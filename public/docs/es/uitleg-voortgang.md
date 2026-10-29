# Avance, fecha de estado y línea base

Una planificación es una previsión. Cuando el trabajo ya está en marcha, usted quiere saber qué está terminado, qué queda por hacer y qué significa eso para la entrega. Este artículo explica cómo la aplicación procesa el avance: qué hace la fecha de estado, cómo calcula la aplicación el trabajo restante, por qué una tarea que ya ha empezado a veces todavía espera a su predecesor, y cómo compara el estado actual con el acuerdo original. Un ejemplo resuelto muestra los números.

## El concepto

El **avance** es lo que realmente ha ocurrido. Para cada tarea, la aplicación registra tres datos: un porcentaje, un **inicio real** y un **fin real**. Lo que predijo la planificación se guarda junto a él. Lo real es lo que de verdad ocurrió.

La **fecha de estado** es el día en que usted hace balance. Todo lo que ocurrió antes de ese día es un hecho. Todo lo que aún falta por ocurrir, la aplicación lo planifica a partir del inicio de ese día. Una fecha real puede caer en la fecha de estado, pero nunca después.

El **trabajo restante** es lo que queda por hacer en una tarea. Una tarea de 4 días laborables que está al 25% tiene 3 días laborables de trabajo restante.

Una **línea base** es una copia guardada de la planificación en un momento determinado, normalmente el momento en que se aprobó el acuerdo. Más tarde, usted pone la planificación con las fechas reales junto a ella y ve cuánto se desvía la ejecución.

## Cómo calcula la aplicación

El ejemplo siguiente usa el perfil de cálculo *Open Planner Studio*, con el que calcula un proyecto nuevo. Más adelante puede leer qué cambia en los perfiles de Primavera P6 y Microsoft Project.

La aplicación no recalcula por sí sola. Después de cada cambio en el avance o en la fecha de estado, la barra de estado muestra *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo en *Planificación › Programación › Calcular*. Si *Calcular automáticamente* está activado (en *Configuración › Proyecto › Configuración*, pestaña *Planificación*, encabezado *Cálculo*), la aplicación lo hace por sí misma.

### La fecha de estado

La fecha de estado hace tres cosas.

Primero, la aplicación no acepta una fecha real posterior a la fecha de estado. Una fecha que coincide con la fecha de estado sí es válida.

Segundo, el trabajo que no ha empezado no puede quedar en el pasado. Si una tarea así está planificada antes de la fecha de estado, la aplicación la mueve a la fecha de estado. Lo mismo vale para las tareas posteriores, que se mueven con sus relaciones. Puede ver el efecto en el ejemplo siguiente. En el perfil de Microsoft Project la aplicación no hace esto.

Tercero, el trabajo restante de una tarea que ya está en curso empieza en la fecha de estado. La aplicación trata la fecha de estado como el inicio de ese día. Si hace balance el viernes después del horario de trabajo, debe poner la fecha de estado en el lunes. Si la pone en el viernes, la aplicación sigue planificando el trabajo restante para ese viernes.

Si todavía no tiene fecha de estado y registra avance, la aplicación pone la fecha de estado en hoy y se lo indica. Puede fijar otra fecha en *Planificación › Líneas base y progreso › Fecha de estado*. Sin fecha de estado, la aplicación calcula una tarea en curso hacia delante con su duración restante, pero hacia atrás con su duración total; la holgura sale entonces negativa y la tarea parece crítica sin motivo.

### Porcentaje, fechas reales y duración restante

Los campos dependen unos de otros. Si usted rellena uno, la aplicación rellena los demás.

- Un porcentaje superior a 0 significa que la tarea ha empezado. Si no indica un inicio real, la aplicación toma el inicio planificado. Si la tarea está planificada para empezar después de la fecha de estado, la aplicación primero pregunta cuándo empezó en realidad.
- Un porcentaje de 100 significa que la tarea está terminada. Si no indica un fin real, el fin real pasa a ser la fecha de estado, aunque el trabajo en realidad terminó antes.
- Un fin real pone la tarea al 100%. Si devuelve una tarea terminada a menos del 100%, el fin real se elimina. Si borra el fin real, el porcentaje vuelve a 0 y la tarea sigue *En curso* hasta que usted borre también el inicio real.
- La **duración restante** es la duración multiplicada por lo que aún falta por hacer, redondeada a días laborables enteros. Para una tarea de 2 días laborables, 0% y 25% dan ambos 2 días laborables de trabajo restante, y 50% y 75% dan ambos 1. Al 90% la aplicación redondea a 0: el trabajo restante se termina entonces en la fecha de estado. Una tarea en horas se calcula en minutos enteros: una tarea de 5 horas al 40% tiene 3 horas de trabajo restante.
- Un hito tiene solo una fecha real.
- Una fase (tarea de resumen) no tiene avance propio. Después de calcular, su porcentaje se deriva de las tareas que hay debajo: la media ponderada de sus porcentajes, con la duración en días laborables como peso. Un hito pesa 0.

