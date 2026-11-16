import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gerarLinkWhatsappRapido } from './whatsapp.js';

const info = {
  nomeCliente: 'Maria Souza',
  categoriaNome: 'Limpeza de piscina',
  descricao: 'Preciso limpar a piscina esta semana.',
  pedidoId: '22dd77aa-1111-4111-8111-111111111111',
};

describe('mensagem do pedido rápido no WhatsApp', () => {
  it('abre conversa com texto já preenchido e os dados do serviço', () => {
    const link = new URL(gerarLinkWhatsappRapido('(21) 99999-2222', info));
    assert.equal(link.origin, 'https://wa.me');
    assert.equal(link.pathname, '/5521999992222');
    const mensagem = link.searchParams.get('text');
    assert.ok(mensagem);
    assert.match(mensagem, /Encontrei seu perfil na LARTOP/);
    assert.match(mensagem, /\*Meu nome:\* Maria Souza/);
    assert.match(mensagem, /\*Serviço:\* Limpeza de piscina/);
    assert.match(mensagem, /\*Detalhes:\* Preciso limpar a piscina esta semana\./);
    assert.match(mensagem, /\*Referência LARTOP:\* 22dd77aa/);
    assert.doesNotMatch(mensagem, /senha|e-mail|token|http/i);
  });

  it('aceita telefone já internacional e DDD brasileiro 55 sem confundir com país', () => {
    const internacional = new URL(gerarLinkWhatsappRapido('+55 21 99999-2222', info));
    assert.equal(internacional.pathname, '/5521999992222');
    const ddd55 = new URL(gerarLinkWhatsappRapido('(55) 99999-2222', info));
    assert.equal(ddd55.pathname, '/5555999992222');
  });

  it('remove quebras de linha inesperadas de campos do cliente', () => {
    const link = new URL(gerarLinkWhatsappRapido('21999992222', {
      ...info,
      nomeCliente: 'Maria\nOutra linha',
      descricao: 'Preciso de limpeza\r\nna piscina.',
    }));
    const mensagem = link.searchParams.get('text') ?? '';
    assert.match(mensagem, /Maria Outra linha/);
    assert.match(mensagem, /limpeza na piscina/);
    assert.doesNotMatch(mensagem, /Maria\nOutra linha|limpeza\r\nna piscina/);
  });
});
