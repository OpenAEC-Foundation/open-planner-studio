# Utilizar a biblioteca de recursos

Objetivo: utilizar recursos da biblioteca de recursos no seu projeto, e colocar na biblioteca um recurso que criou num projeto, para que todos os projetos usem os mesmos dados.

## Quando precisa disto

Tem uma equipa fixa de pedreiros, uma grua e um estucador que aparecem em vários projetos. Sem biblioteca, é preciso introduzi-los de novo em cada projeto, com o risco de nomes e tarifas diferentes. Nenhum projeto vê que outro também pede a mesma equipa. Na biblioteca, regista-os uma só vez.

Para saber o que é a biblioteca e o que um projeto herda dela, veja [A biblioteca de recursos](docs://uitleg-resourcebibliotheek). Este artigo trata das ações. Criar, exportar e eliminar bibliotecas está em [Gerir e partilhar bibliotecas de recursos](docs://howto-bibliotheken-beheren).

## Passos

### 1. Vincular o projeto a uma biblioteca

Só trabalha com a biblioteca se o projeto estiver vinculado a ela. Sem vínculo, o painel *Recursos* não mostra o comutador *Biblioteca*, *Projeto* e *Ocupação*.

Para um projeto novo:

1. Escolha *Ficheiro › Novo*. Abre-se a janela *Novo projeto*.
2. Verifique *Biblioteca de recursos*. O campo está definido com a biblioteca padrão. Pode escolher outra, *nenhuma (projeto autónomo)* ou *+ Nova biblioteca de recursos…*.
3. Clique em *Criar*.

Para um projeto existente:

1. Escolha *Ficheiro › Definições do projeto*.
2. Em *Biblioteca de recursos*, escolha a biblioteca.
3. Clique em *Aplicar*. Até lá, a parte inferior indica *Alterações não aplicadas — clique em Aplicar para as manter.*

Se o projeto já tiver recursos com o mesmo nome de um item da biblioteca, abre-se a janela *Vincular biblioteca de recursos* com a secção *Reconhecer*. Cada recurso com correspondência indica *Sugestão: Bricklayer*. Clique em *Vincular* para ligar esse recurso, ou em *Vincular todas as sugestões* se houver mais do que uma sugestão. A aplicação compara os nomes sem distinguir maiúsculas e minúsculas nem espaços duplos. Ao vincular, o recurso fica com o nome, o tipo, a tarifa, a unidade e a descrição do item da biblioteca. *Unidades máx* mantém o valor que tinha no projeto. A janela mostra também os calendários do projeto com o mesmo nome de um calendário da biblioteca. Com *Decidir depois* fecha a janela sem vincular.

### 2. Colocar um recurso na biblioteca

1. Escolha *Recursos › Gerir › Recursos*. O painel de recursos ocupa o espaço de trabalho. Abre-se sempre em *Projeto*, também num projeto vinculado.
2. No canto superior direito, escolha *Biblioteca*. Acima da tabela indica *Isto edita a biblioteca e aplica-se a todos os projetos — fora do desfazer.*
3. Clique em *Novo recurso na biblioteca*. Aparece uma linha vazia no fim da tabela.
4. Escreva o nome, por exemplo *Bricklayer*, e prima Enter. O recurso fica agora na biblioteca, e abre-se logo uma linha vazia para o seguinte. Prima Esc quando terminar. Sem nome, a aplicação não cria nada.
5. Preencha o resto da linha. *Tipo* é *Mão de obra* por padrão. Em *Unidades máx*, indique quantos destes recursos existem no total, por exemplo 3 para três pedreiros. A vista de ocupação usa este número como capacidade. *Tarifa/hora* é opcional. Só pode preencher *Unidade* para o tipo *Material*. Em *Calendário* escolha um calendário da biblioteca, ou *+ Calendário de recurso* para criar um, veja [Configurar um calendário de recurso](docs://howto-resourcekalender-instellen). A aplicação guarda o nome, a tarifa e a unidade ao sair do campo, e os outros campos de imediato.

Cada alteração na biblioteca passa de imediato para as cópias não editadas nos seus projetos abertos.

### 3. Atribuir um recurso ao projeto

1. Na vista *Biblioteca*, escolha *Atribuir ao projeto* no recurso. Acima da tabela indica *Adicionado.* Se clicar de novo, indica *Já está no projeto.* e não aparece uma segunda cópia.
2. Escolha *Projeto*. A cópia está na tabela com um pequeno ícone da biblioteca junto ao nome, com a indicação *Da biblioteca*. Nome, tipo, tarifa e unidade são texto simples. Se puser o rato sobre eles, vê *Valor da biblioteca — edite-o na vista Biblioteca, ou desvincule este recurso da biblioteca.*
3. Defina *Unidades máx* para este projeto. O campo começa com o valor da biblioteca e continua editável no projeto.
4. Atribua agora o recurso às tarefas como a qualquer outro recurso, veja [Atribuir recursos com uma curva](docs://howto-resource-toewijzen). *Recursos › Atribuição › Atribuir* só mostra recursos que já estão no projeto, por isso atribua primeiro um recurso da biblioteca ao projeto desta forma.

*Atribuir ao projeto* só existe na vista *Biblioteca* de um projeto vinculado a essa biblioteca.

### 4. Levar um recurso do projeto para a biblioteca

Faça isto para um recurso que criou no projeto e que usa com mais frequência, por exemplo uma grua alugada.

1. Na vista *Projeto*, escolha *Para a biblioteca* no recurso. O botão só aparece num recurso que tem nome e ainda não vem da biblioteca, num projeto vinculado.
2. Leia a mensagem acima da tabela.

A mensagem pode indicar três situações:

- *Adicionado.* A biblioteca não tinha nenhum item com esse nome. Foi criado um item novo, e o seu recurso ficou vinculado a ele.
- *Já existia na biblioteca — agora associado.* Havia um item com o mesmo nome e os mesmos dados. O seu recurso fica vinculado a ele.
- *Associado ao item existente da biblioteca — os valores diferem, ver a marcação.* Havia um item com o mesmo nome mas com dados diferentes. O seu recurso fica vinculado e fica logo marcado com *difere — decidir*. Continue no passo 6.

### 5. Desvincular uma cópia

Se quiser afastar-se da biblioteca num só projeto, por exemplo com outra tarifa, desvincule a cópia.

1. Na vista *Projeto*, clique no ícone *Desvincular da biblioteca* no fim da linha.
2. O recurso passa a ser um recurso normal do projeto. Todos os campos são editáveis e deixa de seguir a biblioteca. O calendário que veio com o recurso também fica desvinculado, exceto se outro recurso deste projeto ainda o segue.

Com *Desfazer* (Ctrl+Z) anula a desvinculação.

### 6. Resolver um desvio

Uma cópia que indica *difere — decidir* é diferente do item da biblioteca. A aplicação não escolhe quem tem razão.

1. Clique na marcação *difere — decidir* no recurso. Abre-se a janela *Vincular biblioteca de recursos*. Abre-se também automaticamente ao abrir um ficheiro com uma cópia destas.
2. Na secção *Desvios*, escolha o que pretende para o item, veja abaixo.
3. Clique em *Decidir depois* se ainda não quiser escolher. A janela fecha e a marcação fica.

Para um desvio, há duas escolhas:

- *Usar valores da biblioteca*: a cópia recebe os dados da biblioteca.
- *Adotar os valores do ficheiro na biblioteca*: a biblioteca recebe os dados da sua cópia. Por baixo indica *Atenção: isto altera a biblioteca e vale para todos os seus projetos.* As cópias noutros projetos abertos seguem.

## Armadilhas e o que a aplicação faz então

**Os projetos de exemplo têm uma biblioteca própria.** Se abrir um dos três exemplos de demonstração (*Ficheiro › Exemplos*, ou através de uma ligação na Ajuda), a aplicação cria, uma única vez, a biblioteca *Biblioteca de recursos de demonstração* e vincula o projeto a ela. Os recursos do projeto com o mesmo nome de um item da biblioteca ficam logo vinculados; os calendários não. As suas bibliotecas próprias ficam como estão. Se abrir dois exemplos lado a lado, juntos mostram conflitos em [Utilizar a vista de ocupação](docs://howto-bezettingsoverzicht-gebruiken), por exemplo na equipa de pedreiros (*Masonry crew*) entre *Refurbishment & Extension of a Family Home* e *6 New Terraced Houses, De Akkers*.

**Não vê o comutador.** O projeto não está vinculado a uma biblioteca. Faça o passo 1.

**Edita a biblioteca por engano.** O painel abre sempre em *Projeto* para o evitar. As alterações na vista *Biblioteca* aplicam-se a todos os projetos e ficam fora de *Desfazer*.

**Elimina um recurso da biblioteca.** A aplicação pergunta primeiro *Remover «Bricklayer» da biblioteca? Isto aplica-se a todos os projetos e não pode ser desfeito.* As cópias nos seus projetos ficam e continuam a funcionar. Recebem a marcação *não está mais na biblioteca* e ficam totalmente editáveis. Com *Remover do projeto* retira a cópia do projeto.

**Em Biblioteca de recursos escolhe outra biblioteca ou *nenhuma (projeto autónomo)*.** As marcas de origem da biblioteca anterior desaparecem. Os recursos ficam no projeto como recursos normais do projeto. Com outra biblioteca, a aplicação procura de novo recursos com o mesmo nome.

**Um recurso não tem sugestão em *Reconhecer*.** Indica *Sem sugestão — escolha manualmente*, mas esta janela não tem botão para isso. Isto parece uma falha. Coloque esse recurso na biblioteca com *Para a biblioteca* (passo 4).

## Veja também

- [A biblioteca de recursos](docs://uitleg-resourcebibliotheek): o que decide a biblioteca, o que decide o projeto, e como as cópias acompanham a biblioteca.
- [Gerir e partilhar bibliotecas de recursos](docs://howto-bibliotheken-beheren): criar, exportar e importar bibliotecas.
- [Utilizar a vista de ocupação](docs://howto-bezettingsoverzicht-gebruiken): ver se dois projetos pedem o mesmo recurso ao mesmo tempo.
- [Gerir recursos](docs://howto-resources-beheren): os recursos de um só projeto.
