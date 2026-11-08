"""Smoke tests in real Chromium with desktop and mobile emulation.
Next.js runs locally; every API call is intercepted, and no real account is touched.
This is NOT a test on a physical phone or the production server.
"""
import base64
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
    assert page.evaluate("localStorage.getItem('lartop_access_token')") is None
    assert page.evaluate("localStorage.getItem('lartop_sessao_ativa')") == "1"

    if mobile:
        page.get_by_role("button", name="Abrir menu").click()
    sair = page.get_by_role("button", name="Sair")
    sair.click()
    page.get_by_role("alert").filter(has_text="Não foi possível encerrar sua sessão").wait_for(timeout=15000)
    assert page.evaluate("localStorage.getItem('lartop_access_token')") is None
    assert page.evaluate("localStorage.getItem('lartop_sessao_ativa')") == "1"
    logout_should_fail = False
    sair.click()
    page.wait_for_function("localStorage.getItem('lartop_sessao_ativa') === null")
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
        if route.request.url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"id":"conta-teste","nome":"Conta Teste","tipo":"ADMIN"}))
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
      localStorage.setItem('lartop_sessao_ativa', '1');
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
    assert page.evaluate("localStorage.getItem('lartop_access_token')") is None
    assert page.evaluate("localStorage.getItem('lartop_sessao_ativa')") == "1"
    falhar_logout = False
    sair.click()
    page.wait_for_function("localStorage.getItem('lartop_sessao_ativa') === null", timeout=15000)
    page.wait_for_url(BASE + "/", timeout=20000, wait_until="domcontentloaded")
    assert pedidos_logout == ["POST", "POST"]
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") + " Chromium: logout administrativo OK")



def teste_renovacao_entre_abas(browser):
    """Duas abas usam refresh HttpOnly sem gravar JWT no armazenamento local."""
    context = browser.new_context()
    context.add_cookies([
        {"url": BASE, "name": "lartop_refresh", "value": "cookie-rotativo-teste",
         "httpOnly": True, "sameSite": "Lax"}
    ])
    chamadas_refresh = []
    chamadas_perfil = []

    def api(route):
        url = route.request.url
        cookies = route.request.headers.get("cookie", "")
        if url.endswith("/api/usuarios/mim"):
            chamadas_perfil.append(cookies)
            if "lartop_access=jwt-apenas-httponly" in cookies:
                return route.fulfill(status=200, content_type="application/json",
                    body='{"id":"cliente","nome":"Cliente Duas Abas","tipo":"CLIENTE"}')
            return route.fulfill(status=401, content_type="application/json",
                                 body='{"erro":"Token expirado"}')
        if url.endswith("/api/auth/refresh"):
            chamadas_refresh.append(cookies)
            time.sleep(0.2)
            return route.fulfill(status=200, content_type="application/json",
                headers={"Set-Cookie": "lartop_access=jwt-apenas-httponly; Path=/; HttpOnly; SameSite=Lax"},
                body='{"ok":true}')
        if url.endswith("/api/solicitacoes/minhas"):
            if "lartop_access=jwt-apenas-httponly" not in cookies:
                return route.fulfill(status=401, content_type="application/json",
                                     body='{"erro":"Sessão inválida"}')
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"itens":[],"total":0,"pagina":1}')
        if "/api/notificacoes" in url:
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"itens":[],"naoLidas":0}')
        if url.endswith("/api/push/chave-publica"):
            return route.fulfill(status=503, content_type="application/json",
                                 body='{"erro":"simulado"}')
        return route.fulfill(status=404, content_type="application/json",
                             body='{"erro":"mock"}')

    context.route("**/api/**", api)
    a = context.new_page()
    b = context.new_page()
    a.goto(BASE + "/minhas-solicitacoes", wait_until="domcontentloaded")
    b.goto(BASE + "/minhas-solicitacoes", wait_until="domcontentloaded")
    for page in (a, b):
        page.get_by_text("Você ainda não pediu nenhum orçamento.").wait_for(timeout=20000)
        assert page.evaluate("localStorage.getItem('lartop_access_token')") is None
        assert page.evaluate("localStorage.getItem('lartop_sessao_ativa')") == "1"
    cookies = context.cookies(BASE)
    access = [c for c in cookies if c["name"] == "lartop_access"]
    assert len(access) == 1 and access[0]["httpOnly"], cookies
    assert 1 <= len(chamadas_refresh) <= 2, chamadas_refresh
    assert chamadas_perfil
    context.close()
    print("MULTIABAS: restauração e refresh HttpOnly, JWT ausente do localStorage OK")

    # Um erro 503 nunca deve destruir os metadados não sensíveis de sessão.
    falha = browser.new_context()
    falha.add_init_script("""
        localStorage.setItem('lartop_sessao_ativa','1');
        localStorage.setItem('lartop_tipo_usuario','CLIENTE');
        localStorage.setItem('lartop_nome_usuario','Cliente Falha Temporária');
    """)
    def indisponivel(route):
        if route.request.url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=401, content_type="application/json",
                                 body='{"erro":"JWT expirado"}')
        if route.request.url.endswith("/api/auth/refresh"):
            return route.fulfill(status=503, content_type="application/json",
                                 body='{"erro":"Redis indisponível"}')
        return route.fulfill(status=404, content_type="application/json", body='{"erro":"mock"}')
    falha.route("**/api/**", indisponivel)
    page = falha.new_page()
    page.goto(BASE + "/minhas-solicitacoes", wait_until="load")
    page.wait_for_timeout(1600)
    assert page.evaluate("localStorage.getItem('lartop_access_token')") is None
    assert page.evaluate("localStorage.getItem('lartop_sessao_ativa')") == "1"
    falha.close()
    print("FALHA 503: sessão HttpOnly pode ser recuperada; metadados permanecem OK")


