# victor-forms — contexto do projeto

Formulários públicos da Auster Inteligência Tributária, portados do monolito
`site-ahssyma` (Vite + React Router + Supabase) para uma stack própria.

**Stack:** TanStack Start (SSR) + TanStack Router (rotas por arquivo) +
TanStack Query · oRPC · Prisma 7 + PostgreSQL · MinIO (S3) · Zod 4 · CSS Modules.

O primeiro formulário portado é o **Diagnóstico de Transação Tributária**
(`src/features/diagnostico`). Os outros cinco do monolito — reforma,
planejamento, candidato, parceiro, CAPAG — nascem no mesmo molde.

---

## Arquitetura — bulletproof-react

Segue <https://github.com/alan2207/bulletproof-react>. O que isso significa aqui:

```
src/
  app/            rotas e composição da aplicação
    routes/       rotas por arquivo (TanStack Router)
  components/     UI compartilhada, sem regra de negócio
  config/         env, caminhos, constantes de infraestrutura
  features/       fatias de domínio — é aqui que mora o negócio
    diagnostico/
      api/        chamadas oRPC + hooks do TanStack Query
      components/ telas e blocos da feature
      config/     etapas, opções de campo, feriados
      schemas/    Zod — fonte única, cliente e servidor
      stores/     estado do formulário (contexto + rascunho)
      types/      tipos do domínio
      utils/      máscaras, prazo, rótulos
  lib/            integrações (prisma, s3, protocolo, arquivos)
  orpc/           contrato do servidor
  styles/         tokens e reset globais
```

### A regra que não se quebra: importação é de mão única

```
lib · components · config  →  features  →  app
```

- `features/*` **nunca** importa de `app/`.
- `features/a` **nunca** importa de `features/b`. Se dois formulários
  precisarem da mesma coisa (e vão — máscara de telefone, upload, protocolo),
  ela sobe para `lib/` ou `components/`. Não se cria atalho lateral.
- `components/*` e `lib/*` não conhecem domínio. `components/ui/text-input` não
  sabe o que é CNPJ; quem sabe é `features/diagnostico`.

Alias de importação é `#/` (definido em `package.json#imports` e no
`tsconfig.json`). Sem `../../../`.

Arquivos em **kebab-case**. Vocabulário de domínio em **português**
(`contatoCliente`, `ondaCalor`, `enviarDiagnostico`); vocabulário de framework
em inglês (`Route`, `handler`, `useQuery`).

---

## Uma rota por etapa — a página gigante não volta

No monolito o formulário inteiro era **um arquivo de 1.242 linhas** com
`{step === 1 && ...}` oito vezes. Aqui cada etapa é uma rota:

```
/diagnostico/identificacao → /procuracao → /situacao → /pendencias
/riscos → /calor → /anexos → /revisao → /enviado/$protocolo
```

- `app/routes/diagnostico/route.tsx` é o **layout**: monta o provedor de
  estado, a barra lateral e a navegação. É o único lugar que sabe que existe
  uma sequência.
- Cada `app/routes/diagnostico/<etapa>.tsx` tem meia dúzia de linhas: declara a
  rota e renderiza o componente da etapa, que vive em
  `features/diagnostico/components`. **Rota não tem lógica.** Se aparecer `if`
  de negócio num arquivo de rota, ele está no lugar errado.
- A ordem e os rótulos vivem em um lugar só:
  `features/diagnostico/config/etapas.ts`. Acrescentar etapa é acrescentar uma
  linha lá e um arquivo de rota — nada mais.

O estado atravessa as rotas por contexto (`stores/diagnostico-store.tsx`), não
por `useState` em cada tela, e é espelhado em `localStorage` a cada 800 ms.

---

## CSS — nada de estilo dentro do arquivo do componente

**Todo componente estiliza por CSS Module colocado ao lado dele.**

```
components/ui/text-input/text-input.tsx
components/ui/text-input/text-input.module.css
```

Proibido no `.tsx`: `style={{ ... }}`, classe utilitária solta
(`className="p-8 flex gap-2"`), `<style>` embutido, string de CSS em constante.

Cor, espaçamento, raio e sombra **não são literais** — saem dos tokens de
`src/styles/theme.css`:

