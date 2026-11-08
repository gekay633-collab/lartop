/**
 * Validação compartilhada entre Proxy e rota BFF.
 * Cookies de sessão tornam as operações mutáveis sensíveis a CSRF.
 */
export function origemConfiavel(origemEsperada: string, origem: string | null, fetchSite: string | null): boolean {
  if (fetchSite === "cross-site" || fetchSite === "same-site" || fetchSite === "none") return false;
  if (origem) {
    try {
      return new URL(origem).origin === origemEsperada;
    } catch {
      return false;
    }
  }
  // Navegadores modernos enviam Origin; Sec-Fetch-Site same-origin também
  // é aceito para SWs/PWAs que eventualmente omitam o Origin.
  return fetchSite === "same-origin";
}

export const CHAVE_COOKIE_ACESSO_PRODUCAO = "__Host-lartop_access";
export const CHAVE_COOKIE_ACESSO_LOCAL = "lartop_access";

export function cookieAcessoParaUrl(url: URL): string {
  return url.protocol === "https:" ? CHAVE_COOKIE_ACESSO_PRODUCAO : CHAVE_COOKIE_ACESSO_LOCAL;
}

export function ehMetodoMutavel(metodo: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(metodo.toUpperCase());
}
