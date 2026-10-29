# Atalhos de teclado

Todas as combinações de teclas da aplicação, agrupadas como na janela *Atalhos de teclado*. As teclas são fixas: não as pode alterar. Como trabalhar com o rato e os menus está nos guias práticos; aqui consulta uma tecla.

## Como ler esta lista

**Mac.** Onde este artigo diz Ctrl, use Cmd (⌘) num Mac. Alt é Option (⌥). Num Mac, a janela *Atalhos de teclado* mostra os símbolos ⌥, ⇧ e ⌘ em vez de Alt, Shift e Ctrl. Ctrl também funciona na aplicação num Mac.

**Combinação exata.** A aplicação compara Ctrl, Shift e Alt com exatidão. Por isso, Ctrl+Alt+S não faz nada: as teclas têm de corresponder exatamente à lista.

**Abrir a janela.** Prima Ctrl+/ ou escolha *Definições › Atalhos de teclado › Atalhos de teclado*. Ctrl+/ também volta a fechar a janela. A janela só serve para consultar. Não mostra todas as teclas indicadas aqui: das teclas da tabela, só as primeiras seis entradas, e não as teclas dos diálogos no fim deste artigo.

**Quando uma tecla não funciona.** Cada entrada indica as suas restrições. Três regras aplicam-se quase em todo o lado:

- Num campo de entrada, numa lista pendente ou numa caixa de texto, a aplicação não intercepta as teclas, por isso pode simplesmente escrever. Exceções: F5, Ctrl+S, F11 e Esc durante a apresentação também funcionam num campo. Se o foco estiver numa lista pendente fechada, as teclas com Ctrl também funcionam, por exemplo Ctrl+Z depois de uma escolha (não Ctrl+Delete e Ctrl+Backspace). Isso não vale numa lista aberta nem num diálogo. Na versão final da aplicação (ambiente de trabalho e a versão web no site), isso também vale para Ctrl+Shift+S, Ctrl+O e Ctrl+N.
- Enquanto um diálogo ou outra janela estiver aberta, as teclas marcadas abaixo com *Não num diálogo* não funcionam. Isso também vale para a visita guiada, o diálogo de boas-vindas e as perguntas que esperam resposta, como a pergunta se deve guardar as alterações e a autorização ao instalar uma extensão. A maioria destas teclas também não funciona no modo de apresentação. Exceção: as teclas de edição Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y e Delete/Backspace funcionam durante a apresentação.
- A mudança de documento (Ctrl+1 a 9, Ctrl+N, Ctrl+O) também não funciona enquanto *Ficheiro › Definições do projeto* tiver alterações que ainda não confirmou com *Aplicar*. Descarte-as ou aplique-as primeiro.

## Ficheiro

**F5** — *Calcular*: recalcula o planeamento, como o botão *Calcular* (*Início › Agendamento › Calcular*). Também funciona num campo de entrada.

**Ctrl+S** — *Guardar*: guarda o projeto. Também funciona num campo de entrada.

**Ctrl+Shift+S** — *Guardar como*: pede onde o ficheiro deve ser guardado. Numa versão de desenvolvimento não funciona num campo de entrada.

**Ctrl+O** — *Abrir*: abre um ficheiro, normalmente num separador novo. Não num diálogo e não com alterações por aplicar nas definições do projeto.

**Ctrl+N** — *Novo projeto*: abre a janela *Novo projeto*. Não num diálogo e não com alterações por aplicar nas definições do projeto.

A versão final da aplicação (ambiente de trabalho e a versão web no site) também bloqueia algumas teclas do navegador, para que não atrapalhem: Ctrl+R e Ctrl+Shift+R (recarregar), F12, Ctrl+Shift+I e Ctrl+Shift+J (ferramentas de programador), Ctrl+U (ver código-fonte) e Ctrl+G, Ctrl+F e Ctrl+L (procurar e barra de endereços). Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N e F5 são enviadas para a própria aplicação.

## Editar

**Ctrl+C** — *Copiar*: copia as tarefas selecionadas. Só com uma seleção. Não num diálogo. Não em *Ficheiro*, não nos separadores *Relatório* e *IFC* e não enquanto o painel de recursos completo estiver aberto. Na tabela de tarefas, Ctrl+C copia as células selecionadas; a própria tabela trata disso.

**Ctrl+V** — *Colar*: cola as tarefas copiadas. Não num diálogo. Não em *Ficheiro*, não nos separadores *Relatório* e *IFC* e não enquanto o painel de recursos completo estiver aberto, porque a tabela de tarefas não está visível aí. Na tabela de tarefas cola as células.

**Ctrl+Z** — *Desfazer*. Não num diálogo: feche primeiro a janela.

**Ctrl+Y** ou **Ctrl+Shift+Z** — *Refazer*: repete o que desfez. Não num diálogo.

