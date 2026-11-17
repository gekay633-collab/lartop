/**
 * Nome escolhido na solicitação de visitante, mas só divulgável após consentimento
 * específico na avaliação. Exibe apenas o primeiro nome, sem telefone ou sobrenome.
 * Entradas com dígitos, @ ou outros símbolos não são divulgadas publicamente.
 */
export function primeiroNomePublico(nome: string | null | undefined): string | null {
  const candidato = (nome ?? '').trim().split(/\s+/u)[0] ?? '';
  if (!/^[\p{L}][\p{L}\p{M}'’-]{1,39}$/u.test(candidato)) return null;
  return candidato;
}
