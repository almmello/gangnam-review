export const SOURCE_ORIGIN = "https://gangnambeautyguide.com";
export const ROBOTS_URL = `${SOURCE_ORIGIN}/robots.txt`;
export const SITEMAP_URL = `${SOURCE_ORIGIN}/sitemap.xml`;
export const SEEDS = ["/en/", "/en/clinics/", "/en/reviews/"].map((path) => SOURCE_ORIGIN + path);
export const LIMITS = { pages: 200, reviews: 500, reviewsPerPage: 100, text: 20000, bytes: 5_000_000, timeout: 15000, batch: 2, sitemaps: 4 } as const;
export const USER_AGENT = "GangnamReview/0.2 (+https://gangnam-review.vercel.app)";
export type PageKind = "home" | "directory" | "reviews" | "clinic";
export function pageKind(input: string): PageKind | null {
  const path = new URL(input).pathname;
  if (path === "/en/") return "home";
  if (path === "/en/clinics/") return "directory";
  if (path === "/en/reviews/") return "reviews";
  return /^\/en\/clinics\/[a-z0-9][a-z0-9-]*\/$/.test(path) ? "clinic" : null;
}
export function normalizeSourceUrl(input: string, base = SOURCE_ORIGIN): string | null {
  try {
    const url = new URL(input, base);
    if (url.origin !== SOURCE_ORIGIN || url.username || url.password || /[%\\]/.test(url.pathname)) return null;
    url.search = ""; url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    return pageKind(url.href) ? url.href : null;
  } catch { return null; }
}
export function permittedFetchUrl(input: string): boolean {
  try {
    const url = new URL(input);
    if (url.origin !== SOURCE_ORIGIN || url.username || url.password || url.search || url.hash || /[%\\]/.test(url.pathname)) return false;
    return url.pathname === "/" || url.pathname === "/robots.txt" || /^\/sitemap[a-z0-9/_-]*\.xml$/.test(url.pathname) || normalizeSourceUrl(input) !== null;
  } catch { return false; }
}
