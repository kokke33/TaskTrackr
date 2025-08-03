import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  define: {
    // 環境変数をクライアントサイドで利用可能にする
    'import.meta.env.VITE_LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'info'),
    'import.meta.env.VITE_PORT': JSON.stringify(process.env.PORT || '5000'),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
    dedupe: ["react", "react-dom", "wouter"],
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 戦略的バンドル分割でパフォーマンス最適化
        manualChunks: {
          // Core React ライブラリ（最優先でキャッシュ）
          'react-vendor': ['react', 'react-dom'],
          
          // データフェッチング（TanStack Query）
          'query': ['@tanstack/react-query'],
          
          // Radix UI コンポーネント（サイズが大きいため分離）
          'radix-ui': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-tooltip'
          ],
          
          // フォーム関連ライブラリ
          'forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'drizzle-zod'
          ],
          
          // アイコンとUI ユーティリティ
          'ui-utils': [
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          
          // ルーティングとナビゲーション
          'routing': ['wouter'],
          
          // 日付・時間処理
          'date-utils': ['date-fns', 'react-day-picker'],
          
          // マークダウンと文書処理
          'markdown': [
            'react-markdown',
            'remark-gfm',
            'rehype-raw'
          ],
          
          // その他ユーティリティ
          'utils': ['cmdk']
        },
      },
    },
    // チャンクサイズ警告の調整（最適化後の実際のしきい値）
    chunkSizeWarningLimit: 300,
    // 本番ビルドのさらなる最適化
    minify: 'esbuild', // terserの代わりにesbuildを使用（より高速）
    // ソースマップは開発時のみ
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    hmr: {
      port: parseInt(process.env.PORT || '5000', 10),
    },
    port: parseInt(process.env.PORT || '5000', 10),
  },
});
