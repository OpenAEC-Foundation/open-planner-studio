# Painel de recursos

O painel de recursos é onde gere os recursos: quem e o quê está disponível, com que capacidade e em que calendário. O histograma sob o Gantt e a sobrealocação fazem parte dele. Este artigo explica, para cada campo e botão, o que faz, qual é o padrão e o que se vê. Para saber como criar e atribuir recursos, veja [Gerir recursos](docs://howto-resources-beheren) e [Atribuir recursos com uma curva](docs://howto-resource-toewijzen). Para resolver a sobrealocação, veja [Resolver a sobrealocação](docs://howto-overbezetting-oplossen).

## Onde encontrar

- **Painel completo** — *Recursos › Gerir › Recursos* ou *Visualização › Painéis › Recursos*. Ocupa toda a área de trabalho; a cruz no canto superior direito fecha-o.
- **Dock de recursos** — *Recursos › Gerir › Dock de recursos* ou *Visualização › Painéis › Dock de recursos*: uma lista compacta na coluna da direita, ao lado do Gantt. Veja abaixo.
- **Histograma** — *Recursos › Histograma › Histograma* ou *Visualização › Painéis › Histograma*: uma faixa sob o Gantt. Veja abaixo.
- **Vistas** — se o projeto pertencer a uma biblioteca de recursos, o canto superior direito do painel tem uma escolha entre *Biblioteca*, *Projeto* e *Ocupação*. Sem biblioteca de recursos, existe apenas a tabela do projeto. Cada vez que abre o painel, este começa em *Projeto*. Assim, não fica na biblioteca partilhada sem o notar.

## Novo recurso

- **Novo recurso no projeto** (na vista *Biblioteca*, o botão *Novo recurso na biblioteca*) — botão no canto superior direito. Abre uma linha provisória no fim da tabela. Nada é criado até introduzir um nome e sair da linha, ou premir Enter. Se sair com a linha vazia ou premir Esc, não fica nada: nenhum recurso e nenhum passo em *Desfazer*. Pode preencher os campos por qualquer ordem; tudo é gravado de uma vez. Enter ou a seta para baixo confirma a linha e abre uma nova linha provisória. Shift+Enter ou a seta para cima confirma-a e volta à tabela. A linha provisória não tem o expansor da capacidade, o lápis do calendário nem o caixote, porque estes atuam sobre um recurso que ainda não existe. O botão *Novo recurso* em *Recursos › Gerir* faz o mesmo.
- **Navegação na tabela** — na tabela, Enter e Shift+Enter, e as setas para cima e para baixo, movem o cursor entre as linhas. Enter na última linha abre uma nova linha provisória.

## A vista Projeto

A tabela do que este projeto usa. Cada linha é um recurso. As alterações ao texto e à tarifa entram em vigor ao sair do campo e contam como um passo em *Desfazer*.

- **Cor** — um seletor de cor. Padrão: a primeira cor livre da paleta. Efeito: a cor do *Acento de recurso* sob as barras do Gantt (*Visualização › Linhas de base e progresso › Acento de recurso*) e da amostra no dock.
- **Nome** — o nome do recurso. Um nome vazio não é guardado; o campo volta ao nome anterior.
- **Tipo** — *Mão de obra*, *Equipamento*, *Material*, *Subempreiteiro* ou *Equipa*. Padrão para um novo recurso: *Mão de obra*. Efeito: *Material* tem uma *Unidade* e não conta na soma *Todos os recursos* do histograma; o nivelamento ignora o material. *Equipa* pode ser escolhida como *Equipa* de outros recursos. Os outros tipos calculam da mesma forma.
- **Unidades máx** — quanto do recurso está disponível por dia, um número acima de 0 (são permitidas frações). Padrão: 1. Efeito: a capacidade por dia. Se a carga for mais alta, o recurso fica sobrealocado. A seta ao lado desdobra a *Capacidade faseada no tempo*; o número ao lado da seta é o número de etapas.
- **Capacidade faseada no tempo** — etapas com *A partir de* (uma data) e *Unidades máx*. *Adicionar etapa* acrescenta uma etapa com a data de hoje e 1. Sem etapas, aparece *Sem etapas — aplica-se sempre o máximo de unidades fixo.* Efeito: a partir da data de uma etapa, aplica-se o seu valor de *Unidades máx* em vez do valor fixo. Vence a última etapa com uma data igual ou anterior a esse dia.
- **Calendário** — uma lista com *Calendário do projeto* (padrão), os calendários do projeto e *+ Calendário do recurso* para um novo. O lápis (*Editar…*) abre o calendário escolhido e fica desativado para *Calendário do projeto*. Efeito: os dias em que o recurso trabalha. Num dia de folga a capacidade é 0. Se houver trabalho planeado nesse dia, o recurso fica sobrealocado com o motivo *Não trabalha neste dia segundo o calendário "…"*. O calendário do recurso não altera as datas de uma tarefa. Veja [Janelas do calendário](docs://ref-kalenders).
- **Tarifa/hora** — o custo por hora. Vazio = sem tarifa; um número inválido volta ao valor anterior. Efeito: não influencia o planeamento nem a carga. A tarifa determina a coluna *Total*, fica guardada no ficheiro IFC e é escrita também ao exportar para o MS Project (tarifa padrão) e para XML do Primavera P6 (preço por unidade).
- **Total** — só leitura: as horas carregadas × a tarifa, com duas casas decimais; *—* sem tarifa ou sem carga. No fim, uma linha *Total* soma todos os recursos. As horas vêm do último cálculo e contam unidades × horas por dia do calendário da tarefa. Desatualizado? Prima *Calcular*.
- **Unidade** — a unidade de medida do material, por exemplo `m³`. Só se preenche no tipo *Material* (dica *Só se preenche em recursos do tipo Material.*). Efeito: uma etiqueta; não calcula.
- **Equipa** — a equipa a que o recurso pertence, escolhida entre os recursos do tipo *Equipa*. Padrão: *Nenhuma*. Efeito: só agrupa; a capacidade e a carga de uma equipa não são a soma dos seus membros.
- **Eliminar** (o caixote) — elimina o recurso. Se tiver atribuições, a aplicação pergunta primeiro *'…' tem … atribuição(ões) — eliminar?*, com um visto para confirmar e uma cruz para cancelar.
- **Para a biblioteca de recursos** — só quando o projeto pertence a uma biblioteca de recursos, para um recurso com um nome que ainda não vem dela. Coloca o recurso na biblioteca de recursos, ou associa-o a um item existente com o mesmo nome, e indica o que aconteceu (*Adicionado.*, *Já existia na biblioteca — agora associado.* ou *Associado ao item existente da biblioteca — os valores diferem, ver a marcação.*).
- **Desvincular da biblioteca de recursos** — o ícone de desvincular num recurso que vem da biblioteca de recursos. Remove a origem; depois, todos os campos ficam novamente livres.

Sem recursos, aparece *Ainda não há recursos. Adicione um para começar.* Se o projeto pertencer a uma biblioteca de recursos, aparece *Este projeto ainda não usa recursos da biblioteca.* com uma sugestão.

### Recursos da biblioteca de recursos

Um recurso que vem da biblioteca tem um pequeno ícone de biblioteca (*Da biblioteca*). O seu *Nome*, *Tipo*, *Tarifa/hora* e *Unidade* são então texto simples (*Valor da biblioteca — edite-o na vista Biblioteca, ou desvincule este recurso da biblioteca.*), porque a biblioteca de recursos decide o que é o recurso. *Cor*, *Unidades máx*, as etapas de capacidade, *Calendário* e *Equipa* continuam editáveis, porque o projeto decide quanto e quando. Podem aparecer dois distintivos: *difere — decidir* (um clique abre a janela *Vincular biblioteca de recursos*) e *não está mais na biblioteca*, com o botão *Remover do projeto*.

## A vista Biblioteca

Só quando o projeto pertence a uma biblioteca de recursos. Veja [Utilizar a biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken) e [Gerir e partilhar bibliotecas de recursos](docs://howto-bibliotheken-beheren). No topo há um aviso colorido: *Isto edita a biblioteca e aplica-se a todos os projetos — fora do desfazer.* A tabela tem os mesmos campos que a vista *Projeto*, com estas diferenças:

- Não há coluna *Total*: é um cálculo de um só projeto.
- A coluna *Equipa* aparece assim que a biblioteca tiver recursos.
- A coluna *Calendário* oferece os calendários da biblioteca, com *Sem calendário* como padrão.
- **Atribuir ao projeto** — coloca o recurso no projeto, com uma cópia do seu calendário. Indica *Adicionado.* ou *Já está no projeto.*
- **Eliminar** — pergunta *Remover «…» da biblioteca? Isto aplica-se a todos os projetos e não pode ser desfeito.*
- Sem recursos, aparece *Ainda não há recursos no pool.*

## A vista Ocupação

Uma vista em só leitura sobre todos os documentos abertos: que recursos da biblioteca estão reservados e onde. Não há botão para um novo recurso. Veja [Utilizar a visão geral da ocupação](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabela** — por recurso da biblioteca: *Nome*, *Documentos* (o número de documentos em que está), *Período* e *Pico / Capacidade* (a carga combinada mais alta face à capacidade nesse dia). A vermelho, *N dias com reserva dupla* significa que, em vários documentos, o recurso tem mais do que a sua capacidade. A seta ao lado de um nome desdobra os documentos, cada um com período e pico. Um clique numa linha mostra o histograma desse recurso (*Selecione um recurso para ver o histograma.*).
- **O que conta** — só os documentos abertos nesta aplicação (*Esta vista só vê os documentos abertos nesta aplicação.*). Um documento que não foi calculado recebe uma mensagem na sua linha. O documento ativo conta com os últimos valores calculados (*Desatualizado: estes são os últimos valores calculados — prima F5 neste documento.*). Outro documento é calculado antecipadamente pela vista (*Calculado antecipadamente para esta vista — o próprio documento continua a mostrar datas mais antigas até premir F5 nele ou ativar “Calcular automaticamente”.*). Se *Calcular automaticamente* estiver ativo, a vista calcula de facto esses documentos. Se o cálculo falhar, o documento não conta (*Não contabilizado: planificação não calculada — ative este documento e prima F5.*). Sem recursos reservados, aparece *Nenhum recurso da biblioteca reservado nos documentos abertos.*
- **Ordem** — os recursos com reservas duplas ficam no topo, primeiro os que têm mais dias em conflito e depois por ordem alfabética.

## O dock de recursos

Uma lista compacta na coluna da direita, ao lado do painel *Propriedades*. Por recurso: uma amostra de cor, o nome (só leitura), um triângulo vermelho *Sobrealocado* assim que o recurso tiver pelo menos um dia sobrealocado, e *Unidades máx* para editar. Se houver uma seleção de tarefas, só aparecem os recursos dessas tarefas. No cabeçalho estão *Painel completo* (abre o painel completo) e *Fechar ancoragem*. Sem recursos, aparece *Ainda não há recursos. Adicione um para começar.*

## O histograma

Uma faixa sob o Gantt que mostra a carga de um recurso por dia. Ative ou desative-a em *Recursos › Histograma › Histograma* ou em *Visualização › Painéis › Histograma*. Padrão: desligado; a sua escolha fica guardada. A altura é de 160 pixels por padrão e pode ser arrastada na margem entre o Gantt e o histograma.

- **Seletor** — à esquerda, sob a tabela de tarefas, há uma lista: *Todos os recursos* fixados no topo e, por baixo, uma linha por recurso. Um clique escolhe a linha, as setas do teclado percorrem a lista, e *Recursos › Histograma › Anterior* e *Seguinte* fazem o mesmo. Um ponto vermelho ao lado de uma linha significa que esse recurso tem pelo menos um dia sobrealocado. Para *Todos os recursos*, o ponto só considera os recursos que não são material. Se houver uma seleção de tarefas, a lista só contém os recursos dessas tarefas. Se o recurso escolhido ficar fora dela, a faixa mostra temporariamente *Todos os recursos* da seleção.
- **Barras** — uma barra por dia: a carga em *unidades*. Uma linha mostra a capacidade; a parte da barra acima da capacidade fica vermelha. No canto superior esquerdo está o valor mais alto, com *unidades*. *Todos os recursos* soma a carga e a capacidade de todos os recursos, exceto material.
- **Dica** — mantenha o rato parado durante um momento sobre um dia: *N tarefas contribuem em {date}*, com os nomes de no máximo oito tarefas. Para um recurso escolhido e um dia em que o seu calendário não trabalha, aparece também *Não trabalha neste dia segundo o calendário "…"*.
- **Mensagens na faixa** — *Recalcular (F5) para mostrar a carga* enquanto não há carga, *Ainda não há recursos* sem recursos, e *⚠ Planeamento desatualizado — recalcule (F5)* no canto superior direito quando o planeamento está desatualizado.
- **O que conta** — as unidades por dia de cada atribuição, distribuídas pelos dias úteis da tarefa segundo a *Curva* (ou a *Distribuição de horas*); só tarefas-folha, sem marcos. A carga atualiza-se após *Calcular* e após alterações aos recursos e às atribuições. Se alterar as datas das tarefas, isso só conta após *Calcular*.

## Sobrealocação

Um recurso fica sobrealocado num dia se a sua carga for superior à sua capacidade. A capacidade é *Unidades máx* (com as etapas de capacidade) num dia útil do seu calendário, e 0 num dia de folga. O material também conta aqui. O motivo é capacidade insuficiente ou um dia em que o recurso não trabalha segundo o seu calendário.

Onde o vê:

- **Recursos › Sobrealocação** — o número de recursos sobrealocados, ou *Nenhuma*.
- **Barra de estado** — *N recurso(s) sobrealocado(s)*; um clique abre o painel *Avisos*.
- **Avisos** — uma linha por recurso: *Sobrealocado durante N dia(s) (primeiro – último)*, com *o recurso não trabalha estes dias segundo o seu calendário* acrescentado se todos os dias forem de folga, ou *dos quais N dia(s) o recurso não trabalha segundo o seu calendário* para uma mistura. Veja [Notificações e avisos](docs://ref-meldingen).
- **Histograma** — as partes vermelhas das barras e o ponto vermelho no seletor.
- **Dock** — o triângulo *Sobrealocado*.

O nivelamento pode resolver a sobrealocação ao deixar as tarefas começar mais tarde. Por padrão, a data de fim do projeto pode mover-se; com suavização, fica dentro da folga. O nivelamento não resolve um recurso que tem de trabalhar num dia de folga. Veja [Nivelamento](docs://uitleg-nivelleren).
