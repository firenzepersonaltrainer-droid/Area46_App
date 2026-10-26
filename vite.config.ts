import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "local-demo-api",
      async configureServer(server) {
        const { handleLocalApi } = await import("./local-api");
        server.middlewares.use((req, res, next) => {
          handleLocalApi(req, res, next);
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "@glide/cn",
        replacement: path.resolve(__dirname, "client/lib/cn.ts"),
      },
      {
        find: /^(\.\.\/)*auth$/,
        replacement: path.resolve(__dirname, "client/lib/auth-local.ts"),
      },
      {
        find: /^(\.\/)*auth$/,
        replacement: path.resolve(__dirname, "client/lib/auth-local.ts"),
      },
      {
        find: "auth",
        replacement: path.resolve(__dirname, "client/lib/auth-local.ts"),
      },
    ],
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
});
