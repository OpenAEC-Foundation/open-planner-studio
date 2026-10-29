# Escolher um tipo de tarefa

Objetivo: definir, por tarefa, o que a aplicação ajusta quando altera a duração, as unidades ou o trabalho: a própria duração, as unidades ou o trabalho.

## Quando precisa disto

Já atribuiu recursos a uma tarefa e quer que a aplicação calcule da forma como o faz. Um exemplo: a grua é alugada por um dia e esse dia é fixo. Outro exemplo: sabe que há 160 horas de alvenaria e quer ver quanto tempo demora com três pessoas em vez de duas. Estas duas situações precisam de tipos de tarefa diferentes.

O tipo de tarefa decide qual das três grandezas (duração, unidades e trabalho) acompanha a alteração quando muda outra. O contexto e os exemplos resolvidos estão em [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels).

## Passos

### Mostrar o tipo de tarefa

O tipo de tarefa não aparece por padrão. Ative-o uma só vez:

1. Escolha *Definições › Projeto › Definições da app*, separador *Planeamento*.
2. No grupo *Cálculo*, marque *Usar tipos de tarefa*.
3. Feche a janela com *Fechar*.

Esta é uma definição da aplicação, não do ficheiro do projeto. Se um ficheiro já contiver tipos de tarefa ou trabalho guardado, como um ficheiro do MS Project ou do Primavera P6, a aplicação mostra o tipo de tarefa desse ficheiro, mesmo sem esta definição. O mesmo acontece assim que escolhe um tipo de tarefa num ficheiro: a visualização fica então ativa para esse ficheiro, mesmo que volte a desligar a definição. Fica ativa enquanto o ficheiro estiver aberto e, depois de reabrir, enquanto o ficheiro contiver um tipo de tarefa ou trabalho guardado.

### Definir o tipo de tarefa

1. Selecione a tarefa. O painel *Propriedades* está à direita; se não o vir, ative-o com *Visualização › Painéis › Propriedades*.
2. Em *Tipo de tarefa*, escolha uma das cinco opções: *Predefinição do projeto (Duração e unidades fixas)*, *Duração e unidades fixas*, *Duração e trabalho fixos*, *Trabalho fixo* ou *Unidades fixas*. Com *Predefinição do projeto*, a tarefa segue a predefinição do projeto.
3. Quer saber o que faz uma opção? Na lista pendente aberta, cada opção tem um ícone i. Aponte para ele, clique ou toque nele para ver a explicação. Clicar no ícone i não escolhe ainda esse tipo de tarefa.
4. Ao lado do campo fechado há também um ícone i. Explica o tipo de tarefa que se aplica agora, por exemplo *A duração decorre do trabalho e das unidades.* Com *Predefinição do projeto*, é o tipo de tarefa entre parênteses.

*Predefinição do projeto* é a primeira opção e é o que uma tarefa tem por padrão. O tipo de tarefa entre parênteses é o que o projeto tem atualmente como predefinição. A aplicação não tem nenhum botão para alterar essa predefinição do projeto: ela vem de uma importação (por exemplo, do MS Project ou do Primavera P6) ou da ligação MCP. Se quiser outro tipo de tarefa para uma tarefa, escolha-o aqui.

Também pode escolher o tipo de tarefa na tabela. Clique no **+** à direita do cabeçalho da tabela de tarefas (*Adicionar coluna*) e, em *Planeamento*, escolha a coluna *Tipo de tarefa*.

Uma tarefa sem atribuição não tem nada para ligar, por isso o tipo de tarefa não tem efeito nela. Atribua primeiro um recurso (veja [Atribuir recursos com uma curva](docs://howto-resource-toewijzen)).

### Ver e alterar o trabalho

Para uma tarefa com atribuições, aparece uma coluna *Trabalho (h)* no bloco *Atribuições* do painel *Propriedades*, ao lado de *Unidades*. É o trabalho restante desse recurso, em horas. Um pequeno cadeado sobre uma coluna mostra o que o tipo de tarefa mantém: *Unidades* com *Duração e unidades fixas* e com *Unidades fixas*, *Trabalho (h)* com *Duração e trabalho fixos* e com *Trabalho fixo*.

Se quiser alterar o trabalho, introduza as horas no campo e prima Enter. A aplicação não aceita um valor de 0 ou menos: o campo volta ao valor anterior.

### Ver o que acontece

Se escolher um tipo de tarefa, ainda nenhum número muda. Com um tipo de tarefa que protege o trabalho, a aplicação fixa apenas o trabalho atual, por isso *Trabalho (h)* tem um valor guardado. Só na alteração seguinte é que o tipo de tarefa decide o que acompanha a mudança. Altere, por exemplo, *Unidades* e veja o que acontece à duração e ao trabalho.

Se isso alterar a duração da tarefa, a barra de estado mostra *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*, para ver as novas datas. Se *Calcular automaticamente* estiver ativo (no mesmo separador *Planeamento*, grupo *Cálculo*), a aplicação faz isto por si.

## Qual tipo de tarefa convém

- **Duração e unidades fixas** convém quando a duração é um acordo e as unidades são a sua entrada. O trabalho resulta destas duas. É o padrão. A grua alugada por um dia pertence aqui: o dia é fixo e o número de gruas nesse dia é o que se escolhe.
- **Duração e trabalho fixos** convém quando a tarefa tem de terminar dentro de um prazo fixo e se sabe quanto trabalho contém. Se a duração mudar, a aplicação ajusta as unidades.
- **Trabalho fixo** convém quando sabe quantas horas de trabalho contém e quer ver como a duração muda com o número de pessoas. As 160 horas de alvenaria com três pessoas em vez de duas pertencem aqui. O reboco do projeto de prática tem este tipo de tarefa.
- **Unidades fixas** convém quando as unidades são fixas, por exemplo uma grua, e o trabalho decide a duração.

## Erros comuns e o que a aplicação faz nesse caso

**Falta o campo *Tipo de tarefa*.** Nesse caso, a definição *Usar tipos de tarefa* está desligada e o ficheiro ainda não tem tipos de tarefa, ou selecionou um marco, uma fase, um hammock ou uma tarefa com o tipo de duração *Tempo decorrido*. Ali não há tipo de tarefa. Selecione uma tarefa normal.

**A duração muda sem que a altere.** Com *Trabalho fixo* e *Unidades fixas*, a duração decorre das unidades e do trabalho. Se alterar uma destas grandezas ou o número de recursos, a aplicação ajusta a duração, arredondada para cima até dias úteis inteiros. Numa tarefa em horas, a aplicação arredonda para cima até minutos inteiros.

**O trabalho não coincide exatamente com unidades × duração.** O arredondamento pode causar isso. No campo *Trabalho (h)* aparece então um sinal de aviso, *Difere de unidades × duração*. O histograma segue o trabalho guardado.

**O material não conta.** Para um recurso de material, *Trabalho (h)* mostra um traço. O material nunca determina a duração.

**Uma tarefa com progresso.** O tipo de tarefa atua sobre a parte restante. Por isso, *Trabalho (h)* mostra apenas o que ainda tem de acontecer.

**Anular uma alteração.** Escolher um tipo de tarefa, e cada alteração que o tipo de tarefa calcula, é um só passo para *Desfazer* (Ctrl+Z). O tipo de tarefa escolhido deixa então de estar aplicado, mas o campo *Tipo de tarefa* continua visível.

## Ver também

- [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels): como a aplicação liga a duração, as unidades e o trabalho, com exemplos resolvidos.
- [Atribuir recursos com uma curva](docs://howto-resource-toewijzen): colocar um recurso numa tarefa.
