# Tipos de relatório

Cada relatório do separador *Relatório*, com as opções que lhe pertencem: o que fazem, o valor inicial, o que muda no relatório e onde as encontra. Como criar um relatório e o guardar como PDF está em [Como criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken).

## Como funciona a janela do relatório

Abra o separador *Relatório* (ou prima Ctrl+P). À esquerda está a coluna *Relatório* com a lista pendente *Tipo de relatório*, o bloco *Resumo* com as contagens, o bloco *Definições* ou *Opções do relatório* e, em baixo, o botão *Exportar PDF*. À direita está a pré-visualização. O que vê na pré-visualização vai para o PDF.

**Tipo de relatório** — o relatório que vê. Escolha entre onze relatórios. Padrão: *Gráfico de Gantt*. Onde: *Relatório*, no topo da coluna *Relatório*.

**Exportar PDF** — cria o PDF. Efeito: o resultado é só um PDF; a aplicação não envia nada para uma impressora. Se o planeamento deixar de estar atualizado, a aplicação calcula primeiro. Se o cálculo der um erro, por exemplo por causa de um ciclo nas relações, o botão não cria ficheiro e mostra o erro. Onde: *Relatório*, na parte inferior da coluna *Relatório*.

**Guardado.** A aplicação guarda todas as opções do relatório neste dispositivo, para todos os seus projetos. Não pertencem ao ficheiro do projeto. Só o campo *Empresa*: do Gráfico de Gantt não é guardado.

**Planeamento atual.** Os relatórios usam o último cálculo. Se o planeamento tiver mudado desde então, os relatórios de tabela mostram no topo *O cronograma mudou desde o último cálculo — prima Calcular (F5) para valores atuais.* Se nunca se tiver calculado nada, aparece *Ainda não calculado — prima Calcular (F5) para datas e folgas.* Se o projeto estiver na vista *Datas registadas*, os relatórios mostram as datas do ficheiro de origem e uma faixa indica isso.

**Abreviaturas.** *du* são dias úteis. *TF* é folga total, *FF* é folga livre.

## Papel e orientação

**Papel:** — o tamanho do papel do PDF. Escolha entre A4, A3, A2 e A1. Padrão: A3. Efeito: as páginas são organizadas para esse tamanho. Há uma só escolha para todos os relatórios: o que escolher para um relatório vale também para os outros. Em A4 retrato, uma tabela larga fica pequena, porque a tabela é ajustada à largura da página. Onde: *Definições* (Gráfico de Gantt e Diagrama de recursos) ou *Opções do relatório* (os sete relatórios de tabela). A Visão geral dos marcos e o Desvio não mostram escolhas.

**Orientação:** — paisagem ou retrato. Escolha entre *Paisagem* e *Retrato*. Padrão: *Paisagem*. Efeito: igual ao de *Papel*. Onde: no mesmo local que *Papel*.

## Gráfico de Gantt

O planeamento em forma de gráfico de barras, com uma tabela à esquerda e uma linha de tempo à direita, em várias páginas se for necessário. A pré-visualização mostra o papel com cabeçalho da página, tabela, linha de tempo e legenda. O bloco *Resumo* conta *Tarefas:*, *Tarefas folha:*, *Crítica:* e *Relações:*. Todas as opções estão em *Definições*.

**Empresa:** — a empresa no cabeçalho da página. Padrão: a empresa das definições do projeto. Efeito: só o cabeçalho do relatório; o que escrever aqui não é guardado. Altere a empresa em *Definições › Projeto › Definições do projeto*, no campo *Cliente/organização*, e confirme com *Aplicar*.

**Autor:** — o autor no cabeçalho da página. Só leitura: a aplicação obtém-no das definições do projeto.

**Tamanho da letra:** — tamanho do texto e da tabela no relatório. Escolha entre 90%, 100%, 110% e 125%. Padrão: 100%. Efeito: com uma letra maior, o texto, as linhas e a tabela crescem e a linha de tempo perde largura. Independente de *Tamanho do texto* nas definições.

