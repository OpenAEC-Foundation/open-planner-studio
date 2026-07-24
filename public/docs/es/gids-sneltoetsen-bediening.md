# Atajos de teclado y manejo

Esta guía no enumera atajos de teclado — esa lista ya vive en un único sitio, y una copia aquí
quedaría obsoleta de inmediato. En su lugar, esto explica **cómo consultar siempre la lista actual**, y
qué conceptos de manejo (menús contextuales, arrastrar, selección por rectángulo frente a desplazamiento panorámico, zoom) vale la pena
entender por sí mismos.

## Lo que aprenderá aquí

- Cómo abrir el resumen de atajos siempre actualizado.
- Qué contiene cada uno de los cuatro menús contextuales en la vista de Gantt.
- Cómo funciona el arrastre: mover una barra frente a dibujar una relación.
- Cuándo un arrastre en el lienzo vacío desplaza la vista (pan), y cuándo selecciona por rectángulo.
- Zoom, pestañas de documento y modo presentación.
- Cómo reiniciar el recorrido.

## El resumen siempre actualizado

Pulse **Ctrl+/** (o **Cmd+/** en macOS) para abrir el resumen de atajos — la misma ventana también es
accesible mediante el botón **Atajos** en la pestaña de la cinta **Vista**. Esta ventana es de solo lectura y está
construida directamente a partir del código fuente de la aplicación: un nuevo atajo aparece aquí automáticamente, sin
que nadie tenga que mantener una lista aparte sincronizada. Por eso exactamente esta guía no duplica la lista —
una segunda lista mantenida a mano tarde o temprano se desviaría de lo que realmente hace la aplicación. La
ventana agrupa los atajos por categoría: Archivo, Editar, Estructura, Vista y Navegación.

## Menús contextuales: cuatro tipos, según dónde haga clic derecho

Hacer clic derecho en la vista de Gantt da un menú distinto según dónde esté el ratón:

- **Sobre una barra de tarea** — el menú completo de tarea (editar, insertar, añadir subtarea/hito/relación,
  asignar calendario, progreso, prioridad, trazar ruta, eliminar…), más un elemento extra específico de barra arriba
  del todo: **Iniciar relación desde aquí**.
- **Sobre una fila de tarea sin impacto en la barra** (por ejemplo una fila sin barra visible actualmente) — el mismo
  menú de tarea, pero sin el elemento específico de barra.
- **Sobre una fila de encabezado de grupo** (la fila que resume un conjunto de tareas agrupadas) — un pequeño menú para
  contraer/expandir ese grupo, más **Expandir todo**/**Contraer todo** para todo el árbol.
- **Sobre lienzo vacío** (sin tarea, sin encabezado de grupo) — **Nueva tarea**, **Añadir hito**, **Pegar** (si
  hay algo en el portapapeles), **Restablecer zoom** y **Ajustar al proyecto**.

Este último menú se verificó en vivo: hacer clic derecho en un punto vacío del lienzo de Gantt produce exactamente
estos cinco elementos, en este orden.

## Arrastrar sobre una barra de tarea

Agarrar y arrastrar una barra de tarea mueve la tarea (o, al agarrar el borde, cambia su duración).
Mantenga pulsado **Mayús** mientras arrastra desde una barra, y en su lugar empieza a dibujar una **relación** hacia
la tarea sobre la que suelte — lo mismo que **Iniciar relación desde aquí** en el menú contextual de la barra, pero
en un solo movimiento de ratón.

## Desplazamiento panorámico frente a selección por rectángulo

Un arrastre que empieza en espacio vacío hace una de dos cosas, y eso depende de dónde lo empiece y de
su modo de desplazamiento (**Configuración → Desplazamiento y zoom**):

- **En la tabla de tareas** (la columna izquierda con WBS/nombre/duración), un arrastre en espacio vacío es
  **siempre** una selección por rectángulo — el desplazamiento panorámico nunca ocurre ahí.
- **En el propio lienzo de Gantt**: si su modo de desplazamiento está configurado en **Zoom + arrastrar** (desplazamiento
  panorámico al estilo de un mapa), gana el desplazamiento panorámico — exactamente como esperaría de una aplicación de mapas. En cualquiera de los otros modos de desplazamiento
  (**Posición** o **Asignación de teclas**), ese mismo arrastre en lienzo vacío es una selección por rectángulo, que le permite
  seleccionar varias tareas a la vez arrastrando un rectángulo a su alrededor.

En resumen: la tabla de tareas siempre selecciona; el lienzo solo se desplaza panorámicamente en modo de desplazamiento por arrastre y selecciona
en los demás casos.

## Zoom

Además de los botones de zoom en la cinta, **+**/**=** (o **Ctrl+=**) acerca y **-** (o
**Ctrl+-**) aleja. Un **0** simple restablece el zoom al valor predeterminado; **Ctrl+0** ajusta el zoom para que todo el
proyecto quepa en pantalla ("ajustar al proyecto") — lo mismo que el botón con ese nombre en el menú contextual de lienzo vacío
descrito arriba.

## Pestañas de documento

Si tiene varios proyectos abiertos a la vez (cada uno en su propia pestaña de documento), **Ctrl+1** a
**Ctrl+9** saltan directamente a la primera hasta la novena pestaña de documento.

## Modo presentación

**F11** activa/desactiva el modo presentación — una vista a pantalla completa sin la cinta ni los paneles laterales, pensada
para mostrar la planificación sin el aderezo de edición alrededor. **Esc** vuelve a salir del modo presentación
(y, en una pulsación posterior, realiza el habitual "deseleccionar").

## Reiniciar el recorrido

¿Quiere volver a ejecutar el recorrido de introducción (por ejemplo para mostrar la aplicación a otra persona)? Hay dos
sitios para hacerlo: el botón **Recorrido** en la pestaña de la cinta **Vista**, o **Iniciar recorrido** en la navegación
de Backstage (la fila justo encima de Configuración). Ambos inician el recorrido de inmediato, sin mostrar antes el
diálogo de bienvenida.

## Siga leyendo

- Abra usted mismo el resumen de atajos con **Ctrl+/** — esa es la fuente vinculante, no esta guía.
- El comportamiento de desplazamiento y zoom se configura en **Configuración → Desplazamiento y zoom**, disponible en las tres
  ubicaciones fijas de configuración de la aplicación (el icono de engranaje, la pestaña de la cinta Configuración, y Backstage →
  Configuración).
