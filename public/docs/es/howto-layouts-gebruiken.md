# Crear y usar un diseño

Objetivo: cambiar entre vistas de su planificación con un solo clic, por ejemplo solo las tareas críticas, las tareas por cuadrilla o otro orden.

## Cuándo lo necesita

En la reunión de obra, el cliente quiere ver solo las tareas críticas. Después, el jefe de obra quiere ver por cuadrilla quién se necesita y cuándo. Luego, usted quiere volver a ver toda la planificación. Volver a poner filtros, agrupaciones y órdenes una y otra vez es pesado. Un **diseño** guarda esa vista como un botón en la cinta.

Un diseño puede guardar seis cosas: el filtro, la agrupación, el orden, las columnas de la tabla de tareas junto al Gantt, la escala de tiempo, y las líneas de relación y superposiciones (línea base, línea de avance, línea de fecha de estado, énfasis de recurso, banda de holgura y colores de las barras). Al hacer clic en el botón, solo cambia lo que usted marque. El resto de su vista se queda igual.

Con un diseño, usted filtra, agrupa y ordena. Los botones separados *Filtro…*, *Agrupar…* y *Ordenar…* ahora solo existen tras un ajuste oculto (vea los errores habituales).

## Pasos

### Usar un diseño existente

1. Elija la pestaña *Vista*. En el grupo *Diseño* hay un botón por diseño. De forma predeterminada, ese es *Diagrama de recursos*.
2. Haga clic en él. *Diagrama de recursos* agrupa las tareas por recurso, ordena dentro de cada grupo por inicio y desactiva las líneas de relación. Una tarea con dos recursos aparece bajo los dos.
3. Haga clic de nuevo para desactivar el diseño. La vista vuelve a como estaba antes de su clic.

Cada clic es un paso para *Deshacer* (Ctrl+Z), tanto al activar como al desactivar.

### Crear un diseño propio

1. En el grupo *Diseño*, haga clic en *Nuevo diseño*. Se abre la ventana *Nuevo diseño*.
2. Escriba un *Nombre* y elija un *Icono*.
3. Debajo de *¿Qué guarda este diseño?* están las seis partes, cada una con una casilla. Una ventana nueva empieza con todas las partes marcadas y llenas con lo que hay ahora en su pantalla. Desmarque todo lo que el diseño no debe cambiar. Si solo quiere un filtro, deje marcado solo *Filtro*. *Tomar la vista actual* vuelve a llenar todas las partes con lo que ve en su pantalla.
4. Configure las partes.
5. Haga clic en *Guardar*.

El diseño ya es un botón en la cinta, pero todavía no está aplicado. Haga clic en el botón para activarlo.

### Configurar el filtro

En *Filtro* crea reglas. Haga clic en *+ regla*, elija un *Campo*, un *Operador* y un valor. Si solo quiere las tareas críticas: campo *Crítico*, operador *es igual a*, valor *Sí*. Los campos incluyen *Nombre de tarea*, *Inicio*, *Fin*, *Holgura total*, *Avance* e *Hito*, además de sus propios códigos de actividad y campos, y de *Recursos*. Los operadores dependen del tipo de campo: para texto puede elegir *contiene*; para números y fechas, *entre*.

Los operadores que obtiene dependen del tipo de campo:

- Texto (*Nombre de tarea*, *WBS*): *es igual a*, *no es igual a*, *contiene*, *empieza por* y *está vacío*.
- Número y fecha (*Holgura total*, *Inicio*, *Avance*): *es igual a*, *no es igual a*, *menor que*, *menor o igual que*, *mayor que*, *mayor o igual que*, *entre* y *está vacío*. Con *entre* hay dos campos: para un número, *Desde* y *Hasta* como texto de ayuda; para una fecha, sin texto de ayuda (la primera fecha es el inicio, la segunda el fin).
- Sí/no (*Crítico*, *Hito*, *Casi crítica*): *es igual a* y *no es igual a*, con el valor *Sí* o *No*.
- Lista de opciones (*Categoría de trabajo*, un código de actividad): *es igual a*, *no es igual a*, *es uno de* (con valores de casilla) y *está vacío*.
- *Recursos*: *es uno de* y *está vacío*.
- *En curso*: solo *entre*, con dos fechas (desde y hasta).

Con el campo *En curso*, el operador *entre* y dos fechas, obtiene todas las tareas que se ejecutan en algún momento de ese período, por ejemplo todo lo activo en junio.

Combine varias reglas con la lista de arriba: *Todo lo siguiente (AND)* muestra las tareas que cumplen todas las reglas; *Cualquiera de lo siguiente (OR)* muestra las tareas que cumplen al menos una regla. Con *+ grupo* añade un subgrupo con sus propias reglas.

El filtro mira las tareas en sí. Las fases (tareas de resumen) a las que pertenece una tarea siguen visibles en gris, así ve dónde encaja la tarea. Si además agrupa, esas fases grises desaparecen.

