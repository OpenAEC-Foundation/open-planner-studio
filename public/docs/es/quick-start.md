# Su primera planificación en 10 minutos

Esta guía le lleva, en unos 10 minutos, de un proyecto vacío a una planificación de obra completamente calculada: añadir tareas, construir una estructura de tareas, añadir relaciones, calcular y guardar. Sin teoría previa — simplemente lo hace, paso a paso, usando los botones y menús exactos que encontrará en Open Planner Studio.

## Lo que va a hacer

1. Crear un nuevo proyecto.
2. Añadir tareas — mediante la cinta, la tabla de tareas y el diagrama de Gantt.
3. Organizar las tareas en una estructura (WBS) mediante sangrado.
4. Añadir relaciones entre tareas.
5. Calcular la planificación.
6. Leer el resultado: ruta crítica y holgura.
7. Guardar.

¿Prefiere ver antes hacia dónde se dirige? Abra el proyecto de ejemplo [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) mediante **Archivo → Ejemplos**. (Los nombres de ejemplo se muestran en neerlandés, tal como vienen incluidos con el proyecto.) Es una planificación pequeña y fácil de leer que ya muestra casi todos los pasos siguientes — cómoda de tener abierta junto a este artículo para comparar.

Todo lo que sigue funciona de forma idéntica en la aplicación de escritorio y en la versión de navegador: los mismos botones, los mismos menús, los mismos atajos.

## Paso 1 — Crear un nuevo proyecto

1. Haga clic en la pestaña de la cinta **Archivo**. Esto abre la pantalla de archivo.
2. Haga clic en **Nuevo** (o use el atajo **Ctrl+N** si ya está trabajando en otro proyecto). Aparece el diálogo **Nuevo proyecto**.
3. Introduzca un **Nombre del proyecto**, por ejemplo "Mi primera planificación", y compruebe la **Fecha de inicio** — por defecto es hoy.
4. En **Plantilla de fases**, elija **Vacío**. Las plantillas **Construcción residencial** y **Edificación / renovación** ya configuran algunas tareas de fase por usted, pero para este ejercicio construirá todo usted mismo para reconocer cada paso.
5. Deje las opciones de calendario en sus valores predeterminados y haga clic en **Crear**.

Ahora tiene un proyecto vacío: una tabla de tareas vacía a la izquierda, un diagrama de Gantt vacío a la derecha, y un calendario laboral ya configurado a partir de los ajustes predeterminados.

## Paso 2 — Añadir tareas

Asegúrese de estar en la pestaña de la cinta **Inicio**. Esta pestaña muestra la tabla de tareas (izquierda) y el diagrama de Gantt (derecha) uno junto al otro — dos vistas de la misma planificación, así que una tarea que añada aparece en ambos sitios a la vez.

### Mediante la cinta

1. En el grupo de la cinta **Tareas**, haga clic en el botón **Tarea**. Aparece una nueva tarea llamada "Nueva tarea", con una duración de 5 días laborables, al final tanto de la tabla de tareas como del diagrama de Gantt.
2. Repita esto varias veces hasta tener una tarea para cada fase principal de su proyecto. Si sigue el proyecto de ejemplo, use las mismas fases principales que él: "1. Voorbereiding" (Preparación), "2. Fundering & ruwbouw" (Cimentación y estructura), "3. Afbouw" (Acabados) y "4. Oplevering" (Entrega).
3. Haga doble clic en una tarea — en la tabla o en su barra en el diagrama de Gantt — para abrir la ventana **Editar tarea**. Ajuste el **Nombre**, el **Tipo** y la **Duración (días laborables)** para que coincidan con su fase.

### Mediante la tabla de tareas y el diagrama de Gantt

No tiene que volver siempre a la cinta. Haga clic derecho en una **fila vacía** de la tabla de tareas, o en un espacio vacío del diagrama de Gantt (donde todavía no hay ninguna tarea), y elija **Nueva tarea** en el menú contextual.

Haga clic derecho en una tarea **existente**, en cambio, y obtiene un menú contextual distinto con, entre otros:

