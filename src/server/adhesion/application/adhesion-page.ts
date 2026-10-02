import type { AdhesionCompany, AdhesionReceipt } from '../domain/adhesion'
import { toReceipt } from '../domain/term-copy'
import { adhesionWindow, type AdhesionWindow } from '../domain/window'
import type { AdhesionRepository } from '../ports/adhesion-repository'
import type { Clock } from '../ports/clock'
import type { AdhesionInvitationGateway } from '../ports/invitation-gateway'

export type AdhesionPrefill = Partial<Pick<AdhesionCompany, 'nomeEmpresa' | 'cnpj' | 'email'>>

export interface AdhesionPageData {
  window: AdhesionWindow
  prefill: AdhesionPrefill
  invitationToken: string | null
  receipt: AdhesionReceipt | null
}

export function makeAdhesionPage(deps: {
  adhesions: Pick<AdhesionRepository, 'findByReceiptToken'>
  invitations: AdhesionInvitationGateway
  clock: Clock
}) {
  return {
    async load({ inviteToken, receiptToken }: { inviteToken: string | null; receiptToken: string | null }): Promise<AdhesionPageData> {
      const now = deps.clock.now()
      const record = receiptToken ? await deps.adhesions.findByReceiptToken(receiptToken) : null
      const invitation = inviteToken ? await deps.invitations.find(inviteToken) : null
      // Como o `marcarAbertura` do antigo: cada carga da página conta, e convite inexistente não conta nada.
      if (invitation) await deps.invitations.markOpened(invitation.token, now)
      const prefill: AdhesionPrefill = {}
      if (invitation?.companyName) prefill.nomeEmpresa = invitation.companyName
      if (invitation?.cnpj) prefill.cnpj = invitation.cnpj
      if (invitation?.email) prefill.email = invitation.email
      return {
        window: adhesionWindow(now),
        prefill,
        invitationToken: invitation?.token ?? null,
        receipt: record ? toReceipt(record) : null,
      }
    },
  }
}
