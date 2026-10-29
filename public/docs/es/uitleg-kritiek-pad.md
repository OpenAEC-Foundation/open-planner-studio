# Ruta crítica y holgura

¿Por qué es así la fecha de fin de su proyecto? ¿Y qué tarea puede retrasarse un día sin mover la entrega? Estas preguntas están detrás de la ruta crítica. Este artículo explica con exactitud lo que calcula la aplicación, con un ejemplo práctico.

## El concepto

Una planificación es una red de tareas unidas por **relaciones**: acuerdos como «los marcos de las ventanas se instalan solo cuando el tejado está cerrado». Esas relaciones unen las tareas. Algunas cadenas de tareas son más largas que otras. La cadena más larga decide cuánto tarda todo el proyecto.

Esa cadena más larga es la **ruta crítica**. Si una tarea de ella se retrasa un día, la entrega se mueve un día. En ella no hay margen.

Las tareas fuera de la ruta crítica sí tienen margen. Ese margen se llama **holgura**. El albañil que construye la hoja exterior podría empezar dos días más tarde sin que nadie lo note. Esos dos días son la holgura de esa tarea.

Por tanto, crítico no dice nada sobre la importancia de una tarea. Solo dice que no hay tiempo de sobra.

El método de cálculo se llama **CPM** (Critical Path Method, método de la ruta crítica). Por eso el bloque con los resultados del panel *Propiedades* se llama *Resultado CPM*.

## Cómo calcula la aplicación

La aplicación no recalcula la planificación por sí sola. El cálculo empieza con **Calcular** (F5), por ejemplo a través de *Inicio › Programación › Calcular*. Si algo cambió desde el último cálculo, la barra de estado muestra *Desactualizado — recalcula (F5)*. Si *Calcular automáticamente* está activado (en *Configuración › Proyecto › Configuración*, pestaña *Planificación*, encabezado *Cálculo*), la aplicación lo hace sola.

Un cálculo recorre la red dos veces.

### Pasada hacia adelante

La aplicación empieza en el inicio del proyecto y sigue las relaciones de predecesor a sucesor. Para cada tarea, la aplicación busca el día más temprano en que la tarea puede empezar. Si una tarea tiene varios predecesores, espera a que termine el último. Así cada tarea obtiene su **inicio temprano** y su **fin temprano**. El fin temprano más tardío de todas las tareas es la fecha de fin del proyecto.

### Pasada hacia atrás

Después, la aplicación recorre la red hacia atrás, desde esa fecha de fin hasta el inicio. Ahora busca, para cada tarea, el último día en que debe terminar sin mover la fecha de fin. Si una tarea tiene varios sucesores, cuenta el que debe empezar primero. Así se obtienen el **inicio tardío** y el **fin tardío**.

### Holgura total y holgura libre

La diferencia entre las fechas tardías y las tempranas de una tarea es su **holgura total**: el número de días laborables que la tarea puede retrasarse o empezar más tarde antes de que se mueva la fecha de fin del proyecto. La aplicación cuenta en días laborables del calendario de la tarea. Un fin de semana o un festivo no cuenta.

La **holgura libre** es más estricta. Es el margen que tiene una tarea antes de que un sucesor tenga que empezar más tarde. Ese margen puede usarlo sin que otra tarea lo note.

La holgura total puede compartirse. Si dos tareas no críticas siguen una a otra, comparten el mismo margen. Si la primera lo gasta, a la segunda no le queda nada. La primera tiene entonces holgura total, pero no holgura libre. La parte de la holgura total que no es libre se llama **holgura interferente**: si la utiliza, las tareas posteriores también se mueven. El ejemplo de abajo lo muestra con números.

### Holgura negativa

La holgura también puede ser negativa. Eso pasa cuando una tarea tiene una fecha límite, o una restricción que fija la fecha más tardía posible, que cae antes de la fecha que calcula la aplicación para esa tarea. Sobre el papel, la tarea ya va con retraso. La tarea y la cadena anterior a ella se vuelven críticas.

### ¿Cuándo es crítica una tarea?

De forma predeterminada, una tarea es crítica cuando su holgura total es 0 o menor. Puede cambiarlo en *Configuración › Proyecto › Ajustes del proyecto*, en el bloque *Perfil de cálculo y opciones*, en *Opciones de cálculo de este proyecto*. Cuando pulse *Aplicar*, la aplicación recalcula la planificación de inmediato. Las opciones pertenecen al archivo del proyecto, no a la aplicación.

