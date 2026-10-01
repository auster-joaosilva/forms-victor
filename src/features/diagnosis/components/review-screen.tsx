import type { ReadableAnswer, ReviewRow, ReviewView } from '@/server/diagnosis/domain/review'

function Answer({ answer }: { answer: ReadableAnswer | null }) {
  if (!answer) return <div className="dx-review-answer is-empty">não respondido</div>
  return (
    <div className={answer.gap ? 'dx-review-answer is-gap' : 'dx-review-answer'}>
      {answer.kind === 'text'
        ? answer.text
        : answer.rows.map((row) => (
            <span key={row.label} className={row.gap ? 'dx-matrix-line is-gap' : 'dx-matrix-line'}>
              {row.label}: <b>{row.value}</b>
            </span>
          ))}
    </div>
  )
}

function Row({ row, onChange }: { row: ReviewRow; onChange(block: number, key: string): void }) {
  return (
    <div className="dx-review-row">
      <div className="dx-review-question">
        {row.prompt}
        {row.decides ? <span className="dx-decides">decide</span> : null}
      </div>
      <Answer answer={row.answer} />
      <button type="button" className="dx-review-change" onClick={() => onChange(row.block, row.key)}>
        alterar
      </button>
    </div>
  )
}

export function ReviewScreen({ review, onBack, onNext, onChange }: { review: ReviewView; onBack(): void; onNext(): void; onChange(block: number, key: string): void }) {
  const gaps = review.readableGaps
  const one = gaps.length === 1
  return (
    <div className="dx-card">
      <h1>Confira antes de ver o resultado</h1>
      <p className="dx-step-count">Último passo · {review.total} respostas</p>
      <p className="dx-review-intro">
        As marcadas <span className="dx-decides">decide</span> são as que mudam a recomendação. Vale um olhar nelas — depois do resultado ninguém volta procurar o que
        ficou errado.
      </p>
      {gaps.length ? (
        <div className="dx-review-gaps">
          <b>{one ? 'Um ponto ficou' : `${gaps.length} pontos ficaram`} em "não sei"</b>, e {one ? 'ele pesa' : 'eles pesam'} na decisão:
          <ul>
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
          Se algum desses dados estiver a um telefonema de distância, vale buscar agora. Se não, siga: o resultado sai marcado como indicativo e o plano de ação inclui
          levantar {one ? 'esse ponto' : 'esses pontos'}.
        </div>
      ) : null}
      {review.blocks.map((block) => (
        <div key={block.number} className="dx-review-block">
          <h3>{block.title}</h3>
          <p className="dx-review-count">
            Etapa {block.position} · {block.rows.length} {block.rows.length === 1 ? 'resposta' : 'respostas'}
          </p>
          {block.rows.map((row) => (
            <Row key={row.key} row={row} onChange={onChange} />
          ))}
        </div>
      ))}
      <div className="dx-nav">
        <button type="button" className="dx-button is-secondary" onClick={onBack}>
          Voltar
        </button>
        <button type="button" className="dx-button is-primary" onClick={onNext}>
          Ver diagnóstico
        </button>
      </div>
    </div>
  )
}
