# Criar e imprimir um relatório

Objetivo: escolha um relatório do seu planeamento, verifique-o na pré-visualização e guarde-o como PDF, para o poder distribuir ou imprimir por si.

## Quando precisa disto

Sexta-feira é a reunião de obra. O cliente quer o planeamento em papel, o responsável da obra quer saber o que começa nas próximas semanas, e o encarregado quer uma folha só com as suas próprias tarefas. Cria visões gerais como estas no separador *Relatório*. A aplicação calcula-as a partir do seu planeamento e mostra-as primeiro como pré-visualização. Depois, exporte-as para um PDF.

A aplicação não envia um relatório diretamente para uma impressora. O ponto final é sempre um PDF. Pode imprimi-lo com o seu leitor de PDF, ou enviá-lo por correio eletrónico.

## Passos

### 1. Abra o separador Relatório

Escolha *Relatório* no friso, ou prima Ctrl+P. Ctrl+P leva-o a este separador. Se estiver a escrever num campo, se houver uma caixa de diálogo aberta ou se o modo de apresentação estiver ativo, Ctrl+P não funciona. No navegador, abre-se então a janela de impressão do navegador, e essa imprime o ecrã, não o relatório.

À esquerda está a coluna *Relatório*, com a lista *Tipo de relatório*, um resumo e as definições. À direita está a pré-visualização.

### 2. Escolha o tipo de relatório

A lista *Tipo de relatório* tem onze relatórios. Escolha o que corresponde à sua pergunta.

- *Gráfico de Gantt*: o planeamento em gráfico de barras, para a versão normal a entregar.
- *Diagrama de recursos*: as mesmas barras, mas com uma secção por recurso. Para «o que faz a equipa X?», se preferir, com uma folha por equipa.
- *Visão geral de marcos*: todos os marcos com data e estado.
- *Variance*: o planeamento atual ao lado da linha de base ativa. Para «quanto atraso há?».
- *Previsão (look-ahead)*: o que decorre ou começa no período seguinte. A lista para a reunião semanal.
- *Crítico e quase crítico*: as tarefas sem folga ou com quase nenhuma folga.
- *Relatório de progresso*: a situação do projeto na data de estado, o dia em que se mede o progresso.
- *Saúde do cronograma*: uma verificação do próprio planeamento, para erros e valores invulgares.
- *Carga de recursos*: por recurso e por semana ou mês, o que é necessário face ao que está disponível.
- *Atribuições de recursos*: por recurso, as tarefas a que está atribuído.
- *Resumo WBS*: o planeamento agregado por nível WBS, para a gestão.

### 3. Certifique-se de que o planeamento está atualizado

A aplicação não calcula sozinha. Se alterou tarefas, relações ou calendários desde o último cálculo, prima **Calcular** (F5). Os relatórios em tabela avisam-no por si próprios, no topo do relatório: *O cronograma mudou desde o último cálculo — prima Calcular (F5) para valores atuais.* Ou, se nunca foi calculado: *Ainda não calculado — prima Calcular (F5) para datas e folgas.*

O friso do separador Relatório não tem botão Calcular, mas F5 funciona aqui sem problemas. *Exportar PDF* também calcula primeiro, por si só, se o planeamento estiver desatualizado, para que o PDF nunca fique atrás do seu planeamento.

### 4. Ajuste o relatório

