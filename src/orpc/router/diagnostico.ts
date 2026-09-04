import { ORPCError, os } from '@orpc/server'
import * as z from 'zod'

import { prisma } from '#/db'
import {
  MAX_ARQUIVOS_POR_SOLICITACAO,
  validarArquivo,
} from '#/lib/arquivos'
import { gerarProtocolo } from '#/lib/protocolo'
import { assinarUploadPut, montarChave } from '#/lib/s3'
import { esquemaCompleto } from '#/features/diagnostico/schemas/diagnostico.schema'
import { calcularRetorno } from '#/features/diagnostico/utils/prazo'

const TIPO = 'diagnostico_transacao' as const

const campoAnexo = z.enum(['situacao_fiscal', 'cdas_pgfn', 'contabeis'])

const arquivoDeclarado = z.object({
  campo: campoAnexo,
  nome: z.string().min(1),
  tamanho: z.number().int().positive(),
  mimeType: z.string(),
})

/**
 * Recusa o arquivo com a mesma regra do cliente. O cliente valida por
 * conveniencia; aqui e a fronteira de confianca, e quem chama a API direto
 * nao passa pela tela.
 */
const exigirArquivoValido = (arquivo: z.infer<typeof arquivoDeclarado>) => {
  const recusa = validarArquivo(arquivo)
  if (recusa) throw new ORPCError('BAD_REQUEST', { message: recusa })
}

/**
 * URL de `PUT` assinada para o navegador subir direto no MinIO.
 *
 * `envioId` agrupa os arquivos de uma tentativa de envio na mesma pasta. Nao
 * se usa o protocolo aqui de proposito: o protocolo e gerado no envio, e
 * gerar antes queimaria numero de sequencia de quem desiste na ultima tela.
 */
export const assinarUpload = os
  .input(
    arquivoDeclarado.extend({
      envioId: z.string().uuid(),
    }),
  )
  .handler(async ({ input }) => {
    exigirArquivoValido(input)

    const chave = montarChave(input.envioId, input.nome)
    const { url, bucket, expiraEm } = await assinarUploadPut({
      chave,
      mimeType: input.mimeType,
    })

    return { url, bucket, chave, expiraEm }
  })

/**
 * Grava a solicitacao.
 *
 * `esquemaCompleto` e o MESMO objeto Zod que valida a tela etapa por etapa —
 * por isso nao ha como a API aceitar um formulario que o formulario recusaria.
 */
export const enviar = os
  .input(
    z.object({
      valores: esquemaCompleto,
      anexos: z
        .array(
          arquivoDeclarado.extend({
            bucket: z.string().min(1),
            chave: z.string().min(1),
          }),
        )
        .max(MAX_ARQUIVOS_POR_SOLICITACAO),
    }),
  )
  .handler(async ({ input }) => {
    for (const anexo of input.anexos) exigirArquivoValido(anexo)

    // Os dois obrigatorios sao barreira de envio. O Zod checa o nome
    // registrado no formulario; aqui se checa que o arquivo realmente subiu.
    for (const campo of ['situacao_fiscal', 'cdas_pgfn'] as const) {
      if (!input.anexos.some((anexo) => anexo.campo === campo)) {
        throw new ORPCError('BAD_REQUEST', {
          message: `O anexo obrigatório "${campo}" não foi enviado.`,
        })
      }
    }

    // Prazo e prioridade sao calculados AQUI. O relogio do navegador de quem
    // preenche nao decide SLA da Auster.
    const { prioridade, horas, retornoPrevistoEm } = calcularRetorno(
      input.valores.riscoImediato,
      input.valores.ondaCalor,
    )

    // Protocolo e insercao na mesma transacao: numero gerado e numero usado.
    const solicitacao = await prisma.$transaction(async () => {
      const protocolo = await gerarProtocolo(TIPO, prioridade)

      return prisma.solicitacao.create({
        data: {
          protocolo,
          tipo: TIPO,
          payload: input.valores,
          prioridade,
          slaHoras: horas,
          retornoPrevistoEm,
          anexos: {
            create: input.anexos.map((anexo) => ({
              campo: anexo.campo,
              nome: anexo.nome,
              tamanho: anexo.tamanho,
              mimeType: anexo.mimeType,
              bucket: anexo.bucket,
              chave: anexo.chave,
            })),
          },
        },
        select: {
          protocolo: true,
          prioridade: true,
          slaHoras: true,
          retornoPrevistoEm: true,
        },
      })
    })

    return solicitacao
  })

/**
 * Comprovante por protocolo, para a tela de sucesso sobreviver a um F5.
 *
 * Devolve SO protocolo e prazo — nunca o `payload`. O protocolo circula por
 * e-mail e WhatsApp, e quem tem o numero nao pode com isso ler os dados
 * fiscais de uma empresa.
 */
export const porProtocolo = os
  .input(z.object({ protocolo: z.string().min(1) }))
  .handler(async ({ input }) => {
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { protocolo: input.protocolo },
      select: {
        protocolo: true,
        prioridade: true,
        slaHoras: true,
        retornoPrevistoEm: true,
        criadoEm: true,
      },
    })

    if (!solicitacao) {
      throw new ORPCError('NOT_FOUND', { message: 'Protocolo não encontrado.' })
    }

    return solicitacao
  })
