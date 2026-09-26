# Escolher colunas

A janela **Colunas** controla quais as colunas que o separador Tabela mostra, em que ordem e com que largura. (A tabela de tarefas à esquerda do Gantt tem colunas fixas: WBS, Nome da tarefa e Duração.)

## Abrir

**Visualização** → grupo do friso **Apresentação** → **Colunas…**. Cada alteração é aplicada imediatamente — não há um passo de OK separado; **Fechar**, **Esc**, a cruz de fecho ou um clique fora da janela fecha-a.

## Colunas escolhidas

Uma linha por coluna, com:

- **Pega de arrastar** — arraste a linha para alterar a ordem das colunas.
- **Visível** — desmarcar oculta a coluna sem a remover da lista.
- **Nome** — o rótulo do campo tal como a tabela o mostra.
- **Largura** — em píxeis (mínimo 40).

## Campos disponíveis

Abaixo das colunas escolhidas está a lista **Campos disponíveis**: todos os campos que ainda não são uma coluna. Clicar num adiciona-o como coluna. Além dos campos padrão, encontra os campos de análise **Marco**, **Folga livre**, **Folga interferente**, **Quase crítica** e **Caminho de folga**, mais **Recursos** e os códigos de atividade e campos personalizados do projeto. Os três campos de folga e o Caminho de folga só recebem valores após um cálculo com as opções de agendamento correspondentes — veja [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse).

## Repor predefinição

**Repor predefinição** fica no fundo do seletor de colunas (o sinal de mais à direita do cabeçalho da tabela, ou o separador **Tabela** → **Colunas…**). Um clique repõe as colunas dessa tabela na disposição predefinida: que colunas são mostradas, a sua ordem e largura, e as colunas fixadas. Os campos adicionados a mais saem da tabela e continuam disponíveis na lista. É também assim que obtém a nova disposição predefinida após uma atualização, por exemplo **Início** e **Fim** em vez de **Início planeado** e **Fim planeado**: uma disposição própria guardada antes não muda por si só. É uma única ação, por isso **Ctrl+Z** repõe a sua própria disposição. Se a tabela já usa a disposição predefinida, o botão fica desativado.

O conjunto de colunas faz parte de um layout guardado — veja [Guardar e carregar layouts](docs://ref-layouts).

## Leitura adicional

- [Filtros](docs://ref-filters) — quais tarefas a tabela e o Gantt mostram.
