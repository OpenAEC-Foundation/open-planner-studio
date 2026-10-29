# O friso, separador a separador

O friso no topo do ecrã tem separadores, e cada separador tem grupos de botões. Este artigo indica, para cada botão, o que faz e onde vê o resultado. Como fazer uma operação passo a passo está nos guias práticos; aqui consulta o que é um botão. Um botão que só existe ou só funciona sob uma condição mostra essa condição ao lado.

## Comportamento do friso

- **Separadores** — *Ficheiro* fica à esquerda, depois *Início*, *Planeamento*, *Recursos*, *Visualização*, *Definições*, *Tabela*, *IFC*, *Relatório* e, só com o modo IA ativado, *IA*.
- **Janela estreita** — quando o friso não cabe, os botões reduzem-se a um ícone, da direita para a esquerda. O nome aparece então como texto de ajuda no botão. Cada botão sem texto de ajuda próprio mostra o seu nome.
- **Recolher o friso** — a pequena seta no canto inferior direito do friso transforma-o numa faixa plana, só com ícones. Os grupos *Linhas de base e progresso* e *Ligação* do separador *IA* desaparecem então atrás de um único botão, com um pop-up. Padrão: expandido. A sua escolha fica guardada.
- **Botões de extensão** — uma extensão pode acrescentar o seu próprio grupo no fim de um separador. Esse botão faz o que a extensão definiu para ele.

## Ficheiro

Ao clicar em *Ficheiro*, um ecrã próprio (o Backstage) passa a ocupar a área de trabalho. Não tem friso. *Voltar* fecha-o. Se alterou algo em *Definições do projeto* e não o aplicou, a aplicação pergunta primeiro o que deve fazer com a alteração.

