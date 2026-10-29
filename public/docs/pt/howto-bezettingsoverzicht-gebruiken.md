# Usar a vista de ocupação

Objetivo: ver em que dias dois ou mais projetos abertos, em conjunto, pedem mais de um recurso do que a biblioteca de recursos tem.

## Quando precisa disto

A sua equipa de pedreiros está nas fachadas num projeto e nas garagens noutro. Cada projeto mostra a equipa bem planeada, porque o histograma e a sobrealocação de um projeto só olham para esse projeto. Só quando coloca os projetos lado a lado se vê que, nos mesmos dias, pedem, em conjunto, mais do que tem pedreiros. A vista de ocupação faz essa comparação lado a lado por si.

A vista só conta recursos que vêm da biblioteca de recursos, em projetos ligados à mesma biblioteca. Como isso é calculado, leia em [A biblioteca de recursos](docs://uitleg-resourcebibliotheek).

## Passos

### 1. Prepare os projetos

1. Abra os projetos que quer comparar, cada um no seu separador. Veja [Trabalhar com vários projetos ao mesmo tempo](docs://howto-meerdere-projecten). A vista só vê os projetos abertos nesta aplicação.
2. Ligue cada projeto à mesma biblioteca e use o recurso da biblioteca em todos os projetos. Sem ligação à biblioteca, o painel de recursos não mostra a vista de ocupação. Veja [Usar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken).
3. Calcule os projetos com *Calcular* (F5), ou ative *Calcular automaticamente*. O que a vista faz com projetos desatualizados está descrito nas armadilhas abaixo.

### 2. Abra a vista de ocupação

1. Vá a um dos projetos e escolha *Recursos › Gerir › Recursos*.
2. No canto superior direito, escolha *Ocupação*. A vista pertence à biblioteca do projeto em que está. Não pode alterar nada neste painel: a janela está em só leitura.

### 3. Leia a tabela

Cada recurso da biblioteca que está reservado em pelo menos um projeto aberto tem uma linha. Os recursos sem reserva não aparecem. As linhas com mais dias sobrealocados ficam no topo; depois, por ordem alfabética.

- *Documentos* indica em quantos projetos o recurso está reservado, por exemplo *2 documentos*.
- *Período* vai do primeiro ao último dia com carga, escrito como aaaa-mm-dd, por exemplo *2027-06-07 – 2027-06-14*.
- *Pico / Capacidade* compara a carga diária mais alta de todos os projetos em conjunto com a capacidade do recurso na biblioteca, por exemplo *4,0 / 3,0*. Se houver pelo menos um dia sobrealocado, o valor aparece a vermelho.
- Um marcador vermelho após a linha, por exemplo *3 dias com reserva dupla*, conta os dias em que a soma é maior do que a capacidade. Se passar o rato por cima, vê as datas.

### 4. Veja por projeto

1. Clique na pequena seta antes do nome de um recurso. A linha abre-se.
2. No topo estão as datas sobrealocadas: as cinco primeiras e depois *… e mais 3*, se houver mais. Por baixo, para cada projeto, estão o nome, o período e o pico desse único projeto, por exemplo *Houses North 2027-06-07 – 2027-06-11 Pico: 2,0*.
3. Clique na própria linha para ver um histograma em baixo. Cada projeto tem a sua própria cor e as barras são empilhadas. A linha tracejada é a capacidade da biblioteca. Se ela mudar ao longo do tempo, vê degraus. Os dias sobrealocados têm um fundo vermelho atrás das barras. Clique outra vez na linha para fechar o histograma. Sem linha escolhida, aparece *Selecione um recurso para ver o histograma.*

### 5. Resolva o problema

A vista mostra o problema, mas não o resolve. Tem duas opções:

- Mova uma tarefa num dos projetos, ou dê-lhe menos unidades por dia. Depois recalcule esse projeto com F5.
- Se alguém se juntar mesmo, aumente *Unidades máx* do recurso na biblioteca. Faça isso em *Recursos › Gerir › Recursos*, vista *Biblioteca*.

*Nivelar…* no friso não ajuda aqui: analisa os recursos apenas do projeto em que está. Veja [Nivelamento de recursos](docs://uitleg-nivelleren).

## Armadilhas e o que a aplicação faz então

**A vista está vazia.** Mostra *Nenhum recurso da biblioteca reservado nos documentos abertos.* Nesse caso, nenhum projeto aberto tem um recurso da biblioteca numa tarefa.

**Não vê o botão *Ocupação*.** O projeto em que está não está ligado a uma biblioteca de recursos.

**Um projeto não é contabilizado.** O projeto não está aberto nesta aplicação, está ligado a outra biblioteca de recursos, ou o recurso nele é um recurso próprio desse projeto. Na parte inferior da vista aparece sempre *Esta vista só vê os documentos abertos nesta aplicação.* Uma cópia de um recurso que entretanto foi retirado da biblioteca de recursos também não é contabilizada.

**Uma cópia ou variante conta por inteiro.** Cada projeto aberto que esteja ligado à biblioteca de recursos conta, mesmo que seja uma cópia ou variante de outro projeto aberto, por exemplo uma variante que um assistente de IA criou com `planner_duplicate_document`. Original e variante, em conjunto, podem então mostrar uma sobrealocação que, na realidade, existe só uma vez. A vista não filtra isso em silêncio: feche a variante por um momento, ou ignore-a ao ler.

**Um projeto está desatualizado.** Um projeto está desatualizado se alterou algo no planeamento sem recalcular. A vista trata então esse projeto da seguinte forma:

- Para um projeto que não é o separador ativo, a vista calcula ela própria antecipadamente, sem alterar o projeto. Acima da tabela aparece então *Os documentos alterados foram calculados antecipadamente para esta vista; prima F5 no documento, ou ative “Calcular automaticamente” para o fazer de forma permanente.* Depois do projeto aparece *Calculado antecipadamente para esta vista — o próprio documento continua a mostrar datas mais antigas até premir F5 nele ou ativar “Calcular automaticamente”.* Se *Calcular automaticamente* estiver ativo (*Definições › Projeto › Definições da aplicação*, separador *Planeamento*), a aplicação recalcula mesmo estes projetos assim que olha para a vista, e a mensagem desaparece. Se também o projeto ativo estiver desatualizado, aparece, em vez disso, acima da tabela, a mensagem do ponto seguinte.
- A vista não calcula ela própria o projeto em que está. Se esse projeto estiver desatualizado, aparece *Um documento alterado ainda não foi recalculado; é contabilizado aqui com os seus últimos valores calculados. Prima F5 nesse documento, ou ative “Calcular automaticamente”.* e, depois do projeto, *Desatualizado: estes são os últimos valores calculados — prima F5 neste documento.* Atenção: *últimos valores calculados* não é bem exato. A vista usa as datas de início antigas, mas já uma duração ou atribuição alterada. Por isso, os valores podem diferir tanto do planeamento antigo como do novo, e das barras do Gantt. Só confie neles depois de premir F5.
- Se a vista não conseguir calcular um projeto, por exemplo por causa de um ciclo nas suas relações, esse projeto não é contabilizado. Continua a aparecer, com *Não contabilizado: planificação não calculada — ative este documento e prima F5.* e, acima da tabela, *Pelo menos um documento não foi calculado e não é contabilizado na ocupação.*

**A vista não corresponde ao que espera.** A capacidade vem da biblioteca de recursos (*Unidades máx* do item da biblioteca, ou a sua *Capacidade faseada no tempo* nesse dia), não das *Unidades máx* da cópia no projeto. Uma soma igual à capacidade não é um conflito.

## Ver também

- [A biblioteca de recursos](docs://uitleg-resourcebibliotheek): como a ocupação é contabilizada, com um exemplo prático.
- [Usar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken): ligar projetos e atribuir recursos.
- [Resolver a sobrealocação](docs://howto-overbezetting-oplossen): sobrealocação dentro de um projeto.
