"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restaurarSessao, observarSessao, type SessaoLocal } from "@/lib/auth-client";

export function useGuardaCliente() {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroSessao, setErroSessao] = useState("");

  useEffect(() => {
    let ativo = true;
    async function validar() {
      try {
        setErroSessao("");
        // Nunca confiar apenas em tipo/nome do localStorage para decidir papel.
        // O BFF adiciona o JWT HttpOnly e a API verifica conta/papel.
        const atual = await restaurarSessao();
        if (!ativo) return;
        if (!atual || atual.tipo !== "CLIENTE") {
          setSessao(null);
          setCarregando(false);
          router.replace("/entrar");
          return;
        }
        setSessao(atual);
        setCarregando(false);
      } catch {
        if (!ativo) return;
        // Erro de rede não apaga cookies válidos nem causa logout falso.
        setSessao(null);
        setErroSessao("Não foi possível verificar sua sessão. Confira a conexão e tente novamente.");
        setCarregando(false);
      }
    }
    void validar();
    const parar = observarSessao(() => { void validar(); });
    return () => { ativo = false; parar(); };
  }, [router]);

  return { sessao, carregando, erroSessao };
}
