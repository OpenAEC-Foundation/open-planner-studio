# Resolver la sobreasignación

Objetivo: ver en qué día un recurso tiene demasiado trabajo y resolverlo, normalmente nivelando tareas.

## Cuándo lo necesita

Sobre el papel, su planificación funciona, pero el albañil está asignado a dos muros que se ejecutan en los mismos días. La aplicación llama a eso **sobreasignación**. Un recurso está sobreasignado en un día laborable si la planificación le exige ese día más que su capacidad (*Unidades máx*), o si ese día no trabaja según su calendario.

Primero consulte la sobreasignación. Después elija una solución. **Nivelación** es la solución que la aplicación calcula por usted: hace que las tareas empiecen más tarde hasta que el recurso pueda asumirlo. Consulte cómo se calcula en [Nivelación de recursos](docs://uitleg-nivelleren).

## Pasos

### 1. Busque la sobreasignación

1. Mire en la cinta *Recursos › Sobreasignación*. Dice *Ninguna* o, en rojo, el número de recursos sobreasignados, por ejemplo *1 recurso*. Tras un cálculo, la barra de estado también dice *⚠ 1 recurso(s) sobreasignado(s)*.
2. Haga clic en ese mensaje de la barra de estado. Se abre el panel *Advertencias* a la derecha, con una línea por cada recurso, por ejemplo *Bricklayer* con *Sobreasignado durante 5 día(s) (29-06-2027 – 05-07-2027)*.
3. Haga clic en esa línea. La aplicación activa el histograma, elige el recurso y selecciona todas las tareas en las que participa el recurso.
4. Mire el histograma debajo del Gantt. Las barras rojas son días sobreasignados. Si pasa el ratón sobre un día, ve qué tareas contribuyen, por ejemplo *2 tareas contribuyen el 2027-06-30* con los nombres debajo.

También puede activar el histograma usted mismo con *Recursos › Histograma › Histograma*. Elija un recurso de la lista de la izquierda, o recorra los recursos con *Anterior* y *Siguiente*. Un punto rojo en la lista significa que ese recurso está sobreasignado. La fila *Todos los recursos* suma los recursos, sin materiales.

Si hay una tarea seleccionada, el histograma muestra solo la carga de esa tarea y solo los recursos que participan en ella. Pulse Esc para quitar la selección y ver el proyecto completo otra vez.

### 2. Elija una solución

- **Más capacidad.** Si de verdad llega un segundo albañil, ponga *Unidades máx* en 2 (véase [Gestionar recursos](docs://howto-resources-beheren)). Así desaparece la sobreasignación.
- **Menos unidades por día.** Baje las *Unidades* o elija otra curva para la asignación (véase [Asignar recursos con una curva](docs://howto-resource-toewijzen)).
- **Tareas una detrás de otra.** Añada una relación entre las dos tareas, para que la segunda empiece solo cuando la primera termine (véase [Añadir relaciones](docs://howto-relaties-leggen)).
- **Nivelación.** La aplicación hace que una tarea empiece más tarde.

### 3. Nivelación

1. Compruebe que la planificación se haya calculado con **Calcular** (F5), por ejemplo mediante *Inicio › Programación › Calcular*.
2. Elija *Recursos › Nivelación › Nivelar…*. Se abre la ventana *Nivelar recursos*.
3. Decida si la fecha de fin del proyecto puede cambiar. Si deja la casilla *Nivelar solo dentro de la holgura (suavizado) — la fecha de fin del proyecto no cambia* desmarcada, la fecha de fin puede desplazarse. Si la marca, la aplicación solo mueve las tareas dentro de su holgura.
4. En *Recursos* están los recursos que se van a nivelar. De forma predeterminada están marcados todos los recursos, excepto los materiales. Desmarque el recurso que quiera dejar como está.
5. Haga clic en *Calcular*. Mientras calcula, la ventana muestra *Calculando…* y puede pulsar *Detener*. La planificación todavía no cambia: esto es una propuesta.
6. Lea la propuesta. Arriba está la fecha de fin, por ejemplo *Fecha de fin del proyecto: sin cambios (30-08-2027)* o *Fecha de fin del proyecto: 25-08-2027 → 30-08-2027*. Debajo hay una tabla con, para cada tarea, el *Inicio anterior*, el *Nuevo inicio* y los *Días desplazados*, por ejemplo *Build outer cavity leaf*, 29-06-2027, 06-07-2027 y *5 d*.
7. Elija *Aplicar*. La aplicación escribe los retrasos en las tareas y recalcula la planificación de inmediato. No hace falta pulsar F5. *Cancelar* cierra la ventana sin cambios.
8. Compruebe *Recursos › Sobreasignación*. Ahora dice *Ninguna*.

Si cambia una opción de la ventana después de hacer clic en *Calcular*, la propuesta desaparece. Entonces haga clic en *Calcular* otra vez. Si la planificación cambia mientras la aplicación calcula, muestra *La planificación cambió durante el cálculo. Vuelva a hacer clic en Calcular.*

### Decidir qué tarea se mantiene

La aplicación coloca las tareas una a una, y las tareas que van primero se quedan donde están. Las tareas con la prioridad más alta van primero. Con la misma prioridad, va primero la tarea con menos holgura.

Si quiere decidir usted mismo qué tarea se queda donde está, dé a la tarea una prioridad más alta. Haga clic con el botón derecho en la barra de la tarea en el Gantt y elija *Prioridad* y luego *Baja* (100), *Normal* (500) o *Alta* (900). *Normal* es el valor predeterminado. También puede escribir usted mismo un número de 0 a 1000 en la columna *Prioridad de nivelación*: haga clic en el **+** a la derecha del encabezado de la tabla de tareas (*Añadir columna*) y elija esa columna en el grupo *Planificación*. Un número más alto significa que es más probable que la tarea se quede donde está. La aplicación no acepta un número mayor que 1000. Una tarea con prioridad 1000 nunca se desplaza por capacidad.

### Deshacer y rehacer

- *Deshacer* (Ctrl+Z) anula *Aplicar* en un solo paso.
- *Recursos › Nivelación › Borrar nivelación* quita toda la nivelación de las tareas. El botón está gris mientras no haya nivelación. La sobreasignación que reaparece de este modo vuelve a estar presente, sin más.
- Si ha cambiado la planificación desde entonces, basta con volver a elegir *Nivelar…*. La aplicación empieza entonces desde cero: los retrasos anteriores no cuentan.

## Problemas habituales y qué hace entonces la aplicación

**Aún sin calcular.** Si la planificación no se ha calculado, la ventana muestra *Calcula primero la planificación (F5) antes de nivelar.* y *Calcular* no está disponible.

**Conflictos restantes.** No todas las sobreasignaciones se pueden resolver desplazando tareas. Las tareas que quedan aparecen en la lista *Conflictos restantes*, con el número de días y el motivo:

- *No hay suficiente capacidad libre dentro de la holgura para resolver este conflicto.* Lo ve con el *suavizado*: dentro de la holgura de la tarea no hay ningún momento libre. Desmarque la casilla y la fecha de fin puede cambiar.
- *El recurso no trabaja todos los días que necesita esta tarea — desplazarla no resuelve esto.* El recurso tiene días libres en su propio calendario en mitad de la tarea. Cambie el calendario o la tarea.
- *Bricklayer alcanza un pico de 2 unidades/día, la capacidad es 1 — no se puede resolver desplazando.* Según su curva, la tarea sola pide más en un día de lo que el recurso puede aportar. Elija otra curva o reduzca las unidades.

**El mensaje dice** *Ninguna tarea necesita moverse — la planificación ya está libre de conflictos.* Si esa línea aparece junto con la lista *Conflictos restantes* en la propuesta, fíese de la lista. La línea solo indica que no hay nada que desplazar. Si la línea aparece sin lista, mientras *Recursos › Sobreasignación* todavía indica un recurso, entonces todas las tareas en conflicto están fijadas con prioridad 1000 o ya han empezado. No se desplazan y la ventana no las muestra como conflicto. Por eso, después de aplicar, mire siempre *Sobreasignación*.

**Tareas que no se desplazan.** Una tarea que ya ha empezado o ha terminado nunca se desplaza. Su carga sí cuenta. Los hitos y las fases tampoco se desplazan.

**El material no se nivela.** Si un recurso de material pide más que sus *Unidades máx* en un día, sí cuenta como sobreasignado en *Sobreasignación*, pero no está en la ventana de nivelación.

**La nivelación no se adapta.** Los retrasos se mantienen tal como se calcularon. Si más tarde cambia la duración de una tarea, la tarea nivelada se queda donde está, aunque ese sitio ya no haga falta. Nivele de nuevo entonces.

**Sobreasignado por el calendario.** Si el recurso no trabaja un día según su calendario, el panel *Advertencias* indica, por ejemplo, *Sobreasignado durante 5 día(s) (29-06-2027 – 05-07-2027), de los cuales 1 día(s) el recurso no trabaja según su calendario*. Si una tarea siempre cruza un día así, que es la segunda razón de arriba, la nivelación no lo resuelve.

## Véase también

- [Nivelación de recursos](docs://uitleg-nivelleren): qué desplaza la nivelación, dentro y fuera de la holgura, y qué no hace.
- [Gestionar recursos](docs://howto-resources-beheren): ajustar la capacidad y el calendario de un recurso.
- [Añadir relaciones](docs://howto-relaties-leggen): poner tareas una detrás de otra.
- [Notificaciones y advertencias](docs://ref-meldingen): la advertencia de sobreasignación en el panel Advertencias.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): los yeseros están sobreasignados durante 5 días. Con la casilla *Nivelar solo dentro de la holgura (suavizado) — la fecha de fin del proyecto no cambia* marcada, la fecha de fin se queda en el 17 de agosto de 2027 y queda un conflicto restante. Con la casilla desmarcada (el valor predeterminado), se resuelve todo y la fecha de fin pasa al 24 de agosto de 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): la grúa torre está sobreasignada durante 65 días y los yeseros durante 15 días. Si nivela con la casilla *Nivelar solo dentro de la holgura (suavizado) — la fecha de fin del proyecto no cambia* desmarcada, la fecha de fin pasa del 9 de mayo al 12 de octubre de 2028.
