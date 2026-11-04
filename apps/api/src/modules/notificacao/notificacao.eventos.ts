// Mensagens curtas: não incluem CEP, endereço, telefone ou outros dados pessoais.
// São armazenadas junto da mudança de estado do pedido, em uma transação Prisma.
export const AVISOS_CLIENTE = {
  RESPONDIDA: {
    tipo: 'SOLICITACAO_RESPONDIDA',
    titulo: 'Seu pedido recebeu uma resposta',
    mensagem: 'O profissional respondeu à sua solicitação. Confira os detalhes no Lartop.',
  },
  ACEITA: {
    tipo: 'SOLICITACAO_ACEITA',
    titulo: 'Seu pedido foi aceito',
    mensagem: 'O profissional aceitou sua solicitação. Consulte o pedido no Lartop.',
  },
  RECUSADA: {
    tipo: 'SOLICITACAO_RECUSADA',
    titulo: 'Seu pedido foi recusado',
    mensagem: 'O profissional não poderá atender a este pedido. Você pode buscar outro prestador.',
  },
  CONCLUIDA: {
    tipo: 'SOLICITACAO_CONCLUIDA',
    titulo: 'Serviço concluído',
    mensagem: 'O profissional marcou o serviço como concluído. Você já pode avaliá-lo no Lartop.',
  },
} as const;
