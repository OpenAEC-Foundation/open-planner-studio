# Planificar bien

¿Qué hace que una planificación sea buena? No su aspecto ordenado, sino si responde a la pregunta que importa cuando el trabajo ya está en marcha: si esto se retrasa, ¿qué pasa con la entrega? Este artículo explica los principios de una planificación fiable y por qué pesan tanto en Open Planner Studio: la aplicación calcula solo con lo que usted introduce, y con nada más.

Los ejemplos proceden de la construcción: obra estructural, oficios de acabado, plazos de suministro, retraso por clima, subcontratistas y una fecha contractual de entrega. Pero los principios en sí no son específicos de la construcción.

## El concepto

Una buena planificación no es una imagen de lo que usted espera, sino un **modelo de cálculo**: tareas con una duración, unidas por relaciones, en un calendario. La aplicación calcula las fechas a partir de ese modelo. Cuando algo cambia, el modelo se recalcula y usted ve de inmediato qué significa eso para el resto.

Un planificador trabaja en un orden fijo:

1. El objetivo: hitos y fecha de entrega.
2. El desglose: fases, paquetes de trabajo, tareas.
3. La duración de cada tarea.
4. Las relaciones.
5. Restricciones y fechas fijas.
6. Calendarios.
7. Recursos.
8. Ruta crítica y holgura.
9. Línea base y avance.
10. Revisión.

Ese orden no es una formalidad. Si omite un paso, aparece después como una sorpresa: las tareas sin relaciones no se desplazan con las demás, las duraciones sin calendario son incorrectas, y una línea base que usted captura solo después congela el retraso en lugar del acuerdo.

## Cómo calcula la aplicación con la planificación

Cada principio que sigue está ligado a algo que hace la aplicación. Por eso, esta parte sigue el mismo orden.

### Parta de la meta, no de las tareas

Primero anote los momentos fijos, y solo después el trabajo que tiene que caber entre ellos: inicio de la preparación del terreno, permiso definitivo, edificio cerrado frente a la intemperie, inicio de los acabados, entrega. Esos son **hitos**: puntos sin duración, que de verdad se introducen como hito (*Inicio › Tareas › Hito ▾*) y no como una tarea de duración cero con un nombre parecido.

Por qué este orden: una planificación que parte de una lista de tareas se convierte en una suma, y una suma rara vez coincide con la fecha del contrato. Parta de los hitos y la pregunta correcta surge enseguida: no «cuánto tarda todo esto en conjunto», sino «¿cabe el trabajo entre estos dos momentos y, si no cabe, qué tiene que cambiar?». Calcule hacia atrás desde la fecha de entrega exigida hasta el momento en que el edificio debe estar cerrado a más tardar, y desde ahí hasta el inicio.

Una entrega fijada por contrato recibe la casilla *Obligatorio (contractual)*, para que quien abra el archivo vea que este momento no es negociable ni movible. La casilla es una marca para el Gantt y los informes; no protege una fecha. Eso se hace con una fecha límite o una restricción (véase más abajo).

### El desglose: fases, paquetes de trabajo, tareas

Debajo de los hitos construye la estructura: fases, debajo de ellas paquetes de trabajo, y debajo de estos, tareas. Lo hace aplicando sangría. Una tarea con subtareas se convierte automáticamente en una **tarea de resumen**: la aplicación deriva su barra y su duración de las tareas que tiene debajo. Por eso, nunca introduzca usted mismo una duración para una tarea de resumen.

La regla general para la granularidad: **una tarea dura entre aproximadamente un día y dos semanas**. Menos de un día significa que está planificando la obra en lugar del proyecto; eso pertenece al plan semanal del jefe de obra, no a un modelo de cálculo que tiene que durar meses. Más de dos semanas significa una tarea que no se puede estimar bien ni seguir durante la ejecución: «finishing ground floor, 40 days, 45% complete» no dice a nadie si las cosas van bien. Por eso, las revisiones de la planificación suelen contar cuántas tareas duran más de unos dos meses; por encima de unos pocos por ciento, eso cuenta como falta de detalle.

Demasiado detalle es tan perjudicial como demasiado poco. Cada tarea exige mantenimiento: relaciones que dibujar, avance que registrar, una nueva valoración después de cada cambio. Una planificación de dos mil tareas para un proyecto de seis meses no se vuelve más exacta; se queda sin mantenimiento, y una planificación que nadie actualiza es ficción en tres semanas. Elija el nivel en el que pueda informar del avance con honestidad, cada semana.

