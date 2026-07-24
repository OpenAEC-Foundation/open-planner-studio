# Calendarios y planificación por horas

Una tarea con una duración de "5 días" solo significa algo en combinación con un calendario: ¿qué días son laborables, en qué horas se trabaja, y qué días se pierden por un festivo o un cierre temporal? Esta guía cubre el calendario del proyecto, los calendarios de recursos y la planificación por horas opcional para quien quiera planificar con precisión horaria.

## Lo que aprenderá aquí

- Configurar el calendario del proyecto: días laborables, horarios de trabajo, festivos.
- Generar festivos automáticamente por año, incluidas las vacaciones de construcción.
- Añadir un cierre puntual y específico (por ejemplo una parada por heladas).
- Dar a un recurso su propio calendario, por ejemplo para una semana laboral de 4 días.
- Activar el interruptor principal de **Planificación por horas** y configurar bandas/turnos de horario laboral.
- Cómo conviven en la misma planificación las tareas basadas en días y las basadas en horas.

Siga el ejemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (parada por heladas, calendario de recurso de 4 días) y [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (planificación por horas para el armado y el vertido de hormigón), ambos también disponibles mediante **Archivo → Ejemplos**.

## El calendario del proyecto

Los calendarios se gestionan en la ventana **Calendarios**, que se abre mediante el grupo de la cinta **Calendario** en la pestaña **Planificación** (tanto el botón **Calendario** como **Festivos** abren la misma ventana). Esta ventana muestra a la izquierda una biblioteca con todos los calendarios del proyecto — no solo el calendario del proyecto, sino también cualquier calendario de recursos (vea más abajo) — con una estrella que marca cuál es actualmente el **Calendario del proyecto**. Seleccione un calendario a la izquierda y edítelo a la derecha; use **Establecer como predeterminado del proyecto** para convertir otro calendario de la lista en el nuevo calendario del proyecto. Para el calendario seleccionado establece:

- **Días laborables** — cuáles de los siete días de la semana (lunes a domingo) cuentan como día laborable. De lunes a viernes por defecto.
- **Horario laboral** — **Inicio (hora)**, **Fin (hora)** y las **Horas por día** resultantes.
- **Festivos** — una lista de días libres, cada uno con una **Descripción** y una fecha **Desde**/**Hasta**.

Los cambios en el calendario del proyecto se aplican de inmediato en el cálculo: las tareas que de otro modo caerían en un día que ahora no es laborable se desplazan al siguiente día laborable.

### Generar festivos automáticamente

En lugar de escribir los festivos uno a uno, puede generarlos automáticamente mediante **Generar festivos…** en la ventana de calendario. Elija un **País** (Países Bajos, Alemania, Bélgica, Francia, Reino Unido, Austria, Suiza) y opcionalmente una **Región**. Para los Países Bajos hay también una opción específica de construcción: **Vacaciones de construcción**, con la elección de **Norte**, **Centro** o **Sur** (o **Ninguna**). Las fechas de vacaciones de construcción generadas son fechas orientativas — la propia aplicación lo advierte: verifique las fechas exactas con Bouwend Nederland para el año en curso. Tras elegir país/región, la ventana muestra una vista previa — por ejemplo "12 festivos, 1-1-2026–31-12-2026" — antes de hacer clic en **Generar**.

Si genera festivos para un proyecto que abarca un cambio de año o que se amplía más adelante, Open Planner Studio reconoce que los festivos ya generados ya no cubren todo el período del proyecto y la ventana ofrece **Regenerar** para añadir los años que faltan — sin perder ningún festivo que haya añadido manualmente antes.

### Cierres puntuales (por ejemplo una parada por heladas)

No toda interrupción del trabajo es un festivo anual recurrente. Para cierres puntuales y específicos del proyecto — una semana de parada por heladas, un cierre por un evento local — simplemente añade una fila adicional manualmente mediante **Añadir festivo** en la misma lista: dele una **Descripción** (por ejemplo "Parada por heladas") y un período **Desde**/**Hasta**. Un cierre puntual de este tipo funciona técnicamente igual que un festivo generado — el cálculo CPM lo tiene en cuenta de la misma manera — pero es independiente de la generación automática anual, de modo que una posterior **Regenerar** no lo sobrescribirá.

Vea un período de parada por heladas en la práctica en el ejemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): la cimentación compartida de las seis viviendas incluye un período de parada por heladas añadido como entrada aparte de tipo festivo en el calendario, además de los festivos neerlandeses generados automáticamente.

## Calendarios de recursos

Además del único calendario del proyecto, cada recurso puede tener su propio calendario — por ejemplo para un subcontratista que solo está disponible cuatro días a la semana, mientras el resto del proyecto avanza a cinco días. Los calendarios de recursos se gestionan mediante el campo **Calendario** en el recurso (con el botón **Editar…** junto a él) o el título de la ventana **Calendario del recurso**; por defecto un recurso está configurado en **Calendario del proyecto**.

