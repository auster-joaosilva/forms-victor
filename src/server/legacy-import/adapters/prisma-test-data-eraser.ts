import { prisma } from '@/server/shared/prisma/client'
import type { TestDataEraser } from '../ports/test-data-eraser'

export const prismaTestDataEraser: TestDataEraser = {
  eraseTestData: (actor) =>
    prisma.$transaction(async (tx) => {
      // Os rascunhos saem junto para nenhum navegador de teste retomar um preenchimento que perdeu a resposta.
      const drafts = await tx.diagnosisDraft.deleteMany({})
      // As inscrições saem antes: apontam para as respostas. Os eventos ficam, porque são conteúdo e não dado de teste.
      const registrations = await tx.registration.deleteMany({})
      const adhesions = await tx.adhesion.deleteMany({})
      const responses = await tx.response.deleteMany({})
      const erased = { drafts: drafts.count, registrations: registrations.count, adhesions: adhesions.count, responses: responses.count }
      // Na mesma transação: nada é apagado sem ficar a linha na Auditoria.
      await tx.auditLog.create({ data: { action: 'test_data_reset', actorId: actor.id, actorUsername: actor.username, detail: erased } })
      return erased
    }),
}
