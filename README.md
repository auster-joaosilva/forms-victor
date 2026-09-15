# Portal de Decisão — Simples padrão ou regime regular de IBS/CBS

Primeira versão, focada em **estrutura**. Implementa `MANUAL-DECISAO.md` v1.0.
Conteúdo, textos e cortes de calibragem ficam para validar depois.

## O que rodar

```
node construir.mjs      # gera portal.html (arquivo único, duplo clique, sem servidor)
node varredura.mjs      # mede onde os preenchimentos caem — dado para calibrar
node varredura.mjs 50000
```

Sem dependências. Só Node e um navegador.

## Arquivos

| Arquivo | O que é |
|---|---|
| `src/perguntas.js` | Esquema declarativo: blocos, enunciados, tipos, opções, condicionais, origem do dado e **nota de radar explícita por opção** |
| `src/motor.js` | Motor puro: derivadas, gates, árvore, urgência, prazo, confiança, radar |
| `src/acoes.js` | Regras de plano de ação por gatilho, em duas trilhas |
| `modelo.html` | Casca visual (paleta e tipografia Auster) |
| `construir.mjs` | Inlina os três módulos no `portal.html` |
| `varredura.mjs` | Gera N preenchimentos válidos e mede a distribuição das saídas |

**Fonte única:** o mesmo código roda no navegador e na varredura. Não há duas
versões do motor para divergir — foi o defeito que mais custou no diagnóstico
anterior.

## O que já está de pé

- 6 blocos, 29 perguntas, condicionais reativas (campo some quando a condição
  deixa de valer, e a resposta órfã é descartada do payload).
- Matriz de receita por tipo de cliente, com aviso de soma fora de 80–120%.
- Gates → árvore → 5 saídas + 2 especiais, com `gatilhos[]` rastreáveis.
- Urgência, prazo truncado contra 30/09, confiança por contagem de "não sei".
- Radar de 6 eixos com nota explícita por opção.
- Plano de ação **gerado por gatilho**, em duas trilhas, cada item com
  responsável sugerido e dado a levantar.
- Painel de depuração no rodapé do relatório, mostrando as derivadas e os
  gatilhos que levaram àquela saída. Sai antes de publicar.

## Divergências deliberadas do manual

Marcadas no código como `[DIVERGE-Dn]`. Todas reversíveis em uma linha.

| # | O manual diz | O que foi feito | Por quê |
|---|---|---|---|
| D1 | `receitaCreditavel > 60%` e não perto do teto → sempre SAÍDA C | Flag `APLICAR_TESTE_DENSIDADE_NO_RAMO_ALTO`, **desligada** por padrão (roda fiel ao manual) | A §3 do próprio manual diz que folha alta derruba o crédito; a árvore não testava. Ver medição abaixo |
| D2 | `densidadeCredito` = ponto médio das aquisições | "Não sei" devolve **null**, não zero, e roteia para E | Fato ausente não vira zero |
| D3 | Nota do radar "na ordem em que aparece, da pior para a melhor" | **Mapa explícito por opção** | A ordem real de vários campos não é essa. Pela regra do manual, "Não sei" em `certificadoDigital` valeria 100 e "Sim" valeria 0 |
| D4 | Prazo de 3 ou 7 dias úteis | Truncado contra 30/09 menos folga de protocolo | Preenchimento em 25/09 com 3 dias úteis estouraria a janela |
| D5 | `pressaoCredito` alimenta o eixo 1 do radar | **Não alimenta** o radar; alimenta decisão e plano de ação | Perder negócio é sinal de mercado, não maturidade. Pela regra do manual ganharia nota máxima |
| D6 | `margemLiquida` distribuída na ordem no eixo 2 | 100 para qualquer faixa informada, 0 para "Não sei" | O eixo mede se a empresa **sabe** a margem, não se ela é boa |

Fora isso: `aquisicoesRegimeRegular` foi retirada do eixo 3 (mede densidade, não
documentação) e `conheceRegimeFornecedores` entrou no lugar.

## O que a varredura mostrou — 20.000 preenchimentos

Amostragem uniforme sobre optantes do Simples. **Não reproduz a carteira real**;
mostra o que o motor é capaz de produzir.

| Saída | Fiel ao manual | Com D1 ligado |
|---|---|---|
| **E** — simulação obrigatória | 45,3% | 57,1% |
| **D** — maior que o Simples | 21,9% | 21,9% |
| **C** — optar | 19,4% | **7,6%** |
| **A** — não optar | 7,3% | 7,3% |
| **B** — agir comercialmente | 6,2% | 6,2% |

Três leituras:

1. **"E" já é a maior saída com 45%.** Somando D, dois terços dos respondentes
   não recebem resposta sobre padrão x híbrido. Para um formulário que promete
   decidir em dez minutos, é muito.
2. **Os gates decidem mais que a árvore.** `gate_margem_critica` (24,9%),
   `gate_investimento_relevante` (16,5%) e `gate_acima_do_teto` (14,9%) capturam
   56% dos casos antes da árvore rodar. O racional principal só é exercitado em
   ~44%. O gate de investimento é o mais discutível: manda para E mesmo quem tem
   cadeia B2C, onde a resposta seria A.
3. **O furo D1 não é marginal.** Ligar o teste de densidade derruba a saída C de
   19,4% para 7,6% — ou seja, **~61% dos "optar" atuais vêm de casos com
   densidade de crédito insuficiente**. Mas corrigir só isso empurra tudo para E.
   A conclusão é que o corte de densidade (40%) e os fatores de folha precisam
   ser calibrados **juntos**, não isoladamente.

### Caso concreto, reproduzível no protótipo

Tecnologia · 70% da receita para contribuintes · folha acima de 60% do custo ·
aquisições creditáveis até 20% → densidade de crédito **4,5%** → o motor fiel ao
manual devolve **"Optar pelo regime regular"**. É o perfil que mais sofre no
híbrido recebendo a recomendação de entrar nele.

