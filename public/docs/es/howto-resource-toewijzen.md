# Asignar recursos con una curva

Objetivo: asignar un recurso a una tarea, con unidades por día y una curva que decide cómo se reparten esas unidades en los días de la tarea.

## Cuándo lo necesita

En cuanto quiera ver quién trabaja dónde y cuándo: el albañil de la hoja exterior de la cavidad, la grúa de las losas alveolares. Sin asignación no hay carga y, por tanto, no hay histograma ni sobreasignación.

Dos términos. Las **unidades** (en el panel la columna *Unidades*, en la ventana *Asignar* el campo *Uds./día*) indican cuánto del recurso trabaja en la tarea por día laborable: 1 es un albañil, 2 son dos de ellos, 0,5 es medio día. La **curva** decide cómo se reparte el total (unidades multiplicadas por duración) entre los días laborables de la tarea. El trabajo rara vez es uniforme: en un muro el inicio es tranquilo, el medio es intenso y el final vuelve a ser tranquilo.

La hoja exterior de la cavidad necesita 6 días laborables. Con un albañil y la curva *Uniforme* son 1 unidad en cada uno de los 6 días, 6 en total. Con la curva *Forma de campana* siguen siendo 6 unidades en total, pero la distribución pasa a ser 0, 1, 2, 2, 1 y 0.

## Pasos

Puede asignar un recurso de dos maneras. El recurso debe existir ya (véase [Gestionar recursos](docs://howto-resources-beheren)).

### Desde la cinta

1. Seleccione una tarea en la tabla de tareas. Debe ser una tarea normal, no un hito ni una fase.
2. Elija *Recursos › Asignación › Asignar ▾*.
3. En la ventana, rellene *Uds./día* (predeterminado 1) y elija la *Curva* (predeterminada *Uniforme*). Se aplican al recurso que elija ahora.
4. Haga clic en el recurso. La ventana se cierra y la asignación queda creada.

Para un segundo recurso, vuelva a abrir la ventana. Los recursos que ya están en la tarea no aparecen en la lista.

### Desde el panel de propiedades

1. Seleccione la tarea. El panel *Propiedades* está a la derecha; si no lo ve, actívelo con *Vista › Paneles › Propiedades*.
2. En el bloque *Asignaciones*, al final, elija el recurso en *Asignar recurso*. La asignación empieza con unidades de 1 y la curva *Uniforme*.
3. En cada asignación, cambie *Unidades*. Haga clic en el nombre del recurso para mostrar la *Curva* y elija allí otra curva.

Así también cambia una asignación existente. Con el icono de papelera (*Quitar*) al final de la línea, quita la asignación de la tarea. El recurso en sí se mantiene. Con *Mover a…* (se muestra tras un clic en el nombre) mueve la asignación a otra tarea.

### Las curvas

- *Uniforme*: lo mismo cada día. Es la opción predeterminada y encaja con trabajo que pesa igual cada día.
- *Cargado al inicio*: el inicio pesa más que el final. Encaja con trabajo que empieza con mucho esfuerzo, como el replanteo.
- *Cargado al final*: el final pesa más que el inicio. Encaja con trabajo que se intensifica hacia el cierre.
- *Forma de campana*: un pico en el medio, con un inicio y un final tranquilos. Encaja con un muro que empieza despacio, alcanza su máximo en el medio y luego baja.
- *Pico temprano*: un pico antes del medio. Encaja con trabajo que alcanza su ritmo rápidamente.
- *Pico tardío*: un pico después del medio. Encaja con trabajo cuya etapa intensa llega solo más tarde.
- *Doble pico*: dos picos. Encaja con trabajo con dos momentos intensos.
- *Tortuga*: un inicio y un final tranquilos con un pico amplio en el medio. Encaja con trabajo largo que sube y baja de intensidad poco a poco.

La curva solo cambia la distribución. La duración, las fechas y el total no cambian. No necesita recalcular después. El histograma se ajusta de inmediato. Elija *Recursos › Histograma › Histograma* para verlo. Si selecciona una tarea, el histograma muestra solo la carga de esa tarea.

## Errores frecuentes y qué hace entonces la aplicación

**Una curva puede subir el pico por encima de sus unidades.** Con unidades enteras, la aplicación redondea el valor por día a unidades enteras, y el total no cambia. Un albañil con 1 unidad en la hoja exterior de la cavidad y la curva *Forma de campana* da 0, 1, 2, 2, 1, 0. En los dos días centrales eso son 2 unidades frente a *Unidades máx* de 1. El histograma colorea esos días en rojo y el recurso cuenta como sobreasignado. Elija otra curva, o reparta usted mismo las horas (véase [Ajustar la distribución de horas](docs://howto-urenverdeling-aanpassen)). Con unidades como 0,5, la aplicación redondea a centésimas. En una tarea corta con unidades enteras la forma queda, por tanto, poco fina: en 10 días, *Tortuga* con 1 unidad da la distribución 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, exactamente igual que *Pico temprano*.

**Ni hito ni fase.** El botón *Asignar* queda desactivado y *Propiedades* indica *No es posible asignar en hitos.* o *No es posible asignar en tareas de resumen.*

**Un recurso solo una vez por tarea.** Si el recurso ya está en la tarea, ya no aparece en la lista. Si todos los recursos ya están en la tarea, la aplicación indica *Todos los recursos ya están asignados.* Si todavía no hay ningún recurso, indica *Crea primero recursos (pestaña Recursos).*

**Las unidades deben ser mayores que 0.** La aplicación no acepta un valor de 0 o menos.

**Material.** En un recurso de material, las unidades son la cantidad por día, en la unidad del recurso, por ejemplo m³. El material no cuenta para la duración de la tarea.

**Un tipo de tarea puede ajustar la duración.** Si la tarea usa *Trabajo fijo* o *Unidades fijas*, un segundo recurso cambia la duración de la tarea. Entonces su planificación deja de estar actualizada; pulse **Calcular** (F5). Véase [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels).

**Una distribución propia.** Si la asignación ya tiene una distribución de horas propia, la curva queda desactivada y muestra *Contorno*. Primero libere esa distribución con *Distribución de horas…*.

**Deshacer.** Puede deshacer la creación, el cambio o la eliminación de una asignación con *Deshacer* (Ctrl+Z).

## Véase también

- [Ajustar la distribución de horas](docs://howto-urenverdeling-aanpassen): ajustar usted mismo las horas por día.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): qué hacer cuando un recurso tiene demasiado trabajo en un día.
- [Tipos de tarea: duración, unidades y trabajo](docs://uitleg-werkregels): qué pasa con la duración cuando cambia las unidades.
- [Panel de recursos](docs://ref-resourcepaneel): todos los campos y botones del panel de recursos.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): los cinco tipos de recurso, seis de las ocho curvas y una grúa torre con un escalón de capacidad a partir del 30 de agosto de 2027.
