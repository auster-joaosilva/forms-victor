export interface ErasedTestData {
  drafts: number
  adhesions: number
  responses: number
}

export interface TestDataEraser {
  eraseTestData(): Promise<ErasedTestData>
}
