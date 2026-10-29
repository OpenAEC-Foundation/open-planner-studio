# Conectar un asistente de IA (MCP)

Objetivo: que un asistente de IA lea y trabaje en su planificación, con visibilidad de lo que hace y con límites que usted mismo define.

## Cuándo lo necesita

Usted quiere que un asistente de IA lea, analice o cambie su planificación. Por ejemplo, que elabore una primera WBS, corrija tareas o explique la ruta crítica. Eso funciona a través del **Model Context Protocol** (MCP): un estándar que permite a un asistente de IA usar herramientas de un programa. Para ello, Open Planner Studio ejecuta un servidor pequeño en su propio equipo, el **puente**. Ofrece un conjunto de herramientas, todas con un nombre que empieza por `planner_`: leer y cambiar tareas, relaciones, recursos, calendarios, líneas base, documentos y archivos. Cuáles hay y qué rechazan está en [Herramientas de IA](docs://ref-ai-tools); por qué el enlace funciona así está en [Cómo funciona el enlace con la IA](docs://uitleg-ai-koppeling).

El puente solo funciona en la aplicación de escritorio. Si activa el modo IA en el navegador, sí ve la pestaña *IA*, pero el botón *Iniciar puente* está en gris con el texto *El puente solo funciona en la aplicación de escritorio.* El resto de este artículo trata de la aplicación de escritorio. En el navegador, *Crear copia de seguridad ahora* y *Abrir carpeta de copias de seguridad* también están en gris.

## Pasos

### 1. Active el modo IA

1. Elija *Configuración › Proyecto › Configuración*. También puede elegir *Archivo › Configuración*, o el engranaje de la parte superior.
2. Elija la pestaña *Avanzado* y active *Activar modo IA*. Aparece la pestaña *IA* en la cinta.
3. Si quiere que el puente esté activo en cuanto se inicie la aplicación, active también *Iniciar el puente automáticamente*. Eso solo tiene efecto cuando el modo IA está activado y solo en la aplicación de escritorio. Viene desactivado de forma predeterminada, porque abrir un puerto es una decisión deliberada.

Si desactiva el modo IA, el puente se detiene y desaparece la pestaña *IA*.

### 2. Inicie el puente

1. Vaya a la pestaña *IA* y haga clic en *Iniciar puente* bajo *Servidor*.
2. Mire el estado junto al botón. Dice *Desactivado*, *Activo en el puerto 3877*, *Puerto 3877 ocupado* o *Error*. Si el inicio tiene éxito, dice *Activo en el puerto 3877* y el botón se llama *Detener puente*. Con *Puerto 3877 ocupado* o *Error* el botón sigue en *Iniciar puente*; consulte los problemas frecuentes.

El puente solo escucha en su propio equipo, en un puerto. El valor predeterminado es 3877. En el grupo *Conexión* puede elegir otro en *Puerto*, pero solo mientras el puente está detenido.

### 3. Conecte el asistente

1. Haga clic en *Conectar* bajo *Conexión*. Se abre la ventana *Detalles de conexión*.
2. Elija lo que necesita su cliente; vea abajo.
3. El token está oculto. Con el icono del ojo lo muestra. Los botones de copiar siempre copian el valor real, aunque la pantalla oculte el token.
4. Pida al asistente que solicite la lista de herramientas. Esa comprobación también está en la indicación de conexión: debe ver las herramientas con el prefijo `planner_`; el número esperado está en la indicación de conexión.

La ventana ofrece tres formas de conectar:

- *Fragmento de configuración*: un fragmento de configuración que pega en la configuración MCP de su cliente.
- *Indicación de conexión*: un texto que pega en su asistente de IA, tras lo cual se conecta por sí mismo.
- *Punto de conexión* y *Autenticación*: los datos por separado. El punto de conexión es `http://localhost:3877/mcp` con transporte *streamable HTTP*. Cada solicitud necesita un encabezado `Authorization: Bearer` seguido de su token. Su cliente también debe admitir sesiones de MCP: al conectarse, el puente entrega un código de sesión en el encabezado `Mcp-Session-Id`, y rechaza toda solicitud posterior sin ese código. Claude Code y `mcp-remote` lo hacen por sí solos.

**Vuelva a conectar después de una actualización de la aplicación.** Si su cliente de IA ya estaba conectado a una versión anterior de la aplicación, todavía no envía un código de sesión, y el puente rechaza cada solicitud. Por eso, vuelva a conectar tras la actualización: inicie una sesión nueva en Claude Code, y cierre Claude Desktop por completo y vuelva a iniciarlo.

**Claude Code.** El fragmento de configuración encaja directamente en Claude Code. Ejecute este comando en una terminal, con su propio token en lugar de `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

También puede poner el fragmento en el archivo `.mcp.json` de la carpeta de su proyecto. En ese caso, no incluya ese archivo en git, porque el token da acceso a su plan. Un servidor de `.mcp.json` debe aprobarse la primera vez en Claude Code.

**Claude Desktop.** El fragmento de configuración no encaja directamente en Claude Desktop. En el archivo `claude_desktop_config.json` se nombra un programa que Claude Desktop inicia por sí mismo, no una dirección. Por eso use en medio la herramienta externa `mcp-remote`; necesita Node.js. En Claude Desktop elija *Configuración › Desarrollador › Editar configuración*, ponga esto en el archivo (con su propio token) y vuelva a iniciar Claude Desktop:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

El token va en `env` y no en `args` a propósito: en Windows, Claude Desktop rompe un argumento que contiene un espacio. Un *conector personalizado* en Claude (*Personalizar › Conectores*) no funciona con el puente. Claude se conecta entonces desde la nube de Anthropic, y esa nube no puede llegar al puente en su propio equipo.

En el grupo *Conexión* también está el campo *Token*. Es un código largo y aleatorio que la aplicación crea para usted y guarda en este equipo. En la ventana dice *Este token da acceso al plan abierto. No lo compartas con otras personas.* Con el icono *Nuevo token* crea un token nuevo. La aplicación primero pregunta *Generar un nuevo token rompe todas las conexiones existentes. ¿Continuar?* Si el puente está en marcha, se reinicia con el token nuevo y el anterior deja de funcionar.

### 4. Vea lo que hace la IA

1. Haga clic en *Panel de actividad* bajo *Actividad*. En la columna lateral se abre el panel *Actividad de IA*.
2. Cada llamada del puente es una línea, la más nueva arriba: hora, qué pasó, cuánto tardó y si tuvo éxito o no. Haga clic en una línea para desplegar *Argumentos* y *Respuesta*.
3. Con *Borrar* vacía la lista. El panel guarda las últimas 500 llamadas. Mientras no haya pasado nada, dice *Todavía no hay actividad de IA. Las llamadas del puente aparecerán aquí.*

Con el modo IA activado, hay un punto con *IA* abajo a la derecha de la barra de estado. Su color muestra el estado del puente, y si hace clic en él, va a la pestaña *IA*.

### 5. Ponga límites

Bajo *Seguridad* están los botones con los que limita la IA:

- *Pausar*: la IA no puede cambiar nada de forma temporal; la lectura sigue permitida. El puente sigue activo. El botón cambia a *Reanudar*.
- *Solo lectura*: se rechazan todas las herramientas que cambian algo mientras esto esté activado.
- *Copia de seguridad automática: activada*: antes del primer cambio de la IA en un documento, la aplicación escribe una copia de seguridad IFC. Está activada de forma predeterminada. Con el botón la desactiva; entonces dice *Copia de seguridad automática: desactivada*. Esto ocurre una vez por documento cada vez que inicia el puente.
- *Crear copia de seguridad ahora*: hace una copia de seguridad del documento activo en ese momento. Después dice *Copia de seguridad creada:* con el nombre del archivo.
- *Abrir carpeta de copias de seguridad*: abre la carpeta con las copias de seguridad.

Las copias de seguridad están en la carpeta `ai-backups` en la carpeta de datos de la aplicación. La aplicación guarda las copias recientes y reduce el número de las más antiguas; cómo exactamente está en [Herramientas de IA](docs://ref-ai-tools).

### 6. Haga que el asistente planifique bien

Un asistente solo planifica bien si conoce las reglas de planificación. El artículo [Cómo funciona el enlace con la IA](docs://uitleg-ai-koppeling) explica por qué eso importa y qué contienen. Esto es lo que usted hace:

1. **No tiene que hacer nada por las reglas básicas.** Llegan al conectar. Si su cliente las incluye en sus instrucciones de sistema, depende del cliente.
2. **Haga que el asistente lea la guía.** La indicación de conexión de la ventana *Detalles de conexión* pide al asistente que lea la guía con la herramienta `planner_get_planning_guide`. Si no usa la indicación, pídalo usted mismo: *Lea primero la guía de planificación con planner_get_planning_guide, antes de cambiar nada.* Usted mismo puede leer la guía en `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opcional: instale las skills.** Esto solo funciona con un asistente que admita skills. Ponga el `SKILL.md` de *goed-plannen* y *progress-update* en `.claude/skills/goed-plannen/SKILL.md` y `.claude/skills/progress-update/SKILL.md` en la carpeta del proyecto donde trabaja el asistente, o en las mismas carpetas bajo `~/.claude/skills/` para todos los proyectos.

Puede obtener los archivos de dos formas. Pida al asistente que llame a la herramienta `planner_get_planning_guide` con `part` igual a `skill`: la respuesta contiene ambos textos y, para cada skill, los lugares donde debe ir. O descárguelos desde `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` y `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Si *goed-plannen* sigue ahí de una versión anterior de la aplicación, sustitúyala: ese texto antiguo está en neerlandés y remite al artículo de ayuda en lugar de a la guía para asistentes.

Puede ver en el *Panel de actividad* si el asistente leyó de verdad la guía: entonces hay una llamada a `planner_get_planning_guide`. La respuesta final debería contener una lista de supuestos: duraciones estimadas, el desglose elegido, las relaciones que creó por su cuenta y cada restricción que fijó. Si falta esa lista, pídala. Tras una actualización de avance según *progress-update*, la respuesta debería nombrar la fecha de estado, la nueva fecha de fin y la variación frente a la línea base.

## Problemas frecuentes y lo que hace entonces la aplicación

**La IA cambia algo que usted quiere deshacer.** Cada cambio de la IA es un paso que deshace con *Deshacer* (Ctrl+Z). Una serie de cambios que la IA entrega como un conjunto es un solo paso. Después, el proyecto aparece como sin guardar. Tras un cambio, la planificación se recalcula, así que no tiene que pulsar F5 usted mismo.

**La aplicación rechaza una llamada de la IA.** Con *Pausar* y *Solo lectura* la aplicación rechaza todos los cambios; la lectura sigue siendo posible, incluida la acción de recalcular una planificación desactualizada. Si usted está en medio de una edición, por ejemplo arrastrando una barra o escribiendo en un campo, la IA recibe las fechas de antes de su edición con un aviso de que están desactualizadas. Si tiene abierto un diálogo, por ejemplo la configuración, un diálogo de tarea o la ventana de bienvenida, o si el modo presentación está activado, la aplicación rechaza todas las llamadas, incluida la lectura, hasta que cierre el diálogo. La IA recibe entonces un mensaje de error con el nombre interno de lo que está abierto, por ejemplo `showTaskDialog`. Solo sigue funcionando `planner_get_planning_guide`, porque no lee su planificación.

**Cambia de pestaña mientras la IA trabaja.** La IA trabaja en el documento donde se hizo su primer cambio. Si cambia de pestaña mientras tanto, la aplicación rechaza su siguiente cambio hasta que confirme que quiere trabajar en la otra pestaña. Así, nada acaba en el proyecto equivocado.

**La IA escribe o abre un archivo.** La IA puede escribir una planificación como archivo IFC y abrir un archivo de planificación como una nueva pestaña. Solo puede hacerlo dentro de su carpeta de usuario. Solo sobrescribe un archivo existente si lo pide explícitamente.

**El estado es *Puerto 3877 ocupado*.** Otro programa usa el puerto. Debajo aparece el mensaje de la aplicación. El campo del puerto queda entonces bloqueado (*Solo editable con el servidor detenido.*), aunque el puente no esté en marcha, y no hay botón de detener. Es una limitación conocida. Hasta que se corrija: desactive *Activar modo IA* y actívelo de nuevo. El estado vuelve entonces a *Desactivado* y puede elegir otro puerto. Después copie de nuevo los detalles de conexión, porque el punto de conexión contiene el puerto.

**El cliente no puede conectarse tras un token nuevo.** Un token nuevo rompe todas las conexiones existentes. Dé al cliente el token nuevo o pegue de nuevo el fragmento de configuración.

**Ha detenido el puente usted mismo y no se inicia solo.** *Iniciar el puente automáticamente* funciona una vez cada vez que se inicia la aplicación. Si detiene el puente usted mismo, la aplicación no lo vuelve a activar en silencio.

**La pestaña *IA* ha desaparecido.** El modo IA está desactivado. Actívelo en el paso 1.

**Una página web de su navegador no puede hablar con el puente.** El puente rechaza toda solicitud que venga de un navegador, y toda solicitud sin el token correcto.

## Ver también

- [Dar comentarios](docs://howto-feedback-geven): si la conexión funciona de otra forma a lo que aquí se describe, infórmelo.
- [Cómo funciona el enlace con la IA](docs://uitleg-ai-koppeling): qué es el enlace, por qué el asistente trabaja en su proyecto abierto y qué no puede hacer.
- [Herramientas de IA](docs://ref-ai-tools): todas las herramientas `planner_*` por grupo, los códigos de error y cuánto tiempo se guardan las copias de seguridad.
- [Planificar bien](docs://gids-goed-plannen): los principios de planificación; el asistente los recibe en una versión en inglés con las herramientas añadidas.
- [Configuración](docs://ref-instellingen): los ajustes de IA.
