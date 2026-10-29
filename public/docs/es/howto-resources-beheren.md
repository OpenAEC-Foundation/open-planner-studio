# Gestionar recursos

Objetivo: crear, editar y eliminar recursos (personas, máquinas y material) en su proyecto, para poder asignarlos a tareas.

## Cuándo lo necesita

Antes de asignar un albañil o una grúa a una tarea, esa persona o máquina debe existir como recurso. El recurso registra cuánto hay de él y en qué días trabaja. Con eso, la aplicación calcula si se le pide demasiado en un día. Edite un recurso cuando cambie la dotación, por ejemplo cuando se incorpora un segundo albañil.

Dos términos. **Unidades máx.** es la capacidad por día laborable: 1 es una persona o máquina, 2 son dos de ellas. Una **asignación** es un recurso en una tarea (consulte [Asignar recursos con una curva](docs://howto-resource-toewijzen)).

## Pasos

### Crear un recurso

1. Elija *Recursos › Gestionar › Nuevo recurso*. El panel de recursos ocupa el espacio de trabajo y aparece una fila vacía al final de la tabla. También puede abrir el panel con *Recursos › Gestionar › Recursos* y después elegir *Nuevo recurso en el proyecto*.
2. Escriba el nombre, por ejemplo *Bricklayer*.
3. Elija el *Tipo*: *Mano de obra* (el valor predeterminado), *Equipo*, *Material*, *Subcontratista* o *Cuadrilla*.
4. Rellene los otros campos si hace falta. Todo tiene un valor predeterminado: *Unidades máx* es 1 y *Calendario* es *Calendario del proyecto*. *Tarifa/hora* está vacío. Solo puede rellenar *Unidad* en el tipo *Material*, por ejemplo m³.
5. Pulse Intro o haga clic fuera de la fila. El recurso aparece en la tabla. Con Intro, se abre enseguida una fila vacía debajo para el siguiente. Pulse Esc cuando termine.

La fila solo se convierte en recurso cuando tiene nombre. Con Esc, o al hacer clic fuera sin nombre, la aplicación no crea nada. El orden en que rellena los datos no importa: puede elegir primero el tipo y después escribir el nombre.

### Editar un recurso

Edite los campos de la fila. La aplicación guarda el nombre, la tarifa y la unidad al salir del campo. Los demás campos los guarda enseguida.

- La aplicación solo acepta *Unidades máx* si el valor es mayor que 0. Con 0 o menos, el campo recibe un borde rojo y vuelve al valor anterior.
- *Calendario* decide en qué días trabaja el recurso. Elija *Calendario del proyecto* o un calendario propio. Con *+ Calendario de recurso* crea uno nuevo, y el lápiz (*Editar…*) abre el calendario elegido. Si una tarea trabaja un día en que el recurso no trabaja según su calendario, ese día cuenta como sobreasignado. Cómo crear un calendario de recurso se describe en [Configurar un calendario de recursos](docs://howto-resourcekalender-instellen).
- *Tarifa/hora* y *Total*: *Total* es el resultado de multiplicar las horas cargadas de ese recurso por la tarifa. Un yesero con 32 horas cargadas y una tarifa de 50 por hora suma 1.600,00. Al final de la tabla está la suma de todos los recursos.
- *Cuadrilla* agrupa un recurso bajo un recurso del tipo *Cuadrilla*. Es solo una agrupación: la aplicación no suma la capacidad ni la carga de los miembros a la cuadrilla.
- El cuadrado de color a la izquierda es el color del recurso. Solo sirve para mostrarlo y no afecta a la planificación.

### Capacidad que cambia con el tiempo

¿Su segundo albañil llega solo el 19 de julio? Haga clic en la flecha junto a *Unidades máx*. Bajo *Capacidad escalonada en el tiempo*, elija *Añadir paso*. Cada paso tiene una fecha (*Desde*) y un número (*Unidades máx*). Desde esa fecha se aplica ese número. Sin pasos, siempre se aplica el valor fijo.

Un paso nuevo empieza con la fecha de hoy y 1 unidad. Cambie las dos cosas, porque si no, se aplica una capacidad de 1 desde hoy.

### Eliminar un recurso

1. Haga clic en la papelera de la fila.
2. Si el recurso tiene asignaciones, la aplicación pide confirmación, por ejemplo *'Bricklayer' tiene 4 asignación(es) — ¿eliminar?* Haga clic en el icono de verificación para eliminar, o en el icono de cruz para cancelar. Sin asignaciones, el recurso desaparece al momento.

Las asignaciones del recurso se eliminan junto con él. Si una tarea tiene un tipo de tarea distinto de *Duración y unidades fijas*, la aplicación reparte el trabajo del recurso eliminado entre los recursos que quedan. Según el tipo de tarea, eso cambia sus unidades o la duración de la tarea. Si cambia la duración, la planificación deja de estar actualizada.

Puede deshacer la creación, la edición y la eliminación con *Deshacer* (Ctrl+Z).

### La vista rápida en la columna lateral

*Recursos › Gestionar › Dock de recursos* muestra una vista compacta en la columna de la derecha, junto a *Propiedades*. Ahí ve el nombre y el color de cada recurso, y un icono de aviso (*Sobreasignado*) junto a un recurso que está sobreasignado. Solo puede cambiar *Unidades máx* ahí. Si selecciona una o varias tareas, la vista muestra solo los recursos de esas tareas.

## Errores frecuentes y lo que hace la aplicación entonces

**Solo el tipo *Material* cambia el cálculo.** Mano de obra, equipo, subcontratista y cuadrilla se tratan igual. Material no cuenta para la duración de una tarea y no se nivela. En el histograma, la fila *Todos los recursos* tampoco cuenta el material.

**Sin nombre, no hay recurso.** Una fila vacía desaparece sin dejar rastro.

**Un paso nuevo en la capacidad.** Si olvida cambiar la fecha y el número, la capacidad es 1 desde hoy.

**Eliminar un recurso que todavía necesita.** Si lo elimina por error, pulse Ctrl+Z enseguida. Las asignaciones también vuelven.

## Consulte también

- [Asignar recursos con una curva](docs://howto-resource-toewijzen): colocar un recurso en una tarea.
- [Configurar un calendario de recursos](docs://howto-resourcekalender-instellen): fijar los días laborables de un recurso.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): qué hacer cuando un recurso tiene demasiado que hacer en un día.
- [Panel de recursos](docs://ref-resourcepaneel): todos los campos y botones del panel de recursos.
