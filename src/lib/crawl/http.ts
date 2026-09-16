import "server-only";
import { z } from "zod";
import { LIMITS, normalizeSourceUrl } from "./policy";
export const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (!origin) return true; // Public read-only API, not an authentication boundary.
  try {
    const supplied = new URL(origin);
    const internal = new URL(request.url);
    // Next may represent a loopback request as localhost even when the browser
    // uses 127.0.0.1. Compare the actual Host as well, preserving scheme checks.
    return supplied.origin === internal.origin ||
      (supplied.host === request.headers.get("host") && supplied.protocol === internal.protocol);
  } catch { return false; }
}
export const requestSchema = z.object({ urls: z.array(z.string().max(2048).refine((url) => normalizeSourceUrl(url) === url, "Unsupported source URL")).min(1).max(LIMITS.batch) }).strict();
export async function readSmallJson(request: Request, maxBytes = 16384): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Expected application/json.");
  if (Number(request.headers.get("content-length")) > maxBytes || !request.body) throw new Error("Invalid request size.");
  const reader = request.body.getReader();
  let bytes = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength; if (bytes > maxBytes) throw new Error("Request too large.");
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
