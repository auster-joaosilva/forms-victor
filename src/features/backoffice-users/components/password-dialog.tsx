import { Dialog } from 'radix-ui'
import { useState, type FormEvent } from 'react'
import { MINIMUM_PASSWORD } from '@/server/identity/domain/user-rules'

type Props = { open: boolean; title: string; onSubmit(password: string): void; onCancel(): void }

function PasswordForm({ title, onSubmit, onCancel }: Omit<Props, 'open'>) {
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password.length < MINIMUM_PASSWORD) return setError('Curta demais.')
    if (password !== repeated) return setError('As duas não conferem.')
    onSubmit(password)
  }

  return (
    <form className="bo-sheet bo-password-form" onSubmit={submit}>
      <Dialog.Title asChild>
        <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
      </Dialog.Title>
      <Dialog.Description className="bo-note" style={{ margin: '0 0 14px' }}>
        {`No mínimo ${MINIMUM_PASSWORD} caracteres. Comprimento é o que protege: não exigimos símbolo nem maiúscula, porque isso produz senha curta e anotada em papel.`}
      </Dialog.Description>
      <input type="password" placeholder="Senha" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <input type="password" placeholder="Repita a senha" autoComplete="new-password" value={repeated} onChange={(event) => setRepeated(event.target.value)} />
      <div className="bo-error">{error}</div>
      <div className="bo-sheet-actions">
        <button type="submit" className="bo-button">
          Definir
        </button>
        <button type="button" className="bo-button is-light" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function PasswordDialog({ open, ...form }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && form.onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="bo-overlay" />
        <Dialog.Content className="bo-dialog">
          <PasswordForm {...form} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
