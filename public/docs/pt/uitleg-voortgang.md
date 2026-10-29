# Progresso, data de estado e linha de base

Um planeamento é uma previsão. Quando o trabalho está em curso, quer saber o que está concluído, o que ainda falta fazer e o que isso significa para a entrega. Este artigo explica como a aplicação trata o progresso. Explica o que faz a data de estado, como a aplicação calcula o trabalho restante e por que razão uma tarefa já iniciada ainda pode aguardar pela sua predecessora. Também explica como comparar o estado atual com o acordo original. Um exemplo resolvido mostra os números.

## O conceito

O **progresso** é o que realmente aconteceu. Para cada tarefa, a aplicação regista três valores: uma percentagem, um **início real** e um **fim real**. A previsão do planeamento fica guardada ao lado destes valores. O valor real é o que de facto aconteceu.

A **data de estado** é o dia em que faz o balanço. Tudo o que aconteceu antes desse dia é um facto. Tudo o que ainda tem de acontecer, a aplicação planeia a partir do início desse dia. Uma data real pode ser a data de estado, mas nunca pode ser posterior.

O **trabalho restante** é o que ainda falta fazer numa tarefa. Uma tarefa de 4 dias úteis que está 25% concluída tem 3 dias úteis de trabalho restante.

Uma **linha de base** é uma cópia do planeamento num determinado momento, normalmente o momento em que o acordo foi aprovado. Mais tarde, coloca o planeamento real ao lado dela e vê até que ponto a execução se desvia.

## Como a aplicação calcula

O exemplo abaixo usa o perfil de cálculo *Open Planner Studio*, com o qual um projeto novo é calculado. Mais adiante pode ler o que muda nos perfis Primavera P6 e Microsoft Project.

A aplicação não recalcula sozinha. Após cada alteração ao progresso ou à data de estado, a barra de estado mostra *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo através de *Planeamento › Agendamento › Calcular*. Se *Calcular automaticamente* estiver ativado (em *Definições › Projeto › Definições da app*, separador *Planeamento*, cabeçalho *Cálculo*), a aplicação faz isto sozinha.

### A data de estado

A data de estado faz três coisas.

Primeiro, a aplicação recusa uma data real posterior à data de estado. Uma data igual à data de estado é válida.

Segundo, uma tarefa que ainda não começou não pode ficar no passado. Se essa tarefa estiver planeada antes da data de estado, a aplicação move-a para a data de estado. Isto também se aplica às tarefas seguintes, que se movem através das suas relações. Pode ver o efeito no exemplo abaixo. No perfil Microsoft Project, a aplicação não faz isto.

Terceiro, o trabalho restante de uma tarefa que já está em curso começa na própria data de estado. A aplicação trata a data de estado como o início desse dia. Se fizer o balanço na sexta-feira depois do horário de trabalho, defina a data de estado para segunda-feira. Se a definir para sexta-feira, a aplicação continua a planear o trabalho restante nessa sexta-feira.

Se ainda não tiver uma data de estado e introduzir progresso, a aplicação define a data de estado para hoje e avisa-o. Pode definir outra data em *Planeamento › Linhas de base e progresso › Data de estado*. Sem data de estado, a aplicação calcula uma tarefa em curso para a frente com a sua duração restante, mas para trás com a sua duração total. A folga fica então negativa e a tarefa parece crítica sem motivo.

### Percentagem, datas reais e duração restante

Os campos dependem uns dos outros. Se preencher um, a aplicação preenche os outros.

- Uma percentagem acima de 0 significa que a tarefa começou. Se não indicar um início real, a aplicação usa o início planeado. Se a tarefa estiver planeada para começar depois da data de estado, a aplicação pergunta primeiro quando é que ela começou de facto.
- Uma percentagem de 100 significa que a tarefa está concluída. Se não indicar um fim real, passa a ser a data de estado, mesmo que o trabalho tenha de facto terminado antes.
- Um fim real torna a tarefa 100%. Se baixar uma tarefa concluída para abaixo de 100%, o fim real é removido. Se apagar o fim real, a percentagem volta a 0 e a tarefa continua *Em andamento* até também apagar o início real.
- A **duração restante** é a duração multiplicada pelo que ainda falta fazer, arredondada a dias úteis inteiros. Para uma tarefa de 2 dias úteis, 0% e 25% dão ambos 2 dias úteis de trabalho restante, e 50% e 75% dão ambos 1. A 90%, a aplicação arredonda para 0: o trabalho restante fica então terminado na data de estado. Uma tarefa em horas conta em minutos inteiros: uma tarefa de 5 horas a 40% tem 3 horas de trabalho restante.
- Um marco tem apenas uma data real.
- Uma fase (tarefa de resumo) não tem progresso próprio. Depois de calcular, a sua percentagem resulta das tarefas abaixo dela: a média ponderada das respetivas percentagens, usando a duração em dias úteis como peso. Um marco tem peso 0.

