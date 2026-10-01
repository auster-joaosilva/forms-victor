export interface InvitationGateway {
  open(token: string, draftId: string): Promise<boolean>
}
