# Tipos de informe

Cada informe de la pestaña *Informe*, con sus opciones: qué hacen, el valor inicial, qué cambia en el informe y dónde se encuentran. Cómo crear un informe y guardarlo como PDF está en [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken).

## Cómo funciona la ventana del informe

Abra la pestaña *Informe* (o pulse Ctrl+P). A la izquierda está la columna *Informe* con la lista desplegable *Tipo de informe*, el bloque *Resumen* con recuentos, el bloque *Configuración* u *Opciones del informe* y, abajo, el botón *Exportar PDF*. A la derecha está la vista previa. Lo que ve en la vista previa va al PDF.

**Tipo de informe** — qué informe ve. Elija entre once informes. Predeterminado: *Diagrama de Gantt*. Dónde: *Informe*, en la parte superior de la columna *Informe*.

**Exportar PDF** — crea el PDF. Efecto: el resultado es solo un PDF; la aplicación no envía nada a una impresora. Si la planificación no está actualizada, la aplicación calcula primero. Si el cálculo da un error, por ejemplo por un bucle en las relaciones, el botón no crea ningún archivo y muestra el error. Dónde: *Informe*, en la parte inferior de la columna *Informe*.

**Recordado.** La aplicación guarda todas las opciones de informe en este dispositivo, para todos sus proyectos. No forman parte del archivo del proyecto. Solo el campo *Empresa:* del diagrama de Gantt no se guarda.

**Cronograma actual.** Los informes usan el último cálculo. Si la planificación cambió desde entonces, los informes de tabla muestran arriba *El cronograma cambió desde el último cálculo — pulse Calcular (F5) para valores actuales*. Si nunca se ha calculado, dice *Aún no calculado — pulse Calcular (F5) para fechas y holguras*. Si el proyecto está en la vista *Fechas tal como se registraron*, los informes muestran las fechas del archivo de origen, y una franja lo indica.

**Abreviaturas.** *dl* son días laborables. *TF* es holgura total, *FF* es holgura libre.

## Papel y orientación

**Papel:** — el tamaño de papel del PDF. Elija entre A4, A3, A2 y A1. Predeterminado: A3. Efecto: las páginas se distribuyen para ese tamaño. Hay una sola elección para todos los informes: lo que elige para un informe vale también para los demás. En A4 vertical una tabla ancha se reduce, porque la tabla se escala al ancho de la página. Dónde: *Configuración* (Diagrama de Gantt y Diagrama de recursos) u *Opciones del informe* (los siete informes de tabla). La vista general de hitos y la variación no muestran opciones.

**Orientación:** — horizontal o vertical. Elija entre *Horizontal* y *Vertical*. Predeterminado: *Horizontal*. Efecto: igual que *Papel*. Dónde: el mismo lugar que *Papel*.

## Diagrama de Gantt

La planificación como gráfico de barras, con una tabla a la izquierda y una escala de tiempo a la derecha, en varias páginas si hace falta. La vista previa muestra el papel con encabezado de página, tabla, escala de tiempo y leyenda. El bloque *Resumen* cuenta *Tareas:*, *Tareas hoja:*, *Crítica:* y *Relaciones:*. Todas las opciones están en *Configuración*.

**Empresa:** — la empresa en el encabezado de página. Predeterminado: la empresa de los ajustes del proyecto. Efecto: solo el encabezado del informe; lo que escribe aquí no se guarda. Cambie la empresa en *Configuración › Proyecto › Ajustes del proyecto*, en el campo *Cliente/organización*, y confirme con *Aplicar*.

**Autor:** — el autor en el encabezado de página. Solo lectura: la aplicación lo toma de los ajustes del proyecto.

**Tamaño de fuente:** — tamaño del texto y de la tabla en el informe. Elija entre 90%, 100%, 110% y 125%. Predeterminado: 100%. Efecto: con una fuente más grande, el texto, las filas y la tabla crecen y la escala de tiempo pierde ancho. Es independiente de *Tamaño de texto* en la configuración.

