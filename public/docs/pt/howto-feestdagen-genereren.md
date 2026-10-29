# Gerar feriados e as férias da construção

Objetivo: ter num calendário os feriados de um país e, se for o caso, as férias da construção. Acrescentar também, onde for preciso, um dia ou um período de folga próprio.

## Quando precisa disto

Sem feriados, a aplicação simplesmente planeia trabalho no Natal ou no Dia do Rei. Um novo projeto já recebe os feriados neerlandeses, desde que o *Modo construção* esteja ativado. Pode gerar novamente se precisar de outro país ou de outra região, se quiser incluir as férias da construção, ou se o seu projeto ficar fora dos anos para os quais foram criados feriados. Esses anos importam: para a aplicação, um dia fora deles é simplesmente um dia útil. Como a aplicação tem em conta um feriado ao contar os dias, pode ler em [Calendários e dias úteis](docs://uitleg-kalenders).

As **férias da construção** (*bouwvak*) são as férias coletivas da construção civil neerlandesa, três semanas no verão. Na aplicação vêm desativadas por padrão.

## Passos

### Gerar feriados

1. Escolha *Planeamento › Calendário › Calendário* e selecione à esquerda o calendário em que os feriados devem entrar.
2. Clique em *Gerar feriados…*. Por baixo do botão abre-se um bloco com as opções.
3. Escolha o *País*: Países Baixos, Alemanha, Bélgica, França, Reino Unido, Áustria, Suíça, ou *Sem feriados*. Para alguns países aparece também uma lista *Região*, por exemplo um estado federado na Alemanha. *Nacional* deixa apenas os feriados que se aplicam em todo o lado.
4. Nos Países Baixos, escolha as *Férias da construção*: *Nenhuma* (padrão), *Norte*, *Centro* ou *Sul*. As férias da construção aparecem como um período na lista, por exemplo *Férias da construção (Norte)*, três semanas de segunda a sexta-feira. Só vê esta opção se o *Modo construção* estiver ativado.
5. Debaixo das opções há um resumo, por exemplo *21 feriados, 2026–2028*. Clique nele para ver as datas.
6. Clique em *Gerar*. A lista *Feriados* fica preenchida.
7. Clique em *Aplicar*. A aplicação recalcula o planeamento de imediato.

Para os Países Baixos, a aplicação põe na lista, todos os anos, Nieuwjaar, Goede Vrijdag, Pasen (dois dias), Koningsdag, Hemelvaart, Pinksteren (dois dias) e Kerst (25 e 26 de dezembro) (Ano Novo, Sexta-feira Santa, Páscoa, Dia do Rei, Ascensão, Pentecostes e Natal). Se o Dia do Rei cair num domingo, fica a 26 de abril. O Dia da Libertação (Bevrijdingsdag) só está na lista em anos múltiplos de cinco, como 2025 e 2030.

Os anos seguem o período do projeto: do ano antes da data de início até ao ano depois da data de fim. Se o projeto não tiver data de fim, vai até três anos depois do ano de início. Ajuste a data de início e a data de fim em *Definições › Projeto › Definições do projeto*.

### Gerar novamente após alterar o período do projeto

Se o seu projeto mudar, ou ficar com uma data de fim posterior, os feriados deixam de cobrir os anos novos. A aplicação indica-o na janela *Calendários*, por exemplo *Os feriados cobrem 2025–2028; gerar novamente até 2030 inclusive?* Clique em *Gerar novamente*. A aplicação usa as mesmas opções da última vez (país, região, férias da construção) para os anos do projeto. Clique depois em *Aplicar*. Só vê esta mensagem num calendário cujos feriados foram gerados antes.

### Adicionar um dia ou um período de folga próprio

1. Na janela *Calendários*, clique em *Adicionar feriado*. No fim da lista aparece uma linha nova, com a data de hoje em *De*.
2. Preencha a *Descrição*, por exemplo *Passeio da empresa*.
3. Ajuste o *De*. Deixe *Até* vazio para um só dia, ou preencha o último dia de folga para um período, por exemplo para umas férias de inverno.
4. Clique em *Aplicar*.

Com o caixote do lixo no fim de uma linha, remove-se um feriado.

### Remover todos os feriados

Escolha *Sem feriados* em *País* e clique em *Gerar*. A lista fica então vazia.

## Problemas possíveis e o que a aplicação faz então

**Gerar substitui a lista inteira.** Os dias que acrescentou por si também desaparecem. Acrescente-os de novo depois.

**Goede Vrijdag está incluída.** Se a sua empresa trabalhar na Sexta-feira Santa, ou no Dia da Libertação num ano múltiplo de cinco, remova essa linha com o caixote.

**As datas das férias da construção são indicativas.** A aplicação conhece-as de 2025 até 2028, inclusive. Para os outros anos faz uma estimativa aproximada. Por isso, com as férias da construção escolhidas, a aplicação mostra *Datas indicativas — verifique junto à Bouwend Nederland*. Ajuste o período na lista, se for preciso.

**Uma linha inválida.** Uma linha sem *De* válido, uma *Até* anterior a *De* ou uma data ilegível recebe uma mensagem a vermelho, por exemplo *A data de fim é anterior à data de início.* O botão *Aplicar* fica desativado até que a corrija.

**Com um projeto novo.** A janela *Novo projeto* tem as mesmas opções em *Conjunto de feriados*. Com *Personalizado…* começa-se sem feriados. Depois de criar, abre-se a janela *Calendários*, para os preencher pessoalmente.

## Ver também

- [Calendários e dias úteis](docs://uitleg-kalenders): como a aplicação tem em conta os feriados e as férias da construção ao contar os dias úteis.
- [Criar e atribuir um calendário](docs://howto-kalender-maken-en-toewijzen): criar um calendário próprio para nele colocar os feriados.
- [Janelas de calendário](docs://ref-kalenders): todos os campos das janelas de calendário.
- [Novo projeto e Definições do projeto](docs://ref-projectinfo): o conjunto de feriados de um novo projeto.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): para além dos feriados, o calendário do projeto tem um período de folga *Frost delay, foundations*.
