# Opciones de nivelación

La ventana **Nivelar recursos** resuelve la sobreasignación desplazando tareas. Funciona en dos pasos: **Calcular** construye una propuesta (nada cambia todavía), **Aplicar** la ejecuta.

## Abrir

**Recursos** → grupo de la cinta **Nivelación** → **Nivelar…**. **Esc**, la cruz de cierre o un clic fuera de la ventana cierra sin aplicar.

## Opciones

- **Nivelar solo dentro de la holgura (suavizado) — la fecha de fin del proyecto no cambia** — al marcarla, la nivelación solo desplaza tareas dentro de su holgura total: la fecha de fin no puede moverse, pero entonces no todos los conflictos se pueden resolver. Sin marcar (por defecto), la fecha de fin del proyecto puede alargarse para resolver todos los conflictos.
- **Recursos** — una casilla por recurso: qué recursos participan. Los recursos de material están ausentes aquí (el material no se nivela). Todos los recursos están activados por defecto.

## Calcular

Requiere un cálculo actualizado; en caso contrario, la ventana muestra "Calcula la planificación (F5) antes de nivelar." El botón también está desactivado mientras no haya ningún recurso marcado. Cualquier cambio de opción invalida una propuesta anterior — calcule de nuevo.

## Propuesta (vista previa)

- **Línea de fecha de fin del proyecto** — "sin cambios (fecha)" o "fecha antigua → fecha nueva" (rojo) si el proyecto se alarga.
- **Tabla** — por tarea desplazada: **Tarea**, **Inicio anterior**, **Nuevo inicio** y **Días desplazados**. También se incluyen las sucesoras sin recurso que se desplazan a través de la lógica.
- Si no hay nada que hacer, la ventana informa "Ninguna tarea necesita moverse — la planificación ya está libre de conflictos."

## Conflictos restantes

Tareas que no encajan dentro de las reglas, con el número de días de conflicto y un motivo por tarea:

- "… alcanza un pico de … unidades/día, la capacidad es … — no se puede resolver desplazando." — una asignación exige más en su pico que la capacidad del recurso; reduzca las unidades/día o aumente las Unidades máx.
- "El recurso no trabaja todos los días que necesita esta tarea — desplazarla no resuelve esto." — desajuste de calendario entre la tarea y el recurso.
- "No hay suficiente capacidad libre dentro de la holgura para resolver este conflicto." — sobre todo con el suavizado: no hay margen libre dentro de la holgura disponible.

## Aplicar y deshacer

**Aplicar** ejecuta la propuesta y cierra la ventana; **Cancelar** cierra sin cambios. Deshaga una nivelación aplicada con **Borrar nivelación** (mismo grupo de la cinta) o Ctrl+Z.

## Siga leyendo

- [Recursos, histograma y nivelación](docs://gids-resources-histogram) — detectar la sobreasignación en el histograma y el flujo de trabajo completo de nivelación.
