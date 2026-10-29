# Notificações e avisos

A aplicação indica o que está a acontecer em quatro sítios: a barra de estado em baixo, o painel *Avisos* do lado direito, as notificações que aparecem durante pouco tempo na parte inferior do ecrã e as faixas sob o friso. Este artigo indica, para cada sítio, o que vê, quando aparece e o que pode fazer. Porque é que um planeamento é crítico ou tem recursos sobrealocados está em [Caminho crítico e folga](docs://uitleg-kritiek-pad); a resolução de recursos sobrealocados está em [Resolver recursos sobrealocados](docs://howto-overbezetting-oplossen); como criar relações está em [Criar relações](docs://howto-relaties-leggen).

## A diferença entre os quatro

- **Barra de estado** — uma linha fixa com contadores. Vêm do último cálculo e mantêm-se até voltar a calcular.
- **Painel de avisos** — a lista por detrás desses contadores, com tudo o que o último cálculo encontrou. Um clique leva à tarefa, relação ou recurso. O painel resulta do último cálculo; nada é guardado.
- **Notificações** — mensagens curtas sobre algo que acabou de fazer (falha ao guardar, relação recusada, importação lida). Uma mensagem de informação desaparece outra vez; um erro fica até o fechar. Não aparecem no painel.
- **Faixa sob o friso** — uma faixa colorida com uma explicação e um botão. Pertence a um estado do documento ou de um modo e mantém-se enquanto esse estado se aplicar. Veja *As faixas sob o friso*.

## A barra de estado

A barra em baixo mostra, da esquerda para a direita:

- **Tarefas:** — o número de tarefas folha (as tarefas de resumo não contam).
- **Marcos:** — o número de marcos.
- **Caminho crítico: N tarefas, N dias úteis** — o número de tarefas críticas e a duração do projeto. Só está visível depois de um cálculo.
- **Fim:** — a data de fim do projeto, a partir do cálculo. Só está visível depois de um cálculo; um projeto vazio não tem nenhuma.
- **N prazo(s) ultrapassado(s)**, **N restrição(ões) violada(s)**, **N relação(ões) fora de sequência** e **N recurso(s) sobrealocado(s)** — cada um é um botão com um sinal de aviso, só visível quando o contador é superior a 0 e existe um cálculo. Um clique abre o painel *Avisos* (texto de ajuda: *Abrir o painel de avisos (detalhes e navegação)*). Se estiver no separador *IFC* ou *Relatório*, a aplicação salta ao mesmo tempo para *Início*, porque a coluna da direita não existe nesse separador. O contador *recurso(s) sobrealocado(s)* também se atualiza depois de alterações a recursos e atribuições; os outros contadores só mudam depois de *Calcular*. Os quatro contadores são uma seleção: o que o painel mostra além disso (avanço truncado, relação ignorada, hammock sem driver de fim, data de fim limitada, erro de planeamento) não está na barra de estado.
- **Desatualizado — recalcule (F5)** — com um sinal de aviso (texto de ajuda: *Planificação desatualizada — recalcule (F5)*). Aparece logo que altera algo que afeta o planeamento e ainda não recalculou. Se a opção *Calcular automaticamente* estiver ligada, não aparece, exceto quando o cálculo deu um erro: nesse caso, aparece.
- **Seleção: N tarefa(s)** — o número de tarefas selecionadas; só visível com uma seleção.
- **Escala:** e **Zoom: Npx/dia** — a escala temporal da linha de tempo e o nível de zoom. A escala resulta do zoom.
- **Não guardado** — enquanto o documento tiver alterações que não estão no ficheiro.
- **IA** — um ponto colorido com a palavra IA, só quando o modo IA está ativo. A dica diz *Ponte IA:* com *Desligada*, *Ativa na porta N*, *Porta N ocupada* ou *Erro*. Um clique abre o separador *IA*.
- **Terminal de depuração** — um botão de terminal, só quando o terminal de depuração está ativado; mostra ou oculta o terminal (*Mostrar terminal de depuração* / *Ocultar terminal de depuração*).

## O painel *Avisos*

- **Abertura** — *Planeamento › Agendamento › Avisos*, *Visualização › Painéis › Avisos*, ou um contador na barra de estado. O painel está na coluna da direita, por baixo de *Propriedades* e do painel de recursos, e expande uma coluna recolhida. Por padrão está fechado e não é lembrado entre sessões. Arraste a altura pela margem quando está por baixo de outros painéis; essa altura é lembrada. A cruz no canto superior direito fecha o painel (*Fechar avisos*).
- **Linha de cabeçalho** — *N erro(s), N aviso(s)*. Se ainda não houve cálculo, diz *Ainda não calculado — prima Calcular (F5) para executar as verificações*.
- **Calcular** — um botão na linha de cabeçalho, visível enquanto o planeamento estiver desatualizado ou ainda não tiver sido calculado. Faz o mesmo que *Calcular* no friso.
- **Sinal de aviso na linha de cabeçalho** — aparece quando o planeamento está desatualizado, com a dica *Planeamento desatualizado — esta lista provém do último cálculo. Recalcule (F5)*. A lista não fica oculta; fica apenas marcada como desatualizada.
- **Lista vazia** — *Sem avisos. O planeamento passa em todas as verificações*.
- **Uma linha** — no topo, o sítio (tarefa, relação, recurso ou projeto); por baixo, a descrição. Um erro tem um sinal próprio em forma de octógono; um aviso tem um sinal triangular. Uma tarefa aparece como `nome WBS`. Uma relação aparece como `predecessora → sucessora (FS+2d)`, com tipo e desfasamento. Um clique leva ao sítio (texto de ajuda: *Ir para: …*); consulte abaixo. A linha que pertence à sua tarefa ativa (para uma relação: a sucessora) ou ao recurso escolhido no histograma fica destacada.
- **Ordem** — primeiro os erros; depois, por tipo, pela ordem da lista abaixo; dentro de cada tipo, pela ordem do documento (para uma relação, a da sucessora; para um recurso, a da lista de recursos). Uma tarefa, relação ou recurso eliminado depois do último cálculo deixa de aparecer.

### Tipos de aviso

- **Erro de planeamento** — *O planeamento não pôde ser calculado: …* com o motivo a seguir; consulte abaixo. Um clique: num ciclo, a aplicação seleciona todas as tarefas do ciclo e salta para a primeira; nos outros erros não há para onde saltar, e a linha não é um botão.
- **Prazo ultrapassado** — *Prazo {date} ultrapassado — fim antecipado {date}*. A tarefa tem um prazo e o cálculo não o cumpre. Um clique salta para a tarefa. Para corrigir: ajuste a lógica ou a duração, ou mude o prazo.
- **Restrição violada** — *A restrição {type and date} é ultrapassada pela lógica (folga negativa)*. A restrição não pode ser cumprida sem quebrar a lógica; a folga é negativa. Um clique salta para a tarefa. Consulte [Restrições](docs://uitleg-constraints).
- **Fora de sequência** — *Fora de sequência: o progresso do sucessor contradiz a relação*. O progresso do sucessor não encaixa no tipo de relação; por exemplo, um sucessor que já está em curso enquanto o predecessor ainda não está concluído, numa relação fim-início. Um clique seleciona as duas tarefas, com a sucessora ativa. Verifique as datas reais ou a relação.
- **Avanço truncado** — *Avanço truncado pelo início do projeto — a relação não é totalmente respeitada*. O avanço (desfasamento negativo) da relação ultrapassa o início do projeto. Um clique seleciona as duas tarefas.
- **Relação ignorada** — *Relação ignorada: o predecessor ou o sucessor está em falta ou não é uma tarefa folha*. O cálculo não usa a relação. Um clique seleciona as tarefas que ainda existem. Consulte [Relações](docs://uitleg-relaties).
- **Hammock sem driver de fim** — *Hammock sem driver de fim (sem predecessor FF/SF): a duração volta a zero*. Um clique salta para a tarefa. Consulte [Tarefas hammock](docs://howto-hammock).
- **Data de fim limitada** — *Data de fim limitada: o calendário não deixa nenhuma janela útil para esta tarefa*. O cálculo atingiu o limite de dias que pesquisa, por exemplo por causa de um período contínuo muito longo de dias não úteis no calendário. Um clique salta para a tarefa. Consulte [Calendários e dias úteis](docs://uitleg-kalenders).
- **Recurso sobrealocado** — *Sobrealocado durante N dia(s) (first – last)*, com *o recurso não trabalha estes dias segundo o seu calendário* acrescentado se todos os dias forem dias não úteis, ou *dos quais N dia(s) o recurso não trabalha segundo o seu calendário* para uma mistura. Um clique seleciona as tarefas com uma atribuição a esse recurso, liga o histograma e escolhe esse recurso nele; a partir de *Tabela*, *IFC* ou *Relatório*, a aplicação salta para *Recursos*. Consulte [Painel de recursos](docs://ref-resourcepaneel).

### Causas de erro de planeamento

- *Dependência circular entre tarefas: {path}* — as relações formam um ciclo. As tarefas estão no caminho; inverta ou elimine uma relação.
- *O calendário não tem dias úteis definidos* — dê ao calendário pelo menos um dia útil; consulte [Janelas do calendário](docs://ref-kalenders).
- *Duração em dias inválida para a tarefa '{task}'* e *Duração em horas inválida para a tarefa '{task}'* — a duração da tarefa não é um número válido.
- *A tarefa horária '{task}' não tem horário de trabalho válido no seu calendário* — uma tarefa em horas num calendário sem horário de trabalho.
- *Data de início inválida para a tarefa '{task}'* — a data de início da tarefa não é válida.

## As faixas sob o friso

Uma faixa fica diretamente sob o friso, por cima da área de trabalho. Tem um texto e um botão. Uma faixa para um modo não tem cruz. Feche as outras com a cruz. As cinco faixas:

- **Modo de ligação** — *Modo de ligação: arraste de uma barra para outra no Gantt para criar uma relação. Esc para sair*. Fica enquanto o modo de ligação estiver ativado. Botão: *Parar*. Veja [Criar relações](docs://howto-relaties-leggen).
- **Modo de divisão** — *Clique numa barra no dia em que a interrupção começa e arraste para a direita para definir a duração. Esc para sair*. Fica enquanto *Dividir tarefa* estiver ativo. Botão: *Parar*.
- **Planeamento por horas no ficheiro** — *Este ficheiro contém planeamento por horas*. Aparece quando um ficheiro aberto contém planeamento por horas e *Ativar planeamento por horas* está desligado. Botão: *Ativar planeamento por horas*. Veja [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten).
- **Estrutura bloqueada** — *Não disponível durante a filtragem/agrupamento/ordenação*. Aparece quando avançar ou diminuir indentação é recusado porque a tabela de tarefas está filtrada, agrupada ou ordenada. Botão: *Limpar*, que remove o filtro, o agrupamento e a ordenação.
- **Datas gravadas** — ao abrir um ficheiro em que recalcular moveu algumas datas: *A recalculação afastou N de M tarefas das datas do ficheiro.* com o botão *Mostrar datas gravadas*. Enquanto a vista estiver ativa: *Está a ver as datas gravadas no ficheiro …* com o botão *Recalcular*. Veja [Datas gravadas](docs://uitleg-datums-zoals-opgeslagen).

## Notificações

As notificações aparecem na parte inferior do ecrã, também na tabela, no Backstage e no modo de apresentação. Uma notificação é um *erro* ou uma *informação*. Um erro é vermelho e fica até clicar na cruz. Uma informação desaparece após 5 segundos (uma notificação com muita explicação fica mais tempo), e esses temporizadores recomeçam assim que a pilha muda. Cada notificação tem uma cruz no canto superior direito (descrição *Fechar notificação*) que a fecha de imediato. Um clique no texto da notificação não faz nada. Uma recusa é sempre um erro: uma notificação que indica que a aplicação não executou algo que fez, como uma relação, duração, início ou marco recusado. Assim, não a perde se desviar o olhar por um momento. Uma recusa desaparece após Ctrl+Z ou Ctrl+Y e quando passa para outro documento, porque então já não está correta. Outro erro, como *Falha ao salvar*, fica. Isto também se aplica se o resto da mesma ação teve êxito, por exemplo ao colar em várias células. Se estiverem envolvidas várias tarefas, uma linha por baixo indica quais não foram alteradas, por exemplo *Não alterado: Foundation, Masonry.* Com mais de cinco, termina com *e mais N tarefas*. A mesma recusa agrupa-se numa linha com um contador quando se repete. No máximo, três são mostradas de cada vez. Se chegar uma quarta, sai primeiro a informação mais antiga. Se não houver informação, sai a recusa mais antiga, depois a notificação de abertura fixa mais antiga e só então o erro mais antigo. Assim, uma informação ou uma recusa nunca faz sair outro erro, como *Falha ao salvar*. A pilha afasta-se dos botões de um diálogo aberto e das barras de ações fixas. Uma notificação ao abrir um ficheiro também fica até clicar na cruz, se a aplicação preencheu, substituiu, reparou ou deixou de fora dados ao abrir: uma linha sobre ocorrências do analisador ou do calendário, problemas de formato numérico, alternativas de enumeração, definições de planeamento P6 com uma alternativa segura, uma alternativa protetora para a linha de base, referências de linha de base ignoradas, atividades sem início planeado às quais foi dado um início, relações entre projetos ou atividades sem projeto que não foram importadas (P6 XML), algo de um ficheiro do MS Project que não foi importado (MS Project XML e `.mpp`) ou um ficheiro de origem XER inutilizável, e as notificações sobre identificadores e relações duplicados que não são calculados. Se contém só informação sem tal alteração (como o número de projetos, documentos ou a codificação do texto), a notificação desaparece após 5 segundos.

- **Contador ×N** — uma notificação com uma chave fixa agrupa uma repetição numa linha com um contador, por exemplo uma falha ao guardar que volta sempre ou uma relação recusada que repete. Nem todas as notificações fazem isso.
- **Saiba mais** — algumas notificações têm uma ligação *Saiba mais* ou um tema próprio (por exemplo *Tipos de tarefa explicados*) para o guia em Backstage › Ajuda.
- **Botão de ação** — a notificação sobre o perfil de cálculo tem um botão *Abrir perfil de cálculo* para as Informações do projeto.

A lista abaixo é uma seleção, agrupada por tema. Onde não disser o contrário, é uma informação.

### Guardar, abrir e recuperação

- **Falha ao guardar** (erro) — *Falha ao salvar* com o motivo por baixo. Ao guardar, ao guardar como e ao exportar um relatório.
- **Guardado como transferência** (informação) — *Guardado como transferência: «{name}» está agora na pasta das transferências. …* Com *Guardar como* e exportações, quando o ambiente não deixa a aplicação escrever diretamente no local que escolheu. Duas transferências seguidas agrupam-se.
- **Guardado como transferência (explicação)** (informação, 15 segundos) — *Guardado como transferência: «{name}» está na sua pasta de transferências. Este navegador não deixa a aplicação escrever num local próprio, …* Com *Guardar* num navegador que só guarda por transferência. Uma vez por sessão, com uma ligação para a explicação sobre ficheiros.
- **Navegador não volta a guardar** (informação, 15 segundos) — *Este navegador não deixa a aplicação voltar a escrever em «{name}». …* Com *Guardar* de um projeto que tem um ficheiro, quando o navegador tem de pedir de novo um local. Uma vez por sessão, com uma ligação para a explicação sobre ficheiros.
- **Falha no salvamento automático** (erro) — *Falha no salvamento automático* com o motivo. Aplica-se ao salvamento automático no ficheiro e à recuperação após uma falha.
- **Biblioteca não pôde ser guardada** (erro) — *Não foi possível guardar a biblioteca*, ao guardar a biblioteca de recursos.
- **Falha ao abrir um ficheiro** (erro) — *Falha ao abrir o ficheiro* com o motivo. Por exemplo, um ficheiro recente ou um ficheiro importado.
- **.mpp antigo ou protegido** (erro) — *Este ficheiro .mpp usa um formato mais antigo (Project 2007 ou anterior)…* ou *Este ficheiro .mpp está protegido por palavra-passe…*, ambos com o conselho de exportar como XML no MS Project e abrir esse ficheiro.
- **Ficheiro XER inválido** (erro) — um dos textos *XER…*, por exemplo *Este não é um ficheiro XER válido ou compatível.* ou *O ficheiro XER contém uma tabela duplicada.*, com o motivo acrescentado.
- **IFC não pôde ser lido** (erro) — *Não foi possível ler o IFC* com o motivo, na vista IFC.
- **Recuperação** (erro) — *Não foi possível ler o ficheiro recuperado*, *Falha na restauração* e *N ficheiros de recuperação não puderam ser carregados e foram ignorados.* Ao recuperar após um encerramento inesperado.
- **Ramo guardado como modelo** (informação) — *Ramo guardado como modelo '{name}'*.
- **Mensagem de uma extensão** (informação, ou erro se a extensão comunicar um erro) — *Extensão {name}: {message}*. Uma extensão pode mostrar, no máximo, três novas mensagens por 10 segundos, para não encher a pilha. Se um passo do guia de uma extensão falhar, aparece *Um passo da extensão {name} falhou. O guia continua.*, e se um ficheiro de projeto de uma extensão não puder ser aberto, *Não foi possível abrir o ficheiro de projeto {file} da extensão {name}.* Ambas são erros.
- **Uma alteração entrou entretanto** (erro) — *Uma alteração feita pelo assistente de IA ou por uma extensão entrou entretanto. …* Quando cancela a janela da tarefa enquanto a IA ou uma extensão alterou algo entretanto: as edições de tarefa anteriores a essa alteração não são revertidas e continuam como passos normais em *Desfazer*.

### Cálculo

- **Planeamento não pôde ser calculado** (erro) — *Não foi possível calcular o planeamento* com o motivo por baixo (ver *Motivos de um erro de planeamento*). Ao carregar em *Calcular*, ao mudar de documento e ao abrir um ficheiro.
- **Data de estado definida para hoje** (informação) — *Data de estado definida para hoje ({date}).* Ao registar progresso num projeto sem data de estado. A aplicação mede o progresso até à data de estado, por isso, sem data de estado, não consegue processar o progresso. Defina outra data em *Planeamento › Linhas de base e progresso › Data de estado*. Com uma ligação *Saiba mais* para [Progresso, data de estado e linha de base](docs://uitleg-voortgang).
- **Duração mais curta do que o trabalho já feito** (erro) — *«{name}» já está {N}% feita: uma duração inferior ao trabalho já realizado não é possível. A duração não foi alterada.*

### Relações e hierarquia

- **Relação recusada** (erro) — *Essa relação já existe*, *Não é permitida uma relação entre uma tarefa e a sua própria tarefa de resumo ancestral.* ou *Esta relação criaria um ciclo no planeamento ({cycle}) e não foi criada.* O ciclo indica as tarefas, por isso sabe qual relação remover ou inverter primeiro.
- **Mudança recusada** (erro) — *Esta mudança criaria um ciclo no planeamento ({cycle}): as relações de uma tarefa de resumo também se aplicam às suas subtarefas. Nada foi movido.*
- **Relações sem efeito após uma mudança** (informação) — *Após a mudança, N relações ligam uma tarefa à sua própria tarefa de resumo ancestral; deixam de contar no cálculo.*
- **Relações não criadas ao colar ou inserir** (erro) — *N relações não foram criadas: relação inválida…*, ao colar ou inserir um ramo. Uma linha por baixo indica quais relações, por exemplo *Não criado: Foundation → Masonry.*
- **Relações não contadas após importação** (informação) — *N relação(ões) não puderam ser incluídas. Verifique as colunas Predecessoras e Sucessoras.*
- **Identificadores duplicados após importação** (informação) — *Objetos com um identificador duplicado neste ficheiro: N. Receberam um identificador próprio…*

### Editar tarefas

- **Início registado como restrição** (informação) — *«{name}» não começa antes de {date} (SNET).* Ao alterar o início de uma tarefa com uma predecessora. A predecessora determina o início, por isso a aplicação regista a sua data como restrição *não começar antes de* (SNET). Após recalcular (F5), a tarefa não começa antes dessa data. Se a tarefa já tinha essa restrição, aparece *«{name}» agora não começa antes de {date} (SNET).*; para várias tarefas de uma vez, indica uma contagem. Com uma ligação *Saiba mais* para [Restrições e prazos](docs://uitleg-constraints).
- **Início não aplicado** (erro) — *O novo início de «{name}» não foi aplicado: a tarefa tem uma predecessora e a restrição {type} {date}, e essas determinam o seu início. Altere essa restrição para mudar o início.*
- **Marco recusado** (erro) — *«{task}» tem atribuições de recursos e não pode tornar-se um marco. Remova primeiro as atribuições.* ou *«{task}» é uma tarefa de resumo com subtarefas e não pode tornar-se um marco.* Ao converter na janela da tarefa, no painel de propriedades, no menu de contexto e na tabela.
- **Atribuições movidas para uma subtarefa** (informação) — *Atribuição movida para a subtarefa «{child}».* ou *N atribuições movidas para a subtarefa «{child}».* Quando uma extensão dá subtarefas a uma tarefa com atribuições. Essa tarefa torna-se uma tarefa de resumo, e uma tarefa de resumo não tem atribuições próprias. Por isso, passam para a primeira subtarefa nova. Na própria aplicação escolhe isto na janela *A tarefa torna-se uma tarefa de resumo*; esta mensagem não aparece. Com uma ligação *Saiba mais* para [Ajustar a estrutura](docs://howto-structuur-aanpassen).
- **Indicação de marco removida** (informação) — *«{phase}» já não é um marco.* Quando um marco recebe subtarefas. Um marco é um momento sem subtarefas; com subtarefas torna-se uma tarefa de resumo. Com uma ligação *Saiba mais* para [Ajustar a estrutura](docs://howto-structuur-aanpassen).
- **Pergunta desatualizada** (erro) — *As tarefas ou atribuições foram alteradas enquanto a pergunta estava aberta. Nada foi alterado; tente novamente.* Quando escolhe na janela *A tarefa torna-se uma tarefa de resumo*, mas a pergunta já não corresponde.
- **Tarefa de resumo recusada** (erro) — *«{phase}» não pode tornar-se uma tarefa de resumo: …* com o motivo, e *Nada foi alterado.* Quando uma extensão dá subtarefas a uma tarefa com atribuições e as atribuições não podem ir para a primeira subtarefa nova. Na própria aplicação esta mensagem não aparece: aí a janela *A tarefa torna-se uma tarefa de resumo* pergunta o que fazer, e *Mover* fica então desativado.
- **Células ignoradas ao colar** (erro) — *N células ignoradas: são só leitura (por exemplo, um código WBS numerado automaticamente ou uma coluna calculada).*
- **Referências limpas ao colar** (informação) — *N referências não existiam neste documento e foram limpas (calendários de tarefa, categorias de trabalho próprias, códigos de atividade ou campos personalizados do documento de origem).*
- **Estrutura bloqueada** (erro, faixa vermelha abaixo do friso) — *Não disponível durante a filtragem/agrupamento/ordenação*, com o botão *Limpar*. Enquanto a lista está filtrada, agrupada ou ordenada: ao avançar, ao diminuir a indentação e ao arrastar, e com *Inserir acima* e *Inserir abaixo* (menu do botão direito ou atalho). A faixa fica até clicar na cruz, usar Ctrl+Z ou Ctrl+Y, ou passar para outro documento. Ver [Ajustar a estrutura](docs://howto-structuur-aanpassen).
- **Tarefa adicionada no fim** (erro) — *A nova tarefa foi adicionada no fim. Durante a filtragem, o agrupamento ou a ordenação, a aplicação não a pode colocar abaixo da sua seleção.* Com o botão *Limpar*. Com *Tarefa* e *Marco ▾* enquanto uma tarefa está selecionada e a lista está filtrada, agrupada ou ordenada. A tarefa é adicionada, mas no fundo. *Limpar* remove o filtro, o agrupamento e a ordenação, e fecha a notificação. Ver [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen).
- **Tipo de tarefa ajustou durações** (informação) — *Após a alteração do calendário, o tipo de tarefa ajustou a duração de N tarefas (o trabalho mantém-se, as horas por dia mudaram).* Com uma ligação *Tipos de tarefa explicados*.

### Primavera P6 XML

- **Ficheiro P6 XML aberto** (informação) — *Ficheiro P6 XML aberto: N documentos de projeto.* Após abrir um ficheiro P6 XML.
- **Não importado** (não desaparece) — *N relações entre projetos não foram importadas como relações.* e *N atividades sem projeto não foram lidas.* Verifique se o seu planeamento está completo.
- **Vazio ou inutilizável** (erro) — nada abre. Três motivos: *Este ficheiro não contém atividades que a aplicação consiga ler.*, *As atividades não têm ObjectId. …* e *O ficheiro usa nomes de colunas XER … Abra o próprio ficheiro .xer.*

### Primavera (XER)

- **Ficheiro XER aberto** (informação) — *Ficheiro XER aberto: N documentos de projeto.* Uma notificação por ficheiro, mesmo que o ficheiro abra vários projetos, com uma ligação *Saiba mais* e linhas de detalhe por baixo. Sempre *N projetos encontrados.* Só quando o número for superior a 0: *N projetos vazios ignorados.*, *N projetos de linha de base excluídos.*, *N linhas de base materializadas.*, *N referências de linha de base pendentes ignoradas.*, *Foi usada uma alternativa protetora para a linha de base.* e *N relações externas preservadas.* Só para uma codificação diferente de UTF-8: *Codificação de texto escolhida: {encoding}.* Além disso, quando o número for superior a 0: *N ocorrências do analisador.*, *N ocorrências de calendário.*, *N problemas de formato numérico.*, *N alternativas de enumeração* e *N definições de planeamento P6 usaram alternativas seguras.*
- **Datas como o Primavera as registou** (linha de detalhe na mesma notificação) — *N tarefas mostram as datas tal como registadas pelo Primavera (sem recalcular).* N conta cada tarefa para a qual o ficheiro registou datas, incluindo as que não diferem. Ou, se o modo não tiver sido ativado, *N tarefas diferem das datas no ficheiro — pode mostrá-las.*
- **Ficheiro de origem XER inutilizável** (informação) — *O ficheiro de origem XER deste ficheiro é inutilizável e foi omitido; o projeto em si foi aberto por completo.* com o motivo (por exemplo, *Motivo: a soma de verificação não corresponde aos bytes de origem — o ficheiro está danificado.*) e a consequência (*O planeamento, o perfil de cálculo e todos os dados do projeto no IFC estão completos. …*). Ao abrir um ficheiro IFC em que um ficheiro de origem XER guardado anteriormente não pode ser usado. Também ao restaurar após um encerramento inesperado, se o armazenamento de recuperação já não tiver o ficheiro de origem XER.
- **Exportação perde informação XER** (informação) — *A exportação para {format} perde informações de origem XER.* Após uma exportação bem-sucedida para um formato diferente de IFC, de um projeto com dados que só existem num ficheiro XER. Com uma ligação *Saiba mais*.

### Importar, exportar e perfil de cálculo

- **Datas como no ficheiro** (informação) — *N tarefas mostram as datas tal como registadas no ficheiro (sem recalcular).* (N conta cada tarefa com datas registadas) ou *N tarefas diferem das datas no ficheiro — pode mostrá-las.* Ao abrir um ficheiro com datas registadas.
- **Trabalho e tipos de tarefa visíveis** (informação) — *Este ficheiro contém trabalho guardado ou tipos de tarefa; o tipo de tarefa e o trabalho restante são mostrados para este projeto.*
- **Planeamento do MS Project lido** (informação) — *Este ficheiro do MS Project contém N tarefas com um cronograma dividido, nivelado ou controlado por recursos. Elas são importadas e exibidas como estão.*
- **Interrupções não exportadas** (informação) — *N tarefas com interrupções foram exportadas sem as suas interrupções: o MS Project/P6 só as conhece como distribuição do trabalho.* Ao exportar para o MS Project ou o Primavera.
- **Início do projeto alterado** (informação) — *N tarefas acompanharam o início do projeto.* Ao definir o início do projeto mais tarde. Só se deslocam para essa data as tarefas sem predecessora e sem restrição que ficaria antes da nova data de início. Com uma ligação *Saiba mais* para [Novo projeto e Informações do projeto](docs://ref-projectinfo).
- **Janela de datas deixa de orientar** (informação) — *A janela de datas do MS Project deixa de orientar N tarefas após esta edição; …* Uma vez por documento.
- **Atraso de nivelamento arredondado** (informação) — *O nivelamento arredonda o atraso de nivelamento do MS Project, com precisão de minutos, de N tarefas para dias úteis inteiros.* Uma vez por documento.
- **Perfil de cálculo aplicado** (informação) — *Este projeto calcula como {profile}. Altere em Ficheiro → Informações do projeto → Perfil de cálculo e opções.* Com o botão *Abrir perfil de cálculo*. Após aplicar um perfil, segue-se *Após aplicar, N tarefas foram deslocadas.*, se for necessário.
