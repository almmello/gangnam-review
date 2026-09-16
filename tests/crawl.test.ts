// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { normalizeSourceUrl, permittedFetchUrl, SOURCE_ORIGIN as O } from "../src/lib/crawl/policy";
import { extractPage } from "../src/lib/crawl/extract";
import { requestSchema, readSmallJson, sameOrigin } from "../src/lib/crawl/http";
const at = "2026-09-15T21:00:00Z";
const profile = O + "/en/clinics/test-clinic/";
const html = (body: string) => `<html lang="en"><head><link rel="canonical" href="${profile}"></head><body><main><h1>Test Clinic</h1>${body}</main></body></html>`;
const card = (body: string) => `<div><div><span>★ 4.5</span><span>ExampleSource · 2026-01-02</span><div title="Machine translation (mt)">Translated from Korean</div></div><span lang="en">${body}</span></div>`;
describe("source policy", () => {
  it("normalizes only supported English source pages", () => {
    expect(normalizeSourceUrl("/en/clinics/test-clinic?tracking=1#reviews")).toBe(profile);
    for (const url of ["http://gangnambeautyguide.com/en/", "https://evil.test/en/", "https://gangnambeautyguide.com.evil.test/en/", "https://user:pass@gangnambeautyguide.com/en/", "http://127.0.0.1/", "file:///etc/passwd", "/ko/clinics/test-clinic/", "/en/doctors/test/", "/en/guides/", "/en/clinics/%2e%2e/%2fprivate/"]) {
      expect(normalizeSourceUrl(url)).toBeNull();
    }
    expect(permittedFetchUrl(O + "/sitemap.xml")).toBe(true);
    expect(permittedFetchUrl("https://evil.test/sitemap.xml")).toBe(false);
    expect(permittedFetchUrl(O + "/private")).toBe(false);
  });
  it("rejects arbitrary, unnormalized and oversized collection requests", () => {
    expect(requestSchema.safeParse({ urls: [profile] }).success).toBe(true);
    expect(requestSchema.safeParse({ urls: [profile + "?x=1"] }).success).toBe(false);
    expect(requestSchema.safeParse({ urls: [profile, profile, profile] }).success).toBe(false);
    expect(requestSchema.safeParse({ urls: [] }).success).toBe(false);
    expect(sameOrigin(new Request("http://localhost/api/collect", { headers: { Origin: "https://evil.test" } }))).toBe(false);
    expect(sameOrigin(new Request("http://localhost:3000/api/collect", { headers: { Origin: "http://127.0.0.1:3000", Host: "127.0.0.1:3000", "Sec-Fetch-Site": "same-origin" } }))).toBe(true);
  });
  it("bounds JSON request bodies", async () => {
    await expect(readSmallJson(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x".repeat(20000) }) }))).rejects.toThrow("too large");
  });
});
describe("current markup extraction", () => {
  it("preserves body, provenance, missing fields and summary distinction", () => {
    const page = extractPage(profile, profile, html("<h2>Test Clinic Patient Reviews (1)</h2><div>" + card("A synthetic patient narrative.") + "</div>"), at);
    expect(page.status).toBe("collected");
    expect(page.reviews).toHaveLength(1);
    expect(page.reviews[0]).toMatchObject({ text: "A synthetic patient narrative.", rating: 4.5, sourceLabel: "ExampleSource", publishedAt: "2026-01-02", contentKind: "translation", originalReviewUrl: null, pageUrl: profile, collectedAt: at });
    const url = O + "/en/reviews/";
    const index = extractPage(url, url, html('<div class="gbg-card-grid"><div><div><a href="/en/clinics/test-clinic">Test Clinic</a><span>★ 5.0</span></div><span>A summary.</span></div></div>'), at);
    expect(index.reviews[0]).toMatchObject({ contentKind: "summary", sourceLabel: null, publishedAt: null, clinicUrl: profile, text: "A summary." });
  });
  it("distinguishes absent review sections from unknown templates and zero-count sections", () => {
    expect(extractPage(profile, profile, html("<h2>Doctors (1)</h2>"), at).status).toBe("no_review_section");
    expect(extractPage(profile, profile, html("<h2>Unexpected structure</h2>"), at).status).toBe("extraction_failed");
    expect(extractPage(profile, profile, "<html>Bot challenge</html>", at).status).toBe("extraction_failed");
    expect(extractPage(profile, profile, html("<h2>Patient Reviews (0)</h2><div></div>"), at).status).toBe("empty_review_section");
    expect(extractPage(profile, profile, html("<h2>Patient Reviews (2)</h2><div><article>Changed template</article></div>"), at).status).toBe("extraction_failed");
  });
  it("extracts changed text and refuses to confuse a redirected directory with a profile", () => {
    const first = extractPage(profile, profile, html("<h2>Patient Reviews (1)</h2><div>" + card("Before") + "</div>"), at);
    const next = extractPage(profile, profile, html("<h2>Patient Reviews (1)</h2><div>" + card("After") + "</div>"), at);
    expect(next.reviews[0].text).toBe("After");
    expect(next.reviews[0].id).not.toBe(first.reviews[0].id);
    expect(extractPage(profile, O + "/en/clinics/", html("<h2>Doctors (1)</h2>"), at).status).toBe("extraction_failed");
  });
  it("keeps unlinked directory names and caps long reviews", () => {
    const directory = O + "/en/clinics/";
    const page = extractPage(directory, directory, html('<a href="/en/clinics/test-clinic/"><h3>Test Clinic</h3></a><div><h3>Unlinked Clinic</h3></div>'), at);
    expect(page.clinics).toHaveLength(2);
    expect(page.clinics[1].url).toBeNull();
    const long = extractPage(profile, profile, html("<h2>Patient Reviews (1)</h2><div>" + card("x".repeat(21000)) + "</div>"), at);
    expect(long.truncated).toBe(true);
    expect(long.reviews[0].text).toHaveLength(20000);
  });
  it("keeps English narratives without translation badges, but flags other declared languages", () => {
    const text = '<h2>Patient Reviews (2)</h2><div><div><span>English original without a badge.</span></div><div><span lang="ko">한국어</span></div></div>';
    const page = extractPage(profile, profile, html(text), at);
    expect(page.reviews).toHaveLength(1);
    expect(page.reviews[0]).toMatchObject({ language: "en", contentKind: "published-review", translationLabel: null });
    expect(page.warnings.some((warning) => warning.includes("non-English"))).toBe(true);
  });
});
