# Bibliotecas de recursos

Se trabalha em vários projetos com as mesmas equipas, os mesmos subempreiteiros e os mesmos calendários, não quer manter a respetiva tarifa, calendário e tipo em separado em cada projeto — a reescrevê-los de cada vez e a perseguir cada cópia sempre que algo muda. É para isso que serve uma biblioteca de recursos: uma fonte partilhada de recursos e calendários que pertence à sua organização, vive fora dos projetos individuais, e da qual vários projetos podem beber. Este guia explica como a biblioteca se relaciona com um projeto, exatamente o que acompanha e o que fica por projeto, e como alterna entre os dois.

## O que vai aprender aqui

- A distinção entre a biblioteca (partilhada, ao nível da organização) e o projeto (o que este projeto usa realmente).
- Associar um projeto a uma biblioteca, ou deixá-lo deliberadamente autónomo.
- As duas vistas no separador Recursos: **Biblioteca** e **Projeto**.
- Os três tipos de linhas que encontra na vista de projeto: da biblioteca, exclusiva do projeto, e órfã.
- Exatamente o que um recurso da biblioteca traz para o projeto, e o que define livremente por projeto.
- As três ações que ligam a biblioteca e o projeto.
- Como a aplicação atualiza as cópias, e o que tem de decidir quando uma cópia diverge.
- Partilha, cópia de segurança, e os respetivos limites.

Siga com [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) e com [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): abrir qualquer um dos showcases associa-o automaticamente a uma biblioteca de recursos de demonstração partilhada, e as equipas **Timmerlieden**, **Installateurs**, **Stukadoors** e **Schilders** reaparecem com exatamente o mesmo nome em ambos — a prova direta de que uma biblioteca alimenta vários projetos.

## Biblioteca e projeto: dois mundos

A **biblioteca de recursos** é a fonte partilhada: pertence à sua organização, não a um único projeto, e sobrevive a qualquer projeto individual. O **projeto** decide o que este projeto em concreto realmente põe a trabalhar a partir dela — com a sua própria capacidade, disponibilidade e escolha de calendário. Um projeto associa-se a exatamente uma biblioteca, ou fica totalmente autónomo: nesse caso, tudo funciona simplesmente como habitual, só que sem uma fonte partilhada de onde beber ou para onde escrever de volta.

## Associar um projeto a uma biblioteca

Escolhe a biblioteca em dois locais, que mostram o mesmo painel:

- O **assistente de novo projeto** ("Novo projeto"), com um seletor de biblioteca.
- **Info do projeto** de um projeto existente — tanto na janela como em **Ficheiro → Info do projeto**.

Esse mesmo seletor tem também **+ Nova biblioteca de recursos…**, que lhe permite criar uma ali mesmo, sem ter primeiro de ir a Ficheiro → Biblioteca. **Nenhuma (projeto autónomo)** é uma escolha explícita na mesma lista — desassociar o seu projeto nunca é um efeito colateral acidental, é sempre algo que escolhe deliberadamente.

## O separador Recursos: duas vistas

Assim que um projeto está associado a uma biblioteca, o separador Recursos ganha um interruptor no canto superior direito com duas vistas:

- **Biblioteca** — gerir a fonte propriamente dita. Tudo aqui é diretamente editável, uma alteração aplica-se de imediato a **todos** os projetos que bebem desta biblioteca, e fica fora do desfazer (Ctrl+Z) — não é uma edição de projeto.
- **Projeto** — o que este projeto realmente usa: a tabela de projeto habitual, com marcações por linha para a origem e eventuais desvios.

