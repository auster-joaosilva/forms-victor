export type ErasedTestData = {
  drafts: number
  adhesions: number
  responses: number
}

export interface TestDataEraser {
  eraseTestData(actor: { id: string; username: string }): Promise<ErasedTestData>
}
