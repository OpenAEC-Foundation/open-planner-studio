# Baselines y progreso

Una planificación que nunca se actualiza es una previsión. En cuanto empieza el trabajo, quiere ver dos cosas a la vez: qué se acordó originalmente, y qué está ocurriendo realmente ahora. Una **baseline** congela lo primero; el **progreso** y la **fecha de estado** siguen lo segundo. Esta guía muestra cómo guardar y gestionar una baseline, cómo hacer visible la desviación, cómo introducir el progreso, y qué hace exactamente la fecha de estado a su planificación.

## Lo que aprenderá aquí

- Guardar y gestionar una baseline, y cuál baseline está activa.
- Ver la desviación: la superposición de la baseline en el Gantt y el informe de desviación.
- Introducir progreso — porcentaje, fechas reales — mediante el panel, el diálogo de tarea y el menú contextual.
- La fecha de estado: qué hace a las tareas aún no iniciadas y a los hitos no marcados.
- Advertencias de fuera de secuencia: qué significan y cómo resolverlas.
- Leer la línea de progreso.

Siga el ejemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (una baseline antes del inicio, más progreso y una fecha de estado a mitad del proyecto) y [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (dos baselines — una baseline de contrato y una nueva baseline tras una orden de cambio — con su propio progreso y fecha de estado).

## Guardar y gestionar una baseline

Abra la ventana **Baselines** mediante el grupo de la cinta **Baselines y progreso** en la pestaña **Planificación**: **Guardar baseline…** guarda de inmediato una nueva baseline con un nombre sugerido ("Baseline 1 — [fecha]"), **Gestionar baselines…** abre la misma ventana para revisar, renombrar o eliminar.

La ventana muestra una tabla con cada baseline guardada: un botón de radio **Activa**, el **Nombre** (editable directamente), la fecha de **Creada**, y un botón de eliminar. Exactamente una baseline puede estar activa a la vez — esa es la baseline con la que compara la superposición del Gantt y el informe de desviación. Eliminar la baseline activa pide confirmación (ninguna baseline sigue activa después hasta que elija otra o guarde una nueva). Si la planificación está desactualizada desde el último cálculo, la ventana muestra una indicación junto a "Guardar nueva baseline" para recalcular primero — una baseline guardada sobre una planificación desactualizada congelaría las fechas equivocadas.

Una baseline es una instantánea: el inicio, el fin y (para los hitos) la fecha de cada tarea en el momento en que la guardó. Cambie la planificación más adelante y la baseline permanece sin cambios hasta que usted mismo guarde una nueva.

## Ver la desviación

### En el Gantt: la superposición de la baseline

Active la superposición mediante **Vista → grupo de la cinta Baselines y progreso → Superposición de la baseline**. Aparece una subbarra delgada (o un rombo para un hito) bajo cada barra de tarea, en el color de la baseline, en las fechas originales de la baseline. Si la barra principal se extiende más allá de su subbarra, puede ver de un vistazo cuánto se ha retrasado una tarea respecto a la baseline — sin abrir un informe aparte.

### Como informe: el informe de desviación

Vaya a la pestaña **Informe**, elija **Variance** en **Tipo de informe**. El informe muestra, por tarea: **Inicio de la baseline**, **Fin de la baseline**, **Inicio actual**, **Fin actual**, **Δ inicio (dl)**, **Δ fin (dl)** y un **Estado** (**En plazo**, **Más tarde**, **Más pronto**, **Nueva** para tareas añadidas desde la baseline, o **Eliminada** para tareas eliminadas desde entonces). En la parte superior, el informe totaliza el número de tareas, cuántas están más tarde y cuántas más pronto, y — si la fecha de fin del proyecto se ha desplazado — una línea con el número de días laborables de diferencia respecto a la baseline. Si no hay ninguna baseline activa, el informe lo indica explícitamente en lugar de mostrar una tabla vacía.

## Introducir progreso

El progreso se establece en tres sitios, todos con el mismo efecto:

1. **Panel de propiedades** — la sección **Progreso** bajo una tarea seleccionada: un control deslizante para el **porcentaje completado**, y (para una tarea normal) los campos **Inicio real**/**Fin real**, o (para un hito) un único campo **Fecha real**. Suba el porcentaje por encima del 0% sin una fecha de inicio real, y se rellena automáticamente con el inicio temprano planificado; bájelo de nuevo por debajo del 100% y se borra de nuevo cualquier fin real que hubiera introducido.
2. **Diálogo de tarea** — la misma sección **Progreso**, en la ventana **Editar tarea**.
3. **Menú contextual** — clic derecho en una tarea, submenú **Progreso**, con los pasos fijos **0%**, **25%**, **50%**, **75%** y **100%**. Útil para una actualización rápida sin abrir un panel; para un porcentaje intermedio o una fecha real específica, use el panel o el diálogo de tarea.

Las fechas reales nunca pueden ser posteriores a la fecha de estado — intente introducir una posterior y la aplicación la rechaza con un error. Ese es un límite deliberado: un "hecho" (algo que realmente ocurrió) no puede, por definición, situarse en el futuro respecto al momento en que está registrando el progreso.

## La fecha de estado

La **fecha de estado** (grupo de la cinta **Baselines y progreso** en la pestaña Planificación, campo **Fecha de estado**) marca "hoy" dentro de la planificación — el momento a partir del cual registró el progreso. Una vez establecida, hace dos cosas a la vez:

- Cualquier tarea o hito que aún no haya empezado (0% completado, sin inicio real) no puede empezar antes de la fecha de estado, aunque la lógica (predecesoras, relaciones) permitiría de otro modo un inicio anterior. Su inicio temprano calculado se "ajusta hacia arriba" a la fecha de estado.
- Las tareas que ya han empezado o terminado mantienen sus fechas reales — esas nunca se sobrescriben con la fecha de estado.

Puede ver esto exactamente en el ejemplo de tamaño medio: con la fecha de estado fijada en el 20 de mayo de 2027, varias tareas aún no iniciadas (por ejemplo el trabajo de albañilería y fontanería en distintas viviendas) tienen su inicio temprano fijado exactamente en esa fecha, aunque avancen en viviendas distintas y hubieran empezado, sin el suelo de la fecha de estado, en fechas diversas y anteriores.

### Por qué un hito no marcado "se desplaza hacia la derecha"

En el cálculo, un hito no es más que una tarea con duración cero, así que se aplica la misma regla: si aún no se ha marcado como completado (sin 100%, sin fecha real), su fecha calculada no puede caer antes de la fecha de estado. Siga avanzando la fecha de estado sin marcar el hito como completado, y su fecha mostrada en el Gantt sigue desplazándose hacia la derecha junto con ella, aunque no haya cambiado nada en las tareas subyacentes — la planificación está diciendo, en efecto, "este momento no puede estar en el pasado si todavía no lo ha marcado". En cuanto marca el hito como completado con una fecha real, vuelve a esa fecha fija y deja de desplazarse.

## Advertencias de fuera de secuencia

En cuanto hay una fecha de estado, el cálculo también comprueba si los hechos registrados (fechas de inicio/fin reales) no contradicen la lógica de las relaciones — por ejemplo una sucesora que ya ha empezado mientras su predecesora, según la planificación, todavía no debería haber terminado. Estos casos se llaman **fuera de secuencia** y aparecen como una advertencia en la barra de estado al pie de la pantalla ("N relación(es) fuera de secuencia"), con una información sobre herramientas para el recuento. Es una advertencia, no un error bloqueante — el cálculo continúa de todos modos.

Resuelva una advertencia de fuera de secuencia registrando la situación real con precisión: rellene la fecha real de inicio/fin que falta o es incorrecta en las tareas implicadas (mediante el panel, el diálogo de tarea o el menú contextual, como antes), de modo que los hechos registrados vuelvan a alinearse con lo que lógicamente debía haber precedido. A menudo esto simplemente significa: una tarea que en realidad ya ha terminado aún no se había marcado así en la planificación.

## La línea de progreso

Active la línea de progreso mediante **Vista → grupo de la cinta Baselines y progreso → Línea de progreso**. Dibuja una línea discontinua naranja (4/4 guiones, el mismo estilo que la línea de fecha de estado) que traza, para cada tarea, un punto en la posición correspondiente a su porcentaje completado, y lo conecta con la fecha de estado — el clásico patrón en zigzag. Un quiebro a la izquierda de la fecha de estado significa que una tarea va por detrás de lo esperado según el tiempo transcurrido; un quiebro a la derecha significa que va por delante. La línea de progreso ya dibuja ella misma la vertical de la fecha de estado como columna vertebral del zigzag, así que el interruptor independiente **Línea de fecha de estado** (mismo grupo de la cinta) queda en segundo plano mientras la línea de progreso está activada — solo vuelve a ser visible cuando desactiva la línea de progreso y aún quiere ver la fecha de estado como una simple línea vertical.

## Siga leyendo

- Vea una baseline antes del inicio y progreso a mitad de proyecto en la práctica: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Vea dos baselines (Contrato → nueva baseline tras una orden de cambio) en la práctica: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Los recursos y su carga también se recalculan en cada F5 — lea la guía [Recursos, histograma y nivelación](docs://gids-resources-histogram) para la sobreasignación y la nivelación.
- El progreso y una fecha de estado pueden producir holgura negativa en una tarea que ya está fijada — lea la guía [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse) para saber cómo interpretarlo.
