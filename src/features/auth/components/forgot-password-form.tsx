import { useState, type FormEvent } from 'react'
import { Link, useHydrated } from '@tanstack/react-router'
import { AusterMark } from '@/components/brand/auster-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordResetFn } from '../api/password-reset'

const SAME_MESSAGE = 'Se o usuário existir e tiver e-mail cadastrado, mandamos o link de redefinição para ele agora.'

export function ForgotPasswordForm() {
  const hydrated = useHydrated()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = String(new FormData(event.currentTarget).get('username') ?? '').trim().toLowerCase()
    setPending(true)
    try {
      const result = await requestPasswordResetFn({ data: { username } })
      setMessage(result.ok ? SAME_MESSAGE : 'Muitas tentativas. Espere um minuto e tente de novo.')
    } catch {
      setMessage(SAME_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <form method="post" onSubmit={submit} className="w-full max-w-[400px] rounded-xl border border-[#e3e9ee] bg-white px-8 py-[34px] shadow-[0_1px_3px_rgba(5,44,71,.08)]">
      <AusterMark caption="auster · uso interno" />
      <h1 className="mb-1.5 text-[21px] font-normal text-auster-dark">Esqueci a senha</h1>
      <p className="mb-[22px] text-[13px] leading-relaxed text-auster-gray">Informe o seu usuário. Se existir e tiver e-mail cadastrado, enviamos o link de redefinição.</p>
      {message ? <p className="mb-[18px] text-[13px] text-auster-dark">{message}</p> : null}
      <Label htmlFor="username" className="mb-1.5 block text-xs font-normal uppercase tracking-[.9px] text-auster-gray">Usuário</Label>
      <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus className="mb-4 h-auto px-3.5 py-3" />
      <Button type="submit" disabled={pending || !hydrated} className="mb-3 h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Enviando…' : 'Enviar link de redefinição'}
      </Button>
      <Link to="/login" className="text-[13px] text-auster-gray underline">Voltar para o login</Link>
    </form>
  )
}
