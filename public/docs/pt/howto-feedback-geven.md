# Dar feedback

Objetivo: comunicar um erro ou transmitir uma ideia, se quiser com uma captura de ecrã, diretamente a partir da aplicação.

## Quando precisa disto

O planeamento calcula algo que não compreende, um botão não faz o que deveria ou sente a falta de algo na aplicação. Uma boa mensagem ajuda os responsáveis pela aplicação a encontrar o problema. Por isso, a própria aplicação coloca no seu relatório a versão, o sistema operativo e o idioma. O que descreve por si decide se podem fazer algo com ele: o que fez, o que esperava e o que aconteceu.

## Passos

1. Clique no botão *Enviar feedback* no topo da janela. Esse botão está sempre na barra de título. O texto dele muda a cada dez minutos: *Enviar feedback*, *Reportar um erro* e *Sugerir uma nova funcionalidade*. É sempre o mesmo botão. Abre-se a janela *Enviar feedback*.
2. Escolha o tipo de mensagem. *Algo não funciona* serve para um erro: algo não faz o que devia. *Ideia* serve para algo que lhe falta ou que quer diferente. *Pergunta ou comentário* serve para o resto. *Algo não funciona* está selecionado por predefinição.
3. Preencha o *Título* e depois a *Descrição*. Os campos vazios mostram um exemplo: um título como *Ex.: o caminho crítico salta depois de guardar*, e para a descrição a pergunta *O que fez, o que esperava e o que aconteceu?* Enquanto o botão *Enviar* estiver cinzento, uma linha cinzenta ao lado indica o motivo, por exemplo *Introduza um título.* ou que tem de escrever pelo menos 10 caracteres no título e na descrição juntos.
4. Se quiser uma resposta, preencha o seu *Endereço de email*. Esse campo é opcional. A aplicação guarda o endereço depois de um envio bem-sucedido, por isso já lá está da próxima vez.
5. Se quiser mostrar algo, ative *Anexar captura de ecrã*. A aplicação tira então uma imagem da aplicação sem esta janela. Pouco depois vê uma pequena pré-visualização com três botões ao lado: *Anotar*, *Refazer* e *Remover*.
6. *Anotar* abre um editor. Nele pode colocar setas, retângulos, linhas à mão livre e texto na imagem. Com *Cobrir*, desenha uma área preta sobre algo que não deve ir junto, como um nome ou um valor. Essa parte fica então realmente eliminada da imagem que a aplicação envia. Escolhe a cor, desfaz a sua última ação com *Desfazer* ou recomeça com *Limpar tudo*. Clique em *Concluído* para manter as alterações, ou em *Cancelar* (ou Esc) para as descartar.
7. *Refazer* faz uma nova captura de ecrã e apaga as suas anotações. *Remover* retira a captura de ecrã e desliga a caixa de verificação.
8. Veja a linha cinzenta *Enviado com* sob o formulário. Mostra o que a aplicação envia por si própria: a versão, o sistema operativo e o idioma, por exemplo *Enviado com: v2026.10.1 · Windows · English*.
9. Clique em *Enviar*. Durante o envio, o botão mostra *A enviar…*.
10. Vê *Obrigado, a sua mensagem foi enviada.* Se foi criada uma issue no GitHub para a sua mensagem, aparece também o botão *Ver no GitHub*. Clique em *Fechar*.

## Para onde vai a sua mensagem

A aplicação envia a sua mensagem para a Open Feedback Studio, da OpenAEC. Para isso não precisa de uma conta, também não no GitHub. Os criadores veem a sua mensagem na visão geral deles. Se a ligação ao GitHub estiver ativa, a Open Feedback Studio também transforma a sua mensagem numa issue pública no GitHub. Com *Algo não funciona*, a issue recebe a etiqueta *bug*; com *Ideia*, a etiqueta *enhancement*. Por baixo da sua descrição aparece então uma linha com a versão do Open Planner Studio, o sistema operativo e o idioma da aplicação.

## Problemas e o que a aplicação faz então

**A sua mensagem pode tornar-se pública.** Não ponha nada nela que não queira partilhar. Isso vale também para a captura de ecrã: a imagem mostra tudo o que está visível na aplicação nesse momento, como nomes de tarefas e recursos do seu projeto. A aplicação tira a captura de ecrã no momento em que ativa *Anexar captura de ecrã*. Se o ecrã ainda não estiver certo, feche a janela, ajuste o ecrã, abra a janela de novo e clique em *Refazer*. Use *Cobrir* para ocultar o que não quer mostrar.

