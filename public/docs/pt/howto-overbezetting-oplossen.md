# Resolver recursos sobrealocados

Objetivo: veja em que dia um recurso tem demasiado para fazer e resolva isso, normalmente com o nivelamento de tarefas.

## Quando precisa disto

No papel, o seu planeamento funciona, mas o pedreiro está em duas paredes que se executam nos mesmos dias. A aplicação chama a este estado **sobrealocado**. Um recurso fica sobrealocado num dia útil se o planeamento lhe pedir mais do que a sua capacidade nesse dia (*Unidades máx*), ou se o recurso não trabalhar nesse dia, segundo o seu calendário.

Procure primeiro os recursos sobrealocados. Depois, escolha uma solução. **Nivelamento** é a solução que a aplicação calcula por si: faz as tarefas começarem mais tarde até o recurso conseguir dar conta do trabalho. Como o nivelamento é calculado está explicado em [Nivelamento de recursos](docs://uitleg-nivelleren).

## Passos

### 1. Encontre a sobrealocação

1. Procure no friso em *Recursos › Superalocação*. Aparece *Nenhuma* ou, a vermelho, o número de recursos sobrealocados, por exemplo *1 recurso*. Depois de um cálculo, a barra de estado também mostra *⚠ 1 recurso(s) sobrealocado(s)*.
2. Clique nessa mensagem na barra de estado. Abre-se à direita o painel *Avisos*, com uma linha por recurso, por exemplo *Bricklayer* com *Sobrealocado durante 5 dia(s) (29-06-2027 – 05-07-2027)*.
3. Clique nessa linha. A aplicação liga o histograma, escolhe o recurso e seleciona todas as tarefas em que o recurso está atribuído.
4. Veja o histograma por baixo do Gantt. As barras vermelhas são dias sobrealocados. Se passar o rato sobre um dia, vê quais as tarefas que contribuem, por exemplo *2 tarefas contribuem em 2027-06-30*, com os nomes por baixo.

Também pode ligar o histograma com *Recursos › Histograma › Histograma*. Escolha um recurso na lista à esquerda, ou percorra os recursos com *Anterior* e *Seguinte*. Um ponto vermelho na lista indica que esse recurso está sobrealocado. A linha *Todos os recursos* soma os recursos, sem materiais.

Se uma tarefa estiver selecionada, o histograma mostra só a carga dessa tarefa e só os recursos que nela estão. Prima Esc para limpar a seleção e ver de novo o projeto inteiro.

### 2. Escolha uma solução

- **Mais capacidade.** Se realmente vier um segundo pedreiro, defina *Unidades máx* como 2 (veja [Gerir recursos](docs://howto-resources-beheren)). O recurso deixa então de estar sobrealocado.
- **Menos unidades por dia.** Reduza o valor de *Unidades* ou escolha outra curva para a atribuição (veja [Atribuir recursos com uma curva](docs://howto-resource-toewijzen)).
- **Ponha as tarefas uma a seguir à outra.** Adicione uma relação entre as duas tarefas, de modo que a segunda só comece quando a primeira estiver concluída (veja [Adicionar relações](docs://howto-relaties-leggen)).
- **Nivelamento.** A aplicação faz uma tarefa começar mais tarde.

### 3. Nivelamento

1. Certifique-se de que o planeamento foi calculado com **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*.
2. Escolha *Recursos › Nivelamento › Nivelar…*. Abre-se a janela *Nivelar recursos*.
3. Decida se a data de fim do projeto pode mudar. Se deixar a caixa *Nivelar apenas dentro da folga (suavização) — a data de fim do projeto mantém-se fixa* desmarcada, a data de fim pode mudar. Se a marcar, a aplicação só desloca tarefas dentro da respetiva folga.
4. Em *Recursos* estão os recursos que vão ser nivelados. Por padrão, estão todos marcados, exceto os materiais. Desmarque um recurso que queira deixar de fora.
5. Clique em *Calcular*. Enquanto calcula, aparece *A calcular…* e pode parar com *Parar*. O planeamento ainda não muda: isto é uma proposta.
6. Leia a proposta. No topo está a data de fim, por exemplo *Data de fim do projeto: inalterada (30-08-2027)* ou *Data de fim do projeto: 25-08-2027 → 30-08-2027*. Por baixo está uma tabela com, para cada tarefa, o *Início anterior*, o *Novo início* e os *Dias deslocados*, por exemplo *Build outer cavity leaf*, 29-06-2027, 06-07-2027 e *5 d*.
7. Escolha *Aplicar*. A aplicação grava os atrasos nas tarefas e recalcula o planeamento de imediato. Não é preciso premir F5. *Cancelar* fecha a janela sem alterar nada.
8. Verifique *Recursos › Superalocação*. Agora aparece *Nenhuma*.

Se mudar uma opção na janela depois de clicar em *Calcular*, a proposta desaparece. Clique então novamente em *Calcular*. Se o planeamento mudar enquanto a aplicação calcula, aparece *O planeamento mudou durante o cálculo. Clique novamente em Calcular*.

### Decidir qual tarefa fica no lugar

A aplicação coloca as tarefas uma a uma, e as tarefas que vêm primeiro ficam onde estão. As tarefas com a prioridade mais alta vêm primeiro. Com a mesma prioridade, vai primeiro a tarefa com menos folga.

Se quiser decidir qual tarefa fica no lugar, atribua-lhe uma prioridade mais alta. Clique com o botão direito na barra da tarefa no Gantt e escolha *Prioridade* e, depois, *Baixa* (100), *Normal* (500) ou *Alta* (900). *Normal* é o padrão. Também pode introduzir um número de 0 a 1000 na coluna *Prioridade de nivelamento*: clique no **+** à direita do cabeçalho da tabela de tarefas (*Adicionar coluna*) e escolha essa coluna no grupo *Planeamento*. Um número mais alto significa que a tarefa tem mais probabilidade de ficar no lugar. A aplicação não aceita um número acima de 1000. Uma tarefa com prioridade 1000 nunca se desloca por causa da capacidade.

### Desfazer e refazer

- *Desfazer* (Ctrl+Z) anula *Aplicar* num só passo.
- *Recursos › Nivelamento › Limpar nivelamento* remove todo o nivelamento das tarefas. O botão fica cinzento enquanto não houver nivelamento. O recurso volta a ficar sobrealocado, como antes.
- Se entretanto tiver alterado o planeamento, escolha de novo *Nivelar…*. A aplicação começa então do zero: os atrasos antigos não contam.

## Problemas e o que a aplicação faz nesse caso

**Ainda não calculado.** Se o planeamento não tiver sido calculado, a janela mostra *Calcule primeiro a planificação (F5) antes de nivelar* e *Calcular* não está disponível.

**Conflitos restantes.** Nem todos os recursos sobrealocados se podem resolver deslocando tarefas. As tarefas que restam aparecem em *Conflitos restantes*, com o número de dias e o motivo:

- *Não há capacidade livre suficiente dentro da folga para resolver este conflito*. Vê isto com a *suavização*: dentro da folga da tarefa não há nenhum momento livre. Desmarque a caixa e a data de fim pode mudar.
- *O recurso não trabalha em todos os dias que esta tarefa necessita — deslocar não resolve isto*. O recurso tem dias sem trabalho no seu próprio calendário a meio da tarefa. Altere o calendário ou a tarefa.
- *Bricklayer atinge um pico de 2 unidades/dia, a capacidade é 1 — não é possível resolver deslocando*. Através da sua curva, a tarefa, só por si, pede mais num dia do que o recurso consegue fornecer. Escolha outra curva ou reduza as unidades.

**Mostra** *Nenhuma tarefa precisa de ser deslocada — a planificação já está livre de conflitos*. Se esta linha aparecer junto com a lista *Conflitos restantes* na proposta, confie na lista. A linha só diz que não há nada a deslocar. Se a linha aparecer sem lista, enquanto *Recursos › Superalocação* ainda indicar um recurso sobrealocado, então todas as tarefas em conflito estão fixas com prioridade 1000 ou já começaram. Não se deslocam, e a janela não as indica como conflito. Por isso, depois de aplicar, veja sempre *Superalocação*.

**Tarefas que não se deslocam.** Uma tarefa que já começou ou que está concluída nunca se desloca. A sua carga conta, no entanto. Os marcos e as fases também não se deslocam.

**Os materiais não são nivelados.** Se um recurso do tipo material pedir mais do que as suas *Unidades máx* num dia, conta como sobrealocado em *Superalocação*, mas não está na janela de nivelamento.

**O nivelamento não se adapta.** Os atrasos mantêm-se como foram calculados. Se mudar mais tarde a duração de uma tarefa, a tarefa nivelada fica onde está, mesmo que esse lugar já não seja necessário. Nesse caso, nivele de novo.

**Sobrealocado por causa do calendário.** Se o recurso não trabalhar num dia segundo o seu calendário, o painel *Avisos* indica, por exemplo, *Sobrealocado durante 5 dia(s) (29-06-2027 – 05-07-2027), dos quais 1 dia(s) em que o recurso não trabalha segundo o seu calendário*. Se uma tarefa atravessar sempre um desses dias, que é a segunda razão acima, o nivelamento não resolve isso.

## Ver também

- [Nivelamento de recursos](docs://uitleg-nivelleren): o que o nivelamento desloca, dentro da folga e para além dela, e o que não faz.
- [Gerir recursos](docs://howto-resources-beheren): ajustar a capacidade e o calendário de um recurso.
- [Adicionar relações](docs://howto-relaties-leggen): pôr tarefas uma a seguir à outra.
- [Notificações e avisos](docs://ref-meldingen): o aviso de recurso sobrealocado no painel Avisos.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): os estucadores estão sobrealocados em 5 dias. Com a caixa *Nivelar apenas dentro da folga (suavização) — a data de fim do projeto mantém-se fixa* marcada, a data de fim mantém-se a 17 de agosto de 2027 e fica um conflito restante. Com a caixa desmarcada (o padrão), tudo fica resolvido e a data de fim passa para 24 de agosto de 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): a grua-torre está sobrealocada em 65 dias e os estucadores em 15 dias. Nivelar com a caixa *Nivelar apenas dentro da folga (suavização) — a data de fim do projeto mantém-se fixa* desmarcada desloca a data de fim de 9 de maio para 12 de outubro de 2028.
