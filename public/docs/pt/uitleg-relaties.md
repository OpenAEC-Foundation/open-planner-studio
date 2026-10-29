# Relações e desfasamento

Porque é que a alvenaria só começa depois de a fundação estar feita? E porque é que a colocação da cobertura atrasa uma semana quando os elementos da cobertura chegam tarde? A resposta está nas relações entre as suas tarefas. Neste artigo fica a saber quais são os quatro tipos de relações que a aplicação conhece, o que fazem o desfasamento e o avanço, em que calendário conta um desfasamento, o que acontece a uma relação numa fase e como a aplicação decide qual relação determina a data de início de uma tarefa.

As regras e os exemplos aplicam-se a um projeto novo, com o perfil de cálculo *Open Planner Studio* e uma semana de trabalho de segunda a sexta-feira.

## O conceito

Uma **relação** indica que duas tarefas dependem uma da outra. A primeira tarefa é a **predecessora**, a segunda é a **sucessora**. Uma relação é um limite inferior: a sucessora nunca pode começar ou terminar mais cedo do que a relação permite, mas pode começar ou terminar mais tarde. Se uma tarefa tiver várias predecessoras, espera pela data mais tardia que resulta de todas essas relações.

Existem quatro tipos. Diferem no momento da predecessora (início ou fim) que fica ligado ao momento da sucessora:

- **FS (Fim-Início).** A sucessora só começa quando a predecessora estiver terminada. Os elementos da cobertura só são colocados quando as paredes estiverem levantadas. Este é de longe o tipo de relação mais usado.
- **SS (Início-Início).** A sucessora só começa quando a predecessora já tiver começado. As tarefas podem sobrepor-se: a canalização pode começar assim que a alvenaria estiver em curso.
- **FF (Fim-Fim).** A sucessora só termina quando a predecessora estiver terminada. O rejuntamento não pode ser feito antes de a alvenaria estar concluída, mas pode começar mais cedo.
- **SF (Início-Fim).** A sucessora só termina quando a predecessora já tiver começado. Este tipo é raro. Um exemplo: a drenagem temporária só pode parar quando a alvenaria da fundação já tiver começado.

Uma relação pode também ter um **desfasamento**: um tempo de espera entre as duas tarefas, por exemplo betão que tem de curar. Um desfasamento negativo chama-se **avanço**: a sucessora começa então antes de a predecessora estar terminada, por isso as tarefas sobrepõem-se.

## Como a aplicação calcula

### Os quatro tipos

Para cada relação, a aplicação calcula a data mais cedo em que a sucessora pode começar e usa a mais tardia de todas as relações de uma tarefa. Sem desfasamento, funciona assim:

- Com FS, a sucessora começa no primeiro dia útil depois do fim da predecessora.
- Com SS, a sucessora começa no mesmo dia que a predecessora.
- Com FF, a sucessora termina no mesmo dia que a predecessora. Para encontrar o início, a aplicação conta para trás com a duração da sucessora. Uma sucessora de 3 dias úteis começa, portanto, 2 dias úteis antes do fim da predecessora.
- Com SF, a sucessora termina no dia em que a predecessora começa. Também aqui a aplicação conta para trás com a duração da sucessora.

Estes são limites inferiores. Uma sucessora começa mais tarde se outra relação ou uma restrição o exigir. Todas as datas só aparecem depois de **Calcular** (F5). Enquanto a barra de estado indicar *Desatualizado — recalcule (F5)*, as barras pertencem ao cálculo anterior.

### Desfasamento e avanço

Um desfasamento pode ser indicado de quatro formas:

- Em **dias úteis** (`3` ou `3d`): a aplicação salta os dias de folga e os fins de semana. Este é o padrão.
- Em **dias de calendário** (`3ed`, o e vem de *elapsed*, que significa tempo decorrido): conta cada dia, incluindo sábado e domingo. Esta é a unidade para algo que continua sem que se faça trabalho, como a cura.
- Como **percentagem** da duração da predecessora (`40%`): a aplicação volta a calcular isto em cada cálculo e arredonda para dias inteiros (2,5 dias passam a 3).
- Em **horário de trabalho** (`4h`): a aplicação conta o desfasamento no calendário de atraso, por padrão o da predecessora. Se a predecessora for uma tarefa em dias num calendário sem faixas de tempo de trabalho próprias, como o calendário normal, a aplicação converte as horas em dias úteis inteiros, arredondados para o dia inteiro mais próximo (meio dia sobe). Com um dia útil de 8 horas, `2h` e `3h` dão, portanto, 0 dias, `4h` até `11h` inclusive dão 1 dia e `12h` dá 2 dias. Se esse calendário tiver faixas de tempo de trabalho próprias, ou se a predecessora for uma tarefa horária, o desfasamento conta exatamente em horas de trabalho.

