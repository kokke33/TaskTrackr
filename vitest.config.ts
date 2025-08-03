import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: [path.resolve(__dirname, "tests", "setup.ts")], // 絶対パスに変更
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage", // カバレッジ出力ディレクトリを明示的に指定
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "*.config.*",
        "*.d.ts",
        "client/src/components/ui/**", // Shadcn/uiコンポーネントは除外
      ],
    },
    include: ["tests/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["node_modules", "dist"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@tests": path.resolve(__dirname, "tests"),
    },
  },
});
