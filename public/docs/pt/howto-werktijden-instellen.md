# Definir horários de trabalho

Objetivo: registar, por dia da semana, em que horas do relógio um calendário trabalha, para que as tarefas em horas decorram nas horas certas.

## Quando precisa disto

A tarde de sexta-feira não se trabalha. A equipa trabalha das 06:00 às 22:00 em dois turnos. Há uma equipa noturna. A pausa é mais curta do que uma hora. Enquanto planear só por dias, *Início (hora)*, *Fim (hora)* e a pausa são suficientes ([Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen)). Se planear tarefas em horas, a aplicação conta os minutos de trabalho dentro das **faixas** do calendário. Na aplicação, estes blocos chamam-se *faixa*: uma faixa é um período contínuo de tempo de trabalho num dia da semana, e um intervalo entre duas faixas é uma pausa. O que isto significa para o seu planeamento é explicado em [Dias e horas](docs://uitleg-dagen-en-uren).

Para dar a um calendário normal faixas de tempo de trabalho, precisa de *Ativar planeamento por horas* ([Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten)). Se o calendário já tiver faixas, por exemplo de um ficheiro do MS Project, o painel *Horários de trabalho* está sempre presente, e pode alterar as faixas também com o planeamento por horas desligado.

## Passos

### Escolher uma predefinição de turno

1. Escolha *Planeamento › Calendário › Calendário* e selecione o calendário à esquerda.
2. No painel *Horários de trabalho*, clique numa predefinição. Ela substitui os dias úteis e os horários de trabalho do calendário.
3. Clique em *Aplicar*.

Cada predefinição faz o seguinte:

- *Turno diurno*: de segunda a sexta-feira das 08:00 às 16:00, sem pausa. Assim o calendário volta a ser um calendário normal, sem faixas.
- *2 turnos*: de segunda a sexta-feira das 06:00 às 14:00 e das 14:00 às 22:00, 16 horas no total.
- *3 turnos*: de segunda a sexta-feira três turnos, das 06:00 às 14:00, das 14:00 às 22:00 e das 22:00 às 06:00 do dia seguinte, 24 horas no total.
- *Turno noturno*: de segunda a sexta-feira das 22:00 às 06:00 do dia seguinte, 8 horas.
- *24/7*: todos os sete dias das 00:00 às 24:00.

### Definir horários de trabalho por dia da semana

1. No painel *Horários de trabalho*, clique em *Definir por dia da semana…*. Por baixo dos botões aparece uma linha por dia da semana com o tempo de trabalho desse dia, e o calendário passa a ter faixas de tempo de trabalho por dia da semana. Se o calendário já as tiver, esta vista abre logo; o botão chama-se então *Ocultar horários de trabalho* e recolhe-a.
2. Ajuste a hora de início e de fim de cada faixa nos dois campos de hora. Escreva a hora e prima Enter, ou use as setas (15 minutos por passo). Os campos seguem o *Formato de hora* das definições; *13:00* e *1:00 PM* funcionam ambos.
3. Se quiser incluir uma pausa, clique em **+** (*Adicionar faixa*) nesse dia e ajuste as horas das faixas para que haja um intervalo entre elas. Uma nova faixa começa às 08:00 e termina às 16:00.
4. Numa faixa que passa da meia-noite, marque *dia seguinte*. A faixa conta para o dia em que começa.
5. Clique no ícone do caixote ao lado de uma faixa para a remover. Um dia sem faixas aparece como *Não útil*.
6. Num dia de segunda a sexta-feira, clique no símbolo de cópia (*Copiar para todos os dias úteis*) para pôr as faixas desse dia de segunda a sexta-feira.
7. Acima do painel *Horários de trabalho* está o *Dia útil padrão*: o tempo de trabalho por dia que a aplicação deriva das faixas e com que calcula. O número muda logo que altera as faixas. Se o calendário tiver horas por dia próprias (por exemplo, de um ficheiro do Primavera P6), esse valor próprio mantém-se e segue com a exportação, até uma predefinição o substituir. Se esse valor próprio for diferente do *Dia útil padrão*, aparece um aviso laranja logo abaixo do número, por exemplo: *O ficheiro tem um dia útil próprio de 8h. Esse valor mantém-se na exportação para MS Project e P6. Aí um dia conta 8h, aqui 10h.* O aviso desaparece logo que as faixas dão a mesma soma por dia, ou quando uma predefinição substitui o valor próprio. O aviso não altera o cálculo. Clique em *Aplicar*.

**Exemplo: uma tarde de sexta-feira livre.** Clique em *Definir por dia da semana…*. Remova a segunda faixa (13:00 às 16:00) de *Sex*. Sexta-feira passa a ter 5 horas, os outros dias 8. O *Dia útil padrão* mantém-se em 8 horas.

### Guardar uma predefinição própria

1. Clique em *Guardar como predefinição…* e escreva um nome no campo *Nome da predefinição*.
2. Clique em *Guardar*. A predefinição fica agora junto das outras, e pode usá-la em qualquer projeto. Com o símbolo × ao lado dela, remove-a de novo.

Uma predefinição própria fica guardada neste dispositivo, e não no ficheiro do projeto.

## Armadilhas e o que a aplicação faz nesse caso

**Uma predefinição substitui tudo.** Se escolher uma predefinição, os dias úteis e os horários de trabalho que definiu antes desaparecem. Os feriados mantêm-se.

**Os botões de dia mudam as faixas.** Se desligar um dia em *Dias de trabalho*, as faixas desse dia desaparecem. Se o ligar de novo, recebe as faixas que tinha quando abriu a janela (ou depois da última predefinição), ou então as do primeiro dia útil. *Seg–sex* faz isso de segunda a sexta-feira e remove as faixas de sábado e domingo. *Contínuo (24/7)* substitui todas as faixas: cada dia fica com 00:00 às 24:00.

**Ajustar horários de trabalho com o planeamento por horas desligado.** Um calendário com faixas de tempo de trabalho mantém o painel *Horários de trabalho*, também quando desliga o planeamento por horas. Aí basta alterar as faixas. Se escolher *Turno diurno*, volta a ser um calendário normal com os campos *Início (hora)*, *Fim (hora)* e a pausa; repor faixas só é possível com o planeamento por horas ligado.

**Sem horários de trabalho válidos.** Um calendário sem faixas ou sem dias úteis não consegue planear uma tarefa em horas. A aplicação então mostra *Este calendário não tem horários de trabalho válidos. Verifique os dias e horários de trabalho.*

## Ver também

- [Dias e horas](docs://uitleg-dagen-en-uren): como a aplicação conta os horários de trabalho e deriva o dia útil padrão.
- [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten): planear uma tarefa em horas.
- [Calendários e dias úteis](docs://uitleg-kalenders): que calendário se aplica a cada tarefa.
- [Janelas de calendário](docs://ref-kalenders): todos os campos das janelas de calendário.
