# Códigos e campos personalizados

Objetivo: atribua às suas tarefas as suas próprias classificações (códigos de atividade, como *Localização*) e os seus próprios campos (como *Empreiteiro*).

## Quando precisa disto

Para além dos dados fixos de uma tarefa (nome, duração, relações, …), pode acrescentar dados seus. Se quiser classificar tarefas por ala norte e ala sul, por disciplina, ou controlar qual o empreiteiro que executa uma tarefa, registe-o manualmente. Existem duas formas, e a diferença é importante.

Um **código de atividade** é uma classificação com uma lista de escolha fixa. Crie um **tipo de código** (por exemplo *Localização*) com **valores** (*N* para a ala norte, *Z* para a ala sul). Uma tarefa recebe no máximo um valor por tipo de código.

Um **campo personalizado** (em *Campos personalizados* na janela) é um campo de introdução livre com um tipo: *Texto*, *Número*, *Número inteiro*, *Custo*, *Data* ou *Sim/não*. O campo pode ter um valor diferente em cada tarefa.

## Passos

### Definir códigos e campos

1. Escolha *Planeamento › Estrutura › Códigos e campos*.
2. **Criar um tipo de código.** Em *Novo tipo de código (ex. Localização)* escreva o nome e prima Enter, ou clique em *Adicionar tipo de código*.
3. **Adicionar valores.** Por baixo do tipo de código, clique em *Adicionar valor*. A aplicação coloca aí um código provisório, como *V1*. Altere-o na caixa *Código* (curto, como o escreveria: *N*), preencha, se necessário, a *Descrição* (*Ala norte*) e escolha uma *Cor*. Uma alteração fica aplicada assim que sair da caixa ou premir Enter.
4. **Criar um campo personalizado.** Em *Novo campo (ex. Empreiteiro)* escreva o nome, escolha o tipo e clique em *Adicionar campo* (ou prima Enter).

A janela não tem botão OK: cada alteração se aplica de imediato. Depois não pode alterar o tipo de um campo, apenas o nome. Se quiser outro tipo, crie um novo campo.

### Preencher um código ou um campo numa tarefa

Tem dois locais.

- **No painel *Propriedades*** (ou na janela que abre com F2). Em baixo está o bloco *Códigos e campos*: uma lista de escolha por tipo de código, uma entrada por campo. O bloco só aparece quando existe pelo menos um tipo de código ou campo.
- **Como coluna da tabela de tarefas.** Clique no **+** à direita do cabeçalho da tabela (*Adicionar coluna*) e, em *Personalizado*, escolha o tipo de código ou o campo. Numa célula de tipo de código, pode escrever o código, por exemplo `N`, ou escolhê-lo da lista. Um código que não existe mostra *Escolha um valor deste código de atividade*.

### Utilizar os códigos e campos

Pode usar um tipo de código ou um campo personalizado para filtrar, agrupar e ordenar. Para isso, configure um layout: *Visualização › Layout › Novo layout*. Na janela, marque as partes que quer incluir no layout. Com *Guardar* obtém um botão em *Visualização › Layout* em que pode clicar mais tarde; com *Aplicar sem guardar* só o coloca no ecrã agora. Ao agrupar, as tarefas sem valor ficam em *(nenhum)*.

Para a cor das barras, escolha *Visualização › Linhas de base e progresso › Cores das barras*, depois *Por categoria* e o tipo de código. Cada barra fica então com a *Cor* do seu valor.

## Armadilhas e o que a aplicação faz

**Apagar remove os valores das tarefas.** Se apagar um tipo de código, um valor ou um campo com o ícone do caixote do lixo, a aplicação não pede confirmação, e os valores atribuídos em todas as tarefas desaparecem com ele. Um agrupamento ou uma ordenação por esse tipo de código ou campo também deixa de estar aplicado. *Desfazer* (Ctrl+Z, feche primeiro a janela) repõe o tipo de código, o valor ou o campo e os valores preenchidos, mas não o agrupamento nem a ordenação: volte a configurá-los.

**Dois valores com o mesmo código.** *Adicionar valor* continua a numeração a partir do número de valores que existem. Se apagar um e adicionar outro, um código pode, por isso, aparecer duas vezes. Se escrever esse código numa célula de coluna, a aplicação recusa com a mensagem *Este valor do código de atividade ocorre mais do que uma vez. Escolha-o na lista*. Dê a cada valor o seu próprio código.

**Os modelos não transferem códigos nem campos.** Veja [Guardar e inserir modelos de WBS](docs://howto-wbs-sjablonen). Se colar tarefas noutro documento, a aplicação limpa os códigos e campos que aí não existem e avisa-o.

**Um campo de data não acompanha o movimento.** Se mover o projeto inteiro, os campos personalizados preenchidos do tipo *Data* mantêm a sua data. A aplicação avisa disto na pré-visualização.

## Ver também

- [Ajustar a estrutura](docs://howto-structuur-aanpassen): a árvore WBS, a outra forma de organizar tarefas.
- [Mover um projeto](docs://howto-project-verplaatsen): o que acontece às datas quando move o projeto.
- [Criar e usar um layout](docs://howto-layouts-gebruiken): agrupar e filtrar por um código ou campo personalizado.
- [Ajustar colunas da tabela](docs://howto-tabelkolommen-aanpassen): mostrar um código ou campo personalizado como coluna.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): os códigos de atividade *House* e *Discipline*, o campo personalizado *Cost estimate* e notas (abertas e concluídas).
