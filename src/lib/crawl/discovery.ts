import "server-only";
import { load } from "cheerio";
import { randomUUID } from "node:crypto";
import type { Discovery, DiscoveredSource } from "./contracts";
import { LIMITS, SEEDS, SITEMAP_URL, SOURCE_ORIGIN, normalizeSourceUrl, pageKind, permittedFetchUrl } from "./policy";
import { CrawlError, fetchDocument } from "./transport";
import { loadRobots, respectDelay } from "./robots";
export async function discover(signal?: AbortSignal): Promise<Discovery> {
  const startedAt = new Date().toISOString();
  const found = new Map<string, DiscoveredSource>();
  const warnings: string[] = [];
  const robots = await loadRobots(signal);
  const add = (input: string, from: string) => {
    const url = normalizeSourceUrl(input, from.startsWith("https://") ? from : SOURCE_ORIGIN);
    if (!url) return;
    const existing = found.get(url);
    if (existing) { if (!existing.discoveredFrom.includes(from)) existing.discoveredFrom.push(from); }
    else found.set(url, { url, kind: pageKind(url)!, discoveredFrom: [from], discoveredAt: new Date().toISOString() });
  };
  const read = async (url: string) => { await respectDelay(robots.delay, signal); return fetchDocument(url, signal, robots.allows); };
  const recordError = (url: string, error: unknown) => {
    if (signal?.aborted || (error instanceof CrawlError && error.stopRequested)) throw error;
    warnings.push(`${url}: ${error instanceof Error ? error.message : "Source unavailable."}`);
  };
  try {
    const sitemap = await read(SITEMAP_URL);
    const xml = load(sitemap.body, { xml: true });
    if (xml("urlset").length) xml("url > loc").each((_, element) => add(xml(element).text().trim(), SITEMAP_URL));
    else if (xml("sitemapindex").length) {
      const children = xml("sitemap > loc").map((_, el) => xml(el).text().trim()).get();
      if (children.length > LIMITS.sitemaps) warnings.push("Sitemap discovery was limited to four child sitemaps.");
      for (const child of children.slice(0, LIMITS.sitemaps)) {
        if (!permittedFetchUrl(child) || !child.endsWith(".xml")) { warnings.push("An out-of-scope sitemap was skipped."); continue; }
        try {
          const result = await read(child);
          const doc = load(result.body, { xml: true });
          if (!doc("urlset").length) warnings.push(`${child}: unsupported or nested sitemap structure.`);
          else doc("url > loc").each((_, el) => add(doc(el).text().trim(), child));
        } catch (error) { recordError(child, error); }
      }
    } else warnings.push("The sitemap did not have a supported XML structure; entry-point links were used.");
  } catch (error) { recordError(SITEMAP_URL, error); }
  for (const url of SEEDS) {
    try {
      const response = await read(url);
      const $ = load(response.body);
      if (!$("main").length || !$("main h1").length) { warnings.push(`${url}: the page structure was not recognized.`); continue; }
      add(url, "entry point");
      $("main a[href]").each((_, el) => add($(el).attr("href")!, response.url));
    } catch (error) { recordError(url, error); }
  }
  const rank = { home: 0, directory: 1, reviews: 2, clinic: 3 };
  const sources = [...found.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || a.url.localeCompare(b.url));
  const omitted = Math.max(0, sources.length - LIMITS.pages);
  if (omitted) warnings.push(`${omitted} URLs omitted by the ${LIMITS.pages}-page limit.`);
  return { id: randomUUID(), startedAt, finishedAt: new Date().toISOString(), sources: sources.slice(0, LIMITS.pages), totalFound: sources.length, omitted, warnings, partial: warnings.length > 0 };
}