Se alterar a duração de uma tarefa que já está em curso, o trabalho feito mantém-se feito. A percentagem ajusta-se: uma tarefa de 5 dias úteis a 60% que defina para 10 dias úteis fica a 30%. A aplicação recusa uma duração inferior ao trabalho já feito.

### Tarefas concluídas e em curso

Uma tarefa concluída fica fixa nas suas datas reais. Deixa de se mover e, com data de estado, nunca é crítica. Sem data de estado, uma tarefa concluída ainda pode ser crítica.

Uma tarefa em curso mantém o seu início real. Só se move o trabalho restante. Onde começa o trabalho restante depende do modo de progresso.

### Retained Logic e Progress Override

O que faz a aplicação se uma tarefa já tiver começado enquanto a sua predecessora ainda está em curso? Esta relação chama-se **relação fora de sequência**: o progresso contradiz a ordem. Pense no pintor que já começa numa divisão que já foi estucada, enquanto o estucador ainda está ocupado noutro lado.

Dois modos de progresso decidem como a aplicação calcula isso:

- **Retained Logic** (o padrão): a relação mantém-se em vigor. O trabalho restante da sucessora segue a relação: com fim-início, só começa quando a predecessora estiver terminada, e nunca antes da data de estado.
- **Progress Override**: a realidade prevalece. O trabalho restante da sucessora começa na data de estado, sem esperar pela predecessora.

Neste perfil, a diferença está apenas no trabalho restante das tarefas que já começaram enquanto a predecessora ainda não terminou. As outras tarefas calculam o mesmo nos dois modos. A aplicação indica esta relação nos dois modos: na barra de estado, como *1 relação(ões) fora de sequência*, e no painel *Avisos*.

### Linhas de base e desvios

Ao guardar, a aplicação regista, para cada tarefa sem subtarefas, o início antecipado, o fim antecipado, a duração e o tipo de marco. As fases não fazem parte disso. O que alterar depois não toca na linha de base. Pode guardar várias linhas de base; exatamente uma fica **ativa**. O Gantt, o relatório de variance e o relatório de progresso usam a linha de base ativa.

O **desvio** é a diferença em dias úteis entre a linha de base e o planeamento atual. Um valor positivo significa mais tarde, um valor negativo mais cedo. A aplicação conta no calendário do projeto. O relatório de variance mostra o desvio do início e do fim de cada tarefa. O estado depende apenas do fim: *Mais tarde* para um valor positivo, *Mais cedo* para um valor negativo, caso contrário *No prazo*. Uma tarefa acrescentada depois da linha de base chama-se *Nova*; uma tarefa que já não existe é *Eliminada*.

Duas observações. O desvio de duração está na tabela de tarefas (coluna *Desvio de duração*), e não no relatório de variance. Compara a duração planeada da tarefa agora com a da linha de base. O progresso não altera essa duração planeada: uma tarefa planeada para dois dias que demorou três dias tem, por isso, um desvio de fim de +1, mas um desvio de duração de 0. E se guardar uma linha de base depois de ter introduzido progresso, ela regista o estado com essas datas reais; o desvio é então zero.

O relatório de progresso coloca o progresso planeado ao lado do progresso real. Ambos são ponderados por dias úteis. Planeado é a parte de cada tarefa que, segundo a linha de base, já devia estar terminada na data de estado; real é a percentagem que foi introduzida.

### Onde o vê

No Gantt, uma linha tracejada marca a data de estado, com a data no cabeçalho. Em cada tarefa em curso, a linha faz uma saliência até ao ponto da barra que a percentagem indica. Esta é a **linha de progresso**. Se desligar a linha de progresso e deixar a linha da data de estado ligada, fica uma linha reta; com as duas desligadas, desaparecem a linha e a etiqueta. Os botões *Sobreposição da linha de base*, *Linha de progresso* e *Linha de data de estado* estão em *Visualização › Linhas de base e progresso* e não alteram nada no cálculo. A linha de base aparece como uma barra fina por baixo de cada barra de tarefa. A tabela de tarefas tem colunas para o progresso e, por cada linha de base, para o desvio. No separador *Relatório* encontra os tipos de relatório *Variance* e *Relatório de progresso*.