## Pendências antes de virar produto

1. **Calibrar os cortes** com dado real, não com a varredura uniforme. O caminho
   é rodar o motor sobre a carteira já conhecida pelo e-Kontroll.
2. **Pré-preenchimento**: `regimeAtual`, `faixaRbt12`, `segmento` e `anexoSimples`
   estão marcados `origem: 'base'` mas hoje são perguntados. Para cliente da
   carteira, deveriam vir prontos. Convidado de palestra não tem base — precisa
   do caminho alternativo.
3. **Persistência**: não há protocolo, rascunho nem envio. Falta a camada oRPC +
   Prisma + MinIO.
4. **Relatório em PDF** com a marca — hoje só imprime a tela.
5. **Textos do "Por que"**: a §9.3 do manual pede parágrafos por gatilho. Os
   `gatilhos[]` já saem do motor; os textos não foram escritos.
6. **Verificar no DOU** a semestralidade, a janela de março/2027 e as Resoluções
   189/190/191 — ver revisão técnica, item A.1.
7. **Trava do art. 41, § 5º** (ressarcimento impede a saída) não está em lugar
   nenhum do fluxo — ver A.2.

## Convenções

Português sem estrangeirismos em nome de campo, variável e função. Nenhum dado de
cliente no repositório. Paleta `#052C47` / `#71CFEB`, tipografia Kanit com
fallback Montserrat.

---

## Rodada 2 — 14/09/2026

### Entregue

- **Logo oficial** do Drive (`Logo > Negativa > Sem fundo`), SVG vetorial embutido
  no HTML. Cópia em `ativos/logo-negativa.svg`. O complemento "Inteligência
  Tributária" vai em texto Kanit ao lado, como manda o manual da marca.
- **Faixas de faturamento** passaram de 6 para 8, espelhando as faixas dos Anexos
  da LC 123 (180k · 360k · 720k · 1,8mi · 3,6mi · 4,32mi · 4,8mi). É nelas que a
  alíquota efetiva muda — e a alíquota efetiva é exatamente quanto crédito a
  empresa já cede hoje ao cliente do regime regular. **[CONFERIR]** os limites
  contra os Anexos antes de publicar.
- **Validação bloqueante** de CNPJ, e-mail, telefone, nome e solicitante, com
  mensagem específica por erro e destaque do primeiro campo inválido.
- **Máscaras** de CNPJ (`00.000.000/0000-00`) e telefone (`(00) 00000-0000`),
  aplicadas sem perder a posição do cursor.
- **CNPJ alfanumérico** (IN RFB 2.229/2024, vigente desde 06/07/2026): o
  validador usa `ASCII - 48` no módulo 11, então aceita os dois formatos. Um
  validador só-numérico recusaria em silêncio toda empresa aberta de julho em
  diante. Testado contra `12.ABC.345/01DE-35`, o exemplo oficial da RFB.
- **Descrição de cada Anexo** na própria opção, para o respondente se reconhecer.
- **Rota de apoio quando o anexo é "Não sei"**: atividade principal → se serviço,
  Anexo IV? → se não, fator R (folha ≥ 28%). Some assim que o anexo é informado.
- **`conheceRegimeClientes` agora é condicional**: some quando a receita é toda de
  pessoa física. Consumidor final não tem regime tributário.
- **`operacoesIntragrupo`**: nova condicional quando há empresa do grupo em regime
  regular. Ver abaixo.
- **Trava do art. 41, § 5º** entrou como item de trilha 1 na saída C.
- **Removida** a pergunta de certificado digital. Virou verificação interna da
  Auster ao protocolar. Ela aparecia em 72,8% dos planos sem mudar recomendação.

### Decisões registradas

**`grupoEconomico` — para que serve.** No manual estava marcada como campo de
motor, mas não era usada em lugar nenhum. O uso legítimo é este: se existe
empresa do grupo no **regime regular** que compra desta, ela hoje só se credita
do montante equivalente ao devido no DAS (LC 214, art. 47, § 9º, II). Migrar para
o híbrido faria essa irmã creditar integral — é benefício que fica **dentro do
grupo**, e costuma ser o argumento mais forte a favor do híbrido. Por isso a
pergunta ganhou o desdobramento `operacoesIntragrupo`: o que decide não é existir
outra empresa, é haver operação entre elas.

**Receita 100% de pessoa física.** Além de inibir `conheceRegimeClientes`, esse
caso já cai naturalmente em `receitaCreditavel = 0` → SAÍDA A. O formulário fica
coerente: não pergunta o que não se aplica.

### Pendências — situação após a rodada 2

| # | Item | Situação |
|---|---|---|
| 1 | Calibrar cortes com a carteira do e-Kontroll | **autorizado**, exige sessão própria |
| 2 | Pré-preenchimento pela base | **descartado na v1** por exigir autenticação; conciliação vai para o backoffice |
| 3 | Persistência + backoffice de validação | **próximo bloco** |
| 4 | PDF com padrão gráfico da marca | **aprovado**, a fazer |
| 5 | Textos do "Por que" | a escrever; os gatilhos já saem do motor |
| 6 | Conferir no DOU semestralidade e janela de março | pendente — afeta o texto e a urgência do relatório |
| 7 | Trava do art. 41, § 5º | **feito** — item de trilha 1 na saída C |
| 8 | Perguntas específicas para operação com produtos | **a decidir** — ver abaixo |

### Item 8 — o que falta para quem opera com produtos

O formulário hoje mede bem o lado de serviço (`pesoFolha` como redutor da
densidade de crédito), mas não tem o espelho para mercadoria. Faltam, no mínimo:

