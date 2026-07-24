# Códigos & campos (diálogo de estrutura)

A janela **Códigos e campos** gere as definições da estrutura do projeto: **códigos de atividade** (dimensões livremente definíveis, como Localização ou Disciplina) e **campos personalizados** (campos de utilizador tipados). Os valores por tarefa são depois preenchidos através do painel de propriedades ou do [diálogo de tarefa](docs://ref-taakdialoog).

## Abrir

**Planeamento** → grupo do friso **Estrutura** → **Códigos e campos**. **Esc**, a cruz de fecho ou um clique fora da janela fecha-a. Todas as alterações têm efeito imediato (e podem ser desfeitas com Ctrl+Z) — não há um botão de guardar separado.

## Códigos de atividade

"Dimensões definíveis livremente (ex. Localização, Disciplina) para agrupar e filtrar — no máximo um valor por tipo por tarefa."

Um bloco por tipo de código:

- **Nome do tipo de código** — editável diretamente.
- **Remover tipo de código** (caixote do lixo) — remove o tipo, incluindo todos os valores e as atribuições nas tarefas.
- Uma linha por valor: **Código** (rótulo curto), **Descrição** e um seletor de **Cor** (colore os agrupamentos, entre outras coisas), mais um botão de remover.
- **Adicionar valor** — novo valor sob este tipo.

No fundo: campo de introdução **Novo tipo de código (ex. Localização)** + botão **Adicionar tipo de código** (Enter também funciona).

## Campos personalizados

"Campos de utilizador tipados, visíveis como colunas na tabela e editáveis por tarefa."

Uma linha por campo: o **nome** (editável diretamente), o **tipo** (só de leitura após a criação) e um botão de remover.

No fundo: campo de introdução **Novo campo (ex. Empreiteiro)**, um seletor de tipo — **Texto**, **Número**, **Número inteiro**, **Custo**, **Data** ou **Sim/não** — e o botão **Adicionar campo** (Enter também funciona). O tipo não pode ser alterado após a criação; crie um novo campo se necessário.

## Onde aparecem as definições

- Como a secção de entrada **Códigos e campos** por tarefa no painel de propriedades e no diálogo de tarefa.
- Como colunas na vista de tabela (campos personalizados) e como dimensão de agrupamento/filtro (códigos de atividade).

## Leitura adicional

- [Planeamento & WBS](docs://gids-plannen-wbs) — estruturar um cronograma, incluindo códigos e campos na prática.
