import type { Answers } from '../domain/question-types'

export interface DraftRecord {
  id: string
  step: number
  answers: Answers
  requesterInQsa: boolean | null
  updatedAt: Date
  expiresAt: Date
  responseId: number | null
  invitationToken: string | null
  invitationOpened: boolean
}

export interface DraftRepository {
  find(id: string): Promise<DraftRecord | null>
  create(input: { step: number; answers: Answers; expiresAt: Date }): Promise<DraftRecord>
  save(id: string, input: { step: number; answers: Answers; requesterInQsa: boolean | null; expiresAt: Date }): Promise<void>
  setRequesterInQsa(id: string, value: boolean | null): Promise<void>
  delete(id: string): Promise<void>
  linkResponse(id: string, responseId: number): Promise<void>
}
