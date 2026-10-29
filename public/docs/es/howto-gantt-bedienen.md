# Arrastrar, desplazar y hacer zoom en el Gantt

Objetivo: manejar la línea de tiempo con el ratón. Mueva una barra o ajuste su duración, desplace la línea de tiempo, seleccione tareas con un recuadro y haga zoom para acercar o alejar.

## Cuándo lo necesita

Ve en el Gantt que la mampostería debe empezar dos días más tarde, o que el hormigonado dura un día más. Quiere cambiarlo directamente en la barra. O tiene un proyecto de meses y quiere desplazarse rápido hasta el festivo de obra. El ratón tiene algunos gestos para eso. Qué gesto hace qué depende de dónde empieza a arrastrar y de su configuración de desplazamiento.

## Pasos

### Mover una barra

1. Pulse en el centro de una barra de tarea y arrástrela en horizontal. El inicio y el fin se mueven juntos, en días enteros. La duración no cambia.
2. Suelte el botón. La barra se queda en su nueva posición. La planificación queda entonces desactualizada. Pulse *Calcular* (F5), o, si *Calcular automáticamente* está activado, la aplicación lo hace sola.

Si la tarea tiene un predecesor, la aplicación registra el nuevo inicio como la restricción *No comenzar antes del (SNET)*. Lo indica después de soltar. Por qué ocurre eso, y qué pasa con otra restricción, está en [Restricciones y fechas límite](docs://uitleg-constraints). Si arrastra de nuevo hasta el inicio original, también vuelve la restricción original.

Si arrastra sobre todo hacia arriba o hacia abajo, en lugar de hacia los lados, mueve la tarea a otra fila y las fechas no cambian. La dirección que elige en los primeros píxeles vale para todo el arrastre. Así, un solo gesto nunca cambia fechas y estructura al mismo tiempo. Vea [Ajustar la estructura](docs://howto-structuur-aanpassen).

### Ajustar la duración

1. Mueva el ratón al borde derecho de la barra. El cursor se convierte en una flecha que apunta a la izquierda y a la derecha.
2. Arrastre el borde. Mientras arrastra, una pequeña etiqueta del color de acento del tema (naranja de forma predeterminada) muestra la duración que tendría la tarea ahora, por ejemplo *4d*. Se actualiza en directo, así que ve la nueva duración antes de soltar. En el borde derecho, la etiqueta queda dentro de la barra. En el borde izquierdo, queda justo a la izquierda de ella. La etiqueta muestra la duración como la muestra la columna de duración.
3. Suelte el botón. La duración es la que mostraba la etiqueta.

El borde izquierdo mueve el inicio y deja el fin. Así, la tarea se acorta o se alarga por delante. Se aplica la misma regla de SNET que al mover. Al arrastrar el centro de la barra, la etiqueta no aparece: la duración no cambia.

La duración cuenta los días laborables del calendario de la tarea. Los fines de semana y los días no laborables no cuentan. Una tarea en días no puede acortarse a menos de un día laborable. Para una tarea en horas, la aplicación redondea al paso de la escala de tiempo bajo el ratón: al menos una hora, o un cuarto de hora si amplía lo suficiente y *Mostrar cuartos de hora al ampliar al máximo* está activado.

Un arrastre equivale a un solo paso de *Deshacer*, por largo que sea. En una barra de tarea dividida, los bordes funcionan de otra manera; vea [Dividir una tarea](docs://howto-taak-splitsen).

### Desplazar la línea de tiempo

Lo que hace un arrastre sobre el fondo vacío depende de su modo de desplazamiento. Lo elige en *Configuración*, pestaña *Apariencia*, en *Gantt › Desplazamiento y zoom*, en *Modo*:

- **Zoom + arrastrar** (predeterminado): si arrastra sobre el fondo vacío con el botón izquierdo del ratón, la línea de tiempo se mueve con el ratón, como un mapa. El cursor es una mano. Sobre una barra, un arrastre simplemente inicia un gesto de barra.
- **Posición** y **Teclas**: el mismo arrastre hace un recuadro de selección. Desplaza la línea de tiempo con la rueda (vea [Configuración](docs://ref-instellingen)) o con el botón central del ratón.

**El botón central del ratón** (la rueda pulsada) desplaza la línea de tiempo en todos los modos, también si empieza sobre una barra. No funciona mientras otro gesto está en curso, como arrastrar una barra.

### Seleccionar tareas con un recuadro

Un recuadro selecciona todas las tareas de las filas que toca. Solo cuenta la altura del recuadro, no la escala de tiempo.

1. Empiece sobre el fondo vacío. Con *Zoom + arrastrar* mantenga pulsada la tecla Ctrl (⌘ en un Mac) mientras lo hace. Con *Posición* y *Teclas* no hace falta.
2. Arrastre sobre las filas que quiere seleccionar. La selección recibe un marco.
3. Suelte el botón. Si pulsa Esc mientras arrastra, cancela el recuadro y la selección queda como estaba.

Más sobre seleccionar está en [Seleccionar, eliminar y deshacer tareas](docs://howto-taken-selecteren-verwijderen). En el espacio vacío de la propia tabla de tareas, arrastrar no hace nada.

### Acercar y alejar

1. Utilice *Zoom +* y *Zoom -* (*Inicio › Zoom*), o las teclas + y -. La rueda también hace zoom. Cuándo lo hace depende de su modo de desplazamiento (vea [Configuración](docs://ref-instellingen)).
2. Si quiere ver todo el proyecto, elija *Vista › Escala de tiempo › Ajustar al proyecto* o pulse Ctrl+0. *Restablecer* (en la pestaña *Vista*) o la tecla 0 devuelve el zoom al valor predeterminado.
3. En la esquina inferior derecha de la barra de estado aparece el zoom en píxeles por día, por ejemplo *Zoom: 15px/día*.

Cuanto más aleja la vista, menos líneas de cuadrícula hay. A partir de 8 píxeles por día o más, hay una línea por cada día, con una línea más gruesa en el límite de semana. Entre 2 y 8 píxeles por día solo queda el límite de semana. Por debajo de 2 píxeles por día, a nivel de año, solo quedan los límites de mes. Si no, el lienzo sería un patrón de rayas uniforme en el que las barras desaparecen. Los fines de semana y los días no laborables son grises. Las franjas de semana alternan su color. Se mantienen en todos los niveles y llevan la estructura semanal cuando desaparecen las líneas. En el encabezado de la escala de tiempo, los números de semana y de día solo aparecen cuando hay sitio. Desde 40 píxeles por día, también se muestra el día de la semana delante del número.

El nombre de la tarea se muestra en la barra si cabe completo. Si no cabe, por ejemplo al alejar la vista, el nombre completo aparece a la derecha de la barra.

### Ver los detalles de una tarea

Mantenga el ratón quieto sobre una barra. Aparece una pequeña tarjeta con el nombre de la tarea, *WBS*, *Duración*, *Inicio*, *Fin*, *Estado*, *Crítica* y *Holgura total*. Mientras arrastra, desplaza la vista, usa un recuadro de selección o abre un menú contextual, la tarjeta desaparece.

## Problemas frecuentes y qué hace entonces la aplicación

**El inicio no se mueve.** Si la tarea tiene un predecesor y una restricción distinta de SNET, por ejemplo *Lo más tarde posible (ALAP)*, la aplicación no aplica el inicio arrastrado. Al soltar, la aplicación indica qué restricción retiene el inicio. Cambie esa restricción para mover el inicio. El borde derecho sí funciona, porque solo cambia la duración.

**El gesto hace otra cosa.** En el modo de relación y en el modo de dividir tarea, los gestos sobre la barra hacen algo distinto. Esc detiene esos modos. Si mantiene pulsada Shift mientras arrastra desde una barra, crea una relación en lugar de mover la barra. Vea [Añadir relaciones](docs://howto-relaties-leggen).

**En el modo *Posición* o *Teclas* el botón izquierdo del ratón no desplaza.** Entonces ve un cursor normal en lugar de una mano. Use la rueda o el botón central del ratón, o ponga el modo en *Zoom + arrastrar*.

**Un clic en una pausa de una barra dividida** selecciona la tarea y no inicia ningún arrastre ni recuadro.

## Véase también

- [Menús contextuales](docs://ref-contextmenus): los menús de una barra, una fila y un encabezado de grupo.
- [Atajos de teclado](docs://ref-sneltoetsen): las teclas para hacer zoom y para cancelar un gesto.
- [Configuración](docs://ref-instellingen): el modo de desplazamiento y la escala de tiempo.
- [Restricciones y fechas límite](docs://uitleg-constraints): por qué un inicio movido se convierte en restricción.
