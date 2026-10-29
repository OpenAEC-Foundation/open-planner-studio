# Ferramentas de IA (planner_*)

Todas as ferramentas que um assistente de IA pode chamar através da ponte, por grupo. Para cada uma indica-se o que faz e o que recusa. Todas começam por `planner_`. Na janela *Detalhes de ligação* aparece o número atual. O assistente recebe a lista completa, com descrições, da própria ponte (`tools/list`). Porque é que a ligação funciona assim, está em [Como funciona a ligação com a IA](docs://uitleg-ai-koppeling). Como a ativar, está em [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

## Como ler esta lista

**Leitura** significa: a ferramenta não altera nada. Isto funciona também com *Pausar* e *Só leitura* ativos. Uma caixa de diálogo aberta bloqueia-a (veja *Quando uma ferramenta é recusada* abaixo). Uma ferramenta de leitura devolve sempre datas atuais. Se o planeamento estiver desatualizado, é recalculado primeiro, também com *Pausar* e *Só leitura* ativos. Estes modos bloqueiam alterações, mas não a atualização das datas na leitura. Se estiver a meio de uma edição (a arrastar uma barra, a escrever num campo), não é recalculado. O assistente recebe então as datas de antes da sua edição, com um aviso de que estão desatualizadas. Se o projeto estiver na vista *Datas como registadas*, não é recalculado. O assistente recebe então as datas registadas, com um aviso de que não foram recalculadas.

**Alteração** significa: a ferramenta altera o seu projeto. É recusada com *Pausar* ou *Só leitura* ativos, e também com uma caixa de diálogo aberta. Isto vale também para as ferramentas sem tipo indicado abaixo (`planner_undo`, `planner_redo`, as ferramentas de ficheiros e as ferramentas de documentos, exceto `planner_list_documents`). Cada alteração é um passo no seu histórico de anulação. Se os dados do projeto mudarem, o planeamento é recalculado depois, automaticamente. Não tem de carregar em *Calcular*. Antes da primeira alteração em cada documento, a aplicação cria uma cópia de segurança, se *Cópia de segurança automática* estiver ativa.

**Lote** significa: uma chamada pode conter vários itens. Um item inválido é recusado, com um motivo, e os itens válidos ficam. A resposta indica os itens recusados.

## Ler: planeamento

- `planner_get_project_info` (leitura) — dados do projeto e números-chave: o número de tarefas, relações, recursos e marcos, a data de estado, o fim e a duração do projeto, se o planeamento está desatualizado, o perfil de cálculo e um resumo dos calendários. Uma boa primeira chamada.
- `planner_get_project_overview` (leitura) — a árvore WBS completa numa só resposta: por id de tarefa, WBS, nome, duração, datas cedo, progresso, se é crítica, e as relações de saída com o respetivo id de relação.
- `planner_list_tasks` (leitura) — tarefas com filtros (críticas, estado, janela de datas, tarefas sem relações) e paginação.
- `planner_get_task` (leitura) — uma tarefa em detalhe: datas, folga, progresso, restrições, prazo, calendário, atribuições, predecessoras e sucessoras, interrupções.
- `planner_get_critical_path` (leitura) — as tarefas críticas com a respetiva folga total, e as relações que determinam o caminho.
- `planner_list_resources` (leitura) — recursos com capacidade, tarifa, calendário, equipa, disponibilidade e um resumo das respetivas atribuições. Se um recurso vier da biblioteca de recursos, indica quais campos estão fixos.
- `planner_get_resource_histogram` (leitura) — carga face à capacidade, por recurso, por dia, semana ou mês (semana por predefinição). Sem janela e sem recursos, dá um resumo por recurso. Com janela ou recursos, dá a série completa e as tarefas que deixam um recurso sobrealocado.
- `planner_get_calendars` (leitura) — todos os calendários, com a definição completa e o número de tarefas e recursos que os usam.

## Ler: linhas de base e desvios

- `planner_list_baselines` (leitura) — as linhas de base guardadas e qual delas está ativa.
- `planner_compare_baseline` (leitura) — o planeamento atual face à linha de base ativa: só as tarefas que diferem e a diferença no fim do projeto, em dias úteis no calendário do projeto. Sem linha de base ativa, recusa.
- `planner_analyze_delay` (leitura) — análise de atraso face à linha de base ativa: a diferença na entrega e as tarefas críticas que se deslocaram. Sem linha de base ativa, recusa.

## Tarefas e estrutura

- `planner_add_tasks` (alteração, lote) — cria tarefas, incluindo uma WBS aninhada numa só chamada. Cada tarefa recebe um nome temporário próprio (`tmp-…`), para que uma filha se possa referir à tarefa-pai. Sem duração, uma tarefa recebe 5 dias úteis. Um marco tem duração 0. Todas as tarefas de uma chamada são aceites em conjunto ou recusadas em conjunto.
- `planner_update_tasks` (alteração, lote) — altera campos de tarefas existentes: nome, descrição, duração com unidade (dias ou horas), tipo de duração, categoria de trabalho, marco, obrigatória, prioridade, restrição, prazo, calendário e tipo de tarefa. Também os campos de progresso: percentual de avanço, início real e fim real. Qualquer outra chave é recusada, com um motivo.
- `planner_delete_tasks` (alteração) — apaga tarefas, incluindo toda a sua subárvore, relações e atribuições. A resposta indica exatamente o que foi removido com elas.
- `planner_move_task` (alteração) — coloca uma tarefa sob outra tarefa-pai, numa posição indicada. Uma referência circular, ou colocar uma tarefa sob si mesma, é recusada.
- `planner_set_task_splits` (alteração) — define as interrupções de uma tarefa: após quantos dias úteis (ou horas úteis) de trabalho, e quantos dias úteis (ou horas úteis) de interrupção. Uma lista vazia remove todas as interrupções. Veja [Dividir uma tarefa](docs://howto-taak-splitsen).

## Relações

- `planner_add_dependencies` (alteração, lote) — cria relações com um tipo (`FS`, `SS`, `FF`, `SF` ou a forma longa) e um desfasamento, por exemplo `+2d`.
- `planner_update_dependencies` (alteração, lote) — altera o tipo, o desfasamento, a predecessora ou a sucessora de uma relação existente, pelo id da relação. Isto é um só passo, em vez de apagar e criar de novo.
- `planner_remove_dependencies` (alteração, lote) — apaga relações pelo id da relação.

## Projeto e calendários

- `planner_update_project` (alteração) — nome, descrição, autor, empresa, data de início, data de fim, data de estado, modo de progresso e o padrão do projeto para o tipo de tarefa. A data de início é a âncora para as tarefas novas. Se o assistente a definir mais tarde, só se deslocam as tarefas soltas (sem predecessora e sem restrição que defina um limite inferior, como *Não começar antes de*). A resposta indica quantas, como `anchorsClamped`. O resto do planeamento mantém-se no sítio. Veja [Novo projeto e Info do projeto](docs://ref-projectinfo). A data de estado não é uma etiqueta. É a data de referência do cálculo: num planeamento sem progresso, tudo se desloca. A data de fim é apenas metadados.
- `planner_move_project` (alteração) — desloca todo o planeamento existente para uma nova data de início. Os calendários não se deslocam. Por isso, o fim pode saltar um número de dias diferente do início. As linhas de base ficam como estão, a não ser que o assistente as mande deslocar também, de forma explícita. Veja [Deslocar um projeto](docs://howto-project-verplaatsen).
- `planner_update_calendar` (alteração, lote) — altera ou cria calendários: dias úteis, horário de trabalho, pausa, faixas de horário, feriados (gera-os para um país e uma região, ou indica-os explicitamente) e exceções de trabalho. Não pode alterar qual é o calendário do projeto.

## Recursos e unidades

- `planner_manage_resources` (alteração, lote) — cria, altera ou apaga recursos: nome, tipo (mão de obra, equipamento, material, subempreiteiro ou equipa), descrição, unidades máximas, custo por hora, unidade, calendário, equipa e disponibilidade ao longo do tempo. Recusa apagar um recurso que tenha atribuições, até o assistente confirmar explicitamente. Para um recurso da biblioteca de recursos, o nome, o tipo, a descrição, a tarifa horária e a unidade ficam fixos.
- `planner_manage_assignments` (alteração, lote) — adiciona, altera, transfere ou remove atribuições: unidades por dia útil, curva e trabalho restante. Só numa tarefa-folha, e o mesmo recurso só uma vez por tarefa. O efeito de uma alteração de unidades na duração depende do tipo de tarefa, como em [Tipos de tarefa: duração, unidades e trabalho](docs://uitleg-werkregels).
- `planner_level_resources` (alteração) — faz o nivelamento dos recursos sobrealocados. Por padrão, fica dentro da folga, para que a data de fim se mantenha. Com `constrainToFloat: false`, o fim pode deslocar-se. Com uma simulação, o assistente recebe primeiro uma pré-visualização, sem alterar nada. Ignora material. Veja [Nivelamento de recursos](docs://uitleg-nivelleren).
- `planner_clear_leveling` (alteração) — remove todos os atrasos de nivelamento.

## Gerir linhas de base

- `planner_save_baseline` (alteração) — guarda o planeamento atual como linha de base e torna-a ativa de imediato. As datas desatualizadas são recalculadas primeiro. Não pode ser usada num script.
- `planner_activate_baseline` (alteração) — torna uma linha de base ativa, ou nenhuma.
- `planner_rename_baseline` (alteração) — muda o nome de uma linha de base.
- `planner_delete_baseline` (alteração) — apaga uma linha de base. Se era a ativa, a última linha de base que restar fica ativa, ou nenhuma, se não restar nenhuma.

## Anular

- `planner_undo` e `planner_redo` — anula ou refaz um passo no documento ativo. O histórico é o mesmo que o seu. A resposta indica se algo foi realmente revertido.

## Documentos e ficheiros

- `planner_list_documents` (leitura) — todos os documentos abertos, com título, se estão ativos e alterados, o número de tarefas, o início do projeto e o fim calculado.
- `planner_new_document` — um documento novo e vazio, no seu próprio separador, sem a janela *Novo projeto*.
- `planner_duplicate_document` — copia o documento ativo para um novo separador, para uma simulação ou uma variante de concurso. A cópia fica desligada e não tem caminho de ficheiro.
- `planner_switch_document` — torna outro documento ativo. Serve também para confirmar, depois de mudar de separador, em que documento o assistente trabalha.
- `planner_import_schedule` — abre um ficheiro de planeamento do disco como documento: `.ifc`, `.xml` (Primavera P6 ou MS Project, reconhecido pelo conteúdo), `.csv`, `.xer` e `.mpp` (MS Project 2010 a 2021). Nada é combinado com o planeamento atual. Um CSV não tem calendário, por isso as datas podem deslocar-se. Só dentro da sua pasta de utilizador. Depois de importar um CSV, XML ou `.mpp`, o documento não tem destino de gravação. Só um IFC assume esse caminho.
- `planner_export_ifc` — escreve o documento ativo como ficheiro IFC, no esquema IFC do projeto (por padrão, IFC 4.3 ADD2). Só dentro da sua pasta de utilizador, e um ficheiro existente só é substituído quando for pedido explicitamente. Se o documento foi aberto num esquema que a aplicação não consegue escrever (como IFC2X3), a ferramenta recusa escrever por cima desse ficheiro. O projeto continua não guardado.

## Guia e proveniência da fonte

- `planner_get_planning_guide` (leitura) — o guia em inglês para assistentes (os princípios de [Planear bem](docs://gids-goed-plannen), com as ferramentas de cada princípio), as duas skills *goed-plannen* (montar um planeamento) e *progress-update* (atualizar o progresso), ou tudo. Escolha com `part`: `guide`, `skill` (as duas skills) ou `both`. Por padrão, `both`. Devolve, para cada skill, os sítios onde pertence e os endereços de transferência. O parâmetro `language` ainda é aceite para assistentes mais antigos, mas o texto é sempre em inglês. Não toca no planeamento.
- `planner_inspect_xer_provenance` (leitura) — inspeciona a semântica de origem retida de um ficheiro Primavera P6 aberto (`.xer`): o que o ficheiro continha, com contagens da importação e dos diagnósticos. Os campos de texto livre do ficheiro ficam invisíveis por padrão. O assistente tem de os pedir explicitamente. Os nomes dos recursos também ficam ocultos por padrão, porque um recurso do P6 é normalmente uma pessoa; os códigos dos recursos continuam visíveis. O assistente tem de lhe pedir autorização antes de pedir os nomes, porque estes seguem depois para o fornecedor de IA. Não pode ser usada num script.

## O script

- `planner_batch` — executa um script de no máximo 100 passos como uma só alteração, com um só passo de anulação, recalculando uma só vez, e com uma só cópia de segurança. Se um passo falhar de forma estrutural, o script inteiro é revertido. A resposta indica, por passo, o que foi executado, o que falhou e o que não chegou a ser executado. Os nomes temporários (`tmp-…`) de `planner_add_tasks` valem nos passos seguintes. Não são permitidos como passo: `planner_batch` em si, anular e refazer, as ferramentas de documentos e de ficheiros, `planner_save_baseline`, `planner_get_planning_guide` e `planner_inspect_xer_provenance`. Um script não é uma linguagem de programação: não tem variáveis, condições nem repetições.

## Quando uma ferramenta é recusada

O assistente recebe então uma resposta com um código de erro e uma explicação.

- `PAUSED` — *Pausar* está ativo.
- `READ_ONLY` — *Só leitura* está ativo.
- `DIALOG_OPEN` — uma caixa de diálogo está aberta. Isto conta também para a leitura, exceto para `planner_get_planning_guide`. A resposta indica o que está aberto pelo nome interno, por exemplo `showTaskDialog`.
- `DOC_DRIFT` — mudou de separador enquanto o assistente trabalhava. O assistente tem de confirmar, com `planner_switch_document`, em que documento trabalha.
- `VALIDATION` — os argumentos não correspondem ao esquema, ou a alteração pedida não é permitida. A resposta indica o campo.
- `NOT_FOUND` — um id ou um documento não existe.
- `CYCLE` — a alteração criaria um ciclo. Tudo nessa chamada é revertido.
- `SCOPE` — o caminho do ficheiro está fora da sua pasta de utilizador.
- `BACKUP_FAILED` — a cópia de segurança antes da alteração falhou. A alteração não foi executada.
- `INTERNAL` — um erro inesperado ao executar uma ferramenta, por exemplo uma operação de ficheiro que falhou. A resposta dá a mensagem de erro original.
- `STALE_PRECONDITION` — faz parte do contrato da ponte, mas nenhuma das ferramentas atuais devolve este código.

Um pedido que esteve na fila mais de 110 segundos já não é executado pela aplicação. O cliente já recebeu um erro de tempo limite. Executá-lo alteraria as coisas duas vezes, numa nova tentativa. Uma chamada que demore mais de 120 segundos recebe um erro de tempo limite da ponte.

## O que o assistente não pode definir

Por tarefa, o assistente não pode definir: o tipo hammock, tornar uma tarefa agendada manualmente, uma segunda restrição, notas, cor, códigos de atividade, campos personalizados, relações externas e um atraso de nivelamento manual. A aplicação calcula ela própria o código WBS. Ao nível do projeto, não pode alterar o perfil de cálculo nem as opções de cálculo. Definições, tema, idioma, extensões e atualizações estão fora de alcance, e também a biblioteca de recursos. Também não tem relatórios, layouts, filtros nem vista. Porque é que isto é assim, está em [Como funciona a ligação com a IA](docs://uitleg-ai-koppeling).

## O que a aplicação guarda

- **O token** está neste computador, nas definições guardadas da aplicação. Tem 64 caracteres e é aleatório. *Novo token* substitui-o.
- **A porta** é 3877 por predefinição e só pode ser alterada com a ponte parada.
- **O painel de atividade** guarda as últimas 500 chamadas, só enquanto a aplicação estiver aberta. Os argumentos e as respostas são cortados após 20 kB por campo. *Limpar* esvazia a lista.
- **As cópias de segurança** estão na pasta `ai-backups` na pasta de dados da aplicação. *Abrir pasta de cópias de segurança* leva-o até lá. Têm o nome `<project name>-<timestamp>.ifc`. Um ficheiro de projeto guardado tem uma só pasta em todas as sessões. Um documento que nunca guardou tem uma pasta própria por sessão. Cada vez que inicia a ponte, é criada uma cópia de segurança por documento, além das que criar manualmente com *Criar cópia de segurança agora*.
- **A redução** faz-se sozinha, por pasta. Dos últimos 7 dias ficam todas as cópias, até 20. As cópias da sessão em curso ficam sempre. Depois disso, fica uma por semana até 30 dias, uma por mês até um ano, e depois uma por ano. As cópias de um documento que nunca guardou desaparecem por completo ao fim de um ano. Os ficheiros da pasta que não são da aplicação não são tocados.

## Ver também

- [Como funciona a ligação com a IA](docs://uitleg-ai-koppeling): porque é que a ponte está configurada assim, e o que o assistente pode e não pode fazer.
- [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen): inicie a ponte, ligue o assistente e instale a skill.
- [Definições](docs://ref-instellingen): os dois interruptores de IA.
- [Notificações e avisos](docs://ref-meldingen): o ponto de IA na barra de estado.