def teste_profissional_nao_entra_no_fluxo_cliente(browser, mobile=False):
    """Prestador permanece no painel mesmo se abrir busca/contratação por URL."""
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1366, "height": 844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile,
    )
    page = context.new_page()
    def api(route):
        if route.request.url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"id":"conta-teste","nome":"Conta Teste","tipo":"PROFISSIONAL"}))
        if "/api/solicitacoes/recebidas" in route.request.url:
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"itens":[],"total":0}')
        if route.request.url.endswith("/api/notificacoes"):
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"itens":[],"naoLidas":0}')
        if route.request.url.endswith("/api/push/chave-publica"):
            return route.fulfill(status=503, content_type="application/json",
                                 body='{"erro":"sem push no teste"}')
        return route.fulfill(status=404, content_type="application/json", body='{"erro":"mock"}')

    page.route("**/api/**", api)
    page.goto(BASE + "/", wait_until="load")
    page.wait_for_load_state("networkidle", timeout=20000)
    page.evaluate("""() => {
      localStorage.setItem('lartop_tipo_usuario', 'PROFISSIONAL');
      localStorage.setItem('lartop_nome_usuario', 'Profissional de Teste');
      localStorage.setItem('lartop_sessao_ativa', '1');
    }""")
    page.goto(BASE + "/painel", wait_until="load")
    page.get_by_text("Nenhum pedido novo aguardando resposta.").wait_for(timeout=20000)

    marca = page.locator("header a").filter(has_text="Lartop").first
    assert marca.get_attribute("href") == "/painel"
    marca.click()
    page.wait_for_url(BASE + "/painel", timeout=15000)

    page.goto(BASE + "/buscar", wait_until="domcontentloaded")
    page.wait_for_url(BASE + "/painel", timeout=20000)
    page.goto(BASE + "/solicitar", wait_until="domcontentloaded")
    page.wait_for_url(BASE + "/painel", timeout=20000)

    # Página inicial continua pública, mas a busca não é exibida para o prestador.
    page.goto(BASE + "/", wait_until="load")
    page.get_by_text("A busca e a contratação são destinadas a contas de cliente.").first.wait_for(timeout=15000)
    assert page.get_by_role("button", name="Buscar profissionais").count() == 0
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") + " PRESTADOR: logo/páginas de busca/contratação bloqueadas OK")


