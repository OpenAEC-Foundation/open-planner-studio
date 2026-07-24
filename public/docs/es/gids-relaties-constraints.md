# Relaciones y restricciones

Las tareas que están aisladas no se desplazan cuando cambia la planificación. Las relaciones registran esa dependencia; las restricciones registran un requisito estricto o flexible sobre una fecha. Esta guía profundiza más en ambas que [Inicio rápido](docs://quick-start): cuándo elegir qué tipo de relación, qué hace exactamente un desfase/adelanto, qué significa una fijación forzada y cuándo específicamente *no* debe usarla, y cómo se relaciona una fecha límite con una restricción.

## Lo que aprenderá aquí

- Los cuatro tipos de relación (FS/SS/FF/SF) y cuándo usar cada uno.
- El desfase y el adelanto, incluido el desfase porcentual y el desfase en tiempo transcurrido (por ejemplo para el curado del hormigón).
- Añadir relaciones de tres formas: arrastrando, mediante selección y en la tabla de relaciones.
- Los ocho tipos de restricción, más la fijación forzada (P6 Mandatory) y la restricción secundaria.
- La diferencia entre una fecha límite y una restricción.

Siga el ejemplo de nivel inicial [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (permiso SNET, solape SS, enlace FF) y, para el conflicto de fecha límite, [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Los cuatro tipos de relación

Toda relación tiene una **Predecesora** y una **Sucesora**, y uno de cuatro tipos:

- **FS — Finish-Start**: la sucesora empieza solo una vez que la predecesora ha terminado. Con diferencia, la relación más habitual en construcción: primero la cimentación, luego la estructura. Use FS cuando una tarea físicamente no pueda empezar hasta que la otra esté terminada.
- **SS — Start-Start**: ambas tareas empiezan (aproximadamente) al mismo tiempo. Úselo cuando dos tareas puedan avanzar juntas una vez que la primera se ponga en marcha — por ejemplo el trabajo de muros y la estructura de cubierta empezando de forma solapada en cuanto la estructura está en marcha, sin que una espere a que la otra termine.
- **FF — Finish-Finish**: ambas tareas terminan (aproximadamente) al mismo tiempo. Útil cuando dos tareas pueden avanzar de forma independiente pero deben completarse juntas — por ejemplo la pintura, que debe terminar poco después del alicatado, para que una habitación pueda entregarse de una vez.
- **SF — Start-Finish**: la predecesora debe empezar antes de que se permita terminar a la sucesora. Con diferencia, el tipo menos habitual en la práctica de la construcción — resérvelo para casos límite en los que una tarea de acabado solo puede detenerse una vez que otra tarea ha empezado (por ejemplo un relevo de turno).

¿Quiere reconocer estos tres primeros tipos en un ejemplo real? El ejemplo "Verbouwing & Aanbouw Eengezinswoning" contiene una cadena FS entre las fases principales, un solape SS entre el trabajo de muros y de cubierta, y un enlace FF entre el trabajo de alicatado y de pintura.

## Desfase y adelanto

Una relación no tiene por qué ser cero: un **desfase** (positivo) añade tiempo de espera entre predecesora y sucesora, un **adelanto** (negativo, introducido como número negativo) permite que la sucesora empiece antes — un solape deliberado. El campo de desfase (**Desfase**, en el panel de propiedades y en la tabla de relaciones) acepta una notación breve:

- `2d` — 2 días laborables de desfase (la unidad por defecto: días según el calendario del proyecto).
- `3ed` — 3 días **transcurridos**: días naturales que también avanzan durante fines de semana o festivos. Esta es la unidad que quiere usar, por ejemplo, para el **curado del hormigón**: el hormigón sigue curando también el sábado y el domingo, así que un desfase de "3 días laborables" subestimaría el tiempo de curado si cae un fin de semana en medio. En ese caso, ajuste el desfase a la unidad transcurrida.
- `50%` — un desfase porcentual: el 50% de la duración de la predecesora, recalculado en cada ejecución de CPM a medida que cambia la duración de la predecesora (la misma lógica que MS Project). Útil cuando el tiempo de espera escala de forma natural con el tamaño de la tarea anterior.
- `-25e%` — un desfase porcentual en tiempo transcurrido, negativo: un adelanto del 25% de la duración de la predecesora, en días transcurridos.

Un número negativo (adelanto) significa que la sucesora empieza mientras la predecesora todavía está en curso — por ejemplo el alicatado que ya empieza durante los últimos días del enlucido en la misma habitación.

## Añadir relaciones

Hay tres formas de crear una relación, según en qué parte ya esté trabajando:

1. **Arrastrando en el diagrama de Gantt**: mantenga pulsado **Mayús** y arrastre desde la barra de la predecesora hasta la barra de la sucesora. En cuanto suelte, se crea de inmediato una relación FS con desfase 0, y la ventana **Tipo de relación** aparece enseguida — allí puede ajustar el tipo (FS/SS/FF/SF) y el desfase sin tener que abrir el panel de propiedades.
2. **Selección + botón**: seleccione primero la predecesora, mantenga pulsado Ctrl/Cmd y seleccione a continuación la sucesora (en ese orden), y haga clic en **Nueva relación a partir de la selección** (el grupo de la cinta **Relaciones** en la pestaña **Planificación**, o la propia pestaña **Relaciones**). Este botón solo funciona cuando hay exactamente dos tareas seleccionadas.
3. **Directamente en la tabla de relaciones**: abra la pestaña **Relaciones** (mediante **Gestionar** en el grupo de la cinta Relaciones). La tabla muestra, por relación, las columnas **Predecesora**, **Tipo**, **Desfase**, **Sucesora**, **Determinante** y **Holgura libre** — el tipo y el desfase se pueden editar directamente aquí, también para relaciones que creó antes arrastrando o mediante selección.

La columna **Determinante** muestra, tras un cálculo, qué relación determina realmente la fecha de inicio o de fin de la sucesora — para una tarea con varias predecesoras, esa no es necesariamente la relación que creó más recientemente, sino la que tiene la fecha más tardía (determinante).

## Tipos de restricción

Una restricción impone un límite de fecha a una tarea, con independencia de sus relaciones. Open Planner Studio tiene ocho tipos, que se establecen mediante el campo **Restricción** en el panel de propiedades:

- **Lo antes posible (ASAP)** — sin límite de fecha, el valor por defecto.
- **Lo más tarde posible (ALAP)** — la tarea se desplaza lo máximo posible dentro de su holgura.
- **No comenzar antes del (SNET)** — un límite inferior en la fecha de inicio (por ejemplo: no empezar antes de que se conceda el permiso).
- **No comenzar después del (SNLT)** — un límite superior en la fecha de inicio.
- **No finalizar antes del (FNET)** — un límite inferior en la fecha de fin.
- **No finalizar después del (FNLT)** — un límite superior en la fecha de fin.
- **Debe comenzar el (MSO)** — una fecha de inicio fija.
- **Debe finalizar el (MFO)** — una fecha de fin fija.

SNET/SNLT/FNET/FNLT son todos **límites flexibles**: el cálculo CPM los tiene en cuenta, pero una infracción "solo" produce holgura negativa, no un bloqueo ni un error. El ejemplo "Verbouwing & Aanbouw Eengezinswoning" usa una restricción SNET, por ejemplo, para impedir que una tarea empiece antes de que se conceda el permiso.

### La fijación forzada (P6 Mandatory)

MSO y MFO pueden hacerse además **estrictos** mediante la casilla **Obligatorio (fijación forzada)**, que solo aparece para estos dos tipos. Esta es la restricción "P6 Mandatory" de Primavera P6: la barra queda fijada en la fecha, incluso si sus predecesoras la contradicen lógicamente. Al activar una fijación forzada, Open Planner Studio muestra una advertencia única: **una fijación forzada anula las relaciones — la barra queda fijada en la fecha, incluso antes que sus predecesoras. Una infracción se convierte en holgura negativa aguas arriba.**

Por tanto, use una fijación forzada únicamente cuando una fecha realmente no sea negociable y quede al margen de la lógica de la planificación — por ejemplo una fecha de entrega fijada legalmente que se mantiene independientemente del avance. **No** la use como regla general para "quiero que esta tarea esté en esa fecha": en ese caso, una restricción flexible (SNET/FNLT/etc.) o simplemente una cadena de relaciones bien planificada es casi siempre la mejor opción. Una fijación forzada puede comprimir toda la red aguas arriba: si las tareas anteriores quieren extenderse a través de la fijación, aparece holgura negativa que se propaga por toda la cadena antes de la tarea fijada — una señal de que la planificación entra en conflicto, no de que la fijación haya resuelto el problema.

### Restricción secundaria

Para una restricción no estricta (por tanto, ni ASAP/ALAP ni un MSO/MFO estricto), puede añadir una **restricción secundaria**: un segundo límite de los mismos cuatro tipos flexibles (SNET/FNET/SNLT/FNLT), que no puede limitar el mismo lado que la principal. Eso le permite establecer, por ejemplo, tanto un límite inferior como uno superior en la fecha de inicio a la vez. Open Planner Studio valida la combinación en tiempo real y muestra un error en cuanto la combinación no es válida — por ejemplo una restricción secundaria junto a una fijación forzada, lo cual no está permitido.

## Fechas límite frente a restricciones

Una **fecha límite** (un campo aparte, en el panel de propiedades) se parece a una restricción, pero es deliberadamente distinta: es un límite superior flexible e informativo sobre la fecha de fin, mostrado en el diagrama de Gantt como un marcador de flecha hacia abajo — verde mientras la tarea siga a tiempo, rojo en cuanto su fin temprano la sobrepasa. Una fecha límite no fuerza la planificación (a diferencia de una restricción MFO/FNLT, que participa activamente en el cálculo), pero sí cuenta como límite superior al calcular la holgura: si la planificación, de forma natural, no cumple la fecha límite, eso produce **holgura negativa** sin que intervenga ninguna restricción.

Eso es exactamente lo que ocurre en el ejemplo [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): contiene una fecha límite contractual deliberadamente ajustada que la duración natural de la planificación no cumple, lo que produce holgura negativa visible — un buen ejemplo para consultar si quiere ver cómo es en la práctica un conflicto de fecha límite, sin que nada esté "roto": la planificación simplemente calcula hasta el final y muestra dónde está sometida a presión.

Regla general: use una **fecha límite** para una fecha objetivo que quiera supervisar sin forzar la lógica de la planificación, y use una **restricción** (flexible o, excepcionalmente, estricta) cuando una fecha realmente sea un límite que el cálculo deba respetar.

## Siga leyendo

- Vea SNET, el solape SS y el enlace FF en la práctica: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Vea el conflicto de fecha límite en la práctica: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- ¿La estructura todavía no está lista? Lea antes [Planificación y WBS](docs://gids-plannen-wbs).
- Para calendarios y horarios laborales que afectan a la duración de las tareas: la guía [Calendarios y planificación por horas](docs://gids-kalenders-uren).
