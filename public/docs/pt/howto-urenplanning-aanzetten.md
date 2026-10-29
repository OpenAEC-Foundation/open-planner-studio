# Ativar o planeamento por horas

Objetivo: planear tarefas no horário de trabalho, junto com tarefas em dias.

## Quando precisa disto

Aluga uma grua por hora, não por dia. Uma betonagem de seis horas não cabe num dia útil inteiro. Uma equipa da noite trabalha em horas diferentes da equipa de dia. Para este tipo de trabalho quer uma duração em horas, e um início e um fim com hora do dia. Também ativa isto se abrir um ficheiro e a aplicação mostrar *Este ficheiro contém planeamento por horas.* Porque é que a aplicação conta dias e horas de forma diferente, pode ler em [Dias e horas](docs://uitleg-dagen-en-uren).

## Passos

### Ativar planeamento por horas

1. Escolha *Definições › Projeto › Definições da aplicação* e abra o separador *Planeamento*.
2. Em *Planeamento por horas*, marque *Ativar planeamento por horas*. Funciona de imediato. Na mensagem *Este ficheiro contém planeamento por horas.* o botão *Ativar planeamento por horas* faz o mesmo.
3. Por baixo está *Permitir planeamento misto de dias/horas*, ativado por predefinição. Com esta definição, escolhe por tarefa se conta em dias ou em horas. Se desativar esta definição, a lista *Unidade de duração* desaparece. Pode, então, continuar a introduzir uma duração com unidade, por exemplo `12h`.

Isso altera mais do que a duração de uma tarefa: em *Visualização › Escala temporal* pode escolher a escala *Hora*, na janela *Calendários* um calendário normal pode receber faixas de tempo de trabalho (o bloco *Horários de trabalho*; um calendário que já tem faixas mostra sempre esse bloco), e a janela *Novo projeto* ganha as opções *Turno* e *Unidade predefinida para novas tarefas*.

### Planear uma tarefa em horas

1. Selecione a tarefa e veja no painel *Propriedades*, em *Tempo*, o campo *Duração*.
2. Introduza a duração com unidade e prima Enter: `12h` (`12u`, a abreviatura neerlandesa, também funciona) para doze horas, `1h 30m` para uma hora e meia. `1.5h` também é válido. Um número sem unidade conta na unidade que a tarefa já tem.
3. Se quiser converter uma tarefa existente, escolha a unidade *Horas* em *Unidade de duração*. A aplicação converte a duração de imediato, por exemplo de `2` dias para `16` horas. Para voltar atrás, use *Desfazer*.
4. Voltar a dias é possível com `2d` ou com a unidade *Dias*.
5. Prima **Calcular** (F5), por exemplo em *Início › Agendamento › Calcular*. A tarefa passa a ter um início e um fim com hora do dia.
6. Se quiser ver as horas no Gantt, escolha a escala *Hora* na lista em *Visualização › Escala temporal*.

### Novas tarefas em horas por padrão

1. Escolha *Definições › Projeto › Definições do projeto*.
2. Em *Unidade predefinida para novas tarefas*, escolha a unidade *Horas* e clique em *Aplicar*.

Uma nova tarefa passa então a começar com 5 horas em vez de 5 dias. As tarefas existentes não mudam. Com um novo projeto, a mesma escolha está na janela *Novo projeto*. Se escolher *Turno diurno* em *Turno* nessa janela, a opção *Horas* fica desativada. Escolha outro turno, ou defina a unidade predefinida depois de criar o projeto, em *Definições do projeto*.

## Armadilhas e o que a aplicação faz então

**Sem horários de trabalho válidos.** Se o calendário da tarefa não tiver horários de trabalho utilizáveis, a aplicação mostra *Este calendário não tem horários de trabalho válidos. Verifique os dias e horários de trabalho.* Ao calcular, pode aparecer a mensagem *A tarefa horária 'name' não tem horário de trabalho válido no seu calendário*.

**Sem decimais em dias.** Uma duração em dias é um número inteiro. `1.5d` mostra a mensagem *Introduza um número inteiro de dias ou horas, por exemplo 2d ou 12h.* Se quiser um dia e meio, calcule em horas.

**Uma conversão que não pode ser exata.** Doze horas não cabem em dias inteiros de 8 horas. Nas *Propriedades* e em *Editar tarefa*, a aplicação mostra então um aviso amarelo com *12h não corresponde a dias completos neste calendário. A unidade não foi alterada.* e mantém a unidade. A tabela de tarefas mostra uma mensagem mais curta: *Esta duração não pode ser convertida exatamente para a outra unidade.*

**O campo fica desativado.** Para uma fase, um hammock ou um marco com duração zero, a duração resulta de outra coisa, e não pode introduzi-la.

**Voltar a desativar o planeamento por horas.** As tarefas horárias permanecem e continuam a ser calculadas. A duração dessas tarefas não pode ser editada nessa altura; o campo mostra *Ative o planeamento por horas para editar esta tarefa horária.*, com um botão para o ativar de novo.

## Ver também

- [Dias e horas](docs://uitleg-dagen-en-uren): como a aplicação conta as horas, o que acontece quando dias e horas se cruzam e onde arredonda.
- [Definir o tempo de trabalho](docs://howto-werktijden-instellen): os horários de um calendário por dia da semana.
- [Adicionar relações](docs://howto-relaties-leggen): um desfasamento em horas entre duas tarefas.
- [Definições da aplicação](docs://ref-instellingen): a definição Ativar planeamento por horas e o que mais altera.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contém tarefas horárias (rebar fixing and pouring) com um calendário horário próprio, *Hourly calendar, rebar fixing & pouring*.
