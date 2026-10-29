# Adicionar relações

Objetivo: vincular tarefas, para que uma tarefa só comece quando o trabalho anterior estiver concluído, e acrescentar, onde for preciso, um tempo de espera (desfasamento) entre elas.

## Quando precisa disto

Sem relações, a aplicação não sabe que o pedreiro só pode começar depois de a fundação estar betonada. Cada tarefa começa então no início do projeto, e a data de fim não significa nada. Uma **relação** regista essa ordem. A primeira tarefa é a **predecessora**, a segunda é a **sucessora**.

Pode adicionar relações ao criar um planeamento, quando se acrescenta uma tarefa, ou quando duas tarefas afinal dependem uma da outra. Um **desfasamento** é um tempo de espera entre duas tarefas, como o betão que tem de curar ou a betonilha do piso que tem de secar.

A relação padrão é **FS** (Fim-Início): a sucessora só pode começar depois de a predecessora estar concluída. A aplicação também conhece SS, FF e SF, que ligam um início ou um fim a um início ou a um fim; com SS (Início-Início), por exemplo, o reboco só pode começar depois de as instalações técnicas terem começado.

Não sabe de que tipo precisa? Por baixo da escolha do tipo, uma frase com os nomes reais das tarefas explica-o, por exemplo *Metselwerk só começa depois que Fundering termina*. Escolha outro tipo e a frase muda com ele. Pode vê-la na janela *Tipo de relação*, no bloco *Dependências* e na coluna *Predecessoras* ou *Sucessoras*.

## Passos

Há quatro formas de adicionar uma relação. Todas criam a mesma relação; escolha a que melhor se adapta à sua situação.

### Vincular duas tarefas selecionadas

Útil quando trabalha na tabela de tarefas.

1. Na tabela de tarefas, clique na tarefa que vem primeiro: a predecessora.
2. Mantenha Ctrl (⌘ num Mac) premido e clique na tarefa seguinte: a sucessora.
3. Escolha *Início › Tarefas › Ligação ▾ › Ligar tarefas selecionadas*. O mesmo botão está também em *Planeamento › Relações*.

A aplicação cria uma relação fim-início sem desfasamento. Vê-a como uma seta no Gantt e na coluna *Predecessoras*; só aparece uma notificação se a aplicação recusar a relação. O botão só funciona com exatamente duas tarefas selecionadas.

### Desenhar uma relação no Gantt

Útil quando adiciona muitas relações seguidas.

1. Escolha *Início › Tarefas › Ligação ▾ › Desenhar relação*. Acima do gráfico Gantt aparece o aviso *Modo de ligação: arraste de uma barra para outra no Gantt para criar uma relação. Esc para sair*.
2. Prima a barra da predecessora e arraste até à barra da sucessora. Uma linha tracejada com uma seta segue o cursor.
3. Largue. Aparece uma pequena janela *Tipo de relação*, com o tipo (FS por padrão) e uma caixa para o desfasamento.
4. Se necessário, altere o tipo ou o desfasamento e prima Enter, ou clique fora da janela. A relação fica criada.
5. Adicione logo a seguinte: o modo continua ativo. Pode parar com Esc, com o botão *Sair* no aviso, ou escolhendo outra vez *Desenhar relação*.

Se premir Esc na janela *Tipo de relação*, nada é registado. Para uma única relação, não é preciso ativar o modo: mantenha Shift premido ao arrastar de barra para barra. *Iniciar relação a partir daqui*, no menu do botão direito de uma barra, ativa o modo de ligação; continua a ser preciso arrastar. No separador *Tabela*, sem Gantt, *Desenhar relação* fica desativado.

### Adicionar uma relação no painel de propriedades

Útil quando está a ver uma tarefa e quer adicionar as suas predecessoras ou sucessoras.

1. Selecione a tarefa. O painel *Propriedades* fica à direita; se não o vir, ative-o com *Visualização › Painéis › Propriedades*.
2. No bloco *Dependências*, clique em *Adicionar relação*.
3. Deixe a direção em *Predecessora* se a outra tarefa vier primeiro, ou escolha *Sucessora*.
4. Escreva parte do nome da outra tarefa. Escolha a correta com as setas e Enter, ou clique nela.
5. Escolha o tipo (FS por padrão) e, se necessário, preencha um desfasamento.
6. Prima Enter ou clique no visto (*Criar relação*).

As relações da tarefa ficam então listadas em *Dependências*, cada uma com o número WBS da outra tarefa, o tipo e o desfasamento.

### Escrever relações na coluna Predecessoras

Útil quando trabalha depressa com o teclado e conhece os números WBS.

1. Clique no **+** à direita do cabeçalho da tabela de tarefas (*Adicionar coluna*) e, em *Relações*, escolha a coluna *Predecessoras*. A coluna *Sucessoras* funciona da mesma maneira.
2. Na coluna *Predecessoras*, clique na célula da sucessora.
3. Escreva o número WBS da predecessora, um espaço e o tipo, por exemplo `2.6 FS`. Escreva o desfasamento logo a seguir: `2.6 FS+1d`. Separe várias predecessoras com ponto e vírgula ou vírgula: `3.1 FS; 3.2 SS+2d`.
4. Prima Enter.

