"use client";

import { useState } from "react";

const PERGUNTAS = [
  {
    pergunta: "O que é a Lartop?",
    resposta: "A Lartop é uma vitrine que conecta quem precisa de serviços de jardinagem e corte de grama com profissionais da região. Você pesquisa pelo seu CEP, compara perfis e avaliações, e fala direto com o profissional pelo WhatsApp para combinar tudo.",
  },
  {
    pergunta: "Como contrato um profissional pela Lartop?",
    resposta: "Digite seu CEP, escolha o serviço e compare os perfis. Depois, informe apenas seu nome, WhatsApp e o que precisa. A LARTOP registra o pedido, fornece um link privado de acompanhamento e prepara a mensagem no WhatsApp do profissional; você confirma o envio.",
  },
  {
    pergunta: "Preciso criar conta ou senha para solicitar um serviço?",
    resposta: "Não. Você pede diretamente pelo perfil do prestador, só com nome e WhatsApp. Guarde o link privado recebido na tela: é por ele que você acompanha a solicitação e avalia o serviço depois de concluído.",
  },
  {
    pergunta: "Eu pago alguma taxa para contratar?",
    resposta: "Não. Contratar um profissional pela Lartop é totalmente gratuito para quem procura o serviço. Você negocia o valor direto com o profissional.",
  },
  {
    pergunta: "Como o profissional ganha dinheiro na Lartop?",
    resposta: "O profissional recebe diretamente do cliente pelo serviço prestado, sem comissão da Lartop sobre o valor combinado.",
  },
  {
    pergunta: "Preciso pagar para anunciar meus serviços?",
    resposta: "No momento, cadastrar e publicar seu perfil de profissional na Lartop é gratuito.",
  },
  {
    pergunta: "A Lartop atende em quais cidades?",
    resposta: "A Lartop cobre todo o Brasil. Como o cadastro de profissionais ainda está crescendo, a quantidade de opções disponíveis varia por região.",
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
