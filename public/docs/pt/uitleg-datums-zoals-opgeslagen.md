# Datas tal como registadas

Abre um planeamento do Primavera ou do MS Project, e as datas são diferentes do que viu nesse programa. A importação correu mal? Normalmente, não. Neste artigo, lê porque é que a aplicação recalcula sozinha, quando mostra as datas do ficheiro, o que fica então vazio e como volta ao seu próprio cálculo. O exemplo no fim acompanha duas tarefas em todo o processo.

## O conceito

Um ficheiro de planeamento contém dois tipos de dados. Primeiro, a lógica: tarefas, durações, relações, calendários e restrições. Segundo, as datas que o próprio programa calculou a partir disso. Ao abrir, o Open Planner Studio usa a lógica e calcula sozinho. Por isso, as datas no ficheiro não são dados de entrada.

Se o cálculo próprio der datas diferentes das indicadas no ficheiro, não se sabe qual dos lados está certo. Pode faltar ao ficheiro a lógica que o programa usou. O programa também pode calcular de forma diferente da aplicação num ponto. Por isso, a aplicação pode mostrar as datas **tal como registadas**: as datas que o outro programa pôs no ficheiro. Assim, compara com o que viu nesse programa.

## Como a aplicação lida com isso

### Qual o perfil de cálculo que a aplicação usa

A aplicação calcula com um **perfil de cálculo**: um conjunto de regras de cálculo (convenções) que decide, por exemplo, como trata o início planeado de uma tarefa e as restrições. Veja [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen). Há três perfis integrados: *Primavera P6*, *Microsoft Project* e *Open Planner Studio*. Um `.xer` abre com *Primavera P6* e um `.mpp` com *Microsoft Project*. CSV, XML do MS Project e XML do Primavera P6 abrem com *Open Planner Studio*. O perfil de um projeto está em *Ficheiro › Definições do projeto*, em *Perfil de cálculo e opções*. Um ficheiro IFC da aplicação mantém o seu perfil.

### Quando a aplicação compara

Ao abrir, a aplicação regista o que o ficheiro dizia e compara isso com o seu próprio resultado. Faz isso para:

- um ficheiro Primavera (`.xer`) e XML do Primavera P6;
- XML do MS Project e ficheiros MS Project (`.mpp`);
- um ficheiro IFC de outro programa, para as tarefas cujos inícios antecipados estão no ficheiro;
- um ficheiro IFC da própria aplicação que memorizou a sua origem. Mais abaixo, veja quando é esse o caso.

A aplicação nunca compara um ficheiro CSV: a data de início num CSV é um dado de entrada, e não o resultado de um cálculo. Também não é comparado um ficheiro IFC da própria aplicação sem origem memorizada.

Se nenhuma tarefa diferir, não nota nada. Se pelo menos uma tarefa diferir num ficheiro que está a importar neste momento, a aplicação ativa a vista de imediato.

Com um ficheiro do Primavera, a aplicação calcula com o perfil de cálculo *Primavera P6*. Assim, mantém o início planeado do ficheiro como início antecipado. Uma tarefa que, no ficheiro, começa mais tarde do que as relações exigem, mas que aí também está planeada, fica por isso onde está: então não há diferença.

### O que vê

Por baixo do friso há uma barra: *Está a ver as datas tal como estão registadas no ficheiro; recalcular deslocaria 4 tarefas.* Com uma origem do Primavera (um `.xer` ou XML do Primavera P6) diz *Está a ver o planeamento tal como o Primavera o registou; recalcular deslocaria 1 tarefa.* À direita da barra está o botão *Recalcular*. A barra não tem cruz.

Há também uma mensagem: *12 tarefas mostram as datas tal como registadas no ficheiro (sem recalcular).* Só com um `.xer` diz *12 tarefas mostram as datas tal como registadas pelo Primavera (sem recalcular).* Esse número conta cada tarefa para a qual o ficheiro registou datas, incluindo as que não diferem. O número de tarefas que diferem depois de recalcular está na barra. Cada tarefa para a qual o ficheiro registou datas mostra um bloco laranja no painel *Propriedades*, logo acima de *Início*: *Vê as datas que o Primavera guardou, e não o cálculo da aplicação.* Com outra origem diz *Vê as datas que estavam no ficheiro, e não o cálculo da aplicação.* Uma segunda linha indica o que acontece a esta tarefa quando recalcula: *Ao recalcular, esta tarefa muda.* ou *Ao recalcular, esta tarefa mantém-se igual.* O Gantt, a tabela de tarefas e a barra de estado mostram as datas do ficheiro.

### Tarefas iniciadas ou concluídas

