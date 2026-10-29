# Perfis de cálculo e convenções

O mesmo planeamento pode dar datas diferentes, consoante as regras de cálculo que aplicar. Este artigo explica porque é que o Primavera P6 e o Microsoft Project calculam de forma diferente em alguns pontos, como a aplicação regista essa diferença num **perfil de cálculo** e em que se distingue um perfil das opções de cálculo que define para cada projeto. Um exemplo resolvido com uma rede pequena mostra o efeito nas datas.

## O conceito

Tarefas, relações e um calendário decidem a maior parte de um planeamento, mas não tudo. O que acontece ao trabalho que ainda não começou quando define uma data de estado? Onde começa o trabalho restante de uma tarefa que já está em curso? Qual é a folga livre de uma tarefa quando um prazo não é cumprido? A rede não diz nada sobre isso. Um programa de planeamento tem de escolher uma regra para cada caso. A aplicação conhece vários pontos em que a regra do Primavera P6 e a do Microsoft Project diferem.

A aplicação chama a cada uma dessas escolhas uma **convenção**. Um **perfil de cálculo** é o conjunto de convenções que pertence a um programa. A aplicação tem três:

- *Open Planner Studio*: o perfil com que calcula um projeto novo. Nenhuma convenção está ativa.
- *Primavera P6*: as convenções que a aplicação conhece do P6.
- *Microsoft Project*: as convenções que a aplicação conhece do Microsoft Project.

Assim, o perfil indica como um programa calcula. O que pretende para o seu projeto não faz parte dele. Essas são as **opções de cálculo**: escolhas como a folga com que uma tarefa fica crítica, ou em que calendário conta um desfasamento. Estas define-as para cada projeto.

## Como a aplicação calcula

### Convenções e opções de cálculo

Uma convenção é um interruptor: ativo ou inativo. O perfil decide quais os interruptores que estão ativos. Uma opção de cálculo é uma escolha que se faz. Pode ver a diferença na própria aplicação, no bloco *Perfil de cálculo e opções*:

- **Convenções** estão em *Convenções deste perfil*, agrupadas por tema, por exemplo *Progresso e trabalho concluído*, *Relações e defasagem* e *Folga e datas mais tardias*. Esta parte começa fechada. O cabeçalho mostra quantas convenções existem e, se o perfil for diferente, a etiqueta *alterado: 1*. Clique no cabeçalho para o expandir. Com um perfil incorporado, cada linha tem a etiqueta *ativa* ou *inativa*. Estes valores são apenas informativos e não se podem alterar. Com um perfil personalizado, cada linha tem uma caixa de verificação, com o valor base a seguir (*base: ativa* ou *base: inativa*). Se a sua escolha for diferente, a linha fica em destaque e aparece *voltar à base*. O ícone i a seguir a uma linha abre a explicação dessa convenção. Aponte para ele com o rato, vá até ele com Tab ou toque nele. Leia primeiro essa explicação se quiser alterar uma convenção. Se uma convenção só funcionar com planeamento por horas ou só em tarefas de um ficheiro .xer, uma etiqueta azul ao lado indica-o: *apenas com planeamento por horas* ou *apenas tarefas de .xer*. Planeamento por horas significa: um calendário com faixas de trabalho, uma tarefa cuja duração está em horas, ou o *Calendário de atraso* definido para *24 horas*. Um projeto só com um calendário de dias e tarefas em dias não é afetado por uma convenção com a etiqueta *apenas com planeamento por horas*, a menos que o *Calendário de atraso* esteja em *24 horas*. Nesse caso, um desfasamento conta em horas, e uma convenção sobre desfasamentos pode alterar alguma coisa.
- **Opções de cálculo** estão em *Opções de cálculo deste projeto*: entre outras, *Definição de crítico*, *Cálculo da folga*, *Tarefas de extremidade aberta críticas*, *Marcar quase crítico* e *Calendário de atraso*. Indicam o que pretende para este projeto, e não como um programa calcula. O que fazem está explicado em [Caminho crítico e folga](docs://uitleg-kritiek-pad) e [Relações e desfasamento](docs://uitleg-relaties).

Um exemplo de cada. «Uma tarefa é crítica se a sua folga total for 0 ou menos» é uma opção de cálculo: pode definir o limiar para 4, e então tudo o que tenha 4 dias úteis de folga ou menos fica crítico. «O trabalho que ainda não começou passa para a data de estado» é uma convenção: o Open Planner Studio e o Primavera P6 fazem-no, o Microsoft Project não.

O perfil e as opções de cálculo pertencem ao ficheiro do projeto, não à aplicação. Se guardar o projeto, seguem com ele. Dois projetos na mesma aplicação podem, por isso, calcular com perfis diferentes. Um projeto sem perfil calcula como Open Planner Studio.

Se o seu projeto vier de um ficheiro .xer, o bloco mostra também, em baixo, *Definições do ficheiro de origem*: opções de cálculo que só o Primavera conhece e que o ficheiro trouxe. Aqui não as pode alterar. O botão das definições padrão e a escolha de outro perfil também as deixam como estão. Um projeto novo não as tem, nem com *Primavera P6*.

### Onde escolhe o perfil

Para um projeto novo, o perfil está na janela *Novo projeto*, que se abre através de *Início › Ficheiro › Novo*. Aí, *Perfil de cálculo* é uma lista pendente. Se escolher um perfil aí, a aplicação substitui as opções de cálculo que já tinha preenchido pelo padrão desse perfil; só ficam as definições de um ficheiro de origem. Com *Primavera P6*, *Cálculo da folga* passa a ser *Folga de fim*. Com *Microsoft Project* e *Open Planner Studio*, cada opção de cálculo está no seu valor padrão, por isso *Cálculo da folga* é *Automático (predefinido)*. Com uma data de estado, é também assim que o próprio MS Project calcula: uma tarefa iniciada fica com a folga de fim, e cada outra tarefa com a menor das folgas de início e de fim.

Num projeto existente, escolhe o perfil em *Definições › Projeto › Definições do projeto*, no bloco *Perfil de cálculo e opções*, na lista pendente *Perfil de cálculo*. Também chega ao mesmo sítio por *Ficheiro › Definições do projeto*. Se mudar o perfil aqui, só mudam as convenções. As suas opções de cálculo mantêm-se como estão. Se as suas opções de cálculo forem diferentes do padrão do perfil, um bloco laranja acima das opções indica-o. Isso é muitas vezes intencional, por exemplo porque as opções vêm do ficheiro aberto. Se mesmo assim quiser o padrão, escolha *Usar as definições padrão de …* nesse bloco. A cruz oculta o bloco para este ficheiro aberto.

Até premir *Aplicar*, uma alteração existe só no formulário. Com *Aplicar*, a aplicação recalcula o planeamento de imediato, mesmo que *Calcular automaticamente* esteja desligado. Se tarefas se deslocarem, indica quantas, por exemplo *Após aplicar, 4 tarefas foram deslocadas.* Toda a alteração é um só passo para *Desfazer*. Se premir *Desfazer* ou *Refazer* com a janela *Definições do projeto* aberta, o bloco acompanha o estado do projeto. Se já tiver alterado algo no bloco, a sua escolha mantém-se, e um bloco amarelo indica que *Aplicar* repõe essa escolha.

Os três perfis incorporados não se podem alterar. Para outras convenções, cria um perfil personalizado; pode também guardá-lo como modelo para outros projetos desta aplicação. O projeto tem sempre a sua própria cópia: se alterar o modelo mais tarde, o projeto não muda com ele. Os passos estão em [Escolher ou criar um perfil de cálculo](docs://howto-rekenprofiel-kiezen).

### Quando a aplicação escolhe um perfil sozinha

Ao abrir um ficheiro, a aplicação sugere um perfil com base no formato:

- Um ficheiro .mpp (Microsoft Project) abre com o perfil *Microsoft Project*.
- Um ficheiro .xer (Primavera P6) abre com o perfil *Primavera P6*.
- Um ficheiro no formato *MS Project XML*, *Primavera P6 XML* ou *CSV (separado por ponto e vírgula)* abre com *Open Planner Studio*, sem mensagem sobre o perfil.
- O seu próprio projeto (.ifc) abre com o perfil que está guardado nele.

Para um ficheiro .mpp ou .xer, a aplicação indica o perfil: *Este projeto calcula como Microsoft Project. Altere em Ficheiro → Informações do projeto → Perfil de cálculo e opções.* O botão *Abrir perfil de cálculo* na mensagem leva diretamente às Definições do projeto. Para um ficheiro .xer, esta linha é a primeira linha de detalhe da mensagem de abertura do ficheiro. Mais informação sobre a mensagem está em [Abrir um ficheiro do Primavera P6 (.xer)](docs://howto-xer-openen) e [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen).

Para um ficheiro .mpp, a aplicação só define o perfil. As opções de cálculo ficam vazias, tal como num projeto novo com o perfil *Microsoft Project*: *Cálculo da folga* é *Automático (predefinido)*. Um ficheiro .mpp aberto e um projeto novo com *Microsoft Project* calculam, por isso, a folga da mesma forma.

## Exemplo resolvido: uma rede, três perfis

O exemplo é uma rede pequena. O calendário tem uma semana útil de segunda-feira a sexta-feira, e nestas semanas não há dias não úteis. O modo de progresso é Retained Logic (o padrão). O início do projeto é segunda-feira, 7 de junho de 2027. Todas as tarefas estão em dias úteis.

- *Pour foundation*: 5 dias úteis, planeada a partir de segunda-feira, 7 de junho.
- *Lay walls*: 5 dias úteis, depois de *Pour foundation* (relação fim-início).
- *Order window frames*: 3 dias úteis, sem predecessora, planeada a partir de segunda-feira, 7 de junho.
- *Fit roof*: 2 dias úteis, depois de *Lay walls* e depois de *Order window frames*. O fim desta tarefa é a entrega.

Os números foram calculados com o motor de cálculo da aplicação. Pode lê-los no painel *Propriedades*, em *Resultado CPM*.

**Sem data de estado e sem progresso, os três perfis calculam esta rede da mesma forma.** *Pour foundation* decorre de segunda-feira, 7, a sexta-feira, 11 de junho, *Lay walls* de segunda-feira, 14, a sexta-feira, 18 de junho, e *Fit roof* na segunda-feira, 21, e na terça-feira, 22 de junho. A entrega é terça-feira, 22 de junho. *Order window frames* (de segunda-feira, 7, a quarta-feira, 9 de junho) tem 7 dias úteis de folga total.

Agora regista-se o estado. A data de estado é quarta-feira, 9 de junho. *Pour foundation* começou na segunda-feira, 7 de junho e está em 60 %. O trabalho restante é, portanto, 2 dias úteis (5 × 40 %). *Order window frames* ainda não começou. O funcionamento de [progresso e data de estado](docs://uitleg-voortgang) está explicado nesse artigo. Aqui a questão é o que o perfil faz com isso.

### Open Planner Studio

O trabalho restante de *Pour foundation* começa na data de estado: quarta-feira, 9, e quinta-feira, 10 de junho. O início antecipado mantém-se como início real, segunda-feira, 7 de junho. O fim antecipado é quinta-feira, 10 de junho. *Lay walls* decorre de sexta-feira, 11, a quinta-feira, 17 de junho, e *Fit roof* na sexta-feira, 18, e na segunda-feira, 21 de junho.

*Order window frames* estava planeada para segunda-feira, 7 de junho, mas ainda não começou. Trabalho que ainda não começou não pode ficar no passado. Por isso, a aplicação move-o para a data de estado: de quarta-feira, 9, a sexta-feira, 11 de junho, com 4 dias úteis de folga total. A entrega é segunda-feira, 21 de junho.

### Primavera P6

Tudo é igual ao Open Planner Studio, com um ponto diferente: o início antecipado de *Pour foundation* é quarta-feira, 9 de junho. É o início do trabalho restante, e não o início real. Isto resulta da convenção *Tarefa em curso: início antecipado = início do trabalho restante*, no grupo *Progresso e trabalho concluído*. O fim e a folga não mudam por causa disso. A entrega é segunda-feira, 21 de junho.

### Microsoft Project

Aqui as datas são diferentes. Duas convenções do grupo *Progresso como no Microsoft Project* causam isso.

*Não mover tarefas não iniciadas para a data de estado*: *Order window frames* mantém-se de segunda-feira, 7, a quarta-feira, 9 de junho, embora isso fique em parte antes da data de estado. A folga total é de 7 dias úteis.

*O trabalho restante retoma após a duração decorrida*: o trabalho restante não começa antes da data de estado, nem antes do início real mais o tempo já decorrido. Com 60 % de 5 dias úteis, estão feitos 3 dias úteis. Segunda-feira, 7 de junho, mais 3 dias úteis, é quinta-feira, 10 de junho. Isso é depois da data de estado, por isso o trabalho restante decorre na quinta-feira, 10, e na sexta-feira, 11 de junho. *Lay walls* decorre de segunda-feira, 14, a sexta-feira, 18 de junho, e *Fit roof* na segunda-feira, 21, e na terça-feira, 22 de junho. A entrega é terça-feira, 22 de junho: um dia útil mais tarde do que nos outros dois perfis.

### E se

**Pour foundation está em 20 % em vez de 60 %.** O trabalho restante é então de 4 dias úteis. Com os três perfis, *Pour foundation* termina na segunda-feira, 14 de junho, e a entrega é quarta-feira, 23 de junho. A convenção do Microsoft Project para o trabalho restante não faz diferença aqui: segunda-feira, 7 de junho, mais 1 dia útil decorrido é terça-feira, 8 de junho, e isso é antes da data de estado. Uma convenção destas é um limite inferior, que só pode tornar o trabalho restante mais tardio. *Order window frames* e o início antecipado no Primavera P6 continuam a diferir, como acima. No Microsoft Project, *Order window frames* tem então 8 dias úteis de folga total.

**Só define uma data de estado e não regista progresso.** No Open Planner Studio e no Primavera P6, toda a rede passa para quarta-feira, 9 de junho. *Pour foundation* decorre então de quarta-feira, 9, a terça-feira, 15 de junho, e a entrega passa para quinta-feira, 24 de junho: dois dias úteis mais tarde do que sem data de estado. No Microsoft Project, tudo fica onde estava, e a entrega é terça-feira, 22 de junho.

**Cria um perfil sozinho.** No Open Planner Studio, crie um perfil personalizado com *Novo perfil*, *Cópia de Open Planner Studio*, e ative nele só *Não mover tarefas não iniciadas para a data de estado*. Com o progresso de 60 %, *Pour foundation* mantém então as datas do Open Planner Studio (fim quinta-feira, 10 de junho, entrega segunda-feira, 21 de junho). *Order window frames* fica, de facto, de segunda-feira, 7, a quarta-feira, 9 de junho, com 6 dias úteis de folga total. Um perfil é, portanto, um conjunto de interruptores separados, e pode alterá-los um a um.

**Uma opção de cálculo em vez de uma convenção.** Se definir *Definição de crítico* (*Folga total ≤ limiar*) com *Limiar (dias úteis)* de 4 no Open Planner Studio, *Order window frames* fica crítica, porque a sua folga total é exatamente 4. Nenhuma data muda. Uma opção de cálculo é a sua escolha para o projeto e é independente do perfil.

**Um prazo que não é cumprido.** Atribua a *Fit roof* um prazo até sexta-feira, 18 de junho. No Open Planner Studio, a folga total de *Fit roof* passa a ser −1 dia útil e a folga livre também é −1. No Primavera P6, a folga total mantém-se em −1, mas a folga livre passa a 0. É isso que faz a convenção *Folga livre nunca negativa*, no grupo *Folga e datas mais tardias*. No Microsoft Project, ambas são −2, porque aí a entrega cai um dia mais tarde. Como funciona um prazo está explicado em [Restrições e prazos](docs://uitleg-constraints).

## Consequências e mal-entendidos

**«O perfil é uma definição da aplicação.»** Não. O perfil e as opções de cálculo pertencem ao projeto e seguem no ficheiro. Só os modelos que guarda pertencem à aplicação, e um projeto guarda sempre a sua própria cópia.

**«Se eu exportar, o meu perfil vai junto.»** Só com o seu próprio formato de projeto (.ifc). Se exportar para *MS Project XML*, *Primavera P6 XML* ou *CSV (separado por ponto e vírgula)*, o perfil não fica no ficheiro. Das opções de cálculo, a exportação para *MS Project XML* escreve no máximo o limiar crítico. A aplicação só avisa disto para um projeto que veio de um ficheiro .xer. Para um projeto que cria, não recebe nenhuma mensagem. O ficheiro abre então como Open Planner Studio, sem mensagem de perfil. Veja o exemplo com o perfil Microsoft Project e 60 % de progresso. Se o exportar para *MS Project XML* e o abrir de novo, a aplicação mostra primeiro as datas do ficheiro, com a entrega na terça-feira, 22 de junho. Se deixar a aplicação recalcular, passa para segunda-feira, 21 de junho. O que mais se perde numa exportação está em [Ficheiros e formatos](docs://uitleg-bestanden).

**«O perfil Primavera P6 dá o mesmo resultado que o P6.»** A aplicação não o pode garantir. O perfil ativa as convenções que a aplicação conhece do P6, e essas não são todas as definições do P6. Além de Retained Logic e Progress Override, o P6 tem um terceiro modo de progresso, Actual Dates. A aplicação não o conhece: um ficheiro .xer assim calcula como Retained Logic, e a mensagem de abertura diz isso, por exemplo como *1 definição de planeamento P6 usou uma alternativa segura.* Algumas convenções do perfil Primavera P6 também só funcionam em tarefas que vêm de um ficheiro .xer, como *LOE não iniciada usa a janela objetivo* e *Manter exatas as datas reais*. Para algumas, a explicação diz isso: «apenas tarefas com origem P6». Em tarefas que cria, essas convenções não fazem nada.

**«O modo de progresso faz parte do perfil.»** Não. Retained Logic ou Progress Override é uma escolha separada por projeto. Defina-o separadamente do perfil, veja [Escolher o modo de progresso](docs://howto-voortgangsmodus-kiezen). Uma convenção do Primavera P6, *Progress Override ignora também para trás um sucessor iniciado*, só faz alguma coisa com Progress Override.

**«Vou só mudar de perfil para ver o que acontece.»** Pode, porque *Aplicar* anula-se num só passo com *Desfazer*: o perfil e as datas voltam juntos. Mas as datas podem mudar de facto. No exemplo, passar de Open Planner Studio para Microsoft Project move todas as 4 tarefas. A mensagem conta-as por si. Veja o planeamento depois, antes de continuar. Se a aplicação ainda mostrar as datas do ficheiro depois de abrir um .xer ou .mpp, uma mudança de perfil deixa essa vista e a aplicação calcula ela própria. Como isso funciona está em [Datas como guardadas](docs://uitleg-datums-zoals-opgeslagen).

**O exemplo mostra quatro convenções, e a lista na aplicação é mais longa.** Cada linha do bloco tem a sua própria explicação. Leia-a primeiro. Veja também o grupo *Apenas para perfis próprios*: estas convenções estão desligadas em todos os perfis integrados, incluindo o Primavera P6. Só um perfil próprio as pode ligar: crie um com *Novo perfil*.

## Ver também

- [Escolher ou criar um perfil de cálculo](docs://howto-rekenprofiel-kiezen): escolher, mudar ou criar um perfil.
- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): o que fazem a data de estado e o trabalho restante, com as diferenças por perfil.
- [Escolher o modo de progresso](docs://howto-voortgangsmodus-kiezen): escolher Retained Logic ou Progress Override.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): as opções de cálculo para o caminho crítico e a folga.
- [Relações e desfasamento](docs://uitleg-relaties): a opção de cálculo *Calendário de atraso*.
- [Ficheiros e formatos](docs://uitleg-bestanden): o que uma exportação leva e o que não leva.
- [Exportar](docs://howto-exporteren): exportar um projeto.
- [Atualizar o progresso](docs://howto-voortgang-bijwerken): introduzir a percentagem, o início real e a data de estado.
- [Datas como guardadas](docs://uitleg-datums-zoals-opgeslagen): porque as datas importadas podem diferir do que a aplicação calcula ela própria.
- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): todas as convenções e opções de cálculo numa só lista.
