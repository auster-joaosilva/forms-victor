import { prisma } from '@/server/shared/prisma/client'
import type { TestDataEraser } from '../ports/test-data-eraser'

export const prismaTestDataEraser: TestDataEraser = {
  eraseTestData: (actor) =>
    prisma.$transaction(async (tx) => {
      // Os rascunhos saem junto para nenhum navegador de teste retomar um preenchimento que perdeu a resposta.
      const drafts = await tx.diagnosisDraft.deleteMany({})
      // As inscrições saem primeiro: apontam para os encontros, os eventos e as respostas. Os eventos saem também: na virada
      // o banco é zerado e importado de novo, e um evento criado aqui ocuparia o id de um antigo.
      const registrations = await tx.registration.deleteMany({})
      const sessions = await tx.eventSession.deleteMany({})
      const events = await tx.event.deleteMany({})
      const adhesions = await tx.adhesion.deleteMany({})
      const responses = await tx.response.deleteMany({})
      const erased = {
        drafts: drafts.count,
        registrations: registrations.count,
        sessions: sessions.count,
        events: events.count,
        adhesions: adhesions.count,
        responses: responses.count,
      }
      // Na mesma transação: nada é apagado sem ficar a linha na Auditoria.
      await tx.auditLog.create({ data: { action: 'test_data_reset', actorId: actor.id, actorUsername: actor.username, detail: erased } })
      return erased
    }),
}
