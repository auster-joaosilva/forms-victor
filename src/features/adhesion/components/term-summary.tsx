import type { TermText } from '../types/adhesion'

export function TermSummary({ term }: { term: TermText }) {
  return (
    <div className="ad-term">
      <div className="ad-term-section">
        <p className="ad-label">Orientação recebida</p>
        <p>{term.orientacao}</p>
        <div className="ad-box">
          <div className="ad-box-title">
            {term.prazos.titulo} <span className="ad-source">({term.prazos.fonte})</span>
          </div>
          <ul>
            {term.prazos.itens.map(([label, text]) => (
              <li key={label}>
                <b>{label}:</b> {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ad-term-section">
        <p className="ad-label">Critérios que orientam a recomendação</p>
        {term.criterios.map(([label, text]) => (
          <p key={label}>
            <b>{label}</b> {text}
          </p>
        ))}
      </div>
      <div className="ad-term-section">
        <p className="ad-label">Ciência sobre a decisão e reavaliação</p>
        <ul>
          {term.ciencia.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
