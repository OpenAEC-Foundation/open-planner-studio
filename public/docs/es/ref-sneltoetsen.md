# Atajos de teclado

Todas las combinaciones de teclas de la aplicación, agrupadas como en la ventana *Atajos de teclado*. Las teclas son fijas: no puede cambiarlas. Cómo trabajar con el ratón y los menús aparece en las guías prácticas. Aquí consulta qué hace una tecla.

## Cómo leer esta lista

**Mac.** Donde este artículo dice Ctrl, use Cmd (⌘) en un Mac. Alt es Option (⌥). En un Mac, la ventana *Atajos de teclado* muestra los símbolos ⌥, ⇧ y ⌘ en lugar de Alt, Shift y Ctrl. En un Mac, Ctrl también funciona en la aplicación.

**Combinación exacta.** La aplicación compara Ctrl, Shift y Alt de forma exacta. Por eso Ctrl+Alt+S no hace nada: las teclas deben coincidir exactamente con la lista.

**Abrir la ventana.** Pulse Ctrl+/ o elija *Configuración › Atajos de teclado › Atajos de teclado*. Ctrl+/ también cierra la ventana de nuevo. La ventana es de solo lectura. No muestra todas las teclas de esta lista: de las teclas de la tabla solo muestra las seis primeras, y no las teclas de diálogo al final de este artículo.

**Cuando una tecla no funciona.** Cada entrada indica sus restricciones. Tres reglas se aplican casi siempre:

- En un campo de entrada, una lista desplegable o un cuadro de texto la aplicación no intercepta las teclas, así que puede escribir sin más. Excepciones: F5, Ctrl+S, F11 y Esc durante la presentación también funcionan en un campo. Si el foco está en una lista desplegable cerrada, también funcionan las teclas con Ctrl, por ejemplo Ctrl+Z después de una elección (no Ctrl+Delete ni Ctrl+Backspace). Eso no vale en una lista abierta ni en un diálogo. En la versión compilada (escritorio y la versión web del sitio) eso vale también para Ctrl+Shift+S, Ctrl+O y Ctrl+N.
- Mientras hay abierto un diálogo u otra ventana, no funcionan las teclas marcadas abajo con *No en un diálogo*. Eso vale también para el recorrido guiado, el diálogo de bienvenida y las preguntas que esperan respuesta, como la pregunta de si desea guardar los cambios y el consentimiento al instalar una extensión. La mayoría de estas teclas tampoco funciona en el modo de presentación. Excepción: las teclas de edición Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y y Delete/Backspace sí funcionan durante la presentación.
- Los cambios de documento (Ctrl+1 a 9, Ctrl+N, Ctrl+O) tampoco funcionan mientras *Archivo › Ajustes del proyecto* tenga cambios que aún no ha confirmado con *Aplicar*. Descártelos o aplíquelos primero.

## Archivo

**F5** — *Calcular*: recalcula la planificación, igual que el botón *Calcular* (*Inicio › Programación › Calcular*). También funciona en un campo de entrada.

**Ctrl+S** — *Guardar*: guarda el proyecto. También funciona en un campo de entrada.

**Ctrl+Shift+S** — *Guardar como*: pregunta dónde debe guardarse el archivo. En una versión de desarrollo no funciona en un campo de entrada.

**Ctrl+O** — *Abrir*: abre un archivo, normalmente en una pestaña nueva. No en un diálogo y no mientras haya cambios sin aplicar en Ajustes del proyecto.

**Ctrl+N** — *Nuevo proyecto*: abre la ventana *Nuevo proyecto*. No en un diálogo y no mientras haya cambios sin aplicar en Ajustes del proyecto.

La versión compilada (escritorio y la versión web del sitio) también bloquea varias teclas del navegador para que no estorben: Ctrl+R y Ctrl+Shift+R (recargar), F12, Ctrl+Shift+I y Ctrl+Shift+J (herramientas para desarrolladores), Ctrl+U (ver el código fuente) y Ctrl+G, Ctrl+F y Ctrl+L (buscar y barra de direcciones). Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N y F5 se envían a la propia aplicación.

## Editar

**Ctrl+C** — *Copiar*: copia las tareas seleccionadas. Solo con una selección. No en un diálogo. No en *Archivo*, no en las pestañas *Informe* e *IFC* y no mientras el panel de recursos completo esté abierto. En la tabla de tareas, Ctrl+C copia las celdas seleccionadas; la tabla se encarga de eso por sí misma.

**Ctrl+V** — *Pegar*: pega las tareas copiadas. No en un diálogo. No en *Archivo*, no en las pestañas *Informe* e *IFC* y no mientras el panel de recursos completo esté abierto, porque allí no se ve la tabla de tareas. En la tabla de tareas pega las celdas.

**Ctrl+Z** — *Deshacer*. No en un diálogo: cierre antes la ventana.

