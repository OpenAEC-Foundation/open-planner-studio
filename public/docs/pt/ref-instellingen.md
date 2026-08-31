# Definições

A janela **Definições** contém as definições da aplicação: preferências que se aplicam a este dispositivo, independentemente do ficheiro de projeto. Cada alteração é aplicada e guardada imediatamente — não há botão OK. As opções de agendamento que alteram o cronograma calculado ficam antes com o projeto — veja [Informações do projeto](docs://ref-projectgegevens).

## Abrir — três entradas, o mesmo conteúdo

- A **engrenagem** (⚙) na barra de título.
- **Definições** (separador do friso) → grupo do friso **Projeto** → **Definições**.
- **Ficheiro** → **Definições** (Backstage).

Todas as três mostram exatamente as mesmas definições. Consoante a sua versão, estão distribuídas por três ou
quatro separadores — um quarto, **Aplicação**, separou-se recentemente da parte final do primeiro separador —
mas as próprias definições e o que fazem são idênticas de qualquer forma; este artigo agrupa-as como **Geral**,
**Idioma** e **Linha de tempo / Zoom**.

## Separador Geral

**Aparência:**

- **Tema** — **Escuro**, **Claro** ou **Alto contraste**; clique num cartão para trocar.
- **Fonte** — **Padrão**, **Sistema**, **Serif** ou **Monoespaçada**; substitui o tipo de letra da interface. As aplicações web não seguem automaticamente a definição de fonte do sistema, por isso esta opção e a seguinte são a forma de a escolher você mesmo.
- **Tamanho do texto** — 90%, 100%, 110% ou 125%; ajusta o texto e o layout da interface.
- **Estilo de mudança de documento** — como muda entre documentos abertos: **Separadores horizontais**, **Separadores verticais** ou **Pílula**.
- **Formato de data** — **dd-mm-aaaa**, **mm-dd-aaaa** ou **aaaa-mm-dd**. Apenas visualização; os ficheiros e cálculos não são afetados.
- **Modo construção** — **Ativar o modo construção** alterna as predefinições dos projetos *novos* entre orientadas para a construção (um calendário de obra com feriados neerlandeses, férias da construção, modelos de fases) e uma configuração neutra, independente da construção. Os projetos existentes não são afetados de nenhuma das formas.

**Aplicação:**

- **Versão** — o número de versão da aplicação (só de leitura), com uma ligação **Verificar atualizações** que abre a janela de atualização. Instalar atualizações só funciona na aplicação de ambiente de trabalho; as instalações Snap e AppImage atualizam através do seu próprio canal. Além disso, da primeira vez que abre a aplicação depois de esta se ter atualizado automaticamente, aparece por si só um diálogo único "Você está atualizado!" — o salto de versão, a diferença de tamanho do instalador, os dias desde o lançamento anterior e as notas de lançamento do GitHub, o que for possível obter disso. Esse é um momento diferente, automático, da ligação manual **Verificar atualizações** aqui.
- **Informações do projeto...** — atalho para a janela [Informações do projeto](docs://ref-projectgegevens).
- **Tour** — **Iniciar tour** repete o tour introdutório. O mesmo reinício também está no separador do friso **Visualização** → **Tour** e na Backstage (**Ficheiro** → **Iniciar tour**).
- **Benchmark** — abre a ferramenta de benchmark incorporada, para medir o desempenho de agendamento/renderização deste computador.
- **Modo IA** — **Ativar modo IA** mostra o separador do friso **IA** com a ponte MCP, para que um assistente de IA possa trabalhar no seu cronograma através do Model Context Protocol; desativá-lo interrompe imediatamente uma ponte em execução. **Iniciar a ponte automaticamente** (só disponível com o modo IA ligado) coloca a ponte ativa assim que a aplicação arranca, sem ter de visitar primeiro o separador IA — apenas na aplicação de ambiente de trabalho. Veja o guia do assistente de IA integrado na aplicação para o panorama completo.
- **Terminal de depuração** — **Activar terminal de depuração** mostra o painel de registo para resolução de problemas.

## Separador Idioma

- **Idioma** — o idioma de apresentação da aplicação, aplicado imediatamente.

## Separador Linha de tempo / Zoom

- **Planeamento por horas** — **Ativar planeamento por horas** ativa a escala horária e as faixas de trabalho. Desligado, as novas tarefas começam em dias e as tarefas horárias existentes mantêm o valor exato. Ligado, tarefas de dias e horas podem coexistir. Veja [Calendários & planeamento por horas](docs://gids-kalenders-uren).
- **Exibição da duração** — **Automática (unidade própria por tarefa)**, **Sempre dias** ou **Sempre horas**.
- **Barras de tarefa nas interrupções** — **Nunca dividir**, **Dividir ao selecionar** ou **Dividir sempre**: se uma barra se divide visualmente à volta de dias não úteis.
- **Eixo temporal** — **Mostrar apenas dias úteis** comprime a linha do tempo: os fins de semana e feriados do calendário do projeto são ignorados, para que uma tarefa de 5 dias úteis tenha exatamente 5 colunas de largura, seja como for o calendário entre eles.
- **A semana começa em** — **Segunda-feira** ou **Domingo** (disposição semanal da escala temporal).
- **Mostrar quartos de hora ao ampliar bastante** — gradação extra de quarto de hora na escala temporal horária.
- **Cálculo** — **Calcular automaticamente** recalcula o cronograma assim que fica desatualizado, em vez de esperar por F5.
- **Deslocação e zoom** — **Modo**:
- **Zoom + arrastar** (predefinição) — a roda do rato faz zoom (ancorado no cursor); arraste o fundo do gráfico para deslocar a vista; Shift+roda percorre as linhas; Ctrl/⌘+arrastar desenha uma caixa de seleção.
- **Posição** — a posição do cursor determina a direção da deslocação; com **Divisão do ecrã** (**Esquerda/direita**, **Cima/baixo** ou **Canto superior direito**). Ctrl+roda = zoom, Shift+roda = horizontal.
- **Teclas** — atribua qual controlo (**Deslocar**, **Ctrl + roda**, **Shift + roda**) recebe qual função (**Vertical**, **Horizontal**, **Zoom**) arrastando os chips; largar sobre um lugar já ocupado troca os controlos.
