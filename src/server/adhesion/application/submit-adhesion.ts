import type { AdhesionReceipt } from '../domain/adhesion'
import { checkSubmission, cnpjDigitsOf } from '../domain/submission'
import { computeTermHash, CURRENT_TERM } from '../domain/term'
import { toReceipt } from '../domain/term-copy'
import { adhesionWindow } from '../domain/window'
import type { AdhesionRepository } from '../ports/adhesion-repository'
import type { AdhesionAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { AdhesionInvitationGateway } from '../ports/invitation-gateway'
import type { ProtocolGenerator } from '../ports/protocol-generator'
import type { ReceiptTokenGenerator } from '../ports/receipt-token-generator'
import type { ResponseLookup } from '../ports/response-lookup'

export const USER_AGENT_LIMIT = 300
const PROTOCOL_ATTEMPTS = 10

export interface SubmissionOrigin {
  ip: string | null
  source: string
  chain: string | null
}

export type SubmitAdhesionResult = { ok: true; receipt: AdhesionReceipt; receiptToken: string } | { ok: false; error: string }

export function makeSubmitAdhesion(deps: {
  adhesions: Pick<AdhesionRepository, 'create'>
  responses: ResponseLookup
  invitations: Pick<AdhesionInvitationGateway, 'find'>
  protocols: ProtocolGenerator
  receiptTokens: ReceiptTokenGenerator
  clock: Clock
  recordAudit: AdhesionAuditRecorder
  hashTerm?: (term: typeof CURRENT_TERM) => Promise<string>
}) {
  const hashTerm = deps.hashTerm ?? computeTermHash
  let currentHash: Promise<string> | null = null
  const termHash = () =>
    (currentHash ??= hashTerm(CURRENT_TERM).catch((error: unknown) => {
      currentHash = null
      throw error
    }))

  return async function submitAdhesion({ body, origin, userAgent }: { body: unknown; origin: SubmissionOrigin; userAgent: string | null }): Promise<SubmitAdhesionResult> {
    const now = deps.clock.now()
    const check = checkSubmission(body, { window: adhesionWindow(now), currentVersion: CURRENT_TERM.versao })
    if (!check.ok) return { ok: false, error: check.error }
    const submission = check.value

    const invitation = submission.vinculo ? await deps.invitations.find(submission.vinculo) : null
    const invitationToken = invitation?.token ?? null
    const cnpjDigits = cnpjDigitsOf(submission.empresa.cnpj)
    const responseId = await deps.responses.latestByCnpjDigits(cnpjDigits)
    const hash = await termHash()
    const agent = userAgent?.slice(0, USER_AGENT_LIMIT) || null
    const termVersion = CURRENT_TERM.versao
    // O mesmo objeto que o portal antigo guardava no `pacote`: é o que a prova reconstrói depois.
    const payload = {
      empresa: submission.empresa,
      modalidade: submission.modalidade,
      semManifestacao: submission.semManifestacao,
      querProposta: submission.querProposta,
      respostaId: responseId,
      tokenConvite: invitationToken,
      versaoTermo: termVersion,
      resumoTermo: hash,
      aceitoEm: now.toISOString(),
      origem: origin.ip,
      comoObtido: origin.source,
      cadeia: origin.chain,
      agente: agent,
    }
    // O create devolve 'protocol_taken' em qualquer colisão única (protocolo ou token do recibo): sorteia os dois de novo.
    for (let attempt = 0; attempt < PROTOCOL_ATTEMPTS; attempt++) {
      const protocol = deps.protocols.next(now)
      const receiptToken = deps.receiptTokens.next()
      const created = await deps.adhesions.create({
        protocol,
        receiptToken,
        acceptedAt: now,
        submission,
        cnpjDigits,
        responseId,
        invitationToken,
        termVersion,
        termHash: hash,
        originIp: origin.ip,
        originSource: origin.source,
        forwardedChain: origin.chain,
        userAgent: agent,
        payload,
      })
      if (created === 'protocol_taken') continue
      // A adesão já está gravada: falha na auditoria não pode virar erro, senão o cliente reenvia e duplica.
      try {
        await deps.recordAudit({ action: 'adhesion_received', reference: protocol, detail: { id: created.id, modality: submission.modalidade } })
      } catch (error) {
        console.error('falha ao auditar adhesion_received', error)
      }
      const receipt = toReceipt({
        id: created.id,
        protocol,
        acceptedAt: now,
        empresa: submission.empresa,
        modalidade: submission.modalidade,
        semManifestacao: submission.semManifestacao,
        querProposta: submission.querProposta,
        termVersion,
        termHash: hash,
        originIp: origin.ip,
      })
      return { ok: true, receipt, receiptToken }
    }
    return { ok: false, error: 'não foi possível gerar o protocolo' }
  }
}
