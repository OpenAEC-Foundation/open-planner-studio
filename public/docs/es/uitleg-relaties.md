# Relaciones y desfase

¿Por qué la mampostería solo empieza cuando la cimentación está terminada? ¿Y por qué la colocación de la cubierta se retrasa una semana cuando los elementos de cubierta llegan tarde? Eso depende de las relaciones entre sus tareas. En este artículo usted verá qué cuatro tipos de relaciones conoce la aplicación, qué hacen el desfase y el adelanto, en qué calendario cuenta un desfase, qué pasa con una relación en una fase y cómo decide la aplicación qué relación determina la fecha de comienzo de una tarea.

Las reglas y los ejemplos se aplican a un proyecto nuevo, con el perfil de cálculo *Open Planner Studio* y una semana laborable de lunes a viernes.

## El concepto

Una **relación** registra que dos tareas dependen una de otra. La primera tarea es el **predecesor**, la segunda el **sucesor**. Una relación es un límite inferior: el sucesor nunca puede comenzar ni terminar antes de lo que permite la relación, pero sí puede comenzar o terminar más tarde. Si una tarea tiene varios predecesores, espera a la fecha más tardía que resulta de todas esas relaciones.

Hay cuatro tipos. Se diferencian en qué momento del predecesor (comienzo o fin) se vincula con qué momento del sucesor:

- **FS (fin-comienzo).** El sucesor solo puede comenzar cuando el predecesor ha terminado. Los elementos de cubierta se colocan solo cuando los muros están levantados. Este es, con diferencia, el tipo más usado.
- **SS (comienzo-comienzo).** El sucesor solo puede comenzar cuando el predecesor ya ha comenzado. Las tareas pueden solaparse: la instalación de tuberías puede comenzar en cuanto la mampostería esté en marcha.
- **FF (fin-fin).** El sucesor solo puede terminar cuando el predecesor ha terminado. El rejuntado no puede hacerse antes de que la mampostería esté terminada, pero sí puede empezar antes.
- **SF (comienzo-fin).** El sucesor solo puede terminar cuando el predecesor ha comenzado. Este tipo es poco frecuente. Un ejemplo: el achique temporal solo puede detenerse cuando la mampostería de la cimentación ha comenzado.

Una relación también puede tener un **desfase**: tiempo de espera entre las dos tareas, como el hormigón que tiene que curar. Un desfase negativo se llama **adelanto**: el sucesor comienza entonces antes de que termine el predecesor, de modo que las tareas se solapan.

## Cómo calcula la aplicación

### Los cuatro tipos

Para cada relación, la aplicación calcula la fecha más temprana en la que puede comenzar el sucesor, y toma la más tardía de todas las relaciones de una tarea. Sin desfase funciona así:

- Con FS el sucesor comienza el primer día laborable después del fin del predecesor.
- Con SS el sucesor comienza el mismo día que el predecesor.
- Con FF el sucesor termina el mismo día que el predecesor. Para encontrar el comienzo, la aplicación cuenta hacia atrás a partir de la duración del sucesor. Un sucesor de 3 días laborables, por lo tanto, comienza 2 días laborables antes del fin del predecesor.
- Con SF el sucesor termina el día en que comienza el predecesor. También aquí la aplicación cuenta hacia atrás a partir de la duración del sucesor.

Estos son límites inferiores. Un sucesor comienza más tarde si otra relación o una restricción lo exige. Todas las fechas solo aparecen después de **Calcular** (F5). Mientras la barra de estado muestre *Desactualizado — recalcula (F5)*, las barras pertenecen al cálculo anterior.

### Desfase y adelanto

Un desfase se puede expresar de cuatro maneras:

