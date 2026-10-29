# Caminho crítico e folga

Porque é que a data de fim do projeto é a que é? E que tarefa pode atrasar um dia sem adiar a entrega? Estas perguntas estão na base do caminho crítico. Este artigo explica com exatidão o que a aplicação calcula, com um exemplo prático.

## O conceito

Um planeamento é uma rede de tarefas ligadas por **relações**: acordos como «os caixilhos só são colocados depois de a cobertura estar fechada». Essas relações unem as tarefas. Algumas cadeias de tarefas são mais longas do que outras. A cadeia mais longa decide quanto tempo demora o projeto inteiro.

Essa cadeia mais longa é o **caminho crítico**. Se uma tarefa do caminho atrasar um dia, a entrega atrasa-se um dia. Nele não existe folga.

As tarefas fora do caminho crítico têm margem. Essa margem chama-se **folga**. O pedreiro que constrói the outer cavity leaf poderia começar dois dias mais tarde sem que ninguém reparasse. Esses dois dias são a folga dessa tarefa.

Assim, crítico não diz nada sobre a importância de uma tarefa. Só diz que não há tempo a perder.

O método de cálculo chama-se **CPM** (Critical Path Method). Por isso o bloco com os resultados no painel *Propriedades* se chama *Resultado CPM*.

## Como a aplicação calcula

A aplicação não recalcula o planeamento por si só. O cálculo começa com **Calcular** (F5), por exemplo através de *Início › Agendamento › Calcular*. Se algo mudou desde o último cálculo, a barra de estado mostra *Desatualizado — recalcule (F5)*. Se *Calcular automaticamente* estiver ativo (em *Definições › Projeto › Definições da aplicação*, separador *Planeamento*, grupo *Cálculo*), a aplicação faz isto sozinha.

Um cálculo faz duas passagens pela rede.

### Passagem para a frente

A aplicação começa no início do projeto e segue as relações da predecessora para a sucessora. Para cada tarefa, a aplicação encontra o dia mais cedo em que a tarefa pode começar. Se uma tarefa tem várias predecessoras, espera pela última a terminar. Assim cada tarefa recebe o seu **início antecipado** e o seu **fim antecipado**. O fim antecipado mais tardio de todas as tarefas é a data de fim do projeto.

### Passagem para trás

Depois, a aplicação recua desde essa data de fim até ao início. Agora a aplicação encontra, para cada tarefa, o último dia em que a tarefa tem de terminar sem adiar a data de fim. Se uma tarefa tem várias sucessoras, conta a que tem de começar primeiro. Assim cada tarefa recebe o **início tardio** e o **fim tardio**.

### Folga total e folga livre

A diferença entre as datas tardias e antecipadas de uma tarefa é a sua **folga total**: o número de dias úteis que a tarefa pode atrasar ou começar mais tarde antes de a data de fim do projeto se deslocar. A aplicação conta dias úteis do calendário da tarefa. Um fim de semana ou um feriado não conta.

A **folga livre** é mais restrita. É o espaço que uma tarefa tem antes de uma das sucessoras ter de começar mais tarde. Pode usar esse espaço sem que nenhuma outra tarefa o note.

A folga total pode ser partilhada. Se duas tarefas não críticas se seguem uma à outra, partilham a mesma folga. Se a primeira usar tudo, a segunda já não tem nada. A primeira tem então folga total, mas não tem folga livre. A parte da folga total que não é livre chama-se **folga interferente**: se a usar, as tarefas seguintes também se deslocam. O exemplo abaixo mostra isto com números.

### Folga negativa

A folga também pode ficar negativa. Isso acontece quando uma tarefa tem um prazo, ou uma restrição que impõe uma data tardia, que fica antes da data que a aplicação calcula para essa tarefa. No papel, a tarefa já está atrasada. Então a tarefa e a cadeia que a antecede ficam críticas.

### Quando é uma tarefa crítica?

Por padrão, uma tarefa é crítica quando a sua folga total é 0 ou menos. Isto pode ser alterado em *Definições › Projeto › Definições do projeto*, no bloco *Perfil de cálculo e opções*, em *Opções de cálculo deste projeto*. Quando clica em *Aplicar*, a aplicação recalcula logo o planeamento. As opções pertencem ao ficheiro do projeto, não à aplicação.

