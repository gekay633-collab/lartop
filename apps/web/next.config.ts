import type { NextConfig } from "next";

// As rotas /api/* sao encaminhadas pelo Proxy para aplicar a sessao HttpOnly.
// Nao criar um rewrite externo paralelo aqui: poderia descartar Authorization.

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS vale para HTTPS; não incluir subdomínios/preload até aprovar o domínio próprio.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
};

export default nextConfig;
