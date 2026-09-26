# Escolher colunas

A **Tabela** (separador **Tabela**) e a lista de tarefas ao lado do Gantt têm cada uma as suas próprias colunas. Altera-as na própria tabela: o sinal de mais no cabeçalho da tabela abre o seletor de colunas, e no cabeçalho de uma coluna move, alarga, fixa ou remove uma coluna. Cada alteração é aplicada de imediato; não há um passo de OK.

Por predefinição, a lista de tarefas ao lado do Gantt mostra **Estrutura analítica do projeto (EAP)**, **Nome da tarefa** e **Duração**. A Tabela mostra ainda **Início**, **Fim**, **Tipo de tarefa**, **Crítica**, **Folga total** e **Progresso**, mais os códigos de atividade e os campos personalizados do projeto.

## Abrir o seletor de colunas

- O sinal de mais à direita do cabeçalho da tabela. A Tabela e a lista de tarefas ao lado do Gantt têm cada uma o seu próprio sinal de mais, que só altera a sua própria tabela.
- O separador **Tabela** → **Colunas…** abre o seletor de colunas da Tabela.
- Com os botões de vista clássicos ativados (**Definições** → separador **Avançado** → **Funcionalidades legadas** → **Mostrar os botões de vista clássicos**), **Visualização** → grupo do friso **Apresentação** → **Colunas…** faz o mesmo: o botão muda para o separador Tabela e abre aí o seletor de colunas.

**Esc**, um clique fora do seletor ou outro clique no sinal de mais fecha o seletor.

## Adicionar uma coluna

O seletor **Escolher coluna** contém, de cima para baixo:

- **Usadas recentemente** — campos que adicionou recentemente com o seletor. Este bloco aparece assim que tiver adicionado uma coluna.
- O campo **Pesquisar** — escreva parte do nome de um campo; os **Resultados da pesquisa** vêm de todos os grupos.
- Os campos por grupo: **Tarefa**, **Planeamento**, **Restrições**, **Relações**, **Recursos**, **Progresso**, **Calculado**, **Linha de base**, **Personalizado** e **Técnico**. Um clique num grupo expande-o; o número ao lado é a quantidade de campos desse grupo.
- Em baixo, o botão **Repor predefinição** (veja mais à frente).

Clique num campo para o adicionar como última coluna; o seletor fecha-se então. Um campo que já é uma coluna está assinalado e não pode ser escolhido outra vez. Os códigos de atividade e os campos personalizados do projeto estão em **Personalizado**, os campos das suas linhas de base em **Linha de base**.

Em **Calculado** estão, entre outros, os campos de análise **Folga livre**, **Folga interferente**, **Quase crítica** e **Caminho de folga**. Só recebem valores após um cálculo (**F5**), e **Quase crítica** e **Caminho de folga** apenas se a opção de agendamento correspondente estiver ativada — veja [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse).

## Ajustar colunas no cabeçalho

- **Mover** — arraste o cabeçalho de uma coluna para outra posição. As colunas fixadas ficam juntas no início; uma coluna não fixada só se move entre as colunas não fixadas.
- **Largura** — arraste a margem direita do cabeçalho de uma coluna (de 40 a 480 píxeis). Um duplo clique nessa margem ajusta a coluna ao cabeçalho e ao valor mais longo. Com o teclado: coloque o foco na margem e use as setas esquerda e direita, com **Shift** para passos maiores.
- **Remover** — o sinal de menos que aparece no cabeçalho da coluna quando passa o ponteiro por cima. O campo continua disponível no seletor de colunas.
- **Clique direito** no cabeçalho de uma coluna oferece **Fixar** (ou **Desafixar**), **Ajustar automaticamente** e **Remover**. Uma coluna fixada passa para o início, junto das outras colunas fixadas, e continua visível quando desloca a tabela na horizontal (enquanto as colunas fixadas couberem juntas na tabela).

## Início, Fim e as datas planeadas

**Início** e **Fim** (na disposição predefinida da Tabela) mostram as mesmas datas que a barra no Gantt: o planeamento calculado e, antes do primeiro cálculo, as datas introduzidas. Se escrever outra data em Início, ela passa a ser o início planeado. Outro Fim altera a duração de uma tarefa agendada automaticamente; numa tarefa agendada manualmente passa a ser o fim planeado. Depois prima **F5** para recalcular. Se voltar a escrever a mesma data, nada muda.

Os campos **Início planeado** e **Fim planeado** mostram as próprias datas introduzidas, mesmo quando o cálculo desloca a tarefa. Fim planeado só é editável numa tarefa agendada manualmente: nas outras tarefas, o início e a duração determinam o fim. O Início e o Fim de uma tarefa de resumo agendada automaticamente resultam das suas subtarefas e não são editáveis.

## Repor predefinição

**Repor predefinição** fica no fundo do seletor de colunas. Um clique repõe as colunas dessa tabela na disposição predefinida: que colunas são mostradas, a sua ordem e largura, e as colunas fixadas. Os campos adicionados a mais saem da tabela e continuam disponíveis no seletor. É também assim que obtém a nova disposição predefinida após uma atualização, por exemplo **Início** e **Fim** em vez de **Início planeado** e **Fim planeado**: uma disposição própria guardada antes não muda por si só. Se a tabela já usa a disposição predefinida, o botão fica desativado.

## Guardar, anular e layouts

A disposição das colunas é uma preferência pessoal neste dispositivo: aplica-se a todos os seus projetos e não é guardada no ficheiro do projeto. Cada ação sobre as colunas — adicionar, remover, mover, alargar, fixar ou **Repor predefinição** — é um passo que **Ctrl+Z** anula.

Um layout também pode guardar as colunas. Adota a disposição da tabela que vê quando cria o layout e, com um clique no botão do layout, aplica-a à tabela que estiver visível nesse momento: no separador Tabela, a Tabela; nos outros separadores, a lista de tarefas ao lado do Gantt. Veja [Guardar e carregar layouts](docs://ref-layouts).

## Leitura adicional

- [Filtros](docs://ref-filters) — quais tarefas a tabela e o Gantt mostram.
