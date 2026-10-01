import type { ResponseStatus } from '../domain/response-status'
import type { ResponseProjections, StoredPayload } from '../domain/stored-payload'

export interface ResponseRecord extends ResponseProjections {
  id: number
  protocol: string
  invitationToken: string | null
  receivedAt: Date
  updatedAt: Date | null
  payload: unknown
  status: ResponseStatus
  internalNote: string | null
  handledByUsername: string | null
  handledAt: Date | null
}

export interface ResponseWrite extends ResponseProjections {
  payload: StoredPayload
}

export interface ResponseRepository {
  protocolExists(protocol: string): Promise<boolean>
  create(input: ResponseWrite & { protocol: string; invitationToken: string | null; receivedAt: Date }): Promise<ResponseRecord>
  update(id: number, input: ResponseWrite & { updatedAt: Date }): Promise<void>
  findById(id: number): Promise<ResponseRecord | null>
}
