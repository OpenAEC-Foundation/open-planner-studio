# Ajustar a estrutura

Objetivo: organizar tarefas em fases e subtarefas, alterar a ordem e manter corretos os números WBS.

## Quando precisa disto

O seu planeamento é uma árvore: fases (tarefas de resumo) com subtarefas por baixo delas, como *Foundation* com *Groundwork*, *Reinforcement* e *Pouring*. Ajusta essa árvore quando pretende colocar tarefas debaixo de uma fase, tirar uma tarefa de uma fase, ou quando a ordem está errada. O **código WBS** (1, 1.1, 1.2, 2, …) é o número de uma tarefa nessa árvore.

## Passos

### Avançar uma tarefa

1. Selecione a tarefa. Selecionar várias tarefas é possível.
2. Escolha *Planeamento › Estrutura › Avançar*. Também pode usar Alt+→ (ou Alt+Shift+→), ou *Indentar* no menu de contexto.

A tarefa passa a ser a última subtarefa da tarefa anterior ao mesmo nível. Essa tarefa passa a ser, em consequência, uma tarefa de resumo. Se selecionar um bloco contíguo, o bloco avança como um todo. Se a tarefa não tiver tarefa anterior ao mesmo nível, nada acontece e não aparece mensagem.

### Diminuir a indentação de uma tarefa

Escolha *Planeamento › Estrutura › Recuar*, prima Alt+← (ou Alt+Shift+←) ou escolha *Diminuir indentação* no menu de contexto.

A tarefa passa a estar no mesmo nível, imediatamente a seguir à fase em que estava. As subtarefas dela seguem com ela. As tarefas que vinham depois dela nessa fase continuam nela. Uma tarefa ao nível mais alto não pode diminuir mais a indentação.

### Mover uma tarefa

Tem três maneiras.

- **Com o teclado.** Alt+↑ e Alt+↓ trocam a tarefa com a tarefa vizinha ao mesmo nível. Uma tarefa de resumo leva as suas subtarefas consigo. No início ou no fim do nível não acontece nada. Com várias tarefas selecionadas, só se move a tarefa em que clicou primeiro.
- **Arrastar na tabela de tarefas.** Prima uma linha e arraste na vertical. O quarto superior de uma linha significa *antes*, o quarto inferior significa *após*. O meio de uma tarefa de resumo coloca a tarefa debaixo dela como última subtarefa. O meio de uma tarefa normal conta como a extremidade mais próxima. Se arrastar uma linha que faz parte de uma seleção múltipla, move-se toda a seleção.
- **Arrastar no Gantt.** Arraste a barra na vertical para outra linha. Funciona como arrastar na tabela de tarefas e não altera datas. Se arrastar na horizontal, desloca as datas.

Cada movimento conta como um só passo de *Desfazer* (Ctrl+Z).

### Manter os números WBS atualizados

Veja o botão *WBS auto* em *Planeamento › Estrutura*.

- **Ligado (o padrão num projeto novo).** Também fica ligado depois de abrir um ficheiro sem esta definição, se todos os códigos WBS já corresponderem à numeração da árvore (1, 1.1, 1.2 …). Os códigos não mudam. Um ficheiro vazio sem esta definição também fica com o valor *sim*, tal como um projeto novo. A aplicação renumera a árvore inteira a cada adição, remoção e movimento. O código WBS fica então só de leitura: não o pode escrever na tabela de tarefas nem no painel *Propriedades*. *Renumerar WBS* fica desativado.
- **Desligado.** É o padrão num ficheiro com códigos próprios, como *A1000*, ou com um código que difere da árvore. Os códigos ficam como estão, também depois de mover e de avançar. Escreva-os manualmente, na coluna *WBS* ou no campo *Código WBS* em *Propriedades*, ou renumere-os uma vez com *Renumerar WBS*. Isto também substitui os códigos que escreveu.

Se ligar *WBS auto*, a aplicação numera logo a árvore. Pode anular, com *Desfazer*, tanto *WBS auto* como *Renumerar WBS*.

## Armadilhas e o que a aplicação faz

**Filtragem, agrupamento ou ordenação estão ativos.** A ordem que vê não é então a ordem do planeamento, por isso a aplicação bloqueia a estrutura. *Indentar* e *Diminuir indentação* ficam desativados, com a dica *Não disponível durante a filtragem/agrupamento/ordenação*. Alt+→ e arrastar mostram o mesmo texto numa linha de aviso vermelha, com o botão *Limpar*. Isto remove de uma vez o filtro, o agrupamento e a ordenação, e Ctrl+Z não os repõe. A linha de aviso fica até clicar na cruz, usar Ctrl+Z ou Ctrl+Y, ou mudar para outro documento. Nesse caso, *Indentar* e *Diminuir indentação* não aparecem no menu de contexto.

