"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const usuarioId = searchParams.get("id") ?? "";

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas nao coincidem.");
      return;
    }

    setCarregando(true);
    try {
      const resposta = await fetch(`${API_URL}/api/auth/redefinir-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId, token, novaSenha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Nao foi possivel redefinir a senha");

      setSucesso(true);
      setTimeout(() => router.push("/entrar"), 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setCarregando(false);
    }
  }

  if (!token || !usuarioId) {
    return (
      <>
        <Cabecalho />
        <main className="flex-1">
          <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
            <h1 className="font-display text-2xl font-semibold text-pinho-900">Link inválido</h1>
            <p className="mt-2 text-pinho-700">Esse link de recuperação está incompleto ou incorreto.</p>
            <a href="/esqueci-senha" className="mt-4 inline-block text-sm font-medium text-relva-600 hover:underline">Solicitar novo link</a>
          </div>
        </main>
        <Rodape />
      </>
    );
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
          <h1 className="font-display text-2xl font-semibold text-pinho-900">Criar nova senha</h1>
          <p className="mt-2 text-pinho-700">Digite sua nova senha abaixo.</p>

          {sucesso ? (
            <div className="mt-6 rounded-2xl border border-relva-500/40 bg-relva-500/10 p-5">
              <p className="text-pinho-900">Senha redefinida com sucesso! Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={aoSubmeter} className="mt-6 flex flex-col gap-3">
              <input type="password" placeholder="Nova senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={8} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
              <input type="password" placeholder="Confirmar nova senha" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required minLength={8} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />

              {erro && <p className="text-sm text-terra-600">{erro}</p>}

              <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
                {carregando ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>
          )}
        </div>
      </main>
      <Rodape />
    </>
  );
}
