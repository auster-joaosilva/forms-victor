# Carteira de clientes por analista, com escopo de acesso

Data: 2026-10-05 · Status: desenho aprovado em conversa com o Victor, com o ponto 1 da seção 9 ainda em aberto; aguardando revisão desta spec

Base: portal em produção desde 04/10/2026 (`main`). O papel e as capacidades vivem em `src/server/shared/domain/permissions.ts`. Não existe hoje a noção de cliente, de área nem de escopo: o operador vê todas as respostas e adesões.

Este é o subprojeto 1 de 2. O subprojeto 2 (repositório de termos de opção pelo regime regular IBS/CBS, com leitura automática do comprovante) terá spec própria e depende deste, porque o termo é anexado na ficha do cliente e herda o escopo.

## Decisões

| # | Decisão |
|---|---|
| C1 | **Papéis continuam os quatro, fixos no código.** Não há papel editável na tela. O escopo por carteira vale **só para `operator`**. `admin`, `manager` e `regularization` continuam sem escopo, como hoje. |
| C2 | **Área (`Department`) é cadastro novo.** Cada usuário pertence a no máximo uma área. A área tem um indicador `ownsProspects`, ligado pelo admin nas áreas **Comercial** e **Consultoria**: são elas que tratam quem ainda não é cliente. |
| C3 | **Cliente (`Client`) é entidade própria**, identificada por `cnpjDigits` (único). Tem área, titular opcional e `active`. O titular é um `operator`; o gestor da área é o substituto. |
| C4 | **Substituto é derivado, não gravado**: os usuários `manager` da área do cliente. Como o gestor já vê tudo (C1), o substituto serve de contingência: assume o cliente **sem titular** ou cujo titular foi desativado. Não concede poder novo. |
| C5 | **Titular precisa ser da mesma área do cliente.** Invariante de domínio, conferida na criação, na edição, na importação e na transferência. |
| C6 | **Escopo do operador sobre diagnósticos e adesões**, por `cnpjDigits`: vê os de CNPJ que está na base **e é titular**; vê os de CNPJ **fora da base** (prospect) só se a área dele tiver `ownsProspects`; não vê os de cliente de outro titular. Resposta sem CNPJ conta como prospect. |
| C7 | **Escopo é aplicado no servidor, em todo caso de uso**, inclusive os por id (tratar adesão, copiar o termo, exportar CSV, contagens). Filtrar só na tela deixaria o dado acessível pela server function e por id adivinhado. |
| C8 | **Convites e inscrições em eventos entram no escopo**, pela mesma regra de C6 aplicada ao `cnpjDigits` (convite sem CNPJ e inscrição sem CNPJ contam como prospect). Exceção do convite: o operador sempre vê o que **ele mesmo criou**, para não perder o convite que acabou de emitir para um prospect. Os **eventos em si** (conteúdo, sessões, vagas) não são dado de cliente e seguem abertos. A contagem de vagas continua somando todas as inscrições, e a lista de inscritos mostra só as do escopo; a tela avisa quando há inscrições fora da visão. |
| C9 | **Virada segura por chave.** A chave `portfolio_scope_enabled` (padrão `false`) fica no Postgres e só o admin liga. Com ela desligada, o comportamento é o de hoje. Ligar antes de importar a base e de atribuir áreas faria o operador deixar de ver tudo, e não há ambiente de homologação. Ligar e desligar vão para a trilha de auditoria. |
| C10 | **Transferência de carteira vai para o `AuditLog`** (`client_transferred`, com de/para, autor e motivo opcional). Não há tabela de histórico. |
| C11 | **Importação por CSV/XLSX em duas passadas**, tudo ou nada. A primeira só relata; a segunda, com o mesmo arquivo e a confirmação, grava. O arquivo é lido em memória, sem disco. |
| C12 | **Atribuição em lote.** Na lista de clientes, o gestor ou o admin marca vários clientes (ou "todos do filtro atual") e define o titular de uma vez, ou tira o titular. Vale a invariante C5 para o lote inteiro: se um só cliente for de área diferente da do titular escolhido, **nada é gravado** e a tela lista os que impedem. Limite de 500 clientes por operação. A auditoria grava **uma entrada por lote** (`clients_transferred`) com autor, titular de origem e de destino, quantidade e os ids, e não uma por cliente. |

## 1. Rotas e telas

| Rota | O que é |
|---|---|
| `/backoffice?tab=clients` | Lista de clientes com filtro por área, titular e situação. O operador só enxerga os dele (com a chave ligada). |
| `/backoffice/clients/$id` | Ficha: dados, titular, substituto, transferência. Aqui o subprojeto 2 vai pendurar os termos. |
| (na lista de clientes) | Seleção múltipla e "atribuir titular" em lote (C12), com prévia do que muda. |
| `/backoffice?tab=departments` | Áreas, pessoas de cada área, indicador `ownsProspects` e a chave de escopo (admin). |
| `/backoffice/clients-import` | `POST` da planilha, corpo bruto, com a regra de origem e limite de corpo próprio. |

A aba de usuários passa a escolher a área de cada pessoa.

## 2. Servidor — módulo `clients`

**`domain/`** (puro):
- `client.ts`: tipos, `normalizeCnpj`, validação do dígito verificador, invariante C5.
- `scope.ts`: `ClientScope` e `scopeFor(user, { enabled, department })` → `{ kind: 'all' } | { kind: 'owner', userId, includeProspects: boolean }`. É a única função que decide o que o operador vê, usada por todos os casos de uso.
- `import-sheet.ts`: leitura das linhas (CNPJ, razão social, área, e-mail do titular), validação linha a linha, relatório (criados, alterados, rejeitados com motivo).

