# Guardar e carregar layouts

Um layout é uma configuração de vista guardada: as colunas, o agrupamento, a ordenação, o filtro e a escala temporal num só pacote. Os layouts são globais à aplicação (neste dispositivo) — não pertencem a um único ficheiro de projeto, pelo que os pode usar em qualquer documento.

## Abrir

**Visualização** → grupo do friso **Layout**. Contém um seletor com os seus layouts e três botões:

- **Guardar como…** e **Gerir…** — ambos abrem a janela **Gerir layouts** (abaixo).
- **Atualizar** — substitui o layout escolhido no seletor pela vista atual; desativado enquanto **(nenhum)** estiver selecionado.

Escolher um layout no seletor aplica-o imediatamente.

## A janela Gerir layouts

Sem layouts guardados, a janela mostra "Ainda sem layouts guardados." Caso contrário, uma linha por layout com:

- **Nome** — editável diretamente na linha (renomear).
- **Aplicar** (marca de verificação) — pede primeiro confirmação: "Aplicar o layout …? Isto substitui as colunas/agrupamento/ordenação/filtro/escala atuais."
- **Atualizar** — substitui o layout pela vista atual, sem confirmação.
- **Eliminar** (ícone de caixote do lixo) — pede primeiro confirmação.

As confirmações aparecem como um pequeno diálogo dentro da aplicação; **Esc** ou **Cancelar** cancela.

## Guardar layout como…

No fundo da janela: escreva um **Nome** e clique em **Guardar** — a vista atual é guardada como um novo layout e torna-se o ativo. Sem um nome, o layout recebe o nome predefinido "Nome".

## O que um layout regista

- Colunas (visibilidade, ordem, largura) — veja [Escolher colunas](docs://ref-kolommen).
- Agrupamento e ordenação (**Visualização** → **Agrupar…** / **Ordenar…**).
- O filtro — veja [Filtros](docs://ref-filters).
- A escala temporal do Gantt.

Não incluído: detalhes do nível de zoom, larguras dos painéis e seleções.
