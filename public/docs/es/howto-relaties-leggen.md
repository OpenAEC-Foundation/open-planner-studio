# Añadir relaciones

Objetivo: vincular tareas entre sí, de modo que una tarea solo empiece cuando termine la tarea anterior, y añadir un tiempo de espera (desfase) entre ellas cuando haga falta.

## Cuándo lo necesita

Sin relaciones, la aplicación no sabe que el albañil solo puede empezar cuando se haya vertido la cimentación. Entonces, todas las tareas empiezan en el inicio del proyecto y la fecha de fin no significa nada. Una **relación** registra ese orden. La primera tarea es el **predecesor** y la segunda, el **sucesor**.

Añada relaciones al crear una planificación, al añadir una tarea o cuando resulte que, al fin y al cabo, dos tareas dependen una de otra. Un **desfase** es un tiempo de espera entre dos tareas, por ejemplo, el hormigón que debe curar o una solera que debe secar.

La relación predeterminada es **FS** (fin-comienzo): el sucesor solo puede comenzar cuando haya terminado el predecesor. La aplicación también conoce SS, FF y SF, que relacionan un comienzo o un fin con otro comienzo o fin. Con SS (comienzo-comienzo), por ejemplo, el enlucido solo puede comenzar cuando hayan comenzado las instalaciones.

¿No sabe qué tipo necesita? Debajo de la elección del tipo, una frase con los nombres reales de las tareas lo explica, por ejemplo, *Metselwerk empieza solo cuando termina Fundering.* Elija otro tipo y la frase cambia con él. La ve en la ventana *Tipo de relación*, en el bloque *Relaciones* y en la columna *Predecesoras* o *Sucesoras*.

## Pasos

Hay cuatro formas de añadir una relación. Crean la misma relación; elija la que mejor se adapte a su situación.

### Vincular dos tareas seleccionadas

Es útil cuando trabaja en la tabla de tareas.

1. En la tabla de tareas, haga clic en la tarea que va primero: el predecesor.
2. Mantenga pulsado Ctrl (⌘ en un Mac) y haga clic en la tarea que va después: el sucesor.
3. Elija *Inicio › Tareas › Vincular ▾ › Vincular tareas seleccionadas*. El mismo botón también está en *Planificación › Relaciones*.

La aplicación crea una relación fin-comienzo sin desfase. La ve como una flecha en el Gantt y en la columna *Predecesoras*; solo aparece una notificación si la aplicación rechaza la relación. El botón solo funciona con exactamente dos tareas seleccionadas.

### Dibujar una relación en el Gantt

Es útil cuando añade muchas relaciones seguidas.

1. Elija *Inicio › Tareas › Vincular ▾ › Dibujar relación*. Encima del Gantt aparece el aviso *Modo enlace: arrastre de una barra a otra en el Gantt para crear una relación. Esc para detener.*
2. Pulse sobre la barra del predecesor y arrástrela hasta la barra del sucesor. Una línea discontinua con una flecha sigue al cursor.
3. Suelte el botón del ratón. Aparece una ventana pequeña *Tipo de relación* con el tipo (FS predeterminado) y un campo para el desfase.
4. Cambie el tipo o el desfase si es necesario y pulse Intro, o haga clic fuera de la ventana. Se crea la relación.
5. Añada la siguiente en seguida: el modo sigue activo. Se detiene con Esc, con el botón *Detener* del aviso o eligiendo de nuevo *Dibujar relación*.

Si pulsa Esc en la ventana *Tipo de relación*, no se registra nada. Para una sola relación no necesita activar el modo: mantenga pulsado Mayús mientras arrastra de barra a barra. *Iniciar relación desde aquí*, en el menú contextual de una barra, activa el modo enlace; el arrastre lo sigue haciendo usted. En la pestaña *Tabla*, sin Gantt, *Dibujar relación* está desactivado.

### Añadir una relación en el panel de propiedades

Es útil cuando mira una tarea y quiere añadir sus predecesores o sucesores.

1. Seleccione la tarea. El panel *Propiedades* está a la derecha; si no lo ve, actívelo con *Vista › Paneles › Propiedades*.
2. En el bloque *Relaciones*, haga clic en *Añadir relación*.
3. Deje la dirección en *Predecesora* si la otra tarea va primero, o elija *Sucesora*.
4. Escriba parte del nombre de la otra tarea. Elija la correcta con las teclas de flecha e Intro, o haga clic en ella.
5. Elija el tipo (FS predeterminado) y rellene un desfase si es necesario.
6. Pulse Intro o haga clic en la marca (*Crear relación*).

Después, las relaciones de la tarea aparecen enumeradas en *Relaciones*, cada una con el número WBS de la otra tarea, el tipo y el desfase.

### Escribir relaciones en la columna Predecesoras

Es útil cuando trabaja deprisa con el teclado y conoce los números WBS.

1. Haga clic en el **+** a la derecha del encabezado de la tabla de tareas (*Añadir columna*) y, en *Relaciones*, elija la columna *Predecesoras*. La columna *Sucesoras* funciona igual.
2. En la columna *Predecesoras*, haga clic en la celda del sucesor.
3. Escriba el número WBS del predecesor, un espacio y el tipo, por ejemplo `2.6 FS`. Escriba el desfase justo después: `2.6 FS+1d`. Separe varios predecesores con punto y coma o con coma: `3.1 FS; 3.2 SS+2d`.
4. Pulse Intro.