**Colores de barras:** — de qué depende el color de una barra. Elija entre *Ruta crítica*, *Por tarea — automático* y *Por categoría*, con una lista desplegable *Campo de categoría* para *Por categoría*. Predeterminado: *Ruta crítica*. Efecto: es la misma elección que *Colores de barras* en la pestaña *Vista*: si la cambia aquí, el diagrama de Gantt en pantalla cambia también. Si el campo elegido no existe en este proyecto, dice *Este campo no existe en este proyecto. Se usa temporalmente la categoría de trabajo*.

**Línea de estado:** — una línea en la fecha de estado. Elija entre *Ninguna*, *Línea de fecha de estado* y *Línea de progreso*. Predeterminado: *Ninguna*. Efecto: *Línea de fecha de estado* dibuja una línea en la fecha de estado; *Línea de progreso* dibuja la línea en zigzag que se curva hacia el avance de cada tarea. Si el proyecto no tiene fecha de estado, dice *Establezca primero una fecha de estado* y el informe no dibuja nada.

**Seguir la vista (filtro, agrupación, orden)** — solo para el diagrama de Gantt. Predeterminado: desactivado. Efecto: desactivado pone en el papel toda la estructura de tareas. Activado dibuja exactamente las filas de la pantalla: con su filtro, agrupación, orden y fases contraídas.

**Ajuste automático al papel** — ajusta la escala de tiempo al ancho de la página. Predeterminado: activado. Efecto: activado ajusta la escala de tiempo al ancho de la página; el número de páginas depende de la altura. Desactivado usa una escala fija (*Zoom:*) y también reparte las páginas a lo ancho, lo que rápidamente da muchas páginas.

**Zoom:** — el valor fijo de la escala. Solo visible si *Ajuste automático al papel* está desactivado. Control deslizante de 1 a 40. Predeterminado: 22. Efecto: un valor mayor hace la escala de tiempo más ancha, así que caben más páginas a lo ancho.

**Escala de tiempo en:** — reparte la escala de tiempo en más anchos de página. Opción de 1 a 8 páginas. Predeterminado: 1 página. Efecto: solo con *Ajuste automático al papel*; si no, la opción está desactivada y dice *Solo con ajuste automático*. Útil para una planificación larga que usted quiere imprimir en un tamaño legible.

**Repetir encabezado en cada página** — Predeterminado: activado. Efecto: activado pone el encabezado de página en cada página; desactivado solo en la primera.

**Repetir pie en cada página** — Predeterminado: activado. Efecto: activado pone el pie (nombre del proyecto, fecha de impresión y leyenda) en cada página; desactivado solo en la última. Un folleto sin leyenda no se entiende, por eso está activado.

**Nombres de tarea en las barras** — Predeterminado: activado. Efecto: el nombre de la tarea en la barra, donde hay espacio.

**Mostrar finalización** — Predeterminado: activado. Efecto: la parte completada de la barra se vuelve gris, como en el diagrama de Gantt, y aparece la columna *Av* en la tabla. Una tarea completada no tiene banda de holgura.

**Truncar nombres de tarea** — Predeterminado: activado. Efecto: activado corta los nombres en la tabla al ancho de *Columna de nombre:*. Desactivado deja crecer la columna con el nombre más largo; entonces dice *La columna de nombre se adapta al nombre de tarea más largo*.

**Columna de nombre:** — el ancho de la columna de nombre. Solo visible si *Truncar nombres de tarea* está activado. Control deslizante de 60 a 400. Predeterminado: 130.

**Mostrar superposición de línea base** — la línea base activa junto a las barras. Predeterminado: desactivado. Efecto: una barra fina en el color de la línea base, debajo de la barra de la tarea, solo para las tareas que están en la línea base.

**Ruta crítica** — Predeterminado: activado. Efecto: solo controla las líneas rojas de relación entre dos tareas críticas y la línea de la leyenda. Las barras mismas siguen a *Colores de barras:*, sin importar esta casilla.

**Mostrar holgura** — Predeterminado: activado. Efecto: la holgura como una banda detrás de las barras no críticas.

**Relaciones** — las líneas de relación. Predeterminado: activado. Efecto: dibuja flechas entre las barras.

**Mostrar solo días laborables** — comprime el eje de la escala de tiempo en este informe. Predeterminado: desactivado. Efecto: se omiten fines de semana y festivos, y las bandas de semana sustituyen el sombreado de fin de semana. Es independiente de la misma opción del diagrama de Gantt en pantalla.

