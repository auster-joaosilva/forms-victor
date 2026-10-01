import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createInvitationFn, deleteInvitationFn, listInvitationsFn } from '../api/invitations'
import { InvitationsView, type InvitationFields } from './invitations-view'

const copyLink = (link: string) => navigator.clipboard.writeText(link).catch(() => window.prompt('Copie o link:', link))

export function InvitationsPanel() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const list = useQuery({ queryKey: ['invitations'], queryFn: () => listInvitationsFn() })
  const settle = async (result: { ok: true } | { ok: false; message: string }) => {
    setError(result.ok ? null : result.message)
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ['invitations'] })
  }
  const create = useMutation({ mutationFn: (data: InvitationFields) => createInvitationFn({ data }), onSuccess: settle })
  const remove = useMutation({ mutationFn: (token: string) => deleteInvitationFn({ data: { token } }), onSuccess: settle })

  if (list.isPending) return <>carregando…</>
  if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>

  return (
    <InvitationsView
      invitations={list.data}
      error={error ?? (create.error ?? remove.error)?.message ?? null}
      pending={create.isPending || remove.isPending}
      onCreate={(input) => create.mutate(input)}
      onDelete={(token) => remove.mutate(token)}
      onCopy={(link) => void copyLink(link)}
    />
  )
}
