/* Varredura COM PESOS — mede se a árvore discrimina numa carteira plausível.
 *
 * A varredura uniforme (varredura.mjs) responde outra pergunta: se existe caso
 * que chega a cada saída. Ela não serve para medir DISTRIBUIÇÃO, porque sortear
 * uniformemente dá 78% de "setor com tratamento diferenciado" (7 das 9 opções
 * são setores) e 28% de margem até 5%. Com isso, "decisão fechada" aparecia em
 * 0,0% dos casos — artefato do sorteio, não defeito do motor.
 *
 * OS PESOS ABAIXO SÃO PREMISSA, NÃO DADO. Ficam expostos de propósito, para
 * serem substituídos pela distribuição real da carteira quando a calibragem
 * contra o e-Kontroll for feita. Enquanto não for, nenhum número daqui pode ser
 * apresentado como medição da base Auster.
 *
 * Uso: node varredura_pesos.mjs [N] */
import { PERGUNTAS, TIPOS_CLIENTE, FAIXAS_PERCENTUAIS, perguntasVisiveis } from './src/perguntas.js';
import { diagnosticar } from './src/motor.js';

const PESOS = {
  margemLiquida: { prejuizo: 3, ate_5: 12, de_5_10: 22, de_10_20: 30, de_20_30: 20, acima_30: 10, nao_sei: 3 },
  investimentoPrevisto: { nao: 55, ate_200k: 28, de_200k_1mi: 13, acima_1mi: 4 },
  faixaRbt12: { ate_180k: 18, de_180_360k: 20, de_360_720k: 20, de_720k_1_8mi: 20,
                de_1_8_3_6mi: 13, de_3_6_4_32mi: 5, de_4_32_4_8mi: 3, acima_4_8mi: 1 },
  aquisicoesRegimeRegular: { ate_20: 18, de_20_40: 22, de_40_60: 22, de_60_80: 18, acima_80: 12, nao_sei: 8 },
  pesoMercadorias: { ate_20: 14, de_20_40: 22, de_40_60: 26, de_60_80: 24, acima_80: 14 },
  debitosTributarios: { nao: 62, sim_parcelado: 22, sim_aberto: 10, nao_sei: 6 },
  pesoFolha: { ate_15: 14, de_15_30: 26, de_30_45: 26, de_45_60: 18, acima_60: 12, nenhuma: 4 },
  // A distribuicao uniforme dava 78% de "setor diferenciado" — 7 das 9 opcoes
  // sao setores. Na carteira real a maioria e "nenhum desses".
  setorDiferenciado: { nenhum: 52, saude: 6, educacao: 3, alimentos: 5, transporte_coletivo: 2,
                       profissao_regulamentada: 9, imobiliario: 4,
                       bares_restaurantes: 7, hotelaria_parques: 3, agencias_turismo: 2,
                       nao_sei: 6 },
  mercadoriasComST: { nao: 45, parte: 33, maioria: 14, nao_sei: 8 },
  aquisicoesUsoPessoal: { nao: 62, pouco: 25, relevante: 7, nao_sei: 6 },
  prestadoresPJ: { nao: 52, alguns: 30, boa_parte: 12, nao_sei: 6 },
  versaoFormulario: { sintetico: 35, completo: 65 },
  contratosLongos: { sem_contratos: 26, sem_contratos_longos: 24, com_clausula: 12,
                     sem_clausula: 30, nao_sei: 8 },
};
const PESO_MATRIZ = { zero: 22, ate_20: 22, de_20_40: 16, de_40_60: 14, de_60_80: 10, acima_80: 11, nao_sei: 5 };
const NAO_SEI_RARO = 4;  // peso de 'nao sei' nas perguntas de escolha unica

let sem = 20260915;
const rnd = () => { sem = (sem * 1103515245 + 12345) & 0x7fffffff; return sem / 0x7fffffff; };
function sortear(opcoes, pesos) {
  const lista = opcoes.map(o => [o.valor, pesos ? (pesos[o.valor] ?? 0) : 1]).filter(x => x[1] > 0);
  const total = lista.reduce((t, x) => t + x[1], 0);
  let a = rnd() * total;
  for (const [v, w] of lista) { a -= w; if (a <= 0) return v; }
  return lista[lista.length - 1][0];
}
function gerar() {
  const r = { ehSimei: 'nao', regimeAtual: 'simples' };
  for (let k = 0; k < 3; k++) for (const p of perguntasVisiveis(r)) {
    if (r[p.chave] !== undefined) continue;
    if (p.tipo === 'matriz') {
      const m = {};
      for (const l of TIPOS_CLIENTE) m[l.chave] = sortear(FAIXAS_PERCENTUAIS, PESO_MATRIZ);
      r[p.chave] = m;
    } else if (p.opcoes) {
      let pesos = PESOS[p.chave];
      if (!pesos && p.naoSei) {
        pesos = {}; for (const o of p.opcoes) pesos[o.valor] = o.valor === p.naoSei ? NAO_SEI_RARO : 20;
      }
      r[p.chave] = sortear(p.opcoes, pesos);
    }
  }
  const vis = new Set(perguntasVisiveis(r).map(p => p.chave));
  for (const p of PERGUNTAS) if (!vis.has(p.chave)) delete r[p.chave];
  return r;
}
// Guarda: em 15/09/2026 este arquivo dava peso a `hotelaria_turismo`, opção
// extinta, e peso ZERO às três que a substituíram — o gate de crédito vedado ao
// adquirente nunca aparecia na distribuição. Instrumento de medição quebrado é
// pior que instrumento ausente: ele responde.
for (const [chave, pesos] of Object.entries(PESOS)) {
  const p = PERGUNTAS.find(x => x.chave === chave);
  if (!p || !p.opcoes) continue;
  const validos = new Set(p.opcoes.map(o => o.valor));
  const fantasmas = Object.keys(pesos).filter(v => !validos.has(v));
  const semPeso = [...validos].filter(v => !(v in pesos));
  if (fantasmas.length || semPeso.length) {
    console.error(`PESOS INCOERENTES em "${chave}":`);
    if (fantasmas.length) console.error(`  opções inexistentes: ${fantasmas.join(', ')}`);
    if (semPeso.length) console.error(`  opções sem peso (nunca sorteadas): ${semPeso.join(', ')}`);
    process.exit(1);
  }
}

const n = Number(process.argv[2] || 20000);
const mod = {}, sai = {}, prelim = { com: 0, sem: 0 };
for (let i = 0; i < n; i++) {
  const d = diagnosticar(gerar(), new Date('2026-09-15T12:00:00'));
  sai[d.saida.codigo] = (sai[d.saida.codigo] || 0) + 1;
  const k = `${d.posicao.rotulo} | ${d.posicao.qualificador || '-'}`;
  mod[k] = (mod[k] || 0) + 1;
  if (d.saida.modalidade === 'a_definir') (d.leituraPreliminar ? prelim.com++ : prelim.sem++);
}
const pct = v => `${(100 * v / n).toFixed(1)}%`;
console.log(`\nCarteira plausível (pesos declarados) — ${n.toLocaleString('pt-BR')} casos\n`);
console.log('SAÍDAS');
for (const [k, v] of Object.entries(sai).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}`);
console.log('\nMODALIDADE');
for (const [k, v] of Object.entries(mod).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}`);
console.log(`\n  a definir COM leitura preliminar: ${pct(prelim.com)}`);
console.log(`  a definir SEM lado nenhum:        ${pct(prelim.sem)}`);
console.log(`  → recebe um lado nomeado, no total: ${pct(n - prelim.sem)}\n`);
