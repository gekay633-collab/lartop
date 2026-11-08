/* Service Worker do Lartop. Sem cache offline ou controle de pedidos. */
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const titulo = typeof payload.title === "string" ? payload.title.slice(0, 120) : "Lartop";
  const corpo = typeof payload.body === "string" ? payload.body.slice(0, 300) : "Você recebeu uma atualização.";
  const caminho = payload.url === "/painel" ? "/painel" : "/minhas-solicitacoes";
  const tag = typeof payload.tag === "string" ? payload.tag : "lartop-pedido";

  event.waitUntil(self.registration.showNotification(titulo, {
    body: corpo,
    // Android uses the badge as a small MONOCHROME glyph. The full-color
    // launcher icon has a solid background, so it can appear as a blank dot.
    icon: "/icon-192.png",
    badge: "/badge-notificacao-96.png",
    tag,
    renotify: true,
    data: { url: caminho },
  }));
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
