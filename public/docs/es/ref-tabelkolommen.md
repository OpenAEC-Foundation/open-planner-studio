# Columnas de la tabla

La tabla de tareas tiene 86 columnas fijas, además de una columna por cada código de actividad y campo personalizado del proyecto y ocho columnas por cada línea base. En este artículo se indica para cada columna qué muestra, si puede editarla y en qué forma se escribe el valor. Cómo elegir y ordenar las columnas se explica en [Personalizar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen).

## Dónde elige las columnas

La tabla de tareas junto al diagrama de Gantt y la tabla de la pestaña *Tabla* tienen cada una su propia selección de columnas. El signo más a la derecha del encabezado abre el selector de columnas (título de la ventana *Elegir columna*); en *Tabla* también puede usar *Tabla › Columnas › Columnas…*. El selector muestra las columnas por categoría: *Tarea*, *Planificación*, *Restricciones*, *Relaciones*, *Recursos*, *Progreso*, *Calculado*, *Línea base*, *Personalizado* y *Técnico*. Puede buscar por nombre, y *Usadas recientemente* aparece arriba. *Restablecer valores predeterminados* restaura las columnas predeterminadas.

De forma predeterminada, la tabla junto al diagrama de Gantt muestra *WBS*, *Nombre de tarea* y *Duración*. La tabla de la pestaña *Tabla* muestra *WBS*, *Nombre de tarea*, *Duración*, *Inicio*, *Fin*, *Categoría de trabajo*, *Crítica*, *Holgura total* y *Progreso*, además de una columna por cada código de actividad y campo personalizado del proyecto.

## Cómo se leen y editan los valores

- **Columnas calculadas** — las columnas de la categoría *Calculado* y varias otras son de solo lectura: proceden del cálculo. Si intenta editar una celda de solo lectura, la aplicación muestra *Esta columna calculada no se puede editar.* Ese texto es el mensaje general para toda celda de solo lectura, también cuando la columna no está calculada. Si están desactualizadas porque cambió algo, aparece *obsoleto* junto a ellas hasta que pulse *Calcular*.
- **Fechas** — aparecen con la notación que eligió en *Configuración*, pestaña *Apariencia*, encabezado *Formato de fecha*.
- **Duraciones y holguras** — una duración aparece en la unidad de la tarea (`5d`, `12h`), o según *Visualización de la duración* en la misma pestaña (*Automática (unidad propia por tarea)*, *Siempre días* o *Siempre horas*). La holgura aparece en días laborables con dos decimales y con el separador decimal de su idioma.
- **Sí/No** — un valor de sí o no aparece como *Sí* o *No*; un valor vacío aparece como un guion (—).
- **Edición** — escriba o elija un valor. Un valor no válido se rechaza y debajo de la celda aparece el motivo, por ejemplo *Introduzca una duración válida, como 5d u 8h.* o *Introduzca un porcentaje entre 0 y 100.* Al pegar un bloque de celdas, se trabaja celda por celda; las celdas de solo lectura se omiten y la aplicación indica cuántas son.

## Tarea

- **Nombre de tarea** — el nombre de la tarea. Se puede editar; es obligatorio. Una tarea de resumen aparece en negrita, con un fondo claro en la celda del nombre; un hito aparece en negrita en el color del hito (la misma familia de colores que el hito del diagrama de Gantt). Una tarea normal no cambia. Es solo formato: seleccionar, arrastrar y editar funcionan igual.
- **Descripción** — la descripción. Se puede editar; es texto libre.
- **WBS** — el código WBS. Se puede editar y es obligatorio, pero es de solo lectura mientras *WBS auto* esté activado.
- **Categoría de trabajo** — la categoría de trabajo (*Construcción*, *Instalación*, *Demolición*, *Logística*, *Inspección*, *Reubicación*, *Renovación*, *Mantenimiento* u *Otro*). Se puede editar con una lista.
- **Categoría de trabajo personalizada** — la categoría de trabajo personalizada del proyecto, o un guion. Se puede editar con una lista de las categorías de trabajo personalizadas del proyecto.
- **Color** — el color guardado de la tarea, como código de color, por ejemplo `#1a73e8`. Se puede editar con un selector de color. Se guarda en el archivo IFC, pero ninguna barra ni informe lo usa; los colores de las barras se fijan en *Vista › Líneas base y progreso › Colores de barras*.
- **Notas** — las notas como `✓ text; ○ text`. Se pueden editar mientras haya como máximo una nota (entonces edita su texto); con más notas son de solo lectura.

## Planificación