**Cores das barras:** — do que depende a cor de uma barra. Escolha entre *Caminho crítico*, *Por tarefa — automático* e *Por categoria*, com a lista pendente *Campo de categoria* para *Por categoria*. Padrão: *Caminho crítico*. Efeito: é a mesma escolha que *Cores das barras* no separador *Visualização*: se a mudar aqui, o Gantt no ecrã muda com ela. Se o campo escolhido não existir neste projeto, aparece *Este campo não existe neste projeto. A categoria de trabalho é usada temporariamente.*

**Linha de estado:** — uma linha na data de estado. Escolha entre *Nenhuma*, *Linha de data de estado* e *Linha de progresso*. Padrão: *Nenhuma*. Efeito: *Linha de data de estado* desenha uma linha na data de estado; *Linha de progresso* desenha a linha em ziguezague que mostra o progresso de cada tarefa. Se o projeto não tiver data de estado, aparece *Defina primeiro uma data de estado* e o relatório não desenha nada.

**Seguir a vista (filtro, agrupamento, ordenação)** — só para o Gráfico de Gantt. Padrão: desligado. Efeito: desligado põe toda a árvore de tarefas no papel. Ligado desenha exatamente as linhas do ecrã: com o seu filtro, agrupamento, ordenação e fases recolhidas.

**Ajustar ao papel automaticamente** — ajusta a linha de tempo à largura da página. Padrão: ligado. Efeito: ligado ajusta a linha de tempo à largura da página; o número de páginas depende da altura. Desligado usa uma escala fixa (*Zoom:*) e também se estende por várias páginas na largura, o que depressa dá muitas páginas.

**Zoom:** — a escala fixa da linha de tempo. Só visível quando *Ajustar ao papel automaticamente* está desligado. Controlo deslizante de 1 a 40. Padrão: 22. Efeito: um valor maior alarga a linha de tempo, por isso ficam mais páginas na largura.

**Linha de tempo em:** — distribui a linha de tempo por mais larguras de página. Escolha de 1 a 8 páginas. Padrão: 1 página. Efeito: só com *Ajustar ao papel automaticamente*; caso contrário, a escolha fica desativada e aparece *Apenas com ajuste automático*. Útil para um planeamento longo que quer imprimir em tamanho legível.

**Repetir cabeçalho em cada página** — Padrão: ligado. Efeito: ligado põe o cabeçalho da página em todas as páginas; desligado só na primeira.

**Repetir rodapé em cada página** — Padrão: ligado. Efeito: ligado põe o rodapé (nome do projeto, data de impressão e legenda) em todas as páginas; desligado só na última. Um folheto sem legenda não se lê, por isso fica ligado.

**Nomes das tarefas nas barras** — Padrão: ligado. Efeito: o nome da tarefa na barra, onde houver espaço.

**Mostrar conclusão** — Padrão: ligado. Efeito: a parte concluída da barra fica cinzenta, como no Gantt, e aparece a coluna *Concl* na tabela. Uma tarefa concluída não recebe faixa de folga.

**Truncar nomes de tarefas** — Padrão: ligado. Efeito: ligado corta os nomes na tabela à largura de *Coluna de nome:*. Desligado deixa a coluna crescer com o nome mais longo; aparece então *A coluna de nome adapta-se ao nome de tarefa mais longo*.

**Coluna de nome:** — a largura da coluna de nome. Só visível quando *Truncar nomes de tarefas* está ligado. Controlo deslizante de 60 a 400. Padrão: 130.

**Mostrar sobreposição da linha de base** — a linha de base ativa ao lado das barras. Padrão: desligado. Efeito: uma barra fina na cor da linha de base, por baixo da barra da tarefa, só para as tarefas que estão na linha de base.

**Caminho crítico** — Padrão: ligado. Efeito: controla só as linhas vermelhas de relação entre duas tarefas críticas e a linha da legenda. As próprias barras seguem *Cores das barras:*, independentemente desta caixa de verificação.

**Mostrar folga** — Padrão: ligado. Efeito: a folga como uma faixa atrás das barras não críticas.

**Dependências** — as linhas de relação. Padrão: ligado. Efeito: desenha setas entre as barras.

**Mostrar apenas dias úteis** — comprime o eixo da linha de tempo neste relatório. Padrão: desligado. Efeito: fins de semana e feriados são saltados, e faixas de semana substituem então a sombra do fim de semana. Independente da mesma definição para o Gráfico de Gantt no ecrã.

