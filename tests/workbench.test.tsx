import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workbench } from "../src/components/workbench";
import { ApiSetup } from "../src/components/api-setup";
import { ConnectionProvider } from "../src/components/connection-provider";
import { scenarios } from "../src/lib/product";

describe("workbench", () => {
  it("starts empty, without claiming a scan or an analysis", () => {
    render(<Workbench />);
    expect(screen.getByText("No sources discovered yet")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /findings$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan website" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeDisabled();
    expect(screen.queryByText(/139|207/)).not.toBeInTheDocument();
  });
  it("switches all three scenarios without requesting data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      render(<Workbench />);
      const user = userEvent.setup();
      for (const scenario of scenarios) {
        const button = screen.getByRole("button", { name: new RegExp(scenario.title) });
        await user.click(button);
        expect(button).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("heading", { name: scenario.title })).toBeInTheDocument();
        expect(screen.getByText(scenario.takeaway)).toBeInTheDocument();
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /corrections/i })).not.toBeInTheDocument();
    } finally { fetchSpy.mockRestore(); }
  });
});
describe("API setup", () => {
  it("offers only DeepSeek, without roadmap labels or model calls on opening", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ provider: "deepseek", sharedAvailable: true }));
    render(<ConnectionProvider><ApiSetup /></ConnectionProvider>);
    expect(screen.getByRole("heading", { name: "DeepSeek API" })).toBeInTheDocument();
    expect(screen.queryByText(/NVIDIA|Phase [0-9]/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose your provider" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Bring your own key/ }));
    await userEvent.type(screen.getByLabelText("Your DeepSeek API key"), "test-only-placeholder");
    await userEvent.click(screen.getByRole("radio", { name: /Shared demo access/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Bring your own key/ }));
    expect(screen.getByLabelText("Your DeepSeek API key")).toHaveValue("test-only-placeholder");
    expect(spy.mock.calls.every(([, options]) => !options?.body)).toBe(true);
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    spy.mockRestore();
  });
  it("keeps a personal key in memory, sends it only on explicit test and can clear it", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ provider: "deepseek", sharedAvailable: true })).mockResolvedValueOnce(Response.json({ connected: true, provider: "deepseek", model: "deepseek-flash" }));
    render(<ConnectionProvider><ApiSetup /></ConnectionProvider>);
    expect(screen.getByText("Connection not tested.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Bring your own key/ }));
    expect(screen.getByLabelText("Your DeepSeek API key")).toBeEnabled();
    expect(screen.getByLabelText("Your DeepSeek API key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Your DeepSeek API key"), "test-only-placeholder-key");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText(/Connected. DeepSeek accepted/)).toBeInTheDocument();
    expect(JSON.parse(spy.mock.calls[1][1]!.body as string).key).toBe("test-only-placeholder-key");
    await userEvent.click(screen.getByRole("button", { name: "Clear personal key" }));
    expect(screen.getByLabelText("Your DeepSeek API key")).toHaveValue("");
    await userEvent.click(screen.getByRole("radio", { name: /Shared demo access/ }));
    expect(screen.queryByLabelText("Your DeepSeek API key")).not.toBeInTheDocument();
    spy.mockRestore();
  });
});
