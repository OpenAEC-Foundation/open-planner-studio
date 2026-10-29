# Ficheiros e formatos

O que está, na verdade, no ficheiro que guarda? E o que acontece ao seu planeamento quando o exporta para outro pacote? Neste artigo, fica a saber como a aplicação trata os ficheiros: o IFC como formato próprio, os outros formatos como tradutores, o que uma exportação deixa de fora e em que se diferenciam guardar, AutoSave e recuperação após falha. O exemplo no fim mostra com números o que faz uma exportação.

## O conceito

Open Planner Studio tem um formato de ficheiro próprio: **IFC**, um formato aberto de troca de informação de construção da buildingSMART. A aplicação escreve o esquema IFC do projeto, por padrão IFC 4.3 ADD2 (veja [Escolher o esquema IFC](docs://howto-ifc-schema-kiezen)); na lista de exportação chama-se *IFC*. Não existe um segundo ficheiro de projeto proprietário. *Guardar* escreve o projeto inteiro como ficheiro IFC (`.ifc`), e *Abrir* lê de volta esse tipo de ficheiro. Quer ver o que entra no ficheiro? O separador *IFC* é um editor que mostra o texto IFC do seu projeto; *Gerar IFC* atualiza esse texto e *Copiar* coloca-o na área de transferência. Se alterar o texto, *Aplicar* carrega-o como o seu projeto. Isso substitui completamente o projeto nesse separador.

Todos os outros formatos são **adaptadores**: tradutores entre o modelo de outro programa e o modelo da aplicação. A aplicação lê CSV, MS Project XML, Primavera P6 XML, ficheiros MS Project (`.mpp`) e ficheiros Primavera (`.xer`). Escreve CSV, MS Project XML, Primavera P6 XML e duas folhas de progresso. Não é possível exportar para `.mpp` ou `.xer`.

Porque é que esta distinção importa? Um tradutor só consegue transportar o que os dois lados conhecem. O ficheiro IFC da aplicação guarda tudo o que pertence ao seu projeto. Cada um dos outros formatos não tem uma parte disso, e essa parte fica para trás.

## Como a aplicação trata os ficheiros

### O que acontece ao abrir

A aplicação escolhe o leitor pela extensão: `.ifc`, `.csv`, `.xml`, `.mpp` ou `.xer`. Com um ficheiro `.xml`, verifica o conteúdo para ver se é MS Project XML ou Primavera P6 XML. Uma extensão desconhecida é tratada como IFC. Se o ficheiro não for IFC, a aplicação indica *Falha ao abrir o ficheiro*, com o motivo.

Cada ficheiro abre num separador próprio. A exceção é um separador ainda vazio e sem alterações: esse separador fica com o ficheiro. Um único ficheiro Primavera pode dar origem a vários separadores, um por cada projeto que tenha tarefas.

Depois de abrir, a aplicação recalcula sempre. Se o ficheiro vier de outro pacote, as datas podem ser diferentes do que o ficheiro indicava. Isso é descrito em [Datas tal como guardadas](docs://uitleg-datums-zoals-opgeslagen).

Só um ficheiro IFC se torna o **ficheiro de destino** de *Guardar*: o ficheiro para onde *Guardar* escreve de volta. Um ficheiro CSV, XML, `.mpp` ou `.xer` não se torna. Esse projeto não tem ficheiro depois de abrir; *Guardar* então pergunta onde deve ficar o novo ficheiro IFC. Assim, Ctrl+S nunca substitui o seu ficheiro original por texto IFC.

### O que guardar escreve

*Guardar* escreve sempre o projeto inteiro. Entra o seguinte:

- tarefas com estrutura, duração, datas e progresso;
- relações com desfasamento, restrições e prazos;
- calendários, recursos e atribuições, incluindo as curvas;
- linhas de base, códigos de atividade, campos personalizados e notas;
- relações externas com outros projetos;
- as definições do projeto, como a data de estado, o perfil de cálculo e as opções de cálculo;
- a ligação a uma biblioteca de recursos.

O que define no ecrã não pertence ao projeto e não é guardado com ele: o zoom, a posição de deslocamento, a tarefa selecionada e as fases recolhidas. As definições da aplicação, como o idioma e o tema, também não estão no ficheiro. A aplicação guarda-as por si, na própria aplicação ou no seu navegador.

Uma exportação para outro formato não altera o seu projeto. Depois de uma exportação, o projeto mantém o mesmo ficheiro de destino e continua marcado como *Não guardado*, se já estava antes.

### O que uma exportação perde

Cada adaptador transporta o que o respetivo formato conhece.

**MS Project XML** transporta tarefas, relações, calendários, recursos, atribuições, restrições, prazos e a data de estado. Das suas linhas de base, só a ativa é transportada. Códigos de atividade, campos personalizados, notas e relações externas não são transportados. Uma segunda restrição numa tarefa não é transportada. Uma restrição *Deve começar em (MSO)* ou *Deve terminar em (MFO)* sem a opção *Obrigatório (fixação de data)* volta como *Não começar antes de (SNET)* ou *Não terminar antes de (FNET)*. *Agendada manualmente* e o *Atraso de nivelamento* de uma tarefa não voltam. Um hammock torna-se uma tarefa normal, com datas calculadas.

**Primavera P6 XML** transporta tarefas, relações, calendários, recursos, atribuições, restrições e a data de estado. Linhas de base e prazos não são transportados, nem códigos de atividade, campos personalizados, notas e relações externas. Também aqui, um hammock torna-se uma tarefa normal. O P6 não tem desfasamento em percentagem: a aplicação converte esse desfasamento num número fixo de dias. Um desfasamento em dias de calendário torna-se um desfasamento em dias úteis.

**CSV** é uma tabela de tarefas. O ficheiro tem estas colunas para cada tarefa: task id, WBS, level, name, duration, start, finish, predecessors, work category, o id de uma categoria de trabalho personalizada (`OPS Custom Task Type ID`), status, completion, actual start e finish, critical, total float e description. Recursos, atribuições, calendários, restrições, prazos, linhas de base e a data de estado não fazem parte do ficheiro. Os cabeçalhos das colunas estão sempre em inglês.

**Só o IFC transporta o perfil de cálculo e as opções de cálculo.** Se exportar para CSV, MS Project XML ou Primavera P6 XML, o perfil não está no ficheiro. Das opções de cálculo, o MS Project XML escreve, no máximo, o limiar crítico. Um ficheiro assim abre de novo como *Open Planner Studio*. Se o seu projeto calculou com *Primavera P6* ou *Microsoft Project*, por exemplo porque veio de um `.xer` ou `.mpp`, as datas podem mudar por esse motivo. O que é um perfil de cálculo é explicado em [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen).

Se o seu projeto vier de um ficheiro Primavera (`.xer`), mesmo que o tenha guardado como IFC pelo meio, a aplicação indica, depois de uma exportação para CSV, MS Project XML ou P6 XML: *A exportação para CSV perde informações de origem XER.* Para MS Project XML indica *MSPDI* em vez de *CSV*; para P6 XML indica *P6*. Com IFC, essa mensagem não aparece: o ficheiro IFC transporta também o ficheiro de origem da Primavera. Veja [Abrir um ficheiro Primavera P6 (.xer)](docs://howto-xer-openen).

A aplicação faz ainda mais duas coisas com uma exportação. Se o planeamento estiver desatualizado, recalcula primeiro e só depois exporta. E não exporta um planeamento com uma relação circular: aparece uma mensagem com o ciclo, por exemplo *Dependência circular entre tarefas: Set up site → Demolish existing extension → Set up site*.

### Guardar, AutoSave e recuperação após falha

Estas são três coisas diferentes. Parecem iguais, mas escrevem em sítios diferentes.

**Guardar** é uma ação sua. A aplicação escreve o projeto no seu ficheiro e retira a marca *Não guardado*.

**AutoSave** vem desligado por padrão, e é o próprio utilizador que o ativa em cada projeto. A aplicação então escreve no mesmo ficheiro, sem mostrar nenhuma janela, sempre que há alterações, no máximo uma vez a cada dez segundos. Só funciona se o projeto já tiver um ficheiro. Veja [Ativar o AutoSave](docs://howto-automatisch-opslaan).

**Recuperação após falha** está sempre ativa. Assim que houver uma alteração em qualquer ponto, a aplicação guarda, também no máximo uma vez a cada dez segundos, uma cópia de recuperação de todos os projetos abertos, incluindo os projetos que não alterou diretamente. Essa cópia não está no seu ficheiro de projeto: na aplicação desktop fica na pasta de dados da aplicação, no navegador fica no armazenamento do navegador. No arranque seguinte, a aplicação oferece essa cópia. Leia sobre isso em [Recuperar após uma falha](docs://howto-herstellen-na-een-crash). A recuperação após falha nunca escreve no seu ficheiro de projeto.

Como uma cópia é guardada no máximo uma vez a cada dez segundos, pode perder os últimos segundos de trabalho numa falha.

### Desktop e navegador

A aplicação de ambiente de trabalho e a versão para navegador fazem o mesmo com o seu projeto, mas escrevem ficheiros de forma diferente.

No desktop, a aplicação trabalha com caminhos reais. *Guardar* escreve diretamente no seu ficheiro. Normalmente, a aplicação escreve primeiro num ficheiro temporário ao lado (`.ops-save.tmp`) e só depois substitui o seu ficheiro. Assim, uma falha a meio da escrita não estraga o ficheiro antigo. Se fechar a aplicação com alterações, a aplicação pergunta, para cada projeto, se quer guardar. Numa saída normal, a aplicação apaga as suas cópias de recuperação.

Num navegador que pode guardar ficheiros onde quiser (como Chrome e Edge), obtém uma janela normal de abrir e guardar. Depois disso, *Guardar* escreve diretamente no ficheiro; para um ficheiro que abriu, o navegador pede autorização uma vez. A lista *Recentes* funciona, apenas com os nomes dos ficheiros.

Num navegador sem essa capacidade (como Firefox), a aplicação abre um ficheiro através do seletor de ficheiros e guarda através de uma transferência. Com *Guardar*, a mensagem *Guardado como transferência: 'name.ifc' está na sua pasta de transferências. …* explica isto uma vez por sessão. Com *Guardar como* e com exportações, vê a mensagem *Guardado como transferência: 'name.ifc' está agora na sua pasta de transferências. Este ambiente não permite que a aplicação escreva diretamente no local escolhido.* Se o navegador consegue mostrar uma janela de guardar, mas não consegue escrever de volta no ficheiro do projeto, *Guardar* pede sempre um novo local. Uma mensagem explica isso também uma vez por sessão. *Ficheiro › Recentes* existe, mas abre uma página vazia, e o AutoSave não está disponível. Obtém a mesma mensagem em qualquer ambiente que não permita à aplicação escrever no local escolhido.

## Exemplo: exportar o projeto de exemplo

Use o exemplo *Refurbishment & Extension of a Family Home* (*Ficheiro › Exemplos*). O exemplo tem 20 tarefas, das quais 4 fases e 2 marcos, e 16 relações. Tem 6 recursos com 8 atribuições, 1 linha de base e uma ligação à *Demo resource library*. A tarefa *Demolish existing extension* tem a restrição *Não começar antes de (SNET)* a 14 de maio de 2027, e a tarefa *Handover inspection* tem um prazo a 29 de julho de 2027. O planeamento termina a 7 de julho de 2027.

Eis como o projeto volta de cada formato, medido depois de se abrir de novo o ficheiro exportado:

- O ficheiro IFC devolve tudo: 20 tarefas, 16 relações, 6 recursos, 8 atribuições, a linha de base, a restrição, o prazo e a ligação à biblioteca. O planeamento volta a terminar a 7 de julho de 2027.
- O ficheiro MS Project XML também devolve tudo, exceto a ligação à biblioteca. O planeamento termina a 7 de julho de 2027.
- O ficheiro P6 XML devolve as tarefas, relações, recursos, atribuições e a restrição. Faltam a linha de base e o prazo. O planeamento continua a terminar a 7 de julho de 2027, porque a restrição ainda lá está.
- O ficheiro CSV devolve 20 tarefas e 16 relações. Faltam os recursos, as atribuições, a linha de base, a restrição e o prazo, e o projeto chama-se *CSV Import*. Sem a restrição, as tarefas avançam: o planeamento termina a 2 de julho de 2027, cinco dias de calendário antes.

Sem essa restrição, o próprio exemplo também termina a 2 de julho de 2027. Logo, a diferença vem da restrição que o ficheiro CSV não transporta.

## Consequências e mal-entendidos

**Uma exportação não é uma cópia de segurança.** Só o IFC guarda tudo. Se quer manter o seu projeto, guarde-o como IFC. Exporte só quando alguém precisar do outro formato.

**Abrir uma exportação de novo nem sempre dá o mesmo planeamento.** A aplicação recalcula sempre ao abrir, com o perfil de cálculo que pertence ao formato. Se faltar lógica, como a restrição no exemplo CSV, ou se o perfil calcular de outra forma, o resultado muda.

**Uma exportação também aparece em *Recentes*.** No desktop e em navegadores com acesso a ficheiros, uma exportação fica em *Recentes*, tal como um projeto guardado (as folhas de progresso não). Se a abrir aí, abre-se como importação desse formato.

**Guardar não é o mesmo que recuperação após falha.** A recuperação após falha ajuda depois de uma falha, mas não substitui guardar. Por isso, guarde antes de fechar um separador ou a aplicação.

## Ver também

- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): os passos para abrir, guardar e guardar como.
- [Exportar](docs://howto-exporteren): escolher um formato e o que se obtém.
- [Datas tal como guardadas](docs://uitleg-datums-zoals-opgeslagen): porque é que um planeamento importado pode mostrar outras datas.
- [Restrições e prazos](docs://uitleg-constraints): o que faz uma restrição e, portanto, o que desaparece quando ela falta.
- [Relações e desfasamento](docs://uitleg-relaties): o que é um desfasamento e como a aplicação o calcula.
- [Criar um hammock](docs://howto-hammock): o que é um hammock, que uma exportação escreve como tarefa normal.
- [Códigos e campos personalizados](docs://howto-codes-en-velden): códigos de atividade e campos personalizados, que só o IFC guarda.
- [Relações externas com outro projeto](docs://howto-externe-relaties): relações externas que o MS Project XML e o P6 XML não transportam.
- [Guardar e gerir uma linha de base](docs://howto-baseline-opslaan-en-beheren): linhas de base, das quais o MS Project XML só transporta a ativa.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): por formato, o que é transportado e o que não é.
