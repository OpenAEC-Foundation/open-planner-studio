# Apresentar num ecrã grande

Objetivo: mostrar o Gantt em ecrã inteiro, sem friso nem painéis, por exemplo num projetor ou televisor na reunião na obra.

## Quando precisa disto

Dez pessoas olham para o mesmo ecrã no contentor de obra. O friso, a barra de estado e o painel de propriedades ocupam então espaço de que o planeamento precisa, e distraem. No **modo de apresentação**, a aplicação mantém apenas a tabela de tarefas e o Gantt, em todo o ecrã.

## Passos

### Preparar a vista

No modo de apresentação o friso desaparece, por isso prepare antes o que quer mostrar.

1. Prima **Calcular** (F5), para que as datas mostradas estejam corretas.
2. Defina a vista que quer mostrar, por exemplo um layout que mostre apenas as tarefas críticas (veja [Criar e usar um layout](docs://howto-layouts-gebruiken)).
3. Escolha uma escala temporal e um zoom a que os nomes das tarefas se leem à distância, e recolha ou expanda as fases com *Recolher* e *Expandir* no grupo *Estrutura* do separador *Visualização*.
4. Se quiser usar estas funções, ative *Vista dividida* e *Minimapa* (veja [Usar a vista dividida e o minimapa](docs://howto-split-view-en-mini-map)).

### Iniciar a apresentação

Escolha *Visualização › Apresentação › Apresentação*. Na aplicação para computador também pode premir F11. No navegador, F11 pertence ao próprio navegador: coloca a janela do navegador em ecrã inteiro e deixa a aplicação como está. O friso, os separadores, a barra de estado e o painel do lado direito desaparecem. Vê a tabela de tarefas, o Gantt e, se os tiver ativado, o histograma e o minimapa. Durante alguns segundos, na parte inferior, aparece a mensagem *Prima Esc ou F11 para sair do ecrã inteiro.*

Na aplicação para computador pode iniciar a apresentação a partir de qualquer separador com F11, também a partir de *Tabela* ou *Relatório*. No navegador só a pode iniciar com *Visualização › Apresentação › Apresentação*. Vê sempre o Gantt do projeto aberto, e quando parar volta ao separador onde começou. No navegador, esse separador é, portanto, *Visualização*.

### Parar a apresentação

Prima Esc ou F11. O friso e os painéis voltam a aparecer no separador onde começou.

## Armadilhas e o que a aplicação faz

**Ainda pode editar no modo de apresentação.** Clicar, arrastar, editar células e Delete continuam a funcionar. Se arrastar uma barra por engano, ela move-se e o planeamento deixa de estar atualizado. Uma tarefa que apague por engano repõe-na com Ctrl+Z, também no modo de apresentação. Por isso clique com cuidado quando estiver a trabalhar com um grupo.

**As notificações continuam visíveis.** Uma mensagem da aplicação, por exemplo um erro ao guardar, também aparece no modo de apresentação. Sem friso nem barra de estado, uma mensagem destas é o único sinal de que algo está errado.

**Prepare antes a vista dividida, o minimapa e os layouts.** Para isso precisa do friso, e esse está oculto neste modo. O zoom funciona, com a roda do rato ou com Ctrl+= e Ctrl+-. + e - também funcionam, mas só quando o foco está no Gantt. Depois de iniciar a apresentação, o foco fica muitas vezes na tabela de tarefas, por isso clique primeiro no Gantt.

**O ecrã inteiro não funciona.** Além de ocultar o friso, a aplicação também pede realmente o ecrã inteiro. Se o navegador ou a janela recusar, só desaparecem o friso e os painéis. A apresentação continua a funcionar. Se sair do ecrã inteiro de outra forma que não com Esc ou F11, por exemplo com uma tecla do sistema operativo, o modo de apresentação também termina.

**O modo de apresentação não é memorizado.** Depois de fechar e reabrir a aplicação, fica desligado.

## Ver também

- [Usar a vista dividida e o minimapa](docs://howto-split-view-en-mini-map): duas janelas temporais ou uma faixa de visão geral durante a apresentação.
- [Criar e usar um layout](docs://howto-layouts-gebruiken): configurar a vista que quer mostrar com um clique.
- [Atalhos de teclado](docs://ref-sneltoetsen): F11 e as outras teclas.