Uma tarefa concluída fica nos dias em que aconteceu de facto: do início real ao fim real. Uma tarefa em curso começa no dia em que realmente começou. Acaba no fim calculado. Isto vale nesta vista, depois de recalcular e com todos os perfis de cálculo, tal como no Primavera e no MS Project.

Para uma tarefa destas, o ficheiro costuma registar outras datas antecipadas. O Primavera põe o início antecipado de uma tarefa em curso ou concluída na data de estado. Essas datas vê-as nas colunas *Início antecipado* e *Fim antecipado*, e não em *Início* e *Fim*. Uma tarefa concluída, por isso, nunca conta como diferença. Uma tarefa em curso só conta quando o fim diferir.

Para uma tarefa iniciada, já não pode escrever o início. Na tabela de tarefas, no painel *Propriedades* e em *Editar tarefa*, o início fica então em só leitura. Para uma tarefa concluída, isto vale também para o fim na tabela de tarefas. Altere, em vez disso, o *Início real* ou o *Fim real*, com o progresso. No Gantt, a barra de uma tarefa assim não se move; nesse caso aparece uma mensagem.

### O que fica vazio nesta vista

Nesta vista, a aplicação não calcula nada. Mostra apenas o que o ficheiro registou. Por isso, só vê folga e caminho crítico se o ficheiro os contiver. Se o ficheiro não registar tarefas críticas, a barra de estado indica 0 tarefas críticas. Isso não diz nada sobre o caminho crítico no próprio programa. O que só sai de um cálculo não existe nesta vista: que relações comandam o planeamento, restrições violadas, tarefas fora de sequência e tarefas quase críticas.

Se o ficheiro não registar tudo para uma tarefa, o bloco laranja no painel *Propriedades* ganha uma terceira linha, por exemplo *O Primavera não guardou tudo para esta tarefa. Em falta: Folga livre.* Com outra origem diz *O ficheiro não contém tudo para esta tarefa.* As duas primeiras linhas mantêm-se: assim, para uma tarefa destas, também vê que as datas vêm do ficheiro e se a tarefa muda ao recalcular. Os valores em falta têm os mesmos nomes das colunas da tabela de tarefas. Numa exportação CSV, as colunas *Crítica* e *Folga total* ficam vazias nessa tarefa, em vez de um zero inventado.

### Como sair da vista

Pode sair da vista de duas formas:

- Clique em *Recalcular* na barra, ou escolha *Calcular* (F5). A aplicação calcula com as suas próprias regras.
- Altere algo que possa alterar as datas, como a duração de uma tarefa ou uma tarefa nova. A aplicação sai da vista e recalcula de imediato, mesmo que *Calcular automaticamente* esteja desligado. Alterar um nome, uma descrição, uma categoria de trabalho ou um tipo de tarefa não faz isso: a vista continua ativa.

Uma alteração de calendário a partir da biblioteca de recursos mantém a vista ativa e as datas do ficheiro, mas atualiza o número na barra.

Depois de sair, não há botão para voltar a esta vista. O Ctrl+Z traz a vista de volta, logo após o recálculo ou logo após essa edição. Caso contrário, pode abrir de novo o ficheiro de origem. Com um `.xer`, abrir um ficheiro IFC que guardou depois de recalcular, mas sem o editar, também volta a ativar a vista.

### Recuperação após uma falha