def teste_cliente_pode_continuar_na_busca(browser):
    """Não bloquear visitantes ou clientes reais de procurar profissionais."""
    for tipo in (None, "CLIENTE"):
        context = browser.new_context()
        page = context.new_page()
        page.goto(BASE + "/", wait_until="load")
        if tipo:
            page.evaluate("""() => {
              localStorage.setItem('lartop_tipo_usuario', 'CLIENTE');
              localStorage.setItem('lartop_nome_usuario', 'Cliente Teste');
              localStorage.setItem('lartop_sessao_ativa', '1');
            }""")
        page.goto(BASE + "/buscar", wait_until="domcontentloaded")
        page.get_by_role("heading", name="Digite um CEP para começar").wait_for(timeout=15000)
        assert page.url.endswith("/buscar")
        context.close()
    print("VISITANTE E CLIENTE: busca preservada OK")



def teste_rodape_contextual(browser, mobile=False):
    """Rodapé não deve anunciar busca, cadastro ou login a um prestador conectado."""
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1366, "height": 844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile,
    )
    page = context.new_page()
    papel_atual = [None]

    def api(route):
        if route.request.url.endswith("/api/usuarios/mim"):
            if papel_atual[0]:
                return route.fulfill(status=200, content_type="application/json",
                    body=json.dumps({"id":"conta-rodape","nome":"Conta de Teste","tipo":papel_atual[0]}))
            return route.fulfill(status=401, content_type="application/json",
                body='{"erro":"Não autenticado"}')
        path = route.request.url
        if path.endswith("/api/solicitacoes/recebidas"):
            return route.fulfill(status=200, content_type="application/json", body='{"itens":[],"total":0}')
        if path.endswith("/api/notificacoes"):
            return route.fulfill(status=200, content_type="application/json", body='{"itens":[],"naoLidas":0}')
        if path.endswith("/api/categorias"):
            return route.fulfill(status=200, content_type="application/json", body='[]')
        return route.fulfill(status=404, content_type="application/json", body='{"erro":"mock"}')

    page.route("**/api/**", api)
    page.goto(BASE + "/", wait_until="load")
    footer = page.locator("footer")
    footer.get_by_role("link", name="Entrar na minha conta").wait_for(timeout=15000)
    assert footer.get_by_text("Tipos de serviço").count() == 1

    def alterar_papel(papel):
        papel_atual[0] = papel
        page.evaluate("""(papel) => {
          localStorage.setItem('lartop_sessao_ativa', '1');
          localStorage.setItem('lartop_tipo_usuario', papel);
          localStorage.setItem('lartop_nome_usuario', 'Conta de Teste');
          window.dispatchEvent(new Event('lartop:sessao-alterada'));
        }""", papel)

    alterar_papel("PROFISSIONAL")
    footer.get_by_role("link", name="Meu painel profissional").wait_for(timeout=15000)
    for nome in ("Entrar na minha conta", "Encontrar profissional", "Criar meu perfil", "Sou profissional"):
        assert footer.get_by_role("link", name=nome).count() == 0, nome
    assert footer.get_by_text("Tipos de serviço").count() == 0
    assert footer.get_by_role("link", name="Termos de uso").count() == 1

    # Valida o rodapé exatamente no painel do prestador, como na captura do usuário.
    page.goto(BASE + "/painel", wait_until="load")
    page.locator("footer").get_by_role("link", name="Meu painel profissional").wait_for(timeout=15000)
    assert page.locator("footer").get_by_role("link", name="Entrar na minha conta").count() == 0

    page.goto(BASE + "/", wait_until="load")
    alterar_papel("CLIENTE")
    footer = page.locator("footer")
    footer.get_by_role("link", name="Minhas solicitações").wait_for(timeout=15000)
    assert footer.get_by_role("link", name="Buscar profissionais").count() == 1
    assert footer.get_by_role("link", name="Entrar na minha conta").count() == 0
    assert footer.get_by_text("Tipos de serviço").count() == 0

    alterar_papel("ADMIN")
    footer.get_by_role("link", name="Painel administrativo").wait_for(timeout=15000)
    assert footer.get_by_role("link", name="Buscar profissionais").count() == 0

    papel_atual[0] = None
    page.evaluate("""() => {
      localStorage.removeItem('lartop_sessao_ativa');
      localStorage.removeItem('lartop_tipo_usuario');
      localStorage.removeItem('lartop_nome_usuario');
      window.dispatchEvent(new Event('lartop:sessao-alterada'));
    }""")
    footer.get_by_role("link", name="Entrar na minha conta").wait_for(timeout=15000)
    assert footer.get_by_text("Tipos de serviço").count() == 1
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") + " RODAPÉ: visitante/cliente/prestador/admin e atualização de sessão OK")



