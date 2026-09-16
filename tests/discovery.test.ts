// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/crawl/transport", async (original) => {
  const actual = await original<typeof import("../src/lib/crawl/transport")>();
  return { ...actual, fetchDocument: vi.fn() };
});
import { fetchDocument, CrawlError } from "../src/lib/crawl/transport";
import { discover } from "../src/lib/crawl/discovery";
import { collect } from "../src/lib/crawl/collection";
import { SOURCE_ORIGIN as O, ROBOTS_URL, SITEMAP_URL } from "../src/lib/crawl/policy";
const fetchMock = vi.mocked(fetchDocument);
let name = "old-clinic", body = "Fresh review";
beforeEach(() => {
  name = "old-clinic"; body = "Fresh review"; fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    let html = "<main><h1>Entry point</h1></main>";
    if (url === ROBOTS_URL) html = "User-agent: *\nAllow: /";
    else if (url === SITEMAP_URL) html = `<urlset><url><loc>${O}/en/clinics/${name}/</loc></url><url><loc>${O}/ko/clinics/excluded/</loc></url></urlset>`;
    else if (url.includes("/en/clinics/old-clinic/")) html = `<main><h1>Old Clinic</h1><h2>Patient Reviews (1)</h2><div><div><div><span>★ 5.0</span></div><span lang="en">${body}</span></div></div></main>`;
    return { url, status: 200, body: html, fetchedAt: new Date().toISOString() };
  });
});
describe("two-stage fresh collection", () => {
  it("discovers added URLs and forgets removed URLs on every scan, without collecting profiles", async () => {
    const first = await discover();
    expect(first.sources.some((source) => source.url.endsWith("/old-clinic/"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/old-clinic/"))).toBe(false);
    name = "new-clinic";
    const second = await discover();
    expect(second.sources.some((source) => source.url.endsWith("/new-clinic/"))).toBe(true);
    expect(second.sources.some((source) => source.url.endsWith("/old-clinic/"))).toBe(false);
    expect(second.sources.some((source) => source.url.includes("/ko/"))).toBe(false);
  });
  it("fetches the content again and exposes removal after discovery", async () => {
    await discover(); body = "Changed after scan";
    const url = O + "/en/clinics/old-clinic/";
    expect((await collect([url]))[0].reviews[0].text).toBe("Changed after scan");
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (...args) => { if (args[0] === url) throw new CrawlError("HTTP 404", 404); return original(...args); });
    const removed = (await collect([url]))[0];
    expect(removed.status).toBe("fetch_failed"); expect(removed.httpStatus).toBe(404); expect(removed.reviews).toEqual([]);
  });
  it("honors robots rules and fails closed when robots is unavailable", async () => {
    fetchMock.mockResolvedValue({ url: ROBOTS_URL, status: 200, body: "User-agent: *\nDisallow: /en/", fetchedAt: "now" });
    expect((await collect([O + "/en/clinics/old-clinic/"]))[0].status).toBe("robots_blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValue(new CrawlError("Robots unavailable"));
    await expect(discover()).rejects.toThrow("Robots unavailable");
    expect((await collect([O + "/en/"]))[0].stopRequested).toBe(true);
  });
  it("marks missing sitemap coverage rather than silently using historical data", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (...args) => { if (args[0] === SITEMAP_URL) throw new CrawlError("HTTP 404", 404); return original(...args); });
    const result = await discover();
    expect(result.partial).toBe(true); expect(result.sources).toHaveLength(3);
    expect(result.sources.every((source) => source.kind !== "clinic")).toBe(true);
  });
});
