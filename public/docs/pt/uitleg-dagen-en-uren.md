# Dias e horas

Uma tarefa de 2 dias e uma tarefa de 16 horas parecem iguais, mas a aplicação calcula-as de forma diferente. Porque é que pode escolher entre dias e horas? E o que acontece quando uma tarefa horária está ligada a uma tarefa em dias? Neste artigo vê como a aplicação conta dias e horas e onde arredonda. O exemplo prático mostra os números.

## O conceito

Uma **tarefa em dias** tem uma duração em dias úteis completos, por exemplo `5d`. Ocupa dias úteis completos. No calendário padrão tem uma data de início e uma data de fim, sem hora.

Uma **tarefa horária** tem uma duração em horas de trabalho, por exemplo `12h` ou `1h 30m`. Tem um início e um fim com uma hora, por exemplo terça-feira, às 11:00.

A unidade pertence à tarefa, não ao projeto. Pode combinar tarefas em dias e tarefas horárias no mesmo planeamento. Isto chama-se **planeamento misto**.

Para trabalho que não cabe em dias completos, utiliza horas: uma grua que aluga durante doze horas, uma betonagem de seis horas, uma tarefa que só pode começar depois do almoço. Para tudo o resto, os dias chegam e são mais claros.

O **planeamento por horas** está desativado por padrão. Enquanto estiver desativado, a aplicação funciona em dias. Se um ficheiro tiver planeamento por horas, por exemplo tarefas horárias, a aplicação mostra *Este ficheiro contém planeamento por horas.* Essas tarefas continuam a ser calculadas, mas só pode editar a respetiva duração depois de ativar o planeamento por horas.

## Como a aplicação calcula

### Tempos de trabalho e dia útil padrão

Cada calendário tem **faixas** de tempo de trabalho para cada dia útil (na aplicação, *faixas*). O calendário padrão tem das 07:00 às 12:00 e das 13:00 às 16:00. O intervalo entre elas é a pausa. A aplicação deriva essas faixas do *Início (hora)* e do *Fim (hora)* do calendário, e da pausa; não tem de definir nada para isso. Se definir faixas próprias por dia da semana, essas têm prioridade.

O **dia útil padrão** é o dia útil que ocorre com mais frequência; a sua duração é a soma das respetivas faixas. Não é, portanto, uma média: se segunda-feira tiver 16 horas e de terça-feira a sexta-feira 10 horas, o dia útil padrão tem 10 horas. Se os dias úteis tiverem durações diferentes, aplica-se o total diário mais frequente; em caso de empate, o mais alto. Com quatro dias de 8 horas e uma sexta-feira de 5 horas, o dia útil padrão tem, portanto, 8 horas. Um calendário com horas por dia próprias (por exemplo, do Primavera P6) também calcula com este total diário, e a janela do calendário mostra-o. O valor próprio fica guardado para a exportação. Se for diferente, a janela do calendário mostra um bloco laranja abaixo de *Dia útil padrão*. Uma tarefa de 1870 horas, em faixas de 10 horas por dia, dura, portanto, 187 dias, mesmo que o valor próprio seja de 8 horas por dia.

### Tarefa horária

A aplicação conta minutos de trabalho a partir do início, através das faixas. Pausas, noites, fins de semana e feriados não contam. Uma tarefa de 12 horas, portanto, não cabe num dia útil de 8 horas: continua no dia seguinte.

### Tarefa em dias

A aplicação conta dias úteis completos. As horas por dia não desempenham qualquer papel. Uma tarefa de 5 dias termina no mesmo dia, quer o calendário tenha 6 ou 8 horas por dia.

### Converter dias e horas

Um dia é igual ao dia útil padrão do calendário da tarefa. A aplicação usa esse valor em três situações:

