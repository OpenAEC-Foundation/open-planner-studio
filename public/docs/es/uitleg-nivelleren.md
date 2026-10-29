# Nivelación de recursos

Tiene un albañil y dos muros que se deben construir los mismos días. En el papel, la planificación funciona. En la práctica, él solo puede estar en un lugar. La nivelación resuelve estos conflictos: hace que las tareas empiecen más tarde, hasta que el recurso pueda con el trabajo. En este artículo usted lee exactamente qué desplaza la nivelación, cuándo cede la fecha de fin y qué no resuelve por usted.

## El concepto

Un recurso está **sobreasignado** en un día laborable si la planificación le exige ese día más de lo que puede aportar. Lo que puede aportar es su capacidad: *Unidades máx* en los días laborables de su calendario. Si no trabaja ese día según su calendario, su capacidad es 0.

La **nivelación** resuelve eso haciendo que las tareas empiecen más tarde. No hace nada más. No acorta una tarea, no divide una tarea, no cambia unidades ni relaciones y no añade un recurso extra. Para cada tarea, la aplicación busca el primer punto en que los recursos están libres y desplaza la tarea allí.

Hay dos maneras, en la ventana *Nivelar recursos*:

- De forma predeterminada, la fecha de fin del proyecto puede desplazarse. Eso es la nivelación en sentido estricto.
- Con la casilla *Nivelar solo dentro de la holgura (suavizado) — la fecha de fin del proyecto no cambia*, la aplicación solo desplaza las tareas dentro de su holgura. La fecha de fin se queda como está. Si eso no funciona, la tarea se queda donde está y la aplicación informa de un conflicto. Qué es la holgura lo lee usted en [Ruta crítica y holgura](docs://uitleg-kritiek-pad).

## Cómo calcula la aplicación

### Cuánto pide una tarea

Por día laborable, la aplicación cuenta cuántas unidades pide cada tarea a un recurso. Son las unidades según la curva o según su propia distribución de horas, es decir, exactamente las mismas horas por día que muestra el histograma. La capacidad del recurso es *Unidades máx*, o el valor del tramo de la capacidad por periodos que aplica ese día. Un día está sobreasignado si la demanda es mayor que la capacidad.

### En qué orden

La aplicación coloca las tareas una por una, en este orden: primero la prioridad más alta, luego la tarea con menor holgura total, después el inicio temprano y, por último, el orden en la tabla de tareas. Una tarea solo llega a su turno cuando sus predecesores ya tienen su lugar.

La prioridad es un número de 0 a 1000 que usted asigna por tarea. El valor predeterminado es 500. En el menú contextual de una barra de tarea se llama *Prioridad*, con las opciones *Baja* (100), *Normal* (500) y *Alta* (900). Una tarea que llega antes obtiene el lugar que quiere. Las tareas siguientes tienen que encajar a su alrededor. Así, la prioridad decide qué tarea se queda y cuál cede. El valor 1000 es especial: esa tarea nunca se desplaza por capacidad. Es el «No nivelar» de MS Project.

### Adónde se desplaza una tarea

Para cada tarea, la aplicación empieza en el inicio temprano que permiten las relaciones. Eso tiene en cuenta que los predecesores quizá ya se hayan desplazado. Si la tarea cabe ahí, se queda. Si no cabe, la aplicación prueba el siguiente día laborable de la tarea, y así sucesivamente. Una tarea cabe si, en cada día de la tarea, cada recurso tiene suficiente capacidad libre. Si una tarea tiene varios recursos, todos deben estar libres esos días. Así, una tarea siempre se desplaza hacia más tarde, nunca hacia antes.

La aplicación registra el desplazamiento como un **retraso de nivelación**: un número de días laborables, en el calendario de la tarea, en que la tarea empieza más tarde de lo que exigen sus relaciones. Usted lo ve en la columna *Retraso de nivelación*, bajo *Calculado*. El retraso se guarda con el archivo del proyecto. Calcular (F5) lo tiene en cuenta como tiempo de espera adicional antes del inicio. Las tareas posteriores se mueven con ella mediante sus relaciones.

### Dentro de la holgura o más allá

Sin *suavizado*, la aplicación sigue buscando hasta que la tarea cabe. Como resultado, la fecha de fin del proyecto puede moverse.

Con *suavizado*, una tarea no puede empezar más tarde que su inicio tardío. Ese es el último día en que podría empezar sin que se mueva la fecha de fin. Si la tarea no cabe dentro de esa ventana, se queda en su lugar más temprano. La tarea aparece entonces bajo *Conflictos restantes*.

### Lo que la aplicación no desplaza

- Las tareas que ya han empezado o están terminadas. Su carga cuenta, pero nunca reciben un retraso de nivelación.
- Las tareas con prioridad 1000. Siguen a sus predecesores, pero no se desplazan por capacidad.
- Las tareas sin asignación a los recursos seleccionados, los hitos y las fases. Solo se mueven si se desplaza un predecesor.
- Los materiales. Eso nunca se nivela.

### Propuesta y aplicación

*Calcular* genera una propuesta: las tareas que se desplazan, con el inicio anterior y el nuevo, y la fecha de fin antes y después. Nada cambia en su planificación hasta que elija *Aplicar*. Entonces la aplicación escribe los retrasos en las tareas y hace que la planificación se recalcule de inmediato.

## Ejemplo práctico: el albañil en dos muros

El ejemplo es el proyecto de práctica de los tutoriales *House extension*, tal como está justo antes de la nivelación del tutorial 5. En el tutorial 5 usted lo hace solo y comprueba los números. En este ejemplo, el enlucido está en *Trabajo fijo* y el yesero trabaja con unidades de 2, como en [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels).

Después del forjado alveolar, terminado el lunes 28 de junio, la hoja interior de la cavidad (5 días laborables) y la hoja exterior de la cavidad (6 días laborables) empiezan ambas el martes 29 de junio. Las dos son del albañil, con unidades de 1 y *Unidades máx* de 1. Después de la hoja interior vienen los elementos de cubierta (un trabajo de grúa de 6 horas) y la cubierta (2 días laborables). Los marcos de ventana esperan a la cubierta y a la hoja exterior. La entrega es el lunes 30 de agosto.

### La sobreasignación

La hoja interior va del 29 de junio al 5 de julio inclusive. La hoja exterior va del 29 de junio al 6 de julio inclusive. Del 29 de junio al 5 de julio inclusive son 5 días laborables. En esos días la planificación pide 2 unidades de un albañil con capacidad 1. El albañil está sobreasignado esos 5 días.

### El orden

Ambas tareas tienen prioridad 500. Los marcos de ventana solo se entregan el 14 de julio. (En el tutorial 3 usted fija para ello una restricción *No comenzar antes del (SNET)*.) Por eso la hoja interior tiene 3 días laborables de holgura y la exterior 5. La hoja interior tiene la menor holgura y por eso va primero. Se queda del 29 de junio al 5 de julio inclusive.

### El desplazamiento

La hoja exterior no puede empezar el 29 de junio. El primer día en que el albañil vuelve a estar libre es el martes 6 de julio. Eso son 5 días laborables después del inicio temprano, así que el retraso de nivelación es 5. La hoja exterior va ahora del 6 de julio al 13 de julio inclusive. Los marcos solo empiezan el 14 de julio de todos modos, así que la entrega sigue siendo el lunes 30 de agosto. La ventana muestra *Fecha de fin del proyecto: sin cambios (30-08-2027)* y una línea: *Build outer cavity leaf*, inicio anterior 29-06-2027, nuevo inicio 06-07-2027, *5 d*.

Los 5 días laborables del desplazamiento son exactamente la holgura de la hoja exterior. Por eso la *nivelación* da aquí el mismo resultado. La hoja exterior ya no tiene holgura y es crítica.

### Y si los marcos no llegan el 14 de julio

Sin esa restricción, los marcos pueden empezar el viernes 9 de julio y la entrega es el miércoles 25 de agosto. La hoja exterior tiene entonces solo 2 días laborables de holgura.

- Sin *nivelación*, la hoja exterior se desplaza igual 5 días laborables. Ahora los marcos tienen que esperar: empiezan el 14 de julio, 3 días laborables después. Todo lo posterior se mueve con ellos y la entrega pasa del 25 de agosto al 30 de agosto, también 3 días laborables más tarde.
- Con *nivelación*, nada se desplaza. La hoja exterior no cabe dentro de sus 2 días laborables de holgura. La ventana muestra el conflicto *Build outer cavity leaf*, 5 día(s), con el motivo *No hay suficiente capacidad libre dentro de la holgura para resolver este conflicto*.

### Y si la hoja exterior recibe prioridad

Si usted da a la hoja exterior la prioridad *Alta* (900), va primero. Se queda el 29 de junio y ahora cede la hoja interior: se desplaza 6 días laborables, del 7 de julio al 13 de julio inclusive. La hoja interior solo tiene 3 días laborables de holgura, así que desplazarla 6 días laborables son 3 de más. Los elementos de cubierta, los marcos y todo lo posterior se mueven con ella. La entrega pasa del lunes 30 de agosto al jueves 2 de septiembre. La misma sobreasignación da, por tanto, otra fecha de fin, según qué tarea se queda en su sitio.

### Y si llega un segundo albañil

Si usted pone las *Unidades máx* del albañil en 2, ya no hay sobreasignación. *Calcular* informa: *Ninguna tarea necesita moverse — la planificación ya está libre de conflictos*.

## Consecuencias y malentendidos

**«La nivelación encuentra la planificación más corta.»** No. La aplicación trabaja tarea por tarea, en un orden fijo, y no busca la mejor solución global. Vea el ejemplo con la prioridad: otra prioridad da otra fecha de fin.

**«Una tarea nivelada está segura.»** La nivelación usa holgura. La tarea desplazada tiene entonces menos holgura o ninguna, y puede volverse crítica, como la hoja exterior de arriba. Si luego se retrasa, la entrega se mueve.

**«La nivelación sigue mis cambios posteriores.»** No. El retraso es un número fijo de días laborables. Si la hoja interior se acorta después de nivelar, la hoja exterior sigue empezando 5 días laborables más tarde, aunque ya no haga falta. Nivele de nuevo entonces. La aplicación empieza desde cero.

**No todo se puede resolver desplazando.** Si el recurso no trabaja los días que necesita la tarea, o si la tarea, según su curva, pide en un día más de lo que el recurso puede aportar, la sobreasignación se mantiene. Entonces la aplicación indica el motivo en la tarea.

**Los materiales no se nivelan.** Si un material pide más de su capacidad en un día, la aplicación lo informa como sobreasignación, pero la nivelación lo deja como está.

**Tareas fijadas.** Si todas las tareas en conflicto tienen prioridad 1000, la ventana muestra *Ninguna tarea necesita moverse — la planificación ya está libre de conflictos*, mientras la sobreasignación se mantiene. Por eso, tras aplicar, mire el mensaje *Sobreasignación* en la cinta.

## Véase también

- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): los pasos para encontrar la sobreasignación y nivelarla.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): qué es la holgura y por qué una tarea se vuelve crítica.
- [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels): cómo la duración de una tarea se mueve con las unidades.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tres torres que necesitan las mismas cuadrillas y la grúa torre, y lo que la nivelación hace con eso.
