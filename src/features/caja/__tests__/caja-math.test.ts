import { describe, it, expect } from "vitest";
import { computeBalance, groupPendingByOwner } from "@/features/caja/lib/caja-math";

describe("computeBalance", () => {
  it("adds income and subtracts expense", () => {
    expect(
      computeBalance([
        { type: "income", amount: 25000 },
        { type: "income", amount: 50000 },
        { type: "expense", amount: 20000 },
      ]),
    ).toBe(55000);
  });

  it("is 0 for no movements", () => {
    expect(computeBalance([])).toBe(0);
  });
});

describe("groupPendingByOwner", () => {
  const settlements = [
    { id: "s1", owner_id: "o1", amount: 225000, currency: "ARS", status: "pending", owner: { name: "Juan" } },
    { id: "s2", owner_id: "o1", amount: 225000, currency: "ARS", status: "pending", owner: { name: "Juan" } },
    { id: "s3", owner_id: "o2", amount: 90000, currency: "ARS", status: "pending", owner: { name: "Ana" } },
    { id: "s4", owner_id: "o1", amount: 225000, currency: "ARS", status: "settled", owner: { name: "Juan" } },
  ];

  it("groups pending settlements per owner and sums the totals", () => {
    const groups = groupPendingByOwner(settlements);
    const juan = groups.find((g) => g.owner_id === "o1");
    const ana = groups.find((g) => g.owner_id === "o2");

    expect(juan).toMatchObject({ owner_name: "Juan", total: 450000 });
    expect(juan?.settlement_ids).toEqual(["s1", "s2"]);
    expect(ana).toMatchObject({ owner_name: "Ana", total: 90000 });
  });

  it("ignores already-settled rows", () => {
    const juan = groupPendingByOwner(settlements).find((g) => g.owner_id === "o1");
    expect(juan?.settlement_ids).not.toContain("s4");
  });
});
