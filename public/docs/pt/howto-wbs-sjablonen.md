# Guardar e inserir modelos de WBS

Objetivo: guardar uma fase com as suas subtarefas e as respetivas relações como modelo, e inseri-lo outra vez mais tarde no mesmo projeto ou noutro.

## Quando precisa disto

Continua a planear o mesmo tipo de trabalho: cada casa tem uma fundação com trabalhos de movimentação de terras, armaduras, betonagem e cura. Em vez de criar essas tarefas repetidas vezes e de as vincular entre si, guarde a fase uma vez como **modelo**. Um modelo é um ramo da sua WBS: uma tarefa com tudo o que está por baixo dela.

## Passos

### Guardar um ramo como modelo

1. Construa o ramo da forma como o quer reutilizar: uma tarefa de resumo com subtarefas e as relações entre elas.
2. Clique com o botão direito nessa tarefa de resumo e escolha *Guardar ramo como modelo*. Este item de menu só aparece em tarefas com subtarefas.

A aplicação indica *Ramo guardado como modelo 'Foundation'*. A aplicação não pede um nome: o modelo recebe o nome da tarefa de topo do ramo.

### Inserir um modelo

1. Selecione a tarefa por baixo da qual o modelo deve ficar, ou não selecione nenhuma.
2. Escolha *Planeamento › Estrutura › Modelos*. A lista mostra o nome de cada modelo e, por exemplo, *4 tarefas, 2 relações*.
3. Clique no modelo.

Se uma tarefa estiver selecionada, o modelo entra como última subtarefa dessa tarefa. Como resultado, essa tarefa passa a ser uma tarefa de resumo. Se estiverem selecionadas várias tarefas, conta a que clicou primeiro. Se não estiver selecionada nenhuma, o ramo fica no fim da lista, ao nível superior. O ramo inserido fica selecionado depois.

Todas as tarefas inseridas começam no início do projeto, e o planeamento deixa de estar atualizado. Prima **Calcular** (F5), por exemplo através de *Início › Agendamento › Calcular*, e as datas resultam das relações. Inserir conta como um único passo para *Desfazer*. Guardar ou eliminar um modelo não faz parte desse passo.

### Eliminar um modelo

Abra *Planeamento › Estrutura › Modelos* e clique no pequeno ícone de lixo à direita do modelo (*Eliminar modelo*). A aplicação não pede confirmação.

### O que contém um modelo

Para cada tarefa, um modelo guarda o nome, a descrição, a categoria de trabalho, se é um marco, e a duração em dias. Das relações, guarda apenas as que existem entre duas tarefas dentro do ramo, com tipo e desfasamento. Um desfasamento em horas (`4h`) não é guardado e passa a 0. Um desfasamento em dias úteis, dias de calendário ou percentagem é guardado.

Tudo o resto fica de fora: datas, progresso e datas reais, atribuições de recursos, códigos e campos personalizados (ver [Códigos e campos personalizados](docs://howto-codes-en-velden)), o calendário, as restrições e os prazos, a prioridade, uma categoria de trabalho personalizada, para um marco o tipo e a caixa de verificação *Obrigatório (contratual)*, e as relações com tarefas fora do ramo. Depois de inserir, preencha esses dados outra vez: atribuições, códigos, calendário e restrições ficam vazios, e todas as tarefas começam no início do projeto.

Uma tarefa em horas volta como tarefa em dias, com a duração convertida numa fração de um dia útil. Uma tarefa de 5 horas, com um dia útil de 8 horas, passa a 0,625 dia.

## Armadilhas e o que a aplicação faz

**Os modelos não pertencem ao projeto.** A aplicação guarda-os no armazenamento próprio da aplicação neste dispositivo, e não no ficheiro do projeto. Um colega que abra o seu ficheiro não vê os seus modelos. Na versão para navegador, um modelo pertence a esse navegador. Por isso, se os seus modelos forem importantes, guarde-os também noutro sítio: coloque-os num projeto que guarde como ficheiro.

**O mesmo nome pode existir mais do que uma vez.** Se guardar o ramo duas vezes, a lista tem dois modelos com o mesmo nome. A aplicação não substitui nada.

**A duração da tarefa de topo não conta.** Uma tarefa de resumo recebe a duração das suas subtarefas, assim que usar calcular.

**Uma tarefa com atribuições de recursos como destino.** Se selecionar uma tarefa com atribuições que ainda não tem subtarefas e inserir um modelo por baixo dela, a aplicação recusa. A tarefa passaria a ser uma tarefa de resumo, e uma tarefa de resumo não tem atribuições. A tarefa de topo de um modelo tem subtarefas próprias, por isso as atribuições não têm onde ficar. A aplicação avisa e não altera nada. Escolha então outra tarefa, ou nenhuma, como destino. Um marco que recebe um modelo perde o estado de marco, e a aplicação mostra uma mensagem.

**Uma relação inválida no modelo.** Se uma relação do modelo não for permitida, por exemplo uma tarefa ligada à sua própria fase, ou se já existir, a aplicação ignora-a e indica quantas relações foram ignoradas.

## Ver também

- [Ajustar a estrutura](docs://howto-structuur-aanpassen): mover ou avançar o ramo inserido.
- [Adicionar relações](docs://howto-relaties-leggen): criar relações dentro de um ramo, por si, antes de o guardar.
- [Caminho crítico e folga](docs://uitleg-kritiek-pad): o que acontece ao ramo inserido depois de calcular.
