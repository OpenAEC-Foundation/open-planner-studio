# Trabalhar com vários projetos ao mesmo tempo

Objetivo: ter mais de um planeamento aberto, mudar entre eles e fechá-los separadamente.

## Quando precisa disto

Está a trabalhar no loteamento de habitação do bairro, mas a reunião de obra também trata da renovação da sede do clube. Ou quer manter uma variante ao lado do original. Cada projeto está no seu próprio separador, com as suas tarefas, cálculo e janela temporal. Mudar entre projetos leva um clique e não perde nada.

## Passos

### Abrir um segundo projeto

1. Clique no sinal de mais à direita dos separadores (*Iniciar projeto*). A janela *Iniciar projeto* abre-se.
2. Escolha *Novo projeto* para um planeamento vazio, ou *Abrir projeto existente* para escolher um ficheiro. *Cancelar* fecha a janela.
3. Com *Novo projeto*, preencha a janela *Novo projeto* e clique em *Criar*.

O projeto aparece no seu próprio separador e fica ativo logo. *Novo* e *Abrir* no friso, Ctrl+O e os exemplos em *Ficheiro › Exemplos* também abrem um projeto num novo separador. Só um planeamento novo e vazio, que ainda não alterou, é reutilizado em vez de se acrescentar um separador.

### Mudar entre projetos

- Clique no separador do projeto.
- Prima Ctrl+1 a Ctrl+9 (⌘ em vez de Ctrl no macOS) para o projeto nessa posição na fila, contando da esquerda para a direita.
- Clique no ícone de menu à esquerda dos separadores (*Todos os projetos*). A vista geral *Projetos abertos* mostra um cartão por projeto, com o nome, o nome do ficheiro (se o projeto tiver um ficheiro), uma miniatura do planeamento, o número de tarefas, o número de tarefas críticas e a data de fim. Clique num cartão para ir até lá. Esc fecha a vista geral.

Cada separador tem um ponto colorido que pertence ao projeto. Um separador com um pequeno ponto atrás tem alterações não guardadas.

Se os separadores não couberem todos na largura, aparecem duas setas entre os separadores e o sinal de mais (*Deslocar os separadores para o início* e *Deslocar os separadores para o fim*). Cada clique desloca os separadores duas posições. Uma seta fica cinzenta quando já está no início ou no fim. Também pode deslocar os separadores com a roda do rato. O separador que escolher aparece sempre à vista automaticamente.

### Fechar um projeto

Clique na cruz ao lado do nome no separador (*Fechar*), ou na cruz num cartão da vista geral. Um projeto sem alterações fecha-se logo. Se tiver alterações não guardadas, a aplicação mostra a janela *Alterações não guardadas* com três opções:

- *Guardar* guarda o projeto e depois fecha-o.
- *Não guardar* fecha o projeto e descarta as alterações.
- *Cancelar* deixa o projeto aberto.

Se cancelar a operação de guardar, por exemplo ao fechar a caixa de diálogo de guardar, o projeto continua aberto.

Se fechar o último projeto, fica um planeamento vazio chamado *Novo planeamento*.

### Escolher o estilo de mudança de documento

Os separadores são uma escolha. Abra a janela *Definições da app* com a engrenagem na barra de título, vá ao separador *Aparência* e escolha em *Estilo de mudança de documento*:

- *Separadores horizontais*: o padrão. Uma fila de separadores por baixo do friso.
- *Separadores verticais*: uma barra estreita à esquerda com um botão por projeto (as primeiras letras do nome) e um sinal de mais. Se passar o rato sobre um botão, vê o nome, o nome do ficheiro, o número de tarefas, o número de tarefas críticas e a data de fim. O botão no topo abre a vista geral.
- *Pílula*: uma pílula na barra de título com o nome do projeto ativo e um contador, por exemplo *2 abertos*. Clique nela para abrir a vista geral e mudar de projeto aí.

Os três estilos abrem a mesma vista geral, e Ctrl+1 a Ctrl+9 funciona em todos os estilos.

## Armadilhas e o que a aplicação faz

**O que pertence ao projeto e o que é partilhado.** Cada projeto tem a sua própria vista: zoom e posição, um layout ativo com filtro, agrupamento ou ordenação, vista dividida, as linhas das relações e as fases recolhidas. Se mudar para outro projeto, vê aí a vista própria dele. Partilhados por todos os projetos são o separador selecionado no friso, o minimapa, as sobreposições (sobreposição da linha de base, linha de progresso e as restantes), a sua escolha de colunas, os seus layouts e as opções dos relatórios.

**Não pode mudar de projeto com uma caixa de diálogo aberta.** Enquanto uma caixa de diálogo estiver aberta, por exemplo a janela *Definições da app* ou uma janela de tarefa, Ctrl+1 a Ctrl+9 não fazem nada na aplicação. No navegador, mudam então os separadores do navegador. Feche primeiro a caixa de diálogo. Uma alteração não aplicada em *Definições do projeto* no Backstage também bloqueia a mudança.

**Ctrl+1 a Ctrl+9 contam pela ordem.** O atalho vai para o projeto nessa posição na fila. Se fechar um projeto, as outras posições sobem. Se tiver mais de nove projetos abertos, chega aos restantes só pelos separadores ou pela vista geral.

**Calcular e relatórios funcionam no projeto ativo.** Calcular (F5), *Exportar PDF* e os relatórios referem-se ao projeto que está ativo agora.

## Ver também

- [Criar e usar um layout](docs://howto-layouts-gebruiken): configurar uma vista por projeto.
- [Criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken): o relatório do projeto ativo.