**Ctrl+Y** o **Ctrl+Shift+Z** — *Rehacer*: repite lo que deshizo. No en un diálogo.

**Delete** o **Backspace** — *Eliminar*: elimina las tareas seleccionadas. Solo con una selección. No en un diálogo. No en *Archivo*, no en las pestañas *Informe* e *IFC* y no mientras el panel de recursos completo esté abierto, porque allí no se ve la tabla de tareas. En una celda de la tabla de tareas, Delete y Backspace solo borran el contenido de la celda (consulte *Tabla*).

**F2** — *Editar...*: abre el diálogo de la tarea para la primera tarea seleccionada. Solo con una selección. No en un diálogo. En una celda de la tabla de tareas, F2 empieza a editar la celda.

**Ctrl+A** — *Seleccionar todo*: selecciona todas las tareas. No en un diálogo.

**Esc** — *Deseleccionar*: quita la selección y al mismo tiempo desactiva el modo de relación, el modo para dividir tareas y el trazado de ruta. También cierra el diálogo de la tarea y el resumen del proyecto. Durante la presentación, Esc solo cierra la presentación (consulte *Vista*). En un campo de entrada, Esc no hace nada de esto.

## Estructura

**Alt+Shift+→** o **Alt+→** — *Aplicar sangría*: mueve las tareas seleccionadas un nivel más abajo en la WBS. Solo con una selección, no en un diálogo.

**Alt+Shift+←** o **Alt+←** — *Anular sangría*: sube las tareas seleccionadas un nivel. Solo con una selección, no en un diálogo.

Aplicar sangría, anular sangría e insertar arriba o debajo de una tarea seleccionada solo funcionan en la vista de árbol sencilla: sin filtro, agrupación ni orden. En cualquier otra vista la aplicación rechaza esas acciones con un mensaje, porque el orden que se muestra entonces no es el orden del proyecto. Insertar sin selección funciona en todas las vistas.

**Insert** — *Insertar arriba*: inserta una tarea nueva encima de la tarea seleccionada más alta, al mismo nivel. Sin selección, la tarea va al final, en todas las vistas. No en un diálogo.

**Ctrl+I** — *Insertar debajo*: inserta una tarea nueva debajo de la tarea seleccionada más baja, al mismo nivel. Sin selección, la tarea va al final. No en un diálogo.

**Ctrl+M** — *Añadir hito*: añade un hito nuevo al final de la lista, aunque tenga una tarea seleccionada. No en un diálogo.

**Alt+↑** — *Mover tarea hacia arriba*: mueve la primera tarea seleccionada un lugar hacia arriba dentro de su nivel. Solo con una selección, no en un diálogo.

**Alt+↓** — *Mover tarea hacia abajo*: lo mismo, un lugar hacia abajo.

## Vista

**F11** — *Presentación*: activa o desactiva el modo de presentación. La aplicación también pide al navegador o a la ventana la pantalla completa. También funciona en un campo de entrada. En el navegador, F11 no inicia la presentación: el navegador pone la ventana en pantalla completa por sí mismo y la aplicación no cambia. F11 sí detiene una presentación en curso en el navegador.

**Esc** (durante la presentación) — *Salir de presentación*. También funciona en un campo de entrada. Esta tecla tiene prioridad sobre *Deseleccionar*.

**Ctrl+=** — *Acercar*: acerca la línea de tiempo un paso fijo. No en un campo de entrada.

**Ctrl+-** — *Alejar*: aleja la línea de tiempo un paso fijo.

**+** o **=** — *Acercar*: acerca un 10 % alrededor del centro del área de Gantt. No en un campo de entrada, y solo cuando la línea de tiempo Gantt está visible (así que no en las pestañas *Tabla*, *IFC* e *Informe*).

**-** — *Alejar*: aleja un 10 %. Las mismas restricciones.

**0** — *Restablecer zoom*: restablece el zoom al valor predeterminado y desplaza la vista al inicio. Las mismas restricciones.

**Ctrl+0** — *Ajustar al proyecto*: ajusta el zoom para que todo el proyecto quepa en la vista. Las mismas restricciones.

