# Tipos de tarea: duración, unidades y trabajo

Usted asigna un yesero al enlucido y la tarea dura cuatro días. Si añade un segundo yesero, el trabajo puede hacerse en dos días. También puede seguir durando cuatro días, con el doble de trabajo. Las dos opciones tienen sentido. Cuál de las dos elige la aplicación depende del **tipo de tarea** de esa tarea. En este artículo ve cómo la aplicación relaciona duración, unidades y trabajo, y qué mantiene constante cada tipo de tarea.

## El concepto

Tres magnitudes están relacionadas:

- **Duración**: cuánto dura la tarea, en días laborables o en horas.
- **Unidades**: cuánto de un recurso trabaja en la tarea por día laborable. En el panel *Propiedades* esto se llama *Unidades*; en otras ventanas, *Uds./día*. 1 unidad es un yesero durante todo el día, 2 son dos yeseros y 0,5 es medio día.
- **Trabajo**: el número total de horas que el recurso dedica a la tarea.

La suma es: trabajo = duración × unidades × horas por día laborable. Las horas por día laborable vienen del calendario de la tarea. El enlucido de cuatro días laborables con un yesero es, con un día laborable de 8 horas, 4 × 1 × 8 = 32 horas de trabajo.

Si cambia una de las tres, al menos una de las otras dos debe moverse también. Si no, la suma deja de cumplirse. El tipo de tarea decide cuál. Se define por tarea, en el panel *Propiedades*. La aplicación solo muestra el tipo de tarea y el trabajo cuando usted los activa. Cómo se hace, está en [Elegir un tipo de tarea](docs://howto-werkregel-kiezen).

Un tipo de tarea solo funciona en tareas normales. Los hitos, las fases (tareas de resumen), las hamacas y las tareas cuyo *Tipo de duración* es *Tiempo transcurrido* no tienen uno: el campo *Tipo de tarea* no aparece. Tampoco cuentan los materiales, como el hormigón o el mortero de enlucido. La cantidad de material nunca determina la duración, y la aplicación nunca la ajusta por un tipo de tarea.

## Cómo calcula la aplicación

### El tipo de tarea actúa sobre lo que cambia

La aplicación recalcula duración, unidades y trabajo solo en el momento en que cambia una de ellas: la duración de la tarea, las unidades de una asignación, el trabajo, un recurso que se añade o se quita, o las horas por día en un calendario. **Calcular** (F5) no cambia ninguna de ellas: F5 solo calcula fechas. Elegir un tipo de tarea tampoco cambia ningún número. El tipo de tarea cuenta en su siguiente cambio.

Si un tipo de tarea cambia la duración de la tarea, la planificación queda desactualizada. La barra de estado muestra entonces *Desactualizado — recalcula (F5)*, a menos que *Calcular automáticamente* esté activado.

### Cuatro tipos de tarea

En el panel *Propiedades* hay un icono i junto a la lista desplegable *Tipo de tarea*. Señale el icono, haga clic en él o púlselo, y la aplicación explica el tipo de tarea que se aplica ahora. En la lista desplegable abierta, cada opción también tiene un icono i. La explicación empieza con una frase en negrita. Los cuatro tipos de tarea, con esa frase de la aplicación:

- **Duración y unidades fijas** (*El trabajo se calcula a partir de la duración y las unidades*). Es la opción predeterminada. La aplicación nunca cambia la duración por sí misma, y el trabajo se calcula a partir de la duración y las unidades. Si escribe usted el trabajo, la aplicación ajusta las unidades, porque la duración es fija.
- **Duración y trabajo fijos** (*Las unidades se calculan a partir de la duración y el trabajo*). La aplicación nunca cambia la duración por sí misma. Si cambia la duración, el trabajo se mantiene y las unidades se ajustan.
- **Trabajo fijo** (*La duración se calcula a partir del trabajo y las unidades*). El trabajo es fijo y la duración se calcula a partir del trabajo y de las unidades.
- **Unidades fijas** (*La duración se calcula a partir del trabajo y las unidades*). Las unidades son fijas y la duración se calcula a partir del trabajo.

Así, dos tipos de tarea dejan la duración como está. Con los otros dos, la duración se mueve cuando cambia las unidades, el trabajo o el número de recursos. Con un solo recurso, Trabajo fijo y Unidades fijas hacen exactamente lo mismo en ese caso. Se diferencian cuando usted cambia la duración: con Trabajo fijo el trabajo se mantiene y las unidades se ajustan; con Unidades fijas las unidades se mantienen y el trabajo crece con la duración. También se diferencian cuando hay más recursos en la tarea (véase más abajo).

Los ejemplos resueltos de más abajo muestran lo que hace cada tipo de tarea.

### Redondeo

La aplicación redondea hacia arriba la duración que resulta de la suma. En una tarea en días, redondea a días laborables enteros; en una tarea en horas, a minutos enteros. El trabajo y las unidades se mantienen como usted los introdujo o como la aplicación los tomó de la suma. Por eso la suma a veces deja de cumplirse exactamente. El ejemplo de más abajo muestra qué pasa entonces.

### Varios recursos

Si una tarea tiene varios recursos, se aplican dos reglas. Con Duración y trabajo fijos, Trabajo fijo y Unidades fijas, el trabajo total se mantiene igual cuando se añade o se quita un recurso. La aplicación lo divide entonces en proporción a las unidades. Con Duración y unidades fijas, un recurso nuevo aporta su propio trabajo. Con Trabajo fijo y Unidades fijas, el recurso más lento determina la duración: por recurso, es el trabajo dividido entre las unidades, y cuenta el resultado más grande.

Un ejemplo: dos recursos tienen cada uno 32 horas de trabajo y unidades de 1, en total 4 días laborables. Usted pone las unidades del primero en 0,5. La duración pasa entonces a ser 8 días laborables. Con Trabajo fijo, el segundo recurso mantiene sus 32 horas de trabajo y sus unidades bajan a 0,5. Con Unidades fijas, el segundo mantiene sus unidades de 1 y su trabajo crece hasta 64 horas.

### Avance

Si la tarea ya tiene avance, el tipo de tarea trabaja con la parte restante: la duración restante y el trabajo restante. En el panel *Propiedades* ese trabajo está en la columna *Trabajo (h)*. Lo hecho se mantiene.

### Tareas en horas

Una tarea horaria se calcula igual, pero en minutos. Si solo la grúa está en una tarea de 5 horas, eso son 5 horas de trabajo. Con Trabajo fijo, la duración con unidades de 2 pasa a ser 2,5 horas. El hollow-core floor del proyecto de práctica también tiene la cuadrilla de carpintería. Sigue necesitando 5 horas de trabajo, es la más lenta, y por eso la duración se mantiene en 5 horas. Cómo se relacionan horas y días se explica en [Días y horas](docs://uitleg-dagen-en-uren).

## Ejemplo resuelto: el enlucido

El ejemplo es el proyecto de práctica de los tutoriales, *House extension*. En el tutorial 5 lo resuelve usted mismo y comprueba los números. Aquí lee lo que hace cada tipo de tarea.

El enlucido dura 4 días laborables. Se asigna un yesero, con unidades de 1, y el día laborable es de 8 horas. Así, el trabajo es de 32 horas.

### Duración y unidades fijas

- Usted pone la duración en 6 días laborables: el trabajo crece hasta 48 horas y las unidades se mantienen en 1.
- Usted pone las unidades en 2: la duración se mantiene en 4 días laborables y el trabajo pasa a ser 64 horas.
- Usted escribe 48 horas en *Trabajo (h)*: la duración se mantiene en 4 días laborables y las unidades pasan a ser 1,5.
- Usted asigna un segundo recurso, por ejemplo *Plasterer 2*, con unidades de 1: la duración se mantiene en 4 días laborables y ese segundo recurso aporta 32 horas de trabajo, 64 horas en total.

### Duración y trabajo fijos

- Usted pone la duración en 6 días laborables: el trabajo se mantiene en 32 horas y las unidades bajan a 0,67.
- Usted pone las unidades en 2: la duración se mantiene en 4 días laborables. Como la duración es fija, el trabajo crece hasta 64 horas.
- Usted escribe 16 horas en *Trabajo (h)*: la duración se mantiene en 4 días laborables y las unidades pasan a ser 0,5.
- Usted asigna un segundo recurso, por ejemplo *Plasterer 2*, con unidades de 1: las 32 horas se reparten, 16 horas cada uno, y las unidades pasan a ser 0,5 para los dos. La duración se mantiene en 4 días laborables.

### Trabajo fijo

- Usted pone la duración en 6 días laborables: el trabajo se mantiene en 32 horas y las unidades bajan a 0,67.
- Usted pone las unidades en 2: el trabajo se mantiene en 32 horas y la duración pasa a ser 2 días laborables. Es el paso que da en el tutorial 5.
- Usted escribe 48 horas en *Trabajo (h)*: las unidades se mantienen en 1 y la duración pasa a ser 6 días laborables.
- Usted asigna un segundo recurso, por ejemplo *Plasterer 2*, con unidades de 1: las 32 horas se reparten, 16 horas cada uno, y la duración pasa a ser 2 días laborables. Si vuelve a quitar ese segundo recurso, la duración vuelve a ser 4 días laborables.

### Unidades fijas

- Usted pone la duración en 6 días laborables: las unidades se mantienen en 1 y el trabajo crece hasta 48 horas.
- Usted pone las unidades en 2: el trabajo se mantiene en 32 horas y la duración pasa a ser 2 días laborables.
- Usted escribe 48 horas en *Trabajo (h)*: las unidades se mantienen en 1 y la duración pasa a ser 6 días laborables.
- Usted asigna un segundo recurso, por ejemplo *Plasterer 2*, con unidades de 1: las 32 horas se reparten, 16 horas cada uno, y la duración pasa a ser 2 días laborables.

### Cuando la suma no cuadra

Con Trabajo fijo, usted pone las unidades en 3. El trabajo es de 32 horas, así que la duración pasa a ser 32 ÷ (3 × 8) = 1,33 días laborables. La aplicación redondea a 2 días laborables. El trabajo (32 horas) y las unidades (3) se mantienen, pero 2 × 3 × 8 son 48 horas. Por eso el histograma reparte las 32 horas en los 2 días laborables: 2 unidades por día, no 3. En el campo *Trabajo (h)* aparece un signo de aviso, *Difiere de unidades × duración*, para mostrar esto.

Con dos recursos con unidades distintas funciona igual. Si, con Trabajo fijo, añade usted un segundo recurso, por ejemplo *Plasterer 2*, con unidades de 2 al yesero con unidades de 1, la aplicación divide las 32 horas en la proporción 1 : 2, es decir, 10,7 y 21,3 horas. Entonces los dos necesitan 1,33 días laborables. La duración pasa a ser 2 días laborables.

Un archivo de P6 o de MS Project también puede tener un *Trabajo (rest.)* que no sea igual a unidades × duración restante. Entonces aparece el mismo signo de aviso. La aplicación no cambia ese trabajo por sí misma. Si cambia la duración de una tarea así, la aplicación sigue el tipo de tarea, también cuando el trabajo restante venía del archivo. Con *Duración y unidades fijas* y *Unidades fijas*, el trabajo restante pasa a ser unidades × nueva duración restante. Con *Duración y trabajo fijos* y *Trabajo fijo*, el trabajo se mantiene y las unidades se ajustan. Si de este modo desaparece un trabajo restante del archivo, recibe usted una notificación con el número de horas anterior y el nuevo. Ctrl+Z restaura el valor anterior. La explicación junto al signo de aviso le indica, por tarea, cuál de las dos cosas ocurre.

### Otro calendario

Con Trabajo fijo, el día laborable del calendario pasa de 8 a 6 horas. El trabajo se mantiene en 32 horas, así que la duración pasa a ser 32 ÷ 6 = 5,33, redondeada hacia arriba a 6 días laborables. Cómo cuenta la aplicación los días laborables y los horarios de trabajo se explica en [Calendarios y días laborables](docs://uitleg-kalenders). La aplicación informa: *Tras el cambio de calendario, el tipo de tarea ajustó la duración de 1 tarea (el trabajo se mantiene, cambiaron las horas por día)*.

### Una tarea con avance

The inner cavity leaf dura 5 días laborables y tiene un avance del 40%: 2 días laborables están hechos y quedan 3 días laborables (24 horas). Con Trabajo fijo, usted pone las unidades de 1 a 2. El trabajo restante se mantiene en 24 horas y la duración restante pasa a ser 1,5, redondeada hacia arriba a 2 días laborables. La tarea dura ahora 2 + 2 = 4 días laborables y el avance es del 50%. El porcentaje también cambia, porque la parte hecha se mantiene y lo que queda se acorta.

## Consecuencias y malentendidos

**«Trabajo fijo significa que la duración es fija.»** No, es justo lo contrario. Con *Duración y unidades fijas* y *Duración y trabajo fijos*, la duración es fija. Con *Trabajo fijo* y *Unidades fijas*, la duración se calcula a partir de las otras dos.

**«Si elijo un tipo de tarea, mi planificación cambia.»** No. Elegir no cambia ningún número. Solo en su siguiente cambio el tipo de tarea decide qué se mueve. Con un tipo de tarea que protege el trabajo, la aplicación fija el trabajo en el momento en que usted elige, así que hay un número que proteger. Esa tarea tiene entonces un *Trabajo (h)* guardado.

**«La duración cambió sin que yo la tocara.»** Eso puede pasar después de un cambio en las unidades, el trabajo, el número de recursos o las horas por día, con Trabajo fijo o Unidades fijas. La barra de estado indica entonces que la planificación está desactualizada. Pulse **Calcular** (F5) para ver las nuevas fechas.

**Sin asignación, un tipo de tarea no hace nada.** Entonces no hay unidades ni trabajo que relacionar con la duración.

**Los archivos de MS Project o de Primavera P6 siempre muestran el tipo de tarea.** En una tarea de MS Project, la aplicación a veces conserva el ajuste «condicionada por el esfuerzo». Ese ajuste guardado afecta a dos casos. Con *Duración y trabajo fijos* y condicionada por el esfuerzo, el trabajo se mueve al cambiar la duración, en lugar de las unidades. Con *Unidades fijas* y no condicionada por el esfuerzo, el trabajo se mueve al añadir o quitar un recurso, y la duración se mantiene. Las tareas que usted crea en la aplicación no tienen este ajuste. La explicación junto al icono i tiene en cuenta este ajuste.

## Véase también

- [Elegir un tipo de tarea](docs://howto-werkregel-kiezen): los pasos para definir el tipo de tarea de una tarea.
- [Asignar recursos con una curva](docs://howto-resource-toewijzen): poner un recurso en una tarea, con unidades y distribución.
- [Días y horas](docs://uitleg-dagen-en-uren): cómo la aplicación convierte días y horas.
- [Calendarios y días laborables](docs://uitleg-kalenders): cómo la aplicación cuenta días laborables y horarios de trabajo.
