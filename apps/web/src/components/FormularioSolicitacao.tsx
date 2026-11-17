"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { restaurarSessao, type SessaoLocal } from "@/lib/auth-client";
import { FormularioRapido } from "@/components/FormularioRapido";

interface Categoria {
  id: string;
  categoria: { id: string; nome: string; slug: string };
}

/**
 * Único formulário para novos pedidos: sem e-mail ou senha.
 * A tela conserva o bloqueio de sessão profissional/ADM que existia no legado;
 * clientes antigos também utilizam a contratação rápida daqui em diante.
 */
export function FormularioSolicitacao({
  profissionalId, profissionalNome, categorias,
}: {
  profissionalId: string;
  profissionalNome: string;
  categorias: Categoria[];
}) {
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void restaurarSessao()
      .then((atual) => { if (ativo) setSessao(atual); })
      .catch(() => { if (ativo) setSessao(null); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  if (carregando) return <p className="text-pinho-700">Carregando...</p>;

  if (sessao?.tipo === "PROFISSIONAL" || sessao?.tipo === "ADMIN") {
    const destino = sessao.tipo === "ADMIN" ? "/admin" : "/painel";
    return (
      <div className="rounded-2xl border border-terra-500/30 bg-terra-500/10 p-6">
        <p className="font-medium text-terra-600">
          Esta área é destinada a quem precisa contratar um serviço.
          Você está conectado à sua conta de {sessao.tipo === "ADMIN" ? "administrador" : "prestador"}.
        </p>
        <Link href={destino} className="mt-3 inline-block text-sm font-semibold text-relva-600 underline">
          Voltar ao meu painel
        </Link>
      </div>
    );
  }

  return (
    <FormularioRapido
      profissionalId={profissionalId}
      profissionalNome={profissionalNome}
      categorias={categorias}
    />
  );
}
