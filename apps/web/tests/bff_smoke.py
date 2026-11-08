"""Teste de ponta a ponta do gateway Next -> API simulada (sem page.route).
Roda apenas no CI: mock local em localhost:3333, nunca produção.
Confirma JWT inacessível ao browser, cookies HttpOnly, CSP, CSRF e refresh.
"""
import json
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
eventos = []
ACCESS_INICIAL = "jwt-dentro-do-cookie-httponly"
ACCESS_NOVO = "jwt-renovado-httponly"


class FakeRailway(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def responder(self, status, body, cookie=None):
        dados = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        path = urlparse(self.path).path
        auth = self.headers.get("Authorization", "")
        cookie = self.headers.get("Cookie", "")
        eventos.append(("GET", path, auth, cookie))
        if path == "/api/usuarios/mim":
            if auth in (f"Bearer {ACCESS_INICIAL}", f"Bearer {ACCESS_NOVO}"):
                return self.responder(200, {"id":"cliente-ci", "nome":"Cliente BFF",
                    "email":"cliente@example.test", "tipo":"CLIENTE"})
            return self.responder(401, {"erro":"Sessão inválida"})
        if path == "/api/solicitacoes/minhas":
            if auth in (f"Bearer {ACCESS_INICIAL}", f"Bearer {ACCESS_NOVO}"):
                return self.responder(200, {"itens":[], "total":0, "pagina":1})
            return self.responder(401, {"erro":"Sessão inválida"})
        if path == "/api/notificacoes":
            return self.responder(200, {"itens":[], "naoLidas":0})
        if path == "/api/categorias":
            return self.responder(200, [])
        return self.responder(404, {"erro":"API mock de teste"})

    def do_POST(self):
        path = urlparse(self.path).path
        size = min(int(self.headers.get("Content-Length", "0")), 32768)
        _ = self.rfile.read(size)
        auth = self.headers.get("Authorization", "")
        cookie = self.headers.get("Cookie", "")
        eventos.append(("POST", path, auth, cookie))
        if path == "/api/auth/login":
            return self.responder(200, {"accessToken":ACCESS_INICIAL},
                "lartop_refresh=refresh-inicial; HttpOnly; SameSite=Lax; Path=/")
        if path == "/api/auth/refresh":
            if "lartop_refresh=refresh-inicial" in cookie or "lartop_refresh=refresh-rotativo" in cookie:
                return self.responder(200, {"accessToken":ACCESS_NOVO},
                    "lartop_refresh=refresh-rotativo; HttpOnly; SameSite=Lax; Path=/")
            return self.responder(401, {"erro":"Refresh inválido"})
        if path == "/api/auth/logout":
            if auth in (f"Bearer {ACCESS_INICIAL}", f"Bearer {ACCESS_NOVO}") and "lartop_refresh=" in cookie:
                return self.responder(200, {"ok":True},
                    "lartop_refresh=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
            return self.responder(401, {"erro":"Sem credenciais"})
        return self.responder(404, {"erro":"Rota fake não encontrada"})


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 3333), FakeRailway)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            erros_csp = []
            page.on("console", lambda msg: erros_csp.append(msg.text)
                    if msg.type == "error" and "Content Security Policy" in msg.text else None)

            pagina = page.goto(BASE + "/entrar", wait_until="load")
            csp = pagina.header_value("content-security-policy") or ""
            assert "script-src 'self' 'nonce-" in csp, csp
            assert "'strict-dynamic'" in csp
            scripts = csp.split("script-src", 1)[1].split(";", 1)[0]
            assert "'unsafe-inline'" not in scripts, scripts
            assert "frame-ancestors 'none'" in csp
            assert not erros_csp, erros_csp

            page.get_by_placeholder("E-mail").fill("cliente@example.test")
            page.get_by_placeholder("Senha").fill("senha-ficticia")
            with page.expect_response(lambda r: r.url.endswith("/bff/auth/login")) as tentativa:
                page.locator('form button[type="submit"]').click()
            resposta = tentativa.value
            assert resposta.status == 200, resposta.text()
            assert "accessToken" not in resposta.json(), resposta.json()
            assert ACCESS_INICIAL not in resposta.text()
            page.wait_for_url(BASE + "/", timeout=20000)
            page.get_by_text("Cliente BFF", exact=False).first.wait_for(timeout=15000)

            assert page.evaluate("localStorage.getItem('lartop_access_token')") is None
            assert page.evaluate("sessionStorage.getItem('lartop_access_token')") is None
            assert ACCESS_INICIAL not in page.evaluate("document.cookie")
            cookies = context.cookies(BASE)
            access = [c for c in cookies if c["name"] == "lartop_access"]
            refresh = [c for c in cookies if c["name"] == "lartop_refresh"]
            assert len(access) == 1 and access[0]["httpOnly"], cookies
            assert len(refresh) == 1 and refresh[0]["httpOnly"], cookies
            assert access[0]["value"] == ACCESS_INICIAL

            # O rewrite legado /api/auth não pode retornar accessToken nem
            # permitir login antigo diretamente pelo Railway.
            qtd_login = sum(x[1] == "/api/auth/login" for x in eventos)
            antigo = context.request.post(BASE + "/api/auth/login", headers={
                "Origin": BASE, "Content-Type": "application/json",
                "Sec-Fetch-Site": "same-origin",
            }, data=json.dumps({"email":"cliente@example.test", "senha":"senha-ficticia"}))
            assert antigo.status == 410, antigo.text()
            assert "accessToken" not in antigo.text()
            assert sum(x[1] == "/api/auth/login" for x in eventos) == qtd_login
            antigo_refresh = context.request.post(BASE + "/api/auth/refresh", headers={
                "Origin": BASE, "Sec-Fetch-Site": "same-origin",
            })
            assert antigo_refresh.status == 410, antigo_refresh.text()
            assert "accessToken" not in antigo_refresh.text()

            # Browser tenta injetar um Bearer malicioso: o Proxy deve ignorar
            # esse header e entregar à API só o JWT do cookie HttpOnly.
            resposta = context.request.get(BASE + "/api/usuarios/mim", headers={
                "Authorization":"Bearer token-forjado-no-js",
            })
            assert resposta.status == 200, resposta.text()
            assert eventos[-1][2] == f"Bearer {ACCESS_INICIAL}", eventos[-1]

            # Origin cross-site não pode modificar nenhum estado com cookies.
            qtd_logout_antes = sum(x[1] == "/api/auth/logout" for x in eventos)
            resposta = context.request.post(BASE + "/bff/auth/logout", headers={
                "Origin":"https://ataque.example", "Sec-Fetch-Site":"cross-site",
            })
            assert resposta.status == 403, resposta.text()
            assert sum(x[1] == "/api/auth/logout" for x in eventos) == qtd_logout_antes

            # Expira manualmente somente o access cookie, preservando refresh.
            context.add_cookies([{"url":BASE, "name":"lartop_access",
                "value":"jwt-expirado-ci", "httpOnly":True, "sameSite":"Lax"}])
            page.goto(BASE + "/minhas-solicitacoes", wait_until="load")
            page.get_by_text("Você ainda não pediu nenhum orçamento.").wait_for(timeout=20000)
            assert any(x[1] == "/api/auth/refresh" for x in eventos), eventos
            novo = [c for c in context.cookies(BASE) if c["name"] == "lartop_access"]
            assert novo and novo[0]["value"] == ACCESS_NOVO and novo[0]["httpOnly"]
            assert page.evaluate("localStorage.getItem('lartop_access_token')") is None

            sair = page.get_by_role("button", name="Sair")
            sair.click()
            page.wait_for_url(BASE + "/", timeout=15000)
            page.wait_for_function("localStorage.getItem('lartop_sessao_ativa') === null")
            assert not [c for c in context.cookies(BASE) if c["name"] in ("lartop_access", "lartop_refresh")]
            assert sum(x[1] == "/api/auth/logout" for x in eventos) == qtd_logout_antes + 1
            assert not erros_csp, erros_csp
            context.close()
            browser.close()
        print("BFF REAL: HttpOnly + CSRF + JWT redacted + CSP nonce + refresh + logout OK")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
