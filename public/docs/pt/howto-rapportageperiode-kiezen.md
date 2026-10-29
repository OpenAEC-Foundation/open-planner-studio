# Escolher o período do relatório

Objetivo: decidir que intervalo de tempo um relatório abrange, por exemplo as próximas quatro semanas ou o mês de junho.

## Quando precisa disto

A reunião semanal quer saber o que acontece nas próximas quatro semanas. O relatório mensal abrange junho. Sem período, obtém o planeamento inteiro em papel. Cinco relatórios usam, por isso, um *Período do relatório:*: *Previsão (look-ahead)*, *Relatório de progresso*, *Carga de recursos*, *Atribuições de recursos* e o *Diagrama de recursos*. Os outros relatórios não têm período.

O período não está ligado a um mês civil, mas a um **dia de referência**: a data de estado do seu projeto (o dia em que mede o progresso, ver [Progresso, data de estado e linha de base](docs://uitleg-voortgang)), ou hoje, se o projeto não tiver data de estado. *Próximas 4 semanas* conta a partir desse dia. Se alterar a data de estado, a janela move-se com ela.

## Passos

### 1. Defina a data de estado

Se trabalhar com uma escolha relativa, como *Próximas 4 semanas* ou *Último mês*, defina primeiro a data de estado. Escolha *Planeamento › Linhas de base e progresso* e preencha o campo *Data de estado*. Com a cruz ao lado (*Limpar data de estado*), remove outra vez a data. Se trabalhar com um período fixo (passo 4), não precisa disto.

### 2. Escolha um relatório com período

Abra o separador *Relatório* e escolha um dos cinco relatórios em *Tipo de relatório*. A lista *Período do relatório:* está em *Opções do relatório*. Para o Diagrama de recursos, está em *Definições*, abaixo das quatro caixas de verificação desse relatório.

Cada relatório memoriza o seu próprio período. Estes são os valores iniciais:

- *Previsão (look-ahead)*: *Próximo mês*.
- *Relatório de progresso*: *Último mês*.
- *Carga de recursos*, *Atribuições de recursos* e *Diagrama de recursos*: *Projeto inteiro*.

### 3. Escolha um período da lista

A lista tem *Próxima semana*, *Próximas 2 semanas*, *Próximas 4 semanas*, *Próximas 6 semanas*, *Próximas 8 semanas*, *Próximas 12 semanas*, *Próximo mês*, as mesmas sete em sentido passado (por exemplo *Últimas 2 semanas* e *Último mês*), *Projeto inteiro* e *Personalizado*. Por baixo da lista estão *De* e *Até* com as datas que a escolha produz. Aqui só pode ler estas datas.

Ambos os dias contam. Se a data de estado for quinta-feira, 20 de maio, *Próxima semana* vai de 20 a 26 de maio, inclusive, e *Próximas 4 semanas* de 20 de maio a 16 de junho, inclusive (28 dias). *Próximo mês* vai até ao dia anterior à mesma data do mês seguinte, aqui até 19 de junho, inclusive. *Últimas 2 semanas* vai de 7 a 20 de maio, inclusive.

*Projeto inteiro* vai do primeiro início até ao último fim do planeamento.

### 4. Ou escolha Personalizado

Com *Personalizado*, *De* e *Até* passam a ser dois campos de data. Começam com as datas da escolha que tinha antes. Preencha os dois, por exemplo 1 e 14 de junho. Se o valor introduzido não estiver correto, o relatório mantém o último período válido e mostra a vermelho:

- *A data final é anterior à data inicial.* se *Até* for anterior a *De*.
- *Preencha ambas as datas.* se um dos dois estiver vazio.

### 5. Leia o período no relatório

Para a Previsão (look-ahead), a Carga de recursos e as Atribuições de recursos, o período está por baixo do título, por exemplo *Período: 20-05-2027 – 19-06-2027*. Se escolher *Projeto inteiro*, *Projeto inteiro* é acrescentado depois das datas. O Relatório de progresso mostra o período no resumo, em *Período*. O Diagrama de recursos faz com que o seu eixo de tempo corresponda exatamente ao período.

### O que o período faz em cada relatório

O período não funciona da mesma forma em todos os relatórios.

- **Previsão (look-ahead)** inclui as tarefas não concluídas que se sobrepõem ao período, também se abrangerem o período inteiro. As tarefas atrasadas, anteriores ao dia de referência, também são incluídas, desde que o fim do período não seja anterior ao dia de referência. Um período personalizado totalmente no passado é uma retrospetiva: mostra apenas o que estava a decorrer nessa altura e ainda não estava concluído, sem o atraso acumulado de hoje.
- **Relatório de progresso** usa o período para *Concluídas no período anterior*. A secção *Começam no próximo período* olha em frente a partir da data de estado, até à data em *Previsão até* no resumo. Se escolher uma opção com *Último* ou *Últimas*, como *Último mês* ou *Últimas 2 semanas*, o relatório olha em frente tanto como olha para trás: com *Últimas 2 semanas* e data de estado 20 de maio, mostra *Previsão até* 3 de junho. Um período personalizado ou *Projeto inteiro* que esteja totalmente no passado não é refletido.
- **Carga de recursos** mostra, por inteiro, cada semana ou mês que se sobrepõe ao período. Se o seu período for de quarta-feira a quarta-feira, vê assim semanas completas, por isso uma linha mostra sempre o mesmo número que o histograma.
- **Atribuições de recursos** mostra as atribuições das tarefas que se sobrepõem ao período. Com *Projeto inteiro* não há filtro por data.
- **Diagrama de recursos** mostra apenas as tarefas que se sobrepõem ao período. No resumo, *Fora do período:* conta quantas tarefas ficaram de fora.

## Erros comuns e o que a aplicação faz

**Não há data de estado.** A aplicação usa então o dia de hoje. Para os quatro relatórios em tabela com período (*Previsão (look-ahead)*, *Relatório de progresso*, *Carga de recursos* e *Atribuições de recursos*), aparece no topo, com um período relativo, a mensagem *Sem data de estado — o relatório usa hoje (29-09-2026).*, com a data de hoje no seu dispositivo. O Diagrama de recursos não mostra esta mensagem. Por isso, olhe para *De* e *Até*: estão então em torno de hoje, não em torno do seu planeamento.

**O período está fora do seu planeamento.** Então o relatório fica vazio. O Diagrama de recursos indica-o com a mensagem *Nenhuma tarefa no período do relatório — escolha outro período ou Projeto inteiro.* (na lista, essa escolha chama-se *Projeto inteiro*). Nos outros relatórios, vê zero atividades ou nenhuma linha.

**As datas estão no seu formato.** *De* e *Até* seguem o formato de data das suas definições, exceto nos campos de data de *Personalizado*: esses mostram o formato do seu navegador.

**O período acompanha o tempo.** Uma escolha relativa, como *Próximo mês*, é determinada de novo de cada vez: se a data de estado mudar, ou se não houver data de estado e for outro dia, o período move-se logo. Se quiser um período fixo, escolha *Personalizado*.

**A escolha vale para todos os seus projetos.** Um período personalizado vale também para todos os seus projetos neste dispositivo, e não só para o projeto aberto.

## Ver também

- [Fazer e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken): o percurso completo, desde o tipo de relatório até ao PDF.
- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): o que é a data de estado e porque é que a aplicação calcula com ela.
- [Resolver recursos sobrealocados](docs://howto-overbezetting-oplossen): o que fazer com as semanas sobrealocadas da Carga de recursos.
- [Tipos de relatório](docs://ref-rapporttypes): todos os tipos de relatório e as respetivas opções.
