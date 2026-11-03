"use client";

import { useState, type FormEvent } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { registrarComoCliente } from "@/lib/auth-client";

export default function CadastroPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }
    if (senha.length < 8 || senha.length > 72) {
      setErro("A senha precisa ter entre 8 e 72 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      await registrarComoCliente({ nome: nome.trim(), email: email.trim(), senha });
      setConcluido(true);
      setSenha("");
      setConfirmarSenha("");
    } catch (erroDesconhecido) {
      setErro(erroDesconhecido instanceof Error ? erroDesconhecido.message : "Não foi possível criar a conta.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
          {concluido ? (
            <div role="status">
              <h1 className="font-display text-2xl font-semibold text-pinho-900">Conta criada!</h1>
              <p className="mt-4 text-pinho-700">Seu cadastro foi realizado. Você já pode entrar com o e-mail e a senha escolhidos.</p>
              <a href="/entrar" className="mt-6 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-white">Ir para o login</a>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold text-pinho-900">Criar minha conta</h1>
              <p className="mt-2 text-pinho-700">Cadastre-se para utilizar o Lartop.</p>
              <form onSubmit={aoSubmeter} className="mt-6 flex flex-col gap-3">
                <label htmlFor="cadastro-nome" className="text-sm text-pinho-700">Nome</label>
                <input id="cadastro-nome" autoComplete="name" type="text" minLength={2} maxLength={120} required value={nome} onChange={e => setNome(e.target.value)} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
                <label htmlFor="cadastro-email" className="text-sm text-pinho-700">E-mail</label>
                <input id="cadastro-email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
                <label htmlFor="cadastro-senha" className="text-sm text-pinho-700">Senha (mínimo 8 caracteres)</label>
                <input id="cadastro-senha" autoComplete="new-password" type="password" minLength={8} maxLength={72} required value={senha} onChange={e => setSenha(e.target.value)} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
                <label htmlFor="cadastro-confirmar" className="text-sm text-pinho-700">Confirme a senha</label>
                <input id="cadastro-confirmar" autoComplete="new-password" type="password" minLength={8} maxLength={72} required value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
                {erro && <p role="alert" className="text-sm text-terra-600">{erro}</p>}
                <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
                  {carregando ? "Criando conta..." : "Criar conta"}
                </button>
              </form>
              <p className="mt-6 text-sm text-pinho-700">Já tem conta? <a href="/entrar" className="font-medium text-relva-600 hover:underline">Entrar</a></p>
            </>
          )}
        </div>
      </main>
      <Rodape />
    </>
  );
}
