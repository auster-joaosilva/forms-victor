import { somenteDigitos } from './telefone'

/**
 * Mascara de CPF/CNPJ. Ate 11 digitos formata como CPF, acima disso como
 * CNPJ, e corta em 14.
 *
 * Nao valida digito verificador de proposito: o formulario e a primeira porta
 * e recusar por DV errado deixa de fora quem digitou o numero certo de um
 * grupo economico cadastrado torto na origem. Quem confere e a triagem.
 */
export const formatarCpfCnpj = (valor: string): string => {
  const digitos = somenteDigitos(valor).slice(0, 14)

  if (digitos.length <= 11) {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  return digitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Comprimento de CPF ou de CNPJ. Sem DV. */
export const cpfCnpjValido = (valor: string): boolean => {
  const digitos = somenteDigitos(valor)
  return digitos.length === 11 || digitos.length === 14
}
