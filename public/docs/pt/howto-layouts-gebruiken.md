# Criar e usar um layout

Objetivo: alternar entre vistas do seu planeamento com um clique, por exemplo só as tarefas críticas, as tarefas por equipa ou outra ordem de ordenação.

## Quando precisa disto

Na reunião de obra, o cliente quer ver só as tarefas críticas. Depois, o encarregado quer ver por equipa quem é necessário em cada momento. Depois, quer ver o planeamento completo outra vez. Definir filtros, agrupamentos e ordenações repetidamente é trabalhoso. Um **layout** guarda essa vista como um botão no friso.

Um layout pode guardar seis coisas: o filtro, o agrupamento, a ordenação, as colunas da tabela de tarefas ao lado do Gantt, a escala temporal, e as linhas de relação e as sobreposições (linha de base, linha de progresso, linha da data de estado, destaque de recursos, faixa de folga e cores das barras). Ao clicar no botão, só muda o que marcar. O resto da vista mantém-se como está.

Filtra, agrupa e ordena com um layout. Os botões separados *Filtro…*, *Agrupar…* e *Ordenar…* existem agora só numa definição oculta (veja as armadilhas).

## Passos

### Usar um layout existente

1. Escolha o separador *Visualização*. No grupo *Layout* há um botão por layout. Por padrão, é o *Diagrama de recursos*.
2. Clique nele. *Diagrama de recursos* agrupa as tarefas por recurso, ordena dentro de cada grupo pelo início e desliga as linhas de relação. Uma tarefa com dois recursos aparece em ambos.
3. Clique outra vez para desligar o layout. A vista volta ao que era antes do seu clique.

Cada clique é um passo para *Desfazer* (Ctrl+Z), tanto ao ligar como ao desligar.

### Criar um layout próprio

1. No grupo *Layout*, clique em *Novo layout*. Abre-se a janela *Novo layout*.
2. Escreva um *Nome* e escolha um *Ícone*.
3. Por baixo de *O que este layout guarda?* estão as seis partes, cada uma com uma caixa de verificação. Uma janela nova começa com todas as partes marcadas, preenchidas com o que está agora no ecrã. Desmarque tudo o que o layout não deve mudar. Se só quiser um filtro, deixe só *Filtro* marcado. *Assumir a vista atual* preenche outra vez todas as partes com o seu ecrã.
4. Defina as partes.
5. Clique em *Guardar*.

O layout é agora um botão no friso, mas ainda não está aplicado. Clique no botão para o ligar.

### Definir o filtro

Em *Filtro* cria regras. Clique em *+ regra*, escolha um *Campo*, um *Operador* e um valor. Se só quiser as tarefas críticas: campo *Crítica*, operador *é igual a*, valor *Sim*. Os campos incluem *Nome da tarefa*, *Início*, *Fim*, *Folga total*, *Progresso* e *Marco*, mais os seus códigos de atividade e campos e *Recursos*. Os operadores dependem do tipo de campo: para texto pode escolher *contém*, para números e datas *entre*.

Os operadores que obtém dependem do tipo de campo:

- Texto (*Nome da tarefa*, *WBS*): *é igual a*, *é diferente de*, *contém*, *começa por* e *está vazio*.
- Número e data (*Folga total*, *Início*, *Progresso*): *é igual a*, *é diferente de*, *menor que*, *menor ou igual a*, *maior que*, *maior ou igual a*, *entre* e *está vazio*. Com *entre* há dois campos: para um número, *De* e *Até* como sugestão; para uma data, sem sugestão (a primeira data é o início, a segunda o fim).
- Sim/não (*Crítica*, *Marco*, *Quase crítica*): *é igual a* e *é diferente de*, com o valor *Sim* ou *Não*.
- Seleção (*Categoria de trabalho*, um código de atividade): *é igual a*, *é diferente de*, *é um de* (com valores de caixa de verificação) e *está vazio*.
- *Recursos*: *é um de* e *está vazio*.
- *Em andamento*: só *entre*, com duas datas (de e até).

Com o campo *Em andamento*, o operador *entre* e duas datas, obtém todas as tarefas que decorrem em algum momento desse período, por exemplo tudo o que estava ativo em junho.

Combina várias regras com a lista no topo: *Todas as seguintes (AND)* mostra as tarefas que cumprem todas as regras; *Qualquer uma das seguintes (OR)* mostra as tarefas que cumprem pelo menos uma regra. Com *+ grupo* adiciona um subgrupo com as suas próprias regras.

O filtro olha para as próprias tarefas. As fases (tarefas de resumo) a que uma tarefa pertence continuam visíveis a cinzento, para ver onde a tarefa se insere. Se também agrupar, essas fases a cinzento desaparecem.

### Agrupar e ordenar

