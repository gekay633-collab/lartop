function normalizarTelefone(telefone: string): string {
  const apenasDigitos = telefone.replace(/\D/g, '');
  // Um número nacional pode ter DDD 55 (ex.: Santa Maria/RS).
  // Só interpretar 55 como código do Brasil quando houver 12 ou 13 dígitos.
  if (apenasDigitos.startsWith('55') && [12, 13].includes(apenasDigitos.length)) return apenasDigitos;
  return `55${apenasDigitos}`;
}

interface DadosMensagemLead {
  categoriaNome: string;
  endereco: string;
  tamanhoM2: number;
  descricao?: string;
}

export function gerarLinkWhatsapp(telefoneProfissional: string, dados: DadosMensagemLead): string {
  const numero = normalizarTelefone(telefoneProfissional);

  const tamanhoFormatado = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(dados.tamanhoM2);

  const linhas = [
    'Olá! Encontrei seu perfil na Lartop e gostaria de solicitar um orçamento.',
    '',
    `*Serviço:* ${dados.categoriaNome}`,
    `*Endereço:* ${dados.endereco}`,
    `*Tamanho aproximado:* ${tamanhoFormatado} m²`,
  ];

  if (dados.descricao?.trim()) {
    linhas.push(`*Detalhes:* ${dados.descricao.trim()}`);
  }

  const mensagem = linhas.join('\n');
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Link gerado após registro de uma solicitação pública.
 * O WhatsApp é aberto com texto pronto: o cliente precisa tocar em Enviar.
 * Não adiciona dados privados do prestador além do número público de atendimento.
 */
export function gerarLinkWhatsappRapido(
  telefoneProfissional: string,
  dados: { nomeCliente: string; categoriaNome: string; descricao: string; pedidoId: string },
): string {
  const numero = normalizarTelefone(telefoneProfissional);
  const linha = (valor: string) => valor.replace(/[\r\n]+/g, ' ').trim();
  const mensagem = [
    'Olá! Encontrei seu perfil na LARTOP e gostaria de um orçamento.',
    '',
    `*Meu nome:* ${linha(dados.nomeCliente)}`,
    `*Serviço:* ${linha(dados.categoriaNome)}`,
    `*Detalhes:* ${linha(dados.descricao)}`,
    `*Referência LARTOP:* ${dados.pedidoId.slice(0, 8)}`,
  ].join('\n');
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
