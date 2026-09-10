"use client";

import { useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    try {
      await fetch(`${API_URL}/api/auth/esqueci-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setEnviado(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
          <h1 className="font-display text-2xl font-semibold text-pinho-900">Esqueci minha senha</h1>
          <p className="mt-2 text-pinho-700">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>

          {enviado ? (
            <div className="mt-6 rounded-2xl border border-relva-500/40 bg-relva-500/10 p-5">
              <p className="text-pinho-900">Se esse e-mail estiver cadastrado, você vai receber um link de recuperação em instantes.</p>
              <p className="mt-2 text-sm text-pinho-700">Verifique também a caixa de spam.</p>
            </div>
          ) : (
            <form onSubmit={aoSubmeter} className="mt-6 flex flex-col gap-3">
              <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
              <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-pinho-700">
            Lembrou a senha? <a href="/entrar" className="font-medium text-relva-600 hover:underline">Entrar</a>
          </p>
        </div>
      </main>
      <Rodape />
    </>
  );
}
