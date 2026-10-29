# Definições

Todas as definições da aplicação: o que fazem, o valor inicial, o que muda e onde as encontra. Para as opções de cálculo de um projeto (perfil de cálculo, definição de tarefa crítica), consulte [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): essas pertencem ao ficheiro do projeto, não à aplicação.

## Onde as encontrar e como funcionam

O painel de definições está em três sítios, e em todos é o mesmo painel: a engrenagem no topo da janela, *Definições › Projeto › Definições da app* e *Ficheiro › Definições da app*. O painel tem três separadores: *Aparência*, *Planeamento* e *Avançado*. Cada definição abaixo indica apenas o separador.

Uma alteração tem efeito de imediato. Não há botão *Aplicar* nem *Cancelar*.

**Para toda a aplicação, não por projeto.** Todas as definições deste artigo se aplicam a todos os seus projetos e pertencem a este dispositivo. A aplicação guarda-as no armazenamento da aplicação ou do navegador, e não no ficheiro do projeto. Se outra pessoa abrir o seu ficheiro, vê as suas próprias definições. Se limpar o armazenamento do navegador, as definições voltam aos valores iniciais.

## Separador Aparência

**Tema** — o esquema de cores da interface. Escolha entre *Escuro*, *Claro* e *Alto contraste*. Padrão: *Escuro*. Efeito: as cores de toda a interface, incluindo o Gantt e o histograma. Onde: *Aparência*.

**Seguir o tema do sistema** — deixa que o esquema de cores do seu sistema operativo decida. Padrão: desligado. Efeito: a aplicação fica *Claro* ou *Escuro*, conforme o seu sistema; os três cartões de tema ficam então desativados. *Alto contraste* não segue o sistema: escolhe-o manualmente. Se desativar esta opção, mantém-se o tema que estava no ecrã nesse momento. Onde: *Aparência*, em *Tema*.

**Idioma** — o idioma da interface. Padrão: o idioma do seu navegador ou do sistema, se a aplicação o conhecer; caso contrário, inglês. Efeito: todos os textos da aplicação. As línguas estão ordenadas pelo seu código curto. O árabe e o persa espelham a interface da direita para a esquerda. O idioma dos artigos de Ajuda define-se à parte, em *Idioma da documentação*, em *Ficheiro › Ajuda*. Onde: *Aparência*.

**Tipo de letra** — o tipo de letra de toda a interface. Escolha entre *Padrão*, *Sistema*, *Serif* e *Monoespaçada*. Padrão: *Padrão*. Efeito: títulos e texto na janela, e o texto no Gantt e no histograma. Uma aplicação web não segue sozinha o tipo de letra do seu sistema; por isso escolhe-o aqui. Onde: *Aparência*.

**Tamanho do texto** — escala da interface. Escolha entre 90%, 100%, 110% e 125%. Padrão: 100%. Efeito: o texto e a disposição do friso, dos painéis e das caixas de diálogo ficam maiores ou mais pequenos, e a altura das linhas da tabela e do Gantt acompanha essa escala. Não há opção acima de 125%, porque os textos dos botões no friso se partem então em várias linhas. Onde: *Aparência*.

**Formato da data** — como as datas aparecem na aplicação. Escolha entre *dd-mm-aaaa*, *mm-dd-aaaa* e *aaaa-mm-dd*. Padrão: *dd-mm-aaaa*. Efeito: as datas na tabela, nas caixas de diálogo, nos relatórios e na impressão. Os ficheiros e os cálculos não mudam: só muda a apresentação. Onde: *Aparência*.

**Formato da hora** — como as horas aparecem na aplicação. Escolha entre *24 horas (13:00)* e *12 horas (1:00 PM)*. Padrão: *24 horas (13:00)*. Efeito: as horas na janela *Calendários*, a data e a hora das tarefas horárias (tabela, divisões, mensagens) e a escala temporal *Hora* no Gantt. Num campo de hora pode escrever qualquer uma destas formas: *13:00*, *1300*, *13*, *1:00 PM* ou *1 pm*. Meia-noite como fim do dia é *24:00* ou *12:00 AM*. Os ficheiros e os cálculos não mudam: continuam no formato de 24 horas. Onde: *Aparência*.

