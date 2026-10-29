# Perfiles de cálculo y convenciones

La misma planificación puede producir fechas distintas, según las reglas de cálculo que aplique. Este artículo explica por qué Primavera P6 y Microsoft Project calculan de forma distinta en algunos puntos, cómo la aplicación guarda esa diferencia en un **perfil de cálculo** y en qué se diferencia un perfil de las opciones de cálculo que usted define por proyecto. Un ejemplo práctico con una red pequeña muestra qué efecto tiene esto en las fechas.

## El concepto

Las tareas, las relaciones y un calendario determinan la mayor parte de una planificación, pero no todo. ¿Qué pasa con el trabajo que no se ha iniciado cuando se define una fecha de estado? ¿Dónde empieza el trabajo restante de una tarea que ya está en curso? ¿Cuál es la holgura libre de una tarea cuando no se cumple una fecha límite? La red no dice nada al respecto. Un paquete de planificación tiene que elegir una regla para ello. La aplicación conoce varios puntos en los que la regla de Primavera P6 y la de Microsoft Project difieren.

La aplicación llama **convención** a esa elección. Un **perfil de cálculo** es el conjunto de convenciones que pertenece a un paquete. La aplicación tiene tres:

- *Open Planner Studio*: el perfil con el que calcula un proyecto nuevo. Ninguna convención está activada.
- *Primavera P6*: las convenciones que la aplicación conoce de P6.
- *Microsoft Project*: las convenciones que la aplicación conoce de Microsoft Project.

Así, el perfil indica cómo calcula un paquete. Lo que usted quiere para su proyecto no forma parte de él. Eso son las **opciones de cálculo**: elecciones como a partir de qué holgura una tarea se vuelve crítica, o en qué calendario cuenta un desfase. Usted define esas opciones por proyecto.

## Cómo calcula la aplicación

### Convenciones y opciones de cálculo

Una convención es un interruptor: activado o desactivado. El perfil decide qué interruptores están activados. Una opción de cálculo es una elección que usted hace. Puede ver la diferencia en la propia aplicación, en el bloque *Perfil de cálculo y opciones*:

