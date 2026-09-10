"use client";

import { useState } from "react";

const PERGUNTAS = [
  {
    pergunta: "O que e a Lartop?",
    resposta: "A Lartop e uma vitrine que conecta quem precisa de servicos de jardinagem e corte de grama com profissionais da regiao. Voce pesquisa pelo seu CEP, compara perfis e avaliacoes, e fala direto com o profissional pelo WhatsApp para combinar tudo.",
  },
  {
    pergunta: "Como contrato um profissional pela Lartop?",
    resposta: "Digite seu CEP na busca, escolha o servico que precisa, compare os perfis disponiveis na sua regiao e clique em \"Pedir orcamento\". Voce preenche os detalhes do servico e a Lartop gera um link para conversar direto no WhatsApp do profissional.",
  },
  {
    pergunta: "Eu pago alguma taxa para contratar?",
    resposta: "Nao. Contratar um profissional pela Lartop e totalmente gratuito para quem procura o servico. Voce negocia o valor direto com o profissional.",
  },
  {
    pergunta: "Como o profissional ganha dinheiro na Lartop?",
    resposta: "O profissional recebe diretamente do cliente pelo servico prestado, sem comissao da Lartop sobre o valor combinado.",
  },
  {
    pergunta: "Preciso pagar para anunciar meus servicos?",
    resposta: "No momento, cadastrar e publicar seu perfil de profissional na Lartop e gratuito.",
  },
  {
    pergunta: "A Lartop atende em quais cidades?",
    resposta: "A Lartop cobre todo o Brasil. Como o cadastro de profissionais ainda esta crescendo, a quantidade de opcoes disponiveis varia por regiao.",
  },
];

export function Faq() {
  const [aberta, setAberta] = useState<number | null>(null);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      {PERGUNTAS.map((item, i) => (
        <div key={i} className="rounded-xl border border-areia-300 bg-white/70">
          <button
            onClick={() => setAberta(aberta === i ? null : i)}
            className="flex w-full items-center justify-between px-5 py-4 text-left font-medium text-pinho-900"
          >
            {item.pergunta}
            <span className="ml-4 shrink-0 text-relva-600">{aberta === i ? "−" : "+"}</span>
          </button>
          {aberta === i && (
            <p className="border-t border-areia-300 px-5 py-4 text-sm text-pinho-700">{item.resposta}</p>
          )}
        </div>
      ))}
    </div>
  );
}
