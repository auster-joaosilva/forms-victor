import { errorId, type AdhesionFormController } from '../hooks/use-adhesion-form'
import type { TermText } from '../types/adhesion'

export function DeclarationCard({ form, term }: { form: AdhesionFormController; term: TermText }) {
  return (
    <div className="ad-card">
      <h2>Declaração final</h2>
      <div className="ad-declaration">{term.declaracao}</div>
      <label className="ad-check">
        <input
          type="checkbox"
          checked={form.form.declara}
          onChange={(event) => form.setDeclara(event.target.checked)}
        />
        <span>
          Li o termo acima, declaro o que nele consta e confirmo a modalidade assinalada. Estou ciente de que
          esta confirmação registra data, hora e origem do acesso, e vale como manifestação da empresa.
        </span>
      </label>
      <span className="ad-error" id={errorId('declara')}>
        {form.errors.declara ?? ''}
      </span>
      <div className="ad-actions">
        <button
          type="button"
          className="ad-button"
          disabled={form.sending}
          onClick={() => void form.submit()}
        >
          {form.sending ? 'Registrando…' : 'Confirmar a opção'}
        </button>
      </div>
      <div className="ad-send-error" role="alert">
        {form.submitError}
      </div>
      <p className="ad-note ad-note-after">
        Depois de confirmar você recebe o protocolo e pode baixar o termo preenchido em PDF.
      </p>
    </div>
  )
}