Si cambia la duración de una tarea que ya está en curso, el trabajo ya hecho se mantiene. El porcentaje se ajusta: una tarea de 5 días laborables al 60% que usted cambia a 10 días laborables queda al 30%. La aplicación no acepta una duración menor que el trabajo ya hecho.

### Tareas terminadas y en curso

Una tarea terminada queda fijada en sus fechas reales. Ya no se mueve y, con fecha de estado, nunca es crítica. Sin fecha de estado, una tarea terminada todavía puede ser crítica.

Una tarea en curso conserva su inicio real. Solo se mueve el trabajo restante. Dónde empieza el trabajo restante depende del modo de progreso.

### Retained Logic y Progress Override

¿Qué hace la aplicación si una tarea ya ha empezado mientras su predecesor todavía está en curso? Una relación así se llama **avance fuera de secuencia**: el avance contradice el orden. Piense en el pintor que ya empieza en una habitación que ha sido enlucida, mientras el yesero todavía está ocupado en otra parte.

Dos modos de progreso deciden cómo calcula la aplicación esto:

- **Retained Logic** (el predeterminado): la relación sigue vigente. El trabajo restante del sucesor sigue la relación: con fin-comienzo solo empieza cuando el predecesor ha terminado, y nunca antes de la fecha de estado.
- **Progress Override**: manda la realidad. El trabajo restante del sucesor empieza en la fecha de estado, sin esperar al predecesor.

En este perfil, la diferencia solo está en el trabajo restante de las tareas que ya han empezado mientras su predecesor todavía no ha terminado. Las demás tareas se calculan igual en ambos modos. La aplicación informa de una relación así en los dos modos: en la barra de estado como *1 relación(es) fuera de secuencia* y en el panel *Advertencias*.

### Líneas base y variación

Al guardar, la aplicación registra para cada tarea sin subtareas el inicio temprano, el fin temprano, la duración y el tipo de hito. Las fases no están incluidas. Lo que cambie después no afecta a la línea base. Puede guardar varias líneas base; exactamente una está **activa**. El Gantt, el informe de Variance y el informe de avance usan la línea base activa.

La **variación** es la diferencia en días laborables entre la línea base y la planificación actual. Un signo más significa más tarde, un signo menos más pronto. La aplicación cuenta en el calendario del proyecto. El informe de Variance muestra la variación de inicio y de fin por tarea. El estado depende solo del fin: *Más tarde* para un signo más, *Más pronto* para un signo menos, y en otro caso *En plazo*. Una tarea añadida después de la línea base se llama *Nueva*; una tarea que ya no existe es *Eliminada*.

Dos observaciones. La variación de duración está en la tabla de tareas (columna *Variación de duración*), no en el informe de Variance. Compara la duración planificada de la tarea ahora con la de la línea base. El avance no cambia esa duración planificada: una tarea planificada en dos días que tardó tres tiene, por tanto, una variación de finalización de +1 pero una variación de duración de 0. Y si guarda una línea base después de registrar avance, guarda el estado con esas fechas reales; entonces la variación es cero.

El informe de avance pone el avance planificado junto al avance real. Los dos se ponderan por días laborables. Planificado es la parte de cada tarea que debía estar terminada en la fecha de estado según la línea base; real es el porcentaje que se introdujo.

### Dónde lo ve

