# Adicionar tarefas e marcos

Objetivo: colocar uma nova tarefa ou um novo marco no seu planeamento, no sítio onde pertence.

## Quando precisa disto

Está a construir um planeamento, está a acrescentar trabalho ou quer registar um momento, como uma entrega ou uma inspeção.

Uma **tarefa** é uma unidade de trabalho que demora tempo. Uma nova tarefa dura 5 dias úteis por padrão (com o planeamento por horas, o padrão do projeto pode ser horas). Um **marco** é um momento sem duração: 0 dias. Uma tarefa com subtarefas chama-se **tarefa de resumo**; na construção, muitas vezes é uma fase. A duração e as datas dela decorrem das subtarefas assim que usar **Calcular** (F5).

## Passos

### Adicionar uma tarefa

1. Escolha *Início › Tarefas › Tarefa*. O mesmo botão está no separador *Tabela*.
2. O painel *Propriedades* abre-se e o campo *Nome* fica selecionado. Escreva o nome e prima Enter.

A nova tarefa tem primeiro o nome *Nova tarefa* e começa no início do projeto.

Se uma tarefa estiver selecionada, a nova tarefa fica logo abaixo dela, ao mesmo nível. Se a tarefa selecionada for uma tarefa de resumo, a nova tarefa fica abaixo de toda essa fase, portanto depois das subtarefas. Se nada estiver selecionado, fica no fim da lista. A dica do botão indica qual das duas situações vai acontecer: *Nova tarefa logo abaixo da seleção* ou *Nova tarefa no fim da lista*. Se selecionar várias tarefas, cria-se uma só nova tarefa, abaixo da mais baixa da seleção, tal como a vê no ecrã.

### Rapidamente, uma a uma, na tabela de tarefas

Abaixo da última tarefa da tabela de tarefas há sempre uma linha cinzenta *Nova tarefa*. Ainda não é uma tarefa: não está no Gantt nem no ficheiro.

1. Clique numa célula dessa linha, ou vá até lá com a seta para baixo.
2. Escreva o nome e prima Enter. Agora é uma tarefa real, ao mesmo nível da tarefa acima. O cursor fica logo na nova linha cinzenta abaixo.
3. Escreva o nome seguinte, e assim por diante.

Se preencher só uma duração ou uma data na linha cinzenta, a tarefa fica com o nome *Nova tarefa*. Se sair sem preencher nada, não acontece nada: nenhuma tarefa e nenhum passo em *Desfazer*. Criar a tarefa e o primeiro valor são, juntos, um só passo em *Desfazer*. A linha cinzenta só aparece quando a tabela de tarefas não está filtrada, agrupada nem ordenada.

### Com o botão direito num espaço vazio

Clique com o botão direito num espaço vazio: na tabela de tarefas, abaixo da última tarefa, ou no Gantt, ao lado ou abaixo das barras. Escolha *Nova tarefa* ou *Adicionar marco*. A nova tarefa fica no fim da lista. No Gantt começa na data onde clicou. Na tabela de tarefas, a célula do nome abre logo, para poder escrever.

### Acima ou abaixo de uma tarefa específica

Clique com o botão direito na tarefa e escolha *Inserir acima* ou *Inserir abaixo*. O teclado também funciona: Insert adiciona acima da tarefa selecionada, Ctrl+I (⌘+I num Mac) abaixo dela. Na tabela de tarefas, a célula do nome abre logo a seguir a Insert, pronta para escrever.

Com várias tarefas selecionadas, cria-se uma só nova tarefa: *Inserir acima* põe-na acima da tarefa selecionada mais alta, *Inserir abaixo* abaixo da mais baixa.

### Adicionar uma subtarefa

Clique com o botão direito na tarefa e escolha *Adicionar subtarefa*. A nova tarefa fica no fim das subtarefas dessa tarefa. Na tabela de tarefas, ao lado do Gantt, uma tarefa de resumo também tem um pequeno **+** depois do nome, que faz o mesmo.

### Adicionar um marco

1. Escolha *Início › Tarefas › Marco ▾* e depois *Marco de início*, *Marco de fim* ou *Ponto de inspeção (obrigatório)*.
2. Escreva o nome e prima Enter. A posição segue a mesma regra que para *Tarefa*.

Os três tipos diferem assim:

- Um *Marco de início* fica no início do dia, um *Marco de fim* no fim do dia. No Gantt, o losango fica à esquerda ou à direita da faixa do dia, respetivamente. Isto também importa para a sucessora. Suponha que um marco está na terça-feira, 29 de setembro de 2026, e que uma tarefa o segue com uma relação fim-início: depois de um marco de início, essa tarefa começa nessa mesma terça-feira; depois de um marco de fim, começa na quarta-feira, 30 de setembro.
- Um *Ponto de inspeção (obrigatório)* é um marco de fim com a categoria de trabalho *Inspecção* e a marca *Obrigatório (contratual)*.

### Transformar uma tarefa existente num marco

