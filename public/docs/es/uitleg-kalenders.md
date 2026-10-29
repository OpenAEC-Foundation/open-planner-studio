# Calendarios y días laborables

¿Cuántos días laborables dura una tarea, y en qué fecha termina? Eso depende del calendario en el que cuenta la aplicación. En este artículo usted lee qué es un calendario, cómo cuenta la aplicación los días laborables con él y qué calendario prevalece cuando intervienen varios. El ejemplo resuelto le ayuda a seguir los números.

## El concepto

Una planificación cuenta en **días laborables**, no en días naturales. «Cinco días de albañilería» significa cinco días en los que se trabaja. Un fin de semana o un festivo no cuenta. Por eso, una tarea de este tipo abarca más de cinco días naturales.

Qué días son días laborables se registra en un **calendario**. Un calendario fija tres cosas:

- La **semana laboral**: los días de la semana en los que se trabaja. De forma predeterminada es de lunes a viernes.
- Los **horarios laborales**: inicio, fin y pausa. Dan la **jornada laboral estándar**. De forma predeterminada son de 07:00 a 16:00 con una hora de pausa, así que 8 horas.
- Los **festivos**: días sueltos o varios días seguidos en los que no se trabaja, como el Día del Rey, Navidad o las vacaciones de construcción.

Un proyecto tiene un conjunto de calendarios. Uno de ellos es el **calendario del proyecto**. Se aplica a cada tarea que no tiene calendario propio. Usted asigna otro calendario a una tarea concreta, por ejemplo una semana laboral de seis días para un subcontratista que también trabaja los sábados. Un recurso también puede tener su propio calendario, pero eso funciona de otra manera (véase más abajo).

## Cómo calcula la aplicación

Este artículo describe el cálculo estándar: el perfil de cálculo *Open Planner Studio*, con el que calcula un proyecto nuevo.

### Contar días laborables

El primer día laborable de una tarea cuenta como día 1. Una tarea de 5 días, por tanto, termina el quinto día laborable. Si el comienzo cae en un día no laborable, la tarea empieza el siguiente día laborable. Un festivo o unas vacaciones de construcción en mitad de una tarea no cuentan: la tarea simplemente continúa a través de ellos y dura más días naturales.

