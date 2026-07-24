# Ligações externas

A janela **Ligação externa (entre projetos)** regista uma dependência entre uma tarefa neste projeto e uma tarefa num ficheiro de projeto diferente — por exemplo um projeto de trabalhos de estaleiro que tem de terminar antes do seu início.

## Abrir

Separador **Relações** → botão **Ligação externa…**. Tem de estar selecionada exatamente uma tarefa; caso contrário aparece "Selecione uma única tarefa para adicionar uma ligação externa."

## A âncora congelada

Uma ligação externa não calcula em tempo real face ao projeto de origem. Quando a adiciona, a data relevante da tarefa de origem (início ou fim, dependendo da direção e do tipo de relação) é guardada como uma **data de ancoragem** fixa; o cálculo usa essa data como limite. Se o projeto de origem mudar depois, nada se desloca até **atualizar** a ligação.

## Duas vias

- **Ficheiro de origem** — escolha um ficheiro em **Escolher um ficheiro recente**; é lido apenas em modo de leitura ("O ficheiro de origem é lido apenas em modo de leitura — não é aberto como documento."). Depois escolha a **Tarefa de origem** na lista; a data de ancoragem é lida automaticamente dessa tarefa e mostrada no fundo. Esta via requer a aplicação de ambiente de trabalho e pelo menos um ficheiro recente.
- **Manual (alternativa)** — sem o ficheiro à mão (ou a versão de navegador): cole o **Id de projeto** e o **Id de tarefa** da tarefa externa, opcionalmente um **Nome da tarefa**, e introduza você mesmo a **Data de ancoragem**. Uma ligação manual fica marcada "obsoleto" até uma atualização encontrar efetivamente a origem.

## Campos partilhados

- **Direção** — **Predecessora (externa → eu)**: a tarefa externa determina a minha tarefa; ou **Sucessora (eu → externa)**: a minha tarefa determina a externa.
- **Tipo de relação** — FS, SS, FF ou SF.
- **Atraso (dias úteis)** — tempo de espera (ou negativo: sobreposição) sobre a âncora.

**Adicionar ligação** guarda a ligação (desativado até os campos obrigatórios estarem preenchidos); **Cancelar** fecha sem adicionar.

## Gestão, atualização e origens em falta

As ligações existentes são listadas no painel de Relações sob **Ligações externas**:

- Por ligação: a tarefa de origem, o tipo, a âncora, e um distintivo **obsoleto** assim que a origem não pôde ser carregada (já não pode) — com a explicação "origem não carregada — reimporte para atualizar".
- **Atualizar esta ligação** — relê o ficheiro de origem desta ligação e atualiza a âncora.
- **Atualizar âncoras externas** — relê todos os ficheiros de origem referenciados e atualiza todas as âncoras mais o estado obsoleto. Depois, uma linha de estado reporta quantas âncoras foram atualizadas e quantas permaneceram obsoletas.
- **Remover** — elimina a ligação.
- Atualizar lê ficheiros e por isso só funciona na aplicação de ambiente de trabalho; a versão de navegador reporta "Ler ficheiros de origem só é possível na aplicação de ambiente de trabalho; use a alternativa manual."

## Leitura adicional

- [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse) — como as ligações externas alimentam o caminho crítico.