- **Definição de crítica** com *Folga total ≤ limiar* e o campo *Limiar (dias úteis)*. O limiar é 0 por padrão. Para proteger uma reserva, defina-o para 2, por exemplo: cada tarefa com 2 dias úteis de folga ou menos conta como crítica e fica vermelha. Se escolher *Caminho mais longo*, uma tarefa é crítica quando está no caminho mais longo até ao último fim. Nesse caso, a folga não tem importância.
- **Vários caminhos de folga** numera as cadeias pela sua folga na coluna *Caminho de folga*. O caminho 1 é o caminho crítico. Veja [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies).
- **Marcar quase crítico** com o seu próprio *Limiar*, por padrão 2 dias úteis. Uma tarefa com mais de 0 mas no máximo essa folga fica com uma barra âmbar. Assim vê quais as tarefas que quase não têm folga, sem as chamar críticas.
- **Tarefas de extremidade aberta críticas**: uma tarefa sem sucessora que ainda não está terminada conta como crítica. Útil como rede de segurança contra relações esquecidas (ver os equívocos abaixo).
- **Cálculo da folga** decide se a folga total é medida no início da tarefa, no seu fim, ou como o menor dos dois. Os projetos novos ficam com *Automático (predefinido)*. Se o projeto usa o perfil Primavera P6 e esta escolha não é *Folga de fim*, um bloco laranja em *Definições do projeto* indica isso; o botão desse bloco define a escolha como *Folga de fim*. Para o MS Project, o mesmo botão repõe *Automático (predefinido)*: com uma data de estado, o próprio MS Project calcula dessa forma.

### Onde o vê

No Gantt, as tarefas críticas têm uma barra vermelha. Atrás de uma barra não crítica há uma faixa verde até ao fim tardio da tarefa: essa faixa é a folga. A *Faixa de folga* liga-se ou desliga-se em *Visualização › Linhas de base e progresso › Faixa de folga*.

Para uma tarefa selecionada, o painel *Propriedades* mostra tudo sob *Resultado CPM*: início e fim antecipados e tardios, folga total, livre e interferente, e se a tarefa está no caminho crítico. A folga de todas as tarefas lado a lado está nas colunas sob *Calculado* (o **+** à direita do cabeçalho da tabela), como *Folga total*, *Folga livre*, *Crítica* e *Quase crítica*.

A barra de estado no fundo conta as tarefas críticas, por exemplo *Caminho crítico: 21 tarefas, 45 dias úteis*.

## Exemplo prático: a ampliação da casa

O exemplo é o projeto de prática dos tutoriais, *House extension*, tal como está quando todas as relações estão definidas. No tutorial 2, «Relações e caminho crítico», constrói este exemplo sozinho e verifica os números. Aqui vai perceber porque é que os números são os que são.

A ampliação começa na segunda-feira, 7 de junho de 2027. Depois do cálculo, a entrega fica na sexta-feira, 6 de agosto de 2027, e a barra de estado diz *Caminho crítico: 21 tarefas, 45 dias úteis*. Duas tarefas não são críticas: *Build outer cavity leaf* e *Painting*.

### Duas cadeias que se encontram

Depois do piso estrutural (*Lay hollow-core floor*, terminado na segunda-feira, 28 de junho), a obra divide-se em duas cadeias. As duas acabam em *Install window frames*:

- O interior: *Build inner cavity leaf* (5 dias úteis), depois *Place roof elements* (1), depois *Apply roofing* (2). Os caixilhos só podem ser colocados depois de a cobertura estar fechada.
- O exterior: *Build outer cavity leaf* (6 dias úteis). Os caixilhos assentam na fachada, por isso essa tarefa também tem de estar terminada.

**Para a frente.** As duas folhas podem começar na terça-feira, 29 de junho. A folha interior termina na segunda-feira, 5 de julho. Os elementos da cobertura entram na terça-feira, 6 de julho, e a cobertura segue na quarta-feira, 7, e na quinta-feira, 8 de julho. A folha exterior termina na terça-feira, 6 de julho. *Install window frames* espera pela cadeia mais tardia, a cobertura, e por isso começa na sexta-feira, 9 de julho.

**Para trás.** Os caixilhos têm de começar na sexta-feira, 9 de julho, no máximo, senão a entrega atrasa-se. Assim a folha exterior tem de estar terminada na quinta-feira, 8 de julho, no máximo. Seis dias úteis para trás dão um início tardio na quinta-feira, 1 de julho.

**Folga.** A folha exterior pode começar no mais cedo a 29 de junho e tem de começar no mais tardar a 1 de julho. Pelo meio ficam 2 dias úteis: a quarta-feira, 30 de junho, e a quinta-feira, 1 de julho. Essa é a folga total da tarefa; o painel mostra *Folga total: 2 dias* e *Caminho crítico: Não*. A folga livre também é de 2 dias, porque a única sucessora, *Install window frames*, está no caminho crítico.

A cadeia interior não tem folga. Cada dia de atraso aí adia os caixilhos e tudo o que vem depois.

### Painting

