# Papéis e permissões do backoffice

Decidido por Victor em 01/10/2026. Implementado no portal atual na mesma data e
escrito aqui para servir de entrada à Etapa 4 da reescrita — o backoffice na
stack nova —, para que a política não precise ser redecidida.

A fonte executável é `src/papeis.mjs`. Este documento explica o porquê; o
arquivo manda.

## O problema que isto resolve

Até 01/10/2026 havia dois papéis, `admin` e `equipe`, e **4 das 24 rotas** do
backoffice checavam papel — todas de gestão de usuários. As outras vinte
respondiam a qualquer pessoa autenticada:

- toda resposta de diagnóstico e o relatório de cada uma;
- toda adesão, com CNPJ, CPF, nome, e-mail e telefone do representante;
- as três planilhas (respostas, adesões, inscrições);
- a trilha de auditoria inteira.

O painel escondia abas, mas esconder botão não fecha rota: quem soubesse o
endereço alcançava.

## Os quatro papéis

| Identificador | Rótulo na tela | Em uma linha |
|---|---|---|
| `admin` | administrador | Tudo. O único que cria e altera usuários. |
| `gestor` | gestor de departamento | Tudo, menos abrir acesso para alguém. |
| `regularizacao` | regularização | Respostas e adesões, inclusive protocolar a opção e tirar a via do termo. |
| `operador` | operador | Respostas, convites, eventos e inscrições. Não alcança adesão. |

Identificadores sem acento e sem cedilha: vão para coluna de banco, para URL e
para comparação. O acento mora no rótulo, que é o que se lê.

## A matriz

| Capacidade | admin | gestor | regularização | operador |
|---|:--:|:--:|:--:|:--:|
| `painel` | ✓ | ✓ | ✓ | ✓ |
| `proprio_acesso` (trocar a própria senha) | ✓ | ✓ | ✓ | ✓ |
| `ver_respostas` | ✓ | ✓ | ✓ | ✓ |
| `tratar_respostas` | ✓ | ✓ | ✓ | ✓ |
| `exportar_respostas` | ✓ | ✓ | — | — |
| `ver_adesoes` | ✓ | ✓ | ✓ | — |
| `tratar_adesoes` | ✓ | ✓ | ✓ | — |
| `reimprimir_termo` | ✓ | ✓ | ✓ | — |
| `exportar_adesoes` | ✓ | ✓ | — | — |
| `ver_convites` | ✓ | ✓ | — | ✓ |
| `gerir_convites` | ✓ | ✓ | — | ✓ |
| `ver_eventos` | ✓ | ✓ | — | ✓ |
| `gerir_eventos` | ✓ | ✓ | — | ✓ |
| `tratar_inscricoes` | ✓ | ✓ | — | ✓ |
| `exportar_inscricoes` | ✓ | ✓ | — | — |
| `ver_auditoria` | ✓ | ✓ | — | — |
| `gerir_usuarios` | ✓ | — | — | — |

**Exportação e auditoria sobem para a chefia** por decisão expressa: planilha com
CPF e CNPJ é a maior superfície de vazamento do painel, e a trilha diz quem fez
o quê.

## Como foi construído, e o que replicar

Três escolhas que valem para qualquer stack:

**1. Portaria única, não checagem espalhada.** Uma tabela liga `MÉTODO caminho`
à capacidade exigida, e uma só checagem roda antes de qualquer rota. Com a regra
espalhada, proteger rota nova depende de alguém lembrar — foi assim que vinte
rotas ficaram sem checagem.

**2. Rota não declarada não responde.** Quem acrescenta endereço e esquece a
tabela leva 403, e um teste de cobertura cai antes, apontando o nome. Esquecer
passa a ser erro barulhento, não buraco silencioso.

**3. A tela não repete a regra.** O servidor manda a lista de capacidades de quem
entrou; o painel esconde o que não estiver nela. Regra em dois lugares é regra
que diverge. Esconder é conforto, não defesa — quem forjar a chamada esbarra na
portaria.

E uma recusa por papel **fica registrada na auditoria** (`acesso_negado`), com
papel, método e rota.

## Os testes, e o limite de um deles

- **Cobertura** — varre o próprio servidor atrás de rotas do backoffice e exige
  que cada uma esteja declarada. Tem barreira de completude: se a varredura não
  encontrar pelo menos 20 rotas, falha, porque varredura que não acha nada
  passaria verde por ausência.
- **Matriz** — 4 papéis × 24 rotas = 96 combinações, conferindo se o 403 aparece
  exatamente onde a tabela manda.
- **Asserções nomeadas** — uma por regra decidida ("operador não alcança
  adesão", "regularização não exporta a planilha de adesões", "gestor não cria
  usuário").

**O limite, provado por mutação:** dando `ver_adesoes` ao operador na tabela, a
matriz continua verde — ela compara o servidor com a mesma tabela que está sob
teste, e os dois lados se movem juntos. A matriz prova **obediência** à política
declarada; quem fixa a **política** são as asserções nomeadas. As duas camadas
são necessárias.

## Migração

`equipe` desceu para `operador`, que é o mais fechado — e **não** para `gestor`,
que seria manter o alcance de hoje. Rebaixar por engano se conserta em dois
cliques no painel; manter alcance por engano não aparece em lugar nenhum.

**Consequência operacional:** quem tratava adesão perde a área até ser promovido
a `regularizacao` ou `gestor`. É trabalho de minutos na aba Usuários, e precisa
ser feito logo depois da publicação.

## O que ficou de fora, e por quê

**Departamento não existe neste portal.** Victor optou por `gestor` = "tudo menos
criar usuário", o que não exige modelar departamentos. Se a reescrita precisar do
recorte por departamento — cada gestor enxergando só a sua área —, isso é
modelagem nova: cadastro de departamentos, vínculo do usuário a um, e a decisão
de qual área cada departamento alcança. Não foi feito, e não foi esquecido.