Se trabalha com vários projetos abertos que bebem todos da mesma biblioteca, existe ainda uma terceira vista: **Ocupação**. Mostra, por recurso da biblioteca, onde ele está reservado ao longo de *todos* os documentos abertos, e assinala os dias em que a soma dessas reservas ultrapassa a capacidade da empresa — a dupla reserva entre projetos, que nenhum projeto consegue ver sozinho. Leia o guia [Visão geral da ocupação](docs://gids-bezettingsoverzicht).

## Três tipos de linhas na vista de projeto

Na vista de projeto encontra três tipos de linhas:

1. **Da biblioteca** — assinaladas com a marca **Da biblioteca**. Nome, tipo, tarifa/hora e unidade são herdados da biblioteca e mostrados aqui como texto simples: não os edita aqui, mas sim na vista **Biblioteca**. Já as unidades máx., a disponibilidade faseada no tempo e a escolha do calendário são livremente editáveis — esse é precisamente o compromisso deste projeto.
2. **Exclusiva do projeto** — sem marca, totalmente editável. Mesmo um projeto associado pode ter destas linhas: úteis para itens pontuais que não pertencem à biblioteca partilhada, como uma grua alugada ou um subempreiteiro contratado só para este trabalho.
3. **Órfã** — o original da biblioteca desapareceu; a linha fica marcada como **não está mais na biblioteca**. A cópia em si continua a funcionar normalmente — pode desvinculá-la ou eliminá-la.

## O que acompanha a biblioteca — e o que não acompanha

Esta é a parte que vale a pena memorizar: alguns campos são um acordo à escala da empresa e acompanham a biblioteca; outros são o compromisso deste projeto e você define-os livremente, sem que isso alguma vez conte como um desvio.

**Acompanha a biblioteca:**
- Nome
- Tipo
- Descrição
- Tarifa/hora
- Unidade
- O **conteúdo** de um calendário que viajou junto com um recurso (dias úteis, horas, feriados)

**Decide por projeto, sem que conte como desvio:**
- Unidades máx.
- A disponibilidade faseada no tempo
- A **escolha** de qual o calendário associado ao recurso

Atribua um recurso da biblioteca e o seu calendário viaja junto como uma cópia associada que continua, por sua vez, a acompanhar a biblioteca — daí que o *conteúdo* desse calendário esteja acima, em **Acompanha a biblioteca**. Mas a *escolha* de qual o calendário associado a um recurso está em **Decide por projeto**: a mesma equipa pode perfeitamente trabalhar com um calendário diferente numa obra urgente do que trabalharia normalmente, sem que isso seja um desvio da biblioteca. Esta distinção é subtil mas importante: altere a tarifa ou o nome de um recurso da biblioteca, e a cópia desvia-se da biblioteca; altere a escolha do calendário ou as unidades máx., e está a fazer exatamente aquilo para que esse campo existe.

## Três ações que ligam os dois mundos

- **Atribuir ao projeto** — da biblioteca para o projeto: cria uma cópia editável com origem.
- **Para a biblioteca** — de uma linha exclusiva do projeto para a biblioteca partilhada: associa-a de imediato. Se já existir um item com o mesmo nome na biblioteca, a aplicação associa-o a esse em vez de duplicar.
- **Desvincular da biblioteca** — a origem desaparece, tudo volta a ficar totalmente editável. Um calendário que tinha viajado junto desvincula-se também, a menos que outro recurso ainda associado esteja a usar esse mesmo calendário.

## Atualização e desvios

A aplicação verifica se as suas cópias ainda correspondem à biblioteca em quatro momentos fixos: ao **abrir** um ficheiro, ao **mudar** de documento, depois de uma **edição na biblioteca**, e depois de uma **recuperação após falha**.

- Se uma cópia simplesmente ficou desatualizada (você não a alterou, mas a biblioteca evoluiu entretanto), é **atualizada em silêncio** — vê apenas um breve aviso, sem qualquer pergunta.
- Se uma cópia foi alterada localmente (ou por outra pessoa), aparece a marca **difere — decidir**, e a aplicação pergunta, item a item, o que deve acontecer: **Usar valores da biblioteca**, **Adotar os valores do arquivo na biblioteca**, ou **Decidir depois**.

Estas escolhas não podem ser desfeitas com Ctrl+Z — a segunda opção altera a própria biblioteca, que fica completamente fora do histórico de desfazer do projeto.

## Partilha e cópia de segurança

Um ficheiro de projeto é sempre autónomo e completo: entregue-o a alguém sem a sua biblioteca, e tudo continua a funcionar, só que sem uma fonte partilhada. Exporta e importa uma biblioteca através de **Ficheiro → Biblioteca** — que é também a sua cópia de segurança.

Ao importar, escolhe entre duas opções:

- **Adicionar como nova biblioteca de recursos** — a biblioteca do ficheiro é simplesmente adicionada, como uma biblioteca extra ao lado das que já tem, e nunca substitui nada seu. Se o remetente já tinha separado uma segunda biblioteca própria (por exemplo, para um subempreiteiro à parte), essa biblioteca traz consigo a sua própria identidade: um projeto enviado junto com ela reconhece de imediato as equipas e calendários que já usava como itens de biblioteca outra vez, sem que tenha de acertar nada. Se o remetente só teve sempre uma única biblioteca nunca separada — o caso mais comum para a maioria das pessoas — esse reconhecimento automático não acontece: associa o projeto enviado à nova biblioteca você mesmo, apenas uma vez, e a partir daí a correspondência por nome trata do resto. Se já tiver exatamente essa biblioteca, é antes adicionada como uma cópia separada ao lado dela.
- **Substituir uma biblioteca de recursos existente** — todo o conteúdo da biblioteca que escolher é substituído pelo que está no ficheiro. Se a sua própria versão for mais recente do que a que está a importar, a aplicação avisa-o disso antecipadamente.

Qual das opções vem pré-selecionada depende do ficheiro: se a aplicação ainda não reconhecer a biblioteca, é selecionada "Adicionar como nova biblioteca de recursos"; se a reconhecer (a mesma biblioteca, uma versão diferente), é selecionada "Substituir uma biblioteca de recursos existente", já com essa biblioteca escolhida.

As bibliotecas não se sincronizam sozinhas entre máquinas: se dois planeadores trabalharem com a mesma biblioteca em computadores diferentes, as bibliotecas podem divergir.

## Biblioteca de recursos de demonstração nos exemplos

Abra um dos exemplos de demonstração (**Ficheiro → Exemplos**, ou a partir deste painel de Ajuda), e a aplicação cria uma vez uma **Demo-resourcebibliotheek** e associa a ela o exemplo aberto. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) e [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) partilham as mesmas equipas dessa biblioteca, para que veja de imediato como uma biblioteca alimenta vários projetos. As suas próprias bibliotecas de recursos existentes ficam completamente intocadas.

## Continue a ler

- Atribuir recursos, ler o histograma e nivelar são todos temas do lado do projeto na gestão de recursos — leia o guia [Recursos, histograma & nivelamento](docs://gids-resources-histogram).
- O calendário associado a um recurso usa os mesmos blocos de construção que qualquer outro calendário — leia o guia [Calendários & planeamento por horas](docs://gids-kalenders-uren).
- Veja você mesmo a partilha de equipas entre projetos em [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) e [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
