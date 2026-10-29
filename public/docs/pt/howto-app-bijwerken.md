# Atualizar a aplicação

Objetivo: saber se tem a versão mais recente, atualizar a aplicação e ler o que é novo numa versão.

## Quando precisa disto

Sai regularmente uma nova versão do Open Planner Studio. Quer saber se já a tem, por exemplo antes de comunicar um erro ou porque uma extensão pede uma versão mais recente. Ou acabou de atualizar e quer ver o que mudou.

A atualização só funciona na aplicação para computador. A versão para browser não tem atualizador.

## Passos

### Atualizar quando a própria aplicação indicar uma nova versão

1. Inicie a aplicação para computador. Ao arrancar, a aplicação verifica em segundo plano se existe uma nova versão. Se não existir nova versão, ou se a verificação falhar, por exemplo sem internet, não nota nada.
2. Se houver uma nova versão, abre-se a janela *Atualização de software*. Mostra a *Versão atual*, a *Nova versão*, a mensagem *Uma nova versão está disponível* e, em *Novidades*, o texto que acompanha a atualização.
3. Guarde os projetos abertos.
4. Clique em *Baixar e instalar*. Uma barra de progresso mostra *Baixando…*, e depois segue-se a instalação. Não pode fechar a janela enquanto estiver a baixar.
5. Aguarde até a aplicação se reiniciar. Essa é a nova versão.

Pouco antes de a atualização ser instalada, a aplicação também faz um instantâneo do que tem aberto, para a recuperação após uma falha. Veja [Recuperação após uma falha](docs://howto-herstellen-na-een-crash).

### Verificar por si se há uma nova versão

1. Escolha *Definições › Projeto › Definições da aplicação*. Também pode escolher *Ficheiro › Definições da aplicação*, ou a engrenagem no topo.
2. Escolha o separador *Avançado*. Em *Versão* está o número da versão atual.
3. Clique em *Verificar atualizações*. Abre-se a janela *Atualização de software* e mostra *Verificando…*. Depois mostra *Você está usando a versão mais recente* ou a mensagem de que há uma nova versão, com o mesmo botão *Baixar e instalar*.

No navegador, este botão não faz nada de especial: a janela diz logo *Você está usando a versão mais recente*, sem que a aplicação verifique nada.

### Ler o que há de novo

1. Se iniciar a aplicação para computador pela primeira vez numa versão diferente da anterior, abre-se uma janela sozinha. Na interface chama-se *Você está atualizado!* Depois de uma instalação nova, a janela não abre: a primeira execução não é uma atualização. Se ainda quiser vê-la, use o botão *Novidades* (veja abaixo).
2. No topo está a passagem da versão anterior para a nova. Com o botão *Novidades* só se mostra a nova versão.
3. Se a aplicação tiver um resumo integrado para esta versão, vê um ponto principal e quatro pontos menores. O ponto principal pode ter um botão *Ler o guia*. Caso contrário, vê apenas a passagem de versão e o que está em baixo.
4. Com *Ver notas de versão completas* abre o registo de alterações no GitHub. Se isso não funcionar, aparece *Não foi possível abrir as notas de versão.*
5. Em *Esta atualização em números* estão o número de dias desde a versão anterior, o número de commits e o número de linhas de código acrescentadas. Se a aplicação conseguir calcular a diferença de tamanho do pacote de instalação, também se mostra. Cada valor só aparece se estiver disponível.
6. Clique em *Entendi* para fechar a janela.

Se quiser voltar a ver esta janela mais tarde, escolha *Definições › Projeto › Definições da aplicação*, separador *Avançado*, e em *Versão* o botão *Novidades*. A janela abre então para a versão atual, sem versão anterior.

## Problemas e o que a aplicação faz então

**A atualização falha.** A janela mostra *Ocorreu um erro durante a atualização* com o motivo técnico por baixo, e o botão *Tentar novamente*.

**Instalou a aplicação como pacote .deb e a instalação falha.** A janela explica: *Atualize manualmente executando este comando num terminal, ou baixe o pacote mais recente.* Em *Comando de instalação* está o comando, com o botão *Copiar comando* (depois mostra *Copiado*). Com *Abrir página de downloads* vai à página da versão mais recente.

**Tem a aplicação pela Snap Store.** A aplicação então não se atualiza sozinha e também não verifica ao arrancar. É a Snap Store que faz isso. Na janela diz: *Esta versão é atualizada automaticamente pela Snap Store — você não precisa fazer nada.*

**Não aparece nada ao arrancar.** Isso é normal se já tiver a versão mais recente. A verificação ao arrancar não comunica erros. Se quiser ter a certeza de que está atualizado, verifique por si, como acima.

## Ver também

- [Dar feedback](docs://howto-feedback-geven): comunicar um erro na versão mais recente.