Em *Agrupar* adiciona um campo com *+ nível*. Há no máximo dois níveis de agrupamento. Sem agrupamento vê a árvore WBS. Em *Ordenar* adiciona um campo com *+ nível* e escolhe *Crescente* ou *Decrescente*. Com dois níveis, o segundo decide quando os valores do primeiro são iguais.

### Testar algo depressa sem botão

Na janela, clique em *Aplicar sem guardar*. As partes marcadas passam para o ecrã, mas não se cria nenhum botão. Isto é prático para um filtro de que só precisa uma vez. Ctrl+Z anula-o.

### Alterar, copiar ou eliminar um layout

Clique com o botão direito no botão do layout. Escolhe *Editar…*, *Duplicar* ou *Eliminar*. *Eliminar* pede primeiro uma confirmação. Uma cópia chama-se *nome (cópia)*. Um layout integrado, como *Diagrama de recursos*, não é possível editar nem eliminar; duplique-o para fazer a sua própria versão.

### Mais do que um layout de cada vez

Layouts que não guardam as mesmas partes podem estar ligados ao mesmo tempo. Se tiver um layout que só guarda o filtro *Crítica é igual a Sim* (chame-lhe, por exemplo, *Só críticas*) e o ligar junto com *Diagrama de recursos* (agrupamento, ordenação, linhas de relação), obtém as tarefas críticas por recurso. Se dois layouts guardarem a mesma parte, por exemplo os dois um filtro, o segundo assume o controlo e o primeiro é desligado. Se desligar outra vez esse segundo, volta à vista de antes do primeiro clique, e não ao primeiro layout.

## Armadilhas e o que a aplicação faz

**Pode esquecer-se de desmarcar partes.** Um layout que também guarda as colunas, a escala temporal e as sobreposições repõe-as no estado guardado a cada clique. O zoom então salta para outro lado, quando só queria um filtro. Verifique na janela que só estão marcadas as partes pretendidas.

**Uma regra incompleta não mostra nada.** Se não escolher um valor para um campo de sim/não (continua a indicar *—*) ou deixar vazias as datas de *Em andamento*, nenhuma tarefa corresponde e a lista fica vazia. Complete a regra.

**Uma alteração manual desliga o layout.** Se alterar manualmente uma parte que o layout guarda, por exemplo *Linhas de relação* enquanto o *Diagrama de recursos* está ligado, esse layout sai e as outras partes voltam à vista de antes do layout. Ao fazer zoom desliga-se um layout que guarda a escala temporal, e ao alargar uma coluna desliga-se um layout que guarda as colunas. O resto da vista mantém-se como está. O Diagrama de recursos não guarda a escala temporal, por isso o zoom não o afeta.

**As colunas aplicam-se à tabela de tarefas ao lado do Gantt.** A parte *Colunas* guarda as colunas da tabela à esquerda da linha temporal. A tabela no separador *Tabela* mantém as suas próprias colunas. Como escolher colunas está em [Ajustar colunas da tabela](docs://howto-tabelkolommen-aanpassen).

**Avançar e diminuir indentação estão desativados.** Enquanto houver um filtro, agrupamento ou ordenação ativos, a ordem mostrada não é a ordem do planeamento. *Avançar* e *Diminuir indentação* ficam então desativados, com a dica *Não disponível durante a filtragem/agrupamento/ordenação*. Desligue o layout para voltar a ajustar a estrutura, como descrito em [Ajustar a estrutura](docs://howto-structuur-aanpassen).

**A barra de estado não acompanha.** *Tarefas:* na barra de estado mostra o número de tarefas de todo o projeto, mesmo que um filtro mostre só parte delas.

**Os layouts ficam no seu dispositivo, não no projeto.** A aplicação guarda os seus layouts e as colunas para todos os seus projetos neste dispositivo. As sobreposições de um layout (linha de base, linha de progresso e as restantes) aplicam-se a todos os seus projetos. O filtro, o agrupamento e a ordenação que estão ativos neste momento pertencem ao projeto aberto, mas não entram no ficheiro do projeto: depois de guardar e reabrir, a vista fica outra vez limpa. Também não deixam o projeto como «modificado».

**Os botões separados estão ocultos.** *Colunas…*, *Filtro…*, *Agrupar…* e *Ordenar…* como botões separados no separador *Visualização* são uma vista antiga. Pode voltar a mostrá-los com *Mostrar os botões de vista clássicos* em *Funcionalidades legadas* no separador *Avançado* da janela *Definições da app* (⚙ na barra de título). Prefira os layouts.

## Veja também

- [Ajustar colunas da tabela](docs://howto-tabelkolommen-aanpassen): escolher, mover e fixar as próprias colunas.
- [Criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken): pôr a vista em papel com *Seguir vista*.
- [Ajustar a estrutura](docs://howto-structuur-aanpassen): porque não é possível avançar durante a filtragem.