**Apresentação da duração** — em que unidade se mostra a duração de uma tarefa. Escolha entre *Automática (unidade própria por tarefa)*, *Sempre dias* e *Sempre horas*. Padrão: *Automática (unidade própria por tarefa)*. Efeito: na tabela de tarefas, nos rótulos das barras do Gantt, na dica de ferramenta, na impressão e nos relatórios. Com *Automático*, uma tarefa em dias mostra dias e uma tarefa horária mostra horas. Com *Sempre dias* ou *Sempre horas*, a aplicação converte com as horas por dia do calendário da tarefa e, se a unidade da tarefa for diferente, acrescenta a sua própria unidade entre parênteses, por exemplo `2.25d(18h)`. Só muda a apresentação; a tarefa mantém a sua própria unidade. Onde: *Aparência*.

**Estilo de troca de documento** — como troca entre projetos abertos. Escolha entre *Separadores horizontais*, *Separadores verticais* e *Pílula*. Padrão: *Separadores horizontais*. Efeito: *Separadores horizontais* põe uma barra de separadores por baixo do friso; *Separadores verticais* põe uma barra de projetos à esquerda; *Pílula* põe um pequeno botão de projeto na barra de título. Onde: *Aparência*.

### Secção Gantt

**Mostrar apenas dias úteis** — comprime o eixo temporal. Padrão: desligado. Efeito: os fins de semana e os feriados do calendário do projeto são saltados, por isso uma tarefa de 5 dias úteis tem exatamente 5 dias de largura. Os atalhos *Saltar para hoje* e *Ajustar ao projeto* passam então também a contar dias úteis. O relatório tem uma caixa de verificação própria com o mesmo nome, que é independente desta definição. Onde: *Aparência*, em *Gantt › Eixo temporal*.

**Mostrar quartos de hora com muito zoom** — uma escala temporal mais fina. Padrão: desligado. Efeito: pode aumentar mais o zoom, e a escala das horas ganha uma linha extra de quartos de hora. Arrastar a barra de uma tarefa horária pode então ajustar-se a quartos de hora, em vez de horas inteiras. Só vê isto quando *Ativar planeamento por horas* está ligado. Onde: *Aparência*, em *Gantt › Zoom de quarto de hora*.

**Barras de tarefa nas interrupções** — se uma tarefa horária é desenhada em faixas. Escolha entre *Nunca dividir*, *Dividir ao selecionar* e *Dividir sempre*. Padrão: *Dividir ao selecionar*. Efeito: a barra de uma tarefa horária é então desenhada por faixa de tempo de trabalho, em vez de como uma só faixa contínua. *Dividir ao selecionar* faz isso só para a tarefa selecionada. Diz respeito apenas a tarefas horárias; uma tarefa que está realmente dividida (com *Dividir tarefa*) mostra a sua interrupção, independentemente desta definição. Onde: *Aparência*, em *Gantt*.

**Deslocação e zoom › Modo** — o que a roda do rato faz sobre o Gantt. Escolha entre *Posição*, *Teclas* e *Zoom + arrastar*. Padrão: *Zoom + arrastar*. Efeito: com *Zoom + arrastar*, a roda do rato faz zoom em torno do cursor, Shift+roda do rato desloca-se pelas linhas, arrastar o fundo desloca a escala temporal e Ctrl+arrastar (Cmd num Mac) desenha uma caixa de seleção. Com *Posição*, a função da roda do rato depende de onde está o cursor; Ctrl+roda do rato faz sempre zoom e Shift+roda do rato desloca sempre na horizontal. Com *Teclas*, escolhe qual tecla faz cada função. A escolha aplica-se também à segunda escala temporal da vista dividida. Onde: *Aparência*, em *Gantt › Deslocação e zoom*.

**Deslocação e zoom › Divisão do ecrã** — onde está o cursor para cada função. Só é visível no modo *Posição*. Escolha entre *Esquerda/direita*, *Cima/baixo* e *Canto superior direito*. Padrão: *Esquerda/direita*. Efeito: com *Esquerda/direita*, a roda do rato desloca na vertical sobre a metade esquerda e na horizontal sobre a metade direita. Com *Cima/baixo*, a roda do rato desloca na horizontal sobre os 30% superiores (perto da escala temporal) e na vertical abaixo disso. Com *Canto superior direito*, a roda do rato desloca na horizontal no quadrante superior direito e na vertical no resto. Onde: *Aparência*, em *Gantt › Deslocação e zoom*.