- peso de mercadorias e insumos no custo total (hoje só se mede a folha);
- estoque relevante na virada — há discussão de crédito sobre estoque na
  transição, que muda a conta de quem carrega estoque alto;
- mercadorias hoje sujeitas a substituição tributária, que deixa de existir no
  modelo IBS/CBS;
- frete e logística, que no comércio pesam no crédito.

Sem isso, comércio e indústria são avaliados só pelo que **não** têm (folha
baixa), e não pelo que têm. **[CALIBRAR] com a direção** antes de implementar.

---

## Rodada 3 — 14/09/2026 — parecer de UI e duas perguntas novas

### Diagnóstico da "feiura", medido

Mesmo método do redesenho do painel fiscal (2026-08-27). Três causas, todas medidas
no DOM, não opinadas:

| # | Medição antes | Efeito |
|---|---|---|
| 1 | `--borda` a **1,28:1** sobre branco e **zero sombras** em toda a página | Nada lia como objeto. Cartão, campo e opção eram o mesmo retângulo branco — uma parede clara |
| 2 | Sete tamanhos de fonte, **quatro deles entre 11 e 14 px** | Sem hierarquia: título de seção, rótulo, opção e metadado praticamente do mesmo tamanho |
| 3 | `#71CFEB` a **1,78:1** sobre branco | A marca só existia na faixa escura do topo. O corpo da página não tinha cor nenhuma |

A fonte Kanit **estava** carregando — diferente do painel fiscal, esse não era o problema.

### Correções aplicadas

- **Borda em duas camadas:** `--borda` 1,43:1 para divisória e `--borda-forte`
  **3,05:1** para contorno de campo e de opção, que é onde a WCAG 1.4.11 exige 3:1.
  Escurecer tudo a 3:1 deixaria a tela pesada.
- **Sombra sutil** em cartão, cabeçalho, indicador e item de ação, para os objetos
  existirem.
- **Escala tipográfica reduzida a quatro degraus reais**: 12 · 14 · 16 · 28. Antes
  eram sete valores; agora cada um tem função (metadado, corpo, destaque, título).
- **Acento utilizável sobre branco:** `#007E99` — mesma família de matiz do azul da
  marca (191 contra 194), escurecido até **4,73:1**. O `#71CFEB` continua onde
  rende: fundo escuro e preenchimento.
- **Opções curtas viram grade.** Uma barra da largura do cartão escrita "Sim" é
  ruído, não escolha. Opção com até 26 caracteres e sem descrição entra em linha.
- Foco visível nos campos, hover em toda superfície clicável, régua sob os
  subtítulos, e `h1` com contagem de etapa em caixa alta acima.

Valores conferidos no DOM depois da mudança: divisória 1,43 · controle 3,05 ·
acento 4,73 · escala 28/16/14/12.

### Perguntas novas

- **`setorDiferenciado`** (bloco 2) — setores que a Reforma trata de forma própria:
  saúde, educação, alimentos e agropecuária, transporte coletivo, profissão
  intelectual regulamentada, imobiliário, hotelaria e turismo. **O motor não aplica
  percentual nenhum** — não há redução conferida em fonte primária no projeto. A
  resposta gera gatilho e ação de trilha 1 para apurar caso a caso.
  **[CONFERIR]** a lista e o tamanho de cada redução contra a LC 214/2025.
- **`aquisicoesUsoPessoal`** (bloco 4) — aquisição de uso ou consumo pessoal **não
  gera crédito** (LC 214/2025, art. 47, caput, c/c art. 57 — transcrição conferida
  em `triagem_aliquotas.toml`). Entra como fator redutor da densidade de crédito:
  1,00 · 0,90 · 0,75. **"Não sei" não penaliza** (fator 1,00), só conta como lacuna
  de confiança e vira ação — coerente com a regra de que lacuna não vira o pior caso.
  Fatores **[CALIBRAR]**.

### Observação da varredura

`confirmar_regime_diferenciado` dispara em 78,3% dos casos simulados, mas isso é
artefato da amostragem uniforme: sete das nove opções são setores diferenciados. Na
carteira real a proporção é outra. Vale como teste de que o gatilho funciona, não
como estimativa.

---

## Rodada 4 — 14/09/2026 — tese de regime, bloco produto e ramificação

### O corte de 11,33% / 5,93% — por que ele não pode ser usado cru

Os percentuais estão corretos e conferidos contra `triagem_aliquotas.toml`:

- **Serviços:** IRPJ 15%×32% + CSLL 9%×32% = 7,68%, mais PIS/COFINS cumulativo
  3,65% → **11,33%**
- **Comércio, indústria e transporte de carga:** 15%×8% + 9%×12% = 2,28%, mais
  3,65% → **5,93%**

Só que são **apenas os tributos federais sobre receita**. A alíquota efetiva do
Simples já embute ISS ou ICMS **e a CPP**. Comparar um contra o outro manda migrar
quem ficaria pior.

O motor agora soma as estimativas antes de comparar — e, por decisão da direção,
a saída é sempre **recomendação de análise**, nunca de migração.

**Medição que mostra o tamanho do erro evitado** (serviço, DAS ~17%, folha 30–45%):

| Cenário | Carga estimada do Presumido | Simples parece mais caro? |
|---|---|---|
| Anexo III | **24,9%** | não |
| Mesmo caso no **Anexo IV** | **14,8%** | **sim** |

No Anexo IV a CPP já está fora do DAS, então não se soma de novo ao Presumido —
e só ali a comparação fica próxima do corte cru. Pelo corte de 11,33% sem ajuste,
o Anexo III receberia "migre" com 13,6 pontos percentuais de erro.

Constantes marcadas `[CALIBRAR]`: CPP de 26,8% sobre folha, ISS/ICMS estimado em
3,5% e 4,0%, e os pontos médios das faixas de DAS.

### Perguntas novas

