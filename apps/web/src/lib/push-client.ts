"use client";

import { fetchAutenticado } from "@/lib/auth-client";

/** Remove a inscrição local e avisa a API; outras contas/dispositivos não são afetados. */
export async function desativarPushNoDispositivo(accessToken: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.getRegistration("/");
  const assinatura = await registro?.pushManager.getSubscription();
  if (!assinatura) return;

  let falhaServidor = false;
  try {
    const resposta = await fetchAutenticado("/api/push/assinaturas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ endpoint: assinatura.endpoint }),
      keepalive: true,
    });
    falhaServidor = !resposta.ok;
  } catch {
    falhaServidor = true;
  } finally {
    // Parar a inscrição local mesmo quando o servidor está inacessível.
    await assinatura.unsubscribe();
  }
  if (falhaServidor) {
    throw new Error("Alertas desativados neste aparelho. Não foi possível confirmar no servidor.");
  }
}