**Fines de semana** — Predeterminado: activado. Efecto: sombrea los fines de semana y los festivos en la escala de tiempo, siempre que la escala permita distinguir los días. En el eje comprimido (*Mostrar solo días laborables*) esta casilla no tiene efecto.

**Leyenda** — Predeterminado: activado. Efecto: la leyenda en el pie.

**Calidad de la vista previa** — qué nítida es la vista previa. Elija entre *Estándar*, *Alta* y *Máxima*. Predeterminado: *Alta*. Efecto: solo la nitidez de la vista previa en pantalla; el PDF no cambia. Dónde: *Informe*, encima de la vista previa.

## Diagrama de recursos

Las mismas barras que el diagrama de Gantt, agrupadas por recurso: quién hace qué y cuándo. El bloque *Resumen* cuenta *Recursos:*, *Asignaciones:* y *Sin recurso:* (con un período también *Fuera del período:*). El diagrama comparte todas las opciones del diagrama de Gantt, salvo *Seguir la vista (filtro, agrupación, orden)*, *Ruta crítica* y *Relaciones*: las filas no vienen de la pantalla, una tarea puede aparecer bajo varios recursos, y las relaciones no se dibujan allí. La casilla *Ruta crítica* está oculta y activada. Estas opciones vienen con las del diagrama de Gantt en *Configuración*, con estas cuatro casillas y el período:

**Cada recurso en una página nueva** — Predeterminado: desactivado. Efecto: cada recurso empieza en una página nueva, así puede entregar una hoja por cuadrilla o empleado. Desactivado da un solo documento continuo.

**Incluir tareas sin recurso** — Predeterminado: desactivado. Efecto: las tareas sin recurso aparecen como última banda del diagrama, para ver qué no tiene responsable todavía.

**Agrupar por tipo de recurso** — Predeterminado: desactivado. Efecto: una capa encima: primero una banda por tipo de recurso (mano de obra, cuadrilla, subcontratista, equipo, material) y dentro de ella, por recurso.

**Mostrar unidades/día y curva** — Predeterminado: activado. Efecto: dos columnas después del nombre de la tarea, con las unidades por día y la curva de distribución del recurso de esa banda. Si hay poco espacio para la escala de tiempo, el informe deja las columnas fuera y dice *Se omitieron las columnas Unidades/d y Curva: …*; más espacio se consigue con un papel más grande o en horizontal, un tamaño de fuente menor o una tabla más estrecha.

**Periodo del informe:** — solo las tareas que tocan el período. Predeterminado: *Todo el proyecto*. Efecto: el eje de tiempo abarca exactamente el período. Si no hay nada en el período, dice *No hay tareas en el período del informe — elija otro período o Proyecto completo*. Véase *Período del informe* más abajo.

## Vista general de hitos

Todos los hitos del proyecto en una tabla. No tiene opciones propias. El bloque *Resumen* cuenta *Hitos*, *Obligatorios* y *Retrasados*. Las columnas son *WBS*, *Nombre*, *Tipo* (*Automático*, *Inicio* o *Fin*), *Fecha*, *Restricción/fecha límite*, *Holgura*, *Obligatorio* y *Estado*. El estado es *Retrasado* si no se cumple la restricción, si se pasa la fecha límite o si la holgura total es negativa; si no, *Crítico* si el hito es crítico según la definición de crítico del proyecto; si no, *En plazo*. Sin hitos dice *No hay hitos en este proyecto*. El PDF usa el papel y la orientación que eligió por último para otro informe.

## Variación

La planificación actual junto a la línea base activa, para las tareas hoja. No tiene opciones propias. El bloque *Resumen* cuenta *Tareas*, *Más tarde* y *Más pronto* y muestra *Fin del proyecto: +3 días laborables* (la diferencia en días laborables entre el fin de la línea base y el fin actual). Las columnas son *WBS*, *Nombre*, *Inicio de la línea base*, *Fin de la línea base*, *Inicio actual*, *Fin actual*, *Δ inicio (dl)*, *Δ fin (dl)* y *Estado*. El estado depende del fin: *Más tarde* si el fin es posterior al de la línea base, *Más pronto* si es anterior, si no *En plazo*. *Nueva* es una tarea que no está en la línea base; *Eliminada* es una tarea que está en la línea base pero ya no está en la planificación. Sin línea base activa dice *No hay ninguna línea base activa — guarda una línea base o marca una como activa*. El PDF usa el papel y la orientación que eligió por último para otro informe.

