# Crear e imprimir un informe

Objetivo: elija un informe de su planificación, compruébelo en la vista previa y guárdelo como PDF, para entregarlo o imprimirlo usted mismo.

## Cuándo lo necesita

El viernes es la reunión de obra. El cliente quiere la planificación en papel, el jefe de obra quiere saber qué empieza en las próximas semanas y el capataz quiere una hoja solo con sus propias tareas. Usted hace resúmenes como estos en la pestaña *Informe*. La aplicación los calcula a partir de su planificación y primero los muestra como vista previa. Después los exporta a un PDF.

La aplicación no envía un informe a una impresora por sí misma. El resultado final es siempre un PDF. Usted lo imprime con su lector de PDF, o lo envía por correo electrónico.

## Pasos

### 1. Abra la pestaña Informe

Elija *Informe* en la cinta, o pulse Ctrl+P. Ctrl+P le lleva a esta pestaña. Si escribe en un campo, hay un cuadro de diálogo abierto o está activado el modo de presentación, Ctrl+P no funciona. En el navegador se abre entonces el diálogo de impresión del navegador, y eso imprime la pantalla, no el informe.

A la izquierda está el panel *Informe* con la lista *Tipo de informe*, un resumen y la configuración. A la derecha está la vista previa.

### 2. Elija el tipo de informe

La lista *Tipo de informe* tiene once informes. Elija el que se ajuste a su pregunta.

- *Diagrama de Gantt*: la planificación como diagrama de barras, para la hoja de entrega habitual.
- *Diagrama de recursos*: las mismas barras, pero con una franja por recurso. Para «¿qué hace la cuadrilla X?», si lo desea con una hoja por cuadrilla.
- *Resumen de hitos*: todos los hitos con fecha y estado.
- *Variance*: la planificación actual junto a la línea base activa. Para «¿cuánto nos hemos retrasado?».
- *Previsión (look-ahead)*: lo que se ejecuta o empieza en el período siguiente. La lista para la reunión semanal.
- *Crítico y casi crítico*: las tareas sin holgura o con muy poca holgura.
- *Informe de avance*: dónde está el proyecto en la fecha de estado, el día en que se mide el avance.
- *Salud del cronograma*: una comprobación de la planificación misma en busca de errores y valores inusuales.
- *Carga de recursos*: por recurso, por semana o por mes, lo que se necesita frente a lo que hay disponible.
- *Asignaciones de recursos*: por recurso, las tareas a las que está asignado.
- *Resumen WBS*: la planificación agregada por nivel de WBS, para la dirección.

### 3. Compruebe que la planificación esté actualizada

La aplicación no calcula por sí sola. Si cambió tareas, relaciones o calendarios desde el último cálculo, pulse **Calcular** (F5). Los informes en forma de tabla le avisan por sí mismos, en la parte superior del informe: *El cronograma cambió desde el último cálculo — pulse Calcular (F5) para valores actuales*. O, si nunca se ha calculado: *Aún no calculado — pulse Calcular (F5) para fechas y holguras*.

La cinta de la pestaña Informe no tiene botón Calcular, pero F5 funciona aquí sin problema. *Exportar PDF* también calcula primero por sí mismo si la planificación está desactualizada, así que el PDF nunca va por detrás de su planificación.

### 4. Ajuste el informe