**Delete** ou **Backspace** — *Eliminar*: elimina as tarefas selecionadas. Só com uma seleção. Não num diálogo. Não em *Ficheiro*, não nos separadores *Relatório* e *IFC* e não enquanto o painel de recursos completo estiver aberto, porque a tabela de tarefas não está visível aí. Numa célula da tabela de tarefas, Delete e Backspace só limpam o conteúdo da célula (veja *Tabela*).

**F2** — *Editar...*: abre o diálogo da tarefa para a primeira tarefa selecionada. Só com uma seleção. Não num diálogo. Numa célula da tabela de tarefas, F2 inicia a edição da célula.

**Ctrl+A** — *Selecionar tudo*: seleciona todas as tarefas. Não num diálogo.

**Esc** — *Limpar seleção*: limpa a seleção e ao mesmo tempo desliga o modo de relação, o modo de divisão e o rastreamento de caminho, e fecha o diálogo da tarefa e a vista geral do projeto. Durante a apresentação, Esc só fecha a apresentação (veja *Visualização*). Num campo de entrada, Esc não faz nada disto.

## Estrutura

**Alt+Shift+→** ou **Alt+→** — *Avançar*: torna as tarefas selecionadas um nível mais fundo na WBS. Só com uma seleção, não num diálogo.

**Alt+Shift+←** ou **Alt+←** — *Diminuir indentação*: sobe as tarefas selecionadas um nível. Só com uma seleção, não num diálogo.

Avançar, diminuir indentação e inserir acima ou abaixo de uma tarefa selecionada só funcionam na vista de árvore simples: sem filtro, agrupamento ou ordenação. Em qualquer outra vista, a aplicação recusa-os com uma mensagem, porque a ordem mostrada não é então a ordem do projeto. Inserir sem seleção funciona em todas as vistas.

**Insert** — *Inserir acima*: insere uma tarefa nova acima da tarefa selecionada mais alta, ao mesmo nível. Sem seleção, a tarefa vai para o fim, em todas as vistas. Não num diálogo.

**Ctrl+I** — *Inserir abaixo*: insere uma tarefa nova abaixo da tarefa selecionada mais baixa, ao mesmo nível. Sem seleção, a tarefa vai para o fim. Não num diálogo.

**Ctrl+M** — *Adicionar marco*: adiciona um marco novo no fim da lista, mesmo que tenha uma tarefa selecionada. Não num diálogo.

**Alt+↑** — *Mover tarefa para cima*: move a primeira tarefa selecionada um lugar para cima, dentro do seu nível. Só com uma seleção, não num diálogo.

**Alt+↓** — *Mover tarefa para baixo*: o mesmo, um lugar para baixo.

## Visualização

**F11** — *Apresentação*: liga ou desliga o modo de apresentação. A aplicação também pede à janela que passe para ecrã inteiro. Também funciona num campo de entrada. No navegador, F11 não inicia a apresentação: o próprio navegador põe a janela em ecrã inteiro e a aplicação mantém-se como está. F11 interrompe, no entanto, uma apresentação em curso no navegador.

**Esc** (durante a apresentação) — *Sair da apresentação*. Também funciona num campo de entrada. Isto tem prioridade sobre *Limpar seleção*.

**Ctrl+=** — *Aproximar*: aproxima a linha temporal num passo fixo. Não num campo de entrada.

**Ctrl+-** — *Afastar*: afasta num passo fixo.

**+** ou **=** — *Aproximar*: aproxima 10% em torno do meio da área do Gantt. Não num campo de entrada, e só quando a linha temporal do Gantt está visível (portanto, não nos separadores *Tabela*, *IFC* e *Relatório*).

**-** — *Afastar*: afasta 10%. Mesmas restrições.

**0** — *Repor zoom*: repõe o zoom para o valor padrão e desloca a vista para o início. Mesmas restrições.

**Ctrl+0** — *Ajustar ao projeto*: faz zoom para que o projeto inteiro caiba na vista. Mesmas restrições.

