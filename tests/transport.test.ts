// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchDocument } from "../src/lib/crawl/transport";
import { SOURCE_ORIGIN as O } from "../src/lib/crawl/policy";
afterEach(() => vi.restoreAllMocks());
describe("bounded source transport", () => {
  it("uses fresh requests and follows only permitted redirects", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: O + "/en/" } })).mockResolvedValueOnce(new Response("<main>ok</main>", { headers: { "Content-Type": "text/html" } }));
    expect((await fetchDocument(O + "/")).body).toContain("ok");
    expect(spy).toHaveBeenCalledWith(O + "/en/", expect.objectContaining({ cache: "no-store", redirect: "manual" }));
    spy.mockReset().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } }));
    await expect(fetchDocument(O + "/en/")).rejects.toThrow("outside");
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported content and oversized responses", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("binary", { headers: { "Content-Type": "application/octet-stream" } }));
    await expect(fetchDocument(O + "/en/")).rejects.toThrow("content type");
    spy.mockResolvedValueOnce(new Response("x", { headers: { "Content-Type": "text/html", "Content-Length": "6000000" } }));
    await expect(fetchDocument(O + "/en/")).rejects.toThrow("5 MB");
  });
  it("supports cancellation without retry", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const controller = new AbortController(); controller.abort();
    await expect(fetchDocument(O + "/en/", controller.signal)).rejects.toThrow("cancelled");
    expect(spy).not.toHaveBeenCalled();
  });
  it("reports the request timeout explicitly", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new DOMException("Timed out", "TimeoutError")));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    await expect(fetchDocument(O + "/en/")).rejects.toThrow("15 second timeout");
  });
  it("retries a transient upstream failure once", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("unavailable", { status: 503 })).mockResolvedValueOnce(new Response("<main>Recovered</main>", { headers: { "Content-Type": "text/html" } }));
    expect((await fetchDocument(O + "/en/")).body).toContain("Recovered");
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it("stops on HTTP 429 without retrying", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("limit", { status: 429, headers: { "Retry-After": "1" } }));
    await expect(fetchDocument(O + "/en/")).rejects.toMatchObject({ status: 429, stopRequested: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