Se recuperar um projeto após uma falha que estava na vista, a vista mantém-se ativa. Se a vista estava desligada, a aplicação esquece as datas do ficheiro. O projeto que estava ativo mostra a mesma barra de antes. Um projeto noutro separador mostra a barra sem número: *Está a ver as datas tal como estão registadas no ficheiro. Não foi feito nenhum recálculo.* Veja [Recuperar após uma falha](docs://howto-herstellen-na-een-crash).

### Guardar e reabrir

Se guardar enquanto usa a vista, a aplicação escreve as datas apresentadas no ficheiro IFC, junto com o formato de origem. Se abrir de novo esse ficheiro IFC mais tarde, a vista volta a estar ativa, sem nova mensagem. Isto vale também se tiver alterado algo na vista que não afeta as datas, como um nome. A aplicação abre o ficheiro da maneira como o deixou.

Se guardar depois de sair da vista, ao recalcular ou com uma edição que possa alterar as datas, o ficheiro contém o cálculo da própria aplicação. Ao reabrir, vê esse cálculo, sem barra e sem bloco no painel *Propriedades*. Há uma exceção: um `.xer` que só recalculou e não editou (ver acima). O seu planeamento editado passa a ser o planeamento; as datas antigas do programa de origem já não lhe pertencem. Se ainda quiser vê-las, abra de novo o ficheiro de origem.

## Exemplo trabalhado: a ampliação

Suponha que abre um ficheiro do Primavera *Uitbouw* (ampliação) com duas tarefas, num calendário sem feriados. Em 2027, 6 de maio é a Ascensão e 17 de maio é a Segunda-feira de Pentecostes: com feriados no calendário, as datas ficam diferentes. *Fundering storten* (betonagem da fundação) demora 5 dias úteis, *Metselwerk* (alvenaria) 10 dias úteis, e Metselwerk segue Fundering com uma relação fim-início. O ficheiro regista que Fundering decorre de segunda-feira, 3 de maio, a sexta-feira, 7 de maio de 2027, e Metselwerk de segunda-feira, 17 de maio, a sexta-feira, 28 de maio de 2027: uma semana depois do início antecipado que a relação permite. O início planeado de Metselwerk no ficheiro é segunda-feira, 10 de maio de 2027.

Logo após abrir, vê as datas do ficheiro. A barra de estado indica *Fim: 28-05-2027* e *Caminho crítico: 2 tarefas, 20 dias úteis*. A barra indica que 1 tarefa diverge ao recalcular. Ambas as tarefas mostram o bloco laranja *Vê as datas que o Primavera guardou, e não o cálculo da aplicação.* Por baixo dele, Metselwerk diz *Ao recalcular, esta tarefa muda.* e Fundering diz *Ao recalcular, esta tarefa mantém-se igual.*

Ao clicar em *Recalcular*, Fundering fica de 3 a 7 de maio. Metselwerk passa a começar na segunda-feira, 10 de maio, o dia útil seguinte ao fim de Fundering, e acaba na sexta-feira, 21 de maio. O planeamento acaba a 21 de maio de 2027 e dura 15 dias úteis em vez de 20. O caminho crítico é composto pelas mesmas 2 tarefas.

E se for diferente?

- Se Metselwerk também estiver planeada para segunda-feira, 17 de maio, no ficheiro, o perfil de cálculo *Primavera P6* mantém esse início. O cálculo dá 17 a 28 de maio, não há diferença e a vista não se ativa.
- Adiciona uma tarefa na vista: a aplicação recalcula, e Metselwerk passa para 10 a 21 de maio.
- Guarda na vista e volta a abrir o ficheiro IFC, sem o editar: Metselwerk volta para 17 a 28 de maio.
- Recalcula, guarda sem editar mais e volta a abrir o ficheiro IFC: a vista volta a estar ativa e Metselwerk fica em 17 a 28 de maio.
- Altera só o nome de Metselwerk na vista, guarda e volta a abrir: a vista volta a estar ativa e Metselwerk fica em 17 a 28 de maio.
- Adiciona uma tarefa na vista, guarda e volta a abrir: a aplicação esquece as datas do ficheiro. Metselwerk fica em 10 a 21 de maio, sem barra e sem bloco.
- Fundering já está concluída no ficheiro: o início real foi a 3 de maio e o fim real a 7 de maio. O ficheiro regista a data de estado como início antecipado. A barra de Fundering continua em 3 a 7 de maio, na vista e depois de recalcular. Fundering não conta como diferença.

## Consequências e mal-entendidos

**Uma diferença não é um erro de importação.** A aplicação calcula com as suas próprias regras: com um `.xer` e o perfil de cálculo *Primavera P6*, com um `.mpp` e *Microsoft Project*, com CSV, XML do MS Project e XML do Primavera P6 e *Open Planner Studio*. A razão de as datas do programa de origem terem saído de outra forma pode estar no ficheiro ou no próprio programa. A vista mostra-lhe *que* as datas diferem.

**A vista não é um resultado de cálculo.** A aplicação não calculou as datas. Não as aceite simplesmente como resultado do seu próprio planeamento.

**Guardar na vista mantém as datas do programa de origem.** O ficheiro IFC passa então a conter o que o programa de origem indicava, e não o que a aplicação calcularia.

**Depois de uma edição que pode alterar as datas, as datas do ficheiro não voltam.** Se saiu da vista com essa edição, só vê o cálculo da própria aplicação depois de guardar e reabrir. Alterar um nome não conta: a vista continua ativa (ver *Guardar e reabrir*). Se quiser ver as datas do programa de origem, abra de novo o ficheiro de origem.

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): o que a aplicação guarda num ficheiro e o que uma importação ou exportação transporta.
- [Abrir um ficheiro do Primavera P6 (.xer)](docs://howto-xer-openen): os passos e as mensagens para um ficheiro `.xer`.
- [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen): os passos e as mensagens para um ficheiro `.mpp`.
- [Recuperar após uma falha](docs://howto-herstellen-na-een-crash): o que acontece a este projeto após uma falha.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): como a aplicação calcula a folga e a criticidade, quando faz esse cálculo.
