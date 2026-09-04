import { FERIADOS, ULTIMO_ANO_COBERTO } from '../config/feriados'

/**
 * PRIORIDADE E PRAZO — a regra de negocio mais afiada do formulario.
 *
 * Prioridade sai de DUAS respostas, risco imediato e onda de calor, e o prazo
 * sai da prioridade. Uma fonte, nao duas: no monolito o numero de horas e a
 * letra eram calculados por funcoes separadas, com os mesmos `if` escritos
 * duas vezes.
 *
 * Hora util e hora util: 09:00–17:30, segunda a sexta, sem feriado. Envio
 * fora da janela comeca a contar na abertura do proximo dia util.
 *
 * Roda no SERVIDOR. O relogio do navegador do parceiro nao decide SLA da
 * Auster — por isso o fuso e fixo aqui e nao lido do ambiente.
 */

export type Prioridade = 'A' | 'B' | 'C' | 'D'

/** Brasil nao tem horario de verao desde 2019: o deslocamento e constante. */
const DESLOCAMENTO_BRT_MS = -3 * 60 * 60 * 1000

const ABERTURA_MIN = 9 * 60
const FECHAMENTO_MIN = 17 * 60 + 30

export const HORAS_POR_PRIORIDADE: Record<Prioridade, number> = {
  A: 4,
  B: 8,
  C: 48,
  D: 72,
}

/**
 * `muito_interessado` com risco imediato e o caso de 4 horas. Sem risco e sem
 * calor, 72. As duas respostas juntas, nunca uma sozinha.
 */
export const prioridadeDe = (
  riscoImediato: string,
  ondaCalor: string,
): Prioridade => {
  const comRisco = riscoImediato === 'sim'
  const quente = ondaCalor === 'muito_interessado'

  if (comRisco && quente) return 'A'
  if (comRisco) return 'B'
  if (quente) return 'C'
  return 'D'
}

/* -------------------------------------------------------------------------
 * Relogio de Sao Paulo
 *
 * O truque: deslocar o instante e ler pelos acessores `getUTC*`. Os campos
 * UTC do resultado passam a ser a hora de parede em Sao Paulo, e a conta de
 * dia/hora fica livre do fuso de quem roda o processo.
 * ---------------------------------------------------------------------- */

const paraBrt = (instante: Date): Date =>
  new Date(instante.getTime() + DESLOCAMENTO_BRT_MS)

const deBrt = (brt: Date): Date =>
  new Date(brt.getTime() - DESLOCAMENTO_BRT_MS)

const dataIso = (brt: Date): string => brt.toISOString().slice(0, 10)

const minutosDoDia = (brt: Date): number =>
  brt.getUTCHours() * 60 + brt.getUTCMinutes()

export const eFeriado = (brt: Date): boolean => FERIADOS.includes(dataIso(brt))

export const eDiaUtil = (brt: Date): boolean => {
  const dia = brt.getUTCDay()
  return dia >= 1 && dia <= 5 && !eFeriado(brt)
}

const naAbertura = (brt: Date): Date => {
  const proximo = new Date(brt.getTime())
  proximo.setUTCHours(9, 0, 0, 0)
  return proximo
}

const proximoDiaUtilNaAbertura = (brt: Date): Date => {
  const proximo = new Date(brt.getTime())
  do {
    proximo.setUTCDate(proximo.getUTCDate() + 1)
  } while (!eDiaUtil(proximo))
  return naAbertura(proximo)
}

/**
 * Soma horas uteis a um instante.
 *
 * Antes do laco, o cursor e empurrado para dentro da janela: dia nao util ou
 * depois do fechamento vao para a abertura do proximo dia util; antes da
 * abertura fica no mesmo dia, as 09:00.
 */
export const somarHorasUteis = (inicio: Date, horas: number): Date => {
  let cursor = paraBrt(inicio)

  if (!eDiaUtil(cursor) || minutosDoDia(cursor) >= FECHAMENTO_MIN) {
    cursor = proximoDiaUtilNaAbertura(cursor)
  } else if (minutosDoDia(cursor) < ABERTURA_MIN) {
    cursor = naAbertura(cursor)
  }

  let restante = horas * 60

  while (restante > 0) {
    const disponivel = FECHAMENTO_MIN - minutosDoDia(cursor)

    if (restante <= disponivel) {
      cursor = new Date(cursor.getTime() + restante * 60_000)
      restante = 0
    } else {
      restante -= disponivel
      cursor = proximoDiaUtilNaAbertura(cursor)
    }
  }

  return deBrt(cursor)
}

/**
 * O calculo completo: letra, horas e data de retorno.
 *
 * A prioridade NAO classifica a demanda para a equipe — ela entra no
 * protocolo e as horas vao para a triagem decidir a bandeira. No monolito
 * isto mandava um nivel que o gatilho do banco descartava no INSERT: a
 * classificacao ja estava morta e ninguem sabia.
 */
export const calcularRetorno = (
  riscoImediato: string,
  ondaCalor: string,
  agora = new Date(),
): { prioridade: Prioridade; horas: number; retornoPrevistoEm: Date } => {
  const prioridade = prioridadeDe(riscoImediato, ondaCalor)
  const horas = HORAS_POR_PRIORIDADE[prioridade]

  return {
    prioridade,
    horas,
    retornoPrevistoEm: somarHorasUteis(agora, horas),
  }
}

/**
 * A lista de feriados cobre este instante?
 *
 * Nao trava envio — prazo aproximado e melhor que formulario fora do ar. Quem
 * cobra a atualizacao e o teste, que falha quando o ano corrente passa da
 * cobertura.
 */
export const feriadosCobrem = (instante = new Date()): boolean =>
  Number(dataIso(paraBrt(instante)).slice(0, 4)) <= ULTIMO_ANO_COBERTO
