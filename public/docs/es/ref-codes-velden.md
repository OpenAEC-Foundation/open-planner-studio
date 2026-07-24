# Códigos y campos (diálogo de estructura)

La ventana **Códigos y campos** gestiona las definiciones de estructura del proyecto: **códigos de actividad** (dimensiones libremente definibles como Ubicación o Disciplina) y **campos personalizados** (campos de usuario tipados). Los valores por tarea se rellenan luego mediante el panel de propiedades o el [diálogo de tarea](docs://ref-taakdialoog).

## Abrir

**Planificación** → grupo de la cinta **Estructura** → **Códigos y campos**. **Esc**, la cruz de cierre o un clic fuera de la ventana la cierra. Todos los cambios surten efecto de inmediato (y se pueden deshacer con Ctrl+Z) — no hay un botón de guardado aparte.

## Códigos de actividad

"Dimensiones libremente definibles (por ejemplo Ubicación, Disciplina) para agrupar y filtrar — como máximo un valor por tipo por tarea."

Un bloque por tipo de código:

- **Nombre del tipo de código** — editable directamente.
- **Eliminar tipo de código** (papelera) — elimina el tipo, incluidos todos los valores y las asignaciones en las tareas.
- Una fila por valor: **Código** (etiqueta corta), **Descripción** y un selector de **Color** (colorea las agrupaciones, entre otras cosas), más un botón de eliminar.
- **Añadir valor** — nuevo valor bajo este tipo.

Al pie: campo de entrada **Nuevo tipo de código (ej. Ubicación)** + botón **Añadir tipo de código** (Intro también funciona).

## Campos personalizados

"Campos de usuario tipados, visibles como columnas en la tabla y editables por tarea."

Una fila por campo: el **nombre** (editable directamente), el **tipo** (solo lectura después de crearlo) y un botón de eliminar.

Al pie: campo de entrada **Nuevo campo (ej. Contratista)**, un selector de tipo — **Texto**, **Número**, **Número entero**, **Coste**, **Fecha** o **Sí/no** — y el botón **Añadir campo** (Intro también funciona). El tipo no se puede cambiar después de crearlo; cree un nuevo campo si es necesario.

## Dónde aparecen las definiciones

- Como la sección de entrada **Códigos y campos** por tarea, en el panel de propiedades y en el diálogo de tarea.
- Como columnas en la vista de tabla (campos personalizados) y como dimensión de agrupación/filtro (códigos de actividad).

## Siga leyendo

- [Planificación y WBS](docs://gids-plannen-wbs) — estructurar una planificación, incluidos los códigos y campos en la práctica.