Alt+↑ e Alt+↓ funcionam nessa vista, sem mensagem. Só com um filtro vê a nova ordem de imediato. Com uma ordenação, a ordem no planeamento muda, mas só a vê depois de *Limpar*.

**WBS auto está desligado.** Isto acontece com um ficheiro que tem códigos próprios, ou com um ficheiro que guarda a definição com o valor *não*. Uma tarefa nova recebe o código que corresponde ao seu lugar na árvore, mesmo que outra tarefa já tenha esse código. Assim podem aparecer números duplicados. Também depois de avançar, os códigos deixam de corresponder à árvore. *Renumerar WBS* corrige as duas situações.

**Um marco recebe subtarefas.** Um marco é um momento e não tem subtarefas. A aplicação remove a marcação de marco e mostra uma mensagem.

**Uma tarefa com atribuições de recursos recebe subtarefas.** Uma tarefa de resumo não tem atribuições próprias. Por isso, a aplicação pergunta primeiro o que fazer com elas, na janela *A tarefa torna-se uma tarefa de resumo*. Isto acontece ao avançar, ao usar *Adicionar subtarefa* ou *Adicionar marco* numa tarefa, ao inserir um modelo, e em *Editar tarefa* quando escolhe uma nova *Tarefa pai*: para uma tarefa existente e para uma tarefa nova. Em *Editar tarefa* a pergunta surge antes de guardar. Se escolher *Cancelar* aí, *Editar tarefa* continua aberta com as suas alterações. Escolhe:

- *Cancelar*: nada muda, a estrutura também fica como estava.
- *Remova a atribuição*: a tarefa recebe as subtarefas e as atribuições são removidas. O trabalho real dessas atribuições também é removido.
- *Mover para '…'*: as atribuições passam para a primeira subtarefa nova que as pode ter, com o trabalho real. Um marco ou uma tarefa de resumo não tem atribuições.

Se essa subtarefa já tiver o mesmo recurso, ou se não existir nenhuma subtarefa adequada, *Mover* fica desativado. Um bloco laranja na janela diz porquê.

Se uma atribuição já tiver trabalho real, o bloco laranja indica quantas horas por recurso, por exemplo *A atribuição de Metselaar já tem 8 horas de trabalho real. Removê-la elimina esse trabalho.* *Cancelar* é então o botão predefinido: Enter não muda nada. Se ainda quiser remover a atribuição, clique em *Remova a atribuição* por si mesmo.

Enquanto a janela estiver aberta, nenhum atalho fora dela funciona, incluindo *Desfazer*, *Colar*, Delete, F5 e Ctrl+S. Se uma ação criar mais tarefas de resumo de uma vez, a janela mostra os recursos por tarefa, e a sua escolha aplica-se a todas. Um *Desfazer* (Ctrl+Z) anula a ação inteira.

**Uma relação criaria um ciclo.** As relações de uma tarefa de resumo aplicam-se também às suas subtarefas. Se um movimento criar, por isso, um ciclo, a aplicação recusa-o e mostra a mensagem *Este movimento criaria um ciclo no planeamento (…)*. Nada muda.

**Uma relação entre uma tarefa e a sua própria fase.** Se colocar uma tarefa debaixo de uma fase com a qual já tem uma relação, essa relação mantém-se, mas deixa de contar no cálculo. A aplicação mostra uma mensagem. Pode ler mais sobre relações em tarefas de resumo em [Relações e desfasamento](docs://uitleg-relaties).

**O planeamento deixa de estar atualizado.** Um movimento para outra fase pode alterar datas. Prima **Calcular** (F5). Só trocar a ordem dentro da mesma fase não altera as datas.

## Ver também

- [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen): coloque as tarefas novas no lugar certo.
- [Guardar e inserir modelos WBS](docs://howto-wbs-sjablonen): reutilize uma fase inteira.
- [Adicionar relações](docs://howto-relaties-leggen): vincule tarefas entre si.
- [Selecionar, eliminar e anular tarefas](docs://howto-taken-selecteren-verwijderen): anule um movimento.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): quatro fases com as respetivas subtarefas, tal como se constroem ao avançar tarefas.