## Exemplo resolvido: a ampliação após três semanas

O exemplo é o projeto de prática *House extension* dos tutoriais, no estado depois de todas as relações estarem adicionadas: sem férias da construção, recursos ou horas. No tutorial 6, faz isto por si próprio, no projeto de prática. Nessa altura, esse projeto já tem mais elementos, por isso os números são diferentes. Aqui lê por que razão os números são o que são.

A ampliação começa na segunda-feira, 7 de junho de 2027. No planeamento calculado, a aplicação guarda uma linha de base com o nome *Linha de base*: entrega na sexta-feira, 6 de agosto de 2027, 45 dias úteis.

### O estado na segunda-feira, 28 de junho

A data de estado é segunda-feira, 28 de junho de 2027. Isto é o que aconteceu:

- *Start of construction*, *Set up site*, *Clear garden and paving* e *Set out the extension* estão concluídas segundo o planeado, de 7 a 10 de junho.
- *Excavate foundation trench* estava planeada para 2 dias úteis (sexta-feira, 11, e segunda-feira, 14 de junho) e demorou 3: de 11 a 15 de junho.
- *Foundation formwork and reinforcement* vai de 16 a 18 de junho. *Reinforcement inspection* é a 18 de junho, *Pour foundation* na segunda-feira, 21 de junho.
- *Foundation brickwork* (2 dias úteis) começou na sexta-feira, 25 de junho e está a 50%.

Depois de **Calcular**, a aplicação calcula assim:

- O trabalho restante da foundation brickwork é 2 × (1 − 0,5) = 1 dia útil. Começa na data de estado, por isso termina na segunda-feira, 28 de junho.
- *Lay hollow-core floor* segue na terça-feira, 29 de junho. Por isso, *Build inner cavity leaf* começa na quarta-feira, 30 de junho, em vez de na terça-feira, 29 de junho. A entrega fica para segunda-feira, 9 de agosto: um dia útil depois da linha de base. O dia extra da escavação é, por isso, o atraso de todo o projeto, porque essa tarefa estava no caminho crítico.
- A barra de estado indica *Caminho crítico: 13 tarefas, 46 dias úteis*, face a 21 tarefas e 45 dias úteis antes do progresso. As oito tarefas concluídas que estavam no caminho crítico já não contam.
- A fase *Foundations* está a 77,8%. As tarefas da fase pesam 2 + 3 + 1 + 2 + 1 = 9 dias úteis. Já concluídos estão 2 + 3 + 1 dias úteis, mais metade de 2: 7 no total. E 7 em 9 é 77,8%. O marco *Reinforcement inspection* tem peso 0.

O relatório de variance coloca isto ao lado da linha de base:

- *Excavate foundation trench*: início 0, fim +1 (fim da linha de base 14 de junho, agora 15 de junho).
- *Foundation brickwork*: início +1 (24 de junho passou a 25 de junho), fim +1.
- *Build outer cavity leaf*: +1, +1. Esta tarefa ainda não é crítica: tinha 2 dias úteis de folga e mantém-nos.
- *Handover*: +1. O fim do projeto desvia-se em 1 dia útil.
- No total, 19 tarefas estão em *Mais tarde* e 4 em *No prazo*; nenhuma tarefa está em *Mais cedo*.

O relatório de progresso mostra *Planeado* 28,3% e *Real* 23,9%. As tarefas pesam 46 dias úteis no total. Segundo a linha de base, deviam estar terminados 13: 4 dias úteis da preparação, 2 da escavação, 3 da armadura, 1 da betonagem, 2 da foundation brickwork e 1 da hollow-core floor. Na realidade estão terminados 11: 4 + 2 + 3 + 1, mais meio dia útil da foundation brickwork.

### E se mudar a data de estado?

O mesmo progresso, outra data de estado. O trabalho restante da foundation brickwork começa sempre na data de estado, por isso a entrega move-se com ela:

- Data de estado sexta-feira, 25 de junho: o trabalho restante cai na sexta-feira, 25 de junho, e a entrega mantém-se na sexta-feira, 6 de agosto.
- Segunda-feira, 28 de junho: entrega na segunda-feira, 9 de agosto.
- Terça-feira, 29 de junho: entrega na terça-feira, 10 de agosto, 2 dias úteis depois da linha de base.

### E se alterar a percentagem?

A foundation brickwork tem 2 dias úteis. A 0% ou 25%, o trabalho restante é de 2 dias úteis: termina na terça-feira, 29 de junho, e a entrega passa para terça-feira, 10 de agosto. A 50% ou 75%, é de 1 dia útil: segunda-feira, 28 de junho, entrega na segunda-feira, 9 de agosto. A 90%, o trabalho restante é 0 e a tarefa termina na data de estado.

### E se definir uma data de estado sem introduzir progresso?

Se definir apenas a data de estado como segunda-feira, 28 de junho, e não introduzir nada, então, segundo o planeamento, ainda não aconteceu nada. Uma tarefa que ainda não começou não pode ficar no passado. Por isso, a aplicação move tudo para 28 de junho: *Start of construction* fica então nesse dia, e a entrega fica para sexta-feira, 27 de agosto, 15 dias úteis depois da linha de base. Por isso, introduza primeiro o progresso que existe.

## Exemplo resolvido: estucador e pintor

Agora um exemplo para o modo de progresso. A mesma ampliação, mas noutro estado: é quarta-feira, 21 de julho de 2027. Tudo até *Install building services*, inclusive, está concluído conforme o planeado. *Plastering* (4 dias úteis) começou na terça-feira, 20 de julho, e está a 25%. *Painting* (3 dias úteis) segue o plastering, mas o pintor já começou hoje e está a 33%.

Sem progresso, o plastering estava planeado de terça-feira, 20, a sexta-feira, 23 de julho, e a painting de segunda-feira, 26, a quarta-feira, 28 de julho. A barra de estado mostra agora *1 relação(ões) fora de sequência*: a painting começou enquanto o plastering ainda não está concluído. No painel *Avisos* aparece: *Fora de sequência: o progresso do sucessor contradiz a relação*.

O plastering tem 4 × (1 − 0,25) = 3 dias úteis de trabalho restante: 21, 22 e 23 de julho. A painting tem 3 × (1 − 0,33) = 2 dias úteis de trabalho restante.

- Com **Retained Logic**, esse trabalho restante só pode começar quando o plastering estiver concluído. Isso é sexta-feira, 23 de julho; por isso a painting começa segunda-feira, 26 de julho, e termina terça-feira, 27 de julho. A barra vai do início real, a 21 de julho, até 27 de julho. A folga total é de 7 dias úteis.
- Com **Progress Override**, o trabalho restante começa na data de estado. A painting termina quinta-feira, 22 de julho, antes de o plastering estar concluído. A folga total é de 10 dias úteis.

A entrega mantém-se sexta-feira, 6 de agosto, nos dois casos: a painting tinha folga de qualquer forma.

### Outros perfis de cálculo

Nos perfis Primavera P6 e Microsoft Project, a painting deste exemplo termina nas mesmas datas (27 e 22 de julho). Diferem nos pontos seguintes. São convenções do perfil; encontra-as em *Definições › Projeto › Definições do projeto*, no bloco *Perfil de cálculo e opções*.

- No perfil Microsoft Project, o trabalho que ainda não começou não passa para a data de estado (convenção *Não mover tarefas não iniciadas para a data de estado*). Se no exemplo acima só definir uma data de estado e não introduzir nada, a entrega nesse perfil mantém-se sexta-feira, 6 de agosto.
- No perfil Microsoft Project, o trabalho restante também não começa antes do início real mais a duração já decorrida (convenção *O trabalho restante retoma após a duração decorrida*). É um limite inferior extra, a seguir à data de estado: conta o mais tardio dos dois. Considere *Build inner cavity leaf* (5 dias úteis), iniciada na terça-feira, 29 de junho e a 40% na quarta-feira, 30 de junho, a data de estado (duas equipas estão a fazer alvenaria ao mesmo tempo, por isso os 40% já estão feitos após um dia). Tudo o que vem antes está concluído conforme o planeado. O Open Planner Studio e o Primavera P6 deixam a tarefa terminar na sexta-feira, 2 de julho; o Microsoft Project na segunda-feira, 5 de julho, porque terça-feira, 29 de junho, mais 2 dias úteis de duração decorrida é quinta-feira, 1 de julho, depois da data de estado.
- O Primavera P6 mostra como início antecipado de uma tarefa em curso o início do trabalho restante, e não o início real (no exemplo inner-leaf, quarta-feira, 30 de junho). A coluna *Início* e a barra mostram, porém, o início real em todos os perfis.
- No perfil Primavera P6, com Progress Override, a relação com uma sucessora que já começou também não conta para a predecessora: deixa de limitar as suas datas mais tardias e a sua folga livre (convenção *Progress Override ignora também para trás um sucessor iniciado*). No exemplo do estucador e do pintor não se vê isso, porque o plastering é crítico de qualquer forma através da betonilha do piso: as suas datas mais tardias e a sua folga livre são iguais com Retained Logic e com Progress Override.
- Quando abre um ficheiro .xer, a aplicação toma o modo de progresso do ficheiro. Actual Dates, o terceiro modo do P6, não é conhecido pela aplicação; esse ficheiro calcula como Retained Logic.

