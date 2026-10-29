# Novo projeto e Definições do projeto

Os campos da janela *Novo projeto* e de *Definições do projeto*: o que faz cada campo, qual é o padrão e onde tem efeito. São dois lados do mesmo formulário. *Novo projeto* cria um projeto e tem alguns campos extra. *Definições do projeto* altera o projeto que tem aberto.

## Abertura

**Novo projeto** — *Ficheiro › Novo*, Ctrl+N, ou o sinal de mais à direita dos separadores de documentos (*Iniciar projeto*, depois *Novo projeto*). A janela abre com o cursor em *Nome do projeto*.

**Definições do projeto** — *Definições › Projeto › Definições do projeto* abre o formulário numa janela com o título *Definições do projeto*. *Ficheiro › Definições do projeto* mostra o mesmo formulário no ecrã *Ficheiro*. O bloco *Perfil de cálculo e opções* está em baixo nos dois sítios; o que contém está em [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies).

## Criar, Aplicar e cancelar

**Criar** (em *Novo projeto*) cria o projeto. Se o separador atual estiver vazio e sem alterações, a aplicação usa esse separador; caso contrário, o projeto abre num separador novo. **Aplicar** (em *Definições do projeto*) grava as alterações no projeto.

- **Só ao aplicar.** Escreve num rascunho. O projeto só muda quando clica em *Aplicar*. *Aplicar* grava apenas o que alterou, num único passo em *Desfazer*. Se clicar em *Aplicar* sem alterar nada, não acontece nada e não é criado nenhum passo.
- **Cancelar, a cruz e Esc** fecham a janela sem guardar nada. Um clique ao lado da janela não a fecha: o que escreveu fica.
- **Enter** faz o mesmo que *Criar* ou *Aplicar*, exceto no campo *Descrição* e numa lista pendente aberta.
- **No ecrã Ficheiro** *Definições do projeto* mostra *Alterações não aplicadas — clique em Aplicar para as manter.* em baixo enquanto o rascunho for diferente. Se depois sair do ecrã, a aplicação pergunta se quer aplicar, descartar ou cancelar. Veja [O friso, separador a separador](docs://ref-lint).
- **Um perfil de cálculo personalizado sem nome** bloqueia *Aplicar* e *Criar*. Dê-lhe um nome ou descarte a alteração.

## Campos nas duas janelas

**Nome do projeto** — o nome do projeto na barra do título, no separador e no nome do ficheiro quando o guardar. Padrão: vazio. Um campo vazio é permitido: o projeto chama-se então *Novo planeamento*, mostrado como texto cinzento no campo. Onde: o ecrã inteiro.

**Descrição** — texto livre. Padrão: vazio. Efeito: fica guardado com o projeto, no ficheiro IFC e na exportação para Primavera P6 XML, e não tem influência no planeamento.

**Autor** — texto livre. Padrão: vazio. Efeito: entra no ficheiro IFC e aparece como *Autor:* no cabeçalho de um relatório, onde não o pode escrever de novo.

**Biblioteca de recursos** — a biblioteca de recursos à qual o projeto está ligado. Escolha entre *nenhuma (projeto autónomo)*, as suas bibliotecas existentes e *+ Nova biblioteca de recursos…*. Padrão: em *Novo projeto* a biblioteca padrão, em *Definições do projeto* a ligação atual. Efeito: veja [Utilizar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken). Com *+ Nova biblioteca de recursos…* escreve um nome num campo abaixo; a biblioteca só é criada em *Criar* ou *Aplicar*, por isso cancelar não deixa nada para trás. Uma ligação em *Definições do projeto* só muda se mexer neste campo.

**Cliente/organização** — texto livre. Padrão: vazio. Efeito: entra no ficheiro IFC e aparece como *Empresa:* no cabeçalho de um relatório.

**Data de início** — o início do projeto. Padrão: em *Novo projeto*, a data de hoje. O que o campo faz está abaixo, em *O que faz a data de início*.

**Data de fim** — o fim planeado do projeto. Padrão: vazio. Efeito: uma informação, não um requisito: a aplicação não planeia até esta data. Aparece no cabeçalho de um relatório e nas exportações, e determina até que ano são gerados os feriados. Só num ficheiro Primavera com a definição *Calcular a folga até à data de fim do projeto* (veja [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies)) é que o cálculo da folga vai até esta data.

**Unidade predefinida para novas tarefas** — só visível quando *Ativar planeamento por horas* está ligado. Escolha entre *Dias* e *Horas*. Padrão: *Dias*. Efeito e condições: veja [Ativar planeamento por horas](docs://howto-urenplanning-aanzetten).

**Perfil de cálculo e opções** — em *Definições do projeto* o bloco inteiro; em *Novo projeto* só a lista pendente *Perfil de cálculo* com *Primavera P6*, *Microsoft Project* e *Open Planner Studio*. Padrão: *Open Planner Studio*. Escolher um perfil também define as opções padrão desse perfil. Veja [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies).

## Só em Definições do projeto

**Esquema IFC ao guardar** — o esquema IFC que fica no cabeçalho do ficheiro guardado. Escolha entre *IFC 4.3 ADD2 (padrão)*, *IFC 4.3* e *IFC4*. Padrão: *IFC 4.3 ADD2 (padrão)*; para um ficheiro IFC aberto, o esquema desse ficheiro. Efeito: só o cabeçalho do ficheiro muda, não o conteúdo. Use-o para juntar o planeamento a um modelo de edifício no mesmo esquema. Se um ficheiro aberto tiver outro esquema que o padrão, a aplicação pergunta da primeira vez que guarda se mantém esse esquema; uma escolha aqui conta como resposta. Outra escolha aqui não é um passo em *Desfazer*: o esquema pertence ao ficheiro. Veja [Escolher o esquema IFC](docs://howto-ifc-schema-kiezen).

## Só na janela Novo projeto

**Modelo de faseamento** — as fases com que o projeto começa. Escolha entre *Vazio*, *Construção residencial* e *Construção comercial / renovação*. Padrão: *Vazio*. Efeito: *Vazio* dá um projeto sem tarefas. As outras duas põem oito tarefas de fase prontas, cada uma com uma duração de 5 na unidade predefinida do projeto (5 dias úteis, ou 5 horas se escolher *Horas* em *Unidade predefinida para novas tarefas*) e sem relações. Pode renomeá-las, movê-las e alargá-las. Para *Construção residencial* são estas: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking e Oplevering. Para *Construção comercial / renovação*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen e Oplevering. Os nomes são dados do seu projeto e ficam em neerlandês, também noutra língua da interface. Se *Ativar o modo construção* estiver desligado, só existe *Vazio*. Veja [Definições da aplicação](docs://ref-instellingen).

**Turno** — só visível quando *Ativar planeamento por horas* está ligado. Escolha entre *Turno diurno*, *2 turnos*, *3 turnos* e *24/7*. Padrão: *Turno diurno*. Efeito: *Turno diurno* deixa o calendário padrão como está, um calendário de dia normal de segunda a sexta. Os outros três põem faixas de tempo de trabalho no calendário do projeto, como os botões com o mesmo nome na janela *Calendários*. Os horários estão em [Definir os tempos de trabalho](docs://howto-werktijden-instellen). Com *Turno diurno*, não é possível escolher *Horas* em *Unidade predefinida para novas tarefas*, porque um calendário de dia não tem faixas de trabalho.

**Conjunto de feriados** — os dias de folga que o calendário do projeto recebe. Em *País* escolhe *Países Baixos* (padrão), *Alemanha*, *Bélgica*, *França*, *Reino Unido*, *Áustria*, *Suíça*, *Sem feriados* ou *Personalizado…*. Se o país tiver regiões, é acrescentada uma lista pendente *Região*. Para os Países Baixos escolhe também, se *Ativar o modo construção* estiver ligado, as *Férias da construção*: *Nenhuma* (padrão), *Norte*, *Centro* ou *Sul*. Por baixo há uma linha como *36 feriados, 2025–2029*, que expande para ver a lista. Os anos vão do ano antes da data de início até ao ano depois da data de fim, ou até três anos depois do ano de início se não houver data de fim. *Personalizado…* dá um calendário sem feriados e abre logo a seguir a janela *Calendários*, para o preencher por si. O calendário do projeto chama-se *Bouwkalender NL*, ou *Standaardkalender* se *Ativar o modo construção* estiver desligado; a escolha é então também *Sem feriados*. Como o gerador funciona está em [Gerar feriados e as férias da construção](docs://howto-feestdagen-genereren).

## O que faz a data de início

A data de início é a âncora do projeto. Três regras:

- **As tarefas novas começam na data de início.** Uma tarefa que adiciona recebe o início do projeto como início planeado.
- **Uma tarefa com predecessora nunca começa antes da data de início.** Se o fim da predecessora for mais cedo, a tarefa espera até à data de início. Uma tarefa *sem* predecessora mantém a sua própria data, mesmo que fique antes da data de início. Isso é necessário para mostrar um planeamento do MS Project ou do Primavera da mesma forma que o programa de origem o mostra. Uma restrição *Deve começar em (MSO)* ou *Deve terminar em (MFO)* quebra as duas regras: essa tarefa fica na sua data, mesmo que essa data caia antes da data de início.
- **Uma data de início posterior move as tarefas soltas.** Se definir uma data de início posterior em *Definições do projeto* e clicar em *Aplicar*, as tarefas sem predecessora e sem restrição que defina um limite inferior (*Não começar antes de*, *Deve começar em*, *Não terminar antes de* ou *Deve terminar em*) que ficaria antes da nova data movem-se para essa data, no mesmo passo em *Desfazer*. A aplicação diz quantas tarefas foram movidas. Isso só acontece quando se altera a data de início, nunca ao abrir um ficheiro. Definir uma data de início posterior não move o resto do planeamento: *Mover projeto* faz isso, veja [Mover um projeto](docs://howto-project-verplaatsen).

## Ver também

- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): o bloco *Perfil de cálculo e opções*.
- [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen): porque é que um perfil muda o resultado.
- [Mover um projeto](docs://howto-project-verplaatsen): todo o planeamento para outro início.
- [Adicionar tarefas e marcos](docs://howto-taken-en-mijlpalen-toevoegen): começar pelas primeiras tarefas.
- [Gerar feriados e as férias da construção](docs://howto-feestdagen-genereren): o conjunto de feriados em pormenor.
- [Escolher o esquema IFC](docs://howto-ifc-schema-kiezen): guardar para um modelo de edifício em IFC4.
