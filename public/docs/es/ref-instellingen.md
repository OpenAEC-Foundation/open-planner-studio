# Configuración

La ventana **Configuración** contiene los ajustes de la aplicación: preferencias que se aplican a este dispositivo, con independencia del archivo de proyecto. Cada cambio se aplica y guarda de inmediato — no hay un botón de OK. Las opciones de planificación que cambian la planificación calculada viven con el proyecto en su lugar — vea [Información del proyecto](docs://ref-projectgegevens).

## Abrir — tres entradas, el mismo contenido

- El **engranaje** (⚙) en la barra de título.
- **Configuración** (pestaña de la cinta) → grupo de la cinta **Proyecto** → **Configuración**.
- **Archivo** → **Configuración** (Backstage).

Las tres muestran exactamente los mismos ajustes. Según su versión, están repartidos en tres o
cuatro pestañas — una cuarta, **Aplicación**, se ha separado recientemente del final de la primera
pestaña — pero los ajustes en sí y lo que hacen son idénticos en ambos casos; este artículo los
agrupa como **General**, **Idioma** y **Línea de tiempo / Zoom**.

## Pestaña General

**Apariencia:**

- **Tema** — **Oscuro**, **Claro** o **Alto contraste**; haga clic en una tarjeta para cambiar.
- **Fuente** — **Predeterminado**, **Sistema**, **Serif** o **Monoespaciada**; sobrescribe la
  tipografía de la interfaz. Las aplicaciones web no siguen automáticamente el ajuste de fuente del
  sistema, así que esta opción y la siguiente son cómo la elige usted mismo.
- **Tamaño de texto** — 90%, 100%, 110% o 125%; escala el texto y el diseño de la interfaz.
- **Estilo de cambio de documento** — cómo cambia entre documentos abiertos: **Pestañas horizontales**, **Pestañas verticales** o **Píldora**.
- **Formato de fecha** — **dd-mm-aaaa**, **mm-dd-aaaa** o **aaaa-mm-dd**. Solo visualización; los archivos y los cálculos no se ven afectados.
- **Modo construcción** — **Activar el modo construcción** cambia los valores predeterminados de los
  proyectos *nuevos* entre orientado a la construcción (un calendario de obra con festivos
  neerlandeses, vacaciones de la construcción, plantillas de fases) y una configuración neutra,
  independiente del sector. Los proyectos existentes no se ven afectados en ningún caso.

**Aplicación:**

- **Versión** — el número de versión de la aplicación (solo lectura), con un enlace **Buscar
  actualizaciones** que abre la ventana de actualización. Instalar actualizaciones solo funciona en
  la aplicación de escritorio; las instalaciones Snap y AppImage se actualizan mediante su propio
  canal. Aparte, la primera vez que abre la aplicación después de que se haya actualizado sola,
  aparece por su cuenta un diálogo único «¡Ya estás actualizado!» — el salto de versión, la
  diferencia de tamaño del instalador, los días transcurridos desde la versión anterior y las notas
  de la versión de GitHub, los que haya podido obtener. Ese es un momento distinto, automático, del
  enlace manual **Buscar actualizaciones** de aquí.
- **Información del proyecto...** — acceso directo a la ventana [Información del proyecto](docs://ref-projectgegevens).
- **Recorrido** — **Iniciar recorrido** repite el recorrido introductorio. El mismo reinicio también está en la pestaña de la cinta **Vista** → **Recorrido** y en el Backstage (**Archivo** → **Iniciar recorrido**).
- **Benchmark** — abre la herramienta de benchmark integrada, para medir el rendimiento de
  planificación/renderizado de este equipo.
- **Modo IA** — **Activar modo IA** muestra la pestaña de la cinta **IA** con el puente MCP, para que
  un asistente de IA pueda trabajar con su planificación mediante el Model Context Protocol;
  desactivarlo detiene de inmediato un puente en marcha. **Iniciar el puente automáticamente** (solo
  disponible con el modo IA activado) pone el puente en marcha en cuanto se inicia la aplicación, sin
  tener que visitar antes la pestaña IA — solo en la aplicación de escritorio. Vea la guía de IA
  integrada en la aplicación para el panorama completo.
- **Terminal de depuración** — **Activar terminal de depuración** muestra el panel de registro para la resolución de problemas.

## Pestaña Idioma

- **Idioma** — el idioma de visualización de la aplicación, aplicado de inmediato.

## Pestaña Línea de tiempo / Zoom

- **Planificación por horas** — **Activar planificación por horas** activa la programación por horas/minutos, las bandas de trabajo y la escala horaria. Desactivada, las tareas nuevas comienzan en días y las tareas horarias existentes conservan su valor exacto. Activada, las tareas de días y horas pueden convivir. Vea [Calendarios y planificación por horas](docs://gids-kalenders-uren).
- **Visualización de la duración** — **Automática (unidad propia por tarea)**, **Siempre días** o **Siempre horas**.
- **Barras de tarea en las interrupciones** — **No dividir nunca**, **Dividir al seleccionar** o **Dividir siempre**: si una barra se divide visualmente en torno a los días no laborables.
- **Eje temporal** — **Mostrar solo días laborables** comprime la línea de tiempo: los fines de
  semana y festivos del calendario del proyecto se omiten, de modo que una tarea de 5 días laborables
  ocupa exactamente 5 columnas, sea cual sea el aspecto del calendario entre ellas.
- **La semana empieza el** — **Lunes** o **Domingo** (disposición semanal de la escala de tiempo).
- **Mostrar cuartos de hora al ampliar al máximo** — gradación adicional en cuartos de hora en la escala de tiempo horaria.
- **Cálculo** — **Calcular automáticamente** recalcula la planificación en cuanto queda desactualizada, en lugar de esperar a F5.
- **Desplazamiento y zoom** — **Modo**:
- **Zoom + arrastrar** (el valor predeterminado) — la rueda del ratón hace zoom (anclado en el
  cursor); arrastre el fondo del diagrama para desplazar la vista; Mayús+rueda del ratón se desplaza
  por las filas; Ctrl/⌘+arrastrar dibuja un cuadro de selección.
- **Posición** — la posición del cursor determina la dirección de desplazamiento; con **División de pantalla** (**Izquierda/derecha**, **Arriba/abajo** o **Esquina superior derecha**). Ctrl+rueda = zoom, Shift+rueda = horizontal.
- **Teclas** — asigne qué control (**Desplazar**, **Ctrl + rueda**, **Shift + rueda**) obtiene qué función (**Vertical**, **Horizontal**, **Zoom**) arrastrando las fichas; soltar en una ranura ocupada intercambia los controles.
