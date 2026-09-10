"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { entrar } from "@/lib/auth-client";

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const sessao = await entrar(email, senha);
      if (sessao.tipo === "PROFISSIONAL") {
        router.push("/painel");
      } else if (sessao.tipo === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Nao foi possivel entrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
          <h1 className="font-display text-2xl font-semibold text-pinho-900">Entrar</h1>
          <p className="mt-2 text-pinho-700">Acesse sua conta de cliente ou profissional.</p>

          <form onSubmit={aoSubmeter} className="mt-6 flex flex-col gap-3">
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
            <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />

            {erro && <p className="text-sm text-terra-600">{erro}</p>}

            <div className="flex justify-end">
              <a href="/esqueci-senha" className="text-sm text-relva-600 hover:underline">Esqueci minha senha</a>
            </div>

            <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-sm text-pinho-700">
            E profissional e ainda nao tem conta?{" "}
            <a href="/para-profissionais" className="font-medium text-relva-600 hover:underline">Cadastre-se aqui</a>
          </p>
        </div>
      </main>
      <Rodape />
    </>
  );
}
