import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { primeiroNomePublico } from './avaliacao.nome-publico.js';

describe('primeiro nome de visitante e privacidade', () => {
  it('usa apenas primeiro nome, com acentos e hífen', () => {
    assert.equal(primeiroNomePublico('Maria da Silva'), 'Maria');
    assert.equal(primeiroNomePublico(' João Carlos '), 'João');
    assert.equal(primeiroNomePublico('Ana-Maria Ferreira'), 'Ana-Maria');
  });
  it('nunca publica telefone, email, vazio ou símbolos inesperados', () => {
    assert.equal(primeiroNomePublico('21999998888'), null);
    assert.equal(primeiroNomePublico('fulano@exemplo.com'), null);
    assert.equal(primeiroNomePublico(''), null);
    assert.equal(primeiroNomePublico(null), null);
    assert.equal(primeiroNomePublico('A'), null);
  });
});
