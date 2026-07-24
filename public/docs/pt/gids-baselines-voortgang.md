# Baselines & progresso

Um cronograma que nunca é atualizado é uma previsão. Assim que o trabalho começa, quer ver duas coisas ao mesmo tempo: o que foi originalmente acordado, e o que está realmente a acontecer agora. Uma **baseline** congela a primeira; o **progresso** e a **data de estado** acompanham a segunda. Este guia mostra como guardar e gerir uma baseline, como tornar visível a variância, como introduzir progresso, e exatamente o que a data de estado faz ao seu cronograma.

## O que vai aprender aqui

- Guardar e gerir uma baseline, e qual baseline está ativa.
- Ver a variância: a sobreposição da baseline no Gantt e o relatório de variância.
- Introduzir progresso — percentagem, datas reais — através do painel, do diálogo de tarefa e do menu de contexto.
- A data de estado: o que faz a tarefas ainda não iniciadas e a marcos não assinalados.
- Avisos fora de sequência: o que significam e como resolvê-los.
- Ler a linha de progresso.

Siga com [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (uma baseline antes do início, mais progresso e uma data de estado a meio do projeto) e com [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (duas baselines — uma baseline de contrato e uma nova baseline após uma ordem de alteração — com o seu próprio progresso e data de estado).

## Guardar e gerir uma baseline

Abra a janela **Baselines** através do grupo do friso **Baselines e progresso** no separador **Planeamento**: **Guardar baseline…** guarda imediatamente uma nova baseline com um nome sugerido ("Baseline 1 — [data]"), **Gerir baselines…** abre a mesma janela para rever, renomear ou eliminar.

A janela mostra uma tabela com todas as baselines guardadas: um botão de opção **Ativa**, o **Nome** (editável diretamente), a data **Criada**, e um botão de eliminar. Exatamente uma baseline pode estar ativa de cada vez — essa é a baseline com a qual a sobreposição do Gantt e o relatório de variância comparam. Eliminar a baseline ativa pede confirmação (nenhuma baseline permanece ativa depois disso até escolher outra ou guardar uma nova). Se o cronograma estiver desatualizado desde o último cálculo, a janela mostra uma dica junto a "Guardar nova baseline" para recalcular primeiro — uma baseline guardada sobre um cronograma desatualizado congelaria as datas erradas.

Uma baseline é uma fotografia: o início, o fim e (para marcos) a data de cada tarefa no momento em que a guardou. Altere o cronograma mais depois e a baseline permanece inalterada até guardar você mesmo uma nova.

## Ver a variância

### No Gantt: a sobreposição da baseline

Ative a sobreposição através de **Visualização → grupo do friso Baselines e progresso → Sobreposição da baseline**. Uma subbarra fina (ou um losango para um marco) aparece sob cada barra de tarefa, na cor da baseline, nas datas originais da baseline. Se a barra principal ultrapassar a sua subbarra, vê de imediato o quanto uma tarefa atrasou em relação à baseline — sem abrir um relatório separado.

### Como relatório: o relatório de variância

Vá ao separador **Relatório**, escolha **Variance** para **Tipo de relatório**. O relatório mostra, por tarefa: **Início da baseline**, **Fim da baseline**, **Início atual**, **Fim atual**, **Δ início (du)**, **Δ fim (du)** e um **Estado** (**No prazo**, **Mais tarde**, **Mais cedo**, **Nova** para tarefas adicionadas desde a baseline, ou **Eliminada** para tarefas removidas desde então). No topo, o relatório totaliza o número de tarefas, quantas estão mais tarde e quantas mais cedo, e — se a data de fim do projeto se deslocou — uma linha com o número de dias úteis de diferença em relação à baseline. Se não houver baseline ativa, o relatório diz isso explicitamente em vez de mostrar uma tabela vazia.

## Introduzir progresso

Define o progresso em três locais, todos com o mesmo efeito:

1. **Painel de propriedades** — a secção **Progresso** sob uma tarefa selecionada: um controlo deslizante para a **percentagem concluída**, e (para uma tarefa normal) campos **Início real**/**Fim real**, ou (para um marco) um único campo **Data real**. Empurre a percentagem acima de 0% sem uma data de início real, e é preenchida automaticamente com o início mais cedo planeado; puxe-a de volta abaixo de 100% e qualquer fim real que tenha introduzido é limpo de novo.
2. **Diálogo de tarefa** — a mesma secção **Progresso**, na janela **Editar tarefa**.
3. **Menu de contexto** — clique com o botão direito numa tarefa, submenu **Progresso**, com os passos fixos **0%**, **25%**, **50%**, **75%** e **100%**. Útil para uma atualização rápida sem abrir um painel; para uma percentagem intermédia ou uma data real específica, use o painel ou o diálogo de tarefa.

As datas reais nunca podem ser posteriores à data de estado; tente introduzir uma mais tarde e a aplicação rejeita-a com um erro. Esse é um limite deliberado: um "facto" (algo que realmente aconteceu) não pode, por definição, situar-se no futuro em relação ao momento em que está a registar o progresso.

## A data de estado

A **data de estado** (grupo do friso **Baselines e progresso** no separador Planeamento, campo **Data de estado**) marca "hoje" dentro do cronograma — o momento a partir do qual registou o progresso. Uma vez definida, faz duas coisas ao mesmo tempo:

- Qualquer tarefa ou marco que ainda não tenha começado (0% concluído, sem início real) não pode começar antes da data de estado, mesmo que a lógica (predecessoras, relações) permitisse de outra forma um início mais cedo. O seu início mais cedo calculado é "elevado" até à data de estado.
- As tarefas que já começaram ou terminaram mantêm as suas datas reais — essas nunca são substituídas pela data de estado.

Pode ver isto exatamente no exemplo de dimensão média: com a data de estado definida para 20 de maio de 2027, várias tarefas ainda não iniciadas (por exemplo trabalho de alvenaria e canalização em casas diferentes) têm o seu início mais cedo fixado exatamente nessa data, mesmo decorrendo em casas diferentes e teriam, sem o limite mínimo da data de estado, começado em várias datas diferentes, mais cedo.

### Porque é que um marco não assinalado "desloca-se para a direita"

No cálculo, um marco não é mais do que uma tarefa com duração zero, pelo que se aplica a mesma regra: se ainda não foi marcado como concluído (sem 100%, sem data real), a sua data calculada não pode cair antes da data de estado. Continue a avançar a data de estado sem marcar o marco como concluído, e a sua data apresentada no Gantt continua a deslocar-se para a direita com ela, mesmo que nada tenha mudado nas tarefas subjacentes — o cronograma está, efetivamente, a dizer "este momento não pode situar-se no passado se ainda não o assinalou". Assim que marcar o marco como concluído com uma data real, este volta imediatamente a essa data fixa e para de se deslocar.

## Avisos fora de sequência

Assim que existe uma data de estado, o cálculo também verifica se os factos registados (datas de início/fim reais) não contradizem a lógica das relações — por exemplo uma sucessora que já começou enquanto a sua predecessora, de acordo com o cronograma, ainda não deveria ter terminado. Esses casos chamam-se **fora de sequência** e aparecem como um aviso na barra de estado no fundo do ecrã ("N relação(ões) fora de sequência"), com uma dica para a contagem. É um aviso, não um erro bloqueante — o cálculo continua na mesma.

Resolva um aviso fora de sequência registando a situação real com precisão: preencha a data de início/fim real em falta ou incorreta nas tarefas envolvidas (através do painel, do diálogo de tarefa ou do menu de contexto, como acima), para que os factos registados voltem a alinhar-se com o que logicamente deveria ter precedido. Muitas vezes isto significa simplesmente: uma tarefa que na realidade já terminou ainda não estava marcada como tal no cronograma.

## A linha de progresso

Ative a linha de progresso através de **Visualização → grupo do friso Baselines e progresso → Linha de progresso**. Desenha uma linha tracejada laranja (4/4 traços, o mesmo estilo da linha da data de estado) que traça, para cada tarefa, um ponto na posição correspondente à sua percentagem concluída, e liga-o à data de estado — o clássico padrão em ziguezague. Um desvio à esquerda da data de estado significa que uma tarefa está atrasada em relação ao que seria de esperar com base no tempo decorrido; um desvio à direita significa que está adiantada. A linha de progresso já desenha a vertical da data de estado como a espinha do ziguezague, pelo que o interruptor separado **Linha da data de estado** (mesmo grupo do friso) recua enquanto a linha de progresso está ativa — só se torna visível de novo assim que desligar a linha de progresso e ainda quiser ver a data de estado como uma simples linha vertical.

## Continue a ler

- Veja uma baseline antes do início e progresso a meio do projeto na prática: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Veja duas baselines (Contrato → nova baseline após uma ordem de alteração) na prática: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Os recursos e a sua carga também são recalculados a cada F5 — leia o guia [Recursos, histograma & nivelamento](docs://gids-resources-histogram) para sobrealocação e nivelamento.
- O progresso e uma data de estado podem produzir folga negativa numa tarefa já fixada — leia o guia [Caminho crítico & análise avançada](docs://gids-kritiek-pad-analyse) para saber como interpretar isso.