Las horas por día no influyen en las fechas de una tarea en días. Solo cuentan la semana laboral y los festivos. Los horarios laborales solo entran en juego en una tarea en horas; eso se explica en [Días y horas](docs://uitleg-dagen-en-uren).

### Qué calendario prevalece

La aplicación elige un calendario por tarea:

1. Si la tarea tiene un calendario propio, la aplicación calcula esa tarea por completo en ese calendario: duración, fecha de fin y holgura.
2. Si no tiene ninguno, se aplica el calendario del proyecto. Si una tarea apunta a un calendario que ya no existe, también recurre al calendario del proyecto.

Una tarea de resumen (una fase) no tiene trabajo propio y, por tanto, tampoco calendario propio. Su duración se deduce de las fechas de sus tareas, y la aplicación la cuenta en el calendario del proyecto.

El calendario de un **recurso** no influye en las fechas. En una planificación que usted crea en la aplicación, solo determina cuándo está disponible el recurso: en el histograma, para la sobreasignación y en la nivelación.

### Tareas en calendarios distintos

Cuando se vinculan dos tareas con calendarios distintos, se aplica lo siguiente:

- Con una relación fin-comienzo, el sucesor empieza el primer día laborable después del fin del predecesor, contado en el calendario del **sucesor**. Si una tarea termina un viernes, un sucesor con una semana laboral de seis días empieza el sábado.
- De forma predeterminada, un **desfase** cuenta en el calendario del **predecesor**. Puede cambiarlo en *Configuración › Proyecto › Ajustes del proyecto*, en el bloque *Perfil de cálculo y opciones*, bajo *Opciones de cálculo de este proyecto*, con la opción *Calendario de retraso*: *Predecesora* (predeterminado), *Sucesora*, *24 horas* o *Calendario del proyecto*.
- La **holgura total** se cuenta en días laborables del calendario de la propia tarea. En este perfil, la **holgura libre** se cuenta en el calendario del sucesor.

Qué es exactamente un desfase se explica en [Añadir relaciones](docs://howto-relaties-leggen); qué es la holgura, en [Ruta crítica y holgura](docs://uitleg-kritiek-pad).

### En el diagrama de Gantt

El fondo gris del diagrama de Gantt muestra siempre los días no laborables del **calendario del proyecto**. Por eso, una tarea con un calendario propio puede cruzar un día gris, por ejemplo una tarea de seis días que cruza el sábado. Un bloque de festivos de tres días o más se muestra con su nombre, por ejemplo *Bouwvak (Noord)*. Eso no ocurre cuando *Mostrar solo días laborables* está activado. Si no quiere ver los días grises, active *Mostrar solo días laborables* en *Configuración › Proyecto › Configuración*, pestaña *Apariencia*, sección *Eje temporal*.

## Ejemplo resuelto: la planificación de obra

El ejemplo usa el calendario estándar *Bouwkalender NL*: de lunes a viernes, con los festivos públicos de los Países Bajos. Todas las tareas duran un número entero de días. En el tutorial sobre calendarios (tutorial 3) usted crea un calendario de este tipo por su cuenta.

### Fin de semana, festivo y vacaciones de construcción

*Brickwork* dura 5 días laborables y empieza el jueves 13 de mayo de 2027. El jueves 13 y el viernes 14 de mayo son el día 1 y el día 2. El fin de semana y el lunes de Pentecostés, 17 de mayo, no cuentan. El martes 18, el miércoles 19 y el jueves 20 de mayo son los días 3, 4 y 5. La tarea termina el **jueves 20 de mayo**: ocho días naturales para cinco días laborables.

Unas vacaciones de construcción aumentan la diferencia. Tome *Bouwvak (Noord)*, del 26 de julio al 13 de agosto de 2027 inclusive, y la misma tarea de 5 días laborables desde el viernes 23 de julio. El viernes 23 de julio es el día 1. Después, el calendario se detiene durante tres semanas. Del lunes 16 al jueves 19 de agosto son los días 2 a 5. El fin es el **jueves 19 de agosto**, 28 días naturales después del comienzo. Sin las vacaciones de construcción habría terminado el jueves 29 de julio.

### Una tarea en sábado

Tres tareas se suceden, todas con una relación fin-comienzo sin desfase: *Groundwork* (4 días), *Pour foundation* (3 días) y *Brickwork* (5 días). El proyecto empieza el lunes 24 de mayo de 2027.

Si las tres están en el calendario del proyecto, *Groundwork* va del lunes 24 al jueves 27 de mayo. *Pour foundation* va del viernes 28 de mayo al martes 1 de junio (viernes, lunes, martes). *Brickwork* va del miércoles 2 al martes 8 de junio. El proyecto termina el **martes 8 de junio**.

Asigne a *Pour foundation* el calendario *Six-day week* (de lunes a sábado) y el sábado cuenta. La tarea va del viernes 28 de mayo al **lunes 31 de mayo** (viernes, sábado, lunes). *Brickwork* se queda en el calendario del proyecto, empieza el martes 1 de junio y termina el **lunes 7 de junio**. Todo el proyecto dura un día menos, porque una tarea trabaja el sábado.

### Un desfase en dos calendarios

*Pour floor* (semana de seis días, 4 días) empieza el lunes 31 de mayo y termina el jueves 3 de junio. *Pointing* (calendario del proyecto, 3 días) sigue con un desfase de 2 días laborables. Sin el desfase, *Pointing* empezaría el viernes 4 de junio.

- De forma predeterminada, el desfase cuenta en el calendario del predecesor, la semana de seis días. Desde el viernes 4 de junio, el sábado 5 de junio es el primer día laborable y el lunes 7 de junio el segundo. *Pointing* empieza el **lunes 7 de junio** y termina el miércoles 9 de junio.
- Si configura *Calendario de retraso* en *Sucesora*, cuenta el calendario del proyecto. Entonces el sábado no cuenta: el lunes 7 de junio es el primer día laborable y el martes 8 de junio el segundo. *Pointing* empieza el **martes 8 de junio** y termina el jueves 10 de junio.

### Holgura en su propio calendario

*Brickwork* (5 días, calendario del proyecto) y *Crane hire* (3 días, semana de seis días) empiezan ambos el lunes 24 de mayo. Ambos son predecesores de *Fit window frames* (2 días, calendario del proyecto).

*Brickwork* termina el viernes 28 de mayo, así que *Fit window frames* empieza el lunes 31 de mayo. *Crane hire* ya ha terminado el miércoles 26 de mayo. La holgura total de *Crane hire* se cuenta en su propio calendario: jueves 27, viernes 28 y sábado 29 de mayo, así que **3 días laborables**. Si *Crane hire* estuviera en el calendario del proyecto, serían 2 días laborables. La holgura libre son 2 días laborables (jueves y viernes), porque la aplicación la cuenta en el calendario del sucesor.

### El calendario de un recurso

En otro proyecto de ejemplo, el recurso *Bricklaying crew* tiene el calendario *Crew Mon–Thu* (de lunes a jueves). Se asigna con 1 unidad por día a *Brickwork* (5 días, calendario del proyecto, del lunes 31 de mayo al viernes 4 de junio).

Las fechas de *Brickwork* no cambian. Pero el viernes 4 de junio aparece en rojo en el histograma, con el mensaje *No trabaja este día según el calendario «Crew Mon–Thu»*, y la cinta muestra un recurso en *Sobreasignación*. La nivelación no resuelve esto. Desplazar la tarea tampoco ayuda, porque cinco días laborables seguidos siempre incluyen un viernes. En la ventana *Nivelar recursos*, la tarea aparece por eso en *Conflictos restantes*, con el motivo *El recurso no trabaja todos los días que necesita esta tarea — desplazarla no resuelve esto.*

## Consecuencias y malentendidos

**«El calendario del recurso desplaza mis tareas».** No. Un calendario de recurso no cambia ninguna fecha; solo hace visible la sobreasignación. Si quiere que la propia tarea se ejecute en otros días, asigne a la tarea un calendario propio.

**«Si cambio el calendario del proyecto, todo se desplaza».** Solo se desplazan las tareas sin calendario propio. Una tarea a la que usted mismo asignó un calendario de la lista lo conserva, aunque resulte ser el antiguo calendario del proyecto. Si borra un calendario, las tareas y los recursos que lo usaban recurren al calendario del proyecto.

**«¿Los festivos ya están incluidos, verdad?»** Los festivos solo existen para los años para los que se crearon. Un día fuera de esos años es, sencillamente, un día laborable. En el cuadro de diálogo del calendario, la aplicación lo indica con *Los festivos cubren 2025–2028. ¿Desea volver a generar hasta 2030 inclusive?*

**«Más horas por día hacen mi tarea más corta».** No en una tarea en días: cuenta días laborables completos, tenga 6 u 8 horas. Solo en una tarea con recursos y con el tipo de tarea *Trabajo fijo* o *Unidades fijas* cambia la duración con ello.

**Un calendario sin días laborables** no puede calcularlo la aplicación. El cálculo indica *El calendario no tiene días laborables configurados*.

## Véase también

- [Días y horas](docs://uitleg-dagen-en-uren): cómo cuenta la aplicación los horarios de trabajo y qué pasa cuando se encuentran tareas en días y tareas horarias.
- [Crear y asignar un calendario](docs://howto-kalender-maken-en-toewijzen): los pasos para crear un calendario propio y asignarlo a tareas.
- [Generar festivos y las vacaciones de construcción](docs://howto-feestdagen-genereren): cómo rellenar los festivos de un país y las vacaciones de construcción.
- [Configurar un calendario de recurso](docs://howto-resourcekalender-instellen): registrar la disponibilidad de un recurso.
- [Ventanas de calendario](docs://ref-kalenders): todos los campos de las ventanas de calendario.
