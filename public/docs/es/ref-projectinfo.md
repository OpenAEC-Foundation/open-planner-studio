# Nuevo proyecto y Ajustes del proyecto

Los campos de la ventana *Nuevo proyecto* y de *Ajustes del proyecto*: qué hace cada campo, cuál es el valor predeterminado y dónde surte efecto. Son dos partes del mismo formulario. *Nuevo proyecto* crea un proyecto nuevo y tiene algunos campos adicionales. *Ajustes del proyecto* cambia el proyecto que tiene abierto.

## Apertura

**Nuevo proyecto** — *Archivo › Nuevo*, Ctrl+N, o el botón + a la derecha de las pestañas del documento (*Iniciar un proyecto*, y después *Nuevo proyecto*). La ventana se abre con el cursor en *Nombre del proyecto*.

**Ajustes del proyecto** — *Configuración › Proyecto › Ajustes del proyecto* abre el formulario como una ventana con el título *Ajustes del proyecto*. *Archivo › Ajustes del proyecto* muestra el mismo formulario en la pantalla *Archivo*. El bloque *Perfil de cálculo y opciones* está al final en ambos sitios; lo que contiene se explica en [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies).

## Crear, Aplicar y cancelar

**Crear** (en *Nuevo proyecto*) crea el proyecto. Si su pestaña actual está vacía y sin cambios, la aplicación usa esa pestaña; si no, el proyecto se abre en una pestaña nueva. **Aplicar** (en *Ajustes del proyecto*) incorpora sus cambios al proyecto.

