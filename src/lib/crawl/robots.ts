import "server-only";
import robotsParser from "robots-parser";
import { ROBOTS_URL, USER_AGENT } from "./policy";
import { CrawlError, fetchDocument } from "./transport";
export async function loadRobots(signal?: AbortSignal) {
  const result = await fetchDocument(ROBOTS_URL, signal);
  if (!/^\s*user-agent\s*:/im.test(result.body)) throw new CrawlError("A valid robots.txt could not be verified. Collection paused.", null, true);
  const rules = robotsParser(ROBOTS_URL, result.body);
  return { allows: (url: string) => rules.isAllowed(url, USER_AGENT) !== false, delay: Math.max(0, (rules.getCrawlDelay(USER_AGENT) ?? 0) * 1000) };
}
export async function respectDelay(milliseconds: number, signal?: AbortSignal) {
  if (milliseconds > 10000) throw new CrawlError("The source requests a crawl delay beyond this prototype's time budget.", null, true);
  if (!milliseconds) return;
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new CrawlError("Collection cancelled.")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
