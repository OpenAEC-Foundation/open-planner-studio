# Elegir un tipo de tarea

Objetivo: definir, por tarea, qué ajusta la aplicación cuando cambia la duración, las unidades o el trabajo: la propia duración, las unidades o el propio trabajo.

## Cuándo lo necesita

Ha asignado recursos a una tarea y quiere que la aplicación calcule del modo en que usted lo hace. Un ejemplo: la grúa se alquila por un día y ese día es fijo. Otro ejemplo: sabe que hay 160 horas de albañilería en la tarea y quiere ver cuánto tarda con tres personas en lugar de dos. Esas dos situaciones necesitan un tipo de tarea distinto.

El tipo de tarea decide cuál de las tres magnitudes (duración, unidades y trabajo) se ajusta cuando usted cambia otra. El contexto y los ejemplos resueltos están en [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels).

## Pasos

### Mostrar el tipo de tarea

El tipo de tarea no se muestra de forma predeterminada. Actívelo una vez:

1. Elija *Configuración › Proyecto › Configuración*, pestaña *Planificación*.
2. Bajo el encabezado *Cálculo*, marque *Usar tipos de tarea*.
3. Cierre la ventana con *Cerrar*.

Esto es un ajuste de la aplicación, no del archivo del proyecto. Si un archivo ya contiene tipos de tarea o trabajo guardado, por ejemplo un archivo de MS Project o de Primavera P6, la aplicación muestra el tipo de tarea de ese archivo aunque este ajuste esté desactivado. Lo mismo ocurre en cuanto usted elige un tipo de tarea en un archivo: entonces la visualización sigue activa para ese archivo, aunque después desactive el ajuste. Sigue activa mientras el archivo esté abierto y, tras volver a abrirlo, mientras el archivo contenga un tipo de tarea o trabajo guardado.

### Fijar el tipo de tarea de una tarea

1. Seleccione la tarea. El panel *Propiedades* está a la derecha; si no lo ve, actívelo con *Vista › Paneles › Propiedades*.
2. En *Tipo de tarea*, elija una de las cinco opciones: *Valor predeterminado del proyecto (Duración y unidades fijas)*, *Duración y unidades fijas*, *Duración y trabajo fijos*, *Trabajo fijo* o *Unidades fijas*. Con *Predeterminado del proyecto* la tarea sigue el valor predeterminado del proyecto.
3. ¿Quiere saber qué hace una opción? En la lista desplegable abierta, cada opción tiene un icono i. Sitúe el puntero sobre él, o haga clic o toque en él, para ver la explicación. Al hacer clic en el icono i todavía no se elige ese tipo de tarea.
4. Junto al campo cerrado también hay un icono i. Explica el tipo de tarea que se aplica ahora, por ejemplo *La duración se calcula a partir del trabajo y las unidades.* Con *Predeterminado del proyecto*, es el tipo de tarea que aparece entre paréntesis.

*Predeterminado del proyecto* es la primera opción y es la que tiene una tarea de forma predeterminada. El tipo de tarea entre paréntesis es el que el proyecto tiene ahora como predeterminado. La aplicación no tiene ningún botón para cambiar ese predeterminado del proyecto: viene de una importación (por ejemplo, de MS Project o Primavera P6) o de la conexión MCP. Si quiere otro tipo de tarea para una sola tarea, elíjalo aquí.

También puede elegir el tipo de tarea en la tabla. Haga clic en el **+** a la derecha del encabezado de la tabla de tareas (*Añadir columna*) y, en *Planificación*, elija la columna *Tipo de tarea*.

