export interface ResponseLookup {
  latestByCnpjDigits(digits: string): Promise<number | null>
}
