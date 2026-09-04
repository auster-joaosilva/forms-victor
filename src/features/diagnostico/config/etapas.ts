/**
 * A sequencia do formulario, em UM lugar so.
 *
 * `slug` e o endereco da rota E a chave das regras de validacao em
 * `schemas/diagnostico.schema.ts`. Etapa nova = uma linha aqui, um arquivo em
 * `app/routes/diagnostico/` e uma entrada de regra. Nada mais.
 *
 * Esta lista NAO conhece componente de tela: quem importa aqui e a rota, o
 * contrario nunca.
 */
export const ETAPAS = [
  { slug: 'identificacao', rotulo: 'Identificação' },
  { slug: 'procuracao', rotulo: 'Procuração' },
  { slug: 'situacao', rotulo: 'Diagnóstico' },
  { slug: 'pendencias', rotulo: 'Pendências' },
  { slug: 'riscos', rotulo: 'Riscos' },
  { slug: 'calor', rotulo: 'Calor do Cliente' },
  { slug: 'anexos', rotulo: 'Anexos' },
  { slug: 'revisao', rotulo: 'Revisão' },
] as const

export type SlugEtapa = (typeof ETAPAS)[number]['slug']

export const PRIMEIRA_ETAPA: SlugEtapa = ETAPAS[0].slug
export const TOTAL_ETAPAS = ETAPAS.length

/** A revisao nao tem regra propria: ela mostra o que as outras validaram. */
export const ETAPA_REVISAO: SlugEtapa = 'revisao'

export const indiceDaEtapa = (slug: string): number =>
  ETAPAS.findIndex((etapa) => etapa.slug === slug)

export const rotuloDaEtapa = (slug: string): string =>
  ETAPAS.find((etapa) => etapa.slug === slug)?.rotulo ?? ''

/** Etapas que precedem `slug` — as que a navegacao para frente revalida. */
export const etapasAntesDe = (slug: string): ReadonlyArray<SlugEtapa> =>
  ETAPAS.slice(0, Math.max(0, indiceDaEtapa(slug))).map((etapa) => etapa.slug)

export const etapaSeguinte = (slug: string): SlugEtapa | null =>
  ETAPAS[indiceDaEtapa(slug) + 1]?.slug ?? null

export const etapaAnterior = (slug: string): SlugEtapa | null => {
  const indice = indiceDaEtapa(slug)
  return indice > 0 ? ETAPAS[indice - 1].slug : null
}
