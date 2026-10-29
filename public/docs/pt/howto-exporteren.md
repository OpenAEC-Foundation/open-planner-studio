# Exportar

Objetivo: entregar o seu planeamento como ficheiro noutro formato, para alguém que não lê IFC ou para outro programa.

## Quando precisa disto

O consultor trabalha no MS Project, o cliente no Primavera, o subempreiteiro quer as tarefas em Excel, ou envia um planeamento a um programa que não consegue lidar com IFC. Uma exportação é uma cópia noutro formato. Se quiser manter o próprio projeto, guarde-o: isso grava em IFC e leva tudo consigo. O que cada formato leva e o que não leva está em [Ficheiros e formatos](docs://uitleg-bestanden).

## Passos

1. Escolha *Início › Ficheiro › Exportar* e escolha um formato na lista, ou escolha *Ficheiro › Exportar*. Aí, cada formato é um cartão com uma breve descrição.
2. Na janela, escolha um nome e um local. A aplicação sugere o nome do projeto, com a extensão do formato. As folhas de progresso chamam-se *projectname-voortgang* e abrem na sua pasta de transferências, sempre que possível.
3. Confirme. Não aparece nenhuma mensagem se a exportação for bem-sucedida, exceto as mensagens abaixo. Depois de exportar a partir de *Ficheiro › Exportar*, volta ao separador *Início*, mesmo se cancelar a janela. Se cancelar a janela de uma exportação da lista no separador *Início*, não acontece nada.

Se o seu navegador só guardar através de uma transferência (como o Firefox), o ficheiro fica na sua pasta de transferências logo após o passo 1. Vê a mensagem *Guardado como transferência: 'name.xml' está agora na sua pasta de transferências. Este ambiente não permite que a aplicação escreva diretamente no local escolhido.*

### Qual formato escolhe?

A lista do separador *Início* e os cartões em *Ficheiro › Exportar* oferecem os mesmos formatos:

- *Progresso (Excel)* e *Progresso (CSV)*, nos cartões *Folha de progresso (Excel)* e *Folha de progresso (CSV)*: uma folha simples com id, WBS, nome, datas e conclusão, para enviar a quem preenche o progresso.
- *CSV (;)*, no cartão *CSV (separado por ponto e vírgula)*: uma tabela de tarefas que se abre numa folha de cálculo.
- *MS Project XML*: pode ser aberto no Microsoft Project.
- *Primavera P6 XML*: para o Oracle Primavera P6.
- *IFC*: o formato próprio da aplicação, com tudo o que contém, no esquema IFC do projeto (por padrão, IFC 4.3 ADD2).

### Uma exportação IFC com um ficheiro de biblioteca

Se o seu projeto estiver ligado a uma biblioteca de recursos, a caixa de verificação *Guardar também o ficheiro de biblioteca* está abaixo dos cartões em *Ficheiro › Exportar*. Se a marcar e escolher *IFC*, a aplicação pede um local duas vezes: primeiro para o projeto, depois para *projectname-bibliotheek.ifc*. Esta caixa de verificação só está em *Ficheiro › Exportar*, não na lista do separador *Início*.

### Ler de volta uma folha de progresso

Lê de volta uma folha de progresso preenchida através de *Ficheiro › Importar*. Veja [Importar progresso a partir de uma folha de cálculo](docs://howto-voortgang-importeren).

## Armadilhas e o que a aplicação faz então

**O seu projeto não muda.** O ficheiro do projeto fica igual, e a marca *Não guardado* mantém-se se estava lá.

**Um planeamento desatualizado é recalculado primeiro.** Assim obtém as datas atuais, mesmo que se tenha esquecido de premir *Calcular*.

**Uma exportação também está em Recentes.** Isso não se aplica às folhas de progresso. Se abrir uma exportação aí, ela abre como importação desse formato.

**Uma exportação não leva tudo.** Um ficheiro CSV não tem recursos nem restrições, e o P6 XML não tem linhas de base nem prazos. O perfil de cálculo também não vai junto: uma exportação reaberta calcula como *Open Planner Studio*. Só o IFC leva tudo. Encontra um exemplo com números em [Ficheiros e formatos](docs://uitleg-bestanden).

**Dois formatos com a mesma extensão.** MS Project XML e Primavera P6 XML recebem ambos o nome *projectname.xml*. Dê-lhes nomes diferentes por si; caso contrário, mais tarde não saberá qual ficheiro é qual formato.

**Um planeamento com uma relação circular não é exportado.** A aplicação calcula primeiro e para quando há um ciclo. No separador *Início* recebe a mensagem *Não foi possível calcular o planeamento*, com por baixo, por exemplo, *Dependência circular entre tarefas: Set up site → Demolish existing extension → Set up site*. Em *Ficheiro › Exportar* só esse segundo texto está na página. Resolva o ciclo e exporte de novo.

**Um projeto do Primavera perde informação de origem.** Se exportar um projeto desses para CSV, MS Project XML ou P6 XML, a aplicação indica: *A exportação para CSV perde informações de origem XER.* Para MS Project XML diz *MSPDI*, e para P6 XML diz *P6*. Veja [Abrir um ficheiro Primavera P6 (.xer)](docs://howto-xer-openen).

**As tarefas com divisão perdem as suas divisões.** O MS Project e o Primavera só conhecem uma divisão como distribuição de horas. Se o seu projeto tiver tarefas com divisão sem distribuição de horas, a aplicação indica, depois de uma exportação para MS Project XML ou P6 XML: *2 tarefas com interrupções foram exportadas sem as suas interrupções: o MS Project/P6 só as conhece como distribuição do trabalho.* Para uma tarefa diz *1 tarefa com interrupções foi exportada sem as suas interrupções: o MS Project/P6 só as conhece como distribuição do trabalho.* Veja [Dividir uma tarefa](docs://howto-taak-splitsen).

**Um planeamento na vista *Datas como registadas*.** Se exportar para CSV enquanto vê as datas do ficheiro de origem, a aplicação deixa vazios `Critical` e `Total Float` nas tarefas para as quais o ficheiro de origem não registou esses valores. Veja [Datas como registadas](docs://uitleg-datums-zoals-opgeslagen).

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): o que cada formato leva e o que não leva.
- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): manter o próprio projeto como IFC.
- [Importar progresso a partir de uma folha de cálculo](docs://howto-voortgang-importeren): ler uma folha de progresso preenchida.
- [Formatos de importação e exportação](docs://ref-import-exportformaten): para cada formato, o que é transferido e o que não é.
