# Recursos, histograma y nivelación

Una tarea le dice cuándo debe ocurrir algo; un recurso le dice quién o qué lo va a hacer — y cuánto de ese recurso está disponible en un día dado. En cuanto asigna recursos a tareas, un día puede exigir más de lo que hay capacidad disponible: una sobreasignación. Esta guía muestra cómo gestionar y asignar recursos, cómo leer la carga en el histograma, y cómo (y cuándo *no*) la nivelación resuelve una sobreasignación.

## Lo que aprenderá aquí

- Los cinco tipos de recurso y cuándo usar cada uno.
- Asignar recursos a tareas — mediante el panel de propiedades, el diálogo de tarea o la cinta.
- Unidades por día y las seis curvas de distribución: cuándo elegir cuál.
- Mover una asignación a otra tarea.
- Calendarios de recursos y capacidad escalonada en el tiempo (por ejemplo una segunda grúa añadida más adelante).
- Leer el histograma: el selector de recursos, profundizar por recurso, detectar sobreasignación.
- El panel de recursos anclado junto al Gantt.
- Nivelación: las opciones en la ventana **Nivelar recursos**, la diferencia entre mantenerse dentro de la holgura y dejar que la fecha de fin se desplace, y las prioridades (incluida la prioridad 1000 = "no nivelar").
- La lección honesta: cuándo la nivelación *no* resuelve una sobreasignación.

