/**
 * Leitura de ambiente do SERVIDOR. Nada aqui pode ser importado por
 * componente de cliente — o `import protection` do TanStack Start reclama, e
 * com razao: chave secreta em bundle de navegador e vazamento.
 *
 * Le sob demanda, nao no topo do modulo: em build o processo nao tem as
 * variaveis, e validar na importacao quebraria `npm run build`.
 */

const obrigatoria = (nome: string): string => {
  const valor = process.env[nome]
  if (!valor) {
    throw new Error(`Variavel de ambiente ${nome} e obrigatoria`)
  }
  return valor
}

export const envS3 = () => ({
  endpoint: obrigatoria('S3_ENDPOINT'),
  bucket: obrigatoria('S3_BUCKET'),
  region: process.env.S3_REGION ?? 'us-east-1',
  accessKeyId: obrigatoria('S3_ACCESS_KEY_ID'),
  secretAccessKey: obrigatoria('S3_SECRET_ACCESS_KEY'),
  ttlMinutos: Number(process.env.S3_UPLOAD_URL_TTL_MINUTOS ?? 15),
})
