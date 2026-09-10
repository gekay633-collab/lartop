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

  const linhas = [
    `Ola! Encontrei seu perfil na Lartop e gostaria de um orcamento.`,
    `Servico: ${dados.categoriaNome}`,
    `Endereco: ${dados.endereco}`,
    `Tamanho aproximado: ${dados.tamanhoM2}m2`,
  ];

  if (dados.descricao) {
    linhas.push(`Detalhes: ${dados.descricao}`);
  }

  const mensagem = linhas.join('\n');
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
