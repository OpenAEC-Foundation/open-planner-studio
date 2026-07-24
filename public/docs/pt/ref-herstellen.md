# Recuperar após uma falha

A aplicação de ambiente de trabalho mantém automaticamente instantâneos de recuperação do seu trabalho. Se a aplicação fechar inesperadamente (falha, corte de energia), oferece-se para trazer esse trabalho de volta no arranque seguinte.

## Como funciona a gravação automática

- Pouco depois de cada alteração (menos de um segundo) a aplicação escreve um instantâneo por documento aberto na sua própria pasta de dados — para todos os separadores abertos, incluindo documentos que nunca foram guardados.
- Isto não substitui guardar: o próprio ficheiro do projeto não muda. Por isso continue a guardar o seu trabalho com Ctrl+S.
- Os instantâneos são limpos assim que faz uma escolha na janela de recuperação (**Restaurar** ou **Não restaurar**).
- **Apenas na aplicação de ambiente de trabalho.** A versão de navegador não tem gravação automática nem recuperação — guarde regularmente você mesmo aí.

## A janela "Restaurar trabalho não guardado"

Aparece no arranque quando são encontrados instantâneos: "O Open Planner Studio não foi fechado normalmente. Os seguintes documentos tinham alterações não guardadas que podem ser restauradas:" Para cada documento mostra:

- o **nome** (nome do ficheiro ou nome do projeto; sem nome: "Projeto sem título");
- o **caminho do ficheiro**, se o documento alguma vez foi guardado;
- a **contagem de tarefas** no instantâneo;
- **Guardado** — a hora do instantâneo mais recente.

## As escolhas

- **Restaurar** (ou **Enter**) — todos os documentos listados voltam como separadores abertos. Contam então como não guardados: guarde-os você mesmo.
- **Não restaurar** — os instantâneos são descartados; começa com um projeto vazio.
- **Cruz de fecho**, **Esc** ou um clique fora da janela — adia com segurança: nada é descartado nem restaurado; a pergunta reaparece no arranque seguinte.

## Leitura adicional

- [Início rápido](docs://quick-start) — guardar e abrir projetos.
