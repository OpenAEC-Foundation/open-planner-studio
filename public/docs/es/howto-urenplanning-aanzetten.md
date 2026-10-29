# Activar la planificación por horas

Objetivo: planificar tareas en horarios de trabajo, junto con las tareas en días.

## Cuándo lo necesita

Usted alquila una grúa por horas, no por días. Un vertido de seis horas no cabe en un día laborable completo. Una cuadrilla de noche trabaja en horarios distintos a la cuadrilla de día. Para este tipo de trabajo, quiere una duración en horas y un inicio y un fin con hora concreta. También la activa si abre un archivo y la aplicación muestra *Este archivo contiene planificación por horas.* Por qué la aplicación cuenta días y horas de forma distinta, puede leerlo en [Días y horas](docs://uitleg-dagen-en-uren).

## Pasos

### Activación de la planificación por horas

1. Elija *Configuración › Proyecto › Configuración* y abra la pestaña *Planificación*.
2. Debajo de *Planificación por horas*, marque *Activar planificación por horas*. Funciona de inmediato. En el mensaje *Este archivo contiene planificación por horas.* el botón *Activar planificación por horas* hace lo mismo.
3. Debajo está *Permitir planificación mixta de días/horas*, activada de forma predeterminada. Con esta opción, elija para cada tarea si cuenta en días o en horas. Si la desactiva, desaparece la lista *Unidad de duración*. Aun así, puede escribir una duración con unidad, por ejemplo `12h`.

Esto cambia más que la duración de una tarea: en *Vista › Escala de tiempo* puede elegir la escala *Hora*; en la ventana *Calendarios* un calendario normal puede recibir bandas de horario laboral (el bloque *Horarios de trabajo*; un calendario que ya tiene bandas siempre muestra ese bloque); y la ventana *Nuevo proyecto* recibe las opciones *Turno* y *Unidad predeterminada para tareas nuevas*.

### Planificar una tarea por horas

1. Seleccione la tarea y mire en el panel *Propiedades*, bajo *Tiempo*, el campo *Duración*.
2. Escriba la duración con una unidad y pulse Intro: `12h` (`12u`, la abreviatura neerlandesa, también funciona) para doce horas, `1h 30m` para una hora y media. `1.5h` también es correcto. Un número sin unidad cuenta en la unidad que la tarea ya tiene.
3. Si quiere convertir una tarea existente, elija la unidad *Horas* en *Unidad de duración*. La aplicación convierte la duración de inmediato, por ejemplo de `2` días a `16` horas. Para volver atrás, use *Deshacer*.
4. Volver a días es posible con `2d` o con la unidad *Días*.
5. Pulse **Calcular** (F5), por ejemplo mediante *Inicio › Programación › Calcular*. La tarea tiene ahora un inicio y un fin con hora concreta.
6. Si quiere ver las horas en el Gantt, elija la escala *Hora* en la lista bajo *Vista › Escala de tiempo*.

### Tareas nuevas por horas de forma predeterminada

1. Elija *Configuración › Proyecto › Ajustes del proyecto*.
2. Debajo de *Unidad predeterminada para tareas nuevas*, elija la unidad *Horas* y haga clic en *Aplicar*.

Una tarea nueva empieza entonces con 5 horas en lugar de 5 días. Las tareas existentes no cambian. Con un proyecto nuevo, la misma opción está en la ventana *Nuevo proyecto*. Si elige *Turno de día* en *Turno*, la opción *Horas* queda desactivada. Elija otro turno o establezca la unidad predeterminada después de crear el proyecto, en *Ajustes del proyecto*.

## Problemas y qué hace la aplicación en ese caso

**Sin horario laboral válido.** Si el calendario de la tarea no tiene horarios laborales utilizables, la aplicación muestra *Este calendario no tiene horarios de trabajo válidos. Comprueba sus días y horarios laborables.* Al calcular, puede aparecer el mensaje *La tarea horaria 'name' no tiene un horario laboral válido en su calendario*.

**No hay decimales con días.** Una duración en días es un número entero. `1.5d` muestra el mensaje *Introduzca un número entero de días u horas, por ejemplo 2d o 12h.* Si quiere un día y medio, calcule en horas.

**Una conversión que no puede ser exacta.** Doce horas no caben en días completos de 8 horas. En *Propiedades* y en *Editar tarea* la aplicación muestra entonces un bloque amarillo con *12h no equivale a días completos en este calendario. La unidad no ha cambiado.* y deja la unidad como está. La tabla de tareas muestra un mensaje más corto: *Esta duración no se puede convertir exactamente a la otra unidad.*

**El campo está desactivado.** Para una fase, una hamaca o un hito con duración cero, la duración depende de otro dato y no se puede escribir.

**Volver a desactivar la planificación por horas.** Las tareas horarias se conservan y siguen calculándose. Entonces no se puede editar su duración; el campo muestra *Activa la planificación por horas para editar esta tarea horaria.*, con un botón para volver a activarla.

## Véase también

- [Días y horas](docs://uitleg-dagen-en-uren): cómo cuenta la aplicación las horas, qué ocurre cuando se encuentran días y horas y dónde redondea.
- [Definir horarios laborales](docs://howto-werktijden-instellen): los horarios de un calendario por día de la semana.
- [Añadir relaciones](docs://howto-relaties-leggen): un desfase en horas entre dos tareas.
- [Configuración](docs://ref-instellingen): la opción Activar planificación por horas y qué más cambia.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contiene tareas por horas (rebar fixing and pouring) con un calendario por horas propio, *Hourly calendar, rebar fixing & pouring*.
