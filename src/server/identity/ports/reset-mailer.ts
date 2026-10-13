export interface ResetMailer {
  sendResetLink(to: string, resetUrl: string): Promise<void>
}
