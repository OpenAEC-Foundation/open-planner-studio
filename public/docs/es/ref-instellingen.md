# Configuración

Cada ajuste de la aplicación: qué hace, su valor inicial, qué cambia y dónde lo encuentra. Para las opciones de cálculo de un proyecto (perfil de cálculo, definición de tarea crítica) consulte [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): esas pertenecen al archivo del proyecto, no a la aplicación.

## Dónde encontrarlos y cómo funcionan

El panel de configuración está en tres lugares, y en todos es el mismo panel: el engranaje arriba de la ventana, *Configuración › Proyecto › Configuración* y *Archivo › Configuración*. El panel tiene tres pestañas: *Apariencia*, *Planificación* y *Avanzado*. Cada ajuste de abajo solo indica la pestaña.

Un cambio tiene efecto de inmediato. No hay botón *Aplicar* ni *Cancelar*.

**Para toda la aplicación, no por proyecto.** Todos los ajustes de este artículo se aplican a todos sus proyectos y pertenecen a este dispositivo. La aplicación los guarda en el almacenamiento de la aplicación o de su navegador, no en el archivo del proyecto. Por eso, si otra persona abre su archivo, ve sus propios ajustes. Si borra el almacenamiento de su navegador, los ajustes vuelven a sus valores iniciales.

## Pestaña Apariencia

**Tema** — el esquema de colores de la interfaz. Elija entre *Oscuro*, *Claro* y *Alto contraste*. Predeterminado: *Oscuro*. Efecto: los colores de toda la interfaz, incluidos el Gantt y el histograma. Dónde: *Apariencia*.

**Seguir el tema del sistema** — deja que el esquema de colores de su sistema operativo decida. Predeterminado: desactivado. Efecto: la aplicación está en *Claro* u *Oscuro*, según su sistema; las tres tarjetas de tema quedan entonces desactivadas. *Alto contraste* no sigue su sistema: lo elige usted. Si desactiva esta opción, se mantiene el tema que estaba en pantalla en ese momento. Dónde: *Apariencia*, en *Tema*.

**Idioma** — el idioma de la interfaz. Predeterminado: el idioma de su navegador o sistema, si la aplicación lo conoce; si no, inglés. Efecto: todos los textos de la aplicación. Los idiomas se ordenan por su código corto. Con árabe y persa, la interfaz se muestra de derecha a izquierda. Usted elige por separado el idioma de los artículos de Ayuda, en *Idioma de la documentación*, en *Archivo › Ayuda*. Dónde: *Apariencia*.

**Fuente** — la fuente de toda la interfaz. Elija entre *Predeterminado*, *Sistema*, *Serif* y *Monoespaciada*. Predeterminado: *Predeterminado*. Efecto: los títulos y el texto de la ventana, y el texto del Gantt y del histograma. Una aplicación web no sigue por sí sola la fuente de su sistema; por eso la elige aquí. Dónde: *Apariencia*.

**Tamaño del texto** — escala de la interfaz. Elija entre 90%, 100%, 110% y 125%. Predeterminado: 100%. Efecto: el texto y la disposición de la cinta, los paneles y los diálogos se hacen más grandes o más pequeños, y la altura de fila de la tabla y del Gantt cambia en la misma proporción. No hay opción por encima de 125%, porque entonces los textos de los botones de la cinta se parten en varias líneas. Dónde: *Apariencia*.

**Formato de fecha** — cómo aparecen las fechas en la aplicación. Elija entre *dd-mm-aaaa*, *mm-dd-aaaa* y *aaaa-mm-dd*. Predeterminado: *dd-mm-aaaa*. Efecto: las fechas de la tabla, los diálogos, los informes y la impresión. Los archivos y los cálculos no cambian: solo la visualización. Dónde: *Apariencia*.

**Formato de hora** — cómo aparecen las horas en la aplicación. Elija entre *24 horas (13:00)* y *12 horas (1:00 PM)*. Predeterminado: *24 horas (13:00)*. Efecto: las horas de la ventana de calendario, la fecha y hora de las tareas en horas (tabla, divisiones, mensajes) y la escala de tiempo *Hora* del Gantt. En un campo de hora puede escribir cualquiera de estas formas: *13:00*, *1300*, *13*, *1:00 PM* o *1 pm*. Medianoche como fin del día es *24:00* o *12:00 AM*. Los archivos y los cálculos no cambian: siguen en formato de 24 horas. Dónde: *Apariencia*.