A regra para um desfasamento de N dias úteis com FS: os N dias úteis depois do fim da predecessora são tempo de espera, e a sucessora começa no dia útil seguinte. Com SS e FF, o desfasamento é somado ao início e ao fim da predecessora, respetivamente. Um desfasamento negativo conta para trás: um avanço de 1 dia útil com FS faz com que a sucessora comece no dia em que a predecessora termina.

Um avanço não pode pôr uma tarefa antes do início do projeto. Se isso acontecer, a aplicação mantém a sucessora no início do projeto e indica no painel *Avisos*: *Avanço truncado pelo início do projeto — a relação não é totalmente respeitada*.

### Em que calendário conta o desfasamento

Cada tarefa pode ter o seu próprio calendário. Com um desfasamento em dias úteis, importa qual calendário conta os dias úteis. A definição *Calendário de atraso* decide isso, com quatro opções: *Predecessora*, *Sucessora*, *24 horas* e *Calendário do projeto*. Por padrão, o desfasamento conta no calendário da **predecessora**. Encontra-a em *Definições › Projeto › Definições do projeto*, no bloco *Perfil de cálculo e opções*, em *Opções de cálculo deste projeto*. A escolha pertence ao ficheiro do projeto e só conta depois de clicar em *Aplicar*; o planeamento é então recalculado.

Um desfasamento em dias de calendário (`3ed`) conta sempre todos os dias, qualquer que seja o *Calendário de atraso* escolhido.

### Relações em tarefas de resumo

Pode pôr uma relação numa fase (uma tarefa de resumo) em vez de numa tarefa dentro dela. Internamente, a aplicação põe essa relação em cada tarefa da fase:

- Uma fase como **predecessora**, com FS ou FF: a sucessora espera até que a última tarefa da fase esteja terminada.
- Uma fase como **sucessora**, com FS ou SS: cada tarefa da fase espera pela predecessora, independentemente das outras tarefas da fase.
- Uma fase como **predecessora**, com SS ou SF: a sucessora espera pelo início da tarefa da fase que começa **por último**, e não pelo início da própria fase. Isto é mais cauteloso do que possa esperar: a sucessora nunca começa cedo de mais, mas possivelmente mais tarde do que pretende. Se quiser que a sucessora siga o início da fase, ponha a relação na primeira tarefa da fase.
- Uma fase como **sucessora**, com FF ou SF: cada tarefa da fase tem de cumprir por si a exigência de fim (com FF, o fim em ou após o fim da predecessora; com SF, em ou após o início da predecessora), mesmo uma tarefa que poderia ter sido feita muito mais cedo. Convém pôr essa relação na última tarefa da fase.

Não é permitida uma relação entre uma tarefa e a fase em que está inserida.

### Relações determinantes

