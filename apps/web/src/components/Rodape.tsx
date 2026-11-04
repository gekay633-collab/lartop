"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterSessao, observarSessao, type SessaoLocal } from "@/lib/auth-client";

const SERVICOS = [
  { slug: "corte-de-grama", nome: "Corte de grama" },
  { slug: "poda", nome: "Poda de árvores e arbustos" },
  { slug: "paisagismo", nome: "Paisagismo" },
  { slug: "manutencao-jardim", nome: "Manutenção de jardim" },
  { slug: "limpeza-terreno", nome: "Limpeza de terreno" },
  { slug: "instalacao", nome: "Instalação de grama/jardim" },
  { slug: "piscineiro", nome: "Piscineiro" },
];

type TipoRodape = SessaoLocal["tipo"] | null | undefined;

const estiloLink = "hover:text-pinho-900";

export function Rodape() {
  // undefined durante a hidratação: não exibir links de visitante para quem
  // já está logado. A sessão pertence ao navegador; nunca é inferida no SSR.
  const [tipo, setTipo] = useState<TipoRodape>(undefined);

  useEffect(() => {
    const atualizar = () => setTipo(obterSessao()?.tipo ?? null);
    atualizar();
    // Login, renovação e logout, inclusive de outras abas, atualizam os links.
    return observarSessao(atualizar);
  }, []);

  const visitante = tipo === null;
  const profissional = tipo === "PROFISSIONAL";
  const cliente = tipo === "CLIENTE";
  const administrador = tipo === "ADMIN";

  return (
    <footer className="mt-auto border-t border-areia-300 bg-sauge-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className={`grid gap-8 sm:grid-cols-2 ${visitante ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <div>
            <p className="font-display text-lg text-pinho-900">Lartop</p>
            <p className="mt-2 max-w-xs text-sm text-pinho-700">
              Conectamos quem precisa cuidar da casa com profissionais de jardinagem, piscina e muito mais perto de você.
            </p>
            <a href="https://www.instagram.com/lartopoficial/" target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-relva-600 hover:underline">
              Instagram @lartopoficial
            </a>
          </div>

          {tipo !== undefined && (
            <nav aria-label="Acesso rápido">
              <p className="text-sm font-semibold uppercase tracking-wide text-pinho-900">
                {visitante ? "Acesso rápido" : "Meu espaço"}
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-pinho-700">
                {visitante && (
                  <>
                    <li><Link href="/buscar" className={estiloLink}>Encontrar profissional</Link></li>
                    <li><Link href="/para-profissionais" className={estiloLink}>Sou profissional</Link></li>
                    <li><Link href="/entrar" className={estiloLink}>Entrar na minha conta</Link></li>
                    <li><Link href="/para-profissionais" className={estiloLink}>Criar meu perfil</Link></li>
                  </>
                )}
                {profissional && (
                  <li><Link href="/painel" className={estiloLink}>Meu painel profissional</Link></li>
                )}
                {cliente && (
                  <>
                    <li><Link href="/buscar" className={estiloLink}>Buscar profissionais</Link></li>
                    <li><Link href="/minhas-solicitacoes" className={estiloLink}>Minhas solicitações</Link></li>
                  </>
                )}
                {administrador && (
                  <>
                    <li><Link href="/admin" className={estiloLink}>Painel administrativo</Link></li>
                    <li><Link href="/admin/prestadores" className={estiloLink}>Gerenciar prestadores</Link></li>
                  </>
                )}
              </ul>
            </nav>
          )}

          {visitante && (
            <nav aria-label="Tipos de serviço">
              <p className="text-sm font-semibold uppercase tracking-wide text-pinho-900">Tipos de serviço</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-pinho-700">
                {SERVICOS.map((servico) => (
                  <li key={servico.slug}>
                    <Link href={`/buscar?categoria=${servico.slug}`} className={estiloLink}>{servico.nome}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <nav aria-label="Informações">
            <p className="text-sm font-semibold uppercase tracking-wide text-pinho-900">Informações</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-pinho-700">
              <li><Link href="/#faq" className={estiloLink}>Perguntas frequentes</Link></li>
              <li><Link href="/termos-de-uso" className={estiloLink}>Termos de uso</Link></li>
              <li><Link href="/politica-de-privacidade" className={estiloLink}>Política de privacidade</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 border-t border-areia-300 pt-5 text-xs text-pinho-700/70">
          <p>&copy; {new Date().getFullYear()} Lartop. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