- **Novo** — abre a janela *Novo projeto* e fecha o Backstage. Os campos estão em [Novo projeto e Definições do projeto](docs://ref-projectinfo).
- **Abrir** — escolha um ficheiro e abra-o como documento. Fecha o Backstage.
- **Recentes** — uma lista dos projetos abertos há pouco; um clique abre um deles. Só fica visível quando o ambiente consegue reabrir ficheiros: na aplicação para computador e em navegadores que oferecem acesso a ficheiros, como o Chrome e o Edge. Nos outros navegadores, o botão existe, mas a página fica vazia.
- **Exemplos** — planeamentos de exemplo incluídos, divididos em *Planificações de demonstração completas* (distintivo *Todas as funcionalidades*) e *Exemplos simples*. Um clique abre um deles num novo separador.
- **Guardar** — grava o projeto no ficheiro deste documento. Se o documento ainda não tiver ficheiro, escolha primeiro um nome e um local. Um ficheiro aberto num formato diferente de IFC nunca é substituído; nesse caso, *Guardar* pede um nome e um local para um ficheiro IFC.
- **Guardar como** — escolha um novo nome ou local e guarde aí o ficheiro em formato IFC.
- **Exportar** — um cartão por formato de exportação, cada um com uma descrição. Um clique converte e guarda o projeto. A aplicação volta então ao separador *Início*. Se o planeamento tiver um ciclo, o erro aparece no Backstage e a aplicação fica aí. Se o projeto estiver ligado a uma biblioteca de recursos, aparece por baixo a caixa de verificação *Guardar também o ficheiro de biblioteca*; só funciona no cartão IFC.
- **Importar** — no topo, o cartão *Atualizar o progresso a partir de uma planilha* (desativado sem tarefas); por baixo, os importadores que as extensões acrescentam.
- **Imprimir** — o botão *Abrir pré-visualização* abre o separador *Relatório*.
- **Definições do projeto** — os metadados e o perfil de cálculo deste projeto. As alterações só têm efeito depois de *Aplicar*. Veja [Novo projeto e Definições do projeto](docs://ref-projectinfo) e [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen).
- **Definições da app** — as mesmas definições da janela *Definições da app*.
- **Extensões** — gestão e instalação de extensões; veja [Instalar e gerir uma extensão](docs://howto-extensie-installeren).
- **Biblioteca** — gestão das bibliotecas de recursos; veja [Gerir e partilhar bibliotecas de recursos](docs://howto-bibliotheken-beheren).
- **Ajuda** — a documentação incorporada, também com F1. O campo de pesquisa procura nos títulos, nos cabeçalhos e no próprio texto. Os artigos estão em quatro secções: *Tutoriais*, *Guias práticos*, *Explicações* e *Referência*. Em *Idioma da documentação*, escolha *Seguir o idioma da aplicação* ou um idioma da lista. O neerlandês e o inglês são as línguas de origem; nas outras línguas há apenas os artigos já traduzidos. Se um artigo não existir na sua língua, leia a versão inglesa, com um aviso. A escolha fica guardada neste dispositivo, separada do idioma da aplicação. Também pode abrir a Ajuda a partir de uma janela ou de um painel: muitas janelas e os painéis *Propriedades*, *Recursos* e *Avisos* têm um ponto de interrogação no canto superior direito (*Ajuda sobre este tema*), que abre a Ajuda sobre o artigo dessa janela ou desse painel. Se escreveu algo na janela e ainda não o guardou, a aplicação pergunta primeiro *Guardar*, *Cancelar* (descarta o que escreveu) ou *Voltar* (fica na janela); depois a janela fecha e a Ajuda abre. Algumas janelas, como *Editar tarefa* e *Nivelar recursos*, perguntam sempre. Sem nada escrito, a Ajuda abre logo.
- **Iniciar visita guiada** — fecha o Backstage e inicia a visita guiada no passo 1.
- **Fechar projeto** — fecha o documento ativo. Se tiver alterações por guardar, a aplicação pede confirmação.

## Início

### Início › Ficheiro

- **Novo**, **Guardar**, **Abrir** e **Guardar como** — as mesmas ações de *Ficheiro*.
- **Recentes** — menu pendente com os projetos recentes; um clique abre um deles. Só fica visível sob a mesma condição de *Ficheiro › Recentes*. Sem ficheiros recentes, aparece *Sem ficheiros recentes*.
- **Exportar** — menu pendente com os formatos de exportação (nomes curtos). Um clique converte e guarda o projeto.

### Início › Editar

- **Anular** — desfaz a última alteração. Desativado quando não há nada para anular.
- **Refazer** — repõe a última alteração desfeita. Desativado quando não há nada para refazer.
- **Eliminar** — elimina as tarefas selecionadas, juntamente com as respetivas subtarefas, num só passo. Desativado sem seleção.

### Início › Tarefas

- **Tarefa** — acrescenta uma tarefa com o nome *Nova tarefa*, com uma duração de 5 dias úteis, a começar no início do projeto. (Se *Ativar planeamento por horas* estiver ativado e a *Unidade predefinida para novas tarefas* em *Definições do projeto* for horas, a duração é de 5 horas.) Se houver uma tarefa selecionada e a vista for a árvore simples, a nova tarefa fica logo abaixo da tarefa selecionada mais abaixo (texto de ajuda *Nova tarefa logo abaixo da seleção*). Sem seleção, fica no fim (texto de ajuda *Nova tarefa no fim da lista*). Com uma seleção, mas durante a filtragem, o agrupamento ou a ordenação, também fica no fim, e aparece uma notificação vermelha que diz que a aplicação não consegue colocá-la abaixo da seleção, com o botão *Limpar*. A nova tarefa passa a ser a única seleção, o gráfico de Gantt desloca-se para ela e o nome fica pronto para ser substituído no painel *Propriedades*.
- **Marco ▾** — menu pendente que coloca um marco (duração 0) no mesmo lugar que *Tarefa*. *Marco de início* e *Marco de fim* definem o tipo de marco; o novo marco fica com o nome *Novo marco* e recebe a categoria de trabalho *Outro*. *Ponto de inspeção (obrigatório)* cria um marco de fim com a categoria de trabalho *Inspecção* e a marca *Obrigatório (contratual)*, com o nome *Novo ponto de inspeção*.
- **Vincular ▾** — menu pendente com quatro ações fixas; o botão principal nunca muda de significado. Veja *Planeamento › Relações* para as quatro ações.
- **Dividir tarefa** — ativa ou desativa o modo de divisão. Ativado: uma faixa por baixo do friso explica que se clica numa barra onde começa a divisão e se arrasta para a direita para definir o comprimento. Desativado quando o gráfico de Gantt não está visível (nos separadores *Tabela*, *IFC* e *Relatório* e com o painel de recursos completo); o texto de ajuda diz então *Disponível apenas quando o gráfico de Gantt está visível*. Veja [Dividir uma tarefa](docs://howto-taak-splitsen).

### Início › Planeamento

- **Calcular** — calcula o planeamento: datas, folga, caminho crítico e carga dos recursos. Isto nunca acontece sozinho, a não ser que ative *Calcular automaticamente* (*Definições da app*, separador *Planeamento*, secção *Cálculo*). Enquanto o planeamento estiver desatualizado, a barra de estado mostra *Desatualizado — recalcule (F5)*.

### Início › Zoom

- **Zoom +** — aumenta o zoom do eixo temporal em 10 píxeis por dia.
- **Zoom -** — reduz o zoom do eixo temporal em 10 píxeis por dia.

## Planeamento

### Planeamento › Planeamento

O botão *Calcular* é igual ao de *Início*.

- **Mover projeto…** — abre a janela *Mover projeto*. Desativado sem data de início do projeto. Veja [Mover um projeto](docs://howto-project-verplaatsen).
- **Avisos** — mostra ou oculta o painel *Avisos* na coluna da direita. O botão fica destacado enquanto o painel estiver visível. Ao ativá-lo, expande-se uma coluna recolhida. O que o painel contém está descrito em [Notificações e avisos](docs://ref-meldingen).

### Planeamento › Relações

O grupo tem o botão *Vincular ▾* com quatro ações e o botão *Dividir tarefa* (igual ao de *Início*). As quatro ações:

- **Desenhar relação** — ativa ou desativa o modo de vincular; aparece uma marca de verificação quando está ativado, e o botão principal fica destacado. Ativado: arrasta-se de uma barra para outra no gráfico de Gantt para criar uma relação, e uma faixa por baixo do friso indica como parar (*Parar* ou Esc). Desativado quando o gráfico de Gantt não está visível.
- **Vincular tarefas selecionadas** — cria uma relação fim-início sem desfasamento entre duas tarefas; a tarefa selecionada primeiro passa a ser a predecessora. Só fica disponível com exatamente duas tarefas selecionadas (senão, *Selecione exatamente duas tarefas*). A aplicação recusa uma relação duplicada ou um ciclo e mostra uma mensagem.
- **Adicionar relação externa…** — abre uma janela para acrescentar uma predecessora ou uma sucessora externa à tarefa selecionada. Só fica disponível com exatamente uma tarefa selecionada (senão, *Selecione exatamente uma tarefa*).
- **Atualizar todas as relações externas** — atualiza as âncoras de todas as relações externas e indica no menu quantas foram atualizadas ou estão em falta. Só fica disponível quando o projeto tem relações externas (senão, *Este projeto não contém relações externas*).

Para a explicação das relações, veja [Criar relações](docs://howto-relaties-leggen) e [Relações e desfasamento](docs://uitleg-relaties).

### Planeamento › Rastreamento de caminho

- **Predecessoras** — destaca no gráfico de Gantt as predecessoras das tarefas selecionadas, cadeia a cadeia.
- **Sucessoras** — destaca as sucessoras das tarefas selecionadas.

Pode ativar as duas ao mesmo tempo; um segundo clique num botão desativa esse lado de novo. As relações determinantes recebem um tom mais forte. Veja [Rastrear um caminho](docs://howto-pad-traceren).

### Planeamento › Calendário

- **Calendário** — abre a janela *Calendários* com a biblioteca de calendários do projeto. Veja [Janelas de calendário](docs://ref-kalenders).

### Planeamento › Estrutura

- **Códigos e campos** — abre a janela *Códigos e campos* para códigos de atividade e campos personalizados. Veja [Códigos e campos personalizados](docs://howto-codes-en-velden).
- **WBS auto** — ativa ou desativa a numeração automática dos códigos WBS. Padrão: ativado em projeto novo. Num ficheiro aberto sem esta definição: ativado se o ficheiro estiver vazio ou se todos os códigos já corresponderem à numeração da árvore; caso contrário, desativado. Ativado: a árvore inteira é renumerada de uma vez, os códigos seguem depois cada alteração da estrutura, e o campo *Código WBS* no painel e na janela fica desativado.
- **Renumerar WBS** — renumera uma vez os códigos WBS, segundo a posição na árvore (1.2.3). Desativado enquanto *WBS auto* estiver ativado.
- **Modelos** — menu pendente com os modelos WBS guardados, cada um com o respetivo número de tarefas e relações. Um clique insere o modelo por baixo da tarefa selecionada, ou no nível superior sem seleção. O ícone do lixo elimina um modelo. Sem modelos, mostra como guardar um (clique com o botão direito numa tarefa de resumo, *Guardar ramo como modelo*). Veja [Guardar e inserir modelos WBS](docs://howto-wbs-sjablonen).
- **Avançar** — torna as tarefas selecionadas subtarefas da tarefa anterior. Desativado sem seleção e enquanto houver filtragem, agrupamento ou ordenação; o texto de ajuda diz então *Não disponível durante a filtragem/agrupamento/ordenação*.
- **Diminuir indentação** — sobe as tarefas selecionadas um nível, logo a seguir à respetiva tarefa superior atual. As mesmas condições de *Avançar*.

### Planeamento › Linhas de base e progresso

- **Gerir linhas de base…** — abre a janela de linhas de base. Veja [Guardar e gerir uma linha de base](docs://howto-baseline-opslaan-en-beheren).
- **Data de estado** — a data até à qual mede o progresso. Escreva uma data; a cruz (*Limpar data de estado*) remove-a. Se o calendário do projeto tiver faixas de tempo de trabalho, a aplicação calcula em horas e aparece um campo de hora ao lado da data (o MS Project costuma guardar 17:00). A hora conta então: 12:00 em vez de 17:00 dá uma diferença de meio dia no trabalho restante. Sem faixas de tempo de trabalho, a aplicação calcula em dias inteiros e não há campo de hora. Efeito: o progresso é medido até essa data, e a linha da data de estado e a linha de progresso no gráfico de Gantt ficam sobre ela. Veja [Progresso, data de estado e linha de base](docs://uitleg-voortgang).
- **Modo de progresso** — uma escolha entre *Retained Logic* e *Progress Override*. Padrão: *Retained Logic*. Efeito: com *Retained Logic*, o trabalho restante de uma sucessora iniciada segue a relação; com *Progress Override*, o trabalho restante começa na data de estado, sem esperar pela predecessora. Veja [Escolher o modo de progresso](docs://howto-voortgangsmodus-kiezen).

No friso recolhido, estes três ficam atrás de um único botão, com o título *Linhas de base e progresso*.

### Planeamento › Progresso

- **Exportar folha de progresso** — cria uma folha `.xlsx` com as tarefas, para preencher o progresso fora da aplicação. Desativado sem tarefas.
- **Atualizar o progresso a partir de uma planilha** — abre a janela de importação de uma folha devolvida. Desativado sem tarefas. Veja [Importar o progresso a partir de uma planilha](docs://howto-voortgang-importeren).

Este grupo também está nos separadores *Tabela* e *Relatório*.

## Recursos

### Recursos › Gerir

- **Recursos** — abre o painel de recursos completo; ocupa a área de trabalho. Fica destacado enquanto vê esse painel. Veja [Painel de recursos](docs://ref-resourcepaneel).
- **Painel acoplado de recursos** — acopla o painel compacto de recursos na coluna da direita, ao lado do gráfico de Gantt. Fica destacado enquanto o painel acoplado estiver visível; um segundo clique fecha-o. O painel mostra apenas o nome, a cor, um aviso quando um recurso está sobrealocado e *Unidades máx*, e, com uma seleção de tarefas, apenas os recursos dessas tarefas.
- **Novo recurso** — abre o painel de recursos completo com uma linha de rascunho vazia para um novo recurso. Nada é criado até escrever um nome; se clicar noutro ponto, não fica nada para trás. O recurso vai para a biblioteca de recursos ou para o projeto, conforme a vista.

### Recursos › Atribuição

- **Atribuir ▾** — atribui um recurso à tarefa selecionada. Só fica disponível com exatamente uma tarefa selecionada, que seja uma tarefa-folha e não um marco; caso contrário, o botão fica cinzento. No menu, primeiro define *Unid./dia* (padrão 1) e *Curva* (padrão *Uniforme*); um clique num recurso atribui-o com esses valores. O menu lista apenas os recursos que ainda não estão na tarefa. Veja [Atribuir recursos com uma curva](docs://howto-resource-toewijzen).

### Recursos › Histograma

- **Histograma** — mostra ou oculta a faixa do histograma por baixo do gráfico de Gantt. Padrão: desativado. A sua escolha fica guardada.
- **Anterior** e **Seguinte** — percorrem os recursos no seletor da faixa do histograma, com *Todos os recursos* como passo extra na rotação. Desativados quando o histograma está desativado ou o projeto não tem recursos.

### Recursos › Nivelamento

- **Nivelar…** — abre a janela *Nivelar recursos*. Veja [Nivelamento](docs://uitleg-nivelleren).
- **Limpar nivelamento** — remove os atrasos e as interrupções que o nivelamento aplicou. Desativado quando nenhuma tarefa tem um resultado de nivelamento.

### Recursos › Sobrealocação

- **Sobrealocação** — não é um botão, mas um contador: o número de recursos com pelo menos um dia sobrealocado, ou *Nenhuma*. Fica vermelho com um ícone de aviso logo que haja um. O número atualiza-se depois de *Calcular* e depois de alterações aos recursos e às atribuições; se alterar as datas das tarefas, só conta depois de *Calcular*.

## Vista

### Vista › Escala temporal

- **Zoom +** e **Zoom -** — aumenta ou diminui o zoom do eixo temporal em 10 pixels por dia.
- **Repor** — repõe o zoom no valor padrão de 30 pixels por dia.
- **Ajustar ao projeto** — aplica o zoom e desloca a vista para que o projeto inteiro fique visível.
- **Escolha de escala** — uma lista com *Ano*, *Trimestre*, *Mês*, *Semana*, *Dia* e, só com *Ativar planeamento por horas* ligado, *Hora*. Uma escolha define um zoom fixo. O valor mostrado segue o zoom atual; por baixo, esse zoom aparece em pixels por dia.

### Vista › Ecrã

- **Colunas…**, **Filtro…**, **Agrupar…** e **Ordenar…** — só visíveis quando *Mostrar os botões de vista clássicos* está ligado (*Definições da app*, separador *Avançado*, cabeçalho *Funcionalidades legadas*). Padrão: desligado. *Colunas…* abre *Tabela* e mostra aí o seletor de colunas. *Filtro…* abre logo a janela de filtro, desde que não exista nenhum filtro guardado; com filtros guardados, abre um menu com *Filtro…*, *Limpar* (só quando um filtro está ativo) e os filtros guardados. *Agrupar…* permite dois níveis. *Ordenar…* permite mais níveis. Um botão fica destacado quando essa definição de vista está ativa. No friso atual, isto faz-se com os botões de layout; veja [Criar e usar um layout](docs://howto-layouts-gebruiken).

### Vista › Estrutura

- **Reduzir** — reduz as tarefas de resumo selecionadas; sem seleção, reduz todas. Numa vista agrupada, reduz todos os grupos e a seleção não tem efeito.
- **Expandir** — o inverso.

### Vista › Layout

- **Botões de layout** — cada layout é um interruptor com um ícone e um nome. Inclui-se o *Diagrama de recursos*. Um clique liga o layout; outro clique desliga-o e repõe a vista de antes do clique. Layouts com partes diferentes podem estar ligados ao mesmo tempo. Clique com o botão direito num layout: *Editar…*, *Duplicar* e *Eliminar* (depois de confirmação). Um layout incluído só pode ser duplicado.
- **Novo layout** — abre a janela de layout para criar um layout novo.

### Vista › Apresentação

- **Apresentação** — ativa ou desativa o modo de apresentação (Esc para parar; na aplicação desktop também F11): só o Gantt ocupa o ecrã. Veja [Apresentar num ecrã grande](docs://howto-presentatie).
- **Vista dividida** — divide o Gantt em duas janelas temporais, que começam ambas com o zoom e a posição atuais (a 50 por cento), ou volta a juntar tudo numa só. Padrão: desligado. Veja [Usar a vista dividida e o minimapa](docs://howto-split-view-en-mini-map).
- **Minimapa** — mostra ou oculta o minimapa. Padrão: desligado. A sua escolha fica guardada.

### Vista › Painéis

- **Propriedades** — mostra ou oculta o painel *Propriedades* na coluna da direita. Padrão: ligado. Veja [Diálogo de tarefa e painel de propriedades](docs://ref-taak-eigenschappen).

Os botões *Recursos*, *Dock de recursos* e *Histograma* são os mesmos de *Recursos*, e *Avisos* é o mesmo de *Planeamento*.

**A coluna da direita.** A coluna à direita do Gantt aparece assim que pelo menos um dos painéis *Propriedades*, *Dock de recursos* ou *Avisos* estiver ligado. Se nenhum estiver ligado, não há coluna. Se um painel completo ocupar a área de trabalho, por exemplo o painel de recursos completo, a coluna desaparece. Só no separador *Tabela* é que a coluna fica.

- **Largura** — arraste a divisória entre a área de trabalho e a coluna. Uma largura aplica-se a todos os painéis da coluna.
- **Divisão** — se dois painéis estiverem ligados, arraste a fronteira entre eles. Se só um estiver ligado, esse painel ocupa a coluna inteira.
- **Recolher** — o botão *Recolher a coluna lateral* no cabeçalho oculta a coluna. Uma tira estreita com o botão *Expandir a coluna lateral* volta a mostrá-la, com os mesmos painéis de antes.
- **Fechar** — cada painel tem uma cruz no cabeçalho. É o mesmo interruptor que o botão do friso.
- **Painel completo** — em *Dock de recursos*, o botão *Painel completo* abre o painel de recursos completo.

### Vista › Linhas de base e progresso

Este grupo tem o mesmo nome que o de *Planeamento*, mas contém as opções de desenho do Gantt.

- **Sobreposição de linha de base** — mostra a linha de base ativa como uma barra fina por baixo de cada barra de tarefa. Padrão: ligado. Sem linha de base ativa, não há nada a ver.
- **Linha de progresso** — desenha uma linha na data de estado que se desloca para fora em cada tarefa, conforme o progresso da tarefa. Padrão: ligado. Sem data de estado, não há nada a ver. Com a linha de progresso ligada, essa linha também marca a data de estado.
- **Linha da data de estado** — desenha uma linha tracejada na data de estado. Padrão: ligado. Só se vê quando a linha de progresso está desligada, porque senão essa linha ocupa o seu lugar. A etiqueta com a data no cabeçalho mantém-se enquanto pelo menos uma das duas estiver ligada. A etiqueta segue a sua notação de datas, por exemplo 20-09-2006. Se a aplicação calcular em horas, a linha e a etiqueta ficam na hora do dia, e a etiqueta mostra também a hora, por exemplo 20-09-2006 17:00.
- **Cores das barras** — escolhe como as barras são coloridas: *Caminho crítico* (padrão), *Por tarefa — automático* ou *Por categoria*, com uma escolha de campo. Se esse campo não existir neste projeto, o menu indica que a *Categoria de trabalho* é usada temporariamente. Fora de *Caminho crítico*, um contorno vermelho marca o caminho crítico. A escolha aplica-se também ao relatório.
- **Destaque de recurso** — desenha uma tira fina, na cor do recurso, por baixo de cada barra de tarefa sem subtarefas, dividida em proporção às unidades por dia. Padrão: desligado.
- **Banda de folga** — desenha a banda verde depois de uma barra não crítica, até ao fim tardio da tarefa. Padrão: ligado.
- **Linhas de relação** — mostra ou oculta as linhas de relação entre tarefas. Padrão: ligado. A escolha pertence ao documento e ao layout.

## Definições

### Definições › Projeto

- **Definições do projeto** — abre a janela *Definições do projeto*: os metadados do projeto e, no bloco *Perfil de cálculo e opções*, a forma como o projeto calcula. Veja [Novo projeto e Definições do projeto](docs://ref-projectinfo).
- **Definições da app** — abre a janela *Definições da app* com os separadores *Aparência*, *Planeamento* e *Avançado*. As mesmas definições estão em *Ficheiro › Definições da app*.

### Definições › Calendário

O botão *Calendário* é igual ao de *Planeamento*.

### Definições › Atalhos de teclado

- **Atalhos de teclado** — abre a janela *Atalhos de teclado*.

## Tabela

O separador *Tabela* mostra as tarefas como uma tabela completa, em vez do Gantt. Os grupos *Ficheiro*, *Editar*, *Tarefas*, *Agendamento* e *Rastreamento de caminho* são iguais aos de *Início* e *Planeamento* e atuam sobre a mesma seleção. Não há grupo *Zoom*, porque o zoom só aumenta ou diminui a escala temporal do Gantt. Os botões *Dividir tarefa* e *Desenhar relação* estão desativados aqui: não há Gantt.

### Tabela › Colunas

- **Colunas…** — abre o seletor de colunas desta tabela. O mesmo seletor abre com o sinal de mais no cabeçalho da tabela. A dica diz *Escolher as colunas da vista Tabela*. Veja [Ajustar as colunas da tabela](docs://howto-tabelkolommen-aanpassen) e [Colunas da tabela](docs://ref-tabelkolommen).

## IFC

O separador mostra o painel IFC na área de trabalho. O friso não tem botões aqui, só a linha de texto *IFC - Industry Foundation Classes, no esquema do projeto (padrão: IFC 4.3 ADD2)*.

## Relatório

### Relatório › Relatório

- **Imprimir** — só existe neste separador, onde não faz nada porque *Relatório* já está aberto; as escolhas do relatório estão no ecrã do relatório.

## IA

O separador *IA* só existe quando *Ativar modo IA* está ligado (*Definições da app*, separador *Avançado*, cabeçalho *Modo IA*). Padrão: desligado. Ao desligar, o separador desaparece e a ponte para. Um assistente de IA trabalha com o seu planeamento através de uma ponte MCP que aqui se inicia. Veja [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

### IA › Servidor

- **Iniciar ponte** e **Parar ponte** — iniciam ou param a ponte MCP. Ao lado está o estado: *Desligada*, *Ativo na porta …*, *Porta … ocupada* (com o motivo) ou *Erro*. Desativado na versão web; a dica diz *A ponte só funciona na aplicação desktop.* O mesmo estado aparece como um ponto com *IA* na barra de estado.

### IA › Ligação

- **Porta** — a porta da ponte. Padrão: 3877. Só é editável quando o estado é *Desligada* (dica *Só é editável enquanto o servidor estiver parado.*).
- **Token** — a palavra-passe da ponte, mostrada oculta. Pequenos botões *Mostrar token*/*Ocultar token*, *Copiar* e *Novo token*. *Novo token* pede primeiro confirmação, porque um novo token interrompe todas as ligações existentes; se a ponte estiver em execução, reinicia com o novo token.
- **Ligar** — mostra os dados de ligação: ponto final, token, um excerto de configuração e um prompt de ligação que pode colar no seu agente de IA.

### IA › Segurança

- **Pausar** / **Retomar** — recusa temporariamente todas as alterações feitas pela IA; a leitura continua permitida e a ponte continua ativa. O botão fica destacado a vermelho enquanto estiver em pausa.
- **Só leitura** — recusa todas as ferramentas que alteram dados enquanto estiver ativado.
- **Cópia de segurança automática: ligada** / **Cópia de segurança automática: desligada** — grava automaticamente uma cópia de segurança IFC antes da primeira alteração pela IA em cada documento. Padrão: ligado.
- **Criar cópia agora** — grava uma cópia de segurança de imediato e indica o nome do ficheiro. Só na aplicação desktop.
- **Abrir pasta de cópias** — abre a pasta com as cópias de segurança. Só na aplicação desktop.

### IA › Atividade

- **Painel de atividade** — mostra ou oculta o painel *Atividade de IA* com as chamadas à ponte, com os respetivos argumentos e resposta.
