"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CategoriaBusca {
  slug: string;
  nome: string;
}

export function BuscaHero() {
  const router = useRouter();
  const [cep, setCep] = useState("");
  const [categoria, setCategoria] = useState("");
  const [erro, setErro] = useState("");
  const [categorias, setCategorias] = useState<CategoriaBusca[]>([]);

  useEffect(() => {
    let ativo = true;
    fetch("/api/categorias", { cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Erro ao listar serviços");
        const dados: unknown = await resposta.json();
        if (!Array.isArray(dados)) throw new Error("Resposta inválida de serviços");
        return dados.filter((item): item is CategoriaBusca =>
          item && typeof item.slug === "string" && typeof item.nome === "string"
        );
      })
      .then((dados) => { if (ativo) setCategorias(dados); })
      .catch(() => { if (ativo) setCategorias([]); });
    return () => { ativo = false; };
  }, []);

  function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      setErro("Digite um CEP válido, com 8 números.");
      return;
    }

    setErro("");
    const params = new URLSearchParams({ cep: cepLimpo });
    if (categoria) params.set("categoria", categoria);
    router.push(`/buscar?${params.toString()}`);
  }

  return (
    <form onSubmit={aoSubmeter} className="flex flex-col gap-3 rounded-2xl bg-sauge-50/95 p-4 shadow-lg shadow-pinho-900/10 backdrop-blur sm:flex-row sm:items-stretch sm:p-2">
      <div className="flex flex-1 flex-col gap-1 px-2 py-1 sm:py-2">
        <label htmlFor="cep" className="text-xs font-medium uppercase tracking-wide text-pinho-700">Seu CEP</label>
        <input id="cep" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} maxLength={9} className="bg-transparent font-data text-lg text-pinho-900 outline-none placeholder:text-pinho-900/30" />
      </div>

      <div className="hidden w-px bg-areia-300 sm:block" />

      <div className="flex flex-1 flex-col gap-1 px-2 py-1 sm:py-2">
        <label htmlFor="categoria" className="text-xs font-medium uppercase tracking-wide text-pinho-700">Serviço</label>
        <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-transparent text-base text-pinho-900 outline-none">
          <option value="">Todos os serviços</option>
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>{c.nome}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 sm:my-1">Buscar profissionais</button>

      {erro && <p className="absolute mt-16 text-sm text-terra-600 sm:relative sm:mt-0">{erro}</p>}
    </form>
  );
}
