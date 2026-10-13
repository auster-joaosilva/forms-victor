import { useState, type FormEvent } from 'react'
import { useHydrated, useNavigate } from '@tanstack/react-router'
import { AusterMark } from '@/components/brand/auster-mark'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { completePasswordResetFn } from '../api/password-reset'

const INVALID_TOKEN_MESSAGE = 'Esse link não vale mais (já foi usado, ou passou da validade). Peça um novo em "Esqueci a senha".'
const WEAK_PASSWORD_MESSAGE = 'Precisa de 8 caracteres ou mais, com letra, número e símbolo.'

export function ResetPasswordForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const hydrated = useHydrated()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const repeated = String(form.get('repeated') ?? '')
    setError(null)
    if (password !== repeated) return setError('As duas não conferem.')
    setPending(true)
    try {
      const result = await completePasswordResetFn({ data: { token, password } })
      if (!result.ok) return setError(result.reason === 'weak_password' ? WEAK_PASSWORD_MESSAGE : INVALID_TOKEN_MESSAGE)
      await navigate({ to: '/login' })
    } catch {
      setError(INVALID_TOKEN_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <form method="post" onSubmit={submit} className="w-full max-w-[400px] rounded-xl border border-[#e3e9ee] bg-white px-8 py-[34px] shadow-[0_1px_3px_rgba(5,44,71,.08)]">
      <AusterMark caption="auster · uso interno" />
      <h1 className="mb-1.5 text-[21px] font-normal text-auster-dark">Nova senha</h1>
      {error ? (
        <Alert variant="destructive" className="mb-[18px] border-[#f0c4c4] bg-[#fdf0f0] text-[#8d2226]">
          <AlertDescription className="text-[13px]">{error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="password" name="password" placeholder="Nova senha" autoComplete="new-password" required className="mb-3 w-full rounded-md border border-[#e3e9ee] px-3.5 py-3 text-[14px]" />
      <input type="password" name="repeated" placeholder="Repita a nova senha" autoComplete="new-password" required className="mb-4 w-full rounded-md border border-[#e3e9ee] px-3.5 py-3 text-[14px]" />
      <Button type="submit" disabled={pending || !hydrated} className="h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Salvando…' : 'Definir nova senha'}
      </Button>
    </form>
  )
}