### Agrupar y ordenar

En *Agrupar* añada un campo con *+ nivel*. Hay como máximo dos niveles de agrupación. Sin agrupar, ve el árbol WBS. En *Ordenar* añada un campo con *+ nivel* y elija *Ascendente* o *Descendente*. Con dos niveles, el segundo decide cuando los valores del primero son iguales.

### Probar algo rápido sin botón

En la ventana, haga clic en *Aplicar sin guardar*. Las partes marcadas pasan a la pantalla, pero no se añade ningún botón. Eso sirve para un filtro que solo necesita una vez. Ctrl+Z lo deshace.

### Cambiar, copiar o eliminar un diseño

Haga clic con el botón derecho en el botón del diseño. Elija *Editar…*, *Duplicar* o *Eliminar*. *Eliminar* pide primero una confirmación. Una copia se llama *nombre (copia)*. No puede editar ni eliminar un diseño integrado, como *Diagrama de recursos*; lo duplica para crear su propia versión.

### Más de un diseño a la vez

Diseños que no guardan las mismas partes pueden estar activos a la vez. Si tiene un diseño que solo guarda el filtro *Crítico es igual a Sí* (por ejemplo, llámelo *Solo crítico*) y lo activa junto con *Diagrama de recursos* (agrupar, ordenar, líneas de relación), obtiene las tareas críticas por recurso. Si dos diseños guardan la misma parte, por ejemplo ambos un filtro, el segundo reemplaza al primero y el primero se desactiva. Si desactiva ese segundo de nuevo, vuelve a la vista de antes de su primer clic, no al primer diseño.

## Errores habituales y qué hace la aplicación

**Puede olvidar desmarcar partes.** Un diseño que también guarda las columnas, la escala de tiempo y las superposiciones vuelve a poner esas partes en su estado guardado en cada clic. Su zoom entonces salta, aunque solo quería un filtro. Compruebe en la ventana que solo estén marcadas las partes previstas.

**Una regla incompleta no muestra nada.** Si no elige un valor en un campo sí/no (sigue mostrando *—*) o deja vacías las fechas de *En curso*, ninguna tarea cumple la regla y la lista queda vacía. Complete la regla.

**Un cambio manual desactiva el diseño.** Si usted mismo cambia una parte que el diseño guarda, por ejemplo *Líneas de relación* mientras *Diagrama de recursos* está activo, ese diseño se desactiva y las demás partes vuelven a la vista de antes del diseño. Hacer zoom desactiva un diseño que guarda la escala de tiempo, y ensanchar una columna desactiva un diseño que guarda las columnas. El resto de la vista se queda como está. El *Diagrama de recursos* no guarda la escala de tiempo, así que el zoom no le afecta.

**Las columnas se aplican a la tabla de tareas junto al Gantt.** La parte *Columnas* guarda las columnas de la tabla a la izquierda del Gantt. La tabla de la pestaña *Tabla* conserva sus propias columnas. Cómo elegir columnas se explica en [Ajustar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen).

**Aplicar sangría y anular sangría están desactivados.** Mientras haya un filtro, una agrupación o un orden activo, el orden mostrado no es el orden de la planificación. *Aplicar sangría* y *Anular sangría* quedan desactivados, con el texto de ayuda *No disponible mientras se filtra/agrupa/ordena*. Desactive el diseño para volver a ajustar la estructura, como se describe en [Ajustar la estructura](docs://howto-structuur-aanpassen).

**La barra de estado no sigue el filtro.** *Tareas:* en la barra de estado muestra el número de tareas de todo el proyecto, aunque un filtro muestre solo una parte de ellas.

**Los diseños están en su dispositivo, no en el proyecto.** La aplicación guarda sus diseños y las columnas de todos sus proyectos en este dispositivo. Las superposiciones de un diseño (línea base, línea de progreso y las demás) se aplican a todos sus proyectos. El filtro, la agrupación y el orden que están activos ahora pertenecen al proyecto abierto, pero no se guardan en el archivo del proyecto: tras guardar y volver a abrirlo, la vista está limpia otra vez. Tampoco marcan el proyecto como modificado.

**Los botones separados están ocultos.** *Columnas…*, *Filtro…*, *Agrupar…* y *Ordenar…*, como botones separados en la pestaña *Vista*, son una vista antigua. Puede volver a mostrarlos con *Mostrar los botones de vista clásicos* en *Funciones heredadas* de la pestaña *Avanzado* de la ventana *Configuración* (⚙ en la barra de título). Prefiera los diseños.

## Véase también

- [Ajustar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen): elegir, mover y fijar las columnas en sí.
- [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken): llevar la vista al papel con *Seguir la vista*.
- [Ajustar la estructura](docs://howto-structuur-aanpassen): por qué no puede aplicar sangría mientras filtra.
