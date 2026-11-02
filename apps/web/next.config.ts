import type { NextConfig } from "next";

// O navegador chama /api/* no mesmo dominio do site.
// Em producao, o Next.js encaminha ao backend publicado no Railway.
const BACKEND_PADRAO =
  process.env.NODE_ENV === "production"
    ? "https://lartop-production.up.railway.app"
    : "http://localhost:3333";
const backendUrl = (process.env.API_BACKEND_URL?.trim() || BACKEND_PADRAO).replace(/\/+$/, "");

const nextConfig: NextConfig = {
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
