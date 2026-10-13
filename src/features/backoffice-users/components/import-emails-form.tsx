import { useState } from 'react'
import type { ImportUserEmailsResult } from '../api/users'

type Props = {
  pending: boolean
  result: ImportUserEmailsResult | null
  failure: string | null
  // Devolve se o lote foi gravado; só então o texto colado é limpo.
  onImport(text: string): Promise<boolean>
}

export function ImportEmailsForm({ pending, result, failure, onImport }: Props) {
  const [text, setText] = useState('')

  const submit = async () => {
    if (await onImport(text)) setText('')
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Importar e-mails</h3>
      <p className="bo-note" style={{ margin: '0 0 10px' }}>Uma linha por pessoa, no formato <code>usuario;email</code>.</p>
      <textarea
        placeholder="usuario;email, uma linha por pessoa"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        style={{ width: '100%', maxWidth: 480, fontFamily: 'monospace' }}
      />
      <div>
        <button type="button" className="bo-button" disabled={pending || !text.trim()} onClick={submit}>
          Importar e-mails
        </button>
      </div>
      {failure ? <div className="bo-error">{failure}</div> : null}
      {!failure && result?.ok === false ? (
        <div className="bo-error">
          {result.errors.map((error) => (
            <div key={`${error.line}-${error.reason}`}>{error.line > 0 ? `Linha ${error.line}: ${error.reason}` : error.reason}</div>
          ))}
        </div>
      ) : null}
      {!failure && result?.ok ? <div className="bo-note">{`${result.appliedUsernames.length} e-mail(s) atualizado(s): ${result.appliedUsernames.join(', ')}`}</div> : null}
    </div>
  )
}