**`ports/`**: `ClientRepository`, `DepartmentRepository`, `PortalSettings`, `AuditRecorder`, `Clock`.

**`application/`**: `list-clients`, `get-client`, `save-client`, `transfer-client`, `assign-clients-batch` (modo `dryRun` e modo `commit`), `import-clients` (idem), `manage-departments`, `set-scope-switch`.

**`adapters/`**: Prisma para os repositórios e para a chave; leitor de planilha (ver Dependências).

**`composition.ts`**: liga tudo e exporta os casos prontos, como os demais módulos.

### Escopo nos módulos existentes

`adhesion`, `diagnosis`, `invitations` e `events` **não importam `clients`**. Cada um declara na sua `ports/` uma porta de escopo (`AdhesionVisibility`, `ResponseVisibility`, `InvitationVisibility`, `RegistrationVisibility`) que recebe o `ClientScope` já resolvido e o traduz em condição de consulta. `composition.ts` de cada um recebe o adaptador. Os filtros de listagem de cada módulo ganham o escopo; `list`, `counts`, `findById`, `listForExport` e as escritas passam por ele. No convite, a condição inclui `createdById = operador` (C8). O fluxo público (convite aberto pelo cliente, diagnóstico, adesão e inscrição enviados pelo próprio cliente) **não passa pelo escopo**: ele só vale para o backoffice. Em id fora do escopo, a resposta é "não encontrada", igual ao id inexistente, para não revelar a existência.

## 3. Dados

- `Department`: `id`, `name` (único), `ownsProspects` (padrão `false`).
- `User`: ganha `departmentId` opcional (`onDelete: SetNull`). Usuário sem área, com a chave ligada, não vê prospects e só vê os clientes em que é titular.
- `Client`: `id`, `cnpjDigits` (único), `legalName`, `departmentId`, `ownerId` opcional (`onDelete: SetNull`), `active`, `createdAt`, `updatedAt`. Índices em `ownerId` e `departmentId`.
- `PortalSetting`: `key` (chave primária), `value` (JSON). Uma única chave de uso inicial.
- Nenhuma chave estrangeira de `Response`, `Adhesion`, `Registration` ou `Invitation` para `Client`: a ligação é por `cnpjDigits`, na consulta. Dados anteriores à base continuam válidos.
- Nomes de tabela e coluna em inglês, no padrão do schema atual.

## 4. Capacidades

| Capacidade | Quem |
|---|---|
| `view_clients` | `admin`, `manager`, `operator` |
| `manage_clients` (criar, editar, importar, transferir, atribuir em lote) | `admin`, `manager` |
| `manage_departments` (áreas, pessoas por área, `ownsProspects`, chave de escopo) | `admin` |

`regularization` não ganha nenhuma. O operador lê a própria carteira e não edita cliente.

## 5. Importação

- Colunas: CNPJ, razão social, área, e-mail do titular (opcional). Upsert por CNPJ.
- Rejeita a linha, com motivo, quando: CNPJ inválido; área inexistente; titular inexistente, inativo ou de outra área; CNPJ repetido no arquivo.
- A resposta da primeira passada lista o que seria criado, alterado e rejeitado. A segunda só grava se não houver nenhuma linha rejeitada: corrige-se a planilha e reenvia. Não há gravação parcial.
- Registra uma entrada de auditoria com contagens, sem o conteúdo da planilha.
- **Dependência nova:** leitor de XLSX. Escolha no plano, com `pnpm audit` e comparação. O pacote `xlsx` do npm está parado na 0.18.5 com vulnerabilidades conhecidas e não deve entrar. CSV usa o parser que já existir no projeto, ou um mínimo próprio, se não houver.

## 6. Segurança

- A rota de importação segue o padrão de `/backoffice/event-images`: corpo bruto, `manage_clients`, `Origin` conferido, limite de corpo próprio (proposta: 2 MiB; as demais continuam em 256 KiB).
- Nada de planilha em disco nem em `localStorage`.
- A base de clientes fica só no Postgres, e a razão social e o CNPJ nunca vão em log.
- Recusa de acesso a cliente fora do escopo grava `access_denied`, como as demais.

## 7. Testes

- `domain`, Vitest puro: invariante C5 (inclusive no lote), dígito verificador, e uma bateria de `scopeFor` e da tradução em condição para todas as combinações de papel × chave × área × titularidade × prospect, com a exceção do convite criado pelo próprio operador.
- `application`: casos de uso com fakes das portas, incluindo o acesso por id fora do escopo.
- `adapters`: `*.int.test.ts` contra o Postgres (consultas filtradas por escopo, `onDelete`, unicidade).
- Componentes: lista e ficha, em `*.test.tsx`.
- E2E: com o `e2e-operator`, conferir que, com a chave ligada, ele não abre adesão, diagnóstico, convite nem inscrição de cliente alheio, nem por URL. E que o fluxo público continua funcionando com a chave ligada.

## 8. Fora do escopo

- Repositório de termos e leitura do comprovante (subprojeto 2).
- Escopo do conteúdo dos eventos (só as inscrições entram, C8).
- Papéis editáveis na tela e permissão por usuário.
- Carteira para o papel `regularization`.
- Histórico de carteira além do `AuditLog`.

## 9. Pontos para a sua revisão

1. **C2/C6 — em aberto:** "o dono do prospect é o comercial ou a consultoria" virou o indicador `ownsProspects` nas áreas. Falta a confirmação do Victor de que isso representa o que ele quer. Uma área nova de prospects é só marcar o indicador, sem código.
2. **C8 — decidido:** convites e inscrições entram no escopo.
3. **C9 — decidido:** manter a chave de virada e cadastrar os campos dela.
4. **Resto da spec — sem objeção.**
5. **Dependência:** o leitor de XLSX será escolhido no plano, com auditoria.
