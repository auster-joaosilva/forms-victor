import { useMutation } from '@tanstack/react-query'

import { client } from '#/orpc/client'
import { validarArquivo } from '#/lib/arquivos'

import type { ArquivosDiagnostico, CampoAnexo, DiagnosticoValores } from '../types'

type AnexoGravado = {
  campo: CampoAnexo
  nome: string
  tamanho: number
  mimeType: string
  bucket: string
  chave: string
}

/**
 * Sobe um arquivo: pede a URL assinada e faz `PUT` direto no MinIO.
 *
 * O `Content-Type` TEM de ser o mesmo que entrou na assinatura, senao o MinIO
 * recusa com 403 sem explicar. E `fetch` nao rejeita em 4xx/5xx — sem o
 * `if (!resposta.ok)` o arquivo sumiria e o envio seguiria como se tivesse
 * subido.
 */
const subirArquivo = async (
  envioId: string,
  campo: CampoAnexo,
  arquivo: File,
): Promise<AnexoGravado> => {
  const mimeType = arquivo.type || 'application/octet-stream'

  const recusa = validarArquivo({
    nome: arquivo.name,
    tamanho: arquivo.size,
    mimeType,
  })
  if (recusa) throw new Error(recusa)

  const assinado = await client.diagnostico.assinarUpload({
    envioId,
    campo,
    nome: arquivo.name,
    tamanho: arquivo.size,
    mimeType,
  })

  const resposta = await fetch(assinado.url, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: arquivo,
  })

  if (!resposta.ok) {
    throw new Error(
      `Falha ao enviar "${arquivo.name}" (${resposta.status}). Verifique sua conexão e tente novamente.`,
    )
  }

  return {
    campo,
    nome: arquivo.name,
    tamanho: arquivo.size,
    mimeType,
    bucket: assinado.bucket,
    chave: assinado.chave,
  }
}

const achatar = (
  arquivos: ArquivosDiagnostico,
): Array<{ campo: CampoAnexo; arquivo: File }> =>
  (Object.entries(arquivos) as Array<[CampoAnexo, Array<File>]>).flatMap(
    ([campo, lista]) => lista.map((arquivo) => ({ campo, arquivo })),
  )

/**
 * Sobe os anexos e grava a solicitacao.
 *
 * Nesta ordem, e nao ao escolher o arquivo: enquanto o formulario nao foi
 * enviado nada precisa existir no MinIO, e subir a cada escolha deixaria lixo
 * de quem desistiu no meio.
 */
export const useEnviarDiagnostico = () =>
  useMutation({
    mutationFn: async (entrada: {
      valores: DiagnosticoValores
      arquivos: ArquivosDiagnostico
    }) => {
      const envioId = crypto.randomUUID()

      const anexos: Array<AnexoGravado> = []
      for (const { campo, arquivo } of achatar(entrada.arquivos)) {
        anexos.push(await subirArquivo(envioId, campo, arquivo))
      }

      return client.diagnostico.enviar({ valores: entrada.valores, anexos })
    },
  })
