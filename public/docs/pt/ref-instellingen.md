# Definições

A janela **Definições** contém as definições da aplicação: preferências que se aplicam a este dispositivo, independentemente do ficheiro de projeto. Cada alteração é aplicada e guardada imediatamente — não há botão OK. As opções de agendamento que alteram o cronograma calculado ficam antes com o projeto — veja [Informações do projeto](docs://ref-projectgegevens).

## Abrir — três entradas, o mesmo conteúdo

- A **engrenagem** (⚙) na barra de título.
- **Definições** (separador do friso) → grupo do friso **Projeto** → **Definições**.
- **Ficheiro** → **Definições** (Backstage).

Todas as três mostram exatamente as mesmas definições, distribuídas por três separadores: **Geral**, **Idioma** e **Linha de tempo / Zoom**.

## Separador Geral

- **Tema** — **Escuro**, **Claro** ou **Alto contraste**; clique num cartão para trocar.
- **Estilo de mudança de documento** — como muda entre documentos abertos: **Separadores horizontais**, **Separadores verticais** ou **Pílula**.
- **Formato de data** — **dd-mm-aaaa**, **mm-dd-aaaa** ou **aaaa-mm-dd**. Apenas visualização; os ficheiros e cálculos não são afetados.
- **Versão** — o número de versão da aplicação (só de leitura).
- **Atualizações** — **Verificar atualizações** abre a janela de atualização. Instalar atualizações só funciona na aplicação de ambiente de trabalho; as instalações Snap e AppImage atualizam através do seu próprio canal.
- **Zoom predefinido** — o nível de zoom predefinido (só de leitura, 30 px/dia).
- **Terminal de depuração** — **Ativar terminal de depuração** mostra o painel de registo para resolução de problemas.
- **Informações do projeto...** — atalho para a janela [Informações do projeto](docs://ref-projectgegevens).
- **Tour** — **Iniciar tour** repete o tour introdutório. O mesmo reinício também está no separador do friso **Visualização** → **Tour** e na Backstage (**Ficheiro** → **Iniciar tour**).

## Separador Idioma

- **Idioma** — o idioma de apresentação da aplicação; catorze idiomas, aplicados imediatamente.

## Separador Linha de tempo / Zoom

- **Planeamento por horas** — **Ativar planeamento por horas** ativa o agendamento por hora/minuto: uma escala de tempo horária, turnos com faixas de horário de trabalho e barras de tarefa com precisão à hora. Desligado ⇒ a aplicação permanece totalmente granular por dias. Com o interruptor ligado, aparece **Permitir planeamento misto de dias/horas** (tarefas de dias e de horas num só projeto). Se abrir um ficheiro que contém planeamento por horas enquanto o interruptor está desligado, uma barra no topo oferece **Ativar planeamento por horas**. Veja [Calendários & planeamento por horas](docs://gids-kalenders-uren).
- **Exibição da duração** — **Automática (unidade própria por tarefa)**, **Sempre dias** ou **Sempre horas**.
- **Barras de tarefa nas interrupções** — **Nunca dividir**, **Dividir ao selecionar** ou **Dividir sempre**: se uma barra se divide visualmente à volta de dias não úteis.
- **A semana começa em** — **Segunda-feira** ou **Domingo** (disposição semanal da escala temporal).
- **Mostrar quartos de hora ao ampliar bastante** — gradação extra de quarto de hora na escala temporal horária.
- **Cálculo** — **Calcular automaticamente** recalcula o cronograma assim que fica desatualizado, em vez de esperar por F5.
- **Deslocação e zoom** — **Modo**:
- **Posição** — a posição do cursor determina a direção da deslocação; com **Divisão do ecrã** (**Esquerda/direita**, **Cima/baixo** ou **Canto superior direito**). Ctrl+roda = zoom, Shift+roda = horizontal.
- **Teclas** — atribua qual controlo (**Deslocar**, **Ctrl + roda**, **Shift + roda**) recebe qual função (**Vertical**, **Horizontal**, **Zoom**) arrastando os chips; largar sobre um lugar já ocupado troca os controlos.
- **Zoom + arrastar** — a roda do rato faz zoom (ancorado no cursor); arraste o fundo do gráfico para deslocar a vista.
