# Desplazar un proyecto

Objetivo: desplazar toda la planificación a una nueva fecha de inicio, y ver antes cómo afecta al fin.

## Cuándo lo necesita

El inicio de la obra cambia: el permiso llega más tarde, o reutiliza la planificación de una casa anterior para la siguiente. Mover cada tarea una por una exige mucho trabajo. Con **Mover proyecto** introduce una nueva fecha de inicio y la aplicación desplaza todo lo demás.

El fin del proyecto no siempre se desplaza lo mismo que el inicio. El **calendario** no se desplaza: los festivos, las vacaciones de construcción y la parada de invierno caen en fechas fijas. Un ejemplo: con *Inicio › Archivo › Nuevo* crea un proyecto con *Fecha de inicio* 29-09-2026, *País* en *Países Bajos* y *Vacaciones de construcción* en *Ninguna*, y añade una planificación de 30 días laborables que termina el 9 de noviembre de 2026. Si lo desplaza al 14 de diciembre de 2026, 76 días naturales más tarde, termina el 26 de enero de 2027. Eso son 78 días más tarde, porque el 25 de diciembre y el 1 de enero ahora son días no laborables dentro de su planificación. La duración sigue siendo de 30 días laborables. La vista previa en la ventana muestra esto antes de cambiar nada.

## Pasos

1. Elija *Planificación › Programación › Mover proyecto…*. El botón está desactivado mientras el proyecto no tenga fecha de inicio.
2. En *Inicio actual del proyecto* vea dónde empieza el proyecto ahora, y en *Nuevo inicio del proyecto* elija la nueva fecha.
3. Si el proyecto tiene líneas base, aparece la casilla *Desplazar también las líneas base*. Déjela desactivada si quiere seguir viendo el desplazamiento como variación (véanse los errores frecuentes).
4. Haga clic en *Calcular vista previa*. La aplicación calcula la planificación desplazada por completo, sin cambiar nada en su proyecto.
5. Mire la vista previa (véase abajo). Si es correcta, haga clic en *Mover*.

En la vista previa ve:

- el desplazamiento en días naturales (*Desplazamiento: 76 días naturales más tarde*);
- *Inicio del proyecto* y *Fin del proyecto*, de antes a después;
- una advertencia roja si el calendario interfiere, o el mensaje de que la duración del proyecto no cambia;
- el número de tareas desplazadas y qué más se desplaza;
- advertencias que debe leer (véanse los errores frecuentes).

La aplicación calcula la nueva planificación de inmediato, así que no necesita usar **Calcular** (F5), y ajusta la vista a todo el proyecto. Todo ello es un solo paso para *Deshacer* (Ctrl+Z).

El botón *Mover* solo funciona después de una vista previa sin error, y si la nueva fecha es distinta de la actual. Si cambia la fecha o la casilla, la vista previa desaparece; recalcule.

### Qué se desplaza y qué no

Se desplazan: el inicio y el fin de cada tarea, el inicio real y el fin real, las fechas de las restricciones (también de un anclaje rígido Mandatory, véase [Restricciones y fechas límite](docs://uitleg-constraints)), las fechas límite, la fecha de estado, los anclajes de las relaciones externas y los pasos de disponibilidad de los recursos. El inicio del proyecto y, si lo ha rellenado, la fecha de fin del proyecto también se desplazan.

No se desplaza:

- los calendarios, así que los festivos, las vacaciones de construcción y la parada de invierno;
- las líneas base, salvo que active *Desplazar también las líneas base*;
- un campo personalizado con valor del tipo *Fecha*.

## Errores frecuentes y lo que hace la aplicación

**El fin se desplaza un número distinto de días.** Si la vista previa detecta que el fin se desplaza más o menos días naturales que el inicio, o que la duración del proyecto en días laborables cambia, muestra una advertencia roja con los números. Aun así, puede cancelar.

**Las líneas base se quedan donde están.** Una línea base existe para medir la variación. Si desplaza el proyecto con la casilla desactivada, ve el desplazamiento como variación respecto a la línea base. Si activa la casilla, las líneas base se desplazan con la planificación. Solo se desplazan sus fechas; la fecha en que se guardó la línea base no cambia.

**Un proyecto en curso.** Las fechas reales también se desplazan. En un proyecto en el que ya ha introducido avances, eso no siempre es lo que quiere. La aplicación avisa: *Compruebe si eso es correcto para un proyecto en curso.*

**Relaciones externas.** El anclaje en su propio proyecto se desplaza, el proyecto de origen no. Actualice las relaciones después de desplazar el proyecto con *Inicio › Tareas › Vincular ▾ › Actualizar todas las relaciones externas*. Véase [Relaciones externas con otro proyecto](docs://howto-externe-relaties).

**Festivos que no llegan lo bastante lejos.** Un calendario con festivos generados cubre varios años. Si la planificación desplazada va más allá, la aplicación calcula ese año sin festivos. La vista previa lo avisa, por ejemplo: *Los festivos generados del calendario «Bouwkalender NL» cubren 2025–2029; la planificación desplazada llega hasta 2030. Vuelva a generar los festivos.* Desplace primero el proyecto. Después abra *Planificación › Calendario › Calendario*: junto a los festivos ahora aparece *Regenerar*. Confirme con *Aplicar* y la aplicación recalcula. El intervalo de los nuevos festivos sigue las fechas del proyecto, así que regenerar antes de desplazar no sirve de nada.

**La fecha está en el pasado.** Eso está permitido, pero la vista previa lo menciona: *La nueva fecha de inicio está en el pasado.*

**Cambiar el inicio del proyecto en los ajustes del proyecto es otra cosa.** Si cambia la fecha de inicio en *Configuración › Proyecto › Ajustes del proyecto* y elija *Aplicar*, la planificación no se desplaza. Solo las tareas sin predecesor ni restricción que quedarían antes del nuevo inicio se desplazan a esa fecha, y la aplicación indica cuántas son. Si quiere desplazar todo, use *Mover proyecto…*.

## Véase también

- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): cómo calcula la planificación y por qué se desplaza el fin.
- [Añadir relaciones](docs://howto-relaties-leggen): las relaciones simplemente se quedan donde están al desplazar el proyecto.
- [Nuevo proyecto e info del proyecto](docs://ref-projectinfo): qué hace la fecha de inicio en los ajustes del proyecto.