Lo que escribe sustituye toda la celda. Si ya hay predecesores en ella, escríbalos también (véase Errores frecuentes). Si pulsa Intro o F2 en la celda en lugar de escribir, se abre un campo de entrada que conserva las relaciones existentes: busca una tarea por número WBS o nombre y elige el tipo y el desfase de cada relación.

### Establecer o cambiar un desfase

Escriba un desfase en el campo junto al tipo, en cada una de las formas anteriores. Cambie un desfase existente en *Relaciones*: haga clic en el campo del desfase, escriba el nuevo valor y pulse Intro.

- `3` o `3d`: 3 días laborables. El fin de semana no cuenta. La aplicación muestra `+3d`.
- `3ed`: 3 días naturales. El fin de semana sí cuenta, como ocurre con el hormigón, que también cura el sábado y el domingo.
- `-1`: un desfase negativo (adelanto). El sucesor puede empezar un día antes, así que las tareas se solapan.
- `4h`: 4 horas laborables; la aplicación lo muestra como `+4h`. Si el predecesor es una tarea en días en un calendario sin bandas de horario laboral propias, como el calendario estándar, la aplicación convierte esto en días laborables completos, redondeados al día completo más cercano: `4h` actúa entonces como 1 día y `2h` como 0. En un calendario con bandas de horario laboral propias, o después de una tarea horaria, el desfase cuenta exactamente en horas.
- `50%`: la mitad de la duración del predecesor.

Ejemplo: el hormigón de la cimentación tiene que curar antes de que el albañil pueda trabajar en ella, así que *Pour foundation → Foundation brickwork* recibe una relación FS con desfase `3`. Si el vertido es el viernes 18 de junio de 2027, la mampostería empieza tras **Calcular** el jueves 24 de junio: de lunes a miércoles es tiempo de espera. Con `3ed` el fin de semana cuenta y la mampostería empieza el martes 22 de junio.

### Por último: recalcular

Una relación nueva todavía no mueve ninguna barra; la barra de estado muestra *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo mediante *Inicio › Programación › Calcular*. Solo entonces los sucesores obtienen sus nuevas fechas. Si quiere que la aplicación lo haga por usted, active *Calcular automáticamente* en *Configuración › Proyecto › Configuración*, pestaña *Planificación*.

## Errores frecuentes y qué hace la aplicación

**Orden invertido.** Con *Vincular tareas seleccionadas* cuenta el orden en que hace clic, no el orden de la lista. Si hace clic primero en la tarea posterior, la relación queda al revés. Bórrela en *Relaciones* con el icono de papelera y añádala de nuevo.

**Escribir en la columna borra lo que había.** Si la celda contiene `3.4 FS; 3.2 FS` y escribe solo `3.2 FS`, la relación con 3.4 desaparece, sin ningún mensaje. Escriba todos los predecesores, use Intro o F2 para añadir a ellos, o deshaga con Ctrl+Z.

**Un ciclo.** Si añade una relación que vuelve a una tarea anterior de la cadena, la planificación nunca podría empezar. La aplicación rechaza esa relación: *Esta relación crearía un ciclo en la planificación (…) y no se ha creado*, con las tareas del ciclo entre paréntesis. Borre primero la relación que cierra el ciclo.

**Una tarea y su tarea de resumen.** No es posible una relación entre una tarea y la tarea de resumen en la que se encuentra. La aplicación indica *No se permite una relación entre una tarea y su propia tarea de resumen antecesora*.

**Duplicado.** Si la relación ya existe, la aplicación indica *Esa relación ya existe* y no cambia nada.

**Mensajes más cortos en la columna.** La columna *Predecesoras* muestra los mismos rechazos con un texto más corto debajo de la celda: *Este cambio crearía un ciclo en la planificación.*, *Esta relación ya existe.* o *Una tarea no puede tener una relación con su propia tarea de resumen.* Si escribe solo un número WBS, como `3.1`, falta el tipo y la celda indica *Use, por ejemplo, 1.2 FS+2d.* La celda sigue abierta; corrija la entrada o pulse Esc para cancelar.

**Ningún medio día de desfase.** Un desfase en días siempre es un número entero: `1.5` pasa a ser `+2d`, y un desfase en horas después de una tarea en días, en un calendario sin bandas de horario laboral propias, se redondea a días laborables completos. Una entrada ilegible, como una palabra, no se guarda: el campo vuelve al valor anterior.

## Véase también

- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): lo que la aplicación calcula a partir de sus relaciones y por qué una tarea se vuelve crítica.
- [Relaciones y desfase](docs://uitleg-relaties): lo que hacen los cuatro tipos de relación y un desfase con las fechas.
- [Trazar una ruta](docs://howto-pad-traceren): mostrar la cadena de predecesores y sucesores.
- [Diálogo de tarea y panel de propiedades](docs://ref-taak-eigenschappen): los campos de relaciones y desfase en el panel y en el diálogo.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): una cadena de relaciones fin-comienzo, una de comienzo-comienzo (paredes y tejado, desfase de 2 días) y una de fin-fin (alicatado y pintura, desfase de 1 día).
