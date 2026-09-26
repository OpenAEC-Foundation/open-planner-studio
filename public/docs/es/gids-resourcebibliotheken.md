# Bibliotecas de recursos

Si trabaja en varios proyectos con las mismas cuadrillas, los mismos subcontratistas y los mismos calendarios, no quiere mantener por separado su tarifa, calendario y tipo en cada proyecto — volver a escribirlos cada vez y perseguir cada copia cuando algo cambia. Para eso existe una biblioteca de recursos: una fuente compartida de recursos y calendarios que pertenece a su organización, vive fuera de los proyectos individuales, y de la que pueden beber varios proyectos. Esta guía explica cómo se relaciona la biblioteca con un proyecto, qué viaja exactamente junto con ella y qué queda por proyecto, y cómo cambia entre ambos.

## Lo que aprenderá aquí

- La distinción entre la biblioteca (compartida, de toda la organización) y el proyecto (lo que este proyecto realmente utiliza).
- Vincular un proyecto a una biblioteca, o dejarlo deliberadamente independiente.
- Las dos vistas de la pestaña Recursos: **Biblioteca** y **Proyecto**.
- Los tres tipos de filas que encontrará en la vista de proyecto: de la biblioteca, propias del proyecto, y huérfanas.
- Qué trae exactamente un recurso de la biblioteca al proyecto, y qué establece libremente por proyecto.
- Las tres acciones que conectan la biblioteca y el proyecto.
- Cómo actualiza la aplicación las copias, y qué se le pide decidir cuando una copia ha divergido.
- Compartir, copia de seguridad y sus límites.

Siga el ejemplo con [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) y [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): al abrir cualquiera de los dos ejemplos se vincula automáticamente a una misma biblioteca de recursos de demostración compartida, y las cuadrillas **Timmerlieden**, **Installateurs**, **Stukadoors** y **Schilders** reaparecen con exactamente el mismo nombre en ambos — la prueba directa de que una biblioteca alimenta a varios proyectos.

## Biblioteca y proyecto: dos mundos

La **biblioteca de recursos** es la fuente compartida: pertenece a su organización, no a un solo proyecto, y sobrevive a cualquier proyecto individual. El **proyecto** decide qué pone realmente a trabajar de ella este proyecto en concreto — con su propia capacidad, disponibilidad y elección de calendario. Un proyecto se vincula a exactamente una biblioteca, o queda completamente independiente: en ese caso todo funciona simplemente como siempre, solo que sin una fuente compartida de la que beber o a la que escribir de vuelta.

## Vincular un proyecto a una biblioteca

Elige la biblioteca en dos sitios, que muestran el mismo panel:

- El **asistente de proyecto** ("Nuevo"), con un selector de biblioteca.
- **Información del proyecto** de un proyecto existente — tanto el diálogo como **Archivo → Info del proyecto**.

Ese mismo selector tiene también **+ Nueva biblioteca de recursos…**, que le permite crear una sobre la marcha sin tener que ir antes a Archivo → Biblioteca. **Ninguna (proyecto independiente)** es una opción explícita en esa misma lista — desvincular su proyecto nunca es un efecto secundario accidental, siempre es algo que elige deliberadamente.

## La pestaña Recursos: dos vistas

En cuanto un proyecto está vinculado a una biblioteca, la pestaña Recursos obtiene un interruptor arriba a la derecha con dos vistas:

- **Biblioteca** — gestionar la fuente en sí. Todo aquí es directamente editable, un cambio se aplica de inmediato a **todos** los proyectos que beben de esta biblioteca, y queda fuera de deshacer (Ctrl+Z) — no es una edición de proyecto.
- **Proyecto** — lo que este proyecto realmente utiliza: la tabla de proyecto habitual, con marcas por fila para la procedencia y cualquier desviación.