def teste_responsividade_central_notificacoes(browser):
    """Popup de notificações deve caber na tela sem cortar título/ações."""
    for largura, altura in ((320, 620), (360, 740), (390, 844), (428, 900), (768, 850), (1366, 768)):
        context = browser.new_context(
            viewport={"width": largura, "height": altura},
            is_mobile=largura < 640, has_touch=largura < 640,
        )
        context.add_init_script("""
          localStorage.setItem('lartop_tipo_usuario', 'PROFISSIONAL');
          localStorage.setItem('lartop_nome_usuario', 'Prestador de Teste');
          localStorage.setItem('lartop_sessao_ativa', '1');
        """)
        page = context.new_page()
        acoes = []

        def api(route):
        if route.request.url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"id":"conta-teste","nome":"Conta Teste","tipo":"PROFISSIONAL"}))
            url = route.request.url
            if "/api/notificacoes?" in url:
                itens = [
                    {"id": "not-" + str(i), "tipo": "NOVA_SOLICITACAO",
                     "titulo": "Você recebeu um novo pedido" if i != 1 else "X" * 190,
                     "mensagem": "Solicitação de Corte de Grama. Acesse seu painel para responder. " +
                                 ("texto-sem-espacos" * 18 if i == 1 else ""),
                     "solicitacaoId": "pedido-" + str(i),
                     "lidaEm": None if i == 0 else "2026-11-03T21:41:00.000Z",
                     "criadoEm": "2026-11-03T21:41:00.000Z"} for i in range(15)
                ]
                return route.fulfill(status=200, content_type="application/json",
                                     body=json.dumps({"itens": itens, "naoLidas": 1}))
            if "/api/notificacoes/not-0/lida" in url:
                acoes.append("marcar-lida")
                return route.fulfill(status=200, content_type="application/json",
                                     body='{"ok":true}')
            if "/api/solicitacoes/recebidas" in url:
                return route.fulfill(status=200, content_type="application/json",
                                     body='{"itens":[],"total":0}')
            if url.endswith("/api/push/chave-publica"):
                return route.fulfill(status=503, content_type="application/json",
                                     body='{"erro":"mock"}')
            return route.fulfill(status=404, content_type="application/json", body='{"erro":"mock"}')

        page.route("**/api/**", api)
        page.goto(BASE + "/painel", wait_until="load")
        page.get_by_text("Nenhum pedido novo aguardando resposta.").wait_for(timeout=20000)
        sino = page.locator('button[aria-label^="Notificações:"]')
        sino.wait_for(timeout=15000)
        sino.click()
        painel = page.get_by_role("region", name="Central de notificações")
        painel.wait_for(state="visible", timeout=15000)
        painel.get_by_role("heading", name="Notificações").wait_for(timeout=15000)
        painel.locator("li").first.wait_for(timeout=15000)

        # Bounding boxes garantem que nenhuma parte do painel fique fora da viewport.
        tamanho = painel.evaluate("""el => {
          const r = el.getBoundingClientRect();
          const lista = el.querySelector('ul');
          const c = lista?.getBoundingClientRect();
          const viewport = document.documentElement.clientWidth;
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
                   vw: viewport, vh: window.innerHeight,
                   scrollWidth: document.documentElement.scrollWidth,
                   listaScroll: lista ? lista.scrollHeight : 0,
                   listaAltura: c ? c.height : 0 };
        }""")
        assert tamanho["left"] >= 7, f"painel cortado à esquerda {largura}: {tamanho}"
        assert tamanho["right"] <= largura - 7, f"painel cortado à direita {largura}: {tamanho}"
        assert tamanho["top"] >= 0, f"cabeçalho cortado {largura}: {tamanho}"
        assert tamanho["bottom"] <= altura - 4, f"painel passa da altura {largura}: {tamanho}"
        assert tamanho["scrollWidth"] <= tamanho["vw"] + 1, f"scroll horizontal {largura}: {tamanho}"
        assert tamanho["listaScroll"] > tamanho["listaAltura"] + 30, (
            f"lista deveria ter rolagem independente {largura}: {tamanho}"
        )
        # Título e botões devem ser acessíveis mesmo com 15 notificações e textos longos.
        painel.get_by_role("button", name="Fechar notificações").click()
        painel.wait_for(state="hidden")
        sino.click()
        painel.get_by_role("button", name="Marcar como lida").first.click()
        page.wait_for_timeout(150)
        assert "marcar-lida" in acoes, f"ação marcar como lida não chegou à API: {largura}"
        context.close()
        print(f"NOTIFICAÇÕES RESPONSIVAS: {largura}x{altura} OK")



