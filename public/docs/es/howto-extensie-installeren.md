# Instalar y administrar una extensión

Objetivo: instalar una extensión, leer la pregunta de permisos y, más adelante, desactivar o quitar la extensión.

## Cuándo lo necesita

Una extensión añade algo a la aplicación sin que tenga que esperar a una versión nueva. Una extensión puede, por ejemplo, añadir un formato de importación que aparece en *Archivo › Importar*, poner un botón en la cinta o aportar una fuente para la exportación a PDF. El catálogo oficial las divide en categorías: *Importación/Exportación*, *Planificación*, *Informes*, *Utilidades*, *Fuentes* y *Otro*.

Piense bien antes de instalar una. Una extensión es código de programa que se ejecuta con los mismos derechos que la propia aplicación, y la aplicación no puede limitar eso. Por eso la aplicación pide permiso en cada instalación. Lo que ve en esa pregunta se explica más abajo.

## Pasos

### Instalar una extensión desde el catálogo

1. Elija *Archivo › Extensiones*.
2. Elija la pestaña *Explorar*. La aplicación obtiene el catálogo mientras muestra *Cargando catálogo*... Lo que hay en el catálogo lo decide la OpenAEC Foundation, que lo mantiene, y puede cambiar.
3. Busque una extensión con el campo *Buscar extensiones*... La búsqueda usa el nombre, la descripción, el autor y las etiquetas.
4. Cada tarjeta muestra nombre, versión, categoría, descripción y autor. Pulse *Instalar*.
5. Se abre la ventana *¿Instalar la extensión?* Léala; vea el paso siguiente.
6. Pulse *Instalar* para continuar. Con *No instalar* no pasa nada. Esc o pulsar fuera de la ventana también cuentan como rechazo, y la aplicación no muestra ningún mensaje de error.

Tras la instalación, la extensión se activa de inmediato. En la tarjeta de la pestaña *Explorar* aparece ahora *Instalada*. Lo que añade la extensión lo ve en la propia aplicación: un botón nuevo en la cinta o un formato de importación en *Archivo › Importar*. Algunas extensiones también muestran un mensaje. Lo reconoce por el prefijo *Extensión* seguido del nombre de la extensión.

**Tutoriales.** Los tutoriales son una extensión. Si ve el botón *Instalar tutoriales* bajo *Tutoriales* en *Ayuda*, se abre *Archivo › Extensiones* en *Explorar*. La pregunta tras el primer recorrido también instala esta extensión. Las dos vías muestran la misma pregunta de permisos; puede rechazarla.

### Instalar una extensión desde un archivo

Si recibió una extensión como archivo, instálela así.

1. Elija *Archivo › Extensiones*.
2. Arriba a la derecha, pulse *ZIP* para un archivo ZIP, o *JS* para un archivo JavaScript aparte.
3. Elija el archivo. Se abre la ventana *¿Instalar la extensión?*, como antes.

Un archivo ZIP debe contener un `manifest.json` y el archivo principal de la extensión. Si instala una extensión que ya está instalada, la versión nueva sustituye a la anterior. Si la aplicación no puede instalar el archivo, por ejemplo porque un archivo ZIP está dañado, no pasa nada: la aplicación no muestra ningún mensaje de error para ZIP ni para JS, y la extensión no aparece en la lista. El motivo sí aparece en la terminal de depuración. Actívela con *Configuración › Proyecto › Ajustes de la app*, pestaña *Avanzado*, *Activar terminal de depuración*, y ábrala con el botón *Mostrar terminal de depuración* de la barra de estado. Allí aparece, por ejemplo, *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (la aplicación muestra este texto técnico en neerlandés).

### Leer la pregunta de permisos

La pregunta muestra lo que debe decidir.

- *Autor* y *Repositorio* indican quién hizo la extensión y dónde está el código fuente.
- *Origen* indica de dónde procede el archivo y si se ha comprobado. Si aparece en rojo que la descarga no se ha verificado, instálela solo si conoce el origen.
- *A qué estás diciendo que sí* repite que una extensión es código de programa que se ejecuta con los mismos derechos que la propia aplicación, y qué significa eso en su plataforma. Instale solo extensiones cuyo autor le merezca confianza.
- *Lo que esta extensión declara usar* muestra los permisos que declaró el autor, como etiquetas pequeñas. Es una declaración y no una restricción. Si dice *No declara nada*, la extensión puede leer y cambiar igualmente los datos de su planificación.

Lo que significa cada etiqueta y los textos exactos de la ventana están en [Permisos de las extensiones](docs://ref-extensiepermissies).

### Desactivar, reactivar o quitar una extensión

1. Elija *Archivo › Extensiones* y la pestaña *Instaladas*. Cada extensión tiene una tarjeta con nombre, versión, categoría, descripción y autor.
2. Con el interruptor de la tarjeta puede desactivar la extensión (*Desactivar*) o volver a activarla (*Activar*). Al desactivarla, desaparecen los botones y los formatos de importación que añadió la extensión, pero la extensión sigue instalada. También sigue desactivada tras reiniciar la aplicación. Una extensión activada se inicia sola al arrancar la aplicación.
3. Pulse *Quitar*. El botón cambia a *Confirmar*, con la explicación *Haz clic de nuevo para eliminar definitivamente*. Pulse una vez más para quitar la extensión. La aplicación también borra los ajustes que la extensión guardó.

## Problemas frecuentes y qué hace la aplicación entonces

**No se carga el catálogo.** Indica *No se pudo cargar el catálogo:* con el motivo técnico detrás, y el botón *Reintentar*. Puede que no tenga conexión a internet.

**Aparece *Error de instalación.* bajo una tarjeta del catálogo.** La descarga o la instalación fallaron, por ejemplo porque no coincidió la suma de comprobación. Entonces no se ha instalado nada. Eso es distinto de rechazar la pregunta: en ese caso no aparece ningún mensaje de error.

**Encima de la lista aparece *Entradas de catálogo omitidas: 1*.** El catálogo contenía un elemento que la aplicación no puede usar. Puede instalar las demás extensiones como de costumbre.

**Una extensión no se inicia.** La tarjeta muestra entonces un mensaje de error, por ejemplo que la extensión necesita una versión más nueva de Open Planner Studio, y se muestra su versión actual, o el error que dio la propia extensión. En ese caso la extensión no está activa. Actualice la aplicación o quite la extensión.

**Una tarjeta con *Cuarentena*.** La aplicación no pudo usar la extensión guardada. Debajo del nombre indica *Motivo:* con la causa. Pulse *Quitar del almacenamiento* para limpiarla.

**Escribir una extensión por su cuenta.** La guía para autores de extensiones (manifest, API, permisos) está en el repositorio `OpenAEC-Foundation/open-planner-studio` de GitHub, en el archivo `docs/extensions.md`.

**Una extensión no pertenece a un proyecto.** Las extensiones se guardan en la aplicación: en la aplicación de escritorio, en este equipo; en el navegador, en el almacenamiento de ese navegador. Se aplican a todos sus proyectos y no forman parte de su archivo de proyecto. Si borra los datos del sitio en el navegador, las extensiones desaparecen.

## Véase también

- [Actualizar la aplicación](docs://howto-app-bijwerken): una extensión puede pedir una versión más nueva de la aplicación.
- [Permisos de las extensiones](docs://ref-extensiepermissies): qué significa cada permiso en la pregunta de instalación.