Si trabaja con varios proyectos abiertos que beben todos de la misma biblioteca, existe además una tercera vista: **Ocupación**. Muestra, por recurso de biblioteca, dónde está reservado a través de *todos* los documentos abiertos, y señala los días en que la suma de esas reservas supera la capacidad de la empresa — la doble reserva entre proyectos, que ningún proyecto puede ver por sí solo. Lea la guía [Resumen de ocupación](docs://gids-bezettingsoverzicht).

## Tres tipos de filas en la vista de proyecto

En la vista de proyecto se encontrará con tres tipos de filas:

1. **De la biblioteca** — marcadas con la etiqueta **De la biblioteca**. El nombre, el tipo, la tarifa/hora y la unidad se heredan de la biblioteca y se muestran aquí como texto plano: no se editan aquí, sino en la vista **Biblioteca**. Las unidades máx., la capacidad escalonada en el tiempo y la elección de calendario sí son libremente editables, en cambio — eso es precisamente la implicación de este proyecto en concreto.
2. **Propias del proyecto** — sin etiqueta, totalmente editables. Incluso un proyecto vinculado puede tener filas así: útiles para elementos puntuales que no pertenecen a la biblioteca compartida, como una grúa alquilada o un subcontratista contratado solo para este trabajo.
3. **Huérfana** — el original de la biblioteca ha desaparecido; la fila se marca como **ya no está en la biblioteca**. La copia en sí sigue funcionando con normalidad — puede desvincularla o eliminarla.

## Qué sigue a la biblioteca — y qué no

Esta es la parte que vale la pena recordar: algunos campos son un acuerdo de toda la empresa y siguen a la biblioteca; otros son la implicación de este proyecto en concreto y usted los establece libremente, sin que eso cuente nunca como una desviación.

**Sigue a la biblioteca:**
- Nombre
- Tipo
- Descripción
- Tarifa/hora
- Unidad
- El **contenido** de un calendario que viajó junto con un recurso (días laborables, horas, festivos)

**Usted decide por proyecto, sin que cuente como desviación:**
- Unidades máx.
- La capacidad escalonada en el tiempo
- La **elección** de qué calendario está vinculado al recurso

Asigne un recurso de la biblioteca, y su calendario viaja junto como una copia vinculada que a su vez sigue siguiendo a la biblioteca — por eso el *contenido* de ese calendario aparece arriba, en **Sigue a la biblioteca**. Pero la *elección* de qué calendario está vinculado a un recurso aparece en **Usted decide por proyecto**: la misma cuadrilla puede funcionar con un calendario distinto para un trabajo urgente del que usa normalmente, sin que eso sea una desviación de la biblioteca. Esta distinción es sutil pero importante: cambie la tarifa o el nombre de un recurso de la biblioteca, y la copia se desvía de la biblioteca; cambie su elección de calendario o las unidades máx., y estará haciendo exactamente para lo que ese campo está pensado.

## Tres acciones que conectan los dos mundos

- **Asignar al proyecto** — de la biblioteca al proyecto: crea una copia editable con procedencia.
- **A la biblioteca** — de una fila propia del proyecto a la biblioteca compartida: la vincula de inmediato. Si ya existe un elemento con el mismo nombre en la biblioteca, la aplicación se vincula a ese en lugar de duplicarlo.
- **Desvincular de la biblioteca** — la procedencia desaparece, todo vuelve a ser totalmente editable. Un calendario que había viajado junto se desvincula con él, a menos que otro recurso todavía vinculado use ese mismo calendario.

## Actualización y desviaciones

La aplicación comprueba en cuatro momentos fijos si sus copias siguen coincidiendo con la biblioteca: al **abrir** un archivo, al **cambiar** de documento, después de una **edición en la biblioteca**, y después de una **recuperación tras un cierre inesperado**.

- Si una copia simplemente se ha quedado atrás (usted no la ha cambiado, pero la biblioteca sí ha avanzado desde entonces), se **actualiza en silencio** — solo verá un breve aviso, sin ninguna pregunta.
- Si una copia se ha cambiado localmente (o la ha cambiado otra persona), aparece la marca **difiere — decidir**, y la aplicación pregunta por cada elemento qué debe pasar: **Usar valores de la biblioteca**, **Adoptar los valores del archivo en la biblioteca**, o **Decidir más tarde**.

Estas decisiones no se pueden deshacer con Ctrl+Z — la segunda opción cambia la biblioteca misma, que queda por completo fuera del historial de deshacer del proyecto.

## Compartir y copia de seguridad

Un archivo de proyecto siempre es autónomo por completo: entrégueselo a alguien sin su biblioteca, y todo sigue funcionando, solo que sin una fuente compartida. Una biblioteca se exporta e importa mediante **Archivo → Biblioteca** — eso es también su copia de seguridad.

Al importar, elige entre dos opciones:

- **Añadir como nueva biblioteca de recursos** — la biblioteca del archivo simplemente se añade, como biblioteca extra junto a las que ya tiene, y nunca sobrescribe nada suyo. Si quien la envió ya había separado antes una segunda biblioteca propia (por ejemplo, para un subcontratista aparte), esa biblioteca lleva consigo su propia identidad: un proyecto enviado junto con ella reconoce de inmediato como elementos de biblioteca las cuadrillas y calendarios que ya estaba usando, sin que usted tenga que revisar nada. Si quien la envió solo tenía una biblioteca, nunca separada — el caso habitual de la mayoría de la gente —, ese reconocimiento automático no se activa: usted mismo vincula entonces el proyecto recibido a la nueva biblioteca, una sola vez, tras lo cual la coincidencia por nombre se encarga del resto. Si ya tiene exactamente esa misma biblioteca, se añade en su lugar como una copia aparte junto a la que ya tiene.
- **Reemplazar una biblioteca de recursos existente** — todo el contenido de la biblioteca que elija se sobrescribe con lo que hay en el archivo. Si su propia versión es más reciente que la que está importando, la aplicación le avisa de ello de antemano.

Qué opción viene preseleccionada depende del archivo: si la aplicación todavía no reconoce la biblioteca, está seleccionado "Añadir como nueva biblioteca de recursos"; si la reconoce (la misma biblioteca, una versión distinta), está seleccionado "Reemplazar una biblioteca de recursos existente" con esa biblioteca ya elegida.

Las bibliotecas no se sincronizan solas entre equipos: si dos planificadores trabajan con la misma biblioteca en ordenadores distintos, las bibliotecas pueden divergir.

## Biblioteca de recursos de demostración en los ejemplos

Abra uno de los ejemplos de muestra (**Archivo → Ejemplos**, o desde este panel de Ayuda), y la aplicación crea una vez una **Demo-resourcebibliotheek** y vincula a ella el ejemplo abierto. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) y [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) comparten las mismas cuadrillas de esa biblioteca, así que puede ver de inmediato cómo una biblioteca alimenta a varios proyectos. Sus propias bibliotecas de recursos existentes quedan completamente intactas.

## Siga leyendo

- Asignar recursos, leer el histograma y nivelar son cosas que giran todas en torno al lado del proyecto en los recursos — lea la guía [Recursos, histograma y nivelación](docs://gids-resources-histogram).
- El calendario vinculado de un recurso usa los mismos bloques de construcción que cualquier otro calendario — lea la guía [Calendarios y planificación por horas](docs://gids-kalenders-uren).
- Vea usted mismo cuadrillas compartidas entre proyectos en [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) y [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
