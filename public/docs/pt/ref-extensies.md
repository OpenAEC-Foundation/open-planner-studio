# Gerir e instalar extensões

As extensões adicionam funcionalidades à aplicação, como formatos de importação extra ou botões personalizados do friso. São ao nível da aplicação: pertencem a esta instalação neste dispositivo, não a um ficheiro de projeto.

## Abrir

**Ficheiro** → **Extensões** (Backstage). No topo estão dois separadores — **Instaladas** e **Explorar** — ao lado dos botões **ZIP** e **JS**, com um campo de pesquisa abaixo (**Pesquisar extensões...**).

## Instaladas

Um cartão por extensão com nome, versão, categoria, descrição e autor, mais:

- **Interruptor ligar/desligar** — ativa ou desativa a extensão sem a remover.
- **Remover** — clique em **Confirmar** mais uma vez para remover definitivamente.

Uma extensão que falhou ao carregar mostra uma mensagem de erro no seu cartão. Sem extensões, o separador reporta: "Nenhuma extensão instalada ainda."

## Explorar (catálogo)

O separador **Explorar** obtém o catálogo de extensões online (requer ligação à internet). Cada entrada do catálogo é um cartão com **Instalar**; as extensões já instaladas mostram o distintivo **Instalada**. Se o carregamento falhar, aparece uma mensagem de erro com **Tentar novamente**.

## Instalar a partir de um ficheiro

- **ZIP** — instala um ZIP de extensão (com `manifest.json` + `main.js`).
- **JS** — instala um único ficheiro `.js` com um manifesto incorporado.

Após a instalação, a extensão é ativada imediatamente e quaisquer botões do friso aparecem de imediato.

## Importar através de extensões

**Ficheiro** → **Importar** lista os formatos de importação oferecidos pelas extensões instaladas; clique num formato e escolha um ficheiro. Sem extensões de importação, a página reporta: "Nenhuma extensão de importação instalada. Adicione uma em Extensões." Os formatos de importação incorporados (CSV, MS Project, P6) são separados disto — veja [Importação/exportação](docs://gids-import-export).

## Escrever as suas próprias extensões

O guia para autores de extensões (manifesto, API, permissões) vive no repositório: `github.com/OpenAEC-Foundation/open-planner-studio`, ficheiro `docs/extensions.md`.