**Visualización de la duración** — en qué unidad se muestra la duración de una tarea. Elija entre *Automática (unidad propia por tarea)*, *Siempre días* y *Siempre horas*. Predeterminado: *Automática (unidad propia por tarea)*. Efecto: la tabla de tareas, las etiquetas de las barras del Gantt, la información emergente, la impresión y los informes. Con *Automático*, una tarea en días muestra días y una tarea horaria muestra horas. Con *Siempre días* o *Siempre horas*, la aplicación convierte usando las horas por día del calendario de la tarea. Si la unidad de la tarea es distinta, pone su propia unidad entre paréntesis después, por ejemplo `2.25d(18h)`. Solo cambia la visualización; la tarea conserva su propia unidad. Dónde: *Apariencia*.

**Estilo de cambio de documento** — cómo cambia usted entre proyectos abiertos. Elija entre *Pestañas horizontales*, *Pestañas verticales* y *Píldora*. Predeterminado: *Pestañas horizontales*. Efecto: *Pestañas horizontales* pone una barra de pestañas debajo de la cinta; *Pestañas verticales* pone una barra de proyectos a la izquierda; *Píldora* pone un botón pequeño de proyecto en la barra de título. Dónde: *Apariencia*.

### Sección Gantt

**Mostrar solo días laborables** — comprime el eje temporal. Predeterminado: desactivado. Efecto: se omiten los fines de semana y los festivos del calendario del proyecto, así que una tarea de 5 días laborables ocupa exactamente 5 columnas. Los accesos directos *Ir a hoy* y *Ajustar al proyecto* también cuentan en días laborables. El informe tiene su propia casilla con el mismo nombre, que es independiente de este ajuste. Dónde: *Apariencia*, en *Gantt › Eje temporal*.

**Mostrar cuartos de hora con zoom cercano** — una escala de tiempo más fina. Predeterminado: desactivado. Efecto: puede acercar más y la escala de horas recibe una fila adicional de cuartos de hora. Al arrastrar una tarea horaria, esta puede ajustarse a cuartos de hora en lugar de a horas completas. Solo lo ve usted cuando *Activar planificación por horas* está activado. Dónde: *Apariencia*, en *Gantt › Zoom por cuartos de hora*.

**Barras de tarea en interrupciones** — si una tarea horaria se dibuja por bandas. Elija entre *No dividir nunca*, *Dividir al seleccionar* y *Dividir siempre*. Predeterminado: *Dividir al seleccionar*. Efecto: la barra de una tarea horaria se dibuja entonces por banda de horario laboral, en lugar de como una sola barra continua. *Dividir al seleccionar* lo hace solo con la tarea seleccionada. Solo afecta a tareas horarias; una tarea que está realmente dividida (con *Dividir tarea*) muestra su interrupción sin importar este ajuste. Dónde: *Apariencia*, en *Gantt*.

**Desplazamiento y zoom › Modo** — qué hace la rueda del ratón sobre el Gantt. Elija entre *Posición*, *Teclas* y *Zoom + arrastrar*. Predeterminado: *Zoom + arrastrar*. Efecto: con *Zoom + arrastrar*, la rueda hace zoom alrededor del cursor; Shift + rueda desplaza por las filas; arrastrando el fondo usted desplaza el eje temporal, y Ctrl + arrastrar (Cmd en un Mac) dibuja un cuadro de selección. Con *Posición*, la función de la rueda depende de dónde esté el cursor; Ctrl + rueda siempre hace zoom y Shift + rueda siempre desplaza en horizontal. Con *Teclas* elige usted mismo qué tecla hace qué. La elección también se aplica al segundo eje temporal de la vista dividida. Dónde: *Apariencia*, en *Gantt › Desplazamiento y zoom*.

**Desplazamiento y zoom › División de pantalla** — en qué lugar está el cursor para cada función. Solo es visible en el modo *Posición*. Elija entre *Izquierda/derecha*, *Arriba/abajo* y *Esquina superior derecha*. Predeterminado: *Izquierda/derecha*. Efecto: con *Izquierda/derecha* la rueda desplaza en vertical sobre la mitad izquierda y en horizontal sobre la mitad derecha. Con *Arriba/abajo* la rueda desplaza en horizontal sobre el 30% superior (cerca de la escala de tiempo) y en vertical debajo de él. Con *Esquina superior derecha* la rueda desplaza en horizontal en el cuadrante superior derecho y en vertical en el resto. Dónde: *Apariencia*, en *Gantt › Desplazamiento y zoom*.

