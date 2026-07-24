# O seu primeiro cronograma em 10 minutos

Este guia leva-o, em cerca de 10 minutos, de um projeto vazio a um cronograma de construção totalmente calculado: adicionar tarefas, construir uma estrutura de tarefas, adicionar relações, calcular e guardar. Sem teoria prévia — simplesmente faz, passo a passo, usando exatamente os botões e menus que vai encontrar no Open Planner Studio.

## O que vai fazer

1. Criar um novo projeto.
2. Adicionar tarefas — através do friso, da tabela de tarefas e do diagrama de Gantt.
3. Colocar as tarefas numa estrutura (WBS) através da indentação.
4. Adicionar relações entre tarefas.
5. Calcular o cronograma.
6. Ler o resultado: caminho crítico e folga.
7. Guardar.

Prefere ver primeiro para onde se dirige? Abra o projeto de exemplo [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) através de **Ficheiro → Exemplos**. (Os nomes de exemplo são apresentados em neerlandês, tal como incluídos no projeto.) É um cronograma pequeno e fácil de ler que já mostra quase todos os passos abaixo — útil para manter aberto ao lado deste artigo para comparação.

Tudo o que se segue funciona de forma idêntica na aplicação de ambiente de trabalho e na versão de navegador: os mesmos botões, os mesmos menus, os mesmos atalhos.

## Passo 1 — Criar um novo projeto

1. Clique no separador do friso **Ficheiro**. Isto abre o ecrã de ficheiro.
2. Clique em **Novo** (ou use o atalho **Ctrl+N** se já estiver a trabalhar noutro projeto). Aparece a janela **Novo projeto**.
3. Introduza um **Nome do projeto**, por exemplo "O meu primeiro cronograma", e verifique a **Data de início** — por predefinição é a de hoje.
4. Para **Modelo de fases**, escolha **Vazio**. Os modelos **Construção residencial** e **Construção comercial / renovação** já criam algumas tarefas de fase, mas para este exercício vai construir tudo você mesmo para reconhecer cada passo.
5. Deixe as opções de calendário nos valores predefinidos e clique em **Criar**.

Tem agora um projeto vazio: uma tabela de tarefas vazia à esquerda, um diagrama de Gantt vazio à direita, e um calendário de trabalho já configurado a partir das definições predefinidas.

## Passo 2 — Adicionar tarefas

Certifique-se de que está no separador do friso **Início**. Este separador mostra a tabela de tarefas (esquerda) e o diagrama de Gantt (direita) lado a lado — duas vistas do mesmo cronograma, pelo que uma tarefa que adicionar aparece em ambos os locais ao mesmo tempo.

### Através do friso

1. No grupo do friso **Tarefas**, clique no botão **Tarefa**. Aparece uma nova tarefa chamada "Nova tarefa", com uma duração de 5 dias úteis, no fundo da tabela de tarefas e do diagrama de Gantt.
2. Repita isto algumas vezes até ter uma tarefa para cada fase principal do seu projeto. Se estiver a seguir o projeto de exemplo, use as mesmas fases principais que ele: "1. Voorbereiding" (Preparação), "2. Fundering & ruwbouw" (Fundação & obra em bruto), "3. Afbouw" (Acabamento) e "4. Oplevering" (Entrega).
3. Faça duplo clique numa tarefa — na tabela ou na sua barra no diagrama de Gantt — para abrir a janela **Editar tarefa**. Ajuste o **Nome**, o **Tipo** e a **Duração (dias úteis)** de acordo com a sua fase.

### Através da tabela de tarefas e do diagrama de Gantt

Não precisa de voltar sempre ao friso. Clique com o botão direito numa **linha vazia** da tabela de tarefas, ou num ponto vazio do diagrama de Gantt (onde ainda não há tarefa), e escolha **Nova tarefa** no menu de contexto.

Clique com o botão direito numa tarefa **existente**, em vez disso, e obtém um menu de contexto diferente com, entre outros:

- **Inserir acima** / **Inserir abaixo** — adiciona uma tarefa antes ou depois da tarefa em que clicou com o botão direito.
- **Adicionar subtarefa** — cria uma nova tarefa como filha dessa tarefa num só passo (veja o passo 3 para saber o que isto significa).

Escreveu algo errado, ou adicionou uma tarefa no local errado? **Ctrl+Z** desfaz a última ação, **Ctrl+Y** (ou **Ctrl+Shift+Z**) refaz-a — ambos funcionam em todo o cronograma, não apenas em campos de texto.

### Adicionar um marco

Todo o cronograma precisa de pelo menos um marco, por exemplo para a entrega. No grupo do friso **Tarefas**, clique na seta ao lado de **Marco** e escolha **Marco de fim**, **Marco de início** ou **Ponto de inspeção (obrigatório)** — ou use o atalho **Ctrl+M** para um marco genérico rápido ("Novo marco") que depois renomeia.

## Passo 3 — Construir uma estrutura de tarefas (WBS)

Uma lista plana de tarefas torna-se confusa rapidamente. Ao indentar tarefas constrói uma estrutura de tarefas (WBS): a tarefa acima torna-se então automaticamente uma **tarefa de resumo** que abrange todo o período das suas subtarefas.

1. Selecione uma tarefa que deva ficar sob outra tarefa — por exemplo "Fundering aanbouw" (Fundação do anexo) sob a tarefa de fase "2. Fundering & ruwbouw" (Fundação & obra em bruto).
2. Prima **Alt+→** para indentar, ou clique com o botão direito e escolha **Indentar** no menu de contexto. A tarefa acima torna-se imediatamente visível como tarefa de resumo.
3. Foi longe demais, ou quer mover uma tarefa de volta para o nível superior? Use **Alt+←**, ou clique com o botão direito e escolha **Diminuir indentação**.
4. Mais rápido para uma subtarefa completamente nova: clique com o botão direito na tarefa pai e escolha **Adicionar subtarefa** — isso salta os passos separados de adicionar e depois indentar.

Repita isto até ter alguns níveis de profundidade. No projeto de exemplo, a fase "2. Fundering & ruwbouw" divide-se, por exemplo, nas subtarefas "Grondwerk aanbouw" (Movimento de terras do anexo), "Fundering aanbouw" (Fundação do anexo), "Begane grondvloer storten" (Betonagem do piso térreo), "Wanden opmetselen" (Alvenaria das paredes) e "Dakconstructie plaatsen" (Colocação da estrutura de cobertura).

