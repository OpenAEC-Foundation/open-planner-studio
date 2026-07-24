# Relações & restrições

Tarefas que existem isoladamente não se deslocam quando o cronograma muda. As relações registam essa dependência; as restrições registam um requisito rígido ou flexível sobre uma data. Este guia aprofunda ambos os temas mais do que o [Início rápido](docs://quick-start): quando escolher qual tipo de relação, o que faz exatamente um atraso/avanço, o que significa uma fixação rígida e quando especificamente *não* a deve usar, e como se relaciona um prazo com uma restrição?

## O que vai aprender aqui

- Os quatro tipos de relação (FS/SS/FF/SF) e quando usar cada um.
- Atraso e avanço, incluindo o atraso percentual e o atraso em tempo decorrido (por exemplo para a cura do betão).
- Adicionar relações de três formas: arrastando, por seleção, e na tabela de relações.
- Os oito tipos de restrição, mais a fixação rígida (P6 Mandatory) e a restrição secundária.
- A diferença entre um prazo e uma restrição.

Siga com o exemplo de nível introdutório [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (licença SNET, sobreposição SS, ligação FF) e, para o conflito de prazo, com [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Os quatro tipos de relação

Toda a relação tem uma **Predecessora** e uma **Sucessora**, e um de quatro tipos:

- **FS — Finish-Start**: a sucessora só começa quando a predecessora terminar. De longe a relação mais comum na construção: primeiro a fundação, depois a obra em bruto. Use FS quando uma tarefa fisicamente não pode começar até a outra estar concluída.
- **SS — Start-Start**: ambas as tarefas começam (aproximadamente) ao mesmo tempo. Use isto quando duas tarefas podem decorrer em conjunto assim que a primeira arranca — por exemplo o trabalho de paredes e a estrutura de cobertura a começar sobrepostos assim que a obra em bruto está em curso, sem que uma espere que a outra termine.
- **FF — Finish-Finish**: ambas as tarefas terminam (aproximadamente) ao mesmo tempo. Útil quando duas tarefas podem decorrer de forma independente mas têm de ser concluídas em conjunto — por exemplo a pintura que tem de terminar pouco depois da ladrilhagem, para que uma divisão possa ser entregue de uma só vez.
- **SF — Start-Finish**: a predecessora tem de começar antes de a sucessora poder terminar. De longe o tipo menos comum na prática da construção — reserve-o para casos extremos em que uma tarefa de acabamento só pode parar assim que outra tarefa tiver começado (por exemplo uma passagem de turno).

Quer reconhecer estes três primeiros tipos num exemplo real? O exemplo "Verbouwing & Aanbouw Eengezinswoning" contém uma cadeia FS entre as fases principais, uma sobreposição SS entre o trabalho de paredes e cobertura, e uma ligação FF entre o trabalho de ladrilhagem e pintura.

## Atraso e avanço

Uma relação não tem de ser zero: um **atraso** (positivo) adiciona tempo de espera entre a predecessora e a sucessora, um **avanço** (negativo, introduzido como um número negativo) permite que a sucessora comece mais cedo — uma sobreposição deliberada. O campo de atraso (**Atraso**, no painel de propriedades e na tabela de relações) aceita uma notação curta:

- `2d` — 2 dias úteis de atraso (a unidade predefinida: dias no calendário do projeto).
- `3ed` — 3 dias **decorridos**: dias de calendário que também passam por fins de semana ou feriados. Esta é a unidade que quer usar, por exemplo, para a **cura do betão**: o betão continua a curar também ao sábado e domingo, pelo que um atraso de "3 dias úteis" subestimaria o tempo de cura se um fim de semana ocorrer pelo meio. Nesse caso, defina o atraso para a unidade decorrida.
- `50%` — um atraso percentual: 50% da duração da predecessora, recalculado em cada execução CPM à medida que a duração da predecessora muda (a mesma lógica do MS Project). Útil quando o tempo de espera escala naturalmente com o tamanho da tarefa anterior.
- `-25e%` — um atraso percentual de tempo decorrido negativo: um avanço de 25% da duração da predecessora, em dias decorridos.

Um número negativo (avanço) significa que a sucessora começa enquanto a predecessora ainda está em curso — por exemplo a ladrilhagem que já começa durante os últimos dias do reboco na mesma divisão.

## Adicionar relações

Há três formas de criar uma relação, dependendo de onde já está a trabalhar:

1. **Arrastar no diagrama de Gantt**: mantenha premida a tecla **Shift** e arraste a partir da barra da predecessora para a barra da sucessora. Assim que soltar, uma relação FS com atraso 0 é criada imediatamente, e a janela **Tipo de relação** aparece de imediato — aí pode ajustar o tipo (FS/SS/FF/SF) e o atraso sem ter de abrir o painel de propriedades.
2. **Seleção + botão**: selecione primeiro a predecessora, mantenha premido Ctrl/Cmd e selecione a seguir a sucessora (por essa ordem), e clique em **Nova relação a partir da seleção** (o grupo do friso **Relações** no separador **Planeamento**, ou o próprio separador **Relações**). Este botão só funciona quando estão selecionadas exatamente duas tarefas.
3. **Diretamente na tabela de relações**: abra o separador **Relações** (através de **Gerir** no grupo do friso Relações). A tabela mostra, por relação, as colunas **Predecessora**, **Tipo**, **Atraso**, **Sucessora**, **Determinante** e **Folga livre** — o tipo e o atraso podem ser editados diretamente aqui, incluindo para relações que criou anteriormente arrastando ou por seleção.

A coluna **Determinante** mostra, após um cálculo, qual relação determina efetivamente a data de início ou fim da sucessora — para uma tarefa com múltiplas predecessoras, essa não é necessariamente a relação que criou mais recentemente, mas sim a que tem a data mais tardia (determinante).

## Tipos de restrição

Uma restrição impõe um limite de data a uma tarefa, independentemente das suas relações. O Open Planner Studio tem oito tipos, definidos através do campo **Restrição** no painel de propriedades:

- **O mais cedo possível (ASAP)** — sem limite de data, a predefinição.
- **O mais tarde possível (ALAP)** — a tarefa desloca-se o máximo possível dentro da sua folga.
- **Não começar antes de (SNET)** — um limite inferior na data de início (por exemplo: não começar antes de a licença ser concedida).
- **Não começar depois de (SNLT)** — um limite superior na data de início.
- **Não terminar antes de (FNET)** — um limite inferior na data de fim.
- **Não terminar depois de (FNLT)** — um limite superior na data de fim.
- **Deve começar em (MSO)** — uma data de início fixa.
- **Deve terminar em (MFO)** — uma data de fim fixa.

SNET/SNLT/FNET/FNLT são todos **limites flexíveis**: o cálculo CPM tem-nos em conta, mas uma violação "apenas" leva a folga negativa, não a uma falha ou bloqueio. O exemplo "Verbouwing & Aanbouw Eengezinswoning" usa uma restrição SNET, por exemplo, para impedir que uma tarefa comece antes de a licença ser concedida.

### A fixação rígida (P6 Mandatory)

MSO e MFO podem adicionalmente ser tornados **rígidos** através da caixa de verificação **Obrigatório (fixação de data)**, que só aparece para estes dois tipos. Esta é a restrição "P6 Mandatory" do Primavera P6: a barra é fixada na data, mesmo que as suas predecessoras contradigam isso logicamente. Quando ativa uma fixação rígida, o Open Planner Studio mostra um aviso único: **uma fixação rígida substitui as relações — a barra é fixada na data, mesmo antes das suas predecessoras. Uma violação torna-se folga negativa a montante.**

Por isso, só use uma fixação rígida quando uma data genuinamente não é negociável e está à parte da lógica do cronograma — por exemplo uma data de entrega legalmente fixa que se mantém independentemente do progresso. **Não** a use como regra geral para "quero que esta tarefa fique nessa data": nesse caso, uma restrição flexível (SNET/FNLT/etc.) ou simplesmente uma cadeia de relações bem planeada é quase sempre a melhor escolha. Uma fixação rígida pode comprimir toda a rede a montante: se as tarefas anteriores quiserem decorrer através da fixação, surge folga negativa e propaga-se por toda a cadeia antes da tarefa fixada — um sinal de que o cronograma está em conflito, não de que a fixação resolveu o problema.

### Restrição secundária

Para uma restrição não rígida (portanto, não ASAP/ALAP e não um MSO/MFO rígido), pode adicionar uma **restrição secundária**: um segundo limite dos mesmos quatro tipos flexíveis (SNET/FNET/SNLT/FNLT), que não pode limitar o mesmo lado que a primária. Isso permite-lhe definir, por exemplo, tanto um limite inferior como um superior na data de início ao mesmo tempo. O Open Planner Studio valida a combinação em tempo real e mostra um erro assim que a combinação é inválida — por exemplo uma restrição secundária ao lado de uma fixação rígida, o que não é permitido.

## Prazos versus restrições

Um **prazo** (um campo separado, painel de propriedades) parece uma restrição mas é deliberadamente diferente: é um limite superior flexível e informativo na data de fim, mostrado no diagrama de Gantt como um marcador de seta para baixo — verde enquanto a tarefa ainda está a tempo, vermelho assim que o seu fim mais cedo o ultrapassa. Um prazo não força o cronograma (ao contrário de uma restrição MFO/FNLT, que participa ativamente no cálculo), mas conta como um limite superior ao calcular a folga: se o cronograma naturalmente não cumprir o prazo, isso produz **folga negativa** sem que qualquer restrição esteja envolvida.

É exatamente isso que acontece no exemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): contém um prazo contratual deliberadamente apertado que a duração natural do cronograma não cumpre, resultando em folga negativa visível — um bom exemplo a analisar se quiser ver como é, na prática, um conflito de prazo, sem que nada esteja "avariado": o cronograma simplesmente calcula até ao fim e mostra onde está sob pressão.

Regra geral: use um **prazo** para uma data-alvo que quer monitorizar sem forçar a lógica do cronograma, e use uma **restrição** (flexível ou, excecionalmente, rígida) quando uma data genuinamente é um limite que o cálculo precisa de respeitar.

## Continue a ler

- Veja SNET, a sobreposição SS e a ligação FF na prática: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Veja o conflito de prazo na prática: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- A estrutura ainda não está pronta? Leia primeiro [Plannen & WBS](docs://gids-plannen-wbs).
- Para calendários e horários de trabalho que afetam a duração das tarefas: o guia [Calendários & planeamento por horas](docs://gids-kalenders-uren).
