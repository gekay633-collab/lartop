function normalizarTelefone(telefone: string): string {
  const apenasDigitos = telefone.replace(/\D/g, '');
  if (apenasDigitos.startsWith('55')) return apenasDigitos;
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