## Consequências e mal-entendidos

**«Vou só avançar a data de estado.»** Se a mover, o trabalho restante das tarefas em curso começa na nova data, e o trabalho que ainda não começou nunca pode ficar antes dessa data. Por isso, avance a data de estado só junto com uma atualização do progresso.

**«Introduzir 100% regista o fim real.»** Só se também introduzir o fim real. Se definir a tarefa a 100% sem fim real, o fim passa a ser a data de estado. Se, na verdade, tiver terminado antes, preencha o fim real.

**«0% significa não iniciado.»** Se uma tarefa tiver um início real, conta como iniciada, mesmo a 0%. Nesse caso, o trabalho restante é a duração completa e começa na data de estado. Apague o início real para que volte a contar como não iniciada.

**«Progress Override resolve o aviso.»** A mensagem de progresso fora de sequência mantém-se. O modo só decide como a aplicação calcula. Se a relação deixar de estar correta, altere a relação.

**«A pausa numa tarefa com divisão deixa de contar.»** Não: uma pausa na parte que ainda falta fazer mantém-se no trabalho restante. Considere uma tarefa de 5 dias úteis, com uma pausa de 1 dia após 2 dias de trabalho, iniciada na terça-feira, 29 de junho e, com a data de estado na quarta-feira, 30 de junho, a 40%. O trabalho restante de 3 dias úteis começa na data de estado e atravessa a pausa: o fim é segunda-feira, 5 de julho. Sem a pausa, era sexta-feira, 2 de julho.

**Horas e a data de estado.** Não pode introduzir uma hora no friso: introduza a data de estado como uma data. Se fizer o balanço depois do horário de trabalho, defina a data de estado para o dia útil seguinte. Uma tarefa em horas calcula o trabalho restante a partir do início da data de estado. Considere *Lay hollow-core floor* no projeto de prática, após o tutorial 4, em que tudo o que vem antes já está concluído: 5 horas, na segunda-feira, 28 de junho, dia útil a partir das 07:00. Com a data de estado na segunda-feira, 28 de junho, e a tarefa a 40%, a tarefa tem 3 horas de trabalho restante, de 07:00 a 10:00, mesmo que já se tenha feito trabalho nessa manhã. A forma como a aplicação conta as horas está explicada em [Dias e horas](docs://uitleg-dagen-en-uren).

**Atualizar a linha de base.** Não é possível. Guarde uma nova e apague a antiga. Se mover o projeto, as datas reais e a data de estado acompanham o projeto, mas as linhas de base, por padrão, não: assim, a deslocação continua visível como desvio. Veja [Mover um projeto](docs://howto-project-verplaatsen).

## Veja também

- [Atualizar o progresso](docs://howto-voortgang-bijwerken): definir a data de estado e introduzir o progresso.
- [Importar o progresso de uma folha de cálculo](docs://howto-voortgang-importeren): ler o progresso da equipa de obra de uma só vez.
- [Escolher o modo de progresso](docs://howto-voortgangsmodus-kiezen): definir Retained Logic ou Progress Override.
- [Guardar e gerir uma linha de base](docs://howto-baseline-opslaan-en-beheren): registar uma linha de base e usá-la.
- [Mover um projeto](docs://howto-project-verplaatsen): o que acontece às datas reais, à data de estado e às linhas de base.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): porque é que uma tarefa é crítica e o que significa a folga.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): progresso e uma data de estado a meio do projeto (20 de maio de 2027).