```css
.cartao {
  background: var(--cor-superficie);
  padding: var(--esp-6);
  border-radius: var(--raio-md);
}
```

Token novo entra em `theme.css`. Valor mágico em `.module.css` (`#052c47`,
`padding: 23px`) é dívida — a paleta da Auster está toda lá:
`--cor-primaria: #052c47`, `--cor-destaque: #71cfeb`.

Exceção única e legítima: valor calculado em tempo de execução (largura de
barra de progresso) entra por *custom property* inline, e o `.module.css`
consome com `var()`. O estilo continua no CSS; só o número vem do TSX.

---

## Regras de negócio do Diagnóstico

Estas regras vieram de produção. Cada uma tem um motivo, e mudar qualquer uma
delas é decisão de produto, não de código.

### Protocolo

Formato `DTT-<prioridade>-<AAAAMM><sequência de 3>` — ex. `DTT-A-202609001`.
Sem prioridade, `DTT-202609001`.

- O prefixo é do tipo de formulário: `DTT` transação, `DTR` reforma, `PPS`
  planejamento, `CAN` candidato, `PAR` parceiro, `CPG` CAPAG.
- O contador é **por (tipo, ano-mês)** e o ano-mês é calculado no fuso
  **America/Sao_Paulo**, nunca em UTC. Usar UTC abria a chave do mês seguinte
  às 21h do dia 31, e o primeiro protocolo legítimo do mês nascia `002`.
- A sequência é atômica (`upsert` com incremento na mesma transação). Dois
  envios simultâneos não podem receber o mesmo número.

### Prioridade e prazo de retorno

Derivados de **duas** respostas — risco imediato e onda de calor:

| Risco imediato | Onda de calor | Prioridade | Prazo |
|---|---|---|---|
| sim | muito interessado | **A** | 4 h úteis |
| sim | qualquer outra | **B** | 8 h úteis |
| não | muito interessado | **C** | 48 h úteis |
| não | qualquer outra | **D** | 72 h úteis |

**Hora útil é hora útil:** 09:00–17:30 (8,5 h/dia), de segunda a sexta,
descontando os feriados nacionais de `config/feriados.ts`. Envio fora da
janela começa a contar na abertura do próximo dia útil. O prazo é calculado
**no servidor**, no fuso de São Paulo — o relógio do navegador do parceiro não
decide SLA da Auster.

A prioridade **não classifica a demanda** para a equipe: ela entra no protocolo
e o número de horas vai em `slaHoras`. Quem faz triagem vê o dado bruto e
decide a bandeira. No monolito isto mandava um nível de prioridade que o
gatilho do banco descartava no `INSERT` — a classificação já estava morta e
ninguém sabia.

### Contatos: pede-se os dois lados, exige-se um

Pergunta-se o contato **do lado do cliente** e **do lado do parceiro**, com
papel (sócio, financeiro, contador…). É obrigatório que **pelo menos um dos
dois** tenha telefone ou e-mail. Nome sozinho não conta — não dá para ligar
para um nome.

Travar o envio exigindo os dois afasta mais gente do que melhora o cadastro:
quem preenche costuma ser de um lado só.

A lista de papéis em `config/opcoes.ts` **espelha** `aurora_papeis` do banco
principal. É duplicação consciente: o formulário é público, roda sem sessão, e
abrir leitura da tabela para a internet só para preencher um `select` é pior.
Papel novo lá que não apareça aqui não quebra nada — o valor é validado no
servidor.

### Tratativa

`direto` ou `via_parceiro`. Quando é `via_parceiro`, **proposta, prazo e
condição passam pelo parceiro antes de fechar** — ninguém combina nada direto
com o cliente. É contrato comercial, não preferência de UI.

### Contato: grupo de WhatsApp *ou* telefone

`possuiGrupoWhatsapp = sim` → nome do grupo obrigatório, telefone limpo.
`= nao` → telefone obrigatório, nome do grupo limpo. Nunca os dois.

### Anexos — dois são barreira de envio

Obrigatórios, e sem eles não se avança da etapa de anexos:

1. **Relatório de Situação Fiscal** do e-CAC da Receita Federal;
2. **Relatório de CDAs** da PGFN (sistema Regularize).

