# Ligar um assistente de IA (MCP)

O Open Planner Studio pode abrir-se a um assistente de IA. Ative o modo IA e a aplicação torna-se um **servidor MCP**: um assistente como o Claude liga-se à janela que tem aberta neste momento, lê o seu cronograma e pode editá-lo. Assiste a tudo em tempo real — cada tarefa que ele adiciona aparece de imediato no Gantt — e tudo o que o assistente fizer, desfaz com um único Ctrl+Z.

Este é um modelo fundamentalmente diferente de exportar um ficheiro, editá-lo noutro lado e voltar a importá-lo. Não há cópia, não há formato intermédio, e não há nenhum momento em que você e o assistente estejam a olhar para coisas diferentes. Este guia mostra como o ativar, como ligar um assistente, o que ele pode e não pode fazer, e o que tentar quando algo não funciona.

## O que vai aprender aqui

- Ativar o modo IA e encontrar o separador de IA.
- Iniciar a ponte, e fazê-la arrancar automaticamente com a aplicação.
- Ligar um assistente — com um prompt pronto a usar ou um excerto de configuração.
- O que um assistente pode fazer ao seu cronograma.
- Os controlos de segurança: pausar, só leitura, cópia de segurança automática e o painel de atividade.
- O que fazer quando a ligação não se estabelece.

A ponte funciona **apenas na aplicação de ambiente de trabalho**. O separador de IA é visível na versão de navegador, mas o servidor em si corre na shell de ambiente de trabalho e não pode arrancar aí.

## Ativar

O modo IA está desativado por predefinição. Ative-o em **Definições → Aplicação → Ativar modo IA** — através do ícone de engrenagem, do separador do friso Definições ou de Ficheiro → Definições; os três mostram o mesmo interruptor.

Assim que está ativo, aparece um separador extra **IA** no friso. Desative o modo IA outra vez e o separador desaparece e uma ponte em funcionamento é parada de imediato — assim, nunca fica um servidor à escuta sem que o separador esteja presente.

Por baixo está **Iniciar a ponte automaticamente**. Com este interruptor ativo, o servidor entra em funcionamento assim que abre a aplicação, para que um assistente se possa ligar sem ter de visitar primeiro o separador de IA. Está desativado por predefinição: abrir uma porta à escuta no seu próprio computador deve ser uma escolha deliberada.

## O separador de IA

O separador tem quatro grupos.

**Servidor** — o botão **Iniciar ponte** (ou **Parar ponte**) com o estado ao lado: *Desligada*, *Ativa na porta 3877*, *Porta … ocupada* ou *Erro*. O mesmo estado aparece como um ponto colorido no canto inferior direito da barra de estado, para que possa ver se a ponte está viva a partir de qualquer outro separador.

**Ligação** — o número da porta (só editável enquanto o servidor está parado; um servidor em funcionamento mantém a sua porta), o token, e o botão **Conectar**. O token está oculto por predefinição; o botão do olho torna-o visível, o botão de copiar copia-o, e **Novo token** gera um token novo. Atenção: esta última ação quebra *todas* as ligações existentes, pois todas elas usam o token antigo — por isso a aplicação pede confirmação primeiro.

**Segurança** — **Pausar**, **Só leitura**, o interruptor **Cópia de segurança automática**, e os botões **Criar cópia de segurança agora** e **Abrir pasta de cópias de segurança**. O que cada um faz está descrito mais abaixo em *Os controlos de segurança*.

**Atividade** — o botão **Painel de atividade** abre uma lista de todas as chamadas que o assistente faz: hora, nome da ferramenta, quanto tempo demorou, e se foi bem-sucedida. Expanda qualquer linha para ver os argumentos e a resposta. É o seu registo: não tem de acreditar apenas na palavra do assistente sobre o que fez.

## Ligar um assistente

Clique em **Conectar**. A janela que abre contém quatro blocos que pode copiar um a um:

1. **Ponto final** — o endereço onde a ponte fica à escuta, por predefinição `http://localhost:3877/mcp`. O transporte é HTTP em streaming.
2. **Autenticação** — o cabeçalho HTTP que tem de acompanhar cada pedido, na forma `Authorization: Bearer …`.
3. **Excerto de configuração** — um bloco de JSON pronto a usar, para colar na configuração MCP do seu cliente.
4. **Prompt de ligação** — um texto que cola diretamente no seu assistente; este liga-se sozinho e depois verifica a sua própria lista de ferramentas.

