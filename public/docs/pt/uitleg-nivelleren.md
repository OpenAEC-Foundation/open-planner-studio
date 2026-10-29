# Nivelamento de recursos

Tem um pedreiro e duas paredes que têm de ser construídas nos mesmos dias. No papel, o planeamento funciona, mas, na prática, ele só pode estar num sítio de cada vez. O nivelamento é a forma como a aplicação resolve estes conflitos: faz as tarefas começar mais tarde, até o recurso conseguir dar conta do trabalho. Neste artigo, pode ler exatamente o que o nivelamento desloca, quando a data de fim cede e o que não resolve por si.

## O conceito

Um recurso está **sobrealocado** num dia útil se o planeamento lhe pedir, nesse dia, mais do que consegue fornecer. O que pode fornecer é a sua capacidade: *Unidades máx* nos dias úteis do seu calendário. Se não trabalhar nesse dia, segundo o seu calendário, a capacidade é 0.

O **nivelamento** resolve isso fazendo as tarefas começar mais tarde. Não faz mais nada. Não encurta nem divide uma tarefa, não altera unidades nem relações e não acrescenta um recurso extra. Para cada tarefa, a aplicação procura o primeiro momento em que os recursos estão livres e desloca a tarefa para lá.

Há duas formas, na janela *Nivelar recursos*:

