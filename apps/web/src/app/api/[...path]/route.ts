import { NextRequest, NextResponse } from "next/server";
import { cookieAcessoParaUrl, ehMetodoMutavel, origemConfiavel } from "@/lib/seguranca-bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ path: string[] }> };
const LIMITE_CORPO_BYTES = 8 * 1024 * 1024;

function erro(status: number, mensagem: string): NextResponse {
  return NextResponse.json({ erro: mensagem }, {
    status, headers: { "Cache-Control": "no-store, private" },
  });
}

/** Limit uploads and JSON payloads even if Content-Length was omitted. */
async function corpoLimitado(request: NextRequest): Promise<ArrayBuffer | undefined | null> {
  const informado = request.headers.get("content-length");
  if (informado && (!/^\d+$/.test(informado) || Number(informado) > LIMITE_CORPO_BYTES)) return null;
  if (!request.body) return undefined;
  const leitor = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_CORPO_BYTES) {
        await leitor.cancel().catch(() => undefined);
        return null;
      }
      partes.push(value);
    }
    if (!total) return undefined;
    const buffer = new ArrayBuffer(total);
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    for (const parte of partes) {
      bytes.set(parte, offset);
      offset += parte.byteLength;
    }
    return buffer;
  } catch {
    return null;
  } finally {
    leitor.releaseLock();
  }
}

/**
 * Same-origin API gateway. Browser requests never carry or choose JWT Bearer
 * credentials: the server reads only its own HttpOnly access cookie and sends
 * the Authorization header directly to Railway using server-side fetch.
 *
 * A NextResponse.rewrite to an external origin does not reliably forward
 * request-header overrides across the Vercel routing layer.
 */
async function encaminhar(request: NextRequest, contexto: Contexto): Promise<Response> {
  const { path } = await contexto.params;
  if (!path.length || path.length > 12 || path.some(item => item.length > 250)) {
    return erro(404, "Rota indisponível");
  }
  // Never expose the upstream auth API's raw accessToken response to JS.
  if (path[0] === "auth") {
    return erro(410, "Atualize a página do Lartop para continuar com segurança.");
  }
  if (ehMetodoMutavel(request.method) &&
      !origemConfiavel(request.nextUrl.origin, request.headers.get("origin"),
        request.headers.get("sec-fetch-site"))) {
    return erro(403, "Origem não autorizada");
  }

  const body = ehMetodoMutavel(request.method) ? await corpoLimitado(request) : undefined;
  if (body === null) return erro(413, "Dados muito grandes ou inválidos");

  const backend = (process.env.API_BACKEND_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? "https://lartop-production.up.railway.app"
      : "http://localhost:3333")).replace(/[/]+$/, "");
  const destino = new URL(backend);
  destino.pathname = "/api/" + path.map(encodeURIComponent).join("/");
  destino.search = request.nextUrl.search;

  // Allowlist only data-related headers. Never forward Cookie, Authorization,
  // Origin or forwarded-host headers supplied by the browser.
  const headers = new Headers({ Accept: request.headers.get("accept") || "application/json" });
  const tipo = request.headers.get("content-type");
  if (body && tipo) headers.set("Content-Type", tipo);
  const etag = request.headers.get("if-none-match");
  if (etag) headers.set("If-None-Match", etag);
  const acesso = request.cookies.get(cookieAcessoParaUrl(request.nextUrl))?.value;
  if (acesso && acesso.length <= 4096) headers.set("Authorization", `Bearer ${acesso}`);

  let upstream: Response;
  try {
    upstream = await fetch(destino, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return erro(503, "Serviço indisponível. Tente novamente.");
  }

  // Stream only safe response metadata; do not pass upstream cookies, CORS,
  // Content-Length or Content-Encoding back to the browser.
  const retorno = new Headers({ "Cache-Control": "private, no-store" });
  for (const nome of ["content-type", "content-disposition", "etag"]) {
    const valor = upstream.headers.get(nome);
    if (valor) retorno.set(nome, valor);
  }
  const semCorpo = request.method === "HEAD" || upstream.status === 204 || upstream.status === 304;
  return new NextResponse(semCorpo ? null : upstream.body, {
    status: upstream.status, headers: retorno,
  });
}

export { encaminhar as GET, encaminhar as HEAD, encaminhar as POST,
  encaminhar as PUT, encaminhar as PATCH, encaminhar as DELETE };