**Deslocação e zoom › Vertical, Horizontal, Zoom** — qual tecla pertence a cada função da roda do rato. Só é visível no modo *Teclas*. Para cada função, escolha entre *Deslocar*, *Ctrl + roda* ou *Shift + roda*. Padrão: *Vertical* é *Deslocar*, *Zoom* é *Ctrl + roda* e *Horizontal* é *Shift + roda*. Efeito: se escolher uma tecla que já está em uso, troca com a função que a tinha. Onde: *Aparência*, em *Gantt › Deslocação e zoom*.

## Separador Planeamento

**Ativar modo de construção** — valores iniciais para novos projetos, orientados para a construção. Padrão: ligado. Efeito: ligado dá a um novo projeto o calendário *Bouwkalender NL* com os feriados públicos neerlandeses, permite escolher um feriado da construção ao gerar feriados, oferece os modelos de faseamento *Construção residencial* e *Construção comercial / renovação* e atribui às novas tarefas a categoria de trabalho *Construção*. Desligado dá o calendário *Standaardkalender* sem feriados, apenas o modelo *Vazio* e a categoria de trabalho *Outro*. Uma nova tarefa sob uma tarefa-mãe que tem categoria de trabalho herda primeiro essa categoria; *Construção* ou *Outro* aplica-se depois disso. As tarefas e os calendários existentes não mudam. Onde: *Planeamento*.

