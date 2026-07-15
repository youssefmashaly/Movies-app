import { describe, it, expect, beforeEach } from "vitest";

describe("localStorage probe", () => {
  beforeEach(() => {
    console.log("=== VITEST probe ===");
    console.log("typeof localStorage:", typeof localStorage);
    console.log("constructor:", localStorage?.constructor?.name);
    console.log("removeItem is function:", typeof localStorage?.removeItem === "function");
  });

  it("does nothing", () => {
    expect(true).toBe(true);
  });
});