Esta última é a via mais curta e funciona com qualquer assistente capaz de adicionar servidores MCP. O prompt é deliberadamente neutro em relação ao fornecedor: menciona apenas o endereço, o token e o que o assistente deve verificar a seguir, pelo que funciona da mesma forma com um fornecedor ou com outro.

A ligação está concluída assim que o assistente consegue listar as suas ferramentas. Deverá ver perto de quarenta, todas a começar por `planner_`. Se não vir nenhuma, a ponte não está em funcionamento ou o token está errado.

O token dá acesso ao plano que tem aberto neste momento. Trate-o como uma palavra-passe: não o coloque num documento partilhado, nem numa conversa com outras pessoas.

## O que um assistente pode fazer

As ferramentas cobrem, grosso modo, tudo o que você próprio faz na aplicação:

- **Leitura** — visão geral do projeto, lista de tarefas, uma única tarefa em detalhe, o caminho crítico, recursos e o respetivo histograma, calendários, baselines, e a comparação com uma baseline.
- **Planeamento** — criar tarefas (uma WBS inteira com fases e subtarefas de uma só vez), editá-las, movê-las e eliminá-las; adicionar, alterar e remover relações; registar progresso.
- **Configuração** — criar e atribuir recursos, gerir calendários e feriados, guardar e ativar baselines, nivelar.
- **Gestão** — criar, duplicar e alternar entre documentos, importar ficheiros de cronograma, e exportar para IFC.

Duas coisas importam mais do que a própria lista.

**Um assistente pode trabalhar através de um único guião.** Em vez de invocar uma ferramenta a seguir à outra, pode submeter uma sequência de passos como um todo. Isto não é apenas mais rápido: o guião inteiro torna-se um único passo no seu histórico. Se construir num só passo um cronograma de quarenta tarefas com todas as suas relações, um único Ctrl+Z remove tudo outra vez. Se algo falhar estruturalmente a meio do caminho, o guião inteiro é revertido, em vez de o deixar com um cronograma a meio.

**O cronograma é recalculado após cada alteração.** O assistente não precisa de o pedir à parte e, por isso, não pode continuar a trabalhar por engano sobre datas desatualizadas.

## O que um assistente não pode fazer

A ponte é deliberadamente mais limitada do que a aplicação. Há algumas coisas que um assistente simplesmente não pode fazer, mesmo que lhe peça — recebe uma recusa que explica qual é a via que funciona. Isto não é um bloqueio infantil: em cada caso, trata-se de algo que ultrapassa o projeto que está a ver neste momento.

**A própria biblioteca de recursos.** Um assistente não pode criar, alterar ou eliminar um recurso ou calendário da biblioteca. Uma biblioteca são dados ao nível da aplicação, partilhados por todos os seus projetos, e as edições feitas nela ficam fora do histórico de desfazer normal. Uma única alteração de tarifa propagar-se-ia, portanto, a projetos que nem sequer estão abertos, sem forma de a reverter. Isso faz-se você próprio, em Ficheiro → Biblioteca.

**Os campos fixos de um recurso herdado.** Se um recurso vem de uma biblioteca, é essa biblioteca que decide o que o recurso *é*: nome, tipo, descrição, tarifa/hora e unidade. Esses campos aparecem como texto simples no separador Recursos por uma razão — também você não os pode editar aí — e o assistente não lhes consegue chegar mais do que você. O que o *projeto* decide continua ao seu alcance: unidades máx., a disponibilidade faseada no tempo, o calendário e a pertença a uma equipa. Se ainda assim pedir uma tarifa/hora diferente, a recusa indica as duas vias reais: alterá-la na biblioteca (o que passa então a aplicar-se a todos os projetos), ou primeiro desvincular o recurso da biblioteca — depois disso torna-se propriedade do projeto e fica totalmente editável, e o próprio desvincular é desfeito com Ctrl+Z.

**Qual o calendário que é o calendário do projeto.** O assistente pode editar o conteúdo desse calendário, mas trocar qual deles o projeto usa é algo que faz você próprio na biblioteca de calendários. O mesmo se aplica a opções de planeamento como a definição de múltiplos caminhos críticos.

