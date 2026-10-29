# Arrastar, deslocar e fazer zoom no Gantt

Objetivo: utilizar a linha temporal com o rato: mover uma barra ou ajustar a sua duração, deslocar a linha temporal, selecionar tarefas com uma caixa e fazer zoom para dentro e para fora.

## Quando precisa disto

No Gantt vê que a alvenaria tem de começar dois dias mais tarde, ou que a betonagem demora mais um dia. Quer fazer essa alteração diretamente na barra. Ou tem um projeto de meses e quer deslocar-se rapidamente até ao feriado dos construtores. O rato tem alguns gestos para isso. O gesto que faz cada coisa depende de onde começa a arrastar e da sua definição de deslocação.

## Passos

### Mover uma barra

1. Prima o meio de uma barra de tarefa e arraste na horizontal. O início e o fim movem-se em conjunto, em dias inteiros; a duração mantém-se.
2. Solte o botão. A barra fica no novo lugar. O planeamento fica então desatualizado: prima *Calcular* (F5), ou deixe a aplicação fazê-lo se *Calcular automaticamente* estiver ativo.

Se a tarefa tiver uma predecessora, a aplicação regista o novo início como a restrição *Não começar antes de (SNET)* e indica-o depois de soltar. O motivo disso, e o que acontece com outra restrição, estão em [Restrições e prazos](docs://uitleg-constraints). Se arrastar de volta para o início original, a restrição original também volta.

Se arrastar sobretudo para cima ou para baixo, em vez de na horizontal, move a tarefa para outra linha e as datas mantêm-se. A direção que escolhe nos primeiros poucos pixels aplica-se a toda a operação de arrastar; por isso, um só gesto nunca altera as datas e a estrutura ao mesmo tempo. Veja [Ajustar a estrutura](docs://howto-structuur-aanpassen).

### Ajustar a duração

1. Mova o rato para a extremidade direita da barra. O cursor passa a ser uma seta que aponta para a esquerda e para a direita.
2. Arraste a extremidade. Enquanto arrasta, uma pequena pastilha na cor de destaque do tema (laranja por padrão) mostra a duração que a tarefa teria agora, por exemplo *4d*. Acompanha o movimento em tempo real, por isso vê a nova duração antes de soltar. Na extremidade direita, a pastilha fica dentro da barra; na extremidade esquerda, fica logo à esquerda dela. A pastilha mostra a duração da mesma forma que a coluna de duração.
3. Solte o botão. A duração é a que a pastilha mostrava.

A extremidade esquerda move o início e deixa o fim, por isso a tarefa fica mais curta ou mais longa do lado do início. A mesma regra SNET aplica-se tal como ao mover. Quando arrasta o meio da barra, a pastilha não aparece: a duração não muda.

A duração conta os dias úteis do calendário da tarefa. Fins de semana e dias de folga não contam, e uma tarefa em dias não pode ficar mais curta do que um dia útil. Para uma tarefa em horas, a aplicação arredonda ao passo da escala temporal sob o rato: no mínimo uma hora, ou um quarto de hora se ampliar o suficiente e *Mostrar quartos de hora ao ampliar bastante* estiver ativo.

Uma operação de arrastar é um passo em *Desfazer*, por mais tempo que arraste. Numa barra dividida, as extremidades funcionam de forma diferente; veja [Dividir uma tarefa](docs://howto-taak-splitsen).

### Deslocar a linha temporal

O que faz arrastar no fundo vazio depende do seu modo de deslocação. Escolha-o em *Definições da app*, separador *Aparência*, em *Gantt › Deslocação e zoom*, no campo *Modo*:

- **Zoom + arrastar** (padrão): se arrastar no fundo vazio com o botão esquerdo do rato, a linha temporal move-se com o rato, como num mapa. O cursor é uma mão. Numa barra, arrastar inicia simplesmente um gesto de barra.
- **Posição** e **Teclas**: o mesmo arrasto cria uma caixa de seleção. Desloca a linha temporal com a roda (veja [Definições da app](docs://ref-instellingen)) ou com o botão central do rato.

**O botão central do rato** (a roda premida) desloca a linha temporal em todos os modos, também se começar numa barra. Não funciona enquanto outro gesto estiver em curso, como arrastar uma barra.

### Selecionar tarefas com uma caixa

Uma caixa seleciona todas as tarefas nas linhas que toca. Só conta a altura da caixa, não a escala temporal.

1. Comece no fundo vazio. Com *Zoom + arrastar*, mantenha Ctrl (⌘ num Mac) premido enquanto o faz; com *Posição* e *Teclas* não é preciso.
2. Arraste sobre as linhas que quer selecionar. A seleção fica com uma moldura.
3. Solte o botão. Se premir Esc durante o arrasto, cancela a caixa; a seleção mantém-se como estava.

Mais sobre seleção está em [Selecionar, eliminar e desfazer tarefas](docs://howto-taken-selecteren-verwijderen). No espaço vazio na própria tabela de tarefas, arrastar não faz nada.

### Ampliar e reduzir

1. Utilize *Zoom +* e *Zoom -* (*Início › Zoom*), ou as teclas + e -. A roda também faz zoom. Quando isso acontece depende do seu modo de deslocação (veja [Definições da app](docs://ref-instellingen)).
2. Se quiser ver o projeto inteiro, escolha *Visualização › Escala temporal › Ajustar ao projeto* ou prima Ctrl+0. *Repor* (no separador *Visualização*) ou a tecla 0 repõe o zoom para o padrão.
3. No canto inferior direito da barra de estado está o zoom em pixels por dia, por exemplo *Zoom: 15px/dia*.

Quanto mais reduz o zoom, menos linhas da grelha há. A partir de 8 pixels por dia há uma linha por cada dia, com uma linha mais grossa na fronteira da semana. Entre 2 e 8 pixels por dia, só permanece a fronteira da semana. Abaixo de 2 pixels por dia, ao nível do ano, só ficam as fronteiras dos meses. Caso contrário, a área de desenho passaria a ser um padrão uniforme de riscas, em que as barras desapareciam. Os fins de semana e dias de folga a cinzento, e as bandas semanais com tom alternado, mantêm-se em todos os níveis; continuam a mostrar a estrutura semanal quando as linhas desaparecem. No cabeçalho da linha temporal, os números das semanas e dos dias só aparecem quando há espaço para eles. A partir de 40 pixels por dia, o dia da semana também aparece antes do número do dia.

O nome da tarefa aparece na barra se couber completamente. Se não couber, por exemplo ao reduzir o zoom, o nome completo aparece à direita da barra.

### Ver os detalhes de uma tarefa

Mantenha o rato parado sobre uma barra. Aparece um pequeno cartão com o nome da tarefa, *WBS*, *Duração*, *Início*, *Fim*, *Estado*, *Crítica* e *Folga total*. Durante um arrasto, uma deslocação da linha temporal, uma caixa de seleção ou um menu do botão direito, o cartão desaparece.

## Problemas comuns e o que a aplicação faz nesse caso

**O início não se move.** Se a tarefa tiver uma predecessora e uma restrição diferente de SNET, por exemplo *O mais tarde possível (ALAP)*, a aplicação não aplica o início arrastado. Depois de soltar, a aplicação indica qual restrição retém o início. Altere essa restrição para mover o início. A extremidade direita funciona, porque só altera a duração.

**O gesto faz outra coisa.** No modo de relação e no modo de divisão, os gestos na barra fazem outra coisa; Esc termina esses modos. Se mantiver Shift premido ao arrastar a partir de uma barra, cria uma relação em vez de mover uma barra. Veja [Adicionar relações](docs://howto-relaties-leggen).

**No modo Posição ou Teclas, o botão esquerdo do rato não desloca a linha temporal.** Vê então um cursor normal em vez de uma mão. Utilize a roda ou o botão central do rato, ou defina o modo para *Zoom + arrastar*.

**Um clique numa pausa de uma barra dividida** seleciona a tarefa e não inicia arrasto nem caixa.

## Ver também

- [Menus de clique com o botão direito](docs://ref-contextmenus): os menus de uma barra, de uma linha e de um cabeçalho de grupo.
- [Atalhos de teclado](docs://ref-sneltoetsen): as teclas para fazer zoom e para cancelar um gesto.
- [Definições da app](docs://ref-instellingen): o modo de deslocação e a escala temporal.
- [Restrições e prazos](docs://uitleg-constraints): porque é que um início movido passa a ser uma restrição.
