import { randomUUID } from 'node:crypto'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { envS3 } from '#/config/env'
import { sanitizarNome } from '#/lib/arquivos'

/**
 * MinIO. **Somente servidor** — este modulo le credencial do ambiente.
 *
 * `forcePathStyle: true` nao e opcional: sem ele o SDK monta
 * `bucket.host/objeto` (virtual-hosted), e MinIO responde no caminho
 * `host/bucket/objeto`. A assinatura sai de um jeito e o servidor espera de
 * outro, e o erro que volta e um 403 sem explicacao.
 */
let clienteMemo: { cliente: S3Client; bucket: string; ttl: number } | null = null

const obterCliente = () => {
  if (clienteMemo) return clienteMemo

  const env = envS3()
  clienteMemo = {
    cliente: new S3Client({
      endpoint: env.endpoint,
      region: env.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    }),
    bucket: env.bucket,
    ttl: env.ttlMinutos * 60,
  }
  return clienteMemo
}

export const montarChave = (protocolo: string, nome: string): string =>
  `diagnostico/${protocolo}/${randomUUID()}-${sanitizarNome(nome)}`

/**
 * URL de `PUT` assinada. O byte vai do navegador direto para o MinIO — o
 * servidor nao intermedia upload, entao nao ha limite de corpo de requisicao
 * nem memoria consumida por arquivo de 20 MB.
 *
 * O `ContentType` entra na assinatura: o cliente TEM de mandar o mesmo
 * cabecalho no PUT, senao o MinIO recusa com 403.
 */
export const assinarUploadPut = async (input: {
  chave: string
  mimeType: string
}): Promise<{ url: string; bucket: string; expiraEm: number }> => {
  const { cliente, bucket, ttl } = obterCliente()

  const url = await getSignedUrl(
    cliente,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.chave,
      ContentType: input.mimeType || 'application/octet-stream',
    }),
    { expiresIn: ttl },
  )

  return { url, bucket, expiraEm: ttl }
}
