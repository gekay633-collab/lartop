import type { NextConfig } from "next";

// O navegador chama /api/* no mesmo dominio do site.
// Em producao, o Next.js encaminha ao backend publicado no Railway.
const BACKEND_PADRAO =
  process.env.NODE_ENV === "production"
    ? "https://lartop-production.up.railway.app"
    : "http://localhost:3333";
const backendUrl = (process.env.API_BACKEND_URL?.trim() || BACKEND_PADRAO).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // CSP com nonce por resposta definida em src/proxy.ts.
        ],
      },
      {
        source: "/redefinir-senha",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
