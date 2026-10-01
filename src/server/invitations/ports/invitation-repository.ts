export interface InvitationRecord {
  token: string
  companyName: string | null
  cnpj: string | null
  email: string | null
  note: string | null
  openCount: number
  lastOpenedAt: Date | null
  createdAt: Date
  createdBy: string | null
  responseCount: number
  adhesionCount: number
}

export interface InvitationRepository {
  exists(token: string): Promise<boolean>
  create(input: { token: string; companyName: string | null; cnpj: string | null; email: string | null; createdById: string | null }): Promise<InvitationRecord>
  find(token: string): Promise<InvitationRecord | null>
  list(): Promise<InvitationRecord[]>
  delete(token: string): Promise<void>
  registerOpening(token: string, draftId: string, at: Date): Promise<boolean>
}
