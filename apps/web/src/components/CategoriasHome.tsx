"use client";

import { useEffect, useState } from "react";
import { CardCategoria } from "@/components/CardCategoria";

interface CategoriaAtiva {
  id: string;
  nome: string;
  slug: string;
}

export function CategoriasHome() {
  const [categorias, setCategorias] = useState<CategoriaAtiva[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    fetch("/api/categorias", { cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Erro ao consultar serviços");
        const dados: unknown = await resposta.json();
        if (!Array.isArray(dados)) throw new Error("Resposta inválida");
        return dados.filter((item): item is CategoriaAtiva =>
          item && typeof item.id === "string" &&
          typeof item.nome === "string" && typeof item.slug === "string"
        );
      })
      .then((dados) => { if (ativo) setCategorias(dados); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);

  if (erro) {
    return <p className="mt-6 text-sm text-pinho-700">Não foi possível consultar os serviços agora.</p>;
  }

  if (!categorias) {
    return <p className="mt-6 text-sm text-pinho-700">Carregando serviços...</p>;
  }

  if (categorias.length === 0) {
    return <p className="mt-6 text-sm text-pinho-700">Em breve, novos serviços estarão disponíveis.</p>;
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {categorias.map((categoria) => (
        <CardCategoria key={categoria.id} slug={categoria.slug} nome={categoria.nome} />
      ))}
    </div>
  );
}
