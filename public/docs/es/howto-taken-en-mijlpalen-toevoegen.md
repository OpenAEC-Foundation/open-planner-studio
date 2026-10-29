# Añadir tareas e hitos

Objetivo: añadir una tarea o un hito nuevo a su planificación, en el lugar donde corresponde.

## Cuándo lo necesita

Está creando una planificación, se añaden tareas nuevas o quiere registrar un momento, como una entrega o una inspección.

Una **tarea** es una labor que lleva tiempo. Una tarea nueva dura 5 días laborables de forma predeterminada (con planificación por horas, el valor predeterminado del proyecto puede ser en horas). Un **hito** es un momento sin duración: 0 días. Una tarea con subtareas se llama **tarea de resumen**; en construcción suele ser una fase. Su duración y sus fechas se derivan de sus subtareas en cuanto usa **Calcular** (F5).

## Pasos

### Añadir una tarea

1. Elija *Inicio › Tareas › Tarea*. El mismo botón está en la pestaña *Tabla*.
2. Se abre el panel *Propiedades* y se selecciona el campo *Nombre*. Escriba el nombre y pulse Intro.

La nueva tarea se llama primero *Nueva tarea* y empieza en la fecha de inicio del proyecto.

Si hay una tarea seleccionada, la nueva tarea va justo debajo de ella, al mismo nivel. Si la tarea seleccionada es una tarea de resumen, la nueva tarea va debajo de toda esa fase, es decir, después de sus subtareas. Si no hay nada seleccionado, va al final de la lista. La información sobre herramientas del botón indica cuál de las dos cosas ocurrirá: *Nueva tarea justo debajo de la selección* o *Nueva tarea al final de la lista*. Si selecciona varias tareas, se crea una sola tarea nueva, debajo de la más baja de la selección tal como la ve en pantalla.

### Rápidamente, una tras otra, en la tabla de tareas

Debajo de la última tarea de la tabla de tareas siempre hay una fila gris *Nueva tarea*. Todavía no es una tarea: no está en el Gantt ni en el archivo.

1. Haga clic en una celda de esa fila, o vaya a ella con la flecha hacia abajo.
2. Escriba el nombre y pulse Intro. Ahora es una tarea real, al mismo nivel que la tarea de encima. El cursor está enseguida en la nueva fila gris de debajo.
3. Escriba el siguiente nombre, y así sucesivamente.

Si solo rellena una duración o una fecha en la fila gris, la tarea se llama *Nueva tarea*. Si sale sin rellenar nada, no ocurre nada: no hay tarea ni paso en *Deshacer*. Crear la tarea y su primer valor forman juntos un solo paso en *Deshacer*. La fila gris solo aparece cuando la tabla de tareas no está filtrada, agrupada ni ordenada.

### Con el botón derecho del ratón en un espacio vacío

Haga clic con el botón derecho en un espacio vacío: en la tabla de tareas, debajo de la última tarea, o en el Gantt, al lado o debajo de las barras. Elija *Nueva tarea* o *Añadir hito*. La tarea va al final de la lista. En el Gantt, empieza en la fecha donde hizo clic. En la tabla de tareas se abre enseguida la celda de nombre para que pueda escribir.

### Encima o debajo de una tarea concreta

Haga clic con el botón derecho en la tarea y elija *Insertar arriba* o *Insertar debajo*. El teclado también funciona: Insert añade encima de la tarea seleccionada, Ctrl+I (⌘+I en un Mac) debajo. En la tabla de tareas, la celda de nombre se abre enseguida después de Insert, lista para escribir.

Si hay varias tareas seleccionadas, se crea una sola tarea nueva: *Insertar arriba* la pone encima de la tarea seleccionada más alta, *Insertar debajo* debajo de la más baja.

### Añadir una subtarea

Haga clic con el botón derecho en la tarea y elija *Añadir subtarea*. La nueva tarea va al final de las subtareas de esa tarea. En la tabla de tareas, junto al Gantt, una tarea de resumen también tiene un pequeño **+** después de su nombre que hace lo mismo.

### Añadir un hito

1. Elija *Inicio › Tareas › Hito ▾* y después *Hito de comienzo*, *Hito de fin* o *Punto de inspección (obligatorio)*.
2. Escriba el nombre y pulse Intro. La posición sigue la misma regla que para *Tarea*.

Los tres tipos se diferencian así:

- Un *Hito de comienzo* va al inicio del día, un *Hito de fin* al final del día. En el Gantt, el rombo queda a la izquierda o a la derecha de la columna del día, respectivamente. También importa para el sucesor. Suponga que un hito cae el martes 29 de septiembre de 2026 y una tarea lo sigue con una relación fin-comienzo: después de un hito de comienzo, esa tarea empieza el mismo martes; después de un hito de fin, el miércoles 30 de septiembre.
- Un *Punto de inspección (obligatorio)* es un hito de fin con la categoría de trabajo *Inspección* y la casilla *Obligatorio (contractual)* marcada.

### Convertir una tarea existente en hito

Haga clic con el botón derecho en la tarea y elija *Alternar hito*, o marque *Hito* en el panel *Propiedades*. La opción del menú funciona para toda la selección. La duración se convierte en 0.

