import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarAvaliacaoSchema } from './avaliacao.schemas.js';

const base = {
  solicitacaoId: 'bca7c2ac-b7c8-467c-b7ab-24fb795d7562',
  nota: 5,
};

describe('validação de feedback do cliente', () => {
  it('aceita notas de 1 a 5 e comentário opcional', () => {
    for (const nota of [1, 2, 3, 4, 5]) {
      assert.equal(criarAvaliacaoSchema.safeParse({ ...base, nota }).success, true);
    }
    assert.equal(criarAvaliacaoSchema.safeParse({ ...base, comentario: 'Bom atendimento' }).success, true);
  });

  it('recusa nota inválida, pedido malformado e comentário acima de 500 caracteres', () => {
    for (const nota of [0, 6, 2.5, '5']) {
      assert.equal(criarAvaliacaoSchema.safeParse({ ...base, nota }).success, false);
    }
    assert.equal(criarAvaliacaoSchema.safeParse({ ...base, solicitacaoId: '123' }).success, false);
    assert.equal(criarAvaliacaoSchema.safeParse({ ...base, comentario: 'a'.repeat(501) }).success, false);
  });
});