- **Solo al aplicar.** Escribe en un borrador. El proyecto cambia solo cuando hace clic en *Aplicar*. *Aplicar* incorpora solo lo que de verdad cambió, en un solo paso en *Deshacer*. Si hace clic en *Aplicar* sin cambiar nada, no pasa nada y no se añade ningún paso.
- **Cancelar, la cruz y Esc** cierran la ventana sin guardar nada. Un clic junto a la ventana no la cierra: lo que escribió se conserva.
- **Intro** hace lo mismo que *Crear* o *Aplicar*, excepto en el campo *Descripción* y en una lista desplegable abierta.
- **En la pantalla Archivo** *Ajustes del proyecto* muestra *Cambios no aplicados: haga clic en Aplicar para conservarlos.* al final, mientras su borrador sea distinto. Si después sale de la pantalla, la aplicación pregunta si quiere aplicar, descartar o cancelar. Consulte [La cinta, pestaña por pestaña](docs://ref-lint).
- **Un perfil de cálculo personalizado sin nombre** bloquea *Aplicar* y *Crear*. Póngale un nombre o descarte el cambio.

## Campos en ambas ventanas

**Nombre del proyecto** — el nombre del proyecto en la barra de título, en la pestaña y en el nombre del archivo al guardar. Predeterminado: vacío. Un campo vacío está permitido: el proyecto se llama entonces *Nueva planificación*, que aparece como texto gris en el campo. Dónde: en toda la pantalla.

**Descripción** — texto libre. Predeterminado: vacío. Efecto: se guarda con el proyecto, en el archivo IFC y en la exportación a Primavera P6 XML, y no influye en la planificación.

**Autor** — texto libre. Predeterminado: vacío. Efecto: pasa al archivo IFC y aparece como *Autor:* en el encabezado de un informe, donde no se puede escribir de nuevo.

**Biblioteca de recursos** — la biblioteca de recursos a la que está vinculado el proyecto. Elija entre *ninguna (proyecto independiente)*, sus bibliotecas existentes y *+ Nueva biblioteca de recursos…*. Predeterminado: en *Nuevo proyecto* la biblioteca predeterminada; en *Ajustes del proyecto* el vínculo actual. Efecto: véase [Uso de la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken). Con *+ Nueva biblioteca de recursos…* escribe un nombre en un campo de abajo; la biblioteca solo se crea al hacer clic en *Crear* o *Aplicar*, así que al cancelar no queda nada. Un vínculo en *Ajustes del proyecto* solo cambia si usted mismo modifica este campo.

**Cliente/organización** — texto libre. Predeterminado: vacío. Efecto: pasa al archivo IFC y aparece como *Empresa:* en el encabezado de un informe.

**Fecha de inicio** — el inicio del proyecto. Predeterminado: en *Nuevo proyecto*, hoy. Lo que hace el campo está más abajo, en *Qué hace la fecha de inicio*.

**Fecha de fin** — el fin previsto del proyecto. Predeterminado: vacío. Efecto: es un dato informativo, no un requisito: la aplicación no planifica hacia esta fecha. Aparece en el encabezado de un informe y en las exportaciones, y determina hasta qué año se generan los festivos. Solo en un archivo de Primavera con el ajuste *Calcular la holgura hasta la fecha de fin del proyecto* (véase [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies)) el cálculo de holgura llega hasta esta fecha.

**Unidad predeterminada para tareas nuevas** — solo visible cuando *Activar planificación por horas* está activado. Elija entre *Días* y *Horas*. Predeterminado: *Días*. Efecto y condiciones: véase [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).

**Perfil de cálculo y opciones** — en *Ajustes del proyecto*, todo el bloque; en *Nuevo proyecto* solo la lista desplegable *Perfil de cálculo* con *Primavera P6*, *Microsoft Project* y *Open Planner Studio*. Predeterminado: *Open Planner Studio*. Al elegir un perfil también se fijan las opciones predeterminadas de ese perfil. Consulte [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies).

## Solo en Ajustes del proyecto

**Esquema IFC al guardar** — qué esquema IFC aparece en el encabezado del archivo guardado. Elección entre *IFC 4.3 ADD2 (predeterminado)*, *IFC 4.3* e *IFC4*. Predeterminado: *IFC 4.3 ADD2 (predeterminado)*; para un archivo IFC abierto, el esquema de ese archivo. Efecto: solo cambia el encabezado del archivo, no el contenido. Úselo para combinar la planificación con un modelo de edificio en el mismo esquema. Si un archivo abierto tiene otro esquema que el predeterminado, la aplicación pregunta la primera vez que guarda si quiere conservar ese esquema; una elección aquí cuenta como respuesta. Otra elección aquí no es un paso en *Deshacer*: el esquema pertenece al archivo. Consulte [Elegir el esquema IFC](docs://howto-ifc-schema-kiezen).

## Solo en la ventana Nuevo proyecto

**Plantilla de fases** — con qué fases empieza el proyecto. Elija entre *Vacío*, *Construcción residencial* y *Edificación / renovación*. Predeterminado: *Vacío*. Efecto: *Vacío* crea un proyecto sin tareas. Las otras dos opciones preparan ocho tareas de fase, cada una con una duración de 5 en la unidad predeterminada del proyecto (5 días laborables, o 5 horas si elige *Horas* en *Unidad predeterminada para tareas nuevas*) y sin relaciones; usted mismo las renombra, las mueve y las amplía. Para *Construcción residencial* son estas: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking y Oplevering. Para *Edificación / renovación*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen y Oplevering. Los nombres son datos de su proyecto y se quedan en neerlandés, también con otro idioma de interfaz. Si *Activar el modo construcción* está desactivado, solo existe *Vacío*. Consulte [Ajustes de la aplicación](docs://ref-instellingen).

**Turno** — solo visible cuando *Activar planificación por horas* está activado. Elija entre *Turno de día*, *2 turnos*, *3 turnos* y *24/7*. Predeterminado: *Turno de día*. Efecto: *Turno de día* deja el calendario estándar tal como está, un calendario de día normal de lunes a viernes. Los otros tres colocan bandas de horario laboral en el calendario del proyecto, como los botones del mismo nombre en la ventana *Calendarios*. Qué horas son esas se explica en [Definir los horarios laborales](docs://howto-werktijden-instellen). Con *Turno de día* no se puede elegir *Horas* en *Unidad predeterminada para tareas nuevas*, porque un calendario de día no tiene bandas.

**Conjunto de festivos** — qué días festivos recibe el calendario del proyecto. En *País* elija *Países Bajos* (predeterminado), *Alemania*, *Bélgica*, *Francia*, *Reino Unido*, *Austria*, *Suiza*, *Sin festivos* o *Personalizado…*. Si el país tiene regiones, se añade una lista desplegable *Región*. En el caso de los Países Bajos también elige, si *Activar el modo construcción* está activado, las *Vacaciones de construcción*: *Ninguna* (predeterminado), *Norte*, *Centro* o *Sur*. Debajo aparece una línea como *36 festivos, 2025–2029*, que se despliega para ver la lista. Los años van desde el año anterior a la fecha de inicio hasta el año posterior a la fecha de fin, o hasta tres años después del año de inicio si no hay fecha de fin. *Personalizado…* crea un calendario sin festivos y abre la ventana *Calendarios* justo después de crear el proyecto, para que usted mismo los rellene. El calendario del proyecto se llama *Bouwkalender NL*, o *Standaardkalender* si *Activar el modo construcción* está desactivado; la elección es entonces también *Sin festivos*. Cómo funciona el generador se explica en [Generar festivos y vacaciones de construcción](docs://howto-feestdagen-genereren).

## Qué hace la fecha de inicio

La fecha de inicio es el ancla del proyecto. Tres reglas:

- **Las tareas nuevas comienzan en la fecha de inicio.** Una tarea que añade recibe el inicio del proyecto como inicio planificado.
- **Una tarea con predecesora nunca comienza antes de la fecha de inicio.** Si el fin de la predecesora es anterior, la tarea espera hasta la fecha de inicio. Una tarea *sin* predecesora conserva su propia fecha, aunque esa fecha sea anterior a la fecha de inicio. Eso hace falta para mostrar una planificación de MS Project o Primavera como la muestra el programa de origen. Una restricción *Debe comenzar el (MSO)* o *Debe finalizar el (MFO)* rompe las dos reglas: una tarea así se queda en su fecha, aunque esa fecha sea anterior a la fecha de inicio.
- **Una fecha de inicio posterior mueve las tareas sueltas.** Si cambia la fecha de inicio a una fecha posterior en *Ajustes del proyecto* y hace clic en *Aplicar*, las tareas sin predecesora y sin restricción que fije un límite inferior (*No comenzar antes del (SNET)*, *Debe comenzar el*, *No finalizar antes del* o *Debe finalizar el*) que quede antes de la nueva fecha se mueven a esa fecha, en el mismo paso de *Deshacer*. La aplicación indica cuántas tareas se movieron. Eso solo pasa cuando usted cambia la fecha de inicio, nunca al abrir un archivo. Si cambia la fecha de inicio a una fecha posterior, el resto de la planificación no se mueve: eso lo hace *Mover proyecto*; véase [Mover un proyecto](docs://howto-project-verplaatsen).

## Véase también

- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): el bloque *Perfil de cálculo y opciones*.
- [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen): por qué un perfil cambia el resultado.
- [Mover un proyecto](docs://howto-project-verplaatsen): toda la planificación a otra fecha de inicio.
- [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen): cómo comenzar con las primeras tareas.
- [Generar festivos y vacaciones de construcción](docs://howto-feestdagen-genereren): el conjunto de festivos con detalle.
- [Elegir el esquema IFC](docs://howto-ifc-schema-kiezen): guardar para un modelo de edificio en IFC4.
