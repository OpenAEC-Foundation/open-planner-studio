# Importar progresso a partir de uma planilha

Objetivo: colocar de uma só vez no planeamento o progresso que o pessoal da obra preenche numa folha de cálculo, sem ter de clicar em cada tarefa.

## Quando precisa disto

Um subempreiteiro ou responsável de obra não tem a aplicação, mas comunica o estado dos trabalhos todas as semanas: a percentagem concluída, quando começou e quando terminou. Envie-lhe uma folha com as suas tarefas. Ele preenche três colunas e devolve-a. A partir daí, a aplicação lê apenas três valores por tarefa: conclusão, início real e fim real. O resto do planeamento fica como está. O que a aplicação faz com esse progresso está explicado em [Progresso, data de estado e linha de base](docs://uitleg-voortgang).

## Passos

### 1. Defina a data de estado e calcule

Defina a data de estado como descrito em [Atualizar o progresso](docs://howto-voortgang-bijwerken). O responsável de obra preenche datas reais até esse dia, inclusive. Se o planeamento estiver desatualizado, a aplicação recalcula-o antes de a folha ser criada.

### 2. Crie a folha

Escolha *Planeamento › Progresso › Exportar folha de progresso*. O mesmo botão está nos separadores *Tabela* e *Relatório*. A aplicação cria um ficheiro Excel e sugere o nome *(nome do projeto)-progresso.xlsx*. No navegador, o ficheiro vai para as suas transferências. Prefere um CSV? Escolha *Ficheiro › Exportar › Folha de progresso (CSV)*. A folha Excel também está lá, como *Folha de progresso (Excel)*.

A folha tem oito colunas. Os nomes das colunas continuam em inglês, com uma breve instrução na língua da aplicação, depois de cada nome:

- `OPS Task ID`, `WBS` e `Name` servem só para reconhecer a tarefa. Não os altere.
- `Start` e `Finish` são as datas planeadas, só para informação. A aplicação nunca as escreve de volta no planeamento.
- `Completion (%)`, `Actual Start` e `Actual Finish` são as colunas que preenche.

A folha Excel está protegida, sem palavra-passe: só se podem editar as três colunas de preenchimento. O Excel verifica se uma percentagem está entre 0 e 100 e se uma data real é uma data. Uma fase (tarefa de resumo) fica marcada a cinzento com *— tarefa de resumo: não preencher*.

### 3. Peça o preenchimento

Para cada tarefa, o responsável de obra preenche:

- `Completion (%)`: de 0 até 100, inclusive. A aplicação também lê decimais, com vírgula ou ponto (por exemplo 33,3 ou 33.3). A instrução no CSV continua a pedir números inteiros: uma folha de cálculo com outra configuração regional pode ler 8,38 como 838.
- `Actual Start` e `Actual Finish`: no Excel, como data na sua configuração regional; no CSV, como dd-mm-aaaa ou como aaaa-mm-dd.

Um campo que fica vazio não altera nada. Assim, uma célula vazia também não apaga o progresso existente; isso só se faz na aplicação. Para uma tarefa que ainda não começou, ele deixa os campos totalmente vazios.

### 4. Importe a folha

1. Escolha *Planeamento › Progresso › Atualizar o progresso a partir de uma planilha* (também nos separadores *Tabela* e *Relatório*), ou *Ficheiro › Importar › Atualizar o progresso a partir de uma planilha*. Abre-se a janela *Atualizar o progresso a partir de uma planilha*.
2. Clique em *Escolher ficheiro…* e escolha o ficheiro `.xlsx` ou `.csv` preenchido.
3. Se as datas de um CSV forem ambíguas, a aplicação pergunta *Dia primeiro ou mês primeiro?*, com a data do seu ficheiro lida de duas formas. Clique na data correta.
4. Agora vê uma pré-visualização. No topo estão quatro contadores: *Aplicado*, *Sem alteração*, *Aguardando ligação* e *Recusado*. Por baixo, para cada tarefa, aparece o que muda, por exemplo *Conclusão: 0% → 100%*.
5. Verifique a pré-visualização e clique em *Aplicar*. A janela mostra *Resultado*, com os contadores, as linhas recusadas e o motivo. Termine com *Fechar*.

Não pode saltar a pré-visualização. O botão *Aplicar* fica desativado enquanto não houver nada a aplicar.

### 5. Recalcule o planeamento

A importação não recalcula por si. Carregue em **Calcular** (F5), por exemplo em *Planeamento › Agendamento › Calcular*, a não ser que *Calcular automaticamente* esteja ativado.

## Linhas que não encaixam diretamente

A aplicação liga cada linha a uma tarefa, primeiro pelo `OPS Task ID` e, se não houver, pelo número WBS.

**Ligação duvidosa.** Se a aplicação encontrou a tarefa só pelo número WBS, a linha fica em *Ligação duvidosa*, com *Confirmar* e *Alterar*. A linha também é aplicada se não fizer nada; por isso, verifique se a tarefa está certa. *Confirmar* retira a linha desta lista; não altera o que é aplicado. *Alterar* permite escolher outra tarefa. Com *Remover ligação* retira uma ligação que criou. Nota: uma folha de outro projeto com os mesmos números WBS fica afinal ligada, em *Ligação duvidosa*, e é aplicada ao clicar em *Aplicar*.

**Aguardando ligação.** Se a aplicação não encontrou nenhuma tarefa, ou encontrou várias com o mesmo número WBS, a linha fica em *Aguardando ligação*. Em *Escolher uma tarefa…*, escolha a tarefa certa. Pesquise pelo número WBS ou pelo nome. Se não a ligar, a linha é recusada.

## Armadilhas e o que a aplicação faz

Uma linha que não encaixa é recusada, com um motivo. O resto da folha continua normalmente. Estas são as mensagens principais:

- *A data real é posterior à data de estado.* Defina uma data de estado posterior ou corrija a folha.
- *Esta tarefa está planeada para começar após a data de estado: indique primeiro o seu início real na folha.* A aplicação não inventa um início; indique-o na folha.
- *Percentagem fora de 0–100. Verifique o separador decimal: numa folha de cálculo com outra configuração regional, "8,38" pode ser lido como 838.*
- *Tarefas de resumo não podem receber progresso de uma planilha.* O progresso de uma fase resulta das tarefas abaixo dela.
- *O fim real é anterior ao início real.*
- *Data ilegível.* e *Percentagem ilegível.*
- *Os valores inseridos contradizem-se.* Por exemplo, um fim real com uma percentagem abaixo de 100.
- *Nenhuma tarefa encontrada para esta linha.* A folha indica um ID de tarefa e um número WBS que não existem neste projeto.
- *Este código WBS ocorre em várias tarefas — ligue a linha manualmente.*
- *Outra linha já reivindicou esta tarefa.* Duas linhas apontam para a mesma tarefa.
- *Recusado pelo planeador.* Outra recusa do próprio planeamento, sem mensagem própria.

Se o ficheiro inteiro for recusado, aparece na janela uma destas mensagens: *Este ficheiro não tem coluna «OPS Task ID» nem «WBS» para ligar linhas a tarefas.*, *Este ficheiro não tem nenhuma das colunas Conclusão, Início real ou Fim real.*, *Este ficheiro é demasiado grande para ser lido como planilha de progresso.* (mais de 16 MB), *Este ficheiro tem demasiadas linhas para ser lido como planilha de progresso.* (mais de 50 000 linhas) ou *Este ficheiro está protegido por palavra-passe e não pode ser lido.* ou *Não foi possível ler este ficheiro como planilha de progresso.*

**Sem data de estado.** Se ainda não houver data de estado e a importação aplicar progresso, a aplicação define-a para hoje e apresenta um aviso. Por isso, defina-a primeiro.

**Desfazer de uma só vez.** A folha inteira é um único passo para Ctrl+Z.

**Só o que preenche.** Uma linha sem diferença em relação ao planeamento conta como *Sem alteração*. Uma tarefa sem linha na folha fica como estava.

## Ver também

- [Progresso, data de estado e linha de base](docs://uitleg-voortgang): o que a aplicação calcula com datas reais e percentagens.
- [Atualizar o progresso](docs://howto-voortgang-bijwerken): introduzir o progresso na própria aplicação.
