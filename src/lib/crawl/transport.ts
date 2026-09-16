import "server-only";
import { LIMITS, USER_AGENT, permittedFetchUrl } from "./policy";
export class CrawlError extends Error {
  constructor(message: string, public status: number | null = null, public stopRequested = false) { super(message); }
}
let inFlight = 0;
let cooldownUntil = 0;
const queue: (() => void)[] = [];
async function acquire() {
  if (inFlight < 2) { inFlight++; return; }
  if (queue.length >= 8) throw new CrawlError("The collector is busy. Please try again later.", 503, true);
  await new Promise<void>((resolve) => queue.push(resolve));
}
function release() { const next = queue.shift(); if (next) next(); else inFlight--; }
async function readBounded(response: Response) {
  if (!response.body) throw new CrawlError("The source returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > LIMITS.bytes) throw new CrawlError("The page exceeds the 5 MB collection limit.");
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function fetchDocument(input: string, signal?: AbortSignal, allowed: (url: string) => boolean = () => true) {
  await acquire();
  try {
    if (signal?.aborted) throw new CrawlError("Collection cancelled.");
    if (Date.now() < cooldownUntil) throw new CrawlError("The source requested a pause. Please try again later.", 429, true);
    for (let attempt = 0; attempt < 2; attempt++) {
      const timeout = AbortSignal.timeout(LIMITS.timeout);
      const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let url = input;
      try {
        for (let redirects = 0; redirects <= 3; redirects++) {
          if (!permittedFetchUrl(url)) throw new CrawlError("The URL or redirect is outside the permitted source.");
          if (!allowed(url)) throw new CrawlError("robots.txt disallows this page.", 403);
          const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: requestSignal,
            headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml,text/xml,text/plain", "Cache-Control": "no-cache" } });
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            await response.body?.cancel();
            const location = response.headers.get("location");
            if (!location || redirects === 3) throw new CrawlError("The source redirected too many times.", response.status);
            url = new URL(location, url).href;
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel();
            if (response.status === 429) {
              const retry = response.headers.get("retry-after");
              const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 60000;
              cooldownUntil = Date.now() + Math.max(1000, Number.isFinite(delay) ? delay : 60000);
              throw new CrawlError("The source returned HTTP 429. Collection stopped; respect its retry window.", 429, true);
            }
            if (response.status >= 500 && attempt === 0) break;
            throw new CrawlError(`The source returned HTTP ${response.status}.`, response.status);
          }
          const contentType = response.headers.get("content-type") ?? "";
          if (!/(text\/html|application\/xhtml\+xml|application\/xml|text\/xml|text\/plain)/i.test(contentType)) {
            await response.body?.cancel();
            throw new CrawlError("The source returned an unsupported content type.", response.status);
          }
          if (Number(response.headers.get("content-length")) > LIMITS.bytes) {
            await response.body?.cancel(); throw new CrawlError("The page exceeds the 5 MB collection limit.");
          }
          return { url, status: response.status, body: await readBounded(response), fetchedAt: new Date().toISOString() };
        }
      } catch (error) {
        if (error instanceof CrawlError) throw error;
        if (requestSignal.aborted) throw new CrawlError(signal?.aborted ? "Collection cancelled." : "The source exceeded the 15 second timeout.");
        if (attempt === 1) throw new CrawlError("The source could not be reached.");
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new CrawlError("The source could not be reached.");
  } finally { release(); }
}
