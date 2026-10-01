import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { UserChanges } from '@/server/identity/domain/user'
import { createUserFn, listUsersFn, updateUserFn, type Outcome } from '../api/users'
import { PasswordDialog } from './password-dialog'
import { UsersView, type NewUser } from './users-view'

type Asking = { kind: 'create'; user: NewUser } | { kind: 'password'; username: string }
type Change = { username: string; changes: UserChanges; title: string }

const titleOf = (asking: Asking) => (asking.kind === 'create' ? `Senha de ${asking.user.username}` : `Nova senha de ${asking.username}`)

export function UsersPanel() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState<Asking | null>(null)
  const list = useQuery({ queryKey: ['users'], queryFn: () => listUsersFn() })

  const settle = (prefix: string) => async (result: Outcome) => {
    setError(result.ok ? null : prefix + result.message)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['users'] })
  }
  const create = useMutation({
    mutationFn: (data: NewUser & { password: string }) => createUserFn({ data }),
    onSuccess: settle(''),
    onError: (failure) => setError(`Não deu para falar com o servidor: ${failure.message}`),
  })
  const change = useMutation({
    mutationFn: ({ username, changes }: Change) => updateUserFn({ data: { username, changes } }),
    onSuccess: (result, { title }) => settle(`${title}: `)(result),
    onError: (failure, { title }) => setError(`${title}: não deu para falar com o servidor (${failure.message})`),
  })

  const submitPassword = (password: string) => {
    if (!asking) return
    setAsking(null)
    if (asking.kind === 'create') create.mutate({ ...asking.user, password })
    else change.mutate({ username: asking.username, changes: { password }, title: 'Trocar senha' })
  }
  const rename = (username: string, currentName: string) => {
    const name = window.prompt(`Novo nome de ${username}`, currentName)?.trim()
    if (name) change.mutate({ username, changes: { name }, title: 'Renomear' })
  }

  if (list.isPending) return <>carregando…</>
  if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>

  return (
    <>
      <UsersView
        users={list.data}
        error={error}
        pending={create.isPending || change.isPending}
        onCreate={(user) => setAsking({ kind: 'create', user })}
        onChange={(username, changes) => change.mutate({ username, changes, title: changes.role ? 'Mudar papel' : 'Mudar situação' })}
        onRequestPassword={(username) => setAsking({ kind: 'password', username })}
        onRename={rename}
      />
      <PasswordDialog open={asking !== null} title={asking ? titleOf(asking) : ''} onSubmit={submitPassword} onCancel={() => setAsking(null)} />
    </>
  )
}