## Previsión

Lo que se ejecuta o empieza en el período: la lista para la reunión semanal. Opciones en *Opciones del informe*.

**Periodo del informe:** — la ventana del informe. Predeterminado: *Próximo mes*. Efecto: el informe contiene las tareas no completadas que tocan el período, aunque abarquen todo el período, más las tareas atrasadas de antes del día de referencia, siempre que el final del período no sea anterior al día de referencia.

**Casi crítico ≤ (dl):** — el umbral para *Casi crítico*. Número de 0 a 60. Predeterminado: 5. Efecto: una tarea con más de 0 y como máximo ese número de días laborables de holgura total cuenta como casi crítica. Con 0 solo cuenta lo que marca la opción de cálculo del proyecto *Marcar casi crítico*.

El bloque *Resumen* cuenta *Actividades*, *Atrasadas*, *En curso*, *Debió empezar*, *Empieza*, *Crítica* y *Casi crítico*. El estado de cada fila siempre se refiere al día de referencia: *Atrasada* (no completada y el fin es anterior al día de referencia), *Debió empezar* (no iniciada, mientras el inicio era anterior al día de referencia), *En curso*, *Empieza* (todavía no iniciada, empieza dentro de la ventana). Las columnas son *WBS*, *Nombre*, *Inicio*, *Fin*, *Rest. (dl)*, *Av*, *HT (dl)*, *Crítica*, *Recursos* y *Estado*. La columna *HT (dl)* es la holgura total (*TF*).

## Tareas críticas y casi críticas

Las tareas que determinan el fin del proyecto y las que están casi en ese punto. Opción en *Opciones del informe*.

**Casi crítico ≤ (dl):** — Predeterminado: 5. Número de 0 a 60. Efecto y significado como en la previsión. El subtítulo indica el umbral elegido.

El informe contiene las tareas no completadas que son críticas (según el motor de cálculo y la definición de crítico del proyecto) o casi críticas, ordenadas por ruta de holgura, después por holgura total y después por inicio. El bloque *Resumen* cuenta *Críticas*, *Casi crítico*, *Cadenas críticas* y *Tareas hoja*. Las columnas son *WBS*, *Nombre*, *Inicio*, *Fin*, *Rest. (dl)*, *HT (dl)*, *HL (dl)*, *Ruta* y *Estado*. La columna *HT (dl)* es la holgura total (*TF*) y *HL (dl)* la holgura libre (*FF*). La columna *Ruta* muestra la ruta de holgura si la opción de cálculo *Múltiples rutas de holgura* está activada; si no, un guion.

## Informe de avance

Cómo va el proyecto en la fecha de estado. Opciones en *Opciones del informe*.

**Período del informe:** — Predeterminado: *Último mes*. Efecto: *Completadas en el periodo anterior* cuenta dentro del período. *Empiezan en el próximo periodo* mira hacia delante desde la fecha de estado, hasta *Previsión hasta*; con un período *Último*, llega tan lejos hacia delante como el período mira hacia atrás.

**Casi crítica ≤ (dl):** — Predeterminado: 5. Igual que en la previsión.

El bloque *Resumen* muestra *Fecha de estado*, *Período*, *Previsión hasta*, *Fin de la línea base*, *Fin previsto*, *Δ fin (dl)*, *Planificado* (con *(línea base)* o *(cronograma actual)*), *Real* y los recuentos *Completada*, *En curso*, *No iniciada*, *Atrasadas* y *Crítica*. Planificado y real se ponderan según la duración de las tareas. Planificado se mide contra la línea base si hay una línea base activa; si no, contra el cronograma actual. Las secciones son *Completadas en el periodo anterior*, *En curso*, *Empiezan en el próximo periodo*, *Atrasadas* y *Actividades críticas abiertas*; una tarea puede estar en más de una sección. Todas las secciones tienen las mismas columnas: *WBS*, *Nombre*, *Fin de la línea base*, *Fin previsto*, *Av*, *Rest. (dl)*, *HT (dl)* (TF), *Crítica* y *Estado*. El estado de cada fila es *Completada*, *En curso*, *No iniciada*, *Debió empezar* o *Debió terminar*.

