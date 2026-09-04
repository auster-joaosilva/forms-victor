/**
 * TELEFONE BRASILEIRO — uma funcao para todos os campos do projeto.
 *
 * No monolito havia SEIS grafias de mascara, com DOIS comportamentos, e a que
 * rodava em mais campos era a errada: partia sempre em 2+5+4, e telefone FIXO
 * saia torto — 3432151234 virava "(34) 32151-234".
 *
 * E nenhuma tratava DDI. Colar "+55 34 99655-6666" do WhatsApp — que e como o
 * numero chega na pratica — devolvia "(55) 34996-5566" em silencio: o corte em
 * onze digitos promovia o "55" a DDD. Numero salvo assim nao liga para
 * ninguem, e nada avisava.
 */

export const somenteDigitos = (valor: string): string =>
  (valor || '').replace(/\D/g, '')

/**
 * Descarta o codigo do pais quando ele veio junto.
 *
 * 13 digitos comecando em 55 e celular com DDI; 12 e fixo com DDI. Abaixo
 * disso nao se mexe: um numero de 11 digitos que comeca com 55 e um celular de
 * DDD 55, que existe (Santa Maria, RS) — tirar o 55 estragaria numero valido.
 */
export const tirarDdi = (digitos: string): string => {
  if (digitos.length === 13 && digitos.startsWith('55')) return digitos.slice(2)
  if (digitos.length === 12 && digitos.startsWith('55')) return digitos.slice(2)
  return digitos
}

/**
 * Formata enquanto se digita, ramificando em 10 e 11 digitos — a diferenca
 * entre fixo e celular, que e o erro que a mascara antiga cometia.
 *
 * Completa parcialmente: com dois digitos ja mostra "(11", que e o que da a
 * sensacao de mascara viva.
 */
export const formatarTelefone = (valor: string): string => {
  const d = tirarDdi(somenteDigitos(valor)).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Dez ou onze digitos, depois de tirar o DDI. */
export const telefoneValido = (valor: string): boolean => {
  const d = tirarDdi(somenteDigitos(valor))
  return d.length === 10 || d.length === 11
}
