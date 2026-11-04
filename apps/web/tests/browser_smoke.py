"""Smoke tests in real Chromium with desktop and mobile emulation.
Next.js runs locally; every API call is intercepted, and no real account is touched.
This is NOT a test on a physical phone or the production server.
"""
import json
import os
import time
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LARTOP_BROWSER_URL", "http://localhost:3000")
def wait_server():
    for _ in range(50):
        try:
            with urllib.request.urlopen(BASE + "/entrar", timeout=3) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(1)
    raise AssertionError("Next.js local não iniciou")

def scenario(browser, mobile=False):
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1366, "height": 844 if mobile else 768},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=2 if mobile else 1,
    )
    page = context.new_page()
    request_log = []
    browser_errors = []
    page.on('pageerror', lambda err: browser_errors.append('JS: ' + str(err)))
    page.on('console', lambda msg: browser_errors.append('CONSOLE: ' + msg.text) if msg.type == 'error' else None)
    page.on('response', lambda response: browser_errors.append('HTTP: ' + str(response.status) + ' ' + response.url) if response.status >= 400 and '/_next/' in response.url else None)
    logout_should_fail = True

    def intercept(route):
        nonlocal logout_should_fail
        req = route.request
        url = req.url
        request_log.append((req.method, url.split("?")[0]))
        if url.endswith("/api/auth/login"):
            return route.fulfill(status=200, content_type="application/json",
                headers={"Set-Cookie": "lartop_refresh=fake-for-browser-test; Path=/; HttpOnly; SameSite=Lax"},
                body=json.dumps({"accessToken": "test-only-not-a-real-jwt"}))
        if url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"id":"fake-user","nome":"Teste Navegador","tipo":"CLIENTE","email":"fake@example.test"}))
        if url.endswith("/api/auth/logout"):
            if logout_should_fail:
                return route.fulfill(status=503, content_type="application/json",
                    body='{"erro":"Simulação de falha"}')
            return route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
        if url.endswith("/api/notificacoes"):
            return route.fulfill(status=200, content_type="application/json",
                body='{"itens":[],"naoLidas":0}')
        if url.endswith("/api/push/chave-publica"):
            return route.fulfill(status=503, content_type="application/json", body='{"erro":"disabled"}')
        return route.fulfill(status=404, content_type="application/json",
                             body='{"erro":"API mock: endpoint indisponível"}')

    page.route("**/api/**", intercept)
    page.goto(BASE + "/entrar", wait_until="load")
    # Aguarda scripts e hidratação; não depende de propriedades internas do React.
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(1000)
    page.get_by_placeholder("E-mail").fill("fake@example.test")
    page.get_by_placeholder("Senha").fill("Senha123!SomenteTeste")
    page.locator('form button[type="submit"]').click()
    try:
        page.wait_for_url(BASE + "/", timeout=20000, wait_until="domcontentloaded")
    except Exception:
        print("BROWSER DEBUG URL:", page.url)
        print("BROWSER DEBUG CALLS:", request_log[-15:])
        print("BROWSER DEBUG TEXT:", page.locator("body").inner_text()[-1200:])
        print("BROWSER DEBUG REACT KEYS:", page.evaluate("Object.keys(document.querySelector('form') || {})")[:25])
        print("BROWSER DEBUG ERRORS:", browser_errors[-25:])
        print("BROWSER DEBUG SCRIPTS:", page.evaluate("Array.from(document.scripts).map(s => s.src).filter(Boolean).slice(0,6)"))
        raise
    assert page.evaluate("localStorage.getItem('lartop_access_token')") == "test-only-not-a-real-jwt"

    if mobile:
        page.get_by_role("button", name="Abrir menu").click()
    sair = page.get_by_role("button", name="Sair")
    sair.click()
    page.get_by_role("alert").filter(has_text="Não foi possível encerrar sua sessão").wait_for(timeout=15000)
    assert page.evaluate("localStorage.getItem('lartop_access_token')") is not None
    logout_should_fail = False
    sair.click()
    page.wait_for_function("localStorage.getItem('lartop_access_token') === null")
    assert page.evaluate("localStorage.getItem('lartop_tipo_usuario')") is None
    assert sum(x[1].endswith("/api/auth/logout") for x in request_log) == 2
    page.goto(BASE + "/redefinir-senha?token=token-falso&id=usuario-falso", wait_until="domcontentloaded")
    page.get_by_role("heading", name="Criar nova senha").wait_for(timeout=15000)
    page.wait_for_function("window.location.search === ''", timeout=10000)
    assert page.evaluate("window.location.pathname") == "/redefinir-senha"
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") + " Chromium: login, logout e reset sem token na URL OK")

def admin_logout(browser, mobile=False):
    """Verifica logout da área administrativa sem contas/dados reais."""
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1366, "height": 844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile,
    )
    page = context.new_page()
    pedidos_logout = []
    falhar_logout = True

    def mock_api(route):
        nonlocal falhar_logout
        url = route.request.url
        if url.endswith("/api/auth/logout"):
            pedidos_logout.append(route.request.method)
            if falhar_logout:
                return route.fulfill(status=503, content_type="application/json",
                                     body='{"erro":"falha-simulada"}')
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"ok":true}')
        if url.endswith("/api/admin/dashboard"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({
                    "hoje": {"novosClientes":0,"novosPrestadores":0,"solicitacoes":0},
                    "geral": {"totalClientes":0,"totalPrestadores":0,"prestadoresPublicados":0,
                              "prestadoresNaoPublicados":0,"solicitacoesTotal":0,
                              "avaliacoesTotal":0,"usuariosBloqueados":0}
                }))
        return route.fulfill(status=404, content_type="application/json", body='{"erro":"mock"}')

    page.route("**/api/**", mock_api)
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.evaluate("""() => {
      localStorage.setItem('lartop_access_token', 'token-admin-ficticio');
      localStorage.setItem('lartop_tipo_usuario', 'ADMIN');
      localStorage.setItem('lartop_nome_usuario', 'Teste Admin');
    }""")
    page.goto(BASE + "/admin", wait_until="load")
    page.wait_for_load_state("networkidle", timeout=20000)
    if mobile:
        page.get_by_role("button", name="Abrir menu").click()
    sair = page.get_by_role("button", name="Sair")
    sair.click()
    page.get_by_role("alert").filter(has_text="Não foi possível encerrar sua sessão").wait_for(timeout=15000)
    assert page.evaluate("localStorage.getItem('lartop_access_token')") == "token-admin-ficticio"
    falhar_logout = False
    sair.click()
    page.wait_for_function("localStorage.getItem('lartop_access_token') === null", timeout=15000)
    page.wait_for_url(BASE + "/", timeout=20000, wait_until="domcontentloaded")
    assert pedidos_logout == ["POST", "POST"]
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") + " Chromium: logout administrativo OK")


if __name__ == "__main__":
    wait_server()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            scenario(browser, mobile=False)
            scenario(browser, mobile=True)
            admin_logout(browser, mobile=False)
            admin_logout(browser, mobile=True)
        finally:
            browser.close()