**A própria aplicação.** Não existe nenhuma ferramenta para definições, tema, idioma, extensões ou o atualizador. Um assistente não altera nada na forma como o seu programa está configurado.

**Ficheiros — sim, mas com limites.** Importar significa que pode ler um ficheiro de cronograma do seu disco, e exportar significa que pode escrever um IFC. A escrita fica limitada à sua pasta pessoal, e um ficheiro existente nunca é substituído a menos que isso tenha sido pedido explicitamente. Uma exportação também não é um "guardar": o seu documento continua marcado como não guardado na aplicação, pelo que não pode substituir o seu ficheiro de projeto pelas suas costas.

Ao pedir a lista de recursos, um assistente vê imediatamente quais os recursos que vêm de uma biblioteca, a que empresa pertencem, e quais os campos que estão fixos. Não precisa de esbarrar primeiro na parede para o descobrir.

## Os controlos de segurança

**Pausar** mantém a ponte ativa, mas recusa todas as alterações; a leitura continua permitida. Útil quando quer fazer algo você mesmo sem perder a ligação.

**Só leitura** faz o mesmo, mas como postura em vez de pausa: permita que um assistente analise, relate ou compare o seu cronograma sem poder alterar seja o que for.

**Cópia de segurança automática** escreve automaticamente uma cópia IFC antes da primeira alteração num documento. Isto acontece uma vez por documento e por sessão, para não acumular uma pilha de ficheiros a cada chamada. **Criar cópia de segurança agora** fá-lo de imediato — útil mesmo antes de deixar um assistente fazer algo drástico. **Abrir pasta de cópias de segurança** leva-o até onde elas ficam; a aplicação guarda as últimas dez por documento.

Para além disso, há o histórico de desfazer normal, que um assistente partilha consigo. Tudo o que ele fizer, você pode desfazer — e o assistente também, já que desfazer e refazer estão igualmente nas suas ferramentas.

## Quando não funciona

**"Porta … ocupada."** Já há algo à escuta nessa porta. Normalmente é uma segunda janela desta aplicação: a ponte só consegue servir uma de cada vez. Feche a outra janela, ou escolha um número de porta diferente enquanto o servidor está parado.

**O assistente não recebe resposta, ou fica bloqueado.** Isto acontece quando a janela por trás do servidor desapareceu ou foi recarregada. Pare a ponte e inicie-a de novo; se isso não ajudar, reinicie a aplicação. Se não tiver a certeza se ainda está viva, veja o ponto de estado na barra de estado.

**O assistente não vê ferramentas, ou reporta um erro de acesso.** Nesse caso o token está errado. Isto acontece sobretudo depois de clicar em **Novo token** quando já havia uma ligação estabelecida: o assistente continua a usar o token antigo. Copie o novo a partir da janela **Conectar** e atualize a configuração do seu cliente.

**Não acontece nada, apesar de o assistente dizer que funcionou.** Veja no painel de atividade o que ele realmente invocou e o que voltou como resposta. Se houver uma recusa, esta indicará quase sempre o campo que estava errado, bem como a alternativa.

## Levar o seu assistente de IA a planear bem

Um assistente que conhece as ferramentas pode ainda assim construir um planeamento que não serve a nenhum planeador: tarefas sem ligações, uma data fixa em cada tarefa, ou uma decomposição demasiado fina para ser mantida. Os princípios que evitam isso estão no guia [Planear bem: dos requisitos a um planeamento fiável](docs://gids-goed-plannen) — dê-o a ler ao seu assistente antes de começar, ou remeta para ele nas suas instruções. O código-fonte do Open Planner Studio contém ainda uma breve skill de agente em `.claude/skills/goed-plannen/`, que remete para esse mesmo guia quanto ao conteúdo e acrescenta apenas o que é específico do agente: por que ordem usar as ferramentas `planner_` e o que reportar ao utilizador.

## Leitura adicional

- [Baselines & progresso](docs://gids-baselines-voortgang) — o que a data de estado faz ao seu cronograma. Vale a pena saber antes de deixar um assistente defini-la: não é apenas uma data de referência, também empurra para a frente o trabalho ainda não iniciado.
- [Importação/exportação](docs://gids-import-export) — como o IFC, o CSV, o MS Project e o P6 se relacionam entre si.
- [Definições](docs://ref-instellingen) — todas as definições num só lugar, incluindo os dois interruptores de IA.