**Fins de semana** — Padrão: ligado. Efeito: sombreia os fins de semana e os feriados na linha de tempo, desde que a escala permita distinguir os dias. No eixo comprimido (*Mostrar apenas dias úteis*) esta caixa de verificação não tem efeito.

**Legenda** — Padrão: ligado. Efeito: a legenda no rodapé.

**Qualidade da pré-visualização** — a nitidez da pré-visualização. Escolha entre *Padrão*, *Alta* e *Máxima*. Padrão: *Alta*. Efeito: só a nitidez da pré-visualização no ecrã; o PDF não muda. Onde: *Relatório*, acima da pré-visualização.

## Diagrama de recursos

As mesmas barras do Gráfico de Gantt, agrupadas por recurso: quem faz o quê e quando. O bloco *Resumo* conta *Recursos:*, *Atribuições:* e *Sem recurso:* (com um período também *Fora do período:*). O diagrama partilha todas as opções do Gráfico de Gantt, exceto *Seguir a vista (filtro, agrupamento, ordenação)*, *Caminho crítico* e *Dependências*: as linhas não vêm do ecrã, uma tarefa pode aparecer sob vários recursos, e as relações não são desenhadas aí. A caixa de verificação *Caminho crítico* está oculta e ligada. Estas opções vêm com as do Gráfico de Gantt em *Definições*, com estas quatro caixas de verificação e o período:

**Cada recurso numa nova página** — Padrão: desligado. Efeito: cada recurso começa numa nova página, para poder entregar uma folha por equipa ou colaborador. Desligado dá um documento contínuo.

**Incluir tarefas sem recurso** — Padrão: desligado. Efeito: as tarefas sem recurso aparecem como a última faixa do diagrama, para ver o que ainda ninguém tem.

**Agrupar por tipo de recurso** — Padrão: desligado. Efeito: uma camada por cima: primeiro uma faixa por tipo de recurso (mão de obra, equipa, subempreiteiro, equipamento, material), dentro dela por recurso.

**Mostrar unidades/dia e curva** — Padrão: ligado. Efeito: duas colunas depois do nome da tarefa, com as unidades por dia e a curva de distribuição do recurso dessa faixa. Se houver pouco espaço para a linha de tempo, o relatório deixa as colunas de fora e mostra *As colunas Unidades/d e Curva ficaram de fora: …*. Mais espaço obtém-se com um tamanho de papel maior ou em paisagem, um tamanho de letra menor ou uma tabela mais estreita.

**Período do relatório:** — só as tarefas que tocam o período. Padrão: *Projeto inteiro*. Efeito: o eixo do tempo corre exatamente sobre o período. Se não houver nada no período, aparece *Nenhuma tarefa no período do relatório — escolha outro período ou Projeto inteiro.* Veja *Período do relatório* abaixo.

## Visão geral dos marcos

Todos os marcos do projeto numa tabela. Não tem opções próprias. O bloco *Resumo* conta *Marcos*, *Obrigatórios* e *Atrasados*. As colunas são *WBS*, *Nome*, *Tipo* (*Automático*, *Início* ou *Fim*), *Data*, *Restrição/prazo*, *Folga*, *Obrigatório* e *Estado*. O estado é *Atrasado* se a restrição for violada, o prazo for ultrapassado ou a folga total for negativa; caso contrário *Crítico* se o marco for crítico segundo a definição de crítico do projeto; caso contrário *No prazo*. Sem marcos aparece *Sem marcos neste projeto.* O PDF usa o papel e a orientação que escolheu por último para outro relatório.

## Desvio

O planeamento atual ao lado da linha de base ativa, para tarefas folha. Não tem opções próprias. O bloco *Resumo* conta *Tarefas*, *Mais tarde* e *Mais cedo* e mostra *Fim do projeto: +3 dias úteis* (a diferença em dias úteis entre o fim da linha de base e o fim atual). As colunas são *WBS*, *Nome*, *Início da linha de base*, *Fim da linha de base*, *Início atual*, *Fim atual*, *Δ início (du)*, *Δ fim (du)* e *Estado*. O estado segue o fim: *Mais tarde* se o fim for posterior ao da linha de base, *Mais cedo* se for anterior, caso contrário *No prazo*. *Nova* é uma tarefa que não está na linha de base; *Eliminada* é uma tarefa que está na linha de base mas já não está no planeamento. Sem linha de base ativa aparece *Sem linha de base ativa — guarde uma linha de base ou defina uma como ativa.* O PDF usa o papel e a orientação que escolheu por último para outro relatório.

