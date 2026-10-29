# Tipos de tarefa: duração, unidades e trabalho

Coloca um estucador no plastering e a tarefa demora quatro dias. Se acrescentar um segundo estucador, o trabalho pode ficar feito em dois dias. Também pode continuar com quatro dias, mas com o dobro do trabalho. As duas situações fazem sentido. A opção que a aplicação escolhe depende do **tipo de tarefa** definido na tarefa. Neste artigo fica a saber como a aplicação liga duração, unidades e trabalho, e o que cada tipo de tarefa mantém constante.

## O conceito

Três grandezas estão ligadas entre si:

- **Duração**: quanto tempo a tarefa dura, em dias úteis ou em horas.
- **Unidades**: quanto de um recurso trabalha na tarefa por dia útil. No painel *Propriedades* chama-se *Unidades*, noutras janelas *Unid./dia*. Unidades de 1 correspondem a um estucador o dia inteiro, 2 a dois e 0,5 a meio dia.
- **Trabalho**: o número total de horas que o recurso gasta na tarefa.

A soma é: trabalho = duração × unidades × horas por dia útil. As horas por dia útil vêm do calendário da tarefa. O plastering, com quatro dias úteis e um estucador, tem, com um dia útil de 8 horas, 4 × 1 × 8 = 32 horas de trabalho.

