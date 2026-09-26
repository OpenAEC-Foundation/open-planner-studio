# Elegir columnas

La **Tabla** (pestaña **Tabla**) y la lista de tareas junto al Gantt tienen cada una sus propias columnas. Se cambian en la propia tabla: el signo más del encabezado de la tabla abre el selector de columnas, y en el encabezado de una columna puede moverla, ensancharla, fijarla o quitarla. Cada cambio se aplica de inmediato; no hay un paso de OK.

De forma predeterminada, la lista de tareas junto al Gantt muestra **Estructura de desglose del trabajo (EDT)**, **Nombre de tarea** y **Duración**. La Tabla muestra además **Inicio**, **Fin**, **Tipo de tarea**, **Crítica**, **Holgura total** y **Progreso**, más los códigos de actividad y los campos personalizados del proyecto.

## Abrir el selector de columnas

- El signo más a la derecha del encabezado de la tabla. La Tabla y la lista de tareas junto al Gantt tienen cada una su propio signo más, que solo cambia su propia tabla.
- La pestaña **Tabla** → **Columnas…** abre el selector de columnas de la Tabla.
- Si los botones de vista clásicos están activados (**Configuración** → pestaña **Avanzado** → **Funciones heredadas** → **Mostrar los botones de vista clásicos**), **Vista** → grupo de la cinta **Visualización** → **Columnas…** hace lo mismo: el botón va a la pestaña Tabla y abre allí el selector de columnas.

**Esc**, un clic fuera del selector u otro clic en el signo más cierra el selector.

## Añadir una columna

El selector **Elegir columna** contiene, de arriba abajo:

- **Usadas recientemente** — campos que añadió hace poco con el selector. Este bloque aparece en cuanto ha añadido una columna.
- El campo **Buscar** — escriba parte del nombre de un campo; los **Resultados de búsqueda** proceden de todos los grupos.
- Los campos por grupo: **Tarea**, **Planificación**, **Restricciones**, **Relaciones**, **Recursos**, **Progreso**, **Calculado**, **Línea base**, **Personalizado** y **Técnico**. Un clic en un grupo lo despliega; el número de al lado es la cantidad de campos de ese grupo.
- Abajo, el botón **Restablecer valores predeterminados** (vea más adelante).

Haga clic en un campo para añadirlo como última columna; el selector se cierra entonces. Un campo que ya es una columna aparece marcado y no se puede volver a elegir. Los códigos de actividad y los campos personalizados del proyecto están en **Personalizado**, los campos de sus líneas base en **Línea base**.

En **Calculado** están, entre otros, los campos de análisis **Holgura libre**, **Holgura interferente**, **Casi crítica** y **Ruta de holgura**. Solo obtienen valores tras un cálculo (**F5**), y **Casi crítica** y **Ruta de holgura** solo si la opción de programación correspondiente está activada — vea [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse).

## Ajustar columnas en el encabezado

- **Mover** — arrastre el encabezado de una columna a otra posición. Las columnas fijadas permanecen juntas al principio; una columna sin fijar solo se mueve entre las columnas sin fijar.
- **Ancho** — arrastre el borde derecho del encabezado de una columna (de 40 a 480 píxeles). Un doble clic en ese borde ajusta la columna a su encabezado y a su valor más largo. Con el teclado: ponga el foco en el borde y use las flechas izquierda y derecha, con **Shift** para pasos más grandes.
- **Quitar** — el signo menos que aparece en el encabezado de la columna al pasar el puntero por encima. El campo sigue disponible en el selector de columnas.
- **Clic derecho** en el encabezado de una columna ofrece **Fijar** (o **Desfijar**), **Autoajustar** y **Quitar**. Una columna fijada pasa al principio, junto a las demás columnas fijadas, y sigue visible al desplazar la tabla en horizontal (mientras las columnas fijadas quepan juntas en la tabla).

## Inicio, Fin y las fechas programadas

**Inicio** y **Fin** (en la disposición predeterminada de la Tabla) muestran las mismas fechas que la barra del Gantt: la programación calculada y, antes del primer cálculo, las fechas introducidas. Si escribe otra fecha en Inicio, esta pasa a ser el inicio programado. Otro Fin cambia la duración de una tarea programada automáticamente; en una tarea programada manualmente pasa a ser el fin programado. Después pulse **F5** para recalcular. Si vuelve a escribir la misma fecha, no cambia nada.

Los campos **Inicio programado** y **Fin programado** muestran las propias fechas introducidas, aunque el cálculo desplace la tarea. Fin programado solo se puede editar en una tarea programada manualmente: en las demás tareas, el inicio y la duración determinan el fin. El Inicio y el Fin de una tarea de resumen programada automáticamente se derivan de sus subtareas y no se pueden editar.

## Restablecer valores predeterminados

**Restablecer valores predeterminados** está al pie del selector de columnas. Un clic devuelve las columnas de esa tabla a la disposición predeterminada: qué columnas se muestran, su orden y ancho, y las columnas fijadas. Los campos añadidos de más salen de la tabla y siguen disponibles en el selector. Así también obtiene la nueva disposición predeterminada tras una actualización, por ejemplo **Inicio** y **Fin** en lugar de **Inicio programado** y **Fin programado**: una disposición propia guardada antes no cambia por sí sola. Si la tabla ya usa la disposición predeterminada, el botón está desactivado.

## Guardar, deshacer y layouts

La disposición de columnas es una preferencia personal en este dispositivo: vale para todos sus proyectos y no se guarda en el archivo del proyecto. Cada acción sobre las columnas — añadir, quitar, mover, cambiar el ancho, fijar o **Restablecer valores predeterminados** — es un paso que **Ctrl+Z** deshace.

Un layout también puede guardar las columnas. Toma la disposición de la tabla que ve al crear el layout y, con un clic en el botón del layout, la aplica a la tabla que esté a la vista en ese momento: en la pestaña Tabla, la Tabla; en las demás pestañas, la lista de tareas junto al Gantt. Vea [Guardar y cargar layouts](docs://ref-layouts).

## Siga leyendo

- [Filtros](docs://ref-filters) — qué tareas muestran la tabla y el Gantt.