**A captura de ecrã é demasiado grande.** A aplicação reduz a captura de ecrã antes de a enviar. Se ainda assim for demasiado grande, a sua mensagem segue sem imagem. O ecrã de agradecimento mostra então *A captura de ecrã era demasiado grande e não foi enviada.*

**O envio não funciona.** Aparece uma mensagem na janela e o seu texto fica. Há quatro casos:

- *A mensagem não foi aceite.* Verifique o texto e o endereço de email. Uma mensagem que é sobretudo ligações é recusada.
- *Enviou muitas mensagens num curto espaço de tempo.* Tente de novo dentro de uma hora.
- *O envio falhou.* Não há ligação ou o servidor não responde. Tente de novo, ou clique em *Abrir no GitHub*. Esse botão não aparece se uma tentativa anterior tiver sido incerta (ver abaixo).
- *Não temos a certeza de que a sua mensagem chegou. Aguarde um minuto e envie-a novamente; se já tiver chegado, veremos isso automaticamente.* A ligação caiu depois de a aplicação ter enviado a sua mensagem. O seu texto fica. Não há botão *Abrir no GitHub*, porque a sua mensagem ainda pode chegar. Isso mantém-se até a sua mensagem ser enviada ou já ter sido recebida, também se fechar a janela entretanto e a abrir de novo.

**A sua mensagem já foi recebida.** Se enviar uma mensagem que já lá está, o formulário mantém isto por cima: *Esta mensagem já nos chegou. Quer acrescentar algo? Então altere o texto e envie-o novamente.* O seu texto fica e o seu endereço de email fica guardado. Clique em *Fechar* se não quiser acrescentar nada; da próxima vez o formulário aparece vazio. Se escrever mais alguma coisa, a mensagem desaparece e pode enviar de novo; o botão chama-se então outra vez *Guardar e fechar* e o seu texto é mantido.

**Abrir no GitHub.** Este é o caminho sem a Open Feedback Studio. Para isso precisa de uma conta no GitHub. Sem captura de ecrã, a página do GitHub em que cria uma nova issue abre logo no seu navegador, com o título e a descrição já preenchidos. Com captura de ecrã, vê primeiro *Quase pronto — a sua captura de ecrã está na área de transferência.* com quatro passos. Clique em *OK, ir para o GitHub*, clique dentro da área de texto grande da página da issue e prima Ctrl+V (Cmd+V num Mac). Depois clique em *Submeter nova issue* na parte inferior. Só então é que a sua mensagem é enviada.

**Não funciona colar.** No caminho do GitHub, a captura de ecrã também é guardada como ficheiro no seu computador. Na aplicação de ambiente de trabalho, a janela menciona o caminho: *Não consegue colar? Também guardámos a captura de ecrã em* esse caminho *— arraste esse ficheiro para a área de texto.* No navegador, a aplicação transfere a imagem como `feedback-` com um número e a extensão `.png`. Encontra-a na pasta de transferências e arraste-a para a área de texto.

**A captura de ecrã falha.** A aplicação mostra *Falha ao capturar o ecrã. Ainda pode enviar feedback sem captura.* A caixa de verificação desliga-se e pode enviar a sua mensagem sem imagem.

**Fecha a janela antes de enviar.** Se houver algo no formulário, o botão em baixo chama-se *Guardar e fechar*; com um formulário vazio chama-se *Fechar*. *Guardar e fechar*, a cruz e Esc fecham a janela, e a sua mensagem fica guardada como rascunho até a enviar ou clicar em *Limpar*. Quando abrir a janela de novo, o tipo, o seu texto, o endereço de email e a captura de ecrã com anotações continuam lá. O rascunho fica guardado enquanto a aplicação estiver aberta; depois de fechar a aplicação, desaparece. Depois de um envio bem-sucedido, o formulário fica vazio de novo. Se quiser recomeçar por si, clique em *Limpar*, em baixo à esquerda. Um clique ao lado da janela não a fecha. Durante o envio, Esc não fecha a janela.

## Ver também

- [Atualizar a aplicação](docs://howto-app-bijwerken): antes de enviar uma mensagem, verifique se tem a versão mais recente.
