# Información del proyecto

La ventana **Información del proyecto** contiene los metadatos del proyecto más la sección **Cálculo** con las opciones de planificación. El mismo formulario también actúa como asistente de proyecto para **Nuevo**.

## Abrir

- **Configuración** (pestaña de la cinta) → grupo de la cinta **Proyecto** → **Info del proyecto**.
- Ventana de configuración (engranaje ⚙) → pestaña **General** → **Información del proyecto...**
- **Archivo** → **Info del proyecto** — una variante simplificada en el Backstage, solo con los campos de metadatos (sin la sección Cálculo).

**Aplicar** confirma todos los cambios a la vez; **Cancelar**, **Esc** o un clic fuera de la ventana los descarta. **Intro** hace lo mismo que Aplicar.

## Metadatos

- **Nombre del proyecto** — el nombre en la barra de título y en la pestaña de documento.
- **Descripción** — texto libre.
- **Ingeniero** y **Empresa** — texto libre; se guardan en el archivo IFC.
- **Fecha de inicio** — el inicio del proyecto a partir del cual cuenta el cálculo.
- **Fecha de fin** — fin informativo del proyecto.

## Cálculo

Opciones de planificación para este proyecto — se guardan con el archivo, no con la aplicación, así que viajan a otras máquinas. Si cambia algo aquí, la planificación se recalcula automáticamente tras **Aplicar**.

- **Definición de crítico** — **Holgura total ≤ umbral** (con **Umbral (días laborables)**, por defecto 0) o **Ruta más larga**.
- **Cálculo de holgura** — **Menor (inicio/fin)** (por defecto), **Holgura de inicio** u **Holgura de fin**.
- **Tareas de extremo abierto críticas** — marca como críticas las tareas sin sucesora.
- **Marcar casi crítico** — al marcarla, revela un **Umbral** adicional (por defecto 2 días laborables; la unidad sigue la visualización de duración, así que posiblemente horas): las tareas con poca holgura obtienen la marca de "casi crítica".
- **Múltiples rutas de holgura** — al marcarla, revela el **Método** (**Holgura libre (peeling)** u **Holgura total (clasificación)**) y **Rutas máx.** (por defecto 10): el cálculo entonces numera las rutas de holgura más importantes.
- **Calendario de retraso** — qué calendario cuenta el desfase de una relación: **Predecesora** (por defecto), **Sucesora**, **24 horas** o **Calendario del proyecto**.

Cómo leer estos resultados se cubre en [Ruta crítica y análisis avanzado](docs://gids-kritiek-pad-analyse).

## El asistente de proyecto (Nuevo)

**Nuevo** abre la misma ventana como asistente (título **Nuevo proyecto**, botón **Crear**). Además de los campos de metadatos, el asistente contiene:

- **Plantilla de fases** — **Vacío**, **Construcción residencial** o **Edificación / renovación**: rellena el nuevo proyecto con una estructura de fases.
- **Turno** — solo visible con la planificación por horas activada: **Turno de día** (por defecto), **2 turnos**, **3 turnos** o **24/7**.
- **Conjunto de festivos** — genera el calendario del proyecto: elija un país (con región y vacaciones de construcción donde corresponda), **Sin festivos**, o **Personalizado…** — esta última abre el diálogo de calendario justo después de la creación para que pueda componer el calendario a mano. Vea [Diálogo de calendario](docs://ref-kalenderdialoog).

La sección Cálculo está ausente del asistente; configúrela después mediante una de las entradas de arriba.