Se uma sucessora tiver várias predecessoras, normalmente uma relação determina a sua data de início: a relação que impede a sucessora de começar um único dia mais cedo do que começa agora. Uma relação assim chama-se **relação determinante**. Em caso de empate, há várias relações determinantes. Reconhece uma relação determinante pelo símbolo de relâmpago nas colunas *Predecessoras* e *Sucessoras* da tabela, pela coluna *Determinante* (o **+** à direita do cabeçalho da tabela, em *Relações*) e pela tonalidade mais forte quando traça um caminho. Como abrir esse caminho está em [Traçar um caminho](docs://howto-pad-traceren).

A relação determinante diz algo sobre datas, não sobre duração. Uma predecessora curta também pode ser determinante, por exemplo por causa de um desfasamento longo; vê isso no exemplo abaixo.

## Exemplo resolvido

Os exemplos usam mini-projetos separados, todos a começar na segunda-feira 7 de junho de 2027, salvo indicação em contrário. Termos como caminho crítico e folga são explicados em [Caminho crítico e folga](docs://uitleg-kritiek-pad). Construir uma rede de relações e verificá-la é o que faz no tutorial 2, «Relações e caminho crítico».

### Os quatro tipos lado a lado

*Pour foundation* demora 5 dias úteis: de segunda-feira 7 a sexta-feira 11 de junho. *Build walls* (5 dias úteis) segue com FS e decorre de segunda-feira 14 a sexta-feira 18 de junho. Quatro tarefas de 3 dias úteis cada uma dependem de *Build walls*, cada uma com um tipo diferente:

- *Place roof elements* (FS) começa na segunda-feira 21 de junho, o primeiro dia útil depois da alvenaria, e fica concluída na quarta-feira 23 de junho.
- *Pipework* (SS) começa na segunda-feira 14 de junho, juntamente com a alvenaria, e fica concluída na quarta-feira 16 de junho.
- *Pointing* (FF) tem de ficar concluído na sexta-feira 18 de junho, juntamente com a alvenaria. Com 3 dias úteis, começa, portanto, na quarta-feira 16 de junho.
- *Dewatering* (SF) tem de terminar na segunda-feira 14 de junho, o dia em que a alvenaria começa. Contando para trás 3 dias úteis (quinta-feira 10, sexta-feira 11, segunda-feira 14 de junho), o início fica na quinta-feira 10 de junho.

Só *Place roof elements* está no caminho crítico; o projeto fica concluído na quarta-feira 23 de junho. *Pipework*, *Pointing* e *Dewatering* têm, respetivamente, 5, 3 e 7 dias úteis de folga.

### Desfasamento e avanço em números

*Pour foundation* fica concluída na sexta-feira 18 de junho. *Build walls* (2 dias úteis) segue com FS. Efeito do desfasamento na data de início:

- Sem desfasamento, a alvenaria começa na segunda-feira 21 de junho.
- Com o desfasamento `3` (três dias úteis), segunda-feira 21, terça-feira 22 e quarta-feira 23 de junho são tempo de espera; a alvenaria começa na quinta-feira 24 de junho.
- Com o desfasamento `3ed` (três dias de calendário), contam sábado, domingo e segunda-feira; a alvenaria começa na terça-feira 22 de junho.
- Com o desfasamento `-1` (um avanço de um dia útil), a alvenaria começa na sexta-feira 18 de junho, o dia em que a betonagem fica concluída.
- Com o desfasamento `40%`, o desfasamento é 40% de 5 dias úteis, ou seja, 2 dias úteis; a alvenaria começa na quarta-feira 23 de junho.
- Com o desfasamento `50%`, o desfasamento é de 2,5 dias úteis, arredondados para 3 dias úteis; a alvenaria começa na quinta-feira 24 de junho.

### Qual calendário conta o desfasamento

*Build walls* (4 dias úteis) está no calendário do projeto (de segunda a sexta-feira) e fica concluída na quinta-feira 10 de junho. *Pointing* (2 dias úteis) segue com FS e desfasamento `3`, e está num calendário em que sábado e domingo também são dias úteis. Então, a data de início depende do *Calendário de atraso*:

- *Predecessora* (padrão): o desfasamento conta no calendário da alvenaria. Sexta-feira 11, segunda-feira 14 e terça-feira 15 de junho são tempo de espera; o rejuntamento começa na quarta-feira 16 de junho.
- *Sucessora*: o desfasamento conta no calendário do rejuntamento. Sexta-feira 11, sábado 12 e domingo 13 de junho são tempo de espera; o rejuntamento começa na segunda-feira 14 de junho.
- *24 horas*: conta cada dia de calendário. Também aqui sexta-feira, sábado e domingo são tempo de espera; o rejuntamento começa na segunda-feira 14 de junho.
- *Calendário do projeto*: o desfasamento conta no calendário do projeto, tal como com *Predecessora*; o rejuntamento começa na quarta-feira 16 de junho.

### Relações numa fase

*Foundation* é uma fase com duas tarefas: *Excavate* (2 dias úteis, segunda-feira 7 e terça-feira 8 de junho) e depois *Pour* (3 dias úteis, quarta-feira 9 a sexta-feira 11 de junho). *Build walls* segue a fase *Foundation* com FS e começa na segunda-feira 14 de junho: a aplicação faz com que espere por *Pour*, a última tarefa a terminar.

Com uma fase como sucessora: *Permit* (3 dias úteis, concluída na quarta-feira 9 de junho) segue com FS para a fase *Estrutura*. A fase contém *Build walls* (4 dias úteis) e depois *Lay floor* (2 dias úteis). Cada tarefa da fase espera pela licença: *Build walls* começa na quinta-feira 10 de junho e fica concluída na terça-feira 15 de junho. *Lay floor* também espera pela alvenaria e decorre de quarta-feira 16 a quinta-feira 17 de junho.

Com SS a partir de uma fase: a fase *Finishing* contém *Plastering* (2 dias úteis, 7 e 8 de junho), depois *Painting* (3 dias úteis, 9 a 11 de junho) e depois *Snagging* (2 dias úteis, 14 e 15 de junho). *Cleaning* segue a fase com SS. Seria de esperar um início na segunda-feira 7 de junho, mas a aplicação faz com que *Cleaning* espere pelo início de *Snagging*, a tarefa que começa por último: segunda-feira 14 de junho.

### O que é determinante

*Pour foundation* (2 dias úteis) decorre de segunda-feira 7 a terça-feira 8 de junho. Seguem-se dois ramos:

- *Build walls* (5 dias úteis): quarta-feira 9 a terça-feira 15 de junho.
- *Order roof elements* (2 dias úteis): quarta-feira 9 e quinta-feira 10 de junho.

*Place roof elements* (3 dias úteis) segue ambos: com FS depois da alvenaria, e com FS e desfasamento `5` depois da encomenda (o prazo de entrega). Pela alvenaria, a colocação poderia começar na quarta-feira 16 de junho. Pela encomenda, sexta-feira 11, segunda-feira 14, terça-feira 15, quarta-feira 16 e quinta-feira 17 de junho são tempo de espera; a colocação começa na sexta-feira 18 de junho. A relação com a encomenda é, portanto, uma relação determinante, apesar de a encomenda ser muito mais curta do que a alvenaria. A alvenaria tem 2 dias úteis de folga.

## Consequências e ideias erradas

**«Uma relação fixa as tarefas.»** Não, uma relação é um limite inferior. Uma sucessora começa, no mínimo, na data que a relação indica, e mais tarde se outra relação ou uma restrição o exigir. Como as restrições se encaixam está explicado em [Restrições e prazos](docs://uitleg-constraints).

**«SS significa que as tarefas começam ao mesmo tempo.»** SS indica apenas que a sucessora não pode começar antes da predecessora. Se a sucessora tiver outra predecessora que termina mais tarde, começa mais tarde.

**«Com FF, a sucessora começa no mesmo dia.»** Não, com FF coincidem as datas de fim. Uma sucessora curta, portanto, começa mais tarde do que a predecessora, como o rejuntamento no exemplo.

**«Um desfasamento em dias conta dias de calendário.»** Por padrão, um desfasamento conta dias úteis, no calendário da predecessora. Para cura ou secagem, em que o fim de semana também conta, usa dias de calendário (`ed`).

**«Uma tarefa sem relações não é um problema.»** Uma tarefa sem predecessora começa na sua data de início planeada, e uma tarefa sem sucessora recebe folga até ao fim do projeto. Se se esquecer de uma relação, a tarefa parece, portanto, ter muito espaço; veja as ideias erradas em [Caminho crítico e folga](docs://uitleg-kritiek-pad).

**«Uma relação numa fase é uma só relação.»** Para o cálculo, é uma relação por cada tarefa da fase. Se mover tarefas para dentro ou para fora de uma fase, as relações que se aplicam a essas tarefas também mudam.

## Ver também

- [Adicionar relações](docs://howto-relaties-leggen): os passos para vincular tarefas e definir um desfasamento.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que a aplicação calcula a partir das suas relações e porque é que uma tarefa fica crítica.
- [Restrições e prazos](docs://uitleg-constraints): acordos de datas junto com as relações.
- [Rastrear um caminho](docs://howto-pad-traceren): tornar visível a cadeia antes ou depois de uma tarefa.
- [Criar um hammock](docs://howto-hammock): uma tarefa com duração derivada, ligada por relações do tipo SS e FF.
- [Relações externas com outro projeto](docs://howto-externe-relaties): relações com uma tarefa noutro ficheiro de projeto.
