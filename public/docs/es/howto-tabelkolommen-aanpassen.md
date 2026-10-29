# Ajustar columnas de la tabla

Objetivo: elija qué columnas ve en la tabla de tareas, en qué orden y con qué ancho.

## Cuándo lo necesita

En la reunión quiere ver la fecha límite y la holgura total junto a cada tarea. El jefe de obra solo quiere el comienzo y el fin junto al nombre. O una columna es tan estrecha que se corta su encabezado. La tabla de tareas consta de columnas que usted elige: hay decenas, desde *Nombre de tarea* y *Duración* hasta *Fecha límite*, *Holgura libre* y *Recursos asignados*.

Hay dos tablas de tareas, cada una con sus propias columnas:

- La **tabla de tareas junto al Gantt** está a la izquierda de la línea de tiempo en, entre otras, las pestañas *Inicio*, *Planificación* y *Vista*. De forma predeterminada tiene *WBS*, *Nombre de tarea* y *Duración*, para que quede espacio para la línea de tiempo.
- La **tabla de la pestaña Tabla** ocupa toda el área de trabajo. De forma predeterminada tiene *WBS*, *Nombre de tarea*, *Duración*, *Comienzo*, *Fin*, *Categoría de trabajo*, *Crítica*, *Holgura total* y *Avance*, más una columna por cada código de actividad y campo personalizado del proyecto.

Un cambio en una tabla no cambia la otra.

## Pasos

### Añadir una columna

1. Haga clic en el signo más (**+**) a la derecha del encabezado de la tabla. En la pestaña *Tabla* también puede usar *Tabla › Columnas › Columnas…*. Se abre la ventana *Elegir columna*.
2. Busque la columna. Arriba, si ya ha elegido columnas antes, aparece *Usadas recientemente*. Escriba una parte del nombre en *Buscar*, por ejemplo *fecha* para *Fecha límite*, o abra una categoría: *Tarea*, *Planificación*, *Restricciones*, *Relaciones*, *Recursos*, *Avance*, *Calculado*, *Línea base*, *Personalizado* o *Técnico*.
3. Haga clic en la columna. Se añade al final de la tabla y la ventana se cierra.

Una columna que ya está en la tabla aparece en gris y no se puede elegir.

### Quitar una columna

Haga clic en el signo menos del encabezado de la columna (*Quitar: Fecha límite*). O haga clic con el botón derecho en el encabezado y elija *Quitar: Fecha límite*. Con Ctrl+Z recupera la columna, o la elige de nuevo con el signo más.

### Ajustar el ancho

Arrastre el borde a la derecha del encabezado de la columna a la izquierda o a la derecha. Haga doble clic en ese borde, o elija *Autoajustar* en el menú del encabezado (botón derecho del ratón), para que la columna sea lo bastante ancha para su contenido, hasta un máximo de 480 píxeles. Si el borde tiene el foco, las teclas de flecha lo amplían o lo reducen paso a paso.

### Fijar columnas

Haga clic con el botón derecho en el encabezado y elija *Fijar*. Las columnas fijadas pasan al principio y se quedan a la izquierda cuando se desplaza en horizontal. Esto funciona mientras, juntas, no sean más anchas que la ventana. *Desfijar* las devuelve a la fila.

### Cambiar el orden

Arrastre un encabezado de columna a otro lugar. Una columna fijada se mueve entre las columnas fijadas, y una columna normal entre las columnas normales.

### Volver al valor predeterminado

Abra la ventana *Elegir columna* y haga clic en *Restablecer valores predeterminados* abajo. El botón está en gris si las columnas ya son las predeterminadas. Para la tabla de la pestaña *Tabla*, también se añade una columna por cada código de actividad y cada campo personalizado del proyecto, aunque las hubiera quitado antes. Esas columnas pertenecen al proyecto al que pertenece el código o el campo. Puede leer sobre esos códigos y campos en [Códigos y campos personalizados](docs://howto-codes-en-velden).

## Problemas posibles y qué hace la aplicación

**El encabezado está cortado.** Una columna estrecha corta su nombre, por ejemplo *Holgura total* a *Holgura t…*. Haga doble clic en el borde del encabezado para ajustar la columna.

**Ajusta la tabla equivocada.** Las columnas de la tabla de tareas junto al Gantt y las de la pestaña *Tabla* son independientes. Si está en *Vista* o *Inicio*, ajusta la tabla junto al Gantt. El signo más de la pestaña *Tabla* ajusta la tabla grande.

**Un diseño devuelve las columnas.** Si en un diseño está marcada la parte *Columnas*, al hacer clic en el botón del diseño las columnas de la tabla de tareas junto al Gantt vuelven al estado guardado. La tabla de la pestaña *Tabla* no se modifica. Vea [Crear y usar un diseño](docs://howto-layouts-gebruiken).

**Las columnas están en su dispositivo, no en el proyecto.** La aplicación guarda su elección de columnas para todos sus proyectos en este dispositivo y no la guarda en el archivo del proyecto. Tampoco marca el proyecto como «modificado». Puede deshacer cada cambio de columna con *Deshacer* (Ctrl+Z); los pasos se llaman, por ejemplo, *Añadir la columna Fecha límite* y *Cambiar el ancho de la columna Nombre de tarea*.

## Véase también

- [Crear y usar un diseño](docs://howto-layouts-gebruiken): poner columnas en un botón junto con un filtro o una ordenación.
- [Códigos y campos personalizados](docs://howto-codes-en-velden): crear sus propias columnas que puede elegir aquí.
- [Columnas de la tabla](docs://ref-tabelkolommen): todas las columnas y lo que muestran.
