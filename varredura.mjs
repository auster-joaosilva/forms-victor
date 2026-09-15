/* Varredura do motor — mede a distribuição das saídas antes de publicar.
 *
 * Gera N preenchimentos válidos (respeitando as condicionais) e conta onde eles
 * caem. Serve para calibrar os cortes da §12 do manual com dado, não com
 * intuição: se 90% dos casos caírem em "E", o formulário não decide nada.
 *
 * Uso:  node varredura.mjs [N]
 */

import { PERGUNTAS, TIPOS_CLIENTE, FAIXAS_PERCENTUAIS, perguntasVisiveis } from './src/perguntas.js';
import { diagnosticar, CORTES, APLICAR_TESTE_DENSIDADE_NO_RAMO_ALTO } from './src/motor.js';
import { planoDeAcao } from './src/acoes.js';

let semente = 20260914;
const rnd = () => {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
};
const escolher = lista => lista[Math.floor(rnd() * lista.length)];

/** Preenchimento aleatório válido: respeita condicionais e sempre responde o
 *  que está visível. MEI e não-optantes ficam de fora — o alvo do formulário é
 *  o optante do Simples. */
function preenchimentoAleatorio() {
  const r = { ehSimei: 'nao', regimeAtual: 'simples', nomeEmpresa: 'Simulada',
              cnpj: '00.000.000/0001-00', solicitante: 'x', email: 'x@x.com',
              telefone: '(34) 90000-0000' };

  for (let passada = 0; passada < 3; passada++) {
    for (const p of perguntasVisiveis(r)) {
      if (r[p.chave] !== undefined) continue;
      if (p.tipo === 'matriz') {
        const m = {};
        for (const linha of TIPOS_CLIENTE) m[linha.chave] = escolher(FAIXAS_PERCENTUAIS).valor;
        r[p.chave] = m;
      } else if (p.opcoes) {
        r[p.chave] = escolher(p.opcoes).valor;
      }
    }
  }
  // remove respostas de perguntas que deixaram de estar visíveis
  const visiveis = new Set(perguntasVisiveis(r).map(p => p.chave));
  for (const p of PERGUNTAS) if (!visiveis.has(p.chave)) delete r[p.chave];
  return r;
}

const n = Number(process.argv[2] || 20000);
const hoje = new Date('2026-09-14T12:00:00');

const saidas = {}, urgencias = {}, confiancas = {}, gatilhos = {};
const modalidades = {};
let comLeituraPreliminar = 0, aDefinirSemLeitura = 0;
const radarPorEixo = {}, tamanhoPlano = [], itensAcao = {};
let semTrilha1 = 0;

for (let i = 0; i < n; i++) {
  const r = preenchimentoAleatorio();
  const d = diagnosticar(r, hoje);
  const plano = planoDeAcao(r, d);

  saidas[d.saida.codigo] = (saidas[d.saida.codigo] || 0) + 1;
  const mod = `${d.posicao.rotulo} — ${d.posicao.qualificador || 'n/a'}`;
  modalidades[mod] = (modalidades[mod] || 0) + 1;
  if (d.leituraPreliminar) comLeituraPreliminar++;
  else if (d.saida.modalidade === 'a_definir') aDefinirSemLeitura++;
  urgencias[d.urgencia] = (urgencias[d.urgencia] || 0) + 1;
  confiancas[d.confianca.nivel] = (confiancas[d.confianca.nivel] || 0) + 1;
  for (const g of d.gatilhos) gatilhos[g] = (gatilhos[g] || 0) + 1;
  for (const e of d.radar) {
    (radarPorEixo[e.titulo] = radarPorEixo[e.titulo] || []).push(e.score);
  }
  tamanhoPlano.push(plano.total);
  if (plano.clienteAgora.length === 0) semTrilha1++;
  for (const it of [...plano.clienteAgora, ...plano.clienteDepois, ...plano.auster])
    itensAcao[it.id] = (itensAcao[it.id] || 0) + 1;
}

const pct = v => `${(100 * v / n).toFixed(1)}%`;
const linha = '─'.repeat(64);

console.log(`\nVarredura — ${n.toLocaleString('pt-BR')} preenchimentos válidos (optantes do Simples)`);
console.log(`Cortes: receitaCreditavel ${CORTES.receitaCreditavelBaixa}/${CORTES.receitaCreditavelAlta}` +
            ` · densidade ${CORTES.densidadeCreditoMinima} · margem ${CORTES.margemMinimaSuporta}`);
console.log(`Teste de densidade no ramo alto (D1): ${APLICAR_TESTE_DENSIDADE_NO_RAMO_ALTO ? 'LIGADO' : 'desligado (fiel ao manual)'}`);
console.log(linha);

console.log('\nSAÍDAS');
for (const [k, v] of Object.entries(saidas).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}  ${'█'.repeat(Math.round(40 * v / n))}`);

console.log('\nPOSIÇÃO DE REGIME');
for (const [k, v] of Object.entries(modalidades).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}  ${'█'.repeat(Math.round(40 * v / n))}`);
console.log(`  → com leitura preliminar de modalidade: ${pct(comLeituraPreliminar)}`);
console.log(`  → sem indicação de lado nenhum:         ${pct(aDefinirSemLeitura)}`);

console.log('\nURGÊNCIA');
for (const k of ['ALTA', 'MÉDIA', 'BAIXA'])
  console.log(`  ${k.padEnd(26)} ${pct(urgencias[k] || 0).padStart(7)}`);

console.log('\nCONFIANÇA');
for (const k of ['ALTA', 'MÉDIA', 'BAIXA'])
  console.log(`  ${k.padEnd(26)} ${pct(confiancas[k] || 0).padStart(7)}`);

console.log('\nRADAR (média por eixo)');
for (const [titulo, v] of Object.entries(radarPorEixo)) {
  const validos = v.filter(x => x !== null);
  const media = validos.reduce((a, b) => a + b, 0) / validos.length;
  const semDado = v.length - validos.length;
  console.log(`  ${titulo.padEnd(32)} ${media.toFixed(1).padStart(6)}` +
              (semDado ? `   (${pct(semDado)} sem dados)` : ''));
}

console.log('\nPLANO DE AÇÃO');
const ts = tamanhoPlano.slice().sort((a, b) => a - b);
console.log(`  itens por plano: mín ${ts[0]} · mediana ${ts[Math.floor(ts.length / 2)]} · máx ${ts[ts.length - 1]}`);
console.log(`  planos sem nenhuma ação imediata do cliente: ${pct(semTrilha1)}`);
console.log('\n  frequência de cada item:');
for (const [k, v] of Object.entries(itensAcao).sort((a, b) => b[1] - a[1]))
  console.log(`    ${k.padEnd(36)} ${pct(v).padStart(7)}`);

console.log('\nGATILHOS DA ÁRVORE');
for (const [k, v] of Object.entries(gatilhos).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(32)} ${pct(v).padStart(7)}`);
console.log();
