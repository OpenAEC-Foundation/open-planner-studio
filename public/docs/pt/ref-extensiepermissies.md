# Permissões das extensões

Todas as permissões que uma extensão pode indicar no manifesto: o que permitem, o que acontece quando faltam e o que vê delas ao instalar uma extensão. Como gere e instala extensões está em [Instalar e gerir uma extensão](docs://howto-extensie-installeren).

## O que é e o que não é uma permissão

Uma permissão é uma **declaração do autor**: que partes da interface da aplicação a extensão quer usar. Não é uma barreira. O código de uma extensão corre no mesmo ambiente que a própria aplicação e, por isso, pode fazer mais do que as suas permissões indicam: não há sandbox. A aplicação também o diz na janela de instalação. Instale apenas extensões de autores em quem confia.

A aplicação impõe uma permissão de uma de três formas, e a diferença importa:

**Imposição rígida.** Se a permissão faltar, o método correspondente lança um erro (em neerlandês, por exemplo *Extensie "…" mist permissie: ribbon*) antes de fazer qualquer coisa.

**Aviso.** Se a permissão faltar, o método continua a funcionar, mas a aplicação escreve um aviso no registo. Numa versão futura passa a ser uma recusa.

**Só informativa.** À permissão não está ligada nenhuma parte da interface. A aplicação mostra-a ao instalar e não faz mais nada com ela.

O que não precisa de permissão é a base da interface das extensões: ler o projeto, o calendário, as tarefas, as relações, os recursos e as atribuições; adicionar tarefas e relações e alterar tarefas; carregar um projeto, recalcular e agrupar várias alterações; guardar as suas próprias definições, ler os seus próprios ficheiros incluídos e mostrar uma notificação.

**O manifesto.** As permissões estão no manifesto como uma lista. Uma extensão que instale agora, com uma permissão que esta versão da aplicação não conhece, é recusada. Para uma extensão mais antiga já guardada, a aplicação ignora as permissões desconhecidas e indica-o no registo.

## Como a aplicação pergunta

Ao instalar, a partir do catálogo (*Ficheiro › Extensões › Explorar › Instalar*) ou a partir de um ficheiro (*ZIP* ou *JS*), a aplicação mostra a janela *Instalar a extensão?*. A pergunta surge uma vez, ao instalar: não surge sempre que ativa a extensão.

A janela mostra o nome, a versão, a descrição, o autor e, se existir, o repositório. Em *Proveniência* indica de onde vem a extensão (*Do catálogo de extensões online*, *De um ficheiro ZIP neste computador* ou *De um ficheiro JavaScript neste computador*) e se o descarregamento foi verificado: com a soma de controlo do catálogo, não verificado porque o catálogo não fornece nenhuma, ou um ficheiro escolhido por si. Em *Aquilo a que está a dizer que sim* indica que uma extensão é código de programa que corre com os mesmos direitos da aplicação, e o que isso significa na prática: na aplicação de ambiente de trabalho, entre outras coisas, ler e escrever ficheiros em qualquer lugar da sua pasta de utilizador, além de acesso aos seus projetos, definições e área de transferência; no navegador, acesso aos seus projetos e definições guardados, aos ficheiros a que concedeu acesso e à rede.

Em *O que esta extensão declara usar* aparecem as permissões do manifesto, como etiquetas curtas com o nome tal como abaixo. Indica: *É a declaração do autor, não uma restrição — o código pode fazer mais de qualquer forma.* Se a extensão não tiver permissões, indica *Nada declarado.* Duas permissões têm uma explicação: *importSource* e *help*. As outras seis têm apenas a etiqueta.

Com *Instalar* concorda. *Não instalar*, Esc e clicar fora da janela recusam a instalação.

## As permissões

**ribbon** — colocar um botão no friso. Efeito: a extensão pode acrescentar um botão a um grupo de um separador do friso. Uma extensão sem esta permissão recebe um erro quando o tenta fazer. Os botões aparecem no fim do separador escolhido, sob uma etiqueta de grupo da extensão, e desaparecem quando desativa ou remove a extensão. Por padrão: não concedida; apenas o que está no manifesto. Imposição: rígida. Onde: no separador que a extensão escolheu.

**events** — acompanhar os eventos da aplicação e enviar eventos. Efeito: a extensão pode subscrever e cancelar a subscrição de eventos e enviar os seus próprios eventos. A própria aplicação envia quatro: um projeto é carregado (depois de importar, abrir ou carregar por uma extensão), é criado um projeto vazio, o planeamento é (re)calculado e o utilizador pede um tutorial. Esse último só vai para a extensão de tutorial. Por padrão: não concedida; apenas o que está no manifesto. Imposição: rígida. Onde: em lado nenhum; a extensão reage ao evento.

**backstage** — adicionar um formato de importação. Efeito: a extensão pode registar um importador; aparece em *Ficheiro › Importar*, onde clica num formato e escolhe um ficheiro. Os formatos integrados são separados disto (ver [Formatos de importação e exportação](docs://ref-import-exportformaten)). Por padrão: não concedida; apenas o que está no manifesto. Imposição: aviso. Se a permissão faltar, o registo continua a funcionar, com um aviso no registo. Isso é uma solução transitória, porque as extensões existentes nem sempre indicam a permissão. Onde: *Ficheiro › Importar*.

**pdf-fonts** — fornecer um tipo de letra para a exportação PDF. Efeito: a extensão pode registar um fornecedor de tipos de letra. A exportação PDF usa-o para os caracteres que os tipos de letra incorporados não cobrem, como caracteres chineses, japoneses e coreanos. Por padrão: não concedida; apenas o que está no manifesto. Imposição: rígida. Onde: no PDF de um relatório; na janela de instalação há apenas a etiqueta.

**importSource** — ler os bytes originais de um ficheiro importado. Efeito: a extensão pode pedir o conteúdo completo do ficheiro de origem de um projeto importado (por agora: um ficheiro Primavera), incluindo os campos que a aplicação deliberadamente não leva para o seu projeto, como campos de auditoria e de proveniência, custos, campos de revisão e de localização. Isto vai muito além do resto da interface e por isso é uma permissão à parte. Sem a permissão, a aplicação não lê um único byte do ficheiro de origem: todos os métodos lançam então um erro antes de se obter qualquer coisa. Por padrão: não concedida; apenas o que está no manifesto. Imposição: rígida, negada por padrão. Onde: na janela de instalação acompanha a permissão uma explicação: *importSource — os bytes de origem completos de cada ficheiro importado (por exemplo um ficheiro Primavera em bruto), incluindo campos que nunca chegam ao projeto.*

**help** — adicionar artigos de ajuda e orientação. Efeito: a extensão pode registar e retirar artigos de ajuda (tutoriais), abrir um ficheiro `.ifc` incluído como novo documento e iniciar e parar um guia que aponta para partes da aplicação. Um projeto incluído nunca substitui o documento em que está a trabalhar: abre-se como novo documento, ou apenas ocupa um separador vazio e inalterado. Desde a versão 1.4.0 do contrato. Por padrão: não concedida; apenas o que está no manifesto. Imposição: rígida. Onde: na janela *Ajuda* (os artigos), como novo separador (o projeto) e como guia que aponta para botões. Na janela de instalação acompanha a permissão uma explicação: *help — pode adicionar artigos de ajuda, abrir projetos incluídos como novo documento e mostrar um guia que aponta para partes da aplicação.*

**filesystem** — a extensão declara que usa ficheiros. Efeito: nenhum; nenhuma parte da interface está ligada a isto, e a aplicação não o pode impor. Por padrão: não concedida; apenas o que está no manifesto. Imposição: só informativa. Onde: como etiqueta na janela de instalação.

**network** — a extensão declara que usa a rede. Efeito: nenhum; como *filesystem*. Por padrão: não concedida; apenas o que está no manifesto. Imposição: só informativa. Onde: como etiqueta na janela de instalação.

## Ver também

- [Formatos de importação e exportação](docs://ref-import-exportformaten): os formatos que a própria aplicação conhece, ao lado do que as extensões acrescentam em *Ficheiro › Importar*.
- [Instalar e gerir uma extensão](docs://howto-extensie-installeren): instalar, desativar e remover uma extensão.
