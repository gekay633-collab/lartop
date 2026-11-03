import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AVISOS_CLIENTE } from './notificacao.eventos.js';

describe('mensagens internas por mudança de status', () => {
  it('cobre todas as decisões comunicadas ao cliente', () => {
    assert.deepEqual(Object.keys(AVISOS_CLIENTE).sort(),
      ['ACEITA', 'CONCLUIDA', 'RECUSADA', 'RESPONDIDA'].sort());
  });

  it('fornece tipos de evento distintos para evitar duplicação', () => {
    const avisos = Object.values(AVISOS_CLIENTE);
    assert.equal(new Set(avisos.map(aviso => aviso.tipo)).size, avisos.length);
    for (const aviso of avisos) {
      assert.ok(aviso.titulo.trim().length > 3);
      assert.ok(aviso.mensagem.trim().length > 15);
    }
  });

  it('não coloca endereço, CEP ou telefone nos avisos', () => {
    for (const aviso of Object.values(AVISOS_CLIENTE)) {
      assert.doesNotMatch(aviso.mensagem, /endereço|telefone|CEP/i);
    }
  });
});
