# Planeamento & WBS

Um cronograma começa com uma estrutura de tarefas: que tarefas existem, como se dividem em fases, e que momentos são suficientemente importantes para merecer um marco? Este guia aprofunda essa base mais do que o guia [Início rápido](docs://quick-start) — aqui vai aprender não só *como* indentar, mas também o que uma tarefa de resumo realmente faz, como os três tipos de marco diferem, como dar às tarefas os seus próprios códigos e campos, e como manter notas por tarefa.

## O que vai aprender aqui

- Construir uma estrutura de tarefas (WBS) usando indentação e tarefas de resumo.
- Mover tarefas dentro do mesmo nível, sem reindentar.
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

### Mover tarefas sem reindentar

Além de alterar o nível de uma tarefa (indentar/diminuir indentação), pode também trocar a posição de uma tarefa dentro do mesmo nível, sem alterar a própria estrutura:

- **Alt+↑** move a tarefa selecionada para cima, acima da tarefa que está atualmente acima dela.
- **Alt+↓** move a tarefa para baixo.

Isto funciona em qualquer nível da árvore: mova uma tarefa de fase, e todas as suas subtarefas movem-se automaticamente com ela.

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