En la práctica: «3. Finishing» es una fase, «Finishing house 4» un paquete de trabajo, «Plastering house 4 ground floor» una tarea de cinco días. Puede superar deliberadamente el límite superior en los plazos de suministro y la supervisión: una entrega de marcos de ventana de diez semanas es de verdad un único bloque indivisible de espera, y la supervisión continua pertenece a una hamaca y no a una serie de cortes artificiales.

### Estimar la duración

Una duración es una estimación de cuánto tarda el trabajo, no de qué tan rápido podría hacerse. Estime para un día normal con la cuadrilla que realmente tendrá, no para el mejor día con la mejor cuadrilla. El optimismo se acumula a lo largo de la cadena: una planificación en la que cada tarea supone el mejor día casi nunca cumple la fecha de entrega.

Elegir días u horas es una decisión real, no un formato. Elija **días** para el trabajo que marca el ritmo en la obra: albañilería, enlucido, alicatado. Tarda cinco días, tanto si un día resulta tener ocho como nueve horas. Elija **horas** cuando las horas sean la unidad y lo que queda del día importe: una inspección de tres horas, un vertido de hormigón de catorce horas repartido en dos días, trabajo por turnos. La aplicación guarda esa elección por tarea. La elección solo aparece después de activar *Activar planificación por horas*; véase [Días y horas](docs://uitleg-dagen-en-uren).

No oculte el riesgo dentro de duraciones individuales. Añadir un día en todas partes entierra el margen, de modo que nadie ya puede verlo ni dirigirlo; y donde el margen era realmente necesario, resulta ser demasiado pequeño. Haga visible la reserva: una tarea de colchón explícita antes de la fecha de entrega, o una provisión separada para el tiempo meteorológico. Cuidado con contar dos veces: los unos 180 días laborables útiles al año con los que cuenta la construcción neerlandesa son una cifra anual contractual (UAV), de la que ya se han descontado los festivos, las vacaciones de construcción *y* los días perdidos. Si los festivos y las vacaciones ya están en el calendario del proyecto, solo queda como elemento aparte el retraso meteorológico. El retraso por helada y tormenta sigue sus propias reglas en el convenio colectivo Onwerkbaar weer Bouw & Infra. Ponga esos días perdidos previstos en el calendario o en un elemento aparte, no ocultos en la duración de la albañilería.

### Relaciones: sin una red no hay planificación

La aplicación calcula las fechas a lo largo de las **relaciones**: una tarea solo comienza cuando sus predecesoras lo permiten. Una tarea sin relaciones no está ligada a nada. Si los trabajos de estructura se retrasan dos semanas, una tarea de acabado desconectada no se desplaza, y la planificación engaña sin que nada se ponga en rojo.

Por eso cada tarea tiene al menos un predecesor y al menos un sucesor. Solo quedan exentas la primera tarea del proyecto y el último hito. En una revisión de la planificación, esta es la primera comprobación: no más de unos pocos por ciento de las tareas pueden tener lógica incompleta.

**Fin-comienzo es el valor predeterminado**, y debe seguir así: cimentación terminada, luego trabajos de estructura. En una planificación de construcción sana, alrededor de nueve de cada diez relaciones son fin-comienzo. Es un requisito de legibilidad: fin-comienzo es el único tipo que todos en la obra entienden sin explicación, y se comporta de forma previsible durante la ejecución.

**Comienzo-comienzo con desfase** sirve para trabajos que de verdad avanzan en paralelo y no esperan. El caso clásico es una hilera de casas adosadas o una torre con plantas: el instalador va tres días por detrás de la albañilería. Eso es un comienzo-comienzo con un desfase de tres días, no un fin-comienzo sobre una tarea artificialmente troceada. Añada también una relación fin-fin; si no, el sucesor podría en teoría terminar antes que el predecesor. En construcción casi nunca se usa comienzo-fin.

Es preferible dibujar ese comienzo-comienzo entre tareas, no entre fases. Si el predecesor de un comienzo-comienzo o comienzo-fin es una fase, la aplicación hace que el sucesor espere a la tarea de esa fase que comienza en último lugar, no a la primera. Así nunca planifica demasiado pronto, pero a veces más tarde de lo que quería. Fin-comienzo y fin-fin con una fase como predecesor esperan a que termine la última tarea de esa fase, y eso suele ser exactamente lo que se quiere.

Use los desfases con moderación, y sobre todo los negativos. Un desfase es tiempo de espera sin una razón visible: nadie puede saber después por qué hay siete días de por medio. Si se trata del curado del hormigón, hágalo como un desfase en días naturales (el hormigón también cura los fines de semana), o mejor aún como una tarea real de «curing» que todos puedan ver y seguir. Un desfase negativo, es decir un adelanto o un solapamiento, en realidad no debería existir; en una revisión de la planificación la norma es cero. Si quiere un solapamiento, divida el predecesor o use un comienzo-comienzo.

### Restricciones y fechas fijas: las menos posibles

Cada tarea empieza «lo antes posible», y en la gran mayoría de los casos debe seguir así. Una **restricción** es un límite de fecha junto a las relaciones. Cuantas más añada, menos calcula la planificación y más se convierte en un dibujo. Un plan lleno de fechas fijas parece estable y oculta precisamente por eso el riesgo: ya no se mueve, así que ya no avisa.

Use una restricción solo para una fecha externa firme sobre la que la propia planificación no tiene influencia: el permiso que no será definitivo antes del 1 de marzo (*No comenzar antes del (SNET)*), la franja de cierre que concedió el ayuntamiento, la fecha de conexión de la compañía de servicios públicos. «Quiero esta tarea en mayo» no es un hecho externo; eso se resuelve con la lógica o con otra duración. Como regla general, como máximo unos pocos por ciento de las tareas restantes llevan un límite de fecha firme.

Nunca introduzca una fecha de inicio para colocar una tarea donde usted la quiere. Para una tarea con predecesor, la aplicación convierte un inicio introducido (o arrastrado) en una restricción *No comenzar antes del (SNET)*. La tarea queda entonces donde usted la quiere, y allí se queda aunque toda la cadena anterior se retrase.

Si quiere vigilar una fecha sin dirigir el cálculo, use una **fecha límite**. No mueve nada, pero da una holgura negativa y un aviso en cuanto la tarea ya no la cumple, justo la señal que quiere ver. Reserve la fijación rígida (*Obligatorio (fijación forzada)*) para el caso extremo, y sepa que entonces da holgura negativa en la cadena anterior: eso es la planificación indicando que no encaja, no que algo esté roto.

### Calendarios: primero el proyecto, después las excepciones

Todas las duraciones cuentan en días laborables u horarios de trabajo de un calendario. Por eso, configure bien el calendario del proyecto antes de introducir duraciones: días laborables, horarios laborales, festivos y vacaciones de construcción. Un calendario que corrige a mitad de camino desplaza toda la planificación. Añada enseguida los cierres previsibles: la época de heladas en la que no se vierte hormigón, el cierre de la empresa entre Navidad y Año Nuevo.

Dé a un recurso calendario propio solo si de verdad difiere: el fachadista que viene cuatro días a la semana, la cuadrilla que tiene otras vacaciones de verano. Un calendario de recurso no cambia ni una sola fecha de una tarea; eso sigue rigiéndose por el calendario de la tarea o del proyecto. Solo muestra que el recurso no trabaja en uno de los días laborables de la tarea, como sobreasignación en el histograma. Esa diferencia es difícil de detectar si no sabe que la creó usted mismo.

### Recursos: quién lo hace y si es posible

Una planificación sin recursos responde solo a la mitad de la pregunta. En cuanto asigne las cuadrillas y los equipos, el histograma muestra lo que una línea de tiempo por sí sola no muestra: que el 14 de junio necesita tres cuadrillas de enlucido y solo tiene dos.

Empiece por los recursos escasos. No hace falta incluir cada tornillo; sí hace falta incluir la grúa torre, sus propias cuadrillas, los subcontratistas con techo de capacidad y los plazos de suministro largos. Dé a cada recurso una capacidad honesta: dos enlucidores significan dos, no «dos, pero tres en caso de emergencia».

Lea el histograma como una pregunta, no como un error. El rojo por encima de la línea significa que la planificación pide más de lo que tiene ese día. A veces la respuesta es: desplazar. A menudo la respuesta es: esto no va a funcionar, y eso es lo que quería saber. **Nivelación** desplaza tareas hasta que la demanda cabe dentro de la capacidad. Si la fecha de fin admite cambios, permítalo; si la fecha de entrega es fija, nivele solo dentro de la holgura (la casilla *Nivelar solo dentro de la holgura (suavizado) — la fecha de fin del proyecto no cambia*). La fecha de fin entonces se mantiene y queda un conflicto restante que se muestra, un resultado más honesto que una planificación que solo parece resuelta.

*No* nivele cuando la demanda es estructuralmente mayor que la capacidad. La nivelación reordena el trabajo existente en el tiempo; no contrata más enlucidores ni instala una segunda grúa. Tres torres que necesitan la misma cuadrilla al mismo tiempo siguen siendo tres torres que necesitan la misma cuadrilla después de nivelar; lo único que cambia es que la entrega se retrasa. Lo que sí ayuda entonces es la faseación, más capacidad o un trabajo distinto. Tampoco nivele antes de tener la lógica y las duraciones definidas: estaría nivelando una planificación que mañana será distinta.

### Ruta crítica y holgura: dónde es vulnerable la planificación

La aplicación no recalcula con cada cambio. Calcule con **Calcular** (F5) y solo después lea. Si la barra de estado dice *Desactualizado — recalcula (F5)*, está viendo el cálculo anterior, no este. Con el ajuste *Calcular automáticamente* la aplicación lo hace por sí sola.

La **ruta crítica** es la cadena sin holgura: cada día perdido allí supone un día más de retraso en la entrega. Ahí deben ir su supervisión y sus mejores personas. No mire solo el rojo. La **holgura total** indica cuánto puede retrasarse una tarea sin afectar a la entrega; la **holgura libre** indica cuánto puede retrasarse sin mover a su sucesor. La diferencia no afecta a la fecha de fin de nadie, pero sí estorba a alguien: es útil cuando trabaja con subcontratistas a los que no puede reprogramar dos veces.

Esté atento a tres señales. Una tarea con unos pocos días de holgura no es una tarea segura, sino una casi crítica; con *Marcar casi crítico* esas tareas reciben un color propio. Una tarea con una holgura extrema —en las revisiones de la planificación, más de 44 días laborables, unos dos meses— casi siempre le falta un sucesor; eso le señala directamente los huecos de su red. Y la holgura negativa nunca es un error de cálculo: es la planificación indicando que una fecha límite o una fecha fija no encaja.

### Línea base antes del inicio, después mantenerla actualizada

Guarde una **línea base** en cuanto se apruebe la planificación y antes de que entre la primera pala en el suelo (*Planificación › Líneas base y progreso › Gestionar líneas base…*). Calcule primero: la línea base guarda las fechas del último cálculo. Sin esa referencia, después solo podrá decir *que* las cosas van de otra manera, no en cuánto ni desde cuándo, y eso es justo lo que necesita en una reunión de obra, para trabajos extra y cuando se discute un retraso.

Una línea base guarda las fechas, pero no los supuestos en los que se basan, y justo eso es lo que se pregunta en cuanto se discute un retraso. Así que, cuando la guarde, escriba brevemente en qué se basa esta planificación (en la práctica de planificación: la *base de la planificación*): qué cifras de productividad usó, qué calendario usó y por qué está configurado así, qué dejó a propósito fuera de la planificación, quién facilitó los plazos de suministro que supuso y quién aprobó la planificación. Con media página basta.

Después, mantenerla al día es un ritmo, no un proyecto. Actualice cada semana, en el mismo orden: fije la **fecha de estado** en la fecha del informe, introduzca los inicios reales y las fechas reales de fin de lo que haya empezado y terminado, corrija la duración restante de lo que está en marcha, y calcule. Un porcentaje por sí solo no basta: las fechas reales son el registro objetivo que se consultará más adelante.

Sepa qué hace la fecha de estado: la aplicación mueve el trabajo que todavía no ha empezado hasta la fecha de estado, y las tareas posteriores se desplazan con él (salvo en el perfil de cálculo Microsoft Project). Así que, si olvida dar por terminada una tarea o un hito, se desplaza hacia la derecha por sí solo. Eso no es un fallo, sino que el modelo se niega a fingir que algo del pasado todavía puede ocurrir. Si recibe una advertencia *Fuera de secuencia*, el trabajo se hizo en otro orden del que prescribe la lógica; normalmente es motivo para revisar la secuencia, no para descartar la advertencia. Guarde una nueva línea base solo ante un cambio real de alcance, y entonces junto a la primera, no encima de ella.

Por último: una planificación solo es fiable si las personas que hacen el trabajo creen en ella. Haga que el jefe de obra y los subcontratistas comparen el plan semanal con este modelo. Si semana tras semana solo logran la mitad de lo acordado, el problema suele estar más en la planificación que en la ejecución.

## Ejemplo práctico: tres decisiones que hacen que la planificación engañe sin avisar

Las cifras vienen de dos ejemplos que se desarrollan en otro lugar de la ayuda: el proyecto de práctica *House extension* de los tutoriales, y una red pequeña para una ampliación. Aquí importa qué hace cada decisión con su planificación. Usted lo prueba en el tutorial 2 (relaciones y ruta crítica) y en el tutorial 3 (una restricción y una fecha límite).

### Una relación olvidada

En la ampliación, la obra empieza el lunes 7 de junio de 2027 y la entrega es el viernes 6 de agosto. *Build outer cavity leaf* (6 días laborables) tiene como sucesor a *Install window frames*, porque los marcos de las ventanas están en la fachada. Con esa relación, la hoja exterior tiene 2 días laborables de holgura.

Si olvida esa relación, la hoja exterior tiene de repente 23 días laborables de holgura hasta la entrega. En el papel puede retrasarse semanas sin que nadie espere. No se pone nada en rojo y no aparece ningún aviso. Solo con la opción de cálculo *Tareas de extremo abierto críticas* una tarea así, sin sucesor, se vuelve crítica, y así se ve el hueco.

### Una fecha escrita en lugar de una relación

La red pequeña: *Groundwork* (3 días laborables), *Pour foundation* (2), *Brickwork* (5) y *Roofing* (3), uno detrás de otro, desde el lunes 7 de junio de 2027. El proyecto termina el miércoles 23 de junio.

Si escribe como inicio el lunes 21 de junio para *Brickwork*, porque los ladrillos solo llegan entonces, eso se convierte en un *no comenzar antes del (SNET)*. Brickwork se mueve una semana y el proyecto termina el miércoles 30 de junio. *Groundwork* y *Pour foundation* tienen 5 días laborables de holgura y ya no son críticas. Si los ladrillos llegan antes después de todo, Brickwork se queda en el 21 de junio: ahora manda la fecha, no la lógica.

Si escribe en cambio el miércoles 9 de junio, antes de que termine la cimentación, no pasa nada: las relaciones solo permiten que Brickwork empiece el lunes 14 de junio de todos modos.

### Una fecha límite en lugar de una restricción

Si quiere que *Roofing* termine el viernes 18 de junio, ponga ahí una fecha límite. No se mueve nada: Roofing se queda del lunes 21 al miércoles 23 de junio. Pero la cadena tiene −3 días laborables de holgura y la aplicación muestra *Fecha límite 18-06-2027 incumplida — fin más temprano 23-06-2027*. Así ve de inmediato que el acuerdo no encaja, en lugar de una barra en el lugar correcto con una cadena detrás que no lo cumple.

## Consecuencias y conceptos erróneos

- **Tareas sin predecesor ni sucesor.** Es lo más común y lo más perjudicial: esas tareas no se desplazan con el resto y obtienen una holgura falsa.
- **Escribir fechas o arrastrar barras en lugar de dibujar la lógica.** Así se fija una restricción sin que lo note.
- **Demasiadas restricciones, y una fijación rígida usada como marcador.** La planificación entonces ya no calcula, solo dibuja.
- **Tareas de tres meses, o tareas de medio día.** El rango útil está entre más o menos un día y dos semanas.
- **Duraciones optimistas, y margen oculto en cada tarea individual** en lugar de visible como colchón.
- **Retraso por clima y vacaciones de construcción que no están en el calendario.** De todos modos, en enero acabarán en él.
- **Desfases en lugar de tareas.** Siete días de espera sin nombre resultan inexplicables tres meses después.
- **Realizar la nivelación antes de que la lógica esté definida**, o seguir con la nivelación frente a una falta estructural de capacidad.
- **Olvidar calcular.** *Desactualizado* en la barra de estado significa que ve el cálculo anterior.
- **Ninguna línea base, o una línea base guardada solo después del inicio.**
- **Avance registrado solo como porcentaje**, sin fechas reales y sin fecha de estado.
- **Descartar el panel *Advertencias* sin leerlo.** Ahí se juntan las fechas límite incumplidas, las restricciones violadas, las relaciones fuera de secuencia y los recursos sobreasignados (*Planificación › Programación › Advertencias*).

## Véase también

- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): cómo la aplicación calcula las fechas tempranas y tardías, y la holgura.
- [Relaciones y desfase](docs://uitleg-relaties): los cuatro tipos de relación, el desfase y las relaciones en una fase.
- [Restricciones y fechas límite](docs://uitleg-constraints): qué hace cada restricción y una fecha límite en el cálculo.
- [Calendarios y días laborables](docs://uitleg-kalenders): cómo la aplicación cuenta los días laborables y qué calendario prevalece.
- [Días y horas](docs://uitleg-dagen-en-uren): planificación en días, en horas o combinada.
- [Nivelación de recursos](docs://uitleg-nivelleren): qué mueve la nivelación y qué no.
- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): qué hace la fecha de estado y cómo leer la variación.
- [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen): cómo introducir los hitos y las tareas.
- [Añadir relaciones](docs://howto-relaties-leggen): cómo vincular tareas entre sí.
- [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen): un asistente que planifica según estos principios.
- [Avisos y advertencias](docs://ref-meldingen): todas las advertencias en un solo lugar.