Una tarea sin asignación no tiene nada que relacionar, así que el tipo de tarea no hace nada allí. Asigne primero un recurso (véase [Asignar recursos con una curva](docs://howto-resource-toewijzen)).

### Ver y cambiar el trabajo

En una tarea con asignaciones aparece una columna *Trabajo (h)* en el bloque *Asignaciones* del panel *Propiedades*, junto a *Unidades*. Es el trabajo restante de ese recurso, en horas. Un candado pequeño sobre una columna muestra lo que mantiene el tipo de tarea: *Unidades* con *Duración y unidades fijas* y con *Unidades fijas*, *Trabajo (h)* con *Duración y trabajo fijos* y con *Trabajo fijo*.

Si quiere cambiar el trabajo usted mismo, escriba las horas en el campo y pulse Intro. La aplicación no acepta un valor de 0 o menos: el campo vuelve al valor anterior.

### Ver qué pasa

Si elige un tipo de tarea, todavía no cambia ningún número. Con un tipo de tarea que protege el trabajo, la aplicación solo fija el trabajo actual, así que *Trabajo (h)* tiene un valor guardado. Solo en el siguiente cambio decide el tipo de tarea qué se ajusta. Cambie, por ejemplo, *Unidades* y vea qué pasa con la duración y el trabajo.

Si eso cambia la duración de la tarea, la barra de estado muestra *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo mediante *Inicio › Programación › Calcular*, para ver las nuevas fechas. Si *Calcular automáticamente* está activado (misma pestaña *Planificación*, encabezado *Cálculo*), la aplicación lo hace por sí misma.

## Qué tipo de tarea encaja

- **Duración y unidades fijas** encaja cuando la duración es un acuerdo y las unidades las introduce usted. El trabajo resulta de esas dos. Es la opción predeterminada. La grúa alquilada por un día encaja aquí: el día es fijo y usted decide cuántas grúas trabajan ese día.
- **Duración y trabajo fijos** encaja cuando la tarea debe terminarse dentro de un plazo fijo y usted sabe cuánto trabajo tiene. Si cambia la duración, la aplicación ajusta las unidades.
- **Trabajo fijo** encaja cuando sabe cuántas horas de trabajo tiene y quiere ver cómo cambia la duración con el número de personas. Las 160 horas de albañilería con tres personas en lugar de dos encajan aquí. El enlucido del proyecto de práctica tiene este tipo de tarea.
- **Unidades fijas** encaja cuando las unidades son fijas, por ejemplo una grúa, y el trabajo decide la duración.

## Puntos de atención y qué hace la aplicación entonces

**Falta el campo *Tipo de tarea*.** Entonces el ajuste *Usar tipos de tarea* está desactivado y el archivo todavía no tiene tipos de tarea, o ha seleccionado un hito, una fase, una hamaca o una tarea con el tipo de duración *Tiempo transcurrido*. Ahí no hay tipo de tarea. Seleccione una tarea normal.

**La duración cambia sin que usted la cambie.** Con *Trabajo fijo* y *Unidades fijas* la duración se deriva de las unidades y del trabajo. Si cambia una de ellas o el número de recursos, la aplicación ajusta la duración, redondeada hacia arriba a días laborables completos. En una tarea en horas, la aplicación redondea hacia arriba a minutos completos.

**El trabajo no coincide exactamente con unidades × duración.** El redondeo puede causarlo. En el campo *Trabajo (h)* aparece entonces un signo de advertencia, *Difiere de unidades × duración*. El histograma sigue el trabajo guardado.

**El material no cuenta.** Para un recurso de material, *Trabajo (h)* muestra un guion. El material nunca determina la duración.

**Una tarea con avance.** El tipo de tarea actúa sobre la parte restante. Por eso *Trabajo (h)* muestra solo lo que todavía falta por hacer.

**Deshacer.** Elegir un tipo de tarea y cada cambio que el tipo de tarea calcula forman un solo paso para *Deshacer* (Ctrl+Z). Entonces el tipo de tarea elegido desaparece de nuevo, pero el campo *Tipo de tarea* sigue visible.

## Véase también

- [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels): cómo la aplicación relaciona la duración, las unidades y el trabajo, con ejemplos resueltos.
- [Asignar recursos con una curva](docs://howto-resource-toewijzen): asignar un recurso a una tarea.
