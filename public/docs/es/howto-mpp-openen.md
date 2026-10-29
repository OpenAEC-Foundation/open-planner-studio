# Abrir un archivo de MS Project (.mpp)

Objetivo: abrir una planificación de Microsoft Project directamente en la aplicación, sin exportarla antes.

## Cuándo lo necesita

Un contratista, un consultor o un cliente le envía su planificación como archivo `.mpp`. Quiere verla, calcularla o seguir desarrollándola. La aplicación lee archivos `.mpp` de MS Project 2010 hasta 2021 incluido. Solo lee: no escribe `.mpp` y nunca cambia su archivo. Del archivo toma la planificación en sí misma: tareas con estructura, duración y restricciones, relaciones con desfase, calendarios, recursos, asignaciones y avance. También lee las fechas y las holguras que MS Project calculó por sí mismo, pero solo las usa para la vista *Fechas tal como están registradas*, nunca como dato de entrada.

## Pasos

1. Elija *Inicio › Archivo › Abrir* o pulse Ctrl+O. Elija el archivo `.mpp`.
2. El proyecto se abre en una pestaña nueva o en la pestaña actual, si todavía estaba vacía y sin cambios. El proyecto no tiene archivo: *Guardar* escribe después un archivo IFC nuevo. Una ventana explica brevemente qué ha tomado la aplicación del archivo y cómo funciona el guardado; consulte [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan).
3. Lea el mensaje de la parte inferior: *Este proyecto calcula como Microsoft Project. Cámbielo en Archivo → Información del proyecto → Perfil de cálculo y opciones.* La aplicación calcula este proyecto con las reglas de cálculo de MS Project: el perfil de cálculo *Microsoft Project*. Con *Abrir perfil de cálculo* va al ajuste; *Leer más* abre la ayuda sobre perfiles de cálculo.
4. Compruebe si aparece una franja debajo de la cinta: *Estás viendo las fechas tal como están registradas en el archivo; recalcular desplazaría 4 tareas.* En ese caso, en esas tareas el resultado de la aplicación difiere de las fechas que guardó MS Project. Debajo del mensaje del paso 3 aparece también una línea: *4 tareas muestran las fechas tal como están registradas en el archivo (sin recalcular).* Qué significa eso y cómo se cambia al cálculo propio de la aplicación se explica en [Fechas tal como están registradas](docs://uitleg-datums-zoals-opgeslagen).
5. Si aparece *Este archivo contiene planificación por horas.* con el botón *Activar planificación por horas*, el archivo contiene datos en horas. Consulte [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).

Si el archivo contiene tareas con divisiones, nivelación o una planificación determinada por recursos, se añade otro mensaje, por ejemplo *Este archivo de MS Project contiene 3 tareas con una planificación dividida, nivelada o determinada por recursos. Se importan y se muestran tal cual.* Para una tarea, el mensaje está en singular.

## Posibles problemas y qué hace entonces la aplicación

**No se importa todo.** Tras abrir el archivo, la aplicación le informa en un solo mensaje de lo que no ha tomado del archivo: *No se ha importado todo de este archivo de MS Project.* Debajo hay una línea por cada elemento, con el número, por ejemplo *2 líneas base no se han importado.* En un `.mpp`, la frase sobre el perfil de cálculo del paso 3 es la primera línea de este mensaje. El mensaje se queda hasta que pulse la cruz. Si no se pierde nada, no aparece este mensaje. Una línea puede tratar de:

- proyectos insertados (subproyectos): la aplicación los lee como una tarea normal, sin el vínculo con el otro archivo;
- tareas externas de otro proyecto: la aplicación las lee como una tarea normal;
- líneas base: de un `.mpp` la aplicación no toma ninguna línea base; de XML de MS Project solo la línea base 0 de las tareas, y de esta solo las fechas y la duración (en una tarea en horas, también la hora; no el trabajo ni el coste, ni las líneas base de recursos y asignaciones);
- con XML de MS Project: una asignación cuya línea base tiene otras fechas que su tarea. La aplicación conserva solo la línea base de la tarea; si son iguales, no se pierde nada y la aplicación no informa de nada. Una hora distinta el mismo día también cuenta como diferencia;
- campos personalizados con valores, como campos personalizados, valores de una tabla de búsqueda y códigos de esquema (la aplicación no cuenta los campos sí/no de un `.mpp`);
- notas (también una nota con solo una imagen) de recursos y asignaciones, y de un `.mpp` también de tareas (de XML de MS Project, la nota de una tarea se incluye como su descripción);
- hipervínculos;
- los costes fijos de las tareas;
- las tarifas de los recursos: de un `.mpp` ninguna tarifa, de XML de MS Project solo la tarifa estándar;
- solo con XML de MS Project: tareas programadas manualmente (la aplicación las programa automáticamente), tareas inactivas (se incluyen en el cálculo) y el retraso de nivelación;
- solo con un `.mpp`: el umbral crítico de MS Project; la aplicación usa el umbral 0.

Un código WBS que usted mismo rellenó en MS Project se toma; si no, la aplicación numera las tareas según la estructura.

**Un archivo de MS Project 2007 o anterior.** La aplicación lo rechaza e informa: *Este archivo .mpp usa un formato antiguo (Project 2007 o anterior). Expórtalo en MS Project como XML (Archivo → Guardar como → XML) y abre ese archivo.* Debajo del mensaje, la aplicación añade un motivo técnico en inglés.

**Un archivo con contraseña.** La aplicación informa: *Este archivo .mpp está protegido con contraseña. Expórtalo en MS Project como XML (Archivo → Guardar como → XML) y abre ese archivo.* También aquí el mensaje va acompañado de un motivo técnico en inglés.

**Un archivo que resulta no ser un `.mpp`.** Aparece *No se pudo abrir el archivo*, con un motivo técnico.

**La ruta por XML calcula de otra manera.** Si abre la exportación XML de MS Project en lugar del `.mpp`, la aplicación calcula con el perfil de cálculo *Open Planner Studio* y no ve el mensaje sobre *Microsoft Project*. Las fechas pueden salir entonces distintas de las del archivo `.mpp`. También con la exportación XML, la aplicación le informa de lo que no toma; consulte *No se importa todo*.

**Una edición quita a MS Project el control.** Si edita una tarea cuya planificación controlaba la ventana de fechas de MS Project, la aplicación informa una vez por proyecto: *La distribución de horas de MS Project ya no controla 2 tareas después de esta edición; la distribución original se conserva en el archivo.* Para una tarea, el mensaje está en singular.

**Al guardar, nunca se sobrescribe su `.mpp`.** El proyecto no tiene archivo. *Guardar* pregunta dónde debe guardarse el nuevo archivo IFC.

## Véase también

- [Archivos y formatos](docs://uitleg-bestanden): por qué un `.mpp` solo se lee y qué escribe al guardar.
- [Fechas tal como están registradas](docs://uitleg-datums-zoals-opgeslagen): la vista de las fechas propias de MS Project.
- [Activar la planificación por horas](docs://howto-urenplanning-aanzetten): si el archivo contiene datos en horas.
- [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen): lo mismo para Primavera.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): por formato, qué se conserva y qué no.
- [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen): por qué un archivo de MS Project se abre con su propio perfil de cálculo.
