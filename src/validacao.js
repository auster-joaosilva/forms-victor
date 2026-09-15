/* Máscaras e validadores de campo.
 *
 * CNPJ ALFANUMÉRICO: desde 06/07/2026 (IN RFB 2.229/2024) novas inscrições vêm
 * com letras nas 12 primeiras posições; os 2 dígitos verificadores seguem
 * numéricos. O cálculo é o mesmo módulo 11, trocando o valor da posição por
 * `ASCII - 48` (A=17, B=18...). Para algarismos isso devolve o próprio número,
 * então a fórmula é retrocompatível e valida os dois formatos.
 *
 * Um validador só-numérico recusaria em silêncio toda empresa aberta a partir de
 * julho de 2026 — justamente os prospects novos.
 */

// --------------------------------------------------------------------- CNPJ

const LIMPAR_CNPJ = /[^0-9A-Za-z]/g;

export function mascararCnpj(bruto) {
  const c = String(bruto || '').replace(LIMPAR_CNPJ, '').toUpperCase().slice(0, 14);
  const p = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)];
  let saida = p[0];
  if (c.length > 2) saida += '.' + p[1];
  if (c.length > 5) saida += '.' + p[2];
  if (c.length > 8) saida += '/' + p[3];
  if (c.length > 12) saida += '-' + p[4];
  return saida;
}

const valorPosicao = ch => ch.charCodeAt(0) - 48;

function digitoCnpj(base) {
  let peso = 2, soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += valorPosicao(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(bruto) {
  const c = String(bruto || '').replace(LIMPAR_CNPJ, '').toUpperCase();
  if (c.length !== 14) return false;
  // 12 primeiras: letras ou dígitos. 2 últimas: só dígitos.
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  // Rejeita repetição total (00000000000000 e afins), que passa no módulo 11.
  if (/^(.)\1{13}$/.test(c)) return false;
  const base = c.slice(0, 12);
  return digitoCnpj(base) === Number(c[12])
      && digitoCnpj(base + c[12]) === Number(c[13]);
}

// ----------------------------------------------------------------- telefone

export function mascararTelefone(bruto) {
  const d = String(bruto || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneValido(bruto) {
  const d = String(bruto || '').replace(/\D/g, '');
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Celular tem 11 dígitos e o nono começa em 9; fixo tem 10 e começa de 2 a 5.
  if (d.length === 11 && d[2] !== '9') return false;
  if (d.length === 10 && !'2345'.includes(d[2])) return false;
  return true;
}

// ------------------------------------------------------------------- e-mail

export function emailValido(bruto) {
  const v = String(bruto || '').trim();
  if (v.length > 254 || /\s/.test(v)) return false;
  if (!/^[^@]+@[^@]+$/.test(v)) return false;
  const [local, dominio] = v.split('@');
  if (!local || local.length > 64) return false;
  if (!/^[A-Za-z0-9._%+-]+$/.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  // domínio: rótulos separados por ponto, TLD com 2+ letras
  return /^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(dominio);
}

// -------------------------------------------------------------------- texto

/** Nome de pessoa: mínimo de caracteres e nada de string só com pontuação. */
export function nomeValido(bruto, minimo = 3) {
  const v = String(bruto || '').trim();
  return v.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').length >= minimo;
}

export const VALIDADORES = {
  cnpj: { mascara: mascararCnpj, valida: cnpjValido,
          erro: 'CNPJ inválido — confira os dígitos. Aceita o formato alfanumérico novo.' },
  telefone: { mascara: mascararTelefone, valida: telefoneValido,
              erro: 'Telefone inválido — informe DDD e número, com 10 ou 11 dígitos.' },
  email: { valida: emailValido, erro: 'E-mail inválido.' },
  nomeEmpresa: { valida: v => nomeValido(v, 3),
                 erro: 'Informe o nome da empresa (ao menos 3 caracteres).' },
  nomePessoa: { valida: v => nomeValido(v, 3),
                erro: 'Informe o nome de quem está respondendo (ao menos 3 caracteres).' },
};