Siga el ejemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (tamaño medio, una sobreasignación deliberada y resoluble mediante nivelación en los enlucidores) y [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (grande, casi todos los recursos sobrecargados porque tres torres necesitan las mismas cuadrillas y la misma grúa torre al mismo tiempo — el ejemplo donde la nivelación llega a sus límites).

## Los cinco tipos de recurso

Todo recurso tiene un **Tipo** (una columna en el panel de recursos):

- **Mano de obra (LABOR)** — oficios: albañiles, enlucidores, instaladores.
- **Equipo (EQUIPMENT)** — máquinas y material: una grúa torre, un montacargas de obra.
- **Material (MATERIAL)** — consumibles con una **Unidad** (por ejemplo m³ de hormigón). El material nunca se nivela ni se cuenta en el histograma — es una existencia, no una capacidad diaria que pueda desbordarse.
- **Subcontratista (SUBCONTRACTOR)** — una empresa externa con su propio techo de capacidad, por ejemplo un contratista de fachadas que solo puede desplegar dos cuadrillas a la vez.
- **Cuadrilla (CREW)** — un grupo paraguas. Otros recursos pueden unirse a una cuadrilla mediante la columna **Cuadrilla** en el panel, para agrupación/visión general; esto es puramente informativo — no hay una acumulación automática de capacidad hacia la cuadrilla.

## Gestionar recursos

Abra el panel de recursos mediante el grupo de la cinta **Gestionar** en la pestaña **Recursos**: el botón **Recursos** abre el panel completo (una vista de panel completo aparte, como Tabla o Relaciones), **Nuevo recurso** añade una fila directamente. En el panel edita, por recurso: **Nombre**, **Tipo**, **Unidades máx.** (capacidad por día laborable — 1 = una persona/elemento a jornada completa, 2 = dos unidades a la vez), **Calendario**, **Tarifa/hora**, **Unidad** (solo material) y **Cuadrilla** (a qué cuadrilla pertenece este recurso). Al pie, la columna **Total** suma el coste de cada recurso (unidades cargadas × horas/día × tarifa), recalculado en cada F5.

### Capacidad escalonada en el tiempo

Junto a **Unidades máx.** hay una flecha que despliega una subfila de **Capacidad escalonada en el tiempo**: aquí añade escalones (una fecha **Desde** + **Unidades máx.**) para capacidad que cambia a lo largo del proyecto. El gran ejemplo lo usa para la grúa torre: se sitúa en **Unidades máx. 1**, con un escalón que eleva la capacidad a **2** **a partir del día 130** — el momento en que se añade una segunda grúa. Antes de esa fecha, las tres torres tienen que compartir una única grúa; después, dos torres pueden izar a la vez.

## Asignar recursos

Hay tres sitios donde gestiona una asignación — operan sobre los mismos datos subyacentes, así que cualquier cosa que haga en uno se refleja de inmediato en los demás:

1. **Panel de propiedades** — la sección **Asignaciones** bajo una tarea seleccionada: un desplegable **Asignar recurso** con los recursos aún no asignados, y por cada asignación existente las **Uds./día**, la **Curva** y un botón para quitarla.
2. **Diálogo de tarea** — la misma sección **Asignaciones**, en la ventana **Editar tarea**.
3. **Cinta** — pestaña **Recursos**, grupo de la cinta **Asignación**, botón **Asignar ▾**. Este botón solo está activo cuando hay exactamente una tarea seleccionada que no sea hito ni resumen; el desplegable le permite establecer primero **Uds./día** y **Curva**, y luego lista debajo los recursos aún no asignados — haga clic en un nombre para completar una asignación de una vez.

Los hitos y las tareas de resumen no pueden llevar recursos (no tienen duración propia que cargar) — ambos sitios muestran una explicación en lugar del formulario de asignación.

### Mover una asignación

¿Asignó un recurso a la tarea equivocada por error, o está moviendo trabajo de una tarea a otra? En la sección **Asignaciones** del panel de propiedades (o el diálogo de tarea), cada asignación tiene un desplegable **Mover a…** que lista las tareas candidatas (tareas hoja sin este recurso, excluyendo la tarea actual). Elegir una mueve la asignación en un solo paso, incluidas sus unidades y curva — sin necesidad de quitarla y volver a crearla.

## Unidades y curvas de distribución

Toda asignación tiene **Uds./día** (1 = una persona/elemento a jornada completa, 0,5 = media jornada) y una **curva** que determina cómo se reparte esa carga a lo largo de la duración de la tarea:

- **Uniforme** — plana, la misma cantidad cada día. La opción por defecto, y el punto de partida adecuado para la mayoría de las tareas.
- **Cargado al inicio (FRONT_LOADED)** — la mayor parte del trabajo al principio de la tarea, disminuyendo hacia el final.
- **Cargado al final (BACK_LOADED)** — la imagen especular: aumentando hacia el final, por ejemplo una tarea que necesita coger impulso.
- **Forma de campana (BELL)** — bajo al principio y al final, con pico en el medio — una tarea que arranca, funciona a pleno rendimiento y desciende de nuevo.
- **Pico temprano (EARLY_PEAK)** — el pico se sitúa temprano en la tarea, y luego la carga disminuye.
- **Pico tardío (LATE_PEAK)** — el pico se sitúa tarde en la tarea.

La variación de curva se aprecia con más claridad en el histograma: la misma tarea con las mismas Uds./día produce una forma de barra muy distinta con una curva de campana que con uniforme. El ejemplo de tamaño medio mezcla deliberadamente uniforme/cargado al inicio/cargado al final en las tareas de acabado por vivienda, para que pueda comparar la diferencia.

## Calendarios de recursos

Un recurso puede estar en el **Calendario del proyecto** (por defecto) o en su propio calendario — por ejemplo para un subcontratista que solo está disponible cuatro días a la semana. Configúrelo mediante la columna **Calendario** en el panel de recursos, o el campo **Calendario** del propio recurso. Un calendario de recurso nunca toca las fechas CPM de una tarea (esas siguen funcionando con el calendario de la tarea/proyecto) — solo afecta a la **carga** y a la **nivelación**: si un recurso no trabaja un día que la tarea necesita, eso cuenta como un déficit en el histograma, y el nivelador advierte de que desplazar no soluciona ese desajuste de calendario. Vea la guía [Calendarios y planificación por horas](docs://gids-kalenders-uren) para la explicación completa de los calendarios.

## Leer el histograma

Active el histograma mediante el grupo de la cinta **Histograma** en la pestaña **Recursos** (el botón **Histograma**). Aparece una franja bajo el Gantt en el mismo eje temporal: barras por día, con la parte por encima de la línea de capacidad mostrada en rojo.

A la izquierda de las barras, por encima de la columna de la tabla de tareas, está el **selector de recursos**: una lista con "Todos los recursos" arriba y cada recurso debajo, cada uno con un punto rojo si ese recurso está sobreasignado en algún sitio. Haga clic en un nombre para centrarse en ese recurso — el histograma reescala a su carga y capacidad únicamente. Haga clic de nuevo en "Todos los recursos" para ver otra vez la suma de todos los recursos. Además de hacer clic, también puede recorrer los recursos con los botones **Anterior**/**Siguiente** en el grupo de la cinta **Histograma**, sin tocar el selector en sí.

Haga clic en una barra sobrecargada y una información sobre herramientas muestra cuántas tareas contribuyen a la carga ese día, con los primeros nombres de tarea — útil para ver rápidamente qué combinación de tareas causa la sobreasignación sin comprobar cada asignación a mano.

Si ve "Recalcula (F5) para mostrar la carga" en lugar de barras, la planificación no se ha (re)calculado desde el último cambio — el histograma, igual que la ruta crítica, es una instantánea que usted mismo actualiza.

## El panel de recursos anclado

Además del panel de recursos completo (botón de cinta **Recursos**), hay una variante compacta que puede anclar a la derecha: el botón **Anclar** en el grupo de la cinta **Gestionar**. Este panel anclado muestra solo el nombre, las **Unidades máx.** (editables directamente) y un punto rojo/verde de sobreasignación — una visión rápida junto a su Gantt sin abrir el panel completo. El panel de recursos anclado y el panel de propiedades de una tarea son mutuamente excluyentes — solo verá uno de los dos en la franja lateral derecha a la vez.

## Detectar sobreasignación

Un recurso está sobrecargado en un día en cuanto la suma de unidades de todas sus asignaciones ese día supera sus **Unidades máx.**. Verá esto en tres sitios: la parte roja de la barra en el histograma, el punto rojo en el selector de recursos y en el panel anclado, y el contador de **Sobreasignación** en el grupo de la cinta de la pestaña Recursos ("N recursos" con un icono de advertencia, o "Ninguna").

El ejemplo de tamaño medio lo hace visible a propósito: a principios de junio, los **Stukadoors** (enlucidores, unidades máx. 2) reciben una asignación de 2 unidades en tres viviendas a la vez (el enlucido de las viviendas 1, 2 y 3 se solapa allí durante unos días) — 6 unidades combinadas en el pico, muy por encima de la capacidad de 2.

## Nivelación

Abra la ventana **Nivelar recursos** mediante el botón **Nivelar…** en el grupo de la cinta **Nivelación** de la pestaña Recursos. La ventana requiere un cálculo válido y actualizado (recalcule primero con F5 si la planificación está desactualizada) y funciona en dos pasos: primero **Calcular** para una propuesta, luego **Aplicar** — nada cambia en su planificación hasta que haya visto la propuesta.

En la ventana elige:

- **Recursos** — qué recursos participan en la ejecución de nivelación (todos por defecto; el material siempre queda excluido — nunca se nivela).
- **Nivelar solo dentro de la holgura (suavizado)** — una casilla con un subtítulo claro: "la fecha de fin del proyecto no cambia". Desactivado (**nivelación**), el nivelador puede desplazar tareas tanto como sea necesario, incluso más allá de su propia holgura, lo que puede retrasar la fecha de fin del proyecto. Activado (**suavizado**), la fecha de fin es sagrada — el nivelador solo desplaza dentro de la holgura existente de cada tarea, y un conflicto que no encaje en eso se mantiene marcado como conflicto restante.

Tras **Calcular**, la ventana muestra una tabla con cada tarea cuyo inicio cambia (inicio anterior → nuevo inicio → días desplazados), una línea que informa de si cambia la fecha de fin del proyecto, y — si quedan conflictos — una sección **Conflictos restantes** con, por tarea, el motivo: un desajuste de calendario (el recurso no trabaja los días que la tarea necesita), capacidad libre insuficiente dentro de la holgura, o un desbordamiento intrínseco (una sola asignación ya exige más en su pico de lo que el recurso podría llegar a ofrecer nunca — ningún desplazamiento arregla eso). Solo cuando esté satisfecho con la propuesta hace clic en **Aplicar**.

Pruébelo usted mismo con la sobreasignación de los enlucidores en el ejemplo de tamaño medio: abra **Nieuwbouw 6 Rijwoningen De Akkers**, vaya a la pestaña **Recursos** y abra **Nivelar recursos**. Deje todos los recursos marcados, deje el suavizado desactivado y haga clic en **Calcular**: los conflictos desaparecen por completo (0 conflictos restantes), pero la fecha de fin del proyecto se desplaza aproximadamente una semana más tarde. Luego marque **Nivelar solo dentro de la holgura** y calcule de nuevo: la fecha de fin ahora se mantiene sin cambios, pero una tarea (el enlucido en una de las viviendas) permanece marcada como conflicto — simplemente no hay holgura suficiente para encajarla del todo dentro de la planificación existente. Ese es exactamente el compromiso que esta casilla hace visible: ¿resuelve el problema dejando ir la fecha de fin, o mantiene la fecha de fin fija y acepta un conflicto restante marcado?

### Prioridades

Toda tarea tiene una **prioridad de nivelación** de 0 a 1000 (500 por defecto). Haga clic derecho en una tarea y elija **Prioridad** para tres preajustes: **Baja** (100), **Normal** (500) y **Alta** (900) — en un conflicto de capacidad entre dos tareas, la que tiene mayor prioridad obtiene el primer derecho sobre la capacidad escasa. El valor **1000** es un caso especial: "no nivelar" (MS Project lo llama "Do Not Level"). Una tarea así sigue pasando por el bucle de nivelación y sigue a sus propias predecesoras, posiblemente desplazadas, pero ella misma nunca se desplaza para liberar capacidad. El gran ejemplo lo usa en "Nutsaansluitingen aanleggen" (instalación de acometidas de servicios): una fecha de conexión fija establecida por la compañía de suministro que no debe moverse, sea lo que sea que proponga la ejecución de nivelación.

**Borrar nivelación** (en el grupo de la cinta **Nivelación**) elimina de una vez todo desplazamiento aplicado anteriormente — útil para volver a la planificación original, sin nivelar, sin restablecer cada tarea a mano.

## La lección honesta: cuándo la nivelación no ayuda

La nivelación resuelve una sobreasignación reorganizando el trabajo en el tiempo — dentro de la holgura, o, si es necesario, con una fecha de fin más tardía. Eso funciona bien mientras haya suficiente margen (holgura o tiempo) en algún punto de la planificación para redistribuir el exceso de demanda. Fundamentalmente *no* funciona cuando la demanda es estructuralmente mayor que lo que jamás estará disponible, por mucho que desplace las cosas.

El gran ejemplo muestra esto en varios recursos a la vez: como las tres torres avanzan en gran parte en paralelo y comparten las mismas cuadrillas (albañiles, instaladores, enlucidores, alicatadores, la grúa torre), casi todos los recursos de mano de obra están sobrecargados en algún momento. Nivele con todos los recursos seleccionados y la fecha de fin libre, y la mayoría de los conflictos desaparecen — pero la fecha de fin del proyecto se retrasa meses, y un puñado de tareas de acabado por torre (alicatado, cocinas, sanitarios, pintura) permanecen como desbordamiento intrínseco: la carga pico de una sola asignación ya supera allí la capacidad, así que ningún desplazamiento ayuda. Active el suavizado para proteger la fecha de fin, y una parte mucho mayor de los conflictos simplemente queda sin resolver.

La lección no es que la nivelación "no funcione" — el algoritmo hace exactamente lo que se le pide. La lección es que la nivelación es una herramienta de **planificación**, no una herramienta de **capacidad**: reorganiza el trabajo existente dentro del tiempo existente, pero no crea oficios adicionales, equipos o días de calendario. Una escasez estructural — demasiado pocos enlucidores para tres torres a la vez, una única grúa torre atendiendo tres obras — requiere una solución distinta: contratar más capacidad, ajustar el fraseado (torres una tras otra en lugar de en paralelo, algo que el escalón de la segunda grúa a partir del día 130 ya hace en parte), o repartir el trabajo de otra manera. La nivelación es la herramienta que le muestra dónde duele; no resuelve por usted la cuestión de capacidad subyacente.

## Siga leyendo

- Repita usted mismo la nivelación de la sobreasignación de los enlucidores en [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Vea los límites de la nivelación en la práctica — además de los cinco tipos de recurso, las seis curvas y la capacidad escalonada en el tiempo de la grúa torre — en [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Los recursos funcionan con calendarios — lea la guía [Calendarios y planificación por horas](docs://gids-kalenders-uren) para los calendarios de recursos y la planificación por horas.
- ¿Quiere establecer una baseline antes de empezar a nivelar, para poder ver la diferencia? Lea la guía [Baselines y progreso](docs://gids-baselines-voortgang).
- La nivelación puede cambiar qué tareas son críticas — lea la guía [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse) para saber cómo detectarlo.
