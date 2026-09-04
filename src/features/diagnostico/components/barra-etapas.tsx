import { ETAPAS, indiceDaEtapa, TOTAL_ETAPAS } from '../config/etapas'

import estilos from './barra-etapas.module.css'

import type { SlugEtapa } from '../config/etapas'

/**
 * A sequencia das etapas, clicavel.
 *
 * Uma lista so, responsiva: coluna lateral no desktop, faixa rolavel no
 * celular. No monolito eram TRES componentes com a mesma lista escrita de
 * novo em cada um (`DashboardSidebar`, `FormStepIndicator` e um
 * `MobileSidebarContent` local) — e o local tinha os rotulos duplicados a mao.
 */
export function BarraEtapas({
  atual,
  onEscolher,
}: {
  atual: SlugEtapa
  onEscolher: (slug: SlugEtapa) => void
}) {
  const indiceAtual = indiceDaEtapa(atual)
  const progresso = `${((indiceAtual + 1) / TOTAL_ETAPAS) * 100}%`

  return (
    <nav className={estilos.barra} aria-label="Etapas do diagnóstico">
      <ol className={estilos.lista}>
        {ETAPAS.map((etapa, indice) => (
          <li key={etapa.slug}>
            <button
              className={estilos.etapa}
              type="button"
              onClick={() => onEscolher(etapa.slug)}
              aria-current={etapa.slug === atual ? 'step' : undefined}
              data-estado={
                indice < indiceAtual
                  ? 'concluida'
                  : indice === indiceAtual
                    ? 'atual'
                    : 'pendente'
              }
            >
              <span className={estilos.numero} aria-hidden="true">
                {indice < indiceAtual ? '✓' : indice + 1}
              </span>
              <span className={estilos.rotulo}>{etapa.rotulo}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={estilos.rodape}>
        <p className={estilos.contagem}>
          Etapa {indiceAtual + 1} de {TOTAL_ETAPAS}
        </p>
        {/* O unico estilo que vem do TSX e o numero calculado; a barra em si
            esta no .module.css, lendo esta custom property. */}
        <div
          className={estilos.trilha}
          style={{ '--progresso': progresso } as React.CSSProperties}
          role="progressbar"
          aria-valuenow={indiceAtual + 1}
          aria-valuemin={1}
          aria-valuemax={TOTAL_ETAPAS}
        >
          <div className={estilos.preenchido} />
        </div>
      </div>
    </nav>
  )
}