## Previsão a curto prazo

O que está em curso ou começa no período: a lista para a reunião semanal. Opções em *Opções do relatório*.

**Período do relatório:** — a janela do relatório. Padrão: *Próximo mês*. Efeito: o relatório contém as tarefas não concluídas que tocam o período, mesmo que atravessem todo o período, e as tarefas atrasadas de antes do dia de referência, desde que o fim do período não seja anterior ao dia de referência.

**Quase crítico ≤ (du):** — o limiar para *Quase crítico*. Número de 0 a 60. Padrão: 5. Efeito: uma tarefa com mais de 0 e no máximo esse número de dias úteis de folga total conta como quase crítica. Com 0 só conta o que a opção de cálculo do projeto *Marcar quase crítico* marca.

O bloco *Resumo* conta *Atividades*, *Atrasadas*, *Em andamento*, *Devia ter começado*, *Começa*, *Crítica* e *Quase crítico*. O estado por linha, sempre em relação ao dia de referência: *Atrasada* (não concluída e o fim é antes do dia de referência), *Devia ter começado* (não iniciada, enquanto o início era antes do dia de referência), *Em andamento*, *Começa* (ainda não iniciada, começa na janela). As colunas são *WBS*, *Nome*, *Início*, *Fim*, *Rest. (du)*, *Concl*, *FT (du)*, *Crítica*, *Recursos* e *Estado*. *TF* é a folga total.

## Crítico e quase crítico

As tarefas que determinam o fim do projeto e as que estão quase lá. Opção em *Opções do relatório*.

**Quase crítico ≤ (du):** — Padrão: 5. Número de 0 a 60. Efeito e significado como na Previsão a curto prazo. O subtítulo indica o limiar escolhido.

O relatório contém as tarefas não concluídas que são críticas (segundo o motor de cálculo e a definição de crítico do projeto) ou quase críticas, ordenadas por caminho de folga, depois por folga total e depois por início. O bloco *Resumo* conta *Crítica*, *Quase crítico*, *Cadeias críticas* e *Tarefas folha*. As colunas são *WBS*, *Nome*, *Início*, *Fim*, *Rest. (du)*, *FT (du)*, *FL (du)*, *Caminho* e *Estado*. *TF* é a folga total e *FF* a folga livre. A coluna *Caminho* mostra o caminho de folga se a opção de cálculo *Múltiplos caminhos de folga* estiver ligada; caso contrário, um traço.

## Relatório de progresso

Em que ponto está o projeto na data de estado. Opções em *Opções do relatório*.

**Período do relatório:** — Padrão: *Último mês*. Efeito: *Concluídas no período anterior* conta dentro do período. *Começam no próximo período* olha em frente a partir da data de estado, até *Previsão até*; com um período *Último* vai tão longe em frente como o período olha para trás.

**Quase crítico ≤ (du):** — Padrão: 5. Como na *Previsão até*.

O bloco *Resumo* mostra *Data de estado*, *Período*, *Previsão até*, *Fim da linha de base*, *Fim previsto*, *Δ fim (du)*, *Planeado* (com *(linha de base)* ou *(cronograma atual)*), *Real*, e as contagens *Concluída*, *Em andamento*, *Não iniciada*, *Atrasada* e *Crítica*. Planeado e real são ponderados pela duração das tarefas. Planeado mede em relação à linha de base se houver uma linha de base ativa; caso contrário, em relação ao planeamento atual. As secções são *Concluídas no período anterior*, *Em andamento*, *Começam no próximo período*, *Atrasadas* e *Atividades críticas em aberto*; uma tarefa pode estar em mais do que uma secção. Todas as secções têm as mesmas colunas: *WBS*, *Nome*, *Fim da linha de base*, *Fim previsto*, *Concl*, *Rest. (du)*, *FT (du)* (TF), *Crítica* e *Estado*. O estado por linha é *Concluída*, *Em andamento*, *Não iniciada*, *Devia ter começado* ou *Devia ter terminado*.