En el Gantt, una línea discontinua marca la fecha de estado, con la fecha en el encabezado. En cada tarea en curso, la línea sobresale hasta el punto de la barra que indica el porcentaje. Esa es la **línea de progreso**. Si desactiva la línea de progreso y deja activada la línea de fecha de estado, queda una línea recta; con las dos desactivadas, desaparecen la línea y la etiqueta. Los botones *Superposición de la línea base*, *Línea de progreso* y *Línea de fecha de estado* están en *Vista › Líneas base y progreso* y no cambian nada en el cálculo. La línea base aparece como una barra fina debajo de cada barra de tarea. La tabla de tareas tiene columnas para el avance y, por cada línea base, para la variación. En la pestaña *Informe* encuentra los tipos de informe *Variance* y *Informe de avance*.

## Ejemplo resuelto: la ampliación tras tres semanas

El ejemplo es el proyecto de práctica *House extension* de los tutoriales, en el estado después de añadir todas las relaciones: sin vacaciones de construcción, recursos ni horas. En el tutorial 6 lo hace usted mismo en el proyecto de práctica. Para entonces, ese proyecto tiene más datos, así que los números difieren. Aquí lee por qué los números son los que son.

La ampliación empieza el lunes 7 de junio de 2027. En la planificación calculada, la aplicación guarda una línea base llamada *Línea base*: entrega el viernes 6 de agosto de 2027, 45 días laborables.

### El estado el lunes 28 de junio

La fecha de estado es el lunes 28 de junio de 2027. Esto es lo que ha ocurrido:

- *Start of construction*, *Set up site*, *Clear garden and paving* y *Set out the extension* están terminadas según lo planificado, del 7 al 10 de junio.
- *Excavate foundation trench* se planificó en 2 días laborables (viernes 11 y lunes 14 de junio) y tardó 3: del 11 al 15 de junio.
- *Foundation formwork and reinforcement* va del 16 al 18 de junio. *Reinforcement inspection* es el 18 de junio, *Pour foundation* el lunes 21 de junio.
- *Foundation brickwork* (2 días laborables) empezó el viernes 25 de junio y está al 50%.

Después de **Calcular**, la aplicación lo calcula así:

- El trabajo restante de la foundation brickwork es 2 × (1 − 0,5) = 1 día laborable. Empieza en la fecha de estado, así que termina el lunes 28 de junio.
- *Lay hollow-core floor* sigue el martes 29 de junio. Por eso *Build inner cavity leaf* empieza el miércoles 30 de junio en lugar del martes 29 de junio. La entrega llega el lunes 9 de agosto: un día laborable más tarde que la línea base. El día extra de la excavación es, por tanto, el retraso de todo el proyecto, porque esa tarea estaba en la ruta crítica.
- La barra de estado muestra *Ruta crítica: 13 tareas, 46 días laborables*, frente a 21 tareas y 45 días laborables antes del avance. Las ocho tareas terminadas que estaban en la ruta crítica ya no cuentan.
- La fase *Foundations* está al 77,8%. Las tareas que contiene pesan 2 + 3 + 1 + 2 + 1 = 9 días laborables. Están terminados 2 + 3 + 1 días laborables, más la mitad de 2: 7 en total. Y 7 de 9 es 77,8%. El hito *Reinforcement inspection* pesa 0.

El informe de Variance pone esto junto a la línea base:

- *Excavate foundation trench*: inicio 0, fin +1 (fin de la línea base 14 de junio, ahora 15 de junio).
- *Foundation brickwork*: inicio +1 (el 24 de junio pasó a ser el 25 de junio), fin +1.
- *Build outer cavity leaf*: +1, +1. Esa tarea todavía no es crítica: tenía 2 días laborables de holgura y los conserva.
- *Handover*: +1. El fin del proyecto se desvía 1 día laborable.
- En total, 19 tareas están en *Más tarde* y 4 en *En plazo*; ninguna tarea está en *Más pronto*.

El informe de avance muestra *Planificado* 28,3% y *Real* 23,9%. Las tareas pesan 46 días laborables en total. Según la línea base, deberían estar terminados 13: 4 días laborables de la preparación, 2 de la excavación, 3 del refuerzo, 1 del vertido, 2 de la foundation brickwork y 1 del hollow-core floor. En realidad, 11 están terminados: 4 + 2 + 3 + 1, más medio día laborable de la foundation brickwork.

### ¿Qué pasa si cambia la fecha de estado?

El mismo avance, otra fecha de estado. El trabajo restante de la foundation brickwork siempre empieza en la fecha de estado, así que la entrega se mueve con ella:

- Fecha de estado el viernes 25 de junio: el trabajo restante cae el viernes 25 de junio, la entrega sigue siendo el viernes 6 de agosto.
- El lunes 28 de junio: entrega el lunes 9 de agosto.
- El martes 29 de junio: entrega el martes 10 de agosto, 2 días laborables más tarde que la línea base.

### ¿Qué pasa si cambia el porcentaje?

La foundation brickwork tiene 2 días laborables. Al 0% o al 25% el trabajo restante es de 2 días laborables: termina el martes 29 de junio y la entrega pasa a ser el martes 10 de agosto. Al 50% o al 75% es de 1 día laborable: el lunes 28 de junio, con entrega el lunes 9 de agosto. Al 90% el trabajo restante es 0 y la tarea termina en la fecha de estado.

### ¿Qué pasa si pone una fecha de estado sin registrar avance?

Si solo pone la fecha de estado en el lunes 28 de junio y no introduce nada, según la planificación todavía no ha ocurrido nada. El trabajo que no ha empezado no puede quedar en el pasado. Por eso la aplicación mueve todo al 28 de junio: *Start of construction* queda entonces en ese día, y la entrega llega el viernes 27 de agosto, 15 días laborables después de la línea base. Por eso, registre primero el avance que ya existe.

## Ejemplo práctico: yesero y pintor

Ahora un ejemplo para el modo de progreso. Es la misma ampliación, pero en otro estado: es miércoles 21 de julio de 2027. Todo hasta *Install building services* incluido está terminado según lo planificado. *Plastering* (4 días laborables) empezó el martes 20 de julio y está al 25%. *Painting* (3 días laborables) sigue al plastering, pero el pintor ya ha empezado hoy y está al 33%.

Sin avance, el plastering estaba planificado del martes 20 al viernes 23 de julio, y el painting del lunes 26 al miércoles 28 de julio. La barra de estado indica ahora *1 relación(es) fuera de secuencia*: el painting ha empezado mientras el plastering no está terminado. En el panel *Advertencias* dice: *Fuera de secuencia: el progreso del sucesor contradice la relación*.

El plastering tiene 4 × (1 − 0,25) = 3 días laborables de trabajo restante: 21, 22 y 23 de julio. El painting tiene 3 × (1 − 0,33) = 2 días laborables de trabajo restante.

- Con **Retained Logic** ese trabajo restante solo puede empezar cuando el plastering esté terminado. Eso es el viernes 23 de julio, así que el painting empieza el lunes 26 de julio y termina el martes 27 de julio. La barra va desde el inicio real del 21 de julio hasta el 27 de julio. La holgura total es de 7 días laborables.
- Con **Progress Override** el trabajo restante empieza en la fecha de estado. El painting termina el jueves 22 de julio, antes de que el plastering esté terminado. La holgura total es de 10 días laborables.

La entrega sigue siendo el viernes 6 de agosto en ambos casos: el painting tenía holgura de todos modos.

### Otros perfiles de cálculo

En los perfiles Primavera P6 y Microsoft Project, el painting de este ejemplo termina en las mismas fechas (27 y 22 de julio). Se diferencian en los siguientes puntos. Son convenciones del perfil; las encuentra en *Configuración › Proyecto › Ajustes del proyecto*, en el bloque *Perfil de cálculo y opciones*.

- En el perfil de Microsoft Project, el trabajo que aún no ha empezado no se mueve a la fecha de estado (convención *No mover las tareas no iniciadas a la fecha de estado*). Si en el ejemplo de arriba solo fija una fecha de estado y no introduce nada, la entrega en ese perfil sigue siendo el viernes 6 de agosto.
- En el perfil de Microsoft Project, el trabajo restante tampoco empieza antes del inicio real más la duración ya transcurrida (convención *El trabajo restante se reanuda tras la duración transcurrida*). Eso es un límite inferior adicional junto a la fecha de estado: cuenta la más tardía de las dos. Tome *Build inner cavity leaf* (5 días laborables), iniciada el martes 29 de junio y al 40% el miércoles 30 de junio, que es la fecha de estado (dos cuadrillas colocan ladrillo a la vez, así que el 40% ya está hecho tras un día). Todo lo anterior está terminado según lo planificado. Open Planner Studio y Primavera P6 dejan que la tarea termine el viernes 2 de julio; Microsoft Project, el lunes 5 de julio, porque el martes 29 de junio más 2 días laborables transcurridos es el jueves 1 de julio, después de la fecha de estado.
- Primavera P6 muestra como inicio temprano de una tarea en curso el inicio del trabajo restante, no el inicio real (en el ejemplo de inner-leaf, el miércoles 30 de junio). La columna *Inicio* y la barra sí muestran el inicio real en todos los perfiles.
- En el perfil de Primavera P6, con Progress Override, la relación con un sucesor que ya ha empezado tampoco cuenta para el predecesor: ya no limita sus fechas tardías ni su holgura libre (convención *Progress Override ignora también hacia atrás un sucesor iniciado*). En el ejemplo del yesero y el pintor no se nota, porque el plastering es crítico de todos modos por la solera: sus fechas tardías y su holgura libre son las mismas con Retained Logic y con Progress Override.
- Al abrir un archivo .xer, la aplicación toma el modo de progreso del archivo. Actual Dates, el tercer modo de P6, la aplicación no lo conoce; un archivo así se calcula como Retained Logic.

