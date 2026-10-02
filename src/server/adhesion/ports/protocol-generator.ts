export interface ProtocolGenerator {
  next(now: Date): string
}
