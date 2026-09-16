"use client";
import { useEffect, useRef, useState } from "react";
import { batchSchema, discoverySchema, type CollectedPage, type Discovery } from "@/lib/crawl/contracts";
import { LIMITS } from "@/lib/crawl/policy";
export type Collection = { startedAt: string; finishedAt: string | null; pages: CollectedPage[]; complete: boolean; note: string | null };
async function post(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(path, { method: "POST", cache: "no-store", signal,
    headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "The request failed.");
  return value;
}
export function useLiveSources() {
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [activity, setActivity] = useState<"idle" | "scanning" | "collecting">("idle");
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function begin() { controller.current?.abort(); const run = new AbortController(); controller.current = run; setError(null); return run; }
  async function scan() {
    const run = begin(); setDiscovery(null); setCollection(null); setActivity("scanning");
    try { const result = discoverySchema.parse(await post("/api/discover", run.signal)); if (!run.signal.aborted) setDiscovery(result); }
    catch (failure) { if (controller.current === run) setError(run.signal.aborted ? "Scan cancelled. No earlier dataset was kept." : failure instanceof Error ? failure.message : "Discovery failed."); }
    finally { if (controller.current === run) setActivity("idle"); }
  }
  async function analyze() {
    if (!discovery?.sources.length) return;
    // Evidence belongs to the discovery run, not to a lens. A finished partial
    // run is retained too; only an explicit source refresh starts a new dataset.
    if (collection?.finishedAt) return collection;
    const run = begin(); setActivity("collecting");
    const result: Collection = { startedAt: new Date().toISOString(), finishedAt: null, pages: [], complete: false, note: null };
    setCollection({ ...result });
    try {
      for (let i = 0; i < discovery.sources.length; i += LIMITS.batch) {
        const urls = discovery.sources.slice(i, i + LIMITS.batch).map((source) => source.url);
        const batch = batchSchema.parse(await post("/api/collect", run.signal, { urls }));
        if (run.signal.aborted) break;
        let used = result.pages.reduce((sum, page) => sum + page.reviews.length, 0);
        for (const page of batch.pages) {
          const room = Math.max(0, LIMITS.reviews - used);
          if (page.reviews.length > room) {
            page.reviews = page.reviews.slice(0, room); page.truncated = true;
            page.warnings.push("This page was truncated by the 500-review run limit.");
          }
          used += page.reviews.length; result.pages.push(page);
        }
        setCollection({ ...result, pages: [...result.pages] });
        if (batch.pages.some((page) => page.stopRequested)) { result.note = "Collection paused because the source or its access policy requested a stop."; break; }
        if (used >= LIMITS.reviews && result.pages.length < discovery.sources.length) { result.note = "The 500-review limit was reached. Remaining pages were not collected."; break; }
      }
      if (run.signal.aborted) result.note = "Collection cancelled. Collected pages remain available as a partial run.";
      result.complete = !run.signal.aborted && !result.note && result.pages.length === discovery.sources.length;
    } catch (failure) {
      result.note = run.signal.aborted ? "Collection cancelled. Collected pages remain available as a partial run." : failure instanceof Error ? failure.message : "Collection interrupted.";
    } finally {
      result.finishedAt = new Date().toISOString();
      if (controller.current === run) { setCollection({ ...result, pages: [...result.pages] }); setActivity("idle"); }
    }
    if (!run.signal.aborted && controller.current === run) return result;
  }
  return { discovery, collection, activity, error, scan, analyze, cancel: () => controller.current?.abort() };
}
