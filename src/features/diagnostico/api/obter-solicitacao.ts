import { useQuery } from '@tanstack/react-query'

import { orpc } from '#/orpc/client'

/** Comprovante por protocolo — o que a tela de sucesso mostra depois de um F5. */
export const useSolicitacao = (protocolo: string) =>
  useQuery(orpc.diagnostico.porProtocolo.queryOptions({ input: { protocolo } }))
