import { describe, it, expect } from "vitest";

describe("Basic Test", () => {
  it("should pass a simple test", () => {
    expect(2 + 2).toBe(4);
  });

  it("should work with strings", () => {
    expect("hello").toBe("hello");
  });

  it("should work with objects", () => {
    const obj = { name: "test", value: 123 };
    expect(obj).toEqual({ name: "test", value: 123 });
  });

  it("should work with arrays", () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it("should handle async functions", async () => {
    const promise = Promise.resolve("async result");
    const result = await promise;
    expect(result).toBe("async result");
  });
});