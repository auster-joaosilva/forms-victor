import { isModality, type WithoutManifestationChoice } from '@/server/adhesion/domain/adhesion'
import { errorId, type AdhesionFormController } from '../hooks/use-adhesion-form'
import type { TermText } from '../types/adhesion'

const isChoice = (value: string): value is WithoutManifestationChoice =>
  value === 'cancelar' || value === 'manter'

export function ModalityCard({ form, term }: { form: AdhesionFormController; term: TermText }) {
  const { modalidade, semManifestacao } = form.form
  return (
    <div className="ad-card">
      <h2>Modalidade escolhida</h2>
      <p className="ad-note ad-note-lead">Escolha uma das duas.</p>
      {term.modalidades.map((option) => (
        <label
          key={option.valor}
          className={modalidade === option.valor ? 'ad-option is-checked' : 'ad-option'}
        >
          <span className="ad-option-head">
            <input
              type="radio"
              name="modalidade"
              value={option.valor}
              checked={modalidade === option.valor}
              onChange={() => isModality(option.valor) && form.chooseModality(option.valor)}
            />
            <span className="ad-option-title">{option.titulo}</span>
          </span>
          <span className="ad-option-text">{option.texto}</span>
          {option.partes.map(([label, text]) => (
            <span key={label} className="ad-option-part">
              <b>{label}:</b> {text}
            </span>
          ))}
        </label>
      ))}
      {modalidade === 'hibrido' ? (
        <div className="ad-subchoice">
          <div className="ad-subchoice-prompt">{term.semManifestacao.enunciado}</div>
          {term.semManifestacao.opcoes.map(([value, text]) => (
            <label key={value}>
              <input
                type="radio"
                name="semManifestacao"
                value={value}
                checked={semManifestacao === value}
                onChange={() => isChoice(value) && form.chooseWithoutManifestation(value)}
              />
              <span>{text}</span>
            </label>
          ))}
          <span className="ad-error" id={errorId('semManifestacao')}>
            {form.errors.semManifestacao ?? ''}
          </span>
        </div>
      ) : null}
      <span className="ad-error" id={errorId('modalidade')}>
        {form.errors.modalidade ?? ''}
      </span>
    </div>
  )
}
