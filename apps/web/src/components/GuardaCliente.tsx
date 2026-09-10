"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obterSessao, type SessaoLocal } from "@/lib/auth-client";

export function useGuardaCliente() {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const s = obterSessao();
    if (!s || s.tipo !== "CLIENTE") {
      router.replace("/entrar");
      return;
    }
    setSessao(s);
    setCarregando(false);
  }, [router]);

  return { sessao, carregando };
}
