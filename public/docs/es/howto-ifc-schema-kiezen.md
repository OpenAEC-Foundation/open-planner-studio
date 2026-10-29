# Elegir el esquema IFC

Objetivo: guarde su planificación en el esquema IFC del modelo de edificio con el que quiere combinarla.

## Cuándo lo necesita

De forma predeterminada, la aplicación guarda un proyecto como IFC 4.3 ADD2. Así se llama IFC 4.3 en los archivos que crean IfcOpenShell y Bonsai. Si quiere combinar la planificación con un modelo de edificio en un solo archivo 4D, por ejemplo con la receta *MergeProjects* de IfcOpenShell (ifcpatch), ambos archivos deben tener el mismo esquema. Si el modelo de edificio es un archivo IFC4, IfcOpenShell rechaza combinarlo con una planificación IFC 4.3. En ese caso, elija aquí el esquema del modelo.

## Pasos

1. Abra *Ajustes del proyecto*: *Configuración › Proyecto › Ajustes del proyecto*, o *Archivo › Ajustes del proyecto*.
2. En *Esquema IFC al guardar*, elija el esquema de su modelo de edificio.
3. Haga clic en *Aplicar*. El proyecto queda *Sin guardar*.
4. Guarde con *Guardar* (Ctrl+S) o con *Guardar como*.

Las tres opciones:

- *IFC 4.3 ADD2 (predeterminado)* escribe `IFC4X3_ADD2` en la cabecera del archivo.
- *IFC 4.3* escribe `IFC4X3`. Así lo escribían las versiones anteriores de la aplicación.
- *IFC4* escribe `IFC4`, para un modelo de edificio en IFC4.

## Errores frecuentes y qué hace la aplicación

**Combinar como último paso.** No abra el archivo 4D combinado (modelo de edificio más planificación) en la aplicación para guardarlo de nuevo. La aplicación conserva solo la planificación. Se pierden los muros y las demás partes del modelo de edificio, aunque mantenga el esquema. Cambie la planificación en su propio archivo y vuelva a combinarlos después.

**La aplicación pregunta primero cuando un archivo abierto tiene otro esquema.** Si abre, por ejemplo, un archivo IFC4, o un archivo IFC 4.3 de una versión anterior de la aplicación, la aplicación no cambia el tipo de archivo sin más. La primera vez que use *Guardar* o *Guardar como*, primero pregunta si conserva el esquema del archivo o si pasa a IFC 4.3 ADD2. *Conservar IFC4* (o *Conservar IFC 4.3*) es el botón que elige la tecla Intro. Si cierra la pregunta con Esc o con la X de la ventana, la aplicación no guarda nada.

**La aplicación pregunta solo una vez por archivo.** Su elección se guarda en el propio archivo. Si lo abre más tarde, la aplicación no vuelve a preguntar. Si elige usted mismo un esquema en *Ajustes del proyecto* y hace clic en *Aplicar*, la aplicación tampoco pregunta.

**Un esquema que la aplicación no puede escribir**, como IFC2X3, se abre en la aplicación. La primera vez que guarda, la pregunta lo indica y usted elige uno de los tres esquemas anteriores.

**El guardado automático y la recuperación tras un fallo no preguntan nada.** Escriben el esquema del archivo y dejan la pregunta para la primera vez que guarde usted mismo. Con un esquema que la aplicación no puede escribir, *Guardado automático* no escribe en el archivo hasta que responda la pregunta.

**Un proyecto nuevo no pregunta nada.** Un proyecto nuevo, y un proyecto de otro formato como XER, MPP o CSV, empieza con *IFC 4.3 ADD2 (predeterminado)*.

**El contenido del archivo no cambia.** Los tres esquemas guardan los datos de planificación que la aplicación escribe de la misma forma. Solo es distinta la línea `FILE_SCHEMA` de la cabecera. Por tanto, no pierde nada si elige otro esquema.

**Un modelo IFC 4.3 de IfcOpenShell o Bonsai** suele tener `IFC4X3_ADD2` en la cabecera, como el predeterminado de la aplicación. IfcOpenShell no combina en ese modelo una planificación con `IFC4X3`. Si tiene dudas, mire la línea `FILE_SCHEMA` al principio del archivo del modelo.

**Deshacer no cambia el esquema.** El esquema pertenece al archivo, igual que el lugar donde se guarda. Una elección en *Ajustes del proyecto* y la respuesta a la pregunta al guardar no son, por tanto, un paso de *Deshacer*. Para volver atrás, elija el otro esquema en *Ajustes del proyecto*. Así, *Guardado automático* nunca escribe en silencio otro esquema después de deshacer una edición.

## Véase también

- [Proyecto nuevo y Ajustes del proyecto](docs://ref-projectinfo): todos los campos del formulario.
- [Archivos y formatos](docs://uitleg-bestanden): por qué IFC es el formato propio de la aplicación.
- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): guardar y guardar como.
