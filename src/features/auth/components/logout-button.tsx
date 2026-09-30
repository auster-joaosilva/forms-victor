import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { signOutCurrentUser } from '../api/session'

export function LogoutButton({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    await signOutCurrentUser()
    await navigate({ to: '/login' })
  }

  return (
    <button type="button" onClick={logout} disabled={pending} className={className}>
      {pending ? 'Saindo…' : 'Sair'}
    </button>
  )
}
