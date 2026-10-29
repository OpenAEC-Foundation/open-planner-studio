# Escolher ou criar um perfil de cálculo

Objetivo: decidir que regras de cálculo um projeto usa. Escolha um perfil integrado ou crie um perfil próprio com as suas convenções.

## Quando precisa disto

Abre um projeto que tem de calcular como Primavera P6 ou Microsoft Project, ou quer definir uma convenção de forma diferente do que o perfil faz. O que é um perfil e porque é que as datas se podem deslocar está em [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen).

## Passos

### Escolher um perfil para um projeto novo

1. Escolha *Início › Ficheiro › Novo*. A janela *Novo projeto* abre-se.
2. Na lista pendente *Perfil de cálculo*, escolha o perfil: *Open Planner Studio*, *Primavera P6* ou *Microsoft Project*.
3. Crie o projeto. A aplicação substitui as opções de cálculo que já tinha preenchido pelos valores padrão do perfil.

### Trocar o perfil de um projeto existente

1. Escolha *Definições › Projeto › Definições do projeto*. Também pode escolher *Ficheiro › Definições do projeto*.
2. No bloco *Perfil de cálculo e opções*, abra a lista pendente *Perfil de cálculo* e escolha outro perfil.
3. Clique em **Aplicar**. A aplicação recalcula o planeamento de imediato, mesmo que *Calcular automaticamente* esteja desativado. Se tarefas foram deslocadas, a aplicação indica quantas.

Enquanto não clicar em *Aplicar*, a alteração existe apenas no formulário. A troca inteira é um único passo para *Desfazer*. A troca altera apenas as convenções; as suas opções de cálculo mantêm-se como estão.

### Criar um perfil próprio

1. No bloco *Perfil de cálculo e opções*, clique em *Novo perfil*, ao lado da lista pendente.
2. Escreva um nome. A aplicação sugere *Cópia de* mais o perfil escolhido, por exemplo *Cópia de Open Planner Studio*.
3. Clique em *Criar*. A parte *Convenções deste perfil* expande-se.
4. Ative ou desative as convenções com as caixas de verificação. O ícone i após uma linha mostra a explicação dessa convenção. Uma convenção que difere da base recebe a etiqueta *voltar à base*.
5. Clique em **Aplicar**. Só então o projeto calcula com o novo perfil.

Os três perfis integrados não podem ser alterados. As respetivas convenções são apenas mostradas a título informativo.

### Guardar um perfil próprio como modelo

1. Se necessário, dê outro nome ao perfil próprio no campo *Nome deste perfil próprio*.
2. Clique em *Guardar como modelo*. A aplicação indica que o modelo foi guardado ou porque é que falhou.
3. Noutro projeto da mesma aplicação, o modelo aparece na lista pendente *Perfil de cálculo*.

Se o perfil depois for diferente do modelo, um bloco amarelo indica-o. Nesse caso, escolha *Atualizar o modelo a partir deste projeto* ou *Atualizar a partir do modelo*.

Para eliminar um modelo, clique em *Eliminar modelo*. A aplicação pede confirmação primeiro.

## Verificar o resultado

- O bloco *Perfil de cálculo e opções* mostra o perfil escolhido.
- Depois de *Aplicar*, a aplicação indica as tarefas deslocadas, por exemplo *Após aplicar, 4 tarefas foram deslocadas.*
- Um bloco laranja acima das opções de cálculo indica que as suas opções diferem dos valores padrão do perfil. Isso acontece muitas vezes de propósito. Se, mesmo assim, quiser os valores padrão, clique em *Usar as definições padrão de …*.

## Cuidados e o que a aplicação faz

**As datas deslocam-se.** Outro perfil pode alterar as datas de verdade. Verifique o resultado. Se não gostar, escolha *Desfazer*: perfil e datas voltam juntos ao estado anterior.

**Um bloco amarelo após Desfazer.** Se premir *Desfazer* ou *Refazer* com as Definições do projeto abertas, o bloco segue o estado do projeto. Se já tiver alterado algo no bloco, a sua escolha mantém-se. Um bloco amarelo indica então que *Aplicar* repõe essa escolha.

**Pode haver, no máximo, 100 modelos.** Se já houver 100, a aplicação não guarda o modelo e indica isso. Elimine primeiro um modelo. Se o armazenamento da aplicação estiver cheio ou em falta, também aparece uma mensagem.

**Os modelos pertencem à aplicação, o perfil ao projeto.** O projeto tem sempre a sua própria cópia do perfil. Se alterar o modelo mais tarde, o projeto não muda com ele.

**Definições de um ficheiro de origem.** Se escolher *Primavera P6* ou *Microsoft Project* para um projeto que vem de outro ficheiro, as definições do ficheiro de origem mantêm-se. Não as pode alterar aqui.

## Ver também

- [Perfis de cálculo e convenções](docs://uitleg-rekenprofielen): o que é um perfil e o que faz às datas.
- [Opções de cálculo e convenções](docs://ref-rekenopties-en-conventies): todas as convenções e opções de cálculo numa visão geral.
- [Escolher o modo de progresso](docs://howto-voortgangsmodus-kiezen): Retained Logic ou Progress Override, separado do perfil.
