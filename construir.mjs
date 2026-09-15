/* Gera portal.html — arquivo único, abre com duplo clique, sem servidor.
 *
 * Fonte única: lê src/perguntas.js, src/motor.js e src/acoes.js e inlina os três
 * no HTML, removendo import/export. O mesmo código roda na varredura (Node) e no
 * protótipo (navegador) — não há duas versões para divergir.
 *
 * Uso: node construir.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const limpar = caminho => readFileSync(caminho, 'utf8')
  .replace(/^\s*import[\s\S]*?from\s+'[^']+';\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');

const modulos = ['src/validacao.js', 'src/consulta_cnpj.js', 'src/simples.js',
                 'src/perguntas.js', 'src/motor.js', 'src/acoes.js']
  .map(limpar).join('\n\n');
const modelo = readFileSync('modelo.html', 'utf8');
let html = modelo.replace('/*__MODULOS__*/', modulos);

/* Os dois logos entram aqui, e não no modelo: 63 KB de base64 no meio do HTML
 * tornavam o modelo ilegível e impossível de revisar por diff. A marca é ativo
 * versionado em ativos/, o modelo só diz onde cada variante entra. */
const LOGOS = {
  '/*__LOGO_TELA__*/': 'ativos/logo-contabil-negativa.b64',
  '/*__LOGO_PAPEL__*/': 'ativos/logo-contabil-positiva.b64',
};
for (const [marcador, arquivo] of Object.entries(LOGOS)) {
  if (!html.includes(marcador)) {
    console.error(`ERRO: o marcador ${marcador} desapareceu do modelo.`);
    console.error('Sem ele o cabeçalho sai com a imagem quebrada.');
    process.exit(1);
  }
  html = html.replace(marcador, readFileSync(arquivo, 'utf8').trim());
}

if (!html.includes('/*__PUBLICACAO__*/')) {
  console.error('ERRO: o marcador /*__PUBLICACAO__*/ desapareceu do modelo.');
  console.error('É por ele que o servidor injeta endpoint e convite. Sem ele, o');
  console.error('portal servido nunca envia resposta nenhuma — em silêncio.');
  process.exit(1);
}

/* Guarda contra um defeito que já aconteceu: atributo `onclick` roda no escopo
 * GLOBAL, e o script é `type="module"` — nenhuma const do módulo existe lá.
 * Escrever onclick="window.irPara(REVISAO)" lança ReferenceError e o botão fica
 * inerte, sem erro nenhum na tela. O valor tem de ser interpolado no template.
 *
 * Regra: dentro de um handler, IDENTIFICADOR_EM_MAIÚSCULAS é suspeito. Literais
 * de texto entre aspas passam; interpolações já foram resolvidas no build. */
export function conferirHandlersInline(texto) {
  const suspeitos = [];
  const handlers = /on(?:click|change|input|blur|submit)="([^"]*)"/g;
  for (const m of texto.matchAll(handlers)) {
    const corpo = m[1]
      .replace(/[$][{][^}]*[}]/g, '@')   // interpolacao: resolvida no navegador
      .replace(/'[^']*'/g, '@');         // literal de texto
    if (/[A-Z][A-Z0-9_]{2,}/.test(corpo)) suspeitos.push(m[1]);
  }
  return suspeitos;
}

/* Guarda contra o defeito irmão, que também já aconteceu: a função existe, está
 * exposta em `window` e NENHUM botão a chama. Foi o caso do relatório — pronto,
 * testado por chamada direta, e inalcançável pela tela por três horas. Teste de
 * unidade não pega: ele chama a função. Só a fiação prova a fiação. */
export function conferirFuncoesOrfas(texto) {
  const orfas = [];
  for (const m of texto.matchAll(/window\.([a-zA-Z_$][\w$]*)\s*=\s*(?:\(|function|async)/g)) {
    const nome = m[1];
    const chamada = new RegExp(`on(?:click|change|input|blur|submit)="[^"]*window\\.${nome}\\(`);
    if (!chamada.test(texto)) orfas.push(nome);
  }
  return orfas;
}

const orfas = conferirFuncoesOrfas(html);
if (orfas.length) {
  console.error('ERRO: função exposta em window e não chamada por handler nenhum.');
  for (const x of orfas) console.error(`  window.${x}`);
  console.error('Ou ligue ao botão que deveria chamá-la, ou apague — as duas coisas');
  console.error('são melhores que uma tela que não alcança a função.');
  process.exit(1);
}

const suspeitos = conferirHandlersInline(html);
if (suspeitos.length) {
  console.error('ERRO: handler inline cita identificador de módulo e vai lançar ReferenceError.');
  for (const x of suspeitos) console.error(`  ${x}`);
  console.error('Interpole o valor no template em vez de escrever o nome.');
  process.exit(1);
}

writeFileSync('portal.html', html, 'utf8');
console.log(`portal.html gerado — ${(html.length / 1024).toFixed(0)} KB`);
