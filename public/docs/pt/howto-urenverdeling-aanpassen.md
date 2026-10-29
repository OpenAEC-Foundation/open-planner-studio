# Ajustar a distribuição de horas

Objetivo: para uma atribuição, defina, ao seu critério, quanto o recurso trabalha em cada dia útil da tarefa, em vez de usar uma curva padrão.

## Quando precisa disto

Uma curva como *Em sino* é uma forma fixa. Por vezes, sabe-se melhor. O bricklayer começa a outer cavity leaf a meio ritmo, porque o andaime ainda está a ser montado, e depois trabalha a tempo inteiro. Ou quer manter um pico logo abaixo da capacidade. Nesse caso, ajuste a **distribuição de horas**.

Trabalha-se com **fases**: dias úteis consecutivos em que o recurso trabalha com as mesmas unidades. A distribuição só altera as horas por dia desta atribuição. As datas da tarefa não mudam.

## Passos

O exemplo é a outer cavity leaf: 6 dias úteis, um bricklayer, 48 horas.

1. Selecione a tarefa. O painel *Propriedades* está à direita; se não o vir, ative-o em *Visualização › Painéis › Propriedades*.
2. No bloco *Atribuições*, clique no nome do bricklayer. *Curva* e o botão *Distribuição de horas…* aparecem por baixo dele. Clique em *Distribuição de horas…*. A janela *Distribuição de horas por fases* abre. Parte-se do que a aplicação reserva atualmente: para esta outer cavity leaf, uma fase de 6 dias com unidades de 1.
3. Se for preciso, escolha um ponto de partida em *Aplicar forma:*. Com *Em sino*, a aplicação cria cinco fases: 0,18 unidades no primeiro e no último dia, 0,84 no segundo e no quinto dia e 1,98 nos dois dias do meio. O total mantém-se em 48 horas.

### Ajustar as fases

Pode trabalhar na tabela ou na tira acima dela.

- Escreva outro valor de *Esforço (unid./dia)* numa fase. As colunas *Horas/dia* e *Horas* são calculadas em conjunto.
- Altere o número de *Dias* de uma fase. A última fase vai sempre até ao fim da tarefa e fica com os dias que restam.
- Escolha *Dividir* para separar uma fase em duas, por exemplo 6 dias em 3 e 3. Escolha *Juntar* para juntar uma fase com a seguinte.
- Na tira, arraste um limite para alongar ou encurtar uma fase. Arraste a aresta superior para definir o esforço. Clique duas vezes num dia para dividir uma fase.

### Aplicar

Escolha *Aplicar*. Com *Cancelar*, a janela fecha sem alterações.

Um exemplo. Escolha *Dividir*, defina *Dias* da primeira fase como 2 e o esforço dessa fase como 0,5. A segunda fase passa a durar 4 dias, com esforço 1. O total é 2 × 0,5 × 8 + 4 × 1 × 8 = 40 horas.

Depois de *Aplicar*, a curva da atribuição passa para *Contorno* e fica desativada. *Unidades* mantém-se como estava. Surge agora um ícone de gráfico de barras junto ao nome, também quando a atribuição está recolhida. O histograma e a sobrealocação seguem de imediato a nova distribuição. Não é preciso recalcular, porque nenhuma data se move.

### Libertar a distribuição

Se a atribuição tiver uma distribuição própria, a janela tem também *Libertar distribuição*. Isso remove a sua distribuição própria, e a aplicação volta a *Unidades* e à curva. Escolha também esta opção se quiser mudar a curva, porque a lista pendente *Curva* fica desativada enquanto houver uma distribuição própria.

## Armadilhas e o que a aplicação faz nesse caso

**O total muda com isso.** Não se dividem as horas, decidem-se. Se definir uma fase como 0,5 em vez de 0,18, o total aumenta. O total em horas está no fundo da janela. Verifique-o antes de clicar em *Aplicar*.

**O que as unidades fazem depois depende do tipo de tarefa.** Com *Duração e unidades fixas*, outros valores de *Unidades* não alteram a distribuição. Com *Duração e trabalho fixos*, a aplicação ajusta as horas por dia em conjunto com as novas unidades: com unidades de 2 em vez de 1, cada dia duplica e o total também (de 32 para 64 horas), e a duração mantém-se. Com *Trabalho fixo*, as unidades alteram a duração da tarefa: a distribuição é então comprimida ou esticada pela nova duração, com o mesmo total. Com *Unidades fixas*, as unidades alteram também a duração. Verifique depois o total no fundo da janela.

**Se alterar a duração da tarefa, a distribuição estica com ela.** A forma mantém-se. Com *Duração e unidades fixas* e com *Unidades fixas*, o total cresce em proporção à duração: se a duração de uma tarefa com distribuição própria duplicar de 4 para 8 dias úteis, o total também duplica, de 32 para 64 horas. Com *Duração e trabalho fixos* e com *Trabalho fixo*, o total mantém-se (32 horas continuam 32 horas) e as unidades descem.

**O trabalho segue a distribuição.** *Trabalho (h)* passa a ser a soma das suas fases, também com *Trabalho fixo*. A duração da tarefa não muda por isso.

**Unidades inválidas.** Um esforço vazio ou negativo recebe uma moldura vermelha, e *Aplicar* fica desativado. Uma fase com esforço 0 é permitida. Essa fase fica dentro da duração da tarefa.

**Tudo se aplica só a esta atribuição.** A própria aplicação indica-o: *A distribuição só altera as horas por dia desta atribuição; as datas e as divisões da tarefa mantêm-se.* Os outros recursos da mesma tarefa mantêm a sua própria distribuição.

**O nivelamento segue a distribuição.** A função de nivelamento conta as mesmas horas por dia que o histograma.

**Desfazer.** *Aplicar* e *Libertar distribuição* são, cada um, um passo de *Desfazer* (Ctrl+Z).

## Ver também

- [Atribuir recursos com uma curva](docs://howto-resource-toewijzen): colocar um recurso numa tarefa e escolher uma curva.
- [Resolver recursos sobrealocados](docs://howto-overbezetting-oplossen): o que fazer quando um recurso tem trabalho a mais num dia.