## Consecuencias y malentendidos

**«Solo adelanto la fecha de estado.»** Si la mueve, el trabajo restante de las tareas en curso empieza en la nueva fecha, y el trabajo que aún no ha empezado nunca puede quedar antes de esa fecha. Por eso mueva la fecha de estado solo junto con una actualización del avance.

**«Introducir el 100% registra el fin real.»** Solo si también introduce el fin real. Si pone una tarea al 100% sin fin real, pasa a ser la fecha de estado. Si en realidad terminó antes, rellene el fin real.

**«0% significa no iniciado.»** Si una tarea tiene un inicio real, cuenta como iniciada, aunque esté al 0%. El trabajo restante es entonces la duración completa y empieza en la fecha de estado. Borre el inicio real para que vuelva a contar como no iniciada.

**«Progress Override resuelve el aviso.»** El mensaje de fuera de secuencia sigue. El modo solo decide cómo calcula la aplicación. Si la relación ya no es correcta, cambie la relación.

**«La pausa en una tarea dividida desaparece.»** No: una pausa en la parte que falta por hacer se mantiene en el trabajo restante. Tome una tarea de 5 días laborables con una pausa de 1 día tras 2 días de trabajo, iniciada el martes 29 de junio y, con la fecha de estado el miércoles 30 de junio, al 40%. El trabajo restante de 3 días laborables empieza en la fecha de estado y atraviesa la pausa: el fin es el lunes 5 de julio. Sin la pausa habría sido el viernes 2 de julio.

**Horas y la fecha de estado.** En la cinta no se puede introducir una hora: la fecha de estado se rellena como fecha. Si hace balance después del horario de trabajo, fije la fecha de estado en el siguiente día laborable. Una tarea en horas calcula el trabajo restante desde el inicio de la fecha de estado. Tome *Lay hollow-core floor* en el proyecto de práctica tras el tutorial 4, cuando todo lo anterior ya está terminado: 5 horas, el lunes 28 de junio, día laborable desde las 07:00. Con la fecha de estado el lunes 28 de junio y la tarea al 40%, quedan 3 horas de trabajo restante, de 07:00 a 10:00, aunque ese día ya se haya trabajado por la mañana. Cómo cuenta la aplicación las horas se explica en [Días y horas](docs://uitleg-dagen-en-uren).

**Actualizar una línea base.** No es posible. Guarde una nueva y borre la anterior. Si mueve el proyecto, las fechas reales y la fecha de estado se desplazan con él, pero las líneas base de forma predeterminada no: así el desplazamiento sigue visible como variación. Consulte [Mover un proyecto](docs://howto-project-verplaatsen).

## Ver también

- [Actualizar el avance](docs://howto-voortgang-bijwerken): fijar la fecha de estado e introducir el avance.
- [Importar el avance desde una hoja de cálculo](docs://howto-voortgang-importeren): leer el avance del personal de obra de una vez.
- [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen): fijar Retained Logic o Progress Override.
- [Guardar y gestionar una línea base](docs://howto-baseline-opslaan-en-beheren): registrar una línea base y usarla.
- [Mover un proyecto](docs://howto-project-verplaatsen): qué pasa con las fechas reales, la fecha de estado y las líneas base.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): por qué una tarea es crítica y qué significa la holgura.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): avance y fecha de estado a mitad del proyecto (20 de mayo de 2027).
