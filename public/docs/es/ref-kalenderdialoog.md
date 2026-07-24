# Diálogo de calendario

La ventana **Calendarios** gestiona la biblioteca de calendarios del proyecto: la lista de todos los calendarios a la izquierda, el formulario de edición del calendario seleccionado a la derecha.

## Abrir

- **Planificación** → grupo de la cinta **Calendario** → el botón **Calendario** o **Festivos**.
- **Configuración** (pestaña de la cinta) → grupo de la cinta **Calendario** → **Calendario**.
- Desde el asistente de proyecto: al elegir **Personalizado…** como calendario, se abre esta ventana tras la creación.

## Aplicar y cancelar

Todas las ediciones — incluidas nuevo/duplicar/eliminar — ocurren en una copia de trabajo. **Aplicar** (o **Intro**) escribe todo de una vez y recalcula la planificación; **Cancelar**, **Esc**, la cruz de cierre o un clic fuera de la ventana descarta todos los cambios.

## Biblioteca (columna izquierda)

- **Lista** — todos los calendarios; la estrella marca el **Calendario del proyecto** (el predeterminado para tareas sin calendario propio).
- **+** — **Nuevo calendario**.
- **Duplicar** — copia del calendario seleccionado.
- **Eliminar** — no es posible para el último calendario; eliminar el predeterminado del proyecto hace que otro calendario pase a ser el predeterminado.
- **Establecer como predeterminado del proyecto** — convierte el calendario seleccionado en el calendario del proyecto (botón encima del formulario).

## Formulario (columna derecha)

- **Nombre** — nombre libre.
- **Días laborables** — botones **Lun** a **Dom**; activado = día laborable. Preajustes: **Lun–vie** (semana estándar, 07–16 h, 8 h/día) y **Continuo (24/7)**.
- **Inicio (hora)** / **Fin (hora)** / **Horas por día** — el horario laboral de todo el día. Se oculta en cuanto el calendario tiene bandas de horario laboral y la planificación por horas está activada; entonces las bandas determinan los horarios.

## Horarios de trabajo (solo con la planificación por horas activada)

- **Horas/día derivadas** — cifra de comprobación, derivada de las bandas.
- Preajustes: **Turno de día**, **2 turnos**, **3 turnos**, **Turno de noche**, **24/7** — cada uno establece las bandas de horario laboral de una vez.
- **Guardar como preajuste…** — guarda los horarios de trabajo actuales como su propio preajuste (en este dispositivo); los preajustes propios aparecen como botones con una cruz de eliminar.
- **Definir por día de la semana…** / **Mostrar/ocultar horarios de trabajo** — abre o contrae el editor de bandas.
- **Editor de bandas** — por día de la semana, una lista de bandas horarias (inicio–fin), cada una con una casilla de **día siguiente** (turno de noche que cruza la medianoche), **Añadir banda** (un hueco entre dos bandas es una pausa), **Copiar a todos los días laborables**, el total de horas por día y las horas/día derivadas al pie. Vea [Calendarios y planificación por horas](docs://gids-kalenders-uren).

## Generar festivos…

Genera la lista de festivos basada en reglas a lo largo del período del proyecto:

- **País** — Países Bajos, Alemania, Bélgica, Francia, Reino Unido, Austria, Suiza o **Sin festivos**.
- **Región** — solo para países con conjuntos regionales; por defecto **Nacional**.
- **Vacaciones de construcción** — solo Países Bajos: **Ninguna**, **Norte**, **Centro** o **Sur**; con una indicación de que son fechas orientativas.
- **Vista previa** — línea de resumen ("n festivos, año–año"), ampliable a la lista completa.
- **Generar** reemplaza la lista de festivos; **Cancelar** cierra el bloque.
- Si el proyecto se extiende ahora más allá de los años generados, aparece una indicación arriba con un botón **Regenerar**.

## Festivos

La lista en sí: por fila **Descripción**, **Desde**, **Hasta** y un botón de eliminar; **Añadir festivo** crea una nueva fila. Los períodos de varios días (vacaciones de construcción, parada por heladas) son simplemente una fila con un intervalo Desde–Hasta más largo.
