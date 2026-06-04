import { describe, it, expect } from "vitest";
import { matchesQuery } from "@/shared/search/matches-query";

describe("matchesQuery", () => {
  it("matches everything when the query is empty or whitespace", () => {
    expect(matchesQuery(["anything"], "")).toBe(true);
    expect(matchesQuery(["anything"], "   ")).toBe(true);
  });

  it("matches case-insensitively on a substring", () => {
    expect(matchesQuery(["Av. Corrientes 1234"], "corrientes")).toBe(true);
    expect(matchesQuery(["Av. Corrientes 1234"], "CORRIENTES")).toBe(true);
  });

  it("returns true if ANY part matches", () => {
    expect(matchesQuery(["Juan", "juan@mail.com", null], "mail")).toBe(true);
  });

  it("returns false when no part matches", () => {
    expect(matchesQuery(["Juan", "juan@mail.com"], "zzz")).toBe(false);
  });

  it("ignores null and undefined parts", () => {
    expect(matchesQuery([null, undefined], "x")).toBe(false);
  });

  it("coerces numbers to strings before matching", () => {
    expect(matchesQuery([250000], "2500")).toBe(true);
  });
});