## Salud de la planificación

Una comprobación de la planificación en sí. Busca errores y valores inusuales. La evaluación DCMA de 14 puntos aparece arriba. Las opciones están en *Opciones del informe*.

**Holgura alta > (dl):** — Número de 1 a 365. Predeterminado: 44. Efecto: una tarea no completada con más holgura total que este valor entra en *Holgura alta*.

**Duración larga > (dl):** — Número de 1 a 365. Predeterminado: 44. Efecto: una tarea no completada, que no es un hito, con una duración mayor entra en *Duración larga*.

**Desfase > (dl):** — Número de 0 a 365. Predeterminado: 10. Efecto: una relación con más desfase entra en *Desfase largo*. Un desfase negativo (adelanto) siempre aparece en el informe.

**Casi crítico ≤ (dl):** — Número de 0 a 60. Predeterminado: 5. Efecto: determina la comprobación *Casi crítico*.

La sección *Evaluación DCMA de 14 puntos* va primero. Sigue las catorce comprobaciones de la agencia estadounidense Defense Contract Management Agency, con las fórmulas y los umbrales de su *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, octubre de 2012). Por punto ve *Cantidad*, *De* (el total contado), *Valor*, *Umbral*, *Resultado* y *Detalle*. El resultado es *Cumple*, *Señal* o *n/a*. Para n/a, el motivo está en el detalle. Una señal no es un fallo. El folleto la califica como motivo para revisar más a fondo. Los umbrales de *Opciones del informe* no se aplican a esta sección. Siempre usa los umbrales del folleto.

Cuenta las tareas hoja no completadas, sin hitos ni hamacas, y las relaciones que llegan a esas tareas. La nota en la parte superior del informe muestra ambos números. Los catorce puntos:

- *Lógica*: tareas sin predecesor ni sucesor. Umbral: como máximo 5%.
- *Adelantos*: relaciones con un desfase negativo. Umbral: ninguno.
- *Desfases*: relaciones con un desfase positivo, por corto que sea. Umbral: como máximo 5%.
- *Tipos de relación*: la proporción de relaciones FS. Umbral: como mínimo 90%.
- *Restricciones estrictas*: tareas con una restricción obligatoria o con MSO, MFO, SNLT o FNLT. Umbral: como máximo 5%.
- *Holgura alta*: tareas con más de 44 días laborables de holgura total. Umbral: como máximo 5%. Requiere un cálculo.
- *Holgura negativa*: tareas con holgura total menor que 0. Umbral: ninguno. Requiere un cálculo.
- *Duración alta*: tareas de más de 44 días laborables. Cuenta la duración de la línea base si la tarea está en la línea base activa. Si no, cuenta la duración actual. Umbral: como máximo 5%.
- *Fechas no válidas*: un inicio real o un fin real posterior a la fecha de estado, o un inicio previsto o un fin previsto anterior a la fecha de estado. Umbral: ninguno. Requiere una fecha de estado.
- *Recursos*: tareas sin recurso. Umbral: ninguno. Solo si el proyecto usa recursos. Si no, n/a.
- *Tareas incumplidas*: de las tareas que la línea base indica que deben terminar en la fecha de estado o antes, la proporción que termina más tarde o que tiene un fin previsto más tardío. Umbral: como máximo 5%. Requiere una fecha de estado y una línea base activa.
- *Prueba de la ruta crítica*: la aplicación alarga una tarea crítica en 100 días laborables y recalcula, en una copia, sin cambiar el proyecto. La prueba se cumple si la última tarea del proyecto no termina antes que esa tarea. Se prueba la tarea crítica no completada con el inicio temprano. El detalle indica el nombre de la tarea y cuántos días laborables se desplazó el fin. En la vista *Fechas tal como se registraron* esta prueba es n/a (*no calculado*): la prueba necesita un cálculo, y el informe muestra entonces las fechas del archivo de origen. Pulse Calcular (F5) y la prueba se vuelve a ejecutar.
- *CPLI*: (longitud de la ruta crítica + holgura) / longitud de la ruta crítica. La longitud cuenta los días laborables desde la fecha de estado hasta el fin de la última tarea. La holgura es la diferencia con el fin de la línea base de esa tarea. Si la tarea no está en la línea base, es la holgura calculada. Umbral: como mínimo 0,95. Requiere una fecha de estado.
- *BEI* (índice de ejecución de la línea base): el número de tareas completadas en la fecha de estado, dividido entre la suma de las tareas que la línea base indica que debían estar completadas para entonces y las tareas sin línea base. Umbral: como mínimo 0,95. Requiere una fecha de estado y una línea base activa.

