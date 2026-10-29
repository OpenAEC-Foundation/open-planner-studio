# Atribuir recursos com uma curva

Objetivo: colocar um recurso numa tarefa, com unidades por dia e uma curva que decide como essas unidades se distribuem pelos dias da tarefa.

## Quando precisa disto

Assim que quiser ver quem trabalha onde e quando: o pedreiro no pano exterior da parede de caixa-de-ar, a grua nas lajes alveolares. Sem atribuição não há carga e, por isso, também não há histograma nem sobrealocação.

Dois termos. As **unidades** (no painel, na coluna *Unidades*, e na janela *Atribuir*, no campo *Unid./dia*) indicam quanto do recurso trabalha na tarefa por dia útil: 1 é um pedreiro, 2 são dois, 0,5 é meio dia. A **curva** decide como o total, unidades vezes duração, se distribui pelos dias úteis da tarefa. O trabalho raramente é igual ao longo do tempo: numa parede o início é calmo, o meio é intenso e o fim volta a ser calmo.

O pano exterior da parede de caixa-de-ar leva 6 dias úteis. Com um pedreiro e a curva *Uniforme*, são 1 unidade em cada um dos 6 dias, 6 no total. Com a curva *Em sino*, continuam a ser 6 unidades no total, mas a distribuição passa a ser 0, 1, 2, 2, 1 e 0.

## Passos

Pode atribuir um recurso de duas formas. O recurso tem de já existir (consulte [Gerir recursos](docs://howto-resources-beheren)).

### Através do friso

1. Selecione uma tarefa na tabela de tarefas. Tem de ser uma tarefa normal, não um marco nem uma fase.
2. Escolha *Recursos › Atribuição › Atribuir ▾*.
3. Na janela, preencha *Unid./dia* (padrão 1) e escolha a *Curva* (padrão *Uniforme*). Estes valores aplicam-se ao recurso que escolher agora.
4. Clique no recurso. A janela fecha-se e a atribuição fica criada.

Para um segundo recurso, abra a janela outra vez. Os recursos que já estão na tarefa não aparecem na lista.

### Através do painel de propriedades

1. Selecione a tarefa. O painel *Propriedades* fica à direita; se não o vir, ative-o em *Visualização › Painéis › Propriedades*.
2. No bloco *Atribuições*, no fundo, escolha o recurso em *Atribuir recurso*. A atribuição começa com 1 unidade e a curva *Uniforme*.
3. Em cada atribuição, altere *Unidades*. Clique no nome do recurso para mostrar a *Curva* e escolha outra curva ali.

Assim também altera uma atribuição existente. Com o ícone de lixo (*Remover*) no fim da linha, retira a atribuição da tarefa. O próprio recurso mantém-se. Com *Mover para…* (visível depois de clicar no nome) move a atribuição para outra tarefa.

### As curvas

- *Uniforme*: igual em todos os dias. Este é o padrão e serve trabalho igualmente pesado em todos os dias.
- *Carregado no início*: o início é mais pesado do que o fim. Serve trabalho que começa com muito esforço, como a implantação.
- *Carregado no fim*: o fim é mais pesado do que o início. Serve trabalho que fica mais intenso à medida que se aproxima da conclusão.
- *Em sino*: um pico no meio, com início e fim calmos. Serve uma parede que começa devagar, está em pleno ritmo no meio e abranda no fim.
- *Pico inicial*: um pico antes do meio. Serve trabalho que atinge depressa o ritmo pleno.
- *Pico tardio*: um pico depois do meio. Serve trabalho cuja fase intensa só chega mais tarde.
- *Pico duplo*: dois picos. Serve trabalho com dois momentos intensos.
- *Tartaruga*: início e fim calmos com um pico largo no meio. Serve trabalho longo que aumenta e diminui gradualmente.

A curva altera apenas a distribuição. A duração, as datas e o total mantêm-se. Não precisa de recalcular depois. O histograma ajusta-se de imediato. Escolha *Recursos › Histograma › Histograma* para o ver. Se selecionar uma tarefa, o histograma mostra apenas a carga dessa tarefa.

## Pontos de atenção e o que a aplicação faz nesse caso

**Uma curva pode levar o pico acima das suas unidades.** Com um número inteiro de unidades, a aplicação arredonda o valor por dia para unidades inteiras, e o total mantém-se. Um pedreiro com 1 unidade no pano exterior da parede de caixa-de-ar e a curva *Em sino* dá 0, 1, 2, 2, 1, 0. Nos dois dias do meio são 2 unidades, contra *Unidades máx* de 1. O histograma pinta esses dias de vermelho e o recurso fica sobrealocado. Escolha outra curva, ou distribua as horas manualmente (consulte [Ajustar a distribuição de horas](docs://howto-urenverdeling-aanpassen)). Com unidades como 0,5, a aplicação arredonda às centésimas. Numa tarefa curta com unidades inteiras, a forma fica, por isso, grosseira: em 10 dias, a *Tartaruga* com 1 unidade dá a distribuição 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, exatamente igual à do *Pico inicial*.

**Nem marco nem fase.** O botão *Atribuir* fica então desativado, e *Propriedades* diz *Não é possível atribuir em marcos.* ou *Não é possível atribuir em tarefas de resumo.*

**Um recurso só uma vez por tarefa.** Se o recurso já estiver na tarefa, deixa de aparecer na lista. Se todos os recursos já estiverem na tarefa, a aplicação diz *Todos os recursos já estão atribuídos.* Se ainda não houver nenhum recurso, diz *Crie primeiro recursos (separador Recursos).*

**As unidades têm de ser maiores do que 0.** A aplicação não aceita um valor igual a 0 ou inferior.

**Material.** Para um recurso de material, as unidades são a quantidade por dia, na unidade do recurso, por exemplo m³. O material não conta para a duração da tarefa.

**Um tipo de tarefa pode ajustar a duração.** Se a tarefa estiver em *Trabalho fixo* ou *Unidades fixas*, um segundo recurso altera a duração da tarefa. O planeamento fica então desatualizado; prima **Calcular** (F5). Consulte [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels).

**Uma distribuição própria.** Se a atribuição já tiver uma distribuição de horas própria, a curva fica desativada e mostra *Contorno*. Liberte primeiro essa distribuição através de *Distribuição de horas…*.

**Desfazer.** Pode desfazer a criação, a alteração ou a remoção de uma atribuição com *Desfazer* (Ctrl+Z).

## Ver também

- [Ajustar a distribuição de horas](docs://howto-urenverdeling-aanpassen): definir manualmente as horas por dia.
- [Resolver a sobrealocação](docs://howto-overbezetting-oplossen): o que fazer quando um recurso tem demasiado trabalho num dia.
- [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels): o que acontece à duração quando altera as unidades.
- [Painel de recursos](docs://ref-resourcepaneel): todos os campos e botões do painel de recursos.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): todos os cinco tipos de recurso, seis das oito curvas e uma grua de torre com um degrau de capacidade a partir de 30 de agosto de 2027.
