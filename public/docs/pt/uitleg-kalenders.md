# Calendários e dias úteis

Quantos dias úteis leva uma tarefa e em que data termina? Isso depende do calendário em que a aplicação conta. Neste artigo lê o que é um calendário, como a aplicação conta dias úteis com ele e qual calendário prevalece quando intervém mais do que um. O exemplo resolvido ajuda a seguir os números.

## O conceito

Um planeamento conta em **dias úteis**, não em dias de calendário. «Cinco dias de assentamento de tijolo» significa cinco dias em que há trabalho. Um fim de semana ou um feriado não conta, por isso uma tarefa dessas ocupa mais de cinco dias na agenda.

Os dias úteis ficam registados num **calendário**. Um calendário fixa três coisas:

- A **semana de trabalho**: os dias da semana em que há trabalho. Por padrão, são de segunda a sexta-feira.
- Os **tempos de trabalho**: início, fim e pausa. Dão as **horas líquidas por dia**. Por padrão, são das 07:00 às 16:00 com uma hora de pausa, ou seja, 8 horas.
- Os **feriados**: dias isolados ou períodos inteiros em que não há trabalho, como o Dia do Rei, o Natal ou as férias da construção.

Um projeto tem uma biblioteca de recursos, com os seus calendários. Um deles é o **calendário do projeto**. Aplica-se a cada tarefa que não tem calendário próprio. A uma tarefa individual pode dar outro calendário, por exemplo uma semana de trabalho de seis dias para um subempreiteiro que também trabalha aos sábados. Um recurso também pode ter o seu próprio calendário, mas isso faz outra coisa (ver abaixo).

## Como a aplicação calcula

Este artigo descreve o cálculo normal: o perfil de cálculo *Open Planner Studio*, com o qual calcula um projeto novo.

### Contar dias úteis

O primeiro dia útil de uma tarefa conta como dia 1. Uma tarefa de 5 dias termina, portanto, no quinto dia útil. Se o início cair num dia não útil, a tarefa começa no dia útil seguinte. Um feriado ou as férias da construção a meio de uma tarefa não contam: a tarefa simplesmente atravessa esse período e fica mais longa na agenda.

