# Formatos de importação e exportação

Por formato de ficheiro: se pode abrir, guardar e exportar, o que é e o que não é incluído e com que perfil de cálculo abre. O porquê disto tudo, e um exemplo com números, está em [Ficheiros e formatos](docs://uitleg-bestanden).

## Visão geral

**Abrir** funciona com IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` e `.xer`. Um ficheiro com outra extensão é tratado pela aplicação como IFC.

**Guardar** grava sempre em IFC. Só um ficheiro IFC aberto passa a ser o destino para guardar. Um projeto de outro formato não tem ficheiro depois de aberto, e *Guardar* pergunta então onde deve ficar o ficheiro IFC.

**Exportar** funciona para IFC, MS Project XML, Primavera P6 XML, CSV e duas folhas de progresso (Excel e CSV). Uma exportação não altera o seu projeto.

**Só leitura** são `.mpp` e `.xer`: a aplicação pode abri-los, mas não os pode gravar.

**PDF** vem só de um relatório (consulte [Tipos de relatório](docs://ref-rapporttypes)). A aplicação não lê PDF.

**Onde.** Abrir: *Início › Ficheiro › Abrir*, *Ficheiro › Abrir* ou Ctrl+O. Exportar: *Início › Ficheiro › Exportar* ou *Ficheiro › Exportar*. Importe uma folha de progresso preenchida através de *Ficheiro › Importar*, ou com o botão *Atualizar o progresso a partir de uma planilha* no grupo do friso *Progresso*, nos separadores *Planeamento*, *Tabela* e *Relatório*.

**Perfil de cálculo ao abrir.** Cada formato abre com um perfil de cálculo. O que é, está em [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies). `.xer` abre com *Primavera P6*, `.mpp` com *Microsoft Project*, e CSV, MS Project XML e P6 XML com *Open Planner Studio*. O IFC mantém o perfil guardado no ficheiro. Para `.xer` e `.mpp`, a aplicação indica que o projeto calcula desta forma. Só o IFC transporta o perfil de cálculo e as opções de cálculo. Das opções de cálculo, o MS Project XML grava no máximo o limiar crítico. Uma exportação de outro formato, quando é reaberta, calcula como *Open Planner Studio*.

## IFC

**Abrir** — sim, `.ifc`. A aplicação lê IFC4 e IFC 4.3 (também ADD2). Um ficheiro com outro esquema, como IFC2X3, também abre. Na primeira vez que guardar, escolha um esquema que a aplicação consiga escrever (consulte [Escolher o esquema IFC](docs://howto-ifc-schema-kiezen)). Perfil de cálculo: o que está no ficheiro.

**Guardar** — sim, e é o único formato que guarda. *Guardar* grava todo o seu projeto como ficheiro IFC, no esquema IFC do projeto (IFC 4.3 ADD2 por padrão). O ficheiro passa a ser o destino para guardar.

**Exportar** — sim, como *IFC*, no esquema IFC do projeto (por padrão IFC 4.3 ADD2). Nome por padrão: o nome do projeto com a extensão `.ifc`. Se o seu projeto estiver ligado a uma biblioteca de recursos, a caixa de verificação *Guardar também o ficheiro de biblioteca* fica por baixo dos cartões em *Ficheiro › Exportar*. Com a caixa marcada, a aplicação pede um local para *nomedoprojeto-bibliotheek.ifc* depois do projeto. A caixa de verificação não está na lista do separador *Início*.

**O que é incluído** — tudo o que pertence ao projeto: tarefas com estrutura, duração, datas e progresso; relações com desfasamento; restrições e prazos; calendários; recursos e atribuições, incluindo a distribuição por horas; linhas de base; códigos de atividade e campos personalizados; notas; relações externas a outros projetos; interrupções; tipos de tarefa e categorias de trabalho personalizadas; as definições do projeto, como a data de estado, o modo de progresso, o perfil de cálculo e as opções de cálculo; a ligação a uma biblioteca de recursos. Num projeto de um `.xer`, o ficheiro de origem original também é incluído. Uma categoria de trabalho personalizada é guardada como o tipo IFC `USERDEFINED`, com o nome no campo ObjectType, para que outros programas IFC leiam a tarefa normalmente. A aplicação guarda também o identificador fixo da categoria de trabalho, por isso mudar o nome não quebra a ligação. Se alguém abrir o ficheiro noutro computador, a categoria de trabalho aparece aí em *Deste projeto*, e não na própria lista *As minhas categorias de trabalho*.

**O que não é incluído** — a forma como configurou o ecrã (zoom, posição de deslocamento, tarefa selecionada, fases recolhidas, filtro e agrupamento escolhidos) e as [Definições da aplicação](docs://ref-instellingen). O separador *IFC* é um editor com o texto IFC do seu projeto. *Gerar IFC* atualiza esse texto, *Copiar* coloca-o na área de transferência e *Aplicar* carrega o texto como o seu projeto, substituindo o projeto nesse separador.

## MS Project XML (MSPDI)

**Abrir** — sim. A aplicação reconhece um ficheiro `.xml` como MS Project XML pelo elemento raiz `Project` no espaço de nomes do MS Project (ou sem espaço de nomes). Perfil de cálculo: *Open Planner Studio*. Depois de abrir, a aplicação indica numa só mensagem o que não aproveitou; consulte [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen).

**Guardar** — não. Um projeto assim não recebe nenhum destino para guardar.

**Exportar** — sim, como *MS Project XML* (*Abre no Microsoft Project. Estrutura WBS completa.*). Nome por padrão: o nome do projeto com `.xml`.

**O que é incluído** — tarefas com estrutura (nível e WBS), duração, datas e progresso; relações com desfasamento, também em horas ou percentagens; restrições, incluindo o prazo; calendários, incluindo calendários de tarefa e de recurso; recursos e atribuições, incluindo a curva ou a distribuição por horas; a data de estado; o limiar crítico, como número inteiro de dias úteis igual ou superior a 0, com *Folga total ≤ limiar*; a descrição de uma tarefa (como nota); o tipo de tarefa (como tipo de tarefa do MS Project); uma categoria de trabalho personalizada, num campo livre (`ExtendedAttribute`) que a aplicação volta a ler e que o MS Project pode ignorar. Das suas linhas de base, só a ativa é incluída, como linha de base 0. Uma tarefa em horas mantém a sua unidade, e um marco mantém o seu tipo (início, fim ou automático).

**O que não é incluído** — notas (a lista de verificação de uma tarefa), relações externas a outros projetos, códigos de atividade e campos personalizados, uma segunda restrição, a marcação *Agendada manualmente*, o atraso de nivelamento, o ponto de retoma e de paragem de uma tarefa fora de sequência, as convenções *O trabalho restante retoma após a duração decorrida* e *Não mover tarefas não iniciadas para a data de estado* de um perfil do MS Project, e as outras opções de cálculo. Tarefas interrompidas sem distribuição por horas são incluídas, mas sem as suas interrupções.

**Feriados ao abrir.** Um calendário derivado herda as exceções do seu calendário base. Um calendário com a sua própria semana de trabalho e sem exceções não recebe feriados. Só um calendário simples, sem calendário base, semana de trabalho ou exceções, mantém os feriados neerlandeses habituais. Se faltarem feriados, a sua data de fim pode ser diferente: consulte [Gerar feriados e as férias da construção](docs://howto-feestdagen-genereren).

**O que muda pelo caminho** — uma restrição *Deve começar em (MSO)* ou *Deve terminar em (MFO)* sem a opção *Obrigatório (fixação de data)* passa a *Não começar antes de (SNET)* ou *Não terminar antes de (FNET)*. Uma hammock passa a ser uma tarefa normal com datas calculadas. O MS Project XML guarda as horas por dia só para o calendário do projeto. Outro calendário com horas por dia próprias recebe o seu tempo de trabalho como horas por dia ao abrir o ficheiro: 8 horas por dia com tempos de trabalho de 10 horas passam a 10. Uma tarefa em dias num calendário desses fica então mais curta, por exemplo 4 dias em vez de 5.

## Ficheiro MS Project (`.mpp`)

**Abrir** — sim, do MS Project 2010 até 2021. Perfil de cálculo: *Microsoft Project*. A aplicação só lê o ficheiro: nunca altera o seu `.mpp`. Um ficheiro do MS Project 2007 ou anterior, e um ficheiro protegido por palavra-passe, a aplicação recusa com uma mensagem que aponta para a exportação XML do MS Project. Depois de abrir, a aplicação indica numa só mensagem o que não aproveitou.

**Guardar** — não, e não há destino para guardar: *Guardar* cria um novo ficheiro IFC.

**Exportar** — não.

**O que é incluído** — tarefas com estrutura, duração e restrições; relações com desfasamento; calendários; recursos e atribuições; progresso; um código WBS que preencheu manualmente no MS Project. As datas e a folga que o próprio MS Project calculou também são lidas, para a vista *Datas registadas*.

**O que não é incluído** — linhas de base, custos e tarifas, notas, hiperligações, os campos personalizados do MS Project, a ligação de subprojetos e de tarefas externas, e o limiar crítico. Consulte [Abrir um ficheiro do MS Project (.mpp)](docs://howto-mpp-openen).

**Origem e licença** — o leitor de `.mpp` foi escrito para o Open Planner Studio e deriva do código-fonte e do conhecimento estrutural do MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), uma biblioteca Java sob LGPL-2.1. A estrutura e as constantes dos campos foram portadas para TypeScript. O próprio Open Planner Studio é de código aberto sob LGPL-3.0. O leitor de `.xer` não é uma derivação: o MPXJ foi consultado aí apenas como fonte de compreensão.

## Primavera P6 XML

**Abrir** — sim. A aplicação reconhece um ficheiro `.xml` como P6 XML pelo elemento raiz `APIBusinessObjects`. Perfil de cálculo: *Open Planner Studio*.

**Vários projetos num ficheiro.** Cada projeto com tarefas abre no seu próprio separador, com o nome *Nome do projeto (ID do projeto)*. A aplicação ignora um projeto sem tarefas. O separador ativo é o projeto com mais tarefas. A aplicação não transfere uma relação para outro projeto, nem uma tarefa que não pertença a nenhum projeto. Depois de abrir, a aplicação indica quantos projetos abriu.

**Feriados ao abrir.** Aplicam-se as mesmas regras que para o MS Project XML: um calendário com a sua própria semana de trabalho e sem exceções não recebe feriados.

**Linhas de base.** Um `<BaselineProject>` no ficheiro passa a ser uma linha de base do seu projeto. A linha de base que o P6 marca como ativa também fica ativa na aplicação.

**Ritmo de uma atribuição.** Se ainda houver trabalho restante, o ritmo restante (`RemainingUnitsPerTime`) passa a ser *Unid./dia*. Caso contrário, é o ritmo planeado (`PlannedUnitsPerTime`). Para material, o ritmo planeado mantém-se. A aplicação não recalcula nada ao abrir o ficheiro. Numa exportação para P6 XML, escreve o ritmo planeado como `PlannedUnitsPerTime`. Escreve o ritmo restante como `RemainingUnitsPerTime` só quando a atribuição tem um ritmo planeado separado.

**Sem tarefas legíveis.** Se a aplicação não encontrar nenhuma tarefa que possa ler, não abre um separador. Indica isso, com o motivo quando é conhecido. Exemplos: tarefas sem `ObjectId`, ou nomes de colunas XER num ficheiro XML. Exporte então o projeto de novo do P6 como P6 XML, ou abra-o como `.xer`.

**Guardar** — não.

**Exportar** — sim, como *Primavera P6 XML* (*Para Oracle Primavera P6.*). Nome por padrão: o nome do projeto com `.xml`, com o ID do projeto entre parênteses se o projeto tiver um. Uma exportação MS Project XML recebe o mesmo nome: escolha nomes diferentes para cada uma.

**Nome do projeto e ID do projeto.** A aplicação guarda o ID do projeto do P6 separado do nome do projeto, tal como num `.xer`. *Definições do projeto* mostra só o nome, por exemplo *Bid for Facility Extension*. O separador mostra *Bid for Facility Extension (OZB-05)*. Se mudar o nome do projeto para *Hall extension*, o separador passa a chamar-se *Hall extension (OZB-05)*. Uma exportação para P6 XML grava *OZB-05* como ID do projeto e *Hall extension* como nome. Assim, o P6 reconhece o projeto. Um projeto de um `.xer` também transporta o seu ID do projeto. O ID do projeto mantém-se quando guardar o projeto como IFC. Os parênteses no próprio nome, como em *New build (phase 2)*, mantêm-se no nome. Um projeto sem ID do projeto recebe, na exportação, um ID único próprio da aplicação, que começa por *OPS:*.

**O que é incluído** — estrutura WBS e tarefas com duração, datas e progresso; relações com desfasamento; restrições (também uma segunda, como restrição flexível); calendários; recursos e atribuições; a data de estado (como `DataDate`); uma categoria de trabalho personalizada, num campo próprio, `OPS Custom Task Type`, que a aplicação volta a ler e que o P6 pode ignorar.

**O que não é incluído** — linhas de base e prazos; códigos de atividade, campos personalizados, notas e relações externas; as opções de cálculo; os nomes dos feriados. O P6 não tem nome para cada dia não útil: ao reabrir, um feriado chama-se *Feriado* e uma exceção de trabalho chama-se *Exceção de trabalho*. Dias não úteis consecutivos voltam como um único intervalo. A aplicação encurta um nome ou código mais longo do que o P6 permite: o nome de uma tarefa para 120 caracteres, o ID de uma tarefa ou o código WBS para 40, o nome de um WBS ou de um projeto para 100. Indica quantos nomes e códigos encurtou. O P6 não tem desfasamento em percentagem: a aplicação converte-o num número fixo de dias. Um desfasamento em dias de calendário passa a ser um desfasamento em tempo de trabalho: 3 dias de calendário passam a 3 dias úteis. Uma hammock passa a ser uma tarefa normal, uma tarefa agendada manualmente passa a ser uma tarefa normal com datas calculadas, e um atraso de nivelamento de menos de um dia é eliminado.

## Ficheiro Primavera (`.xer`)

**Abrir** — sim. Perfil de cálculo: *Primavera P6*. A aplicação só lê o ficheiro: não grava `.xer` e nunca altera o seu ficheiro. Abre um separador por projeto com tarefas. Um ficheiro sem tarefas ou com tabelas danificadas é recusado com uma mensagem.

**Guardar** — não. Não há ficheiro de destino: *Guardar* cria um novo ficheiro IFC, com o `.xer` original dentro.

**Exportar** — não. Se exportar um projeto de um `.xer` para CSV, MS Project XML ou P6 XML, a aplicação indica que a informação de origem XER se perde, mesmo que tenha guardado o projeto como IFC entretanto. Para IFC não se perde nada.

**O que é incluído** — a estrutura WBS e as tarefas com duração, datas, restrições e progresso; relações com desfasamento; calendários; recursos com atribuições; códigos de atividade; campos personalizados (UDF); notas; as definições de planeamento do P6. Uma tarefa do tipo *Level of Effort* passa a ser uma hammock. Um projeto de linha de base passa a ser a linha de base ativa do projeto que o referencia. Uma relação entre dois projetos é guardada pela aplicação como dados de origem.

**Tarifa de uma atribuição.** Se houver trabalho restante, a tarifa restante (`remain_qty_per_hr`) é usada como *Unid./dia*. Caso contrário, usa-se a tarifa planeada (`target_qty_per_hr`). O trabalho planeado, real e restante mantém-se como no ficheiro. Para material, a tarifa planeada mantém-se.

**Um sábado ou domingo livre que não está no ficheiro.** Algumas exportações do P6 movem um dia livre de fim de semana, dentro de um bloco de vários dias livres, para a sexta-feira anterior ou para a segunda-feira seguinte. Se o calendário trabalhar ao sábado ou ao domingo, esse dia passaria a ser um dia útil por engano. Se a aplicação vir esse padrão num bloco de pelo menos três dias livres, torna afinal esse dia de fim de semana livre. No calendário, o dia chama-se *Exceção de calendário (reconstrução do fim de semana)* e conta na linha *N ocorrências de calendário.* da mensagem. Num calendário que não trabalha ao fim de semana, nada muda.

**Folga até ao fim do projeto, sem data de fim.** Está ativada a opção do P6 para calcular a folga até ao fim do projeto, mas o ficheiro não tem data de fim do projeto nem data de fim planeada para nenhuma tarefa? Então a aplicação desliga a opção *Calcular a folga até à data de fim do projeto*. Depois, calcula as datas mais tardias a partir do fim antecipado mais tardio. Isso conta na linha *N definições de planeamento P6 usaram alternativas seguras.* da mensagem.

**Tarefas concluídas na data de estado.** Alguns ficheiros não registam as datas reais de uma tarefa concluída, mas uma janela na data de estado. Na vista *Datas como guardadas*, uma tarefa assim é então uma barra estreita na data de estado. Se ao recalcular a tarefa ficar noutro sítio, conta no número de tarefas que a faixa indica. A convenção *Tarefa concluída na janela da data de estado* calcula essa janela, e só com essa convenção uma tarefa concluída recebe uma folga real, através da opção de cálculo *Tarefa concluída: datas mais tardias a partir da data de estado*. Esta convenção é uma aproximação: a aplicação só viu este comportamento em resultados do P3, e a Primavera não o confirma em lado nenhum. Por isso está desligada em todos os perfis incorporados, também em *Primavera P6*. Ative-a no bloco *Perfil de cálculo e opções*; o projeto passa então a ter um perfil personalizado. Consulte [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies).

**Números com vírgula como separador decimal.** O P6 regista o separador decimal e o separador de milhares na tabela `CURRTYPE`. A aplicação lê esses caracteres antes de converter durações, trabalho e folga. Se essa informação faltar, a aplicação usa um ponto como separador decimal. Se o ficheiro ainda contiver números com vírgula decimal, a aplicação não abre nada. Assim nunca se abre um planeamento com números lidos de forma errada.

**O que não é incluído** — um projeto sem tarefas, e uma relação entre dois projetos como relação real no seu planeamento. Consulte [Abrir um ficheiro Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Abrir** — sim. A aplicação lê `;` e `,` como separador. Reconhece cabeçalhos de coluna em inglês e em neerlandês (por exemplo `Name` ou `Naam`, `Duration` ou `Duur`, `Predecessors` ou `Voorgangers`). As datas podem ser *aaaa-mm-dd*, *dd-mm-aaaa* ou *dd/mm/aaaa*. Escreva a predecessora como código WBS, tipo de relação e desfasamento, por exemplo `1.2FS+2d`. Perfil de cálculo: *Open Planner Studio*. O projeto chama-se *CSV Import*. A coluna `Task Type` contém a categoria de trabalho, e não o tipo de tarefa; a aplicação também lê os cabeçalhos `Werksoort` e `Work category`. Um `Task Type` que não seja nenhum dos códigos fixos (como `CONSTRUCTION` ou `INSTALLATION`, que a própria aplicação escreve) passa a ser uma categoria de trabalho personalizada em *Deste projeto*, e não em *As minhas categorias de trabalho*. Com `OPS Custom Task Type ID` mantém-se o identificador de uma categoria de trabalho personalizada.

**Guardar** — não.

**Exportar** — sim, como *CSV (;)* (*Exportação de tabela universal. Todas as tarefas com datas e durações.*), no cartão *CSV (separado por ponto e vírgula)*. O ficheiro usa o ponto e vírgula como separador, está em UTF-8 com BOM e tem cabeçalhos de coluna em inglês.

**O que é incluído** — por tarefa, estas colunas: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` e `Description`. A coluna `Task Type` contém a categoria de trabalho. A conclusão está em percentagens inteiras. Um desfasamento em horas recebe o sinal de hora do idioma da aplicação: `1.2FS+2h` em inglês, `1.2FS+2u` em neerlandês. Ao abrir, a aplicação lê as duas formas.

**O que não é incluído** — recursos, atribuições, calendários, restrições, prazos, linhas de base e a data de estado. Se as datas estiverem na vista *Datas como guardadas*, a exportação deixa vazios `Critical` e `Total Float` nas tarefas cujo ficheiro de origem não registou esses valores.

## Folha de progresso (Excel e CSV)

**Abrir** — sim, por *Ficheiro › Importar* (*Atualizar o progresso a partir de uma planilha*) ou pelo botão com esse nome no grupo do friso *Progresso*, nos separadores *Planeamento*, *Tabela* e *Relatório*. A aplicação lê `.xlsx` e `.csv`, até 16 MB e 50 000 linhas. Isto não abre um projeto: atualiza o progresso do seu projeto aberto. Consulte [Importar progresso a partir de uma planilha](docs://howto-voortgang-importeren).

**Guardar** — não.

**Exportar** — sim, como *Folha de progresso (Excel)* (*Progresso (Excel)* na lista) e *Folha de progresso (CSV)* (*Progresso (CSV)*). Nome por padrão: *nomedoprojeto-voortgang*. O botão *Exportar folha de progresso* no mesmo grupo do friso cria a folha Excel com um clique. A folha Excel tem larguras de coluna fixas, campos bloqueados e verificação de datas; a folha CSV tem o mesmo conteúdo em texto simples.

**O que é incluído** — as colunas `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` e `Actual Finish`. Ao importar, a aplicação usa `Completion (%)`, `Actual Start` e `Actual Finish`. `Start` e `Finish` servem apenas para reconhecer a notação da data e não alteram o seu planeamento. A aplicação liga as linhas às tarefas pelo `OPS Task ID`, ou, em alternativa, por um código WBS único.

**O que não é incluído** — tudo o que estiver fora destas colunas: duração, relações, recursos e o resto do seu planeamento. Uma tarefa de resumo não recebe progresso da folha.

## PDF

**Abrir** — não.

**Guardar** — não.

**Exportar** — sim, a partir de um relatório: no separador *Relatório*, o botão *Exportar PDF*. A aplicação não envia ela mesma um relatório para uma impressora; o caminho para o papel passa pelo PDF. O conteúdo depende do tipo de relatório: consulte [Tipos de relatório](docs://ref-rapporttypes) e [Criar e imprimir um relatório](docs://howto-rapport-maken-en-afdrukken).

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): porque é que o IFC é o formato próprio e o que uma exportação perde, com um exemplo.
- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): os passos.
- [Exportar](docs://howto-exporteren): escolher um formato e as mensagens depois de uma exportação.
- [Datas como guardadas](docs://uitleg-datums-zoals-opgeslagen): porque é que um ficheiro aberto pode mostrar outras datas.
- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): os perfis de cálculo.
