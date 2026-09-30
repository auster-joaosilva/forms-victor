import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { AusterMark } from '@/components/brand/auster-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.signIn.username({
      username: String(form.get('username') ?? '').trim().toLowerCase(),
      password: String(form.get('password') ?? ''),
    })
    setPending(false)
    if (failure) {
      setError(failure.status === 429 ? 'Muitas tentativas. Espere um minuto e tente de novo.' : 'Usuário ou senha não conferem. Tente de novo.')
      return
    }
    await navigate({ to: redirectTo })
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[400px] rounded-xl border border-[#e3e9ee] bg-white px-8 py-[34px] shadow-[0_1px_3px_rgba(5,44,71,.08)]">
      <AusterMark caption="auster · uso interno" />
      <h1 className="mb-1.5 text-[21px] font-normal text-auster-dark">Conferência do Diagnóstico</h1>
      <p className="mb-[22px] text-[13px] leading-relaxed text-auster-gray">
        Entre com o seu usuário e a sua senha. É esse nome que fica gravado na auditoria de cada resposta que você validar.
      </p>
      {error ? (
        <Alert variant="destructive" className="mb-[18px] border-[#f0c4c4] bg-[#fdf0f0] text-[#8d2226]">
          <AlertDescription className="text-[13px]">{error}</AlertDescription>
        </Alert>
      ) : null}
      <Label htmlFor="username" className="mb-1.5 block text-xs font-normal uppercase tracking-[.9px] text-auster-gray">Usuário</Label>
      <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus className="mb-4 h-auto px-3.5 py-3" />
      <Label htmlFor="password" className="mb-1.5 block text-xs font-normal uppercase tracking-[.9px] text-auster-gray">Senha</Label>
      <Input id="password" name="password" type="password" autoComplete="current-password" required className="mb-4 h-auto px-3.5 py-3" />
      <Button type="submit" disabled={pending} className="h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
