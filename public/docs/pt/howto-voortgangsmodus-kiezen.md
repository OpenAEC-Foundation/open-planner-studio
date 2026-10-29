# Escolher o modo de progresso

Objetivo: decidir como a aplicação planeia o trabalho restante de uma tarefa que já começou enquanto a sua predecessora ainda está em curso: segundo a relação (Retained Logic) ou segundo o que acontece de facto (Progress Override).

## Quando precisa disto

Em obra, a execução muitas vezes avança à frente da lógica do planeamento. O pintor já começa nas salas que já foram estucadas, enquanto o estucador ainda está ocupado noutro sítio. No planeamento, isso é, por exemplo, uma relação fim-início cuja sucessora começa antes de a predecessora estar concluída. A aplicação chama-lhe **fora de sequência**. Se a barra de estado indicar *N relação(ões) fora de sequência*, tem um caso destes, e o modo de progresso decide como a aplicação planeia o trabalho restante da sucessora. O que fazem os dois modos, com um exemplo, está em [Progresso, data de estado e linha de base](docs://uitleg-voortgang).

## Passos

1. Atualize o progresso e defina a data de estado, como descrito em [Atualizar o progresso](docs://howto-voortgang-bijwerken).
2. Vá a *Planeamento › Linhas de base e progresso › Modo de progresso* e abra a lista.
3. Escolha *Retained Logic* ou *Progress Override*.
4. Prima **Calcular** (F5), por exemplo através de *Planeamento › Agendamento › Calcular*. A escolha deixa o planeamento desatualizado: a barra de estado indica *Desatualizado — recalcule (F5)*. Se *Calcular automaticamente* estiver ativo, a aplicação faz isto por si.

Como escolhe?

- **Retained Logic** é o padrão. A relação mantém-se em vigor: o trabalho restante da sucessora só começa quando a predecessora estiver concluída. Escolha esta opção se a ordem for mesmo fixa, ou se quiser planear com cautela.
- **Progress Override** deixa prevalecer a realidade. O trabalho restante da sucessora começa na data de estado, sem esperar pela predecessora. Escolha esta opção se a sucessora continuar mesmo a trabalhar e a data de fim não deve depender de uma predecessora que ainda está em curso.

## Verificar o resultado

- Clique na mensagem *N relação(ões) fora de sequência* na barra de estado. O painel *Avisos* abre-se; também é possível aceder a ele através de *Planeamento › Agendamento › Avisos*. Cada relação consta dele com o texto *Fora de sequência: o progresso do sucessor contradiz a relação*, por exemplo *4.2 Plastering → 4.5 Painting (FS)*.
- Observe a barra da sucessora. Com Retained Logic, a barra estende-se até depois do fim da sua predecessora. Com Progress Override, termina mais cedo. No exemplo da explicação, é terça-feira 27 de julho contra quinta-feira 22 de julho.

## Armadilhas e o que a aplicação faz

**Sem diferença.** O modo só tem efeito em tarefas que já começaram enquanto a predecessora ainda não está concluída. Sem uma tarefa destas, nada muda.

**A mensagem mantém-se.** Progress Override não resolve a mensagem de progresso fora de sequência. O modo decide como a aplicação calcula; a contradição entre relação e progresso mantém-se. Se a relação já não estiver certa, altere-a ([Adicionar relações](docs://howto-relaties-leggen)).

**Pertence ao projeto.** A escolha fica guardada no ficheiro do projeto, aplica-se a todo o projeto e pode ser anulada com Ctrl+Z. Um projeto novo usa Retained Logic.

**Um ficheiro P6.** Se abrir um ficheiro do Primavera P6 (.xer), a aplicação toma o modo do ficheiro. Além de Retained Logic e Progress Override, o P6 também tem Actual Dates. A aplicação não conhece esse terceiro modo; um ficheiro destes calcula com Retained Logic. A mensagem de importação regista isso como *1 definição de planeamento P6 usou uma alternativa segura.*

**O perfil de cálculo.** No perfil Primavera P6, Progress Override também atua para trás, nas datas mais tardias e na folga livre da predecessora (convenção *Progress Override ignora também para trás um sucessor iniciado*). Nos perfis Open Planner Studio e Microsoft Project não é assim. Encontra as convenções em *Definições › Projeto › Definições do projeto*, no bloco *Perfil de cálculo e opções*. No exemplo da explicação, esse efeito para trás não se vê.

## Ver também

- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): a diferença entre os dois modos, com números.
- [Atualizar o progresso](docs://howto-voortgang-bijwerken): introduzir o progresso ao qual o modo se aplica.
- [Adicionar relações](docs://howto-relaties-leggen): alterar uma relação que já não está certa.
