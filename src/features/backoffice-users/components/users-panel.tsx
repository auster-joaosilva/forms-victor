import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { UserChanges } from '@/server/identity/domain/user'
import { createUserFn, importUserEmailsFn, listUsersFn, sendResetLinkFn, sendResetLinksToAllFn, setUserEmailFn, updateUserFn, type Outcome } from '../api/users'
import { ImportEmailsForm } from './import-emails-form'
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

  const setEmail = useMutation({
    mutationFn: ({ username, email }: { username: string; email: string }) => setUserEmailFn({ data: { username, email } }),
    onSuccess: settle('E-mail: '),
    onError: (failure) => setError(`E-mail: não deu para falar com o servidor (${failure.message})`),
  })
  const sendReset = useMutation({
    mutationFn: (username: string) => sendResetLinkFn({ data: { username } }),
    onSuccess: (result) => setError(result.failed ? 'Enviar link: o envio falhou; tente de novo em instantes.' : null),
    onError: (failure) => setError(`Enviar link: não deu para falar com o servidor (${failure.message})`),
  })
  const sendResetToAll = useMutation({
    mutationFn: () => sendResetLinksToAllFn(),
    onSuccess: (result) => setError(`Enviado para ${result.sent} pessoa(s)${result.failed ? `, ${result.failed} falha(s)` : ''}.`),
    onError: (failure) => setError(`Enviar para todos: não deu para falar com o servidor (${failure.message})`),
  })
  const importEmails = useMutation({
    mutationFn: (text: string) => importUserEmailsFn({ data: { text } }),
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const changeEmail = (username: string, currentEmail: string) => {
    const email = window.prompt(`E-mail de ${username}`, currentEmail)?.trim()
    if (email) setEmail.mutate({ username, email })
  }
  const sendResetLinksToAll = () => {
    if (window.confirm('Enviar o link de redefinição para todos os usuários com e-mail cadastrado?')) sendResetToAll.mutate()
  }
  const importPastedEmails = async (text: string) => {
    try {
      return (await importEmails.mutateAsync(text)).ok
    } catch {
      return false
    }
  }

  if (list.isPending) return <>carregando…</>
  if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>

  return (
    <>
      <UsersView
        users={list.data}
        error={error}
        pending={create.isPending || change.isPending || setEmail.isPending || sendReset.isPending || sendResetToAll.isPending}
        onCreate={(user) => setAsking({ kind: 'create', user })}
        onChange={(username, changes) => change.mutate({ username, changes, title: changes.role ? 'Mudar papel' : 'Mudar situação' })}
        onRequestPassword={(username) => setAsking({ kind: 'password', username })}
        onRename={rename}
        onChangeEmail={changeEmail}
        onSendResetLink={(username) => sendReset.mutate(username)}
        onSendResetLinksToAll={sendResetLinksToAll}
      />
      <ImportEmailsForm
        pending={importEmails.isPending}
        result={importEmails.data ?? null}
        failure={importEmails.isError ? `Importar e-mails: não deu para falar com o servidor (${importEmails.error.message})` : null}
        onImport={importPastedEmails}
      />
      <PasswordDialog open={asking !== null} title={asking ? titleOf(asking) : ''} onSubmit={submitPassword} onCancel={() => setAsking(null)} />
    </>
  )
}
