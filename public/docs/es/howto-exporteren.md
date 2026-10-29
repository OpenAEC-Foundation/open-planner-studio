# Exportar

Objetivo: entregar su planificación como archivo en otro formato, para alguien que no lee IFC o para otro programa.

## Cuándo lo necesita

El consultor trabaja en MS Project, el cliente en Primavera, el subcontratista quiere las tareas en Excel, o usted envía una planificación a un programa que no puede manejar IFC. Una exportación es una copia en otro formato. Si quiere conservar el propio proyecto, guárdelo: se escribe en IFC y lo incluye todo. Lo que lleva y lo que no lleva cada formato está en [Archivos y formatos](docs://uitleg-bestanden).

## Pasos

1. Elija *Inicio › Archivo › Exportar* y seleccione un formato de la lista, o elija *Archivo › Exportar*. Allí cada formato es una tarjeta con una breve descripción.
2. En la ventana elija un nombre y una ubicación. La aplicación propone el nombre del proyecto, con la extensión del formato. Las hojas de avance se llaman *nombre-del-proyecto-avance* y se abren en su carpeta de descargas cuando es posible.
3. Confirme. No aparece ningún mensaje si la exportación tiene éxito, salvo los mensajes de más abajo. Desde *Archivo › Exportar* vuelve después a la pestaña *Inicio*, incluso si cancela la ventana. Si cancela la ventana de una exportación desde la lista de la pestaña *Inicio*, no pasa nada.

Si su navegador solo guarda mediante una descarga (como Firefox), el archivo está en su carpeta de descargas justo después del paso 1. Ve el mensaje *Guardado como descarga: 'name.xml' está ahora en tu carpeta de descargas. Este entorno no permite que la aplicación escriba directamente en la ubicación elegida.*

### ¿Qué formato elige?

La lista de la pestaña *Inicio* y las tarjetas de *Archivo › Exportar* ofrecen los mismos formatos:

- *Avance (Excel)* y *Avance (CSV)*, en las tarjetas *Hoja de avance (Excel)* y *Hoja de avance (CSV)*: una hoja sencilla con identificador, WBS, nombre, fechas y finalización, para enviar a quien introduce el avance.
- *CSV (;)*, en la tarjeta *CSV (separado por punto y coma)*: una tabla de tareas que se abre en una hoja de cálculo.
- *MS Project XML*: se puede abrir en Microsoft Project.
- *Primavera P6 XML*: para Oracle Primavera P6.
- *IFC*: el formato propio de la aplicación, con todo lo que contiene, en el esquema IFC del proyecto (predeterminado: IFC 4.3 ADD2).

### Una exportación IFC con un archivo de biblioteca

Si su proyecto está vinculado a una biblioteca de recursos, la casilla *Guardar también el archivo de biblioteca* está debajo de las tarjetas de *Archivo › Exportar*. Si activa la casilla y elige *IFC*, la aplicación pide una ubicación dos veces: primero para el proyecto y después para *nombre-del-proyecto-biblioteca.ifc*. Esta casilla solo está en *Archivo › Exportar*, no en la lista de la pestaña *Inicio*.

### Restaurar una hoja de avance

Lea de nuevo una hoja de avance rellena con *Archivo › Importar*. Consulte [Importar avance desde una hoja de cálculo](docs://howto-voortgang-importeren).

## Qué ocurre en los casos problemáticos

**Su proyecto no cambia.** El archivo de su proyecto sigue igual, y la marca *Sin guardar* se mantiene si ya estaba.

**Una planificación desactualizada se recalcula primero.** Así obtiene las fechas actuales, aunque se le haya olvidado pulsar *Calcular*.

**Una exportación también aparece en Recientes.** Esto no se aplica a las hojas de avance. Si la abre allí, se abre como una importación de ese formato.

**Una exportación no lo contiene todo.** Un archivo CSV no tiene recursos ni restricciones, y P6 XML no tiene líneas base ni fechas límite. Tampoco se incluye el perfil de cálculo: una exportación que se vuelve a abrir se calcula como *Open Planner Studio*. Solo IFC lo contiene todo. Encontrará un ejemplo con cifras en [Archivos y formatos](docs://uitleg-bestanden).

**Dos formatos con la misma extensión de archivo.** MS Project XML y Primavera P6 XML reciben ambos el nombre *nombre-del-proyecto.xml*. Dé usted mismo nombres distintos; si no, después no sabrá qué archivo es cada formato.

**Una planificación con una relación circular no se exporta.** La aplicación calcula primero y se detiene si hay un bucle. En la pestaña *Inicio* recibe el mensaje *No se pudo calcular la planificación*, y debajo, por ejemplo, *Relación circular entre tareas: Set up site → Demolish existing extension → Set up site*. En *Archivo › Exportar* solo aparece ese segundo texto en la página. Resuelva el bucle y exporte de nuevo.

**Un proyecto de Primavera pierde información de origen.** Si exporta un proyecto así a CSV, MS Project XML o P6 XML, la aplicación informa: *Al exportar a CSV se pierde información de origen XER.* Para MS Project XML aparece *MSPDI*, y para P6 XML, *P6*. Consulte [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen).

**Las tareas divididas pierden sus divisiones.** MS Project y Primavera solo conocen una división como distribución de horas. Si su proyecto contiene tareas divididas sin distribución de horas, la aplicación informa, después de una exportación a MS Project XML o P6 XML: *2 tareas con interrupciones se han exportado sin sus interrupciones: MS Project/P6 solo las conocen como distribución del trabajo.* Para una sola tarea, el mensaje es *1 tarea con interrupciones se ha exportado sin sus interrupciones: MS Project/P6 solo las conocen como distribución del trabajo.* Consulte [Dividir una tarea](docs://howto-taak-splitsen).

**Una planificación en la vista *Fechas tal como se registraron*.** Si exporta a CSV mientras ve las fechas del archivo de origen, la aplicación deja vacíos `Critical` y `Total Float` en las tareas en las que el archivo de origen no registró ese dato. Consulte [Fechas tal como se registraron](docs://uitleg-datums-zoals-opgeslagen).

## Vea también

- [Archivos y formatos](docs://uitleg-bestanden): qué lleva cada formato y qué no.
- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): conservar el propio proyecto como IFC.
- [Importar avance desde una hoja de cálculo](docs://howto-voortgang-importeren): leer una hoja de avance rellena.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): por formato, qué se transfiere y qué no.
