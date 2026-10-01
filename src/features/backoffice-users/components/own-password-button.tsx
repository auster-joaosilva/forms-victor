import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { changeOwnPasswordFn } from '../api/users'
import { PasswordDialog } from './password-dialog'

export function OwnPasswordButton({ username }: { username: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const change = async (password: string) => {
    setOpen(false)
    setPending(true)
    try {
      const result = await changeOwnPasswordFn({ data: { password } })
      if (!result.ok) return window.alert(`Trocar minha senha: ${result.message}`)
      window.alert('Senha trocada. O navegador ainda guarda a antiga nesta aba: feche e abra de novo para entrar com a nova.')
      await navigate({ to: '/login' })
    } catch (failure) {
      window.alert(`Trocar minha senha: não deu para falar com o servidor (${failure instanceof Error ? failure.message : String(failure)})`)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button type="button" className="bo-button is-light" disabled={pending} onClick={() => setOpen(true)}>
        Trocar minha senha
      </button>
      <PasswordDialog open={open} title={`Nova senha de ${username}`} onSubmit={(password) => void change(password)} onCancel={() => setOpen(false)} />
    </>
  )
}
