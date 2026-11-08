import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  CHAVE_COOKIE_ACESSO_LOCAL,
  CHAVE_COOKIE_ACESSO_PRODUCAO,
  ehMetodoMutavel,
  origemConfiavel,
} from "@/lib/seguranca-bff";

function politicaConteudo(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function responderErro(status: number, texto: string) {
  return NextResponse.json({ erro: texto }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Next Proxy executa ANTES do rewrite público /api -> Railway.
 * Apenas o servidor lê o JWT HttpOnly e o injeta para a API Fastify.
 * Nunca aceitar Authorization fornecido por JavaScript do navegador.
 */
export function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  const api = caminho === "/api" || caminho.startsWith("/api/");
  const bffAuth = caminho.startsWith("/bff/auth/");
  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("x-nonce");
  headers.delete("content-security-policy");

  // Nunca deixar o rewrite genérico /api/:path* devolver um JWT bruto.
  // Bundles antigos do PWA devem ser atualizados para /bff/auth/*.
  if (caminho.startsWith("/api/auth/")) {
    return responderErro(410, "Atualize a página do Lartop para continuar com segurança.");
  }

  if (api || bffAuth) {
    if (ehMetodoMutavel(request.method) && !origemConfiavel(
      request.nextUrl.origin,
      request.headers.get("origin"),
      request.headers.get("sec-fetch-site"),
    )) {
      return responderErro(403, "Origem não autorizada");
    }

    if (api) {
      // Somente o gateway de autenticação BFF pode receber refresh cookie.
      // Nenhuma outra API (inclusive uploads) recebe cookies diretamente.
      headers.delete("cookie");
      const jwt = request.cookies.get(CHAVE_COOKIE_ACESSO_PRODUCAO)?.value ||
        request.cookies.get(CHAVE_COOKIE_ACESSO_LOCAL)?.value;
      if (jwt && jwt.length <= 4096) headers.set("Authorization", `Bearer ${jwt}`);
    }
    // Vercel must receive the authenticated header on the SAME rewrite that
    // proxies the request to Railway. A separate next.config rewrite can
    // lose Proxy's request header overrides on the external-hop path.
    if (api) {
      const backend = (process.env.API_BACKEND_URL?.trim() ||
        (process.env.NODE_ENV === "production"
          ? "https://lartop-production.up.railway.app"
          : "http://localhost:3333")).replace(/[/]+$/, "");
      const destino = new URL(backend);
      // Assign pathname rather than resolving a client-provided // path as a host.
      destino.pathname = caminho;
      destino.search = request.nextUrl.search;
      headers.delete("host");
      const response = NextResponse.rewrite(destino, { request: { headers } });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const nonce = randomBytes(16).toString("base64");
  const csp = politicaConteudo(nonce);
  headers.set("x-nonce", nonce);
  // O Next.js precisa receber o header CSP como REQUEST para identificar o
  // nonce e marcar seus próprios scripts de hidratação com ele.
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png).*)",
  ],
};
