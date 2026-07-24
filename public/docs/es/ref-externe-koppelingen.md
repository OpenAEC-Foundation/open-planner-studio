# Enlaces externos

La ventana **Enlace externo (entre proyectos)** registra una dependencia entre una tarea de este proyecto y una tarea de un archivo de proyecto distinto — por ejemplo un proyecto de obra vial que debe terminar antes de que empiece el suyo.

## Abrir

Pestaña **Relaciones** → botón **Enlace externo…**. Debe estar seleccionada exactamente una tarea; en caso contrario aparece "Seleccione una sola tarea para añadir un enlace externo."

## El anclaje congelado

Un enlace externo no calcula en vivo contra el proyecto de origen. Al añadirlo, la fecha relevante de la tarea de origen (inicio o fin, según la dirección y el tipo de relación) se guarda como una **fecha de anclaje** fija; el cálculo usa esa fecha como límite. Si el proyecto de origen cambia después, nada se desplaza hasta que **actualice** el enlace.

## Dos vías

- **Archivo de origen** — elija un archivo bajo **Elegir un archivo reciente**; se lee en modo solo lectura ("El archivo de origen se lee solo en modo lectura — no se abre como documento."). Luego elija la **Tarea de origen** de la lista; la fecha de anclaje se lee automáticamente de esa tarea y se muestra al pie. Esta vía requiere la aplicación de escritorio y al menos un archivo reciente.
- **Manual (alternativa)** — sin archivo a mano (o en la versión de navegador): pegue el **Id de proyecto** y el **Id de tarea** de la tarea externa, opcionalmente un **Nombre de la tarea**, e introduzca usted mismo la **Fecha de anclaje**. Un enlace manual se marca "obsoleto" hasta que una actualización realmente encuentre el origen.

## Campos compartidos

- **Dirección** — **Predecesora (externa → yo)**: la tarea externa determina mi tarea; o **Sucesora (yo → externa)**: mi tarea determina la externa.
- **Tipo de relación** — FS, SS, FF o SF.
- **Retraso (días laborables)** — tiempo de espera (o negativo: solape) además del anclaje.

**Añadir enlace** guarda el enlace (desactivado hasta que se rellenen los campos obligatorios); **Cancelar** cierra sin añadir.

## Gestión, actualización y orígenes ausentes

Los enlaces existentes se listan en el panel de Relaciones bajo **Enlaces externos**:

- Por enlace: la tarea de origen, el tipo, el anclaje, y una etiqueta de **obsoleto** en cuanto el origen no se pudo cargar (más) — con la explicación "origen no cargado — reimporte para actualizar".
- **Actualizar este enlace** — vuelve a leer el archivo de origen de este único enlace y actualiza el anclaje.
- **Actualizar anclajes externos** — vuelve a leer cada archivo de origen referenciado y actualiza todos los anclajes más el estado obsoleto. Después, una línea de estado informa de cuántos anclajes se actualizaron y cuántos siguen obsoletos.
- **Eliminar** — elimina el enlace.
- Actualizar implica leer archivos y por tanto solo funciona en la aplicación de escritorio; la versión de navegador indica "Leer archivos de origen solo es posible en la aplicación de escritorio; use la alternativa manual."

## Siga leyendo

- [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse) — cómo alimentan los enlaces externos la ruta crítica.
