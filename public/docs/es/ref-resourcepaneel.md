# Panel de recursos

El panel de recursos es el lugar donde gestiona los recursos: quién y qué está disponible, con qué capacidad y en qué calendario. El histograma bajo el Gantt y la sobreasignación pertenecen a él. Este artículo indica, para cada campo y cada botón, qué hace, cuál es el valor predeterminado y qué notará usted en la práctica. Cómo crear y asignar recursos está en [Gestionar recursos](docs://howto-resources-beheren) y [Asignar recursos con una curva](docs://howto-resource-toewijzen); resolver la sobreasignación está en [Resolver la sobreasignación](docs://howto-overbezetting-oplossen).

## Dónde encontrarlo

- **Panel completo** — *Recursos › Gestionar › Recursos* o *Vista › Paneles › Recursos*. Ocupa toda el área de trabajo; la cruz de arriba a la derecha lo cierra.
- **Dock de recursos** — *Recursos › Gestionar › Dock de recursos* o *Vista › Paneles › Dock de recursos*: una lista compacta en la columna de la derecha, junto al Gantt. Vea abajo.
- **Histograma** — *Recursos › Histograma › Histograma* o *Vista › Paneles › Histograma*: una franja bajo el Gantt. Vea abajo.
- **Vistas** — si su proyecto pertenece a una biblioteca de recursos, en la parte superior derecha del panel hay una elección entre *Biblioteca*, *Proyecto* y *Ocupación*. Sin biblioteca solo hay una tabla del proyecto. Cada vez que lo abre, el panel empieza en *Proyecto*, para que no llegue a la biblioteca compartida sin notarlo.

## Nuevo recurso

- **Nuevo recurso en el proyecto** (en la vista *Biblioteca*, *Nuevo recurso en la biblioteca*) — botón arriba a la derecha. Abre una fila provisional al final de la tabla. No se crea nada hasta que escriba un nombre y salga de la fila (o pulse Intro). Si sale con la fila vacía o pulsa Esc, no queda nada: ni recurso ni paso en *Deshacer*. Puede rellenar los campos en cualquier orden; todo se guarda a la vez. Intro o la flecha abajo confirman la fila y abren una nueva fila provisional. Mayús+Intro o la flecha arriba confirman la fila y vuelven a la tabla. La fila provisional no tiene el desplegable de capacidad, el lápiz del calendario ni la papelera, porque actúan sobre un recurso que todavía no existe. El botón *Nuevo recurso* de *Recursos › Gestionar* hace lo mismo.
- **Navegación en la tabla** — en la tabla, Intro, Mayús+Intro y las flechas arriba y abajo mueven el cursor entre filas. Intro en la última fila abre una nueva fila provisional.

## La vista Proyecto

La tabla de lo que usa este proyecto. Cada fila es un recurso. Los cambios en el texto y en la tarifa surten efecto en cuanto sale del campo y cuentan como un solo paso en *Deshacer*.

- **Color** — un selector de color. Predeterminado: el primer color libre de la paleta. Efecto: el color de la barra de acento del recurso bajo el Gantt (*Vista › Líneas base y progreso › Acento de recurso*) y del cuadro de color en el dock.
- **Nombre** — el nombre del recurso. Un nombre vacío no se guarda; el campo vuelve al nombre anterior.
- **Tipo** — *Mano de obra*, *Equipo*, *Material*, *Subcontratista* o *Cuadrilla*. Predeterminado para un recurso nuevo: *Mano de obra*. Efecto: *Material* tiene una *Unidad* y no cuenta en la suma *Todos los recursos* del histograma; la nivelación omite el material. *Cuadrilla* se puede elegir como la *Cuadrilla* de otros recursos. Los demás tipos calculan igual.
- **Unidades máx** — cuánto está disponible del recurso por día: un número mayor que 0 (se admiten fracciones). Predeterminado: 1. Efecto: la capacidad por día. Si la carga es mayor, el recurso está sobreasignado. La flecha junto a *Unidades máx* despliega la *Capacidad escalonada en el tiempo*; el número junto a la flecha es el número de pasos.
- **Capacidad escalonada en el tiempo** — pasos con *Desde* (una fecha) y *Unidades máx*. *Añadir paso* añade un paso con la fecha de hoy y 1. Sin pasos dice *Sin pasos — siempre se aplica el máximo de unidades fijo.* Efecto: desde la fecha de un paso, se aplica su *Unidades máx* en lugar del valor fijo. Gana el último paso con una fecha igual o anterior a ese día.
- **Calendario** — una lista con *Calendario del proyecto* (predeterminado), los calendarios del proyecto y *+ Calendario de recurso* para uno nuevo. El lápiz (*Editar…*) abre el calendario elegido y está desactivado para *Calendario del proyecto*. Efecto: los días en que trabaja el recurso. En un día libre la capacidad es 0; si hay trabajo planificado, el recurso queda sobreasignado con el motivo *No trabaja este día según el calendario «…»*. El calendario del recurso no cambia las fechas de una tarea. Vea [Ventanas de calendario](docs://ref-kalenders).
- **Tarifa/hora** — el coste por hora. Vacío = sin tarifa; un número no válido vuelve a su valor anterior. Efecto: ninguna influencia en la planificación ni en la carga. La tarifa determina la columna *Total*, se guarda en el archivo IFC y se escribe también al exportar a MS Project (tarifa estándar) y a Primavera P6 XML (precio por unidad).
- **Total** — solo lectura: las horas cargadas × la tarifa, con dos decimales; *—* sin tarifa o sin carga. Al final, una línea *Total* suma todos los recursos. Las horas vienen del último cálculo y cuentan unidades × horas por día del calendario de la tarea. ¿Está desactualizado? Pulse *Calcular*.
- **Unidad** — la unidad de medida del material, por ejemplo `m³`. Solo se puede rellenar para el tipo *Material* (información sobre herramientas: *Solo se rellena en recursos de tipo Material.*). Efecto: una etiqueta; no calcula nada.
- **Cuadrilla** — la cuadrilla a la que pertenece el recurso, de entre los recursos del tipo *Cuadrilla*. Predeterminado: *Ninguna*. Efecto: solo agrupa; la capacidad y la carga de una cuadrilla no son la suma de sus miembros.
- **Eliminar** (la papelera) — elimina el recurso. Si tiene asignaciones, la aplicación primero pregunta *'…' tiene … asignación(es) — ¿eliminar?*, con una marca para confirmar y una cruz para cancelar.
- **A la biblioteca** — solo cuando el proyecto pertenece a una biblioteca de recursos, para un recurso con un nombre que todavía no viene de la biblioteca. Lo pone en la biblioteca, o lo vincula a un elemento existente con el mismo nombre, e informa de lo ocurrido (*Añadido.*, *Ya existía en la biblioteca — ahora vinculado.* o *Vinculado al elemento existente de la biblioteca — los valores difieren, consulta la marca.*).
- **Desvincular de la biblioteca** — el icono de desvincular en un recurso que viene de la biblioteca. Quita el origen; después todos los campos están libres de nuevo.

Sin recursos dice *Aún no hay recursos. Añade uno para empezar.* Si el proyecto pertenece a una biblioteca, dice *Este proyecto aún no usa recursos de la biblioteca.*, con una sugerencia.

### Recursos de la biblioteca

Un recurso que viene de la biblioteca tiene un pequeño icono de biblioteca (*De la biblioteca*). Su *Nombre*, *Tipo*, *Tarifa/hora* y *Unidad* son entonces texto normal (*Valor de la biblioteca — edítalo en la vista Biblioteca, o desvincula este recurso de la biblioteca.*), porque la biblioteca decide qué es el recurso. *Color*, *Unidades máx*, los pasos de capacidad, *Calendario* y *Cuadrilla* siguen siendo editables, porque el proyecto decide cuánto y cuándo. Pueden aparecer dos distintivos: *difiere — decidir* (un clic abre la ventana *Vincular biblioteca de recursos*) y *ya no está en la biblioteca*, con el botón *Quitar del proyecto*.

## La vista Biblioteca

Solo cuando el proyecto pertenece a una biblioteca de recursos. Vea [Usar la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken) y [Gestionar y compartir bibliotecas de recursos](docs://howto-bibliotheken-beheren). Arriba hay un aviso en color: *Esto edita la biblioteca y se aplica a todos los proyectos — fuera de deshacer.* La tabla tiene los mismos campos que la vista *Proyecto*, con estas diferencias:

- No hay columna *Total*: es un cálculo de un solo proyecto.
- La columna *Cuadrilla* aparece en cuanto la biblioteca tiene recursos.
- La columna *Calendario* ofrece los calendarios de la biblioteca, con *Sin calendario* como predeterminado.
- **Asignar al proyecto** — pone el recurso en el proyecto, con una copia de su calendario. Informa *Añadido.* o *Ya está en el proyecto.*
- **Eliminar** — pregunta *¿Eliminar «…» de la biblioteca? Esto se aplica a todos los proyectos y no se puede deshacer.*
- Sin recursos dice *Aún no hay recursos en el pool.*

## La vista Ocupación

Una vista de solo lectura de todos los documentos abiertos: qué recursos de la biblioteca están reservados y dónde. No hay botón para un recurso nuevo. Vea [Usar la vista general de ocupación](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabla** — por recurso de la biblioteca: *Nombre*, *Documentos* (el número de documentos en los que aparece), *Período* y *Pico / Capacidad* (la carga combinada más alta frente a la capacidad de ese día). Un *N días con sobreasignación* en rojo significa que, en varios documentos, el recurso tiene más de su capacidad. La flecha junto a un nombre despliega los documentos, cada uno con período y pico. Un clic en una fila muestra el histograma de ese recurso (*Selecciona un recurso para ver el histograma.*).
- **Qué cuenta** — solo los documentos abiertos en esta aplicación (*Esta vista solo ve los documentos abiertos en esta aplicación.*). Un documento que no se ha calculado recibe un mensaje en su línea. El documento activo cuenta con sus últimas cifras calculadas (*Desactualizado: estas son las últimas cifras calculadas — pulsa F5 en este documento.*). Otro documento lo calcula de antemano la vista (*Calculado por adelantado para esta vista — el propio documento sigue mostrando fechas antiguas hasta que pulses F5 en él o actives “Calcular automáticamente”.*). Si *Calcular automáticamente* está activado, la vista calcula de verdad esos documentos. Si el cálculo falla, el documento no cuenta (*No se cuenta: planificación sin calcular — activa este documento y pulsa F5.*). Sin recursos reservados dice *No hay recursos de la biblioteca reservados en los documentos abiertos.*
- **Orden** — los recursos con sobreasignación van arriba, primero los que tienen más días en conflicto, y después por orden alfabético.

## El dock de recursos

Una lista compacta en la columna de la derecha, junto al panel *Propiedades*. Por recurso: un cuadro de color, el nombre (solo lectura), un triángulo rojo *Sobreasignado* en cuanto el recurso tiene al menos un día sobreasignado, y *Unidades máx* para editar. Si hay una selección de tareas, solo aparecen los recursos de esas tareas. En la cabecera están *Panel completo* (abre el panel completo) y *Cerrar anclaje*. Sin recursos dice *Aún no hay recursos. Añade uno para empezar.*

## El histograma

Una franja bajo el Gantt que muestra la carga de un recurso por día. Actívela o desactívela con *Recursos › Histograma › Histograma* o *Vista › Paneles › Histograma*. Predeterminado: desactivado; su elección se recuerda. La altura es de 160 píxeles de forma predeterminada y se puede arrastrar en el borde entre el Gantt y el histograma.

- **Selector** — a la izquierda, bajo la tabla de tareas, hay una lista: *Todos los recursos* fijado arriba y, debajo, una línea por recurso. Un clic elige la línea, las teclas de flecha la recorren, y *Recursos › Histograma › Anterior* y *Siguiente* hacen lo mismo. Un punto rojo junto a una línea significa que ese recurso tiene al menos un día sobreasignado; para *Todos los recursos*, el punto solo mira los recursos que no son material. Si hay una selección de tareas, la lista solo contiene los recursos de esas tareas. Si el recurso elegido queda fuera, la franja muestra temporalmente *Todos los recursos* de la selección.
- **Barras** — una barra por día: la carga en unidades. Una línea muestra la capacidad; la parte de la barra por encima de la capacidad es roja. Arriba a la izquierda está el valor más alto, con *unidades*. *Todos los recursos* suma la carga y la capacidad de todos los recursos, salvo el material.
- **Información sobre herramientas** — mantenga el ratón quieto un momento sobre un día: *N tareas contribuyen el {date}*, con los nombres de como máximo ocho tareas. Para un recurso elegido y un día en que su calendario no trabaja, también dice *No trabaja este día según el calendario «…»*.
- **Mensajes en la franja** — *Recalcula (F5) para mostrar la carga* mientras no hay carga, *Aún no hay recursos* sin recursos, y *⚠ Planificación desactualizada — recalcule (F5)* arriba a la derecha cuando la planificación está desactualizada.
- **Qué cuenta** — las unidades por día de cada asignación, repartidas sobre los días laborables de la tarea según la *Curva* (o la *Distribución de horas*); solo tareas hoja y sin hitos. La carga se actualiza tras *Calcular* y tras los cambios en recursos y asignaciones. Si cambia las fechas de las tareas, solo cuenta después de *Calcular*.

## Sobreasignación

Un recurso está sobreasignado en un día si su carga es mayor que su capacidad. La capacidad es *Unidades máx* (con los pasos de capacidad) en un día laborable de su calendario, y 0 en un día libre. Aquí el material también cuenta. El motivo es, o bien poca capacidad, o bien un día en que el recurso no trabaja según su calendario.

Dónde lo ve:

- **Recursos › Sobreasignación** — el número de recursos sobreasignados, o *Ninguna*.
- **Barra de estado** — *N recurso(s) sobreasignado(s)*; un clic abre el panel *Advertencias*.
- **Advertencias** — una línea por recurso: *Sobreasignado durante N día(s) (primero – último)*, con *el recurso no trabaja estos días según su calendario* añadido si todos los días son días libres, o *de ellos, N día(s) el recurso no trabaja según su calendario* en caso de mezcla. Vea [Notificaciones y advertencias](docs://ref-meldingen).
- **Histograma** — las partes rojas de las barras y el punto rojo del selector.
- **Dock** — el triángulo *Sobreasignado*.

Con la nivelación se puede resolver la sobreasignación dejando que las tareas empiecen más tarde. Con el valor predeterminado, la fecha de fin del proyecto puede cambiar; con *suavizado* se mantiene dentro de la holgura. La nivelación no resuelve un recurso que tiene que trabajar en un día libre. Vea [Nivelación](docs://uitleg-nivelleren).
