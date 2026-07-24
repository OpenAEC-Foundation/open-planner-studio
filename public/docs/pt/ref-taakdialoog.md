# Diálogo de tarefa

A janela **Editar tarefa** mostra todas as propriedades de uma tarefa — os mesmos campos e secções do painel de propriedades à direita, mas numa janela com um passo de gravação explícito.

## Abrir

- **Duplo clique** numa tarefa no Gantt.
- **F2** com uma tarefa selecionada.
- **Clique com o botão direito** numa tarefa → **Editar...**

## Guardar e cancelar

- **Guardar** aplica todas as alterações de campo de uma vez; o botão fica desativado enquanto o nome estiver vazio. **Enter** faz o mesmo que Guardar (exceto dentro de uma caixa de texto multilinha).
- **Cancelar**, **Esc**, a cruz de fecho ou um clique fora da janela fecha sem aplicar as alterações de campo.
- Exceção: as secções **Dependências**, **Atribuições** e **Códigos e campos** funcionam diretamente sobre o cronograma (idêntico ao painel) — as alterações aí têm efeito imediato, mesmo que cancele a seguir.

## Campos

- **Nome \*** — obrigatório; recebe automaticamente o foco quando o diálogo abre.
- **Código WBS** — introdução livre. Com a numeração automática de WBS ativada (Planeamento → Estrutura) o campo fica bloqueado: a aplicação gere os códigos.
- **Descrição** — texto livre.
- **Tipo** — o tipo de tarefa (por exemplo Construção); determina a codificação de cor da barra.
- **Calendário** — **Calendário do projeto** ou um calendário específico da biblioteca; determina os dias de trabalho desta tarefa.
- **Tarefa pai** — mova a tarefa para outro pai, ou **- Nenhuma (raiz) -**. Este campo só existe no diálogo; no painel, a reestruturação faz-se arrastando ou indentando/diminuindo indentação.

## Notas

Uma lista de verificação por tarefa: cada linha tem uma **caixa de verificação de concluído**, uma caixa de texto e um botão de remover; **Adicionar nota** cria uma nova linha. As linhas concluídas ficam riscadas. Veja [Planeamento & WBS](docs://gids-plannen-wbs).

## Marco

- **Marco** — assinalar define a duração para 0 e mostra o losango em vez de uma barra.
- **Tipo de marco** — **Automático**, **Marco de início** ou **Marco de fim**.
- **Obrigatório (contratual)** — assinala o marco como contratual.

## Tempo

- **Data de início** — mostra o início mais cedo calculado; uma alteração manual fixa a nova data como o início planeado.
- **Duração (dias úteis)** — dias úteis inteiros; desativado para um marco.
- Com o **planeamento por horas ativado** e um calendário horário na tarefa, aparecem três caixas sincronizadas: **Dias**, **Horas** e **Total de horas** (apenas números inteiros). Sem um calendário horário aparece uma dica: "A introdução em horas requer um calendário horário (horários de trabalho)." Veja [Calendários & planeamento por horas](docs://gids-kalenders-uren).

## Hammock (duração derivada)

Apenas numa tarefa sem subtarefas que não seja um marco. Assinalar torna a duração derivada: o intervalo entre o **Driver de início** (relação FS/SS de entrada) e o **Driver de fim** (relação FF/SF de entrada), ambos mostrados só de leitura. Se faltar um driver de fim, o diálogo reporta que o intervalo volta a um comprimento zero. Veja [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse).

## Restrição e prazo

- **Restrição** — O mais cedo possível (ASAP), O mais tarde possível (ALAP), Não começar antes de (SNET), Não começar depois de (SNLT), Não terminar antes de (FNET), Não terminar depois de (FNLT), Deve começar em (MSO) ou Deve terminar em (MFO); com uma **Data da restrição** quando aplicável.
- **Obrigatório (fixação de data)** — apenas MSO/MFO: fixa rigidamente a data e substitui a lógica das relações; uma violação torna-se folga negativa a montante.
- **Restrição secundária** — um segundo limite (SNET/FNET/SNLT/FNLT) com uma **Data secundária**; não é possível com uma fixação rígida. As combinações proibidas ficam a vermelho com um motivo.
- **Prazo** — uma data-alvo fora do cálculo; não a cumprir dá um aviso, não uma deslocação. Veja [Relações & restrições](docs://gids-relaties-constraints).

## Progresso

- **Progresso (%)** — controlo deslizante de 0–100%.
- **Início real** / **Fim real** — factos registados; para um marco, um único campo **Data real**. As datas posteriores à data de estado são rejeitadas.
- **Restante (dias úteis)** — só de leitura, derivado de duração × (1 − progresso). Veja [Baselines & progresso](docs://gids-baselines-voortgang).

## Resultado CPM (só de leitura)

**Início mais cedo/fim mais cedo**, **Início mais tarde/fim mais tarde**, **Folga total**, **Folga livre**, **Folga interferente** (quando calculada) e **Caminho crítico** (sim/não). Preenchido após um cálculo (F5).

## Dependências

Todas as relações desta tarefa: direção (→ sucessora, ← predecessora), a outra tarefa, um ícone de relâmpago na **relação determinante**, o tipo de relação (FS/SS/FF/SF), o **atraso** (por exemplo 2d, 3ed, 50%) e um botão de remover. As alterações têm efeito imediato.

## Atribuições

Por recurso atribuído: nome, **Unid./dia**, **Curva**, **Mover para…** (mover a atribuição para outra tarefa) e remover; no fundo **Atribuir recurso**. Não é possível em marcos ou tarefas de resumo. Tem efeito imediato. Veja [Recursos, histograma & nivelamento](docs://gids-resources-histogram).

## Códigos e campos

Só visível quando o projeto tem tipos de código de atividade ou campos personalizados: um seletor de valor por tipo de código, uma introdução tipada por campo personalizado. Tem efeito imediato. As definições são geridas no diálogo de estrutura — veja [Códigos & campos](docs://ref-codes-velden).
