/* Service Worker do Lartop. Sem cache offline ou controle de pedidos. */
// A atualização é segura porque este worker não intercepta fetch nem mantém
// caches. O novo diagnóstico deve valer mesmo para PWAs já instalados.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const titulo = typeof payload.title === "string" ? payload.title.slice(0, 120) : "Lartop";
  const corpo = typeof payload.body === "string" ? payload.body.slice(0, 300) : "Você recebeu uma atualização.";
  const caminho = payload.url === "/painel" ? "/painel" : "/minhas-solicitacoes";
  const tag = typeof payload.tag === "string" ? payload.tag : "lartop-pedido";

  // Um teste envia segredo efêmero criptografado dentro do Push.
  // A confirmação informa se o service worker chegou a executar
  // showNotification, mas NÃO prova que o Android mostrou o aviso.
  const diagnostico = payload.diagnostico;
  const testeValido = diagnostico &&
    typeof diagnostico.id === "string" &&
    /^[a-f0-9-]{36}$/.test(diagnostico.id) &&
    typeof diagnostico.segredo === "string" &&
    /^[a-f0-9]{64}$/.test(diagnostico.segredo);

  event.waitUntil((async () => {
    let estado = "exibida";
    try {
      await self.registration.showNotification(titulo, {
        body: corpo,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag,
        renotify: true,
        data: { url: caminho },
      });
    } catch {
      estado = "falha";
    }

    if (testeValido) {
      try {
        await fetch(`/api/push/teste/${diagnostico.id}/confirmar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          cache: "no-store",
          body: JSON.stringify({ segredo: diagnostico.segredo, estado }),
        });
      } catch {
        // Não impedir entrega do Push se a confirmação estiver offline.
      }
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destino = event.notification.data?.url === "/painel" ? "/painel" : "/minhas-solicitacoes";
  event.waitUntil((async () => {
    const url = new URL(destino, self.location.origin).href;
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const janela of janelas) {
      if (janela.url.startsWith(self.location.origin + "/")) {
        await janela.navigate(url);
        return janela.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
