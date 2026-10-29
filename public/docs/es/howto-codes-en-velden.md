# Códigos y campos personalizados

Objetivo: añadir sus propias clasificaciones (códigos de actividad, como *Ubicación*) y sus propios campos (como *Contratista*) a sus tareas.

## Cuándo lo necesita

Además de los datos fijos de una tarea (nombre, duración, relaciones, …) puede añadir datos propios. Si quiere clasificar las tareas por ala norte y ala sur, por disciplina, o llevar un registro de qué contratista realiza una tarea, lo registra usted mismo. Hay dos formas, y la diferencia importa.

Un **código de actividad** es una clasificación con una lista de selección fija. Crea un **tipo de código** (por ejemplo *Ubicación*) con **valores** (*N* para el ala norte, *Z* para el ala sur). Una tarea recibe como máximo un valor por tipo de código.

Un **campo personalizado** (debajo de *Campos personalizados* en la ventana) es un campo de entrada libre con un tipo: *Texto*, *Número*, *Número entero*, *Coste*, *Fecha* o *Sí/no*. El campo puede tener un valor distinto en cada tarea.

## Pasos

### Definir códigos y campos

1. Elija *Planificación › Estructura › Códigos y campos*.
2. **Crear un tipo de código.** Debajo de *Nuevo tipo de código (ej. Ubicación)* escriba el nombre y pulse Intro, o haga clic en *Añadir tipo de código*.
3. **Añadir valores.** Debajo del tipo de código, haga clic en *Añadir valor*. La aplicación pone allí un código provisional, por ejemplo *V1*. Cámbielo en la casilla *Código* (corto, como lo escribiría usted: *N*). Si hace falta, rellene *Descripción* (*Ala norte*) y elija un *Color*. Un cambio se aplica en cuanto sale de la casilla o pulsa Intro.
4. **Crear un campo personalizado.** Debajo de *Nuevo campo (ej. Contratista)* escriba el nombre, elija el tipo y haga clic en *Añadir campo* (o pulse Intro).

La ventana no tiene botón Aceptar: cada cambio se aplica de inmediato. Después no puede cambiar el tipo de un campo, solo su nombre. Si quiere otro tipo, cree un campo nuevo.

### Introducir un código o un campo en una tarea

Hay dos lugares.

- **En el panel *Propiedades*** (o en la ventana que abre con F2). Abajo está el bloque *Códigos y campos*: una lista de selección por tipo de código y una entrada por campo. El bloque solo aparece cuando hay al menos un tipo de código o un campo.
- **Como columna en la tabla de tareas.** Haga clic en el **+** a la derecha del encabezado de la tabla (*Añadir columna*) y, en *Personalizado*, elija el tipo de código o el campo. En la celda de un tipo de código escriba el código, por ejemplo `N`, o elija de la lista. Un código que no existe muestra el mensaje *Elija un valor de este código de actividad*.

### Cómo usarlos

Puede usar un tipo de código o un campo personalizado para filtrar, agrupar y ordenar. Lo configura con un diseño: *Vista › Diseño › Nuevo diseño*. En la ventana, marque las partes que quiere incluir. Con *Guardar* obtiene un botón en *Vista › Diseño* en el que puede hacer clic de nuevo más tarde. Con *Aplicar sin guardar* solo lo muestra en pantalla ahora. Al agrupar, las tareas sin valor van en *(ninguno)*.

Para el color de las barras, elija *Vista › Líneas base y progreso › Colores de barras*, después *Por categoría* y el tipo de código. Cada barra recibe entonces el *Color* de su valor.

## Trampas y lo que hace la aplicación

**Eliminar borra los valores de las tareas.** Si elimina con la papelera un tipo de código, un valor o un campo, la aplicación no pide confirmación. Con ello desaparecen las asignaciones de todas las tareas. También se pierde una agrupación o una ordenación por ese tipo de código o campo. *Deshacer* (Ctrl+Z, cierre primero la ventana) restaura el tipo de código, el valor o el campo y los valores introducidos, pero no la agrupación ni la ordenación: debe configurarlas de nuevo.

**Dos valores con el mismo código.** *Añadir valor* continúa la numeración a partir del número de valores que hay. Si elimina uno y añade otro, un código puede aparecer dos veces. Si escribe ese código en una celda de columna, la aplicación lo rechaza con *Este valor de código de actividad aparece varias veces. Elíjalo de la lista*. Dé a cada valor su propio código.

**Las plantillas no incluyen códigos ni campos.** Consulte [Guardar e insertar plantillas de WBS](docs://howto-wbs-sjablonen). Si pega tareas en otro documento, la aplicación borra los códigos y campos que no existen allí y se lo indica.

**Un campo de fecha no se desplaza.** Si mueve todo el proyecto, los campos personalizados de tipo *Fecha* con valor se quedan en su fecha. La aplicación lo advierte en la vista previa.

## Véase también

- [Ajustar la estructura](docs://howto-structuur-aanpassen): el árbol de WBS, la otra forma de organizar las tareas.
- [Mover un proyecto](docs://howto-project-verplaatsen): qué pasa con las fechas cuando mueve el proyecto.
- [Crear y usar un diseño](docs://howto-layouts-gebruiken): agrupar y filtrar por un código o un campo personalizado.
- [Ajustar las columnas de la tabla](docs://howto-tabelkolommen-aanpassen): mostrar un código o un campo personalizado como columna.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): los códigos de actividad *House* y *Discipline*, el campo personalizado *Cost estimate* y notas (abiertas y completadas).