- En **días laborables** (`3` o `3d`): la aplicación omite los días no laborables y los fines de semana. Es el valor predeterminado.
- En **días naturales** (`3ed`; la *e* significa *elapsed*, es decir, tiempo transcurrido): cuentan todos los días, incluidos el sábado y el domingo. Es la unidad para algo que sigue su curso sin que se trabaje, como el curado.
- Como **porcentaje** de la duración del predecesor (`40%`): la aplicación lo recalcula en cada cálculo y redondea a días enteros (2,5 días se convierte en 3).
- En **horarios de trabajo** (`4h`): la aplicación cuenta el desfase en el calendario de retraso, de forma predeterminada, el del predecesor. Si el predecesor es una tarea en días en un calendario sin bandas de horario laboral propias, como el calendario estándar, la aplicación convierte las horas en días laborables enteros, redondeando al día más cercano (medio día se redondea hacia arriba). Con un día laborable de 8 horas, `2h` y `3h` dan, por lo tanto, 0 días; desde `4h` hasta `11h` inclusive dan 1 día, y `12h` da 2 días. Si ese calendario tiene bandas de horario laboral propias, o si el predecesor es una tarea horaria, el desfase cuenta exactamente en horarios de trabajo.

La regla para un desfase de N días laborables con FS: los N días laborables después del fin del predecesor son tiempo de espera, y el sucesor comienza el día laborable siguiente a ese. Con SS y FF el desfase se suma al comienzo y al fin del predecesor, respectivamente. Un desfase negativo cuenta hacia atrás: un adelanto de 1 día laborable con FS permite que el sucesor comience el día en que termina el predecesor.

Un adelanto no puede situar una tarea antes del inicio del proyecto. Si eso ocurriera, la aplicación mantiene el sucesor en el inicio del proyecto y lo indica en el panel *Advertencias*: *Adelanto truncado por el inicio del proyecto — la relación no se respeta por completo*.

### En qué calendario cuenta el desfase

Cada tarea puede tener su propio calendario. Con un desfase en días laborables importa qué calendario cuenta los días laborables. El ajuste *Calendario de retraso* decide eso, con cuatro opciones: *Predecesora*, *Sucesora*, *24 horas* y *Calendario del proyecto*. De forma predeterminada, el desfase cuenta en el calendario del **predecesor**. Encontrará el ajuste en *Configuración › Proyecto › Ajustes del proyecto*, en el bloque *Perfil de cálculo y opciones*, en *Opciones de cálculo de este proyecto*. La elección pertenece al archivo del proyecto y solo cuenta después de pulsar *Aplicar*; la planificación se recalcula entonces.

Un desfase en días naturales (`3ed`) cuenta siempre todos los días, sea cual sea el *Calendario de retraso* que elija.

### Relaciones en tareas de resumen

Puede poner una relación en una fase (una tarea de resumen) en lugar de en una tarea dentro de ella. Internamente la aplicación pone esa relación en cada tarea de la fase:

- Una fase como **predecesor** con FS o FF: el sucesor espera hasta que termina la última tarea de la fase en acabar.
- Una fase como **sucesor** con FS o SS: cada tarea de la fase espera al predecesor, independientemente de las demás tareas de la fase.
- Una fase como **predecesor** con SS o SF: el sucesor espera al comienzo de la tarea de la fase que **comienza más tarde**, no al comienzo de la fase en sí. Eso es más prudente de lo que quizá espera: el sucesor nunca comienza demasiado pronto, pero sí quizá más tarde de lo que quiere. Si quiere que el sucesor siga el comienzo de la fase, ponga la relación en la primera tarea de la fase.
- Una fase como **sucesor** con FF o SF: cada tarea de la fase tiene que cumplir por sí misma la exigencia de fin (con FF, terminar en la fecha del fin del predecesor o después; con SF, en la fecha del comienzo del predecesor o después), incluso una tarea que podría haberse hecho mucho antes. Es mejor poner esa relación en la última tarea de la fase.

Una relación entre una tarea y la fase a la que pertenece no está permitida.

### Relaciones determinantes

