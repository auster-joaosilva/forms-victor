import { prisma } from '@/server/shared/prisma/client'
import type { TestDataEraser } from '../ports/test-data-eraser'

export const prismaTestDataEraser: TestDataEraser = {
  eraseTestData: () =>
    prisma.$transaction(async (tx) => {
      // Os rascunhos saem junto para nenhum navegador de teste retomar um preenchimento que perdeu a resposta.
      const drafts = await tx.diagnosisDraft.deleteMany({})
      const adhesions = await tx.adhesion.deleteMany({})
      const responses = await tx.response.deleteMany({})
      return { drafts: drafts.count, adhesions: adhesions.count, responses: responses.count }
    }),
}