| Chave | Bloco | Aparece para | O que alimenta |
|---|---|---|---|
| `aliquotaEfetivaDas` | 2 | todos | a comparação de regime. Sem ela não há tese — "Não sei" vira ação de trilha 1 |
| `jaPlanejouMudancaRegime` | 2 | todos | ação. Diferente de `jaSimulou`, que é sobre a Reforma |
| `pesoMercadorias` | 4 | **só operação com produto** | densidade de crédito — SUBSTITUI o fator de folha quando respondido (ver rodada 12) |
| `mercadoriasComST` | 4 | **só operação com produto** | gatilho e ação; a ST não existe no IBS/CBS |
| `prestadoresPJ` | 4 | todos | densidade de crédito (PJ gera crédito, folha não) |
| `pagaRPA` | 4 | **só operação de serviço** | ação. A inclusão no fator R é questão em aberto |

`margemLiquida` mudou de enunciado: agora é **antes do IRPJ e da CSLL**, porque é
assim que se compara com a presunção. O campo e a chave continuam os mesmos.

### Ramificação por natureza da operação

`ehOperacaoComProduto()` e `ehOperacaoDeServico()` decidem pelo segmento, pelo
anexo ou pela atividade informada. Resultado medido:

- **Comércio** vê no bloco 4: folha, aquisições, fornecedores, investimento,
  **mercadorias, ST**, prestadores PJ, uso pessoal, documentação.
- **Serviço** vê: folha, aquisições, fornecedores, investimento, prestadores PJ,
  **RPA**, uso pessoal, documentação.

Ninguém responde pergunta que não se aplica, e o total por respondente fica em ~30
em vez de ~40.

### Prestador PJ — enunciado atenuado

