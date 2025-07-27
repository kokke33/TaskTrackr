import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("Utils", () => {
  describe("cn (className utility)", () => {
    it("should combine class names", () => {
      const result = cn("class1", "class2");
      expect(result).toContain("class1");
      expect(result).toContain("class2");
    });

    it("should handle conditional classes", () => {
      const result = cn("base", true && "conditional", false && "hidden");
      expect(result).toContain("base");
      expect(result).toContain("conditional");
      expect(result).not.toContain("hidden");
    });

    it("should handle undefined and null values", () => {
      const result = cn("base", undefined, null, "valid");
      expect(result).toContain("base");
      expect(result).toContain("valid");
      expect(result).not.toContain("undefined");
      expect(result).not.toContain("null");
    });

    it("should merge Tailwind classes correctly", () => {
      // Tailwindのクラスのマージをテスト
      const result = cn("px-2 py-1", "px-4");
      // clsx + tailwind-merge により px-2 は px-4 に上書きされる
      expect(result).toContain("px-4");
      expect(result).toContain("py-1");
    });

    it("should handle empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("should handle array of classes", () => {
      const classes = ["class1", "class2", "class3"];
      const result = cn(...classes);
      classes.forEach(cls => {
        expect(result).toContain(cls);
      });
    });
  });
});