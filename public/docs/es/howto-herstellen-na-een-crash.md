# Recuperación tras un cierre inesperado

Objetivo: recuperar su trabajo cuando la aplicación o el navegador se cerraron de forma inesperada y usted no había guardado.

## Cuándo lo necesita

El portátil se apagó, la aplicación se bloqueó o la pestaña del navegador falló, y usted todavía no había guardado los últimos cambios. En cuanto hay un cambio en cualquier parte, la aplicación guarda copias de recuperación de todos sus proyectos abiertos en segundo plano, como máximo una vez cada diez segundos. Esa copia es independiente de su archivo de proyecto. Sobre la diferencia con guardar y con el Guardado automático, lea [Archivos y formatos](docs://uitleg-bestanden).

## Pasos

1. Vuelva a iniciar la aplicación. En el navegador, recargue la misma pestaña: la copia de recuperación pertenece a esa pestaña.
2. Si la aplicación encuentra copias, aparece la ventana *Restaurar trabajo no guardado*: *Open Planner Studio no se cerró correctamente. Los siguientes documentos tenían cambios sin guardar que se pueden restaurar:* Para cada proyecto muestra el nombre, la ruta del archivo si el proyecto tiene uno (en el navegador, solo el nombre del archivo), el número de tareas y la hora de la copia. Por ejemplo, *21 tareas* y *Guardado: Sep 29, 2026, 9:41 AM*. La hora sigue su ajuste *Formato de hora*. La ventana también puede mostrar proyectos que usted no había modificado.
3. Elija *Restaurar*. La aplicación abre todos los proyectos de la lista, cada uno en una pestaña, con el estado de la última copia. La tecla Intro hace lo mismo.
4. Compruebe sus proyectos y guárdelos de inmediato con Ctrl+S.

Si no quiere restaurar, tiene dos opciones. *No restaurar* elimina las copias, y eso no se puede deshacer. Si cierra la ventana con Escape, con la cruz o haciendo clic al lado de ella, las copias se conservan y la aplicación vuelve a preguntar en el siguiente inicio.

El signo de interrogación de la parte superior derecha de la ventana abre este artículo sin tomar una decisión. Mientras lee en la Ayuda, la ventana espera. Cuando regresa, la ventana sigue ahí y todavía puede restaurar.

## Puntos de atención y qué hace la aplicación en ese caso

**Recibe el estado de la última copia.** Es posible que falte lo que hizo en los últimos segundos antes del fallo. Un proyecto que tenía cambios vuelve a aparecer marcado como *Sin guardar*. El historial de *Deshacer* está vacío: no puede deshacer pasos anteriores al fallo. El zoom, la posición de desplazamiento y la selección se reconstruyen.

**En el escritorio, un proyecto recuperado conserva su archivo; en el navegador, no.** En el escritorio, *Guardar* escribe en el archivo original, con el estado recuperado. En el navegador, un proyecto recuperado ya no está asociado a su archivo: *Guardar* pregunta dónde debe ir el archivo. El interruptor *Guardado automático* también aparece en gris hasta que haya guardado el proyecto una vez.

**Un proyecto en la vista *Fechas tal como se registraron* sigue en esa vista.** Consulte [Fechas tal como se registraron](docs://uitleg-datums-zoals-opgeslagen).

**En el escritorio, la ventana no aparece en cada inicio.** Las copias de recuperación están en la carpeta de datos de la aplicación, como archivos IFC con un nombre que empieza por *recovery*. Si cierra la aplicación de la forma normal, borra sus propias copias. Por eso la ventana aparece después de un cierre inesperado, después de un reinicio para una actualización de la aplicación, o si aplazó la recuperación en un inicio anterior.

**En el navegador, la copia se conserva por pestaña.** La copia está en el almacenamiento del navegador. Una pestaña o ventana nueva no ofrece las copias de otra pestaña. Las copias de pestañas que ya no existen se borran después de siete días, en cuanto la aplicación vuelva a escribir copias.

**En el navegador, la ventana también aparece después de una recarga normal.** Eso ocurre aunque lo haya guardado todo. Si guardó justo antes de recargar y no cambió nada después, puede elegir *No restaurar* sin riesgo: su archivo está actualizado.

**La ventana no aparece.** En ese caso, la aplicación no encontró ninguna copia. Eso ocurre si todavía no había cambiado nada, si usa una pestaña nueva en el navegador, si antes descartó la recuperación con *No restaurar*, o si el fallo llegó antes de que la aplicación guardara la primera copia. Eso puede tardar hasta unos diez segundos después de su primer cambio.

**Una copia está dañada.** La aplicación muestra *No se pudo leer el archivo recuperado*, con el motivo, y ofrece los demás proyectos. Si elige *Restaurar*, la aplicación después borra todas las copias, incluida la que no se puede leer. Si ninguna copia se puede leer, la ventana no aparece y las copias se conservan.

**Falla la restauración.** La aplicación muestra *No se pudo restaurar* con el motivo. Las copias se conservan y la pregunta vuelve en el siguiente inicio.

**Algunos proyectos no se pueden cargar.** La aplicación muestra: *2 archivos de recuperación no se pudieron cargar y se omitieron.* Si solo es un archivo, muestra: *1 archivo de recuperación no se pudo cargar y se omitió.* Los demás proyectos se restauran. Como se omitió algo, todas las copias se conservan y la ventana vuelve en el siguiente inicio con la misma lista. Entonces elija *No restaurar* si ya recuperó todo lo posible.

## Vea también

- [Archivos y formatos](docs://uitleg-bestanden): guardar, Guardado automático y recuperación tras un cierre inesperado, en conjunto.
- [Activar el Guardado automático](docs://howto-automatisch-opslaan): dejar que la aplicación actualice su archivo por sí misma.
- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): guardar después de recuperar.
- [Fechas tal como se registraron](docs://uitleg-datums-zoals-opgeslagen): qué pasa con un proyecto en esa vista.