A pergunta entrou como **fato tributário** ("parte dos prestadores é pessoa
jurídica?"), porque pagamento a PJ gera crédito e folha não. A ação correspondente
recomenda avaliar enquadramento, dinâmica de trabalho e cuidados contratuais —
sem afirmar passivo no documento que vai ao cliente.

### Alíquota do DAS: estimada, não perguntada

`src/simples.js` calcula a alíquota efetiva pela fórmula do art. 18, § 1º-A da
LC 123 — `(RBT12 × Aliq − PD) / RBT12` — usando as tabelas dos **Anexos III e V**,
transcritas do `triagem_aliquotas.toml`, onde estão marcadas como conferidas.

Como o formulário coleta a faixa e não o valor exato, a estimativa devolve um
**intervalo**: no Anexo III, 4ª faixa, a alíquota vai de 11,05% a 14,02%. Um número
único seria falsa precisão.

| Situação | Comportamento |
|---|---|
| Anexo III ou V com faixa conhecida | **estima e não pergunta** |
| Anexo I, II, IV, "mais de um" ou desconhecido | **pergunta ao cliente** (tabelas não transcritas) |
| Cliente informou a alíquota | a informada **vence** a estimativa |

**Armadilha que a medição revelou.** No Anexo III a alíquota efetiva *cai* de
17,51% para 15,00% ao cruzar R$ 3,6 mi. Não é erro da tabela: acima do sublimite o
ISS e o ICMS **saem do DAS** e passam a ser recolhidos por fora. A alíquota do DAS
diminui, o custo total não. Comparar o DAS cru com outro regime nessa faixa
subestimaria o Simples — por isso a estimativa carrega a bandeira
`issIcmsForaDoDas` e o motor soma o ISS/ICMS estimado antes de comparar.

Conferido: Anexo III 720k–1,8mi → 12,54% · Anexo V 1,8–3,6mi → 20,41% · Anexo III
acima do sublimite → 15–18% na tabela, **20%** depois de somar o que saiu do DAS.

---

## Rodada 5 — blocos fundidos e a fronteira do diagnóstico

- **Seis blocos viraram cinco.** "Preparo para a janela" foi absorvido por
  "Margem, preço e preparo". Uma etapa a menos de navegação, nada perdido.
- **`cienteDoPrazo` removida.** Media se a comunicação funcionou, não o cenário da
  empresa — e a resposta já se sabe pelo canal que trouxe o respondente.
- **Fronteira explícita entre o que é grátis e o que é serviço.** Nova ação
  `projetar_margem_pos_reforma`: a margem informada no formulário é a de **hoje** e
  serve de gatilho; a margem **sob CBS e IBS** depende de crédito de insumo,
  repasse e regime da cadeia — é o que a simulação entrega. O relatório passa a
  dizer isso, em vez de deixar o cliente achar que já recebeu a resposta.

Total visível para um serviço do Anexo III: **34 perguntas** em 5 etapas.

### Consulta de CNPJ — o que a API realmente devolve

Testado contra a BrasilAPI com CNPJ público, **HTTP 200 em 0,39 s**, 48 campos:

| Campo | Uso no portal |
|---|---|
| `razao_social`, `nome_fantasia` | pré-preenche a identificação |
| `opcao_pelo_simples` (booleano) | **confere** `regimeAtual`, hoje só declarado |
| `opcao_pelo_mei` | **confere** o gate do SIMEI |
| `data_inicio_atividade` | resolve o limite proporcional do art. 3º, § 2º — que o projeto de Triagem registra como lacuna de dado |
| `cnae_fiscal` + `cnaes_secundarios` | sugere o anexo e sinaliza setor diferenciado |
| `descricao_situacao_cadastral` | detecta baixada/inapta antes de diagnosticar |
| `qsa[]` | confere se quem preenche está no quadro societário |

Dois cuidados medidos:

1. **`cnae_fiscal` vem como inteiro** (`6422100`). CNAE com zero à esquerda perde
   o dígito: `0600001` chega como `600001`, e classificar pelos dois primeiros
   caracteres jogaria extração de petróleo em telecomunicações. Exige
   `padStart(7,'0')`.
2. **O CPF do sócio vem mascarado** (`***550179**`), como nos dados abertos da
   Receita. Nome do sócio, não. Ver decisão abaixo.

A chamada **exige header `User-Agent`** — sem ele a API devolve 403.

---

## Rodada 6 — consulta cadastral por CNPJ

`src/consulta_cnpj.js`. Dispara na saída do campo, quando o CNPJ é válido.

**Três regras de projeto, testadas:**

1. **Nunca bloqueia.** Timeout de 4 s, 403, CNPJ inexistente ou rede caída
   devolvem `{ok:false}` e o formulário segue manual, sem erro na tela. Conferido
   com CNPJ inexistente (HTTP 400) e CNPJ curto — degradou nos dois.
2. **QSA buscado, nunca exibido.** Serve só para marcar `_solicitanteNoQsa`
   (true/false/null) por trás. Conferido: nenhum nome de sócio chega ao DOM.
3. **Não rouba o foco.** A resposta chega enquanto o respondente já digita o campo
   seguinte — por isso o retorno atualiza só o selo, sem redesenhar a etapa.
   Conferido: foco preservado durante a consulta.

Pré-preenche `nomeEmpresa` e pré-marca `ehSimei` e `regimeAtual`, sempre sem
sobrescrever o que o respondente já escreveu.

**Dois defeitos encontrados testando, e corrigidos:**

- O selo sobrevivia à troca de CNPJ — campo com erro e selo exibindo a razão
  social do CNPJ anterior. Agora a troca limpa cadastro, QSA e selo.
- A guarda de cache impedia reconsultar um CNPJ já visto depois de o selo ter
  sido limpo: o campo ficava mudo. A guarda passou a exigir que o resultado ainda
  esteja em mão.

---

## Rodada 7 — duas versões e campos abertos

**Escolha na primeira pergunta**, com o tempo estimado na própria opção:

| Versão | Perguntas | Confiança | Entrega |
|---|---|---|---|
| **Caminho curto** (~4 min) | 20 | teto de **MÉDIA** | leitura inicial e plano de ação enxuto |
| **Completo** (~10 min) | 38 | até ALTA | radar, plano detalhado e oportunidade preliminar de planejamento |

O filtro é declarativo: `essencial: true` marca as perguntas que o motor precisa
para chegar a uma saída. O caminho curto mostra só essas.

**O teto de confiança é deliberado.** Mesmo sem nenhuma resposta em branco, o
caminho curto não coleta o suficiente para uma leitura de confiança alta — e quem
lê o relatório precisa saber disso. Quem escolhe o curto ganha, no plano de ação,
o item `completar_diagnostico` explicando o que ficou de fora.

Medido no mesmo cenário: curto e completo chegaram à **mesma saída (C)**, com
confiança MÉDIA contra ALTA. O essencial basta para a recomendação; o resto
dimensiona a oportunidade.

**Dois campos abertos, facultativos:** `expectativa` no início ("o que você espera
descobrir aqui?") e `percepcaoFinal` no fim ("o que mudou na sua percepção?").
Não alimentam o motor — alimentam a conversa comercial e a calibragem futura.

---

## Rodada 8 — o plano de ação reescrito para quem toca a empresa

Três problemas do plano anterior, apontados pela direção:

1. Estava **escrito para contador** — citava artigo no corpo do texto e usava
   jargão de apuração.
2. **Misturava** o que o cliente faz com o que é serviço da Auster, tirando a
   força das duas coisas.
3. Não dava **direcionamento claro** sobre a decisão em si.

### O relatório passou a ter três blocos

**1. A decisão**, em uma frase, seguida de "O que isso significa para a sua
empresa" — dois a três períodos em linguagem de dono de negócio. As cinco saídas
foram reescritas:

| Antes | Agora |
|---|---|
| "Não optar. Manter IBS e CBS no DAS." | **"Continue como está."** |
| "Não optar, mas agir comercialmente." | **"Continue como está, mas resolva o lado comercial."** |
| "Optar pelo regime regular." | **"Vale apurar IBS e CBS por fora do DAS."** |
| "A decisão é maior que o Simples." | **"A pergunta é maior: vale continuar no Simples?"** |
| "Simulação obrigatória antes de decidir." | **"Não decida sem simular."** |

Evitei "híbrido" e "regime regular" no texto do cliente: *dentro da guia única* e
*por fora do DAS* dizem a mesma coisa sem exigir vocabulário.

**2. O que fazer na sua empresa** — só ações internas, no imperativo, divididas em
"antes de 30 de setembro" e "nos próximos meses". Cada item traz **o que você
precisa ter em mãos**, não "dado a levantar". O fundamento legal saiu do corpo e
virou nota discreta, para quem quiser conferir.

**3. Como a Auster pode ajudar** — bloco à parte, visualmente distinto, com a
frase que separa venda de tarefa: *"nenhuma delas depende de você fazer antes"*.

### Separação no código

Cada regra agora declara `executor: 'cliente' | 'auster'`, e `planoDeAcao()`
devolve `{clienteAgora, clienteDepois, auster}`. A separação é estrutural, não de
redação — não dá para um item de venda vazar para a lista de tarefas do cliente.

Medido num caso de cadeia B2B com contrato travado: **7 ações do cliente para
antes de 30/09, 4 para os meses seguintes e 7 frentes da Auster** — antes era uma
lista única de 14 itens indistintos.

### Painel de depuração

Estava aparecendo no relatório do cliente, com `receitaCreditável`, `densidade de
crédito` e os nomes internos dos gatilhos. Agora só aparece com **`?motor=1`** na
URL. Padrão: invisível. Testado com cinco variações de query.

---

## Rodada 9 — 15/09/2026: a decisão de regime em destaque, e uma correção de lei

### O que mudou por pedido

**1. "Não sei" na matriz de clientes.** A pergunta *"Quanto do seu faturamento
vai para cada tipo de cliente?"* ganhou a coluna **não sei**, por linha.

O detalhe que importa: a coluna NÃO tem ponto médio (`pm: null`). Se tivesse 0,
quem desconhece a própria carteira cairia em SAÍDA A — *"continue como está"* —
sem ninguém ter afirmado nada. Com `pm: null`, a `receitaCreditavel` fica
indefinida, a árvore para no primeiro galho e devolve a saída nova
`E_SEM_DADO`: *"Falta uma informação para decidir."* A lacuna aparece na
confiança como `receitaPorCliente.regime_regular` e vira ação.

De carona, dois defeitos:

* A matriz não redesenhava a etapa. A pergunta sobre o regime dos clientes
  depende da matriz e está no MESMO bloco — só aparecia ao sair e voltar da
  etapa. Agora `setMatriz` compara `assinaturaVisivel()`, como `set` já fazia.
* Sete colunas não cabem em tela de telefone. A tabela passou a rolar dentro do
  próprio quadro (`.matriz-rolo`), sem empurrar a página.

**2. A decisão de regime virou a primeira coisa da tela.** Antes de "por que",
antes dos indicadores, antes do radar: uma faixa com o nome da posição, o
qualificador e **a única ação que decorre dela**. Cinco posições, três famílias
que nunca se misturam (`POSICOES` em `motor.js`):

| Posição | Qualificador | Ação única na tela |
|---|---|---|
| Simples padrão | decisão fechada | "Não há nada a protocolar em setembro." |
| Simples padrão | a confirmar | "Nada a protocolar — mas confira o ponto aberto." |
| Simples híbrido | decisão fechada | "Protocole a opção até 30 de setembro de 2026." |
| Simples híbrido | a confirmar por simulação, dentro de setembro | "A simulação precisa ficar pronta ainda em setembro." |
| Sem posição fechada | depende de número real | "Priorize a simulação — decidir no escuro custa um semestre." |

**3. A árvore agora roda sempre**, mesmo quando um gate curto-circuita a decisão.
Medido: **91% das saídas E vinham de gate** (`gate_margem_critica` 58%,
`gate_investimento_relevante` 33%) — e o respondente saía sem nenhuma indicação
de modalidade, ainda que a carteira dele fosse clara. Agora a leitura da árvore
sobrevive como `leituraPreliminar`, sempre "a confirmar", com o motivo em
linguagem do respondente: *"leitura que depende de conferir a margem real, hoje
abaixo de 5%"*.

### O que mudou por conferência de lei — e aqui há erro corrigido

Duas premissas do `MANUAL-DECISAO.md` que o portal reproduzia estavam erradas.
Conferidas em 15/09/2026 no texto do Planalto.

**A. Não existe cancelamento em 30 de novembro.** A opção pelo regime regular do
IBS e da CBS é **semestral e IRRETRATÁVEL dentro do semestre**: janelas em
**setembro e março**, na forma regulamentada pelo CGSN.

> LC 123/2006, art. 13, § 9º (incluído pela LC 227/2026) e § 10 (redação da LC
> 227/2026): a opção "será exercida para os semestres iniciados em janeiro e
> julho de cada ano, sendo irretratável para cada um desses períodos, devendo ser
> exercida nos meses de setembro e março imediatamente anteriores a cada
> semestre".

Saíram: `PRAZO.cancelamentoAte`, a ressalva de tela e a ação
`ciencia_da_trava_de_saida`, que dizia ao cliente que ele podia cancelar até
novembro. Entraram `PRAZO.janelaSeguinte` (março de 2027, efeito no 2º semestre)
e a ação `ciencia_da_irretratabilidade`. Toda posição da família híbrido agora
carrega a tarja da irretratabilidade com o fundamento à vista.

A trava do art. 41, § 5º, da LC 214 é **mais estreita** do que eu havia
registrado: ela veda sair do regime regular a quem **recebeu ressarcimento de
créditos** no ano-calendário corrente ou anterior — não é uma trava geral.

**B. A janela de setembro não serve para ENTRAR no Simples.** O art. 87-B da LC
123, incluído pelo art. 517 da LC 214 — que antecipava a opção pelo Simples para
2027 ao mês de setembro de 2026 — foi **revogado** pela LC 227/2026, art. 181,
IV, "a". A saída `ESPECIAL-FORA-DO-SIMPLES` afirmava o contrário e foi corrigida.

**C. Medicina não é profissão regulamentada do art. 127.** A lista do art. 127
da LC 214 (redução de 30%) é fechada, com 18 profissões, e inclui **médico
VETERINÁRIO** — não médico. Serviço médico é serviço de saúde: art. 128, II,
redução de 60%. As duas opções da pergunta `setorDiferenciado` foram reescritas
com a lista correta e com o requisito do § 1º, II (sócios habilitados, nenhum
sócio pessoa jurídica, serviços prestados pelos próprios sócios).

> **LC 227/2026, de 13 de janeiro de 2026.** Alterou a LC 214 de forma ampla.
> O projeto `Triagem_Reforma_Tributaria`, conferido em 06/09/2026, não a
> menciona. Toda premissa marcada "conferida" lá precisa ser revista.

### Calibragem do critério de "decisão fechada"

A primeira versão exigia confiança ALTA e nenhum gatilho em aberto. Resultado
medido: **"decisão fechada" em 0,0% dos casos** — os três estados colapsavam em
dois. Duas causas, as duas corrigidas:

* `simples_pode_estar_mais_caro` e `margem_abaixo_da_presuncao` estavam na lista
  de pontos em aberto. Os dois são sobre OUTRA decisão — continuar ou não no
  Simples — e já geram ação própria. Misturar as duas decisões fazia toda
  recomendação virar "a confirmar".
* A confiança GERAL travava a posição. Um "não sei" em pergunta que a árvore do
  padrão x híbrido nem percorre (sublimite, estudo de regime anterior) não deve
  impedir fechar a posição. Agora só travam as lacunas de
  `LACUNA_QUE_TRAVA_A_DECISAO`. O caminho curto nunca fecha posição, por
  construção.

`varredura_pesos.mjs` entrou para isso: a varredura uniforme sorteia 78% de
"setor com tratamento diferenciado" (7 das 9 opções são setores), o que inviabiliza
medir distribuição. **Os pesos dele são premissa, não dado** — nenhum número de
lá pode ser apresentado como medição da carteira Auster até a calibragem contra
o e-Kontroll.

Com pesos plausíveis, 30.000 casos: padrão 42,6% · híbrido 35,3% · sem posição
22,0%. **78% recebem um lado nomeado.**

### Pendências que esta rodada abriu

* Reconferir TODA a `Triagem_Reforma_Tributaria` contra a LC 227/2026.
* O § 10 remete à forma "regulamentada pelo CGSN" — falta localizar a Resolução
  CGSN que disciplina o protocolo da opção. O portal diz "até 30 de setembro"
  com base no mês legal, não em resolução conferida.

### Rodada 10 — 15/09/2026: peso visual da decisão e do fechamento

**A decisão virou um cartão só.** Havia dois títulos grandes competindo — a faixa
de regime (branca) e o cartão escuro da saída. Fundi os dois: um herói escuro,
nome do regime em `clamp(32px, 5.4vw, 46px)`, tarja superior colorida por família,
qualificador em capápsula e a ação única em 19px. O título da saída desceu para
uma linha de apoio dentro do mesmo cartão.

**Corrigida uma contradição de leitura.** Nos casos de gate, o herói dizia
"Simples híbrido" e a linha imediatamente abaixo dizia "Não decida sem simular".
Quando existe leitura preliminar, a linha de apoio passou a ser **o que trava**,
não o título da saída: *"O que ainda trava: esta leitura depende de conferir a
margem real, hoje abaixo de 5%."*

**Aviso de que isto não é diagnóstico.** Faixa própria logo abaixo do herói,
nomeando o que a simulação olha e o portal não: alíquota efetiva do DAS mês a mês,
crédito que cada cliente aproveita, composição real das compras, margem por linha.

**As ressalvas viraram "Três coisas para não errar"**, em cartões numerados, com o
item do híbrido em evidência. As duas ressalvas genéricas (análise preliminar,
cortes de triagem) desceram para nota de pé.

O item 2 ganhou o alcance que faltava: o MEI **não aproveita e não transfere
crédito** — nas compras é tratado como consumo final (LC 227/2026, art. 106, § 5º)
e nas vendas não transfere, salvo os créditos presumidos de **transporte autônomo
de carga** e de **bem móvel usado para revenda** (LC 214, arts. 169 e 171). As duas
exceções estão na tela porque MEI caminhoneiro é caso comum.

**Primeira consulta de mídia do arquivo.** Não havia nenhuma: em 400 px, os 24 px
de `main` mais os 40 px do cartão deixavam 272 px de texto. Abaixo de 560 px os
espaçamentos horizontais caem e a grade de indicadores vira uma coluna.

> **Pedido não atendido, com motivo.** A solicitação era destacar *"a opção do
> híbrido pode ser cancelada até 30 de novembro de 2026"*. Esse cancelamento **não
> existe**: LC 123, art. 13, § 10 (LC 227/2026) diz que a opção é "irretratável
> para cada um desses períodos". Pôr isso em destaque num relatório de cliente
> seria induzir decisão irreversível com promessa de recuo inexistente. O item
> está em destaque — com o conteúdo correto: semestral, irretratável, janelas em
> setembro e março.

### Rodada 11 — 15/09/2026: a quebra de serviço era inerte; triagem de optante no início

**A quebra de serviço não decidia nada.** `segmento` oferecia quatro tipos de
serviço — profissional regulamentado, tecnologia, saúde, demais — e os quatro
usos do campo no código colapsavam tudo em `startsWith('servico')`. Quatro
opções de atrito para zero consequência.

**E faltavam as duas quebras que decidem.** Conferido em
`Triagem_Reforma_Tributaria/01_Parametros/triagem_aliquotas.toml` (Lei 9.249,
arts. 15 e 20): a presunção do Lucro Presumido **difere** entre transporte de
carga (8%, art. 15, § 1º, II, 'a', parte final) e de passageiros (16%), e
serviço hospitalar volta ao caput (8%) em vez dos 32% dos serviços em geral.

O motor tinha **dois** valores — 11,33% "serviço" e 5,93% "produto" — e todo
segmento fora de comércio/indústria/agronegócio caía em 11,33%. Transporte de
carga e saúde hospitalar ficavam com quase o dobro da carga devida, o que
empurrava o gatilho `simples_pode_estar_mais_caro` para o lado errado.

Agora há `PRESUNCOES` por segmento, com a fonte em cada linha:

| Segmento | IRPJ | CSLL | Carga federal |
|---|---|---|---|
| Comércio, indústria, agronegócio | 8% | 12% | 5,93% |
| Transporte de cargas | 8% | 12% | 5,93% |
| Transporte de passageiros | 16% | 12% | 7,13% |
| Serviço de saúde, confirmado como hospitalar | 8% | 12% | 5,93% |
| Serviços em geral, construção civil, outro | 32% | 32% | 11,33% |

A presunção reduzida da saúde depende de **duas condições de fato** — sociedade
empresária e normas da Anvisa — e não de CNAE. Entrou a pergunta condicional
`servicoHospitalar`; sem confirmação, vale a presunção de serviços em geral.
Profissão regulamentada saiu do `segmento`: quem a captura com precisão é
`setorDiferenciado` (art. 127 da LC 214), e para o Presumido ela é serviço em
geral como qualquer outro.

Construção civil ficou em 32% com `[CONFERIR]`: a distinção entre empreitada com
fornecimento de material e só mão de obra não está conferida no toml. 32% é o
lado conservador — faz o Presumido parecer pior, nunca melhor do que é.

**CNPJ antes da razão social.** A ordem do bloco 1 virou
`versaoFormulario > cnpj > nomeEmpresa > regimeAtual > ehSimei > solicitante > ...`.
A consulta à BrasilAPI já devolvia `optanteSimples`, `optanteMei` e a razão
social; com o CNPJ na frente, os três campos seguintes chegam preenchidos.

Isso expôs um defeito: a consulta gravava `ehSimei` e `regimeAtual` no estado
**sem marcar o radio na tela** — a pessoa via os campos em branco e respondia de
novo. `repintarOpcoes` passou a ajustar `checked`, não só a classe visual.

**Triagem de optante no início, com saída para o diagnóstico oficial.** Quem é
MEI ou não é optante era descoberto só no fim, depois de cinco blocos. Agora
`atalhoDeTriagem()` desvia na própria etapa em que a resposta aparece, para uma
tela curta com link para a **Avaliação Prévia da Reforma Tributária**
(`consultoria.austercontabil.com.br/diagnostico-reforma`), que serve a qualquer
regime. Botão "Voltar e corrigir" devolve à etapa exata de onde saiu.

O bloco 1 ganhou aviso de escopo no cabeçalho: *"Este diagnóstico é para quem já
é optante do Simples Nacional."*

### Pendência aberta nesta rodada — decisão da direção

Os 3,65% de PIS/COFINS cumulativo somados à carga do Presumido são **base 2026**.
A partir de 1º/01/2027 a matriz legal do PIS e da COFINS é revogada (LC 214,
art. 542, III, IX, X, XVIII e XXI, c/c art. 544, III) e entra a CBS cheia —
conforme o próprio `triagem_aliquotas.toml`, que registra `devido = false` para
2027. A comparação de regimes do portal, portanto, **mistura épocas**: DAS de
hoje contra Presumido de hoje, para uma opção que produz efeito em 2027.

Mantive a base 2026 de propósito — é a que o respondente confere no próprio
PGDAS — e a saída continua "vale analisar", nunca "migre". Trocar a base muda a
tese da comparação e não é decisão que eu deva tomar sozinho.

### Rodada 12 — 15/09/2026: o crédito vedado ao adquirente, e três opções que faltavam

**O que `setorDiferenciado` decide (era a pergunta).** Hoje, três coisas — e
nenhuma delas é percentual:

1. liga o gatilho `setor_com_tratamento_diferenciado`, que está em
   `ABRE_PONTO_EM_ABERTO`: impede a posição ser "decisão fechada" e a rebaixa
   para "a confirmar";
2. gera a ação da Auster `confirmar_setor_diferenciado`;
3. **novo:** dois setores agora acionam um gate próprio.

O motor **não aplica** redução de alíquota nenhuma, de propósito — o tamanho de
cada redução é caso a caso.

**Bares e restaurantes: era uma opção só, e são três seções da lei.** O
Capítulo VII da LC 214 separa bares e restaurantes (Seção I, arts. 273-276),
hotelaria e parques (Seção II, arts. 277-283) e agências de turismo. A opção
"Hotelaria, restaurantes, parques e turismo" juntava tudo.

E a separação **muda a decisão**, não só o rótulo:

> **Art. 276.** Fica vedada a apropriação de créditos do IBS e da CBS pelos
> adquirentes de alimentação e bebidas fornecidas pelos bares e restaurantes,
> inclusive lanchonetes.
>
> **Art. 283.** Fica vedada a apropriação de créditos de IBS e de CBS pelo
> adquirente dos serviços de hotelaria, parques de diversão e parques temáticos.

Ou seja: nesses dois setores **o cliente não pode creditar, por lei**, esteja a
empresa na guia única ou por fora. O argumento central deste diagnóstico —
destacar imposto para o cliente aproveitar — simplesmente não existe ali. Antes
desta rodada, um restaurante com clientela de empresas era mandado para a SAÍDA C
("vale apurar por fora porque seus clientes querem crédito"). Recomendação
errada, contra texto expresso.

Entrou o gate `gate_credito_vedado_ao_adquirente` e a saída
`ESPECIAL-SETOR-SEM-CREDITO`, com posição própria — *"Depende do regime do seu
setor"* — e ação da Auster `rodar_regime_especifico_do_setor`. Na varredura
uniforme, 6,0% dos casos. Hotelaria mantém o crédito nas próprias compras
(art. 282), o que deixa a decisão puramente aritmética.

**"Não tenho folha nem prestadores na operação".** `pesoFolha` começava em "até
15%" — não havia como dizer "zero". A opção nova esconde `prestadoresPJ` e
`pagaRPA`, e entra em `fatorFolha` como 1,00 e em `PONTO_MEDIO_FOLHA` como 0: sem
folha, todo o custo passa por terceiro e a densidade de crédito é a máxima.

**"Não trabalho com contrato — cada venda é fechada na hora".** `contratosLongos`
tinha "Não há contratos de prazo longo", que supõe contratos curtos. Agora são
duas respostas distintas, e quem não tem contrato pontua 90 no eixo de
preço e contratos — acima de quem tem contrato curto (75), abaixo de quem
contratou cláusula de revisão de propósito (100).

**A saída E passou a dizer o custo de cada erro**, em vez de "priorize a
simulação": optar e errar prende a empresa no regime regular por todo o primeiro
semestre de 2027; não optar e errar custa a espera até março. É o que responde
à pergunta sobre "decidir pelo híbrido e calcular depois".
