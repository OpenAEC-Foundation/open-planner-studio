# Planear bem

O que torna um planeamento bom? Não é o aspeto arrumado, mas se responde à pergunta que importa quando os trabalhos estão em curso: se isto atrasar, o que acontece à entrega? Este artigo explica os princípios por trás de um planeamento fiável, e por que pesam tanto no Open Planner Studio: a aplicação calcula com o que introduz, e com mais nada.

Os exemplos vêm da construção — obras estruturais, trabalhos de acabamento, prazos de fornecimento, atrasos devidos ao tempo, subempreiteiros, uma data contratual de entrega — mas os princípios em si não são específicos da construção.

## O conceito

Um bom planeamento não é uma imagem daquilo que deseja, mas um **modelo de cálculo**: tarefas com uma duração, ligadas por relações, num calendário. A aplicação calcula as datas a partir desse modelo. Quando algo muda, o modelo é recalculado e o utilizador vê de imediato o que isso significa para o resto.

Um planeador segue uma ordem fixa:

1. O objetivo: marcos e data de entrega.
2. A decomposição: fases, pacotes de trabalho, tarefas.
3. A duração de cada tarefa.
4. As relações.
5. Restrições e datas fixas.
6. Calendários.
7. Recursos.
8. Caminho crítico e folga.
9. Linha de base e progresso.
10. Revisão.

Essa ordem não é uma questão de protocolo. Se ignorar um passo, o resultado é uma surpresa: tarefas sem relações não acompanham as outras, durações sem calendário estão erradas, e uma linha de base guardada só depois fixa o atraso em vez do acordo.

## Como a aplicação calcula com este método

Cada princípio abaixo está ligado a algo que a aplicação faz. Por isso, esta parte segue a mesma ordem.

### Comece pelo objetivo, não pelas tarefas

Primeiro, registe os momentos que estão fixos, e só depois o trabalho que tem de caber entre eles: início da preparação do terreno, licença final, edifício estanque, início dos acabamentos, entrega da obra. Estes são **marcos**: pontos sem duração, que se introduzem como marco (*Início › Tarefas › Marco ▾*) e não como tarefa de duração zero com um nome que se pareça com um marco.

Porquê esta ordem: um planeamento que parte de uma lista de tarefas torna-se uma soma, e uma soma raramente cai na data do contrato. Se partir dos marcos, a pergunta certa surge logo: não «quanto tempo leva tudo isto junto», mas «o trabalho cabe entre estes dois momentos e, se não couber, o que tem de mudar». Recue a partir da data de entrega exigida até ao momento em que o edifício tem de estar estanque, o mais tardar, e daí até ao início.

Uma entrega fixada por contrato recebe a caixa de verificação *Obrigatório (contratual)*, para que quem abrir o ficheiro veja que este momento não é negociável nem móvel. A caixa de verificação é uma marca para o Gantt e para os relatórios; não protege uma data. Para isso use um prazo ou uma restrição (ver abaixo).

### A decomposição: fases, pacotes de trabalho, tarefas

Abaixo dos marcos constrói a estrutura: fases, depois pacotes de trabalho, depois tarefas. Isso faz-se avançando a tarefa um nível. Uma tarefa com subtarefas torna-se automaticamente uma **tarefa de resumo**: a aplicação deriva a barra e a duração a partir das tarefas abaixo dela. Por isso, nunca introduza uma duração para uma tarefa de resumo.

A regra prática para a granularidade: **uma tarefa dura entre cerca de um dia e duas semanas**. Menos de um dia significa que está a planear o dia a dia da obra em vez do projeto; isso pertence ao plano semanal do diretor de obra, e não a um modelo de cálculo que tem de durar meses. Mais de duas semanas significa uma tarefa que não consegue estimar bem nem acompanhar durante a execução: «finishing ground floor, 40 days, 45% complete» não diz a ninguém se as coisas estão a correr bem. Por isso, as revisões do planeamento costumam contar quantas tarefas duram mais de cerca de dois meses; acima de uma pequena percentagem, isso conta como falta de detalhe.

