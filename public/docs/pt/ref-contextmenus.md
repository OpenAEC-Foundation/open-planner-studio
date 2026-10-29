# Menus de clique com o botão direito

Que menus abre o botão direito do rato no Gantt e na tabela de tarefas, o que faz cada item e a que tarefas se aplica. Os itens que também existem como botão ou atalho estão em [O friso, separador a separador](docs://ref-lint) e [Atalhos de teclado](docs://ref-sneltoetsen).

## Que menu em cada local

Há quatro menus. Qual deles aparece depende de onde clica:

- **Numa barra de tarefa no Gantt** — o menu da tarefa, com *Iniciar relação a partir daqui* no topo.
- **Numa tarefa na tabela de tarefas** — o mesmo menu da tarefa, sem esse item no topo. Isto vale para a tabela de tarefas à esquerda do Gantt e para o separador *Tabela*.
- **Num cabeçalho de grupo na tabela de tarefas** — um pequeno menu para expandir e recolher grupos. Os cabeçalhos de grupo só aparecem quando agrupa, por exemplo com o layout *Diagrama de recursos*.
- **Num espaço vazio** — no Gantt, ao lado ou abaixo das barras, e na tabela de tarefas abaixo da última tarefa ou na linha cinzenta *Nova tarefa*. O menu tem *Nova tarefa*, *Adicionar marco* e *Colar*; no Gantt também *Repor zoom* e *Ajustar ao projeto*. Uma nova tarefa ou um novo marco vai para o fim da lista. No Gantt começa na data em que clicou; na tabela de tarefas a célula do nome abre logo, para poder escrever.

Na linha de um cabeçalho de grupo no Gantt, o botão direito do rato abre o menu de espaço vazio; o próprio cabeçalho de grupo tem um menu só na tabela de tarefas. Um clique com o botão direito no cabeçalho da escala de tempo não faz nada. Os cabeçalhos das colunas da tabela de tarefas têm um menu próprio, descrito em [Ajustar colunas da tabela](docs://howto-tabelkolommen-aanpassen).

**A que tarefas se aplica um item?** Clica numa tarefa, mas a seleção define o âmbito. Se a tarefa em que clica faz parte da seleção, o item aplica-se à seleção inteira. Se não fizer parte, aplica-se só a essa tarefa. Com um clique com o botão direito numa barra no Gantt ou numa linha da tabela de tarefas, essa tarefa substitui a seleção se não fazia parte dela. Cada item que altera algo é um passo em *Desfazer*, também para uma seleção inteira.

## O menu da tarefa

Os itens estão nesta ordem. Uma linha entre grupos é um separador no menu.

**Iniciar relação a partir daqui** — só no Gantt, numa barra. Ativa o modo de relação com esta tarefa selecionada; depois arrasta até à sucessora. Veja [Adicionar relações](docs://howto-relaties-leggen).

***Remover a interrupção*** e ***Remover todas as interrupções*** — só no Gantt, numa barra com interrupções. *Remover a interrupção* só aparece se clicar numa interrupção ou no trecho depois dela, e se a interrupção for editável; remove essa interrupção. *Remover todas as interrupções* remove todas, incluindo as interrupções de um ficheiro de origem que não pode editar. Veja [Dividir uma tarefa](docs://howto-taak-splitsen).

***Editar...*** — abre a janela *Editar tarefa* para esta tarefa. Veja [Janela da tarefa e painel de propriedades](docs://ref-taak-eigenschappen).

***Inserir acima*** e ***Inserir abaixo*** — insere uma nova tarefa acima da tarefa mais alta ou abaixo da mais baixa do âmbito, ao mesmo nível. Só funciona na vista de árvore pura, sem filtro, agrupamento ou ordenação; caso contrário, a aplicação recusa com uma mensagem. Veja [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen).

***Adicionar subtarefa*** — adiciona uma nova tarefa como subtarefa da tarefa em que clicou, no fim das suas subtarefas. Só para essa tarefa, não para a seleção inteira.

***Adicionar marco*** — adiciona um marco como subtarefa da tarefa em que clicou. Só para essa tarefa.

***Adicionar relação*** — faz o mesmo que *Iniciar relação a partir daqui*: ativa o modo de relação com esta tarefa selecionada. Na tabela de tarefas o item fica desativado se o Gantt não estiver visível, com a dica *Disponível apenas quando o gráfico de Gantt está visível*.

**Avançar** e **Diminuir indentação** — move as tarefas do âmbito um nível mais fundo ou um nível mais alto na WBS. Estes dois só existem na vista de árvore pura. Veja [Ajustar a estrutura](docs://howto-structuur-aanpassen).

**Alternar marco** — transforma a tarefa em marco, ou volta atrás. O novo estado segue a tarefa em que clicou e aplica-se ao âmbito inteiro: se essa for uma tarefa, todas as tarefas do âmbito passam a marcos. Uma tarefa de resumo e uma tarefa com atribuições não passam a marco; o resto do âmbito passa, e aparece uma mensagem por cada motivo.

**Atribuir calendário ▸** — um submenu com *Calendário do projeto* (a tarefa fica então sem calendário próprio) e, por baixo, os calendários disponíveis. A escolha atual tem uma marca de verificação. Uma tarefa que já está nesse calendário não conta e não cria um passo extra em *Desfazer*. Veja [Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen).

**Progresso ▸** — um submenu com 0%, 25%, 50%, 75% e 100%. O valor atual tem uma marca de verificação. Uma tarefa de resumo não tem progresso próprio: se houver uma no âmbito, as suas tarefas-folha recebem a percentagem. Sem data de estado, a aplicação define a data de hoje, com uma mensagem. Uma tarefa planeada para começar só depois da data de estado, e que ainda não tem início real, leva primeiro a uma pergunta sobre o início real; se cancelar, nada muda. Veja [Atualizar o progresso](docs://howto-voortgang-bijwerken).

**Prioridade ▸** — um submenu com *Baixa* (100), *Normal* (500) e *Alta* (900), a prioridade de nivelamento da tarefa. O valor atual tem uma marca de verificação. Veja [Nivelamento de recursos](docs://uitleg-nivelleren).

**Rastrear caminho** — mostra as predecessoras e as sucessoras desta tarefa. Se o rastreamento já estiver ativo, o item chama-se *Parar rastreamento*. Veja [Rastrear um caminho](docs://howto-pad-traceren).

***Recolher***, ***Expandir*** e ***Guardar ramo como modelo*** — só para uma tarefa de resumo. *Recolher* e *Expandir* aparecem sempre os dois, mesmo que a tarefa já esteja recolhida ou expandida, e aplicam-se ao âmbito inteiro. *Guardar ramo como modelo* guarda a tarefa com as suas subtarefas e as relações entre elas como modelo de WBS. Veja [Guardar e inserir modelos de WBS](docs://howto-wbs-sjablonen).

**Eliminar** — elimina as tarefas do âmbito, com as respetivas subtarefas. Não há confirmação; recupera-as com Ctrl+Z, num único passo para o âmbito inteiro. Veja [Selecionar, eliminar e desfazer tarefas](docs://howto-taken-selecteren-verwijderen).

## O menu de um cabeçalho de grupo

Este menu só existe na tabela de tarefas, num cabeçalho de grupo:

**Recolher grupo** ou **Expandir grupo** — recolhe ou expande só este grupo. O item mostra o que pode fazer.

**Expandir tudo** e **Recolher tudo** — expandem ou recolhem todos os grupos de uma vez.

Configura o agrupamento com um layout. Veja [Criar e usar um layout](docs://howto-layouts-gebruiken).

## Ver também

- [Arrastar, deslocar e ampliar no Gantt](docs://howto-gantt-bedienen): o que faz arrastar com os botões esquerdo e do meio do rato.
- [O friso, separador a separador](docs://ref-lint): os botões que têm as mesmas ações.
- [Atalhos de teclado](docs://ref-sneltoetsen): as teclas que correspondem a estas ações.
