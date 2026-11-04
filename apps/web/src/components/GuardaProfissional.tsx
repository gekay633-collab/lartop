"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obterSessao, observarSessao, type SessaoLocal } from "@/lib/auth-client";

export function useGuardaProfissional() {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const validar = () => {
      const atual = obterSessao();
      if (!atual || atual.tipo !== "PROFISSIONAL") {
        setSessao(null);
        setCarregando(false);
        router.replace("/entrar");
        return;
      }
      setSessao(atual);
      setCarregando(false);
    };
    validar();
    // Expiração, renovação e logout em outra aba atualizam o painel.
    return observarSessao(validar);
  }, [router]);

  return { sessao, carregando };
}
