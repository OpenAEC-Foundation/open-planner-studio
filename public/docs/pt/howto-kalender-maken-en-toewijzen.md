# Criar e atribuir um calendário

Objetivo: criar um calendário próprio, por exemplo uma semana de trabalho de seis dias, e atribuí-lo às tarefas que têm de ser calculadas nele.

## Quando precisa disto

Um subcontratado também trabalha aos sábados. Uma equipa trabalha só de segunda a quinta-feira. Uma tarefa cai num período em que só essa tarefa fica parada. O calendário do projeto fica então com os dias úteis errados. Com um calendário próprio, a aplicação calcula essas tarefas nos dias certos, e o resto mantém-se no calendário do projeto. O que a aplicação faz exatamente com um calendário, pode ler em [Calendários e dias úteis](docs://uitleg-kalenders).

## Passos

### Criar um calendário

1. Escolha *Planeamento › Calendário › Calendário*. O mesmo botão está em *Definições › Calendário › Calendário*. Abre-se a janela *Calendários*. À esquerda estão os calendários do projeto; o calendário do projeto tem uma estrela.
2. Por baixo da lista, clique no botão com o sinal de mais (*Novo calendário*). O novo calendário é uma cópia do calendário padrão: de segunda a sexta-feira, das 07:00 às 16:00, com uma hora de pausa e, se *Modo construção* estiver ativo, os feriados públicos neerlandeses. Se quiser usar um calendário existente como base, escolha-o na lista e clique no botão com as duas folhas, por baixo da lista (*Duplicar*).
3. Dê um nome ao calendário em *Nome*, que indique quem o usa, por exemplo *Six-day week*.
4. Em *Dias de trabalho*, clique nos dias da semana para os ligar ou desligar. *Seg–sex* repõe a semana padrão, das 07:00 às 16:00. Se o calendário tiver faixas de tempo de trabalho, *Seg–sex* liga apenas de segunda a sexta-feira, e cada dia mantém as suas faixas. *Contínuo (24/7)* liga os sete dias, das 00:00 às 24:00.
5. Ajuste, se necessário, os tempos de trabalho: *Início (hora)*, *Fim (hora)*, *Início da pausa* e *Duração da pausa (minutos)*. Introduza as horas no formato HH:MM. Com as setas, aumenta ou reduz os valores num quarto de hora. Se definir a duração da pausa como 0, o calendário funciona sem pausa. O *Dia útil padrão* é calculado pela própria aplicação. Se o calendário tiver faixas de tempo de trabalho por dia da semana (por exemplo do MS Project), não vê estes campos, mas o bloco *Horários de trabalho*, também com o planeamento por horas desativado; veja [Definir tempos de trabalho](docs://howto-werktijden-instellen).
6. Ajuste, se necessário, os feriados. Como funciona, está descrito em [Gerar feriados e férias da construção](docs://howto-feestdagen-genereren).
7. Clique em *Aplicar*. A aplicação recalcula logo o planeamento e fecha a janela. Com *Cancelar*, descarta as alterações. Se premir Enter num campo de introdução, a aplicação guarda entretanto e também recalcula, sem fechar a janela; *Cancelar* então só anula o que alterou depois disso.

### Atribuir um calendário a tarefas

Um calendário novo só tem efeito quando uma tarefa o usa. Há duas maneiras.

**Através do painel de propriedades**

1. Selecione a tarefa. Se não vir o painel *Propriedades*, ative-o com *Visualização › Painéis › Propriedades*.
2. Em *Tarefa*, escolha o calendário na lista *Calendário*. A primeira opção, *Calendário do projeto* com o nome a seguir, significa que a tarefa não tem calendário próprio.

**Através do menu do botão direito**

1. Clique com o botão direito na tarefa, na tabela de tarefas ou na barra no Gantt.
2. Escolha *Atribuir calendário* e depois o calendário, ou *Calendário do projeto* para remover de novo o calendário próprio. O calendário que está aplicado tem uma marca de verificação.
3. Se quiser dar um calendário a várias tarefas de uma vez, selecione-as primeiro com Ctrl (⌘ num Mac) e clique com o botão direito numa das tarefas selecionadas. A escolha aplica-se a todas as tarefas selecionadas. Se clicar com o botão direito numa tarefa que não está selecionada, a escolha aplica-se só a essa tarefa.

Uma nova escolha de calendário não torna o planeamento atual: a barra de estado indica *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo através de *Início › Agendamento › Calcular*. Se *Calcular automaticamente* estiver ativo (*Definições › Projeto › Definições da aplicação*, separador *Planeamento*, secção *Cálculo*), a aplicação faz isto por si.

### Mudar o calendário do projeto

1. Abra *Planeamento › Calendário › Calendário* e escolha o calendário na lista.
2. Acima do formulário, clique em *Definir como padrão do projeto*. A estrela passa para esse calendário.
3. Clique em *Aplicar*.

Só as tarefas sem calendário próprio acompanham a mudança.

### Eliminar um calendário

1. Abra a janela *Calendários* e escolha o calendário na lista.
2. Por baixo da lista, clique no botão com o caixote do lixo (*Eliminar*). Esse botão fica desativado enquanto só existir um calendário.
3. Clique em *Aplicar*. As tarefas e os recursos que usavam o calendário passam a usar o calendário do projeto. Se eliminar o próprio calendário do projeto, o primeiro calendário da lista passa a ser o calendário do projeto.

## Problemas frequentes e o que a aplicação faz nesse caso

**Sem dias úteis.** Se desligar todos os dias da semana, a aplicação não consegue calcular. Ao calcular, indica *O calendário não tem dias úteis definidos*.

**Dados inválidos.** Uma pausa fora do dia útil, uma hora de início posterior à hora de fim ou um feriado com data incorreta faz aparecer uma mensagem a vermelho no campo, e *Aplicar* fica desativado até corrigir. Para uma pausa ou um feriado inválido, há também um sinal de aviso ao lado do calendário na lista (*Este calendário contém dados inválidos*).

**Um calendário numa fase.** Uma fase calcula sempre no calendário do projeto, porque a sua duração resulta das suas tarefas. Atribua o calendário às próprias tarefas.

**O mesmo calendário, duas escolhas.** Na lista, o calendário do projeto aparece duas vezes: como *Calendário do projeto: nome* e como um calendário normal com esse nome. Se escolher o segundo, é uma escolha própria para essa tarefa. A tarefa então não acompanha a mudança quando, mais tarde, escolher outro calendário do projeto.

**Horas diferentes por dia.** Se alterar os tempos de trabalho ou a pausa, de modo que o *Dia útil padrão* de um calendário mude, uma tarefa em dias continua a contar o mesmo número de dias. Para uma tarefa com recursos e o tipo de tarefa *Trabalho fixo* ou *Unidades fixas*, a duração muda com isso, porque o trabalho se mantém. Quarenta horas de trabalho são 5 dias a 8 horas por dia e 7 dias a 6 horas por dia. A aplicação indica quantas tarefas ficaram com uma duração diferente.

## Ver também

- [Calendários e dias úteis](docs://uitleg-kalenders): como a aplicação conta os dias úteis e qual calendário prevalece.
- [Dias e horas](docs://uitleg-dagen-en-uren): o que faz o dia útil padrão.
- [Configurar um calendário de recurso](docs://howto-resourcekalender-instellen): um calendário para um recurso em vez de uma tarefa.
- [Janelas de calendário](docs://ref-kalenders): todos os campos das janelas de calendário.