- **Definición de crítica** con *Holgura total ≤ umbral* y el campo *Umbral (días laborables)*. El umbral es 0 de forma predeterminada. Para proteger un margen de seguridad, póngalo en 2, por ejemplo: toda tarea con 2 días laborables de holgura o menos cuenta como crítica y se muestra en rojo. Si elige *Ruta más larga*, una tarea es crítica cuando está en la cadena más larga hasta el último fin. Su holgura no importa entonces.
- **Varias rutas de holgura** numera las cadenas según su holgura, en la columna *Ruta de holgura*. La ruta 1 es la ruta crítica. Véase [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies).
- **Marcar casi crítico** con su propio *Umbral*, 2 días laborables de forma predeterminada. Una tarea con más de 0 y como máximo esa holgura recibe una barra ámbar. Así se ven las tareas que casi no tienen margen, sin llamarlas críticas.
- **Tareas de extremo abierto críticas**: una tarea sin sucesor que aún no está terminada cuenta como crítica. Es útil como red de seguridad contra relaciones olvidadas (véanse los malentendidos más abajo).
- **Cálculo de la holgura** decide si la holgura total se mide al inicio de la tarea, al final o como la menor de las dos. Los proyectos nuevos tienen *Automático (predeterminado)*. Si el proyecto usa el perfil Primavera P6 y esta opción no es *Holgura de fin*, un bloque naranja en Ajustes del proyecto lo indica; su botón pone la opción en *Holgura de fin*. Para MS Project, el mismo botón la devuelve a *Automático (predeterminado)*: con una fecha de estado, MS Project calcula así por sí mismo.

### Dónde se ve

Las tareas críticas tienen una barra roja en el Gantt. Detrás de una barra no crítica hay una banda verde hasta el fin tardío de la tarea: esa es la holgura. La banda se activa o desactiva en *Vista › Líneas base y progreso › Banda de holgura*.

Para una tarea seleccionada, el panel *Propiedades* muestra todo bajo *Resultado CPM*: inicio y fin tempranos y tardíos, holgura total, libre e interferente, y si la tarea está en la ruta crítica. La holgura de todas las tareas, una al lado de otra, está en las columnas bajo *Calculado* (el **+** a la derecha del encabezado de la tabla), como *Holgura total*, *Holgura libre*, *Crítica* y *Casi crítica*.

La barra de estado, abajo, cuenta las tareas críticas, por ejemplo *Ruta crítica: 21 tareas, 45 días laborables*.

## Ejemplo práctico: la ampliación de la casa

El ejemplo es el proyecto práctico de los tutoriales, *House extension*, tal como queda cuando todas las relaciones están definidas. En el tutorial 2, «Relaciones y ruta crítica», usted construye el proyecto y comprueba los números. Aquí se explica por qué los números son los que son.

*House extension* empieza el lunes 7 de junio de 2027. Tras el cálculo, la entrega es el viernes 6 de agosto de 2027 y la barra de estado indica *Ruta crítica: 21 tareas, 45 días laborables*. Dos tareas no son críticas: *Build outer cavity leaf* y *Painting*.

### Dos cadenas que se unen

Después del forjado estructural (*Lay hollow-core floor*, terminado el lunes 28 de junio), la obra se divide en dos cadenas. Las dos terminan en *Install window frames*:

- El interior: *Build inner cavity leaf* (5 días laborables), después *Place roof elements* (1), después *Apply roofing* (2). Los marcos de las ventanas solo pueden colocarse cuando el tejado está cerrado.
- El exterior: *Build outer cavity leaf* (6 días laborables). Los marcos están en la fachada, así que también esa tarea debe estar terminada.

**Hacia adelante.** Las dos hojas de la cavidad pueden empezar el martes 29 de junio. La hoja interior termina el lunes 5 de julio. Los elementos de cubierta se colocan el martes 6 de julio, y el tejado sigue el miércoles 7 y el jueves 8 de julio. La hoja exterior termina el martes 6 de julio. *Install window frames* espera a la cadena más tardía, el tejado, y por eso empieza el viernes 9 de julio.

**Hacia atrás.** Los marcos deben empezar como muy tarde el viernes 9 de julio, o la entrega se mueve. Por tanto, la hoja exterior debe terminar como muy tarde el jueves 8 de julio. Seis días laborables hacia atrás dan un inicio tardío el jueves 1 de julio.

**Holgura.** La hoja exterior puede empezar el 29 de junio como pronto y debe empezar el 1 de julio como muy tarde. Entre ambas fechas hay 2 días laborables: el miércoles 30 de junio y el jueves 1 de julio. Esa es su holgura total; el panel muestra *Holgura total: 2 días* y *Ruta crítica: No*. La holgura libre también es de 2 días, porque su único sucesor, *Install window frames*, está en la ruta crítica.

La cadena interior no tiene holgura. Cada día de retraso allí mueve los marcos y todo lo que viene después.

### Painting