Un calendario de recurso usa el mismo formulario que el calendario del proyecto (**Días laborables**, **Horario laboral**, **Festivos**), pero es puramente informativo para el recurso: no cambia nada de las fechas CPM propias de la tarea. Lo que sí afecta es la **carga** (histograma) y la **nivelación**: si un recurso está configurado a una semana de 4 días mientras la tarea a la que está asignado se extiende 5 días laborables, la carga del recurso muestra un déficit el quinto día, y la ventana de nivelación (**Nivelar recursos**) advierte de que el recurso no trabaja todos los días que la tarea necesita — desplazar dentro de la holgura no resuelve automáticamente ese desajuste de calendario.

Vea un calendario de recurso de 4 días en la práctica: los instaladores en [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) trabajan con su propio calendario con una semana laboral reducida, mientras que el resto del proyecto sigue funcionando con el calendario normal del proyecto.

## Planificación por horas: el interruptor principal

Por defecto, Open Planner Studio trabaja completamente a **granularidad de día** — cada tarea tiene una duración en días (laborables) enteros. Para tareas que prefiera planificar por horas (piense en un vertido de hormigón que empieza a las 7:00 y debe terminar a las 14:00, bien antes de que cambie el tiempo), existe la **Planificación por horas** opcional.

Active el interruptor principal mediante **Configuración → Línea de tiempo / Zoom → Activar planificación por horas**. Esto añade una escala de tiempo horaria, turnos con bandas de horario laboral y barras de tarea con precisión de hora; con el interruptor apagado, la aplicación sigue funcionando exactamente igual que antes, a granularidad de día. También hay una opción **Permitir planificación mixta de días/horas**, que activa si quiere combinar tareas basadas en días y tareas basadas en horas en el mismo proyecto (vea más abajo).

## Bandas de horario laboral y turnos

Con la planificación por horas activada, el calendario obtiene una capa adicional: en lugar de solo "día laborable sí/no", establece **bandas de horario laboral** por día (la sección **Horarios de trabajo** en la ventana de calendario) — las franjas horarias exactas durante las cuales se trabaja. Un hueco entre dos bandas se convierte automáticamente en una pausa; para planificar una pausa, simplemente ajuste los horarios de las bandas adyacentes de modo que aparezca un hueco.

Para no tener que dibujar las bandas a mano cada vez, hay **preajustes de turno** ya preparados:

- **Turno de día** — horario de oficina normal, una banda por día.
- **2 turnos** — dos turnos consecutivos.
- **3 turnos** — tres turnos consecutivos, que cubren casi todo el día.
- **Turno de noche** — un turno que se extiende pasada la medianoche.
- **24/7** — funcionamiento continuo, sin interrupción.

Además de estos preajustes, también puede **Definir por día de la semana…** las bandas completamente a mano, por ejemplo si el viernes es más corto que el resto de la semana. ¿Ha compuesto una combinación propia que quiere reutilizar más a menudo? Guárdela con **Guardar como preajuste…** — el preajuste se almacena localmente en este dispositivo y luego se puede volver a elegir en cualquier proyecto. La sección también muestra las **Horas/día derivadas**: el número de horas de trabajo efectivas que resulta de las bandas configuradas.

## Tareas basadas en horas

Con la planificación por horas activada y una tarea en un **calendario horario** (un calendario con bandas de horario laboral en lugar de solo días completos), la ventana de edición de tarea muestra campos adicionales: **Duración (horas)** junto a **Duración (días)**, y un total en **Horas totales**. Se requiere un calendario horario para la entrada en horas — intente introducir horas en un calendario de días normal y la indicación se lo señala.

Así es exactamente como se planifican en la práctica las tareas de vertido: una tarea "Vloer storten toren A" (Verter forjado torre A) con una duración de, digamos, 6 horas, vinculada a un calendario de turnos que ese día tiene un turno de mañana. Vea este patrón en el gran ejemplo [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), que usa planificación por horas para el trabajo de armado y de vertido.

## Combinar tareas basadas en días y en horas

Un proyecto no tiene que funcionar completamente por horas para beneficiarse de la planificación por horas: con **Permitir planificación mixta de días/horas** marcado, las tareas basadas en días (en el calendario normal del proyecto) y las tareas basadas en horas (en un calendario horario) pueden convivir y relacionarse entre sí en la misma planificación. En ese caso, la tabla de tareas muestra la duración de cada tarea en su propia unidad — una tarea de día en días, una tarea de hora en horas — y avisa al pie de la tabla cuando conviven tareas con distintas horas por día, para que quede claro qué comparaciones son homogéneas y cuáles no.

## Siga leyendo

- Vea una parada por heladas y un calendario de recurso de 4 días en la práctica: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Vea la planificación por horas para el armado y el vertido de hormigón en la práctica: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Las relaciones y el desfase/adelanto funcionan con las mismas unidades de calendario — lea [Relaciones y restricciones](docs://gids-relaties-constraints) para la diferencia entre el desfase en días laborables y en tiempo transcurrido.
