/**
 * Enderecos da aplicacao em um lugar so (bulletproof-react).
 *
 * `ROTAS_ETAPA` existe porque cada etapa e um ARQUIVO de rota, e o roteador
 * do TanStack tipa `to` como uniao dos caminhos conhecidos: montar o caminho
 * com `'/diagnostico/' + slug` nao passa no typecheck. O mapa devolve um
 * literal, que passa.
 *
 * A ORDEM das etapas nao esta aqui — esta em
 * `features/diagnostico/config/etapas.ts`, junto do rotulo e da validacao.
 * Aqui e so endereco. A completude do mapa e checada la, em tempo de
 * compilacao.
 */
export const ROTAS_ETAPA = {
  identificacao: '/diagnostico/identificacao',
  procuracao: '/diagnostico/procuracao',
  situacao: '/diagnostico/situacao',
  pendencias: '/diagnostico/pendencias',
  riscos: '/diagnostico/riscos',
  calor: '/diagnostico/calor',
  anexos: '/diagnostico/anexos',
  revisao: '/diagnostico/revisao',
} as const

export const paths = {
  inicio: '/',
  diagnostico: {
    raiz: '/diagnostico',
    enviado: '/diagnostico/enviado/$protocolo',
  },
} as const