Se alterar uma das três grandezas, pelo menos uma das outras duas tem de acompanhar, senão a soma deixa de estar certa. O tipo de tarefa decide qual. Pode defini-lo por tarefa, no painel *Propriedades*. A aplicação só mostra o tipo de tarefa e o trabalho depois de os ativar; como se faz isso está em [Escolher um tipo de tarefa](docs://howto-werkregel-kiezen).

Um tipo de tarefa só funciona em tarefas normais. Marcos, fases (tarefas de resumo), hammocks e tarefas cujo *Tipo de duração* é *Tempo decorrido* não o têm: o campo *Tipo de tarefa* não aparece. O material, como betão ou argamassa de reboco, também não conta. A quantidade de material nunca determina a duração, e a aplicação nunca a ajusta por causa de um tipo de tarefa.

## Como a aplicação calcula

### O tipo de tarefa atua sobre o que altera

A aplicação recalcula duração, unidades e trabalho só no momento em que altera um deles: a duração da tarefa, as unidades de uma atribuição, o trabalho, um recurso adicionado ou removido, ou as horas por dia num calendário. **Calcular** (F5) não altera nenhum deles: F5 calcula apenas as datas. Escolher um tipo de tarefa também não altera um único número. O tipo de tarefa conta na sua próxima alteração.

Se um tipo de tarefa alterar a duração da tarefa, o planeamento fica desatualizado. A barra de estado indica então *Desatualizado — recalcule (F5)*, a não ser que *Calcular automaticamente* esteja ativado.

### Quatro tipos de tarefa

No painel *Propriedades* há um ícone i ao lado da lista *Tipo de tarefa*. Aponte para ele, clique ou toque nele, e a aplicação explica o tipo de tarefa que se aplica agora. Na lista aberta, cada opção também tem esse ícone i. A explicação começa com uma frase em negrito. Os quatro tipos de tarefa, com essa frase da aplicação:

- **Duração e unidades fixas** (*O trabalho decorre da duração e das unidades*). É o padrão. A aplicação nunca altera a própria duração, e o trabalho decorre da duração e das unidades. Se introduzir o trabalho manualmente, a aplicação ajusta as unidades, porque a duração está fixa.
- **Duração e trabalho fixos** (*As unidades decorrem da duração e do trabalho*). A aplicação nunca altera a própria duração. Se alterar a duração, o trabalho mantém-se e as unidades ajustam-se.
- **Trabalho fixo** (*A duração decorre do trabalho e das unidades*). O trabalho é fixo, e a duração decorre do trabalho e das unidades.
- **Unidades fixas** (*A duração decorre do trabalho e das unidades*). As unidades são fixas, e a duração decorre do trabalho.

Assim, dois tipos de tarefa não alteram a duração. Com os outros dois, a duração acompanha quando altera as unidades, o trabalho ou o número de recursos. Com um só recurso, *Trabalho fixo* e *Unidades fixas* fazem exatamente o mesmo. Diferem quando altera a própria duração: com Trabalho fixo o trabalho mantém-se e as unidades ajustam-se; com Unidades fixas as unidades mantêm-se e o trabalho cresce com ela. Diferem também quando há mais recursos na tarefa (ver abaixo).

Os exemplos resolvidos abaixo mostram o que cada tipo de tarefa faz.

### Arredondamento

A duração que resulta da soma é arredondada para cima pela aplicação. Numa tarefa em dias, arredonda para dias úteis inteiros; numa tarefa em horas, para minutos inteiros. O trabalho e as unidades ficam como os introduziu ou como a aplicação os tirou da soma. Por isso a soma às vezes deixa de bater certo exatamente. O exemplo abaixo mostra o que acontece então.

### Vários recursos

Se uma tarefa tiver vários recursos, aplicam-se duas regras. Com Duração e trabalho fixos, Trabalho fixo e Unidades fixas, o trabalho total mantém-se quando acrescenta ou remove um recurso. A aplicação divide-o então em proporção às unidades. Com Duração e unidades fixas, um novo recurso traz o seu próprio trabalho. Com Trabalho fixo e Unidades fixas, o recurso mais lento decide a duração: por recurso, é o trabalho dividido pelas unidades, e conta o maior resultado.

Um exemplo: dois recursos têm cada um 32 horas de trabalho e unidades de 1, ou seja, 4 dias úteis no total. Se definir as unidades do primeiro para 0,5, a duração passa então a ser de 8 dias úteis. Com Trabalho fixo, o segundo recurso mantém as suas 32 horas de trabalho e as unidades descem para 0,5. Com Unidades fixas, o segundo mantém as unidades de 1 e o trabalho cresce para 64 horas.

### Progresso

Se a tarefa já tiver progresso, o tipo de tarefa atua sobre a parte restante: a duração restante e o trabalho restante. No painel *Propriedades*, esse trabalho está na coluna *Trabalho (h)*. O que já foi feito mantém-se.

### Tarefas horárias

Uma tarefa horária calcula da mesma forma, mas em minutos. Se só a crane estiver atribuída a uma tarefa de 5 horas, são 5 horas de trabalho. Com Trabalho fixo, a duração para unidades de 2 passa então a ser de 2,5 horas. O hollow-core floor do projeto de prática também tem a carpentry crew atribuída. Continua a precisar de 5 horas de trabalho, é a mais lenta, e por isso a duração mantém-se em 5 horas. A forma como as horas e os dias se relacionam explica-se em [Dias e horas](docs://uitleg-dagen-en-uren).

## Exemplo resolvido: o plastering

O exemplo é o projeto de prática *House extension* dos tutoriais. No tutorial 5, faz as contas por conta própria e verifica os números. Aqui fica a saber o que faz cada tipo de tarefa.

O plastering demora 4 dias úteis. Um estucador está atribuído a ele, com unidades de 1, e o dia útil tem 8 horas. Assim, o trabalho é de 32 horas.

### Duração e unidades fixas

- Se definir a duração como 6 dias úteis, o trabalho sobe para 48 horas e as unidades mantêm-se em 1.
- Se definir as unidades como 2, a duração mantém-se em 4 dias úteis e o trabalho passa a 64 horas.
- Se escrever 48 horas em *Trabalho (h)*, a duração mantém-se em 4 dias úteis e as unidades passam a 1,5.
- Se atribuir um segundo recurso, por exemplo *Plasterer 2*, com unidades de 1, a duração mantém-se em 4 dias úteis e esse segundo traz 32 horas de trabalho, 64 horas no total.

### Duração e trabalho fixos

- Se definir a duração como 6 dias úteis, o trabalho mantém-se em 32 horas e as unidades descem para 0,67.
- Se definir as unidades como 2, a duração mantém-se em 4 dias úteis. Como a duração está fixa, o trabalho cresce junto, para 64 horas.
- Se escrever 16 horas em *Trabalho (h)*, a duração mantém-se em 4 dias úteis e as unidades passam a 0,5.
- Se atribuir um segundo recurso, por exemplo *Plasterer 2*, com unidades de 1, as 32 horas são divididas, 16 horas cada, e as unidades passam a 0,5 para os dois. A duração mantém-se em 4 dias úteis.

### Trabalho fixo

- Se definir a duração como 6 dias úteis, o trabalho mantém-se em 32 horas e as unidades descem para 0,67.
- Se definir as unidades como 2, o trabalho mantém-se em 32 horas e a duração passa a 2 dias úteis. Este é o passo que se faz no tutorial 5.
- Se escrever 48 horas em *Trabalho (h)*, as unidades mantêm-se em 1 e a duração passa a 6 dias úteis.
- Se atribuir um segundo recurso, por exemplo *Plasterer 2*, com unidades de 1, as 32 horas são divididas, 16 horas cada, e a duração passa a 2 dias úteis. Se remover de novo esse segundo recurso, a duração volta a ser de 4 dias úteis.

### Unidades fixas

- Se definir a duração como 6 dias úteis, as unidades mantêm-se em 1 e o trabalho sobe para 48 horas.
- Se definir as unidades como 2, o trabalho mantém-se em 32 horas e a duração passa a 2 dias úteis.
- Se escrever 48 horas em *Trabalho (h)*, as unidades mantêm-se em 1 e a duração passa a 6 dias úteis.
- Se atribuir um segundo recurso, por exemplo *Plasterer 2*, com unidades de 1, as 32 horas são divididas, 16 horas cada, e a duração passa a 2 dias úteis.

### Quando a soma não bate certo

Com Trabalho fixo, se definir as unidades como 3, o trabalho é de 32 horas, por isso a duração passa a ser 32 ÷ (3 × 8) = 1,33 dias úteis. A aplicação arredonda para cima, para 2 dias úteis. O trabalho (32 horas) e as unidades (3) mantêm-se, mas 2 × 3 × 8 são 48 horas. O histograma distribui, por isso, as 32 horas pelos 2 dias úteis: 2 unidades por dia, e não 3. No campo *Trabalho (h)* aparece um sinal de aviso, *Difere de unidades × duração*, para mostrar isto.

Com dois recursos com unidades diferentes, o mecanismo é o mesmo. Com Trabalho fixo, se acrescentar um segundo recurso, por exemplo *Plasterer 2*, com unidades de 2 ao estucador com unidades de 1, a aplicação divide as 32 horas na proporção 1 : 2, ou seja, 10,7 e 21,3 horas. Ambos precisam então de 1,33 dias úteis. A duração passa a 2 dias úteis.

Um ficheiro do P6 ou do MS Project também pode ter um *Trabalho (rest.)* que não seja igual a unidades × duração restante. Aparece então o mesmo sinal de aviso. A aplicação não altera este trabalho por si. Se alterar a duração de uma tarefa destas, a aplicação segue o tipo de tarefa, também quando o trabalho restante veio do ficheiro. Com *Duração e unidades fixas* e *Unidades fixas*, o trabalho restante passa a ser unidades × a nova duração restante. Com *Duração e trabalho fixos* e *Trabalho fixo*, o trabalho mantém-se e as unidades ajustam-se. Se um trabalho restante vindo do ficheiro desaparecer assim, recebe uma notificação com o número de horas antigo e o novo. Ctrl+Z repõe o valor antigo. A explicação junto ao sinal de aviso indica, tarefa a tarefa, qual dos dois casos acontece.

### Um calendário diferente

Com Trabalho fixo, o dia útil do calendário passa de 8 para 6 horas. O trabalho mantém-se em 32 horas, por isso a duração passa a 32 ÷ 6 = 5,33, arredondada para cima para 6 dias úteis. A forma como a aplicação conta os dias úteis e as horas de trabalho explica-se em [Calendários e dias úteis](docs://uitleg-kalenders). A aplicação informa: *Após a alteração do calendário, o tipo de tarefa ajustou a duração de 1 tarefa (o trabalho mantém-se, as horas por dia mudaram).*

### Uma tarefa com progresso

O inner cavity leaf demora 5 dias úteis e está 40% concluído: 2 dias úteis estão feitos e 3 dias úteis (24 horas) faltam. Com Trabalho fixo, se mudar as unidades de 1 para 2, o trabalho restante mantém-se em 24 horas e a duração restante passa a 1,5, arredondada para cima para 2 dias úteis. A tarefa passa a demorar 2 + 2 = 4 dias úteis e o progresso é de 50%. A percentagem sobe, porque a parte já feita se mantém e a restante fica mais curta.

## Consequências e ideias erradas

**«Trabalho fixo significa que a duração é fixa.»** Não, é precisamente o contrário. Com *Duração e unidades fixas* e *Duração e trabalho fixos*, a duração é fixa. Com *Trabalho fixo* e *Unidades fixas*, a duração decorre das outras duas.

**«Se eu escolher um tipo de tarefa, o meu planeamento muda.»** Não. Escolher não altera nenhum número. Só na sua próxima alteração o tipo de tarefa decide o que acompanha. Com um tipo de tarefa que protege o trabalho, a aplicação fixa o trabalho no momento em que escolhe, para haver um número a proteger. Essa tarefa tem então um *Trabalho (h)* guardado.

**«A duração mudou sem eu lhe tocar.»** Pode acontecer depois de uma alteração às unidades, ao trabalho, ao número de recursos ou às horas por dia, com Trabalho fixo ou Unidades fixas. A barra de estado indica então que o planeamento está desatualizado. Prima **Calcular** (F5) para ver as novas datas.

**Sem atribuição, um tipo de tarefa não faz nada.** Não há então unidades nem trabalho a ligar à duração.

**Os ficheiros do MS Project ou do Primavera P6 mostram sempre o tipo de tarefa.** Numa tarefa do MS Project, a aplicação por vezes mantém a definição orientada pelo esforço. Essa definição guardada tem efeito em dois casos. Com *Duração e trabalho fixos* e a definição orientada pelo esforço, o trabalho acompanha quando altera a duração, em vez das unidades. Com *Unidades fixas* e a definição não orientada pelo esforço, o trabalho acompanha quando acrescenta ou remove um recurso, e a duração mantém-se. As tarefas que cria na aplicação não têm esta definição. A explicação por trás do ícone i tem em conta esta definição.

## Ver também

- [Escolher um tipo de tarefa](docs://howto-werkregel-kiezen): os passos para definir o tipo de tarefa de uma tarefa.
- [Atribuir recursos com uma curva](docs://howto-resource-toewijzen): colocar um recurso numa tarefa, com unidades e distribuição.
- [Dias e horas](docs://uitleg-dagen-en-uren): como a aplicação converte dias e horas.
- [Calendários e dias úteis](docs://uitleg-kalenders): como a aplicação conta os dias úteis e as horas de trabalho.
