# Días y horas

Una tarea de 2 días y una tarea de 16 horas parecen iguales, pero la aplicación las calcula de forma distinta. ¿Por qué puede elegir entre días y horas? ¿Y qué pasa cuando una tarea en horas está unida a una tarea en días? En este artículo aprenderá cómo la aplicación cuenta días y horas, y dónde redondea. El ejemplo práctico muestra los números.

## El concepto

Una **tarea en días** tiene una duración en días laborables completos, por ejemplo `5d`. Ocupa días laborables completos. En el calendario estándar tiene una fecha de inicio y una fecha de fin, sin hora.

Una **tarea horaria** tiene una duración en horas laborables, por ejemplo `12h` o `1h 30m`. Tiene un inicio y un fin con hora, por ejemplo martes 11:00.

La unidad pertenece a la tarea, no al proyecto. Puede combinar tareas en días y tareas horarias en una misma planificación. Eso se llama **planificación mixta**.

Utilice horas para trabajos que no caben en días completos: una grúa que usted alquila durante doce horas, un hormigonado de seis horas, una tarea que solo puede empezar después de la pausa para comer. Para todo lo demás bastan los días, y son más claros.

La **planificación por horas** está desactivada de forma predeterminada. Mientras esté desactivada, la aplicación trabaja en días. Si un archivo sí contiene planificación por horas, por ejemplo tareas en horas, la aplicación muestra *Este archivo contiene planificación por horas.* Esas tareas siguen calculándose, pero solo puede editar su duración cuando active la planificación por horas.

## Cómo calcula la aplicación

### Horarios laborales y día laborable estándar

Cada calendario tiene **bandas de horario laboral** para cada día laborable (en la aplicación se llaman *bandas*). El calendario estándar tiene de 07:00 a 12:00 y de 13:00 a 16:00. El hueco entre ambas es la pausa. La aplicación deriva esas bandas de *Inicio (hora)*, *Fin (hora)* y la pausa del calendario; usted no tiene que configurar nada para ello. Si define bandas propias por día de la semana, estas tienen prioridad.

El **día laborable estándar** es el día laborable que más se repite; su duración es la suma de sus bandas. No es un promedio: con el lunes de 16 horas y de martes a viernes de 10 horas, el día laborable estándar es de 10 horas. Si los días laborables tienen distinta duración, se aplica el total diario más frecuente y, en caso de empate, el más alto. Con cuatro días de 8 horas y un viernes de 5 horas, el día laborable estándar es, por tanto, de 8 horas. Un calendario con sus propias horas por día (por ejemplo, procedente de Primavera P6) también calcula con este total diario, y la ventana del calendario lo muestra. Su propio valor se conserva para la exportación. Si difiere, la ventana del calendario muestra un bloque naranja debajo de *Día laborable estándar*. Una tarea de 1870 horas, con días laborables de 10 horas, dura 187 días, aunque su valor propio sea de 8 horas por día.

### Una tarea horaria

La aplicación cuenta los minutos laborables desde el inicio, a través de las bandas de horario laboral. Las pausas, las tardes, los fines de semana y los festivos no cuentan. Una tarea de 12 horas, por tanto, no cabe en un día laborable de 8 horas: continúa al día siguiente.

### Una tarea en días

La aplicación cuenta días laborables completos. Las horas por día no intervienen. Una tarea de 5 días termina el mismo día, tanto si el calendario tiene 6 horas por día como si tiene 8.

### Convertir días y horas

Un día equivale al día laborable estándar del calendario de la tarea. La aplicación lo usa en tres lugares:

