/**
 * TDD — BrandMark
 * The shared Nodo lockup: node icon + "nodo" wordmark + orange "inmo" suffix.
 * Two background tones: light (default, navy text + navy mark) and dark
 * (white text + white mark) for the navy sidebar.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandMark } from "@/shared/components/brand-mark";

describe("BrandMark", () => {
  it("renders the nodo + inmo wordmark", () => {
    render(<BrandMark />);
    expect(screen.getByText("nodo")).toBeInTheDocument();
    expect(screen.getByText("inmo")).toBeInTheDocument();
  });

  it("uses the navy node mark on light backgrounds (default)", () => {
    const { container } = render(<BrandMark useLegacyIcon />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/brand/nodo-mark.png");
  });

  it("uses the white node mark on dark backgrounds", () => {
    const { container } = render(<BrandMark onDark useLegacyIcon />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/brand/nodo-mark-white.png");
  });

  it("colors the nodo wordmark navy on light and white on dark", () => {
    const { rerender } = render(<BrandMark useLegacyIcon />);
    expect(screen.getByText("nodo")).toHaveClass("text-navy");

    rerender(<BrandMark onDark useLegacyIcon />);
    expect(screen.getByText("nodo")).toHaveClass("text-white");
  });

  it("always keeps the inmo suffix in brand orange", () => {
    render(<BrandMark useLegacyIcon />);
    expect(screen.getByText("inmo")).toHaveClass("text-brand");
  });

  it("marks the icon as decorative (empty alt) since the wordmark is the label", () => {
    const { container } = render(<BrandMark useLegacyIcon />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
  });
});
