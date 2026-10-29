# Guardar e insertar plantillas de WBS

Objetivo: guardar una fase con sus subtareas y sus relaciones como plantilla, e insertarla de nuevo más adelante en el mismo proyecto o en otro.

## Cuándo lo necesita

Usted planifica siempre el mismo tipo de trabajo: cada casa tiene una cimentación con movimiento de tierras, armado, hormigonado y curado. En vez de crear esas tareas una y otra vez y vincularlas entre sí, guarde la fase una vez como **plantilla**. Una plantilla es una rama de su WBS: una tarea con todo lo que cuelga de ella.

## Pasos

### Guardar una rama como plantilla

1. Construya la rama como quiere reutilizarla: una tarea de resumen con subtareas y las relaciones entre ellas.
2. Haga clic con el botón derecho en esa tarea de resumen y elija *Guardar rama como plantilla*. Esta opción de menú solo aparece en las tareas con subtareas.

La aplicación muestra *Rama guardada como plantilla 'Foundation'*. La aplicación no pide un nombre: la plantilla toma el nombre de la tarea superior de la rama.

### Insertar una plantilla

1. Seleccione la tarea bajo la que debe ir la plantilla, o no seleccione nada.
2. Elija *Planificación › Estructura › Plantillas*. La lista muestra el nombre de cada plantilla y, por ejemplo, *4 tareas, 2 relaciones*.
3. Haga clic en la plantilla.

Si hay una tarea seleccionada, la plantilla se inserta como última subtarea de esa tarea. Como resultado, esa tarea pasa a ser una tarea de resumen. Si hay varias tareas seleccionadas, cuenta la que hizo clic primero. Si no hay nada seleccionado, la rama va al final de la lista, en el nivel superior. Después, la rama insertada queda seleccionada.

Todas las tareas insertadas quedan en la fecha de inicio del proyecto y la planificación deja de estar actualizada. Pulse **Calcular** (F5), por ejemplo desde *Inicio › Programación › Calcular*, y las fechas se derivan de las relaciones. Con *Deshacer* se revierte la inserción en un solo paso. Guardar o eliminar una plantilla no forma parte de esa inserción.

### Eliminar una plantilla

Abra *Planificación › Estructura › Plantillas* y haga clic en el pequeño icono de papelera a la derecha de la plantilla (*Eliminar plantilla*). La aplicación no pide confirmación.

### Qué contiene una plantilla

Por cada tarea, una plantilla guarda el nombre, la descripción, la categoría de trabajo, si es un hito y la duración en días. De las relaciones, guarda solo las que van entre dos tareas de la rama, con tipo y desfase. Un desfase en horas (`4h`) no se guarda y pasa a ser 0. Un desfase en días laborables, días naturales o porcentaje sí se guarda.

Todo lo demás queda fuera: fechas, avance y fechas reales, asignaciones de recursos, códigos y campos personalizados (véase [Códigos y campos personalizados](docs://howto-codes-en-velden)), el calendario, las restricciones y las fechas límite, la prioridad, una categoría de trabajo personalizada, en el caso de un hito el tipo y la marca *Obligatorio (contractual)*, y las relaciones con tareas fuera de la rama. Después de insertar, usted las rellena de nuevo: las asignaciones, los códigos, el calendario y las restricciones quedan vacíos, y todas las tareas empiezan en la fecha de inicio del proyecto.

Una tarea que estaba en horas vuelve como tarea en días, con su duración convertida en una fracción de día laborable. Una tarea de 5 horas, con un día laborable de 8 horas, pasa a ser 0,625 días.

## Puntos delicados y qué hace la aplicación

**Las plantillas no pertenecen al proyecto.** La aplicación las guarda en el almacenamiento de la aplicación en este dispositivo, no en el archivo del proyecto. Un compañero que abra su archivo no ve sus plantillas. En la versión para el navegador, una plantilla pertenece a ese navegador. Por eso, si sus plantillas son importantes, guárdelas también en otro lugar: póngalas en un proyecto que guarde como archivo.

**El mismo nombre puede aparecer más de una vez.** Si guarda la rama dos veces, la lista contiene dos plantillas con el mismo nombre. La aplicación no sobrescribe nada.

**La duración de la tarea superior no cuenta.** Una tarea de resumen obtiene su duración de sus subtareas en cuanto use Calcular.

**Una tarea con asignaciones de recursos como destino.** Si selecciona una tarea con asignaciones que todavía no tiene subtareas e inserta una plantilla debajo, la aplicación lo rechaza. La tarea pasaría a ser una tarea de resumen, y un resumen no lleva asignaciones. La tarea superior de una plantilla ya tiene subtareas, así que las asignaciones no tendrían dónde ir. La aplicación se lo indica y no cambia nada. Elija entonces otra tarea, o ninguna, como destino. Un hito que recibe una plantilla pierde su marca de hito, con un mensaje.

**Una relación no válida en la plantilla.** Si una relación de la plantilla no está permitida, por ejemplo una relación de una tarea con su propia fase, o si ya existe, la aplicación la omite y le indica cuántas relaciones omitió.

## Véase también

- [Ajustar la estructura](docs://howto-structuur-aanpassen): mover o aplicar sangría a la rama insertada.
- [Añadir relaciones](docs://howto-relaties-leggen): crear usted mismo relaciones dentro de una rama antes de guardarla.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): qué pasa con la rama insertada después de Calcular.
