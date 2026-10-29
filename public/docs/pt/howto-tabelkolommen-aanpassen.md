# Ajustar colunas da tabela

Objetivo: escolha as colunas que vê na tabela de tarefas, a sua ordem e a sua largura.

## Quando precisa disto

Na reunião, quer ver o prazo e a folga total ao lado de cada tarefa. O responsável de obra só quer ver o início e o fim ao lado do nome. Ou uma coluna é tão estreita que o cabeçalho fica cortado. A tabela de tarefas é formada por colunas que escolhe a si próprio: há dezenas, desde *Nome da tarefa* e *Duração* até *Prazo*, *Folga livre* e *Recursos atribuídos*.

Há duas tabelas de tarefas, cada uma com as suas próprias colunas:

- A **tabela de tarefas ao lado do Gantt** fica à esquerda da linha de tempo nos separadores, entre outros, *Início*, *Planeamento* e *Visualização*. Por padrão, tem *WBS*, *Nome da tarefa* e *Duração*, para que sobre espaço para a linha de tempo.
- A **tabela no separador Tabela** ocupa toda a área de trabalho. Por padrão, tem *WBS*, *Nome da tarefa*, *Duração*, *Início*, *Fim*, *Categoria de trabalho*, *Crítica*, *Folga total* e *Progresso*, mais uma coluna por cada código de atividade e campo personalizado do projeto.

Uma alteração a uma tabela não altera a outra.

## Passos

### Adicionar uma coluna

1. Clique no sinal de mais (**+**) à direita do cabeçalho da tabela. No separador *Tabela* também pode usar *Tabela › Colunas › Colunas…*. A janela *Escolher coluna* aparece.
2. Encontre a coluna. No topo, se já tiver escolhido colunas antes, está *Usadas recentemente*. Escreva parte do nome em *Pesquisar*, por exemplo *praz* para *Prazo*, ou abra uma categoria: *Tarefa*, *Planeamento*, *Restrições*, *Relações*, *Recursos*, *Progresso*, *Calculado*, *Linha de base*, *Personalizado* ou *Técnico*.
3. Clique na coluna. Ela fica no fim da tabela e a janela fecha.

Uma coluna que já está na tabela fica cinzenta e não a pode escolher.

### Remover uma coluna

Clique no sinal de menos no cabeçalho da coluna (*Remover: Prazo*). Ou clique com o botão direito no cabeçalho e escolha *Remover: Prazo*. Com Ctrl+Z, recupera a coluna. Ou escolha-a outra vez com o sinal de mais.

### Ajustar a largura

Arraste a margem à direita do cabeçalho da coluna para a esquerda ou para a direita. Faça duplo clique nessa margem, ou escolha *Ajustar automaticamente* no menu do cabeçalho (botão direito do rato), para que a coluna fique tão larga quanto o conteúdo, até um máximo de 480 pixels. Se a margem tiver o foco, as setas do teclado alargam ou estreitam-na passo a passo.

### Fixar colunas

Clique com o botão direito no cabeçalho e escolha *Fixar*. As colunas fixadas passam para a frente e ficam à esquerda quando desloca a tabela na horizontal. Isso funciona enquanto, em conjunto, não forem mais largas do que a janela. *Desafixar* volta a pôr as colunas na linha.

### Mudar a ordem

Arraste um cabeçalho de coluna para outro lugar. Ao mover uma coluna fixada, ela fica entre as colunas fixadas, e uma coluna normal fica entre as colunas normais.

### Voltar ao padrão

Abra a janela *Escolher coluna* e clique em *Repor predefinição* na parte inferior. O botão fica cinzento se as colunas já estiverem no padrão. Para a tabela no separador *Tabela*, é também adicionada uma coluna por cada código de atividade e campo personalizado do projeto, mesmo que as tenha removido antes. Essas colunas pertencem ao projeto em que está o código ou o campo. Pode ler sobre esses códigos e campos em [Códigos e campos personalizados](docs://howto-codes-en-velden).

## Armadilhas e o que a aplicação faz

**O cabeçalho está cortado.** Uma coluna estreita corta o nome, por exemplo *Folga total* fica *Folga t…*. Faça duplo clique na margem do cabeçalho para ajustar a coluna.

**Ajusta a tabela errada.** As colunas da tabela de tarefas ao lado do Gantt e as do separador *Tabela* são separadas. Se estiver em *Visualização* ou *Início*, ajusta a tabela ao lado do Gantt. O sinal de mais no separador *Tabela* ajusta a tabela grande.

**Um layout repõe colunas.** Se um layout tiver a parte *Colunas* marcada, um clique no botão do layout repõe as colunas da tabela ao lado do Gantt no estado guardado. A tabela no separador *Tabela* fica como está. Veja [Criar e usar um layout](docs://howto-layouts-gebruiken).

**As colunas ficam no seu dispositivo, não no projeto.** A aplicação guarda a escolha de colunas para todos os projetos neste dispositivo e não a guarda no ficheiro do projeto. Também não marca o projeto como «modificado». Pode desfazer cada alteração de coluna com *Desfazer* (Ctrl+Z). Os passos chamam-se, por exemplo, *Adicionar a coluna Prazo* e *Redimensionar a coluna Nome da tarefa*.

## Veja também

- [Criar e usar um layout](docs://howto-layouts-gebruiken): colocar colunas num botão, juntamente com um filtro ou uma ordenação.
- [Códigos e campos personalizados](docs://howto-codes-en-velden): criar colunas próprias que pode escolher aqui.
- [Colunas da tabela](docs://ref-tabelkolommen): todas as colunas e o que mostram.
