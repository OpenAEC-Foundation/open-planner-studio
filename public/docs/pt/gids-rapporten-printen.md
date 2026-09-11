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
- **Tamanho da fonte** — 90, 100, 110 ou 125%; ajusta o texto do relatório, a altura das linhas e o
  cabeçalho/rodapé, independentemente do nível de zoom acima.
- **Repetir cabeçalho em cada página** — ligado por predefinição; mantém o cabeçalho do relatório visível em
  todas as páginas impressas, em vez de apenas na primeira.
- **Cronograma em** — distribui a linha do tempo de Gantt por 1 a 8 páginas lado a lado; só disponível
  com o ajuste automático ligado.
- Interruptores para **Nomes de tarefas nas barras**, **Mostrar conclusão**, **Caminho crítico**, **Mostrar folga**,
  **Dependências**, **Fins de semana** e **Legenda**.
- Um campo **Empresa:** (autopreenchido a partir da definição do projeto, mas separadamente editável aqui) e o
  **Autor:** (só leitura, a partir das informações do projeto).

As linhas de relação no relatório usam a mesma linguagem visual da vista de Gantt: uma linha **contínua** é
uma relação determinante, uma linha **tracejada** uma não determinante, e uma relação determinante entre duas
tarefas críticas é **vermelha**. Desative *caminho crítico* e essas linhas também ficam neutras. A legenda no
fundo resume a diferença. Antes do primeiro cálculo, todas as linhas são desenhadas a neutro e contínuas —
prima primeiro *Calcular* (F5).

O bloco de resumo acima mostra a contagem ao vivo de tarefas, tarefas folha, tarefas críticas e relações
no projeto. O painel de definições memoriza as suas escolhas entre sessões — reabra o separador Relatório
mais tarde e o tamanho de papel, os interruptores, o tamanho da fonte e o resto voltam exatamente como os
deixou. Só o campo empresa é reposto: parte sempre da definição própria do projeto, para que um relatório
nunca herde o nome da empresa de outro projeto.

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

## Os sete relatórios tabulares

Os restantes tipos de relatório são tabelas tiradas diretamente do último cálculo. Partilham algumas
regras: só as **tarefas folha** contam como atividades (as tarefas resumo só aparecem no resumo EAP;
as tarefas hammock não); o **dia de referência** é a data de estado do projeto — sem data de estado
o relatório usa hoje e diz isso; datas e folgas vêm do último **cálculo** (F5), uma nota assinala um
cronograma alterado desde então e a exportação PDF recalcula sempre primeiro; cada relatório tem um
pequeno bloco **Opções do relatório**, lembrado entre sessões. Os dias úteis abreviam-se para *du*.

### Previsão (look-ahead)

A lista para a reunião semanal de obra: todas as atividades das próximas *N* semanas (quatro por
defeito) — o que começa, continua ou termina — mais o que já devia ter acontecido. Por linha: EAP,
nome, início e fim, duração restante, progresso, folga total, crítica ou quase crítica, recursos
atribuídos e um estado: **Começa**, **Em curso**, **Devia ter começado** ou **Atrasada**. Uma
atividade que abrange toda a janela também aparece.

### Crítico e quase crítico

Que atividades determinam o fim do projeto e quais estão prestes a fazê-lo. Crítico vem do cálculo;
*quase crítico* é uma folga total de 0 até ao limiar das opções (5 dias úteis por defeito) ou a
marcação das opções de programação. As tarefas concluídas são excluídas. Ordenação por caminho de
folga, depois folga, depois início; com folga livre e número de caminho.

### Relatório de progresso

O ponto de situação periódico «onde estamos» na data de estado. O resumo dá o fim da linha de base
e o fim previsto com a diferença em dias úteis, o progresso **planeado** face ao **real** (ambos
ponderados pela duração das tarefas folha; planeado nas datas da linha de base ativa, senão no
cronograma atual) e as contagens por estado. Por baixo, cinco secções: concluídas no período
anterior, em curso, começam no próximo período, atrasadas e atividades críticas em aberto. O período
(duas semanas por defeito) olha tanto para trás como para a frente.

### Saúde do cronograma

Uma revisão automática do cronograma no espírito dos 14 pontos DCMA. Cada verificação recebe uma
gravidade e uma contagem, com as constatações por tarefa ou relação: **erros** (folga negativa,
prazo falhado, restrição violada, progresso incoerente), **avisos** (início ou fim abertos, duração
longa, avanços, restrições rígidas, progresso fora de sequência) e **informação** (quase crítico,
folga alta, atrasos longos). Os limiares estão nas opções; por defeito segundo DCMA: 44 dias úteis
para folga alta e duração longa, 10 para atrasos. Um cronograma limpo tem zero erros.

### Carga de recursos por semana

Por recurso e semana, a necessidade face à capacidade disponível (em unidades-dia), a diferença, o
pico diário e se a semana está sobrecarregada — o mesmo cálculo do histograma no separador
**Recursos**, em forma de tabela. Só aparecem semanas com necessidade; com *Apenas semanas
sobrecarregadas* ficam só os estrangulamentos.

### Atribuições de recursos

Por recurso, as atividades atribuídas: EAP, nome, início e fim, duração restante, unidades por dia,
progresso, crítica e estado. As tarefas concluídas são excluídas por defeito. Com uma janela em
semanas torna-se a *previsão por recurso*. O resumo conta também as tarefas sem recurso.

### Resumo EAP

O cronograma agregado por elemento EAP até um nível à escolha — a vista de gestão. Por elemento:
início e fim, início e fim da linha de base, duração, progresso ponderado pela duração, diferença do
fim face à linha de base, menor folga total e número de atividades, das quais críticas, em curso e
concluídas. Escolha um nível (2 por defeito) ou a EAP completa, com as atividades se quiser.

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
Latino, Cirílico, Grego, Árabe e Persa — o Árabe e o Persa também são moldados (shaped) e incorporados como texto
vetorial. O texto Chinês, Japonês e Coreano é opcional: instale uma extensão de fonte que forneça esses
glifos e também é incorporado como vetor (selecionável e pesquisável); sem essa extensão, esse texto é
exportado como imagem raster — continua corretamente apresentado, mas não selecionável nem pesquisável. Útil para email ou arquivo sem passar pelo diálogo de impressão do
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
