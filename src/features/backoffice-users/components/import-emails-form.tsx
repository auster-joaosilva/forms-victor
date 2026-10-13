import { useState } from 'react'
import { importUserEmailsFn, type ImportUserEmailsResult } from '../api/users'

export function ImportEmailsForm() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportUserEmailsResult | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setPending(true)
    const outcome = await importUserEmailsFn({ data: { text } })
    setPending(false)
    setResult(outcome)
    if (outcome.ok) setText('')
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
      {result?.ok === false ? (
        <div className="bo-error">
          {result.errors.map((error) => (
            <div key={error.line}>{`Linha ${error.line}: ${error.reason}`}</div>
          ))}
        </div>
      ) : null}
      {result?.ok ? <div className="bo-note">{`${result.appliedUsernames.length} e-mail(s) atualizado(s): ${result.appliedUsernames.join(', ')}`}</div> : null}
    </div>
  )
}
