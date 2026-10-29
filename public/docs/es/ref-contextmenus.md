# Menús del botón derecho

Qué menús abre el botón derecho del ratón en el diagrama de Gantt y en la tabla de tareas, qué hace cada elemento y a qué tareas se aplica. Los elementos que también existen como botón o atajo de teclado están en [La cinta, pestaña por pestaña](docs://ref-lint) y [Atajos de teclado](docs://ref-sneltoetsen).

## Qué menú en cada lugar

Hay cuatro menús. Cuál aparece depende de dónde haga clic:

- **En una barra de tarea del diagrama de Gantt** — el menú de tarea, con *Iniciar relación desde aquí* arriba del todo.
- **En una tarea de la tabla de tareas** — el mismo menú de tarea, sin ese elemento de arriba. Esto vale para la tabla de tareas a la izquierda del diagrama de Gantt y para la pestaña *Tabla*.
- **En un encabezado de grupo de la tabla de tareas** — un menú pequeño para expandir y contraer grupos. Los encabezados de grupo solo aparecen cuando agrupa, por ejemplo con el diseño *Diagrama de recursos*.
- **En espacio vacío** — en el diagrama de Gantt junto o debajo de las barras, y en la tabla de tareas debajo de la última tarea o en la fila gris *Nueva tarea*. El menú tiene *Nueva tarea*, *Añadir hito* y *Pegar*; en el diagrama de Gantt también *Restablecer zoom* y *Ajustar al proyecto*. Una tarea nueva o un hito nuevo va al final de la lista. En el diagrama de Gantt empieza en la fecha donde hizo clic; en la tabla de tareas la celda del nombre se abre de inmediato para que pueda escribir.

En la franja de un encabezado de grupo del diagrama de Gantt, el botón derecho del ratón abre el menú de espacio vacío; el propio encabezado de grupo tiene un menú solo en la tabla de tareas. Un clic derecho en el encabezado de la escala temporal no hace nada. Los encabezados de columna de la tabla de tareas tienen su propio menú, descrito en [Ajustar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen).

**¿A qué tareas se aplica un elemento?** Hace clic en una tarea, pero la selección define el alcance. Si la tarea en la que hace clic forma parte de la selección, el elemento se aplica a toda la selección. Si no forma parte, se aplica solo a esa tarea. Con un clic con el botón derecho en una barra del diagrama de Gantt o en una fila de la tabla de tareas, esa tarea reemplaza la selección si no formaba parte de ella. Cada elemento que cambia algo es un paso de *Deshacer*, también para toda una selección.

## El menú de tarea

Los elementos están en este orden. Una línea entre grupos es un separador en el menú.

**Iniciar relación desde aquí** — solo en el diagrama de Gantt, en una barra. Activa el modo de relación con esta tarea seleccionada; después usted arrastra hasta el sucesor. Véase [Añadir relaciones](docs://howto-relaties-leggen).

**Quitar la interrupción** y **Quitar todas las interrupciones** — solo en el diagrama de Gantt, en una barra con interrupciones. *Quitar la interrupción* solo aparece si hace clic en una interrupción o en el tramo que sigue a ella, y esa interrupción se puede editar; quita esa única interrupción. *Quitar todas las interrupciones* quita todas, también las interrupciones de un archivo de origen que no puede editar. Véase [Dividir una tarea](docs://howto-taak-splitsen).

**Editar...** — abre la ventana *Editar tarea* para esta tarea. Véase [Cuadro de diálogo de tarea y panel de propiedades](docs://ref-taak-eigenschappen).

**Insertar encima** y **Insertar debajo** — inserta una tarea nueva encima de la tarea superior o debajo de la tarea inferior del alcance, al mismo nivel. Solo funciona en la vista de árbol pura, sin filtro, agrupación ni ordenación; si no, la aplicación lo rechaza con un mensaje. Véase [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen).

**Añadir subtarea** — añade una tarea nueva como subtarea de la tarea en la que hizo clic, al final de sus subtareas. Solo para esa tarea, no para toda la selección.

**Añadir hito** — añade un hito como subtarea de la tarea en la que hizo clic. Solo para esa tarea.

**Añadir relación** — hace lo mismo que *Iniciar relación desde aquí*: activa el modo de relación con esta tarea seleccionada. En la tabla de tareas el elemento está desactivado si el diagrama de Gantt no está visible, con el texto emergente *Solo disponible cuando el diagrama de Gantt está visible*.

**Aplicar sangría** y **Anular sangría** — mueve las tareas del alcance un nivel más abajo o un nivel más arriba en la WBS. Estos dos elementos solo aparecen en la vista de árbol pura. Véase [Ajustar la estructura](docs://howto-structuur-aanpassen).

**Alternar hito** — convierte la tarea en hito, o al revés. El nuevo estado depende de la tarea en la que hizo clic y se aplica a todo el alcance: si esa es una tarea, todas las tareas del alcance pasan a ser hitos. Una tarea de resumen y una tarea con asignaciones no pasan a ser hito; el resto del alcance sí, y usted recibe un mensaje por cada motivo.

**Asignar calendario ▸** — un submenú con *Calendario del proyecto* (la tarea no tiene entonces calendario propio) y debajo los calendarios disponibles. La opción actual tiene una marca de verificación. Una tarea que ya está en ese calendario no cuenta y no crea un paso extra de *Deshacer*. Véase [Crear y asignar un calendario](docs://howto-kalender-maken-en-toewijzen).

**Avance ▸** — un submenú con 0%, 25%, 50%, 75% y 100%. La opción actual tiene una marca de verificación. Una tarea de resumen no tiene avance propio: si hay una en el alcance, sus tareas hoja reciben el porcentaje. Si no hay fecha de estado, la aplicación la fija en hoy, con un mensaje. Una tarea cuyo inicio planificado es posterior a la fecha de estado y que todavía no tiene inicio real primero lleva a una pregunta sobre el inicio real; si la cancela, no cambia nada. Véase [Actualizar el avance](docs://howto-voortgang-bijwerken).

**Prioridad ▸** — un submenú con *Baja* (100), *Normal* (500) y *Alta* (900), la prioridad de nivelación de la tarea. La opción actual tiene una marca de verificación. Véase [Nivelación de recursos](docs://uitleg-nivelleren).

**Mostrar trazado de ruta** — muestra los predecesores y sucesores de esta tarea. Si el trazado ya está activo, el elemento se llama *Detener trazado de ruta*. Véase [Trazar una ruta](docs://howto-pad-traceren).

**Contraer**, **Expandir** y **Guardar rama como plantilla** — solo para una tarea de resumen. *Contraer* y *Expandir* siempre aparecen los dos, aunque la tarea ya esté contraída o expandida, y se aplican a todo el alcance. *Guardar rama como plantilla* guarda la tarea con sus subtareas y las relaciones entre ellas como plantilla WBS. Véase [Guardar e insertar plantillas WBS](docs://howto-wbs-sjablonen).

**Eliminar** — elimina las tareas del alcance, con sus subtareas. No hay confirmación; las recupera con Ctrl+Z, en un solo paso para todo el alcance. Véase [Seleccionar, eliminar y deshacer tareas](docs://howto-taken-selecteren-verwijderen).

## El menú de un encabezado de grupo

Este menú solo existe en la tabla de tareas, en un encabezado de grupo:

**Contraer grupo** o **Expandir grupo** — contrae o expande solo este grupo. El elemento muestra lo que puede hacer.

**Expandir todo** y **Contraer todo** — expande o contrae todos los grupos a la vez.

Configure la agrupación con un diseño. Véase [Crear y usar un diseño](docs://howto-layouts-gebruiken).

## Véase también

- [Arrastrar, desplazar y hacer zoom en el diagrama de Gantt](docs://howto-gantt-bedienen): qué hace arrastrar con los botones izquierdo y central del ratón.
- [La cinta, pestaña por pestaña](docs://ref-lint): los botones con las mismas acciones.
- [Atajos de teclado](docs://ref-sneltoetsen): las teclas que les corresponden.
