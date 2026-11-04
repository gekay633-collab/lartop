"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterSessao, observarSessao, type SessaoLocal } from "@/lib/auth-client";

/**
 * A página de perfil é pública, mas apenas visitantes e clientes podem iniciar
 * uma solicitação. Não apresentar um CTA enganoso ao titular do perfil.
 */
export function AcaoPedirOrcamento({ profissionalId }: { profissionalId: string }) {
  const [tipo, setTipo] = useState<SessaoLocal["tipo"] | null | undefined>(undefined);

  useEffect(() => {
    const atualizar = () => setTipo(obterSessao()?.tipo ?? null);
    atualizar();
    return observarSessao(atualizar);
  }, []);

  if (tipo === undefined) return null;

  if (tipo === "PROFISSIONAL" || tipo === "ADMIN") {
    const destino = tipo === "PROFISSIONAL" ? "/painel" : "/admin";
    return (
      <div className="mt-5">
        <p className="text-sm text-pinho-700">
          Para solicitar um serviço é necessário usar uma conta de cliente.
        </p>
        <Link href={destino} className="mt-3 block rounded-xl border border-pinho-900 px-4 py-3 text-center font-semibold text-pinho-900 transition hover:bg-sauge-100">
          Voltar ao meu painel
        </Link>
      </div>
    );
  }

  return (
    <Link href={`/solicitar?profissionalId=${encodeURIComponent(profissionalId)}`}
      className="mt-5 block rounded-xl bg-relva-500 px-4 py-3 text-center font-semibold text-sauge-50 transition hover:bg-relva-600">
      Pedir orçamento
    </Link>
  );
}
