# Formatos de importación y exportación

Por formato de archivo: si puede abrir, guardar y exportar cada archivo, qué se conserva y qué no, y con qué perfil de cálculo se abre. Lo que hay detrás de todo esto, y un ejemplo con cifras, está en [Archivos y formatos](docs://uitleg-bestanden).

## De un vistazo

**Abrir** admite los formatos IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` y `.xer`. La aplicación trata cualquier archivo con otra extensión como IFC.

**Guardar** siempre escribe IFC. Solo un archivo IFC abierto se convierte en destino de guardado. Un proyecto de otro formato no tiene archivo tras abrirlo. Entonces *Guardar* pregunta dónde debe ir el archivo IFC.

**Exportar** admite IFC, MS Project XML, Primavera P6 XML, CSV y dos hojas de avance (Excel y CSV). Una exportación no cambia su proyecto.

**Solo lectura** son `.mpp` y `.xer`: la aplicación puede abrirlos, pero no escribirlos.

**PDF** solo se obtiene de un informe (vea [Tipos de informe](docs://ref-rapporttypes)). La aplicación no lee PDF.

**Dónde.** Para abrir: *Inicio › Archivo › Abrir*, *Archivo › Abrir* o Ctrl+O. Para exportar: *Inicio › Archivo › Exportar* o *Archivo › Exportar*. Un archivo de avance rellenado se lee con *Archivo › Importar*. También se puede usar el botón *Actualizar avance desde una hoja* en el grupo de cinta *Avance*, en las pestañas *Planificación*, *Tabla* e *Informe*.

**Perfil de cálculo al abrir.** Cada formato se abre con un perfil de cálculo. Para saber qué es, vea [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies). `.xer` se abre con *Primavera P6*, `.mpp` con *Microsoft Project*, y CSV, MS Project XML y P6 XML con *Open Planner Studio*. IFC conserva el perfil guardado en el archivo. Para `.xer` y `.mpp`, la aplicación indica que el proyecto calcula de esta manera. Solo IFC lleva el perfil de cálculo y las opciones de cálculo. De las opciones de cálculo, MS Project XML escribe como máximo el umbral crítico. Una exportación reabierta de otro formato se calcula como *Open Planner Studio*.

## IFC

**Abrir** — sí, `.ifc`. La aplicación lee IFC4 y IFC 4.3 (también ADD2). Un archivo con otro esquema, como IFC2X3, también se abre. En el primer guardado debe elegir entonces un esquema que la aplicación puede escribir (vea [Elegir el esquema IFC](docs://howto-ifc-schema-kiezen)). Perfil de cálculo: el del archivo.

**Guardar** — sí, y es el único formato que se puede guardar. *Guardar* escribe todo su proyecto como archivo IFC, en el esquema IFC del proyecto (IFC 4.3 ADD2 de manera predeterminada). El archivo pasa a ser el destino de guardado.

**Exportar** — sí, como *IFC*, en el esquema IFC del proyecto (IFC 4.3 ADD2 de manera predeterminada). Nombre predeterminado: el nombre del proyecto con la extensión `.ifc`. Si su proyecto está vinculado a una biblioteca de recursos, la casilla *Guardar también el archivo de biblioteca* está debajo de las tarjetas en *Archivo › Exportar*. Con la casilla marcada, la aplicación pide después un lugar para *nombre-del-proyecto-biblioteca.ifc*. La casilla no aparece en la lista de la pestaña *Inicio*.

**Qué se conserva** — todo lo que pertenece al proyecto: tareas con estructura, duración, fechas y avance; relaciones con desfase; restricciones y fechas límite; calendarios; recursos y asignaciones, incluida la distribución de horas; líneas base; códigos de actividad y campos personalizados; notas; relaciones externas con otros proyectos; interrupciones; tipos de tarea y categorías de trabajo personalizadas; los ajustes del proyecto, como la fecha de estado, el modo de progreso, el perfil de cálculo y las opciones de cálculo; el vínculo con una biblioteca de recursos. En un proyecto de un `.xer`, también se conserva el archivo original de origen. Una categoría de trabajo personalizada se guarda como el tipo IFC `USERDEFINED`, con su nombre en el campo ObjectType; así, otros programas IFC leen la tarea con normalidad. La aplicación también conserva el id fijo de la categoría de trabajo, de modo que cambiar el nombre no rompe el vínculo. Si alguien abre el archivo en otro equipo, la categoría aparece allí en *De este proyecto*, y no en sus propias *Mis categorías de trabajo*.

**Qué no se conserva** — cómo ha configurado la pantalla (zoom, posición de desplazamiento, tarea seleccionada, fases contraídas, filtro y agrupación elegidos) y los ajustes de la aplicación ([Configuración](docs://ref-instellingen)). La pestaña *IFC* es un editor con el texto IFC de su proyecto. *Generar IFC* lo actualiza, *Copiar* lo pone en el portapapeles y *Aplicar* carga el texto como su proyecto, sustituyendo el proyecto en esa pestaña.

## MS Project XML (MSPDI)

**Abrir** — sí. La aplicación reconoce un archivo `.xml` como MS Project XML por el elemento raíz `Project` del espacio de nombres de MS Project (o sin espacio de nombres). Perfil de cálculo: *Open Planner Studio*. Tras abrir, la aplicación le indica en un solo mensaje lo que no ha incorporado; vea [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen).

**Guardar** — no. Un proyecto así no tiene destino de guardado.

**Exportar** — sí, como *MS Project XML* (*Se abre en Microsoft Project. Estructura WBS completa.*). Nombre predeterminado: el nombre del proyecto con `.xml`.

**Qué se conserva** — tareas con estructura (nivel y WBS), duración, fechas y avance; relaciones con desfase, también en horas o porcentajes; restricciones, incluida la fecha límite; calendarios, incluidos los calendarios de tarea y de recurso; recursos y asignaciones, incluida la curva o la distribución de horas; la fecha de estado; el umbral crítico, como número entero de días laborables de 0 o más, con *Holgura total ≤ umbral*; la descripción de una tarea (como nota); el tipo de tarea de cada tarea (como tipo de tarea de MS Project); una categoría de trabajo personalizada, en un campo libre (`ExtendedAttribute`) que la aplicación vuelve a leer y que MS Project puede ignorar. De sus líneas base solo se conserva la activa, como línea base 0. Una tarea en horas conserva su unidad, y un hito conserva su tipo (inicio, fin o automático).

**Qué no se conserva** — notas (la lista de comprobación de una tarea), relaciones externas con otros proyectos, códigos de actividad y campos personalizados, una segunda restricción, la marca *Programada manualmente*, el retraso de nivelación, el punto de reanudación y el de parada de una tarea con avance fuera de secuencia, las convenciones *El trabajo restante se reanuda tras la duración transcurrida* y *No mover las tareas no iniciadas a la fecha de estado* de un perfil de MS Project, y las demás opciones de cálculo. Las tareas interrumpidas sin distribución de horas se conservan sin sus interrupciones.

**Festivos al abrir.** Un calendario derivado hereda las excepciones de su calendario base. Un calendario con semana laboral propia y sin excepciones no recibe festivos. Solo un calendario básico, sin calendario base, semana laboral ni excepciones, conserva los festivos estándar de los Países Bajos. Si faltan festivos, su fecha de fin puede ser distinta: vea [Generar festivos y vacaciones de construcción](docs://howto-feestdagen-genereren).

**Qué cambia en el proceso** — una restricción *Debe comenzar el (MSO)* o *Debe finalizar el (MFO)* sin la opción *Obligatorio (fijación forzada)* pasa a ser *No comenzar antes del (SNET)* o *No finalizar antes del (FNET)*. Una hamaca pasa a ser una tarea normal con fechas calculadas. MS Project XML guarda las horas por día solo para el calendario del proyecto. Otro calendario con sus propias horas por día recibe su horario laboral como horas por día al abrir el archivo: 8 horas por día con horarios laborales de 10 horas pasa a ser 10. Una tarea en días en ese calendario se acorta entonces, por ejemplo 4 días en lugar de 5.

## Archivo de MS Project (`.mpp`)

**Abrir** — sí, desde MS Project 2010 hasta 2021. Perfil de cálculo: *Microsoft Project*. La aplicación solo lee el archivo: nunca cambia su `.mpp`. Un archivo de MS Project 2007 o anterior, y un archivo protegido con contraseña, lo rechaza con un mensaje que remite a la exportación XML de MS Project. Tras abrir, la aplicación le indica en un solo mensaje lo que no ha incorporado.

**Guardar** — no, y no hay destino de guardado: *Guardar* escribe un archivo IFC nuevo.

**Exportar** — no.

**Qué se conserva** — tareas con estructura, duración y restricciones; relaciones con desfase; calendarios; recursos y asignaciones; avance; un código WBS que usted mismo rellenó en MS Project. También se leen las fechas y la holgura que MS Project calculó por sí mismo, para la vista *Fechas tal como se guardaron*.

**Qué no se conserva** — líneas base, costes y tarifas, notas, hipervínculos, los campos personalizados de MS Project, las relaciones externas con subproyectos y tareas externas, y el umbral crítico. Vea [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen).

**Origen y licencia** — el lector de `.mpp` se escribió para Open Planner Studio y se deriva del código fuente y del conocimiento estructural de MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), una biblioteca Java bajo LGPL-2.1. La estructura y las constantes de campo se portaron a TypeScript. Open Planner Studio en sí es de código abierto bajo LGPL-3.0. El lector de `.xer` no es una derivación: MPXJ solo se consultó allí como fuente de información.

## Primavera P6 XML

**Abrir** — sí. La aplicación reconoce un archivo `.xml` como P6 XML por el elemento raíz `APIBusinessObjects`. Perfil de cálculo: *Open Planner Studio*.

**Varios proyectos en un archivo.** Cada proyecto con tareas se abre en su propia pestaña, con el nombre *Nombre del proyecto (ID del proyecto)*. La aplicación omite un proyecto sin tareas. La pestaña activa es el proyecto con más tareas. La aplicación no incorpora una relación con otro proyecto, ni una tarea que no pertenece a ningún proyecto. Tras abrir, la aplicación informa de cuántos proyectos ha abierto.

**Festivos al abrir.** Se aplican las mismas reglas que para MS Project XML: un calendario con semana laboral propia y sin excepciones no recibe festivos.

**Líneas base.** Un `<BaselineProject>` del archivo pasa a ser una línea base de su proyecto. La línea base que P6 marca como activa también está activa en la aplicación.

**Unidades de una asignación.** Si queda trabajo, las unidades restantes (`RemainingUnitsPerTime`) pasan a ser *Uds./día*. Si no, son las unidades planificadas (`PlannedUnitsPerTime`). En el caso de material se mantienen las unidades planificadas. La aplicación no recalcula nada al abrir el archivo. Al exportar a P6 XML escribe las unidades planificadas como `PlannedUnitsPerTime`. Escribe las unidades restantes como `RemainingUnitsPerTime` solo cuando la asignación tiene unas unidades planificadas aparte.

**Sin tareas legibles.** Si la aplicación no encuentra ninguna tarea que pueda leer, no abre una pestaña. Lo indica, con el motivo cuando se conoce. Ejemplos: tareas sin `ObjectId`, o nombres de columna XER en un archivo XML. Entonces exporte el proyecto de P6 de nuevo como P6 XML, o ábralo como `.xer`.

**Guardar** — no.

**Exportar** — sí, como *Primavera P6 XML* (*Para Oracle Primavera P6.*). Nombre predeterminado: el nombre del proyecto con `.xml`, con el ID del proyecto entre paréntesis si el proyecto tiene uno. Una exportación a MS Project XML recibe el mismo nombre: póngales usted mismo nombres distintos.

**Nombre del proyecto e ID del proyecto.** La aplicación guarda el ID del proyecto de P6 aparte del nombre del proyecto, igual que con un `.xer`. *Ajustes del proyecto* muestra solo el nombre, por ejemplo *Bid for Facility Extension*. La pestaña muestra *Bid for Facility Extension (OZB-05)*. Si cambia el nombre del proyecto a *Hall extension*, la pestaña se llama *Hall extension (OZB-05)*. Una exportación a P6 XML escribe *OZB-05* de nuevo como ID del proyecto y *Hall extension* como nombre. Así P6 reconoce el proyecto. Un proyecto de un `.xer` también conserva su ID del proyecto. El ID del proyecto se mantiene cuando guarda el proyecto como IFC. Los paréntesis del propio nombre, como en *New build (phase 2)*, se quedan en el nombre. Un proyecto sin ID del proyecto recibe al exportar un ID único propio de la aplicación, que empieza por *OPS:*.

**Qué se conserva** — estructura WBS y tareas con duración, fechas y avance; relaciones con desfase; restricciones (también una segunda, como restricción flexible); calendarios; recursos y asignaciones; la fecha de estado (como `DataDate`); una categoría de trabajo personalizada, en un campo propio, `OPS Custom Task Type`, que la aplicación vuelve a leer y que P6 puede ignorar.

**Qué no se conserva** — líneas base y fechas límite; códigos de actividad, campos personalizados, notas y relaciones externas; las opciones de cálculo; los nombres de los festivos. P6 no tiene nombre por día libre: al volver a abrir, un festivo se llama *Festivo* y una excepción laboral *Excepción laboral*. Los días libres seguidos vuelven como un solo intervalo. La aplicación acorta un nombre o un código que sea más largo de lo que admite P6: el nombre de una tarea a 120 caracteres, el ID de una tarea o el código WBS a 40, y un nombre de WBS o de proyecto a 100. Indica cuántos nombres y códigos ha acortado. P6 no tiene desfase en porcentajes: la aplicación lo convierte en un número fijo de días. Un desfase en días naturales pasa a ser un desfase en horario laboral: 3 días naturales pasan a ser 3 días laborables. Una hamaca pasa a ser una tarea normal, una tarea programada manualmente pasa a ser una tarea normal con fechas calculadas, y un retraso de nivelación de menos de un día se descarta.

## Archivo de Primavera (`.xer`)

**Abrir** — sí. Perfil de cálculo: *Primavera P6*. La aplicación solo lee el archivo: no escribe `.xer` y nunca cambia su archivo. Abre una pestaña por cada proyecto que tenga tareas. Un archivo sin tareas o con tablas dañadas lo rechaza con un mensaje.

**Guardar** — no, y no hay destino de guardado: *Guardar* escribe un archivo IFC nuevo, con el `.xer` original dentro.

**Exportar** — no. Si exporta un proyecto de un `.xer` a CSV, MS Project XML o P6 XML, la aplicación indica que se pierde la información de origen de XER, aunque haya guardado el proyecto como IFC antes. A IFC no se pierde nada.

**Qué se conserva** — la estructura WBS y las tareas con duración, fechas, restricciones y avance; relaciones con desfase; calendarios; recursos con asignaciones; códigos de actividad; campos personalizados (UDF); notas; los ajustes de planificación P6. Una tarea del tipo *Nivel de esfuerzo* pasa a ser una hamaca. Un proyecto de línea base pasa a ser la línea base activa del proyecto que lo referencia. Una relación entre dos proyectos la guarda la aplicación como dato de origen.

**Ritmo de una asignación.** Si queda trabajo, el ritmo restante (`remain_qty_per_hr`) pasa a ser *Uds./día*. En caso contrario, es el ritmo planificado (`target_qty_per_hr`). El trabajo planificado, el real y el trabajo restante se mantienen como están en el archivo. Para los materiales se mantiene el ritmo planificado.

**Un sábado o domingo libre que no está en el archivo.** Algunas exportaciones de P6 mueven un día libre del fin de semana, dentro de un bloque de varios días libres, al viernes anterior o al lunes siguiente. Si el calendario trabaja los sábados o domingos, ese día pasaría a ser un día laborable por error. Si la aplicación ve ese patrón en un bloque de al menos tres días libres, hace que ese día del fin de semana, al fin y al cabo, vuelva a ser libre. En el calendario, el día se llama *Excepción de calendario (reconstrucción del fin de semana)*, y cuenta en la línea *N hallazgos del calendario.* del mensaje. En un calendario que no trabaja los fines de semana, no cambia nada.

**Holgura hasta el fin del proyecto, sin fecha de fin.** ¿Está activada la opción de P6 para calcular la holgura hasta el fin del proyecto, pero el archivo no tiene fecha de fin del proyecto ni fecha de fin planificada en ninguna tarea? Entonces la aplicación desactiva la opción *Calcular la holgura hasta la fecha de fin del proyecto*. Después calcula las fechas tardías hacia atrás desde el fin temprano más tardío. Eso cuenta en la línea *N ajustes de planificación P6 usaron alternativas seguras.*

**Tareas completadas en la fecha de estado.** Algunos archivos no guardan las fechas reales de una tarea completada, sino una ventana sobre la fecha de estado. En la vista *Fechas tal como se guardaron*, esa tarea aparece entonces como una barra estrecha en la fecha de estado. Si al recalcular queda en otro lugar, cuenta en el número de tareas que da la franja. La convención *Tarea completada en la ventana de la fecha de estado* calcula esa ventana, y solo con esa convención una tarea completada obtiene una holgura real mediante la opción de cálculo *Tarea completada: fechas tardías desde la fecha de estado*. Esta convención es una aproximación: la aplicación solo observó este comportamiento en la salida de P3, y Primavera no lo confirma en ningún sitio. Por eso está desactivada en todos los perfiles integrados, también en *Primavera P6*. Actívela en el bloque *Perfil de cálculo y opciones*; el proyecto recibe entonces un perfil personalizado. Vea [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies).

**Números con coma como separador decimal.** P6 guarda el separador decimal y el separador de miles en la tabla `CURRTYPE`. La aplicación lee esos caracteres antes de convertir duraciones, trabajo y holguras. Si falta esa información, la aplicación usa un punto como separador decimal. Si el archivo sigue conteniendo números con coma decimal, la aplicación no abre nada. Así nunca se abre una planificación con números leídos de forma incorrecta.

**Qué no se conserva** — un proyecto sin tareas, y una relación entre dos proyectos como relación real en su planificación. Vea [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Abrir** — sí. La aplicación lee `;` y `,` como separador. Reconoce los encabezados de columna en inglés y en neerlandés (por ejemplo `Name` o `Naam`, `Duration` o `Duur`, `Predecessors` o `Voorgangers`). Las fechas pueden ser *aaaa-mm-dd*, *dd-mm-aaaa* o *dd/mm/aaaa*. Escriba un predecesor como código WBS, tipo de relación y desfase, por ejemplo `1.2FS+2d`. Perfil de cálculo: *Open Planner Studio*. El proyecto se llama *CSV Import*. La columna `Task Type` contiene la categoría de trabajo, no el tipo de tarea; la aplicación también lee los encabezados `Werksoort` y `Work category`. Un `Task Type` que no es ninguno de los códigos fijos (como `CONSTRUCTION` o `INSTALLATION`, que la aplicación escribe ella misma) pasa a ser una categoría de trabajo personalizada en *De este proyecto*, no en *Mis categorías de trabajo*; con `OPS Custom Task Type ID` se conserva el id de una categoría de trabajo personalizada.

**Guardar** — no.

**Exportar** — sí, como *CSV (;)* (*Exportación de tabla universal. Todas las tareas con fechas y duraciones.*), en la tarjeta *CSV (separado por punto y coma)*. El archivo usa punto y coma como separador, está en UTF-8 con BOM y tiene encabezados de columna en inglés.

**Qué se conserva** — por tarea, estas columnas: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` y `Description`. La columna `Task Type` contiene la categoría de trabajo. La finalización va en porcentajes enteros. Un desfase en horas recibe el signo de hora del idioma de la aplicación: `1.2FS+2h` en inglés, `1.2FS+2u` en neerlandés. Al abrir se leen los dos.

**Qué no se conserva** — recursos, asignaciones, calendarios, restricciones, fechas límite, líneas base y la fecha de estado. Si las fechas están en la vista *Fechas tal como se guardaron*, la exportación deja vacías `Critical` y `Total Float` en las tareas cuyo archivo de origen no las registró.

## Hoja de avance (Excel y CSV)

**Abrir** — sí, mediante *Archivo › Importar* (*Actualizar avance desde una hoja*), o mediante el botón de ese nombre en el grupo de cinta *Avance* de *Planificación*, *Tabla* e *Informe*. La aplicación lee `.xlsx` y `.csv`, hasta 16 MB y 50.000 filas. Esto no abre un proyecto: actualiza el avance de su proyecto abierto. Vea [Importar avance desde una hoja de cálculo](docs://howto-voortgang-importeren).

**Guardar** — no.

**Exportar** — sí, como *Hoja de avance (Excel)* (*Avance (Excel)* en la lista) y *Hoja de avance (CSV)* (*Avance (CSV)*). Nombre predeterminado: *nombre-del-proyecto-avance*. El botón *Exportar hoja de avance* del mismo grupo de cinta crea la hoja de Excel en un solo clic. La hoja de Excel tiene anchos de columna fijos, campos bloqueados y control de fechas. La hoja CSV tiene el mismo contenido, como texto simple.

**Qué se conserva** — las columnas `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` y `Actual Finish`. Al leerla, la aplicación usa `Completion (%)`, `Actual Start` y `Actual Finish`. `Start` y `Finish` solo sirven para reconocer la notación de fechas y no cambian su planificación. La aplicación vincula las filas con las tareas por el `OPS Task ID`, o si no, por un código WBS único.

**Qué no se conserva** — todo lo que queda fuera de estas columnas: duración, relaciones, recursos y el resto de su planificación. Una tarea de resumen no recibe avance de la hoja.

## PDF

**Abrir** — no.

**Guardar** — no.

**Exportar** — sí, desde un informe: en la pestaña *Informe*, el botón *Exportar PDF*. La aplicación no envía por sí misma un informe a una impresora. Para imprimirlo, use el PDF. El contenido depende del tipo de informe: vea [Tipos de informe](docs://ref-rapporttypes) y [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken).

## Vea también

- [Archivos y formatos](docs://uitleg-bestanden): por qué IFC es el formato propio y qué pierde una exportación, con un ejemplo.
- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): los pasos.
- [Exportar](docs://howto-exporteren): elegir un formato y los mensajes tras una exportación.
- [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen): por qué un archivo abierto puede mostrar otras fechas.
- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): los perfiles de cálculo.
