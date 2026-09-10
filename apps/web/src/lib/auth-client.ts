"use client";

const CHAVE_TOKEN = "lartop_access_token";
const CHAVE_TIPO = "lartop_tipo_usuario";
const CHAVE_NOME = "lartop_nome_usuario";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export interface SessaoLocal {
  accessToken: string;
  tipo: "CLIENTE" | "PROFISSIONAL" | "ADMIN";
  nome: string;
}

export function obterSessao(): SessaoLocal | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(CHAVE_TOKEN);
  const tipo = localStorage.getItem(CHAVE_TIPO) as SessaoLocal["tipo"] | null;
  const nome = localStorage.getItem(CHAVE_NOME);
  if (!accessToken || !tipo || !nome) return null;
  return { accessToken, tipo, nome };
}

export function salvarSessao(sessao: SessaoLocal) {
  localStorage.setItem(CHAVE_TOKEN, sessao.accessToken);
  localStorage.setItem(CHAVE_TIPO, sessao.tipo);
  localStorage.setItem(CHAVE_NOME, sessao.nome);
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_TIPO);
  localStorage.removeItem(CHAVE_NOME);
}

async function buscarUsuarioLogado(accessToken: string): Promise<{ nome: string; tipo: SessaoLocal["tipo"] }> {
  const resposta = await fetch(`${API_URL}/api/usuarios/mim`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const dados = await resposta.json();
  return { nome: dados.nome, tipo: dados.tipo };
}

export async function entrar(email: string, senha: string): Promise<SessaoLocal> {
  const resposta = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, senha }),
  });

  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro ?? "Nao foi possivel entrar");
  }

  const usuario = await buscarUsuarioLogado(dados.accessToken);
  const sessao: SessaoLocal = { accessToken: dados.accessToken, tipo: usuario.tipo, nome: usuario.nome };
  salvarSessao(sessao);
  return sessao;
}

export async function registrarComoCliente(input: { nome: string; email: string; senha: string; telefone?: string }): Promise<SessaoLocal> {
  const resposta = await fetch(`${API_URL}/api/auth/registrar/cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro ?? "Nao foi possivel cadastrar");
  }

  const sessao: SessaoLocal = { accessToken: dados.accessToken, tipo: dados.usuario.tipo, nome: dados.usuario.nome };
  salvarSessao(sessao);
  return sessao;
}
