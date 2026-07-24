# Recursos, histograma & nivelamento

Uma tarefa diz-lhe quando algo precisa de acontecer; um recurso diz-lhe quem ou o quê o vai fazer — e quanto disso está disponível num determinado dia. Assim que atribui recursos a tarefas, um dia pode exigir mais do que há capacidade disponível: uma sobrealocação. Este guia mostra como gerir e atribuir recursos, como ler a carga no histograma, e como (e quando *não*) o nivelamento resolve uma sobrealocação.

## O que vai aprender aqui

- Os cinco tipos de recurso e quando usar cada um.
- Atribuir recursos a tarefas — através do painel de propriedades, do diálogo de tarefa ou do friso.
- Unidades por dia e as seis curvas de distribuição: quando escolher qual.
- Mover uma atribuição para outra tarefa.
- Calendários de recursos e capacidade faseada no tempo (por exemplo uma segunda grua adicionada mais tarde).
- Ler o histograma: o seletor de recursos, aprofundar por recurso, detetar sobrealocação.
- O painel de recursos ancorado ao lado do Gantt.
- Nivelamento: as opções na janela **Nivelar recursos**, a diferença entre permanecer dentro da folga e deixar a data de fim deslocar-se, e prioridades (incluindo a prioridade 1000 = "não nivelar").
- A lição honesta: quando o nivelamento *não* resolve uma sobrealocação.