Debajo de *Configuración* están las opciones del Diagrama de Gantt y del Diagrama de recursos. *Previsión (look-ahead)*, *Crítico y casi crítico*, *Informe de avance*, *Salud del cronograma*, *Carga de recursos*, *Asignaciones de recursos* y *Resumen WBS* solo tienen *Papel:* y *Orientación:*, además de un bloque *Opciones del informe* con las opciones de ese informe. *Resumen de hitos* y *Variance* no tienen opciones propias. Para el período de un informe, vea [Elegir el período de informe](docs://howto-rapportageperiode-kiezen).

- *Papel:* y *Orientación:* determinan la hoja. De forma predeterminada es A3 apaisado, que resulta práctico para una planificación de obra, pero no todas las impresoras imprimen A3. Si tiene una impresora A4, elija A4 ahora: la aplicación entonces distribuye las páginas para A4, en lugar de que usted tenga que reducirlas después.
- Con el Diagrama de recursos, la casilla *Cada recurso en una página nueva* da una hoja por cuadrilla.
- *Tamaño de letra:* (del 90% al 125%) hace el texto y la tabla más grandes o más pequeños. Una letra más grande deja menos espacio para el cronograma.
- *Seguir la vista (filtro, agrupación, orden)* solo aparece en el Diagrama de Gantt. De forma predeterminada, todo el árbol de tareas va al papel. Con esta casilla, el informe dibuja exactamente las filas que ve en pantalla, incluidas las fases contraídas; por ejemplo, solo las tareas críticas de un diseño. Cómo crear esa vista está en [Crear y usar un diseño](docs://howto-layouts-gebruiken).
- *Mostrar superposición de línea base* muestra la línea base activa junto a las barras actuales. Con *Línea de estado:* elija una *Línea de fecha de estado* o una *Línea de progreso*.
- *Ajuste automático al papel* está activado de forma predeterminada: el cronograma se escala entonces al ancho de la página y el número de páginas depende de la altura. Si lo desactiva, el informe usa un zoom fijo y además se reparte a lo ancho, lo que produce rápidamente muchas páginas. Con *Cronograma en:* reparte el cronograma en 2 a 8 páginas de ancho con ajuste automático, para una planificación larga que quiere imprimir en un tamaño legible.

### 5. Compruebe la vista previa

Para el Diagrama de Gantt y el Diagrama de recursos verá el papel con encabezado de página, tabla, cronograma y leyenda. Desplácese por las páginas para revisarlas. *Calidad de vista previa* solo ajusta la nitidez de la vista previa en su pantalla; el PDF no cambia con ella. Si debajo de las páginas se lee *… y 1 página más — exporta para ver el documento completo* (con más páginas, *… y 2 páginas más — exporta para ver el documento completo*), la vista previa no tiene todas las páginas listas. El PDF contiene todas.

Los demás informes se muestran en pantalla como tabla. Lo que ve es lo que acaba en el PDF.

### 6. Exporte a PDF

En la parte inferior del panel izquierdo, haga clic en **Exportar PDF**. El nombre de archivo sugerido es el nombre del proyecto seguido del tipo de informe; para el Diagrama de Gantt, por ejemplo, *Extension house-planning.pdf*.

- En la aplicación de escritorio, y en un navegador que tiene un cuadro de diálogo para guardar archivos, usted elige dónde va el PDF. Si cierra ese cuadro de diálogo sin guardar, no pasa nada.
- En un navegador sin ese cuadro de diálogo, el navegador guarda el PDF en su carpeta de descargas.

### 7. Imprima el PDF

Abra el PDF en su lector de PDF e imprímalo allí. Si imprime un PDF A3 en una impresora A4, su diálogo de impresión tiene que reducir las páginas. Por eso, ajuste primero el tamaño del papel en el paso 4.

## Errores frecuentes y qué hace la aplicación

**El botón Imprimir y Ctrl+P no imprimen.** El botón *Imprimir* del grupo *Informe* está en la propia pestaña Informe y no hace nada más. Ctrl+P le lleva a esta pestaña. La aplicación no tiene un comando de impresión aparte: para obtener el informe en papel hay que pasar por el PDF. Si Ctrl+P no funciona (vea el paso 1), en el navegador se abre el diálogo de impresión del navegador, y eso imprime la pantalla, no el informe.

**Empresa: lo que escribe encima no se conserva.** El campo *Empresa:* del Diagrama de Gantt empieza con la empresa indicada en los ajustes del proyecto. Lo que escribe encima no se conserva. Aquí no puede escribir en *Autor:*. Cambie ambos con *Configuración › Proyecto › Ajustes del proyecto*, en los campos *Cliente/organización* y *Autor*, y confirme con *Aplicar*.

**Colores de barras: también afecta a su pantalla.** La opción *Colores de barras:* del informe es la misma opción que *Colores de barras* en la pestaña Vista. Si la cambia en el informe, su Diagrama de Gantt en pantalla cambia con ella.

**La Variance sin línea base.** Una línea base es una copia guardada de su planificación con la que se compara más adelante; cómo guardarla está en [Guardar y gestionar una línea base](docs://howto-baseline-opslaan-en-beheren). Si no tiene ninguna línea base activa, en lugar de una comparación aparece *No hay ninguna línea base activa — guarda una línea base o marca una como activa*.

**Línea de estado sin fecha de estado.** Si elige una *Línea de estado:* mientras el proyecto no tiene fecha de estado, el informe avisa con *Establezca primero una fecha de estado* y no dibuja nada. Usted establece la fecha de estado en *Planificación › Líneas base y progreso › Fecha de estado*.

**La planificación contiene un bucle.** Si la planificación contiene un bucle, *Exportar PDF* no crea ningún archivo y muestra el error.

**El papel se aplica por ahora a todos los informes.** Hay una sola opción para *Papel:* y *Orientación:*, compartida por todos los informes. *Resumen de hitos* y *Variance* no tienen opción de papel propia: usan lo que usted fijó en otro informe, A3 apaisado de forma predeterminada. Así que elija primero el papel en un informe que lo ofrezca, por ejemplo el Diagrama de Gantt, y luego vuelva al informe anterior.

**Los ajustes valen para todos los proyectos.** El papel, el tamaño de letra, el período y las demás opciones los recuerda la aplicación en este dispositivo, para todos sus proyectos. No forman parte del archivo del proyecto.

## Véase también

- [Elegir el período de informe](docs://howto-rapportageperiode-kiezen): una previsión (look-ahead) o un informe de avance sobre un tramo de tiempo concreto.
- [Crear y usar un diseño](docs://howto-layouts-gebruiken): primero filtre o agrupe, y después imprima con *Seguir la vista (filtro, agrupación, orden)*.
- [Guardar y gestionar una línea base](docs://howto-baseline-opslaan-en-beheren): la copia guardada con la que compara la Variance.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): qué hacer cuando la Carga de recursos muestra semanas con sobreasignación.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): por qué una tarea es crítica o casi crítica.
- [Tipos de informe](docs://ref-rapporttypes): todos los tipos de informe y sus opciones.