**Ctrl+/** — *Mostrar atajos*: abre y cierra la ventana *Atajos de teclado*. También funciona cuando hay otro diálogo abierto, pero no durante el recorrido guiado ni el diálogo de bienvenida.

**Ctrl+Shift+H** — *Histograma*: activa o desactiva el histograma, igual que el botón *Histograma* (*Recursos › Histograma › Histograma* o *Vista › Paneles › Histograma*). La aplicación recuerda su elección.

**Ctrl+Shift+L** — *Advertencias*: activa o desactiva el panel de advertencias, igual que el botón *Advertencias* (*Vista › Paneles › Advertencias* o *Planificación › Programación › Advertencias*).

## Navegación

**Ctrl+P** — *Ir a la pestaña Informe*: le lleva a la pestaña *Informe*. Por eso no es un comando de impresión. No en un diálogo.

**F1** — *Abrir ayuda*: abre *Archivo › Ayuda*. No en un campo de entrada y no en un diálogo. En una ventana, use el signo de interrogación arriba a la derecha: abre la ayuda del artículo sobre esa ventana (consulte [La cinta, pestaña por pestaña](docs://ref-lint), en *Ayuda*).

**Ctrl+1** a **Ctrl+9** — *Cambiar de documento*: va al primer documento abierto, hasta el noveno. Si ese documento no existe, no pasa nada. No en un diálogo y no mientras haya cambios sin aplicar en Ajustes del proyecto.

**Ctrl+Home** — *Ir a hoy*: desplaza la línea de tiempo para que una fecha quede a la izquierda de la vista. Es la fecha de estado si ha definido una; si no, es hoy. Por eso la etiqueta dice «hoy», aunque la línea de tiempo salte a la fecha de estado. El zoom y el inicio de la línea de tiempo no cambian. Si una celda de la tabla de tareas tiene el foco, Ctrl+Home va en cambio a la primera celda de la tabla (consulte *Tabla*).

## Tabla

Estas teclas funcionan en la tabla de tareas (en la pestaña *Tabla* y en la tabla a la izquierda del Gantt) cuando una celda tiene el foco. La ventana *Atajos de teclado* muestra las primeras seis entradas; el resto no aparece en ella.

**Tab** y **Shift+Tab** — *Celda siguiente/anterior*: va a la celda siguiente o anterior, y al final de una fila a la fila siguiente. En la última celda (Tab) o la primera (Shift+Tab), el foco sale de la tabla de tareas.

**Enter** o **F2** — *Editar celda*: abre el editor de la celda. Si la celda es de solo lectura, la tabla muestra un mensaje.

**Una letra, un dígito u otro carácter** — *Escribir reemplaza el contenido de la celda*: empieza a editar y reemplaza el contenido por lo que escriba.

**Insert** — *Insertar arriba*: inserta una tarea encima de la fila activa.

**Delete** o **Backspace** — *Borrar contenido de la celda*: borra el contenido de las celdas seleccionadas, no la tarea en sí. La ventana *Atajos de teclado* solo muestra Delete.

**Esc** — *Deseleccionar*: mueve el foco a la tabla de tareas en su conjunto, para que el siguiente Tab salga de ella, y también quita la selección como se describe arriba.

**Teclas de flecha** — van a la celda de arriba, de abajo, a la izquierda o a la derecha. Añada Shift para ampliar la selección.

**Home** y **End** — a la primera o la última columna de la fila. Si añade Ctrl, va a la primera celda de la primera fila y a la última celda de la última fila. Añada Shift para ampliar la selección.

**Page Up** y **Page Down** — una altura de pantalla hacia arriba o hacia abajo. Añada Shift para ampliar la selección.

**Enter** (mientras edita) — confirma la entrada y va a la misma columna de la fila siguiente. Shift+Enter va a la fila anterior.

**Esc** (mientras edita) — cancela la edición sin guardar la entrada.

La tabla de recursos tiene su propio manejo de teclas entre los campos de entrada; eso no aparece en esta lista.

## Diálogos y otras ventanas

Estas teclas no aparecen en la ventana *Atajos de teclado*.

**Esc** — cierra el diálogo superior (cancela). También en *Archivo* (Backstage), Esc cierra la pantalla, salvo que haya un diálogo o una lista desplegable abierta encima.

**Enter** — confirma el diálogo superior, igual que el botón principal, en los diálogos que lo admiten. Enter no hace eso en un cuadro de texto de varias líneas, en una lista desplegable abierta ni durante la entrada IME.

**Esc** durante un gesto en el Gantt — cancela un cuadro de selección (la selección se mantiene como estaba) y un gesto de división (una división ya hecha se deshace).

**Enter** y **Esc** en el selector de tipo de relación — Enter confirma, Esc cancela.

**Flecha izquierda y flecha derecha** en el divisor entre la tabla de tareas y la línea de tiempo — mueve el divisor 10 píxeles cada vez, 40 con Shift. El divisor debe tener el foco del teclado.

**Flecha arriba y flecha abajo** en la lista de recursos del histograma — elija el recurso anterior o el siguiente. El campo del histograma debe tener el foco.

## Véase también

- [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken): por qué Ctrl+P no abre una ventana de impresión.
- [Dividir una tarea](docs://howto-taak-splitsen): el gesto de división que Esc cancela.
- [Presentar en una pantalla grande](docs://howto-presentatie): F11 y Esc en la práctica.
- [Activar el guardado automático](docs://howto-automatisch-opslaan): guardar con Ctrl+S junto al guardado automático.
- [Arrastrar, desplazar y hacer zoom en el Gantt](docs://howto-gantt-bedienen): los gestos del ratón junto a las teclas.
