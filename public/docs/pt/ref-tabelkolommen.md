# Colunas da tabela

A tabela de tarefas tem 86 colunas fixas, mais uma coluna por código de atividade e por campo personalizado do projeto, e oito colunas por linha de base. Este artigo indica, para cada coluna, o que mostra, se pode editá-la e em que formato é escrito o valor. Como escolher e dispor as colunas explica-se em [Personalizar colunas da tabela](docs://howto-tabelkolommen-aanpassen).

## Onde escolhe as colunas

A tabela de tarefas ao lado do Gantt e a tabela no separador *Tabela* têm, cada uma, a sua própria escolha de colunas. O sinal de mais à direita do cabeçalho abre o seletor de colunas (título da janela *Escolher coluna*); no separador *Tabela* pode também usar *Tabela › Colunas › Colunas…*. O seletor lista as colunas por categoria: *Tarefa*, *Planeamento*, *Restrições*, *Relações*, *Recursos*, *Progresso*, *Calculado*, *Linha de base*, *Personalizado* e *Técnico*. Pode procurar pelo nome, e *Usadas recentemente* fica no topo. *Repor predefinição* restaura as colunas padrão.

Por padrão, a tabela ao lado do Gantt mostra *WBS*, *Nome da tarefa* e *Duração*. A tabela do separador *Tabela* mostra *WBS*, *Nome da tarefa*, *Duração*, *Início*, *Fim*, *Categoria de trabalho*, *Crítica*, *Folga total* e *Progresso*, mais uma coluna por código de atividade e campo personalizado do projeto.

## Como os valores são lidos e editados

- **Colunas calculadas** — as colunas da categoria *Calculado* e algumas outras são só leitura: vêm do cálculo. Se tentar editar uma célula só leitura, a aplicação indica *Esta coluna calculada não pode ser editada*. Esta é a mensagem geral para cada célula só leitura, também quando a coluna não é calculada. Se estiverem desatualizadas por ter alterado algo, aparece *obsoleto* ao lado delas até premir *Calcular*.
- **Datas** — aparecem no formato que escolheu em *Definições da app*, separador *Aparência*, secção *Formato de data*.
- **Durações e folga** — uma duração aparece na unidade da tarefa (`5d`, `12h`) ou segundo *Exibição da duração* no mesmo separador (*Automática (unidade própria por tarefa)*, *Sempre dias* ou *Sempre horas*). A folga aparece em dias úteis, com duas casas decimais e com o separador decimal da sua língua.
- **Sim/Não** — um valor sim/não aparece como *Sim* ou *Não*; um valor vazio aparece como travessão (—).
- **Edição** — escreva ou escolha um valor. Um valor inválido é recusado, com um motivo debaixo da célula, por exemplo *Introduza uma duração válida, como 5d ou 8h.* ou *Introduza uma percentagem entre 0 e 100.* Colar um bloco de células funciona célula a célula; as células só leitura são ignoradas e a aplicação indica quantas.

## Tarefa

- **Nome da tarefa** — o nome da tarefa. Editável; obrigatório. Uma tarefa de resumo aparece a negrito, com um fundo ligeiramente colorido na célula do nome; um marco aparece a negrito na cor de marco (da mesma família de cores do marco no Gantt). Uma tarefa comum fica como está. Isto é só formatação: selecionar, arrastar e editar funcionam da mesma forma.
- **Descrição** — a descrição. Editável; texto livre.
- **WBS** — o código WBS. Editável e obrigatório, mas só leitura enquanto *WBS auto* estiver ativo.
- **Categoria de trabalho** — a categoria de trabalho (*Construção*, *Instalação*, *Demolição*, *Logística*, *Inspecção*, *Transferência*, *Renovação*, *Manutenção* ou *Outro*). Editável com uma lista.
- **Categoria de trabalho personalizada** — a categoria de trabalho personalizada do projeto, ou um travessão. Editável com uma lista das categorias de trabalho personalizadas do projeto.
- **Cor** — a cor guardada da tarefa, como código de cor, por exemplo `#1a73e8`. Editável com um seletor de cores. Fica guardada no ficheiro IFC, mas nenhuma barra ou relatório a usa; defina as cores das barras em *Visualização › Linhas de base e progresso › Cores das barras*.
- **Notas** — as notas no formato `✓ texto; ○ texto`. Editáveis enquanto houver no máximo uma nota (edita-se então o seu texto); com mais notas, só leitura.

## Planeamento

- **Marco** — se a tarefa é um marco. Editável. Ao ativá-lo, a duração passa a 0; a aplicação recusa-o para uma tarefa de resumo e para uma tarefa com atribuições.
- **Tipo de marco** — *Marco de início* ou *Marco de fim*, ou um travessão para automático. Só editável num marco.
- **Marco obrigatório** — o indicador *Obrigatório (contratual)*. Só editável num marco.
- **Prioridade de nivelamento** — um número inteiro de 0 a 1000, por padrão 500. Editável. 1000 fixa a tarefa para o nivelamento.
- **Lacunas de divisão** — o número de interrupções, como `Lacunas de divisão: 2`, ou um travessão. Só leitura; edite-as no painel *Propriedades*.
- **Tipo de tarefa** — o tipo de tarefa; vazio é o padrão do projeto. Editável com uma lista, mas vazio e só leitura num marco, numa tarefa de resumo ou numa hammock. Só aparece no seletor quando os tipos de tarefa estão visíveis (*Usar tipos de tarefa*, ou o ficheiro contém tipos de tarefa).
- **Hammock (duração derivada)** — se a tarefa é uma hammock. Editável, exceto num marco ou numa tarefa de resumo.
- **Calendário** — o ID do calendário próprio da tarefa; vazio (—) é o calendário do projeto. Escreva ou escolha um ID entre as sugestões; um ID desconhecido é recusado. Nota: a célula mostra, de momento, o ID interno em vez do nome; é melhor escolher um calendário no painel *Propriedades*.
- **Tipo de duração** — *Tempo de trabalho* (a duração conta em dias úteis ou em horário de trabalho do calendário) ou *Tempo decorrido* (a duração conta em tempo de relógio contínuo, sem calendário). Editável.
- **Unidade da duração** — *Dias* ou *Horas*. Editável, exceto numa tarefa de resumo, numa hammock ou num marco; a troca só funciona se a conversão for exata e *Ativar planeamento por horas* estiver ativo.
- **Duração** — a duração da tarefa, na unidade da tarefa ou segundo *Exibição da duração*. Editável: escreva `5d`, `12h` ou `1h 30m`; também um número na unidade da tarefa. Em só leitura numa tarefa de resumo, numa hammock e num marco com duração 0.
- **Início** — o início mostrado, a mesma data que a barra do Gantt. Para uma tarefa que já começou, é o início real. Editável. Uma tarefa com predecessora, à qual atribui um novo início, recebe a restrição *Não começar antes de (SNET)* nessa data. Em só leitura numa tarefa de resumo ou numa hammock, salvo se estiver agendada manualmente, e numa tarefa que já começou (*Esta tarefa já começou; o seu início é o início real. Altere-o através do progresso*).
- **Fim** — o fim mostrado. Para uma tarefa concluída, é o fim real. Editável: um novo fim torna-se uma nova duração. A aplicação recusa-o para um marco, uma tarefa em tempo decorrido e uma tarefa com interrupções, e para um fim anterior ao início (*O fim é anterior ao início*). Em só leitura numa tarefa de resumo ou numa hammock, salvo se estiver agendada manualmente, e numa tarefa concluída (*Esta tarefa está concluída; o seu fim é o fim real. Altere-o através do progresso*).
- **Início planeado** — a âncora de planeamento a partir da qual o cálculo parte (não é necessariamente o início mostrado). Editável; tem o mesmo efeito que escrever em *Início*.
- **Fim planeado** — o fim introduzido. Só editável numa tarefa agendada manualmente; caso contrário, a aplicação indica *O fim planeado só se aplica a uma tarefa agendada manualmente. Altere o fim através da coluna Fim ou da duração*.

## Restrições

- **Tipo de restrição** — o tipo da restrição, de *O mais cedo possível (ASAP)* a *Deve terminar em (MFO)*. Editável; uma tarefa sem restrição mostra *ASAP*.
- **Data da restrição** — a data da restrição. Editável.
- **Restrição rígida** — o indicador *Obrigatório (fixação de data)*. Só editável em *MSO* e *MFO*.
- **Tipo de restrição secundária** — o tipo do segundo limite, ou um travessão. Editável; a tabela oferece todos os tipos, mas uma combinação não permitida é recusada: tem de ser *SNET*, *FNET*, *SNLT* ou *FNLT*, a restrição principal tem de ser um limite (não *ASAP*, *ALAP*, *MSO*, *MFO* nem uma restrição rígida) e os dois têm de limitar lados opostos (um limite inferior *SNET*/*FNET* com um limite superior *SNLT*/*FNLT*, ou o inverso).
- **Data da restrição secundária** — a data do segundo limite. Editável.
- **Prazo** — a data-alvo do fim. Editável.

## Relações

- **Predecessoras** — as predecessoras, no formato `WBS type±lag`, separadas por `; `, por exemplo `1.2 FS+2d`. Editável ao escrever no mesmo formato. Uma relação externa não se adiciona aqui, mas com *Planeamento › Relações › Vincular › Adicionar relação externa…*.
- **Sucessoras** — as sucessoras, no mesmo formato. Editável.
- **Relações determinantes** — as relações que determinam a data desta tarefa, como `← 1.2` (predecessora) ou `→ 1.4` (sucessora). Só leitura; aparece *obsoleto* até premir *Calcular*.
- **Folga livre** (na categoria *Relações*) — a folga livre por relação, como `← 1.2: 3d`. Não é a mesma coluna que *Folga livre* em *Calculado*, que mostra a folga da própria tarefa. Só leitura.
- **Avisos** — avisos por relação, por exemplo *Fora de sequência* ou *Não incluída no cálculo*. Só leitura. Veja [Notificações e avisos](docs://ref-meldingen).

## Recursos

- **Recursos atribuídos** — os nomes dos recursos atribuídos, separados por vírgulas. Editável: ao acrescentar um nome, o recurso fica atribuído com 1 unidade por dia; ao remover um nome, a atribuição é eliminada. Em só leitura num marco ou numa tarefa de resumo.
- **Unidades de atribuição por dia** — as unidades por recurso, como `Name: 1; Name: 0,5`, com no máximo duas casas decimais. O valor guardado mantém-se exato. Editável numa tarefa com atribuições.
- **Unidades planeadas por dia** — o valor planeado por recurso, como `Name: 1.11`, com no máximo duas casas decimais, como em *Unidades de atribuição por dia*. Só para uma atribuição de Primavera P6 com um valor restante diferente; *Unidades de atribuição por dia* mostra então o valor restante. Só leitura.
- **Curva de atribuição** — a curva por recurso, como `Name: Uniforme`. Editável numa tarefa com atribuições.
- **Início da janela de trabalho** e **Fim da janela de trabalho** — a janela de trabalho por recurso, de um ficheiro importado, como `Name: data`. Só leitura.
- **Trabalho previsto (horas)** e **Trabalho real (horas)** — o trabalho previsto e real por recurso em horas, como `Name: 617,14`, com no máximo duas casas decimais, de um ficheiro importado. Só leitura.
- **Trabalho restante (horas)** — o trabalho restante por recurso em horas, como `Name: 6` ou `Name: 26,67`: o trabalho guardado; caso contrário, duração restante × unidades. Editável numa tarefa com atribuições à qual se aplica um tipo de tarefa, com vírgula ou ponto como separador decimal. Só aparece no seletor quando os tipos de tarefa estão visíveis. Um ⚠ amarelo na célula indica que o trabalho guardado difere de unidades × duração restante, como o ⚠ em *Trabalho (rest.)* no painel da tarefa.

## Progresso

- **Estado** — *Não iniciada*, *Em andamento* ou *Concluída*. Editável, exceto numa tarefa de resumo.
- **Progresso** — a percentagem, como `40%`. Editável com um número de 0 a 100, exceto numa tarefa de resumo.
- **Início real** — a data em que a tarefa começou. Editável, exceto numa tarefa de resumo.
- **Fim real** — a data em que a tarefa foi concluída. Editável, exceto numa tarefa de resumo.
- **Duração real** — a duração real, como número. Editável, exceto numa tarefa de resumo.
- **Restante** — a duração restante, na unidade da tarefa. Editável, exceto numa tarefa de resumo.
- **Data de retoma** e **Data de paragem** — a retoma e a paragem de uma tarefa em curso, de um ficheiro do MS Project ou do Primavera. Só leitura.

As colunas de progresso seguem as regras de progresso da aplicação: uma data real posterior à data de estado é recusada. Numa tarefa de resumo, a aplicação indica *O progresso de uma tarefa de resumo é derivado das suas subtarefas e não pode ser alterado aqui.*

## Calculado

Todas as colunas desta categoria são só leitura.

- **Atraso de nivelamento** — em quantos dias úteis o nivelamento atrasou a tarefa; um travessão se não tiver sido aplicado nenhum nivelamento.
- **Início antecipado** e **Fim antecipado** — as datas mais cedo do cálculo. Numa tarefa que já começou, podem ser diferentes de *Início* e *Fim*: o perfil de cálculo *Primavera P6* põe o início antecipado de uma tarefa em curso ou concluída na data de estado.
- **Início tardio** e **Fim tardio** — as datas mais tardias em que a tarefa ainda pode começar ou acabar sem atrasar o projeto.
- **Folga livre** — os dias úteis em que a tarefa pode atrasar-se sem atrasar uma sucessora.
- **Folga total** — os dias úteis em que a tarefa pode atrasar-se sem atrasar o fim do projeto. Negativa se uma restrição ou um prazo não puder ser cumprido.
- **Crítica** — *Sim* se a tarefa estiver no caminho crítico.
- **Folga interferente** — folga total menos folga livre.
- **Quase crítica** — *Sim* numa tarefa quase crítica. Só é preenchida se *Marcar quase crítico* estiver ativo (*Definições do projeto*, bloco *Perfil de cálculo e opções*); caso contrário, um travessão.
- **Caminho de folga** — o número do caminho de folga; 1 é o mais crítico. Só é preenchido se *Múltiplos caminhos de folga* estiver ativo; caso contrário, um travessão.
- **Origem das datas registadas** — enquanto a aplicação mostrar as datas do ficheiro: *Parcialmente não registado* numa tarefa para a qual o ficheiro não contém tudo. Só aparece no seletor nessa vista. Num eixo não registado, *Não registado* aparece nas colunas de datas tardias e de folga.

Veja [Caminho crítico e folga](docs://uitleg-kritiek-pad).

## Linha de base

Para cada linha de base do projeto são acrescentadas colunas, com o nome da linha de base à frente do nome da coluna (`<baseline> — Início planeado`). São só leitura. Uma tarefa que não está na linha de base mostra um travessão, com a dica *Não existe nesta linha de base*.

- **Início planeado**, **Fim planeado** e **Duração** — o início, o fim e a duração tal como a linha de base os registou.
- **Desvio de início** e **Desvio de fim** — o número de dias úteis entre a linha de base e o início ou fim mostrado, no calendário do projeto; positivo se a tarefa estiver mais tarde.
- **Desvio de duração** — a duração atual menos a duração na linha de base, em dias úteis.

## Personalizado

- **Código de atividade** — uma coluna por código de atividade, com o nome do código. Mostra o código do valor escolhido. Editável: escreva o código ou escolha-o entre as sugestões; um código desconhecido é recusado, e se um código ocorrer mais do que uma vez, a aplicação pede que o escolha na lista.
- **Campo personalizado** — uma coluna por campo personalizado, com o nome. A entrada corresponde ao tipo: texto, número, inteiro, custo, data ou sim/não. Editável.

Estas colunas pertencem ao projeto em que está o código ou o campo. Veja [Códigos e campos personalizados](docs://howto-codes-en-velden).

## Técnico

Todas as colunas desta categoria são só leitura. Mostram dados que a aplicação guarda, mas não mostra numa coluna comum, por exemplo para verificar uma importação.

- **ID da tarefa** — o ID interno da tarefa.
- **ID da tarefa-mãe** e **IDs das tarefas-filhas** — os IDs da tarefa-mãe e das tarefas-filhas.
- **IDs dos recursos** — os IDs dos recursos da tarefa.
- **ID da atribuição**, **ID da tarefa da atribuição** e **ID do recurso da atribuição** — os IDs das atribuições, tarefas e recursos desta tarefa.
- **Duração (minutos)** e **Restante (minutos)** — a duração e a duração restante em minutos; só preenchidas numa tarefa em horas.
- **Atraso de nivelamento (minutos)** e **Atraso de nivelamento decorrido** — o atraso de nivelamento do MS Project em minutos, e se conta em tempo de relógio.
- **Agendada manualmente** — se a tarefa está agendada manualmente.
- **Tipo de tarefa do MS Project (importação)** e **Orientada pelo esforço** — o tipo de tarefa e o indicador de orientação pelo esforço tal como o MS Project os tinha.
- **Proveniência do Primavera P6** — os campos de origem de um ficheiro do Primavera, como `key: value`.
- **Tarefa de resumo explícita** — se a tarefa é um resumo explícito sem subtarefas (de um ficheiro do Primavera).
- **Limite do fim com distribuição temporal**, **Âncora do início com distribuição temporal**, **Segmentos de duração com distribuição temporal** e **Contornos com distribuição temporal** — a distribuição por horas de um ficheiro do MS Project, como datas e contagens.
- **Dados de códigos de atividade**, **Dados de campos personalizados** e **Dados de notas** — o número de atribuições de códigos, campos personalizados e notas.
- **Dados de relações internas** e **Dados de relações externas** — o número de relações internas e externas.
- De cada linha de base, **Marco** e **Tipo de marco** também estão aqui, tal como a linha de base os registou.
