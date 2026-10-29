# Gerir recursos

Objetivo: criar, editar e eliminar recursos (pessoas, máquinas e material) no seu projeto, para os poder atribuir a tarefas.

## Quando precisa disto

Antes de colocar um pedreiro ou uma grua numa tarefa, essa pessoa ou máquina tem de existir como recurso. O recurso regista quanto existe dela e em que dias trabalha. Com isso, a aplicação calcula se lhe pede demasiado num dia. Edite um recurso quando a equipa mudar, por exemplo quando entra um segundo pedreiro.

São dois termos. **Unidades máx.** é a capacidade por dia útil: 1 é uma pessoa ou máquina, 2 são duas delas. Uma **atribuição** é um recurso numa tarefa (veja [Atribuir recursos com uma curva](docs://howto-resource-toewijzen)).

## Passos

### Criar um recurso

1. Escolha *Recursos › Gerir › Novo recurso*. O painel de recursos ocupa a área de trabalho e aparece uma linha vazia no fim da tabela. Também pode abrir o painel com *Recursos › Gerir › Recursos* e depois escolher *Novo recurso no projeto*.
2. Escreva o nome, por exemplo *Bricklayer*.
3. Escolha o *Tipo*: *Mão de obra* (o padrão), *Equipamento*, *Material*, *Subempreiteiro* ou *Equipa*.
4. Preencha os outros campos, se necessário. Tudo tem um valor padrão: *Unidades máx* é 1 e *Calendário* é *Calendário do projeto*. *Tarifa/hora* fica sem valor. Só pode preencher *Unidade* para o tipo *Material*, por exemplo m³.
5. Prima Enter ou clique fora da linha. O recurso fica na tabela. Com Enter, abre-se logo uma linha vazia por baixo para o seguinte. Prima Esc quando terminar.

A linha só se torna um recurso quando tem um nome. Com Esc, ou ao clicar fora sem nome, a aplicação não cria nada. A ordem do preenchimento não importa: pode escolher primeiro o tipo e depois escrever o nome.

### Editar um recurso

Edite os campos na linha. A aplicação guarda o nome, a tarifa e a unidade quando sai do campo, e os outros campos logo.

- *Unidades máx* só é aceite pela aplicação se o valor for superior a 0. Com 0 ou menos, o campo fica com uma moldura vermelha e volta ao valor anterior.
- *Calendário* decide em que dias o recurso trabalha. Escolha *Calendário do projeto* ou um calendário próprio. Com *+ Calendário de recurso* cria um novo; o lápis (*Editar…*) abre o calendário escolhido. Se uma tarefa trabalhar num dia em que o recurso não trabalha segundo o seu calendário, esse dia conta como sobrealocado. Como criar um calendário de recurso está descrito em [Configurar um calendário de recurso](docs://howto-resourcekalender-instellen).
- *Tarifa/hora* e *Total*: *Total* é o número de horas carregadas desse recurso vezes a tarifa. Um estucador com 32 horas de carga e uma tarifa de 50 por hora dá 1 600,00. Na parte inferior da tabela está a soma de todos os recursos.
- *Equipa* agrupa um recurso debaixo de um recurso do tipo *Equipa*. É só um agrupamento: a aplicação não soma a capacidade nem a carga dos membros à equipa.
- O quadrado colorido à esquerda é a cor do recurso. Serve só para visualizar e não tem efeito no planeamento.

### Capacidade que muda ao longo do tempo

O seu segundo pedreiro só chega a 19 de julho? Clique na seta ao lado de *Unidades máx*. Em *Capacidade faseada no tempo*, escolha *Adicionar etapa*. Cada etapa tem uma data (*A partir de*) e um número (*Unidades máx*). A partir dessa data aplica-se esse número. Sem etapas aplica-se sempre o valor fixo.

Uma nova etapa começa com a data de hoje e 1 unidade. Altere as duas coisas, porque senão uma capacidade de 1 aplica-se a partir de hoje.

### Eliminar um recurso

1. Clique no caixote do lixo da linha.
2. Se o recurso tiver atribuições, a aplicação pede confirmação, por exemplo *'Bricklayer' tem 4 atribuição(ões) — eliminar?* Clique no visto para eliminar ou na cruz para cancelar. Sem atribuições, o recurso desaparece logo.

As atribuições do recurso são eliminadas com ele. Se uma tarefa tiver um tipo de tarefa diferente de *Duração e unidades fixas*, a aplicação divide o trabalho do recurso removido pelos recursos que restam. Conforme o tipo de tarefa, isso altera as unidades deles ou a duração da tarefa. Se a duração mudar, o planeamento deixa de estar atualizado.

Pode anular a criação, a edição e a eliminação com *Desfazer* (Ctrl+Z).

### A vista resumida na coluna lateral

*Recursos › Gerir › Dock de recursos* mostra um resumo compacto na coluna da direita, ao lado de *Propriedades*. Aí vê o nome e a cor de cada recurso, e um sinal de aviso (*Sobrealocado*) junto a um recurso sobrealocado. Só pode alterar *Unidades máx* aí. Se selecionar uma ou mais tarefas, o resumo mostra só os recursos dessas tarefas.

## Armadilhas e o que a aplicação faz nesse caso

**Só o tipo *Material* faz diferença no cálculo.** Mão de obra, Equipamento, Subempreiteiro e Equipa são tratados da mesma forma. Material não conta para a duração de uma tarefa e não é nivelado. No histograma, a linha Todos os recursos também não conta o material.

**Sem nome, sem recurso.** Uma linha vazia desaparece sem deixar rasto.

**Uma nova etapa na capacidade.** Se não alterar a data e o número, a capacidade é 1 a partir de hoje.

**Remover um recurso que ainda precisa.** Se o remover por engano, prima Ctrl+Z logo a seguir. As atribuições também voltam.

## Ver também

- [Atribuir recursos com uma curva](docs://howto-resource-toewijzen): colocar um recurso numa tarefa.
- [Configurar um calendário de recurso](docs://howto-resourcekalender-instellen): corrigir os dias úteis de um recurso.
- [Resolver a sobrealocação](docs://howto-overbezetting-oplossen): o que fazer quando um recurso tem demasiado a fazer num dia.
- [Painel de recursos](docs://ref-resourcepaneel): todos os campos e botões do painel de recursos.
