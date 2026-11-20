import type { NextConfig } from "next";

// The browser only ever calls /api/py/*.
// - Local dev: forwarded to the FastAPI server started with `npm run dev:api` (port 8000).
// - Vercel: served by the Python function in api/index.py (same project, same domain).
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/py/:path*"
            : "/api/",
      },
    ];
  },
};

export default nextConfig;
