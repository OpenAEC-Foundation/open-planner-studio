# La cinta, pestaña por pestaña

La cinta de la parte superior de la pantalla tiene pestañas, y cada pestaña tiene grupos de botones. Este artículo indica, para cada botón, qué hace y dónde ve el resultado. Cómo hacer un proceso paso a paso está en las guías prácticas; aquí busca qué es un botón. Un botón que solo existe o funciona bajo una condición tiene esa condición junto a él.

## Cómo se comporta la cinta

- **Pestañas** — *Archivo* está a la izquierda, después *Inicio*, *Planificación*, *Recursos*, *Vista*, *Configuración*, *Tabla*, *IFC*, *Informe* y, solo con el modo IA activado, *IA*.
- **Ventana estrecha** — cuando la cinta no cabe, los botones se reducen a un icono de derecha a izquierda. El nombre aparece entonces como información sobre herramientas del botón. Cada botón sin su propia información sobre herramientas muestra su nombre.
- **Contraer la cinta** — la pequeña flecha abajo a la derecha de la cinta la convierte en una franja plana con solo iconos. Los grupos *Líneas base y progreso* y *Conexión* de la pestaña IA desaparecen entonces detrás de un solo botón con ventana emergente. Predeterminado: expandida. Su elección se recuerda.
- **Botones de extensión** — una extensión puede añadir su propio grupo al final de una pestaña. Ese botón hace lo que define la extensión.

## Archivo

Al hacer clic en *Archivo* aparece una pantalla propia (el Backstage) que ocupa el espacio de trabajo. No tiene cinta. *Volver* la cierra. Si cambió algo en *Ajustes del proyecto* y no lo aplicó, la aplicación pregunta primero qué debe hacer con ello.

