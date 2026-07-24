# Ruta crítica y análisis avanzado

Toda planificación tiene una cadena más larga de tareas que en conjunto determinan cuándo termina el proyecto: la ruta crítica. Todo lo que queda fuera tiene holgura — margen para retrasarse sin afectar a la fecha de fin. Esta guía va más allá de "qué barras son rojas": holgura total/libre/interferente, trabajo casi crítico, varias rutas igualmente críticas, hammocks, fijaciones forzadas y su efecto aguas arriba, y enlaces externos entre proyectos.

## Lo que aprenderá aquí

- Leer la ruta crítica, y la diferencia entre holgura total, libre e interferente.
- Trabajo casi crítico: establecer el umbral y reconocer la marca ámbar.
- Varias rutas críticas a la vez — cuándo ocurre eso y cómo se ve.
- Fijaciones forzadas y su efecto en la holgura, incluida la holgura negativa que surge aguas arriba.
- Hammocks (Level of Effort): qué hacen y qué no hacen.
- Enlaces externos entre proyectos: el anclaje congelado, la actualización y el estado "origen no cargado".
- Trazar una ruta mediante el menú contextual o la cinta.
- La sección **Cálculo** en la configuración del proyecto.

Siga el ejemplo [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — el gran ejemplo "de todo un poco" con tres torres en paralelo que muestra casi todos los temas de esta guía: varias rutas críticas, trabajo casi crítico, un hammock, una fijación forzada y un enlace externo a un archivo de origen aparte.

## Leer la ruta crítica

Pulse **F5** (o el botón **Calcular**) para ejecutar la planificación. La barra de estado al pie muestra entonces, por ejemplo, "Ruta crítica: N tareas, M días laborables" — el número de tareas en la ruta crítica y la duración total. En el diagrama de Gantt, las tareas críticas obtienen su propio color de barra (rojo): tareas sin holgura, donde cada día de retraso desplaza directamente la fecha de fin del proyecto.

Haga doble clic en una tarea y busque en la sección **Resultado CPM** las cifras exactas: **Inicio temprano**, **Fin temprano**, **Inicio tardío**, **Fin tardío**, **Holgura total**, **Holgura libre** y (cuando corresponda) **Holgura interferente**, más si la tarea está en la **Ruta crítica**. ¿Quiere estos campos como columnas en la tabla de tareas? **Vista → Columnas…** y márquelos.

### Holgura total, libre e interferente

- **Holgura total** — cuánto puede retrasarse una tarea en total sin afectar a la fecha de fin del proyecto. Cero significa crítica.
- **Holgura libre** — cuánto puede retrasarse una tarea sin afectar a su sucesora inmediata siguiente. Puede ser menor que la holgura total: una tarea puede tener algo de holgura total, y aun así, si se retrasa un solo día, su sucesora inmediata ya se mueve también (esa sucesora tiene entonces suficiente holgura propia para no afectar a la fecha de fin).
- **Holgura interferente** — la diferencia entre las dos (holgura total − holgura libre): la parte de su holgura que no afecta a la fecha de fin, pero sí "estorba" a una sucesora. Cero significa que la holgura libre y la total son iguales — retrasarse dentro de su holgura no afecta entonces a nadie.

## Trabajo casi crítico

Una tarea con una holgura total pequeña, distinta de cero, es vulnerable: un pequeño contratiempo la hace crítica después de todo. Actívelo mediante **Info del proyecto → Cálculo → Marcar casi crítico**, con un **Umbral** en días laborables (u horas, según su visualización de duración). Toda tarea con holgura total mayor que cero y menor o igual que ese umbral obtiene un color de barra ámbar en el Gantt — entre el rojo de crítica y el verde de holgura amplia.

El gran ejemplo fija el umbral en 3 días laborables. La inspección final de la **Torre C**, por tanto, tiene exactamente 3 días laborables de holgura total — justo dentro del umbral — mientras que las inspecciones finales idénticas de la **Torre A** y la **Torre B** están en holgura cero y son genuinamente críticas. La Torre C es idéntica a las otras dos en tareas y duraciones excepto por una tarea de acabado ligeramente más corta; esa pequeña diferencia basta exactamente para moverla de crítica a casi crítica.

## Varias rutas críticas

Normalmente hay exactamente una cadena más larga, pero puede ocurrir que dos o más cadenas tengan exactamente la misma longitud — entonces ambas (o todas) son igualmente críticas. Active **Múltiples rutas de holgura** (**Info del proyecto → Cálculo**) para que esto se calcule: elija el **Método** (**Holgura libre (peeling)** u **Holgura total (clasificación)**) y un **Rutas máx.**. Cada tarea obtiene entonces un número de **Ruta de holgura** (1 = la más crítica); una tarea sin ruta de holgura no está en ninguna de las rutas calculadas.

En el gran ejemplo, la Torre A y la Torre B son totalmente simétricas en tareas y duraciones — terminan exactamente al mismo tiempo. En cuanto activa **Múltiples rutas de holgura**, verá más de una ruta en los resultados (`criticalPaths.length` mayor que 1 en el cálculo): no una única cadena más larga, sino varias cadenas igualmente críticas que atraviesan el proyecto. Esa es una señal distinta de "una ruta crítica con algo de trabajo casi crítico al lado" — significa que un retraso en *cualquiera* de esas rutas afecta por igual a la fecha de fin, así que no puede centrar su atención en una sola cadena.

## Fijaciones forzadas y su efecto en la holgura

Una **fijación forzada** (la casilla **Obligatorio (fijación forzada)** en una restricción MSO o MFO) fija una tarea a una fecha, incluso si sus predecesoras la contradicen lógicamente. El gran ejemplo lo usa en "Wegafzetting gemeente (vergunde stremmingsperiode)" (cierre de vía municipal, período de cierre autorizado): el municipio solo permite el cierre exactamente en esa fecha autorizada, punto — la lógica de la red se pliega en torno a eso.

El efecto aguas arriba es la parte difícil de ver: si las predecesoras de una tarea fijada necesitan más tiempo del disponible hasta la fecha de la fijación, aparece **holgura negativa** en esas predecesoras. La holgura negativa, por tanto, no es un error de cálculo: es la forma en que el motor le dice "esta cadena anterior ya no encaja en el tiempo que permite la fijación". Si ve holgura negativa aguas arriba de una fijación forzada, la pregunta no es "qué está roto aquí", sino "cuál de estas dos cosas tiene que ceder: la fecha de la fijación, o la duración de la cadena anterior".

Nota: en el gran ejemplo, toda la cadena en torno a "Wegafzetting gemeente" — incluida la propia tarea fijada — lleva mucho tiempo completamente terminada (inicio y fin reales, bien antes de la fecha de estado). Por eso, verá allí una pequeña holgura negativa residual en toda la cadena de la fase 1, incluida la propia tarea de fijación: eso es una característica de las tareas ya completadas combinadas con una fecha de estado, no el escenario de "las predecesoras no encajan" descrito arriba. Para ver ese escenario en su forma pura: borre temporalmente la fecha de estado (grupo de la cinta **Baselines y progreso**, botón **Borrar fecha de estado**) y recalcule — la propia tarea de fijación vuelve entonces a estar en holgura total cero, y la holgura negativa solo aparece cuando alarga deliberadamente la cadena anterior más allá del margen disponible antes de la fecha de la fijación.

## Hammocks (Level of Effort)

Un **hammock** (la casilla **Hammock (duración derivada)** en el panel de propiedades) es una tarea sin entrada de duración propia: su inicio y fin siguen automáticamente sus propias relaciones. Las relaciones entrantes **FS**/**SS** aportan el **driver de inicio** (el inicio más temprano), las relaciones entrantes **FF**/**SF** aportan el **driver de fin** (el fin más tardío) — el panel muestra ambos como solo lectura en cuanto marca la casilla de hammock, para que pueda ver exactamente qué tareas determinan el intervalo. Sin un driver de fin, el intervalo vuelve a longitud cero, con una advertencia en el panel.

Lo que sí hace un hammock: muestra, como una especie de barra global, todo el intervalo de una parte del trabajo sin que usted tenga que mantener una duración propia — útil, por ejemplo, para la "supervisión" o los "gastos generales de obra" que literalmente duran lo mismo que el trabajo subyacente. Lo que no hace un hammock: no lleva recursos ni lógica propia que afecte al cálculo CPM — es una vista derivada, no una tarea determinante. El gran ejemplo lo usa para "Ruwbouw toren A (LOE)" (estructura, Torre A): un hammock que empieza en cuanto comienza la primera tarea real de estructura de la Torre A y termina en cuanto acaba la última, sin situarse él mismo en ningún punto intermedio.

## Enlaces externos entre proyectos

Los proyectos grandes a veces se componen de varias subplanificaciones gestionadas por separado — por ejemplo su propia planificación maestra y un paquete de obra vial que gestiona otro contratista. Un **enlace externo** (la ventana **Enlace externo (entre proyectos)**, que se abre mediante el botón en la pestaña **Relaciones**) registra una relación con una tarea en ese otro archivo, sin tener que abrir ese archivo como documento.

Elige un **Archivo de origen** de sus archivos recientes (se lee en modo solo lectura, nunca se abre como documento) o rellena **Manual** con un id de proyecto, un id de tarea y una fecha de anclaje si no tiene el archivo de origen a mano. Luego elige la **Dirección** (predecesora o sucesora), el **Tipo de relación** (FS/SS/FF/SF) y un **Desfase**. La **Fecha de anclaje** — la fecha de la tarea de origen en el momento en que la vinculó — queda congelada en su propio archivo; esa fecha no sigue automáticamente si el proyecto de origen cambia.

¿Quiere saber si el archivo de origen se ha actualizado desde entonces? Vaya a la pestaña **Relaciones**, sección **Enlaces externos**, y haga clic en **Actualizar este enlace** (por enlace) o **Actualizar anclajes externos** (todos a la vez) para volver a leer el archivo de origen y actualizar el anclaje. Si el archivo de origen no está disponible — movido, renombrado o nunca distribuido — el enlace muestra la etiqueta **obsoleto** con la información sobre herramientas "origen no cargado — reimporte para actualizar": la aplicación entonces no puede verificar por sí misma si el anclaje congelado sigue siendo válido.

El gran ejemplo demuestra deliberadamente justo esa última vía: la tarea "Bestrating parkeerterrein" (pavimentación del aparcamiento) está vinculada a un archivo de origen de un subcontratista de obra vial que deliberadamente *no* se distribuye con el ejemplo. Abra la tarea y verá el enlace listado con el estado "obsoleto" — una demostración honesta de lo que ocurre cuando un archivo de origen externo deja de estar disponible, en lugar de un enlace que siempre se actualiza sin problemas.

## Trazar una ruta

¿Quiere ver exactamente qué tareas afectan a una tarea dada, aguas arriba y aguas abajo? Haga clic derecho en la tarea y elija **Trazar ruta** (o **Detener trazado de ruta** para desactivarlo de nuevo) — eso resalta de una vez toda la cadena de predecesoras y sucesoras. Para un trabajo más específico, la cinta (pestaña **Planificación** o **Relaciones**, grupo de la cinta **Trazado de ruta**) tiene un par de botones aparte **Predecesoras**/**Sucesoras**: ambos apagados no muestra nada, uno activado muestra esa única dirección, ambos activados es lo mismo que el comando del menú contextual. El trazado también distingue entre todas las tareas lógicamente conectadas y las tareas que realmente están **determinando** la fecha (la misma relación "Determinante" que se muestra en la tabla de relaciones) — así ve no solo qué está conectado, sino qué está realmente marcando el rumbo.

## Configuración de cálculo

La sección **Cálculo** en **Info del proyecto** (Backstage → Info del proyecto, o la ventana **Info del proyecto**) reúne las opciones de cálculo que pertenecen a este proyecto en particular — pertenecen al archivo, no a la aplicación, así que un compañero que abra el mismo archivo obtiene el mismo resultado:

- **Definición de crítico** — **Holgura total ≤ umbral** (umbral por defecto 0) o **Ruta más larga**, que marca las tareas como críticas según la cadena más larga a través de la red, con independencia de su cifra de holgura.
- **Cálculo de holgura** — cómo se determina la holgura total para una tarea con lado de inicio y de fin: **Menor (inicio/fin)** (por defecto), **Holgura de inicio** u **Holgura de fin**.
- **Tareas de extremo abierto críticas** — trata automáticamente como críticas las tareas sin sucesora.
- **Marcar casi crítico** con **Umbral** (vea arriba).
- **Múltiples rutas de holgura** con **Método** y **Rutas máx.** (vea arriba).
- **Calendario de retraso** — qué calendario usa un desfase en días laborables: el de la **Predecesora**, el de la **Sucesora**, siempre **24 horas**, o el **Calendario del proyecto**.

## Siga leyendo

- Vea varias rutas críticas, trabajo casi crítico, un hammock, una fijación forzada y un enlace externo, todo en una misma planificación: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Las relaciones, el desfase/adelanto y las restricciones (incluida la fijación forzada) se explican con más profundidad en la guía [Relaciones y restricciones](docs://gids-relaties-constraints).
- La nivelación puede cambiar la estructura de la ruta crítica — lea la guía [Recursos, histograma y nivelación](docs://gids-resources-histogram).
- El progreso y una fecha de estado pueden producir holgura negativa en una tarea ya fijada — lea la guía [Baselines y progreso](docs://gids-baselines-voortgang).