Este artigo cobre a construção de WBS apenas a um nível prático, para começar. Para saber como os tipos de marco, as tarefas de resumo e os códigos de atividade funcionam juntos em detalhe, leia o guia [Planeamento & WBS](docs://gids-plannen-wbs).

## Passo 4 — Adicionar relações

Tarefas sem relações são independentes umas das outras e não se deslocam quando altera uma tarefa anterior. Uma relação (dependência) liga duas tarefas entre si.

1. Certifique-se de que as barras das duas tarefas que quer ligar estão visíveis no diagrama de Gantt.
2. Mantenha premida a tecla **Shift** e arraste a partir da barra da predecessora para a barra da sucessora. Assim que soltar, uma relação **Finish-Start (FS)** com um atraso de 0 dias úteis é criada imediatamente — a relação mais comum: a sucessora só começa quando a predecessora termina.
3. Logo após soltar, aparece a janela **Tipo de relação**. Aqui pode alterar o tipo de relação (**FS**, **SS**, **FF** ou **SF**) e introduzir um **atraso**, por exemplo `2d` para dois dias úteis de tempo de espera entre as tarefas. Em resumo: com **FS** (Finish-Start) a sucessora começa depois de a predecessora terminar, com **SS** (Start-Start) ambas as tarefas começam (aproximadamente) ao mesmo tempo, com **FF** (Finish-Finish) terminam (aproximadamente) ao mesmo tempo, e com **SF** (Start-Finish) a predecessora tem de começar antes de a sucessora poder terminar — esta última é a menos comum na prática da construção.
4. Prefere ligar duas tarefas sem arrastar? Vá ao separador do friso **Relações** (ou clique em **Gerir** no grupo do friso **Relações** no separador Planeamento), selecione primeiro a predecessora, depois (mantendo premido Ctrl/Cmd) a sucessora, e use o botão **Nova relação a partir da seleção** — esse botão só funciona quando estão selecionadas exatamente duas tarefas, por essa ordem.

Para o exercício, adicione pelo menos duas relações: por exemplo "1. Voorbereiding" → "2. Fundering & ruwbouw" e "2. Fundering & ruwbouw" → "3. Afbouw".

## Passo 5 — Calcular

Agora que tem tarefas e relações, pode mandar calcular o cronograma (CPM — Critical Path Method).

1. Prima **F5**, ou clique no botão **Calcular** no grupo do friso **Agendamento**.
2. O Open Planner Studio calcula agora, para cada tarefa, as datas de início e fim mais cedo e mais tarde, a folga, e quais as tarefas que se situam no caminho crítico.
3. Não quer pensar mais em F5? Ative **Calcular automaticamente** nas **Definições**. O cronograma recalcula-se então sozinho assim que fica desatualizado, em vez de esperar por uma pressão manual de F5.

## Passo 6 — Ler o resultado

- No fundo do ecrã, a barra de estado mostra, por exemplo, "Caminho crítico: 4 tarefas, 62 dias úteis" assim que o cronograma foi calculado. Se alterou algo desde o último cálculo, mostra em vez disso "Desatualizado — recalcule (F5)".
- No diagrama de Gantt, as tarefas críticas — tarefas sem folga, que por isso determinam diretamente a data de fim do projeto — recebem uma cor de barra diferente das tarefas que ainda têm margem (folga). Se uma tarefa crítica atrasar, toda a data de fim do projeto desloca-se com ela; uma tarefa com folga pode atrasar sem consequências, desde que a folga não se esgote.
- Faça duplo clique numa tarefa para reabrir a janela **Editar tarefa**. Na secção **Resultado CPM** encontra, por tarefa: **Início mais cedo:**, **Fim mais cedo:**, **Início mais tarde:**, **Fim mais tarde:**, **Folga total:**, **Folga livre:**, e se a tarefa se situa no **Caminho crítico:**.
- Quer estes dados também como colunas na tabela de tarefas, em vez de ter de abrir cada tarefa? Vá ao separador do friso **Visualização**, clique em **Colunas…** no grupo **Apresentação**, e assinale **Crítica** e **Folga total**.

## Passo 7 — Guardar

1. Prima **Ctrl+S**, ou clique em **Guardar** no separador **Ficheiro**. Da primeira vez, o Open Planner Studio pede um nome de ficheiro e uma localização; o projeto é guardado como um ficheiro IFC nativo.
2. Quer antes manter uma cópia com um nome diferente, por exemplo para manter duas variantes lado a lado? Use **Ficheiro → Guardar como** (atalho **Ctrl+Shift+S**).

## Continue a praticar

- Repita os passos acima com um exemplo completo: abra [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) através de **Ficheiro → Exemplos** e reconheça a cadeia FS entre as fases, a sobreposição SS entre o trabalho de paredes e cobertura, a ligação FF entre o trabalho de ladrilhagem e pintura, e a restrição de licença (SNET) antes do início.
- Quer saber mais sobre a estrutura de tarefas, tarefas de resumo, tipos de marco e códigos de atividade? Leia o guia [Planeamento & WBS](docs://gids-plannen-wbs).
- Prefere fazer uma visita visual às principais áreas do ecrã? Reinicie o tour através do separador **Visualização** → botão **Tour**, ou através de **Ficheiro** → **Iniciar tour**.
