# Planificación y WBS

Una planificación empieza con una estructura de tareas: ¿qué tareas existen, cómo se descomponen en fases, y qué momentos son lo bastante importantes para merecer un hito? Esta guía profundiza más en esa base que la guía [Inicio rápido](docs://quick-start) — aquí aprenderá no solo *cómo* sangrar, sino también qué hace realmente una tarea de resumen, en qué se diferencian los tres tipos de hito, cómo dar a las tareas sus propios códigos y campos, y cómo llevar notas por tarea.

## Lo que aprenderá aquí

- Construir una estructura de tareas (WBS) mediante sangrado y tareas de resumen.
- Mover tareas dentro del mismo nivel, sin volver a sangrar — con el teclado, arrastrando, o en
  la pestaña **Tabla** de estilo hoja de cálculo.
- Los tres tipos de hito y el indicador de obligatoriedad independiente para los momentos contractuales.
- Gestionar códigos de actividad y campos personalizados mediante la ventana **Códigos y campos**, y agrupar por ellos.
- Usar notas (una lista de comprobación por tarea) para llevar el seguimiento de los puntos pendientes.

¿Prefiere seguir un ejemplo completo? Abra [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) mediante **Archivo → Ejemplos** — el fraseado "1. Voorbereiding" (Preparación) / "2. Fundering & ruwbouw" (Cimentación y estructura) / "3. Afbouw" (Acabados) / "4. Oplevering" (Entrega) con sus subtareas es exactamente la estructura que se explica a continuación.

## Construir una estructura de tareas

Una lista plana de tareas no dice nada sobre cómo se relacionan. Al sangrar una tarea bajo otra, construye una estructura en árbol (WBS — Work Breakdown Structure): la tarea padre se convierte entonces automáticamente en una **tarea de resumen**.

1. Seleccione la tarea que quiere colocar más profundamente en la estructura.
2. Pulse **Alt+→** para sangrar. Hay un segundo atajo para la misma acción: **Alt+Mayús+→** — útil si su distribución de teclado ya usa Alt+→ para otra cosa. Ambos hacen exactamente lo mismo.
3. ¿Prefiere trabajar con el ratón? Haga clic derecho en la tarea y elija **Sangrar** en el menú contextual.
4. ¿Se pasó un nivel? **Alt+←** (o clic derecho → **Reducir sangría**) devuelve la tarea un nivel hacia atrás.
5. Para una subtarea completamente nueva hay una vía más rápida: haga clic derecho en la tarea padre y elija **Añadir subtarea**. Eso crea una nueva tarea, ya sangrada, en un solo paso, en lugar de añadir primero una tarea y sangrarla después por separado.

En cuanto una tarea tiene al menos una subtarea, se convierte automáticamente en una tarea de resumen: su barra en el diagrama de Gantt abarca entonces todo el período desde el inicio más temprano hasta el fin más tardío de todas las subtareas que hay debajo, y su propia duración y fechas ya no pueden establecerse de forma independiente. Una tarea de resumen es, por tanto, siempre un valor derivado, nunca una planificación que se introduce directamente — elimine o desplace las subtareas, y la barra de la tarea de resumen se ajusta automáticamente.

**Contraer y expandir.** Con una WBS grande, a veces querrá compactar el árbol temporalmente. La pestaña de la cinta **Vista**, grupo **Esquema**, tiene dos botones separados para esto — **Contraer** y **Expandir** — deliberadamente no un único interruptor, porque con una selección mixta (algunas ramas abiertas, otras cerradas) un interruptor nunca podría dejarlo todo igual.

- **Con una selección**, los botones actúan sobre las tareas seleccionadas; solo se ven afectadas las tareas con subtareas, las tareas independientes se ignoran.
- **Sin selección**, actúan sobre toda la planificación. Deseleccione con **Esc**, o haga clic en una zona vacía de la vista de Gantt.
- En una vista agrupada (vea *Agrupar por códigos y campos* más abajo) los botones contraen/expanden las bandas de grupo en su lugar — incluidas las bandas anidadas — en lugar de las tareas.

La flecha delante de una tarea de resumen sigue funcionando como antes, para abrir o cerrar solo esa rama.

### Insertar una tarea nueva en el sitio correcto

Las tareas nuevas ya no tienen por qué acabar al final. Todos los botones y teclas que crean una tarea siguen la misma regla:

- **Si hay una tarea seleccionada**, la nueva tarea se coloca justo **debajo** de ella, y no al final de toda la lista. Hereda el nivel y la tarea superior de su selección, así que una tarea nueva dentro de una fase se queda en esa fase.
- **Si no hay nada seleccionado**, va al final, como siempre.
- **Si hay varias tareas seleccionadas**, se coloca debajo de la tarea **más baja** de su selección tal y como aparece en pantalla — nunca en medio de la selección, y el orden en que las haya pulsado no influye.

Esto vale para el botón **Tarea** y el menú **Hito** del grupo de cinta **Tareas**, y también para **Nueva tarea** en el menú contextual. Ese grupo está tanto en la pestaña **Inicio** como en la pestaña **Tabla**, con los mismos tres botones (**Tarea**, **Hito**, **Enlace**), de modo que ya no hace falta cambiar de pestaña para introducir tareas.

Con el teclado es aún más rápido:

- **Insert** inserta una tarea **encima** de la selección.
- **Ctrl+I** (**Cmd+I** en macOS) inserta una tarea **debajo** de la selección — normalmente adonde quiere ir mientras recorre una lista.

Ambas aparecen también en el resumen de atajos (**Ctrl+/**), en la categoría **Estructura**.

**Solo en la vista de árbol normal.** Insertar encima o debajo es una intervención estructural, y solo tiene sentido mientras el orden mostrado sea el orden real. Con un filtro, una ordenación o una agrupación activa, la tarea nueva aparecería en un sitio distinto de donde la ha puesto. La aplicación rechaza entonces la inserción encima/debajo y muestra una franja que explica el motivo, con un botón para borrar filtro, ordenación y agrupación de una sola vez. Los botones **Tarea** e **Hito** siguen funcionando, pero colocan la tarea al final — con la misma explicación.

### Mover tareas sin volver a sangrar

Además de cambiar el nivel de una tarea (sangrar/reducir sangría), también puede intercambiar la posición de una tarea dentro del mismo nivel, sin cambiar la estructura en sí:

- **Alt+↑** mueve la tarea seleccionada hacia arriba, por encima de la tarea que tiene actualmente encima.
- **Alt+↓** mueve la tarea hacia abajo.

Esto funciona en cualquier nivel del árbol: mueva una tarea de fase, y todas sus subtareas se mueven automáticamente con ella.

¿Prefiere el ratón? Agarre una tarea por su fila en la tabla de tareas (la columna izquierda de la
vista de Gantt, con el mismo comportamiento de arrastre en la pestaña de la cinta **Tabla**) y
arrástrela hacia arriba o hacia abajo. Suéltela entre dos filas para reordenarla entre sus hermanas,
igual que Alt+↑/↓. Suéltela en cambio sobre la parte inferior de la fila de una tarea de resumen, y
se anida: la tarea se convierte en la nueva última subtarea de esa tarea de resumen, sangrándose en
un solo movimiento — es el equivalente en ratón de Alt+→. Seleccione varias tareas primero
(Ctrl/Cmd+clic, o una selección por rectángulo) y toda la selección se arrastra y suelta junta.

La pestaña de la cinta **Tabla** muestra esta misma estructura como una cuadrícula plana y editable,
útil cuando está introduciendo o corrigiendo muchas tareas a la vez: un solo clic en cualquier celda
editable inicia la edición de inmediato con el valor existente seleccionado, las teclas de flecha
mueven un cursor de celda sin abrirla, **F2**/**Enter** abre la celda actual para editarla, y
**Tab**/**Mayús+Tab** va a la celda siguiente/anterior, continuando en la fila de tarea
siguiente/anterior. La sangría sigue usando **Alt+→**/**Alt+←**.
Llegar a **Enter** o **↓** en la última fila crea ahí mismo una nueva tarea hermana con el cursor ya
en su celda de nombre, para que pueda seguir introduciendo toda una lista sin tocar el ratón — esto
solo funciona en la vista de árbol normal, ya que un filtro, una ordenación o una agrupación activa
podría hacer que la tarea nueva desapareciera de la vista, así que la aplicación pregunta primero en
lugar de colocar en silencio una tarea que no puede ver.

## Tipos de hito

Un hito es una tarea sin duración que marca un momento — un inicio, una entrega, una inspección. Open Planner Studio tiene tres formas de añadir un hito, todas mediante el grupo de la cinta **Tareas**, usando la flecha junto al botón **Hito**:

- **Hito de comienzo** — marca el inicio de una fase o del proyecto.
- **Hito de fin** — marca una finalización, por ejemplo una entrega.
- **Punto de inspección (obligatorio)** — en la práctica, un hito de fin con el indicador **Obligatorio (contractual)** ya marcado y su Tipo establecido directamente en **Inspección**, de modo que un momento de inspección se reconoce desde el principio como contractualmente obligatorio y como inspección a la vez.

¿Prefiere el atajo **Ctrl+M**? Eso le da un hito genérico ("Nuevo hito") que después renombra y tipifica usted mismo.

Verá este mismo desglose en el panel de propiedades en cuanto seleccione un hito con la casilla **Hito** activada: el campo **Tipo de hito** ofrece **Automático**, **Hito de comienzo** o **Hito de fin**. "Automático" deja que el motor de planificación decida cómo se comporta el hito según sus relaciones — elija esto si el hito no tiene un carácter marcado de inicio o de fin. Aparte, está la casilla **Obligatorio (contractual)**: eso marca un hito como vinculante contractualmente, independientemente de si es un hito de comienzo o de fin. Así puede, por ejemplo, hacer obligatorio también un hito de comienzo, o — como con el **Punto de inspección** — configurar de un clic un hito de fin obligatorio.

## Códigos y campos: códigos de actividad y campos personalizados

Las planificaciones más grandes necesitan pronto dimensiones adicionales que no encajan en la WBS: qué unidad, qué disciplina, qué contratista. Para eso están los **códigos de actividad** y los **campos personalizados**, ambos gestionados mediante la ventana **Códigos y campos** (el grupo de la cinta **Estructura** en la pestaña **Planificación**, botón etiquetado **Códigos y campos**).

- Los **códigos de actividad** son dimensiones libremente definibles (por ejemplo "Ubicación" o "Disciplina") con una lista de valores — cada valor tiene un **Código**, una **Descripción** y un **Color**. Una tarea puede tener como máximo un valor por tipo de código. Use **Añadir tipo de código** para iniciar una nueva dimensión, y **Añadir valor** para construir los valores posibles.
- Los **campos personalizados** son campos propios tipados — **Texto**, **Número**, **Número entero**, **Coste**, **Fecha** o **Sí/no** — que aparecen como columna en la tabla de tareas y se pueden rellenar por tarea. Piense en un campo "Contratista" (texto) o "Permiso recibido" (sí/no).

Una vez creados, asigna un código de actividad o rellena un campo personalizado mediante las columnas de la tabla de tareas (hágalas visibles primero mediante **Vista → Columnas…** si es necesario) o mediante el panel de propiedades de la tarea.

### Agrupar por códigos y campos

Los códigos de actividad y los campos personalizados realmente dan sus frutos en cuanto agrupa por ellos: vaya a la pestaña de la cinta **Vista**, abra **Agrupar** y elija el código de actividad o el campo personalizado por el que agrupar en **Campo**. La tabla de tareas muestra entonces encabezados de grupo en lugar del árbol WBS — útil para ver, por ejemplo, todas las tareas por unidad o por disciplina juntas, a través de todo el fraseado. Puede configurar hasta dos niveles de agrupación a la vez (por ejemplo primero por unidad, luego por disciplina).

## Notas: una lista de comprobación por tarea

Cada tarea tiene una sección **Notas** en el panel de propiedades — en esencia, una pequeña lista de comprobación que permanece adjunta a la tarea. Está pensada para el tipo de acciones sueltas que no encajan en una fecha de planificación: "todavía hay que consultar con el contratista", "todavía hay que pedir material", "esperando el plano v2".

1. Haga clic en **+ Añadir nota**. Aparece una nueva fila vacía con el foco en el campo de texto.
2. Escriba el texto de la nota.
3. Marque la casilla una vez resuelto el punto — el texto queda entonces tachado, pero la nota sigue visible (marcada como hecha en lugar de eliminada) para que el historial de una tarea siga siendo legible.
4. Use el icono de papelera para eliminar una nota de forma permanente.

Las notas son puramente informativas: no afectan a la planificación ni al cálculo, así que son la herramienta adecuada para observaciones que no se pueden expresar como fecha o duración. Vea una mezcla de notas abiertas y completadas en la práctica en el ejemplo de tamaño medio "Nieuwbouw 6 Rijwoningen De Akkers" (etiqueta *aantekeningen*/notas en **Archivo → Ejemplos**).

## Siga leyendo

- Vea esta estructura — fases, tareas de resumen, hitos — en la práctica en [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Ahora que la estructura está lista, el siguiente paso es vincular las tareas entre sí: lea la guía [Relaciones & restricciones](docs://gids-relaties-constraints).
- ¿Todavía es nuevo en Open Planner Studio? Empiece con la guía [Inicio rápido](docs://quick-start) para un ejercicio continuo desde un proyecto vacío hasta una planificación calculada.