Em *Definições* estão as opções do gráfico de Gantt e do diagrama de recursos. Previsão (look-ahead), Crítico e quase crítico, Relatório de progresso, Saúde do cronograma, Carga de recursos, Atribuições de recursos e Resumo WBS só têm *Papel:* e *Orientação:*, mais um bloco *Opções do relatório* com as opções desse relatório. A Visão geral de marcos e o Variance não têm opções próprias. Para o período de um relatório, veja [Escolher o período do relatório](docs://howto-rapportageperiode-kiezen).

- *Papel:* e *Orientação:* determinam a folha. Por padrão, é A3 paisagem, o que é prático para um planeamento de obra, mas nem todas as impressoras imprimem A3. Se tiver uma impressora A4, escolha já A4: a aplicação dispõe então as páginas para A4, em vez de as ter de reduzir depois.
- Com o Diagrama de recursos, a caixa de verificação *Cada recurso numa nova página* dá uma folha por equipa.
- *Tamanho da fonte:* (90% a 125%) torna o texto e a tabela maiores ou mais pequenos. Uma fonte maior deixa menos espaço para o cronograma.
- *Seguir a vista (filtro, agrupamento, ordenação)* só aparece para o gráfico de Gantt. Por padrão, a árvore completa de tarefas vai para o papel. Com esta caixa de verificação, o relatório desenha exatamente as linhas que vê no ecrã, incluindo as fases recolhidas, por exemplo só as tarefas críticas de um layout. Como criar essa vista, veja [Criar e utilizar um layout](docs://howto-layouts-gebruiken).
- *Mostrar sobreposição da linha de base* mostra a linha de base ativa ao lado das barras atuais. Com *Linha de status:* escolhe uma *Linha de data de estado* ou uma *Linha de progresso*.
- *Ajustar ao papel automaticamente* está ativo por padrão: o cronograma é então dimensionado à largura da página, e o número de páginas depende da altura. Se o desativar, o relatório usa um zoom fixo e também se estende pela largura, o que gera rapidamente muitas páginas. Com *Cronograma em:* distribui o cronograma por 2 a 8 páginas de largura, com o ajuste automático, para um planeamento longo que pretende imprimir num tamanho legível.

### 5. Verifique a pré-visualização

Para o gráfico de Gantt e o diagrama de recursos, vê o papel com cabeçalho da página, tabela, cronograma e legenda. Percorra as páginas para as ver. *Qualidade da pré-visualização* define apenas a nitidez da pré-visualização no seu ecrã; o PDF não muda com ela. Se abaixo das páginas aparecer *… e mais 1 página — exporte para o documento completo* (com mais páginas, *… e mais 2 páginas — exporte para o documento completo*), a pré-visualização ainda não tem todas as páginas prontas. O PDF contém todas elas.

Os outros relatórios aparecem no ecrã como tabela. O que vê é o que fica no PDF.

### 6. Exporte para PDF

Na parte inferior da coluna da esquerda, clique em **Exportar PDF**. O nome de ficheiro sugerido é o nome do projeto seguido do tipo de relatório. Para o gráfico de Gantt, por exemplo, *Extension house-planning.pdf*.

- Na aplicação para computador, e num navegador que tenha uma janela para guardar ficheiros, escolhe onde fica o PDF. Se fechar essa janela sem guardar, nada acontece.
- Num navegador sem essa janela, o navegador guarda o PDF na sua pasta de transferências.

### 7. Imprima o PDF

Abra o PDF no seu leitor de PDF e imprima-o aí. Se imprimir um PDF A3 numa impressora A4, a sua janela de impressão tem de reduzir as páginas. Por isso, defina primeiro o tamanho do papel no passo 4.

## Armadilhas e o que a aplicação faz

**O botão Imprimir e Ctrl+P não imprimem.** O botão *Imprimir* do grupo *Relatório* está no próprio separador Relatório e não faz mais nada. Ctrl+P leva-o a este separador. Não existe um comando de impressão separado na aplicação: o caminho para o papel passa pelo PDF. Se Ctrl+P não funcionar (veja o passo 1), abre-se no navegador a janela de impressão do navegador, e essa imprime o ecrã, não o relatório.

**Empresa: escrever por cima não se mantém.** O campo *Empresa:* do gráfico de Gantt começa com a empresa das definições do projeto. O que escreve por cima dele não se mantém. Aqui não pode escrever em *Autor:*. Altere ambos em *Definições › Projeto › Definições do projeto*, nos campos *Cliente/organização* e *Autor*, e confirme com *Aplicar*.

**Cores das barras: aplica-se também ao seu ecrã.** A escolha *Cores das barras:* no relatório é a mesma escolha de *Cores das barras* no separador Vista. Se a alterar no relatório, o seu gráfico de Gantt no ecrã muda também.

**O Variance sem linha de base.** Uma linha de base é uma cópia guardada do seu planeamento, com a qual mede mais tarde. Para saber como a guardar, veja [Guardar e gerir uma linha de base](docs://howto-baseline-opslaan-en-beheren). Se não tiver nenhuma linha de base ativa, em vez de uma comparação aparece *Sem linha de base ativa — guarde uma linha de base ou defina uma como ativa.*

**Linha de status sem data de estado.** Se escolher *Linha de status:* enquanto o projeto não tiver data de estado, o relatório avisa com *Defina primeiro uma data de estado* e não desenha nada. Defina a data de estado em *Planeamento › Linhas de base e progresso › Data de estado*.

**O planeamento contém um ciclo.** Se o planeamento contiver um ciclo, *Exportar PDF* não cria ficheiro e mostra o erro.

**O papel aplica-se atualmente a todos os relatórios.** Há uma única escolha para *Papel:* e *Orientação:*, partilhada por todos os relatórios. A Visão geral de marcos e o Variance não têm escolha de papel própria: usam o que definiu noutro relatório, por padrão A3 paisagem. Por isso, escolha primeiro o papel num relatório que o ofereça, por exemplo o gráfico de Gantt, e depois volte atrás.

**As escolhas aplicam-se a todos os projetos.** O papel, o tamanho da fonte, o período e as outras escolhas são guardados pela aplicação neste dispositivo, para todos os seus projetos. Não pertencem ao ficheiro do projeto.

## Ver também

- [Escolher o período do relatório](docs://howto-rapportageperiode-kiezen): uma previsão ou um relatório de progresso sobre um certo intervalo de tempo.
- [Criar e utilizar um layout](docs://howto-layouts-gebruiken): primeiro filtre ou agrupe, depois imprima com *Seguir a vista (filtro, agrupamento, ordenação)*.
- [Guardar e gerir uma linha de base](docs://howto-baseline-opslaan-en-beheren): a cópia guardada com que o Variance compara.
- [Resolver a sobrealocação](docs://howto-overbezetting-oplossen): o que fazer quando a Carga de recursos mostra semanas sobrealocadas.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): porque é uma tarefa crítica ou quase crítica.
- [Tipos de relatório](docs://ref-rapporttypes): todos os tipos de relatório e as suas opções.
