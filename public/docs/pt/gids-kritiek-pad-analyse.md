# Caminho crítico & análise avançada

Todo o cronograma tem uma cadeia mais longa de tarefas que, em conjunto, determinam quando o projeto termina: o caminho crítico. Tudo o que está fora dele tem folga — margem para atrasar sem tocar na data de fim. Este guia vai além de "quais barras são vermelhas": folga total/livre/interferente, trabalho quase crítico, múltiplos caminhos igualmente críticos, hammocks, fixações rígidas e o seu efeito a montante, e ligações externas entre projetos.

## O que vai aprender aqui

- Ler o caminho crítico, e a diferença entre folga total, livre e interferente.
- Trabalho quase crítico: definir o limiar e reconhecer a marcação âmbar.
- Múltiplos caminhos críticos ao mesmo tempo — quando isso acontece e como se vê.
- Fixações rígidas e o seu efeito na folga, incluindo folga negativa a surgir a montante.
- Hammocks (Level of Effort): o que fazem e o que não fazem.
- Ligações externas entre projetos: a âncora congelada, atualizar, e o estado "origem não carregada".
- Rastrear um caminho através do menu de contexto ou do friso.
- A secção **Cálculo** nas definições do projeto.

Siga com [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — o grande exemplo "com tudo incluído", com três torres paralelas, que mostra quase todos os temas deste guia: múltiplos caminhos críticos, trabalho quase crítico, um hammock, uma fixação rígida e uma ligação externa a um ficheiro de origem separado.

## Ler o caminho crítico

Prima **F5** (ou o botão **Calcular**) para executar o cronograma. A barra de estado no fundo mostra então, por exemplo, "Caminho crítico: N tarefas, M dias úteis" — o número de tarefas no caminho crítico e a duração total. No diagrama de Gantt, as tarefas críticas recebem a sua própria cor de barra (vermelha): tarefas sem folga, em que cada dia de atraso empurra diretamente a data de fim do projeto.

Faça duplo clique numa tarefa e procure na secção **Resultado CPM** os números exatos: **Início mais cedo:**, **Fim mais cedo:**, **Início mais tarde:**, **Fim mais tarde:**, **Folga total:**, **Folga livre:** e (quando aplicável) **Folga interferente:**, além de se a tarefa está no **Caminho crítico:**. Quer estes campos como colunas na tabela de tarefas? **Visualização → Colunas…** e assinale-os.

### Folga total, livre e interferente

- **Folga total** — quanto uma tarefa pode atrasar no total sem tocar na data de fim do projeto. Zero significa crítica.
- **Folga livre** — quanto uma tarefa pode atrasar sem tocar na sua sucessora imediatamente seguinte. Pode ser menor do que a folga total: uma tarefa pode ter alguma folga total, mas se atrasar um único dia a sua sucessora imediata já se move também (essa sucessora tem então folga própria suficiente para não tocar na data de fim).
- **Folga interferente** — a diferença entre as duas (folga total − folga livre): a parte da sua folga que não toca na data de fim mas "atrapalha" uma sucessora. Zero significa que a folga livre e a folga total são iguais — atrasar dentro da sua folga não afeta então ninguém.

## Trabalho quase crítico

Uma tarefa com uma folga total pequena, não nula, é vulnerável: um pequeno contratempo torna-a crítica afinal. Ative isto através de **Info do projeto → Cálculo → Marcar quase crítico**, com um **Limiar** em dias úteis (ou horas, dependendo da sua exibição de duração). Toda a tarefa com folga total superior a zero e inferior ou igual a esse limiar recebe uma cor de barra âmbar no Gantt — entre o vermelho da crítica e o verde da folga ampla.

O grande exemplo define o limiar em 3 dias úteis. A inspeção final da **Torre C** tem, por isso, exatamente 3 dias úteis de folga total — mesmo dentro do limiar — enquanto as inspeções finais idênticas da **Torre A** e da **Torre B** estão em folga zero e são genuinamente críticas. A Torre C é idêntica às outras duas em tarefas e durações, exceto por uma tarefa de acabamento ligeiramente mais curta; essa pequena diferença é exatamente suficiente para a fazer passar de crítica a quase crítica.

## Múltiplos caminhos críticos

Normalmente há exatamente uma cadeia mais longa, mas pode acontecer que duas ou mais cadeias tenham exatamente o mesmo comprimento — então ambas (ou todas) são igualmente críticas. Ative **Múltiplos caminhos de folga** (**Info do projeto → Cálculo**) para que isto seja calculado: escolha o **Método** (**Folga livre (peeling)** ou **Folga total (classificação)**) e um **Caminhos máx.**. Cada tarefa recebe então um número de **Caminho de folga** (1 = mais crítico); uma tarefa sem caminho de folga não está em nenhum dos caminhos calculados.

No grande exemplo, a Torre A e a Torre B são totalmente simétricas em tarefas e durações — terminam exatamente ao mesmo tempo. Assim que ativa **Múltiplos caminhos de folga**, verá mais do que um caminho nos resultados (`criticalPaths.length` superior a 1 no cálculo): não uma única cadeia mais longa, mas várias cadeias igualmente críticas a decorrer pelo projeto. Esse é um sinal diferente de "um caminho crítico com algum trabalho quase crítico ao lado" — significa que um atraso em *qualquer* desses caminhos atinge a data de fim de igual forma, pelo que não pode concentrar a sua atenção numa única cadeia.

## Fixações rígidas e o seu efeito na folga

Uma **fixação rígida** (a caixa de verificação **Obrigatório (fixação de data)** numa restrição MSO ou MFO) fixa uma tarefa a uma data, mesmo que as suas predecessoras contradigam isso logicamente. O grande exemplo usa isto em "Wegafzetting gemeente (vergunde stremmingsperiode)" (corte de estrada municipal, período de corte autorizado): o município só permite o corte exatamente nessa data autorizada, ponto final — a lógica da rede dobra-se em torno disso.

O efeito a montante é a parte complicada de perceber: se as predecessoras de uma tarefa fixada precisarem de mais tempo do que o disponível até à data da fixação, surge **folga negativa** nessas predecessoras. A folga negativa não é, por isso, um erro de cálculo: é a forma como o motor lhe diz "esta cadeia anterior já não cabe no tempo que a fixação permite". Se vir folga negativa a montante de uma fixação rígida, a questão não é "o que está avariado aqui" mas sim "qual destas duas coisas tem de ceder: a data da fixação, ou a duração da cadeia antes dela".

Nota: no grande exemplo, toda a cadeia em torno de "Wegafzetting gemeente" — incluindo a própria tarefa fixada — já foi totalmente concluída há muito (início e fim reais, bem antes da data de estado). Por causa disso, verá uma pequena folga negativa residual em toda a cadeia da fase 1 aí, incluindo na própria tarefa de fixação: essa é uma característica de tarefas já concluídas combinada com uma data de estado, não o cenário "as predecessoras não cabem" descrito acima. Para ver esse cenário na sua forma pura: limpe temporariamente a data de estado (grupo do friso **Baselines e progresso**, botão **Limpar data de estado**) e recalcule — a própria tarefa de fixação fica então de novo em folga total zero, e a folga negativa só aparece quando deliberadamente torna a cadeia anterior mais longa do que o espaço disponível antes da data da fixação.

## Hammocks (Level of Effort)

Um **hammock** (a caixa de verificação **Hammock (duração derivada)** no painel de propriedades) é uma tarefa sem entrada de duração própria: o seu início e fim seguem automaticamente das suas próprias relações. As relações **FS**/**SS** de entrada fornecem o **driver de início** (o início mais cedo), as relações **FF**/**SF** de entrada fornecem o **driver de fim** (o fim mais tarde) — o painel mostra ambos como só leitura assim que assinala a caixa de hammock, para que veja exatamente quais tarefas determinam o intervalo. Sem um driver de fim, o intervalo volta a um comprimento zero, com um aviso no painel.

O que um hammock faz: mostra, como uma espécie de barra abrangente, o intervalo completo de uma parte do trabalho sem que tenha de manter uma duração você mesmo — útil para, por exemplo, "supervisão" ou "custos gerais gerais do estaleiro" que decorrem literalmente enquanto durar o trabalho subjacente. O que um hammock não faz: não carrega recursos nem lógica própria que afete o cálculo CPM — é uma vista derivada, não uma tarefa determinante. O grande exemplo usa isto para "Ruwbouw toren A (LOE)" (estrutura em bruto, Torre A): um hammock que começa assim que a primeira tarefa real de estrutura em bruto da Torre A começa e termina assim que a última estiver concluída, sem se situar em lado nenhum pelo meio.

## Ligações externas entre projetos

Projetos grandes por vezes consistem em vários subcronogramas geridos separadamente — por exemplo o seu próprio cronograma principal e um pacote de trabalhos de estaleiro gerido por outro empreiteiro. Uma **ligação externa** (a janela **Ligação externa (entre projetos)**, aberta através do botão no separador **Relações**) regista uma relação a uma tarefa noutro desses ficheiros, sem ter de abrir esse ficheiro como documento.

Escolhe um **Ficheiro de origem** dos seus ficheiros recentes (esse é lido apenas em modo de leitura, nunca aberto como documento) ou preenche **Manual** com um id de projeto, id de tarefa e data de ancoragem se não tiver o ficheiro de origem à mão. Depois escolhe a **Direção** (predecessora ou sucessora), o **Tipo de relação** (FS/SS/FF/SF) e um **Atraso**. A **Data de ancoragem** — a data da tarefa de origem no momento em que a ligou — fica congelada no seu próprio ficheiro; essa data não acompanha automaticamente se o projeto de origem mudar.

Quer saber se o ficheiro de origem foi entretanto atualizado? Vá ao separador **Relações**, secção **Ligações externas**, e clique em **Atualizar esta ligação** (por ligação) ou **Atualizar âncoras externas** (todas de uma vez) para reler o ficheiro de origem e atualizar a âncora. Se o ficheiro de origem não estiver disponível — movido, renomeado ou nunca fornecido — a ligação mostra a etiqueta **obsoleto** com a dica "origem não carregada — reimporte para atualizar": a aplicação não consegue então verificar por si se a âncora congelada ainda é válida.

O grande exemplo demonstra deliberadamente esse último caminho: a tarefa "Bestrating parkeerterrein" (pavimentação do estacionamento) está ligada a um ficheiro de origem de um subempreiteiro de trabalhos de estaleiro que deliberadamente *não* é fornecido com o exemplo. Abra a tarefa e verá a ligação listada com o estado "obsoleto" — uma demonstração honesta do que acontece quando um ficheiro de origem externo deixa de estar disponível, em vez de uma ligação que se atualiza sempre sem falhas.

## Rastrear um caminho

Quer ver exatamente quais tarefas afetam uma determinada tarefa a montante e a jusante? Clique com o botão direito na tarefa e escolha **Rastrear caminho** (ou **Parar rastreamento** para o desligar de novo) — isso destaca de uma só vez toda a cadeia de predecessoras e sucessoras. Para um trabalho mais direcionado, o friso (separador **Planeamento** ou **Relações**, grupo do friso **Rastreamento de caminho**) tem um par separado de botões **Predecessoras**/**Sucessoras**: ambos desligados não mostra nada, um ligado mostra essa direção, ambos ligados é o mesmo que o comando do menu de contexto. O rastreio também distingue entre todas as tarefas logicamente ligadas e as tarefas que estão efetivamente a **determinar** a data (a mesma relação "Determinante" mostrada na tabela de relações) — para que veja não apenas o que está ligado, mas o que está efetivamente a comandar.

## Definições de cálculo

A secção **Cálculo** em **Info do projeto** (Backstage → Info do projeto, ou a janela **Info do projeto**) reúne as opções de cálculo que pertencem a este projeto em particular — pertencem ao ficheiro, não à aplicação, pelo que um colega que abra o mesmo ficheiro obtém o mesmo resultado:

- **Definição de crítico** — **Folga total ≤ limiar** (limiar predefinido 0) ou **Caminho mais longo**, que marca as tarefas como críticas com base na cadeia mais longa na rede, independentemente do seu número de folga.
- **Cálculo da folga** — como a folga total é determinada para uma tarefa com um lado de início e de fim: **Menor (início/fim)** (predefinição), **Folga de início** ou **Folga de fim**.
- **Tarefas de extremidade aberta críticas** — trata automaticamente as tarefas sem sucessora como críticas.
- **Marcar quase crítico** com **Limiar** (veja acima).
- **Múltiplos caminhos de folga** com **Método** e **Caminhos máx.** (veja acima).
- **Calendário de atraso** — qual calendário um atraso em dias úteis usa: o da **Predecessora**, o da **Sucessora**, sempre **24 horas**, ou o **Calendário do projeto**.

## Continue a ler

- Veja múltiplos caminhos críticos, trabalho quase crítico, um hammock, uma fixação rígida e uma ligação externa, tudo num só cronograma: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- As relações, o atraso/avanço e as restrições (incluindo a fixação rígida) são explicados em maior profundidade no guia [Relações & restrições](docs://gids-relaties-constraints).
- O nivelamento pode alterar a estrutura do caminho crítico — leia o guia [Recursos, histograma & nivelamento](docs://gids-resources-histogram).
- O progresso e uma data de estado podem produzir folga negativa numa tarefa já fixada — leia o guia [Baselines & progresso](docs://gids-baselines-voortgang).
