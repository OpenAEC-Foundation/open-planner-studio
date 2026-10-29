# Permisos de las extensiones

Todos los permisos que una extensión puede declarar en su manifiesto: qué permite, qué pasa si falta y qué ve usted de él al instalar una extensión. Cómo gestiona e instala extensiones está en [Instalar y gestionar una extensión](docs://howto-extensie-installeren).

## Qué es y qué no es un permiso

Un permiso es una **declaración del autor**: qué partes de la interfaz de la aplicación quiere usar la extensión. No es una barrera. El código de una extensión se ejecuta en el mismo entorno que la propia aplicación y, por eso, puede hacer más de lo que dicen sus permisos: no hay entorno aislado (sandbox). La aplicación lo indica también en la ventana de instalación. Instale solo extensiones de autores en los que confíe.

La aplicación aplica un permiso de una de tres formas. La diferencia importa:

**Aplicación estricta.** Si falta el permiso, el método correspondiente lanza un error (en neerlandés, por ejemplo *Extensie «…» mist permissie: ribbon*) antes de que pase nada.

**Aviso.** Si falta el permiso, el método funciona igual, pero la aplicación escribe un aviso en el registro. En una versión futura se convertirá en un rechazo.

**Solo informativo.** El permiso no tiene ninguna parte de la interfaz asociada. La aplicación lo muestra al instalar y no hace nada más con él.

Lo que no necesita permiso es la base de la interfaz de la extensión: leer el proyecto, el calendario, las tareas, las relaciones, los recursos y las asignaciones; añadir tareas y relaciones y cambiar tareas; cargar un proyecto, recalcular y agrupar varios cambios; guardar sus propios ajustes, leer sus propios archivos incluidos y mostrar una notificación.

**El manifiesto.** Los permisos están en el manifiesto como lista. Una extensión que instala ahora, con un permiso que esta versión de la aplicación no conoce, se rechaza. Para una extensión guardada de una versión anterior, la aplicación descarta los permisos desconocidos y lo indica en el registro.

## Cómo pregunta la aplicación

Al instalar, desde el catálogo (*Archivo › Extensiones › Explorar › Instalar*) o desde un archivo (*ZIP* o *JS*), la aplicación muestra la ventana *¿Instalar la extensión?*. La pregunta llega una sola vez, al instalar: no cada vez que activa la extensión.

La ventana muestra el nombre, la versión, la descripción, el autor y, si lo hay, el repositorio. Bajo *Origen* indica de dónde viene la extensión (*Del catálogo de extensiones en línea*, *De un archivo ZIP en este equipo* o *De un archivo JavaScript en este equipo*) y si la descarga está verificada: con la suma de comprobación del catálogo, no verificada porque el catálogo no da ninguna, o un archivo que usted eligió. Bajo *A qué estás diciendo que sí* indica que una extensión es código de programa que se ejecuta con los mismos derechos que la aplicación, y qué significa eso en la práctica: en la aplicación de escritorio, entre otras cosas, leer y escribir archivos en cualquier lugar de su carpeta de usuario, y acceder a sus proyectos, ajustes y portapapeles; en el navegador, acceder a sus proyectos y ajustes guardados, a los archivos a los que dio acceso y a la red.

Bajo *Lo que esta extensión declara usar* están los permisos del manifiesto, como etiquetas cortas con el nombre tal como aparece abajo. Dice: *Es la declaración del autor, no una restricción: el código puede hacer más de todos modos.* Si la extensión no tiene permisos, dice *No declara nada.* Dos permisos reciben una explicación: *importSource* y *help*. Los otros seis solo reciben su etiqueta.

Con *Instalar* acepta. *No instalar*, Esc y hacer clic fuera de la ventana rechazan la instalación.

## Los permisos

**ribbon** — colocar un botón en la cinta. Efecto: la extensión puede añadir un botón a un grupo de una pestaña de la cinta. Una extensión sin este permiso recibe un error cuando lo intenta. Los botones aparecen al final de la pestaña elegida, bajo una etiqueta de grupo de la extensión, y desaparecen al desactivar la extensión o al eliminarla. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: estricta. Dónde: en la pestaña que eligió la extensión.

**events** — seguir los eventos de la aplicación y enviar eventos propios. Efecto: la extensión puede suscribirse a eventos, darse de baja de ellos y enviar eventos propios. La propia aplicación envía cuatro: se carga un proyecto (tras importar, abrir o cuando una extensión lo carga), se crea un proyecto vacío, se recalcula la planificación y el usuario pide un tutorial. Este último solo va a la extensión de tutoriales. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: estricta. Dónde: en ninguna parte; la extensión reacciona al evento.

**backstage** — ofrecer un formato de importación. Efecto: la extensión puede registrar un importador; aparece en *Archivo › Importar*, donde hace clic en un formato y elige un archivo. Los formatos integrados son independientes de esto (véase [Formatos de importación y exportación](docs://ref-import-exportformaten)). Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: aviso. Si falta el permiso, registrar un importador sigue funcionando, con un aviso en el registro. Es una solución transitoria, porque las extensiones existentes no siempre declaran el permiso. Dónde: *Archivo › Importar*.

**pdf-fonts** — proporcionar una fuente para la exportación a PDF. Efecto: la extensión puede registrar un proveedor de fuentes. La exportación a PDF lo usa para caracteres que las fuentes integradas no cubren, como caracteres chinos, japoneses y coreanos. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: estricta. Dónde: en el PDF de un informe; en la ventana de instalación solo aparece la etiqueta.

**importSource** — leer los bytes originales de un archivo importado. Efecto: la extensión puede pedir el contenido completo del archivo de origen de un proyecto importado (por ahora: un archivo Primavera), incluidos los campos que la aplicación deliberadamente no toma para su proyecto, como campos de auditoría y de procedencia, costes, campos de revisión y de ubicación. Eso es mucho más amplio que el resto de la interfaz, por eso es un permiso aparte. Sin el permiso, la aplicación no lee ni un solo byte del archivo de origen: cada método lanza entonces un error antes de que se obtenga nada. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: estricta, denegado por defecto. Dónde: en la ventana de instalación se muestra una explicación: *importSource — los bytes de origen completos de cada archivo importado (por ejemplo un archivo Primavera sin procesar), incluidos campos que nunca llegan al proyecto*.

**help** — añadir artículos de ayuda y orientación. Efecto: la extensión puede registrar y retirar artículos de ayuda (tutoriales), abrir un archivo `.ifc` incluido como documento nuevo e iniciar y detener una guía que señala partes de la aplicación. Un proyecto incluido nunca sobrescribe el documento en el que está trabajando: se abre como documento nuevo, o solo ocupa una pestaña vacía y sin cambios. Desde la versión 1.4.0 del contrato. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: estricta. Dónde: en la ventana *Ayuda* (los artículos), como pestaña nueva (el proyecto) y como guía que señala botones. En la ventana de instalación se muestra una explicación: *help — puede añadir artículos de ayuda, abrir proyectos incluidos como documento nuevo y mostrar una guía que señala partes de la aplicación*.

**filesystem** — la extensión declara que usa archivos. Efecto: ninguno; no hay ninguna parte de la interfaz asociada y la aplicación no puede aplicarlo. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: solo informativo. Dónde: como etiqueta en la ventana de instalación.

**network** — la extensión declara que usa la red. Efecto: ninguno; como *filesystem*. Predeterminado: no concedido; solo lo que está en el manifiesto. Aplicación: solo informativo. Dónde: como etiqueta en la ventana de instalación.

## Véase también

- [Formatos de importación y exportación](docs://ref-import-exportformaten): los formatos que la aplicación conoce por sí misma, junto a lo que las extensiones añaden bajo *Archivo › Importar*.
- [Instalar y gestionar una extensión](docs://howto-extensie-installeren): instalar, desactivar y eliminar una extensión.
