export interface AdhesionInvitationGateway {
  find(token: string): Promise<{ token: string; companyName: string | null; cnpj: string | null; email: string | null } | null>
  markOpened(token: string, at: Date): Promise<void>
}
