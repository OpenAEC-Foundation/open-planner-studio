# Trabajar con varios proyectos a la vez

Objetivo: tener abierta más de una planificación, cambiar entre ellas y cerrarlas por separado.

## Cuándo lo necesita

Usted trabaja en el desarrollo de viviendas del barrio, pero la reunión de obra también trata de la renovación de la casa club. O quiere guardar una variante junto al original. Cada proyecto está en su propia pestaña, con sus propias tareas, cálculo y periodo de tiempo. Cambiar de proyecto requiere un solo clic. Usted no pierde nada.

## Pasos

### Abrir un segundo proyecto

1. Haga clic en el signo más a la derecha de las pestañas (*Iniciar un proyecto*). Se abre la ventana *Iniciar un proyecto*.
2. Elija *Nuevo proyecto* para una planificación vacía, o *Abrir proyecto existente* para elegir un archivo. *Cancelar* cierra la ventana.
3. Con *Nuevo proyecto*, rellene la ventana *Nuevo proyecto* y haga clic en *Crear*.

El proyecto aparece en su propia pestaña y queda activo de inmediato. *Nuevo* y *Abrir* en la cinta, Ctrl+O y los ejemplos en *Archivo › Ejemplos* también abren un proyecto en una pestaña nueva. Solo se reutiliza una planificación nueva y vacía que usted aún no ha modificado, en lugar de añadir una pestaña.

### Cambiar entre proyectos

- Haga clic en la pestaña del proyecto.
- Pulse Ctrl+1 a Ctrl+9 (⌘ en lugar de Ctrl en macOS) para ir al proyecto en ese lugar de la fila, contado de izquierda a derecha.
- Haga clic en el icono de menú a la izquierda de las pestañas (*Todos los proyectos*). La vista general *Proyectos abiertos* muestra una tarjeta por proyecto, con su nombre, el nombre del archivo (si el proyecto tiene archivo), una miniatura de la planificación, el número de tareas, el número de tareas críticas y la fecha de fin. Haga clic en una tarjeta para ir allí. Esc cierra la vista general.

Cada pestaña tiene un punto de color que pertenece al proyecto. Una pestaña con un punto pequeño detrás tiene cambios sin guardar.

Si las pestañas no caben todas en el ancho, aparecen dos flechas entre las pestañas y el signo más (*Desplazar las pestañas hacia el inicio* y *Desplazar las pestañas hacia el final*). Cada clic desplaza las pestañas dos posiciones. Una flecha se ve gris cuando ya está al inicio o al final. También puede desplazarse con la rueda del ratón sobre las pestañas. La pestaña que elija siempre se desplaza sola a la vista.

### Cerrar un proyecto

Haga clic en la cruz junto al nombre de la pestaña (*Cerrar*), o en la cruz de una tarjeta de la vista general. Un proyecto sin cambios se cierra de inmediato. Si tiene cambios sin guardar, la aplicación muestra la ventana *Cambios sin guardar* con tres opciones:

- *Guardar* guarda el proyecto y después lo cierra.
- *No guardar* cierra el proyecto y descarta los cambios.
- *Cancelar* deja el proyecto abierto.

Si cancela el guardado, por ejemplo al cerrar la ventana de guardar, el proyecto sigue abierto.

Si cierra el último proyecto, queda una planificación vacía llamada *Nueva planificación*.

### Elegir el estilo de cambio

Usted puede elegir cómo se muestran los proyectos. Abra la ventana *Configuración* con el engranaje de la barra de título, vaya a la pestaña *Apariencia* y elija en *Estilo de cambio de documento*:

- *Pestañas horizontales*: la opción predeterminada. Una fila de pestañas debajo de la cinta.
- *Pestañas verticales*: una franja estrecha a la izquierda, con un botón por proyecto (las primeras letras del nombre) y un signo más. Si pasa el puntero sobre un botón, ve el nombre, el nombre del archivo, el número de tareas, el número de tareas críticas y la fecha de fin. El botón de arriba abre la vista general.
- *Píldora*: una píldora en la barra de título con el nombre del proyecto activo y un contador, por ejemplo *2 abiertos*. Haga clic en ella para abrir la vista general y cambiar allí.

Los tres estilos abren la misma vista general, y Ctrl+1 a Ctrl+9 funciona en todos los estilos.

## Puntos de atención y lo que hace la aplicación

**Qué pertenece al proyecto y qué es compartido.** Cada proyecto tiene su propia vista: ampliación y posición, un diseño activo con filtro, agrupación u ordenación, vista dividida, las líneas de relación y las fases contraídas. Si cambia a otro proyecto, ve allí su propia vista. Son compartidos por todos los proyectos: la pestaña seleccionada en la cinta, el minimapa, las superposiciones (superposición de la línea base, línea de progreso y lo demás), su elección de columnas, sus diseños y las opciones de informe.

**No puede cambiar con una ventana abierta.** Mientras haya una ventana abierta, por ejemplo la ventana *Configuración* o la ventana de una tarea, Ctrl+1 a Ctrl+9 no hacen nada en la aplicación. En el navegador, en cambio, cambian las pestañas del navegador. Cierre primero la ventana. Un cambio sin aplicar en *Ajustes del proyecto* en Backstage también bloquea el cambio de proyecto.

**Ctrl+1 a Ctrl+9 se cuentan por orden.** El atajo va al proyecto en ese lugar de la fila. Si cierra un proyecto, los demás lugares suben. Si tiene más de nueve proyectos abiertos, llega a los demás solo por las pestañas o la vista general.

**Calcular e Informe actúan sobre el proyecto activo.** Calcular (F5), *Exportar PDF* y los informes se refieren al proyecto que está activo ahora.

## Véase también

- [Crear y usar un diseño](docs://howto-layouts-gebruiken): configurar una vista por proyecto.
- [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken): el informe del proyecto activo.
