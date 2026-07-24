# Informes e impresión

Una planificación no está terminada hasta que puede compartirla — en papel para una reunión de obra, como
imagen en una presentación, o como resumen de lo que se avecina y de lo que ya se ha desplazado. Para eso está la
pestaña **Informe**, con tres tipos de informe y una vista previa de impresión.

## Lo que aprenderá aquí

- Los tres tipos de informe en la pestaña **Informe**: impresión de Gantt, resumen de hitos, desviación.
- Cómo funciona la vista previa de impresión: tamaño de papel, orientación y qué elementos activa/desactiva.
- Cómo imprimir realmente un informe o guardarlo como archivo.
- Qué hace **Ctrl+P** en esta aplicación.

## Llegar a la pantalla de informe

Hay tres formas de llegar a la misma pantalla: haga clic en la pestaña de la cinta **Informe**, vaya a
**Backstage → Imprimir** (que abre directamente la pantalla de informe), o pulse **Ctrl+P**. Las tres llevan
al mismo sitio — no hay un diálogo de "imprimir" aparte; la pantalla de informe *es* la vista previa de impresión.

La pantalla se divide en dos columnas: un panel de configuración a la izquierda con el selector de **Tipo de informe**
arriba, y una vista previa en vivo a la derecha que se actualiza de inmediato al cambiar la configuración de la
izquierda.

## Los tres tipos de informe

### Diagrama de Gantt

Una impresión completa y formateada de las barras del Gantt — este es el único tipo de informe con un bloque de configuración:

- **Papel**: A4, A3 o A1.
- **Orientación**: horizontal o vertical.
- **Ajuste automático al papel** (activado = la planificación se escala automáticamente al tamaño elegido) o un
  control deslizante manual de **zoom** si desactiva el ajuste automático.
- Interruptores para **nombres de tarea en las barras**, **mostrar avance**, **ruta crítica**, **mostrar holgura**,
  **dependencias**, **fines de semana** y **leyenda**.
- Un campo de **empresa** (se rellena automáticamente desde el ajuste del proyecto, pero es editable aquí por separado) y el
  **autor** (solo lectura, desde la información del proyecto).

El bloque de resumen encima muestra el recuento en vivo de tareas, tareas hoja, tareas críticas y relaciones
en el proyecto.

### Resumen de hitos

Una tabla de cada hito del proyecto: WBS, nombre, tipo (automático/comienzo/fin), fecha, la
restricción o fecha límite subyacente, holgura, si el hito es obligatorio, y estado (en
plazo / crítico / retrasado). El bloque de resumen muestra el número total de hitos, cuántos son
obligatorios y cuántos están retrasados. Este informe no tiene configuración de tamaño de papel/orientación — imprime
la tabla exactamente como se muestra.

### Variance

Compara la planificación actual con la baseline activa: inicio/fin de la baseline frente al inicio/fin
actual, la diferencia en días laborables para el inicio y el fin, y un estado por tarea (en
plazo / retrasada / anticipada / nueva / eliminada). Si no hay ninguna baseline activa, la pantalla lo indica
explícitamente en lugar de mostrar un informe vacío. El bloque de resumen también muestra el desplazamiento de la
fecha de fin del proyecto en días laborables, si lo hay. Vea la guía
[Baselines y progreso](docs://gids-baselines-voortgang) para saber cómo registrar una baseline antes de que este
informe pueda decirle algo útil.

## Imprimir y exportar

El panel de configuración siempre tiene un botón **Imprimir...** al pie — abre una ventana de impresión aparte
que contiene el informe y activa de inmediato el diálogo de impresión del navegador/sistema operativo. Para el informe de Gantt,
esa ventana usa el tamaño de papel y la orientación elegidos; los informes de hitos y de desviación imprimen la
tabla tal como se muestra.

Solo el informe de Gantt tiene también un botón **Exportar PDF**. Eso guarda la vista previa actual como un
archivo PDF real (nombre de archivo terminado en `-planning.pdf`) — una página con el tamaño ajustado a las dimensiones
físicas del tamaño de papel y la orientación elegidos. El archivo PDF es **vectorial**: las barras, líneas y texto
se guardan como instrucciones de dibujo PDF en lugar de una única imagen incrustada, así que se mantiene nítido a
cualquier nivel de zoom y el texto es seleccionable y buscable en cualquier visor de PDF. Esto se aplica al texto en
latín, cirílico y griego; si el proyecto contiene texto en chino, japonés, coreano, árabe o persa,
la exportación recurre automáticamente a una imagen rasterizada para ese texto — que sigue mostrándose correctamente,
pero no es seleccionable ni buscable. Útil para correo electrónico o archivado sin pasar por el diálogo de impresión
del sistema. Si prefiere imprimir directamente (o guardar como PDF mediante el diálogo del sistema, por ejemplo para elegir
un tamaño de papel distinto al configurado arriba), use **Imprimir...**.

## Los informes en la práctica

Cada tipo de informe sirve para una conversación distinta:

- El **informe de Gantt** es el clásico documento para repartir en una reunión de obra: la ruta crítica resaltada, la holgura
  visible en las barras no críticas, y la leyenda que explica qué significa cada color. Active
  **nombres de tarea en las barras** y **mostrar avance** si la audiencia no conoce ya la planificación;
  desactívelos para una vista limpia en A1 si se reparte una lista de tareas aparte junto con él.
- El **resumen de hitos** es para quien solo quiere las fechas importantes sin pasar por decenas de filas de tareas — por ejemplo un cliente que principalmente quiere saber si se están cumpliendo las
  fechas de entrega obligatorias. El símbolo ◆ delante del nombre de un hito en la tabla marca un hito
  **obligatorio**.
- El **informe de desviación** es la conversación sobre corregir el rumbo: qué tareas se están retrasando
  respecto a la baseline, y en cuántos días laborables. Vea este informe en la práctica en el ejemplo
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), que tiene
  dos baselines (una baseline de contrato y una nueva baseline tras una orden de cambio) con su propio progreso
  y fecha de estado — un buen ejemplo de cómo se rellenan las columnas Δ en cuanto hay una diferencia real
  entre la baseline y la planificación actual.

La vista previa en vivo a la derecha se actualiza con cada cambio en la configuración de la izquierda — no hay un
botón "actualizar" aparte, y nada se calcula solo en el momento de imprimir.

## Siga leyendo

- Un informe de desviación no tiene nada que comparar hasta que se haya registrado una baseline — lea la guía
  [Baselines y progreso](docs://gids-baselines-voortgang).
- La ruta crítica y la holgura mostradas en el informe de Gantt provienen del mismo cálculo que la propia vista
  de Gantt — lea la guía [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse)
  para saber cómo interpretarlo.
