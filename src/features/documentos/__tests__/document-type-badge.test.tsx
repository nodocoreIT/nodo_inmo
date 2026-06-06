/**
 * TDD — DocumentTypeBadge component
 *
 * Test cases:
 *  1. Renders correct color class for each of 4 types
 *  2. Renders capitalized label for each type
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocumentTypeBadge } from "@/features/documentos/components/document-type-badge";

describe("DocumentTypeBadge", () => {
  const cases: Array<[string, string, string]> = [
    ["factura",     "Factura",     "bg-blue-100"],
    ["presupuesto", "Presupuesto", "bg-yellow-100"],
    ["certificado", "Certificado", "bg-green-100"],
    ["otro",        "Otro",        "bg-gray-100"],
  ];

  it.each(cases)('renders correct color for type "%s"', (type, _label, colorClass) => {
    const { container } = render(<DocumentTypeBadge type={type} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain(colorClass);
  });

  it.each(cases)('renders capitalized label "%s" for type "%s"', (type, label) => {
    render(<DocumentTypeBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders fallback for unknown type", () => {
    const { container } = render(<DocumentTypeBadge type="unknown" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-gray-100");
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