- **Insertar arriba** / **Insertar debajo** — añade una tarea antes o después de la tarea sobre la que hizo clic derecho.
- **Añadir subtarea** — crea una nueva tarea como hija de esa tarea en un solo paso (vea el paso 3 para saber qué significa eso).

¿Escribió algo mal, o añadió una tarea en el sitio equivocado? **Ctrl+Z** deshace la última acción, **Ctrl+Y** (o **Ctrl+Mayús+Z**) la rehace — ambos funcionan en toda la planificación, no solo en los campos de texto.

### Añadir un hito

Toda planificación necesita al menos un hito, por ejemplo para la entrega. En el grupo de la cinta **Tareas**, haga clic en la flecha junto a **Hito** y elija **Hito de fin**, **Hito de comienzo** o **Punto de inspección (obligatorio)** — o use el atajo **Ctrl+M** para un hito genérico rápido ("Nuevo hito") que renombra después.

## Paso 3 — Construir una estructura de tareas (WBS)

Una lista plana de tareas se vuelve confusa rápidamente. Al sangrar tareas construye una estructura de tareas (WBS): la tarea de arriba se convierte entonces automáticamente en una **tarea de resumen** que abarca todo el período de sus subtareas.

1. Seleccione una tarea que deba quedar bajo otra tarea — por ejemplo "Fundering aanbouw" (Cimentación de la ampliación) bajo la tarea de fase "2. Fundering & ruwbouw" (Cimentación y estructura).
2. Pulse **Alt+→** para sangrar, o haga clic derecho y elija **Sangrar** en el menú contextual. La tarea de arriba se vuelve visible de inmediato como tarea de resumen.
3. ¿Se pasó de nivel, o quiere devolver una tarea al nivel superior? Use **Alt+←**, o haga clic derecho y elija **Reducir sangría**.
4. Más rápido para una subtarea completamente nueva: haga clic derecho en la tarea padre y elija **Añadir subtarea** — así se salta los pasos separados de añadir y luego sangrar.

Repita esto hasta llegar a unos cuantos niveles de profundidad. En el proyecto de ejemplo, la fase "2. Fundering & ruwbouw" por ejemplo se descompone en las subtareas "Grondwerk aanbouw" (Movimiento de tierras de la ampliación), "Fundering aanbouw" (Cimentación de la ampliación), "Begane grondvloer storten" (Vertido de la planta baja), "Wanden opmetselen" (Levantamiento de muros) y "Dakconstructie plaatsen" (Instalación de la estructura de cubierta).

