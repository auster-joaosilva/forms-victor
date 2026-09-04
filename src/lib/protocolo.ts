import { prisma } from '#/db'

import type { TipoFormulario } from '#/generated/prisma/client'

/** Prefixo por tipo de formulario. Herdado do monolito — nao renomear. */
const PREFIXOS: Record<TipoFormulario, string> = {
  diagnostico_transacao: 'DTT',
  diagnostico_reforma: 'DTR',
  planejamento: 'PPS',
  candidato: 'CAN',
  parceiro: 'PAR',
  capag: 'CPG',
}

/**
 * Ano-mes no fuso de Sao Paulo.
 *
 * Em UTC, das 21h a meia-noite do dia 31 isto ja devolvia o mes seguinte: a
 * chave do contador abria adiantada e o primeiro protocolo legitimo do mes
 * nascia com sequencia 002.
 */
export const anoMesSaoPaulo = (agora = new Date()): string => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(agora)

  const ano = partes.find((p) => p.type === 'year')?.value ?? ''
  const mes = partes.find((p) => p.type === 'month')?.value ?? ''
  return `${ano}${mes}`
}

/**
 * `DTT-A-202609001`. Sem prioridade, `DTT-202609001`.
 *
 * O incremento e atomico: o `upsert` resolve no banco, entao dois envios
 * simultaneos nao levam o mesmo numero. Chamar dentro de uma transacao com o
 * INSERT da solicitacao garante que numero gerado e numero usado.
 */
export const gerarProtocolo = async (
  tipo: TipoFormulario,
  prioridade?: string,
): Promise<string> => {
  const anoMes = anoMesSaoPaulo()

  const contador = await prisma.contadorProtocolo.upsert({
    where: { tipo_anoMes: { tipo, anoMes } },
    create: { tipo, anoMes, valor: 1 },
    update: { valor: { increment: 1 } },
    select: { valor: true },
  })

  const sequencia = String(contador.valor).padStart(3, '0')
  const limpa = (prioridade ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

  return limpa
    ? `${PREFIXOS[tipo]}-${limpa}-${anoMes}${sequencia}`
    : `${PREFIXOS[tipo]}-${anoMes}${sequencia}`
}