- Para a *Exibição da duração*. Em *Definições › Projeto › Definições da aplicação*, no separador *Aparência*, escolha *Automática (unidade própria por tarefa)*, *Sempre dias* ou *Sempre horas*. Uma tarefa de 18 horas aparece em *Sempre dias* como `2.25d(18h)`: a unidade própria fica entre parênteses.
- Para um desfasamento em horas depois de uma tarefa em dias (veja *Arredondamento*).
- Ao alterar a unidade de uma tarefa. A aplicação conta então os dias a partir do início da tarefa, cada dia com as suas próprias horas, e converte a duração de imediato se o resultado for exato. Dois dias passam a `16h`. Num calendário em que a sexta-feira tem 5 horas, 5 dias a partir de segunda-feira passam a `37h`. Doze horas não podem ser convertidas em dias completos num calendário com dias de 8 horas: a aplicação deixa então a unidade como está.

### Tarefas em dias e tarefas horárias juntas

As regras abaixo aplicam-se a uma relação fim-início num calendário sem faixas próprias, como o calendário padrão.

- **Tarefa horária → tarefa horária.** A sucessora começa no momento em que a predecessora termina, mesmo que isso seja a meio de um dia.
- **Tarefa horária → tarefa em dias.** Uma tarefa em dias nunca começa a meio de um dia. Começa no primeiro dia útil depois do dia em que a tarefa horária termina. O resto desse dia fica por usar e volta como folga da tarefa horária.
- **Tarefa em dias → tarefa horária.** Uma tarefa em dias ocupa todo o último dia. A tarefa horária começa no primeiro dia útil depois dela, no início da primeira faixa de tempo de trabalho.

### Arredondamento

A aplicação arredonda, ou recusa, em quatro situações:

- **Uma tarefa em dias depois de uma tarefa horária** começa no dia útil seguinte. A tarefa horária é, por assim dizer, arredondada para dias completos.
- **Um desfasamento em horas** conta no calendário do desfasamento, por padrão o da predecessora. Se a predecessora for uma tarefa em dias num calendário sem faixas próprias, como o calendário padrão, a aplicação converte o desfasamento em dias úteis completos: o desfasamento dividido pelas horas do dia útil padrão, arredondado a um número inteiro; meio dia arredonda para cima. Com 8 horas por dia, 1 hora conta como 0 dias, 4 horas como 1 dia e 12 horas como 2 dias. Isto também se aplica se a sucessora for uma tarefa horária. Se a predecessora for uma tarefa horária, ou se o respetivo calendário tiver faixas próprias, o desfasamento conta exatamente no horário de trabalho e a pausa não conta.
- **Uma duração em dias** é sempre um número inteiro. Se escrever `1.5d`, a aplicação mostra *Introduza um número inteiro de dias ou horas, por exemplo 2d ou 12h.* Uma duração em horas pode ser `1.5h` ou `1h 30m`.
- **Alterar a unidade** só acontece se o resultado for exato (veja acima).

## Exemplo prático: a grua

O calendário é de segunda-feira a sexta-feira, das 07:00 às 12:00 e das 13:00 às 16:00: um dia útil padrão de 8 horas. O projeto começa na segunda-feira, 7 de junho de 2027.

### Duas tarefas horárias e uma em dias

*Place crane* dura 12 horas. Segunda-feira tem um horário de trabalho de 8 horas (5 até às 12:00 e 3 depois da pausa) e terça-feira as últimas 4 horas. A tarefa decorre de segunda-feira, às 07:00, até **terça-feira, 8 de junho, às 11:00**.

*Adjust elements* dura 8 horas e segue com uma relação fim-início. Começa logo na terça-feira, às 11:00: isso é 1 hora até à pausa e 3 horas depois dela. As últimas 4 horas são na quarta-feira, das 07:00 às 11:00. O fim é **quarta-feira, 9 de junho, às 11:00**.

*Finishing* dura 2 dias e segue *Adjust elements*. Uma tarefa em dias não começa a meio de um dia, por isso começa na **quinta-feira, 10 de junho**, e termina na sexta-feira, 11 de junho.

### Arredondamento na transição

Se omitir *Adjust elements* e ligar *Finishing* diretamente a *Place crane*, *Finishing* começa na quarta-feira, 9 de junho, e termina na quinta-feira, 10 de junho. O resto do horário de trabalho de terça-feira (4 horas) não pode ser usado. Essas 4 horas voltam a aparecer como folga total de *Place crane*: meio dia útil.