O que escrever substitui a célula inteira. Se já houver predecessoras nela, escreva-as também (veja as armadilhas). Se premir Enter ou F2 na célula, em vez de escrever, abre-se um campo que mantém as relações existentes: procura uma tarefa pelo número WBS ou pelo nome, e escolhe o tipo e o desfasamento de cada relação.

### Definir ou alterar um desfasamento

Pode escrever o desfasamento na caixa ao lado do tipo, em cada uma das formas acima. Pode alterar um desfasamento existente em *Dependências*: clique na caixa do desfasamento, escreva o novo valor e prima Enter.

- `3` ou `3d`: 3 dias úteis. O fim de semana não conta. A aplicação mostra `+3d`.
- `3ed`: 3 dias de calendário. O fim de semana conta, como no betão que também cura no sábado e no domingo.
- `-1`: um desfasamento negativo (avanço). A sucessora pode começar um dia antes, por isso as tarefas se sobrepõem.
- `4h`: 4 horas de trabalho; a aplicação mostra-o como `+4u`. Se a predecessora for uma tarefa em dias num calendário sem faixas de tempo de trabalho próprias, como o calendário padrão, a aplicação converte isto em dias úteis inteiros, arredondados para o dia inteiro mais próximo: `4h` passa então a valer 1 dia, `2h` vale 0. Num calendário com faixas de tempo de trabalho próprias, ou depois de uma tarefa horária, o desfasamento conta exatamente em horas.
- `50%`: metade da duração da predecessora.

Exemplo: o betão da fundação tem de curar antes de o pedreiro poder trabalhar nele, por isso *Pour foundation → Foundation brickwork* recebe uma relação FS com desfasamento `3`. Se a betonagem for na sexta-feira, 18 de junho de 2027, a alvenaria começa depois de **Calcular** na quinta-feira, 24 de junho: de segunda a quarta-feira é tempo de espera. Com `3ed`, o fim de semana conta e a alvenaria começa na terça-feira, 22 de junho.

### Por fim: recalcular

Uma relação nova ainda não move nenhuma barra; a barra de estado mostra *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*. Só então as sucessoras recebem as novas datas. Se quiser que a aplicação faça isto por si, ative *Calcular automaticamente* em *Definições › Projeto › Definições da aplicação*, separador *Planeamento*.

## Armadilhas e o que a aplicação faz

**Ordem invertida.** Com *Ligar tarefas selecionadas*, conta a ordem em que clica, não a ordem da lista. Se clicar primeiro na tarefa posterior, a relação fica ao contrário. Elimine-a em *Dependências* com o ícone do lixo e adicione-a outra vez.

**Escrever na coluna apaga o que lá estava.** Se a célula tiver `3.4 FS; 3.2 FS` e escrever só `3.2 FS`, a relação com 3.4 desaparece, sem mensagem. Escreva todas as predecessoras, use Enter ou F2 para acrescentar, ou desfaça com Ctrl+Z.

**Um ciclo.** Se adicionar uma relação que volta a uma tarefa anterior na cadeia, o planeamento nunca poderia começar. A aplicação recusa essa relação: *Esta relação criaria um ciclo no planeamento (…) e não foi criada*, com as tarefas do ciclo entre parênteses. Elimine primeiro a relação que fecha o ciclo.

**Uma tarefa e a sua própria fase.** Não é possível uma relação entre uma tarefa e a tarefa de resumo a que pertence. A aplicação diz *Não é permitida uma relação entre uma tarefa e a sua própria tarefa de resumo ancestral*.

**Relação duplicada.** Se a relação já existir, a aplicação diz *Essa relação já existe* e nada muda.

**Mensagens mais curtas na coluna.** A coluna *Predecessoras* dá as mesmas recusas, com um texto mais curto debaixo da célula: *Esta alteração criaria um ciclo no planeamento*, *Esta relação já existe* ou *Uma tarefa não pode ter uma relação com a sua própria tarefa de resumo*. Se escrever só um número WBS, como `3.1`, falta o tipo e a célula mostra *Use, por exemplo, 1.2 FS+2d*. A célula fica aberta; corrija a entrada ou prima Esc para cancelar.

**Sem meios dias de desfasamento.** Um desfasamento em dias é sempre um número inteiro: `1.5` passa a `+2d`. Um desfasamento em horas depois de uma tarefa em dias, num calendário sem faixas de tempo de trabalho próprias, é arredondado a dias úteis inteiros. Uma entrada ilegível, como uma palavra, não é guardada: a caixa volta ao valor anterior.

## Veja também

- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que a aplicação calcula a partir das suas relações, e porque é que uma tarefa fica crítica.
- [Relações e desfasamento](docs://uitleg-relaties): o que os quatro tipos de relação e um desfasamento fazem às datas.
- [Rastrear um caminho](docs://howto-pad-traceren): mostrar a cadeia de predecessoras e sucessoras.
- [Janela de tarefa e painel de propriedades](docs://ref-taak-eigenschappen): os campos de relações e desfasamento no painel e na janela.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): uma cadeia de relações fim-início, com uma início-início (paredes e telhado, desfasamento de 2 dias) e uma fim-fim (azulejos e pintura, desfasamento de 1 dia).
