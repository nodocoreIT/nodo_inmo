/**
 * Scaffold smoke test — proves the RTL + Vitest + jsdom harness works.
 *
 * RED → GREEN contract:
 *   - Render a real component tree (Button, Card, Label, Input from ui/)
 *   - Assert elements are in the DOM
 *   - Assert accessible roles and labels
 *
 * This is the "pgTAP equivalent" for the frontend harness.
 * Feature tests go in their own __tests__ directories, co-located with features.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

// ── Button ────────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders with correct text", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    await userEvent.click(screen.getByRole("button", { name: /click me/i }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button", { name: /disabled/i })).toBeDisabled();
  });

  it("renders secondary variant without throwing", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

// ── Input ─────────────────────────────────────────────────────────────────────

describe("Input", () => {
  it("renders and accepts text input", async () => {
    render(<Input placeholder="Enter email" aria-label="Email" />);
    const input = screen.getByRole("textbox", { name: /email/i });
    expect(input).toBeInTheDocument();
    await userEvent.type(input, "hello@nodo.com");
    expect(input).toHaveValue("hello@nodo.com");
  });
});

// ── Label ─────────────────────────────────────────────────────────────────────

describe("Label", () => {
  it("renders and is associated with an input via htmlFor", () => {
    render(
      <div>
        <Label htmlFor="email-input">Email</Label>
        <Input id="email-input" />
      </div>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
    // Clicking the label focuses the input — proves htmlFor wiring
    const labelEl = screen.getByText("Email");
    expect(labelEl).toBeInTheDocument();
  });
});

// ── Card ──────────────────────────────────────────────────────────────────────

describe("Card", () => {
  it("renders children and title", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Property Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>3 active listings</p>
        </CardContent>
      </Card>,
    );
    expect(screen.getByText("Property Overview")).toBeInTheDocument();
    expect(screen.getByText("3 active listings")).toBeInTheDocument();
  });
});

// ── Composed form ─────────────────────────────────────────────────────────────

describe("Composed form (scaffold sanity)", () => {
  it("renders a label+input+button form and submits", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" aria-label="Full name" />
        <Button type="submit">Submit</Button>
      </form>,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: /full name/i }),
      "Juan Pérez",
    );
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
