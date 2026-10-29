# Mover um projeto

Objetivo: deslocar todo o planeamento para uma nova data de início, e ver antecipadamente o que isso faz ao fim.

## Quando precisa disto

O início do trabalho muda: a licença chega mais tarde, ou reutiliza o planeamento de uma casa anterior para a seguinte. Mover cada tarefa uma a uma dá muito trabalho. Com **Mover projeto** introduz uma única nova data de início, e a aplicação desloca tudo o resto.

O fim do projeto nem sempre se desloca o mesmo número de dias que o início. O **calendário** não se desloca com ele: os feriados, a paragem da construção e a paragem de inverno ficam em datas fixas. Por exemplo: crie um projeto com *Início › Ficheiro › Novo*, com a *Data de início* 29-09-2026, o *País* em *Países Baixos* e as *Férias da construção* em *Nenhuma*. Coloque nele um planeamento de 30 dias úteis que termina a 9 de novembro de 2026. Se o mover para 14 de dezembro de 2026, 76 dias corridos depois, o fim fica a 26 de janeiro de 2027. Isso são 78 dias depois, porque 25 de dezembro e 1 de janeiro são agora dias sem trabalho dentro do seu planeamento. A duração mantém-se em 30 dias úteis. A pré-visualização na janela mostra isto antes de alterar seja o que for.

## Passos

1. Escolha *Planeamento › Agendamento › Mover projeto…*. O botão fica desativado enquanto o projeto não tiver data de início.
2. Em *Início atual do projeto* veja onde o projeto começa agora. Em *Novo início do projeto* escolha a nova data.
3. Se o projeto tiver linhas de base, aparece a caixa *Deslocar também as linhas de base*. Deixe-a desligada se quiser continuar a ver o deslocamento como desvio (veja as armadilhas).
4. Clique em *Calcular pré-visualização*. A aplicação calcula o planeamento deslocado por completo, sem alterar nada no seu projeto.
5. Verifique a pré-visualização (veja abaixo). Se estiver correta, clique em *Mover*.

Na pré-visualização vê:

- o deslocamento em dias corridos (*Deslocamento: 76 dias corridos para a frente*);
- o *Início do projeto* e o *Fim do projeto*, de antes para depois;
- um aviso vermelho se o calendário interferir, ou a mensagem de que a duração do projeto se mantém;
- o número de tarefas deslocadas e o que mais se desloca com elas;
- avisos que deve ler (veja as armadilhas).

A aplicação calcula o novo planeamento de imediato, por isso não precisa de usar **Calcular** (F5), e ajusta a vista a todo o projeto. Tudo isto é um só passo para *Desfazer* (Ctrl+Z).

O botão *Mover* só funciona depois de uma pré-visualização sem erro, e se a nova data for diferente da atual. Se alterar a data ou a caixa, a pré-visualização desaparece e tem de a calcular de novo.

### O que se desloca e o que não se desloca

Desloca-se: o início e o fim de cada tarefa, o início real e o fim real, as datas das restrições (também de uma fixação rígida Mandatory, veja [Restrições e prazos](docs://uitleg-constraints)), os prazos, a data de estado, as âncoras das relações externas e os passos de disponibilidade dos recursos. O início do projeto e, se o tiver preenchido, o fim do projeto também se deslocam.

Não se desloca:

- os calendários, por isso os feriados, a paragem da construção e a paragem de inverno;
- as linhas de base, a menos que ative *Deslocar também as linhas de base*;
- um campo personalizado preenchido do tipo *Data*.

## Armadilhas e o que a aplicação faz

**O fim desloca-se um número diferente de dias.** Se a pré-visualização vir que o fim se desloca mais ou menos dias corridos do que o início, ou que a duração do projeto em dias úteis muda, mostra um aviso vermelho com os números. Pode então ainda cancelar.

**As linhas de base mantêm-se definidas.** Uma linha de base existe para medir o desvio. Se mover o projeto com a caixa desligada, vê o deslocamento como desvio em relação à linha de base. Se ligar a caixa, as linhas de base deslocam-se com o planeamento. Só se deslocam as respetivas datas; a data em que a linha de base foi guardada mantém-se.

**Um projeto em curso.** As datas reais deslocam-se com ele. Num projeto em que já introduziu progresso, nem sempre é isso que pretende. A aplicação avisa: *Verifique se isso está correto para um projeto em curso.*

**Relações externas.** A âncora no seu projeto desloca-se com ele; o projeto de origem não se desloca. Atualize as relações externas depois de mover, com *Início › Tarefas › Ligação ▾ › Atualizar todas as relações externas*. Veja [Relações externas com outro projeto](docs://howto-externe-relaties).

**Feriados que não chegam até ao fim.** Um calendário com feriados gerados cobre um número de anos. Se o planeamento deslocado ultrapassar esse período, a aplicação calcula esse ano sem feriados. A pré-visualização avisa, por exemplo: *Os feriados gerados do calendário «Bouwkalender NL» abrangem 2025–2029; o planeamento deslocado vai até 2030. Volte a gerar os feriados.* Mova primeiro o projeto. Depois abra *Planeamento › Calendário › Calendário*: ao lado dos feriados aparece agora *Gerar novamente*. Confirme com *Aplicar* e a aplicação recalcula. O intervalo dos novos feriados segue as datas do projeto, por isso gerar novamente antes de mover não ajuda.

**A data está no passado.** Isso é permitido, mas a pré-visualização menciona-o: *A nova data de início está no passado.*

**Alterar o início do projeto em Definições do projeto é outra coisa.** Se alterar a data de início em *Definições › Projeto › Definições do projeto* e escolher *Aplicar*, o planeamento não se desloca. Só se deslocam as tarefas sem predecessora ou restrição que, depois disso, ficariam antes do novo início. Essas tarefas passam para essa data, e a aplicação diz quantas são. Se quiser deslocar tudo, use *Mover projeto…*.

## Ver também

- [Caminho crítico e folga](docs://uitleg-kritiek-pad): como o planeamento calcula e porque o fim se desloca.
- [Adicionar relações](docs://howto-relaties-leggen): as relações mantêm-se simplesmente definidas quando move.
- [Novo projeto e Definições do projeto](docs://ref-projectinfo): o que faz a data de início em *Definições do projeto*.
