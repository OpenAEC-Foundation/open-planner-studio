# Atualizar o progresso

Objetivo: introduzir o estado real do trabalho no planeamento e recalcular o planeamento: quais as tarefas concluídas, quais as que estão em curso e quanto trabalho ainda falta.

## Quando precisa disto

Atualiza-se o progresso em momentos fixos, por exemplo todas as sextas-feiras, quando o responsável da obra comunica o estado. Assim, o planeamento vê o que realmente aconteceu e calcula o trabalho restante a partir da data de estado. A razão por que a aplicação funciona assim está explicada em [Progresso, data de estado e linha de base](docs://uitleg-voortgang).

## Passos

### 1. Defina a data de estado

A data de estado é o dia em que faz o balanço. Defina-a antes de introduzir o progresso.

1. Vá a *Planeamento › Linhas de base e progresso › Data de estado*.
2. Escreva a data nas três caixas de dia, mês e ano (na ordem da sua notação de datas), por exemplo 28, 06 e 2027, e prima Enter. A aplicação passa sozinha para a caixa seguinte.
3. O calendário do projeto tem faixas de tempo de trabalho (a faixa *Horários de trabalho* na janela *Calendários*)? Então a aplicação calcula em horas e aparece um campo de hora à direita, por exemplo 17:00. Escreva outra hora, por exemplo 12:00, e prima Enter. Se esvaziar o campo de hora, fica só a data. Se alterar só a data, a hora mantém-se. A hora segue a sua notação de horas (24 ou 12 horas). Sem faixas de tempo de trabalho, a aplicação calcula em dias inteiros: então não há campo de hora e a linha da data de estado fica no início do dia.
4. Com a pequena cruz ao lado do campo, apague de novo a data de estado.

Se fizer o balanço à sexta-feira depois do horário de trabalho, defina a data de estado para o dia útil seguinte, segunda-feira. A aplicação planeia o trabalho restante a partir do início da data de estado.

Se introduzir progresso enquanto ainda não houver data de estado, a aplicação define-a para hoje e indica: *Data de estado definida para hoje (…).* Por isso, é melhor fazer este passo primeiro, manualmente.

### 2. Introduza o progresso

Escolha a forma que se adapta à sua situação. Todas dão o mesmo resultado.

**Uma tarefa no painel de propriedades.** Útil quando atualiza uma só tarefa.

1. Clique na tarefa. Se não vir o painel de *Propriedades*, ative-o em *Visualização › Painéis › Propriedades*.
2. Arraste o controlo deslizante *Progresso (%)* para a percentagem que está feita.
3. Se necessário, preencha *Início real* e *Fim real*, da mesma forma que a data de estado. A aplicação calcula o campo *Restante* sozinha; aqui não o pode alterar.

Um marco tem um só campo, *Data real*.

**Escolher uma percentagem no menu.** Útil para um estado rápido.

1. Clique com o botão direito na barra da tarefa no Gantt.
2. Escolha *Progresso* e depois 0%, 25%, 50%, 75% ou 100%.

**Várias tarefas na tabela.** Útil quando atualiza uma lista inteira.

1. Clique no **+** à direita do cabeçalho da tabela de tarefas (*Adicionar coluna*) e abra a categoria *Progresso*. Adicione as colunas *Início real*, *Fim real*, *Restante* e *Estado*. A coluna *Progresso* já está no separador *Tabela*.
2. Faça duplo clique numa célula, escreva o valor e prima Enter. Escreva a percentagem como `50` ou `50%`, a data como `25-06-2027` e a duração restante como `1`.
3. Em *Estado*, depois de um duplo clique, prima Enter e escolha *Não iniciada*, *Em andamento* ou *Concluída*.

Se introduzir uma duração restante, a aplicação calcula de volta a percentagem: numa tarefa de 2 dias úteis, um restante de 1 dá uma percentagem de 50. Um restante de 0 conclui a tarefa. A coluna *Duração real* (também na categoria *Progresso*) funciona ao contrário: escreva quanto trabalho já está feito e a aplicação calcula a percentagem. Numa tarefa de 4 dias úteis, uma duração real de 1 dá 25%. Se escolher *Não iniciada* em *Estado*, a percentagem passa para 0 e as datas reais desaparecem.

**Tudo de uma tarefa na janela Editar tarefa.** Clique com o botão direito na tarefa e escolha *Editar...*. Os campos de progresso também lá estão. Só se aplicam depois de clicar em *Guardar*.

**Muitas tarefas de uma vez a partir de uma folha de cálculo.** Veja [Importar o progresso a partir de uma folha de cálculo](docs://howto-voortgang-importeren).

### 3. Recalcule o planeamento

Cada alteração ao progresso ou à data de estado deixa o planeamento desatualizado: a barra de estado indica *Desatualizado — recalcule (F5)*. Prima **Calcular** (F5), por exemplo em *Planeamento › Agendamento › Calcular*. Se *Calcular automaticamente* estiver ativo (em *Definições › Projeto › Definições da app*, separador *Planeamento*), a aplicação faz isto sozinha.

## Verificar o resultado

- Na data de estado, o Gantt mostra uma linha a tracejado com a data no cabeçalho. Nas tarefas em andamento, a linha faz uma saliência até à percentagem na barra. Pode ativar ou desativar estas linhas em *Visualização › Linhas de base e progresso › Linha de progresso* e *Linha de data de estado*.
- A parte concluída de uma barra fica cinzenta; o resto mantém a cor. Uma tarefa totalmente concluída fica totalmente cinzenta, com um visto antes do nome e sem zona de folga. A barra de uma fase também fica cinzenta até à sua percentagem derivada, por isso vê, por fase, o avanço do trabalho. Se mostrar as predecessoras ou as sucessoras de uma tarefa, essas barras mantêm a cor de destaque, também quando estão concluídas.
- Tarefas concluídas nunca aparecem a vermelho: com uma data de estado, uma tarefa concluída não é crítica.
- As fases mostram uma percentagem derivada, e o fim do planeamento pode ter mudado.
- Se guardou uma linha de base, o planeamento original fica por baixo de cada barra, e o tipo de relatório *Variance* mostra o desvio.

## Problemas frequentes e o que a aplicação faz

**Uma data posterior à data de estado.** A aplicação recusa um início real ou um fim real posterior à data de estado. No painel, diz por baixo dos campos *As datas reais não podem ser posteriores à data de estado*; na tabela, a célula indica *A data real é posterior à data de estado.* Primeiro defina a data de estado mais tarde, ou corrija a data.

**Uma tarefa que só começaria depois da data de estado.** Se introduzir progresso numa tarefa que, segundo o planeamento, ainda não teria começado, abre-se a janela *Indicar o início real*. Pergunta quando a tarefa realmente começou; a sugestão é a data de estado. Com *Aplicar progresso* regista-a; com *Cancelar* não muda nada.

**100% sem datas.** Se definir uma tarefa a 100% sem fim real, o fim real passa a ser a data de estado, mesmo que a tarefa tivesse terminado antes. Então, indique manualmente o fim real.

**Uma percentagem abaixo de 100%.** Se voltar a definir uma tarefa concluída para abaixo de 100%, o fim real é retirado. Se apagar só o fim real, a percentagem passa para 0 e a tarefa fica *Em andamento*. Se quiser que a tarefa volte a contar como não iniciada, apague também o início real, ou escolha *Não iniciada* em *Estado* na tabela.

**Alterar a duração de uma tarefa em curso.** O trabalho já feito mantém-se e a percentagem ajusta-se. Uma tarefa de 5 dias úteis a 60% que definir para 10 dias úteis fica a 30%. A aplicação recusa uma duração inferior ao trabalho já realizado: *«Build inner cavity leaf» já está 60% feita: uma duração inferior ao trabalho já realizado não é possível. A duração não foi alterada.* Na tabela, a célula indica *Esta duração é inferior ao trabalho já realizado.*

**A duração restante é arredondada.** A aplicação arredonda a duração restante a dias úteis inteiros. Numa tarefa de 2 dias úteis, 50% e 75% dão ambos um restante de 1 dia útil.

**Uma fase.** Uma fase não tem progresso próprio. No painel diz *Derivado das subtarefas: altere o progresso nelas. A tarefa de resumo acompanha após calcular (F5).* Na tabela, a célula indica *O progresso de uma tarefa de resumo é derivado das suas subtarefas e não pode ser alterado aqui.*

**Mudar a data de estado para mais tarde.** O trabalho restante das tarefas em curso começa na nova data de estado, e o trabalho que ainda não começou não pode ficar antes dessa data. Por isso, mude-a só em conjunto com uma atualização do progresso. Se definir uma data de estado sem introduzir progresso, todo o trabalho que ainda não começou passa para essa data (exceto no perfil do Microsoft Project).

**Um erro.** Cada alteração ao progresso pode ser anulada com Ctrl+Z.

## Ver também

- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): como a aplicação calcula o trabalho restante e a data de estado, com um exemplo trabalhado.
- [Importar o progresso a partir de uma folha de cálculo](docs://howto-voortgang-importeren): ler o progresso de muitas tarefas de uma vez.
- [Escolher o modo de progresso](docs://howto-voortgangsmodus-kiezen): o que a aplicação faz com uma tarefa que começou enquanto a sua predecessora ainda está a decorrer.
- [Guardar e gerir uma linha de base](docs://howto-baseline-opslaan-en-beheren): registar o planeamento original para comparar o progresso com ele.
