# Planeamento & WBS

Um cronograma começa com uma estrutura de tarefas: que tarefas existem, como se dividem em fases, e que momentos são suficientemente importantes para merecer um marco? Este guia aprofunda essa base mais do que o guia [Início rápido](docs://quick-start) — aqui vai aprender não só *como* indentar, mas também o que uma tarefa de resumo realmente faz, como os três tipos de marco diferem, como dar às tarefas os seus próprios códigos e campos, e como manter notas por tarefa.

## O que vai aprender aqui

- Construir uma estrutura de tarefas (WBS) usando indentação e tarefas de resumo.
- Mover tarefas dentro do mesmo nível, sem reindentar — com o teclado, arrastando, ou no separador
  **Tabela**, ao estilo de uma folha de cálculo.
- Os três tipos de marco e o indicador obrigatório separado para momentos contratuais.
- Gerir códigos de atividade e campos personalizados através da janela **Códigos e campos**, e agrupar por eles.
- Usar notas (uma lista de verificação por tarefa) para acompanhar itens em aberto.

Prefere seguir com um exemplo completo? Abra [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) através de **Ficheiro → Exemplos** — o faseamento "1. Voorbereiding" (Preparação) / "2. Fundering & ruwbouw" (Fundação & obra em bruto) / "3. Afbouw" (Acabamento) / "4. Oplevering" (Entrega) com as suas subtarefas é exatamente a estrutura explicada abaixo.

## Construir uma estrutura de tarefas

Uma lista plana de tarefas não diz nada sobre como se relacionam. Ao indentar uma tarefa sob outra tarefa, constrói uma estrutura em árvore (WBS — Work Breakdown Structure): a tarefa pai torna-se então automaticamente uma **tarefa de resumo**.

1. Selecione a tarefa que quer colocar mais fundo na estrutura.
2. Prima **Alt+→** para indentar. Há um segundo atalho para a mesma ação: **Alt+Shift+→** — útil se a sua disposição de teclado já usar Alt+→ para outra coisa. Ambos fazem exatamente o mesmo.
3. Prefere trabalhar com o rato? Clique com o botão direito na tarefa e escolha **Indentar** no menu de contexto.
4. Foi um nível longe demais? **Alt+←** (ou clique com o botão direito → **Diminuir indentação**) move a tarefa de volta um nível.
5. Para uma subtarefa completamente nova há uma via mais rápida: clique com o botão direito na tarefa pai e escolha **Adicionar subtarefa**. Isso cria uma nova tarefa, já indentada, num só passo, em vez de adicionar primeiro uma tarefa e depois indentá-la separadamente.

Assim que uma tarefa tem pelo menos uma subtarefa, torna-se automaticamente uma tarefa de resumo: a sua barra no diagrama de Gantt passa a abranger todo o período desde o início mais cedo até ao fim mais tarde de todas as subtarefas abaixo dela, e a sua própria duração e datas deixam de poder ser definidas de forma independente. Uma tarefa de resumo é, por isso, sempre um valor derivado, nunca um cronograma que introduz diretamente — elimine ou desloque as subtarefas, e a barra da tarefa de resumo ajusta-se automaticamente.

**Recolher e expandir.** Com uma WBS grande, por vezes vai querer compactar a árvore temporariamente. O separador do friso **Visualização**, grupo **Estrutura**, tem dois botões separados para isto — **Recolher** e **Expandir** — deliberadamente não um único alternador, porque com uma seleção mista (alguns ramos abertos, outros fechados) um alternador nunca poderia definir tudo da mesma forma.

- **Com uma seleção**, os botões atuam sobre as tarefas selecionadas; só as tarefas com subtarefas são afetadas, as tarefas isoladas são ignoradas.
- **Sem seleção**, atuam sobre todo o cronograma. Retire a seleção com **Esc**, ou clique numa área vazia da vista de Gantt.
- Numa vista agrupada (ver *Agrupar por códigos e campos* mais abaixo) os botões recolhem/expandem as faixas de grupo — incluindo faixas aninhadas — em vez das tarefas.

A seta à frente de uma tarefa de resumo continua a funcionar como antes, para abrir ou fechar apenas esse ramo.

### Inserir uma nova tarefa no sítio certo

As tarefas novas já não têm de ficar no fim. Todos os botões e teclas que criam uma tarefa seguem a mesma regra:

- **Se houver uma tarefa selecionada**, a nova tarefa fica diretamente **por baixo** dela, e não no fim de toda a lista. Herda o nível e a tarefa superior da sua seleção, por isso uma tarefa nova dentro de uma fase mantém-se nessa fase.
- **Se não houver nada selecionado**, vai para o fim, como sempre.
- **Se estiverem várias tarefas selecionadas**, fica por baixo da tarefa **mais abaixo** da sua seleção tal como a vê no ecrã — nunca no meio da seleção, e a ordem por que as clicou não interessa.

Isto aplica-se ao botão **Tarefa** e ao menu **Marco** no grupo do friso **Tarefas**, e também a **Nova tarefa** no menu de contexto. Esse grupo está tanto no separador **Início** como no separador **Tabela**, com os mesmos três botões (**Tarefa**, **Marco**, **Ligação**), pelo que já não tem de mudar de separador para introduzir tarefas.

Com o teclado é ainda mais rápido:

- **Insert** insere uma tarefa **acima** da seleção.
- **Ctrl+I** (**Cmd+I** no macOS) insere uma tarefa **abaixo** da seleção — normalmente é para aí que quer ir enquanto percorre uma lista.

Ambos aparecem também no resumo de atalhos (**Ctrl+/**), na categoria **Estrutura**.

**Apenas na vista em árvore normal.** Inserir acima ou abaixo é uma intervenção estrutural e só faz sentido enquanto a ordem apresentada for também a ordem real. Com um filtro, uma ordenação ou um agrupamento ativo, a nova tarefa apareceria noutro sítio que não aquele onde a colocou. A aplicação recusa então a inserção acima/abaixo e mostra uma faixa que explica porquê, com um botão para limpar filtro, ordenação e agrupamento num só clique. Os botões **Tarefa** e **Marco** continuam a funcionar, mas colocam a tarefa no fim — com a mesma explicação.

### Mover tarefas sem reindentar

Além de alterar o nível de uma tarefa (indentar/diminuir indentação), pode também trocar a posição de uma tarefa dentro do mesmo nível, sem alterar a própria estrutura:

- **Alt+↑** move a tarefa selecionada para cima, acima da tarefa que está atualmente acima dela.
- **Alt+↓** move a tarefa para baixo.

Isto funciona em qualquer nível da árvore: mova uma tarefa de fase, e todas as suas subtarefas movem-se automaticamente com ela.

Prefere o rato? Agarre uma tarefa pela sua linha na tabela de tarefas (a coluna do lado esquerdo da vista de Gantt, com o mesmo comportamento de arrastar no separador do friso **Tabela**) e arraste-a para cima ou para baixo. Largue-a entre duas linhas para a reordenar entre as suas irmãs, tal como Alt+↑/↓. Em vez disso, largue-a na parte inferior da linha de uma tarefa de resumo, e ela aninha-se: a tarefa torna-se a nova última subtarefa dessa tarefa de resumo, reindentando-a num só movimento — é o equivalente em rato de Alt+→. Selecione primeiro várias tarefas (Ctrl/Cmd-clique, ou uma seleção por caixa) e toda a seleção é arrastada e largada em conjunto.

O separador do friso **Tabela** mostra esta mesma estrutura como uma grelha simples e editável, útil quando está a introduzir ou a corrigir muitas tarefas de uma vez: um único clique em qualquer célula editável inicia imediatamente a edição com o valor existente selecionado, as teclas de seta movem um cursor de célula sem a abrir, **F2**/**Enter** abre a célula atual para edição, e **Tab**/**Shift+Tab** passa para a célula seguinte/anterior, continuando na linha de tarefa seguinte/anterior. A indentação continua em **Alt+→**/**Alt+←**. Chegar a **Enter** ou **↓** na última linha cria ali mesmo uma nova tarefa irmã com o cursor já na sua célula de nome, para que possa manter uma lista inteira em andamento sem tocar no rato — isto só funciona na vista em árvore normal, já que um filtro, uma ordenação ou um agrupamento ativo poderiam fazer a nova tarefa cair diretamente fora de vista, por isso a aplicação pergunta primeiro em vez de colocar em silêncio uma tarefa que não consegue ver.

## Tipos de marco

Um marco é uma tarefa sem duração que assinala um momento — um início, uma entrega, uma inspeção. O Open Planner Studio tem três formas de adicionar um marco, todas através do grupo do friso **Tarefas**, usando a seta ao lado do botão **Marco**:

- **Marco de início** — assinala o início de uma fase ou do projeto.
- **Marco de fim** — assinala uma conclusão, por exemplo uma entrega.
- **Ponto de inspeção (obrigatório)** — na prática, um marco de fim com o indicador **Obrigatório (contratual)** já assinalado e o seu Tipo definido diretamente como **Inspeção**, de modo que um momento de inspeção é reconhecível desde o início como contratualmente obrigatório e como uma inspeção.

Prefere o atalho **Ctrl+M**? Isso dá-lhe um marco genérico ("Novo marco") que depois renomeia e tipifica você mesmo.

Verá esta mesma divisão no painel de propriedades assim que selecionar um marco com a caixa de verificação **Marco** ativada: o campo **Tipo de marco** oferece **Automático**, **Marco de início** ou **Marco de fim**. "Automático" deixa o motor de planeamento decidir como o marco se comporta com base nas suas relações — escolha isto se o marco não tiver um caráter de início ou fim pronunciado. Separadamente, há a caixa de verificação **Obrigatório (contratual)**: essa assinala um marco como vinculativo contratualmente, independentemente de ser um marco de início ou de fim. Assim pode, por exemplo, tornar também um marco de início obrigatório, ou — como acontece com **Ponto de inspeção** — configurar um marco de fim obrigatório com um só clique.

## Códigos e campos: códigos de atividade e campos personalizados

Cronogramas maiores rapidamente precisam de dimensões extra que não cabem na WBS: qual unidade, qual disciplina, qual empreiteiro. É para isso que servem os **códigos de atividade** e os **campos personalizados**, ambos geridos através da janela **Códigos e campos** (o grupo do friso **Estrutura** no separador **Planeamento**, botão rotulado **Códigos e campos**).

- **Códigos de atividade** são dimensões livremente definíveis (por exemplo "Localização" ou "Disciplina") com uma lista de valores — cada valor tem um **Código**, uma **Descrição** e uma **Cor**. Uma tarefa pode ter no máximo um valor por tipo de código. Use **Adicionar tipo de código** para iniciar uma nova dimensão, e **Adicionar valor** para construir os valores possíveis.
- **Campos personalizados** são campos próprios tipados — **Texto**, **Número**, **Número inteiro**, **Custo**, **Data** ou **Sim/não** — que aparecem como coluna na tabela de tarefas e podem ser preenchidos por tarefa. Pense num campo "Empreiteiro" (texto) ou "Licença recebida" (sim/não).

Uma vez criados, atribui um código de atividade ou preenche um campo personalizado através das colunas na tabela de tarefas (torne-as visíveis primeiro através de **Visualização → Colunas…**, se necessário) ou através do painel de propriedades da tarefa.

### Agrupar por códigos e campos

Os códigos de atividade e os campos personalizados compensam mesmo quando os agrupa: vá ao separador do friso **Visualização**, abra **Agrupar** e escolha o código de atividade ou campo personalizado a agrupar em **Campo**. A tabela de tarefas mostra então cabeçalhos de grupo em vez da árvore WBS — útil para ver, por exemplo, todas as tarefas por unidade ou por disciplina juntas, ao longo do faseamento. Pode configurar até dois níveis de agrupamento ao mesmo tempo (por exemplo primeiro por unidade, depois por disciplina).

## Notas: uma lista de verificação por tarefa

Toda a tarefa tem uma secção **Notas** no painel de propriedades — essencialmente uma pequena lista de verificação que fica associada à tarefa. Isto destina-se ao tipo de itens de ação soltos que não cabem numa data de cronograma: "ainda preciso de verificar com o empreiteiro", "ainda preciso de encomendar material", "à espera do desenho v2".

1. Clique em **+ Adicionar nota**. Aparece uma nova linha vazia com o foco no campo de texto.
2. Escreva o texto da nota.
3. Assinale a caixa de verificação assim que o item estiver tratado — o texto fica então riscado, mas a nota permanece visível (marcada como concluída em vez de eliminada), para que o histórico de uma tarefa permaneça legível.
4. Use o ícone de caixote do lixo para remover uma nota definitivamente.

As notas são puramente informativas: não afetam o cronograma nem o cálculo, por isso são a ferramenta certa para observações que não podem ser expressas como uma data ou duração. Veja uma mistura de notas em aberto e concluídas na prática no exemplo de dimensão média "Nieuwbouw 6 Rijwoningen De Akkers" (etiqueta *aantekeningen*/notas em **Ficheiro → Exemplos**).

## Continue a ler

- Veja esta estrutura — faseamento, tarefas de resumo, marcos — na prática em [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Agora que a estrutura está pronta, o próximo passo é ligar as tarefas entre si: leia o guia [Relações & restrições](docs://gids-relaties-constraints).
- Ainda é novo no Open Planner Studio? Comece com o guia [Início rápido](docs://quick-start) para um exercício contínuo desde um projeto vazio até um cronograma calculado.
