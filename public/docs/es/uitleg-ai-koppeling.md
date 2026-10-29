# Cómo funciona el enlace con IA

¿Qué ocurre de verdad cuando un asistente de IA trabaja en su planificación? En este artículo encontrará qué es el enlace, en qué se diferencia de intercambiar un archivo, qué límites impone la aplicación y cómo el asistente averigua cómo debe construirse una planificación. El ejemplo del final muestra con cifras qué puede hacer un asistente de una vez y qué conserva usted de ello.

## El concepto

Un asistente de IA, como un programa de chat o un asistente de programación, puede manejar otro programa a través del **Model Context Protocol** (MCP). Open Planner Studio hace de servidor en ese intercambio. La aplicación de escritorio ejecuta un servidor pequeño en su propio equipo, el **puente**. El asistente se conecta a él y recibe una lista de **herramientas**: instrumentos con un nombre que empieza por `planner_`, como leer tareas, añadir una relación o guardar una línea base. Cuáles hay, lo encontrará en [Herramientas de IA](docs://ref-ai-tools).

Lo notable es que el asistente trabaja en el proyecto que tiene abierto en ese momento, no en una copia. Usted no exporta nada, no importa nada, y no hay ningún momento en que usted y el asistente vean dos versiones distintas. Una tarea que añade el asistente aparece en el Gantt de inmediato. La aplicación lo controla: el asistente trabaja con el mismo cálculo, el mismo historial de deshacer y las mismas reglas que usted.

Cómo activa usted el enlace está en [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen). A continuación encontrará cómo funciona.

## Cómo gestiona la aplicación el enlace

### Un servidor que solo escucha a su propio equipo

El puente solo escucha en su propio equipo (`127.0.0.1`), en un puerto, 3877 de forma predeterminada. Solo acepta peticiones en la dirección `/mcp`, y solo con su **token** en la cabecera `Authorization: Bearer`. Rechaza una petición sin el token correcto. También rechaza una petición que llega desde un navegador que reconoce por una cabecera `Origin`, para que una página web que tenga abierta no pueda hablar con su planificación. Atiende las peticiones estrictamente una a una.

La conexión es HTTP normal en su propio equipo; la aplicación misma no envía nada hacia fuera. Lo que el asistente hace con la planificación que lee, por ejemplo lo que hace con ella su proveedor, depende del asistente y queda fuera de la aplicación.

### El asistente trabaja en un solo documento

En su primer cambio, el puente une la conexión al documento que está activo en ese momento. Si después cambia usted mismo de pestaña, la aplicación rechaza el siguiente cambio del asistente (código `DOC_DRIFT`) hasta que confirme con `planner_switch_document` en qué documento quiere trabajar. Así nada acaba en el proyecto equivocado. Un asistente que abre o duplica un documento por sí mismo, trabaja después en ese nuevo documento.

### Cada cambio recalcula

En la aplicación planifica usted a mano: cambia algo y luego pulsa *Calcular* (F5), salvo que *Calcular automáticamente* esté activado. Eso no se aplica a un cambio del asistente. Cada acción de escritura del asistente pasa por una sola transacción. Si cambian datos del proyecto, la aplicación recalcula al final por sí sola, una vez por script. Una herramienta de lectura siempre da fechas actuales: si la planificación está desactualizada, por ejemplo porque usted cambió algo y todavía no pulsó *Calcular*, la herramienta de lectura recalcula primero. Hay una excepción: si el proyecto está en la vista *Fechas registradas* (tras una importación), una herramienta de lectura no recalcula en silencio, porque eso sustituiría esas fechas. El asistente recibe entonces las fechas registradas, con un aviso de que no se han recalculado. Un cambio del propio asistente siempre recalcula, incluso entonces. Usted no tiene que pulsar *Calcular* tras un cambio del asistente. Después el asistente lee el resultado, como el fin del proyecto y la ruta crítica, con las herramientas de lectura. Lea también [Fechas registradas](docs://uitleg-datums-zoals-opgeslagen).

### Un script es un solo paso

Un asistente puede enviar una serie de pasos como un todo con `planner_batch`, un script de como máximo 100 pasos. Así usted tiene un solo paso de deshacer, un solo recálculo y una sola copia de seguridad. Si un paso falla de forma estructural, por ejemplo una herramienta desconocida o una referencia circular, la aplicación deshace el script entero. Usted nunca conserva una planificación a medias. Un rechazo de un elemento dentro de un paso masivo, como una línea de progreso no válida de cada veinte, es más leve: ese elemento se deja fuera y el resto se ejecuta. Los rechazos aparecen al principio de la respuesta.

### Sus límites

Usted fija cuatro cosas, en la pestaña *IA*:

- *Pausar* y *Solo lectura* dejan al asistente conectado, pero rechazan todo cambio. La lectura sigue siendo posible, incluido el recálculo de una planificación desactualizada al leer: son campos calculados, no datos del proyecto, así que no se añade ningún paso de deshacer y el proyecto no cuenta como modificado. Si usted está en medio de una edición, por ejemplo arrastrando una barra o escribiendo en un campo, una herramienta de lectura no recalcula: el asistente recibe entonces las fechas de antes de su edición, con un aviso de que están desactualizadas.
- Un diálogo abierto bloquea todo. Con un diálogo de tarea, los ajustes, el modo presentación o la ventana de bienvenida abiertos, por ejemplo, la aplicación rechaza también la lectura, porque usted está en medio de una acción manual. El asistente recibe el código de error `DIALOG_OPEN`. El mensaje nombra el nombre interno de lo que está abierto, por ejemplo `showTaskDialog` para el diálogo de tarea.
- *Copia de seguridad automática* escribe una copia IFC antes del primer cambio por documento. Si esa copia falla, la aplicación no ejecuta el cambio.
- El *Panel de actividad* muestra cada llamada, con argumentos y respuesta.

Además está su *Deshacer* normal (Ctrl+Z). El asistente comparte ese historial con usted y tiene por sí mismo `planner_undo` y `planner_redo`.

### Lo que el asistente no puede hacer

El puente es deliberadamente más estrecho que la aplicación. Lo que el asistente no puede hacer suele tener una de tres razones.

**Va más allá del proyecto.** Un asistente no puede cambiar la biblioteca de recursos. Una biblioteca la comparten todos sus proyectos y queda fuera del historial de deshacer; un cambio de tarifa tendría efecto en proyectos que ni siquiera están abiertos. Para un recurso de una biblioteca, el nombre, el tipo, la descripción, la tarifa por hora y la unidad están fijados, igual que en el panel de recursos. Lo que decide el proyecto lo puede decidir el asistente: unidades máximas, disponibilidad a lo largo del tiempo, calendario y cuadrilla. Tampoco puede elegir qué calendario es el calendario del proyecto. Puede leer el perfil de cálculo y las opciones de cálculo, pero no cambiarlos; solo puede fijar el modo de progreso y el valor predeterminado del proyecto para el tipo de tarea. No hay herramientas para ajustes, tema, idioma, extensiones o actualizaciones.

**No se presta a una validación fiable.** Un asistente no puede crear una hamaca, planificar una tarea de forma manual, poner una segunda restricción, rellenar notas, colores, códigos de actividad, campos personalizados o relaciones externas, y no puede fijar a mano un retraso de nivelación. Tampoco elige un código WBS: eso lo deriva la aplicación sola.

**Afecta algo que usted debe decidir.** Solo registra avance si hay una fecha de estado. No la elige el asistente: es su fecha de referencia. Si una tarea que no ha empezado tiene un inicio planificado posterior a la fecha de estado, el asistente debe aportar el inicio real. Lee y escribe archivos solo dentro de su carpeta de usuario, y solo sobrescribe un archivo existente si lo pide explícitamente. Una exportación no equivale a *Guardar*: el proyecto sigue sin guardar en la aplicación.

### Cómo sabe el asistente cómo planificar

Un asistente que conoce las herramientas puede, aun así, construir una planificación que ningún planificador puede aprovechar: tareas sin relaciones, una fecha fija en cada tarea o un desglose demasiado fino. Por eso la aplicación le da tres cosas.

**Las reglas básicas en el intercambio inicial.** Al conectarse, el puente envía un texto breve en el campo `instructions` del intercambio inicial de MCP. Muchos clientes ponen ese texto en su prompt de sistema; si el suyo lo hace depende del cliente. Las reglas son: empezar por los hitos y la fecha de entrega, crear tareas de más o menos un día a dos semanas, dirigir la planificación con relaciones en vez de fechas fijas, usar restricciones solo para fechas externas firmes, corregir primero un cálculo fallido, usar `planner_batch` para una serie coherente, registrar avance solo con su fecha de estado y las fechas reales que usted indique, y decir al final qué se ha supuesto y qué se ha dejado de hacer a propósito.

**La guía para asistentes.** La herramienta `planner_get_planning_guide` devuelve una guía escrita especialmente para asistentes. Sigue los mismos principios que [Planificar bien](docs://gids-goed-plannen), pero un asistente trabaja de otra manera que usted: no pulsa F5 ni hace clic en la cinta, llama a herramientas y la aplicación recalcula por él. Por eso la guía indica, para cada principio, qué herramientas usa el asistente, y explica qué hace con *Fechas registradas* o con un cálculo fallido. La guía está en inglés, como todo lo que el asistente lee a través del enlace; la herramienta admite todavía una elección de idioma por compatibilidad con asistentes antiguos, pero eso no cambia el texto. Usted puede leerla en `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. El texto de conexión de la ventana *Detalles de conexión* pide al asistente que lea primero la guía. La herramienta también funciona con un diálogo abierto, en pausa y en solo lectura, porque no lee su planificación.

**Dos habilidades.** Una habilidad es un archivo pequeño con instrucciones que un asistente lee en cada sesión. Hay dos, porque son dos tipos de trabajo. Preparar una planificación trata de lógica; actualizar el avance trata de hechos que solo usted conoce. La habilidad *goed-plannen* sirve para preparar o reestructurar una planificación: el orden en que se usan las herramientas, la regla de recálculo, `planner_batch` y la obligación de informar de los supuestos. La habilidad *progress-update* sirve para la actualización semanal de avance: primero su fecha de estado, después las fechas reales de inicio y fin y el porcentaje de avance, y luego un informe de la variación respecto a la línea base, la ruta crítica y la nueva fecha de fin. Los principios de planificación están en la guía. Las dos habilidades están en inglés. La herramienta devuelve ambas, con el lugar donde deben colocarse. Para instalarlas, consulte [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

## Un ejemplo

Usted pide a un asistente de IA que construya una ampliación con foundation, brickwork y roof, en ese orden. Su proyecto empieza el lunes 2 de marzo de 2026. El asistente lee primero la guía y después envía un solo script:

1. el inicio del proyecto el 2 de marzo de 2026;
2. tres tareas: Foundation de 5 días laborables, Brickwork de 10 y Roof de 4;
3. dos relaciones fin-comienzo: de Foundation a Brickwork y de Brickwork a Roof.

La aplicación ejecuta los tres pasos y recalcula. Si el asistente lee después, encuentra: fin del proyecto el jueves 26 de marzo de 2026, duración del proyecto de 19 días laborables y las tres tareas críticas. Eso coincide con la suma: 5 + 10 + 4 son 19 días laborables, y 19 días laborables después del lunes 2 de marzo terminan el jueves 26 de marzo. El script entero es un solo paso en su historial. Un *Deshacer* elimina las tres tareas, las dos relaciones y el nuevo inicio del proyecto.

Ahora, un caso de «¿qué pasaría si?». Usted pide después al asistente que actualice el avance, y para eso fija la fecha de estado en el lunes 16 de marzo. Una fecha de estado no es una etiqueta: el trabajo que no ha empezado no puede quedar antes de esa fecha y se desplaza hasta ella. Sin una sola línea de avance, toda la planificación se desplaza, por tanto: Foundation va del 16 al 20 de marzo, Brickwork del 23 de marzo al 7 de abril y Roof del 8 al 13 de abril. El fin del proyecto salta del 26 de marzo al 13 de abril. La planificación se retrasa dos semanas laborables, y el calendario de este ejemplo, *Bouwkalender NL*, tiene el Viernes Santo (3 de abril) y la Pascua (5 y 6 de abril). Esos dos días no laborables alargan el fin otros dos días. Por eso el asistente fija la fecha de estado solo si usted lo pide, y solo cuando hay avance real que registrar.

## Consecuencias para su planificación y malentendidos frecuentes

**El asistente no tiene copia propia.** Lo que cambia, cambia su proyecto. Con la *Copia de seguridad automática* activada, tiene una copia de seguridad IFC antes de su primer cambio. Con *Solo lectura* el asistente puede analizar sin cambiar nada.

**Un token nuevo rompe todas las conexiones.** El token es la contraseña del puente. Un token nuevo invalida el anterior, incluso con el puente en marcha, y hay que dárselo nuevo al asistente.

**Que el asistente diga que funcionó no es una prueba.** El *Panel de actividad* muestra qué herramienta llamó de verdad y qué devolvió. Un rechazo casi siempre indica el campo que estaba mal y la vía que sí funciona.

**El asistente no puede hacer un caso de «¿qué pasaría si?» con deshacer.** Comparte el deshacer con usted, así que para las variantes duplica el documento con `planner_duplicate_document`. La copia es independiente, no tiene ruta de archivo y aparece como sin guardar. El asistente no cierra variantes; eso lo decide usted.

**Una exportación del asistente no es un guardado.** Escribe un archivo IFC en una ruta que él mismo elige, dentro de su carpeta de usuario, y solo sobrescribe un archivo existente si lo pide explícitamente. Su proyecto sigue sin guardar en la aplicación y conserva su propio destino de guardado. Si importa un archivo, este se abre en una pestaña nueva o en una pestaña vacía e intacta.

## Véase también

- [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen): los pasos para iniciar el puente, conectar un asistente e instalar la habilidad.
- [Herramientas de IA](docs://ref-ai-tools): todas las herramientas por grupo, qué rechazan y cuánto tiempo se guardan las copias de seguridad.
- [Planificar bien](docs://gids-goed-plannen): los principios de planificación; el asistente los recibe en una versión en inglés con las herramientas añadidas.
- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): lo que hace la fecha de estado con su planificación.