def teste_recuperacao_push_expirado(browser):
    """Simula 410 removido no servidor e inscrição obsoleta ainda no navegador."""
    context = browser.new_context(viewport={"width": 390, "height": 844},
                                  is_mobile=True, has_touch=True)
    context.add_init_script("""
      localStorage.setItem('lartop_tipo_usuario', 'PROFISSIONAL');
      localStorage.setItem('lartop_nome_usuario', 'Prestador Teste Push');
      localStorage.setItem('lartop_sessao_ativa', '1');
      window.__pushTeste = { removidas: 0, novas: 0 };
      let inscricao = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/inscricao-antiga',
        unsubscribe: async () => { window.__pushTeste.removidas++; inscricao = null; return true; },
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/inscricao-antiga',
                        keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(22) } }),
      };
      const registro = {
        pushManager: {
          getSubscription: async () => inscricao,
          subscribe: async () => {
            window.__pushTeste.novas++;
            inscricao = {
              endpoint: 'https://fcm.googleapis.com/fcm/send/inscricao-renovada',
              toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/inscricao-renovada',
                              keys: { p256dh: 'c'.repeat(80), auth: 'd'.repeat(22) } }),
              unsubscribe: async () => { inscricao = null; return true; },
            };
            return inscricao;
          },
        },
      };
      Object.defineProperty(window, 'PushManager', { configurable: true, value: function() {} });
      Object.defineProperty(window, 'Notification', {
        configurable: true, value: { permission: 'granted', requestPermission: async () => 'granted' }
      });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true, value: {
          getRegistration: async () => registro,
          register: async () => registro,
        },
      });
    """)
    chamadas = []
    def api(route):
        if route.request.url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"id":"conta-teste","nome":"Conta Teste","tipo":"PROFISSIONAL"}))
        url = route.request.url
        if url.endswith("/api/push/assinaturas/verificar"):
            chamadas.append("verificar")
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"registrada":false}')
        if url.endswith("/api/push/chave-publica"):
            return route.fulfill(status=200, content_type="application/json",
                                 body=json.dumps({"chave": "B" * 88}))
        if url.endswith("/api/push/assinaturas") and route.request.method == "DELETE":
            chamadas.append("remover")
            corpo = route.request.post_data_json
            assert corpo["endpoint"].endswith("/inscricao-antiga")
            return route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
        if url.endswith("/api/push/assinaturas"):
            chamadas.append("registrar")
            corpo = route.request.post_data_json
            assert corpo["endpoint"].endswith("/inscricao-renovada")
            return route.fulfill(status=201, content_type="application/json", body='{"ok":true}')
        if "/api/solicitacoes/recebidas" in url:
            return route.fulfill(status=200, content_type="application/json", body='{"itens":[],"total":0}')
        if "/api/notificacoes" in url:
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"itens":[],"naoLidas":0}')
        return route.fulfill(status=404, content_type="application/json", body='{"erro":"mock"}')
    context.route("**/api/**", api)
    page = context.new_page()
    page.goto(BASE + "/painel", wait_until="load")
    page.get_by_text("Alertas ativados neste aparelho").wait_for(timeout=20000)
    estado = page.evaluate("window.__pushTeste")
    assert estado == {"removidas": 1, "novas": 1}, estado
    assert chamadas == ["verificar", "remover", "registrar"], chamadas
    page.get_by_role("button", name="Reparar alertas").wait_for()
    context.close()
    print("PUSH 410: reinscrição obsoleta recuperada e registrada novamente OK")



