import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAnalysis } from "../src/components/use-analysis";
import { fieldNames, type Task } from "../src/lib/analysis/contracts";
import type { Collection } from "../src/components/use-live-sources";
import { PROVIDERS, type ProviderId } from "../src/lib/analysis/providers";
import { ConnectionProvider, useConnection } from "../src/components/connection-provider";
const time = "2026-09-15T22:00:00Z";
const dataset: Collection = { startedAt: time, finishedAt: time, complete: true, note: null, pages: ["one", "two"].map((name) => {
  const url = `https://gangnambeautyguide.com/en/clinics/${name}/`;
  return { url, finalUrl: url, kind: "clinic", collectedAt: time, status: "collected", httpStatus: 200, title: name, clinics: [{ name, url, pageUrl: url }], warnings: [], error: null, reportedReviewCount: null, truncated: false, stopRequested: false, reviews: [{ id: name, pageUrl: url, position: 1, locator: "Review 1", collectedAt: time, clinicName: name, clinicUrl: url, rating: null, sourceLabel: null, publishedAt: null, originalReviewUrl: null, text: "Good service.", contentKind: "published-review", language: "en", translationLabel: null, textTruncated: false }] };
}) };
function answer(options?: RequestInit) {
  const task = JSON.parse(options?.body as string).task as Task;
  const provider = JSON.parse(options?.body as string).provider as ProviderId;
  return Response.json({ provider, model: PROVIDERS[provider].model, findings: task.units.map((unit) => ({ unitId: unit.id, status: "gaps_found", reason: "No procedure details in the text.", quotes: [], fields: fieldNames.map((name) => ({ name, state: "not_stated", quote: null })), candidateUrl: null })) });
}
afterEach(() => vi.restoreAllMocks());
describe("analysis lifecycle", () => {
  it("explicitly reruns a completed lens without recollection and preserves other lenses", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => answer(options));
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(dataset, "missing-information"));
    await act(() => result.current.run(dataset, "clinic-identity"));
    const identity = result.current.reports["clinic-identity"];
    const requests = spy.mock.calls.length;
    await act(() => result.current.run(dataset, "missing-information"));
    expect(spy.mock.calls.length).toBe(requests);
    await act(() => result.current.run(dataset, "missing-information", true));
    expect(spy.mock.calls.length).toBeGreaterThan(requests);
    expect(result.current.reports["clinic-identity"]).toBe(identity);
    expect(result.current.reports["missing-information"]?.results).toHaveLength(2);
    expect(spy.mock.calls.every(([url]) => url === "/api/ai/analyze")).toBe(true);
  });
  it("isolates an invalid item, preserves valid batch neighbours and continues subsequent batches", async () => {
    const first = dataset.pages[0];
    const mixed = { ...dataset, pages: [{ ...first, reviews: [first.reviews[0], { ...first.reviews[0], id: "valid-neighbour" }] }, dataset.pages[1]] };
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const task = JSON.parse(options?.body as string).task as Task;
      if (task.units.length > 1 || task.units[0].id === "one") return Response.json({ code: "invalid_model_output", error: "Quotation was rejected." }, { status: 422 });
      return answer(options);
    });
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(mixed, "missing-information"));
    const report = result.current.reports["missing-information"]!;
    expect(report.status).toBe("complete");
    expect(report.error).toBeNull();
    expect(report.results.map((r) => r.unitId)).toEqual(["valid-neighbour", "two"]);
    expect(report.issues).toEqual([{ record: expect.objectContaining({ id: "one" }), reasons: ["invalid_output"] }]);
    expect(report.processedUnitIds).toHaveLength(3);
    expect(report.completedTasks).toBe(report.tasks);
    expect(spy).toHaveBeenCalledTimes(4);
  });
  it("records inconclusive items individually without retaining an assigned pair", async () => {
    const first = dataset.pages[0];
    const pairData = { ...dataset, pages: [{ ...first, reviews: [first.reviews[0], { ...first.reviews[0], id: "second" }] }] };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => {
      const task = JSON.parse(options?.body as string).task as Task;
      return Response.json({ provider: "deepseek", model: PROVIDERS.deepseek.model, findings: task.units.map((unit) => ({ unitId: unit.id, status: "inconclusive", reason: "Generic text does not establish a relationship.", quotes: unit.recordIds.map((recordId) => ({ recordId, text: "Good service." })), fields: [], candidateUrl: null })) });
    });
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(pairData, "review-similarity"));
    const report = result.current.reports["review-similarity"]!;
    expect(report.status).toBe("complete");
    expect(report.results).toHaveLength(0);
    expect(report.processedUnitIds).toHaveLength(1);
    expect(report.issues).toHaveLength(2);
    expect(report.issues?.map((issue) => issue.record.id)).toEqual(["one", "second"]);
  });
  it("resumes an isolated batch after a provider-wide interruption without duplicating settled items", async () => {
    const first = dataset.pages[0];
    const mixed = { ...dataset, pages: [{ ...first, reviews: [first.reviews[0], { ...first.reviews[0], id: "second" }] }] };
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ code: "invalid_model_output" }, { status: 422 }))
      .mockImplementationOnce(async (_, options) => answer(options))
      .mockResolvedValueOnce(Response.json({ error: "Provider quota reached." }, { status: 429 }))
      .mockImplementationOnce(async (_, options) => answer(options));
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(mixed, "missing-information"));
    expect(result.current.reports["missing-information"]?.status).toBe("partial");
    expect(result.current.reports["missing-information"]?.results).toHaveLength(1);
    await act(() => result.current.run(mixed, "missing-information"));
    const report = result.current.reports["missing-information"]!;
    expect(report.status).toBe("complete");
    expect(report.processedUnitIds).toEqual(["one", "second"]);
    expect(report.results).toHaveLength(2);
    expect(report.issues).toHaveLength(0);
    const last = JSON.parse(spy.mock.calls[3][1]?.body as string).task as Task;
    expect(last.units).toHaveLength(1);
    expect(last.units[0].id).toBe("second");
  });
  it("quarantines invalid evidence even in a successful HTTP response and continues", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_, options) => {
      const data = await answer(options).json();
      data.findings[0].fields[0] = { name: "procedure", state: "stated", quote: "Invented quotation" };
      return Response.json(data);
    }).mockImplementationOnce(async (_, options) => answer(options));
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(dataset, "missing-information"));
    const report = result.current.reports["missing-information"]!;
    expect(report.status).toBe("complete");
    expect(report.results).toHaveLength(1);
    expect(report.issues?.[0].reasons).toEqual(["invalid_output"]);
    expect(JSON.stringify(report)).not.toContain("Invented quotation");
  });
  it("reuses completed reports after changing connection mode without recollecting", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_, options) => answer(options));
    const { result } = renderHook(() => ({ ai: useAnalysis(), connection: useConnection() }), { wrapper: ConnectionProvider });
    await act(() => result.current.ai.run(dataset, "missing-information"));
    expect(result.current.ai.reports["missing-information"]?.provider).toBe("deepseek");
    act(() => { result.current.connection.setMode("personal"); result.current.connection.setKey("test-only-placeholder"); });
    await act(() => result.current.ai.run(dataset, "missing-information"));
    expect(Object.keys(result.current.ai.allReports)).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.ai.reports["missing-information"]?.collectionStartedAt).toBe(time);
    expect(spy.mock.calls.every(([url]) => url === "/api/ai/analyze")).toBe(true);
  });
  it("rejects a response attributed to another provider", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ provider: "unsupported-provider", model: PROVIDERS.deepseek.model, findings: [] }));
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(dataset, "missing-information"));
    expect(result.current.reports["missing-information"]?.error).toContain("mismatch");
    expect(result.current.reports["missing-information"]?.results).toHaveLength(0);
  });
  it("resumes only unfinished batches, caches completed lenses and resets on refresh", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_, options) => answer(options)).mockResolvedValueOnce(Response.json({ error: "Quota reached. Change key or resume later." }, { status: 429 })).mockImplementationOnce(async (_, options) => answer(options));
    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(dataset, "missing-information"));
    expect(result.current.reports["missing-information"]?.status).toBe("partial");
    expect(result.current.reports["missing-information"]?.results).toHaveLength(1);
    await act(() => result.current.run(dataset, "missing-information"));
    expect(result.current.reports["missing-information"]?.status).toBe("complete");
    expect(result.current.reports["missing-information"]?.results).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(3);
    await act(() => result.current.run(dataset, "clinic-identity"));
    expect(result.current.reports["clinic-identity"]?.results).toHaveLength(2);
    await act(() => result.current.run(dataset, "missing-information"));
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls.every(([path]) => path === "/api/ai/analyze")).toBe(true);
    expect(result.current.reports["missing-information"]?.collectionStartedAt).toBe(time);
    act(() => result.current.reset());
    expect(result.current.reports).toEqual({});
  });
  it("cancels a pending request without accepting late findings", async () => {
    let release: (() => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_, options) => new Promise((resolve) => { release = () => resolve(answer(options)); }));
    const { result } = renderHook(() => useAnalysis());
    let job: Promise<void>;
    act(() => { job = result.current.run(dataset, "missing-information"); });
    await waitFor(() => expect(result.current.active).toBe("missing-information"));
    act(() => result.current.cancel());
    await act(async () => { release!(); await job; });
    expect(result.current.reports["missing-information"]?.status).toBe("partial");
    expect(result.current.reports["missing-information"]?.results).toHaveLength(0);
    expect(result.current.active).toBeNull();
  });
});