Dos puntos difieren del folleto, porque la aplicación no tiene ese concepto. *Duración alta* cuenta cada tarea no completada. El folleto lo limita al horizonte de planificación detallada (rolling wave). *Recursos* mira solo los recursos asignados, no los costes. El folleto no da ningún número para la prueba de la ruta crítica. Los 100 días laborables los elige la aplicación.

Las comprobaciones siguen este orden, con su gravedad. Error: *Holgura negativa*, *Fecha límite incumplida*, *Restricción violada* y *Avance incoherente* (inicio real o fin real posterior a la fecha de estado; inicio previsto o fin previsto anterior a la fecha de estado; 100% sin fin real; fin real sin 100%; avance sin inicio real). Advertencia: *Sin predecesora (inicio abierto)* y *Sin sucesora (fin abierto)* (no hitos), *Duración larga*, *Adelanto (desfase negativo)*, *Restricción estricta* (una restricción obligatoria o MSO, MFO, SNLT o FNLT), *Avance fuera de secuencia* y *Tarea incumplida (respecto a la línea base)*. Información: *Casi crítico*, *Holgura alta*, *Desfase largo*, *Relación distinta de FS* y *Sin recurso* (solo si el proyecto usa recursos). El informe mira solo las tareas hoja que no son hamacas. El bloque *Resumen* cuenta *Señales DCMA*, *Errores*, *Advertencias*, *Información*, *Tareas hoja* y *Relaciones*. Debajo de la sección DCMA hay una sección *Resumen* (por comprobación, la gravedad y el recuento) y una sección *Hallazgos* (cada tarea o relación). Sin cálculo, faltan las comprobaciones que necesitan holgura.

## Carga de recursos

Por recurso, por semana o por mes: lo que se requiere frente a lo disponible. Las opciones están en *Opciones del informe*.

**Período del informe:** — Predeterminado: *Todo el proyecto*. Efecto: cada semana o mes que toca el período se incluye por completo. Así, una fila muestra el mismo número que el histograma.

**Agregación:** — Elija entre *Semanal* y *Mensual*. Predeterminado: *Semanal*. Efecto: una fila por semana natural (columna *Semana del*, con el lunes) o por mes natural (columna *Mes*).

**Solo períodos sobreasignados** — Predeterminado: desactivado. Efecto: con la opción activada, solo se muestran las semanas o meses con al menos un día sobreasignado.

Las columnas son *Recurso*, *Tipo*, *Semana del* o *Mes*, *Requerido*, *Disponible*, *Variance* (disponible menos requerido; un valor negativo indica escasez), *Pico/día* y *Sobreasignado*. *Requerido* es la suma de unidades-día. Solo entran semanas o meses con demanda. El bloque *Resumen* cuenta *Recursos*, *Semanas* o *Meses*, *Semanas sobrecargadas* o *Meses sobreasignados* y *Recursos sobreasignados*.

## Asignaciones de recursos

Por recurso, las tareas a las que está asignado: ¿qué hace esta cuadrilla o esta grúa? Las opciones están en *Opciones del informe*.

**Período del informe:** — Predeterminado: *Todo el proyecto*. Efecto: con un período, solo se incluyen las asignaciones de tareas que tocan el período, más el trabajo atrasado de antes del día de referencia. *Todo el proyecto* no filtra por fecha.

**Incluir tareas completadas** — Predeterminado: desactivado. Efecto: con la opción activada, también se incluyen las asignaciones de tareas completadas.

