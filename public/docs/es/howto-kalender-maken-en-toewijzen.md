# Crear y asignar un calendario

Objetivo: cree un calendario propio, por ejemplo una semana laboral de seis días, y asígnelo a las tareas que deben calcularse con él.

## Cuándo lo necesita

Un subcontratista también trabaja los sábados. Una cuadrilla trabaja solo de lunes a jueves. Una tarea cae en un intervalo de tiempo en el que solo esa tarea permanece detenida. El calendario del proyecto entonces tiene los días laborables incorrectos. Con un calendario propio, la aplicación calcula esas tareas en los días correctos, y el resto se queda en el calendario del proyecto. Lo que la aplicación hace exactamente con un calendario puede leerlo en [Calendarios y días laborables](docs://uitleg-kalenders).

## Pasos

### Crear un calendario

1. Elija *Planificación › Calendario › Calendario*. El mismo botón está en *Configuración › Calendario › Calendario*. Se abre la ventana *Calendarios*. A la izquierda están los calendarios del proyecto; el calendario del proyecto tiene una estrella.
2. Debajo de la lista, haga clic en el botón con el signo más (*Nuevo calendario*). El calendario nuevo es una copia del estándar: de lunes a viernes, de 07:00 a 16:00 con una hora de pausa y, si *Modo construcción* está activado, los días festivos nacionales de los Países Bajos. Si quiere usar un calendario existente como base, selecciónelo en la lista y haga clic en el botón con las dos hojas debajo de la lista (*Duplicar*).
3. Dé un nombre al calendario en *Nombre* que indique quién lo usa, por ejemplo *Six-day week*.
4. En *Días laborables*, haga clic en los días de la semana para activarlos o desactivarlos. *Lun–vie* restablece la semana estándar, de 07:00 a 16:00. Si el calendario tiene bandas de horario laboral, *Lun–vie* solo activa de lunes a viernes y cada día conserva sus bandas. *Continuo (24/7)* activa los siete días, de 00:00 a 24:00.
5. Ajuste los horarios laborales si hace falta: *Inicio (hora)*, *Fin (hora)*, *Inicio de la pausa* y *Duración de la pausa (minutos)*. Escriba las horas como HH:MM; con las flechas las sube o baja un cuarto de hora. Si pone la duración de la pausa en 0, el calendario funciona sin pausa. La aplicación calcula el *Día laborable estándar* por sí misma. Si el calendario tiene bandas de horario laboral por día de la semana (por ejemplo de MS Project), no ve estos campos, sino el bloque *Horarios de trabajo*, también con la planificación por horas desactivada; vea [Definir los horarios laborales](docs://howto-werktijden-instellen).
6. Ajuste los festivos si hace falta. Cómo funciona se explica en [Generar los festivos y las vacaciones de construcción](docs://howto-feestdagen-genereren).
7. Haga clic en *Aplicar*. La aplicación recalcula la planificación al momento y cierra la ventana. Con *Cancelar* descarta los cambios. Al pulsar Intro en un campo de entrada se guardan los cambios intermedios y también se recalcula, sin cerrar la ventana; *Cancelar* entonces solo deshace lo que cambió después de eso.

### Asignar un calendario a las tareas

Un calendario nuevo solo actúa cuando una tarea lo usa. Hay dos formas.

**Mediante el panel de propiedades**

1. Seleccione la tarea. Si no ve el panel *Propiedades*, actívelo con *Vista › Paneles › Propiedades*.
2. Debajo de *Tarea*, elija el calendario en la lista *Calendario*. La primera opción, *Calendario del proyecto* con el nombre a continuación, significa que la tarea no tiene calendario propio.

**Mediante el menú contextual**

1. Haga clic con el botón derecho en la tarea, en la tabla de tareas o en la barra del diagrama de Gantt.
2. Elija *Asignar calendario* y después el calendario, o *Calendario del proyecto* para quitar de nuevo el calendario propio. El calendario que se aplica ahora tiene una marca.
3. Si quiere dar un calendario a varias tareas a la vez, primero selecciónelas con Ctrl (⌘ en un Mac) y haga clic con el botón derecho en una de las tareas seleccionadas. La elección se aplica a todas las tareas seleccionadas. Si hace clic con el botón derecho en una tarea que no está seleccionada, se aplica solo a esa tarea.

Una nueva elección de calendario todavía no deja la planificación actualizada: la barra de estado muestra *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo con *Inicio › Programación › Calcular*. Si *Calcular automáticamente* está activado (*Configuración › Proyecto › Configuración*, pestaña *Planificación*, encabezado *Cálculo*), la aplicación lo hace por sí misma.

### Cambiar el calendario del proyecto

1. Abra *Planificación › Calendario › Calendario* y elija el calendario en la lista.
2. Encima del formulario, haga clic en *Establecer como predeterminado del proyecto*. La estrella pasa a ese calendario.
3. Haga clic en *Aplicar*.

Solo se mueven las tareas sin calendario propio.

### Eliminar un calendario

1. Abra la ventana *Calendarios* y elija el calendario en la lista.
2. Debajo de la lista, haga clic en el botón con la papelera (*Eliminar*). Ese botón está desactivado mientras solo haya un calendario.
3. Haga clic en *Aplicar*. Las tareas y los recursos que usaban el calendario vuelven a usar el calendario del proyecto. Si elimina el propio calendario del proyecto, el primer calendario de la lista pasa a ser el calendario del proyecto.

## Problemas posibles y qué hace la aplicación entonces

**Sin días laborables.** Si desactiva todos los días de la semana, la aplicación no puede calcular. Al calcular, muestra *El calendario no tiene días laborables configurados*.

**Entrada no válida.** Una pausa fuera del día laborable, una hora de inicio posterior a la hora de fin o un festivo con una fecha incorrecta muestra un mensaje rojo en el campo, y *Aplicar* queda desactivado hasta que lo corrija. Para una pausa o un festivo no válidos, también aparece un signo de advertencia junto al calendario en la lista (*Este calendario contiene datos no válidos*).

**Un calendario en una fase.** Una fase siempre se calcula con el calendario del proyecto, porque su duración se deriva de sus tareas. Asigne el calendario a las propias tareas.

**El mismo calendario, dos opciones.** En la lista, el calendario del proyecto aparece dos veces: como *Calendario del proyecto: nombre* y como un calendario normal con ese nombre. Si elige la segunda, es una elección propia para esa tarea. Entonces la tarea no se mueve con el calendario del proyecto cuando después elija otro calendario de proyecto.

**Horas distintas por día.** Si cambia los horarios laborales o la pausa de modo que cambie el *Día laborable estándar* de un calendario, una tarea en días sigue contando el mismo número de días. Para una tarea con recursos y con el tipo de tarea *Trabajo fijo* o *Unidades fijas*, la duración sí cambia con ello, porque el trabajo sigue igual. Cuarenta horas de trabajo son 5 días a 8 horas por día y 7 días a 6 horas por día. La aplicación informa de cuántas tareas han recibido una duración distinta.

## Véase también

- [Calendarios y días laborables](docs://uitleg-kalenders): cómo cuenta la aplicación los días laborables y qué calendario gana.
- [Días y horas](docs://uitleg-dagen-en-uren): lo que hace el día laborable estándar.
- [Configurar un calendario de recurso](docs://howto-resourcekalender-instellen): un calendario para un recurso en lugar de una tarea.
- [Ventanas de calendario](docs://ref-kalenders): todos los campos de las ventanas de calendario.
