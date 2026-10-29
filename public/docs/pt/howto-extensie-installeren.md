# Instalar e gerir uma extensão

Objetivo: instalar uma extensão, ler a pergunta sobre permissões e, mais tarde, desativar ou remover a extensão.

## Quando precisa disto

Uma extensão acrescenta algo à aplicação sem que tenha de esperar por uma nova versão. Uma extensão pode, por exemplo, acrescentar um formato de importação que aparece em *Ficheiro › Importar*, colocar um botão no friso ou fornecer um tipo de letra para a exportação para PDF. O catálogo oficial divide-as em categorias: *Importação/Exportação*, *Planeamento*, *Relatórios*, *Utilitários*, *Tipos de letra* e *Outro*.

Pense bem antes de instalar uma. Uma extensão é código de programa que corre com os mesmos direitos que a própria aplicação, e a aplicação não o pode limitar. Por isso a aplicação pede permissão em cada instalação. O que vê nessa pergunta explica-se abaixo.

## Passos

### Instalar uma extensão do catálogo

1. Escolha *Ficheiro › Extensões*.
2. Escolha o separador *Explorar*. A aplicação transfere o catálogo enquanto mostra *Carregando catálogo...*. O que está no catálogo é decidido pela OpenAEC Foundation, que o mantém, e pode mudar.
3. Pesquise uma extensão no campo *Pesquisar extensões...*. A pesquisa usa o nome, a descrição, o autor e as etiquetas.
4. Cada cartão mostra o nome, a versão, a categoria, a descrição e o autor. Clique em *Instalar*.
5. Abre-se a janela *Instalar a extensão?*. Leia-a e veja o passo seguinte.
6. Clique em *Instalar* para continuar. Com *Não instalar* não acontece nada. Esc ou clicar ao lado da janela também conta como recusa, e a aplicação não mostra então nenhuma mensagem de erro.

Depois da instalação, a extensão fica ativada de imediato. No cartão em *Explorar* diz agora *Instalada*. Pode ver o que a extensão acrescenta na própria aplicação: um novo botão no friso, ou um formato de importação em *Ficheiro › Importar*. Algumas extensões mostram também uma mensagem. Reconhece-a pelo prefixo *Extensão* seguido do nome da extensão.

**Tutoriais.** Os tutoriais são uma extensão. Se vir o botão *Instalar tutoriais* na secção *Tutoriais* da *Ajuda*, abre-se *Ficheiro › Extensões* no separador *Explorar*. A pergunta depois da primeira visita guiada também instala esta extensão. Os dois caminhos mostram a mesma pergunta sobre permissões; pode recusá-la.

### Instalar uma extensão a partir de um ficheiro

Se recebeu uma extensão num ficheiro, instale-a assim.

1. Escolha *Ficheiro › Extensões*.
2. No canto superior direito, clique em *ZIP* para um ficheiro ZIP, ou em *JS* para um ficheiro JavaScript separado.
3. Escolha o ficheiro. Abre-se a janela *Instalar a extensão?*, como acima.

Um ficheiro ZIP tem de conter um `manifest.json` e o ficheiro principal da extensão. Se instalar uma extensão que já está instalada, a nova versão substitui a antiga. Se a aplicação não conseguir instalar o ficheiro, por exemplo porque um ficheiro ZIP está danificado, não acontece nada: a aplicação não mostra nenhuma mensagem de erro para ZIP e JS, e a extensão não aparece na lista. A causa fica, no entanto, no terminal de depuração. Ative-o em *Definições › Projeto › Definições da aplicação*, separador *Avançado*, *Activar terminal de depuração*, e abra-o com o botão *Mostrar terminal de depuração* na barra de estado. Aí aparece, por exemplo, *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (a aplicação apresenta este texto técnico em neerlandês).

### Ler a pergunta sobre permissões

A pergunta mostra o que tem de decidir.

- *Autor* e *Repositório* indicam quem fez a extensão e onde está o código-fonte.
- *Proveniência* indica de onde vem o ficheiro e se foi verificado. Se disser a vermelho que a transferência não foi verificada, instale só se conhecer a origem.
- *Aquilo a que está a dizer que sim* repete que uma extensão é código de programa que corre com os mesmos direitos da própria aplicação, e o que isso significa na sua plataforma. Instale apenas extensões de autores em quem confia.
- *O que esta extensão declara usar* mostra as permissões que o autor declarou, como pequenas etiquetas. É uma declaração e não uma restrição. Se disser *Nada declarado.*, a extensão pode, mesmo assim, ler e alterar os dados do seu planeamento.

O que significa cada etiqueta e os textos exatos da janela estão em [Permissões de extensões](docs://ref-extensiepermissies).

### Desativar, reativar ou remover uma extensão

1. Escolha *Ficheiro › Extensões* e o separador *Instaladas*. Cada extensão tem um cartão com o nome, a versão, a categoria, a descrição e o autor.
2. Com o interruptor no cartão, desative a extensão (*Desativar*) ou volte a ativá-la (*Ativar*). Quando está desativada, os botões e formatos de importação que a extensão acrescentou desaparecem, mas a extensão continua instalada. Continua também desativada depois de reiniciar a aplicação. Uma extensão ativada arranca sozinha quando a aplicação arranca.
3. Clique em *Remover*. O botão muda para *Confirmar*, com a explicação *Clique novamente para remover definitivamente*. Clique mais uma vez para remover a extensão. A aplicação também limpa as definições que a extensão guardou.

## Problemas e o que a aplicação faz então

**O catálogo não carrega.** Mostra *Não foi possível carregar o catálogo:* com a razão técnica a seguir, e o botão *Tentar novamente*. Isso pode dever-se a não ter ligação à internet.

**Aparece *Falha na instalação.* por baixo de um cartão do catálogo.** A transferência ou a instalação falhou, por exemplo porque a soma de verificação não coincidiu. Nesse caso, nada foi instalado. Isso é diferente de recusar a pergunta: aí não há mensagem de erro.

**Aparece *Entradas do catálogo ignoradas: 1* acima da lista.** O catálogo continha um elemento que a aplicação não consegue utilizar. Pode instalar as outras extensões como habitualmente.

**Uma extensão não arranca.** O cartão mostra então uma mensagem de erro, por exemplo que a extensão precisa de uma versão mais recente do Open Planner Studio, com a sua versão atual indicada, ou o erro que a própria extensão deu. Nesse caso a extensão não fica ativa. Atualize a aplicação ou remova a extensão.

**Um cartão com *Quarentena*.** A aplicação não conseguiu utilizar a extensão guardada. Sob o nome diz *Motivo:* com a causa. Com *Remover do armazenamento* limpa-a.

**Escrever uma extensão por si mesmo.** O guia para autores de extensões (manifesto, API, permissões) está no repositório `OpenAEC-Foundation/open-planner-studio` no GitHub, no ficheiro `docs/extensions.md`.

**Uma extensão não pertence a um projeto.** As extensões ficam guardadas na própria aplicação: na aplicação de ambiente de trabalho, neste computador, e no navegador, no armazenamento desse navegador. Aplicam-se a todos os seus projetos e não fazem parte do ficheiro do projeto. Se limpar os dados do site no navegador, as extensões desaparecem.

## Ver também

- [Atualizar a aplicação](docs://howto-app-bijwerken): uma extensão pode pedir uma versão mais recente da aplicação.
- [Permissões das extensões](docs://ref-extensiepermissies): o que significa cada permissão na pergunta de instalação.
