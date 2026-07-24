# Informações do projeto

A janela **Informações do projeto** contém os metadados do projeto mais a secção **Cálculo** com as opções de agendamento. O mesmo formulário também funciona como o assistente de projeto para **Novo**.

## Abrir

- **Definições** (separador do friso) → grupo do friso **Projeto** → **Info do projeto**.
- Janela de definições (engrenagem ⚙) → separador **Geral** → **Informações do projeto...**
- **Ficheiro** → **Info do projeto** — uma variante simplificada na Backstage, apenas com os campos de metadados (sem secção de Cálculo).

**Aplicar** confirma todas as alterações de uma vez; **Cancelar**, **Esc** ou um clique fora da janela descarta-as. **Enter** faz o mesmo que Aplicar.

## Metadados

- **Nome do projeto** — o nome na barra de título e no separador do documento.
- **Descrição** — texto livre.
- **Engenheiro** e **Empresa** — texto livre; guardado no ficheiro IFC.
- **Data de início** — o início do projeto a partir do qual o cálculo conta.
- **Data de fim** — fim informativo do projeto.

## Cálculo

Opções de agendamento para este projeto — são guardadas com o ficheiro, não com a aplicação, pelo que viajam para outras máquinas. Se alterar algo aqui, o cronograma é recalculado automaticamente após **Aplicar**.

- **Definição de crítico** — **Folga total ≤ limiar** (com **Limiar (dias úteis)**, predefinição 0) ou **Caminho mais longo**.
- **Cálculo da folga** — **Menor (início/fim)** (predefinição), **Folga de início** ou **Folga de fim**.
- **Tarefas de extremidade aberta críticas** — marca as tarefas sem sucessora como críticas.
- **Marcar quase crítico** — assinalar revela um **Limiar** extra (predefinição 2 dias úteis; a unidade segue a exibição da Duração, por isso possivelmente horas): as tarefas com pouca folga recebem a marcação "quase crítica".
- **Múltiplos caminhos de folga** — assinalar revela o **Método** (**Folga livre (peeling)** ou **Folga total (classificação)**) e **Caminhos máx.** (predefinição 10): o cálculo numera então os caminhos de folga mais importantes.
- **Calendário de atraso** — qual calendário conta o atraso de uma relação: **Predecessora** (predefinição), **Sucessora**, **24 horas** ou **Calendário do projeto**.

Como ler estes resultados está coberto em [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse).

## O assistente de projeto (Novo)

**Novo** abre a mesma janela como um assistente (título **Novo projeto**, botão **Criar**). Além dos campos de metadados, o assistente contém:

- **Modelo de fases** — **Vazio**, **Construção residencial** ou **Construção comercial / renovação**: preenche o novo projeto com uma estrutura de fases.
- **Turno** — só visível com o planeamento por horas ativado: **Turno diurno** (predefinição), **2 turnos**, **3 turnos** ou **24/7**.
- **Conjunto de feriados** — gera o calendário do projeto: escolha um país (com região e férias da construção quando aplicável), **Sem feriados**, ou **Personalizado…** — este último abre o diálogo de calendário logo após a criação, para poder compor o calendário à mão. Veja [Diálogo de calendário](docs://ref-kalenderdialoog).

A secção Cálculo está ausente do assistente; defina-a depois através de uma das entradas acima.
