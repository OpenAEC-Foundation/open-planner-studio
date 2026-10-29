# Presentar en una pantalla grande

Objetivo: mostrar el Gantt a pantalla completa, sin cinta ni paneles, por ejemplo en un proyector o televisor en la reunión de obra.

## Cuándo lo necesita

Diez personas miran una sola pantalla en la caseta de obra. La cinta, la barra de estado y el panel de propiedades ocupan entonces espacio que la planificación necesita, y distraen. En el **modo de presentación** la aplicación mantiene solo la tabla de tareas y el Gantt, en toda la pantalla.

## Pasos

### Preparar la vista

En el modo de presentación la cinta no aparece, así que prepare antes lo que quiere mostrar.

1. Pulse **Calcular** (F5), para que las fechas mostradas sean correctas.
2. Configure la vista que quiere mostrar, por ejemplo un diseño que muestre solo las tareas críticas (véase [Crear y usar un diseño](docs://howto-layouts-gebruiken)).
3. Elija una escala de tiempo y un zoom con los que los nombres de las tareas se puedan leer desde lejos, y contraiga o expanda las fases con *Contraer* y *Expandir* en el grupo *Esquema* de la ficha *Vista*.
4. Si quiere usarlos, active *Vista dividida* y *Minimapa* (véase [Usar la vista dividida y el minimapa](docs://howto-split-view-en-mini-map)).

### Iniciar la presentación

Elija *Vista › Presentación › Presentación*. En la aplicación de escritorio también puede pulsar F11. En el navegador, F11 lo usa el propio navegador: pone la ventana del navegador en pantalla completa y deja la aplicación como está. Desaparecen la cinta, las fichas, la barra de estado y el panel de la derecha. Ve la tabla de tareas, el Gantt y, si los activó, el histograma y el minimapa. Durante unos segundos, en la parte inferior aparece el texto *Pulse Esc o F11 para salir de pantalla completa.*

En la aplicación de escritorio puede iniciar la presentación desde cualquier ficha con F11, también desde *Tabla* o *Informe*. En el navegador solo la inicia con *Vista › Presentación › Presentación*. Siempre ve el Gantt del proyecto abierto, y al detenerla vuelve a la ficha desde la que empezó. En el navegador, por tanto, esa ficha es *Vista*.

### Detener la presentación

Pulse Esc o F11. Vuelven a aparecer la cinta y los paneles en la ficha desde la que empezó.

## Problemas posibles y qué hace la aplicación

**Todavía puede editar en el modo de presentación.** Hacer clic, arrastrar, editar celdas y pulsar la tecla Supr siguen funcionando. Si arrastra una barra por error, se mueve y la planificación queda desactualizada. Una tarea que borra por error la recupera con Ctrl+Z, también en el modo de presentación. Por eso haga clic con cuidado cuando trabaje con un grupo.

**Las notificaciones siguen visibles.** Un mensaje de la aplicación, por ejemplo un error al guardar, también aparece en el modo de presentación. En ese modo no hay cinta ni barra de estado, así que ese mensaje es la única señal de que algo va mal.

**Configure antes la vista dividida, el minimapa y los diseños.** Para ello necesita la cinta, y en este modo no aparece. El zoom sí funciona, con la rueda del ratón o con Ctrl+= y Ctrl+-. + y - también funcionan, pero solo cuando el foco está en el Gantt. Después de iniciarla, el foco suele estar en la tabla de tareas, así que primero haga clic en el Gantt.

**La pantalla completa no funciona.** Además de ocultar la cinta, la aplicación también pide de verdad la pantalla completa. Si su navegador o ventana lo rechaza, solo desaparecen la cinta y los paneles. La presentación sigue funcionando. Si sale de la pantalla completa de otra forma que con Esc o F11, por ejemplo con una tecla de su sistema operativo, el modo de presentación también se detiene.

**El modo de presentación no se recuerda.** Después de cerrar y volver a abrir la aplicación, está desactivado.

## Véase también

- [Usar la vista dividida y el minimapa](docs://howto-split-view-en-mini-map): dos ventanas de tiempo o una franja de vista general durante la presentación.
- [Crear y usar un diseño](docs://howto-layouts-gebruiken): configurar con un solo clic la vista que quiere mostrar.
- [Atajos de teclado](docs://ref-sneltoetsen): F11 y las demás teclas.
