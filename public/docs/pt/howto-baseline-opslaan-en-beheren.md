# Guardar e gerir uma linha de base

Objetivo: registe o planeamento como acordo (uma linha de base), para poder ver mais tarde até que ponto a execução se desvia, e mantenha, altere o nome, escolha e elimine várias linhas de base.

## Quando precisa disto

Registe uma linha de base quando o planeamento tiver sido aprovado e o trabalho ainda não tiver começado. Se o planeamento for revisto mais tarde de forma formal, por exemplo após uma ordem de alteração, guarda uma segunda linha de base e mantém a primeira. Assim, mede a execução contra o primeiro acordo e contra o acordo revisto. O que uma linha de base regista exatamente e como a aplicação calcula o desvio é explicado em [Progresso, data de estado e linha de base](docs://uitleg-voortgang).

## Passos

### Guardar uma linha de base

1. Prima **Calcular** (F5), por exemplo através de *Planeamento › Agendamento › Calcular*. A linha de base regista as datas que são calculadas nesse momento.
2. Escolha *Planeamento › Linhas de base e progresso › Gerir linhas de base…*. Abre-se a janela *Linhas de base*.
3. Em *Guardar nova linha de base* há um nome sugerido, por exemplo *Linha de base 1 — (data de hoje)*. Escreva um nome à sua escolha que reconheça mais tarde, por exemplo *Linha de base*.
4. Clique em *Guardar*. A linha de base está agora na lista e fica imediatamente a linha de base ativa.
5. Clique em *Fechar*.

Por baixo de cada barra de tarefa no Gantt há agora uma barra fina com as datas da linha de base; um marco recebe um pequeno losango. Ative ou desative essa sobreposição com *Visualização › Linhas de base e progresso › Sobreposição da linha de base*.

### Escolher a linha de base ativa

Abra *Gerir linhas de base…* e escolha, na coluna *Ativa*, a linha de base com que quer comparar. Enquanto existirem linhas de base, exatamente uma está ativa. A sobreposição do Gantt, o tipo de relatório *Variance* e o *Relatório de progresso* usam-na.

### Alterar o nome de uma linha de base

Altere o nome na lista. A alteração aplica-se de imediato; não tem de clicar em *Guardar*.

### Eliminar uma linha de base

Clique no pequeno cesto do lixo ao lado da linha de base na lista. Se eliminar a linha de base ativa, a aplicação pergunta *Eliminar a linha de base ativa?*. Depois, a linha de base mais recente que restar passa a ser a ativa. Se não houver outra, deixa de haver linha de base ativa e a sobreposição desaparece. Com Ctrl+Z repõe uma linha de base eliminada. Feche primeiro a janela; o Ctrl+Z não funciona dentro de uma janela.

### Desvios na tabela de tarefas

Cada linha de base tem seis colunas na tabela de tarefas. Clique no **+** à direita do cabeçalho da tabela de tarefas (*Adicionar coluna*) e abra a categoria *Linha de base*. Por linha de base existem *Início planeado*, *Fim planeado*, *Duração*, *Desvio de início*, *Desvio de fim* e *Desvio de duração*, com o nome da linha de base à frente, por exemplo *Linha de base — Desvio de fim*. Os desvios são expressos em dias úteis: um sinal de mais significa mais tarde, um sinal de menos significa mais cedo. Uma tarefa que não está na linha de base mostra um travessão (—) nessas colunas.

## Armadilhas e o que a aplicação faz

**Um planeamento desatualizado.** Se o planeamento estiver desatualizado, a janela mostra *A planificação está desatualizada — recalcule primeiro (F5)*. Trata-se de um aviso; continua a ser possível guardar. Mas, nesse caso, guarda as datas antigas. Feche a janela, prima **Calcular** e só depois guarde.

**Uma linha de base com progresso.** Se guardar uma linha de base depois de ter introduzido o progresso, ela regista o estado com essas datas reais. O desvio fica então a zero e já não diz nada sobre a execução. Registe a linha de base antes de o trabalho começar.

**Uma linha de base não pode ser atualizada.** Se quiser rever o acordo, guarde uma nova linha de base e elimine a antiga, se necessário.

**Um ⚠ em Duração ou Desvio de duração.** Em tarefas em horas, um dia é o tempo de trabalho do respetivo calendário. Se o calendário tiver horas por dia próprias (por exemplo 8, com faixas de 10 horas, vindo do Primavera P6), uma versão anterior da aplicação contava os dias de outra forma. Uma linha de base dessa versão mantém o número antigo: uma tarefa de 1870 horas corresponde a 233,75 dias na linha de base e a 187 dias agora. A aplicação não converte essa linha de base. As colunas *Duração* e *Desvio de duração* dessa linha de base mostram então um ⚠; passe o cursor por cima dele para ver a explicação. As datas da linha de base estão corretas. Guarde uma nova linha de base e elimine a antiga, se necessário.

**Só tarefas sem subtarefas.** Uma fase não está na linha de base: não tem barra de linha de base nem desvio. A fase resulta das tarefas que estão abaixo dela.

**Tarefas novas e eliminadas.** Uma tarefa que acrescenta depois de guardar não tem barra de linha de base. No relatório de variance aparece como *Nova*. Uma tarefa que elimina aparece como *Eliminada*.

**Mover projeto.** Na janela *Mover projeto…*, assim que existirem linhas de base, aparece a caixa de verificação *Deslocar também as linhas de base*. Por padrão está desligada: as linhas de base mantêm-se onde estão, pelo que a deslocação aparece como desvio. Veja [Mover um projeto](docs://howto-project-verplaatsen).

**Guardado no ficheiro do projeto.** As linhas de base e a escolha ativa são guardadas com o projeto e voltam quando abre o ficheiro.

## Ver também

- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): o que uma linha de base regista e como se calcula o desvio.
- [Mover um projeto](docs://howto-project-verplaatsen): a caixa de verificação *Deslocar também as linhas de base*.
- [Atualizar o progresso](docs://howto-voortgang-bijwerken): introduzir o estado real que compara com a linha de base.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): uma linha de base (*Baseline at start*) antes do início, com progresso e data de estado de 20 de maio de 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): duas linhas de base, *Contract* e *Re-baseline (variation order)*, com progresso e data de estado de 5 de julho de 2027.