- Para *Visualización de la duración*. En *Configuración › Proyecto › Configuración*, en la pestaña *Apariencia*, usted elige *Automática (unidad propia por tarea)*, *Siempre días* o *Siempre horas*. Una tarea de 18 horas se muestra con *Siempre días* como `2.25d(18h)`: la unidad propia queda entre paréntesis.
- Para un desfase en horas después de una tarea en días (véase *Redondeo*).
- Al cambiar la unidad de una tarea. La aplicación cuenta entonces los días desde el inicio de la tarea, cada día con sus propias horas, y convierte la duración de inmediato si el resultado es exacto. Dos días pasan a ser `16h`. En un calendario en el que el viernes tiene 5 horas, 5 días desde el lunes pasan a ser `37h`. Doce horas no se pueden convertir en días completos en un calendario con días de 8 horas: en ese caso la aplicación deja la unidad como está.

### Tareas en días y tareas horarias juntas

Las reglas siguientes se aplican a una relación fin-comienzo en un calendario sin bandas de horario laboral propias, como el calendario estándar.

- **Hora → hora.** El sucesor empieza en el momento en que termina el predecesor, aunque sea a mitad de un día.
- **Hora → día.** Una tarea en días nunca empieza a mitad de un día. Empieza el primer día laborable posterior al día en que termina la tarea horaria. El resto de ese día no se usa y vuelve como holgura de la tarea horaria.
- **Día → hora.** Una tarea en días ocupa todo su último día. La tarea horaria empieza el primer día laborable posterior, al inicio de la primera banda de horario laboral.

### Redondeo

La aplicación redondea, o rechaza, en cuatro lugares:

- **Una tarea en días después de una tarea horaria** empieza el día laborable siguiente. La tarea horaria se redondea, por así decirlo, hacia arriba hasta días completos.
- **Un desfase en horas** se cuenta en el calendario del desfase, de forma predeterminada el del predecesor. Si el predecesor es una tarea en días en un calendario sin bandas de horario laboral propias, como el calendario estándar, la aplicación convierte el desfase en días laborables completos: el desfase dividido entre las horas del día laborable estándar, redondeado a un número entero; medio día se redondea hacia arriba. Con 8 horas por día, 1 hora cuenta como 0 días, 4 horas como 1 día y 12 horas como 2 días. Esto también se aplica si el sucesor es una tarea horaria. Si el predecesor es una tarea horaria, o su calendario tiene bandas de horario laboral propias, el desfase se cuenta exactamente en horas laborables y la pausa no cuenta.
- **Una duración en días** es siempre un número entero. Si escribe `1.5d`, la aplicación muestra *Introduzca un número entero de días u horas, por ejemplo 2d o 12h.* Una duración en horas puede ser `1.5h` o `1h 30m`.
- **Cambiar la unidad** solo se hace si el resultado es exacto (véase más arriba).

## Ejemplo práctico: la grúa

El calendario es de lunes a viernes, de 07:00 a 12:00 y de 13:00 a 16:00: un día laborable estándar de 8 horas. El inicio del proyecto es el lunes 7 de junio de 2027.

### Hora, hora y día

*Place crane* dura 12 horas. El lunes tiene 8 horas laborables (5 hasta las 12:00 y 3 después de la pausa) y el martes, las 4 horas restantes. La tarea va del lunes a las 07:00 al **martes 8 de junio a las 11:00**.

*Adjust elements* dura 8 horas y sigue con una relación fin-comienzo. Empieza de inmediato el martes a las 11:00: eso son 1 hora hasta la pausa y 3 horas después de ella. Las 4 horas restantes son el miércoles de 07:00 a 11:00. El fin es el **miércoles 9 de junio a las 11:00**.

*Finishing* dura 2 días y sigue a *Adjust elements*. Una tarea en días no empieza a mitad de un día, así que empieza el **jueves 10 de junio** y termina el viernes 11 de junio.

### Redondeo en la transición

Si omite *Adjust elements* y une *Finishing* directamente a *Place crane*, *Finishing* empieza el miércoles 9 de junio y termina el jueves 10 de junio. El resto del martes (4 horas laborables) no se puede usar. Esas 4 horas vuelven a aparecer como la holgura total de *Place crane*: medio día laborable.

