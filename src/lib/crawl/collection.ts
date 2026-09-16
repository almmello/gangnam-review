import "server-only";
import type { CollectedPage } from "./contracts";
import { emptyPage, extractPage } from "./extract";
import { loadRobots, respectDelay } from "./robots";
import { CrawlError, fetchDocument } from "./transport";
export async function collect(urls: string[], signal?: AbortSignal): Promise<CollectedPage[]> {
  let robots: Awaited<ReturnType<typeof loadRobots>>;
  try { robots = await loadRobots(signal); }
  catch (error) { return urls.map((url) => ({ ...emptyPage(url), status: "robots_blocked", stopRequested: true, error: error instanceof Error ? error.message : "robots.txt could not be verified." })); }
  const one = async (url: string): Promise<CollectedPage> => {
    if (!robots.allows(url)) return { ...emptyPage(url), status: "robots_blocked", error: "robots.txt disallows this page." };
    try {
      await respectDelay(robots.delay, signal);
      const result = await fetchDocument(url, signal, robots.allows);
      return extractPage(url, result.url, result.body, result.fetchedAt, result.status);
    } catch (error) {
      return { ...emptyPage(url), error: error instanceof Error ? error.message : "The page could not be collected.",
        httpStatus: error instanceof CrawlError ? error.status : null, stopRequested: error instanceof CrawlError && error.stopRequested };
    }
  };
  // A declared crawl delay takes priority over parallel collection.
  if (robots.delay > 0) {
    const pages: CollectedPage[] = [];
    for (const url of urls) { const page = await one(url); pages.push(page); if (page.stopRequested || signal?.aborted) break; }
    return pages;
  }
  return Promise.all(urls.map(one));
}