Siga com [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (dimensão média, uma sobrealocação deliberada e resolúvel por nivelamento nos estucadores) e com [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (grande, quase todos os recursos sobrecarregados porque três torres precisam das mesmas equipas e da grua-torre ao mesmo tempo — o exemplo onde o nivelamento atinge os seus limites).

## Os cinco tipos de recurso

Todo o recurso tem um **Tipo** (uma coluna no painel de recursos):

- **Mão de obra (LABOR)** — profissionais: pedreiros, estucadores, instaladores.
- **Equipamento (EQUIPMENT)** — máquinas e material: uma grua-torre, um monta-cargas de construção.
- **Material (MATERIAL)** — consumíveis com uma **Unidade** (por exemplo m³ de betão). O material nunca é nivelado nem contabilizado no histograma — é um stock, não uma capacidade diária que pode transbordar.
- **Subempreiteiro (SUBCONTRACTOR)** — uma empresa externa com o seu próprio teto de capacidade, por exemplo um empreiteiro de fachadas que só consegue disponibilizar duas equipas de uma vez.
- **Equipa (CREW)** — um grupo abrangente. Outros recursos podem juntar-se a uma equipa através da coluna **Equipa** no painel para agrupamento/visão geral; isto é puramente informativo — não há acumulação automática de capacidade para a equipa.

## Gerir recursos

Abra o painel de recursos através do grupo do friso **Gerir** no separador **Recursos**: o botão **Recursos** abre o painel completo (uma vista de painel completo separada, como Tabela ou Relações), **Novo recurso** adiciona uma linha diretamente. No painel edita, por recurso: **Nome**, **Tipo**, **Unidades máx.** (capacidade por dia útil — 1 = uma pessoa/item a tempo inteiro, 2 = duas unidades ao mesmo tempo), **Calendário**, **Tarifa/hora**, **Unidade** (apenas material) e **Equipa** (a que equipa este recurso pertence). No fundo, a coluna **Total** soma o custo de cada recurso (unidades carregadas × horas/dia × tarifa), recalculado a cada F5.

### Capacidade faseada no tempo

Junto a **Unidades máx.** há uma seta que expande uma sublinha de **Capacidade faseada no tempo**: aqui adiciona etapas (uma data **A partir de** + **Unidades máx.**) para capacidade que muda ao longo do projeto. O grande exemplo usa isto para a grua-torre: começa em **Unidades máx. 1**, com uma etapa que eleva a capacidade para **2** **a partir do dia 130** — o momento em que é adicionada uma segunda grua. Antes dessa data, as três torres têm de partilhar uma única grua; depois, duas torres podem içar ao mesmo tempo.

## Atribuir recursos

Há três locais onde gere uma atribuição — operam sobre os mesmos dados subjacentes, pelo que tudo o que faz num aparece imediatamente nos outros:

1. **Painel de propriedades** — a secção **Atribuições** sob uma tarefa selecionada: uma lista pendente para **Atribuir recurso** com os recursos ainda não atribuídos, e por atribuição existente as **Unid./dia**, a **Curva** e um botão para a remover.
2. **Diálogo de tarefa** — a mesma secção **Atribuições**, na janela **Editar tarefa**.
3. **Friso** — separador **Recursos**, grupo do friso **Atribuição**, o botão **Atribuir ▾**. Este botão só está ativo quando exatamente uma tarefa não-marco e não-resumo está selecionada; a lista pendente permite definir primeiro as **Unid./dia** e a **Curva** e depois lista abaixo os recursos ainda não atribuídos — clique num nome para concluir uma atribuição de uma só vez.

Os marcos e as tarefas de resumo não podem carregar recursos (não têm duração própria a carregar) — ambos os locais mostram uma explicação em vez do formulário de atribuição.

### Mover uma atribuição

Atribuiu um recurso à tarefa errada por engano, ou está a mover trabalho de uma tarefa para outra? Na secção **Atribuições** do painel de propriedades (ou do diálogo de tarefa), cada atribuição tem uma lista pendente **Mover para…** que lista as tarefas candidatas (tarefas folha sem este recurso, excluindo a tarefa atual). Escolher uma move a atribuição num só passo, incluindo as suas unidades e curva — sem necessidade de a remover e recriar.

## Unidades e curvas de distribuição

Toda a atribuição tem **unidades/dia** (1 = uma pessoa/item a tempo inteiro, 0,5 = meio dia) e uma **curva** que determina como essa carga se distribui ao longo da duração da tarefa:

- **Uniforme** — plana, a mesma quantidade todos os dias. A predefinição, e o ponto de partida certo para a maioria das tarefas.
- **Carregado no início (FRONT_LOADED)** — a maior parte do trabalho no início da tarefa, diminuindo em direção ao fim.
- **Carregado no fim (BACK_LOADED)** — a imagem espelhada: aumentando em direção ao fim, por exemplo uma tarefa que precisa de ganhar ritmo.
- **Em sino (BELL)** — baixo no início e no fim, com pico no meio — uma tarefa que aumenta, decorre a todo o vapor e depois desacelera.
- **Pico inicial (EARLY_PEAK)** — o pico situa-se cedo na tarefa, depois a carga diminui.
- **Pico tardio (LATE_PEAK)** — o pico situa-se tarde na tarefa.

A variação de curva é mais visível no histograma: a mesma tarefa com as mesmas unidades/dia produz uma forma de barra muito diferente com uma curva em sino do que com uniforme. O exemplo de dimensão média mistura deliberadamente uniforme/carregado no início/carregado no fim nas tarefas de acabamento por casa, para poder comparar a diferença.

## Calendários de recursos

Um recurso pode estar no **Calendário do projeto** (predefinição) ou no seu próprio calendário — por exemplo para um subempreiteiro que só está disponível quatro dias por semana. Defina isto através da coluna **Calendário** no painel de recursos, ou o campo **Calendário** no próprio recurso. Um calendário de recurso nunca toca nas datas CPM de uma tarefa (essas continuam a decorrer no calendário da tarefa/projeto) — apenas afeta a **carga** e o **nivelamento**: se um recurso não trabalhar um dia que a tarefa necessita, isso conta como um défice no histograma, e o nivelador avisa que deslocar não resolve essa incompatibilidade de calendário. Veja o guia [Calendários & planeamento por horas](docs://gids-kalenders-uren) para a explicação completa dos calendários.

## Ler o histograma

Ative o histograma através do grupo do friso **Histograma** no separador **Recursos** (o botão **Histograma**). Aparece uma faixa sob o Gantt no mesmo eixo temporal: barras por dia, com a parte acima da linha de capacidade mostrada a vermelho.

À esquerda das barras, acima da coluna da tabela de tarefas, situa-se o **seletor de recursos**: uma lista com "Todos os recursos" no topo e cada recurso abaixo, cada um com um ponto vermelho se esse recurso estiver sobrealocado nalgum lugar. Clique num nome para ampliar esse recurso — o histograma reajusta a escala apenas à sua carga e capacidade. Clique de volta em "Todos os recursos" para ver de novo a soma de todos os recursos. Além de clicar, também pode percorrer os recursos com os botões **Anterior**/**Seguinte** no grupo do friso **Histograma**, sem tocar no seletor propriamente dito.

Clique numa barra sobrecarregada e uma dica mostra quantas tarefas contribuem para a carga nesse dia, com os primeiros nomes de tarefas — útil para ver rapidamente qual combinação de tarefas causa a sobrealocação sem verificar cada atribuição à mão.

Se vir "Recalcular (F5) para mostrar a carga" em vez de barras, o cronograma não foi (re)calculado desde a última alteração — o histograma, tal como o caminho crítico, é uma fotografia que atualiza você mesmo.

## O painel de recursos ancorado

Além do painel de recursos completo (botão do friso **Recursos**), há uma variante compacta que pode ancorar à direita: o botão **Ancorar** no grupo do friso **Gerir**. Este painel ancorado mostra apenas o nome, as **Unidades máx.** (editáveis diretamente) e um ponto vermelho/verde para sobrealocação — uma visão rápida ao lado do seu Gantt sem abrir o painel completo. O painel de recursos ancorado e o painel de propriedades de uma tarefa são mutuamente exclusivos — só vê um dos dois de cada vez na coluna direita.

## Detetar sobrealocação

Um recurso está sobrecarregado num dia assim que as unidades somadas de todas as suas atribuições nesse dia excedem as suas **Unidades máx.**. Vê isto em três locais: a parte vermelha da barra no histograma, o ponto vermelho no seletor de recursos e no painel ancorado, e o contador **Superalocação** no grupo do friso no separador Recursos ("N recursos" com um ícone de aviso, ou "Nenhuma").

O exemplo de dimensão média torna isto visível de propósito: no início de junho, os **Stukadoors** (estucadores, unidades máx. 2) recebem uma atribuição de 2 unidades em três casas ao mesmo tempo (o estuque das casas 1, 2 e 3 sobrepõe-se aí durante alguns dias) — 6 unidades combinadas no pico, bem acima da capacidade de 2.

## Nivelamento

Abra a janela **Nivelar recursos** através do botão **Nivelar…** no grupo do friso **Nivelamento** no separador Recursos. A janela requer um cálculo válido e atualizado (recalcule primeiro com F5 se o cronograma estiver desatualizado) e funciona em dois passos: **Calcular** primeiro para uma proposta, depois **Aplicar** — nada muda no seu cronograma até ter visto a proposta.

Na janela escolhe:

- **Recursos** — quais os recursos que participam na execução de nivelamento (todos por predefinição; o material está sempre excluído — nunca é nivelado).
- **Nivelar apenas dentro da folga (suavização)** — uma caixa de verificação com um subtítulo claro: "a data de fim do projeto mantém-se fixa". Desligado (**nivelamento**), o nivelador pode deslocar tarefas o quanto for necessário, mesmo além da sua própria folga, o que pode adiar a data de fim do projeto. Ligado (**suavização**), a data de fim é sagrada — o nivelador só desloca dentro da folga existente de cada tarefa, e um conflito que não caiba nisso permanece assinalado como conflito remanescente.

Após **Calcular**, a janela mostra uma tabela com todas as tarefas cujo início muda (início anterior → novo início → dias deslocados), uma linha a reportar se a data de fim do projeto muda, e — se restarem conflitos — uma secção **Conflitos restantes** com, por tarefa, o motivo: uma incompatibilidade de calendário (o recurso não trabalha os dias que a tarefa necessita), capacidade livre insuficiente dentro da folga, ou um excesso intrínseco (uma única atribuição já exige mais no seu pico do que o recurso alguma vez poderia entregar — nenhum deslocamento resolve isso). Só depois de estar satisfeito com a proposta clica em **Aplicar**.

Experimente você mesmo a sobrealocação dos estucadores no exemplo de dimensão média: abra **Nieuwbouw 6 Rijwoningen De Akkers**, vá ao separador **Recursos** e abra **Nivelar recursos**. Deixe todos os recursos assinalados, deixe a suavização desligada e clique em **Calcular**: os conflitos desaparecem completamente (0 conflitos restantes), mas a data de fim do projeto avança cerca de uma semana. Depois assinale **Nivelar apenas dentro da folga** e calcule de novo: a data de fim agora mantém-se inalterada, mas uma tarefa (o estuque numa das casas) permanece assinalada como conflito — simplesmente não há folga suficiente para a encaixar totalmente dentro do cronograma existente. É exatamente essa a compensação que esta caixa de verificação torna visível: resolve o problema deixando a data de fim ir, ou mantém a data de fim fixa e aceita um conflito remanescente assinalado?

### Prioridades

Toda a tarefa tem uma **prioridade de nivelamento** de 0 a 1000 (predefinição 500). Clique com o botão direito numa tarefa e escolha **Prioridade** para três predefinições: **Baixa** (100), **Normal** (500) e **Alta** (900) — num conflito de capacidade entre duas tarefas, a que tem a prioridade mais alta obtém a primeira reivindicação sobre a capacidade escassa. O valor **1000** é um caso especial: "não nivelar" (o MS Project chama a isto "Do Not Level"). Essa tarefa ainda passa pelo ciclo de nivelamento e segue as suas próprias predecessoras, possivelmente deslocadas, mas ela própria nunca é deslocada para libertar capacidade. O grande exemplo usa isto em "Nutsaansluitingen aanleggen" (instalação de ligações de utilidades): uma data de ligação fixa definida pela empresa de utilidades que não pode mudar, seja o que for que a execução de nivelamento proponha de resto.

**Limpar nivelamento** (no grupo do friso **Nivelamento**) remove de uma só vez todos os deslocamentos previamente aplicados — útil para voltar ao cronograma original, não nivelado, sem repor cada tarefa à mão.

## A lição honesta: quando o nivelamento não ajuda

O nivelamento resolve uma sobrealocação reorganizando o trabalho no tempo — dentro da folga, ou, se necessário, com uma data de fim posterior. Isso funciona bem enquanto houver espaço suficiente (folga ou tempo) algures no cronograma para redistribuir o excesso de procura. Fundamentalmente, *não* funciona quando a procura é estruturalmente maior do que alguma vez estará disponível, seja como for que desloque as coisas.

O grande exemplo mostra isto em vários recursos ao mesmo tempo: porque as três torres decorrem largamente em paralelo e partilham as mesmas equipas (pedreiros, instaladores, estucadores, colocadores de ladrilhos, a grua-torre), quase todos os recursos de mão de obra estão sobrecarregados nalgum momento. Nivele com todos os recursos selecionados e a data de fim livre, e a maioria dos conflitos desaparece — mas a data de fim do projeto atrasa-se meses, e um punhado de tarefas de acabamento por torre (ladrilhagem, cozinhas, sanitários, pintura) permanece como um excesso intrínseco: a carga de pico de uma única atribuição já excede aí a capacidade, pelo que nenhum deslocamento ajuda. Ative a suavização para proteger a data de fim, e uma parte muito maior dos conflitos simplesmente permanece por resolver.

A lição não é que o nivelamento "não funciona" — o algoritmo faz exatamente o que lhe é pedido. A lição é que o nivelamento é uma ferramenta de **agendamento**, não uma ferramenta de **capacidade**: reorganiza trabalho existente dentro de tempo existente, mas não cria mais profissionais, equipamento ou dias de calendário. Uma escassez estrutural — poucos estucadores para três torres ao mesmo tempo, uma grua-torre a servir três estaleiros — pede uma solução diferente: contratar mais capacidade, ajustar o faseamento (torres uma após a outra em vez de em paralelo, o que a etapa da segunda grua a partir do dia 130 já parcialmente faz), ou dividir o trabalho de outra forma. O nivelamento é a ferramenta que mostra onde dói; não resolve por si a questão subjacente de capacidade.

## Continue a ler

- Repita o nivelamento da sobrealocação dos estucadores você mesmo em [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Veja os limites do nivelamento na prática — mais todos os cinco tipos de recurso, as seis curvas e a capacidade faseada no tempo da grua-torre — em [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Os recursos funcionam com calendários — leia o guia [Calendários & planeamento por horas](docs://gids-kalenders-uren) para calendários de recursos e planeamento por horas.
- Quer definir uma baseline antes de começar a nivelar, para poder ver a diferença? Leia o guia [Baselines & progresso](docs://gids-baselines-voortgang).
- O nivelamento pode alterar quais as tarefas críticas — leia o guia [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse) para saber como detetar isso.
