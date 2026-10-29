# Elegir o crear un perfil de cálculo

Objetivo: decidir qué reglas de cálculo usa un proyecto. Elija un perfil integrado o cree un perfil propio con sus propias convenciones.

## Cuándo lo necesita

Usted abre un proyecto que debe calcularse como Primavera P6 o Microsoft Project, o desea ajustar una convención de forma distinta a la del perfil. Qué es un perfil y por qué pueden cambiar las fechas se explica en [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen).

## Pasos

### Elegir un perfil para un proyecto nuevo

1. Elija *Inicio › Archivo › Nuevo*. Se abre la ventana *Nuevo proyecto*.
2. En la lista desplegable *Perfil de cálculo*, elija el perfil: *Open Planner Studio*, *Primavera P6* o *Microsoft Project*.
3. Cree el proyecto. La aplicación sustituye las opciones de cálculo que ya había rellenado por los valores predeterminados del perfil.

### Cambiar el perfil de un proyecto existente

1. Elija *Configuración › Proyecto › Ajustes del proyecto*. También puede elegir *Archivo › Ajustes del proyecto*.
2. En el bloque *Perfil de cálculo y opciones*, abra la lista desplegable *Perfil de cálculo* y elija otro perfil.
3. Haga clic en **Aplicar**. La aplicación recalcula la planificación de inmediato, aunque *Calcular automáticamente* esté desactivado. Si se han movido tareas, la aplicación indica cuántas.

Hasta que haga clic en *Aplicar*, el cambio solo existe en el formulario. Todo el cambio cuenta como un solo paso de *Deshacer*. Cambiar el perfil solo cambia las convenciones; sus opciones de cálculo se mantienen igual.

### Crear un perfil propio

1. En el bloque *Perfil de cálculo y opciones*, haga clic en *Nuevo perfil*, junto a la lista desplegable.
2. Introduzca un nombre. La aplicación propone *Copia de* seguido del perfil elegido, por ejemplo *Copia de Open Planner Studio*.
3. Haga clic en *Crear*. La sección *Convenciones de este perfil* se despliega.
4. Active o desactive las convenciones con las casillas de verificación. El icono i tras una línea muestra la explicación de esa convención. Una convención que difiere de la base recibe la etiqueta *volver a la base*.
5. Haga clic en **Aplicar**. Solo entonces el proyecto se calcula con el perfil nuevo.

Los tres perfiles integrados no se pueden cambiar. Sus convenciones se muestran solo a título informativo.

### Guardar un perfil propio como plantilla

1. Si hace falta, dé otro nombre al perfil propio en el campo *Nombre de este perfil propio*.
2. Haga clic en *Guardar como plantilla*. La aplicación indica que la plantilla se guardó o por qué no se pudo.
3. En otro proyecto de la misma aplicación, la plantilla aparece en la lista desplegable *Perfil de cálculo*.

Si más tarde el perfil difiere de la plantilla, un bloque amarillo lo indica. Entonces elija *Actualizar la plantilla desde este proyecto* o *Actualizar desde la plantilla*.

Elimine una plantilla con *Eliminar plantilla*. La aplicación pide confirmación antes.

## Comprobar el resultado

- El bloque *Perfil de cálculo y opciones* muestra el perfil elegido.
- Tras *Aplicar*, la aplicación indica las tareas movidas, por ejemplo *Tras aplicar, se movieron 4 tareas.*
- Un bloque naranja encima de las opciones de cálculo indica que sus opciones difieren del predeterminado del perfil. Eso suele ser a propósito. Si de todos modos quiere el predeterminado, haga clic en *Usar la configuración predeterminada de …*.

## Puntos de atención y qué hace la aplicación

**Las fechas cambian.** Otro perfil puede cambiar las fechas reales. Compruebe el resultado. Si no le gusta, elija *Deshacer*: el perfil y las fechas vuelven atrás juntos.

**Un bloque amarillo tras *Deshacer*.** Si pulsa *Deshacer* o *Rehacer* mientras *Ajustes del proyecto* está abierto, el bloque sigue el estado del proyecto. Si usted ya había cambiado algo en el bloque, su elección se mantiene. Entonces un bloque amarillo indica que *Aplicar* vuelve a poner esa elección.

**Puede haber 100 plantillas como máximo.** Si ya hay 100, la aplicación no guarda la plantilla y lo indica. Elimine antes una plantilla. Si el almacenamiento de la aplicación está lleno o no está disponible, también aparece un mensaje.

**Las plantillas pertenecen a la aplicación, el perfil al proyecto.** El proyecto siempre lleva su propia copia del perfil. Si cambia la plantilla más tarde, el proyecto no cambia con ella.

**Ajustes de un archivo de origen.** Si elige *Primavera P6* o *Microsoft Project* para un proyecto que viene de otro archivo, los ajustes del archivo de origen se mantienen. Aquí no puede cambiarlos.

## Véase también

- [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen): qué es un perfil y qué hace con las fechas.
- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): todas las convenciones y opciones de cálculo de un vistazo.
- [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen): Retained Logic o Progress Override, aparte del perfil.
