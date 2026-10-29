# Recuperar depois de uma falha

Objetivo: recuperar o seu trabalho depois de a aplicação ou o navegador parar de forma inesperada e de não ter guardado.

## Quando precisa disto

O portátil avariou, a aplicação deixou de responder ou o separador do navegador fechou de forma inesperada, e ainda não guardou as últimas alterações. Assim que existir uma alteração em qualquer ponto, a aplicação mantém em segundo plano cópias de recuperação de todos os seus projetos abertos, no máximo uma vez a cada dez segundos. Essa cópia é separada do seu ficheiro de projeto. Sobre a diferença entre guardar e *Guardar automaticamente*, leia [Ficheiros e formatos](docs://uitleg-bestanden).

## Passos

1. Inicie a aplicação de novo. No navegador, recarregue o mesmo separador: a cópia de recuperação pertence apenas a esse separador.
2. Se a aplicação encontrar cópias, aparece a janela *Restaurar trabalho não guardado*. *O Open Planner Studio não foi fechado normalmente. Os seguintes documentos tinham alterações não guardadas que podem ser restauradas:* Para cada projeto, a janela mostra o nome, o caminho do ficheiro, se o projeto tiver um ficheiro (no navegador, só o nome do ficheiro), o número de tarefas e a hora da cópia, por exemplo *21 tarefas* e *Guardado: Sep 29, 2026, 9:41 AM*. A hora segue a sua definição *Formato de hora*. A janela também pode mostrar projetos que não alterou.
3. Escolha *Restaurar*. A aplicação abre todos os projetos da lista, cada um num separador, com o estado da última cópia. A tecla Enter faz o mesmo.
4. Verifique os seus projetos e guarde-os logo com Ctrl+S.

Se não quiser restaurar, tem duas opções. *Não restaurar* apaga as cópias, e não pode desfazer essa ação. Se fechar a janela com Escape, com a cruz ou ao clicar ao lado dela, as cópias ficam mantidas e a aplicação volta a perguntar no próximo arranque.

O ponto de interrogação no canto superior direito da janela abre este artigo, sem fazer uma escolha. Enquanto lê na Ajuda, a janela espera. Quando voltar, a janela está de novo lá e ainda pode restaurar.

## Armadilhas e o que a aplicação faz nesse caso

**Recebe o estado da última cópia.** O que fez nos últimos segundos antes da falha pode faltar. Um projeto que tinha alterações fica marcado de novo como *Não guardado*. O histórico de *Desfazer* fica vazio: não pode desfazer passos anteriores à falha. O zoom, a posição de deslocamento e a seleção são reconstruídos.

**No ambiente de trabalho, um projeto recuperado mantém o seu ficheiro; no navegador, não.** No ambiente de trabalho, *Guardar* escreve no ficheiro original, com o estado recuperado. No navegador, um projeto recuperado já não está ligado ao seu ficheiro: *Guardar* pergunta onde o ficheiro deve ser guardado. O interruptor *Guardar automaticamente* também fica cinzento até guardar o projeto uma vez.

**Um projeto na vista *Datas tal como registadas* mantém-se nessa vista.** Veja [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen).

**No ambiente de trabalho, a janela não aparece em todos os arranques.** As cópias de recuperação estão na pasta de dados da aplicação, como ficheiros IFC cujo nome começa por *recovery*. Se fechar a aplicação da forma normal, ela apaga as suas próprias cópias. Por isso a janela aparece depois de um fim inesperado, depois de um reinício para uma atualização da aplicação, ou se adiou a recuperação no arranque anterior.

**No navegador, a cópia é mantida por separador.** A cópia está no armazenamento do navegador. Um separador ou uma janela novos não oferecem as cópias de outro separador. As cópias de separadores que já não existem são apagadas ao fim de sete dias, assim que a aplicação voltar a escrever cópias.

**No navegador, a janela também aparece depois de um recarregamento normal.** Isto acontece mesmo que tenha guardado tudo. Se guardou pouco antes de recarregar e não alterou nada depois, pode escolher *Não restaurar* sem risco: o seu ficheiro está atualizado.

**A janela não aparece.** Então a aplicação não encontrou nenhuma cópia. Isto acontece se ainda não tiver alterado nada, se usar um separador novo no navegador, se tiver descartado a recuperação antes com *Não restaurar*, ou se a falha ocorreu antes de a aplicação manter a primeira cópia: isso pode demorar até cerca de dez segundos depois da primeira alteração.

**Uma cópia está danificada.** A aplicação indica *Não foi possível ler o ficheiro recuperado*, com o motivo, e oferece os outros projetos. Se escolher *Restaurar*, a aplicação apaga depois todas as cópias, incluindo a ilegível. Se nenhuma cópia puder ser lida, a janela não aparece e as cópias ficam mantidas.

**A restauração falha.** A aplicação indica *Falha na restauração*, com o motivo. As cópias ficam mantidas e a pergunta volta no próximo arranque.

**Alguns projetos não podem ser carregados.** A aplicação indica: *2 ficheiros de recuperação não puderam ser carregados e foram ignorados.* Para um só ficheiro, indica *1 ficheiro de recuperação não pôde ser carregado e foi ignorado.* Os outros projetos são restaurados. Como algo foi ignorado, todas as cópias ficam mantidas e a janela volta no próximo arranque com a mesma lista. Nesse caso, escolha *Não restaurar* se já tiver recuperado tudo o que era possível.

## Ver também

- [Ficheiros e formatos](docs://uitleg-bestanden): guardar, Guardar automaticamente e recuperação depois de uma falha, lado a lado.
- [Ativar Guardar automaticamente](docs://howto-automatisch-opslaan): deixar a aplicação atualizar o seu próprio ficheiro.
- [Abrir e guardar um ficheiro](docs://howto-bestand-openen-en-opslaan): guardar depois de recuperar.
- [Datas tal como registadas](docs://uitleg-datums-zoals-opgeslagen): o que acontece a um projeto nessa vista.