Las filas se agrupan por recurso y, dentro de cada recurso, se ordenan por inicio. El bloque *Resumen* cuenta *Recursos*, *Asignaciones* y *Tareas sin recurso*. Las columnas son *Recurso*, *Tipo*, *WBS*, *Nombre*, *Inicio*, *Fin*, *Rest. (dl)*, *Uds./día*, *Av*, *Crítica* y *Estado*. *Recurso* y *Tipo* aparecen solo en la primera fila de un recurso. El estado de cada fila es el mismo que en el informe de avance: *Completada*, *En curso*, *No iniciada*, *Debió empezar* o *Debió terminar*.

## Resumen de WBS

La planificación agregada por elemento WBS: la vista general de gestión. Las opciones están en *Opciones del informe*.

**Nivel:** — hasta qué nivel se muestra la WBS. Elija entre *WBS completa* y los niveles 1 a 8. Predeterminado: nivel 2. Efecto: el subtítulo dice *Hasta el nivel 2*.

**Mostrar tareas** — Predeterminado: desactivado. Efecto: con la opción activada, también se muestran las propias tareas hoja bajo cada elemento.

Las columnas incluyen *WBS*, *Nombre*, *Inicio*, *Fin*, *Inicio de la línea base*, *Fin de la línea base*, *Duración (dl)*, *Av*, *Δ fin (dl)*, *HT mín (TF)*, *Act* (número de tareas), *Crít*, *Activo* y *Listo*. El inicio y el fin de una tarea de resumen vienen del último cálculo. El avance se pondera por duración sobre las tareas hoja. *HT mín* y los recuentos se refieren a las tareas hoja de abajo. El bloque *Resumen* cuenta *Elementos WBS* y *Actividades*.

## Periodo del informe

Cuatro informes de tabla y el *Diagrama de recursos* trabajan con un *Periodo del informe:*: *Previsión (look-ahead)*, *Informe de avance*, *Carga de recursos*, *Asignaciones de recursos* y el *Diagrama de recursos*. Cada informe recuerda su propio período. Debajo de la lista desplegable están *Desde* y *Hasta*, con las fechas que produce la elección.

**Día de referencia.** Un período con *Siguiente* o *Último* cuenta desde la fecha de estado del proyecto, o desde hoy si no hay fecha de estado. En ese caso, los informes de tabla muestran *Sin fecha de estado — el informe usa hoy (…).* Si mueve la fecha de estado, la ventana se mueve con ella. Ambos días cuentan.

**Próxima semana, Próximas 2 semanas, Próximas 4 semanas, Próximas 6 semanas, Próximas 8 semanas, Próximas 12 semanas** — a partir del día de referencia, cada semana tiene 7 días. Con fecha de estado jueves 20 de mayo, *Próxima semana* va del 20 al 26 de mayo y *Próximas 4 semanas* va del 20 de mayo al 16 de junio.

**Última semana, Últimas 2 semanas, Últimas 4 semanas, Últimas 6 semanas, Últimas 8 semanas, Últimas 12 semanas** — son las mismas seis, pero hacia atrás: cada semana tiene 7 días, hasta el día de referencia incluido. *Últimas 2 semanas* va del 7 al 20 de mayo, con 20 de mayo como día de referencia.

**Próximo mes, Último mes** — un mes natural hacia delante o hacia atrás, hasta un día antes de la misma fecha del otro mes. *Próximo mes* va hasta el 19 de junio, con el 20 de mayo como día de referencia. *Último mes* va del 21 de abril al 20 de mayo.

**Todo el proyecto** — desde el primer inicio hasta el último fin de la planificación.

**Personalizado** — su propio período. Efecto: *Desde* y *Hasta* pasan a ser dos campos de fecha. Empiezan con las fechas de la elección anterior. La fecha de fin no puede ser anterior a la fecha de inicio (*La fecha de fin es anterior a la fecha de inicio.*), y los dos campos deben estar completos (*Introduzca ambas fechas.*). Si la entrada no es correcta, el informe se queda en el último período válido.

## Véase también

- [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken): la ruta completa desde el tipo de informe hasta el PDF.
- [Elegir el período del informe](docs://howto-rapportageperiode-kiezen): pasos y ejemplos.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): qué significan crítica y casi crítica.
- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): la fecha de estado y la línea base con las que trabajan los informes.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): qué hacer con las semanas sobrecargadas de Carga de recursos.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): PDF junto a los demás formatos.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): dos líneas base con avance y una fecha de estado, para revisar el informe de Variance.
