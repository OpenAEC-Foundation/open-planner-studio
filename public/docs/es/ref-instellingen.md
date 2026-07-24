# Configuración

La ventana **Configuración** contiene los ajustes de la aplicación: preferencias que se aplican a este dispositivo, con independencia del archivo de proyecto. Cada cambio se aplica y guarda de inmediato — no hay un botón de OK. Las opciones de planificación que cambian la planificación calculada viven con el proyecto en su lugar — vea [Información del proyecto](docs://ref-projectgegevens).

## Abrir — tres entradas, el mismo contenido

- El **engranaje** (⚙) en la barra de título.
- **Configuración** (pestaña de la cinta) → grupo de la cinta **Proyecto** → **Configuración**.
- **Archivo** → **Configuración** (Backstage).

Las tres muestran exactamente la misma configuración, repartida en tres pestañas: **General**, **Idioma** y **Línea de tiempo / Zoom**.

## Pestaña General

- **Tema** — **Oscuro**, **Claro** o **Alto contraste**; haga clic en una tarjeta para cambiar.
- **Estilo de cambio de documento** — cómo cambia entre documentos abiertos: **Pestañas horizontales**, **Pestañas verticales** o **Píldora**.
- **Formato de fecha** — **dd-mm-aaaa**, **mm-dd-aaaa** o **aaaa-mm-dd**. Solo visualización; los archivos y los cálculos no se ven afectados.
- **Versión** — el número de versión de la aplicación (solo lectura).
- **Actualizaciones** — **Buscar actualizaciones** abre la ventana de actualización. Instalar actualizaciones solo funciona en la aplicación de escritorio; las instalaciones Snap y AppImage se actualizan mediante su propio canal.
- **Zoom predeterminado** — el nivel de zoom predeterminado (solo lectura, 30 px/día).
- **Terminal de depuración** — **Activar terminal de depuración** muestra el panel de registro para la resolución de problemas.
- **Información del proyecto...** — acceso directo a la ventana [Información del proyecto](docs://ref-projectgegevens).
- **Recorrido** — **Iniciar recorrido** repite el recorrido introductorio. El mismo reinicio también está en la pestaña de la cinta **Vista** → **Recorrido** y en el Backstage (**Archivo** → **Iniciar recorrido**).

## Pestaña Idioma

- **Idioma** — el idioma de visualización de la aplicación; catorce idiomas, aplicados de inmediato.

## Pestaña Línea de tiempo / Zoom

- **Planificación por horas** — **Activar planificación por horas** activa la programación por horas/minutos: una escala de tiempo horaria, turnos con bandas de horario laboral y barras de tarea con precisión de hora. Desactivado ⇒ la aplicación se mantiene totalmente granular por días. Con el interruptor activado, aparece **Permitir planificación mixta de días/horas** (tareas de día y de hora en un proyecto). Si abre un archivo que contiene planificación por horas mientras el interruptor está desactivado, una barra arriba ofrece **Activar planificación por horas**. Vea [Calendarios y planificación por horas](docs://gids-kalenders-uren).
- **Visualización de la duración** — **Automática (unidad propia por tarea)**, **Siempre días** o **Siempre horas**.
- **Barras de tarea en las interrupciones** — **No dividir nunca**, **Dividir al seleccionar** o **Dividir siempre**: si una barra se divide visualmente en torno a los días no laborables.
- **La semana empieza el** — **Lunes** o **Domingo** (disposición semanal de la escala de tiempo).
- **Mostrar cuartos de hora al ampliar al máximo** — gradación adicional en cuartos de hora en la escala de tiempo horaria.
- **Cálculo** — **Calcular automáticamente** recalcula la planificación en cuanto queda desactualizada, en lugar de esperar a F5.
- **Desplazamiento y zoom** — **Modo**:
- **Posición** — la posición del cursor determina la dirección de desplazamiento; con **División de pantalla** (**Izquierda/derecha**, **Arriba/abajo** o **Esquina superior derecha**). Ctrl+rueda = zoom, Shift+rueda = horizontal.
- **Teclas** — asigne qué control (**Desplazar**, **Ctrl + rueda**, **Shift + rueda**) obtiene qué función (**Vertical**, **Horizontal**, **Zoom**) arrastrando las fichas; soltar en una ranura ocupada intercambia los controles.
- **Zoom + arrastrar** — la rueda del ratón hace zoom (anclado en el cursor); arrastre el fondo del diagrama para desplazar la vista.
