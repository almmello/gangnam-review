import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { createHash } from "node:crypto";
import type { CollectedPage, Review } from "./contracts";
import { LIMITS, normalizeSourceUrl, pageKind } from "./policy";
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
export function emptyPage(url: string): CollectedPage {
  return { url, finalUrl: null, kind: pageKind(url)!, collectedAt: new Date().toISOString(), status: "fetch_failed",
    httpStatus: null, title: null, reviews: [], clinics: [], warnings: [], error: null,
    reportedReviewCount: null, truncated: false, stopRequested: false };
}
function readReview($: CheerioAPI, card: AnyNode, body: AnyNode, page: CollectedPage, position: number, index: boolean): Review | null {
  const text = clean($(body).text());
  if (!text) return null;
  const language = $(body).attr("lang") ?? $("html").attr("lang") ?? null;
  if (language && !/^en(?:-|$)/i.test(language)) {
    page.warnings.push(`Review card ${position} declares a non-English language (${language}); it was not collected.`);
    return null;
  }
  const spans = $(card).find("span").map((_, el) => clean($(el).text())).get();
  const metadata = spans.find((value) => /·\s*\d{4}-\d{2}-\d{2}/.test(value));
  const date = metadata?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const ratingText = spans.find((value) => /^★\s*[0-5](\.\d+)?$/.test(value));
  const rating = ratingText ? Number(ratingText.replace("★", "").trim()) : null;
  const clinicLink = $(card).find('a[href*="/en/clinics/"]').first();
  const linkUrl = clinicLink.attr("href");
  const clinicUrl = index ? (linkUrl ? normalizeSourceUrl(linkUrl, page.finalUrl!) : null) : page.clinics[0]?.url ?? null;
  const translationLabel = clean($(card).find("[title*='translation'], [title*='Translation']").text()) || null;
  return { id: createHash("sha256").update(page.url + "\n" + position + "\n" + text).digest("hex").slice(0, 24),
    pageUrl: page.url, position, locator: index ? `main .gbg-card-grid > div:nth-child(${position})` : `Patient Reviews / card ${position}`,
    collectedAt: page.collectedAt, clinicName: index ? clean(clinicLink.text()) || null : page.title,
    clinicUrl, rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    sourceLabel: metadata ? metadata.split("·")[0].trim() || null : null, publishedAt: date,
    originalReviewUrl: null, text: text.slice(0, LIMITS.text), contentKind: index ? "summary" : translationLabel ? "translation" : "published-review",
    language, translationLabel, textTruncated: text.length > LIMITS.text };
}
export function extractPage(url: string, finalUrl: string, html: string, collectedAt: string, httpStatus = 200): CollectedPage {
  const page = { ...emptyPage(url), finalUrl, collectedAt, httpStatus };
  const $ = load(html);
  $("script, style, noscript, template").remove();
  const main = $("main").first();
  page.title = clean(main.find("h1").first().text()) || null;
  if (!main.length || !page.title) return { ...page, status: "extraction_failed", error: "Expected main content and heading were not found. The template may have changed." };
  if (pageKind(finalUrl) !== page.kind) return { ...page, status: "extraction_failed", error: "The page redirected to a different page type." };
  page.status = "collected";
  if (page.kind === "home") return page;
  if (page.kind === "directory") {
    main.find("h3").each((_, el) => {
      const name = clean($(el).text()); if (!name) return;
      const href = $(el).closest("a").attr("href");
      page.clinics.push({ name, url: href ? normalizeSourceUrl(href, finalUrl) : null, pageUrl: url });
    });
    if (!page.clinics.length) return { ...page, status: "extraction_failed", error: "No clinic headings were found in the expected directory structure." };
    return page;
  }
  if (page.kind === "clinic") {
    const canonical = $('link[rel="canonical"]').attr("href");
    const canonicalUrl = canonical ? normalizeSourceUrl(canonical, finalUrl) : normalizeSourceUrl(finalUrl);
    page.clinics.push({ name: page.title, url: canonicalUrl && pageKind(canonicalUrl) === "clinic" ? canonicalUrl : null, pageUrl: url });
    if (!canonical) page.warnings.push("No canonical tag; the fetched profile URL is used as the observed identity link.");
    const heading = main.find("h2").filter((_, el) => /Patient Reviews/i.test($(el).text())).first();
    if (!heading.length) {
      const knownTemplate = main.find("h2").toArray().some((el) => /Focus procedures|Doctors\s*\(/i.test($(el).text()));
      return { ...page, status: knownTemplate ? "no_review_section" : "extraction_failed", error: knownTemplate ? null : "Clinic template not recognized; review absence cannot be determined." };
    }
    const count = clean(heading.text()).match(/\((\d+)\)$/);
    page.reportedReviewCount = count ? Number(count[1]) : null;
    const cards = heading.next("div").children("div");
    cards.slice(0, LIMITS.reviewsPerPage).each((i, card) => {
      const body = $(card).children("span").first()[0];
      if (body) { const review = readReview($, card, body, page, i + 1, false); if (review) page.reviews.push(review); }
    });
    page.truncated = cards.length > LIMITS.reviewsPerPage;
    if (page.reportedReviewCount !== null && page.reportedReviewCount !== page.reviews.length) page.warnings.push(`The heading reports ${page.reportedReviewCount} reviews; ${page.reviews.length} bodies were extracted.`);
    if (!page.reviews.length) {
      page.status = page.reportedReviewCount === 0 && !cards.length ? "empty_review_section" : "extraction_failed";
      if (page.status === "extraction_failed") page.error = "The review section exists, but its expected review bodies could not be read.";
    } else if (cards.length > page.reviews.length && !page.truncated) page.warnings.push("Some review cards could not be read; extraction is partial.");
  } else {
    const cards = main.find(".gbg-card-grid").first().children("div");
    cards.slice(0, LIMITS.reviewsPerPage).each((i, card) => {
      const body = $(card).children("span").last()[0];
      if (body) { const review = readReview($, card, body, page, i + 1, true); if (review) page.reviews.push(review); }
    });
    page.truncated = cards.length > LIMITS.reviewsPerPage;
    if (!page.reviews.length) { page.status = "extraction_failed"; page.error = "No review summaries were found in the expected card structure."; }
    else if (cards.length > page.reviews.length && !page.truncated) page.warnings.push("Some review summary cards could not be read; extraction is partial.");
    page.warnings.push("Review-index cards are published summaries, not original patient narratives.");
  }
  if (page.truncated) page.warnings.push(`Collection limited to ${LIMITS.reviewsPerPage} review cards on this page.`);
  if (page.reviews.some((review) => review.textTruncated)) { page.truncated = true; page.warnings.push("A review body exceeded the 20,000-character limit and was truncated."); }
  if (page.reviews.length) page.warnings.push("Original review URLs are not available in this extractor; the displayed source labels do not verify the original reviews.");
  return page;
}