Ser demasiado detalhado é tão prejudicial como ser demasiado grosseiro. Cada tarefa dá trabalho de manutenção: relações a desenhar, progresso a registar, uma nova avaliação após cada alteração. Um planeamento com duas mil tarefas para um projeto de seis meses não fica mais exato; deixa de ser mantido. E um planeamento que ninguém atualiza é ficção dentro de três semanas. Escolha o nível ao qual consegue comunicar o progresso com honestidade, todas as semanas.

Na prática: «3. Finishing» é uma fase, «Finishing house 4» um pacote de trabalho, «Plastering house 4 ground floor» uma tarefa de cinco dias. Pode ultrapassar deliberadamente o limite máximo para prazos de fornecimento e supervisão: uma entrega de caixilhos de dez semanas é de facto um bloco indivisível de espera, e a supervisão contínua pertence a uma hammock e não a uma série de fatias artificiais.

### Estimar a duração

Uma duração é uma estimativa de quanto tempo o trabalho leva, não de quão depressa poderia ir. Estime para um dia normal com a equipa que de facto vai ter, e não para o melhor dia com a melhor equipa. O otimismo acumula-se ao longo da cadeia: um planeamento em que cada tarefa assume o melhor dia quase nunca cumpre a data de entrega.

Medir uma tarefa em dias ou em horas é uma escolha real, não uma formatação. Escolha **dias** para trabalho que dita o ritmo na obra, como alvenaria, reboco e colocação de azulejos: leva cinco dias, quer um dia tenha, por acaso, oito ou nove horas. Escolha **horas** quando as próprias horas são a unidade e o resto do dia importa: uma inspeção de três horas, uma betonagem de catorze horas distribuída por dois dias, trabalho por turnos. A aplicação guarda essa escolha por tarefa. A escolha só fica disponível depois de ativar primeiro *Ativar planeamento por horas*; veja [Dias e horas](docs://uitleg-dagen-en-uren).

Não esconda o risco dentro de durações individuais. Acrescentar um dia a tudo enterra a reserva, de modo que ninguém a consegue ver nem gerir; e onde a reserva era mesmo necessária, revela-se pequena demais. Torne a reserva visível: uma tarefa de reserva explícita antes da data de entrega, ou uma reserva separada para o mau tempo. Atenção à contagem dupla: os cerca de 180 dias úteis de obra por ano com que a construção neerlandesa conta são um valor anual contratual (UAV), do qual já foram deduzidos os feriados, a paragem da indústria *e* os dias perdidos. Se os feriados e a paragem já estiverem no calendário do projeto, resta apenas o atraso por mau tempo como item separado. O atraso por gelo e tempestade segue regras próprias no acordo coletivo *Onwerkbaar weer Bouw & Infra*. Coloque esses dias perdidos previstos no calendário ou num item separado, e não escondidos dentro da duração da alvenaria.

### Relações: sem rede não há planeamento

A aplicação calcula as datas ao longo das **relações**: uma tarefa só começa quando as suas predecessoras o permitem. Uma tarefa sem relações não está ligada a nada. Se as obras estruturais atrasarem duas semanas, uma tarefa de acabamento desligada não segue, e o planeamento mente sem que nada fique a vermelho.

Por isso, cada tarefa recebe pelo menos uma predecessora e pelo menos uma sucessora. Só a primeira tarefa do projeto e o último marco são exceções. Numa revisão do planeamento, esta é a primeira verificação: não mais do que uma pequena percentagem de tarefas pode ter lógica em falta.

**Fim-início é o padrão**, e deve manter-se assim: fundações concluídas, depois obras estruturais. Num planeamento de obra saudável, cerca de nove em cada dez relações são fim-início. Isso é um requisito de legibilidade: fim-início é o único tipo que toda a gente na obra compreende sem explicação, e comporta-se de forma previsível durante a execução.

**Início-início com desfasamento** é para trabalho que de facto corre em paralelo, em vez de esperar. O caso clássico é uma fila de casas em banda ou uma torre de pisos: o instalador segue três dias atrás da alvenaria. Isso é um início-início com desfasamento de três dias, e não uma relação fim-início numa tarefa artificialmente cortada. Acrescente uma relação fim-fim ao lado, senão a sucessora poderia, em teoria, acabar antes da predecessora. Na construção quase nunca se usa início-fim.

De preferência, desenhe esse início-início entre tarefas, e não entre fases. Se a predecessora de um início-início ou de um início-fim for uma fase, a aplicação faz a sucessora esperar pela tarefa dessa fase que começa **por último**, e não pela primeira. Assim nunca planeia cedo demais, mas por vezes mais tarde do que queria. Fim-início e fim-fim, com uma fase como predecessora, esperam que a última tarefa dessa fase acabe, e isso costuma ser exatamente o que pretende.

Use os desfasamentos com moderação, sobretudo os negativos. Um desfasamento é tempo de espera sem uma razão visível: ninguém consegue perceber mais tarde porque há sete dias pelo meio. Se for cura do betão, faça-o como desfasamento em dias de calendário (o betão também cura ao fim de semana), ou, melhor ainda, como uma tarefa real de «cura» que toda a gente consiga ver e acompanhar. Um desfasamento negativo, um avanço ou uma sobreposição, na verdade não deveria existir; numa revisão do planeamento, a norma é zero. Se quiser sobreposição, divida a predecessora ou use um início-início.

### Restrições e datas fixas: o mínimo possível

Cada tarefa começa «o mais cedo possível», e na grande maioria dos casos deve continuar assim. Uma **restrição** é um limite de data junto às relações. Quanto mais acrescentar, menos o seu planeamento calcula, e mais se torna um desenho. Um plano cheio de datas fixas parece estável e esconde o risco precisamente por isso: já não se move, por isso já não avisa.

Use uma restrição só para uma data externa rígida sobre a qual o próprio planeamento não tem influência: a licença que só será final a 1 de março (*Não começar antes de*), a janela de encerramento que a câmara municipal concedeu, a data de ligação da empresa de utilidades. «Quero esta tarefa em maio» não é um facto externo; resolve-se isso com a lógica ou com outra duração. Como regra prática, no máximo uma pequena percentagem das tarefas restantes tem um limite de data rígido.

Nunca escreva uma data de início para fixar uma tarefa na data pretendida. Para uma tarefa com predecessora, a aplicação transforma um início escrito (ou arrastado) numa restrição *Não começar antes de (SNET)*. A tarefa fica então onde a quer, e mantém-se aí mesmo quando toda a cadeia anterior atrasa.

Se quiser acompanhar uma data sem dirigir o cálculo, use um **prazo**. Não move nada, mas dá folga negativa e um aviso logo que a tarefa deixa de o cumprir: exatamente o sinal que quer ver. Reserve uma fixação rígida (*Obrigatório (fixação de data)*) para o caso extremo, e saiba então que ela dá folga negativa na cadeia anterior. É o planeamento a dizer que não cabe, e não que algo esteja avariado.

### Calendários: primeiro o projeto, depois as exceções

Todas as durações contam em dias úteis ou horas úteis de um calendário. Por isso, configure bem o calendário do projeto antes de introduzir durações: dias úteis, tempos de trabalho, feriados e as férias da construção. Um calendário que corrige a meio desloca todo o planeamento. Acrescente logo os encerramentos previsíveis: o período de gelo em que não se betona, a paragem da empresa entre o Natal e o Ano Novo.

Dê a um recurso um calendário próprio apenas se for mesmo diferente: o construtor de fachadas que vem quatro dias por semana, a equipa que tira outras férias de verão. Um calendário de recurso não altera uma única data de uma tarefa; essa continua a correr no calendário da tarefa ou do projeto. Apenas mostra que o recurso não trabalha num dos dias úteis da tarefa, como sobrealocação no histograma. Essa diferença é difícil de detetar se não se souber que foi criada por si.

### Recursos: quem executa e se isso é possível

Um planeamento sem recursos responde apenas a metade da pergunta. Assim que atribui as equipas e os equipamentos, o histograma mostra o que uma linha do tempo sozinha não mostra: que a 14 de junho precisa de três equipas de reboco e só tem duas.

Comece pelos recursos que apertam. Nem todo o parafuso tem de entrar; a grua-torre, as suas próprias equipas, os subempreiteiros com um teto de capacidade e os prazos longos de fornecimento, sim. Dê a cada recurso uma capacidade honesta: dois estucadores significam dois, e não «dois, mas três em caso de emergência».

Leia o histograma como uma pergunta, e não como um erro. Vermelho acima da linha significa que o planeamento pede mais do que tem nesse dia. Por vezes a resposta é: deslocar. Muitas vezes a resposta é: isto não vai funcionar, e era isso que queria saber. **Nivelamento** desloca tarefas até que a procura caiba na capacidade. Se a data de fim puder ceder, deixe-o fazer; se a data de entrega for fixa, nivele apenas dentro da folga (a caixa de verificação *Nivelar apenas dentro da folga (suavização) — a data de fim do projeto mantém-se fixa*). A data de fim fica então onde está, e fica-lhe um conflito restante comunicado, o que é um resultado mais honesto do que um planeamento que só parece resolvido.

Não nivele quando a procura é estruturalmente superior à capacidade. O nivelamento reorganiza no tempo o trabalho existente; não contrata mais estucadores nem constrói uma segunda grua. Três torres que precisam da mesma equipa ao mesmo tempo continuam a ser três torres que precisam da mesma equipa depois do nivelamento; o único que muda é que a entrega se adia. O que ajuda, nesse caso, é o faseamento, mais capacidade ou trabalho diferente. Também não nivele antes de a lógica e as durações estarem definidas: estaria a nivelar um planeamento que amanhã será diferente.

### Caminho crítico e folga: onde o planeamento é vulnerável

A aplicação não recalcula a cada alteração. Calcule com **Calcular** (F5) e só depois leia. Se a barra de estado disser *Desatualizado — recalcule (F5)*, está a ver o cálculo anterior, e não o atual. Com a definição *Calcular automaticamente*, a aplicação faz isso por si.

O **caminho crítico** é a cadeia sem folga: cada dia perdido aí é um dia de atraso na entrega. É aí que deve pôr a sua supervisão e as suas melhores pessoas. Não olhe só para o vermelho. A **folga total** diz quanto tempo uma tarefa pode atrasar sem afetar a entrega; a **folga livre** diz quanto pode atrasar sem deslocar a sucessora. A diferença não afeta a data de fim de ninguém, mas atrapalha alguém: é útil quando trabalha com subempreiteiros que não pode replanear duas vezes.

Atenção a três sinais. Uma tarefa com alguns dias de folga não é uma tarefa segura, mas sim uma tarefa quase crítica; com *Marcar quase crítico*, essas tarefas recebem cor própria. Uma tarefa com uma quantidade extrema de folga (nas revisões do planeamento, mais de 44 dias úteis, cerca de dois meses) quase sempre tem uma sucessora em falta; isso aponta-lhe diretamente as lacunas da rede. E folga negativa nunca é um erro de cálculo: é o planeamento a dizer que um prazo ou uma data fixa não cabe.

### Linha de base antes do arranque, depois atualize-a

Guarde uma **linha de base** logo que o planeamento for aprovado e antes de a primeira pá tocar na terra (*Planeamento › Linhas de base e progresso › Gerir linhas de base…*). Calcule primeiro: a linha de base guarda as datas do último cálculo. Sem essa referência, só consegue dizer mais tarde *que* as coisas estão a correr de outra forma, e não em quanto nem desde quando. É exatamente isso que precisa numa reunião de obra, para trabalhos extra e quando se discute um atraso.

Uma linha de base guarda as datas, mas não os pressupostos por trás delas, e são precisamente esses que se perguntam assim que se discute um atraso. Por isso, ao guardá-la, escreva brevemente em que se baseia este planeamento (na prática de planeamento: a *base do planeamento*): que produtividades usou, que calendário e porquê está configurado assim, o que deliberadamente deixou de fora do planeamento, quem forneceu os prazos de fornecimento que assumiu e quem aprovou o planeamento. Meia página chega.

Depois disso, manter tudo atualizado é um ritmo, e não um projeto. Atualize todas as semanas, pela mesma ordem: defina a **data de estado** como a data do relatório, introduza o início real e a data real de fim do que começou e acabou, corrija a duração restante do que está em curso, e calcule. Uma percentagem sozinha não chega: as datas reais são o registo factual que será consultado mais tarde.

Saiba o que faz a data de estado: a aplicação move para a data de estado o trabalho que ainda não começou, e as tarefas seguintes acompanham-no (exceto no perfil de cálculo Microsoft Project). Por isso, se se esquecer de dar por concluída uma tarefa ou um marco, ele desloca-se sozinho para a direita. Isso não é uma falha, mas sim o modelo a recusar fingir que algo do passado ainda pode acontecer. Se receber um aviso *Fora de sequência*, o trabalho foi feito numa ordem diferente da que a lógica prescreve; isso costuma ser razão para rever a sequência, e não para ignorar o aviso. Crie uma nova linha de base apenas para uma alteração real do âmbito, e então ao lado da primeira, e não por cima dela.

Por fim: um planeamento só é fiável se as pessoas que fazem o trabalho acreditarem nele. Peça ao diretor de obra e aos subempreiteiros que confrontem o plano semanal com este modelo. Se, semana após semana, só alcançarem metade do que ficou acordado, o problema está com mais frequência no planeamento do que na execução.

## Exemplo prático: três escolhas que tornam o planeamento enganador sem aviso

Os números vêm de dois exemplos explicados noutro ponto da Ajuda: o projeto de treino *House extension* dos tutoriais e uma pequena rede para uma ampliação. Aqui interessa o que cada escolha faz ao seu planeamento. Experimente por si mesmo no tutorial 2 (relações e caminho crítico) e no tutorial 3 (uma restrição e um prazo).

### Uma relação esquecida

Na ampliação, a execução começa na segunda-feira 7 de junho de 2027 e a entrega é na sexta-feira 6 de agosto. *Build outer cavity leaf* (6 dias úteis) tem *Install window frames* como sucessora, porque as caixilharias ficam na fachada. Com essa relação, a folha exterior tem 2 dias úteis de folga.

Se esquecer essa relação, a folha exterior passa de repente a ter 23 dias úteis de folga, até à entrega. No papel, pode atrasar-se semanas sem que ninguém espere por ela. Nada fica a vermelho e nenhum aviso aparece. Só com a opção de cálculo *Tarefas de extremidade aberta críticas* é que uma tarefa destas, sem sucessora, fica crítica, e a lacuna torna-se visível.

### Uma data digitada em vez de uma relação

A pequena rede: *Groundwork* (3 dias úteis), *Pour foundation* (2), *Brickwork* (5) e *Roofing* (3), uns a seguir aos outros, a partir da segunda-feira 7 de junho de 2027. O projeto fica concluído na quarta-feira 23 de junho.

Se digitar o início na segunda-feira 21 de junho para *Brickwork*, porque os tijolos só chegam nessa altura, isso passa a ser uma restrição *Não começar antes de*. A tarefa *Brickwork* desloca-se uma semana e o projeto fica concluído na quarta-feira 30 de junho. *Groundwork* e *Pour foundation* passam a ter 5 dias úteis de folga e deixam de ser críticas. Se os tijolos chegarem mais cedo, afinal, *Brickwork* mantém-se em 21 de junho: agora é a data que decide, não a lógica.

Se digitar, em vez disso, quarta-feira 9 de junho, antes de a fundação estar concluída, não acontece nada: as relações só deixam *Brickwork* começar na segunda-feira 14 de junho, de qualquer modo.

### Um prazo em vez de uma restrição

Se quiser que *Roofing* fique concluída na sexta-feira 18 de junho, defina aí um prazo. Nada se move: *Roofing* mantém-se de segunda-feira 21 a quarta-feira 23 de junho. Mas a cadeia passa a ter −3 dias úteis de folga e a aplicação apresenta *Prazo 18-06-2027 ultrapassado — fim antecipado 23-06-2027*. Assim, vê logo que o acordo não encaixa, em vez de uma barra no sítio certo com uma cadeia por trás que não o cumpre.

## Consequências e ideias erradas

- **Tarefas sem predecessora ou sucessora.** As mais comuns e as mais prejudiciais: estas tarefas não se deslocam com as outras e ficam com folga falsa.
- **Digitar datas ou arrastar barras em vez de desenhar a lógica.** Isso define uma restrição em silêncio.
- **Restrições em excesso, e uma fixação rígida usada como marcador.** O planeamento deixa então de calcular e passa só a desenhar.
- **Tarefas de três meses, ou tarefas de meio dia.** O intervalo útil fica entre cerca de um dia e duas semanas.
- **Durações otimistas, e margem escondida em cada tarefa** em vez de ser visível como reserva.
- **Atrasos por mau tempo e férias da construção que não estão no calendário.** De qualquer modo, acabam por entrar nele em janeiro.
- **Desfasamentos em vez de tarefas.** Sete dias de espera sem nome ficam inexplicáveis três meses depois.
- **Fazer o nivelamento antes de a lógica estar pronta, ou continuar o nivelamento contra uma falta estrutural de capacidade.**
- **Esquecer de calcular.** *Desatualizado* na barra de estado significa que está a ver o cálculo anterior.
- **Nenhuma linha de base, ou uma linha de base guardada só depois do início.**
- **Progresso registado só em percentagem**, sem datas reais e sem data de estado.
- **Fechar o painel *Avisos* sem o ler.** É aí que se reúnem os prazos ultrapassados, as restrições violadas, as relações fora de sequência e os recursos sobrealocados (*Planeamento › Planeamento › Avisos*).

## Ver também

- [Caminho crítico e folga](docs://uitleg-kritiek-pad): como a aplicação calcula as datas antecipadas e as datas mais tardias, e a folga.
- [Relações e desfasamento](docs://uitleg-relaties): os quatro tipos de relação, o desfasamento e as relações numa fase.
- [Restrições e prazos](docs://uitleg-constraints): o que cada restrição e um prazo fazem ao cálculo.
- [Calendários e dias úteis](docs://uitleg-kalenders): como a aplicação conta os dias úteis e qual calendário prevalece.
- [Dias e horas](docs://uitleg-dagen-en-uren): planeamento em dias, em horas ou misto.
- [Nivelamento de recursos](docs://uitleg-nivelleren): o que o nivelamento desloca e o que não desloca.
- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): o que faz a data de estado e como ler o desvio.
- [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen): como introduzir os marcos e as tarefas.
- [Adicionar relações](docs://howto-relaties-leggen): como vincular tarefas entre si.
- [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen): um assistente que planeia segundo estes princípios.
- [Notificações e avisos](docs://ref-meldingen): todos os avisos num só lugar.
