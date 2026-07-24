# Guardar y cargar layouts

Un layout es una configuración de vista guardada: las columnas, la agrupación, el orden, el filtro y la escala de tiempo en un solo paquete. Los layouts son globales de la aplicación (en este dispositivo) — no pertenecen a un único archivo de proyecto, así que puede usarlos en cualquier documento.

## Abrir

**Vista** → grupo de la cinta **Layout**. Contiene un selector con sus layouts y tres botones:

- **Guardar como…** y **Gestionar…** — ambos abren la ventana **Gestionar layouts** (más abajo).
- **Actualizar** — sobrescribe el layout elegido en el selector con la vista actual; desactivado mientras esté seleccionado **(ninguno)**.

Elegir un layout en el selector lo aplica de inmediato.

## La ventana Gestionar layouts

Sin layouts guardados, la ventana muestra "Aún no hay layouts guardados." En caso contrario, una fila por layout con:

- **Nombre** — editable directamente en la fila (renombrar).
- **Aplicar** (marca de verificación) — pide confirmación primero: "¿Aplicar el layout …? Esto reemplaza las columnas/agrupación/orden/filtro/escala actuales."
- **Actualizar** — sobrescribe el layout con la vista actual, sin confirmación.
- **Eliminar** (icono de papelera) — pide confirmación primero.

Las confirmaciones aparecen como un pequeño diálogo dentro de la aplicación; **Esc** o **Cancelar** las cancela.

## Guardar layout como…

Al pie de la ventana: escriba un **Nombre** y haga clic en **Guardar** — la vista actual se guarda como un nuevo layout y pasa a ser el activo. Sin un nombre, el layout recibe el nombre predeterminado "Nombre".

## Qué captura un layout

- Columnas (visibilidad, orden, ancho) — vea [Elegir columnas](docs://ref-kolommen).
- Agrupación y orden (**Vista** → **Agrupar…** / **Ordenar…**).
- El filtro — vea [Filtros](docs://ref-filters).
- La escala de tiempo del Gantt.

No incluido: detalles del nivel de zoom, anchos de panel y selecciones.
