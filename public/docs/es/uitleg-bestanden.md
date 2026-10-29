# Archivos y formatos

¿Qué hay realmente en el archivo que guarda? ¿Y qué le pasa a su planificación cuando la exporta a otro paquete? En este artículo encontrará cómo gestiona la aplicación los archivos: IFC como formato propio, los demás formatos como traductores, lo que deja fuera una exportación, y en qué se diferencian guardar, el guardado automático y la recuperación tras un fallo. El ejemplo del final muestra con cifras lo que hace una exportación.

## El concepto

Open Planner Studio tiene un formato de archivo propio: **IFC**, un formato de intercambio abierto para información de construcción de buildingSMART. La aplicación escribe el esquema IFC del proyecto, de forma predeterminada IFC 4.3 ADD2 (consulte [Elegir el esquema IFC](docs://howto-ifc-schema-kiezen)); en la lista de exportación se llama *IFC*. No existe un segundo archivo de proyecto propietario. *Guardar* escribe todo su proyecto como archivo IFC (`.ifc`) y *Abrir* lee de nuevo ese archivo. ¿Quiere ver qué contiene el archivo? La pestaña *IFC* es un editor que muestra el texto IFC de su proyecto; *Generar IFC* actualiza ese texto y *Copiar* lo pone en el portapapeles. Si cambia el texto, *Aplicar* lo carga como su proyecto. Eso reemplaza por completo el proyecto en esa pestaña.

Todos los demás formatos son **adaptadores**: traductores entre el modelo de otro programa y el de la aplicación. La aplicación lee CSV, MS Project XML, Primavera P6 XML, archivos de Microsoft Project (`.mpp`) y archivos de Primavera (`.xer`). Escribe CSV, MS Project XML, Primavera P6 XML y dos hojas de avance. No puede exportar a `.mpp` ni a `.xer`.

¿Por qué importa esta distinción? Un traductor solo puede llevar lo que ambos lados conocen. El archivo IFC de la aplicación conserva todo lo que pertenece a su proyecto. Cada otro formato no tiene una parte de ello, y esa parte se queda atrás.

## Cómo gestiona la aplicación los archivos

### Qué hace abrir

La aplicación elige el lector según la extensión: `.ifc`, `.csv`, `.xml`, `.mpp` o `.xer`. Con un archivo `.xml` mira dentro del archivo para saber si es MS Project XML o Primavera P6 XML. Una extensión desconocida se trata como IFC. Si el archivo no es IFC, la aplicación informa de *No se pudo abrir el archivo*, con el motivo.

Cada archivo se abre en una pestaña propia. La excepción es una pestaña que aún está vacía y sin cambios: esa pestaña toma el archivo. Un solo archivo de Primavera puede generar varias pestañas, una por cada proyecto que tenga tareas.

Tras abrir, la aplicación siempre recalcula. Si el archivo viene de otro paquete, las fechas pueden diferir de lo que decía el archivo. Eso se describe en [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen).

Solo un archivo IFC se convierte en el **destino de guardado**: el archivo al que *Guardar* escribe de nuevo. Un archivo CSV, XML, `.mpp` o `.xer` no. Ese proyecto no tiene archivo tras abrirlo; *Guardar* entonces pregunta dónde debe ir el nuevo archivo IFC. Así, al pulsar Ctrl+S nunca se sobrescribe su archivo original con texto IFC.

### Qué escribe guardar

*Guardar* escribe siempre todo el proyecto. Esto es lo que se incluye:

- tareas con estructura, duración, fechas y avance;
- relaciones con desfase, restricciones y fechas límite;
- calendarios, recursos y asignaciones, incluidas las curvas;
- líneas base, códigos de actividad, campos personalizados y notas;
- relaciones externas con otros proyectos;
- la configuración del proyecto, como la fecha de estado, el perfil de cálculo y las opciones de cálculo;
- el vínculo con una biblioteca de recursos.

Lo que usted ajusta en pantalla no pertenece al proyecto y no se incluye: el zoom, la posición de desplazamiento, la tarea seleccionada y las fases contraídas. Sus ajustes de la aplicación, como el idioma y el tema, tampoco están en el archivo. La aplicación los guarda por sí misma, en la aplicación o en su navegador.

Una exportación a otro formato no toca su proyecto. Tras una exportación el proyecto conserva el mismo destino de guardado, y sigue marcado *Sin guardar* si ya lo estaba.

### Qué pierde una exportación

Cada adaptador lleva lo que su formato conoce.

**MS Project XML** lleva tareas, relaciones, calendarios, recursos, asignaciones, restricciones, fechas límite y la fecha de estado. De sus líneas base solo se incluye la activa. Los códigos de actividad, los campos personalizados, las notas y las relaciones externas no se incluyen. Una segunda restricción en una tarea no se incluye. Una restricción *Debe comenzar el (MSO)* o *Debe finalizar el (MFO)* sin la opción *Obligatorio (fijación forzada)* vuelve como *No comenzar antes del (SNET)* o *No finalizar antes del (FNET)*. *Programada manualmente* y el *Retraso de nivelación* de una tarea no vuelven. Una hamaca pasa a ser una tarea normal con fechas calculadas.

**Primavera P6 XML** lleva tareas, relaciones, calendarios, recursos, asignaciones, restricciones y la fecha de estado. Las líneas base y las fechas límite no se incluyen, y tampoco los códigos de actividad, los campos personalizados, las notas y las relaciones externas. Una hamaca también pasa a ser una tarea normal aquí. P6 no tiene desfases en porcentaje: la aplicación convierte ese desfase en un número fijo de días. Un desfase en días naturales pasa a ser un desfase en días laborables.

**CSV** es una lista de tareas. El archivo tiene estas columnas para cada tarea: task id, WBS, level, name, duration, start, finish, predecessors, work category, el identificador de una categoría de trabajo personalizada (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float y description. Recursos, asignaciones, calendarios, restricciones, fechas límite, líneas base y la fecha de estado no están en él. Los encabezados de columna siempre están en inglés.

**Solo IFC lleva el perfil de cálculo y las opciones de cálculo.** Si exporta a CSV, MS Project XML o Primavera P6 XML, el perfil no está en el archivo; de las opciones de cálculo, MS Project XML escribe como máximo el umbral crítico. Ese archivo se vuelve a abrir como *Open Planner Studio*. Si su proyecto calculó con *Primavera P6* o *Microsoft Project*, por ejemplo porque venía de un `.xer` o `.mpp`, las fechas pueden desplazarse por ese motivo. Qué es un perfil de cálculo se explica en [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen).

Si su proyecto viene de un archivo de Primavera (`.xer`), incluso si lo guardó como IFC antes, la aplicación informa tras una exportación a CSV, MS Project XML o P6 XML: *Al exportar a CSV se pierde información de origen XER.* Para MS Project XML dice *MSPDI* en lugar de *CSV*; para P6 XML dice *P6*. Con IFC no aparece ese mensaje: el archivo IFC lleva consigo el archivo de origen de Primavera. Consulte [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen).

Hay dos cosas más que la aplicación hace con una exportación. Si la planificación está desactualizada, recalcula primero y exporta después. Y no exporta una planificación con una relación circular: recibe un mensaje con el bucle, por ejemplo *Relación circular entre tareas: Set up site → Demolish existing extension → Set up site*.

### Guardar, guardado automático y recuperación tras un fallo

Son tres cosas distintas. Se parecen, pero escriben en un lugar distinto.

**Guardar** es una acción que usted hace. La aplicación escribe su proyecto en su archivo y quita la marca *Sin guardar*.

El **guardado automático** está desactivado de forma predeterminada, y usted lo activa para cada proyecto. La aplicación entonces escribe, sin ventana, en el mismo archivo cada vez que hay cambios, como máximo una vez cada diez segundos. Solo funciona si el proyecto ya tiene un archivo. Consulte [Activar el guardado automático](docs://howto-automatisch-opslaan).

**La recuperación tras un fallo** siempre está activada. En cuanto hay un cambio en cualquier parte, la aplicación guarda, también como máximo una vez cada diez segundos, una copia de recuperación de todos los proyectos abiertos, incluidos los proyectos que usted no cambió. Esa copia no está en su archivo de proyecto: en la aplicación de escritorio está en la carpeta de datos de la aplicación; en el navegador, en el almacenamiento del navegador. Al siguiente inicio, la aplicación ofrece esa copia. Eso lo explica [Recuperar tras un fallo](docs://howto-herstellen-na-een-crash). La recuperación tras un fallo nunca escribe en su archivo de proyecto.

Como una copia se guarda como máximo una vez cada diez segundos, en un fallo puede perder los últimos segundos de cambios.

### Escritorio y navegador

La aplicación de escritorio y la versión para navegador hacen lo mismo con su proyecto, pero escriben los archivos de otra forma.

En el escritorio la aplicación trabaja con rutas reales. *Guardar* escribe directamente en su archivo. Normalmente la aplicación escribe primero en un archivo temporal junto al suyo (`.ops-save.tmp`) y solo después reemplaza su archivo, de modo que un fallo a mitad de la escritura no corta su archivo antiguo. Si cierra la aplicación con cambios, pregunta para cada proyecto si quiere guardarlo. Al cerrar de forma correcta, borra sus copias de recuperación.

En un navegador que puede guardar archivos donde usted quiera (como Chrome y Edge) obtiene una ventana normal de abrir y guardar. Después, *Guardar* escribe directamente en el archivo; en el caso de un archivo que abrió, el navegador pide permiso una vez. La lista *Recientes* funciona, pero solo muestra nombres de archivo.

En un navegador sin esa capacidad (como Firefox), la aplicación abre un archivo mediante el selector de archivos y guarda mediante una descarga. Con *Guardar*, el mensaje *Guardado como descarga: 'name.ifc' está en tu carpeta de descargas. …* explica esto una vez por sesión; con *Guardar como* y con las exportaciones ve el mensaje *Guardado como descarga: 'name.ifc' está ahora en tu carpeta de descargas. Este entorno no permite que la aplicación escriba directamente en la ubicación elegida.* Si el navegador puede mostrar una ventana de guardar, pero no puede escribir de vuelta en el archivo del proyecto, *Guardar* vuelve a pedir un lugar cada vez. Un mensaje lo explica también una vez por sesión. *Archivo › Recientes* está, pero abre una página vacía, y el guardado automático no está disponible. Usted recibe el mismo mensaje en cualquier entorno que no permita a la aplicación escribir en el lugar elegido.

## Ejemplo: exportar el proyecto de ejemplo

Tome el ejemplo *Refurbishment & Extension of a Family Home* (*Archivo › Ejemplos*). Tiene 20 tareas, de las cuales 4 son fases y 2 son hitos, y 16 relaciones. Hay 6 recursos con 8 asignaciones, 1 línea base y un vínculo a la *Demo resource library*. La tarea *Demolish existing extension* tiene la restricción *No comenzar antes del (SNET)* el 14 de mayo de 2027, y *Handover inspection* tiene una fecha límite el 29 de julio de 2027. La planificación termina el 7 de julio de 2027.

Así vuelve el proyecto desde cada formato, medido después de abrir de nuevo el archivo de exportación:

- El archivo IFC devuelve todo: 20 tareas, 16 relaciones, 6 recursos, 8 asignaciones, la línea base, la restricción, la fecha límite y el vínculo a la biblioteca. La planificación vuelve a terminar el 7 de julio de 2027.
- El archivo MS Project XML también devuelve todo, salvo el vínculo a la biblioteca. La planificación termina el 7 de julio de 2027.
- El archivo P6 XML devuelve las tareas, relaciones, recursos, asignaciones y la restricción. Faltan la línea base y la fecha límite. La planificación sigue terminando el 7 de julio de 2027, porque la restricción sigue en ella.
- El archivo CSV devuelve 20 tareas y 16 relaciones. Faltan recursos, asignaciones, línea base, restricción y fecha límite, y el proyecto se llama *CSV Import*. Sin la restricción las tareas se adelantan: la planificación termina el 2 de julio de 2027, cinco días naturales antes.

Sin esa restricción, el ejemplo en sí también termina el 2 de julio de 2027. Así que la diferencia viene de la restricción que el archivo CSV no lleva.

## Consecuencias y malentendidos

**Una exportación no es una copia de seguridad.** Solo IFC conserva todo. Si quiere conservar su proyecto, guárdelo como IFC. Exporte solo para alguien que necesite el otro formato.

**Al abrir de nuevo una exportación no siempre se obtiene la misma planificación.** La aplicación siempre recalcula al abrir, con el perfil de cálculo que pertenece al formato. Si falta lógica, como la restricción del ejemplo CSV, o si el perfil calcula de otra forma, el resultado cambia.

**Una exportación también está en *Recientes*.** En el escritorio y en navegadores con acceso a archivos, una exportación acaba en *Recientes*, igual que un proyecto guardado (las hojas de avance no). Si la abre desde ahí, se abre como una importación de ese formato.

**Guardar no es lo mismo que la recuperación tras un fallo.** La recuperación tras un fallo ayuda después de un fallo, pero no sustituye a guardar. Así que guarde antes de cerrar una pestaña o la aplicación.

## Ver también

- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): los pasos para abrir, guardar y guardar como.
- [Exportar](docs://howto-exporteren): elegir un formato y lo que obtiene.
- [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen): por qué una planificación importada puede mostrar otras fechas.
- [Restricciones y fechas límite](docs://uitleg-constraints): qué hace una restricción, y así qué desaparece si falta.
- [Relaciones y desfase](docs://uitleg-relaties): qué es un desfase y cómo lo calcula la aplicación.
- [Crear una hamaca](docs://howto-hammock): qué es una hamaca, que una exportación escribe como tarea normal.
- [Códigos y campos personalizados](docs://howto-codes-en-velden): códigos de actividad y campos personalizados, que solo IFC conserva.
- [Relaciones externas con otro proyecto](docs://howto-externe-relaties): vínculos que MS Project XML y P6 XML no llevan.
- [Guardar y gestionar una línea base](docs://howto-baseline-opslaan-en-beheren): líneas base, de las que MS Project XML solo lleva la activa.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): por formato, qué se incluye y qué no.
