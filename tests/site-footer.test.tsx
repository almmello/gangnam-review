import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../src/components/site-footer";

describe("site footer", () => {
  it("links to Alexandre's website without replacing the current analysis tab", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: "almmello.com" });
    expect(link).toHaveAttribute("href", "https://almmello.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: /Explore Gangnam Beauty Guide/ })).toBeInTheDocument();
  });
});