Clique com o botão direito na tarefa e escolha *Alternar marco*, ou marque *Marco* no painel *Propriedades*. O item de menu funciona para toda a seleção. A duração passa a 0.

Se o desligar outra vez, continua a ser uma tarefa normal com duração 0: introduza a duração.

### Outras formas

- Ctrl+M (⌘+M num Mac) põe um novo marco no fim da lista, mesmo que haja uma tarefa selecionada. O painel *Propriedades* não se abre.
- Um marco que criar com Ctrl+M ou pelo menu do botão direito recebe a categoria de trabalho *Inspecção*. Um *Marco de início* ou *Marco de fim* a partir de *Marco ▾* recebe *Outro*. Se precisar, altere a categoria de trabalho no painel *Propriedades*.
- *Adicionar marco* no menu do botão direito de uma tarefa cria o marco como subtarefa dessa tarefa, e não ao mesmo nível.

### Copiar uma tarefa ou um ramo inteiro

1. No Gantt, clique na barra da tarefa. Selecione mais tarefas com Ctrl+clique.
2. Prima Ctrl+C (⌘+C num Mac). A aplicação copia a tarefa com todas as suas subtarefas, as relações entre as tarefas copiadas e as respetivas atribuições de recursos.
3. Se quiser, clique na barra da tarefa junto à qual a cópia deve ficar, e prima Ctrl+V (⌘+V).

A cópia tem o mesmo nome, as mesmas datas e o mesmo progresso. Fica ao mesmo nível da tarefa selecionada (com várias: a que clicou primeiro), no fim das tarefas desse mesmo nível. Se nada estiver selecionado, fica no fim da lista. Depois, as tarefas copiadas ficam selecionadas, os códigos WBS (o número de cada tarefa na árvore, como 1.2; ver [Ajustar a estrutura](docs://howto-structuur-aanpassen)) são determinados de novo e o planeamento fica desatualizado.

A área de transferência é partilhada por toda a aplicação, por isso também pode colar noutro documento. O que lá não existir, como um calendário de tarefa, uma categoria de trabalho personalizada, um código de atividade ou um campo personalizado, a aplicação remove e avisa-o.

### Depois

Uma nova tarefa ainda não altera as outras datas. A barra de estado indica *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*.

## Armadilhas e o que a aplicação faz

**Cada nova tarefa começa no início do projeto.** Sem relações, uma tarefa não espera por nada. Adicione relações, veja [Adicionar relações](docs://howto-relaties-leggen).

**A filtragem, o agrupamento ou a ordenação estão ativados.** A ordem que vê então não é a ordem do planeamento. Com uma tarefa selecionada, *Tarefa* e *Marco ▾* adicionam a nova tarefa no fim, e aparece uma notificação vermelha: *A nova tarefa foi adicionada no fim. Durante a filtragem, o agrupamento ou a ordenação, a aplicação não a pode colocar abaixo da sua seleção.* *Inserir acima* e *Inserir abaixo* são recusados, com a faixa *Não disponível durante a filtragem/agrupamento/ordenação*. O botão *Limpar* na notificação ou na faixa remove de uma só vez o filtro, o agrupamento e a ordenação. Isto não faz parte de *Desfazer*: Ctrl+Z não os repõe.

**Uma subtarefa sob uma tarefa com atribuições de recursos.** A tarefa passa a ser uma tarefa de resumo, e uma tarefa de resumo não tem atribuições próprias. A aplicação move as atribuições para a nova subtarefa e avisa-o. Se isso não for possível, por exemplo porque escolheu *Adicionar marco* e um marco não pode ter atribuições, a aplicação não adiciona nada e explica porquê.

**Uma subtarefa sob um marco.** O marco passa a ser uma tarefa de resumo e a aplicação remove a marca de marco, com uma mensagem.

**Marco ativado para uma tarefa de resumo ou para uma tarefa com atribuições.** A aplicação recusa e explica porquê. Com atribuições: remova-as primeiro.

**Copiar na tabela de tarefas.** Na tabela de tarefas (e no separador *Tabela*), Ctrl+C copia apenas os valores das células selecionadas, como numa folha de cálculo, e Ctrl+V cola nas células. Copiar tarefas só funciona se usar o Gantt: clique primeiro numa barra.

## Ver também

- [Ajustar a estrutura](docs://howto-structuur-aanpassen): avançar e mover tarefas e manter os números WBS atualizados.
- [Adicionar relações](docs://howto-relaties-leggen): vincular tarefas entre si.
- [Selecionar, eliminar e anular tarefas](docs://howto-taken-selecteren-verwijderen): retirar uma tarefa outra vez.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que a aplicação calcula quando existem relações.
- [Janela de tarefa e painel de propriedades](docs://ref-taak-eigenschappen): todos os campos de uma tarefa.
- [Novo projeto e Info do projeto](docs://ref-projectinfo): começar com um modelo de fases.
- [Menus do botão direito](docs://ref-contextmenus): todos os itens do menu de uma tarefa.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): um pequeno projeto de exemplo (*Ficheiro › Exemplos*) com quatro fases, um marco de início e um marco de entrega obrigatório.
