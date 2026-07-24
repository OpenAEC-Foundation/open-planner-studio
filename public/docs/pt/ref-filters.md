# Filtros

A janela **Filtro** controla quais tarefas estão visíveis — no Gantt e no separador Tabela. Um filtro consiste em regras (campo + operador + valor), opcionalmente agrupadas em grupos.

## Abrir

**Visualização** → grupo do friso **Apresentação** → **Filtro…**. O botão mantém-se destacado enquanto um filtro está ativo. **Esc**, a cruz de fecho ou um clique fora da janela fecha sem aplicar.

## Grupos: todas ou qualquer uma

No topo de cada grupo escolhe como as suas regras se combinam:

- **Todas as seguintes (AND)** — uma tarefa tem de corresponder a todas as regras.
- **Qualquer uma das seguintes (OR)** — corresponder a uma regra é suficiente.

**+ regra** adiciona uma regra; **+ grupo** (apenas no nível superior) adiciona um grupo aninhado, para poder combinar AND e OR — por exemplo "Crítica é sim AND (Tipo é Construção OR Tipo é Instalação)". Sem regras, a janela mostra: "Ainda sem regras — este filtro corresponde a tudo."

## Uma regra: campo, operador, valor

- **Campo** — todos os campos de tarefa: WBS, Nome da tarefa, Duração, Início, Fim, Tipo, Crítica, Folga total, Progresso, Marco, Folga livre, Folga interferente, Quase crítica, Caminho de folga e Recursos, mais os códigos de atividade e campos personalizados do projeto.
- **Operador** — adapta-se ao tipo de campo:
- texto: **é igual a**, **é diferente de**, **contém**, **começa por**, **está vazio**;
- número e data: adicionalmente **menor que**, **menor ou igual a**, **maior que**, **maior ou igual a** e **entre** (com **De**/**Até**);
- campos sim/não (como Crítica e Marco): uma escolha **Sim**/**Não**;
- campos de escolha (como Tipo ou um código de atividade): **é um de**, com valores marcáveis.
- **Valor** — a introdução segue o tipo de campo (caixa de texto, número, data ou seletor); **está vazio** não tem introdução de valor.

O ícone de caixote do lixo atrás de uma regra remove essa regra; a cruz no canto superior direito de um grupo aninhado remove o grupo inteiro.

## Aplicar, cancelar e limpar

- **Aplicar** ativa o filtro e fecha a janela. Um filtro sem regras conta como "sem filtro".
- **Cancelar** fecha sem aplicar as alterações.
- **Limpar** desliga imediatamente o filtro ativo e esvazia o editor.

Um filtro ativo faz parte de um layout guardado — veja [Guardar e carregar layouts](docs://ref-layouts).

## Leitura adicional

- [Escolher colunas](docs://ref-kolommen) — quais colunas a tabela mostra.