- **Hito** — indica si la tarea es un hito. Se puede editar. Al activarlo, la duración pasa a 0; la aplicación lo rechaza en una tarea de resumen y en una tarea con asignaciones.
- **Tipo de hito** — *Hito de comienzo* o *Hito de fin*, o un guion para automático. Solo se puede editar en un hito.
- **Hito obligatorio** — la marca *Obligatorio (contractual)*. Solo se puede editar en un hito.
- **Prioridad de nivelación** — un número entero de 0 a 1000, predeterminado 500. Se puede editar. Con 1000 la tarea queda fijada para la nivelación.
- **Huecos de división** — el número de interrupciones, como `Split gaps: 2`, o un guion. Es de solo lectura; se editan en el panel *Propiedades*.
- **Tipo de tarea** — el tipo de la tarea; vacío es el predeterminado del proyecto. Se puede editar con una lista, pero en un hito, una tarea de resumen o una hamaca está vacío y es de solo lectura. Solo aparece en el selector cuando los tipos de tarea son visibles (*Usar tipos de tarea*, o cuando el archivo contiene tipos de tarea).
- **Hamaca (duración derivada)** — indica si la tarea es una hamaca. Se puede editar, excepto en un hito o una tarea de resumen.
- **Calendario** — el identificador del calendario propio de la tarea; vacío (—) es el calendario del proyecto. Escriba o elija un identificador de las sugerencias; un identificador desconocido se rechaza. Nota: la celda muestra ahora el identificador interno en lugar del nombre; es mejor elegir un calendario en el panel *Propiedades*.
- **Tipo de duración** — *Tiempo de trabajo* (la duración se cuenta en días laborables o en horarios de trabajo del calendario) o *Tiempo transcurrido* (la duración se cuenta en tiempo continuo del reloj, sin calendario). Se puede editar.
- **Unidad de duración** — *Días* u *Horas*. Se puede editar, excepto en una tarea de resumen, una hamaca o un hito; el cambio solo funciona si la conversión es exacta y *Activar planificación por horas* está activado.
- **Duración** — la duración de la tarea, en la unidad de la tarea o según *Visualización de la duración*. Se puede editar: escriba `5d`, `12h` o `1h 30m`; también un número en la unidad de la tarea. Es de solo lectura en una tarea de resumen, una hamaca y un hito con duración 0.
- **Inicio** — el inicio que se muestra, la misma fecha que la barra del diagrama de Gantt. Para una tarea que ya ha comenzado, es el inicio real. Se puede editar. Si da un nuevo inicio a una tarea con predecesor, la tarea recibe la restricción *No comenzar antes del (SNET)* en esa fecha. Es de solo lectura en una tarea de resumen o una hamaca, salvo que esté programada manualmente, y en una tarea que ya ha comenzado (*Esta tarea ya ha comenzado; su inicio es el inicio real. Cámbielo mediante el avance.*).
- **Fin** — el fin que se muestra. Para una tarea completada, es el fin real. Se puede editar: un nuevo fin se convierte en una nueva duración. La aplicación lo rechaza en un hito, una tarea en tiempo transcurrido y una tarea con interrupciones, y también si el fin es anterior al inicio (*El fin es anterior al inicio.*). Es de solo lectura en una tarea de resumen o una hamaca, salvo que esté programada manualmente, y en una tarea completada (*Esta tarea está completada; su fin es el fin real. Cámbielo mediante el progreso.*).
- **Inicio programado** — el ancla de planificación desde la que empieza el cálculo (no es necesariamente el inicio que se muestra). Se puede editar; tiene el mismo efecto que escribir en *Inicio*.
- **Fin programado** — el fin introducido. Solo se puede editar en una tarea programada manualmente; en otro caso la aplicación indica *El fin programado solo se aplica a una tarea programada manualmente. Cambie el fin mediante la columna Fin o la duración.*

## Restricciones

- **Tipo de restricción** — el tipo de la restricción, desde *Lo antes posible (ASAP)* hasta *Debe finalizar el (MFO)*. Se puede editar; una tarea sin restricción muestra *ASAP*.
- **Fecha de restricción** — la fecha de la restricción. Se puede editar.
- **Restricción estricta** — la marca *Obligatorio (fijación forzada)*. Solo se puede editar en *MSO* y *MFO*.
- **Tipo de restricción secundaria** — el tipo del segundo límite, o un guion. Se puede editar; la tabla ofrece todos los tipos, pero una combinación no permitida se rechaza: debe ser *SNET*, *FNET*, *SNLT* o *FNLT*, la restricción principal debe ser un límite (no *ASAP*, *ALAP*, *MSO*, *MFO* ni una restricción estricta) y los dos deben limitar lados opuestos (un límite inferior *SNET*/*FNET* con un límite superior *SNLT*/*FNLT*, o al revés).
- **Fecha de restricción secundaria** — la fecha del segundo límite. Se puede editar.
- **Fecha límite** — la fecha objetivo para el fin. Se puede editar.

