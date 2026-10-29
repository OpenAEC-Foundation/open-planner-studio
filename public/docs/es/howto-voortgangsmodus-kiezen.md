# Elegir el modo de progreso

Objetivo: decidir cómo la aplicación planifica el trabajo restante de una tarea que ya ha empezado mientras su predecesor sigue en curso: según la relación (Retained Logic) o según lo que realmente ocurre (Progress Override).

## Cuándo lo necesita

En obra, la ejecución suele ir por delante de la lógica. El pintor ya empieza en las habitaciones que están enlucidas, mientras el yesero sigue ocupado en otra parte. En la planificación, eso es por ejemplo una relación fin-comienzo cuyo sucesor empieza antes de que termine el predecesor. La aplicación lo llama **avance fuera de secuencia**. Si la barra de estado muestra *N relación(es) fuera de secuencia*, existe un caso así, y el modo de progreso decide cómo la aplicación planifica el trabajo restante del sucesor. Lo que hacen los dos modos, con un ejemplo práctico, está en [Avance, fecha de estado y línea base](docs://uitleg-voortgang).

## Pasos

1. Actualice el avance y fije la fecha de estado, como se describe en [Actualizar el avance](docs://howto-voortgang-bijwerken).
2. Vaya a *Planificación › Líneas base y progreso › Modo de progreso* y abra la lista.
3. Elija *Retained Logic* o *Progress Override*.
4. Pulse **Calcular** (F5), por ejemplo mediante *Planificación › Programación › Calcular*. La elección deja la planificación desactualizada: la barra de estado muestra *Desactualizado — recalcula (F5)*. Si *Calcular automáticamente* está activado, la aplicación lo hace por sí misma.

¿Cómo elige?

- **Retained Logic** es el predeterminado. La relación sigue vigente: el trabajo restante del sucesor solo empieza cuando el predecesor ha terminado. Elija esta opción si el orden es realmente fijo, o si quiere planificar con prudencia.
- **Progress Override** deja que mande la realidad. El trabajo restante del sucesor empieza en la fecha de estado, sin esperar al predecesor. Elija esta opción si el sucesor realmente sigue trabajando y la fecha de fin no debe depender de un predecesor que todavía está en curso.

## Comprobar el resultado

- Haga clic en el mensaje *N relación(es) fuera de secuencia* de la barra de estado. Se abre el panel *Advertencias*, al que también se llega mediante *Planificación › Programación › Advertencias*. Cada relación aparece en él con el texto *Fuera de secuencia: el progreso del sucesor contradice la relación*, por ejemplo *4.2 Plastering → 4.5 Painting (FS)*.
- Mire la barra del sucesor. Con Retained Logic, la barra sigue hasta después del fin de su predecesor. Con Progress Override, la barra termina antes. En el ejemplo de la explicación, son el martes 27 de julio frente al jueves 22 de julio.

## Errores frecuentes y qué hace la aplicación

**Sin diferencia.** El modo solo tiene efecto en las tareas que ya han empezado mientras su predecesor todavía no ha terminado. Sin una tarea así, no cambia nada.

**El mensaje sigue.** Progress Override no resuelve el mensaje de fuera de secuencia. El modo decide cómo calcula la aplicación; la contradicción entre relación y avance sigue existiendo. Si la relación ya no es correcta, cámbiela ([Añadir relaciones](docs://howto-relaties-leggen)).

**Pertenece al proyecto.** La elección se guarda con el archivo del proyecto, se aplica a todo el proyecto y se puede deshacer con Ctrl+Z. Un proyecto nuevo está en Retained Logic.

**Un archivo P6.** Si abre un archivo de Primavera P6 (.xer), la aplicación toma el modo del archivo. Además de Retained Logic y Progress Override, P6 también tiene Actual Dates. La aplicación no conoce ese tercer modo; un archivo así se calcula como Retained Logic. El mensaje de importación cuenta eso como *1 ajuste de planificación P6 usó una alternativa segura.*

**El perfil de cálculo.** En el perfil de Primavera P6, Progress Override también actúa hacia atrás, en las fechas tardías y en la holgura libre del predecesor (convención *Progress Override ignora también hacia atrás un sucesor iniciado*). En los perfiles de Open Planner Studio y de Microsoft Project, eso no es así. Las convenciones están en *Configuración › Proyecto › Ajustes del proyecto*, en el bloque *Perfil de cálculo y opciones*. En el ejemplo de la explicación no se ve ese efecto hacia atrás.

## Véase también

- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): la diferencia entre los dos modos, con cifras.
- [Actualizar el avance](docs://howto-voortgang-bijwerken): cómo introducir el avance sobre el que actúa el modo.
- [Añadir relaciones](docs://howto-relaties-leggen): cómo cambiar una relación que ya no es correcta.
