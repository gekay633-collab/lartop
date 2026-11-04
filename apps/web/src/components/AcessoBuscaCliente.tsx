"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { obterSessao, observarSessao, type SessaoLocal } from "@/lib/auth-client";

/**
 * Pesquisa e contratação são fluxos de cliente. A consulta pública dos perfis
 * continua acessível a visitantes; profissionais e admins logados retornam aos
 * seus painéis. A regra de autorização definitiva vive na API.
 */
export function AcessoBuscaCliente({
  children,
  redirecionar = false,
}: {
  children: ReactNode;
  redirecionar?: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<SessaoLocal["tipo"] | null | undefined>(undefined);

  useEffect(() => {
    const atualizar = () => {
      const tipoAtual = obterSessao()?.tipo ?? null;
      setTipo(tipoAtual);
      if (redirecionar && tipoAtual === "PROFISSIONAL") {
        router.replace("/painel");
      } else if (redirecionar && tipoAtual === "ADMIN") {
        router.replace("/admin");
      }
    };
    atualizar();
    return observarSessao(atualizar);
  }, [redirecionar, router]);

  if (tipo === undefined) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-center text-pinho-700">Carregando...</p>;
  }

  if (tipo === "PROFISSIONAL" || tipo === "ADMIN") {
    if (redirecionar) {
      return <p className="mx-auto max-w-3xl px-4 py-10 text-center text-pinho-700">Voltando ao seu painel...</p>;
    }
    const destino = tipo === "PROFISSIONAL" ? "/painel" : "/admin";
    return (
      <div className="rounded-2xl bg-sauge-50/95 p-5 text-pinho-900">
        <p className="font-medium">A busca e a contratação são destinadas a contas de cliente.</p>
        <p className="mt-2 text-sm text-pinho-700">Sua conta está conectada como {tipo === "PROFISSIONAL" ? "profissional" : "administrador"}.</p>
        <Link href={destino} className="mt-4 inline-block rounded-xl bg-relva-500 px-5 py-2 font-semibold text-sauge-50">Voltar ao meu painel</Link>
      </div>
    );
  }

  return <>{children}</>;
}
