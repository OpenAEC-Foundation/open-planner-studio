# Diálogo de tarea

La ventana **Editar tarea** muestra todas las propiedades de una tarea — los mismos campos y secciones que el panel de propiedades de la derecha, pero en una ventana con un paso explícito de guardado.

## Abrir

- **Doble clic** en una tarea en el Gantt.
- **F2** con una tarea seleccionada.
- **Clic derecho** en una tarea → **Editar...**

## Guardar y cancelar

- **Guardar** aplica todos los cambios de campo a la vez; el botón está desactivado mientras el nombre esté vacío. **Intro** hace lo mismo que Guardar (excepto dentro de un cuadro de texto multilínea).
- **Cancelar**, **Esc**, la cruz de cierre o un clic fuera de la ventana cierra sin aplicar los cambios de campo.
- Excepción: las secciones **Dependencias**, **Asignaciones** y **Códigos y campos** funcionan directamente sobre la planificación (idéntico al panel) — los cambios ahí surten efecto de inmediato, incluso si cancela después.

## Campos

- **Nombre *** — obligatorio; recibe automáticamente el foco al abrir el diálogo.
- **Código WBS** — entrada libre. Con la numeración automática de WBS activada (Planificación → Estructura) el campo queda bloqueado: la aplicación gestiona los códigos.
- **Descripción** — texto libre.
- **Tipo** — el tipo de tarea (por ejemplo Construcción); determina la codificación por color de la barra.
- **Calendario** — **Calendario del proyecto** o un calendario específico de la biblioteca; determina los días laborables de esta tarea.
- **Tarea padre** — mueve la tarea bajo un padre distinto, o **- Ninguna (raíz) -**. Este campo solo existe en el diálogo; en el panel, la reestructuración se hace arrastrando o mediante sangrar/reducir sangría.

## Notas

Una lista de comprobación por tarea: cada fila tiene una **casilla de hecho**, un cuadro de texto y un botón de eliminar; **Añadir nota** crea una nueva fila. Las filas completadas se muestran tachadas. Vea [Planificación y WBS](docs://gids-plannen-wbs).

## Hito

- **Hito** — al marcarlo, la duración se fija a 0 y se muestra el rombo en lugar de una barra.
- **Tipo de hito** — **Automático**, **Hito de comienzo** o **Hito de fin**.
- **Obligatorio (contractual)** — marca el hito como contractual.

## Tiempo

- **Fecha de inicio** — muestra el inicio temprano calculado; un cambio manual ancla la nueva fecha como el inicio planificado.
- **Duración (días laborables)** — días laborables enteros; desactivado para un hito.
- Con la **planificación por horas activada** y un calendario horario en la tarea, aparecen tres cuadros sincronizados: **Días**, **Horas** y **Horas totales** (solo números enteros). Sin un calendario horario aparece una indicación: "La entrada en horas requiere un calendario horario (horarios de trabajo)." Vea [Calendarios y planificación por horas](docs://gids-kalenders-uren).

## Hammock (duración derivada)

Solo en una tarea sin subtareas que no sea un hito. Al marcarla, la duración pasa a ser derivada: el intervalo entre el **Driver de inicio** (relación entrante FS/SS) y el **Driver de fin** (relación entrante FF/SF), ambos mostrados como solo lectura. Si falta un driver de fin, el diálogo informa de que el intervalo vuelve a longitud cero. Vea [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse).

## Restricción y fecha límite

- **Restricción** — Lo antes posible (ASAP), Lo más tarde posible (ALAP), No comenzar antes del (SNET), No comenzar después del (SNLT), No finalizar antes del (FNET), No finalizar después del (FNLT), Debe comenzar el (MSO) o Debe finalizar el (MFO); con una **Fecha de restricción** cuando corresponda.
- **Obligatorio (fijación forzada)** — solo MSO/MFO: fija la fecha de forma rígida y anula la lógica de relaciones; una infracción se convierte en holgura negativa aguas arriba.
- **Restricción secundaria** — un segundo límite (SNET/FNET/SNLT/FNLT) con una **Fecha secundaria**; no es posible con una fijación forzada. Las combinaciones prohibidas se marcan en rojo con un motivo.
- **Fecha límite** — una fecha objetivo fuera del cálculo; incumplirla da una advertencia, no un desplazamiento. Vea [Relaciones y restricciones](docs://gids-relaties-constraints).

## Progreso

- **Progreso (%)** — control deslizante de 0 a 100%.
- **Inicio real** / **Fin real** — hechos registrados; para un hito, un único campo **Fecha real**. Las fechas posteriores a la fecha de estado se rechazan.
- **Restante (días laborables)** — solo lectura, derivado de duración × (1 − progreso). Vea [Baselines y progreso](docs://gids-baselines-voortgang).

## Resultado CPM (solo lectura)

**Inicio/fin temprano**, **Inicio/fin tardío**, **Holgura total**, **Holgura libre**, **Holgura interferente** (cuando se calcula) y **Ruta crítica** (sí/no). Se rellena tras un cálculo (F5).

## Dependencias

Todas las relaciones de esta tarea: dirección (→ sucesora, ← predecesora), la otra tarea, un icono de rayo en la **relación determinante**, el tipo de relación (FS/SS/FF/SF), el **desfase** (por ejemplo 2d, 3ed, 50%) y un botón de eliminar. Los cambios surten efecto de inmediato.

## Asignaciones

Por cada recurso asignado: nombre, **Uds./día**, **Curva**, **Mover a…** (mover la asignación a otra tarea) y eliminar; al pie, **Asignar recurso**. No es posible en hitos ni en tareas de resumen. Surte efecto de inmediato. Vea [Recursos, histograma y nivelación](docs://gids-resources-histogram).

## Códigos y campos

Solo visible cuando el proyecto tiene tipos de código de actividad o campos personalizados: un selector de valor por tipo de código, una entrada tipada por campo personalizado. Surte efecto de inmediato. Las definiciones se gestionan en el diálogo de estructura — vea [Códigos y campos](docs://ref-codes-velden).