## Saúde do planeamento

Uma verificação do próprio planeamento quanto a erros e valores invulgares, com a avaliação DCMA de 14 pontos no topo. Opções em *Opções do relatório*.

**Folga alta > (du):** — Número de 1 a 365. Padrão: 44. Efeito: uma tarefa não concluída com mais folga total do que este valor fica em *Folga alta*.

**Duração longa > (du):** — Número de 1 a 365. Padrão: 44. Efeito: uma tarefa não concluída, que não seja um marco, com uma duração mais longa fica em *Duração longa*.

**Desfasamento > (du):** — Número de 0 a 365. Padrão: 10. Efeito: uma relação com mais desfasamento fica em *Atraso longo*. Um desfasamento negativo (avanço) é sempre indicado.

**Quase crítico ≤ (du):** — Número de 0 a 60. Padrão: 5. Efeito: define a verificação *Quase crítico*.

A secção *Avaliação DCMA de 14 pontos* vem em primeiro lugar. Segue as catorze verificações da US Defense Contract Management Agency, com as fórmulas e os limiares do seu *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, outubro de 2012). Por ponto vê *Quantidade*, *De* (o total sobre o qual se contou), *Valor*, *Limite*, *Resultado* e *Detalhe*. O resultado é *Cumpre*, *Sinalizado* ou *n/a*; para n/a, o motivo está no detalhe. Uma sinalização não é uma falha: o folheto indica que é um motivo para investigar mais. Os limiares em *Opções do relatório* não se aplicam a esta secção; usa sempre os limiares do folheto.

Conta as tarefas folha não concluídas, sem marcos nem hammocks, e as relações que chegam a essas tarefas. A nota acima do relatório indica os dois números. Os catorze pontos:

- *Lógica*: tarefas sem predecessora nem sucessora. Limite: no máximo 5%.
- *Avanços*: relações com um desfasamento negativo. Limite: nenhum.
- *Desfasamentos*: relações com um desfasamento positivo, por curto que seja. Limite: no máximo 5%.
- *Tipos de relação*: a proporção de relações FS. Limite: pelo menos 90%.
- *Restrições rígidas*: tarefas com uma restrição obrigatória ou uma MSO, MFO, SNLT ou FNLT. Limite: no máximo 5%.
- *Folga alta*: tarefas com mais de 44 dias úteis de folga total. Limite: no máximo 5%. Requer um cálculo.
- *Folga negativa*: tarefas com uma folga total abaixo de 0. Limite: nenhum. Requer um cálculo.
- *Duração elevada*: tarefas com mais de 44 dias úteis. Conta a duração da linha de base se a tarefa estiver na linha de base ativa; caso contrário, a duração atual. Limite: no máximo 5%.
- *Datas inválidas*: um início real ou um fim real posterior à data de estado, ou um início previsto ou um fim previsto anterior à data de estado. Limite: nenhum. Requer uma data de estado.
- *Recursos*: tarefas sem recurso. Limite: nenhum. Só se o projeto usar recursos; caso contrário, n/a.
- *Tarefas falhadas*: das tarefas que a linha de base indica que deveriam estar concluídas até à data de estado, a proporção que termina mais tarde ou que tem uma previsão posterior. Limite: no máximo 5%. Requer uma data de estado e uma linha de base ativa.
- *Teste do caminho crítico*: a aplicação prolonga uma tarefa crítica em 100 dias úteis e recalcula, numa cópia, sem alterar o projeto. O teste é aprovado se a última tarefa do projeto então não terminar antes dessa tarefa. Testa a tarefa crítica e não concluída com o menor início antecipado; o detalhe indica a tarefa e quantos dias úteis o fim se deslocou. Na vista *Datas como registadas* este teste é n/a (*não calculado*): o teste calcula, e o relatório mostra então as datas do ficheiro de origem. Carregue em Calcular (F5) e o teste volta a ser executado.
- *CPLI*: (comprimento do caminho crítico + folga) / comprimento do caminho crítico. O comprimento conta os dias úteis desde a data de estado até ao fim da última tarefa; a folga é a diferença face ao fim da linha de base dessa tarefa, ou a folga calculada se a tarefa não estiver na linha de base. Limite: pelo menos 0,95. Requer uma data de estado.
- *BEI*: o número de tarefas concluídas na data de estado, dividido pelo número que a linha de base indica que deveriam estar concluídas até essa data, mais as tarefas sem linha de base. Limite: pelo menos 0,95. Requer uma data de estado e uma linha de base ativa.