Si lo desactiva de nuevo, sigue siendo una tarea normal con duración 0. Introduzca usted una duración.

### Otras formas

- Ctrl+M (⌘+M en un Mac) pone un hito nuevo al final de la lista, aunque haya una tarea seleccionada. El panel *Propiedades* no se abre.
- Un hito que cree con Ctrl+M o con el menú contextual recibe la categoría de trabajo *Inspección*. Un *Hito de comienzo* o un *Hito de fin* desde *Hito ▾* recibe *Otro*. Cambie la categoría de trabajo en *Propiedades* si lo necesita.
- *Añadir hito* en el menú contextual de una tarea hace del hito una subtarea de esa tarea, no una tarea del mismo nivel.

### Copiar una tarea o una rama completa

1. En el Gantt, haga clic en la barra de la tarea. Seleccione más tareas con Ctrl+clic.
2. Pulse Ctrl+C (⌘+C en un Mac). La aplicación copia la tarea con todas sus subtareas, las relaciones entre las tareas copiadas y sus asignaciones de recursos.
3. Si lo desea, haga clic en la barra de la tarea junto a la que debe ir la copia, y pulse Ctrl+V (⌘+V).

La copia tiene el mismo nombre, las mismas fechas y el mismo avance. Entra como tarea del mismo nivel que la tarea seleccionada (con varias: la primera en la que hizo clic), al final entre esas tareas del mismo nivel. Si no hay nada seleccionado, va al final de la lista. Después, las tareas copiadas quedan seleccionadas, los códigos WBS (el número de cada tarea en el árbol, como 1.2; véase [Ajustar la estructura](docs://howto-structuur-aanpassen)) se determinan de nuevo y la planificación deja de estar actualizada.

El portapapeles es común a toda la aplicación, así que también puede pegar en otro documento. Lo que allí no existe, como un calendario de tarea, una categoría de trabajo personalizada, un código de actividad o un campo personalizado, la aplicación lo borra y se lo indica.

### Después

Una tarea nueva todavía no cambia las demás fechas. La barra de estado dice *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo en *Inicio › Programación › Calcular*.

## Dificultades habituales y lo que hace la aplicación

**Cada tarea nueva empieza en la fecha de inicio del proyecto.** Sin relaciones, una tarea no espera a nada. Añada relaciones; véase [Añadir relaciones](docs://howto-relaties-leggen).

**El filtrado, la agrupación o la ordenación están activados.** El orden que ve entonces no es el orden de la planificación. Con una tarea seleccionada, *Tarea* e *Hito ▾* añaden la nueva tarea al final. Aparece una notificación roja que dice *La nueva tarea se ha añadido al final. Durante el filtrado, la agrupación o la ordenación, la aplicación no puede colocarla debajo de su selección*. *Insertar arriba* e *Insertar debajo* se rechazan, con la franja *No disponible mientras se filtra/agrupa/ordena*. El botón *Limpiar* de la notificación o de la franja quita el filtro, la agrupación y la ordenación de una vez. Eso no forma parte de *Deshacer*: Ctrl+Z no los recupera.

**Una subtarea debajo de una tarea con asignaciones de recursos.** La tarea se convierte en tarea de resumen, y una tarea de resumen no lleva asignaciones por sí misma. La aplicación traslada las asignaciones a la nueva subtarea y se lo indica. Si no es posible, por ejemplo porque eligió *Añadir hito* y un hito no puede llevar asignaciones, la aplicación no añade nada y explica por qué.

**Una subtarea debajo de un hito.** El hito se convierte en tarea de resumen y la aplicación quita la marca de hito, con un mensaje.

**Hito activado en una tarea de resumen o en una tarea con asignaciones.** La aplicación lo rechaza y explica por qué. Con asignaciones: quítelas antes.

**Copiar en la tabla de tareas.** En la tabla de tareas (y en la pestaña *Tabla*), Ctrl+C copia solo los valores de las celdas seleccionadas, como en una hoja de cálculo, y Ctrl+V pega en celdas. Por eso, copiar tareas solo funciona si usa el Gantt: haga clic antes en una barra.

## Véase también

- [Ajustar la estructura](docs://howto-structuur-aanpassen): aplicar sangría y mover tareas, y mantener actualizados los números WBS.
- [Añadir relaciones](docs://howto-relaties-leggen): vincular tareas entre sí.
- [Seleccionar, eliminar y deshacer tareas](docs://howto-taken-selecteren-verwijderen): quitar de nuevo una tarea.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): lo que calcula la aplicación cuando hay relaciones.
- [Cuadro de diálogo de tarea y panel de propiedades](docs://ref-taak-eigenschappen): todos los campos de una tarea.
- [Proyecto nuevo e info del proyecto](docs://ref-projectinfo): para empezar con una plantilla de fases.
- [Menús del clic derecho](docs://ref-contextmenus): todas las opciones del menú de una tarea.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): un proyecto de ejemplo pequeño (*Archivo › Ejemplos*) con cuatro fases, un hito de comienzo y un hito de entrega obligatorio.
