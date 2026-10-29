# Escolher o esquema IFC

Objetivo: guardar o seu planeamento no esquema IFC do modelo de edifício que quer juntar a ele.

## Quando precisa disto

Por padrão, a aplicação guarda um projeto como IFC 4.3 ADD2. Esse é o nome do IFC 4.3 nos ficheiros que o IfcOpenShell e o Bonsai criam. Se quiser juntar o planeamento a um modelo de edifício num só ficheiro 4D, por exemplo com a receita *MergeProjects* do IfcOpenShell (ifcpatch), os dois ficheiros têm de ter o mesmo esquema. Se o modelo de edifício for um ficheiro IFC4, o IfcOpenShell recusa juntá-lo a um planeamento em IFC 4.3. Então escolha aqui o esquema do modelo.

## Passos

1. Abra *Definições do projeto*: *Definições › Projeto › Definições do projeto*, ou *Ficheiro › Definições do projeto*.
2. Em *Esquema IFC ao guardar*, escolha o esquema do seu modelo de edifício.
3. Clique em *Aplicar*. O projeto está agora *Não guardado*.
4. Guarde com *Guardar* (Ctrl+S) ou com *Guardar como*.

As três opções:

- *IFC 4.3 ADD2 (padrão)* escreve `IFC4X3_ADD2` no cabeçalho do ficheiro.
- *IFC 4.3* escreve `IFC4X3`. É assim que as versões mais antigas da aplicação escreviam o IFC 4.3.
- *IFC4* escreve `IFC4`, para um modelo de edifício em IFC4.

## Armadilhas e o que a aplicação faz

**Juntar como último passo.** Não abra o ficheiro 4D juntado (modelo de edifício mais planeamento) na aplicação para o guardar outra vez. A aplicação guarda só o planeamento: as paredes e as outras partes do modelo de edifício perdem-se, também se mantiver o esquema. Altere o planeamento no seu próprio ficheiro e volte a juntar depois.

**A aplicação pergunta primeiro quando um ficheiro aberto tem outro esquema.** Se abrir, por exemplo, um ficheiro IFC4, ou um ficheiro IFC 4.3 de uma versão mais antiga da aplicação, a aplicação não muda simplesmente o tipo do ficheiro. Na primeira vez que usar *Guardar* ou *Guardar como*, a aplicação pergunta primeiro se quer manter o esquema do ficheiro ou passar para IFC 4.3 ADD2. *Manter IFC4* (ou *Manter IFC 4.3*) é o botão que a tecla Enter escolhe. Se fechar a pergunta com Esc ou com a cruz, a aplicação não guarda nada.

**A aplicação pergunta só uma vez por ficheiro.** A sua escolha fica guardada no próprio ficheiro. Se o abrir outra vez mais tarde, a aplicação não volta a perguntar. Se escolher por si um esquema em *Definições do projeto* e clicar em *Aplicar*, a aplicação também não pergunta.

**Um esquema que a aplicação não consegue escrever**, como o IFC2X3, abre na aplicação. Na primeira vez que guardar, a pergunta diz isso. Escolha um dos três esquemas acima.

**O guardar automático e a recuperação não perguntam nada.** Escrevem o esquema do ficheiro e deixam a pergunta para a primeira vez que guardar. Para um esquema que a aplicação não consegue escrever, *Guardar automaticamente* não escreve no ficheiro enquanto não responder à pergunta.

**Um projeto novo não pergunta nada.** Um projeto novo, e um projeto de outro formato, como XER, MPP ou CSV, começa em *IFC 4.3 ADD2 (padrão)*.

**O conteúdo do ficheiro não muda.** Os três esquemas conhecem os dados de planeamento que a aplicação escreve da mesma maneira. Só a linha `FILE_SCHEMA` no cabeçalho é diferente. Por isso, não perde nada ao escolher outro esquema.

**Um modelo IFC 4.3 do IfcOpenShell ou do Bonsai** tem normalmente `IFC4X3_ADD2` no cabeçalho, como o padrão da aplicação. O IfcOpenShell não junta a ele um planeamento com `IFC4X3`. Em caso de dúvida, veja a linha `FILE_SCHEMA` no início do ficheiro do modelo.

**Desfazer não altera o esquema.** O esquema pertence ao ficheiro, tal como o local onde está guardado. Uma escolha em *Definições do projeto* e a resposta à pergunta ao guardar não são, por isso, um passo de *Desfazer*. Para voltar atrás, escolha o outro esquema em *Definições do projeto*. Assim, *Guardar automaticamente* nunca escreve silenciosamente outro esquema depois de desfazer uma edição.

## Ver também

- [Novo projeto e Definições do projeto](docs://ref-projectinfo): todos os campos do formulário.
- [Ficheiros e formatos](docs://uitleg-bestanden): porque o IFC é o formato próprio da aplicação.
- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): guardar e guardar como.
