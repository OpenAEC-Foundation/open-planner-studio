# Importar avance desde una hoja

Objetivo: introducir de una vez en la planificación el avance que el personal de obra anota en una hoja de cálculo, sin hacer clic en cada tarea.

## Cuándo lo necesita

Un subcontratista o un jefe de obra no tiene la aplicación, pero informa de su estado cada semana: qué porcentaje está hecho, cuándo empezó y cuándo terminó. Usted le envía una hoja con sus tareas. Él rellena tres columnas y se la devuelve. De ella, la aplicación lee solo tres valores por tarea: finalización, inicio real y fin real. El resto de su planificación no cambia. Lo que la aplicación hace con ese avance se explica en [Avance, fecha de estado y línea base](docs://uitleg-voortgang).

## Pasos

### 1. Indique la fecha de estado y calcule

Indique la fecha de estado como se describe en [Actualizar avance](docs://howto-voortgang-bijwerken). El jefe de obra anota las fechas reales hasta ese día incluido. Si la planificación no está al día, la aplicación la recalcula antes de crear la hoja.

### 2. Cree la hoja

Elija *Planificación › Avance › Exportar hoja de avance*. El mismo botón está en las pestañas *Tabla* e *Informe*. La aplicación crea un archivo de Excel y propone el nombre *(nombre del proyecto)-voortgang.xlsx*. En el navegador, el archivo se guarda en sus descargas. ¿Prefiere un CSV? Elija *Archivo › Exportar › Hoja de avance (CSV)*. La hoja de Excel también está disponible, como *Hoja de avance (Excel)*.

La hoja tiene ocho columnas. Los nombres de las columnas quedan en inglés, con una breve instrucción en el idioma de la aplicación detrás:

- `OPS Task ID`, `WBS` y `Name` sirven solo para reconocer la tarea. No las modifique.
- `Start` y `Finish` son las fechas planificadas, para su información. La aplicación nunca las vuelve a escribir.
- `Completion (%)`, `Actual Start` y `Actual Finish` son las que usted rellena.

La hoja de Excel está protegida, sin contraseña: solo se pueden editar las tres columnas que se rellenan. Excel comprueba que un porcentaje esté entre 0 y 100 y que una fecha real sea una fecha. Una fase (tarea de resumen) aparece en gris con *— tarea resumen: no rellenar*.

### 3. Haga que el jefe de obra la rellene

Para cada tarea, el jefe de obra rellena:

- `Completion (%)`: de 0 a 100, incluido. La aplicación también lee decimales, con coma o con punto (por ejemplo 33,3 o 33.3). La instrucción del CSV sigue pidiendo números enteros: una hoja de cálculo con otra configuración regional puede leer 8,38 como 838.
- `Actual Start` y `Actual Finish`: en Excel, como fecha con la configuración regional de su equipo; en el CSV, como dd-mm-yyyy o como yyyy-mm-dd.

Lo que queda vacío no cambia nada. Así, una celda vacía tampoco borra el avance que ya existe; eso solo se puede hacer en la aplicación. Una tarea que no ha empezado se deja completamente vacía.

### 4. Leer la hoja

1. Elija *Planificación › Avance › Actualizar avance desde una hoja* (también en las pestañas *Tabla* e *Informe*), o *Archivo › Importar › Actualizar avance desde una hoja*. Se abre la ventana *Actualizar avance desde una hoja*.
2. Haga clic en *Elegir archivo*… y elija el archivo `.xlsx` o `.csv` rellenado.
3. Si las fechas de un CSV son ambiguas, la aplicación pregunta *¿Día primero o mes primero?*, con la fecha de su archivo leída de dos maneras. Haga clic en la fecha que es correcta.
4. Ahora ve una vista previa. Arriba hay cuatro contadores: *Aplicadas*, *Sin cambios*, *Esperando vínculo* y *Rechazadas*. Debajo, por tarea, se ve qué cambia, por ejemplo *Finalización: 0% → 100%*.
5. Revise la vista previa y haga clic en *Aplicar*. La ventana muestra *Resultado*, con los contadores y las filas que se rechazaron y por qué. Termine con *Cerrar*.

No puede saltarse la vista previa. El botón *Aplicar* está desactivado mientras no haya nada que aplicar.

### 5. Recalcular la planificación

La lectura no recalcula por sí sola. Pulse **Calcular** (F5), por ejemplo en *Planificación › Programación › Calcular*, salvo que *Calcular automáticamente* esté activado.

## Filas que no encajan sin más

La aplicación vincula cada fila con una tarea: primero por `OPS Task ID` y, si no es posible, por el número WBS.

**Vínculo dudoso.** Si la aplicación encontró la tarea solo por el número WBS, la fila aparece en *Vínculo dudoso*, con *Confirmar* y *Cambiar*. La fila se aplica igualmente si no hace nada; por eso compruebe que la tarea es la correcta. *Confirmar* saca la fila de esta lista; no cambia nada de lo que se aplica. *Cambiar* le permite elegir otra tarea. Con *Quitar vínculo* elimina un vínculo que usted mismo hizo. Nota: una hoja de otro proyecto con los mismos números WBS se vincula de todos modos, en *Vínculo dudoso*, y se aplica al hacer clic en *Aplicar*.

**Esperando vínculo.** Si la aplicación no encontró ninguna tarea, o encontró varias con el mismo número WBS, la fila aparece en *Esperando vínculo*. En *Elija una tarea*… elija la tarea correcta; busca por número WBS o por nombre. Si no la vincula, la fila se rechaza.

## Errores frecuentes y qué hace la aplicación

Una fila que no encaja se rechaza y se indica el motivo. El resto de la hoja sigue su curso. Estos son los mensajes principales:

- *La fecha real es posterior a la fecha de estado*. Indique una fecha de estado posterior o corrija la hoja.
- *Esta tarea está planificada para empezar después de la fecha de estado: indique primero su inicio real en la hoja*. La aplicación no inventa un inicio; indíquelo en la hoja.
- *Porcentaje fuera de 0–100. Compruebe el separador decimal: «8,38» puede leerse como 838 en una hoja de cálculo con otra configuración regional*.
- *Las tareas resumen no pueden recibir avance de una hoja*. El avance de una fase se deduce de las tareas que tiene debajo.
- *El fin real es anterior al inicio real*.
- *Fecha ilegible* y *Porcentaje ilegible*.
- *Los valores introducidos se contradicen*. Por ejemplo, un fin real con un porcentaje inferior a 100.
- *No se encontró ninguna tarea para esta fila*. La hoja menciona un ID de tarea y un número WBS que no existen en este proyecto.
- *Este código WBS aparece en varias tareas — vincula la fila manualmente*.
- *Otra fila ya reclamó esta tarea*. Dos filas apuntan a la misma tarea.
- *Rechazado por el planificador*. Otro rechazo de la propia planificación, sin mensaje propio.

Si se rechaza el archivo entero, aparece en la ventana uno de estos mensajes: *Este archivo no tiene columna «OPS Task ID» ni «WBS» para vincular filas con tareas*, *Este archivo no tiene ninguna de las columnas Finalización, Inicio real o Fin real*, *Este archivo es demasiado grande para leerlo como hoja de avance* (más de 16 MB), *Este archivo tiene demasiadas filas para leerlo como hoja de avance* (más de 50.000 filas), *Este archivo está protegido con contraseña y no se puede leer* o *Este archivo no se pudo leer como hoja de avance*.

**Sin fecha de estado.** Si todavía no hay fecha de estado y la importación aplica avance, la aplicación pone la fecha de hoy y se lo indica. Por eso indique usted la fecha antes.

**Todo en un solo paso.** Toda la hoja cuenta como un solo paso para Ctrl+Z.

**Solo lo que usted rellena.** Una fila sin diferencia con la planificación cuenta como *Sin cambios*. Una tarea sin fila en la hoja se queda como estaba.

## Vea también

- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): qué calcula la aplicación con fechas reales y porcentajes.
- [Actualizar avance](docs://howto-voortgang-bijwerken): cómo introducir el avance en la propia aplicación.
