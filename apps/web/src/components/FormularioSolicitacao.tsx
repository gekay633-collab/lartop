"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterSessao, observarSessao, type SessaoLocal } from "@/lib/auth-client";
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
  // Nenhuma chamada de autenticação bloqueia a exibição para visitantes.
  // O papel armazenado é apenas uma dica de interface, nunca autorização da API.
  const [tipo, setTipo] = useState<SessaoLocal["tipo"] | null | undefined>(undefined);

  useEffect(() => {
    const atualizar = () => setTipo(obterSessao()?.tipo ?? null);
    atualizar();
    return observarSessao(atualizar);
  }, []);

  if (tipo === undefined) return null;

  if (tipo === "PROFISSIONAL" || tipo === "ADMIN") {
    const destino = tipo === "ADMIN" ? "/admin" : "/painel";
    return (
      <div className="rounded-2xl border border-terra-500/30 bg-terra-500/10 p-6">
        <p className="font-medium text-terra-600">
          Esta área é destinada a quem precisa contratar um serviço.
          Você está conectado à sua conta de {tipo === "ADMIN" ? "administrador" : "prestador"}.
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
