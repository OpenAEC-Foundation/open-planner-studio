# Usar la biblioteca de recursos

Objetivo: usar recursos de la biblioteca de recursos en su proyecto, y llevar a la biblioteca un recurso que creó en un proyecto, para que todos los proyectos usen los mismos datos.

## Cuándo lo necesita

Tiene un equipo fijo de albañiles, una grúa y un yesero que aparecen en varios proyectos. Sin biblioteca, debe escribirlos de nuevo en cada proyecto. Así existe el riesgo de nombres y tarifas distintos, y ningún proyecto ve que otro también pide el mismo equipo. En la biblioteca los registra una sola vez.

Lea qué es la biblioteca y qué toma un proyecto de ella en [La biblioteca de recursos](docs://uitleg-resourcebibliotheek). Este artículo trata de las acciones. Crear, exportar y eliminar bibliotecas se explica en [Gestionar y compartir bibliotecas de recursos](docs://howto-bibliotheken-beheren).

## Pasos

### 1. Vincular el proyecto a una biblioteca

Solo puede trabajar con la biblioteca si el proyecto está vinculado a ella. Sin vínculo, el panel *Recursos* no muestra el selector *Biblioteca*, *Proyecto* y *Ocupación*.

Para un proyecto nuevo:

1. Elija *Archivo › Nuevo*. Se abre la ventana *Nuevo proyecto*.
2. Mire *Biblioteca de recursos*. El campo está ajustado a la biblioteca predeterminada. Puede elegir otra, *ninguna (proyecto independiente)* o *+ Nueva biblioteca de recursos*…
3. Haga clic en *Crear*.

Para un proyecto existente:

1. Elija *Archivo › Ajustes del proyecto*.
2. En *Biblioteca de recursos*, elija la biblioteca.
3. Haga clic en *Aplicar*. Hasta entonces, abajo aparece *Cambios no aplicados: haga clic en Aplicar para conservarlos.*

Si el proyecto ya tiene recursos con el mismo nombre que un elemento de la biblioteca, se abre la ventana *Vincular biblioteca de recursos* con la sección *Reconocer*. Cada recurso con coincidencia dice *Sugerencia: Bricklayer*. Haga clic en *Vincular* para vincular ese recurso, o en *Vincular todas las sugerencias* si hay más de una. La aplicación compara los nombres sin tener en cuenta mayúsculas ni espacios dobles. Al vincular, el recurso toma de la biblioteca el nombre, el tipo, la tarifa, la unidad y la descripción. *Unidades máx* se queda como lo tenía en el proyecto. La ventana también muestra los calendarios del proyecto que tienen el mismo nombre que un calendario de la biblioteca. Con *Decidir más tarde* cierra la ventana sin vincular.

### 2. Poner un recurso en la biblioteca

1. Elija *Recursos › Gestionar › Recursos*. El panel de recursos ocupa el área de trabajo. Siempre se abre en *Proyecto*, también en un proyecto vinculado.
2. Arriba a la derecha, elija *Biblioteca*. Encima de la tabla aparece *Esto edita la biblioteca y se aplica a todos los proyectos — fuera de deshacer.*
3. Haga clic en *Nuevo recurso en la biblioteca*. Aparece una fila vacía al final de la tabla.
4. Escriba el nombre, por ejemplo *Bricklayer*, y pulse Intro. El recurso ya está en la biblioteca y se abre enseguida una fila vacía para el siguiente. Pulse Esc cuando termine. Sin nombre, la aplicación no crea nada.
5. Rellene el resto de la fila. El valor predeterminado de *Tipo* es *Mano de obra*. En *Unidades máx* indique cuántos de este recurso hay en total, por ejemplo 3 para tres albañiles. El resumen de ocupación usa este número como capacidad. *Tarifa/hora* es opcional. Solo puede rellenar *Unidad* con el tipo *Material*. En *Calendario* elija un calendario de la biblioteca, o *+ Calendario de recurso* para crear uno; véase [Configurar un calendario de recursos](docs://howto-resourcekalender-instellen). La aplicación guarda el nombre, la tarifa y la unidad al salir del campo. Los demás campos se guardan enseguida.

Cada cambio en la biblioteca se aplica enseguida a las copias sin editar de sus proyectos abiertos.

### 3. Asignar un recurso a su proyecto

1. En la vista *Biblioteca*, elija *Asignar al proyecto* en el recurso. Encima de la tabla aparece *Añadido.* Si vuelve a hacer clic, aparece *Ya está en el proyecto.* y no se crea una segunda copia.
2. Elija *Proyecto*. La copia está en la tabla con un pequeño icono de biblioteca junto al nombre, con la etiqueta *De la biblioteca*. Nombre, tipo, tarifa y unidad son texto normal. Si pasa el ratón sobre ellos, verá *Valor de la biblioteca — edítalo en la vista Biblioteca, o desvincula este recurso de la biblioteca.*
3. Ajuste *Unidades máx* para este proyecto. El campo empieza con el valor de la biblioteca y sigue siendo editable en el proyecto.
4. Ahora asigne el recurso a tareas como cualquier otro recurso; véase [Asignar recursos con una curva](docs://howto-resource-toewijzen). *Recursos › Asignación › Asignar* solo muestra los recursos que ya están en el proyecto. Por eso, primero asigne así un recurso de la biblioteca al proyecto.

*Asignar al proyecto* solo existe en la vista *Biblioteca* de un proyecto que está vinculado a esa biblioteca.

### 4. Llevar un recurso de su proyecto a la biblioteca

Haga esto con un recurso que creó en el proyecto y usa con más frecuencia, por ejemplo una grúa alquilada.

1. En la vista *Proyecto*, elija *A la biblioteca* en el recurso. El botón solo aparece en un recurso que tiene nombre y que todavía no viene de la biblioteca, en un proyecto vinculado.
2. Lea el mensaje encima de la tabla.

El mensaje puede decir tres cosas:

- *Añadido.* La biblioteca no tenía ningún elemento con ese nombre. Se creó un elemento nuevo y su recurso quedó vinculado a él.
- *Ya existía en la biblioteca — ahora vinculado.* Había un elemento con el mismo nombre y los mismos datos. Su recurso queda vinculado a él.
- *Vinculado al elemento existente de la biblioteca — los valores difieren, consulta la marca.* Había un elemento con el mismo nombre pero con datos distintos. Su recurso queda vinculado y se marca enseguida con *difiere — decidir*. Continúe en el paso 6.

### 5. Desvincular una copia

Si quiere apartarse de la biblioteca en un proyecto, por ejemplo con otra tarifa, desvincule la copia.

1. En la vista *Proyecto*, haga clic en el icono *Desvincular de la biblioteca* al final de la fila.
2. El recurso ahora es un recurso normal del proyecto. Todos los campos son editables y ya no sigue a la biblioteca. El calendario que llegó con el recurso también se desvincula, salvo que otro recurso de este proyecto todavía lo siga.

Con *Deshacer* (Ctrl+Z) puede anular la desvinculación.

### 6. Resolver una desviación

Una copia que muestra *difiere — decidir* no coincide con el elemento de la biblioteca. La aplicación no decide cuál tiene razón.

1. Haga clic en la marca *difiere — decidir* del recurso. Se abre la ventana *Vincular biblioteca de recursos*. También se abre sola al abrir un archivo con una copia así.
2. En la sección *Desviaciones*, elija lo que quiere para el elemento; véase abajo.
3. Haga clic en *Decidir más tarde* si todavía no quiere elegir. La ventana se cierra y la marca se queda.

Para una desviación tiene dos opciones:

- *Usar valores de la biblioteca*: la copia recibe los datos de la biblioteca.
- *Adoptar los valores del archivo en la biblioteca*: la biblioteca recibe los datos de su copia. Debajo aparece *Atención: esto modifica la biblioteca y se aplica a todos tus proyectos.* Las copias de otros proyectos abiertos siguen el cambio.

## Problemas frecuentes y qué hace la aplicación entonces

**Los proyectos de ejemplo tienen una biblioteca propia.** Si abre uno de los tres ejemplos de muestra (*Archivo › Ejemplos*, o mediante un enlace en la Ayuda), la aplicación crea una vez la biblioteca *Biblioteca de recursos de demostración* y vincula el proyecto a ella. Los recursos del proyecto con el mismo nombre que un elemento de la biblioteca se vinculan enseguida; los calendarios no. Sus propias bibliotecas no se tocan. Si abre dos ejemplos a la vez, juntos muestran conflictos en [Usar el resumen de ocupación](docs://howto-bezettingsoverzicht-gebruiken), por ejemplo en el equipo de albañiles (*Masonry crew*) entre *Refurbishment & Extension of a Family Home* y *6 New Terraced Houses, De Akkers*.

**No ve el selector.** El proyecto no está vinculado a una biblioteca. Haga el paso 1.

**Modifica la biblioteca sin querer.** El panel siempre se abre en *Proyecto* para evitarlo. Los cambios en la vista *Biblioteca* se aplican a todos los proyectos y quedan fuera de *Deshacer*.

**Elimina un recurso de la biblioteca.** La aplicación primero pregunta *¿Eliminar «Bricklayer» de la biblioteca? Esto se aplica a todos los proyectos y no se puede deshacer.* Las copias en sus proyectos se quedan y siguen funcionando. Reciben la marca *ya no está en la biblioteca* y son totalmente editables. Con *Quitar del proyecto* saca una copia del proyecto.

**En Biblioteca de recursos, elija otra biblioteca o *ninguna (proyecto independiente)*.** Las marcas de origen de la biblioteca anterior desaparecen. Los recursos se quedan en el proyecto como recursos normales del proyecto. Con otra biblioteca, la aplicación vuelve a buscar recursos con el mismo nombre.

**Un recurso no tiene sugerencia en *Reconocer*.** Dice *Sin sugerencia — elija manualmente*, pero esta ventana no tiene botón para eso. Parece una carencia. Ponga ese recurso en la biblioteca con *A la biblioteca* (paso 4).

## Véase también

- [La biblioteca de recursos](docs://uitleg-resourcebibliotheek): qué decide la biblioteca, qué decide el proyecto y cómo siguen las copias los cambios.
- [Gestionar y compartir bibliotecas de recursos](docs://howto-bibliotheken-beheren): crear, exportar e importar bibliotecas.
- [Usar el resumen de ocupación](docs://howto-bezettingsoverzicht-gebruiken): ver si dos proyectos piden el mismo recurso a la vez.
- [Gestionar recursos](docs://howto-resources-beheren): los recursos de un solo proyecto.