*Painting* (3 días laborables) empieza después del enlucido, el lunes 26 de julio, y termina el miércoles 28 de julio. La tarea siguiente, *Snagging and cleaning*, también espera al alicatado. Este solo termina el jueves 5 de agosto, porque el mortero de la solera tiene que secar cinco días laborables antes. Así, *Painting* puede durar hasta el jueves 5 de agosto. Eso da 6 días laborables de holgura: 29 y 30 de julio, y del 2 al 5 de agosto. También aquí la holgura libre es igual a la total, porque el sucesor es crítico.

### Cuando la hoja exterior se retrasa

Si la hoja exterior tarda 8 días laborables en vez de 6, termina el jueves 8 de julio: justo su fin tardío. La holgura desaparece y la tarea se muestra en rojo. Entonces las dos cadenas son críticas y la barra de estado cuenta 22 tareas críticas. La entrega sigue siendo el viernes 6 de agosto.

Si tarda 9 días laborables, la hoja exterior solo termina el viernes 9 de julio. Los marcos se mueven al lunes 12 de julio y la entrega al lunes 9 de agosto: un día laborable más tarde. La cadena exterior es ahora la ruta crítica; la barra de estado indica *Ruta crítica: 19 tareas, 46 días laborables*.

La cadena interior tiene entonces 1 día laborable de holgura total, pero ese día se comparte:

- *Build inner cavity leaf*: holgura total 1, holgura libre 0, holgura interferente 1. Si la hoja interior se retrasa un día, los elementos de cubierta se mueven con ella.
- *Place roof elements*: holgura total 1, holgura libre 0, holgura interferente 1.
- *Apply roofing*: holgura total 1, holgura libre 1. Solo aquí un día de retraso no perjudica a nadie.

Es el mismo único día, compartido por toda la cadena. Si la hoja interior lo usa, ya no queda para los elementos de cubierta ni para el tejado.

### Casi crítica y holgura negativa

Con *Marcar casi crítico* activado en el umbral predeterminado de 2 días laborables, la hoja exterior, con exactamente 2 días de holgura, recibe una barra ámbar. *Painting*, con 6 días, sigue en azul.

Si la entrega recibe una fecha límite el miércoles 4 de agosto, dos días laborables antes de la entrega calculada, la holgura se vuelve negativa. Las 21 tareas de la ruta crítica quedan con una holgura total de −2 días laborables. La hoja exterior ya no tiene holgura y también se vuelve crítica; *Painting* conserva 4 días laborables.

## Consecuencias e ideas erróneas

**«Crítico significa importante».** No. Una inspección puede ser muy importante y aun así tener holgura. Al revés, una tarea sencilla puede ser crítica: en el ejemplo, *Snagging and cleaning* está en la ruta crítica. Crítico solo se refiere al tiempo: no queda margen.

**«Esta tarea tiene holgura, así que puede esperar».** Mire primero la holgura libre. Si una tarea tiene holgura total pero no holgura libre, cada día de retraso quita margen a las tareas siguientes, como con la hoja interior en el caso de 9 días laborables.

**Una relación olvidada da holgura falsa.** Una tarea sin sucesor obtiene holgura hasta el final del proyecto. Si al ejemplo le faltara la relación de la hoja exterior a los marcos, la hoja exterior tendría de repente 23 días laborables de holgura, hasta la entrega del 6 de agosto. Sobre el papel podría retrasarse semanas sin que los marcos esperen. Con *Tareas de extremo abierto críticas* activado, la hoja exterior se vuelve crítica en ese caso y el hueco queda a la vista.

**La ruta crítica no es fija.** Si una tarea no crítica se retrasa más que su holgura, otra cadena pasa a ser la más larga. Usted lo vio arriba, con 9 días laborables de albañilería. Por eso la planificación se debe recalcular después de cada cambio. Mientras la barra de estado diga *Desactualizado — recalcula (F5)*, las barras rojas siguen perteneciendo al cálculo anterior.

**La holgura cuenta en días laborables.** La holgura total de *Painting*, 6 días laborables, va del jueves 29 de julio al jueves 5 de agosto: ocho días en el calendario, porque el fin de semana no cuenta. Un festivo o unas vacaciones de construcción en el calendario tampoco cuentan.

## Véase también

- [Añadir relaciones](docs://howto-relaties-leggen): los pasos para vincular tareas y definir un desfase.
- [Relaciones y desfase](docs://uitleg-relaties): cómo las relaciones y el desfase determinan las fechas tempranas.
- [Restricciones y fechas límite](docs://uitleg-constraints): cómo una restricción o una fecha límite produce holgura negativa.
- [Trazar una ruta](docs://howto-pad-traceren): seguir la cadena detrás de una tarea.
- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): la definición de crítica, casi crítica y el cálculo de la holgura, opción por opción.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): un proyecto grande con varias rutas de holgura, tareas casi críticas (umbral de 3 días laborables), una hamaca, una fecha fija y una relación externa.