**Desplazamiento y zoom › Vertical, Horizontal, Zoom** — qué tecla pertenece a qué función de la rueda. Solo es visible en el modo *Teclas*. Para cada función elige usted entre *Desplazar*, *Ctrl + rueda* o *Shift + rueda*. Predeterminado: *Vertical* es *Desplazar*, *Zoom* es *Ctrl + rueda* y *Horizontal* es *Shift + rueda*. Efecto: si elige una tecla que ya está en uso, esa tecla se intercambia con la función que la tenía. Dónde: *Apariencia*, en *Gantt › Desplazamiento y zoom*.

## Pestaña Planificación

**Activar modo construcción** — valores iniciales orientados a la construcción para proyectos nuevos. Predeterminado: activado. Efecto: si está activado, un proyecto nuevo recibe el calendario *Bouwkalender NL* con los festivos neerlandeses, le permite elegir un festivo de la construcción al generar festivos, ofrece las plantillas de fases *Construcción residencial* y *Edificación / renovación* y da a las tareas nuevas la categoría de trabajo *Construcción*. Si está desactivado, recibe el calendario *Standaardkalender* sin festivos, solo la plantilla *Vacío* y la categoría de trabajo *Otro*. Una tarea nueva bajo una tarea padre que tiene una categoría de trabajo toma primero esa categoría; *Construcción* u *Otro* se aplica después. Las tareas y los calendarios existentes no cambian. Dónde: *Planificación*.

**Activar planificación por horas** — planificación en horarios de trabajo junto a los días laborables. Predeterminado: desactivado. Efecto: aparece la escala de tiempo *Hora* en *Vista › Escala de tiempo*; la ventana *Calendarios* permite que un calendario normal reciba bandas de horario laboral (el bloque *Horarios de trabajo*; un calendario que ya tiene bandas siempre muestra ese bloque); y la ventana *Nuevo proyecto* recibe las opciones *Turno* y *Unidad predeterminada para tareas nuevas*. *Ajustes del proyecto* también recibe la opción *Unidad predeterminada para tareas nuevas*. Si está desactivada, la aplicación trabaja por días. Las tareas horarias que ya existen se conservan y se incluyen en el cálculo; solo puede editar su duración cuando active la planificación por horas. Dónde: *Planificación*, en *Planificación por horas*. Consulte [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).