Documentos contábeis (balanço, balancete, DRE, razão — 5 anos) são opcionais.
Cada obrigatório tem manual em PDF em `public/manuais/` — a maioria de quem
preenche não sabe emitir, e sem o manual o formulário simplesmente não é
concluído.

Limites, iguais aos de produção: **20 MB por arquivo**, **15 arquivos por
solicitação**, e allowlist de tipo por MIME *e* extensão (PDF, imagens,
Office, txt, csv). A validação roda no cliente **e** no servidor: o cliente é
conveniência, o servidor é a fronteira de confiança.

### Campos condicionais

Só é obrigatório o que a resposta anterior tornou relevante:

- `procuracaoFeita = nao` → `formaAcesso` obrigatório;
- `pendenciaFiscal = sim` → `quaisPendencias` com ao menos um item;
- `riscoImediato = sim` → `quaisRiscos` com ao menos um item.

### Navegação entre etapas

Voltar é livre. **Avançar valida.** Pular para uma etapa adiante revalida todas
as anteriores e, na primeira que falhar, para nela e mostra os erros — não dá
para chegar na revisão por cima de uma etapa vazia.

### Rascunho

Salvo em `localStorage` (chave `diagnostico-rascunho`) 800 ms depois da última
digitação, e **apagado no envio bem-sucedido**.

Ao ler o rascunho, faça *merge* campo a campo com o estado inicial. Um rascunho
salvo antes de um campo existir volta sem ele, e um spread raso deixa
`contatoCliente` como `undefined` — a tela quebra na primeira renderização de
quem tinha rascunho salvo. Já aconteceu.

### Máscaras

**Telefone** (`utils/telefone.ts`) — uma função para todos os campos:

- 13 dígitos começando em `55` (celular com DDI) ou 12 (fixo com DDI): o `55`
  sai. Colar `+55 34 99655-6666` do WhatsApp é o caso comum, e sem isso o
  número virava `(55) 34996-5566` — salvo assim não liga para ninguém, e nada
  avisava.
- Ramifica em 10 e 11 dígitos: fixo é `(34) 3215-1234`, celular é
  `(34) 99655-6666`. A máscara antiga partia sempre em 2+5+4 e torcia todo
  fixo do país.
- Válido é 10 **ou** 11 dígitos, depois de tirar o DDI.

**CPF/CNPJ** — até 11 dígitos formata como CPF, acima disso como CNPJ, corta
em 14.

---

## Dados

`prisma/schema.prisma`. Modelos do diagnóstico:

- `Solicitacao` — uma linha por envio: protocolo, tipo, `payload` (Json, o
  formulário como veio), prioridade, `slaHoras`, `retornoPrevistoEm`.
- `Anexo` — metadados do arquivo no MinIO: `bucket`, `chave`, nome original,
  tamanho, mime. **O byte nunca vai para o Postgres.**
- `ContadorProtocolo` — `(tipo, anoMes) → valor`, com unique composto. É o que
  torna a sequência atômica.

Migration com `npm run db:migrate` (usa `dotenv-cli` e `.env.local`).
`db:push` só em desenvolvimento descartável.

**O cliente Prisma é gerado e está no `.gitignore`.** Depois de clonar, ou
depois de mexer no `schema.prisma`, rode `npm run db:generate` — sem isso
`#/generated/prisma/client` não existe e o typecheck falha em cascata.

**`npm run dev` passa por `dotenv -e .env.local`**, e não é conveniência: o
`src/db.ts` lê `DATABASE_URL` no topo do módulo, e a rota de qualquer etapa
importa o cliente oRPC, que no servidor importa o roteador, que importa o
Prisma. Sem a variável no `process.env`, o SSR da primeira tela estoura. O
`vite dev` puro carrega `.env.local` apenas para variáveis `VITE_*`, que não
ajudam aqui.

---

## Arquivos no MinIO

O servidor **não intermedia bytes**. O fluxo:

1. cliente pede URL assinada (`diagnostico.assinarUpload`) mandando nome,
   tamanho e mime;
2. servidor valida limites/allowlist, gera a chave
   `diagnostico/<protocolo>/<uuid>-<nome-sanitizado>` e devolve a URL de `PUT`;
