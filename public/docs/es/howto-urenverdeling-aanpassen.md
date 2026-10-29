# Ajustar la distribución de horas

Objetivo: para una asignación, decida usted mismo cuánto trabaja el recurso en cada día laborable de la tarea, en lugar de usar una curva estándar.

## Cuándo necesita esto

Una curva como *Forma de campana* es una forma fija. A veces usted sabe mejor. El albañil empieza en la outer cavity leaf con la mitad de su rendimiento, porque el andamio todavía se está montando, y luego trabaja a tiempo completo. O bien quiere mantener un pico justo por debajo de la capacidad. Entonces ajuste la **distribución de horas**.

Usted trabaja con **fases**: días laborables consecutivos en los que el recurso trabaja con las mismas unidades. La distribución solo cambia las horas por día de esta asignación. Las fechas de la tarea no cambian.

## Pasos

El ejemplo es la outer cavity leaf: 6 días laborables, un albañil, 48 horas.

1. Seleccione la tarea. El panel *Propiedades* está a la derecha; si no lo ve, actívelo con *Vista › Paneles › Propiedades*.
2. En el bloque *Asignaciones*, haga clic en el nombre del albañil. *Curva* y el botón *Distribución de horas…* aparecen debajo. Haga clic en *Distribución de horas…*. La ventana *Distribución de horas por fases* se abre. Usted parte de lo que la aplicación registra ahora: para la outer cavity leaf, una fase de 6 días con unidades de 1.
3. Si hace falta, elija un punto de partida en *Aplicar forma:*. Con *Forma de campana* la aplicación crea cinco fases: 0,18 unidades en el primer y el último día, 0,84 en el segundo y el quinto día y 1,98 en los dos días centrales. El total sigue siendo 48 horas.

### Ajustar las fases

Puede trabajar en la tabla o en la franja que está encima de ella.

- Escriba otro *Esfuerzo (unid./día)* en una fase. Las columnas *Horas/día* y *Horas* se calculan también.
- Cambie el número de *Días* de una fase. La última fase siempre llega hasta el final de la tarea y recibe los días que quedan.
- Elija *Dividir* para separar una fase en dos, por ejemplo 6 días en 3 y 3. Elija *Unir* para unir una fase con la siguiente.
- En la franja, arrastre un límite para alargar o acortar una fase, arrastre el borde superior para fijar el esfuerzo y haga doble clic en un día para dividir una fase.

### Aplicar los cambios

Elija *Aplicar*. Con *Cancelar* la ventana se cierra sin cambios.

Un ejemplo. Elija *Dividir*, fije los *Días* de la primera fase en 2 y el esfuerzo de esa fase en 0,5. La segunda fase dura entonces 4 días con esfuerzo 1. El total es 2 × 0,5 × 8 + 4 × 1 × 8 = 40 horas.

Después de *Aplicar*, la curva de la asignación pasa a *Contorno* y queda desactivada. *Unidades* sigue igual. Junto al nombre aparece ahora un icono de gráfico de barras, también cuando la asignación está contraída. El histograma y la sobreasignación se ajustan a la nueva distribución de inmediato. No hace falta recalcular, porque ninguna fecha se mueve.

### Liberar la distribución

Si la asignación tiene una distribución propia, la ventana también tiene *Liberar distribución*. Eso elimina su distribución propia y la aplicación vuelve a *Unidades* y a la curva. Elija también esta opción si quiere cambiar la curva, porque la lista desplegable *Curva* está desactivada mientras haya una distribución propia.

## Errores frecuentes y lo que hace la aplicación entonces

**El total cambia con ello.** Usted no reparte las horas, las decide. Si fija una fase en 0,5 en lugar de 0,18, el total aumenta. El total en horas está en la parte inferior de la ventana, así que compruébelo antes de hacer clic en *Aplicar*.

**Lo que hacen las unidades después depende del tipo de tarea.** Con *Duración y unidades fijas*, otro valor de *Unidades* no cambia nada de la distribución. Con *Duración y trabajo fijos*, la aplicación escala las horas por día junto con las nuevas unidades: con unidades de 2 en lugar de 1, cada día se duplica y el total también (de 32 a 64 horas), y la duración sigue igual. Con *Trabajo fijo*, las unidades cambian la duración de la tarea: la distribución se comprime o se estira entonces sobre la nueva duración, con el mismo total. Con *Unidades fijas*, las unidades también cambian la duración; compruebe después el total en la parte inferior de la ventana.

**Si cambia la duración de la tarea, la distribución se estira con ella.** La forma no cambia. Con *Duración y unidades fijas* y con *Unidades fijas*, el total crece en proporción a la duración: si la duración de una tarea con distribución propia pasa de 4 a 8 días laborables, el total también se duplica, de 32 a 64 horas. Con *Duración y trabajo fijos* y con *Trabajo fijo*, el total sigue igual (32 horas siguen siendo 32 horas) y las unidades bajan.

**El trabajo sigue a la distribución.** *Trabajo (h)* pasa a ser la suma de sus fases, también con *Trabajo fijo*. La duración de la tarea no cambia por ello.

**Esfuerzo no válido.** Un esfuerzo vacío o negativo recibe un borde rojo y *Aplicar* queda desactivado. Una fase con esfuerzo 0 está permitida. Esa fase se queda dentro de la duración de la tarea.

**Todo se aplica a esta asignación.** La propia aplicación lo indica: *La distribución solo cambia las horas por día de esta asignación; las fechas de la tarea y las divisiones no cambian.* Otros recursos de la misma tarea conservan su propia distribución.

**La nivelación sigue a la distribución.** La nivelación cuenta las mismas horas por día que el histograma.

**Deshacer.** *Aplicar* y *Liberar distribución* son cada uno un paso de *Deshacer* (Ctrl+Z).

## Véase también

- [Asignar recursos con una curva](docs://howto-resource-toewijzen): colocar un recurso en una tarea y elegir una curva.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): qué hacer cuando un recurso tiene demasiado trabajo en un día.
