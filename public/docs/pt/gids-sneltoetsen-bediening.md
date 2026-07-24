# Atalhos de teclado & controlos

Este guia não lista atalhos de teclado — essa lista já vive num único local, e uma cópia aqui
ficaria desatualizada de imediato. Em vez disso, explica **como consultar sempre a lista atual**, e
quais conceitos de controlo (menus de contexto, arrastar, seleção por retângulo versus deslocação, zoom) valem a pena
compreender por si próprios.

## O que vai aprender aqui

- Como abrir a visão geral de atalhos sempre atualizada.
- O que contém cada um dos quatro menus de contexto na vista de Gantt.
- Como funciona o arrastar: mover uma barra versus desenhar uma relação.
- Quando um arrasto em tela vazia desloca a vista, e quando faz seleção por retângulo.
- Zoom, separadores de documento e modo de apresentação.
- Como reiniciar o tour.

## A visão geral sempre atualizada

Prima **Ctrl+/** (ou **Cmd+/** no macOS) para abrir a visão geral de atalhos — a mesma janela também é
acessível através do botão **Atalhos de teclado** no separador do friso **Visualização**. Esta janela é só de leitura e é
construída diretamente a partir do código-fonte da aplicação: um novo atalho aparece aqui automaticamente, sem
nenhuma lista separada que alguém tenha de manter sincronizada. É exatamente por isso que este guia não duplica a lista —
uma segunda lista, mantida à mão, mais cedo ou mais tarde divergiria do que a aplicação realmente faz. A
janela agrupa os atalhos por categoria: Ficheiro, Editar, Estrutura, Visualização e Navegação.

## Menus de contexto: quatro tipos, dependendo de onde clica com o botão direito

Clicar com o botão direito na vista de Gantt dá um menu diferente dependendo de onde está o rato:

- **Numa barra de tarefa** — o menu completo de tarefa (editar, inserir, adicionar subtarefa/marco/relação, atribuir
  calendário, progresso, prioridade, rastrear caminho, eliminar…), mais um item extra específico da barra no topo:
  **Iniciar relação a partir daqui**.
- **Numa linha de tarefa sem atingir uma barra** (por exemplo uma linha sem barra atualmente visível) — o mesmo
  menu de tarefa, mas sem o item específico da barra.
- **Numa linha de cabeçalho de grupo** (a linha que resume um conjunto agrupado de tarefas) — um pequeno menu para
  recolher/expandir esse grupo, mais **Expandir tudo**/**Recolher tudo** para toda a árvore.
- **Em tela vazia** (sem tarefa, sem cabeçalho de grupo) — **Nova tarefa**, **Adicionar marco**, **Colar** (se
  houver algo na área de transferência), **Repor zoom** e **Ajustar ao projeto**.

Este último menu foi verificado ao vivo: clicar com o botão direito num ponto vazio da tela de Gantt produz exatamente
estes cinco itens, por esta ordem.

## Arrastar numa barra de tarefa

Agarrar e arrastar uma barra de tarefa move a tarefa (ou, ao agarrar na extremidade, altera a sua duração).
Mantenha premido **Shift** enquanto arrasta a partir de uma barra, e em vez disso começa a desenhar uma **relação** para
qualquer tarefa em que soltar — o mesmo que **Iniciar relação a partir daqui** no menu de contexto da barra, mas
num só movimento do rato.

## Deslocação versus seleção por retângulo

Um arrasto que começa em espaço vazio faz uma de duas coisas, e isso depende de onde o inicia e
do seu modo de deslocação (**Definições → Deslocação e zoom**):

- **Na tabela de tarefas** (a coluna à esquerda com WBS/nome/duração), um arrasto em espaço vazio é
  **sempre** uma seleção por retângulo — a deslocação nunca acontece aí.
- **Na própria tela de Gantt**: se o seu modo de deslocação estiver definido para **Zoom + arrastar** (deslocação estilo mapa),
  a deslocação prevalece — exatamente como esperaria de uma aplicação de mapas. Em qualquer dos outros modos de deslocação
  (**Posição** ou **Teclas**), esse mesmo arrasto em tela vazia é uma seleção por retângulo, permitindo-lhe
  selecionar várias tarefas de uma vez arrastando um retângulo à volta delas.

Em resumo: a tabela de tarefas sempre seleciona; a tela só se desloca no modo de deslocação por arrasto e seleciona
nos outros casos.

## Zoom

Além dos botões de zoom no friso, **+**/**=** (ou **Ctrl+=**) amplia e **-** (ou
**Ctrl+-**) reduz. Um simples **0** repõe o zoom para a predefinição; **Ctrl+0** ajusta o zoom de modo a que todo
o projeto caiba no ecrã ("ajustar ao projeto") — o mesmo que o botão com esse nome no menu de contexto de
tela vazia acima.

## Separadores de documento

Se tiver vários projetos abertos ao mesmo tempo (cada um no seu próprio separador de documento), **Ctrl+1** até
**Ctrl+9** salta diretamente para o primeiro até ao nono separador de documento.

## Modo de apresentação

**F11** alterna o modo de apresentação — uma vista em ecrã inteiro sem o friso e os painéis laterais, pensada para
mostrar o cronograma sem os elementos de edição à volta. **Esc** sai novamente do modo de apresentação
(e, numa pressão subsequente, executa o habitual "limpar seleção").

## Reiniciar o tour

Quer executar de novo o tour de introdução (por exemplo para mostrar a alguém a aplicação)? Há dois
locais para fazer isso: o botão **Tour** no separador do friso **Visualização**, ou **Iniciar tour** na navegação da
Backstage (a linha mesmo acima de Definições). Ambos iniciam o tour imediatamente, sem mostrar primeiro o
diálogo de boas-vindas.

## Leitura adicional

- Abra a própria visão geral de atalhos com **Ctrl+/** — essa é a fonte vinculativa, não este guia.
- O comportamento de deslocação e zoom é configurado em **Definições → Deslocação e zoom**, disponível nos três
  locais de definições fixos da aplicação (o ícone de engrenagem, o separador do friso Definições, e Backstage →
  Definições).