3. cliente faz `PUT` direto no MinIO;
4. cliente envia o formulário com a lista de chaves; servidor grava os `Anexo`.

Nome de arquivo é **sanitizado** antes de virar chave (NFD, sem acento, só
`[a-zA-Z0-9._-]`) — nome brasileiro com acento e espaço em chave S3 é dor de
cabeça de assinatura.

Variáveis em `.env.local` (modelo em `.env.example`): `S3_ENDPOINT`,
`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. MinIO
exige `forcePathStyle: true` — sem isso o SDK monta `bucket.host` e não
resolve.

---

## oRPC é o contrato; o tRPC do starter é legado

Existem os dois no `package.json` porque o template veio assim. **Código novo
usa oRPC** (`src/orpc/`): tem Zod na entrada, gera OpenAPI em `/api` e o
cliente é isomórfico (no servidor chama a função direto, sem HTTP).

O `src/integrations/trpc/` com o `todos` de exemplo fica só porque o contexto
do roteador ainda o declara. Não acrescente procedimento lá.

**Zod é fonte única.** O schema de cada etapa vive em
`features/diagnostico/schemas/` e é o mesmo objeto usado pela validação da tela
e pelo `.input()` do procedimento oRPC. Duas validações divergem em silêncio;
uma, não.

---

## Como trabalhar aqui

**Commitar ao terminar cada leva coerente de alterações**, agrupando por
assunto, para permitir reversão cirúrgica.

**Sem linha de co-autoria nos commits.** Nada de `Co-Authored-By`.

Antes de commitar, rodar:

```
npx tsc --noEmit      # 0 erro
npm run build
npm test              # checagens de prazo, telefone e CPF/CNPJ
```

Continua exigindo confirmação: apagar arquivos, mexer em credenciais, aplicar
migration em base compartilhada, mudar alvo de deploy.

### Rota nova exige regenerar a árvore

`src/app/routeTree.gen.ts` é **gerado**. Não edite à mão. Depois de criar ou
renomear arquivo de rota: `npm run generate-routes` (o `vite dev` também
regenera). Diretório de rotas e destino do arquivo gerado ficam em
`tsr.config.json`.

### Sempre cheque o erro

`const { data } = await algo()` sem olhar o erro já esconde dois bugs graves no
projeto de origem. Erro de mutação sobe para a tela; nunca morre em `catch`
vazio. `catch` que devolve sucesso é pior que estouro — no monolito a Z-API deu
mensagem por entregue por três dias por causa disso.

### Lógica pura tem checagem

`utils/prazo.ts`, `utils/telefone.ts` e `utils/cpf-cnpj.ts` têm arquivo
`*.test.ts` ao lado, rodando em `node --test` com `tsx`. Sem framework, sem
fixture. Regra de negócio com ramo (hora útil, feriado, DDI) não entra sem uma
asserção que quebre se ela quebrar.

---

## Estado conhecido

- O `todos` de exemplo do template ainda existe em oRPC e tRPC. Sai quando o
  segundo formulário entrar.
- Sem autenticação: os formulários são públicos por natureza.
- Sem geração de PDF. O monolito baixava um resumo com `jspdf` na tela de
  sucesso; aqui a tela de sucesso mostra protocolo e prazo. Se o PDF voltar,
  ele é responsabilidade do servidor, não do navegador.
- Sem envio de e-mail/notificação no envio — no monolito era uma Edge Function.
- Os manuais em `public/manuais/` precisam ser copiados do monolito
  (`site-ahssyma/public/manuais/`); os links da etapa de anexos já apontam
  para eles.
- **A migration do diagnóstico ainda não foi aplicada.** O `schema.prisma`
  tem `Solicitacao`, `Anexo` e `ContadorProtocolo`, mas nenhum banco recebeu
  `db:migrate` — não havia Postgres no ar. Validação, protocolo e prazo já
  respondem; o `INSERT` estoura com `ECONNREFUSED` até subir o banco.
- **O MinIO ainda não foi ligado.** `assinarUpload` está escrito e valida a
  entrada, mas as variáveis `S3_*` não existem em `.env.local` — a primeira
  chamada real levanta `Variavel de ambiente S3_ENDPOINT e obrigatoria`.
