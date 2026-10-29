# Abrir um ficheiro do MS Project (.mpp)

Objetivo: abrir um planeamento do Microsoft Project diretamente na aplicação, sem o exportar primeiro.

## Quando precisa disto

Um empreiteiro, um consultor ou um cliente envia-lhe o planeamento como ficheiro `.mpp`. Quer vê-lo, calculá-lo ou desenvolvê-lo mais. A aplicação lê ficheiros `.mpp` desde o MS Project 2010 até 2021, inclusive. Só lê: não escreve `.mpp` e nunca altera o seu ficheiro. Do ficheiro retira o próprio planeamento: tarefas com estrutura, duração e restrições, relações com desfasamento, calendários, recursos, atribuições e progresso. Também lê as datas e a folga que o MS Project calculou sozinho, mas usa-as apenas para a vista *Datas tal como registadas*, nunca como entrada.

## Passos

1. Escolha *Início › Ficheiro › Abrir* ou prima Ctrl+O. Escolha o ficheiro `.mpp`.
2. O projeto abre-se num novo separador, ou no separador atual se este ainda estava vazio e sem alterações. O projeto não tem ficheiro. *Guardar* mais tarde escreve um novo ficheiro IFC. Depois, uma janela explica brevemente o que a aplicação transferiu do ficheiro e como funciona guardar; veja [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan).
3. Leia a mensagem na parte inferior: *Este projeto calcula como Microsoft Project. Altere em Ficheiro → Informações do projeto → Perfil de cálculo e opções.* A aplicação calcula este projeto com as regras de cálculo do MS Project: o perfil de cálculo *Microsoft Project*. Com *Abrir perfil de cálculo* vai para a definição. *Saiba mais* abre a Ajuda sobre perfis de cálculo.
4. Verifique se aparece uma mensagem abaixo do friso: *Está a ver as datas tal como estão registadas no ficheiro; recalcular deslocaria 4 tarefas.* Nessas tarefas, o resultado da aplicação difere então das datas que o MS Project guardou. Por baixo da mensagem do passo 3 aparece também uma linha: *4 tarefas mostram as datas tal como registadas no ficheiro (sem recalcular).* O que isso significa e como se passa para o cálculo próprio da aplicação está em [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen).
5. Se aparecer *Este ficheiro contém planeamento por horas.* com o botão *Ativar planeamento por horas*, o ficheiro contém dados em horas. Veja [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten).

Se o ficheiro contiver tarefas com divisões, nivelamento ou um planeamento controlado por recursos, aparece outra mensagem, por exemplo *Este ficheiro do MS Project contém 3 tarefas com um cronograma dividido, nivelado ou controlado por recursos. Elas são importadas e exibidas como estão.* Para uma tarefa, a mensagem aparece no singular.

## Pontos de atenção e o que a aplicação faz nesse caso

**Nem tudo é transferido.** Depois de abrir, a aplicação indica numa única mensagem o que deixou de fora: *Nem tudo deste ficheiro MS Project foi importado.* Por baixo, há uma linha por item com o número, por exemplo *2 linhas de base não foram importadas.* Para um `.mpp`, a frase sobre o perfil de cálculo do passo 3 é então a primeira linha desta mensagem. A mensagem fica visível até clicar na cruz. Se nada se perder, esta mensagem não aparece. Uma linha pode referir-se a:

- subprojetos (projetos inseridos): a aplicação lê-os como uma tarefa normal, sem a ligação ao outro ficheiro;
- tarefas externas de outro projeto: a aplicação lê-as como uma tarefa normal;
- linhas de base: a partir de um `.mpp`, a aplicação não transfere nenhuma linha de base; a partir do XML do MS Project, só a linha de base 0 das tarefas, e dessa apenas as datas e a duração (numa tarefa em horas, também a hora; não o trabalho e o custo, nem as linhas de base de recursos e atribuições);
- com o XML do MS Project: uma atribuição cuja linha de base tem datas diferentes das da sua tarefa. A aplicação guarda apenas a linha de base da tarefa; se forem iguais, nada se perde e a aplicação não indica nada. Uma hora diferente no mesmo dia também conta como diferença;
- campos personalizados com valores, como campos personalizados, valores de uma tabela de consulta e códigos de estrutura de tópicos (a aplicação não conta campos de sim/não num `.mpp`);
- notas (também uma nota só com uma imagem) em recursos e atribuições, e a partir de um `.mpp` também em tarefas (a partir do XML do MS Project, a nota de uma tarefa é transferida como a sua descrição);
- hiperligações;
- os custos fixos das tarefas;
- as tarifas dos recursos: a partir de um `.mpp` nenhuma tarifa, a partir do XML do MS Project só a tarifa padrão;
- só com XML do MS Project: tarefas agendadas manualmente (a aplicação agenda-as automaticamente), tarefas inativas (são incluídas no cálculo) e o atraso de nivelamento;
- só com um `.mpp`: o limiar crítico do MS Project; a aplicação usa o limiar 0.

Um código WBS que preencheu por si no MS Project é transferido; caso contrário, a aplicação numera as tarefas de acordo com a estrutura.

**Um ficheiro do MS Project 2007 ou anterior.** A aplicação recusa-o e apresenta: *Este ficheiro .mpp usa um formato antigo (Project 2007 ou anterior). Exporte-o no MS Project como XML (Ficheiro → Guardar como → XML) e abra esse ficheiro.* Por baixo da mensagem, a aplicação acrescenta um motivo técnico em inglês.

**Um ficheiro protegido por senha.** A aplicação apresenta: *Este ficheiro .mpp está protegido por senha. Exporte-o no MS Project como XML (Ficheiro → Guardar como → XML) e abra esse ficheiro.* Também aqui, a mensagem traz um motivo técnico em inglês.

**Um ficheiro que não é um `.mpp`.** Recebe *Falha ao abrir o ficheiro*, com um motivo técnico.

**O caminho pelo XML calcula de outra forma.** Se abrir a exportação XML do MS Project em vez do `.mpp`, a aplicação calcula com o perfil de cálculo *Open Planner Studio* e não vê a mensagem sobre *Microsoft Project*. As datas podem então ser diferentes das do ficheiro `.mpp`. Também com a exportação XML, a aplicação indica o que deixa de fora; veja *Nem tudo é transferido*.

**Uma edição faz o MS Project perder o controlo.** Se editar uma tarefa cujo planeamento era controlado pela janela de datas do MS Project, a aplicação apresenta a mensagem uma vez por projeto: *A distribuição de horas do MS Project não controla mais 2 tarefas após esta edição; a distribuição original permanece guardada no ficheiro.* Para uma tarefa, a mensagem aparece no singular.

**Guardar nunca substitui o seu `.mpp`.** O projeto não tem ficheiro. *Guardar* pergunta onde deve ficar o novo ficheiro IFC.

## Veja também

- [Ficheiros e formatos](docs://uitleg-bestanden): porque é que um `.mpp` só é lido e o que *Guardar* escreve.
- [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen): a vista das próprias datas do MS Project.
- [Ativar o planeamento por horas](docs://howto-urenplanning-aanzetten): se o ficheiro contiver dados em horas.
- [Abrir um ficheiro do Primavera P6 (.xer)](docs://howto-xer-openen): o mesmo para o Primavera.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): por formato, o que é transferido e o que não é.
- [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen): porque é que um ficheiro do MS Project abre com o seu próprio perfil de cálculo.
