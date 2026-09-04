import {
  FAIXAS_VALOR,
  FORMAS_ACESSO,
  ONDAS_CALOR,
  ORIGENS_DEBITO,
  PAPEIS_CONTATO,
  PENDENCIAS,
  RISCOS,
  SIM_NAO,
  TRATATIVAS,
} from '../config/opcoes'

import type { ContatoPublico } from '../types'
import type { Opcao } from '#/components/ui/types'

/**
 * Valor guardado -> texto para humano.
 *
 * O mapa e MONTADO das listas de opcoes, nao escrito a mao. No monolito
 * existia um `labelMap` paralelo com 32 entradas, e uma opcao nova entrava no
 * `<select>` sem entrar no mapa: a revisao e o PDF mostravam o valor cru
 * (`parcelamento_rescindido`) para o cliente ler.
 */
const todasAsOpcoes: ReadonlyArray<Opcao> = [
  ...SIM_NAO,
  ...PAPEIS_CONTATO,
  ...TRATATIVAS,
  ...FORMAS_ACESSO,
  ...FAIXAS_VALOR,
  ...ORIGENS_DEBITO,
  ...PENDENCIAS,
  ...RISCOS,
  ...ONDAS_CALOR,
]

const MAPA = new Map(todasAsOpcoes.map((o) => [o.valor, o.rotulo]))

export const rotuloDe = (valor: string): string => MAPA.get(valor) ?? valor

export const rotulosDe = (valores: ReadonlyArray<string>): string =>
  valores.map(rotuloDe).join(', ') || '—'

/** Uma linha so, para a revisao. */
export const resumoContato = (contato?: ContatoPublico | null): string => {
  if (!contato) return '—'

  const quem = [
    contato.nome?.trim(),
    contato.papel ? `(${rotuloDe(contato.papel)})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const como = [contato.telefone?.trim(), contato.email?.trim()]
    .filter(Boolean)
    .join(' · ')

  return [quem, como].filter(Boolean).join(' — ') || '—'
}
