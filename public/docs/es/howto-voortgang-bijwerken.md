# Actualizar el avance

Objetivo: introducir el estado real del trabajo en la planificación y recalcular la planificación: qué tareas están terminadas, cuáles están en curso y cuánto trabajo queda por hacer.

## Cuándo lo necesita

Actualice el avance en momentos fijos, por ejemplo cada viernes, cuando el jefe de obra informa del estado., por ejemplo cada viernes, cuando el jefe de obra informa del estado. Así la planificación ve lo que ha pasado realmente y calcula el trabajo restante desde la fecha de estado. Por qué la aplicación funciona así se explica en [Avance, fecha de estado y línea base](docs://uitleg-voortgang).

## Pasos

### 1. Establezca la fecha de estado

La fecha de estado es el día en que hace balance. Establézcala antes de introducir el avance.

1. Vaya a *Planificación › Líneas base y progreso › Fecha de estado*.
2. Escriba la fecha en las tres casillas de día, mes y año (en el orden de su notación de fechas), por ejemplo 28, 06 y 2027, y pulse Intro. La aplicación pasa sola a la casilla siguiente.
3. ¿Tiene el calendario del proyecto bandas de horario laboral (la sección *Horarios de trabajo* de la ventana *Calendarios*)? Entonces la aplicación calcula en horas y aparece un campo de hora a la derecha, por ejemplo 17:00. Escriba otra hora, por ejemplo 12:00, y pulse Intro. Si vacía el campo de hora, solo queda la fecha. Si cambia solo la fecha, la hora se mantiene. La hora sigue su notación horaria (24 o 12 horas). Sin bandas de horario laboral, la aplicación calcula en días completos: entonces no hay campo de hora y la línea de fecha de estado empieza al inicio del día.
4. Con la pequeña cruz junto al campo, vacía de nuevo la fecha de estado.

Si hace balance el viernes fuera de los horarios de trabajo, establezca la fecha de estado en el siguiente día laborable, el lunes. La aplicación planifica el trabajo restante desde el inicio de la fecha de estado.

Si introduce avance mientras aún no hay fecha de estado, la aplicación la establece en hoy y muestra este aviso: *Fecha de estado fijada en hoy (…).* Por eso es mejor que lo haga usted antes.

### 2. Introduzca el avance

Elija la forma que le convenga a su situación. Todas dan el mismo resultado.

**Una tarea en el panel de propiedades.** Útil cuando actualiza una sola tarea.

1. Haga clic en la tarea. Si no ve el panel *Propiedades*, actívelo con *Vista › Paneles › Propiedades*.
2. Arrastre el control deslizante *Progreso (%)* hasta el porcentaje que está hecho.
3. Si hace falta, rellene *Inicio real* y *Fin real*, igual que la fecha de estado. La aplicación calcula el campo *Restante* por sí misma; aquí no lo puede cambiar.

Un hito tiene un solo campo, *Fecha real*.

**Elegir un porcentaje en el menú.** Útil para un estado rápido.

1. Haga clic con el botón derecho en la barra de tarea del diagrama Gantt.
2. Elija *Progreso* y después 0 %, 25 %, 50 %, 75 % o 100 %.

**Varias tareas en la tabla.** Útil cuando actualiza una lista completa.

1. Haga clic en el **+** a la derecha del encabezado de la tabla de tareas (*Añadir columna*) y abra la categoría *Progreso*. Añada las columnas *Inicio real*, *Fin real*, *Restante* y *Estado*. La columna *Progreso* ya está en la pestaña *Tabla*.
2. Haga doble clic en una celda, escriba el valor y pulse Intro. Escriba un porcentaje como `50` o `50%`, una fecha como `25-06-2027` y una duración restante como `1`.
3. En la columna *Estado*, tras un doble clic, pulse Intro y elija *No iniciada*, *En curso* o *Completada*.

Si escribe una duración restante, la aplicación deduce el porcentaje: para una tarea de 2 días laborables, un resto de 1 da un porcentaje de 50. Un resto de 0 finaliza la tarea. La columna *Duración real* (también en la categoría *Progreso*) funciona al revés: escriba cuánto trabajo ya está hecho y la aplicación calcula el porcentaje. Para una tarea de 4 días laborables, una duración real de 1 da un 25 %. Si elige *No iniciada* en *Estado*, el porcentaje pasa a 0 y desaparecen las fechas reales.

**Todos los datos de una tarea en la ventana de edición.** Haga clic con el botón derecho en la tarea y elija *Editar...*. Los campos de avance también están ahí. Solo se aplican cuando hace clic en *Guardar*.

**Muchas tareas a la vez desde una hoja de cálculo.** Consulte [Importar el avance desde una hoja de cálculo](docs://howto-voortgang-importeren).

### 3. Recalcule la planificación

Cada cambio en el avance o en la fecha de estado deja la planificación desactualizada: la barra de estado muestra *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo en *Planificación › Programación › Calcular*. Si *Calcular automáticamente* está activado (en *Configuración › Proyecto › Configuración*, pestaña *Planificación*), la aplicación lo hace sola.

## Compruebe el resultado

- En la fecha de estado, el diagrama Gantt muestra una línea discontinua con la fecha en el encabezado. En las tareas en curso, la línea sobresale hasta el porcentaje de la barra. Puede activar o desactivar estas líneas en *Vista › Líneas base y progreso › Línea de progreso* y *Línea de fecha de estado*.
- La parte finalizada de una barra se vuelve gris; el resto conserva su color. Una tarea totalmente terminada aparece completamente gris, con una marca de verificación delante del nombre y sin franja de holgura. La barra de una fase también se vuelve gris hasta su porcentaje derivado, así que puede ver por fase cuánto trabajo se ha hecho. Si muestra los predecesores o sucesores de una tarea, esas barras conservan su color de resaltado, también cuando están terminadas.
- Las tareas finalizadas nunca aparecen en rojo: con fecha de estado, una tarea finalizada no es crítica.
- Las fases muestran un porcentaje derivado, y el fin de la planificación puede haber cambiado.
- Si guardó una línea base, la planificación original aparece debajo de cada barra, y el tipo de informe *Variance* muestra la variación.

## Problemas y qué hace la aplicación

**Una fecha posterior a la fecha de estado.** La aplicación no acepta un inicio real ni un fin real posterior a la fecha de estado. En el panel, debajo de los campos, aparece *Las fechas reales no pueden ser posteriores a la fecha de estado*; en la tabla, la celda muestra *La fecha real es posterior a la fecha de estado.* Primero establezca una fecha de estado posterior o corrija la fecha.

**Una tarea que solo empezaría después de la fecha de estado.** Si introduce avance para una tarea que, según la planificación, aún no habría empezado, se abre la ventana *Indicar el inicio real*. Pregunta cuándo empezó realmente la tarea; la sugerencia es la fecha de estado. Con *Aplicar avance* lo registra; con *Cancelar* no cambia nada.

**100 % sin fechas.** Si pone una tarea al 100 % sin fin real, el fin real pasa a ser la fecha de estado, aunque la tarea hubiera terminado antes. Entonces, rellene usted mismo el fin real.

**Un porcentaje inferior al 100 %.** Si pone una tarea completada de nuevo por debajo del 100 %, se borra el fin real. Si borra solo el fin real, el porcentaje pasa a 0 y la tarea sigue *En curso*. Si quiere que la tarea vuelva a contar como no iniciada, borre también el inicio real, o elija *No iniciada* en *Estado* en la tabla.

**Cambiar la duración de una tarea en curso.** El trabajo ya hecho se mantiene y el porcentaje se ajusta. Una tarea de 5 días laborables al 60 % que cambia a 10 días laborables queda al 30 %. La aplicación no acepta una duración menor que el trabajo ya realizado: *«Build inner cavity leaf» ya está hecha en un 60 %: una duración menor que el trabajo ya realizado no es posible. La duración no se ha cambiado.* En la tabla, la celda muestra *Esta duración es menor que el trabajo ya realizado.*

**La duración restante se redondea.** La aplicación redondea la duración restante a días laborables completos. Para una tarea de 2 días laborables, 50 % y 75 % dan ambos un resto de 1 día laborable.

**Una fase.** Una fase no tiene avance propio. En el panel aparece *Derivado de las subtareas: cambie el progreso allí. La tarea de resumen se actualiza tras calcular (F5).* En la tabla, la celda muestra *El progreso de una tarea de resumen se deriva de sus subtareas y no se puede cambiar aquí.*

**Mover la fecha de estado más tarde.** El trabajo restante de las tareas en curso empieza en la nueva fecha de estado, y el trabajo que aún no ha empezado no puede quedar antes de esa fecha. Por eso, muévala solo junto con una actualización del avance. Si establece una fecha de estado sin introducir también avance, todo el trabajo que aún no ha empezado pasa a esa fecha (excepto en el perfil de Microsoft Project).

**Un error.** Cada cambio de avance cuenta como un paso para Ctrl+Z.

## Consulte también

- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): cómo la aplicación calcula el trabajo restante y la fecha de estado, con un ejemplo práctico.
- [Importar el avance desde una hoja de cálculo](docs://howto-voortgang-importeren): leer el avance de muchas tareas a la vez.
- [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen): qué hace la aplicación con una tarea que ha empezado mientras su predecesor sigue en curso.
- [Guardar y gestionar una línea base](docs://howto-baseline-opslaan-en-beheren): guardar la planificación original para comparar el avance con ella.
