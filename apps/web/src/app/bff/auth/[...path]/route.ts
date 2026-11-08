import { NextRequest, NextResponse } from "next/server";
import { cookieAcessoParaUrl, origemConfiavel } from "@/lib/seguranca-bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backend = (
  process.env.API_BACKEND_URL?.trim() ||
  (process.env.NODE_ENV === "production"
    ? "https://lartop-production.up.railway.app"
    : "http://localhost:3333")
).replace(/[/]+$/, "");

const CAMINHOS_PERMITIDOS = new Set([
  "login", "logout", "refresh", "registrar/cliente",
  "registrar/profissional", "esqueci-senha", "redefinir-senha",
]);

type Contexto = { params: Promise<{ path: string[] }> };

function enviarErro(status: number, erro: string): NextResponse {
  const resposta = NextResponse.json({ erro }, { status });
  resposta.headers.set("Cache-Control", "no-store");
  return resposta;
}

/**
 * A API mantém compatibilidade com clientes antigos retornando accessToken.
 * Este gateway elimina o campo ANTES de responder ao navegador e converte
 * o JWT em cookie HttpOnly __Host- (HTTPS) ou lartop_access (localhost).
 */
export async function POST(request: NextRequest, { params }: Contexto): Promise<NextResponse> {
  const { path } = await params;
  const acao = path.join("/");
  if (!CAMINHOS_PERMITIDOS.has(acao)) return enviarErro(404, "Rota indisponível");
  if (!origemConfiavel(
    request.nextUrl.origin,
    request.headers.get("origin"),
    request.headers.get("sec-fetch-site"),
  )) {
    return enviarErro(403, "Origem não autorizada");
  }

  // Evitar logar credenciais ou aceitar corpo arbitrariamente grande.
  const corpo = await request.text();
  if (corpo.length > 16_384) return enviarErro(413, "Dados muito grandes");
  if (acao !== "logout" && acao !== "refresh" &&
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return enviarErro(415, "Envie dados em formato JSON");
  }

  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
  });
  const refresh = request.cookies.get("lartop_refresh")?.value;
  if (refresh) headers.set("Cookie", `lartop_refresh=${refresh}`);
  if (acao === "logout") {
    const access = request.cookies.get(cookieAcessoParaUrl(request.nextUrl))?.value;
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/api/auth/${acao}`, {
      method: "POST",
      headers,
      body: corpo || undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return enviarErro(503, "Serviço de autenticação indisponível. Tente novamente.");
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return enviarErro(502, "Resposta inesperada do serviço de autenticação");
  }
  const dados: unknown = await upstream.json().catch(() => null);
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return enviarErro(502, "Resposta inválida do serviço de autenticação");
  }

  const sanitizado = { ...dados } as Record<string, unknown>;
  delete sanitizado.accessToken;
  const sucesso = upstream.ok;
  const jwt = "accessToken" in dados && typeof dados.accessToken === "string"
    ? dados.accessToken : null;
  if (sucesso && acao !== "logout" && acao !== "esqueci-senha" &&
      acao !== "redefinir-senha" && (!jwt || jwt.length > 4096)) {
    return enviarErro(502, "Sessão não confirmada pelo servidor");
  }

  // Não copiar Set-Cookie cru: NextResponse.cookies.set pode substituir
  // headers Set-Cookie anexados manualmente, perdendo o refresh HttpOnly.
  // Reemitir somente a credencial de renovação conhecida, com os mesmos
  // atributos seguros definidos pela API Fastify.
  const cookieDoServidor = upstream.headers.getSetCookie()
    .find(cookie => cookie.startsWith("lartop_refresh="));
  const refreshAtualizado = cookieDoServidor
    ? cookieDoServidor.split(";", 1)[0].slice("lartop_refresh=".length)
    : null;
  const exigeRefresh = sucesso && ["login", "refresh", "registrar/cliente", "registrar/profissional"].includes(acao);
  if (exigeRefresh && (!refreshAtualizado || refreshAtualizado.length > 4096)) {
    return enviarErro(502, "O servidor não confirmou o cookie de renovação.");
  }

  const resposta = NextResponse.json(sanitizado, { status: upstream.status });
  resposta.headers.set("Cache-Control", "no-store, private");
  resposta.headers.set("Pragma", "no-cache");

  const secure = request.nextUrl.protocol === "https:";
  if (sucesso && refreshAtualizado && acao !== "logout") {
    resposta.cookies.set("lartop_refresh", refreshAtualizado, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  const nome = cookieAcessoParaUrl(request.nextUrl);
  if (sucesso && jwt && acao !== "logout") {
    resposta.cookies.set(nome, jwt, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
  }
  if (sucesso && acao === "logout") {
    resposta.cookies.delete("lartop_refresh");
    resposta.cookies.delete(nome);
    // Rotação de contexto (http local/https): limpar nome de desenvolvimento.
    if (nome !== "lartop_access") resposta.cookies.delete("lartop_access");
  }
  return resposta;
}
