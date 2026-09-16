// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("ai", async (original) => ({ ...await original<typeof import("ai")>(), generateText: vi.fn() }));
import { generateText, APICallError } from "ai";
import { analyzeTask, sharedAvailable, testConnection, resolveKey, connectionInfo } from "../src/lib/analysis/provider";
import { fieldNames, type Task } from "../src/lib/analysis/contracts";
import { POST } from "../src/app/api/ai/analyze/route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); delete (globalThis as typeof globalThis & { gangnamAI?: unknown }).gangnamAI; });
const url = "https://gangnambeautyguide.com/en/clinics/test/";
const task: Task = { lens: "missing-information", records: [{ id: "r1", text: "Good service.", clinic: "Test", clinicUrl: url, pageUrl: url, kind: "summary" }], units: [{ id: "u1", recordIds: ["r1"], candidates: [] }] };
const valid = { findings: [{ unitId: "u1", status: "gaps_found", reason: "No details.", quotes: [], fields: fieldNames.map((name) => ({ name, state: "not_stated", quote: null })), candidateUrl: null }] };
const mockResult = (text: string) => ({ text }) as Awaited<ReturnType<typeof generateText>>;

describe("single semantic pass", () => {
  const pair: Task = { lens: "review-similarity", records: [task.records[0], { ...task.records[0], id: "r2", text: "Different service." }], units: [{ id: "pair", recordIds: ["r1", "r2"], candidates: [] }] };
  const request = () => new Request("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ task: pair, key: "personal-test-placeholder-key", provider: "deepseek" }) });
  const answer = (status: string) => mockResult(JSON.stringify({ findings: [{ unitId: "pair", status, reason: "Shared: service. Differences: wording.", quotes: pair.records.map((r) => ({ recordId: r.id, text: r.text })), fields: [], candidateUrl: null }] }));
  it.each(["similar", "inconclusive"])("returns %s with exactly one model call and no correction or textual metadata", async (status) => {
    vi.mocked(generateText).mockResolvedValueOnce(answer(status));
    const response = await POST(request()); const data = await response.json();
    expect(response.status).toBe(200); expect(data.findings[0].status).toBe(status);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(data.guidance).toBeUndefined(); expect(data.textMatches).toBeUndefined();
    const call = vi.mocked(generateText).mock.calls[0][0];
    expect(call.instructions).toContain("This is the final classification");
    expect(call.prompt).not.toContain("humanClassification");
    expect(call.prompt).not.toContain("personal-test-placeholder-key");
  });
  it("rejects removed repetition labels instead of silently accepting an old classification", async () => {
    vi.mocked(generateText).mockResolvedValue(answer("possible_same_experience"));
    const response = await POST(request());
    expect(response.status).toBe(422); expect((await response.json()).code).toBe("invalid_model_output");
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
describe("DeepSeek boundary", () => {
  it("gives one targeted repair hint without echoing rejected model text", async () => {
    const invalid = { findings: [{ ...valid.findings[0], fields: [{ name: "procedure", state: "stated", quote: "PRIVATE-NONMATCHING-QUOTE" }, ...valid.findings[0].fields.slice(1)] }] };
    vi.mocked(generateText).mockResolvedValueOnce(mockResult(JSON.stringify(invalid))).mockResolvedValueOnce(mockResult(JSON.stringify(valid)));
    const result = await analyzeTask(task, "test-placeholder", new AbortController().signal, "deepseek");
    expect(result.repairCategory).toBe("quotation does not exactly match its source record");
    const repairPrompt = JSON.stringify(vi.mocked(generateText).mock.calls[1][0].prompt);
    expect(repairPrompt).toContain("quotation does not exactly match");
    expect(repairPrompt).not.toContain("PRIVATE-NONMATCHING-QUOTE");
    expect(vi.mocked(generateText).mock.calls[0][0].instructions).toContain("performing this patient's procedure");
  });
  it("returns only a safe category after a second validation failure", async () => {
    vi.mocked(generateText).mockResolvedValue(mockResult("PRIVATE-invalid-json"));
    await expect(analyzeTask(task, "test-placeholder", new AbortController().signal)).rejects.toThrow("validation twice: invalid JSON");
    expect(generateText).toHaveBeenCalledTimes(2);
  });
  it("exposes an item-validation code so the client can continue without accepting invalid evidence", async () => {
    vi.mocked(generateText).mockResolvedValue(mockResult("PRIVATE invalid response"));
    const response = await POST(new Request("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ task, provider: "deepseek", key: "personal-test-placeholder-key" }) }));
    const data = await response.json();
    expect(response.status).toBe(422);
    expect(data.code).toBe("invalid_model_output");
    expect(JSON.stringify(data)).not.toContain("PRIVATE");
    expect(generateText).toHaveBeenCalledTimes(2);
  });
  it("uses only the DeepSeek server key and never exposes it in configuration", () => {
    vi.stubEnv("VERCEL", ""); vi.stubEnv("NVIDIA_API_KEY", "obsolete-test-secret"); vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-test-secret");
    expect(resolveKey()).toBe("deepseek-test-secret");
    expect(resolveKey("personal-test-key")).toBe("personal-test-key");
    expect(JSON.stringify(connectionInfo())).not.toContain("test-secret");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(() => resolveKey()).toThrow("DeepSeek access is unavailable");
    vi.stubEnv("VERCEL", "1"); expect(sharedAvailable()).toBe(false);
  });
  it("routes direct DeepSeek calls with its model and its own non-thinking option", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(mockResult(JSON.stringify(valid)));
    const response = await analyzeTask(task, "deepseek-personal-placeholder", new AbortController().signal, "deepseek");
    expect(response).toMatchObject({ provider: "deepseek", model: "deepseek-flash" });
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(options.model).toMatchObject({ modelId: "deepseek-flash", provider: "deepseek.chat" });
    expect(options.providerOptions).toEqual({ deepseek: { thinking: { type: "disabled" } } });
    expect(JSON.stringify(options.prompt)).not.toContain("deepseek-personal-placeholder");
  });
  it("rejects the removed provider without using any key or calling a model", async () => {
    const response = await POST(new Request("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ task, provider: "nvidia" }) }));
    expect(response.status).toBe(400); expect(generateText).not.toHaveBeenCalled();
  });
  it("rejects unrecognized providers before using any key", async () => {
    const response = await POST(new Request("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ task, provider: "https://attacker.example" }) }));
    expect(response.status).toBe(400); expect(generateText).not.toHaveBeenCalled();
  });
  it("disables public shared access even when a server key exists", () => { vi.stubEnv("DEEPSEEK_API_KEY", "test-not-a-key"); vi.stubEnv("VERCEL", "1"); expect(sharedAvailable()).toBe(false); });
  it("requires an explicit production opt-in and a server key for shared access", () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("DEEPSEEK_API_KEY", "test-not-a-key");
    vi.stubEnv("ENABLE_SHARED_AI", "false"); expect(sharedAvailable()).toBe(false);
    vi.stubEnv("ENABLE_SHARED_AI", "true"); expect(sharedAvailable()).toBe(true);
    expect(JSON.stringify(connectionInfo())).not.toContain("test-not-a-key");
    vi.stubEnv("DEEPSEEK_API_KEY", ""); expect(sharedAvailable()).toBe(false);
  });
  it("repairs once and validates before returning results", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(mockResult('{"findings":[]}')).mockResolvedValueOnce(mockResult(JSON.stringify(valid)));
    const response = await analyzeTask(task, "test-placeholder", new AbortController().signal);
    expect(response.repaired).toBe(true); expect(generateText).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateText).mock.calls[0][0]).toMatchObject({ maxRetries: 0, providerOptions: { deepseek: { thinking: { type: "disabled" } } } });
  });
  it("fails closed after two invalid responses, without exposing raw content", async () => {
    vi.mocked(generateText).mockResolvedValue(mockResult("UNSAFE raw output"));
    await expect(analyzeTask(task, "test-placeholder", new AbortController().signal)).rejects.toThrow("validation twice");
    expect(generateText).toHaveBeenCalledTimes(2);
  });
  it("sanitizes provider errors that may contain secrets", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("secret-provider-header-value"));
    await expect(testConnection("test-placeholder", new AbortController().signal)).rejects.toThrow("failed or timed out");
  });
  it("distinguishes authentication, quota and overloaded service failures", async () => {
    for (const [statusCode, message] of [[401, "did not accept"], [429, "quota or rate"], [529, "overloaded"]] as const) {
      delete (globalThis as typeof globalThis & { gangnamAI?: unknown }).gangnamAI;
      vi.mocked(generateText).mockRejectedValueOnce(new APICallError({ message: "private-header-placeholder", url: "https://api.deepseek.com/chat/completions", requestBodyValues: {}, statusCode }));
      await expect(testConnection("test-placeholder", new AbortController().signal)).rejects.toThrow(message);
    }
  });
  it("rejects cross-site, missing-origin and oversized requests before using the provider", async () => {
    for (const headers of [{}, { origin: "https://evil.example" }] as Record<string, string>[]) {
      const response = await POST(new Request("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ task }) }));
      expect(response.status).toBe(403);
    }
    const response = await POST(new Request("http://localhost:3000/api/ai/analyze", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: "x".repeat(180001) }));
    expect(response.status).toBe(400); expect(generateText).not.toHaveBeenCalled();
  });
});
