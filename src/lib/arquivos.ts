/**
 * Regras de arquivo — as mesmas no cliente e no servidor.
 *
 * O cliente valida para dar erro imediato; o servidor valida porque e a
 * fronteira de confianca. Duas listas divergem em silencio, uma nao — por isso
 * este arquivo e isomorfico e nao importa nada de Node.
 */

export const MAX_BYTES_POR_ARQUIVO = 20 * 1024 * 1024
export const MAX_ARQUIVOS_POR_SOLICITACAO = 15

const MIMES_PERMITIDOS = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
])

const EXTENSOES_PERMITIDAS =
  /\.(pdf|png|jpe?g|gif|webp|heic|docx?|xlsx?|pptx?|txt|csv)$/i

/**
 * Nome de arquivo virando chave de objeto.
 *
 * Acento e espaco em chave S3 dao dor de cabeca de assinatura, e nome de
 * arquivo brasileiro tem os dois. NFD separa o acento do caractere e
 * `\p{M}` tira a marca combinante que sobra.
 */
export const sanitizarNome = (nome: string): string =>
  nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'arquivo'

export const formatarTamanho = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Devolve a mensagem de recusa, ou `null` quando o arquivo passa.
 *
 * Aceita por MIME **ou** por extensao: navegador as vezes manda `type` vazio
 * (arquivo vindo de scanner, de compartilhamento do celular), e recusar por
 * isso derruba envio legitimo.
 */
export const validarArquivo = (arquivo: {
  nome: string
  tamanho: number
  mimeType: string
}): string | null => {
  if (arquivo.tamanho > MAX_BYTES_POR_ARQUIVO) {
    return `O arquivo "${arquivo.nome}" excede o limite de 20 MB.`
  }

  const tipo = (arquivo.mimeType || '').toLowerCase()
  const tipoPermitido = Boolean(tipo) && MIMES_PERMITIDOS.has(tipo)
  const extensaoPermitida = EXTENSOES_PERMITIDAS.test(arquivo.nome)

  if (!tipoPermitido && !extensaoPermitida) {
    return `O arquivo "${arquivo.nome}" tem formato nao suportado. Envie PDF, imagem ou documento do Office.`
  }

  return null
}
