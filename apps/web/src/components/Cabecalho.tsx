"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obterSessao, encerrarSessao, type SessaoLocal } from "@/lib/auth-client";
import { SinoNotificacoes } from "@/components/SinoNotificacoes";
import { desativarPushNoDispositivo } from "@/lib/push-client";

export function Cabecalho() {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState("");

  useEffect(() => {
    setSessao(obterSessao());
    setCarregado(true);
  }, []);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setErroSaida("");
    const token = sessao?.accessToken;
    try {
      await encerrarSessao(token);
      if (token) {
        await desativarPushNoDispositivo(token).catch(() => undefined);
      }
      setSessao(null);
      setMenuAberto(false);
      router.push("/");
    } catch {
      // Sem confirmação do servidor, não informar logout como concluído.
      setErroSaida("Não foi possível encerrar sua sessão. Tente novamente.");
    } finally {
      setSaindo(false);
    }
  }

  const linksNavegacao = !carregado ? null : sessao?.tipo === "ADMIN" ? (
    <Link href="/admin" className="block py-2 hover:text-pinho-900 sm:py-0">Painel administrativo</Link>
  ) : sessao?.tipo === "PROFISSIONAL" ? (
    <Link href="/painel" className="block py-2 hover:text-pinho-900 sm:py-0">Meu painel</Link>
  ) : sessao?.tipo === "CLIENTE" ? (
    <>
      <Link href="/buscar" className="block py-2 hover:text-pinho-900 sm:py-0">Encontrar profissional</Link>
      <Link href="/minhas-solicitacoes" className="block py-2 hover:text-pinho-900 sm:py-0">Minhas solicitações</Link>
    </>
  ) : (
    <>
      <Link href="/buscar" className="block py-2 hover:text-pinho-900 sm:py-0">Encontrar profissional</Link>
      <Link href="/para-profissionais" className="block py-2 hover:text-pinho-900 sm:py-0">Sou profissional</Link>
    </>
  );

  return (
    <header className="border-b border-areia-300 bg-sauge-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-semibold text-pinho-900">Lartop</Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-pinho-700 sm:flex">
          {linksNavegacao}
          {!carregado ? null : sessao ? (
            <div className="flex items-center gap-3">
              <span className="text-pinho-900">Olá, {sessao.nome.split(" ")[0]}</span>
              <button onClick={() => void sair()} disabled={saindo} className="rounded-lg border border-pinho-900 px-4 py-2 text-pinho-900 transition hover:bg-pinho-900 hover:text-sauge-50 disabled:opacity-50">{saindo ? "Saindo..." : "Sair"}</button>
              {erroSaida && <span role="alert" className="max-w-52 text-xs text-terra-600">{erroSaida}</span>}
            </div>
          ) : (
            <Link href="/entrar" className="rounded-lg border border-pinho-900 px-4 py-2 text-pinho-900 transition hover:bg-pinho-900 hover:text-sauge-50">Entrar</Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {carregado && sessao && (
            <SinoNotificacoes accessToken={sessao.accessToken} tipo={sessao.tipo} />
          )}
          <button onClick={() => setMenuAberto(!menuAberto)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-areia-300 text-pinho-900 sm:hidden"
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"} aria-expanded={menuAberto}>
            {menuAberto ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {menuAberto && (
        <nav className="border-t border-areia-300 bg-sauge-50 px-4 py-3 text-sm font-medium text-pinho-700 sm:hidden">
          {linksNavegacao}
          {!carregado ? null : sessao ? (
            <div className="mt-2 flex flex-col gap-2 border-t border-areia-300 pt-3">
              <span className="text-pinho-900">Olá, {sessao.nome.split(" ")[0]}</span>
              <button onClick={() => void sair()} disabled={saindo} className="rounded-lg border border-pinho-900 px-4 py-2 text-center text-pinho-900 disabled:opacity-50">{saindo ? "Saindo..." : "Sair"}</button>
              {erroSaida && <p role="alert" className="text-sm text-terra-600">{erroSaida}</p>}
            </div>
          ) : (
            <Link href="/entrar" className="mt-2 block rounded-lg border border-pinho-900 px-4 py-2 text-center text-pinho-900">Entrar</Link>
          )}
        </nav>
      )}
    </header>
  );
}
