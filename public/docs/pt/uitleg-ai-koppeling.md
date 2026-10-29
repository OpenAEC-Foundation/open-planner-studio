# Como funciona a ligação de IA

O que acontece de facto quando um assistente de IA trabalha no seu planeamento? Neste artigo lê-se o que é a ligação, em que se distingue da troca de um ficheiro, que limites a aplicação se impõe a si própria e como o assistente descobre como um planeamento deve ser construído. O exemplo no fim mostra com números o que um assistente consegue fazer de uma vez e o que o utilizador recebe de volta.

## O conceito

Um assistente de IA, como um programa de chat ou um assistente de programação, pode operar outro programa através do **Model Context Protocol** (MCP). O Open Planner Studio faz de servidor nessa troca. A aplicação para computador executa um pequeno servidor no seu próprio computador, a **ponte**. O assistente liga-se a ele e recebe uma lista de **ferramentas**: instrumentos com um nome que começa por `planner_`, como ler tarefas, adicionar uma relação ou guardar uma linha de base. O que existe está descrito em [Ferramentas de IA](docs://ref-ai-tools).

O aspeto notável é que o assistente trabalha no projeto que tem aberto nesse momento, não numa cópia. Não se exporta nada, não se importa nada, e não existe nenhum momento em que o utilizador e o assistente vejam duas versões diferentes. Uma tarefa que o assistente acrescenta aparece logo no Gantt. A aplicação não é ingénua quanto a isto: o assistente trabalha com o mesmo cálculo, o mesmo histórico de desfazer e as mesmas regras que o utilizador.

Como ativar a ligação está em [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen). Mais abaixo lê-se como funciona.

## Como a aplicação trata isto

### Um servidor que só o seu próprio computador ouve

A ponte só escuta no seu próprio computador (`127.0.0.1`), numa só porta, a 3877 por predefinição. Só aceita pedidos no endereço `/mcp`, e só com o seu **token** no cabeçalho `Authorization: Bearer`. Recusa um pedido sem o token certo. Um pedido que vem de um navegador, reconhecido pelo cabeçalho `Origin`, também é recusado, para que uma página web que tenha aberta não consiga falar com o seu planeamento. Trata os pedidos estritamente um de cada vez.

A ligação é HTTP simples no seu próprio computador; a própria aplicação não envia nada para fora. O que um assistente faz com o planeamento que lê, por exemplo o que o respetivo fornecedor faz com ele, depende do assistente e fica fora da aplicação.

### O assistente trabalha num só documento

Na sua primeira alteração, a ponte liga a ligação ao documento que está ativo nesse momento. Se mudar de separador por iniciativa própria, a aplicação recusa a alteração seguinte do assistente (código `DOC_DRIFT`), até que ele confirme com `planner_switch_document` em que documento quer trabalhar. Assim nada acaba no projeto errado. Um assistente que abre ou duplica um documento por si próprio trabalha depois nesse novo documento.

### Cada alteração recalcula

Na aplicação planeia-se à mão: altera-se algo e depois carrega-se em *Calcular* (F5), a não ser que *Calcular automaticamente* esteja ativo. Isso não se aplica a uma alteração do assistente. Cada ação de escrita do assistente passa por uma só transação. Se os dados do projeto mudarem nela, a aplicação recalcula no fim por si, uma vez por script. Uma ferramenta de leitura dá sempre datas atuais: se o planeamento estiver desatualizado, por exemplo porque o utilizador alterou algo e ainda não carregou em *Calcular*, a ferramenta de leitura recalcula primeiro. Há uma exceção: se o projeto estiver na vista *Datas como registadas* (depois de uma importação), uma ferramenta de leitura não recalcula em silêncio, porque isso substituiria essas datas. O assistente recebe então as datas registadas, com um aviso de que não foram recalculadas. Uma alteração do próprio assistente recalcula sempre, mesmo nesse caso. Não é preciso carregar em *Calcular* depois de uma alteração do assistente. Depois, o assistente lê o resultado, como o fim do projeto e o caminho crítico, com as ferramentas de leitura. Veja também [Datas como registadas](docs://uitleg-datums-zoals-opgeslagen).

### Um script é um só passo

Um assistente pode enviar uma série de passos como um todo com `planner_batch`, um script de no máximo 100 passos. Isso dá um só passo de desfazer, um só recálculo e uma só cópia de segurança. Se um passo falhar de forma estrutural, por exemplo uma ferramenta desconhecida ou uma referência circular, a aplicação anula o script inteiro. Nunca se fica com um planeamento a meio. A recusa de um item dentro de um passo de massa, como uma entrada de progresso inválida em vinte, é mais leve: esse item fica de fora e o resto é executado. As recusas aparecem no topo da resposta.

### Os seus limites

Quatro coisas definem-se no separador *IA*:

- *Pausar* e *Só leitura* deixam o assistente ligado, mas recusam todas as alterações. A leitura continua possível, incluindo o recálculo de um planeamento desatualizado durante a leitura: são campos calculados, não dados do projeto, por isso não se acrescenta nenhum passo de desfazer e o projeto não conta como alterado. Se estiver a meio de uma edição, por exemplo a arrastar uma barra ou a escrever num campo, uma ferramenta de leitura não recalcula: o assistente recebe então as datas de antes da sua edição, com um aviso de que estão desatualizadas.
- Uma caixa de diálogo aberta bloqueia tudo. Com uma caixa de diálogo de tarefa, as definições, o modo de apresentação ou a janela de boas-vindas abertos, por exemplo, a aplicação recusa também a leitura, porque o utilizador está a meio de uma ação manual. O assistente recebe o código de erro `DIALOG_OPEN`. A mensagem indica o nome interno do que está aberto, por exemplo `showTaskDialog` para a caixa de diálogo de tarefa.
- *Cópia de segurança automática* escreve uma cópia IFC antes da primeira alteração por documento. Se essa cópia falhar, a aplicação não executa a alteração.
- O *Painel de atividade* mostra cada chamada, com argumentos e resposta.

Acresce o seu *Desfazer* normal (Ctrl+Z). O assistente partilha esse histórico com o utilizador e tem também `planner_undo` e `planner_redo`.

### O que o assistente não consegue fazer

A ponte é deliberadamente mais estreita do que a aplicação. O que o assistente não consegue fazer tem normalmente uma de três razões.

**Vai além do projeto.** O assistente não consegue alterar a biblioteca de recursos. A biblioteca de recursos é partilhada por todos os seus projetos e fica fora do histórico de desfazer; uma única alteração de tarifa faria então efeito em projetos que nem sequer estão abertos. Para um recurso de uma biblioteca, o nome, o tipo, a descrição, a tarifa horária e a unidade ficam fixos, tal como no painel de recursos. O que decide o projeto fica com o assistente: unidades máximas, disponibilidade ao longo do tempo, calendário e equipa. Também não pode escolher qual é o calendário do projeto. Pode ler o perfil de cálculo e as opções de cálculo, mas não as alterar; só pode definir o modo de progresso e o padrão do projeto para o tipo de tarefa. Não existem ferramentas para definições, tema, idioma, extensões ou atualizações.

**Não se presta a uma validação fiável.** O assistente não consegue definir um hammock, planear uma tarefa manualmente, definir uma segunda restrição, preencher notas, cores, códigos de atividade, campos personalizados ou relações externas, e não consegue definir um atraso de nivelamento à mão. Também não escolhe um código WBS; a aplicação deriva-o por si.

**Toca em algo que o utilizador tem de decidir.** Só regista progresso se existir uma data de estado. Não a escolhe por si: é a sua data de referência. Se uma tarefa que ainda não começou tiver um início planeado posterior à data de estado, tem de indicar o início real. Lê e escreve ficheiros só dentro da sua pasta de utilizador, e só substitui um ficheiro existente se o pedir explicitamente. Uma exportação não é *Guardar*: o projeto continua não guardado na aplicação.

### Como o assistente sabe planear

Um assistente que conhece as ferramentas ainda pode construir um planeamento que nenhum planeador aproveita: tarefas sem relações, uma data fixa em cada tarefa ou uma decomposição demasiado fina. Por isso, a aplicação dá-lhe três coisas.

**As regras essenciais no handshake.** Ao ligar, a ponte envia um texto curto no campo `instructions` do handshake MCP. Muitos clientes põem esse texto no prompt de sistema. Se o seu cliente o faz, depende do cliente. As regras: comece pelos marcos e pela data de entrega, crie tarefas de cerca de um dia a duas semanas, deixe as relações conduzir o planeamento em vez de datas fixas, use restrições só para datas externas rígidas, corrija primeiro um cálculo falhado, use `planner_batch` para uma série coerente, registe o progresso só com a sua data de estado e as datas reais que indicar, e diga no fim o que assumiu e o que deliberadamente não fez.

**O guia para assistentes.** A ferramenta `planner_get_planning_guide` devolve um guia escrito especialmente para assistentes. Segue os mesmos princípios que [Planear bem](docs://gids-goed-plannen), mas um assistente trabalha de outra forma: não carrega em F5 nem clica no friso, chama ferramentas e a aplicação recalcula por ele. Por isso, o guia indica, para cada princípio, as ferramentas que o assistente usa para ele, e explica o que o assistente faz com *Datas como registadas* ou com um cálculo falhado. O guia está em inglês, como tudo o que o assistente lê pela ligação. A ferramenta ainda aceita uma escolha de idioma para assistentes mais antigos, mas isso não altera o texto. Também pode ler o guia em `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. O prompt de ligação da janela *Detalhes de ligação* pede ao assistente que leia o guia primeiro. A ferramenta também funciona com uma caixa de diálogo aberta, em pausa e no modo só leitura, porque não lê o seu planeamento.

**Duas competências.** Uma competência é um pequeno ficheiro de instruções que um assistente lê em cada sessão. Há duas, porque são dois tipos de trabalho. Montar um planeamento é uma questão de lógica; atualizar o progresso é uma questão de factos que só o utilizador conhece. A competência *goed-plannen* serve para montar ou reestruturar um planeamento: a ordem em que se usam as ferramentas, a regra de recálculo, `planner_batch` e o dever de indicar os pressupostos. A competência *progress-update* serve para a atualização semanal do progresso: primeiro a sua data de estado, depois as datas reais de início e de fim e o percentual de avanço, e depois um relatório do desvio em relação à linha de base, do caminho crítico e da nova data de fim. Os princípios de planeamento em si estão no guia. Ambas as competências estão em inglês. A ferramenta devolve as duas, com indicação do sítio onde devem ficar. Como as instalar está em [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

## Um exemplo

Peça a um assistente que construa uma ampliação com foundation, brickwork e roof, por esta ordem. O seu projeto começa na segunda-feira, 2 de março de 2026. O assistente lê primeiro o guia e depois envia um único script:

1. o início do projeto em 2 de março de 2026;
2. três tarefas: Foundation com 5 dias úteis, Brickwork com 10 e Roof com 4;
3. duas relações fim-início: Foundation para Brickwork, Brickwork para Roof.

A aplicação executa os três passos e recalcula. Se o assistente depois ler os dados, encontra: fim do projeto na quinta-feira, 26 de março de 2026, duração do projeto de 19 dias úteis, e todas as três tarefas críticas. Isto coincide com a soma: 5 + 10 + 4 são 19 dias úteis, e 19 dias úteis depois de segunda-feira, 2 de março, terminam na quinta-feira, 26 de março. O script inteiro é um só passo no seu histórico. Um *Desfazer* remove as três tarefas, as duas relações e o novo início do projeto.

Agora um cenário hipotético. Depois, peça ao assistente que atualize o progresso, e para isso ele define a data de estado para segunda-feira, 16 de março. Uma data de estado não é uma etiqueta: tarefas que ainda não começaram não podem ficar antes dessa data e sobem até lá. Sem uma única linha de progresso, todo o planeamento se desloca, portanto: Foundation corre de 16 a 20 de março, Brickwork de 23 de março a 7 de abril e Roof de 8 a 13 de abril. O fim do projeto salta de 26 de março para 13 de abril. O planeamento avança duas semanas úteis, e o calendário deste exemplo, *Bouwkalender NL*, tem a Sexta-feira Santa (3 de abril) e a Páscoa (5 e 6 de abril). Esses dois dias de semana sem trabalho empurram o fim mais dois dias. Por isso, o assistente só define a data de estado a seu pedido, e só quando há progresso real para registar.

## Consequências para o seu planeamento e ideias erradas comuns

**O assistente não tem cópia própria.** O que ele altera, altera o seu projeto. Com a *Cópia de segurança automática* ativa, tem uma cópia de segurança IFC antes da primeira alteração. Com *Só leitura*, o assistente pode analisar sem alterar nada.

**Um novo token desliga todas as ligações.** O token é a palavra-passe da ponte. Um novo token invalida o antigo, mesmo numa ponte em funcionamento, e o assistente tem de receber o novo.

**Que o assistente diga que funcionou não é prova.** O *Painel de atividade* mostra qual ferramenta chamou de facto e o que voltou. Uma recusa quase sempre indica o campo que estava errado e o caminho que funciona.

**O assistente não consegue fazer um cenário hipotético com desfazer.** Partilha o desfazer com o utilizador, por isso, para variantes, duplica o documento com `planner_duplicate_document`. A cópia fica separada, não tem caminho de ficheiro e aparece como não guardada. O assistente não fecha variantes; essa decisão cabe ao utilizador.

**Uma exportação do assistente não equivale a guardar.** Escreve um ficheiro IFC num caminho que escolhe por si, dentro da sua pasta de utilizador, e só substitui um ficheiro existente se o pedir explicitamente. O projeto continua não guardado na aplicação e mantém o seu próprio destino de gravação. Se importar um ficheiro, este abre num separador novo ou num separador vazio, sem alterações.

## Veja também

- [Ligar um assistente de IA (MCP)](docs://howto-ai-assistent-koppelen): os passos para iniciar a ponte, ligar um assistente e instalar a competência.
- [Ferramentas de IA](docs://ref-ai-tools): todas as ferramentas por grupo, o que recusam e durante quanto tempo se mantêm as cópias de segurança.
- [Planear bem](docs://gids-goed-plannen): os princípios de planeamento; o assistente recebe-os numa versão em inglês, com as ferramentas acrescentadas.
- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): o que a data de estado faz ao seu planeamento.