- Por padrão, a data de fim do projeto pode deslocar-se também. Esse é o nivelamento no sentido próprio.
- Com a caixa *Nivelar apenas dentro da folga (suavização) — a data de fim do projeto mantém-se fixa*, a aplicação só desloca tarefas dentro da respetiva folga. A data de fim mantém-se. Se isso não resultar, a tarefa fica onde está e a aplicação indica um conflito. O que é a folga, pode ler em [Caminho crítico e folga](docs://uitleg-kritiek-pad).

## Como a aplicação calcula

### Quanto pede uma tarefa

Por dia útil, a aplicação conta quantas unidades cada tarefa pede a um recurso. São as unidades segundo a curva ou a sua própria distribuição de horas, exatamente as mesmas horas por dia que o histograma mostra. A capacidade do recurso é *Unidades máx*, ou o valor do degrau da capacidade faseada no tempo que se aplica nesse dia. Um dia está sobrealocado se a procura for maior do que a capacidade.

### Em que ordem

A aplicação coloca as tarefas uma a uma, por esta ordem: primeiro a prioridade mais alta, depois a tarefa com menos folga total, depois a tarefa com o início antecipado mais cedo e, por fim, a ordem na tabela de tarefas. Uma tarefa só é tratada quando as suas predecessoras já têm o seu lugar.

A prioridade é um número de 0 a 1000 que se define para cada tarefa. O padrão é 500. No menu de contexto da barra de uma tarefa, chama-se *Prioridade*, com as opções *Baixa* (100), *Normal* (500) e *Alta* (900). Uma tarefa tratada mais cedo fica com o lugar que quer. As tarefas seguintes têm de se ajustar a ela. Assim, a prioridade decide que tarefa fica e qual cede. O valor 1000 é especial: uma tarefa com este valor nunca se desloca por causa da capacidade. É o equivalente ao «Do Not Level» do MS Project.

### Para onde se desloca uma tarefa

Para cada tarefa, a aplicação começa no início antecipado que as relações permitem. Isto tem em conta que as predecessoras também podem já ter sido deslocadas. Se a tarefa couber aí, fica. Se não couber, a aplicação experimenta o dia útil seguinte da tarefa, e assim por diante. Uma tarefa cabe se, em cada dia da tarefa, cada recurso tiver disponibilidade suficiente. Se a tarefa tiver vários recursos, todos têm de estar livres nesses dias. Assim, uma tarefa desloca-se sempre para mais tarde, nunca para mais cedo.

A aplicação regista o deslocamento como **atraso de nivelamento**: um número de dias úteis, no calendário da tarefa, em que a tarefa começa mais tarde do que as suas relações exigem. Vê-o na coluna *Atraso de nivelamento*, sob *Calculado*. O atraso fica guardado com o ficheiro do projeto. Calcular (F5) tem-o em conta como tempo de espera extra antes do início. As tarefas seguintes acompanham-na através das relações.

### Dentro da folga ou para além dela

Sem *suavização*, a aplicação continua a procurar até a tarefa caber. Por isso, a data de fim do projeto pode mudar.

Com *suavização*, uma tarefa não pode começar mais tarde do que o seu início tardio, que é o último dia em que poderia começar sem a data de fim se deslocar. Se a tarefa não couber nesse intervalo, fica no seu início antecipado. A tarefa aparece então em *Conflitos restantes*.

### O que a aplicação não desloca

- Tarefas que já começaram ou estão concluídas. A carga delas conta, mas nunca recebem um atraso de nivelamento.
- Tarefas com prioridade 1000. Seguem as predecessoras, mas não se deslocam por capacidade.
- Tarefas sem atribuição aos recursos selecionados, marcos e fases. Só se deslocam se uma predecessora se deslocar.
- Material. Nunca é nivelado.

### Proposta e aplicação

*Calcular* cria uma proposta: as tarefas que se deslocam, com o início anterior e o novo, e a data de fim antes e depois. Nada muda no seu planeamento até escolher *Aplicar*. Depois, a aplicação grava os atrasos nas tarefas e recalcula o planeamento de imediato.

## Exemplo trabalhado: o pedreiro em duas paredes

O exemplo é o projeto de prática dos tutoriais *House extension*, tal como está imediatamente antes do nivelamento no tutorial 5. No tutorial 5, faz isto sozinho e verifica os números. Neste exemplo, o reboco está em *Trabalho fixo* e o estucador trabalha com unidades de 2, tal como em [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels).

Depois da laje alveolar, concluída na segunda-feira, 28 de junho, o pano interior da parede de caixa de ar (5 dias úteis) e o pano exterior (6 dias úteis) começam ambos na terça-feira, 29 de junho. Ambos estão atribuídos ao pedreiro, com unidades de 1 e *Unidades máx* de 1. Depois do pano interior vêm os elementos da cobertura (um trabalho de grua de 6 horas) e a cobertura (2 dias úteis). Os caixilhos esperam pela cobertura e pelo pano exterior. A entrega é na segunda-feira, 30 de agosto.

### A sobrealocação

O pano interior decorre de 29 de junho a 5 de julho, inclusive, e o pano exterior de 29 de junho a 6 de julho, inclusive. De 29 de junho a 5 de julho, inclusive, são 5 dias úteis em que o planeamento pede 2 unidades a um pedreiro com capacidade de 1. O pedreiro está sobrealocado nesses 5 dias.

### A ordem

As duas tarefas têm prioridade 500. Os caixilhos só são entregues a 14 de julho (no tutorial 3, define para isso uma restrição *Não começar antes de (SNET)*). Por isso, o pano interior tem 3 dias úteis de folga e o exterior 5. O pano interior tem a menor folga e por isso é tratado primeiro. Fica de 29 de junho a 5 de julho, inclusive.

### O deslocamento

O pano exterior não pode começar a 29 de junho. O primeiro dia em que o pedreiro volta a ficar livre é a terça-feira, 6 de julho. São mais 5 dias úteis do que o início antecipado, por isso o atraso de nivelamento é 5. O pano exterior decorre agora de 6 de julho a 13 de julho, inclusive. Os caixilhos só começam a 14 de julho de qualquer forma, por isso a entrega mantém-se na segunda-feira, 30 de agosto. A janela indica *Data de fim do projeto: inalterada (30-08-2027)* e mostra uma linha: *Build outer cavity leaf*, início anterior 29-06-2027, novo início 06-07-2027, *5 d*.

Os 5 dias úteis de deslocamento são exatamente a folga do pano exterior. Por isso, o *nivelamento* dá aqui o mesmo resultado. O pano exterior já não tem folga e é crítico.

### E se os caixilhos não chegarem a 14 de julho

Sem essa restrição, os caixilhos podem começar na sexta-feira, 9 de julho, e a entrega é na quarta-feira, 25 de agosto. O pano exterior tem então apenas 2 dias úteis de folga.

- Sem *nivelamento*, o pano exterior continua a deslocar-se 5 dias úteis. Agora os caixilhos têm de esperar: começam a 14 de julho, 3 dias úteis mais tarde. Tudo o que vem depois deles se desloca também, e a entrega passa de 25 de agosto para 30 de agosto, também 3 dias úteis mais tarde.
- Com *nivelamento*, nada se desloca. O pano exterior não cabe nos seus 2 dias úteis de folga. A janela mostra o conflito *Build outer cavity leaf*, 5 day(s), com a razão *Não há capacidade livre suficiente dentro da folga para resolver este conflito.*

### E se o pano exterior tiver prioridade

Se definir a prioridade *Alta* (900) para o pano exterior, ele é tratado primeiro. Fica a 29 de junho e agora o pano interior cede: 6 dias úteis mais tarde, de 7 de julho a 13 de julho, inclusive. O pano interior tem apenas 3 dias úteis de folga, por isso deslocar 6 dias úteis são 3 a mais do que a folga permite. Os elementos da cobertura, os caixilhos e tudo o que vem depois deles deslocam-se também. A entrega passa de segunda-feira, 30 de agosto, para quinta-feira, 2 de setembro. A mesma sobrealocação dá, portanto, uma data de fim diferente, consoante a tarefa que fica no seu lugar.

### E se chegar um segundo pedreiro

Se definir *Unidades máx* do pedreiro como 2, já não há sobrealocação. *Calcular* indica *Nenhuma tarefa precisa de ser deslocada — a planificação já está livre de conflitos.*

## Consequências e ideias erradas

**«O nivelamento encontra o planeamento mais curto.»** Não. A aplicação trabalha tarefa a tarefa, numa ordem fixa, e não procura a melhor solução global. Veja o exemplo com a prioridade: outra prioridade dá outra data de fim.

**«Uma tarefa nivelada está segura.»** O nivelamento usa a folga. A tarefa deslocada fica então com menos folga ou sem folga, e pode tornar-se crítica, como o pano exterior acima. Se atrasar, a entrega desloca-se.

**«O nivelamento acompanha as suas alterações posteriores.»** Não. O atraso é um número fixo de dias úteis. Se o pano interior ficar mais curto depois do nivelamento, o pano exterior continua a começar 5 dias úteis mais tarde, mesmo que já não seja preciso. Nivele de novo nesse caso. A aplicação começa do zero.

**Nem tudo se resolve deslocando tarefas.** Se o recurso não trabalhar nos dias de que a tarefa precisa, ou se a tarefa, pela sua curva, pedir mais num dia do que o recurso pode fornecer, a sobrealocação mantém-se. A aplicação indica então o motivo na tarefa.

**O material não é nivelado.** Se o material pedir mais do que a sua capacidade num dia, a aplicação indica isso como sobrealocação, mas o nivelamento deixa-o como está.

**Tarefas fixadas.** Se todas as tarefas em conflito tiverem prioridade 1000, a janela indica *Nenhuma tarefa precisa de ser deslocada — a planificação já está livre de conflitos.*, mas a sobrealocação mantém-se. Por isso, depois de aplicar, veja a mensagem *Superalocação* no friso.

## Ver também

- [Resolver a sobrealocação](docs://howto-overbezetting-oplossen): os passos para encontrar a sobrealocação e nivelá-la.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que é a folga e porque uma tarefa se torna crítica.
- [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels): como a duração de uma tarefa acompanha as unidades.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): três torres que precisam das mesmas equipas e da grua-torre, e o que o nivelamento faz com isso.