Dois pontos diferem do folheto porque a aplicação não tem esse conceito: *Duração elevada* conta todas as tarefas não concluídas, enquanto o folheto a limita ao período de planeamento detalhado (rolling wave), e *Recursos* olha apenas para os recursos atribuídos, não para os custos. O folheto não indica nenhum número para o teste do caminho crítico; os 100 dias úteis são uma escolha da aplicação.

As verificações estão nesta ordem, com a respetiva gravidade. Erro: *Folga negativa*, *Prazo falhado*, *Restrição violada* e *Progresso incoerente* (início real ou fim real posterior à data de estado, início previsto ou fim previsto anterior à data de estado, 100% sem um fim real, fim real mas não 100%, progresso sem um início real). Aviso: *Sem predecessora (início aberto)* e *Sem sucessora (fim aberto)* (não marcos), *Duração longa*, *Avanço (atraso negativo)*, *Restrição rígida* (uma restrição obrigatória ou uma MSO, MFO, SNLT ou FNLT), *Progresso fora de sequência* e *Tarefa falhada (face à linha de base)*. Informação: *Quase crítico*, *Folga alta*, *Atraso longo*, *Relação diferente de FS* e *Sem recurso* (só se o projeto usar recursos). O relatório analisa apenas tarefas folha que não são hammocks. O bloco *Resumo* conta *Sinalizações DCMA*, *Erros*, *Avisos*, *Informação*, *Tarefas folha* e *Relações*; abaixo da secção DCMA estão uma secção *Visão geral* (por verificação, a gravidade e a quantidade) e uma secção *Constatações* (cada tarefa ou relação). Sem um cálculo, faltam as verificações que requerem folga.

## Carga de recursos

Por recurso, por semana ou mês, o que é necessário face ao que está disponível. Opções em *Opções do relatório*.

**Período do relatório:** — Padrão: *Projeto inteiro*. Efeito: cada semana ou mês que toca o período é incluído por completo. Assim, uma linha mostra o mesmo número que o histograma.

**Agregação:** — Escolha entre *Semanal* e *Mensal*. Padrão: *Semanal*. Efeito: uma linha por semana civil (coluna *Semana de*, com a segunda-feira) ou por mês civil (coluna *Mês*).

**Apenas períodos sobrealocados** — Padrão: desativado. Efeito: ativado mostra apenas as semanas ou os meses com pelo menos um dia sobrealocado.

As colunas são *Recurso*, *Tipo*, *Semana de* ou *Mês*, *Necessário*, *Disponível*, *Variance* (disponível menos necessário; negativo é uma falta), *Pico/dia* e *Sobrealocado*. *Necessário* é a soma das unidades-dia. Só entram semanas ou meses com procura. O bloco *Resumo* conta *Recursos*, *Semanas* ou *Meses*, *Semanas sobrecarregadas* ou *Meses sobrealocados* e *Recursos sobrealocados*.

## Atribuições de recursos

Por recurso, as tarefas a que está associado: o que faz esta equipa ou esta grua? Opções em *Opções do relatório*.

**Período do relatório:** — Padrão: *Projeto inteiro*. Efeito: com um período, só são incluídas as atribuições de tarefas que tocam o período, mais o trabalho em atraso de antes do dia de referência. *Projeto inteiro* não filtra por data.

**Incluir tarefas concluídas** — Padrão: desativado. Efeito: ativado inclui também as atribuições de tarefas concluídas.

