# Guardar y gestionar una línea base

Objetivo: guardar la planificación como un acuerdo (una línea base). Así puede ver después cuánto se desvía la ejecución, y puede guardar, cambiar de nombre, elegir y eliminar varias líneas base.

## Cuándo lo necesita

Usted guarda una línea base cuando la planificación está aprobada y el trabajo todavía no ha empezado. Si la planificación se revisa formalmente más tarde, por ejemplo después de una orden de modificación, usted guarda una segunda línea base y conserva la primera. Así puede medir la ejecución frente al primer acuerdo y frente al revisado. Lo que registra exactamente una línea base y cómo calcula la aplicación la variación se explica en [Avance, fecha de estado y línea base](docs://uitleg-voortgang).

## Pasos

### Guardar una línea base

1. Pulse **Calcular** (F5), por ejemplo mediante *Planificación › Programación › Calcular*. La línea base guarda las fechas que se calculan en ese momento.
2. Elija *Planificación › Líneas base y progreso › Gestionar líneas base…*. Se abre la ventana *Líneas base*.
3. En *Guardar nueva línea base* aparece un nombre sugerido, como *Línea base 1 — (fecha de hoy)*. Escriba un nombre propio que pueda reconocer más tarde, por ejemplo *Línea base*.
4. Haga clic en *Guardar*. La línea base ya aparece en la lista y es la línea base activa de inmediato.
5. Haga clic en *Cerrar*.

Debajo de cada barra de tarea del Gantt aparece ahora una barra fina con las fechas de la línea base. Un hito recibe un pequeño rombo. Active o desactive esa superposición con *Vista › Líneas base y progreso › Superposición de la línea base*.

### Elegir la línea base activa

Abra *Gestionar líneas base…* y elija en la columna *Activa* la línea base con la que quiere comparar. Mientras haya líneas base, exactamente una está activa. La superposición del Gantt, el tipo de informe *Variance* y el *Informe de avance* la usan.

### Cambiar el nombre de una línea base

Cambie el nombre en la lista. El cambio se aplica de inmediato; no tiene que pulsar *Guardar*.

### Eliminar una línea base

Haga clic en la pequeña papelera junto a la línea base en la lista. Si elimina la línea base activa, la aplicación pregunta *¿Eliminar la línea base activa?*. Después, la línea base más nueva que quede pasa a ser la activa. Si no queda ninguna otra, ya no hay línea base activa y la superposición desaparece. Con Ctrl+Z recupera una línea base eliminada. Cierre primero la ventana; Ctrl+Z no funciona dentro de una ventana.

### Variaciones en la tabla de tareas

Cada línea base tiene seis columnas en la tabla de tareas. Haga clic en el **+** a la derecha del encabezado de la tabla de tareas (*Añadir columna*) y abra la categoría *Línea base*. Por cada línea base hay *Inicio programado*, *Fin programado*, *Duración*, *Variación de inicio*, *Variación de finalización* y *Variación de duración*, con el nombre de la línea base delante, por ejemplo *Línea base — Variación de finalización*. Las variaciones están en días laborables. Un signo más indica una fecha posterior; un signo menos, una fecha anterior. Una tarea que no está en la línea base muestra un guion (—) en esas columnas.

## Errores frecuentes y qué hace la aplicación

**Una planificación desactualizada.** Si la planificación está desactualizada, la ventana muestra *La planificación está desactualizada — recalcula primero (F5)*. Es una advertencia; guardar sigue siendo posible. Pero así usted guardaría las fechas antiguas. Cierre la ventana, pulse **Calcular** y solo después guarde.

**Una línea base con avance.** Si guarda una línea base después de introducir avance, registra el estado con esas fechas reales. La variación es entonces cero y ya no dice nada sobre la ejecución. Guarde la línea base antes de que empiece la obra.

**Una línea base no se puede actualizar.** Si quiere revisar el acuerdo, guarde una línea base nueva y elimine la antigua si hace falta.

**Un ⚠ en Duración o Variación de duración.** En una tarea en horas, un día equivale al horario laboral de su calendario. Si el calendario tiene sus propias horas por día (por ejemplo 8, con bandas de 10 horas, de Primavera P6), una versión anterior de la aplicación contaba los días de otra forma. Una línea base de esa versión conserva el número antiguo: una tarea de 1870 horas equivale a 233,75 días en la línea base y a 187 días ahora. La aplicación no convierte esa línea base. Las columnas *Duración* y *Variación de duración* de esa línea base muestran entonces un ⚠; sitúe el puntero sobre él para ver la explicación. Las fechas de la línea base son correctas. Guarde una línea base nueva y elimine la antigua si hace falta.

**Solo tareas sin subtareas.** Una fase no está en la línea base: no tiene barra de línea base ni variación. La fase se deriva de las tareas que tiene debajo.

**Tareas nuevas y eliminadas.** Una tarea que añade después de guardar no tiene barra de línea base. En el informe de Variance aparece como *Nueva*. Una tarea que elimina aparece como *Eliminada*.

**Mover proyecto.** En la ventana *Mover proyecto…*, en cuanto hay líneas base, aparece la casilla *Desplazar también las líneas base*. Está desactivada de forma predeterminada: las líneas base se quedan en su sitio, así que el desplazamiento aparece como variación. Véase [Mover un proyecto](docs://howto-project-verplaatsen).

**Guardado en el archivo del proyecto.** Las líneas base y la elección activa se guardan con el proyecto y vuelven a aparecer al abrir el archivo.

## Véase también

- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): qué registra una línea base y cómo se calcula la variación.
- [Mover un proyecto](docs://howto-project-verplaatsen): la casilla *Desplazar también las líneas base*.
- [Actualizar el avance](docs://howto-voortgang-bijwerken): introducir el estado real que se compara con la línea base.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): una línea base (*Baseline at start*) antes del inicio, con avance y una fecha de estado de 20 de mayo de 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dos líneas base, *Contract* y *Re-baseline (variation order)*, con avance y una fecha de estado de 5 de julio de 2027.