Si un sucesor tiene varios predecesores, normalmente una sola relación determina su fecha de comienzo: la relación que impide que el sucesor comience un solo día antes de lo que comienza ahora. Esa relación se llama **relación determinante**. En caso de empate hay varias relaciones determinantes. Usted reconoce una relación determinante por el símbolo de rayo en las columnas *Predecesoras* y *Sucesoras* de la tabla, por la columna *Determinante* (el **+** a la derecha del encabezado de la tabla, bajo *Relaciones*) y por el tono más intenso cuando traza una ruta. Cómo abrir esa ruta está en [Trazar una ruta](docs://howto-pad-traceren).

Una relación determinante dice algo sobre las fechas, no sobre la duración. Un predecesor corto también puede ser determinante, por ejemplo por un desfase largo; usted lo ve en el ejemplo de abajo.

## Ejemplo resuelto

Los ejemplos usan proyectos pequeños separados, todos con comienzo el lunes 7 de junio de 2027, salvo que se indique otra cosa. Términos como ruta crítica y holgura se explican en [Ruta crítica y holgura](docs://uitleg-kritiek-pad). Construir una red de relaciones usted mismo y comprobarla es lo que hace en el tutorial 2, «Relations and the critical path».

### Los cuatro tipos uno al lado de otro

*Pour foundation* dura 5 días laborables: del lunes 7 al viernes 11 de junio. *Build walls* (5 días laborables) sigue con FS y va del lunes 14 al viernes 18 de junio. Cuatro tareas de 3 días laborables cada una dependen de *Build walls*, cada una con un tipo distinto:

- *Place roof elements* (FS) empieza el lunes 21 de junio, el primer día laborable después de la mampostería, y termina el miércoles 23 de junio.
- *Pipework* (SS) empieza el lunes 14 de junio, a la vez que la mampostería, y termina el miércoles 16 de junio.
- *Pointing* (FF) tiene que terminar el viernes 18 de junio, a la vez que la mampostería. Con 3 días laborables, por lo tanto, empieza el miércoles 16 de junio.
- *Dewatering* (SF) tiene que terminar el lunes 14 de junio, el día en que empieza la mampostería. Al contar hacia atrás 3 días laborables (jueves 10, viernes 11 y lunes 14 de junio), el comienzo es el jueves 10 de junio.

Solo *Place roof elements* está en la ruta crítica; el proyecto termina el miércoles 23 de junio. *Pipework*, *Pointing* y *Dewatering* tienen, respectivamente, 5, 3 y 7 días laborables de holgura.

### Desfase y adelanto en cifras

*Pour foundation* termina el viernes 18 de junio. *Build walls* (2 días laborables) sigue con FS. Esto es lo que hace el desfase con la fecha de comienzo:

- Sin desfase, la mampostería empieza el lunes 21 de junio.
- Con desfase `3` (tres días laborables), el lunes 21, el martes 22 y el miércoles 23 de junio son tiempo de espera; la mampostería empieza el jueves 24 de junio.
- Con desfase `3ed` (tres días naturales), cuentan el sábado, el domingo y el lunes; la mampostería empieza el martes 22 de junio.
- Con desfase `-1` (un adelanto de un día laborable), la mampostería empieza el viernes 18 de junio, el día en que termina el colado.
- Con desfase `40%`, el desfase es el 40% de 5 días laborables, es decir, 2 días laborables; la mampostería empieza el miércoles 23 de junio.
- Con desfase `50%`, el desfase es 2,5 días laborables, redondeado a 3 días laborables; la mampostería empieza el jueves 24 de junio.

### Qué calendario cuenta el desfase

*Build walls* (4 días laborables) está en el calendario del proyecto (lunes a viernes) y termina el jueves 10 de junio. *Pointing* (2 días laborables) sigue con FS y desfase `3`, y está en un calendario en el que el sábado y el domingo también son días laborables. Entonces la fecha de comienzo depende de *Calendario de retraso*:

- *Predecesora* (predeterminado): el desfase cuenta en el calendario de la mampostería. El viernes 11, el lunes 14 y el martes 15 de junio son tiempo de espera; *Pointing* empieza el miércoles 16 de junio.
- *Sucesora*: el desfase cuenta en el calendario de *Pointing*. El viernes 11, el sábado 12 y el domingo 13 de junio son tiempo de espera; *Pointing* empieza el lunes 14 de junio.
- *24 horas*: cuentan todos los días naturales. También aquí el viernes, el sábado y el domingo son tiempo de espera; *Pointing* empieza el lunes 14 de junio.
- *Calendario del proyecto*: el desfase cuenta en el calendario del proyecto, igual que con *Predecesora*; *Pointing* empieza el miércoles 16 de junio.

### Relaciones en una fase

*Foundation* es una fase con dos tareas: *Excavate* (2 días laborables, lunes 7 y martes 8 de junio) y después *Pour* (3 días laborables, del miércoles 9 al viernes 11 de junio). *Build walls* sigue a la fase *Foundation* con FS y empieza el lunes 14 de junio: la aplicación hace que espere a *Pour*, la última tarea en terminar.

Con una fase como sucesor: *Permit* (3 días laborables, termina el miércoles 9 de junio) va con FS a la fase *Estructura*. La fase contiene *Build walls* (4 días laborables) y después *Lay floor* (2 días laborables). Cada tarea de la fase espera a *Permit*: *Build walls* empieza el jueves 10 de junio y termina el martes 15 de junio. *Lay floor* también espera a la mampostería y va del miércoles 16 al jueves 17 de junio.

Con SS desde una fase: la fase *Finishing* contiene *Plastering* (2 días laborables, 7 y 8 de junio), después *Painting* (3 días laborables, del 9 al 11 de junio) y después *Snagging* (2 días laborables, 14 y 15 de junio). *Cleaning* sigue a la fase con SS. Usted esperaría un comienzo el lunes 7 de junio, pero la aplicación hace que *Cleaning* espere al comienzo de *Snagging*, la tarea que comienza más tarde: lunes 14 de junio.

### Qué es determinante

*Pour foundation* (2 días laborables) va del lunes 7 al martes 8 de junio. Siguen dos ramas:

- *Build walls* (5 días laborables): del miércoles 9 al martes 15 de junio.
- *Order roof elements* (2 días laborables): el miércoles 9 y el jueves 10 de junio.

*Place roof elements* (3 días laborables) depende de ambas: con FS después de la mampostería, y con FS y desfase `5` después del pedido (el plazo de entrega). Desde la mampostería, la colocación podría empezar el miércoles 16 de junio. Desde el pedido, el viernes 11, el lunes 14, el martes 15, el miércoles 16 y el jueves 17 de junio son tiempo de espera; la colocación empieza el viernes 18 de junio. La relación con el pedido es, por lo tanto, una relación determinante, aunque el pedido es mucho más corto que la mampostería. La mampostería tiene 2 días laborables de holgura.

## Consecuencias y malentendidos

**«Una relación fija las tareas.»** No, una relación es un límite inferior. Un sucesor comienza como muy pronto en la fecha que da la relación, y más tarde si otra relación o una restricción lo pide. Cómo encajan las restricciones se explica en [Restricciones y fechas límite](docs://uitleg-constraints).

**«SS significa que las tareas comienzan a la vez.»** SS solo dice que el sucesor no puede comenzar antes que el predecesor. Si el sucesor tiene otro predecesor que termina más tarde, comienza más tarde.

**«Con FF el sucesor comienza el mismo día.»** No, con FF coinciden las fechas de fin. Un sucesor corto, por lo tanto, comienza más tarde que el predecesor, como *Pointing* en el ejemplo.

**«Un desfase en días cuenta días naturales.»** De forma predeterminada, un desfase cuenta días laborables, en el calendario del predecesor. Para el curado o el secado, cuando también cuenta el fin de semana, se usan días naturales (`ed`).

**«Una tarea sin relaciones no supone ningún problema.»** Una tarea sin predecesor comienza en su fecha de inicio planificada, y una tarea sin sucesor obtiene holgura hasta el fin del proyecto. Si olvida una relación, una tarea parece por lo tanto tener mucho margen; vea los malentendidos en [Ruta crítica y holgura](docs://uitleg-kritiek-pad).

**«Una relación en una fase es una sola relación.»** Para el cálculo es una relación por cada tarea de la fase. Si mueve tareas dentro o fuera de una fase, cambian también las relaciones que se aplican a esas tareas.

## Ver también

- [Añadir relaciones](docs://howto-relaties-leggen): los pasos para vincular tareas y definir un desfase.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): lo que la aplicación calcula a partir de sus relaciones, y por qué una tarea se vuelve crítica.
- [Restricciones y fechas límite](docs://uitleg-constraints): acuerdos de fecha junto a las relaciones.
- [Trazar una ruta](docs://howto-pad-traceren): hacer visible la cadena antes o después de una tarea.
- [Crear una hamaca](docs://howto-hammock): una tarea con duración calculada, colgada de relaciones de tipo SS y FF.
- [Relaciones externas con otro proyecto](docs://howto-externe-relaties): relaciones con una tarea de otro archivo de proyecto.