Se inverter a ordem, é mais simples. *Pour foundation* dura 2 dias, de segunda-feira, 7, a terça-feira, 8 de junho. *Place crane* passa a durar 4 horas e segue. Começa na **quarta-feira, 9 de junho, às 07:00**, e termina às 11:00.

### Um desfasamento em horas

Entre *Place crane* (12 horas) e *Adjust elements* (8 horas) coloca um desfasamento de 2 horas. *Adjust elements* não começa então às 11:00, mas na terça-feira, às **14:00**: 1 hora até à pausa e 1 hora depois dela. O fim passa para **quarta-feira, 9 de junho, às 14:00**.

Depois de uma tarefa em dias, um desfasamento funciona de outra forma. *Pour foundation* termina na terça-feira, 8 de junho. Sem desfasamento, *Finishing* começa na quarta-feira, 9 de junho. Com um desfasamento de 4 horas, isso é meio dia, e a aplicação arredonda para cima: *Finishing* começa na **quinta-feira, 10 de junho**. Com um desfasamento de 1 hora, a aplicação arredonda para baixo, e *Finishing* começa simplesmente na quarta-feira.

### Uma sexta-feira com tarde livre

Agora a sexta-feira tem só uma faixa, das 07:00 às 12:00: 5 horas. Os outros dias mantêm-se nas 8 horas. O dia útil padrão mantém-se em 8 horas, porque é o total diário mais frequente. Uma semana tem agora um horário de trabalho de 37 horas.

Uma tarefa de 40 horas, a partir de segunda-feira, 7 de junho, às 07:00, usa de segunda-feira a quinta-feira (32 horas) e a sexta-feira (5 horas). As últimas 3 horas caem na segunda-feira seguinte, das 07:00 às 10:00. O fim é **segunda-feira, 14 de junho, às 10:00**. Uma tarefa de 5 dias ocuparia 37 horas a partir de segunda-feira. É isso que a aplicação propõe se alterar a unidade de 5 dias para horas.

No tutorial 4, sobre planeamento por horas, planeia pessoalmente uma obra com grua em horas.

## Consequências e mal-entendidos

**«8 horas são 1 dia.»** Só se o calendário tiver dias de 8 horas. No calendário com a tarde livre de sexta-feira, 5 dias são 37 horas, não 40.

**«Se eu definir mais horas por dia, a minha tarefa em dias termina mais cedo.»** Não. Uma tarefa em dias conta dias úteis completos. As horas por dia só mudam o valor de um dia em horas, por exemplo na exibição e para um desfasamento em horas. Só numa tarefa com recursos e com o tipo de tarefa *Trabalho fixo* ou *Unidades fixas* é que a duração muda com isso, porque o trabalho se mantém: 40 horas de trabalho são 5 dias com 8 horas por dia e 7 dias com 6 horas por dia.

**«Uma tarefa de 8 horas dura um dia.»** Só se começar no início do dia. Se começar mais tarde, como *Adjust elements* na terça-feira às 11:00, continua no dia seguinte.

**Um calendário com faixas próprias** comporta-se de forma diferente do calendário padrão. Obtém um calendário destes ao definir tempos de trabalho por dia da semana ou ao escolher uma predefinição de turnos (*2 turnos*, *3 turnos*, *Turno noturno* ou *24/7*). Num calendário destes, um desfasamento em horas conta exatamente no horário de trabalho, também depois de uma tarefa em dias.

**Desativar o planeamento por horas** não remove nada. As tarefas horárias mantêm-se e continuam a ser calculadas, mas não as pode editar até voltar a ativar o planeamento por horas.

## Ver também

- [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten): os passos para planear uma tarefa horária.
- [Definir horários de trabalho](docs://howto-werktijden-instellen): ajustar as faixas de um calendário.
- [Calendários e dias úteis](docs://uitleg-kalenders): como a aplicação conta os dias úteis e qual calendário prevalece.
- [Adicionar relações](docs://howto-relaties-leggen): os passos para adicionar uma relação ou um desfasamento.