Este artículo solo cubre la construcción de la WBS a nivel práctico, para que pueda empezar. Para aprender cómo interactúan en detalle los tipos de hito, las tareas de resumen y los códigos de actividad, lea la guía [Planificación y WBS](docs://gids-plannen-wbs).

## Paso 4 — Añadir relaciones

Las tareas sin relaciones son independientes entre sí y no se desplazan cuando cambia una tarea anterior. Una relación (dependencia) vincula dos tareas entre sí.

1. Asegúrese de que las barras de las dos tareas que quiere vincular sean visibles en el diagrama de Gantt.
2. Mantenga pulsado **Mayús** y arrastre desde la barra de la predecesora hasta la barra de la sucesora. En cuanto suelte, se crea de inmediato una relación **Finish-Start (FS)** con un desfase de 0 días laborables — la relación más común: la sucesora empieza solo una vez que la predecesora ha terminado.
3. Justo después de soltar, aparece la ventana **Tipo de relación**. Aquí puede cambiar el tipo de relación (**FS**, **SS**, **FF** o **SF**) e introducir un **desfase**, por ejemplo `2d` para dos días laborables de espera entre las tareas. En resumen: con **FS** (Finish-Start) la sucesora empieza después de que termine la predecesora, con **SS** (Start-Start) ambas tareas empiezan (aproximadamente) al mismo tiempo, con **FF** (Finish-Finish) terminan (aproximadamente) al mismo tiempo, y con **SF** (Start-Finish) la predecesora debe empezar antes de que se permita terminar a la sucesora — esta última es la menos habitual en la práctica de la construcción.
4. ¿Prefiere vincular dos tareas sin arrastrar? Vaya a la pestaña de la cinta **Relaciones** (o haga clic en **Gestionar** en el grupo de la cinta **Relaciones** de la pestaña Planificación), seleccione primero la predecesora, luego (manteniendo pulsado Ctrl/Cmd) la sucesora, y use el botón **Nueva relación a partir de la selección** — ese botón solo funciona cuando hay exactamente dos tareas seleccionadas, en ese orden.

Para el ejercicio, añada al menos dos relaciones: por ejemplo "1. Voorbereiding" → "2. Fundering & ruwbouw" y "2. Fundering & ruwbouw" → "3. Afbouw".

## Paso 5 — Calcular

Ahora que tiene tareas y relaciones, puede hacer que se calcule la planificación (CPM — Critical Path Method).

1. Pulse **F5**, o haga clic en el botón **Calcular** del grupo de la cinta **Programación**.
2. Open Planner Studio calcula ahora, para cada tarea, las fechas de inicio y fin más tempranas y más tardías, la holgura, y qué tareas están en la ruta crítica.
3. ¿No quiere volver a pensar en F5? Active **Calcular automáticamente** en **Configuración**. La planificación se recalcula entonces sola en cuanto queda desactualizada, en lugar de esperar a que pulse F5 manualmente.

## Paso 6 — Leer el resultado

- En la parte inferior de la pantalla, la barra de estado muestra, por ejemplo, "Ruta crítica: 4 tareas, 62 días laborables" una vez calculada la planificación. Si ha cambiado algo desde el último cálculo, muestra en su lugar "Desactualizado — recalcula (F5)".
- En el diagrama de Gantt, las tareas críticas — tareas sin holgura, que por tanto determinan directamente la fecha de fin del proyecto — reciben un color de barra distinto al de las tareas que aún tienen margen (holgura). Si una tarea crítica se retrasa, toda la fecha de fin del proyecto se desplaza con ella; una tarea con holgura puede retrasarse sin consecuencias, mientras la holgura no se agote.
- Haga doble clic en una tarea para volver a abrir la ventana **Editar tarea**. En la sección **Resultado CPM** encontrará, por tarea: **Inicio temprano**, **Fin temprano**, **Inicio tardío**, **Fin tardío**, **Holgura total**, **Holgura libre**, y si la tarea está en la **Ruta crítica**.
- ¿Quiere tener estos datos también como columnas en la tabla de tareas, en lugar de tener que abrir cada tarea? Vaya a la pestaña de la cinta **Vista**, haga clic en **Columnas…** en el grupo **Visualización**, y marque **Crítica** y **Holgura total**.

## Paso 7 — Guardar

1. Pulse **Ctrl+S**, o haga clic en **Guardar** en la pestaña **Archivo**. La primera vez, Open Planner Studio pide un nombre de archivo y una ubicación; el proyecto se guarda como un archivo IFC nativo.
2. ¿Quiere guardar una copia con otro nombre, por ejemplo para mantener dos variantes en paralelo? Use **Archivo → Guardar como** (atajo **Ctrl+Mayús+S**).

## Siga practicando

- Repita los pasos anteriores con un ejemplo completo: abra [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) mediante **Archivo → Ejemplos** y reconozca la cadena FS entre las fases, el solape SS entre el trabajo de muros y de cubierta, el enlace FF entre el trabajo de alicatado y de pintura, y la restricción de permiso (SNET) antes del inicio.
- ¿Quiere saber más sobre la estructura de tareas, las tareas de resumen, los tipos de hito y los códigos de actividad? Lea la guía [Planificación y WBS](docs://gids-plannen-wbs).
- ¿Prefiere hacer un recorrido visual por las áreas principales de la pantalla? Reinicie el recorrido mediante la pestaña **Vista** → botón **Recorrido**, o mediante **Archivo** → **Iniciar recorrido**.
