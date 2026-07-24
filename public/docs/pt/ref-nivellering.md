# Opções de nivelamento

A janela **Nivelar recursos** resolve a sobrealocação deslocando tarefas. Funciona em dois passos: **Calcular** constrói uma proposta (nada muda ainda), **Aplicar** executa-a.

## Abrir

**Recursos** → grupo do friso **Nivelamento** → **Nivelar…**. **Esc**, a cruz de fecho ou um clique fora da janela fecha sem aplicar.

## Opções

- **Nivelar apenas dentro da folga (suavização) — a data de fim do projeto mantém-se fixa** — quando assinalado, o nivelamento apenas desloca tarefas dentro da sua folga total: a data de fim não pode mover-se, mas nem todos os conflitos podem então ser resolvidos. Não assinalado (predefinição), a data de fim do projeto pode prolongar-se para resolver todos os conflitos.
- **Recursos** — uma caixa de verificação por recurso: quais os recursos que participam. Os recursos de material estão ausentes aqui (o material não é nivelado). Todos os recursos estão ligados por predefinição.

## Calcular

Requer um cálculo atualizado; caso contrário a janela mostra "Calcule primeiro a planificação (F5) antes de nivelar." O botão também fica desativado enquanto nenhum recurso estiver assinalado. Qualquer alteração de opção invalida uma proposta anterior — calcule de novo.

## Proposta (pré-visualização)

- **Linha da data de fim do projeto** — "inalterada (data)" ou "data antiga → nova data" (vermelho) se o projeto se prolongar.
- **Tabela** — por tarefa deslocada: **Tarefa**, **Início anterior**, **Novo início** e **Dias deslocados**. As sucessoras sem recurso que se deslocam através da lógica também são incluídas.
- Se não houver nada a fazer, a janela reporta "Nenhuma tarefa precisa de ser deslocada — a planificação já está livre de conflitos."

## Conflitos restantes

Tarefas que não cabem dentro das regras, com por tarefa o número de dias de conflito e um motivo:

- "… atinge um pico de … unidades/dia, a capacidade é … — não é possível resolver deslocando." — uma atribuição exige mais no seu pico do que a capacidade do recurso; baixe as unidades/dia ou aumente as Unidades máx.
- "O recurso não trabalha em todos os dias que esta tarefa necessita — deslocar não resolve isto." — incompatibilidade de calendário entre a tarefa e o recurso.
- "Não há capacidade livre suficiente dentro da folga para resolver este conflito." — principalmente com suavização: não há janela livre dentro da folga disponível.

## Aplicar e desfazer

**Aplicar** executa a proposta e fecha a janela; **Cancelar** fecha sem alterações. Desfaça um nivelamento aplicado com **Limpar nivelamento** (mesmo grupo do friso) ou Ctrl+Z.

## Leitura adicional

- [Recursos, histograma & nivelamento](docs://gids-resources-histogram) — detetar sobrealocação no histograma e o fluxo de trabalho completo de nivelamento.
