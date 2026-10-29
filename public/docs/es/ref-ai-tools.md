# Herramientas de IA (planner_*)

Todas las herramientas que un asistente de IA puede llamar a través del puente, por grupo, con lo que hacen y lo que rechazan. Todas empiezan por `planner_`. El aviso de conexión de la ventana *Detalles de conexión* indica el número actual, y el asistente recibe la lista completa con descripciones del propio puente (`tools/list`). El porqué de que la conexión funcione así está en [Cómo funciona la conexión con IA](docs://uitleg-ai-koppeling). Cómo la activa está en [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

## Cómo leer esta lista

**Lectura** significa: la herramienta no cambia nada. Eso funciona también durante *Pausar* y *Solo lectura*. Un cuadro de diálogo abierto sí la bloquea (véase *Cuando se rechaza una herramienta* más abajo). Una herramienta de lectura siempre da fechas actuales: si la planificación está desactualizada, la aplicación la recalcula primero, también durante *Pausar* y *Solo lectura*. Esos modos frenan los cambios, no el recálculo al leer. Si está en medio de una edición (arrastrar una barra, escribir en un campo), la aplicación no recalcula; el asistente recibe entonces las fechas de antes de su edición, con un aviso de que están desactualizadas. Si el proyecto está en la vista *Fechas registradas*, la aplicación no recalcula; el asistente recibe entonces las fechas registradas, con un aviso de que no se han recalculado.

**Cambio** significa: la herramienta cambia su proyecto. Se rechaza durante *Pausar*, *Solo lectura* y cuando hay un cuadro de diálogo abierto. Eso vale también para las herramientas sin etiqueta abajo (`planner_undo`, `planner_redo`, las herramientas de archivos y las de documentos, salvo `planner_list_documents`). Cada cambio es un paso en su historial de deshacer. Si cambian datos del proyecto, la aplicación recalcula la planificación después por sí misma; usted no tiene que pulsar *Calcular*. Antes del primer cambio por documento, la aplicación escribe una copia de seguridad, si *Copia de seguridad automática* está activada.

**Lote** significa: una llamada puede contener varios elementos. Un elemento no válido se rechaza con un motivo, y los elementos válidos se quedan. La respuesta indica los elementos rechazados.

## Lectura: planificación

- `planner_get_project_info` (lectura) — datos del proyecto y cifras clave: el número de tareas, relaciones, recursos e hitos, la fecha de estado, el fin y la duración del proyecto, si la planificación está desactualizada, el perfil de cálculo y un resumen de los calendarios. Una buena primera llamada.
- `planner_get_project_overview` (lectura) — toda la estructura WBS en una sola respuesta: por id de tarea, WBS, nombre, duración, fechas tempranas, avance, si es crítica, y las relaciones salientes con su id de relación.
- `planner_list_tasks` (lectura) — tareas con filtros (críticas, estado, ventana de fechas, tareas sin relaciones) y paginación.
- `planner_get_task` (lectura) — una tarea en detalle: fechas, holgura, avance, restricciones, fecha límite, calendario, asignaciones, predecesores y sucesores, interrupciones.
- `planner_get_critical_path` (lectura) — las tareas críticas con su holgura total, y las relaciones que determinan la ruta crítica.
- `planner_list_resources` (lectura) — recursos con capacidad, tarifa, calendario, cuadrilla, disponibilidad y un resumen de sus asignaciones. Si un recurso viene de la biblioteca de recursos, muestra qué campos están fijos.
- `planner_get_resource_histogram` (lectura) — carga frente a capacidad por recurso, por día, semana o mes (por semana de forma predeterminada). Sin ventana y sin recursos da un resumen por recurso. Con una ventana o con recursos da la serie completa y las tareas que causan una sobreasignación.
- `planner_get_calendars` (lectura) — todos los calendarios con su definición completa y cuántas tareas y recursos los usan.

## Lectura: líneas base y variación

- `planner_list_baselines` (lectura) — las líneas base guardadas y cuál está activa.
- `planner_compare_baseline` (lectura) — la planificación actual frente a la línea base activa: solo las tareas que difieren y la diferencia en el fin del proyecto, en días laborables del calendario actual del proyecto. Sin línea base activa, la herramienta lo rechaza.
- `planner_analyze_delay` (lectura) — análisis de retraso frente a la línea base activa: la diferencia en la entrega y las tareas críticas que se han desplazado. Sin línea base activa, la herramienta lo rechaza.

## Tareas y estructura

- `planner_add_tasks` (cambio, lote) — crea tareas, incluida una WBS anidada en una sola llamada. Cada tarea recibe su propio nombre temporal (`tmp-…`), para que una subtarea pueda referirse a su tarea superior. Sin duración, una tarea recibe 5 días laborables. Un hito tiene duración 0. Todas las tareas de una llamada se crean juntas o no se crea ninguna.
- `planner_update_tasks` (cambio, lote) — cambia campos de tareas existentes: nombre, descripción, duración con unidad (días u horas), tipo de duración, categoría de trabajo, hito, obligatoria, prioridad, restricción, fecha límite, calendario y tipo de tarea. También hay una vía para el avance: porcentaje de avance, inicio real y fin real. Cualquier otra clave se rechaza con un motivo.
- `planner_delete_tasks` (cambio) — elimina tareas, incluido todo su subárbol, relaciones y asignaciones. La respuesta indica exactamente qué se ha eliminado con ellas.
- `planner_move_task` (cambio) — coloca una tarea bajo otra tarea superior, con una posición. Una referencia circular, o colocar una tarea bajo sí misma, se rechaza.
- `planner_set_task_splits` (cambio) — define las interrupciones de una tarea: tras cuántos días laborables (o horas laborables) de trabajo, y cuántos días laborables (o horas laborables) de interrupción. Una lista vacía quita todas las interrupciones. Véase [Dividir una tarea](docs://howto-taak-splitsen).

## Relaciones

- `planner_add_dependencies` (cambio, lote) — crea relaciones con un tipo (`FS`, `SS`, `FF`, `SF` o la forma larga) y un desfase, por ejemplo `+2d`.
- `planner_update_dependencies` (cambio, lote) — cambia el tipo, el desfase, el predecesor o el sucesor de una relación existente, por id de relación. Eso es un solo paso, en lugar de borrar y crear de nuevo.
- `planner_remove_dependencies` (cambio, lote) — elimina relaciones por id de relación.

## Proyecto y calendarios

- `planner_update_project` (cambio) — nombre, descripción, autor, empresa, fecha de inicio, fecha de fin, fecha de estado, modo de progreso y el valor predeterminado del proyecto para el tipo de tarea. La fecha de inicio es el ancla para las tareas nuevas. Si el asistente la define más tarde, solo se desplazan las tareas sueltas (sin predecesor y sin una restricción que fije un límite inferior, como *no comenzar antes del (SNET)*), y la respuesta indica el número de tareas en `anchorsClamped`. El resto de la planificación se queda donde está. Véase [Nuevo proyecto e info del proyecto](docs://ref-projectinfo). La fecha de estado no es una etiqueta, sino la fecha de referencia del cálculo: en una planificación sin avance, todo se desplaza. La fecha de fin es solo metadatos.
- `planner_move_project` (cambio) — mueve toda la planificación existente a una nueva fecha de inicio. Los calendarios no se desplazan con ella, así que el fin puede saltar un número de días distinto al del inicio. Las líneas base se quedan, salvo que el asistente pida explícitamente que también se muevan. Véase [Mover un proyecto](docs://howto-project-verplaatsen).
- `planner_update_calendar` (cambio, lote) — cambia o crea calendarios: días laborables, horarios de trabajo, pausa, bandas horarias, festivos (generar para un país y una región, o indicar de forma literal) y excepciones de trabajo. No puede cambiar cuál es el calendario del proyecto.

## Recursos y unidades

- `planner_manage_resources` (cambio, lote) — crea, cambia o elimina recursos: nombre, tipo (mano de obra, equipo, material, subcontratista o cuadrilla), descripción, unidades máx., coste por hora, unidad, calendario, cuadrilla y disponibilidad a lo largo del tiempo. Rechaza eliminar un recurso que tiene asignaciones hasta que el asistente lo confirme explícitamente. En un recurso de la biblioteca de recursos, el nombre, el tipo, la descripción, la tarifa por hora y la unidad están fijos.
- `planner_manage_assignments` (cambio, lote) — añade, cambia, mueve o quita asignaciones: unidades por día laborable, curva y trabajo restante. Solo en una tarea hoja, y el mismo recurso solo una vez por tarea. El efecto de un cambio en unidades sobre la duración depende del tipo de tarea, como en [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels).
- `planner_level_resources` (cambio) — nivela la sobreasignación. De forma predeterminada solo dentro de la holgura, así que la fecha de fin se queda; con `constrainToFloat: false` el fin puede moverse. Con una prueba en seco, el asistente recibe primero una vista previa sin cambiar nada. Omite los materiales. Véase [Nivelación de recursos](docs://uitleg-nivelleren).
- `planner_clear_leveling` (cambio) — quita todos los retrasos de nivelación.

## Gestionar líneas base

- `planner_save_baseline` (cambio) — guarda la planificación actual como línea base y la activa enseguida. Recalcula antes las fechas desactualizadas. No se puede usar en un script.
- `planner_activate_baseline` (cambio) — activa una línea base, o ninguna.
- `planner_rename_baseline` (cambio) — cambia el nombre de una línea base.
- `planner_delete_baseline` (cambio) — elimina una línea base. Si era la activa, la última línea base que quede pasa a ser la activa, o ninguna si no queda ninguna.

## Deshacer

- `planner_undo` y `planner_redo` — deshacen o rehacen un paso en el documento activo. El historial es el mismo que el suyo. La respuesta indica si realmente se ha revertido algo.

## Documentos y archivos

- `planner_list_documents` (lectura) — todos los documentos abiertos, con título, si están activos y modificados, el número de tareas, la fecha de inicio del proyecto y el fin calculado.
- `planner_new_document` — un documento nuevo y vacío en su propia pestaña, sin la ventana *Nuevo proyecto*.
- `planner_duplicate_document` — copia el documento activo en una pestaña nueva, para un análisis de escenarios o una variante de licitación. La copia es independiente y no tiene ruta de archivo.
- `planner_switch_document` — hace activo otro documento. También sirve para confirmar, después de cambiar de pestaña, en qué documento trabaja el asistente.
- `planner_import_schedule` — abre un archivo de planificación del disco como documento: `.ifc`, `.xml` (Primavera P6 o MS Project, reconocido por su contenido), `.csv`, `.xer` y `.mpp` (MS Project 2010 hasta 2021). No se fusiona nada con el plan actual. Un CSV no tiene calendario, así que las fechas pueden desplazarse. Solo dentro de su carpeta de usuario. Después de importar un CSV, XML o `.mpp`, el documento no tiene destino de guardado; solo un IFC toma esa ruta.
- `planner_export_ifc` — escribe el documento activo como archivo IFC, en el esquema IFC del proyecto (predeterminado: IFC 4.3 ADD2). Solo dentro de su carpeta de usuario, y un archivo existente solo se sobrescribe si lo pide explícitamente. Si el documento se abrió en un esquema que la aplicación no puede escribir (como IFC2X3), la herramienta se niega a escribir sobre ese archivo. El proyecto sigue sin guardar.

## Guía y procedencia de las fuentes

- `planner_get_planning_guide` (lectura) — la guía en inglés para asistentes (los principios de [Planificar bien](docs://gids-goed-plannen), con las herramientas de cada principio), las dos skills *goed-plannen* (montar una planificación) y *progress-update* (actualizar el avance), o todo. Elija con `part`: `guide`, `skill` (las dos skills) o `both`; `both` de forma predeterminada. Devuelve, para cada skill, los lugares donde corresponde y las direcciones de descarga. El parámetro `language` sigue aceptándose por asistentes antiguos, pero el texto siempre está en inglés. No toca la planificación.
- `planner_inspect_xer_provenance` (lectura) — inspecciona la semántica de origen conservada de un archivo Primavera P6 (`.xer`) abierto: qué contenía el archivo, con recuentos de la importación y de los diagnósticos. Los campos de texto libre del archivo quedan ocultos de forma predeterminada; el asistente tiene que pedirlos explícitamente. Los nombres de los recursos también quedan ocultos de forma predeterminada, porque un recurso de P6 suele ser una persona; los códigos de recurso siguen visibles. El asistente debe pedirle permiso antes de solicitar los nombres, porque entonces se envían al proveedor de IA. No se puede usar en un script.

## El script

- `planner_batch` — ejecuta un script de como máximo 100 pasos como un solo cambio: un paso de deshacer, un recálculo y una copia de seguridad. Si un paso falla de forma estructural, se revierte todo el script y la respuesta indica para cada paso qué se ejecutó, qué falló y qué no se alcanzó. Los nombres temporales (`tmp-…`) de `planner_add_tasks` se pueden usar en los pasos posteriores. No se permite como paso: `planner_batch` en sí, deshacer y rehacer, las herramientas de documentos y archivos, `planner_save_baseline`, `planner_get_planning_guide` y `planner_inspect_xer_provenance`. Un script no es un lenguaje de programación: no hay variables, condiciones ni bucles.

## Cuando se rechaza una herramienta

El asistente recibe entonces una respuesta con un código de error y una explicación.

- `PAUSED` — *Pausar* está activado.
- `READ_ONLY` — *Solo lectura* está activado.
- `DIALOG_OPEN` — hay un cuadro de diálogo abierto. Eso cuenta también para la lectura, salvo para `planner_get_planning_guide`. La respuesta indica qué está abierto con su nombre interno, por ejemplo `showTaskDialog`.
- `DOC_DRIFT` — usted cambió de pestaña mientras trabajaba el asistente. El asistente tiene que confirmar con `planner_switch_document` en qué documento trabaja.
- `VALIDATION` — los argumentos no coinciden con el esquema, o el cambio pedido no está permitido. La respuesta indica el campo.
- `NOT_FOUND` — un id o un documento no existe.
- `CYCLE` — el cambio crearía una referencia circular. Todo en esa llamada se revierte.
- `SCOPE` — la ruta del archivo queda fuera de su carpeta de usuario.
- `BACKUP_FAILED` — la copia de seguridad previa al cambio falló; el cambio no se ejecutó.
- `INTERNAL` — un error inesperado al ejecutar una herramienta, por ejemplo una operación de archivo que falló. La respuesta da el mensaje de error original.
- `STALE_PRECONDITION` — forma parte del contrato del puente, pero ninguna herramienta actual devuelve este código.

Una solicitud que estuvo más de 110 segundos en la cola ya no la ejecuta la aplicación: el cliente ya recibió un tiempo de espera, y ejecutarla cambiaría las cosas dos veces si se reintenta. Una llamada que tarda más de 120 segundos recibe un tiempo de espera del puente.

## Lo que el asistente no puede definir

Por tarea, el asistente no puede definir: hamaca, tarea programada manualmente, una segunda restricción, notas, color, códigos de actividad, campos personalizados, relaciones externas ni un retraso de nivelación a mano. La aplicación calcula por sí misma el código WBS. A nivel de proyecto no puede cambiar el perfil de cálculo ni las opciones de cálculo. La configuración, el tema, el idioma, las extensiones y las actualizaciones están fuera de su alcance, y también la biblioteca de recursos. Tampoco tiene informes, diseños, filtros ni vista. El porqué está en [Cómo funciona la conexión con IA](docs://uitleg-ai-koppeling).

## Lo que guarda la aplicación

- **El token** está en este equipo, en la configuración guardada de la aplicación. Tiene 64 caracteres y es aleatorio. *Nuevo token* lo reemplaza.
- **El puerto** es 3877 de forma predeterminada y solo se puede cambiar mientras el puente está detenido.
- **El panel de actividad** guarda las últimas 500 llamadas, solo mientras la aplicación está abierta. Los argumentos y las respuestas se cortan después de 20 kB por campo. *Borrar* vacía la lista.
- **Las copias de seguridad** están en la carpeta `ai-backups` de la carpeta de datos de la aplicación; *Abrir carpeta de copias de seguridad* le lleva allí. Se llaman `<project name>-<timestamp>.ifc`. Un archivo de proyecto guardado tiene una carpeta para todas las sesiones; un documento que nunca se guardó recibe su propia carpeta por sesión. Se hace una copia de seguridad por documento cada vez que se inicia el puente, además de las que usted crea con *Crear copia de seguridad ahora*.
- **La limpieza** ocurre sola, por carpeta. De los últimos 7 días se conservan todas, hasta 20; lo que creó la sesión en curso siempre se conserva. Después queda una por semana hasta 30 días de antigüedad, una por mes hasta un año, y después una por año. Las copias de un documento que nunca se guardó desaparecen por completo tras un año. Los archivos de la carpeta que no pertenecen a la aplicación se dejan en paz.

## Véase también

- [Cómo funciona la conexión con IA](docs://uitleg-ai-koppeling): por qué el puente está montado así y qué puede y qué no puede hacer el asistente.
- [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen): inicie el puente, conecte e instale la skill.
- [Configuración](docs://ref-instellingen): los dos interruptores de IA.
- [Avisos y advertencias](docs://ref-meldingen): el punto de IA en la barra de estado.
