"""Browser end-to-end: novo cliente sem conta, Next real + Railway fake local.
Sem acesso à produção, números reais ou APIs pagas.
"""
import json
import re
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
PROF = "11111111-1111-4111-8111-111111111111"
CAT = "22222222-2222-4222-8222-222222222222"
PEDIDO = "33333333-3333-4333-8333-333333333333"

eventos = []
pedido_capturado = []
concluido = False
avaliacao_feita = False

class BackendSimulado(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def responder(self, codigo, dados):
        corpo = json.dumps(dados).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        caminho = urlparse(self.path).path
        eventos.append(("GET", caminho))
        if caminho == "/api/profissionais/" + PROF:
            return self.responder(200, {
                "usuarioId": PROF, "nomeExibicao": "Prestador Simulado",
                "bio": None, "fotoPerfilUrl": None, "raioAtendimentoKm": 15,
                "seloVerificado": False, "notaMedia": 0, "totalAvaliacoes": 0,
                "cidade": {"id": "44444444-4444-4444-8444-444444444444",
                           "nome": "Maricá", "estado": "RJ"},
                "categorias": [{"id": "vinculo-ci", "valorReferencia": None,
                               "categoria": {"id": CAT, "nome": "Limpeza de piscina",
                                             "slug": "limpeza-de-piscina"}}],
                "fotos": [],
            })
        if caminho == "/api/usuarios/mim":
            return self.responder(401, {"erro": "Visitante sem conta"})
        if caminho == "/api/notificacoes":
            return self.responder(200, {"itens": [], "naoLidas": 0})
        return self.responder(404, {"erro": "Recurso simulado indisponível"})

    def do_POST(self):
        caminho = urlparse(self.path).path
        tamanho = int(self.headers.get("Content-Length", "0"))
        assert tamanho <= 16_384, "Corpo da solicitação deve ser pequeno"
        dados = json.loads(self.rfile.read(tamanho) or b"{}")
        eventos.append(("POST", caminho))

        if caminho == "/api/auth/refresh":
            return self.responder(401, {"erro": "Entre novamente"})
        if caminho == "/api/solicitacoes/rapidas":
            # Exerce a cadeia real Browser -> Next BFF -> backend simulado.
            assert not self.headers.get("Authorization"), "Visitante não deve ter JWT"
            assert not self.headers.get("Cookie"), "BFF não deve transmitir cookies"
            assert dados["profissionalId"] == PROF
            assert dados["categoriaId"] == CAT
            assert dados["nome"] == "João Visitante"
            assert dados["whatsapp"] == "(21) 99999-1111"
            assert dados["consentimento"] is True
            assert re.fullmatch(r"[A-Za-z0-9_-]{43}", dados["token"])
            assert re.fullmatch(r"[0-9a-f-]{36}", dados["tentativaId"])
            assert "email" not in dados and "senha" not in dados
            pedido_capturado.append(dados)
            return self.responder(201, {
                "id": PEDIDO, "status": "PENDENTE",
                "linkWhatsapp": "https://wa.me/5521999992222?text=Teste",
                "categoria": {"nome": "Limpeza de piscina"},
                "profissional": {"nomeExibicao": "Prestador Simulado"},
            })
        if caminho == f"/api/solicitacoes/rapidas/{PEDIDO}/acompanhar":
            if not pedido_capturado or dados.get("token") != pedido_capturado[-1]["token"]:
                return self.responder(404, {"erro": "Link inválido ou expirado"})
            return self.responder(200, {
                "id": PEDIDO, "referencia": "10427",
                "status": "CONCLUIDA" if concluido else "PENDENTE",
                "jaAvaliada": avaliacao_feita,
                "avaliacao": {"nota": 5, "comentario": "Prestador atencioso."} if avaliacao_feita else None,
                "criadoEm": "2026-11-16T20:00:00.000Z",
                "categoria": {"nome": "Limpeza de piscina"},
                "profissional": {"nomeExibicao": "Prestador Simulado"},
                "linkWhatsapp": "https://wa.me/5521999992222?text=Teste",
            })
        if caminho == f"/api/solicitacoes/rapidas/{PEDIDO}/avaliar":
            global avaliacao_feita
            if not concluido:
                return self.responder(409, {"erro": "Não concluído"})
            if not pedido_capturado or dados.get("token") != pedido_capturado[-1]["token"]:
                return self.responder(404, {"erro": "Link inválido"})
            if dados.get("confirmacao") is not True or dados.get("nota") not in (1, 2, 3, 4, 5):
                return self.responder(400, {"erro": "Confirme e selecione nota"})
            if avaliacao_feita:
                return self.responder(409, {"erro": "Avaliação já registrada"})
            avaliacao_feita = True
            return self.responder(201, {"id": "avaliacao-test", "nota": dados["nota"]})
        return self.responder(404, {"erro": "Rota simulada indisponível"})


def executar(browser, mobile=False):
    global concluido, avaliacao_feita
    concluido = False
    avaliacao_feita = False
    context = browser.new_context(
        viewport={"width": 390 if mobile else 1366, "height": 844 if mobile else 768},
        is_mobile=mobile, has_touch=mobile,
    )
    pagina = context.new_page()
    pagina.goto(BASE + "/solicitar?profissionalId=" + PROF, wait_until="domcontentloaded")
    pagina.get_by_role("heading", name="Pedido rápido, sem cadastro").wait_for(timeout=20000)
    assert pagina.locator('input[type="password"], input[type="email"]').count() == 0
    pagina.get_by_label("Seu nome").fill("João Visitante")
    pagina.get_by_label("WhatsApp com DDD").fill("(21) 99999-1111")
    pagina.get_by_label("O que você precisa?").fill("Gostaria de limpar a piscina esta semana.")
    pagina.get_by_role("checkbox").check()
    pagina.get_by_role("button", name="Solicitar serviço sem cadastro").click()
    pagina.get_by_role("heading", name="Solicitação registrada!").wait_for(timeout=20000)
    assert len(pedido_capturado) >= 1
    link = pagina.get_by_label("Link privado de acompanhamento").input_value()
    assert re.fullmatch(r"http://localhost:3000/acompanhar/" + PEDIDO + r"#[A-Za-z0-9_-]{43}", link)
    assert pedido_capturado[-1]["token"] == link.split("#", 1)[1]
    assert pagina.evaluate("sessionStorage.getItem('lartop:rapida:tentativa:v1')") is None
    # Um site terceiro não pode usar o gateway para criar pedidos em nome do visitante.
    total_postagens = sum(1 for metodo, caminho in eventos
                          if metodo == "POST" and caminho == "/api/solicitacoes/rapidas")
    cross_site = context.request.post(
        BASE + "/api/solicitacoes/rapidas",
        headers={"Origin": "https://exemplo-malicioso.invalid",
                 "Sec-Fetch-Site": "cross-site",
                 "Content-Type": "application/json"},
        data=json.dumps({"nome": "Invasor"}),
    )
    assert cross_site.status == 403, cross_site.text()
    assert sum(1 for metodo, caminho in eventos
               if metodo == "POST" and caminho == "/api/solicitacoes/rapidas") == total_postagens
    assert "wa.me/5521999992222" in pagina.get_by_role(
        "link", name=re.compile("Conversar com Prestador Simulado")
    ).get_attribute("href")
    # O WhatsApp ainda depende de o visitante apertar Enviar.
    pagina.get_by_role("link", name="Acompanhar pedido").click()
    pagina.get_by_role("heading", name="Acompanhar solicitação").wait_for(timeout=20000)
    pagina.get_by_text("Aguardando resposta do prestador").wait_for(timeout=20000)
    assert pagina.url == link
    assert not any("#" in path for _method, path in eventos)
    assert pagina.locator('input[type="password"]').count() == 0

    # Prestador conclui pedido no backend mock. O visitante continua autenticado
    # apenas pelo fragmento criptograficamente forte do próprio link.
    concluido = True
    pagina.get_by_role("button", name="Atualizar status").click()
    pagina.get_by_role("heading", name="O serviço foi realizado?").wait_for(timeout=20000)
    assert "Referência LARTOP: 10427" in pagina.locator("main").inner_text()
    pagina.get_by_label("Não, o serviço não foi realizado").check()
    pagina.get_by_text("Não enviaremos uma avaliação.").wait_for(timeout=20000)
    pagina.get_by_label("Sim, o serviço foi realizado").check()
    pagina.get_by_role("button", name="5 estrelas").click()
    pagina.get_by_label("Comentário (opcional)").fill("Prestador atencioso.")
    pagina.get_by_role("button", name="Enviar avaliação").click()
    pagina.get_by_role("heading", name="Avaliação registrada").wait_for(timeout=20000)
    assert avaliacao_feita, "A API simulada deve registrar uma avaliação"
    assert pagina.get_by_role("button", name="Enviar avaliação").count() == 0
    context.close()
    print(("MOBILE" if mobile else "DESKTOP") + " contratação sem cadastro, WhatsApp e link privado OK")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 3333), BackendSimulado)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            try:
                executar(browser, mobile=False)
                executar(browser, mobile=True)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
