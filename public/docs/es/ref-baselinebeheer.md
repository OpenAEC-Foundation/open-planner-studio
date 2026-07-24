# Gestión de baselines

La ventana **Baselines** gestiona las instantáneas guardadas de la planificación: guardar, renombrar, elegir la baseline activa y eliminar.

## Abrir

**Planificación** → grupo de la cinta **Baselines y progreso** → **Guardar baseline…** o **Gestionar baselines…** (ambos abren la misma ventana). **Esc**, **Cerrar**, la cruz de cierre o un clic fuera de la ventana cierra; todos los cambios en esta ventana surten efecto de inmediato.

## La tabla de baselines

Una fila por baseline guardada:

- **Activa** — botón de radio; exactamente una baseline puede estar activa. La baseline activa es la base de comparación para la superposición de la baseline en el Gantt y el informe de desviación.
- **Nombre** — editable directamente en la fila.
- **Creada** — la fecha en que se guardó la baseline.
- **Eliminar** (papelera) — elimina la baseline. Si es la activa, la ventana pide primero confirmación ("¿Eliminar la baseline activa?"); después, la baseline restante guardada más recientemente pasa a ser la activa, o ninguna si no queda ninguna.

Sin baselines, la ventana muestra "Aún no hay baselines".

## Guardar nueva baseline

- **Campo de nombre** — prerrellenado con "Baseline {n} — {fecha}"; ajuste el nombre como desee.
- **Guardar** — registra el inicio, el fin y (para los hitos) la fecha de cada tarea, y hace que la nueva baseline sea la activa.
- **Advertencia** — si la planificación está desactualizada desde el último cálculo, aparece "La planificación está desactualizada — recalcula primero (F5)": una indicación, no un bloqueo. Una baseline sobre una planificación desactualizada congelaría las fechas equivocadas.

## Siga leyendo

- [Baselines y progreso](docs://gids-baselines-voortgang) — superposición de la baseline, informe de desviación, progreso y fecha de estado.