As linhas são por recurso e, dentro de um recurso, por início. O bloco *Resumo* conta *Recursos*, *Atribuições* e *Tarefas sem recurso*. As colunas são *Recurso*, *Tipo*, *WBS*, *Nome*, *Início*, *Fim*, *Rest. (du)*, *Unid./dia*, *Concl*, *Crítica* e *Estado*. *Recurso* e *Tipo* aparecem só na primeira linha de um recurso. O estado de cada linha é igual ao do relatório de progresso: *Concluída*, *Em andamento*, *Não iniciada*, *Devia ter começado* ou *Devia ter terminado*.

## Resumo WBS

O planeamento agregado por elemento WBS: a visão geral de gestão. Opções em *Opções do relatório*.

**Nível:** — até que nível a WBS é mostrada. Escolha entre *WBS completa* e os níveis 1 a 8. Padrão: nível 2. Efeito: o subtítulo indica *Até ao nível 2*.

**Mostrar tarefas** — Padrão: desativado. Efeito: ativado mostra também as próprias tarefas folha em cada elemento.

As colunas incluem *WBS*, *Nome*, *Início*, *Fim*, *Início da linha de base*, *Fim da linha de base*, *Duração (du)*, *Concl*, *Δ fim (du)*, *FT mín*, *Ativ* (número de tarefas), *Crít*, *Ativo* e *Concluído*. O início e o fim de uma tarefa de resumo vêm do último cálculo. O progresso é ponderado pela duração das tarefas folha. *FT mín* (TF) e as contagens referem-se às tarefas folha abaixo. O bloco *Resumo* conta *Elementos WBS* e *Atividades*.

## Período do relatório

Quatro relatórios de tabela e o diagrama de recursos usam um *Período do relatório:*: *Previsão (look-ahead)*, *Relatório de progresso*, *Carga de recursos*, *Atribuições de recursos* e *Diagrama de recursos*. Cada relatório memoriza o seu próprio período. Abaixo da lista pendente estão *A partir de* e *Até*, com as datas que a escolha produz.

**Dia de referência.** Um período com *Seguinte* ou *Último* conta a partir da data de estado do projeto, ou a partir de hoje se não houver data de estado. Então os relatórios de tabela indicam *Sem data de estado — o relatório usa hoje (…).* Se alterar a data de estado, a janela desloca-se com ela. Os dois dias contam.

**Próxima semana, Próximas 2 semanas, Próximas 4 semanas, Próximas 6 semanas, Próximas 8 semanas, Próximas 12 semanas** — a partir do dia de referência, com 7 dias por semana. Com data de estado quinta-feira, 20 de maio, a *Próxima semana* vai de 20 a 26 de maio e as *Próximas 4 semanas* de 20 de maio a 16 de junho.

**Última semana, Últimas 2 semanas, Últimas 4 semanas, Últimas 6 semanas, Últimas 8 semanas, Últimas 12 semanas** — as mesmas seis, mas contadas para trás: com 7 dias por semana, até ao dia de referência. *Últimas 2 semanas* vai de 7 a 20 de maio, com 20 de maio como dia de referência.

**Próximo mês, Último mês** — um mês civil para a frente ou para trás, até um dia antes da mesma data no outro mês. *Próximo mês* vai de 20 de maio até 19 de junho; *Último mês* vai de 21 de abril a 20 de maio.

**Projeto inteiro** — do primeiro início ao último fim do planeamento.

**Personalizado** — um período à sua escolha. Efeito: *A partir de* e *Até* passam a ser dois campos de data. Começam com as datas da escolha que acabou de fazer. A data de fim não pode ser anterior à data de início (*A data de fim é anterior à data de início.*) e os dois campos têm de estar preenchidos (*Preencha ambas as datas.*). Se a introdução não estiver correta, o relatório mantém o último período válido.

## Ver também

- [Criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken): o percurso completo, desde o tipo de relatório até ao PDF.
- [Escolher o período do relatório](docs://howto-rapportageperiode-kiezen): passos e exemplos.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que significam crítico e quase crítico.
- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): a data de estado e a linha de base com que os relatórios trabalham.
- [Resolver a sobrealocação](docs://howto-overbezetting-oplossen): o que fazer com as semanas sobrecarregadas de Carga de recursos.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): o PDF ao lado dos outros formatos.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): duas linhas de base com progresso e uma data de estado, para ver o relatório de variance.
