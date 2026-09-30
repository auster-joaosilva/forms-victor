/* Estimativa da alíquota efetiva do DAS por anexo e faixa de receita.
 *
 * Fórmula — LC 123/2006, art. 18, § 1º-A:
 *     alíquota efetiva = (RBT12 × Aliq − PD) / RBT12
 * onde Aliq é a alíquota nominal e PD a parcela a deduzir da faixa.
 *
 * Como o formulário coleta a FAIXA e não o valor exato do RBT12, a estimativa
 * devolve um INTERVALO: a alíquota efetiva cresce dentro da própria faixa. No
 * Anexo III, 4ª faixa, ela vai de 11,1% no piso a 14,0% no teto — dizer um
 * número só seria falsa precisão.
 *
 * Tabelas transcritas de `Triagem_Reforma_Tributaria/01_Parametros/
 * triagem_aliquotas.toml`, onde estão marcadas `confianca = "conferida"`
 * contra a LC 123/2006 com redação da LC 155/2016.
 *
 * Anexos I, II e IV NÃO estão transcritos naquele arquivo e por isso NÃO estão
 * aqui. Para eles o portal continua perguntando a alíquota — é melhor perguntar
 * do que estimar com número não conferido.
 */

export const TABELAS_SIMPLES = {
  iii: {
    conferida: true,
    fonte: 'LC 123/2006, Anexo III (redação da LC 155/2016)',
    faixas: [
      { ate: 180000, aliq: 0.0600, pd: 0 },
      { ate: 360000, aliq: 0.1120, pd: 9360 },
      { ate: 720000, aliq: 0.1350, pd: 17640 },
      { ate: 1800000, aliq: 0.1600, pd: 35640 },
      { ate: 3600000, aliq: 0.2100, pd: 125640 },
      { ate: 4800000, aliq: 0.3300, pd: 648000 },
    ],
  },
  v: {
    conferida: true,
    fonte: 'LC 123/2006, Anexo V (redação da LC 155/2016)',
    faixas: [
      { ate: 180000, aliq: 0.1550, pd: 0 },
      { ate: 360000, aliq: 0.1800, pd: 4500 },
      { ate: 720000, aliq: 0.1950, pd: 9900 },
      { ate: 1800000, aliq: 0.2050, pd: 17100 },
      { ate: 3600000, aliq: 0.2300, pd: 62100 },
      { ate: 4800000, aliq: 0.3050, pd: 540000 },
    ],
  },
  // [PENDENTE] Anexos I (comércio), II (indústria) e IV (construção, limpeza,
  // vigilância, advocacia). Transcrever de fonte primária antes de habilitar.
  i: null, ii: null, iv: null,
};

/** Limites de receita de cada opção do formulário, em reais. */
export const LIMITES_DA_FAIXA = {
  ate_180k: [0, 180000],
  de_180_360k: [180000, 360000],
  de_360_720k: [360000, 720000],
  de_720k_1_8mi: [720000, 1800000],
  de_1_8_3_6mi: [1800000, 3600000],
  de_3_6_4_32mi: [3600000, 4320000],
  de_4_32_4_8mi: [4320000, 4800000],
};

function efetivaEm(tabela, rbt12) {
  if (rbt12 <= 0) return null;
  const f = tabela.faixas.find(x => rbt12 <= x.ate) || tabela.faixas[tabela.faixas.length - 1];
  return ((rbt12 * f.aliq - f.pd) / rbt12) * 100;
}

/**
 * Estima a alíquota efetiva do DAS.
 * @returns {{min:number, max:number, medio:number, fonte:string}|null}
 *          null quando não há tabela conferida para o anexo ou a faixa está
 *          fora do Simples. Null NUNCA significa zero — significa "pergunte".
 */
export function estimarAliquotaDas(anexo, faixaRbt12) {
  const tabela = TABELAS_SIMPLES[anexo];
  const limites = LIMITES_DA_FAIXA[faixaRbt12];
  if (!tabela || !tabela.conferida || !limites) return null;

  // O piso da faixa é exclusivo: usa-se um real acima para cair na faixa certa.
  const piso = efetivaEm(tabela, limites[0] + 1);
  const teto = efetivaEm(tabela, limites[1]);
  if (piso === null || teto === null) return null;

  const min = Math.min(piso, teto), max = Math.max(piso, teto);
  // Acima do sublimite de R$ 3,6 mi o ISS e o ICMS saem do DAS e passam a ser
  // recolhidos por fora. A alíquota do DAS CAI — no Anexo III, de 17,51% para
  // 15,00% —, mas o custo total não. Quem comparar o DAS cru com outro regime
  // aqui subestima o Simples. A bandeira avisa quem consome a estimativa.
  const acimaDoSublimite = limites[0] >= 3600000;
  return {
    min: +min.toFixed(2),
    max: +max.toFixed(2),
    medio: +((min + max) / 2).toFixed(2),
    issIcmsForaDoDas: acimaDoSublimite,
    fonte: tabela.fonte,
  };
}

/** Há tabela conferida para estimar este caso? */
export function daParaEstimarDas(r) {
  return estimarAliquotaDas(r.anexoSimples, r.faixaRbt12) !== null;
}

/** Intervalo de cada faixa de alíquota que o formulário oferece, em pontos
 *  percentuais. A última é aberta: acima de 19% não há teto declarado. */
export const FAIXA_DAS_DECLARADA = {
  ate_6: [0, 6], de_6_9: [6, 9], de_9_12: [9, 12],
  de_12_15: [12, 15], de_15_19: [15, 19], acima_19: [19, 40],
};

/** Porteira de coerência entre o que a pessoa declarou e o que a tabela diz.
 *
 *  Nunca descarta a declaração: devolve um veredito para quem consome decidir o
 *  que dizer. Muita gente informa a alíquota NOMINAL da faixa achando que é a
 *  efetiva — no Anexo III, 4ª faixa, a nominal é 16% e a efetiva vai de 11,1% a
 *  14,0%. Esse erro precisa aparecer, não contaminar a conta em silêncio.
 *
 *  @returns {{situacao:'nao_declarada'|'sem_tabela_conferida'|'coerente'|'fora_do_intervalo',
 *             declarada:number[]|null, estimativa:object|null}}
 */
export function conferirAliquotaDeclarada(r) {
  const declarada = FAIXA_DAS_DECLARADA[r.aliquotaEfetivaDas] || null;
  const estimativa = estimarAliquotaDas(r.anexoSimples, r.faixaRbt12);
  if (!declarada) return { situacao: 'nao_declarada', declarada: null, estimativa };
  if (!estimativa) return { situacao: 'sem_tabela_conferida', declarada, estimativa: null };
  // Sobreposição, não igualdade: os dois lados são intervalos.
  const sobrepoe = declarada[0] <= estimativa.max && estimativa.min <= declarada[1];
  return { situacao: sobrepoe ? 'coerente' : 'fora_do_intervalo', declarada, estimativa };
}