def teste_filtros_pedidos_prestador(browser, mobile=False):
    """Pedidos novos aparecem primeiro, histórico fica separado e páginas têm só cinco."""
    from urllib.parse import urlsplit, parse_qs

    context = browser.new_context(
        viewport={"width": 390 if mobile else 1366, "height": 844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile,
    )
    context.add_init_script("""
      localStorage.setItem('lartop_tipo_usuario', 'PROFISSIONAL');
      localStorage.setItem('lartop_nome_usuario', 'Prestador de teste');
      localStorage.setItem('lartop_sessao_ativa', '1');
    """)
    page = context.new_page()
    chamadas = []
    estados = {f"pedido-{i}": "PENDENTE" if i <= 8 else
               "RESPONDIDA" if i == 9 else "ACEITA" if i == 10 else
               "CONCLUIDA" if i <= 16 else "RECUSADA"
               for i in range(1, 21)}

    def api(route):
        if route.request.url.endswith("/api/usuarios/mim"):
            return route.fulfill(status=200, content_type="application/json",
                body=json.dumps({"id":"conta-teste","nome":"Conta Teste","tipo":"PROFISSIONAL"}))
        url = route.request.url
        path = urlsplit(url).path
        if path.endswith("/api/solicitacoes/recebidas"):
            q = parse_qs(urlsplit(url).query)
            grupo = q.get("grupo", ["TODOS"])[0]
            pagina = int(q.get("pagina", ["1"])[0])
            por_pagina = int(q.get("porPagina", ["20"])[0])
            chamadas.append(("listar", grupo, pagina, por_pagina))
            filtrados = [
                (i, estado) for i in range(1, 21)
                if (estado := estados[f"pedido-{i}"]) and (
                    grupo == "TODOS" or
                    grupo == "NOVOS" and estado == "PENDENTE" or
                    grupo == "EM_ANDAMENTO" and estado in ("RESPONDIDA", "ACEITA") or
                    grupo == "HISTORICO" and estado in ("CONCLUIDA", "RECUSADA", "CANCELADA")
                )
            ]
            itens = [
                {"id": f"pedido-{i}", "endereco": "Rua teste, 1", "tamanhoM2": 20,
                 "descricao": None, "status": estado, "criadoEm": "2026-11-04T12:00:00.000Z",
                 "categoria": {"nome": "Corte de grama"},
                 "cliente": {"nome": f"Cliente {i}", "telefone": None,
                              "telefoneVerificado": False}}
                for i, estado in filtrados[(pagina - 1) * por_pagina:pagina * por_pagina]
            ]
            return route.fulfill(status=200, content_type="application/json",
                                 body=json.dumps({"total": len(filtrados), "itens": itens,
                                                  "pagina": pagina, "porPagina": por_pagina}))
        if path.endswith("/api/solicitacoes/pedido-1/status") and route.request.method == "PATCH":
            assert route.request.post_data_json["status"] == "ACEITA"
            estados["pedido-1"] = "ACEITA"
            chamadas.append(("atualizar", "pedido-1"))
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"id":"pedido-1","status":"ACEITA"}')
        if path.endswith("/api/push/assinaturas/verificar"):
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"registrada":true}')
        if path.endswith("/api/notificacoes"):
            return route.fulfill(status=200, content_type="application/json",
                                 body='{"itens":[],"naoLidas":0}')
        return route.fulfill(status=404, content_type="application/json",
                             body='{"erro":"API simulada"}')

    page.route("**/api/**", api)
    page.goto(BASE + "/painel", wait_until="load")
    page.get_by_role("button", name="Novos", exact=True).wait_for(timeout=15000)
    page.get_by_text("8 solicitações nesta categoria", exact=False).wait_for(timeout=15000)
    assert page.get_by_text("Cliente 1 - Rua teste, 1").count() == 1
    assert page.get_by_text("Cliente 6 - Rua teste, 1").count() == 0
    assert ("listar", "NOVOS", 1, 5) in chamadas

    page.get_by_role("button", name="Próxima").click()
    page.get_by_text("Cliente 6 - Rua teste, 1").wait_for(timeout=15000)
    assert page.get_by_text("Cliente 1 - Rua teste, 1").count() == 0
    assert ("listar", "NOVOS", 2, 5) in chamadas

    page.get_by_role("button", name="Histórico").click()
    page.get_by_text("Concluído").first.wait_for(timeout=15000)
    assert page.get_by_text("Cliente 6 - Rua teste, 1").count() == 0
    assert ("listar", "HISTORICO", 1, 5) in chamadas

    page.get_by_role("button", name="Em andamento").click()
    page.get_by_text("Cliente 9 - Rua teste, 1").wait_for(timeout=15000)
    assert ("listar", "EM_ANDAMENTO", 1, 5) in chamadas

    page.get_by_role("button", name="Novos", exact=True).click()
    page.get_by_text("Cliente 1 - Rua teste, 1").wait_for(timeout=15000)
    page.get_by_role("button", name="Marcar como Aceito").first.click()
    page.get_by_text("7 solicitações nesta categoria", exact=False).wait_for(timeout=15000)
    assert ("atualizar", "pedido-1") in chamadas
    assert page.get_by_text("Cliente 1 - Rua teste, 1").count() == 0
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") +
          " pedidos agrupados: 5 por página, histórico preservado e aceite atualiza lista OK")


if __name__ == "__main__":
    wait_server()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            scenario(browser, mobile=False)
            scenario(browser, mobile=True)
            admin_logout(browser, mobile=False)
            admin_logout(browser, mobile=True)
            teste_renovacao_entre_abas(browser)
            teste_profissional_nao_entra_no_fluxo_cliente(browser, mobile=False)
            teste_profissional_nao_entra_no_fluxo_cliente(browser, mobile=True)
            teste_cliente_pode_continuar_na_busca(browser)
            teste_rodape_contextual(browser, mobile=False)
            teste_rodape_contextual(browser, mobile=True)
            teste_responsividade_central_notificacoes(browser)
            teste_filtros_pedidos_prestador(browser, mobile=False)
            teste_filtros_pedidos_prestador(browser, mobile=True)
            teste_recuperacao_push_expirado(browser)
        finally:
            browser.close()
