# Gestão de baselines

A janela **Baselines** gere as fotografias guardadas do cronograma: guardar, renomear, escolher a baseline ativa e eliminar.

## Abrir

**Planeamento** → grupo do friso **Baselines e progresso** → **Guardar baseline…** ou **Gerir baselines…** (ambas abrem a mesma janela). **Esc**, **Fechar**, a cruz de fecho ou um clique fora da janela fecha; todas as alterações nesta janela têm efeito imediato.

## A tabela de baselines

Uma linha por baseline guardada:

- **Ativa** — botão de opção; exatamente uma baseline pode estar ativa. A baseline ativa é a base de comparação para a sobreposição da baseline no Gantt e o relatório de variância.
- **Nome** — editável diretamente na linha.
- **Criada** — a data em que a baseline foi guardada.
- **Eliminar** (caixote do lixo) — remove a baseline. Se for a ativa, a janela pede primeiro confirmação ("Eliminar a baseline ativa?"); depois disso, a baseline restante guardada mais recentemente torna-se ativa, ou nenhuma se não sobrar nenhuma.

Sem baselines, a janela mostra "Ainda não há baselines".

## Guardar nova baseline

- **Campo de nome** — pré-preenchido com "Baseline {n} — {data}"; ajuste o nome como desejar.
- **Guardar** — regista o início, o fim e (para marcos) a data de cada tarefa e torna a nova baseline ativa.
- **Aviso** — se o cronograma estiver desatualizado desde o último cálculo, aparece "A planificação está desatualizada — recalcule primeiro (F5)": uma dica, não um bloqueio. Uma baseline sobre um cronograma desatualizado congelaria as datas erradas.

## Leitura adicional

- [Baselines & progresso](docs://gids-baselines-voortgang) — sobreposição da baseline, relatório de variância, progresso e data de estado.
