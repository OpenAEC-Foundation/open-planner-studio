# Gerir e partilhar bibliotecas de recursos

Objetivo: criar e eliminar bibliotecas de recursos, colocar calendários nelas e exportar ou importar uma biblioteca, como cópia de segurança ou para a utilizar noutro computador.

## Quando precisa disto

A biblioteca não está nos ficheiros do seu projeto, mas na aplicação: na aplicação de ambiente de trabalho, num ficheiro neste computador; no navegador, no armazenamento desse navegador. A biblioteca não é sincronizada. Se eliminar os dados do site no navegador, a biblioteca perde-se. Por isso, exporte-a como cópia de segurança. Se um colega quiser trabalhar com as mesmas equipas e tarifas, entregue-lhe também a biblioteca como ficheiro. Se a sua organização tiver várias empresas operacionais com equipas próprias, crie uma biblioteca separada para cada uma. Para um novo projeto, escolha a biblioteca que ele utiliza.

Para saber o que é uma biblioteca, leia [A biblioteca de recursos](docs://uitleg-resourcebibliotheek). Aqui não edita os próprios recursos, mas no painel de recursos. Veja [Utilizar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken).

## Passos

### Abrir o ecrã de gestão

Escolha *Ficheiro › Biblioteca*. À esquerda está a lista *Bibliotecas de recursos*. À direita estão os detalhes da biblioteca em que clicar: o nome, os botões e a lista *Calendários*. No cimo está escrito que gere os recursos no separador *Recursos*.

### Criar, alterar o nome e escolher a biblioteca padrão

1. Clique no sinal de mais acima da lista (*Adicionar biblioteca de recursos*). A aplicação adiciona uma biblioteca *Nova biblioteca de recursos* e seleciona-a logo a seguir.
2. Escreva o novo nome no campo do nome, no cimo da parte direita, e prima Enter, ou clique fora do campo. A aplicação não aceita um nome vazio.
3. Clique em *Definir como predefinida* para que esta biblioteca fique pré-selecionada para novos projetos a partir de agora. A biblioteca padrão tem uma estrela na lista.

### Colocar um calendário na biblioteca

1. Em *Calendários*, clique em *Do projeto*. Abre-se uma lista com os calendários do seu projeto ativo.
2. Clique na pequena seta depois do calendário que quer adicionar. Acima da lista, está escrito *Adicionado.* Um calendário já associado a esta biblioteca tem *já associado* a seguir ao nome.
3. O calendário fica agora na lista *Calendários* da biblioteca. Com o lápis (*Editar*), altera o nome e guarda com o visto. O ícone do caixote do lixo elimina o calendário de imediato, sem pedir confirmação. As cópias nos projetos mantêm-se.

Depois de *Calendários* aparece um número de versão, por exemplo *v2*. O número sobe com cada alteração à biblioteca. Um calendário da biblioteca segue para um projeto quando atribui um recurso que o utiliza. Associa-o a um recurso em *Recursos*, vista *Biblioteca*, na coluna *Calendário*.

### Exportar uma biblioteca

1. Escolha a biblioteca na lista.
2. Clique em *Exportar*.
3. Na aplicação de ambiente de trabalho, e no Chrome e no Edge, escolha onde guardar o ficheiro. Noutros navegadores, o ficheiro vai diretamente para a pasta de transferências, e a aplicação indica-o. O ficheiro chama-se `bibliotheek-` seguido do nome da biblioteca, com a extensão `.ifc`.

Por baixo dos botões está escrito *Exportar também serve de cópia de segurança: guarde o ficheiro num local seguro.*

### Importar uma biblioteca

1. Clique em *Importar*. Abre-se a janela *Importar biblioteca* para a biblioteca que selecionou na lista.
2. Clique em *Escolher ficheiro…* e escolha o ficheiro `.ifc` de uma exportação. Se o ficheiro não contiver uma biblioteca, está escrito *Este ficheiro IFC não contém uma biblioteca de recursos.*
3. A aplicação mostra o que o ficheiro contém, por exemplo *2 calendários, 5 recursos (versão 3).*
4. Escolha o que pretende fazer, veja a seguir.
5. Clique em *Adicionar* ou em *Substituir*, ou em *Cancelar* para parar.

Tem duas opções:

- *Adicionar como nova biblioteca de recursos*: o ficheiro passa a ser uma biblioteca separada, ao lado das existentes. Por baixo, está escrito com que nome, por exemplo *Será adicionada como “Mijn resourcebibliotheek (2)”.* Não se perde nada, e o seu projeto ativo continua associado à sua própria biblioteca.
- *Substituir uma biblioteca de recursos existente*: todo o conteúdo da biblioteca escolhida é substituído pelo conteúdo do ficheiro. A janela também o indica: *A importação substitui TODO o pool da biblioteca de recursos selecionada.* Se tiver duas ou mais bibliotecas, escolha qual em *Importar para a biblioteca de recursos*. Se a sua biblioteca for mais recente do que o ficheiro, a aplicação avisa: *A sua biblioteca local é mais recente — importar pode substituir as suas alterações.*

A aplicação propõe ela própria uma escolha. Para um ficheiro que continha a biblioteca padrão, fica pré-selecionada a opção *Adicionar como nova biblioteca de recursos*. Se a biblioteca do ficheiro já existir no seu computador e não for a biblioteca padrão, fica pré-selecionada a opção *Substituir uma biblioteca de recursos existente*, com exatamente essa biblioteca escolhida. Em caso de dúvida, escolha *Adicionar*: assim não substitui nada.

### Eliminar uma biblioteca

1. Escolha a biblioteca na lista e clique em *Remover biblioteca de recursos*. O botão fica cinzento na última biblioteca, porque tem de existir sempre pelo menos uma.
2. Confirme com *Eliminar*. A pergunta é *Remover esta biblioteca de recursos?* Se houver projetos abertos associados a ela, está escrito *Esta biblioteca de recursos está associada a 1 projeto aberto. Removê-la irá desassociar esse projeto. Continuar?* Para mais projetos, está escrito o mesmo com o número, por exemplo *associada a 2 projetos abertos*.

Depois, a biblioteca desaparece, com todos os recursos e calendários que tinha. Os projetos abertos que a utilizavam ficam desassociados: os seus recursos mantêm-se como recursos normais do projeto. Exporte primeiro se quiser guardar o conteúdo.

### Entregar um projeto juntamente com a sua biblioteca

Um ficheiro de projeto contém as suas próprias cópias dos recursos. Se também quiser entregar a biblioteca inteira, faça o seguinte. A própria exportação também está descrita em [Exportação](docs://howto-exporteren).

1. Abra um projeto que esteja associado a uma biblioteca e escolha *Ficheiro › Exportar*.
2. Marque *Guardar também o ficheiro de biblioteca*. A caixa de verificação só aparece para um projeto associado.
3. Escolha o cartão *IFC* e guarde o ficheiro. A aplicação pede então também um segundo ficheiro. Tem o mesmo nome do projeto, seguido de `-bibliotheek`, e contém a biblioteca.

A caixa de verificação só funciona na exportação IFC, e não nos outros formatos de exportação. O seu colega importa o segundo ficheiro, como descrito acima.

## Armadilhas e o que a aplicação faz nesse caso

**Dois planeadores, duas bibliotecas.** A aplicação não sincroniza bibliotecas entre computadores. A janela de importação mostra sempre um aviso sobre isto: *Nota: as bibliotecas não são sincronizadas entre computadores. Se dois planeadores trabalharem com a mesma biblioteca de recursos, as bibliotecas podem divergir. Se a sua organização partilhar equipas entre empresas operacionais, escolha deliberadamente uma biblioteca de recursos partilhada.*

**Substituir escreve por cima de tudo.** Perde-se tudo o que tinha na biblioteca escolhida, e uma alteração à biblioteca fica fora de *Desfazer*. Exporte primeiro se tiver dúvidas. Os seus projetos mantêm as suas cópias. A aplicação atualiza as cópias que ainda existem no novo ficheiro. As cópias que já não estão nele recebem a marca *não está mais na biblioteca* e continuam a funcionar. Se uma cópia for diferente, abre-se a janela *Vincular biblioteca de recursos* (ver [Utilizar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken)).

**Eliminar um calendário da lista é imediato.** A aplicação não pede confirmação, ao contrário do que acontece ao eliminar um recurso. Isto parece uma limitação. As alterações à biblioteca ficam fora de *Desfazer*.

## Ver também

- [A biblioteca de recursos](docs://uitleg-resourcebibliotheek): como a biblioteca e o projeto se relacionam entre si.
- [Utilizar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken): associar recursos, atribuí-los e resolver desvios.
- [Exportação](docs://howto-exporteren): os formatos de exportação, incluindo IFC com um ficheiro de biblioteca.
