# Relatórios & impressão

Um cronograma não está terminado até que possa ser partilhado — em papel para uma reunião de estaleiro, como imagem
numa apresentação, ou como uma visão geral do que está para vir e do que já se deslocou. É para isso que serve o
separador **Relatório**, com três tipos de relatório e uma pré-visualização de impressão.

## O que vai aprender aqui

- Os três tipos de relatório no separador **Relatório**: impressão de Gantt, visão geral de marcos, variância.
- Como funciona a pré-visualização de impressão: tamanho de papel, orientação e que elementos ativa/desativa.
- Como imprimir efetivamente um relatório ou guardá-lo como ficheiro.
- O que faz **Ctrl+P** nesta aplicação.

## Chegar ao ecrã de relatório

Há três formas de chegar ao mesmo ecrã: clicar no separador do friso **Relatório**, ir a
**Backstage → Imprimir** (que abre diretamente o ecrã de relatório), ou premir **Ctrl+P**. Todas as três levam
ao mesmo local — não há um diálogo "imprimir" separado; o ecrã de relatório *é* a pré-visualização de impressão.

O ecrã está dividido em duas colunas: um painel de definições à esquerda com o seletor de **Tipo de relatório**
no topo, e uma pré-visualização ao vivo à direita que se atualiza imediatamente à medida que altera as definições à
esquerda.

## Os três tipos de relatório

### Impressão de Gantt

Uma impressão completa e formatada das barras de Gantt — este é o único tipo de relatório com um bloco de definições:

- **Papel**: A4, A3 ou A1.
- **Orientação**: paisagem ou retrato.
- **Ajustar ao papel automaticamente** (ligado = o cronograma ajusta-se automaticamente ao tamanho escolhido) ou um
  controlo deslizante de **zoom** manual se desligar o ajuste automático.
- Interruptores para **Nomes de tarefas nas barras**, **Mostrar conclusão**, **Caminho crítico**, **Mostrar folga**,
  **Dependências**, **Fins de semana** e **Legenda**.
- Um campo **Empresa:** (autopreenchido a partir da definição do projeto, mas separadamente editável aqui) e o
  **Autor:** (só leitura, a partir das informações do projeto).

O bloco de resumo acima mostra a contagem ao vivo de tarefas, tarefas folha, tarefas críticas e relações
no projeto.

### Visão geral de marcos

Uma tabela de todos os marcos no projeto: EAP, nome, tipo (automático/início/fim), data, a
restrição ou prazo subjacente, folga, se o marco é obrigatório, e estado (no
prazo / crítico / atrasado). O bloco de resumo mostra a contagem total de marcos, quantos são
obrigatórios e quantos estão atrasados. Este relatório não tem definições de tamanho de papel/orientação — imprime
a tabela exatamente como apresentada.

### Variance

Compara o cronograma atual com a baseline ativa: início/fim da baseline versus início/fim
atual, a diferença em dias úteis para o início e o fim, e um estado por tarefa (no
prazo / atrasado / mais cedo / nova / eliminada). Se não houver baseline ativa, o ecrã declara isso
explicitamente em vez de mostrar um relatório vazio. O bloco de resumo também mostra o desvio na
data de fim do projeto em dias úteis, se existir. Veja o guia
[Baselines & progresso](docs://gids-baselines-voortgang) para saber como registar uma baseline antes de este
relatório poder dizer-lhe algo útil.

## Imprimir e exportar

O painel de definições tem sempre um botão **Imprimir...** no fundo — abre uma janela de impressão separada
contendo o relatório e desencadeia imediatamente o diálogo de impressão do navegador/SO. Para o relatório de Gantt,
essa janela usa o tamanho de papel e a orientação escolhidos; os relatórios de marcos e de variância imprimem a
tabela tal como apresentada.

Só o relatório de Gantt tem também um botão **Exportar PDF**. Isso guarda a pré-visualização atual como um
ficheiro PDF real (nome do ficheiro terminado em `-planning.pdf`) — uma página dimensionada às dimensões
físicas do tamanho de papel e orientação escolhidos. O ficheiro PDF é **baseado em vetores**: barras, linhas e texto
são armazenados como instruções de desenho PDF em vez de uma única imagem incorporada, pelo que se mantém nítido em
qualquer nível de zoom e o texto é selecionável e pesquisável em qualquer leitor de PDF. Isto aplica-se a texto
Latino, Cirílico e Grego; se o projeto contiver texto Chinês, Japonês, Coreano, Árabe ou Persa, a exportação
recorre automaticamente a uma imagem raster para esse texto — ainda corretamente apresentado,
mas não selecionável nem pesquisável. Útil para email ou arquivo sem passar pelo diálogo de impressão do
sistema. Se preferir imprimir diretamente (ou guardar como PDF através do diálogo do sistema, por exemplo para escolher
um tamanho de papel diferente do configurado acima), use **Imprimir...**.

## Relatórios na prática

Cada tipo de relatório serve uma conversa diferente:

- O **relatório de Gantt** é o clássico documento para reuniões de estaleiro: o caminho crítico destacado, a folga
  visível nas barras não críticas, e a legenda a explicar o que significa cada cor. Ative
  **Nomes de tarefas nas barras** e **Mostrar conclusão** se a audiência ainda não conhecer o cronograma;
  desative-os para uma visão geral limpa em A1 se uma lista de tarefas separada for entregue ao mesmo tempo.
- A **visão geral de marcos** destina-se a quem só quer as datas importantes sem percorrer
  dezenas de linhas de tarefas — por exemplo um cliente que principalmente quer saber se as datas de
  entrega obrigatórias estão a ser cumpridas. O símbolo ◆ antes do nome de um marco na tabela assinala um marco
  **obrigatório**.
- O **relatório de variância** é a conversa sobre correção de rumo: quais as tarefas que se atrasam
  em relação à baseline, e por quantos dias úteis. Veja este relatório na prática no exemplo
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), que tem
  duas baselines (uma baseline de contrato e uma nova baseline após uma ordem de alteração) com o seu próprio progresso
  e data de estado — um bom exemplo de como as colunas Δ se preenchem assim que há uma diferença real
  entre a baseline e o cronograma atual.

A pré-visualização ao vivo à direita atualiza-se a cada alteração das definições à esquerda — não há
um botão "atualizar" separado, e nada é calculado apenas no momento da impressão.

## Leitura adicional

- Um relatório de variância não tem nada para comparar até que uma baseline tenha sido registada — leia o guia
  [Baselines & progresso](docs://gids-baselines-voortgang).
- O caminho crítico e a folga apresentados no relatório de Gantt vêm do mesmo cálculo que a própria vista de
  Gantt — leia o guia [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse)
  para saber como interpretar isso.
