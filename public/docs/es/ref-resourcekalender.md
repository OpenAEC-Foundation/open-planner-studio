# Calendario de recursos

La ventana **Calendario del recurso** edita el calendario propio de un único recurso — por ejemplo una cuadrilla que trabaja cuatro días a la semana. El formulario es idéntico al [diálogo de calendario](docs://ref-kalenderdialoog); este artículo solo describe las diferencias.

## Abrir

- Abra el panel de recursos: **Recursos** → grupo de la cinta **Gestionar** → **Recursos** (panel completo) o **Dock de recursos** (anclado junto al Gantt).
- En la columna **Calendario** de un recurso, elija un calendario y haga clic en el icono de lápiz (**Editar…**) junto a él para editarlo; cree un nuevo calendario mediante el mismo desplegable.

## Diferencias con el diálogo de calendario

- **Un calendario a la vez** — sin lista de biblioteca a la izquierda, sin estrella de predeterminado del proyecto; solo el formulario.
- **Aplicar** guarda el calendario; **Cancelar**, **Esc**, la cruz de cierre o un clic fuera de la ventana descarta los cambios. Un calendario nuevo creado con **+ Calendario del recurso** en la lista desplegable solo existe tras **Aplicar** y entonces se vincula de inmediato al recurso (juntos, un solo paso de Deshacer); tras **Cancelar** no queda nada. Parte del mismo valor predeterminado que **+** en el diálogo de calendarios.
- **Sin recálculo automático** — **Aplicar** no recalcula la planificación. En su papel de calendario de recurso, un calendario no cambia las fechas CPM; cuenta para la carga (histograma) y la nivelación, que usted mismo vuelve a ejecutar con F5 o **Nivelar…** respectivamente. Sin embargo, la lista desplegable ofrece todos los calendarios del proyecto: si edita aquí un calendario que también es el calendario del proyecto o el de una tarea, la planificación sí cambia. Entonces se marca como desactualizada y F5 la recalcula.

## Campos

Vea el [diálogo de calendario](docs://ref-kalenderdialoog) para la referencia completa de campos: **Nombre**, **Días laborables** (con los preajustes Lun–vie y Continuo (24/7)), **Inicio (hora)** / **Fin (hora)** / **Horas por día**, la sección **Horarios de trabajo** (con la planificación por horas activada), **Generar festivos…** y la lista de **Festivos**.

## Siga leyendo

- [Calendarios y planificación por horas](docs://gids-kalenders-uren) — cuándo un calendario de recurso es la elección correcta.
- [Recursos, histograma y nivelación](docs://gids-resources-histogram) — cómo el calendario alimenta la carga y la nivelación.
