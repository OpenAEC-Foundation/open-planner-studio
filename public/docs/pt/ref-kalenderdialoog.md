# Diálogo de calendário

A janela **Calendários** gere a biblioteca de calendários do projeto: a lista de todos os calendários à esquerda, o formulário de edição do calendário selecionado à direita.

## Abrir

- **Planeamento** → grupo do friso **Calendário** → botão **Calendário** ou **Feriados**.
- **Definições** (separador do friso) → grupo do friso **Calendário** → **Calendário**.
- A partir do assistente de projeto: escolher **Personalizado…** como calendário abre esta janela após a criação.

## Aplicar e cancelar

Todas as edições — incluindo novo/duplicar/eliminar — acontecem numa cópia de trabalho. **Aplicar** (ou **Enter**) escreve tudo de uma vez e recalcula o cronograma; **Cancelar**, **Esc**, a cruz de fecho ou um clique fora da janela descarta todas as alterações.

## Biblioteca (coluna esquerda)

- **Lista** — todos os calendários; a estrela assinala o **Calendário do projeto** (a predefinição para tarefas sem calendário próprio).
- **+** — **Novo calendário**.
- **Duplicar** — cópia do calendário selecionado.
- **Eliminar** — não é possível para o último calendário; eliminar a predefinição do projeto torna outro calendário na predefinição.
- **Definir como padrão do projeto** — torna o calendário selecionado no calendário do projeto (botão acima do formulário).

## Formulário (coluna direita)

- **Nome** — nome livre.
- **Dias de trabalho** — botões **Seg** até **Dom**; ligado = dia útil. Predefinições: **Seg–sex** (semana padrão, 07–16 h, 8 h/dia) e **Contínuo (24/7)**.
- **Início (hora)** / **Fim (hora)** / **Horas por dia** — o horário de trabalho abrangendo todo o dia. Oculto assim que o calendário tem faixas de horário de trabalho e o planeamento por horas está ativado; as faixas determinam então os horários.

## Horários de trabalho (apenas com planeamento por horas ativado)

- **Horas/dia derivadas** — valor de verificação, derivado das faixas.
- Predefinições: **Turno diurno**, **2 turnos**, **3 turnos**, **Turno noturno**, **24/7** — cada uma define as faixas de horário de trabalho de uma vez.
- **Guardar como predefinição…** — guarde os horários de trabalho atuais como a sua própria predefinição (neste dispositivo); as predefinições próprias aparecem como botões com uma cruz de eliminar.
- **Definir por dia da semana…** / **Mostrar/ocultar horários de trabalho** — abre ou recolhe o editor de faixas.
- **Editor de faixas** — por dia da semana uma lista de faixas horárias (início–fim), cada uma com uma caixa de verificação de **dia seguinte** (turno noturno através da meia-noite), **Adicionar faixa** (um intervalo entre duas faixas é uma pausa), **Copiar para todos os dias úteis**, o total de horas por dia e as horas/dia derivadas no fundo. Veja [Calendários & planeamento por horas](docs://gids-kalenders-uren).

## Gerar feriados…

Gera a lista de feriados com base em regras ao longo do período do projeto:

- **País** — Países Baixos, Alemanha, Bélgica, França, Reino Unido, Áustria, Suíça ou **Sem feriados**.
- **Região** — apenas para países com conjuntos regionais; predefinição **Nacional**.
- **Férias da construção** — apenas Países Baixos: **Nenhuma**, **Norte**, **Centro** ou **Sul**; com uma dica de que estas são datas indicativas.
- **Pré-visualização** — linha de resumo ("n feriados, ano–ano"), expansível para a lista completa.
- **Gerar** substitui a lista de feriados; **Cancelar** fecha o bloco.
- Se o projeto agora decorrer além dos anos gerados, aparece uma dica no topo com um botão **Gerar novamente**.

## Feriados

A própria lista: por linha **Descrição**, **De**, **Até** e um botão de remover; **Adicionar feriado** cria uma nova linha. Períodos de vários dias (férias da construção, paragem de inverno) são simplesmente uma linha com um intervalo De–Até mais longo.