**Ctrl+/** — *Mostrar atalhos*: abre e fecha a janela *Atalhos de teclado*. Também funciona quando outro diálogo está aberto, mas não durante a visita guiada e o diálogo de boas-vindas.

**Ctrl+Shift+H** — *Histograma*: liga ou desliga o histograma, como o botão *Histograma* (*Recursos › Histograma › Histograma* ou *Visualização › Painéis › Histograma*). A aplicação lembra a sua escolha.

**Ctrl+Shift+L** — *Avisos*: liga ou desliga o painel de avisos, como o botão *Avisos* (*Visualização › Painéis › Avisos* ou *Planeamento › Agendamento › Avisos*).

## Navegação

**Ctrl+P** — *Ir para o separador Relatório*: leva-o ao separador *Relatório*. Não é, portanto, um comando de impressão. Não num diálogo.

**F1** — *Abrir ajuda*: abre *Ficheiro › Ajuda*. Não num campo de entrada e não num diálogo. Numa janela, use o ponto de interrogação no canto superior direito: abre a ajuda sobre o artigo dessa janela (veja [O friso, separador a separador](docs://ref-lint), em *Ajuda*).

**Ctrl+1** a **Ctrl+9** — *Mudar de documento*: vai para o primeiro ao nono documento aberto. Se esse documento não existir, não acontece nada. Não num diálogo e não com alterações por aplicar nas definições do projeto.

**Ctrl+Home** — *Saltar para hoje*: desloca a linha temporal para que uma data fique à esquerda da vista. Essa é a data de estado, se tiver definido uma; caso contrário, é hoje. Por isso, o nome diz «hoje», mesmo quando a linha temporal salta para a data de estado. O zoom e o início da linha temporal mantêm-se como estavam. Se uma célula da tabela de tarefas tiver o foco, Ctrl+Home vai, em vez disso, para a primeira célula da tabela (veja *Tabela*).

## Tabela

Estas teclas funcionam na tabela de tarefas (no separador *Tabela* e na tabela à esquerda do Gantt) quando uma célula tem o foco. A janela *Atalhos de teclado* mostra as primeiras seis entradas; as restantes não constam dela.

**Tab** e **Shift+Tab** — *Célula seguinte/anterior*: vai para a célula seguinte ou anterior e, no fim de uma linha, para a linha seguinte. Na última célula (Tab) ou na primeira (Shift+Tab), o foco sai da tabela.

**Enter** ou **F2** — *Editar célula*: abre o editor da célula. Se a célula não puder ser editada, a tabela mostra uma mensagem.

**Uma letra, um algarismo ou outro carácter** — *Digitar substitui o conteúdo da célula*: inicia a edição e substitui o conteúdo pelo que digitar.

**Insert** — *Inserir acima*: insere uma tarefa acima da linha ativa.

**Delete** ou **Backspace** — *Limpar conteúdo da célula*: limpa o conteúdo das células selecionadas, não a própria tarefa. A janela *Atalhos de teclado* só mostra Delete.

**Esc** — *Limpar seleção*: move o foco para a tabela no seu conjunto, para que o Tab seguinte saia da tabela, e limpa também a seleção, como descrito acima.

**Teclas de seta** — vão para a célula acima, abaixo, à esquerda ou à direita. Acrescente Shift para estender a seleção.

**Home** e **End** — para a primeira ou a última coluna da linha. Com Ctrl acrescentado, para a primeira célula da primeira linha e a última célula da última linha. Acrescente Shift para estender a seleção.

**Page Up** e **Page Down** — uma altura de ecrã para cima ou para baixo. Acrescente Shift para estender a seleção.

**Enter** (durante a edição) — confirma a entrada e vai para a mesma coluna da linha seguinte. Shift+Enter vai para a linha anterior.

**Esc** (durante a edição) — cancela a edição sem manter a entrada.

A tabela de recursos tem um tratamento de teclas próprio entre os campos de entrada; isso não consta desta lista.

## Diálogos e outras janelas

Estas teclas não constam da janela *Atalhos de teclado*.

**Esc** — fecha o diálogo mais alto (cancela). Também em *Ficheiro* (Backstage), Esc fecha o ecrã, exceto se um diálogo ou uma lista pendente aberta estiver por cima.

**Enter** — confirma o diálogo mais alto, como o botão principal, nos diálogos que o suportam. O Enter não faz isso numa caixa de texto de várias linhas, numa lista pendente aberta nem durante a entrada IME.

**Esc** durante um gesto no Gantt — cancela uma caixa de seleção (a seleção mantém-se como estava) e um gesto de divisão (uma divisão já feita é desfeita).

**Enter** e **Esc** no seletor do tipo de relação — Enter confirma, Esc cancela.

**Seta para a esquerda e seta para a direita** no divisor entre a tabela de tarefas e a linha temporal — move o divisor 10 pixels de cada vez, 40 com Shift. O divisor tem de ter o foco do teclado.

**Seta para cima e seta para baixo** na lista de recursos do histograma — escolhem o recurso anterior ou seguinte. O campo do histograma tem de ter o foco.

## Ver também

- [Criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken): porque é que Ctrl+P não abre uma janela de impressão.
- [Dividir uma tarefa](docs://howto-taak-splitsen): o gesto de divisão que Esc cancela.
- [Apresentar num ecrã grande](docs://howto-presentatie): F11 e Esc na prática.
- [Ativar o AutoSave](docs://howto-automatisch-opslaan): guardar com Ctrl+S junto ao AutoSave.
- [Arrastar, deslocar e fazer zoom no Gantt](docs://howto-gantt-bedienen): os gestos do rato junto às teclas.