As horas por dia não influenciam as datas de uma tarefa em dias. Só contam a semana de trabalho e os feriados. Os tempos de trabalho só entram em jogo numa tarefa em horas; isso está descrito em [Dias e horas](docs://uitleg-dagen-en-uren).

### Qual calendário prevalece

A aplicação escolhe um calendário por tarefa:

1. Se a tarefa tiver calendário próprio, a aplicação calcula essa tarefa inteiramente nesse calendário: duração, data de fim e folga.
2. Se não tiver, aplica-se o calendário do projeto. Se uma tarefa apontar para um calendário que já não existe, recorre também ao calendário do projeto.

Uma tarefa de resumo (uma fase) não tem trabalho próprio e, por isso, também não tem calendário próprio. A duração resulta das datas das suas tarefas, e a aplicação conta-a no calendário do projeto.

O calendário de um **recurso** não influencia as datas. Num planeamento que cria na aplicação, determina apenas quando o recurso está disponível: no histograma, para a sobrealocação e para o nivelamento.

### Tarefas em calendários diferentes

Quando duas tarefas com calendários diferentes estão vinculadas, aplica-se o seguinte:

- Com uma relação fim-início, a sucessora começa no primeiro dia útil após o fim da predecessora, contado no calendário da **sucessora**. Se uma tarefa terminar numa sexta-feira, uma sucessora com semana de trabalho de seis dias começa no sábado.
- Um **desfasamento** conta por padrão no calendário da **predecessora**. Pode alterar isso em *Definições › Projeto › Definições do projeto*, no bloco *Perfil de cálculo e opções*, em *Opções de cálculo deste projeto*, com o campo *Calendário de atraso*: *Predecessora* (padrão), *Sucessora*, *24 horas* ou *Calendário do projeto*.
- A **folga total** conta em dias úteis do calendário da própria tarefa. Neste perfil, a **folga livre** conta no calendário da sucessora.

O que é exatamente um desfasamento está descrito em [Adicionar relações](docs://howto-relaties-leggen); o que é a folga, em [Caminho crítico e folga](docs://uitleg-kritiek-pad).

### No Gantt

O fundo cinzento no Gantt mostra sempre os dias não úteis do **calendário do projeto**. Uma tarefa com calendário próprio pode, portanto, atravessar um dia cinzento, por exemplo uma tarefa de seis dias que atravessa o sábado. Um bloco de feriados com três dias ou mais de largura mostra o seu nome, por exemplo *Bouwvak (Noord)*. Isso não acontece quando *Mostrar apenas dias úteis* está ativado. Se não quiser ver de todo os dias cinzentos, ative *Mostrar apenas dias úteis* em *Definições › Projeto › Definições da app*, no separador *Aparência*, no cabeçalho *Eixo temporal*.

## Exemplo resolvido: o planeamento da obra

O exemplo usa o calendário habitual *Bouwkalender NL*: de segunda a sexta-feira, com os feriados públicos neerlandeses. Todas as tarefas duram um número inteiro de dias. No tutorial sobre calendários (tutorial 3) cria um calendário desses por si.

### Fim de semana, feriado e férias da construção

*Brickwork* dura 5 dias úteis e começa na quinta-feira, 13 de maio de 2027. A quinta-feira, 13, e a sexta-feira, 14 de maio, são os dias 1 e 2. O fim de semana e a Segunda-feira de Pentecostes, 17 de maio, não contam. A terça-feira, 18, a quarta-feira, 19, e a quinta-feira, 20 de maio, são os dias 3, 4 e 5. A tarefa termina na **quinta-feira, 20 de maio**: oito dias de calendário para cinco dias úteis.

Umas férias da construção tornam a diferença maior. Considere *Bouwvak (Noord)*, de 26 de julho a 13 de agosto de 2027 inclusive, e a mesma tarefa de 5 dias úteis a partir de sexta-feira, 23 de julho. A sexta-feira, 23 de julho, é o dia 1. Depois disso, o calendário fica parado durante três semanas. De segunda-feira, 16, a quinta-feira, 19 de agosto, são os dias 2 a 5. O fim é **quinta-feira, 19 de agosto**, 28 dias de calendário depois do início. Sem as férias da construção, teria sido quinta-feira, 29 de julho.

### Uma tarefa ao sábado

Três tarefas seguem-se umas às outras, todas com uma relação fim-início sem desfasamento: *Groundwork* (4 dias), *Pour foundation* (3 dias) e *Brickwork* (5 dias). O projeto começa na segunda-feira, 24 de maio de 2027.

Se as três estiverem no calendário do projeto, *Groundwork* decorre de segunda-feira, 24, a quinta-feira, 27 de maio. *Pour foundation* decorre de sexta-feira, 28 de maio, a terça-feira, 1 de junho (sexta-feira, segunda-feira, terça-feira). *Brickwork* decorre de quarta-feira, 2 de junho, a terça-feira, 8 de junho. O projeto termina na **terça-feira, 8 de junho**.

Dê a *Pour foundation* o calendário *Six-day week* (de segunda a sábado) e o sábado conta. A tarefa decorre de sexta-feira, 28 de maio, a **segunda-feira, 31 de maio** (sexta-feira, sábado, segunda-feira). *Brickwork* fica no calendário do projeto, começa na terça-feira, 1 de junho, e termina na **segunda-feira, 7 de junho**. O projeto inteiro fica um dia mais curto, porque uma tarefa trabalha ao sábado.

### Um desfasamento entre dois calendários

*Pour floor* (semana de seis dias, 4 dias) começa na segunda-feira, 31 de maio, e termina na quinta-feira, 3 de junho. *Pointing* (calendário do projeto, 3 dias) segue com um desfasamento de 2 dias úteis. Sem o desfasamento, *Pointing* começaria na sexta-feira, 4 de junho.

- Por padrão, o desfasamento conta no calendário da predecessora, a semana de seis dias. A partir de sexta-feira, 4 de junho, sábado, 5 de junho, é o primeiro dia útil e segunda-feira, 7 de junho, o segundo. *Pointing* começa na **segunda-feira, 7 de junho** e termina na quarta-feira, 9 de junho.
- Se definir *Calendário de atraso* como *Sucessora*, conta o calendário do projeto. O sábado então não conta: segunda-feira, 7 de junho, é o primeiro dia útil e terça-feira, 8 de junho, o segundo. *Pointing* começa na **terça-feira, 8 de junho** e termina na quinta-feira, 10 de junho.

### Folga no seu próprio calendário

*Brickwork* (5 dias, calendário do projeto) e *Crane hire* (3 dias, semana de seis dias) começam ambas na segunda-feira, 24 de maio. Ambas são predecessoras de *Fit window frames* (2 dias, calendário do projeto).

*Brickwork* termina na sexta-feira, 28 de maio, por isso *Fit window frames* começa na segunda-feira, 31 de maio. *Crane hire* já terminou na quarta-feira, 26 de maio. A folga total de *Crane hire* conta no seu próprio calendário: quinta-feira, 27, sexta-feira, 28 e sábado, 29 de maio, portanto **3 dias úteis**. Se *Crane hire* estivesse no calendário do projeto, teriam sido 2 dias úteis. A folga livre é de 2 dias úteis (quinta-feira e sexta-feira), porque a aplicação a conta no calendário da sucessora.

### O calendário de um recurso

Noutro projeto de exemplo, o recurso *Bricklaying crew* tem o calendário *Crew Mon–Thu* (de segunda a quinta-feira). Está atribuído com 1 unidade por dia a *Brickwork* (5 dias, calendário do projeto, de segunda-feira, 31 de maio, a sexta-feira, 4 de junho).

As datas de *Brickwork* não mudam. Mas a sexta-feira, 4 de junho, fica a vermelho no histograma, com a mensagem *Não trabalha neste dia segundo o calendário "Crew Mon–Thu"*, e o friso indica um recurso em *Superalocação*. O nivelamento não resolve isto. Deslocar também não ajuda, porque cinco dias úteis seguidos incluem sempre uma sexta-feira. Na janela *Nivelar recursos*, a tarefa aparece por isso em *Conflitos restantes*, com o motivo *O recurso não trabalha em todos os dias que esta tarefa necessita — deslocar não resolve isto.*

## Consequências e mal-entendidos

**«O calendário do recurso desloca as minhas tarefas.»** Não. Um calendário de recurso não altera nenhuma data; apenas torna visível a sobrealocação. Se quiser que a própria tarefa decorra noutros dias, dê à tarefa um calendário próprio.

**«Se eu mudar o calendário do projeto, tudo se desloca.»** Só se deslocam as tarefas sem calendário próprio. Uma tarefa a que atribuiu um calendário da lista mantém-no, mesmo que seja o antigo calendário do projeto. Se eliminar um calendário, as tarefas e os recursos que o usavam recorrem ao calendário do projeto.

**«Os feriados estão lá, não estão?»** Os feriados só existem para os anos para os quais foram criados. Um dia fora desses anos é simplesmente um dia útil. Na caixa de diálogo do calendário, a aplicação indica isso com *Os feriados cobrem 2025–2028; gerar novamente até 2030 inclusive?*

**«Mais horas por dia tornam a minha tarefa mais curta.»** Não numa tarefa em dias: conta dias úteis inteiros, quer o dia tenha 6 ou 8 horas. Só numa tarefa com recursos e com o tipo de tarefa *Trabalho fixo* ou *Unidades fixas* é que a duração muda com isso.

**Um calendário sem dias úteis** não pode ser calculado pela aplicação. O cálculo indica *O calendário não tem dias úteis definidos*.

## Ver também

- [Dias e horas](docs://uitleg-dagen-en-uren): como a aplicação conta o horário de trabalho e o que acontece quando se cruzam tarefas em dias e tarefas horárias.
- [Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen): os passos para criar um calendário próprio e atribuí-lo a tarefas.
- [Gerar feriados e as férias da construção](docs://howto-feestdagen-genereren): preencher os feriados de um país e as férias da construção.
- [Configurar o calendário de um recurso](docs://howto-resourcekalender-instellen): registar a disponibilidade de um recurso.
- [Janelas de calendário](docs://ref-kalenders): todos os campos das janelas de calendário.