**Ativar planeamento por horas** — planeamento em horas de trabalho, ao lado dos dias úteis. Padrão: desligado. Efeito: a escala temporal *Hora* aparece em *Visualização › Escala temporal*, na janela *Calendários* um calendário comum pode receber faixas de tempo de trabalho (a faixa *Horários de trabalho*; um calendário que já tem faixas mostra-o sempre), e a janela *Novo projeto* ganha as opções *Turno* e *Unidade predefinida para novas tarefas*. *Definições do projeto* também ganha a opção *Unidade predefinida para novas tarefas*. Desligado, a aplicação trabalha só com dias. As tarefas que já estão em horas mantêm-se e entram no cálculo; só pode editar a respetiva duração depois de ativar o planeamento por horas. Onde: *Planeamento*, em *Planeamento por horas*. Consulte [Ativar planeamento por horas](docs://howto-urenplanning-aanzetten).

**Permitir planeamento misto de dias/horas** — se escolhe a unidade por tarefa. Só visível quando *Ativar planeamento por horas* está ligado. Padrão: ligado. Efeito: ligado mostra a lista pendente *Unidade de duração* ao lado da duração de cada tarefa. Desligado oculta essa lista. Onde: *Planeamento*, em *Planeamento por horas*. Consulte [Dias e horas](docs://uitleg-dagen-en-uren).

**A semana começa em** — o primeiro dia da semana. Escolha entre *Segunda-feira* e *Domingo*. Padrão: *Segunda-feira*. Efeito: a disposição da semana e os números das semanas da escala temporal no Gantt e nos relatórios (a impressão do gráfico Gantt), e a ordem dos dias da semana na janela *Calendários*. Onde: *Planeamento*.

**Calcular automaticamente** — recalcula o planeamento logo que fique desatualizado. Padrão: desligado. Efeito: desligado significa que tem de premir *Calcular* (F5) por si. Ligado faz a aplicação recalcular o planeamento numa fração de segundo após uma alteração às tarefas, às relações ou ao calendário. Durante um gesto de arrastar, ou enquanto escreve num campo, a aplicação espera e calcula uma vez, quando termina. Depois de um cálculo falhado, só volta a calcular quando alterar alguma coisa. Onde: *Planeamento*, em *Cálculo*.

**Usar tipos de tarefa** — os campos de tipo de tarefa e de trabalho na aplicação. Padrão: desligado. Efeito: ligado mostra o campo *Tipo de tarefa* numa tarefa e a coluna de trabalho das atribuições, e torna disponível a coluna da tabela *Tipo de tarefa*. Desligado oculta-os; a duração e as unidades mantêm-se, e o trabalho segue-as. Um projeto que já contenha dados de tipo de tarefa ou de trabalho, por exemplo de um ficheiro `.mpp` ou `.xer`, mostra-os sempre, mesmo que a definição esteja desligada. Onde: *Planeamento*, em *Cálculo*. Consulte [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels).

## Separador Avançado

**Mostrar explicação depois de abrir** — uma caixa de verificação por formato: *Ficheiro Primavera (.xer)*, *Ficheiro MS Project (.mpp)*, *MS Project XML*, *Primavera P6 XML* e *Ficheiro CSV*. Padrão: todas ligadas. Efeito: ligado mostra uma janela com uma breve explicação do formato depois de abrir esse tipo de ficheiro: o que a aplicação assumiu, o que não assumiu e como funcionam a gravação e a escrita de volta. *Não mostrar novamente para …* nessa janela desmarca a caixa aqui; aqui volta a ligá-la. Um ficheiro IFC, um exemplo e um projeto que um assistente de IA ou uma extensão abre nunca recebem esta explicação. Onde: *Avançado*, em *Mostrar explicação depois de abrir*. Consulte [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan).

**Ativar modo IA** — deixa um assistente de IA trabalhar com o seu planeamento. Padrão: desligado. Efeito: ligado mostra o separador *IA* com a ponte MCP, para que um assistente de IA possa trabalhar com o seu planeamento através do Model Context Protocol. Desligado oculta o separador e para a ponte. Onde: *Avançado*, em *Modo IA*. Consulte [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

**Iniciar a ponte automaticamente** — inicia a ponte MCP quando a aplicação arranca. Só pode ser ativada quando *Ativar modo IA* está ligado. Padrão: desligado. Efeito: a ponte fica ativa logo, por isso um cliente de IA pode ligar-se sem que antes abra o separador *IA*. Isto só funciona na aplicação para computador, e uma vez por arranque: se depois desligar a ponte por sua própria iniciativa, ela não volta a iniciar. Onde: *Avançado*, em *Modo IA*.

**Ativar terminal de depuração** — um painel de registo para diagnosticar problemas. Padrão: desligado. Efeito: ligado põe um botão de terminal na barra de estado, que mostra ou oculta o painel de registo. Desligado fecha o painel. Onde: *Avançado*, em *Terminal de depuração*.

**Benchmark…** — mede o desempenho do motor de planeamento. Efeito: abre uma janela em que se gera um planeamento de teste de um tamanho escolhido e se medem as fases principais. O projeto aberto fica intacto. É um botão, não uma definição: não há nada a memorizar. Onde: *Avançado*, em *Benchmark*.

**Estatísticas…** — quantas vezes a aplicação foi transferida. Efeito: abre a janela *Estatísticas de transferências*, com números públicos de GitHub Releases; não se recolhe nada de si. É um botão, não uma definição. Onde: *Avançado*, em *Estatísticas*. Na janela:

- *Transferências por sistema operativo* — por sistema, as colunas *Transferências*, *Instaladores* (o que uma pessoa transfere) e *Atualizações* (o que o atualizador da aplicação obtém), com um *Total*. No Linux não é possível separar as duas: o atualizador obtém o mesmo ficheiro `.deb`, `.rpm` ou `.AppImage` que as pessoas também transferem à mão, por isso só o ficheiro snap conta aí como instalador. Abaixo disto, *Verificações de atualização a partir da aplicação*: com que frequência o atualizador de uma aplicação instalada foi buscar o ficheiro de versão ao GitHub para procurar uma nova versão. São verificações, não instalações.
- *Por versão* — as mesmas transferências por versão, com a data; primeiro as seis mais recentes, com *Mostrar todas as … versões* para as restantes.
- *Fonte* — a data dos números (GitHub Releases, atualizado semanalmente) e *Atualizar agora*. A aplicação guarda os números obtidos durante meia hora. Se a obtenção falhar, a janela indica-o. As instalações feitas pela Snap Store não passam pelo GitHub e não aparecem.

**Iniciar o tour** — o tour de introdução outra vez. Efeito: fecha a janela *Definições da app* e inicia o tour a partir do primeiro passo. Onde: *Avançado*, em *Tour*.

**Versão** — o número de versão da aplicação, com dois botões. *Verificar atualizações* abre a janela de atualização. *Novidades* mostra as novidades da versão atual. Onde: *Avançado*, em *Versão*.

**Mostrar botões de vista clássica** — uma funcionalidade substituída, em *Funcionalidades legadas*. Padrão: desligado. Efeito: ligado volta a pôr um grupo *Apresentação* no separador *Visualização*, com os botões separados *Colunas…*, *Filtro…*, *Agrupar…* e *Ordenar…*. Foram substituídos pelo sinal de mais no cabeçalho da tabela, pelos botões de layout e pela janela de layout. Onde: *Avançado*, em *Funcionalidades legadas*.

## Escolhas de visualização guardadas fora do painel

A aplicação também guarda estas escolhas neste dispositivo, mas define-as no próprio item, não no painel de definições.

**Sobreposição da linha de base** — a linha de base ativa como uma barra fina por baixo da barra de tarefa. Padrão: ativado. Onde: *Visualização › Linhas de base e progresso › Sobreposição da linha de base*.

**Linha de progresso** — a linha em ziguezague do progresso na data de estado. Padrão: ativado. Efeito: a linha só aparece quando o projeto tem uma data de estado, e substitui então a linha de data de estado separada. Onde: *Visualização › Linhas de base e progresso › Linha de progresso*.

**Linha de data de estado** — uma linha pontilhada na data de estado. Padrão: ativado. Efeito: se a linha de progresso estiver ativada, ela desenha a própria marcação. Onde: *Visualização › Linhas de base e progresso › Linha de data de estado*.

**Acento de recurso** — uma listra fina na cor do recurso por baixo da barra de tarefa. Padrão: desativado. Onde: *Visualização › Linhas de base e progresso › Acento de recurso*.

**Faixa de folga** — a folga como faixa atrás das barras não críticas, não para tarefas concluídas. Padrão: ativado. Onde: *Visualização › Linhas de base e progresso › Faixa de folga*.

**Cores das barras** — de que depende a cor de uma barra. Escolha entre *Caminho crítico*, *Por tarefa — automático* e *Por categoria*. Padrão: *Caminho crítico*. Efeito: aplica-se ao Gantt e ao relatório ao mesmo tempo. Onde: *Visualização › Linhas de base e progresso › Cores das barras*.

**Histograma** — a tira do histograma por baixo do Gantt. Padrão: desativado. Onde: *Recursos › Histograma › Histograma*, *Visualização › Painéis › Histograma* ou Ctrl+Shift+H. A altura da tira (padrão: 160 pixels, entre 80 e 480) define-se arrastando a sua borda.

**Minimapa** — um mapa geral da linha do tempo. Padrão: desativado. Onde: *Visualização › Apresentação › Minimapa*.

**Recolher o friso** — um friso compacto. Padrão: desativado. Onde: o botão de seta no canto inferior direito do friso.

**Largura da tabela de tarefas** — padrão: 350 pixels, entre 150 e 800. A largura define-se arrastando o divisor ao lado da tabela, ou com a seta para a esquerda e a seta para a direita quando o divisor tiver o foco.

**Largura do painel direito** — padrão: 280 pixels, entre 200 e 900. A largura define-se arrastando a borda do painel.

**Altura de *Propriedades* e *Avisos* no painel direito** — padrão: 240 e 220 pixels, entre 120 e 2000. *Propriedades* tem esta altura também quando a lista de recursos está aberta. A altura define-se com a pega de arrastar entre as secções. A aplicação não guarda se as secções estão abertas ou fechadas.

**Também guardadas, descritas noutro lugar** — as colunas da tabela ([Ajustar colunas da tabela](docs://howto-tabelkolommen-aanpassen)), os seus layouts ([Criar e usar um layout](docs://howto-layouts-gebruiken)), as opções de relatório ([Tipos de relatório](docs://ref-rapporttypes)), os seus próprios modelos de perfil de cálculo ([Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies)) e o *Idioma da documentação* da Ajuda (*Ficheiro › Ajuda*) também são guardados pela aplicação neste dispositivo, não no ficheiro do projeto.

## Ver também

- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): as opções que pertencem a um projeto.
- [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten): os passos para o interruptor *Ativar planeamento por horas*.
- [Dias e horas](docs://uitleg-dagen-en-uren): como a aplicação conta os dias e as horas.
- [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels): o que *Usar tipos de tarefa* torna visível.
- [Atalhos de teclado](docs://ref-sneltoetsen): todas as teclas da aplicação, incluindo as de zoom e deslocamento.