Invierta el orden y es más sencillo. *Pour foundation* dura 2 días, del lunes 7 al martes 8 de junio. *Place crane* dura ahora 4 horas y sigue. Empieza el **miércoles 9 de junio a las 07:00** y termina a las 11:00.

### Un desfase en horas

Entre *Place crane* (12 horas) y *Adjust elements* (8 horas) pone un desfase de 2 horas. *Adjust elements* entonces no empieza a las 11:00, sino el martes a las **14:00**: 1 hora hasta la pausa y 1 hora después de ella. El fin se desplaza al **miércoles 9 de junio a las 14:00**.

Después de una tarea en días, un desfase funciona de otra manera. *Pour foundation* termina el martes 8 de junio. Sin desfase, *Finishing* empieza el miércoles 9 de junio. Con un desfase de 4 horas son medio día, y la aplicación lo redondea hacia arriba: *Finishing* empieza el **jueves 10 de junio**. Con un desfase de 1 hora, la aplicación redondea hacia abajo, y *Finishing* empieza simplemente el miércoles.

### Una tarde libre el viernes

Ahora el viernes tiene una sola banda, de 07:00 a 12:00: 5 horas. Los demás días siguen con 8 horas. El día laborable estándar sigue siendo de 8 horas, porque es el total diario más frecuente. Una semana tiene ahora 37 horas laborables.

Una tarea de 40 horas desde el lunes 7 de junio a las 07:00 ocupa del lunes al jueves (32 horas) y el viernes (5 horas). Las últimas 3 horas caen el lunes siguiente, de 07:00 a 10:00. El fin es el **lunes 14 de junio a las 10:00**. Una tarea de 5 días ocuparía 37 horas desde el lunes, y eso es lo que propone la aplicación si cambia la unidad de 5 días a horas.

En el tutorial 4, sobre planificación por horas, usted mismo planifica un trabajo de grúa en horas.

## Consecuencias y malentendidos

**«8 horas son 1 día.»** Solo si el calendario tiene días de 8 horas. En el calendario con la tarde libre del viernes, 5 días son 37 horas, no 40.

**«Si pongo más horas por día, mi tarea en días termina antes.»** No. Una tarea en días cuenta días laborables completos. Las horas por día solo cambian lo que vale un día en horas, por ejemplo en la visualización y en un desfase en horas. Solo en una tarea con recursos y con el tipo de tarea *Trabajo fijo* o *Unidades fijas* cambia la duración con ello, porque el trabajo sigue siendo el mismo: 40 horas de trabajo son 5 días a 8 horas por día y 7 días a 6 horas por día.

**«Una tarea de 8 horas dura un día.»** Solo si empieza al inicio del día. Si empieza más tarde, como *Adjust elements* el martes a las 11:00, continúa al día siguiente.

**Un calendario con bandas de horario laboral propias** se comporta de otra manera que el calendario estándar. Se obtiene un calendario así al definir horarios laborales por día de la semana o al elegir un preajuste de turnos (*2 turnos*, *3 turnos*, *Turno de noche* o *24/7*). En un calendario así, un desfase en horas se cuenta exactamente en horas laborables, también después de una tarea en días.

**Desactivar la planificación por horas** no borra nada. Las tareas horarias permanecen y siguen calculándose, pero no puede editarlas hasta que vuelva a activar la planificación por horas.

## Véase también

- [Activar la planificación por horas](docs://howto-urenplanning-aanzetten): los pasos para planificar una tarea en horas.
- [Configurar los horarios laborales](docs://howto-werktijden-instellen): cómo ajustar las bandas de horario laboral de un calendario.
- [Calendarios y días laborables](docs://uitleg-kalenders): cómo la aplicación cuenta los días laborables y qué calendario prevalece.
- [Añadir relaciones](docs://howto-relaties-leggen): los pasos para añadir una relación o un desfase.
