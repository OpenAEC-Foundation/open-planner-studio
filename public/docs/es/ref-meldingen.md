# Notificaciones y advertencias

La aplicación le informa de lo que ocurre en cuatro lugares: la barra de estado en la parte inferior, el panel *Advertencias* en la columna derecha, las notificaciones que aparecen brevemente en la parte inferior de la pantalla y las bandas bajo la cinta. Este artículo indica, para cada lugar, qué ve, cuándo aparece y qué puede hacer al respecto. El motivo por el que una planificación es crítica o tiene sobreasignación está en [Ruta crítica y holgura](docs://uitleg-kritiek-pad). Cómo resolver la sobreasignación está en [Resolver la sobreasignación](docs://howto-overbezetting-oplossen). Cómo crear relaciones está en [Crear relaciones](docs://howto-relaties-leggen).

## La diferencia entre los cuatro

- **Barra de estado** — una línea fija con contadores. Proceden del último cálculo y se mantienen hasta que vuelva a calcular.
- **Panel de advertencias** — la lista detrás de esos contadores, con todo lo que encontró el último cálculo. Al hacer clic, la aplicación le lleva a la tarea, la relación o el recurso. Se deriva del último cálculo; no se guarda nada.
- **Notificaciones** — mensajes breves sobre algo que acaba de hacer (error al guardar, relación rechazada, importación leída). Un mensaje informativo desaparece de nuevo; un error permanece hasta que lo cierre. No están en el panel.
- **Banda bajo la cinta** — una banda de color con una explicación y un botón. Pertenece a un estado del documento o de un modo y permanece mientras ese estado se aplique. Consulte *Las bandas bajo la cinta*.

## La barra de estado

La barra inferior muestra, de izquierda a derecha:

- **Tareas:** — el número de tareas hoja (las tareas de resumen no cuentan).
- **Hitos:** — el número de hitos.
- **Ruta crítica: N tareas, N días laborables** — el número de tareas críticas y la duración del proyecto. Solo es visible después de un cálculo.
- **Fin:** — la fecha de fin del proyecto según el cálculo. Solo es visible después de un cálculo; un proyecto vacío no tiene fin.
- **N fecha(s) límite incumplida(s)**, **N restricción(es) violada(s)**, **N relación(es) fuera de secuencia** y **N recurso(s) sobreasignado(s)** — cada uno es un botón con un signo de advertencia. Solo es visible cuando el contador es mayor que 0 y hay un cálculo. Al hacer clic se abre el panel *Advertencias* (información emergente: *Abrir el panel de advertencias (detalles y navegación)*). Si se encuentra en la pestaña *IFC* o *Informe*, la aplicación salta a *Inicio* al mismo tiempo, porque la columna derecha no existe allí. El contador *recurso(s) sobreasignado(s)* también se actualiza después de cambios en los recursos y las asignaciones. Los demás contadores solo cambian después de *Calcular*. Los cuatro contadores son una selección: lo que el panel muestra además (adelanto truncado, relación ignorada, hamaca sin driver de fin, fecha de fin limitada, error de planificación) no aparece en la barra de estado.
- **Desactualizada — recalcule (F5)** — con un signo de advertencia (información emergente: *Planificación desactualizada — recalcula (F5)*). Aparece en cuanto cambia algo que afecta a la planificación y todavía no ha recalculado. Si *Calcular automáticamente* está activado, no aparece, salvo que el cálculo dio un error. En ese caso sí aparece.
- **Selección: N tarea(s)** — el número de tareas seleccionadas. Solo es visible si hay una selección.
- **Escala:** y **Zoom: Npx/día** — la escala de tiempo de la línea de tiempo y el nivel de zoom. La escala depende del zoom.
- **Sin guardar** — mientras el documento tenga cambios que no están en el archivo.
- **IA** — un punto de color con la palabra IA, solo cuando el modo IA está activado. La información emergente dice *Puente IA:* con *Desactivado*, *Activo en el puerto N*, *Puerto N ocupado* o *Error*. Al hacer clic se abre la pestaña *IA*.
- **Terminal de depuración** — un botón de terminal, solo cuando la terminal de depuración está activada. Muestra u oculta la terminal (*Mostrar terminal de depuración* / *Ocultar terminal de depuración*).

## El panel de advertencias

- **Apertura** — *Planificación › Programación › Advertencias*, *Vista › Paneles › Advertencias*, o un contador de la barra de estado. El panel está en la columna derecha, debajo de *Propiedades* y del panel de recursos, y amplía una columna contraída. De forma predeterminada está cerrado y no se recuerda entre sesiones. Arrastre su altura por el borde cuando esté debajo de otros paneles; esa altura sí se recuerda. La cruz de la esquina superior derecha lo cierra (*Cerrar advertencias*).
- **Línea de encabezado** — *N error(es), N advertencia(s)*. Si todavía no se ha calculado nada, dice *Aún no calculado — pulse Calcular (F5) para ejecutar las comprobaciones*.
- **Calcular** — un botón en la línea de encabezado. Está visible mientras la planificación esté desactualizada o todavía no se haya calculado. Hace lo mismo que *Calcular* en la cinta.
- **Signo de advertencia en la línea de encabezado** — cuando la planificación está desactualizada, con la información emergente *Programación desactualizada — esta lista proviene del último cálculo. Recalcule (F5)*. La lista no se oculta; solo se marca como desactualizada.
- **Lista vacía** — *Sin advertencias. La programación supera todas las comprobaciones*.
- **Una línea** — arriba aparece el lugar (tarea, relación, recurso o proyecto) y debajo la descripción. Un error tiene su propio signo octogonal. Una advertencia tiene un signo triangular. Una tarea aparece como `WBS name`. Una relación aparece como `predecessor → successor (FS+2d)`, con tipo y desfase. Al hacer clic se va al lugar (información emergente *Ir a: …*); véase más abajo. La línea que corresponde a su tarea activa (en una relación, la de su sucesor) o al recurso elegido en el histograma queda resaltada.
- **Orden** — primero los errores. Después, por tipo, en el orden de la lista siguiente. Dentro de cada tipo, en el orden del documento (en una relación, el del sucesor; en un recurso, el de la lista de recursos). Una tarea, relación o recurso que se borró después del último cálculo desaparece de la lista.

### Tipos de advertencia

- **Error de planificación** — *No se pudo calcular la planificación: …*, con el motivo después; véase más abajo. Al hacer clic en un ciclo, la aplicación selecciona todas las tareas del ciclo y salta a la primera. En los demás errores no hay adónde saltar, y la línea no es un botón.
- **Fecha límite incumplida** — *Fecha límite {date} incumplida — fin más temprano {date}*. La tarea tiene una fecha límite y el cálculo no la cumple. Al hacer clic se salta a la tarea. Para corregirlo, ajuste la lógica o la duración, o mueva la fecha límite.
- **Restricción violada** — *La restricción {type and date} es sobrepasada por la lógica (holgura negativa)*. La restricción no se puede cumplir sin romper la lógica; la holgura es negativa. Al hacer clic se salta a la tarea. Véase [Restricciones](docs://uitleg-constraints).
- **Fuera de secuencia** — *Fuera de secuencia: el progreso del sucesor contradice la relación*. El avance del sucesor no encaja con el tipo de relación. Por ejemplo, un sucesor que ya está en curso mientras el predecesor todavía no ha terminado, con una relación fin-comienzo. Al hacer clic se seleccionan las dos tareas, con el sucesor activo. Compruebe las fechas reales o la relación.
- **Adelanto truncado** — *Adelanto truncado por el inicio del proyecto — la relación no se respeta por completo*. El adelanto (desfase negativo) de la relación llega antes del inicio del proyecto. Al hacer clic se seleccionan las dos tareas.
- **Relación ignorada** — *Relación ignorada: el predecesor o el sucesor falta o no es una tarea hoja*. El cálculo no usa la relación. Al hacer clic se seleccionan las tareas que todavía existen. Véase [Relaciones](docs://uitleg-relaties).
- **Hamaca sin driver de fin** — *Hamaca sin driver de fin (sin predecesor FF/SF): su duración vuelve a cero*. Al hacer clic se salta a la tarea. Véase [Tareas hamaca](docs://howto-hammock).
- **Fecha de fin limitada** — *Fecha de fin limitada: el calendario no deja ninguna ventana laborable para esta tarea*. El cálculo alcanzó el límite de días que busca, por ejemplo por un periodo muy largo de días libres seguidos en el calendario. Al hacer clic se salta a la tarea. Véase [Calendarios y días laborables](docs://uitleg-kalenders).
- **Sobreasignación** — *Sobreasignado durante N día(s) (primero – último)*, con *el recurso no trabaja estos días según su calendario* si todos los días son libres. Si es una combinación, se añade *de los cuales N día(s) el recurso no trabaja según su calendario*. Al hacer clic se seleccionan las tareas con una asignación a ese recurso, se activa el histograma y se elige ese recurso en él. Desde *Tabla*, *IFC* o *Informe*, la aplicación salta a *Recursos*. Véase [Panel de recursos](docs://ref-resourcepaneel).

### Motivos de un error de planificación

- *Relación circular entre tareas: {path}* — las relaciones forman un ciclo. Las tareas aparecen en la ruta. Invierta o elimine una relación.
- *El calendario no tiene días laborables configurados* — dé al calendario al menos un día laborable. Véase [Ventanas de calendario](docs://ref-kalenders).
- *Duración en días no válida para la tarea '{task}'* y *Duración en horas no válida para la tarea '{task}'* — la duración de la tarea no es un número válido.
- *La tarea horaria '{task}' no tiene un horario laboral válido en su calendario* — una tarea en horas en un calendario sin horario laboral.
- *Fecha de inicio no válida para la tarea '{task}'* — la fecha de inicio de la tarea no es válida.

## Las bandas bajo la cinta

Una banda se sitúa directamente debajo de la cinta, encima del espacio de trabajo. Tiene un texto y un botón. Una banda de modo no tiene cruz; las demás se cierran con la cruz. Las cinco bandas:

- **Modo enlace** — *Modo enlace: arrastre de una barra a otra en el Gantt para crear una relación. Esc para detener*. Permanece mientras el modo enlace esté activado. Botón: *Detener*. Consulte [Crear relaciones](docs://howto-relaties-leggen).
- **Modo división** — *Haga clic en una barra en el día en que empieza la interrupción y arrastre a la derecha para su duración. Esc para detener*. Permanece mientras *Dividir tarea* esté activado. Botón: *Detener*.
- **Planificación por horas en el archivo** — *Este archivo contiene planificación por horas*. Aparece cuando un archivo abierto contiene planificación por horas y *Activar planificación por horas* está desactivado. Botón: *Activar planificación por horas*. Consulte [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).
- **Estructura bloqueada** — *No disponible mientras se filtra/agrupa/ordena*. Aparece cuando se rechaza aplicar sangría o anular sangría porque la tabla de tareas está filtrada, agrupada u ordenada. Botón: *Borrar*, que quita el filtro, la agrupación y la ordenación.
- **Fechas tal como se guardaron** — tras abrir un archivo en el que el recálculo movió fechas: *El recálculo desplazó N de M tareas de las fechas del archivo.* con el botón *Mostrar fechas guardadas*. Mientras la vista está activada: *Está viendo las fechas tal como se guardaron en el archivo …* con el botón *Recalcular*. Consulte [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen).

## Notificaciones

Las notificaciones aparecen en la parte inferior de la pantalla, también en la tabla, en Backstage y en el modo de presentación. Una notificación es un *error* o una *información*. Un error es rojo y permanece hasta que pulse la cruz; una información desaparece tras 5 segundos (una notificación con mucha explicación permanece más tiempo), y esos temporizadores vuelven a empezar en cuanto cambia la pila. Cada notificación tiene una cruz arriba a la derecha (texto emergente *Cerrar notificación*) que la cierra de inmediato. Si pulsa el texto de la notificación, no pasa nada. Un rechazo es siempre un error: una notificación que indica que la aplicación no ha realizado algo que usted hizo, por ejemplo una relación, una duración, un inicio o un hito rechazados. Así no se le pasa aunque aparte la vista un momento. Un rechazo sí desaparece tras Ctrl+Z o Ctrl+Y y al pasar a otro documento, porque entonces ya no es correcto. Otro error, como *No se pudo guardar*, permanece. Esto también vale si el resto de la misma acción sí se realizó, por ejemplo al pegar en varias celdas. Si intervienen varias tareas, una línea debajo indica qué tareas no se han modificado, por ejemplo *No se ha modificado: Foundation, Masonry.* Con más de cinco, termina con *y N tareas más*. Si se repite el mismo rechazo, se agrupa en una línea con un contador. Se muestran tres como máximo a la vez. Si llega una cuarta, primero desaparece la información más antigua. Si no hay información, desaparece primero el rechazo más antiguo, después la notificación fija de apertura más antigua y solo entonces el error más antiguo. Así, una información o un rechazo nunca desplaza a otro error, como *No se pudo guardar*. La pila se aparta de los botones de un cuadro de diálogo abierto y de las barras de acciones fijas. Una notificación al abrir un archivo también permanece hasta que pulse la cruz si la aplicación completó, sustituyó, reparó u omitió datos al abrirlo: una línea sobre hallazgos del analizador o del calendario, problemas de formato numérico, alternativas de enumeración, ajustes de planificación P6 con una alternativa segura, una alternativa protectora para la línea base, referencias de línea base ignoradas, actividades sin inicio planificado a las que se dio un inicio, relaciones entre proyectos o actividades sin proyecto que no se importaron (P6 XML), algo de un archivo de MS Project que no se importó (XML de MS Project y `.mpp`) o un archivo de origen XER no utilizable, y las notificaciones sobre ids duplicados y relaciones que no se calculan. Si solo contiene información sin ese cambio (por ejemplo el número de proyectos, documentos o la codificación de texto), la notificación desaparece tras 5 segundos.

- **Contador ×N** — una notificación con clave fija agrupa una repetición en una línea con un contador, por ejemplo un error al guardar que vuelve a aparecer o una relación rechazada que repite. No todas las notificaciones hacen esto.
- **Leer más** — algunas notificaciones tienen un enlace *Leer más* o un tema propio (por ejemplo *Tipos de tarea explicados*) hacia la guía en Backstage › Ayuda.
- **Botón de acción** — la notificación sobre el perfil de cálculo tiene un botón *Abrir perfil de cálculo* que lleva a Información del proyecto.

La lista siguiente es una selección, agrupada por tema. Si no se indica lo contrario, es una información.

### Guardar, abrir y recuperar

- **Error al guardar** (error) — *No se pudo guardar* con el motivo debajo. Al guardar, al usar *Guardar como* y al exportar un informe.
- **Guardado como descarga** (información) — *Guardado como descarga: «{name}» ya está en su carpeta de descargas. …* Con *Guardar como* y las exportaciones, cuando el entorno no permite que la aplicación escriba directamente en la ubicación elegida. Dos descargas seguidas se agrupan.
- **Guardado como descarga (explicación)** (información, 15 segundos) — *Guardado como descarga: «{name}» está en su carpeta de descargas. Este navegador no permite que la aplicación escriba en un lugar propio, …* Con *Guardar* en un navegador que solo guarda mediante una descarga. Una vez por sesión, con un enlace a la explicación de los archivos.
- **El navegador no vuelve a escribir** (información, 15 segundos) — *Este navegador no permite que la aplicación vuelva a escribir en «{name}». …* Con *Guardar* de un proyecto que tiene un archivo, cuando el navegador tiene que volver a pedir una ubicación. Una vez por sesión, con un enlace a la explicación de los archivos.
- **Error de guardado automático** (error) — *Error de guardado automático* con el motivo. Se aplica al guardado automático en el archivo y a la recuperación tras un fallo.
- **No se pudo guardar la biblioteca** (error) — *No se pudo guardar la biblioteca*, al guardar la biblioteca de recursos.
- **Error al abrir un archivo** (error) — *No se pudo abrir el archivo* con el motivo. Por ejemplo, un archivo reciente o un archivo importado.
- **.mpp antiguo o protegido** (error) — *Este archivo .mpp usa un formato anterior (Project 2007 o anterior)…* o *Este archivo .mpp está protegido con contraseña…*, ambos con el consejo de exportarlo como XML en MS Project y abrir ese archivo.
- **Archivo XER no válido** (error) — uno de los textos *XER…*, por ejemplo *Este archivo XER no es válido o compatible.* o *El archivo XER contiene una tabla duplicada.*, con el motivo añadido.
- **No se pudo leer el IFC** (error) — *No se pudo leer el IFC* con el motivo, en la vista IFC.
- **Recuperación** (error) — *No se pudo leer el archivo recuperado*, *No se pudo restaurar* y *N archivos de recuperación no se pudieron cargar y se omitieron.* Al recuperar tras un cierre inesperado.
- **Rama guardada como plantilla** (información) — *Rama guardada como plantilla «{name}»*.
- **Mensaje de una extensión** (información, o error si la extensión informa de un error) — *Extensión {name}: {message}*. Una extensión puede mostrar tres nuevos como máximo cada 10 segundos, para que no llene la pila. Si falla un paso de la guía de una extensión, aparece *Un paso de la extensión {name} ha fallado. La guía continúa.*, y si no se puede abrir un archivo de proyecto de una extensión, *No se pudo abrir el archivo de proyecto {file} de la extensión {name}.* Ambos son errores.
- **Entretanto llegó un cambio** (error) — *Entretanto llegó un cambio del asistente de IA o de una extensión. …* Al cancelar el cuadro de diálogo de tarea mientras la IA o una extensión cambió algo entretanto: las ediciones de tarea anteriores a ese cambio no se deshacen y siguen como pasos normales en *Deshacer*.

### Cálculo

- **No se pudo calcular la planificación** (error) — *No se pudo calcular la planificación* con el motivo debajo (véase *Motivos de un error de planificación*). Al pulsar *Calcular*, al cambiar de documento y al abrir un archivo.
- **Fecha de estado fijada en hoy** (información) — *Fecha de estado fijada en hoy ({date}).* Al introducir avance en un proyecto sin fecha de estado. La aplicación mide el avance hasta la fecha de estado, así que sin fecha de estado no puede procesar el avance. Puede fijar otra fecha en *Planificación › Líneas base y progreso › Fecha de estado*. Con un enlace *Leer más* a [Avance, fecha de estado y línea base](docs://uitleg-voortgang).
- **Duración menor que el trabajo realizado** (error) — *«{name}» ya está hecha en un {N} %: una duración menor que el trabajo ya realizado no es posible. La duración no se ha cambiado*.

### Relaciones y jerarquía

- **Relación rechazada** (error) — *Esa relación ya existe*, *No se permite una relación entre una tarea y su propia tarea de resumen antecesora.* o *Esta relación crearía un ciclo en la planificación ({cycle}) y no se ha creado.* El ciclo indica las tareas, así sabe qué relación debe eliminar o invertir primero.
- **Traslado rechazado** (error) — *Este traslado crearía un ciclo en la planificación ({cycle}): las relaciones de una tarea de resumen también se aplican a sus subtareas. No se ha movido nada.*
- **Relaciones que dejan de contar tras un traslado** (información) — *Tras el traslado, N relaciones vinculan una tarea con su propia tarea de resumen antecesora; ya no se tienen en cuenta en el cálculo*.
- **Relaciones omitidas al insertar** (error) — *N relaciones no se han creado: vínculo no válido…*, al pegar o insertar una rama. Una línea debajo indica qué relaciones, por ejemplo *No se ha creado: Foundation → Masonry.*
- **Relaciones no contadas tras importar** (información) — *N relación(es) no se pudieron incluir en el cálculo. Revise las columnas Predecesores y Sucesores*.
- **Ids duplicados tras importar** (información) — *Objetos con un id duplicado en este archivo: N. Se les asignó un id propio…*

### Editar tareas

- **Inicio registrado como restricción** (información) — *«{name}» no comienza antes del {date} (SNET).* Al cambiar el inicio de una tarea con un predecesor. El predecesor determina el inicio, así que la aplicación registra su fecha como una restricción *no comenzar antes del (SNET)*. Tras recalcular (F5), la tarea no comenzará antes de esa fecha. Si la tarea ya tenía esa restricción, aparece *«{name}» ahora no comienza antes del {date} (SNET).*; para varias tareas a la vez indica un recuento. Con un enlace *Leer más* a [Restricciones y fechas límite](docs://uitleg-constraints).
- **Inicio no aplicado** (error) — *No se ha aplicado el nuevo inicio de «{name}»: la tarea tiene un predecesor y la restricción {type} {date}, y ambos determinan su inicio. Cambie esa restricción para mover el inicio.*
- **Hito rechazado** (error) — *«{task}» tiene asignaciones de recursos y no puede convertirse en hito. Elimine primero las asignaciones.* o *«{task}» es una tarea de resumen con subtareas y no puede convertirse en hito.* Al convertir en el cuadro de diálogo de tarea, en el panel de propiedades, en el menú contextual y en la tabla.
- **Asignaciones movidas a una subtarea** (información) — *Asignación movida a la subtarea «{child}».* o *N asignaciones movidas a la subtarea «{child}».* Cuando una extensión da subtareas a una tarea con asignaciones. Esa tarea pasa a ser tarea de resumen, y una tarea de resumen no lleva asignaciones por sí misma. Por eso se mueven a la primera subtarea nueva. En la propia aplicación usted elige esto en la ventana *La tarea pasa a ser tarea de resumen*; este mensaje no aparece. Con un enlace *Leer más* a [Ajustar la estructura](docs://howto-structuur-aanpassen).
- **Marca de hito quitada** (información) — *«{phase}» ya no es un hito.* Cuando un hito recibe subtareas. Un hito es un momento sin subtareas; con subtareas pasa a ser una tarea de resumen. Con un enlace *Leer más* a [Ajustar la estructura](docs://howto-structuur-aanpassen).
- **Pregunta caducada** (error) — *Las tareas o asignaciones han cambiado mientras la pregunta estaba abierta. No se ha modificado nada; vuelva a intentarlo.* Al elegir en la ventana *La tarea pasa a ser tarea de resumen*, pero la pregunta ya no coincide.
- **Tarea de resumen rechazada** (error) — *«{phase}» no puede pasar a ser tarea de resumen: …* con el motivo, y *No se ha modificado nada.* Cuando una extensión da subtareas a una tarea con asignaciones y estas no pueden pasar a la primera subtarea nueva. En la propia aplicación este mensaje no aparece: allí la ventana *La tarea pasa a ser tarea de resumen* pregunta qué hacer, y *Mover* queda desactivado.
- **Celdas omitidas al pegar** (error) — *Se omitieron N celdas: son de solo lectura (por ejemplo, un código WBS numerado automáticamente o una columna calculada).*
- **Referencias borradas al pegar** (información) — *N referencias no existían en este documento y se han borrado (calendarios de tarea, categorías de trabajo personalizadas, códigos de actividad o campos personalizados del documento de origen).*
- **Estructura bloqueada** (error, franja roja debajo de la cinta) — *No disponible mientras se filtra/agrupa/ordena*, con el botón *Borrar*. Mientras la lista está filtrada, agrupada u ordenada: al aplicar sangría, al anular sangría y al arrastrar, y con *Insertar arriba* e *Insertar debajo* (menú contextual o atajo de teclado). La franja permanece hasta que pulse la cruz, use Ctrl+Z o Ctrl+Y, o pase a otro documento. Véase [Ajustar la estructura](docs://howto-structuur-aanpassen).
- **Tarea añadida al final** (error) — *La nueva tarea se ha añadido al final. Durante el filtrado, la agrupación o la ordenación, la aplicación no puede colocarla debajo de su selección.* Con el botón *Borrar*. Con *Tarea* y *Hito ▾* mientras hay una tarea seleccionada y la lista está filtrada, agrupada u ordenada. La tarea se añade, pero abajo del todo. *Borrar* quita el filtro, la agrupación y la ordenación, y cierra la notificación. Véase [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen).
- **El tipo de tarea ajustó duraciones** (información) — *Tras el cambio de calendario, el tipo de tarea ajustó la duración de N tareas (el trabajo se mantiene, cambiaron las horas por día).* Con un enlace *Tipos de tarea explicados*.

### Primavera P6 XML

- **Archivo P6 XML abierto** (información) — *Archivo P6 XML abierto: N documentos de proyecto.* Tras abrir un archivo P6 XML.
- **No importado** (permanece) — *N relaciones entre proyectos no se han importado como relaciones.* y *N actividades sin proyecto no se han leído.* Compruebe si su planificación está completa.
- **Vacío o no utilizable** (error) — no se abre nada. Tres motivos: *Este archivo no contiene actividades que la aplicación pueda leer.*, *Las actividades no tienen ObjectId. …* y *El archivo usa nombres de columna XER … Abra el propio archivo .xer.*

### Primavera (XER)

- **Archivo XER abierto** (información) — *Archivo XER abierto: N documentos de proyecto.* Una notificación por archivo, aunque el archivo abra varios proyectos, con un enlace *Leer más* y líneas de detalle debajo. Siempre *N proyectos encontrados.* Solo cuando el número es mayor que 0: *N proyectos vacíos omitidos.*, *N proyectos de línea base excluidos.*, *N líneas base materializadas.*, *N referencias de línea base sin destino ignoradas.*, *Se usó una alternativa protectora para la línea base.* y *N relaciones externas conservadas.* Solo para una codificación distinta de UTF-8: *Codificación de texto elegida: {encoding}.* Además, cuando el número es mayor que 0: *N hallazgos del analizador.*, *N hallazgos del calendario.*, *N problemas de formato numérico.*, *N alternativas de enumeración.* y *N ajustes de planificación P6 usaron alternativas seguras.*
- **Fechas tal como las registró Primavera** (línea de detalle en la misma notificación) — *N tareas muestran las fechas tal como las registró Primavera (sin recalcular).* N cuenta cada tarea para la que el archivo registró fechas, también las que no difieren. O, si el modo no se activó, *N tareas difieren de las fechas del archivo; puede mostrarlas.*
- **Archivo de origen XER no utilizable** (información) — *El archivo de origen XER de este fichero no se puede usar y se ha omitido; el proyecto en sí se ha abierto por completo.* con el motivo (por ejemplo *Motivo: la suma de comprobación no coincide con los bytes de origen: el archivo está dañado.*) y la consecuencia (*La planificación, el perfil de cálculo y todos los datos del proyecto del IFC están completos. …*). Al abrir un archivo IFC en el que no se puede usar un archivo de origen XER guardado antes. También al restaurar tras un cierre inesperado, si el almacenamiento de recuperación ya no contiene el archivo de origen.
- **La exportación pierde información XER** (información) — *Al exportar a {format} se pierde información de origen XER.* Tras una exportación correcta a un formato distinto de IFC de un proyecto con datos que solo existen en un archivo XER. Con un enlace *Leer más*.

### Importar, exportar y perfil de cálculo

- **Fechas como en el archivo** (información) — *N tareas muestran las fechas tal como están registradas en el archivo (sin recalcular).* (N cuenta cada tarea con fechas registradas) o *N tareas difieren de las fechas del archivo; puede mostrarlas.* Al abrir un archivo con fechas registradas.
- **Trabajo y tipos de tarea visibles** (información) — *Este archivo contiene trabajo guardado o tipos de tarea; el tipo de tarea y el trabajo restante se muestran para este proyecto.*
- **Planificación de MS Project leída** (información) — *Este archivo de MS Project contiene N tareas con una planificación dividida, nivelada o determinada por recursos. Se importan y se muestran tal cual.*
- **Interrupciones no exportadas** (información) — *N tareas con interrupciones se han exportado sin sus interrupciones: MS Project/P6 solo las conocen como distribución del trabajo*. Al exportar a MS Project o Primavera.
- **Inicio del proyecto movido** (información) — *N tareas se movieron con el inicio del proyecto.* Al fijar el inicio del proyecto más tarde. Solo se mueven a esa fecha las tareas sin predecesor y sin restricción que quedarían antes de la nueva fecha de inicio. Con un enlace *Leer más* a [Nuevo proyecto e Información del proyecto](docs://ref-projectinfo).
- **La ventana de fechas ya no dirige** (información) — *La ventana de fechas de MS Project ya no determina N tareas tras esta edición; …* Una vez por documento.
- **Retraso de nivelación redondeado** (información) — *La nivelación redondea el retraso de nivelación de MS Project, preciso al minuto, de N tareas a días laborables completos.* Una vez por documento.
- **Perfil de cálculo aplicado** (información) — *Este proyecto calcula como {profile}. Cámbielo en Archivo → Información del proyecto → Perfil de cálculo y opciones.* Con el botón *Abrir perfil de cálculo*. Tras aplicar un perfil, si hace falta, sigue *Tras aplicar, se movieron N tareas.*
