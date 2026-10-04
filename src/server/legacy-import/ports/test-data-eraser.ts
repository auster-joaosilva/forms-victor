export type ErasedTestData = {
  drafts: number
  registrations: number
  adhesions: number
  responses: number
}

export interface TestDataEraser {
  eraseTestData(actor: { id: string; username: string }): Promise<ErasedTestData>
}