- **Las convenciones** están en *Convenciones de este perfil*, agrupadas por tema, por ejemplo *Avance y trabajo completado*, *Relaciones y desfase* y *Holgura y fechas tardías*. Al principio, este apartado está plegado. Su encabezado indica cuántas convenciones hay y, si el perfil se desvía, una etiqueta *cambiado: 1*. Haga clic en el encabezado para desplegarlo. Con un perfil integrado, cada línea tiene una etiqueta *Activada* o *Desactivada*. Esos valores son solo informativos y no se pueden cambiar. Con un perfil personalizado, cada línea tiene una casilla de verificación, con el valor base detrás (*base: activada* o *base: desactivada*). Si su elección es distinta, la línea destaca y aparece *volver a la base*. El icono i detrás de una línea muestra la explicación de esa convención. Señale el icono con el ratón, llegue a él con la tecla Tab o púlselo. Lea primero esa explicación si quiere cambiar una convención. Si una convención solo funciona con planificación por horas, o solo con tareas de un archivo .xer, una etiqueta azul al lado lo indica: *solo con planificación por horas* o *solo tareas de .xer*. Planificación por horas significa: un calendario con bandas de tiempo laborable, una tarea cuya duración está en horas, o el *Calendario de retraso* en *24 horas*. Un proyecto con solo un calendario de días y tareas en días no nota nada de una convención marcada como *solo con planificación por horas*, salvo que el *Calendario de retraso* esté en *24 horas*. En ese caso, un desfase cuenta en horas, y una convención sobre el desfase puede cambiar algo.
- **Las opciones de cálculo** están en *Opciones de cálculo de este proyecto*: entre otras *Definición de crítico*, *Cálculo de holgura*, *Tareas de extremo abierto críticas*, *Marcar casi crítico* y *Calendario de retraso*. Indican lo que usted quiere para este proyecto, no cómo calcula un paquete. Lo que hacen se explica en [Ruta crítica y holgura](docs://uitleg-kritiek-pad) y [Relaciones y desfase](docs://uitleg-relaties).

Un ejemplo de cada una. «Una tarea es crítica si su holgura total es 0 o menos» es una opción de cálculo: usted puede fijar el umbral en 4, y entonces todo lo que tenga 4 días laborables de holgura o menos es crítico. «El trabajo que no ha empezado se mueve a la fecha de estado» es una convención: Open Planner Studio y Primavera P6 lo hacen, Microsoft Project no.

El perfil y las opciones de cálculo pertenecen al archivo del proyecto, no a la aplicación. Si guarda el proyecto, viajan con él. Por tanto, dos proyectos en la misma aplicación pueden calcular con un perfil distinto. Un proyecto sin perfil calcula como Open Planner Studio.

Si su proyecto viene de un archivo .xer, el bloque muestra además, al final, *Ajustes del archivo de origen*: opciones de cálculo que solo conoce Primavera y que el archivo trajo consigo. Aquí no puede cambiarlas. Tampoco las cambian el botón de la configuración predeterminada ni el de otro perfil. Un proyecto nuevo no las tiene, ni siquiera con *Primavera P6*.

### Dónde elige el perfil

En un proyecto nuevo, el perfil está en la ventana *Nuevo proyecto*, que abre con *Inicio › Archivo › Nuevo*. Allí, *Perfil de cálculo* es una lista desplegable. Si elige un perfil allí, la aplicación sustituye las opciones de cálculo que ya había rellenado por los valores predeterminados de ese perfil; solo se conservan los ajustes de un archivo de origen. Con *Primavera P6*, *Cálculo de holgura* pasa a ser *Holgura de fin*. Con *Microsoft Project* y *Open Planner Studio*, todas las opciones de cálculo tienen su valor predeterminado, así que *Cálculo de holgura* es *Automático (predeterminado)*. Con una fecha de estado, así también calcula MS Project: una tarea iniciada recibe la holgura de fin, y cada otra tarea recibe la menor de la holgura de inicio y la de fin.

En un proyecto existente, elija el perfil en *Configuración › Proyecto › Ajustes del proyecto*, en el bloque *Perfil de cálculo y opciones*, en la lista desplegable *Perfil de cálculo*. También puede llegar al mismo lugar por *Archivo › Ajustes del proyecto*. Si cambia el perfil aquí, solo cambian las convenciones. Sus opciones de cálculo se quedan como están. Si sus opciones de cálculo son distintas de la predeterminada del perfil, un bloque naranja encima de las opciones lo indica. A menudo es a propósito, por ejemplo porque las opciones vienen del archivo abierto. Si de todos modos quiere la configuración predeterminada, elija *Usar la configuración predeterminada de …* en ese bloque. La cruz oculta el bloque para este archivo abierto.

Mientras no pulse *Aplicar*, el cambio existe solo en el formulario. Con *Aplicar*, la aplicación recalcula la planificación de inmediato, incluso si *Calcular automáticamente* está desactivado. Si se movieron tareas, indica cuántas, por ejemplo *Tras aplicar, se movieron 4 tareas.* Todo el cambio es un solo paso para *Deshacer*. Si pulsa *Deshacer* o *Rehacer* mientras *Ajustes del proyecto* está abierto, el bloque sigue el estado del proyecto. Si ya había cambiado algo en el bloque, su elección se mantiene y un bloque amarillo indica que *Aplicar* restablece esa elección.

Los tres perfiles integrados no se pueden cambiar. Para cambiar otras convenciones, cree un perfil personalizado; también puede guardarlo como plantilla para otros proyectos de esta aplicación. El proyecto siempre lleva su propia copia: si cambia la plantilla más adelante, el proyecto no cambia con ella. Los pasos están en [Elegir o crear un perfil de cálculo](docs://howto-rekenprofiel-kiezen).

### Cuándo elige la aplicación un perfil

Al abrir un archivo, la aplicación sugiere un perfil según el formato:

- Un archivo .mpp (Microsoft Project) se abre con el perfil *Microsoft Project*.
- Un archivo .xer (Primavera P6) se abre con el perfil *Primavera P6*.
- Un archivo en formato *MS Project XML*, *Primavera P6 XML* o *CSV (separado por punto y coma)* se abre con *Open Planner Studio*, sin mensaje de perfil.
- Su propio proyecto (.ifc) se abre con el perfil guardado en él.

Con un archivo .mpp o .xer, la aplicación indica el perfil: *Este proyecto calcula como Microsoft Project. Cámbielo en Archivo → Información del proyecto → Perfil de cálculo y opciones.* El botón *Abrir perfil de cálculo* del mensaje lleva directamente a *Ajustes del proyecto*. Con un archivo .xer, esta línea es la primera línea de detalle del mensaje de apertura del archivo. Más información sobre el mensaje está en [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen) y [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen).

Con un archivo .mpp, la aplicación solo fija el perfil. Las opciones de cálculo quedan vacías, igual que en un proyecto nuevo con el perfil *Microsoft Project*: *Cálculo de holgura* es *Automático (predeterminado)*. Un archivo .mpp abierto y un proyecto nuevo con *Microsoft Project* calculan, por tanto, la holgura de la misma forma.

## Ejemplo práctico: una red, tres perfiles

El ejemplo es una red pequeña. El calendario tiene una semana laborable de lunes a viernes y ningún día no laborable en estas semanas. El modo de progreso es Retained Logic (el predeterminado). El proyecto empieza el lunes 7 de junio de 2027. Todas las tareas se expresan en días laborables.

- *Pour foundation*: 5 días laborables, planificada desde el lunes 7 de junio.
- *Lay walls*: 5 días laborables, después de *Pour foundation* (fin-comienzo).
- *Order window frames*: 3 días laborables, sin predecesor, planificada desde el lunes 7 de junio.
- *Fit roof*: 2 días laborables, después de *Lay walls* y después de *Order window frames*. El fin de esta tarea es la entrega.

Los números se calcularon con el motor de cálculo de la aplicación. Los consulta en el panel *Propiedades*, en *Resultado CPM*.

**Sin fecha de estado y sin avance, los tres perfiles calculan esta red igual.** *Pour foundation* va del lunes 7 al viernes 11 de junio, *Lay walls* del lunes 14 al viernes 18 de junio y *Fit roof* el lunes 21 y el martes 22 de junio. La entrega es el martes 22 de junio. *Order window frames* (del lunes 7 al miércoles 9 de junio) tiene 7 días laborables de holgura total.

Ahora registra el estado. La fecha de estado es el miércoles 9 de junio. La tarea *Pour foundation* empezó el lunes 7 de junio y tiene un avance del 60 %. Por tanto, el trabajo restante son 2 días laborables (5 × 40 %). *Order window frames* no ha empezado. Cómo funcionan [el avance y la fecha de estado](docs://uitleg-voortgang) se explica en ese artículo. Aquí la pregunta es qué hace el perfil con ello.

### Open Planner Studio

El trabajo restante de *Pour foundation* empieza en la fecha de estado: miércoles 9 y jueves 10 de junio. El inicio temprano sigue siendo el inicio real, el lunes 7 de junio. El fin temprano es el jueves 10 de junio. *Lay walls* va del viernes 11 al jueves 17 de junio y *Fit roof* el viernes 18 y el lunes 21 de junio.

*Order window frames* estaba planificada para el lunes 7 de junio, pero no ha empezado. El trabajo que no ha empezado no puede quedar en el pasado. Por eso la aplicación lo mueve a la fecha de estado: del miércoles 9 al viernes 11 de junio, con 4 días laborables de holgura total. La entrega es el lunes 21 de junio.

### Primavera P6

Todo es igual que en Open Planner Studio, salvo un punto: el inicio temprano de *Pour foundation* es el miércoles 9 de junio. Es el inicio del trabajo restante, no el inicio real. Lo hace la convención *Tarea en curso: inicio temprano = inicio del trabajo restante*, en el grupo *Avance y trabajo completado*. El fin y la holgura no cambian por ello. La entrega es el lunes 21 de junio.

### Microsoft Project

Aquí las fechas son distintas. Dos convenciones del grupo *Avance como en Microsoft Project* lo causan.

*No mover las tareas no iniciadas a la fecha de estado*: *Order window frames* se queda del lunes 7 al miércoles 9 de junio, aunque parte de ese tramo queda antes de la fecha de estado. La holgura total es de 7 días laborables.

*El trabajo restante se reanuda tras la duración transcurrida*: el trabajo restante empieza como muy pronto en la fecha de estado, y no antes del inicio real más el tiempo ya transcurrido. Con el 60 % de 5 días laborables, 3 días laborables ya están hechos. El lunes 7 de junio más 3 días laborables es el jueves 10 de junio. Eso es posterior a la fecha de estado, así que el trabajo restante va el jueves 10 y el viernes 11 de junio. *Lay walls* va del lunes 14 al viernes 18 de junio y *Fit roof* el lunes 21 y el martes 22 de junio. La entrega es el martes 22 de junio: un día laborable más tarde que en los otros dos perfiles.

### ¿Qué pasa si?

**La tarea *Pour foundation* está al 20 % en lugar del 60 %.** El trabajo restante son entonces 4 días laborables. Con los tres perfiles, *Pour foundation* termina el lunes 14 de junio y la entrega es el miércoles 23 de junio. La convención de Microsoft Project para el trabajo restante no cambia nada aquí: el lunes 7 de junio más 1 día laborable transcurrido es el martes 8 de junio, y eso es antes de la fecha de estado. Una convención así es un límite inferior que solo puede hacer el trabajo restante más tarde. *Order window frames* y el inicio temprano con Primavera P6 siguen siendo distintos, como antes. Con Microsoft Project, *Order window frames* tiene entonces 8 días laborables de holgura total.

**Solo define una fecha de estado y no introduce avance.** Con Open Planner Studio y Primavera P6, toda la red se mueve al miércoles 9 de junio. La tarea *Pour foundation* va entonces del miércoles 9 al martes 15 de junio y la entrega pasa a ser el jueves 24 de junio: dos días laborables más tarde que sin fecha de estado. Con Microsoft Project, todo se queda donde estaba y la entrega es el martes 22 de junio.

**Usted crea un perfil propio.** Con Open Planner Studio, cree un perfil personalizado con *Nuevo perfil* y *Copia de Open Planner Studio*, y active solo *No mover las tareas no iniciadas a la fecha de estado* en él. Con el avance del 60 %, *Pour foundation* conserva entonces las fechas de Open Planner Studio (fin el jueves 10 de junio, entrega el lunes 21 de junio). *Order window frames* sí se queda del lunes 7 al miércoles 9 de junio, con 6 días laborables de holgura total. Un perfil es, por tanto, un conjunto de interruptores separados, y puede cambiarlos uno por uno.

**Una opción de cálculo en lugar de una convención.** Si con Open Planner Studio fija *Definición de crítico* (*Holgura total ≤ umbral*) con un *Umbral (días laborables)* de 4, *Order window frames* pasa a ser crítica, porque su holgura total es exactamente 4. Ninguna fecha cambia. Una opción de cálculo es su elección para el proyecto y es independiente del perfil.

**Una fecha límite que no se cumple.** Asigne a *Fit roof* una fecha límite el viernes 18 de junio. Con Open Planner Studio, la holgura total de *Fit roof* es entonces −1 día laborable y la holgura libre también es −1. Con Primavera P6, la holgura total sigue en −1, pero la holgura libre pasa a ser 0. Eso es lo que hace la convención *Holgura libre nunca negativa*, en el grupo *Holgura y fechas tardías*. Con Microsoft Project ambas son −2, porque allí la entrega cae un día más tarde. Cómo funciona una fecha límite se explica en [Restricciones y fechas límite](docs://uitleg-constraints).

## Consecuencias y malentendidos

**«El perfil es una configuración de la aplicación.»** No. El perfil y las opciones de cálculo pertenecen al proyecto y se guardan en el archivo. Solo las plantillas que guarda pertenecen a la aplicación, y un proyecto siempre guarda su propia copia.

**«Si exporto, mi perfil sale con él.»** Solo con su propio formato de proyecto (.ifc). Si exporta a *MS Project XML*, *Primavera P6 XML* o *CSV (separado por punto y coma)*, el perfil no está en el archivo. De las opciones de cálculo, la exportación a MS Project XML escribe como máximo el umbral crítico. La aplicación solo avisa de esto en un proyecto que viene de un archivo .xer. Para un proyecto que usted mismo creó, no recibe ningún mensaje. El archivo se abre entonces como Open Planner Studio, sin mensaje de perfil. Tome el ejemplo con el perfil Microsoft Project y 60 % de avance. Si lo exporta a *MS Project XML* y lo vuelve a abrir, la aplicación muestra primero las fechas del archivo, con la entrega el martes 22 de junio. Si deja que la aplicación recalcule por sí misma, la fecha pasa a ser el lunes 21 de junio. Lo demás que pierde una exportación está en [Archivos y formatos](docs://uitleg-bestanden).

**«El perfil Primavera P6 da el mismo resultado que P6.»** La aplicación no puede garantizarlo. El perfil activa las convenciones que la aplicación conoce de P6, y no son todas las configuraciones de P6. Además de Retained Logic y Progress Override, P6 tiene un tercer modo de progreso, Actual Dates. La aplicación no lo conoce: un archivo .xer así se calcula como Retained Logic, y el mensaje de apertura lo indica, por ejemplo como *1 ajuste de planificación P6 usó una alternativa segura.* Algunas convenciones del perfil Primavera P6 también funcionan solo en tareas que vienen de un archivo .xer, como *LOE no iniciada toma la ventana objetivo* y *Mantener exactas las fechas reales*. Para algunas de ellas, la explicación lo dice: «solo tareas con procedencia P6». En las tareas que usted crea, esas convenciones no hacen nada.

**«El modo de progreso forma parte del perfil.»** No. Retained Logic o Progress Override es una elección aparte para cada proyecto. Se configura aparte del perfil. Puede verlo en [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen). Una convención de Primavera P6, *Progress Override ignora también hacia atrás un sucesor iniciado*, solo actúa con Progress Override.

**«Solo cambio de perfil para ver qué pasa.»** Puede hacerlo, porque *Aplicar* se deshace en un solo paso con *Deshacer*: perfil y fechas vuelven juntos. Pero las fechas sí pueden moverse de verdad. En el ejemplo, al cambiar de Open Planner Studio a Microsoft Project se mueven las 4 tareas. El mensaje las cuenta por usted. Revise la planificación después, antes de seguir. Si la aplicación sigue mostrando las fechas del archivo tras abrir un .xer o .mpp, al cambiar de perfil esa vista se cierra y la aplicación calcula por sí misma. Cómo funciona eso está en [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen).

**El ejemplo muestra cuatro convenciones, y la lista de la aplicación es más larga.** Cada línea del bloque tiene su propia explicación. Léala primero. Mire también el grupo *Solo para perfiles propios*: esas convenciones están desactivadas en todos los perfiles integrados, incluido Primavera P6. Solo un perfil propio puede activarlas: cree uno con *Nuevo perfil*.

## Véase también

- [Elegir o crear un perfil de cálculo](docs://howto-rekenprofiel-kiezen): elegir, cambiar o crear un perfil.
- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): qué hacen la fecha de estado y el trabajo restante, con las diferencias por perfil.
- [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen): elegir Retained Logic o Progress Override.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): las opciones de cálculo para lo crítico y la holgura.
- [Relaciones y desfase](docs://uitleg-relaties): la opción de cálculo *Calendario de retraso*.
- [Archivos y formatos](docs://uitleg-bestanden): qué lleva una exportación y qué no.
- [Exportar](docs://howto-exporteren): exportar un proyecto.
- [Actualizar el avance](docs://howto-voortgang-bijwerken): introducir el porcentaje, el inicio real y la fecha de estado.
- [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen): por qué las fechas importadas pueden diferir de lo que la aplicación calcula por sí misma.
- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): todas las convenciones y opciones de cálculo en una sola lista.