**Permitir planificación mixta por días y horas** — si usted elige la unidad por tarea. Solo es visible cuando *Activar planificación por horas* está activado. Predeterminado: activado. Efecto: si está activado, aparece el desplegable *Unidad de duración* junto a la duración de cada tarea. Si está desactivado, el desplegable se oculta. Dónde: *Planificación*, en *Planificación por horas*. Consulte [Días y horas](docs://uitleg-dagen-en-uren).

**Primer día de la semana** — el primer día de la semana. Elija entre *Lunes* y *Domingo*. Predeterminado: *Lunes*. Efecto: la disposición de la semana y los números de semana de la escala de tiempo del Gantt y de los informes (la impresión del diagrama de Gantt), y el orden de los días de la semana en la ventana *Calendarios*. Dónde: *Planificación*.

**Calcular automáticamente** — recalcula la planificación en cuanto queda desactualizada. Predeterminado: desactivado. Efecto: desactivado significa que usted pulsa *Calcular* (F5). Activado hace que la aplicación recalcule la planificación en una fracción de segundo tras un cambio en tareas, relaciones o calendario. Durante un gesto de arrastre o mientras escribe en un campo, la aplicación espera y calcula una vez cuando usted termina. Después de un cálculo fallido, solo se calcula otra vez cuando usted haya cambiado algo. Dónde: *Planificación*, en *Cálculo*.

**Usar tipos de tarea** — los campos de tipo de tarea y de trabajo en la aplicación. Predeterminado: desactivado. Efecto: si está activado, aparece el campo *Tipo de tarea* en una tarea y la columna de trabajo para las asignaciones, y la columna de tabla *Tipo de tarea* queda disponible. Si está desactivado, se ocultan esos campos; la duración y las unidades se mantienen y el trabajo se ajusta en consecuencia. Un proyecto que ya contiene datos de tipo de tarea o de trabajo, por ejemplo de un archivo `.mpp` o `.xer`, siempre los muestra, aunque el ajuste esté desactivado. Dónde: *Planificación*, en *Cálculo*. Consulte [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels).

## Pestaña Avanzado

**Mostrar explicación después de abrir** — una casilla por formato: *Archivo de Primavera (.xer)*, *Archivo de MS Project (.mpp)*, *MS Project XML*, *Primavera P6 XML* y *Archivo CSV*. Predeterminado: todas activadas. Efecto: si está activado, al abrir un archivo de estos aparece una ventana con una breve explicación del formato: qué tomó la aplicación, qué no tomó y cómo funcionan el guardado y la reescritura. *No volver a mostrar para …* en esa ventana desmarca la casilla aquí; aquí la vuelve a activar. Un archivo IFC, un ejemplo y un proyecto que abre un asistente de IA o una extensión nunca reciben esta explicación. Dónde: *Avanzado*, en *Mostrar explicación después de abrir*. Consulte [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan).

**Activar modo IA** — permite que un asistente de IA trabaje con su planificación. Predeterminado: desactivado. Efecto: si está activado, aparece la pestaña *IA* con el puente MCP, para que un asistente de IA pueda trabajar con su planificación mediante el Model Context Protocol. Si está desactivado, la pestaña se oculta y el puente se detiene. Dónde: *Avanzado*, en *Modo IA*. Consulte [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

**Iniciar el puente automáticamente** — inicia el puente MCP cuando se inicia la aplicación. Solo se puede activar cuando *Activar modo IA* está activado. Predeterminado: desactivado. Efecto: el puente queda activo de inmediato, así que un cliente de IA puede conectarse sin que usted abra antes la pestaña *IA*. Esto solo funciona en la aplicación de escritorio, y una vez por cada inicio: si después usted desactiva el puente, no se vuelve a iniciar. Dónde: *Avanzado*, en *Modo IA*.

**Activar terminal de depuración** — un panel de registro para resolver problemas. Predeterminado: desactivado. Efecto: si está activado, aparece un botón de terminal en la barra de estado, que muestra u oculta el panel de registro. Si está desactivado, el panel se cierra. Dónde: *Avanzado*, en *Terminal de depuración*.

**Benchmark…** — mide el rendimiento del motor de planificación. Efecto: abre una ventana en la que usted genera una planificación de prueba de un tamaño elegido, y se miden las fases principales. Su proyecto abierto no cambia. Es un botón, no un ajuste: no hay nada que recordar. Dónde: *Avanzado*, en *Benchmark*.

**Estadísticas…** — con qué frecuencia se ha descargado la aplicación. Efecto: abre la ventana *Estadísticas de descargas* con cifras públicas de GitHub Releases; no se recoge nada de usted. Es un botón, no un ajuste. Dónde: *Avanzado*, en *Estadísticas*. En la ventana:

- *Descargas por sistema operativo* — por sistema, las columnas *Descargas*, *Instaladores* (lo que descarga una persona) y *Actualizaciones* (lo que descarga el actualizador de la aplicación), con un *Total*. En Linux no se pueden separar las dos: el actualizador descarga el mismo archivo `.deb`, `.rpm` o `.AppImage` que la gente también descarga a mano, así que ahí solo cuenta el archivo snap como instalador. Debajo aparece *Búsquedas de actualizaciones desde la aplicación*: con qué frecuencia el actualizador de una aplicación instalada ha obtenido el archivo de versión de GitHub para buscar una versión nueva. Son búsquedas, no instalaciones.
- *Por versión* — las mismas descargas por versión, con la fecha; primero las seis más recientes, con *Mostrar las … versiones* para el resto.
- *Fuente* — la fecha de las cifras (GitHub Releases, se actualiza cada semana) y *Actualizar ahora*. La aplicación guarda las cifras obtenidas durante media hora. Si la obtención falla, la ventana lo indica. Las instalaciones a través de Snap Store no pasan por GitHub y no aparecen.

**Iniciar el recorrido** — el recorrido de introducción otra vez. Efecto: cierra la ventana *Configuración* e inicia el recorrido desde el primer paso. Dónde: *Avanzado*, en *Recorrido*.

**Versión** — el número de versión de la aplicación, con dos botones. *Buscar actualizaciones* abre la ventana de actualizaciones. *Novedades* muestra las novedades de la versión actual. Dónde: *Avanzado*, en *Versión*.

**Mostrar botones clásicos de vista** — una función sustituida, en *Funciones heredadas*. Predeterminado: desactivado. Efecto: si está activado, vuelve a aparecer un grupo *Visualización* en la pestaña *Vista*, con los botones separados *Columnas…*, *Filtro…*, *Agrupar…* y *Ordenar…*. El signo más del encabezado de la tabla, los botones de diseño y la ventana de diseño los sustituyen. Dónde: *Avanzado*, en *Funciones heredadas*.

## Opciones de visualización recordadas fuera del panel

La aplicación también guarda estas opciones en este dispositivo. Pero usted las ajusta en el propio elemento, no en el panel de configuración.

**Superposición de la línea base** — la línea base activa como una barra fina debajo de la barra de tarea. Predeterminado: activado. Dónde: *Vista › Líneas base y progreso › Superposición de la línea base*.

**Línea de progreso** — la línea en zigzag del avance en la fecha de estado. Predeterminado: activado. Efecto: la línea solo aparece cuando el proyecto tiene una fecha de estado, y entonces sustituye a la línea de fecha de estado separada. Dónde: *Vista › Líneas base y progreso › Línea de progreso*.

**Línea de fecha de estado** — una línea punteada en la fecha de estado. Predeterminado: activado. Efecto: si la línea de progreso está activada, dibuja la marca por sí misma. Dónde: *Vista › Líneas base y progreso › Línea de fecha de estado*.

**Acento de recurso** — una franja fina en el color del recurso debajo de la barra de tarea. Predeterminado: desactivado. Dónde: *Vista › Líneas base y progreso › Acento de recurso*.

**Banda de holgura** — la holgura como banda detrás de las barras no críticas; no para tareas finalizadas. Predeterminado: activado. Dónde: *Vista › Líneas base y progreso › Banda de holgura*.

**Colores de barras** — de qué depende el color de una barra. Elija entre *Ruta crítica*, *Por tarea — automático* y *Por categoría*. Predeterminado: *Ruta crítica*. Efecto: se aplica al diagrama de Gantt y al informe al mismo tiempo. Dónde: *Vista › Líneas base y progreso › Colores de barras*.

**Histograma** — la franja del histograma debajo del diagrama de Gantt. Predeterminado: desactivado. Dónde: *Recursos › Histograma › Histograma*, *Vista › Paneles › Histograma* o Ctrl+Shift+H. Usted ajusta la altura de la franja arrastrando su borde. El valor predeterminado es 160 píxeles, entre 80 y 480.

**Minimapa** — un mapa general de la línea de tiempo. Predeterminado: desactivado. Dónde: *Vista › Presentación › Minimapa*.

**Contraer la cinta** — una cinta compacta. Predeterminado: desactivado. Dónde: el botón de flecha abajo a la derecha de la cinta.

**Anchura de la tabla de tareas** — predeterminado: 350 píxeles, entre 150 y 800. Usted la ajusta arrastrando el separador junto a la tabla, o con la flecha izquierda y la flecha derecha cuando el separador tiene el foco.

**Anchura del panel derecho** — predeterminado: 280 píxeles, entre 200 y 900. Usted la ajusta arrastrando el borde del panel.

**Altura de *Propiedades* y *Advertencias* en el panel derecho** — predeterminado: 240 y 220 píxeles, entre 120 y 2000. *Propiedades* tiene esa altura también cuando la lista de recursos está abierta. Usted ajusta la altura con el tirador entre las secciones. La aplicación no recuerda si las secciones están abiertas o cerradas.

**También guardadas, descritas en otro lugar** — las columnas de la tabla ([Ajustar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen)), sus diseños ([Crear y usar un diseño](docs://howto-layouts-gebruiken)), las opciones de informe ([Tipos de informe](docs://ref-rapporttypes)), sus propias plantillas de perfil de cálculo ([Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies)) y el *Idioma de la documentación* de la Ayuda (*Archivo › Ayuda*) se guardan también en este dispositivo, no en el archivo del proyecto.

## Véase también

- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): las opciones que pertenecen a un proyecto.
- [Activar la planificación por horas](docs://howto-urenplanning-aanzetten): los pasos para el interruptor *Activar planificación por horas*.
- [Días y horas](docs://uitleg-dagen-en-uren): cómo cuenta la aplicación los días y las horas.
- [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels): lo que hace visible *Usar tipos de tarea*.
- [Atajos de teclado](docs://ref-sneltoetsen): todas las teclas de la aplicación, incluidas las de zoom y desplazamiento.