*Painting* (3 dias úteis) começa depois do estuque, na segunda-feira, 26 de julho, e termina na quarta-feira, 28 de julho. A tarefa seguinte, *Snagging and cleaning*, também espera pelo ladrilhamento. Esta só fica pronta na quinta-feira, 5 de agosto, porque a betonilha do piso tem de secar primeiro cinco dias úteis. Assim, a pintura pode prolongar-se até quinta-feira, 5 de agosto. Isso dá 6 dias úteis de folga: 29 e 30 de julho, e de 2 a 5 de agosto. Também aqui a folga livre é igual à folga total, porque a sucessora é crítica.

### Quando a folha exterior atrasa

Se a folha exterior demorar 8 dias úteis em vez de 6, termina na quinta-feira, 8 de julho: exatamente no fim tardio dela. A folga desaparece e a tarefa fica vermelha. As duas cadeias ficam então críticas, e a barra de estado conta 22 tarefas críticas. A entrega mantém-se na sexta-feira, 6 de agosto.

Se demorar 9 dias úteis, a folha exterior só termina na sexta-feira, 9 de julho. Os caixilhos passam para a segunda-feira, 12 de julho, e a entrega para a segunda-feira, 9 de agosto: mais um dia útil. A cadeia exterior é agora o caminho crítico; a barra de estado diz *Caminho crítico: 19 tarefas, 46 dias úteis*.

A cadeia interior tem então 1 dia útil de folga total, mas esse dia é partilhado:

- *Build inner cavity leaf*: folga total 1, folga livre 0, folga interferente 1. Se a folha interior atrasar um dia, os elementos da cobertura também se deslocam com ela.
- *Place roof elements*: folga total 1, folga livre 0, folga interferente 1.
- *Apply roofing*: folga total 1, folga livre 1. Só aqui um dia de atraso não custa nada a ninguém.

É o mesmo dia único, partilhado por toda a cadeia. Se a folha interior o usar, deixa de existir para os elementos da cobertura e para a cobertura.

### Tarefas quase críticas e folga negativa

Com *Marcar quase crítico* ativo, com o limiar por padrão de 2 dias úteis, a folha exterior, com exatamente 2 dias de folga, fica com uma barra âmbar. A pintura, com 6 dias, mantém-se azul.

Se a entrega receber um prazo de quarta-feira, 4 de agosto, dois dias úteis antes da entrega calculada, a folga fica negativa. Todas as 21 tarefas do caminho crítico ficam com uma folga total de −2 dias úteis. A folha exterior já não tem folga e também fica crítica; a pintura mantém 4 dias úteis.

## Consequências e equívocos

**«Crítico quer dizer importante.»** Não. Uma inspeção pode ser crucial e, ainda assim, ter folga. Ao contrário, um trabalho simples pode ser crítico: no exemplo, *Snagging and cleaning* está no caminho crítico. Crítico refere-se só ao tempo: não sobra folga.

**«Esta tarefa tem folga, por isso pode esperar.»** Veja primeiro a folga livre. Se uma tarefa tem folga total mas não tem folga livre, cada dia de atraso retira folga às tarefas seguintes, como a folha interior no caso dos 9 dias úteis.

**Uma relação esquecida dá folga falsa.** Uma tarefa sem sucessora fica com folga até ao fim do projeto. Se o exemplo não tivesse a relação da folha exterior para os caixilhos, a folha exterior passaria de repente a ter 23 dias úteis de folga, até à entrega de 6 de agosto. No papel, podia então atrasar-se semanas sem que os caixilhos esperassem. Com *Tarefas de extremidade aberta críticas* ligado, a folha exterior fica crítica neste caso, e a lacuna fica visível.

**O caminho crítico não é fixo.** Se uma tarefa não crítica atrasar mais do que a sua folga, outra cadeia passa a ser a mais longa. Viu isso acima, com 9 dias úteis de alvenaria. Por isso o planeamento tem de ser recalculado depois de cada alteração. Enquanto a barra de estado disser *Desatualizado*, as barras vermelhas ainda pertencem ao cálculo anterior.

**A folga conta em dias úteis.** Os 6 dias úteis de folga da pintura vão de quinta-feira, 29 de julho, a quinta-feira, 5 de agosto: oito dias na agenda, porque o fim de semana não conta. Um feriado ou as férias da construção no calendário também não contam.

## Veja também

- [Adicionar relações](docs://howto-relaties-leggen): os passos para vincular tarefas e definir um desfasamento.
- [Relações e desfasamento](docs://uitleg-relaties): como as relações e o desfasamento determinam as datas antecipadas.
- [Restrições e prazos](docs://uitleg-constraints): como uma restrição ou um prazo produz folga negativa.
- [Seguir um caminho](docs://howto-pad-traceren): seguir a cadeia por trás de uma tarefa.
- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): a definição de crítica, quase crítica e o cálculo da folga, opção a opção.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): um projeto grande com vários caminhos de folga, tarefas quase críticas (limiar de 3 dias úteis), um hammock, um pino fixo e uma relação externa.
