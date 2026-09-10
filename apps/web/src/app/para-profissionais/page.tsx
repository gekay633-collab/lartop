"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { salvarSessao, type SessaoLocal } from "@/lib/auth-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export default function ParaProfissionaisPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cepBase, setCepBase] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`${API_URL}/api/auth/registrar/profissional`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nome, email, senha, telefone, cepBase: cepBase.replace(/\D/g, "") }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Nao foi possivel cadastrar");
      }
      const sessao: SessaoLocal = { accessToken: dados.accessToken, tipo: dados.usuario.tipo, nome: dados.usuario.nome };
      salvarSessao(sessao);
      router.push("/painel");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="textura-gramado-sutil border-b border-areia-300">
          <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6">
            <h1 className="font-display text-3xl font-semibold text-pinho-900">Trabalhe com jardinagem? Cadastre seu perfil de graca.</h1>
            <p className="mt-3 text-pinho-700">Receba pedidos de orcamento de clientes da sua regiao e feche negocio direto pelo WhatsApp.</p>
          </div>
        </div>

        <div className="mx-auto max-w-sm px-4 py-10 sm:px-6">
          <form onSubmit={aoSubmeter} className="flex flex-col gap-3">
            <input type="text" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
            <input type="password" placeholder="Senha (minimo 8 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
            <input type="tel" placeholder="WhatsApp com DDD" value={telefone} onChange={(e) => setTelefone(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
            <input type="text" placeholder="CEP onde voce atende" value={cepBase} onChange={(e) => setCepBase(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 font-data text-pinho-900 outline-none focus:border-relva-500" />

            {erro && <p className="text-sm text-terra-600">{erro}</p>}

            <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-terra-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-terra-600 disabled:opacity-60">
              {carregando ? "Cadastrando..." : "Criar meu perfil"}
            </button>
          </form>

          <p className="mt-6 text-sm text-pinho-700">
            Ja tem conta?{" "}
            <a href="/entrar" className="font-medium text-relva-600 hover:underline">Entrar</a>
          </p>
        </div>
      </main>
      <Rodape />
    </>
  );
}
