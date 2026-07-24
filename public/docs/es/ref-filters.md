# Filtros

La ventana **Filtro** controla qué tareas son visibles — en el Gantt y en la pestaña Tabla. Un filtro consiste en reglas (campo + operador + valor), opcionalmente agrupadas en grupos.

## Abrir

**Vista** → grupo de la cinta **Visualización** → **Filtro…**. El botón permanece resaltado mientras haya un filtro activo. **Esc**, la cruz de cierre o un clic fuera de la ventana cierra sin aplicar.

## Grupos: todo o cualquiera

En la parte superior de cada grupo elige cómo se combinan sus reglas:

- **Todo lo siguiente (AND)** — una tarea debe cumplir todas las reglas.
- **Cualquiera de lo siguiente (OR)** — con cumplir una regla basta.

**+ regla** añade una regla; **+ grupo** (solo en el nivel superior) añade un grupo anidado, para que pueda combinar AND y OR — por ejemplo "Crítica es sí AND (Tipo es Construcción OR Tipo es Instalación)". Sin reglas, la ventana muestra: "Aún no hay reglas — este filtro coincide con todo."

## Una regla: campo, operador, valor

- **Campo** — todos los campos de tarea: WBS, Nombre de tarea, Duración, Inicio, Fin, Tipo, Crítica, Holgura total, Progreso, Hito, Holgura libre, Holgura interferente, Casi crítica, Ruta de holgura y Recursos, además de los códigos de actividad y campos personalizados del proyecto.
- **Operador** — se adapta al tipo de campo:
- texto: **es igual a**, **no es igual a**, **contiene**, **empieza por**, **está vacío**;
- número y fecha: además **menor que**, **menor o igual que**, **mayor que**, **mayor o igual que** y **entre** (con **Desde**/**Hasta**);
- campos sí/no (como Crítica y Hito): una elección **Sí**/**No**;
- campos de elección (como Tipo o un código de actividad): **es uno de**, con valores marcables.
- **Valor** — la entrada sigue el tipo de campo (cuadro de texto, número, fecha o selector); **está vacío** no tiene entrada de valor.

El icono de papelera detrás de una regla elimina esa regla; la cruz en la esquina superior derecha de un grupo anidado elimina todo el grupo.

## Aplicar, cancelar y borrar

- **Aplicar** activa el filtro y cierra la ventana. Un filtro sin reglas cuenta como "sin filtro".
- **Cancelar** cierra sin aplicar los cambios.
- **Borrar** desactiva de inmediato el filtro activo y vacía el editor.

Un filtro activo forma parte de un layout guardado — vea [Guardar y cargar layouts](docs://ref-layouts).

## Siga leyendo

- [Elegir columnas](docs://ref-kolommen) — qué columnas muestra la tabla.
