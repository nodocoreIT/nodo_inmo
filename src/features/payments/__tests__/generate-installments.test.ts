import { describe, it, expect } from "vitest";
import {
  generateInstallments,
  isOverdue,
} from "@/features/payments/lib/generate-installments";

describe("generateInstallments", () => {
  it("generates one installment per month, excluding the end month boundary", () => {
    const out = generateInstallments({
      start_date: "2026-01-01",
      end_date: "2028-01-01",
      rent_amount: 250000,
      currency: "ARS",
      as_of: new Date("2027-12-15"),
    });
    expect(out).toHaveLength(24); // Jan 2026 … Dec 2027
    expect(out[0]).toMatchObject({
      period: "2026-01-01",
      due_date: "2026-01-01",
      amount: 250000,
      currency: "ARS",
      status: "pending",
    });
    expect(out[out.length - 1].period).toBe("2027-12-01");
  });

  it("uses the contract start day-of-month as the due day", () => {
    const out = generateInstallments({
      start_date: "2026-03-10",
      end_date: "2026-06-01",
      rent_amount: 100000,
      currency: "ARS",
    });
    expect(out.map((i) => i.period)).toEqual([
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
    ]);
    expect(out[0].due_date).toBe("2026-03-10");
    expect(out[1].due_date).toBe("2026-04-10");
  });

  it("clamps the due day to the month length (e.g. day 31 → Feb)", () => {
    const out = generateInstallments({
      start_date: "2026-01-31",
      end_date: "2026-04-01",
      rent_amount: 100000,
      currency: "ARS",
    });
    expect(out[0].due_date).toBe("2026-01-31");
    expect(out[1].due_date).toBe("2026-02-28"); // 2026 is not a leap year
    expect(out[2].due_date).toBe("2026-03-31");
  });

  it("does not generate installments beyond the as_of month", () => {
    const out = generateInstallments({
      start_date: "2026-01-01",
      end_date: "2028-01-01",
      rent_amount: 250000,
      currency: "ARS",
      as_of: new Date("2026-06-15"),
    });
    expect(out).toHaveLength(6);
    expect(out[out.length - 1].period).toBe("2026-06-01");
  });

  it("crosses year boundaries correctly", () => {
    const out = generateInstallments({
      start_date: "2026-11-05",
      end_date: "2027-02-01",
      rent_amount: 100000,
      currency: "USD",
      as_of: new Date("2027-01-15"),
    });
    expect(out.map((i) => i.period)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
  });
});

describe("isOverdue", () => {
  const today = new Date("2026-06-15T12:00:00Z");

  it("is true for a pending installment past its due date", () => {
    expect(isOverdue({ status: "pending", due_date: "2026-06-10" }, today)).toBe(true);
  });

  it("is false for a pending installment due in the future", () => {
    expect(isOverdue({ status: "pending", due_date: "2026-06-20" }, today)).toBe(false);
  });

  it("is false for a paid installment regardless of due date", () => {
    expect(isOverdue({ status: "paid", due_date: "2026-06-10" }, today)).toBe(false);
  });
});