## Relaciones

- **Predecesores** — los predecesores, como `WBS type±lag`, separados por `; `, por ejemplo `1.2 FS+2d`. Se puede editar escribiendo la misma forma. Aquí no añade una relación externa; hágalo con *Planificación › Relaciones › Vincular › Añadir relación externa…*.
- **Sucesores** — los sucesores, en la misma forma. Se puede editar.
- **Relaciones determinantes** — las relaciones que fijan la fecha de esta tarea, como `← 1.2` (predecesor) o `→ 1.4` (sucesor). Son de solo lectura; quedan desactualizadas hasta que pulse *Calcular*.
- **Holgura libre** (en la categoría *Relaciones*) — la holgura libre por relación, como `← 1.2: 3d`. No es la misma columna que *Holgura libre* en *Calculado*, que muestra la holgura de la propia tarea. Es de solo lectura.
- **Advertencias** — advertencias por relación, por ejemplo *Fuera de secuencia* o *No incluida en el cálculo*. Es de solo lectura. Consulte [Notificaciones y advertencias](docs://ref-meldingen).

## Recursos

- **Recursos asignados** — los nombres de los recursos asignados, separados por comas. Se puede editar: al añadir un nombre se asigna el recurso con 1 unidad por día; al quitar un nombre se elimina la asignación. Es de solo lectura en un hito o una tarea de resumen.
- **Unidades de asignación por día** — las unidades por recurso, como `Name: 1; Name: 0.5`, con como máximo dos decimales. El valor guardado sigue siendo exacto. Se puede editar en una tarea con asignaciones.
- **Unidades planificadas por día** — las unidades planificadas por recurso, como `Name: 1.11`, con como máximo dos decimales, igual que *Unidades de asignación por día*. Solo para una asignación de Primavera P6 con unidades restantes distintas; entonces *Unidades de asignación por día* muestra las unidades restantes. Es de solo lectura.
- **Curva de asignación** — la curva por recurso, como `Name: Uniform`. Se puede editar en una tarea con asignaciones.
- **Inicio de la ventana de trabajo** y **Fin de la ventana de trabajo** — la ventana de trabajo por recurso, de un archivo importado, como `Name: date`. Es de solo lectura.
- **Trabajo previsto (horas)** y **Trabajo real (horas)** — el trabajo previsto y el real por recurso en horas, como `Name: 617.14`, con como máximo dos decimales, de un archivo importado. Es de solo lectura.
- **Trabajo restante (horas)** — el trabajo restante por recurso en horas, como `Name: 6` o `Name: 26.67`: el trabajo guardado; si no, duración restante × unidades. Se puede editar en una tarea con asignaciones a las que se aplica un tipo de tarea, con coma o punto como separador decimal. Solo aparece en el selector cuando los tipos de tarea son visibles. Un ⚠ amarillo en la celda indica que el trabajo guardado difiere de unidades × duración restante, igual que el ⚠ en *Trabajo (rest.)* del panel de tarea.

## Avance

- **Estado** — *No iniciada*, *En curso* o *Completada*. Se puede editar, excepto en una tarea de resumen.
- **Progreso** — el porcentaje, como `40%`. Se puede editar con un número de 0 a 100, excepto en una tarea de resumen.
- **Inicio real** — la fecha en que empezó la tarea. Se puede editar, excepto en una tarea de resumen.
- **Fin real** — la fecha en que se terminó la tarea. Se puede editar, excepto en una tarea de resumen.
- **Duración real** — la duración real, como número. Se puede editar, excepto en una tarea de resumen.
- **Restante** — la duración restante, en la unidad de la tarea. Se puede editar, excepto en una tarea de resumen.
- **Fecha de reanudación** y **Fecha de parada** — la reanudación y la parada de una tarea en curso de un archivo de MS Project o Primavera. Es de solo lectura.

Las columnas de avance siguen las reglas de avance de la aplicación: una fecha real posterior a la fecha de estado se rechaza. En una tarea de resumen la aplicación indica *El progreso de una tarea de resumen se deriva de sus subtareas y no se puede cambiar aquí.*

## Calculado

Todas las columnas de esta categoría son de solo lectura.

- **Retraso de nivelación** — cuántos días laborables la nivelación retrasó la tarea; un guion si no se ha aplicado nivelación.
- **Inicio temprano** y **Fin temprano** — las fechas más tempranas del cálculo. Para una tarea que ha comenzado, pueden diferir de *Inicio* y *Fin*: el perfil de cálculo *Primavera P6* sitúa el inicio temprano de una tarea en curso o completada en la fecha de estado.
- **Inicio tardío** y **Fin tardío** — las fechas más tardías en que la tarea todavía puede empezar o terminar sin retrasar el proyecto.
- **Holgura libre** — los días laborables que la tarea puede retrasarse sin retrasar un sucesor.
- **Holgura total** — los días laborables que la tarea puede retrasarse sin retrasar el fin del proyecto. Negativa si no se puede cumplir una restricción o una fecha límite.
- **Crítica** — *Sí* si la tarea está en la ruta crítica.
- **Holgura interferente** — holgura total menos holgura libre.
- **Casi crítica** — *Sí* para una tarea casi crítica. Solo se rellena si *Marcar casi crítico* está activado (*Ajustes del proyecto*, bloque *Perfil de cálculo y opciones*); en otro caso, un guion.
- **Ruta de holgura** — el número de la ruta de holgura; 1 para la más crítica. Solo se rellena si *Múltiples rutas de holgura* está activado; en otro caso, un guion.
- **Origen de las fechas registradas** — mientras la aplicación muestre las fechas del archivo, aparece *Parcialmente no registrado* en una tarea para la que el archivo no contiene todo. Solo aparece en el selector en esa vista. En un eje sin registro, *No registrado* aparece en las columnas de fechas tardías y de holgura.

Consulte [Ruta crítica y holgura](docs://uitleg-kritiek-pad).

## Línea base

Por cada línea base del proyecto se añaden columnas, con el nombre de la línea base delante del nombre de la columna (`<baseline> — Scheduled start`). Son de solo lectura. Una tarea que no está en la línea base muestra un guion, con el texto emergente *No está presente en esta línea base*.

- **Inicio programado**, **Fin programado** y **Duración** — el inicio, el fin y la duración tal como los registró la línea base.
- **Variación de inicio** y **Variación de finalización** — el número de días laborables entre la línea base y el inicio o el fin que se muestra, en el calendario del proyecto; positivo si la tarea es posterior.
- **Variación de duración** — la duración actual menos la duración de la línea base, en días laborables.

## Personalizado

- **Código de actividad** — una columna por cada código de actividad, con el nombre del código. Muestra el código del valor elegido. Se puede editar: escriba el código o elíjalo de las sugerencias; un código desconocido se rechaza, y si un código aparece más de una vez, la aplicación le pide que lo elija de la lista.
- **Campo personalizado** — una columna por cada campo personalizado, con su nombre. La entrada se ajusta al tipo: texto, número, entero, coste, fecha o sí/no. Se puede editar.

Estas columnas pertenecen al proyecto en el que está el código o el campo. Consulte [Códigos y campos personalizados](docs://howto-codes-en-velden).

## Técnico

Todas las columnas de esta categoría son de solo lectura. Muestran datos que la aplicación guarda pero no muestra en una columna normal, por ejemplo para comprobar una importación.

- **ID de tarea** — el identificador interno de la tarea.
- **ID de tarea superior** y **ID de tareas subordinadas** — los identificadores de la tarea superior y de las tareas subordinadas.
- **ID de recursos** — los identificadores de los recursos de la tarea.
- **ID de asignación**, **ID de tarea de asignación** y **ID de recurso de asignación** — los identificadores de las asignaciones, tareas y recursos de esta tarea.
- **Duración (minutos)** y **Restante (minutos)** — la duración y la duración restante en minutos; solo se rellenan en una tarea en horas.
- **Retraso de nivelación (minutos)** y **Retraso de nivelación transcurrido** — el retraso de nivelación de MS Project en minutos, y si cuenta en tiempo de reloj.
- **Programada manualmente** — indica si la tarea está programada manualmente.
- **Tipo de tarea de MS Project (importación)** y **Condicionada por el esfuerzo** — el tipo de tarea y la marca de condicionada por el esfuerzo tal como los tenía MS Project.
- **Origen de Primavera P6** — los campos de origen de un archivo de Primavera, como `key: value`.
- **Tarea de resumen explícita** — indica si la tarea es un resumen explícito sin subtareas (de un archivo de Primavera).
- **Suelo de fin con distribución temporal**, **Ancla de inicio con distribución temporal**, **Segmentos de duración con distribución temporal** y **Contornos con distribución temporal** — la distribución por horas de un archivo de MS Project, como fechas y recuentos.
- **Datos de códigos de actividad**, **Datos de campos personalizados** y **Datos de notas** — el número de asignaciones de códigos, campos personalizados y notas.
- **Datos de relaciones internas** y **Datos de relaciones externas** — el número de relaciones internas y externas.
- Por cada línea base, **Hito** y **Tipo de hito** también están aquí, tal como los registró la línea base.