- **Nuevo** — abre la ventana *Nuevo proyecto* y cierra el Backstage. Los campos están en [Nuevo proyecto y Ajustes del proyecto](docs://ref-projectinfo).
- **Abrir** — elige un archivo y lo abre como documento. Cierra el Backstage.
- **Recientes** — una lista de proyectos abiertos recientemente; un clic abre uno. Solo es visible cuando el entorno puede volver a abrir archivos: en la aplicación de escritorio y en navegadores que ofrecen acceso a archivos, como Chrome y Edge. En otros navegadores el botón está, pero la página queda vacía.
- **Ejemplos** — planificaciones de ejemplo incluidas, divididas en *Planificaciones de muestra completas* (insignia *Todas las funciones*) y *Ejemplos sencillos*. Un clic abre una en una pestaña nueva.
- **Guardar** — escribe el proyecto en el archivo de este documento. Si el documento todavía no tiene archivo, primero elija un nombre y una ubicación. Un archivo que abrió en un formato distinto de IFC nunca se sobrescribe; en ese caso, *Guardar* pide un nombre y una ubicación para un archivo IFC.
- **Guardar como** — elige un nombre o una ubicación nuevos y guarda allí como IFC.
- **Exportar** — tarjetas por formato de exportación, con una descripción. Un clic convierte el proyecto y lo guarda, y lleva de vuelta a *Inicio*. Si la planificación tiene un ciclo, el error aparece en el Backstage y la pantalla no se cierra. Si el proyecto está vinculado a una biblioteca de recursos, debajo aparece la casilla *Guardar también el archivo de biblioteca*; solo funciona en la tarjeta IFC.
- **Importar** — arriba, la tarjeta *Actualizar avance desde una hoja* (deshabilitada sin tareas); debajo, los importadores que añaden las extensiones.
- **Imprimir** — el botón *Abrir vista previa de impresión* lleva a la pestaña *Informe*.
- **Ajustes del proyecto** — los metadatos y el perfil de cálculo de este proyecto. Los cambios solo tienen efecto después de *Aplicar*. Vea [Nuevo proyecto y Ajustes del proyecto](docs://ref-projectinfo) y [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen).
- **Configuración** — la misma configuración que la ventana *Configuración*.
- **Extensiones** — gestión e instalación de extensiones; vea [Instalar y gestionar una extensión](docs://howto-extensie-installeren).
- **Biblioteca** — gestión de bibliotecas de recursos; vea [Gestionar y compartir bibliotecas de recursos](docs://howto-bibliotheken-beheren).
- **Ayuda** — la documentación integrada, también con F1. El campo de búsqueda busca en títulos, encabezados y en el texto mismo. Los artículos están en cuatro secciones: *Tutoriales*, *Guías prácticas*, *Explicaciones* y *Referencia*. En *Idioma de la documentación* elija *Seguir el idioma de la aplicación* o un idioma de la lista. El neerlandés y el inglés son los idiomas de origen; los demás idiomas tienen los artículos que ya están traducidos. Si falta un artículo en su idioma, verá la versión en inglés, con un aviso. La elección se guarda en este dispositivo, por separado del idioma de la aplicación. También puede abrir la ayuda desde una ventana o panel: muchas ventanas y los paneles *Propiedades*, *Recursos* y *Advertencias* tienen un signo de interrogación arriba a la derecha (*Ayuda sobre este tema*), que abre la ayuda sobre el artículo de esa ventana o panel. Si escribió algo en la ventana que todavía no está guardado, la aplicación primero pregunta: *Guardar*, *Cancelar* (descartar lo escrito) o *Volver* (quedarse en la ventana). Después la ventana se cierra y se abre la ayuda. Algunas ventanas, como *Editar tarea* y *Nivelar recursos*, siempre preguntan. Si no escribió nada, la ayuda se abre de inmediato.
- **Iniciar recorrido** — cierra el Backstage e inicia el recorrido en el paso 1.
- **Cerrar proyecto** — cierra el documento activo. Si tiene cambios sin guardar, la aplicación pide confirmación.

## Inicio

### Inicio › Archivo

- **Nuevo**, **Guardar**, **Abrir** y **Guardar como** — las mismas acciones que en *Archivo*.
- **Recientes** — menú desplegable con los proyectos recientes; un clic abre uno. Solo es visible con la misma condición que *Archivo › Recientes*. Sin archivos recientes muestra *Sin archivos recientes*.
- **Exportar** — menú desplegable con los formatos de exportación (nombres cortos). Un clic convierte el proyecto y lo guarda.

### Inicio › Editar

- **Deshacer** — revierte el último cambio. Deshabilitado cuando no hay nada que deshacer.
- **Rehacer** — restaura el último cambio deshecho. Deshabilitado cuando no hay nada que rehacer.
- **Eliminar** — elimina las tareas seleccionadas, junto con sus subtareas, en un solo paso. Deshabilitado sin selección.

### Inicio › Tareas

- **Tarea** — agrega una tarea llamada *Nueva tarea*, con una duración de 5 días laborables, que empieza en la fecha de inicio del proyecto. (Si *Activar planificación por horas* está activado y la *Unidad predeterminada para tareas nuevas* en *Ajustes del proyecto* es horas, la duración es de 5 horas.) Si hay una tarea seleccionada y la vista es la vista de árbol normal, la tarea se coloca justo debajo de la tarea seleccionada más abajo (información sobre herramientas *Nueva tarea justo debajo de la selección*). Sin selección, se coloca al final (información sobre herramientas *Nueva tarea al final de la lista*). Con una selección, pero mientras filtra, agrupa u ordena, también se coloca al final. Entonces, una notificación roja indica que la aplicación no puede colocarla debajo de su selección, con el botón *Borrar*. La nueva tarea pasa a ser la única selección, el Gantt se desplaza hasta ella y su nombre queda listo para sobrescribirlo en el panel *Propiedades*.
- **Hito ▾** — un menú desplegable que coloca un hito (duración 0) en el mismo lugar que *Tarea*. *Hito de comienzo* y *Hito de fin* definen el tipo de hito; el nuevo hito se llama *Nuevo hito* y recibe la categoría de trabajo *Otro*. *Punto de inspección (obligatorio)* crea un hito de fin con categoría de trabajo *Inspección* y la marca *Obligatorio (contractual)*, llamado *Nuevo punto de inspección*.
- **Vincular ▾** — un menú desplegable con cuatro acciones fijas; el botón principal nunca cambia de significado. Vea *Planificación › Relaciones* para las cuatro acciones.
- **Dividir tarea** — activa o desactiva el modo de división. Activado: una franja debajo de la cinta explica que debe hacer clic en una barra donde empieza la interrupción y arrastrar hacia la derecha según su duración. Deshabilitado cuando el Gantt no está visible (en las pestañas *Tabla*, *IFC* e *Informe* y bajo el panel de recursos completo); la información sobre herramientas muestra entonces *Solo disponible cuando el diagrama de Gantt está visible*. Vea [Dividir una tarea](docs://howto-taak-splitsen).

### Inicio › Planificación

- **Calcular** — calcula la planificación: fechas, holguras, ruta crítica y carga de recursos. Esto nunca ocurre por sí solo, salvo que active *Calcular automáticamente* (*Configuración*, pestaña *Planificación*, encabezado *Cálculo*). Mientras la planificación esté desactualizada, la barra de estado muestra *Desactualizado — recalcula (F5)*.

### Inicio › Zoom

- **Zoom +** — amplía el eje de tiempo 10 píxeles por día.
- **Zoom -** — reduce el eje de tiempo 10 píxeles por día.

## Planificación

### Planificación › Planificación

El botón *Calcular* es el mismo que en *Inicio*.

- **Mover proyecto…** — abre la ventana *Mover proyecto*. Deshabilitado sin fecha de inicio del proyecto. Vea [Mover un proyecto](docs://howto-project-verplaatsen).
- **Advertencias** — muestra u oculta el panel *Advertencias* en la columna derecha. El botón se ilumina mientras el panel es visible. Al activarlo, se expande una columna contraída. Su contenido se describe en [Notificaciones y advertencias](docs://ref-meldingen).

### Planificación › Relaciones

El grupo tiene el botón *Vincular ▾* con cuatro acciones y el botón *Dividir tarea* (igual que en *Inicio*). Las cuatro acciones:

- **Dibujar relación** — activa o desactiva el modo de vínculo; aparece una marca de verificación cuando está activo y el botón principal se ilumina. Activado: arrastre de una barra a otra en el Gantt para crear una relación, y una franja debajo de la cinta indica cómo detenerlo (*Detener* o Esc). Deshabilitado cuando el Gantt no está visible.
- **Vincular tareas seleccionadas** — crea una relación fin-comienzo sin desfase entre dos tareas; la que se seleccionó primero pasa a ser el predecesor. Solo está disponible con exactamente dos tareas seleccionadas (si no, *Seleccione exactamente dos tareas*). Una relación duplicada o un ciclo se rechaza con un mensaje.
- **Agregar relación externa…** — abre una ventana para agregar un predecesor o sucesor externo a la tarea seleccionada. Solo está disponible con exactamente una tarea seleccionada (si no, *Seleccione exactamente una tarea*).
- **Actualizar todas las relaciones externas** — actualiza los anclajes de todas las relaciones externas e indica en el menú cuántas se actualizaron o faltan. Solo está disponible cuando el proyecto tiene relaciones externas (si no, *Este proyecto no contiene relaciones externas*).

Para el motivo de las relaciones, vea [Crear relaciones](docs://howto-relaties-leggen) y [Relaciones y desfase](docs://uitleg-relaties).

### Planificación › Trazado de ruta

- **Predecesores** — resalta en el Gantt los predecesores de las tareas seleccionadas, cadena por cadena.
- **Sucesores** — resalta los sucesores de las tareas seleccionadas.

Puede tener ambos activos a la vez; un segundo clic en un botón desactiva ese lado de nuevo. Las relaciones determinantes reciben un tono más intenso. Vea [Trazar una ruta](docs://howto-pad-traceren).

### Planificación › Calendario

- **Calendario** — abre la ventana *Calendarios* con la biblioteca de calendarios del proyecto. Vea [Ventanas de calendario](docs://ref-kalenders).

### Planificación › Estructura

- **Códigos y campos** — abre la ventana *Códigos y campos* para códigos de actividad y campos personalizados. Vea [Códigos y campos personalizados](docs://howto-codes-en-velden).
- **WBS auto** — activa o desactiva la numeración automática de los códigos WBS. Predeterminado: activado en un proyecto nuevo. En un archivo abierto sin esta opción: activado si el archivo está vacío o si todos los códigos ya coinciden con la numeración del árbol; si no, desactivado. Activado: todo el árbol se renumera a la vez, los códigos se ajustan a cada cambio de estructura y el campo *Código WBS* del panel y del cuadro de diálogo queda deshabilitado.
- **Renumerar WBS** — renumera los códigos WBS una vez, según la posición en el árbol (1.2.3). Deshabilitado mientras *WBS auto* esté activado.
- **Plantillas** — menú desplegable con plantillas WBS guardadas; cada una muestra el número de tareas y relaciones. Un clic inserta la plantilla debajo de la tarea seleccionada o en el nivel superior si no hay selección. El icono de papelera elimina una plantilla. Sin plantillas, indica cómo guardar una (haga clic con el botón derecho en una tarea de resumen, *Guardar rama como plantilla*). Vea [Guardar e insertar plantillas WBS](docs://howto-wbs-sjablonen).
- **Aplicar sangría** — convierte las tareas seleccionadas en subtareas de la tarea anterior a ellas. Deshabilitado sin selección y en cuanto filtra, agrupa u ordena; la información sobre herramientas muestra entonces *No disponible mientras se filtra/agrupa/ordena*.
- **Anular sangría** — sube las tareas seleccionadas un nivel, justo después de su tarea padre actual. Las mismas condiciones que *Aplicar sangría*.

### Planificación › Líneas base y progreso

- **Gestionar líneas base…** — abre la ventana de líneas base. Vea [Guardar y gestionar una línea base](docs://howto-baseline-opslaan-en-beheren).
- **Fecha de estado** — la fecha hasta la que mide el avance. Escriba una fecha; la cruz (*Borrar fecha de estado*) la elimina. Si el calendario del proyecto tiene bandas de horario laboral, la aplicación calcula en horas y junto a la fecha aparece un campo de hora (MS Project suele guardar 17:00). Entonces la hora sí cuenta: 12:00 en lugar de 17:00 cambia el trabajo restante en medio día. Sin bandas de horario laboral, la aplicación calcula en días completos y no aparece ningún campo de hora. Efecto: el avance se mide hasta esa fecha, y la línea de fecha de estado y la línea de progreso del Gantt se sitúan en ella. Vea [Avance, fecha de estado y línea base](docs://uitleg-voortgang).
- **Modo de progreso** — una elección entre *Retained Logic* y *Progress Override*. Predeterminado: *Retained Logic*. Efecto: con *Retained Logic* el trabajo restante de un sucesor iniciado sigue la relación; con *Progress Override* el trabajo restante empieza en la fecha de estado, sin esperar al predecesor. Vea [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen).

En la cinta contraída, estos tres quedan detrás de un botón con bandera titulado *Líneas base y progreso*.

### Planificación › Avance

- **Exportar hoja de avance** — crea una hoja `.xlsx` con las tareas, para completar el avance fuera de la aplicación. Deshabilitado sin tareas.
- **Actualizar avance desde una hoja** — abre la ventana de importación para una hoja devuelta. Deshabilitado sin tareas. Vea [Importar avance desde una hoja](docs://howto-voortgang-importeren).

Este grupo también está en *Tabla* e *Informe*.

## Recursos

### Recursos › Gestionar

- **Recursos** — abre el panel de recursos completo; ocupa todo el espacio de trabajo. Se ilumina mientras ve ese panel. Vea [Panel de recursos](docs://ref-resourcepaneel).
- **Acoplar recursos** — acopla el panel de recursos compacto en la columna derecha, junto al Gantt. Se ilumina mientras el panel acoplado es visible; un segundo clic lo cierra. El panel acoplado muestra solo nombre, color, una advertencia por sobreasignación y *Unidades máx*, y, con una selección de tareas, solo los recursos de esas tareas.
- **Nuevo recurso** — abre el panel de recursos completo con una fila vacía de borrador para un recurso nuevo. No se crea nada hasta que escriba un nombre; si hace clic fuera, no queda nada. El recurso se guarda en la biblioteca o en el proyecto, según la vista.

### Recursos › Asignación

- **Asignar ▾** — asigna un recurso a la tarea seleccionada. Solo está disponible con exactamente una tarea seleccionada que sea una tarea sin subtareas y no un hito; si no, el botón aparece en gris. En el menú, primero establezca *Uds./día* (predeterminado 1) y *Curva* (predeterminado *Uniforme*); un clic en un recurso lo asigna con esos valores. El menú solo muestra recursos que todavía no están en la tarea. Vea [Asignar recursos con una curva](docs://howto-resource-toewijzen).

### Recursos › Histograma

- **Histograma** — muestra u oculta la franja de histograma debajo del Gantt. Predeterminado: desactivado. Su elección se recuerda.
- **Anterior** y **Siguiente** — recorren los recursos del selector de la franja de histograma, con *Todos los recursos* como paso adicional en la ronda. Deshabilitados cuando el histograma está desactivado o el proyecto no tiene recursos.

### Recursos › Nivelación

- **Nivelar…** — abre la ventana *Nivelar recursos*. Vea [Nivelación](docs://uitleg-nivelleren).
- **Borrar nivelación** — elimina los retrasos e interrupciones que aplicó la nivelación. Deshabilitado cuando ninguna tarea tiene un resultado de nivelación.

### Recursos › Sobreasignación

- **Sobreasignación** — no es un botón, sino un contador: el número de recursos con al menos un día sobreasignado, o *Ninguna*. Se muestra en rojo con un icono de advertencia en cuanto hay uno. El número se actualiza después de *Calcular* y después de cambios en recursos y asignaciones; si cambia las fechas de las tareas, solo cuenta después de *Calcular*.

## Vista

### Vista › Escala de tiempo

- **Zoom +** y **Zoom -** — amplían o reducen el eje de tiempo en 10 píxeles por día.
- **Restablecer** — vuelve a poner el zoom en el valor predeterminado de 30 píxeles por día.
- **Ajustar al proyecto** — hace zoom y desplaza la vista para que todo el proyecto quepa en pantalla.
- **Elección de escala** — una lista con *Año*, *Trimestre*, *Mes*, *Semana*, *Día* y, solo con *Activar planificación por horas* activado, *Hora*. Una elección fija el zoom; el valor que se muestra sigue al zoom actual, y debajo se muestra ese zoom en píxeles por día.

### Vista › Visualización

- **Columnas…**, **Filtro…**, **Agrupar…** y **Ordenar…** — solo son visibles cuando *Mostrar los botones de vista clásicos* está activado (*Configuración*, pestaña *Avanzado*, encabezado *Funciones heredadas*). Predeterminado: desactivado. *Columnas…* lleva a *Tabla* y abre allí el selector de columnas. *Filtro…* abre la ventana de filtro de inmediato mientras no haya un filtro guardado; con filtros guardados abre un menú con *Filtro…*, *Borrar* (solo cuando hay un filtro activo) y los filtros guardados. *Agrupar…* permite dos niveles. *Ordenar…* permite más niveles. Un botón se ilumina cuando ese ajuste de vista está activo. En la cinta actual usted hace esto con botones de diseño; consulte [Crear y usar un diseño](docs://howto-layouts-gebruiken).

### Vista › Esquema

- **Contraer** — contrae las tareas de resumen seleccionadas; sin selección, contrae todas. En una vista agrupada contrae todos los grupos y una selección no tiene efecto.
- **Expandir** — lo contrario.

### Vista › Diseño

- **Botones de diseño** — cada diseño es un interruptor con un icono y un nombre. Se incluye *Diagrama de recursos*. Un clic activa el diseño, otro clic lo desactiva y vuelve a mostrar la vista de antes del clic. Diseños con partes distintas pueden estar activos a la vez. Haga clic derecho en un diseño: *Editar…*, *Duplicar* y *Eliminar* (después de confirmar). Un diseño incluido solo se puede duplicar.
- **Nuevo diseño** — abre la ventana de diseño para un diseño nuevo.

### Vista › Presentación

- **Presentación** — activa o desactiva el modo de presentación (Esc para detenerlo; en la aplicación de escritorio, también F11): solo el Gantt ocupa la pantalla. Consulte [Presentar en una pantalla grande](docs://howto-presentatie).
- **Vista dividida** — divide el Gantt en dos ventanas de tiempo que empiezan ambas con su zoom y posición actuales (división al 50 por ciento), o vuelve a dejarlo en una sola. Predeterminado: desactivado. Consulte [Usar la vista dividida y el minimapa](docs://howto-split-view-en-mini-map).
- **Minimapa** — muestra u oculta el minimapa. Predeterminado: desactivado. Su elección se recuerda.

### Vista › Paneles

- **Propiedades** — muestra u oculta el panel *Propiedades* en la columna de la derecha. Predeterminado: activado. Consulte [Cuadro de diálogo de tarea y panel de propiedades](docs://ref-taak-eigenschappen).

Los botones *Recursos*, *Dock de recursos* e *Histograma* son iguales que en *Recursos*, y *Advertencias* es igual que en *Planificación*.

**La columna de la derecha.** La columna a la derecha del Gantt aparece en cuanto al menos uno de los paneles *Propiedades*, *Dock de recursos* o *Advertencias* está activado. Si ninguno está activado, no hay columna. Si un panel completo ocupa el espacio de trabajo, por ejemplo el panel de recursos completo, la columna desaparece. Solo en la pestaña *Tabla* se mantiene.

- **Ancho** — arrastre el separador entre el espacio de trabajo y la columna. Un solo ancho se aplica a todos los paneles de la columna.
- **División** — si hay dos paneles activados, arrastre el borde entre ellos. Si hay uno, ese panel ocupa toda la columna.
- **Contraer** — el botón *Contraer la columna lateral* del encabezado oculta la columna. Una franja estrecha con el botón *Expandir la columna lateral* la vuelve a mostrar, con los mismos paneles que antes.
- **Cerrar** — cada panel tiene una cruz en su encabezado. Es el mismo interruptor que el botón de la cinta.
- **Panel completo** — en el dock de recursos, el botón *Panel completo* abre el panel de recursos completo.

### Vista › Líneas base y avance

Este grupo tiene el mismo nombre que el de *Planificación*, pero contiene las opciones de dibujo del Gantt.

- **Superposición de línea base** — muestra la línea base activa como una barra fina debajo de cada barra de tarea. Predeterminado: activado. Sin una línea base activa no hay nada que ver.
- **Línea de progreso** — dibuja una línea en la fecha de estado que sobresale en cada tarea según su avance. Predeterminado: activado. Sin fecha de estado no hay nada que ver. Cuando la línea de progreso está activada, esa línea también marca la fecha de estado.
- **Línea de fecha de estado** — dibuja una línea discontinua en la fecha de estado. Predeterminado: activado. Solo se ve cuando la línea de progreso está desactivada, porque si no, esa línea ocupa su lugar. La etiqueta con la fecha en el encabezado se mantiene mientras al menos una de las dos esté activada. La etiqueta sigue su notación de fechas, por ejemplo 20-09-2006. Si la aplicación calcula en horas, la línea y la etiqueta se sitúan en la hora del día, y la etiqueta también muestra la hora, por ejemplo 20-09-2006 17:00.
- **Colores de barra** — elige cómo se colorean las barras: *Ruta crítica* (predeterminado), *Por tarea — automático* o *Por categoría* con una elección de campo. Si ese campo no está en este proyecto, el menú indica que *Categoría de trabajo* se usa de forma temporal. Fuera de *Ruta crítica*, un contorno rojo marca la ruta crítica. La elección también se aplica al informe.
- **Acento de recurso** — dibuja una franja fina en el color del recurso debajo de la barra de cada tarea sin subtareas, dividida en proporción a las unidades por día. Predeterminado: desactivado.
- **Zona de holgura** — dibuja la zona verde después de una barra no crítica, hasta el fin tardío de la tarea. Predeterminado: activado.
- **Líneas de relación** — muestra u oculta las líneas de relación entre tareas. Predeterminado: activado. La elección pertenece al documento y al diseño.

## Configuración

### Configuración › Proyecto

- **Ajustes del proyecto** — abre la ventana *Ajustes del proyecto*: los metadatos del proyecto y, en el bloque *Perfil de cálculo y opciones*, cómo calcula el proyecto. Consulte [Nuevo proyecto e info del proyecto](docs://ref-projectinfo).
- **Configuración** — abre la ventana *Configuración* con las pestañas *Apariencia*, *Planificación* y *Avanzado*. Los mismos ajustes están en *Archivo › Configuración*.

### Configuración › Calendario

El botón *Calendario* es igual que en *Planificación*.

### Configuración › Atajos de teclado

- **Atajos de teclado** — abre la ventana *Atajos de teclado*.

## Tabla

La pestaña *Tabla* muestra las tareas como una tabla completa en lugar del Gantt. Los grupos *Archivo*, *Editar*, *Tareas*, *Programación* y *Trazado de ruta* son iguales que en *Inicio* y *Planificación*, y actúan sobre la misma selección. No hay grupo *Zoom*, porque el zoom solo escala el eje de tiempo del Gantt. Los botones *Dividir tarea* y *Dibujar relación* están desactivados aquí: no hay Gantt.

### Tabla › Columnas

- **Columnas…** — abre el selector de columnas de esta tabla. El mismo selector se abre con el botón + del encabezado de la tabla. El texto de ayuda dice *Elegir las columnas de la vista Tabla*. Consulte [Ajustar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen) y [Columnas de la tabla](docs://ref-tabelkolommen).

## IFC

La pestaña muestra el panel IFC en el espacio de trabajo. La cinta no tiene botones aquí, solo la línea de texto *IFC - Industry Foundation Classes, en el esquema del proyecto (predeterminado IFC 4.3 ADD2)*.

## Informe

### Informe › Informe

- **Imprimir** — solo en esta pestaña, donde no hace nada porque *Informe* ya está abierto; las opciones del informe están en la pantalla de informe.

## IA

La pestaña *IA* solo existe cuando *Activar modo IA* está activado (*Configuración*, pestaña *Avanzado*, encabezado *Modo IA*). Predeterminado: desactivado. Al desactivarlo, se quita la pestaña y se detiene el puente. Un asistente de IA trabaja con su planificación a través de un puente MCP que usted inicia aquí. Consulte [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

### IA › Servidor

- **Iniciar puente** y **Detener puente** — inician o detienen el puente MCP. Junto a ellos está el estado: *Desactivado*, *Activo en el puerto …*, *Puerto … ocupado* (con el motivo) o *Error*. Desactivado en la versión web; el texto de ayuda dice *El puente solo funciona en la aplicación de escritorio.* El mismo estado se muestra como un punto con *IA* en la barra de estado.

### IA › Conexión

- **Puerto** — el puerto del puente. Predeterminado: 3877. Solo se puede editar cuando el estado es *Desactivado* (texto de ayuda: *Solo se puede editar mientras el servidor está detenido.*).
- **Token** — la contraseña del puente, que se muestra oculta. Botones pequeños *Mostrar token*/*Ocultar token*, *Copiar* y *Nuevo token*. *Nuevo token* pide confirmación antes, porque un token nuevo rompe todas las conexiones existentes; si el puente está en marcha, se reinicia con el token nuevo.
- **Conectar** — muestra los datos de conexión: punto de conexión, token, un fragmento de configuración y una instrucción de conexión que usted pega en su agente de IA.

### IA › Seguridad

- **Pausar** / **Reanudar** — rechaza temporalmente todos los cambios de la IA; la lectura sigue permitida y el puente sigue activo. El botón se ilumina en rojo mientras está en pausa.
- **Solo lectura** — rechaza todas las herramientas que cambian datos mientras esté activado.
- **Copia de seguridad automática: activada** / **Copia de seguridad automática: desactivada** — escribe automáticamente una copia de seguridad IFC antes del primer cambio de IA por documento. Predeterminado: activada.
- **Hacer copia de seguridad ahora** — escribe una copia de seguridad en el momento y muestra el nombre del archivo. Solo en la aplicación de escritorio.
- **Abrir carpeta de copias de seguridad** — abre la carpeta con las copias de seguridad. Solo en la aplicación de escritorio.

### IA › Actividad

- **Panel de actividad** — muestra u oculta el panel *Actividad de IA* con las llamadas al puente, con sus argumentos y respuesta.
