# Calendários & planeamento por horas

Uma tarefa com uma duração de "5 dias" só tem significado em combinação com um calendário: que dias são dias úteis, em que horas se trabalha, e que dias caem por causa de um feriado ou de um encerramento temporário? Este guia cobre o calendário do projeto, os calendários de recursos, e o planeamento por horas opcional para quem quer planear ao pormenor da hora.

## O que vai aprender aqui

- Configurar o calendário do projeto: dias de trabalho, horários de trabalho, feriados.
- Gerar feriados automaticamente por ano, incluindo as férias da construção.
- Adicionar um encerramento único e ad hoc (por exemplo uma paragem de inverno).
- Dar a um recurso o seu próprio calendário, por exemplo para uma semana de trabalho de 4 dias.
- Ativar o interruptor principal de **Planeamento por horas** e configurar faixas/turnos de horário de trabalho.
- Como coexistem tarefas baseadas em dias e tarefas baseadas em horas no mesmo cronograma.

Siga com [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (paragem de inverno, calendário de recurso de 4 dias) e com [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (planeamento por horas para o trabalho de armaduras e betonagem), ambos também disponíveis através de **Ficheiro → Exemplos**.

## O calendário do projeto

Os calendários são geridos na janela **Calendários**, aberta através do grupo do friso **Calendário** no separador **Planeamento** (tanto o botão **Calendário** como o **Feriados** abrem a mesma janela). Esta janela mostra à esquerda uma biblioteca de todos os calendários do projeto — não apenas o calendário do projeto, mas também quaisquer calendários de recursos (veja abaixo) — com uma estrela a assinalar qual calendário é atualmente o **Calendário do projeto**. Selecione um calendário à esquerda e edite-o à direita; use **Definir como padrão do projeto** para tornar um calendário diferente da lista o novo calendário do projeto. Para o calendário selecionado, define:

- **Dias de trabalho** — quais dos sete dias da semana (Seg a Dom) contam como dia útil. Segunda a sexta-feira por predefinição.
- **Horas de trabalho** — **Início (hora)**, **Fim (hora)** e as **Horas por dia** resultantes.
- **Feriados** — uma lista de dias de folga, cada um com uma **Descrição** e uma data **De**/**Até**.

As alterações ao calendário do projeto têm efeito imediato no cálculo: as tarefas que de outra forma cairiam num dia agora não útil deslocam-se para o próximo dia útil.

### Gerar feriados automaticamente

Em vez de introduzir feriados um a um, pode gerá-los automaticamente através de **Gerar feriados…** na janela de calendário. Escolha um **País** (Países Baixos, Alemanha, Bélgica, França, Reino Unido, Áustria, Suíça) e opcionalmente uma **Região**. Para os Países Baixos há também uma opção específica de construção: **Férias da construção**, com a escolha de **Norte**, **Centro** ou **Sul** (ou **Nenhuma**). As datas de férias da construção geradas são datas indicativas — a própria aplicação avisa disso: verifique as datas exatas junto da Bouwend Nederland para o ano em curso. Depois de escolher país/região, a janela mostra uma pré-visualização — por exemplo "12 feriados, 1-1-2026–31-12-2026" — antes de clicar em **Gerar**.

Se gerar feriados para um projeto que atravessa uma fronteira de ano ou é posteriormente prolongado, o Open Planner Studio reconhece que os feriados já gerados deixaram de cobrir todo o período do projeto e a janela oferece **Gerar novamente** para adicionar os anos em falta — sem perder quaisquer feriados que tenha adicionado manualmente antes.

### Encerramentos ad hoc (por exemplo uma paragem de inverno)

Nem toda a interrupção do trabalho é um feriado anual recorrente. Para encerramentos únicos, específicos do projeto — uma semana de paragem de inverno, um encerramento local por causa de um evento — basta adicionar manualmente uma linha extra através de **Adicionar feriado** na mesma lista: dê-lhe uma **Descrição** (por exemplo "Paragem de inverno") e um período **De**/**Até**. Esse encerramento ad hoc funciona tecnicamente de forma idêntica a um feriado gerado — o cálculo CPM tem-no em conta da mesma forma — mas está separado da geração automática anual, pelo que um **Gerar novamente** subsequente não o vai substituir.

Veja um período de paragem de inverno na prática no exemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): a fundação partilhada das seis casas inclui um período de paragem de inverno adicionado como uma entrada separada do tipo feriado no calendário, à parte dos feriados neerlandeses gerados automaticamente.

## Calendários de recursos

Além do calendário único do projeto, todo o recurso pode ter o seu próprio calendário — por exemplo para um subempreiteiro que só está disponível quatro dias por semana, enquanto o resto do projeto decorre cinco dias. Os calendários de recursos são geridos através do campo **Calendário** no recurso (com o botão **Editar…** ao lado) ou o título da janela **Calendário do recurso**; por predefinição um recurso está definido para **Calendário do projeto**.

Um calendário de recurso usa o mesmo formulário que o calendário do projeto (**Dias de trabalho**, **Horas de trabalho**, **Feriados**), mas é puramente informativo para o recurso: não altera nada nas datas CPM próprias da tarefa. O que afeta é a **carga** (histograma) e o **nivelamento**: se um recurso estiver definido para uma semana de 4 dias enquanto a tarefa a que está atribuído decorre 5 dias úteis, a carga do recurso mostra um défice no quinto dia, e a janela de nivelamento (**Nivelar recursos**) avisa que o recurso não trabalha em todos os dias que a tarefa necessita — deslocar dentro da folga não resolve automaticamente essa incompatibilidade de calendário.

Veja um calendário de recurso de 4 dias na prática: os instaladores em [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) trabalham com o seu próprio calendário com uma semana de trabalho reduzida, enquanto o resto do projeto continua a decorrer no calendário do projeto normal.

## Planeamento por horas: o interruptor principal

Por predefinição, o Open Planner Studio trabalha inteiramente à **granularidade do dia** — toda a tarefa tem uma duração em dias (úteis) inteiros. Para tarefas que prefere planear à hora (pense numa betonagem que começa às 7:00 e tem de estar concluída às 14:00, bem antes de o tempo mudar), há o **Planeamento por horas** opcional.

Ative o interruptor principal através de **Definições → Linha de tempo / Zoom → Ativar planeamento por horas**. Isto adiciona uma escala temporal horária, turnos com faixas de horário de trabalho, e barras de tarefa com precisão à hora; com o interruptor desligado, a aplicação funciona inteiramente como antes, à granularidade do dia. Há também uma opção **Permitir planeamento misto de dias/horas**, que ativa se quiser combinar tarefas baseadas em dias e baseadas em horas no mesmo projeto (veja abaixo).

## Faixas de horário de trabalho e turnos

Com o planeamento por horas ativado, o calendário ganha uma camada extra: em vez de apenas "dia útil sim/não", define **faixas de horário de trabalho** por dia (a secção **Horários de trabalho** na janela de calendário) — os intervalos de tempo exatos durante os quais se trabalha. Um intervalo entre duas faixas torna-se automaticamente uma pausa; para agendar uma pausa, basta ajustar os horários das faixas adjacentes de modo que surja um intervalo.

Para não ter de desenhar faixas à mão todas as vezes, há predefinições de **turnos** já prontas:

- **Turno diurno** — horário de escritório normal, uma faixa por dia.
- **2 turnos** — dois turnos consecutivos.
- **3 turnos** — três turnos consecutivos, cobrindo quase todo o dia.
- **Turno noturno** — um turno que decorre para além da meia-noite.
- **24/7** — operação contínua, sem interrupção.

Além destas predefinições, também pode **Definir por dia da semana…** as faixas totalmente à mão, por exemplo se a sexta-feira for mais curta do que o resto da semana. Montou uma combinação própria que quer reutilizar mais vezes? Guarde-a com **Guardar como predefinição…** — a predefinição fica armazenada localmente neste dispositivo e pode depois ser escolhida novamente em qualquer projeto. A secção também mostra as **Horas/dia derivadas**: o número de horas de trabalho efetivas que resulta das faixas configuradas.

## Tarefas baseadas em horas

Com o planeamento por horas ativado e uma tarefa num **calendário horário** (um calendário com faixas de horário de trabalho em vez de apenas dias inteiros), a janela de edição de tarefa mostra campos extra: **Duração (horas)** junto de **Duração (dias)**, e um total em **Total de horas**. É necessário um calendário horário para a introdução de horas — tente introduzir horas num calendário de dias normal e a sugestão assinala isso.

É exatamente assim que as tarefas de betonagem são agendadas na prática: uma tarefa "Vloer storten toren A" (Betonar piso torre A) com uma duração de, digamos, 6 horas, ligada a um calendário de turnos que tem um turno da manhã nesse dia. Veja este padrão no grande exemplo [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), que usa o planeamento por horas para o trabalho de armaduras e betonagem.

## Misturar tarefas baseadas em dias e em horas

Um projeto não tem de decorrer inteiramente por horas para beneficiar do planeamento por horas: com **Permitir planeamento misto de dias/horas** assinalado, as tarefas baseadas em dias (no calendário normal do projeto) e as tarefas baseadas em horas (num calendário horário) podem coexistir e relacionar-se entre si no mesmo cronograma. Nesse caso, a tabela de tarefas mostra a duração de cada tarefa na sua própria unidade — uma tarefa de dias em dias, uma tarefa de horas em horas — e avisa no fundo da tabela quando tarefas com horas/dia diferentes decorrem lado a lado, para que se mantenha claro quais comparações são diretas e quais não são.

## Continue a ler

- Veja uma paragem de inverno e um calendário de recurso de 4 dias na prática: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Veja o planeamento por horas para o trabalho de armaduras e betonagem na prática: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- As relações e o atraso/avanço trabalham com as mesmas unidades de calendário — leia [Relações & restrições](docs://gids-relaties-constraints) para a diferença entre atraso em dias úteis e em tempo decorrido.
