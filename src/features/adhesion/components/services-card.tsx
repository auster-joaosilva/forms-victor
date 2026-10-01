import type { AdhesionFormController } from '../hooks/use-adhesion-form'
import type { TermText } from '../types/adhesion'

export function ServicesCard({ form, term }: { form: AdhesionFormController; term: TermText }) {
  return (
    <div className="ad-card">
      <h2>Serviços complementares</h2>
      <p>{term.servicos.abertura}</p>
      <ul>
        {term.servicos.itens.map(([label, text]) => (
          <li key={label}>
            <b>{label}:</b> {text}
          </li>
        ))}
      </ul>
      <label className="ad-check">
        <input
          type="checkbox"
          checked={form.form.querProposta}
          onChange={(event) => form.setQuerProposta(event.target.checked)}
        />
        <span>{term.servicos.pergunta}</span>
      </label>
    </div>
  )
}
