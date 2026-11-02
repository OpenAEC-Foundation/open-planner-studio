# Conexión de un cliente MCP

Objetivo: que un cliente MCP pueda seguir su planificación y trabajar en ella, con visibilidad de lo que hace y con límites que usted mismo define.

## Rápido: deje que Claude lo haga

¿Trabaja con Claude Desktop o con Claude Code? Entonces Claude puede instalar la conexión por sí mismo:

1. Pulse *Copiar prompt* más abajo.
2. Pegue el prompt en un chat nuevo con Claude y envíelo.

Claude instala entonces la extensión para Open Planner Studio y explica lo que hace por el camino. Si usted debe hacer algo por sí mismo, por ejemplo pulsar *Instalar* en Claude Desktop, Claude le indica exactamente qué clic debe hacer. Para ello no necesita ningún token.

```prompt
Instala por mí la extensión de Open Planner Studio, para que puedas leer y cambiar mis planificaciones de obra en Open Planner Studio. Haz tú todo lo que puedas. Antes de cada paso, di en una sola frase sencilla qué vas a hacer y por qué. Si me necesitas, pregunta una cosa cada vez y espera mi respuesta. Si tengo que hacer algo yo mismo, indícame exactamente qué clic o acción debo hacer, y dónde.

Lo que necesitas saber:
- La extensión es un único archivo, open-planner-studio-<version>.mcpb, de la versión más reciente publicada: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. El enlace directo está en https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (el archivo cuyo nombre termina en .mcpb). El archivo es un ZIP.
- La extensión funciona con la aplicación de escritorio Open Planner Studio y también sin la aplicación. Cuando la aplicación está abierta y el puente MCP de la aplicación se ejecuta, trabajas en la planificación abierta en la aplicación. Cuando la aplicación está cerrada, trabajas con archivos de planificación en una carpeta de trabajo que yo elijo.
- La instalación no necesita token ni contraseña. No me pidas uno, y no lo leas ni lo muestres.

Si funcionas en Claude Desktop:
1. Si puedes descargar un archivo y abrirlo en mi ordenador, hazlo con el archivo .mcpb. Si no puedes, dame el enlace directo de descarga e indícame que haga doble clic en el archivo cuando la descarga esté completa.
2. Claude Desktop muestra entonces la extensión Open Planner Studio. Indícame que haga clic en *Instalar*. Después indícame que elija la carpeta con mis archivos de planificación como carpeta de trabajo.
3. Indícame que abra un chat nuevo y que allí te pregunte qué herramientas de Open Planner Studio ves.

Si funcionas en Claude Code:
1. Comprueba que Node.js 22 o una versión más reciente esté instalado. Si no lo está, indícame cómo instalarlo, y detente.
2. Pregúntame qué carpeta contiene mis archivos de planificación. Esa es la carpeta de trabajo.
3. Descarga el archivo .mcpb y descomprímelo en una carpeta nueva y propia dentro de mi carpeta de usuario. Lee allí manifest.json: server.mcp_config indica cómo se inicia el servidor. Sustituye ${__dirname} por la carpeta descomprimida y ${user_config.workdir} por la carpeta de trabajo.
4. Ejecuta claude mcp list. Si ya existe un servidor con el nombre open-planner-studio, pregúntame si puedes reemplazarlo. No muestres sus ajustes, porque pueden contener un token.
5. Añade el servidor para mi cuenta de usuario, por ejemplo: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<carpeta de trabajo> -- node <carpeta descomprimida>/server/index.mjs
6. Indícame que abra una sesión nueva de Claude Code y que allí /mcp muestra si open-planner-studio está conectado.

Si funcionas en otro lugar, como claude.ai en el navegador, indícame que esto necesita Claude Desktop o Claude Code. Si no sabes dónde funcionas, pregúntame.

Cuando la instalación esté terminada, explica en unas pocas frases:
- cómo permito que trabajes en la aplicación abierta: en Open Planner Studio, elija Ajustes › Proyecto › Ajustes de la aplicación, pestaña Avanzado, y active Permitir conexión MCP. Después pulse Iniciar puente en la pestaña MCP.
- que sin la aplicación un cambio solo queda en el archivo después de guardarlo, y que no sobrescribes un archivo existente mientras la aplicación está abierta.
Si un paso falla, indícame en una frase qué salió mal y qué puedo hacer. No adivines.
```

¿Prefiere hacerlo usted mismo, o usa otro cliente MCP? Entonces siga los pasos de abajo.

## Cuándo lo necesita

Quiere que un cliente MCP lea, analice o cambie su planificación. Por ejemplo, para que redacte un primer WBS, corrija tareas o explique la ruta crítica. Eso funciona a través del **Model Context Protocol** (MCP): un estándar que permite que un programa de IA, el **cliente MCP**, use herramientas de otro programa. Para ello, Open Planner Studio ejecuta un servidor pequeño en su propio ordenador, el **puente**. Ofrece un conjunto de herramientas, todas con un nombre que empieza por `planner_`: leer y cambiar tareas, relaciones, recursos, calendarios, líneas base, documentos y archivos. Cuáles hay y qué rechazan está en [Herramientas MCP](docs://ref-ai-tools). El cliente MCP trabaja en el proyecto que tiene abierto, no en una copia: una tarea que añade aparece de inmediato en el Gantt. Usa el mismo cálculo y el mismo historial de *Deshacer* que usted.

El puente solo funciona en la aplicación de escritorio. Si permite la conexión MCP en el navegador, sí ve la pestaña *MCP*, pero el botón *Iniciar puente* aparece en gris con el texto *El puente solo funciona en la aplicación de escritorio*. El resto de este artículo trata de la aplicación de escritorio. En el navegador, *Crear copia de seguridad ahora* y *Abrir carpeta de copias de seguridad* también aparecen en gris.

## Pasos

### 1. Permitir la conexión MCP

1. Elija *Configuración › Proyecto › Ajustes de la app*. También puede elegir *Archivo › Configuración*, o el engranaje de la parte superior.
2. Elija la pestaña *Avanzado* y active *Permitir conexión MCP*. La pestaña *MCP* aparece en la cinta.
3. Si quiere que el puente esté activo en cuanto se inicie la aplicación, active también *Iniciar el puente automáticamente*. Esta opción solo tiene efecto si la conexión MCP está activada, y solo funciona en la aplicación de escritorio. Viene desactivada de forma predeterminada, porque abrir un puerto es una decisión deliberada.

Si desactiva la conexión MCP, el puente se detiene y la pestaña *MCP* desaparece.

### 2. Iniciar el puente

1. Vaya a la pestaña *MCP* y haga clic en *Iniciar puente* en el grupo *Servidor*.
2. Mire el estado junto al botón. Muestra *Desactivado*, *Activo en el puerto 3877*, *Puerto 3877 ocupado* o *Error*. Si el inicio se realiza correctamente, muestra *Activo en el puerto 3877* y el botón se llama *Detener puente*. Con *Puerto 3877 ocupado* o *Error*, el botón sigue siendo *Iniciar puente*; consulte los problemas habituales.

El puente solo escucha en su propio equipo, en un solo puerto. De forma predeterminada es el 3877. En el grupo *Conexión* puede elegir otro en *Puerto*, pero solo mientras el puente esté detenido. La conexión es HTTP sin cifrar en su propio equipo. La aplicación en sí no envía nada hacia fuera. Lo que el cliente MCP hace con su planificación, por ejemplo lo que hace su proveedor con ella, queda fuera de la aplicación.

### 3. Conectar el cliente MCP

1. Haga clic en *Conectar* en el grupo *Conexión*. Se abre la ventana *Detalles de conexión*.
2. Elija lo que necesita su cliente; vea más abajo.
3. El token está oculto. Con el icono del ojo lo muestra. Los botones de copia siempre copian el valor real, aunque la pantalla oculte el token.
4. Haga que el cliente MCP pida la lista de herramientas. Esa comprobación también está en la indicación de conexión: debe ver las herramientas con el prefijo `planner_`; el número esperado está en la indicación de conexión.

La ventana ofrece cuatro formas de conectar:

- *Deje que Claude lo haga*: la misma indicación que aparece al principio de este artículo, con el botón *Copiar prompt*. Es para Claude Desktop y Claude Code. Para esto no necesita un token.
- *Fragmento de configuración*: una parte de la configuración que se pega en los ajustes MCP de su cliente.
- *Indicación de conexión*: un texto que se pega en su cliente MCP, y después el cliente se conecta solo.
- *Punto de conexión* y *Autenticación*: los datos por separado. El punto de conexión es `http://localhost:3877/mcp` con transporte *streamable HTTP*. Cada solicitud necesita un encabezado `Authorization: Bearer` seguido de su token. Su cliente también debe admitir sesiones MCP: al conectarse, el puente entrega un código de sesión en el encabezado `Mcp-Session-Id`, y rechaza cada solicitud posterior sin ese código. Claude Code y `mcp-remote` lo hacen solos.

**Conecte de nuevo después de una actualización de la aplicación.** Si su cliente MCP ya estaba conectado a una versión anterior de la aplicación, todavía no envía un código de sesión, y el puente rechaza cada solicitud. Por eso, conecte de nuevo después de la actualización: inicie una sesión nueva en Claude Code, y cierre Claude Desktop por completo y vuelva a iniciarlo.

**Claude Code.** El fragmento de configuración encaja directamente en Claude Code. Ejecute este comando en una terminal, con su propio token en lugar de `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

También puede poner el fragmento en el archivo `.mcp.json` de la carpeta de su proyecto. En ese caso, no incluya ese archivo en git, porque el token da acceso a su plan. Un servidor de `.mcp.json` debe aprobarse la primera vez en Claude Code.

**Claude Desktop.** Para Claude Desktop hay una extensión: el archivo `open-planner-studio-<version>.mcpb`. Claude Desktop lo instala con un doble clic. Para esto no necesita Node.js. La extensión funciona con la aplicación y sin la aplicación. Es más rápido con la indicación del principio de este artículo; abajo están los pasos manuales.

1. Descargue el archivo `.mcpb` de la versión publicada más reciente: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Haga doble clic en el archivo. Claude Desktop se abre y muestra la extensión *Open Planner Studio*. Instálela. Si el doble clic no funciona, abra *Configuración › Extensiones* en Claude Desktop e instale allí el archivo.
3. En *Working folder*, elija la carpeta con sus archivos de planificación. Claude usa esta carpeta solo cuando la aplicación está cerrada. Entonces Claude lee y escribe solo en esa carpeta.
4. Active la extensión e inicie un chat nuevo. Pregunte a Claude qué herramientas de Open Planner Studio ve.

No tiene que introducir un token ni un puerto: mientras el puente está en marcha, la extensión encuentra la aplicación por sí sola. Para cada pregunta de Claude, la extensión elige de nuevo:

- *La aplicación está abierta y el puente está en marcha*: Claude trabaja en el plan que está abierto en la aplicación. Ve cada cambio en la aplicación de inmediato.
- *La aplicación está cerrada, o el puente está desactivado*: Claude trabaja con un archivo de planificación de la carpeta de trabajo. Un cambio solo queda en el archivo cuando Claude guarda el archivo. No hay guardado automático. Mientras la aplicación está abierta, Claude no sobrescribe un archivo existente, sino que guarda con un nombre nuevo.

Si la aplicación se abre o se cierra mientras Claude trabaja, la extensión cambia y se lo indica a Claude. Entonces Claude primero elige o abre de nuevo el plan, y solo después cambia algo. Si Claude todavía tiene cambios sin la aplicación que no están guardados, la extensión sigue trabajando sin la aplicación hasta que Claude los haya guardado. Así no se pierde ningún trabajo. Si la extensión no puede llegar a la aplicación y no hay una carpeta de trabajo utilizable, Claude solo ve la herramienta `open_planner_studio_status`, con un mensaje que le indica qué debe hacer.

**Claude Desktop sin la extensión.** Si no puede usar la extensión, conecte Claude Desktop con la herramienta externa `mcp-remote`. El fragmento de configuración no encaja directamente en Claude Desktop: en el archivo `claude_desktop_config.json` se indica un programa que Claude Desktop inicia por sí mismo, no una dirección. `mcp-remote` necesita Node.js. En Claude Desktop elija *Configuración › Desarrollador › Editar configuración*, coloque esto en el archivo (con su propio token) y vuelva a iniciar Claude Desktop:

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

El token está en `env` y no en `args` a propósito: en Windows, Claude Desktop rompe un argumento que contiene un espacio. Un *conector personalizado* en Claude (*Personalizar › Conectores*) no funciona con el puente. Entonces Claude se conecta desde la nube de Anthropic, y esa nube no puede llegar al puente en su propio equipo.

En el grupo *Conexión* también está el campo *Token*. Es un código largo y aleatorio que la aplicación crea para usted y guarda en este equipo. En la ventana dice *Este token da acceso al plan abierto. No lo compartas con otras personas.* Con el icono *Nuevo token* crea un token nuevo. La aplicación primero pregunta *Generar un nuevo token rompe todas las conexiones existentes. ¿Continuar?* Si el puente está en marcha, se reinicia con el nuevo token y el anterior ya no funciona.

**Cómo encuentra la extensión la aplicación.** Mientras el puente está en marcha, la aplicación de escritorio escribe el puerto y el token en el archivo `mcp/runtime.json` de la carpeta de datos de la aplicación. La extensión de Claude Desktop lee ese archivo en cada pregunta. En Linux y macOS, solo su cuenta de usuario puede leer el archivo. En Windows, la ACL predeterminada de su carpeta de perfil protege el archivo; la aplicación no lo comprueba por separado. Cuando detiene el puente o desactiva la conexión MCP, la aplicación elimina el archivo. La aplicación también guarda una lista de archivos abiertos en `mcp/open-files.json`, incluso cuando la conexión MCP está desactivada. Mientras ese archivo existe, la extensión y el servidor MCP sin interfaz no sobrescriben ningún archivo existente, tampoco un archivo que acaba de abrir y que todavía no está en la lista. Se permite un archivo nuevo. La lectura también está permitida: Claude entonces ve la versión en el disco, sin sus cambios que todavía no están guardados.

### 4. Ver lo que hace el cliente MCP

1. Haga clic en *Panel de actividad* en el grupo *Actividad*. En la zona lateral se abre el panel *Actividad MCP*.
2. Cada llamada del puente aparece en una línea, la más reciente arriba: la hora, qué pasó, cuánto tardó y si tuvo éxito o no. Haga clic en una línea para desplegar *Argumentos* y *Respuesta*.
3. Con *Borrar* se vacía la lista. El panel guarda las últimas 500 llamadas. Mientras no haya pasado nada, muestra *Todavía no hay actividad MCP. Las llamadas al puente aparecerán aquí.*

Con la conexión MCP activada, hay un punto con *MCP* en la esquina inferior derecha de la barra de estado. Su color muestra el estado del puente, y si hace clic en él, le lleva a la pestaña *MCP*.

### 5. Establecer límites

En el grupo *Seguridad* están los botones con los que limita el cliente MCP:

- *Pausar*: el cliente MCP no puede cambiar nada de forma temporal, pero la lectura sigue permitida. El puente sigue activo. El botón cambia a *Reanudar*.
- *Solo lectura*: se rechazan todas las herramientas que cambian algo mientras esta opción esté activada.
- *Copia de seguridad automática: activada*: antes del primer cambio del cliente MCP en un documento, la aplicación escribe una copia de seguridad IFC. Viene activada de forma predeterminada. Con el botón la desactiva, y entonces muestra *Copia de seguridad automática: desactivada*. Esto ocurre una vez por documento cada vez que inicia el puente.
- *Crear copia de seguridad ahora*: crea una copia de seguridad del documento activo de inmediato. Después muestra *Copia de seguridad creada:* con el nombre del archivo.
- *Abrir carpeta de copias de seguridad*: abre la carpeta con las copias de seguridad.

Las copias de seguridad están en la carpeta `ai-backups` de la carpeta de datos de la aplicación. La aplicación conserva las copias recientes y reduce las más antiguas; el funcionamiento exacto está en [herramientas MCP](docs://ref-ai-tools).

### 6. Hacer que el cliente MCP planifique bien

Un cliente MCP solo planifica bien si conoce las reglas de planificación. Esto es lo que usted hace por sí mismo:

1. **No hace falta hacer nada para las reglas básicas.** Llegan al conectar: el puente las envía en el campo `instructions` del intercambio inicial de MCP. Que el cliente las incluya en la indicación del sistema depende del propio cliente.
2. **Haga que se lea la guía.** La indicación de conexión de la ventana *Detalles de conexión* pide al cliente MCP que lea la guía con la herramienta `planner_get_planning_guide`. Si no usa la indicación, pida al cliente: *Lea primero la guía de planificación con planner_get_planning_guide, antes de cambiar nada.* Usted mismo puede leer la guía en `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opcional: instale las habilidades.** Esto solo funciona con un cliente MCP que admita habilidades. Coloque los archivos `SKILL.md` de *goed-plannen* y de *progress-update* en `.claude/skills/goed-plannen/SKILL.md` y `.claude/skills/progress-update/SKILL.md` en la carpeta del proyecto con la que trabaja el cliente MCP, o en `~/.claude/skills/` para todos los proyectos.

Los archivos se obtienen de dos formas. Pida al cliente MCP que llame a la herramienta `planner_get_planning_guide` con `part` igual a `skill`: la respuesta contiene ambos textos y, para cada habilidad, los lugares donde va. O bien, descárguelos de `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` y `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Si *goed-plannen* sigue ahí de una versión anterior de la aplicación, sustitúyalo: ese texto antiguo está en neerlandés y remite al artículo de ayuda, en lugar de a la guía para clientes MCP.

Si el cliente MCP leyó de verdad la guía, lo puede ver en el *Panel de actividad*: allí aparece una llamada a `planner_get_planning_guide`. La respuesta final debe contener una lista de supuestos: duraciones estimadas, el desglose elegido, las relaciones que el cliente creó por sí mismo y cada restricción que fijó. Si falta esa lista, pídala. Tras una actualización de avance según *progress-update*, la respuesta debe indicar la fecha de estado, la nueva fecha de fin y la variación frente a la línea base.

## Problemas habituales y lo que hace la aplicación en ese caso

**El cliente MCP cambia algo que usted quiere deshacer.** Cada cambio del cliente MCP es un paso que usted deshace con *Deshacer* (Ctrl+Z). Una serie de cambios que el cliente MCP entrega como un conjunto es un solo paso. Después, el proyecto aparece como no guardado. Tras un cambio, la planificación queda calculada de nuevo, así que usted no tiene que pulsar F5.

**La aplicación rechaza una llamada del cliente MCP.** Con *Pausar* y *Solo lectura*, la aplicación rechaza todos los cambios, pero la lectura sigue siendo posible, incluido recalcular una planificación desactualizada. Si usted está en medio de una edición, por ejemplo arrastrando una barra o escribiendo en un campo, el cliente MCP recibe las fechas de antes de su edición, con un aviso de que están desactualizadas. Si tiene abierto un cuadro de diálogo, por ejemplo la configuración, un cuadro de diálogo de tarea o la ventana de bienvenida, o si el modo de presentación está activado, la aplicación rechaza todas las llamadas, incluida la lectura, hasta que cierre el cuadro de diálogo. Entonces el cliente MCP recibe un mensaje de error con el nombre interno de lo que está abierto, por ejemplo `showTaskDialog`. Solo `planner_get_planning_guide` sigue funcionando, porque no lee su planificación.

**Usted cambia de pestaña mientras el cliente MCP trabaja.** El cliente MCP trabaja en el documento donde se aplicó su primer cambio. Si entretanto cambia de pestaña, la aplicación rechaza el siguiente cambio del cliente MCP hasta que el cliente confirme que quiere trabajar en la otra pestaña. Así, nada acaba en el proyecto equivocado. Si el cliente MCP abre o duplica un documento por sí mismo, después trabaja en ese nuevo documento.

**El cliente MCP escribe o abre un archivo.** El cliente MCP puede escribir una planificación como archivo IFC y abrir un archivo de planificación en una pestaña nueva. Solo puede hacerlo dentro de su carpeta de usuario. Solo sobrescribe un archivo existente si lo pide explícitamente.

**El estado es *Puerto 3877 ocupado*.** Otro programa usa el puerto. Debajo aparece el mensaje de la aplicación. El campo del puerto queda entonces bloqueado (*Solo editable mientras el servidor esté detenido.*), aunque el puente no esté en marcha, y no hay botón de detener. Es una limitación conocida. Hasta que se corrija: desactive *Permitir conexión MCP* y vuelva a activarlo. El estado vuelve entonces a *Desactivado*, y puede elegir otro puerto. Después, copie de nuevo los detalles de conexión, porque el punto de conexión contiene el puerto.

**El cliente no puede conectarse después de un token nuevo.** Un token nuevo rompe todas las conexiones existentes. Dé al cliente el token nuevo, o pegue de nuevo el fragmento de configuración. La extensión de Claude Desktop lee el token nuevo por sí misma; allí no tiene que hacer nada.

**Usted detuvo el puente y este no se inicia solo.** *Iniciar el puente automáticamente* funciona una vez cada vez que se inicia la aplicación. Si usted detiene el puente, la aplicación no lo vuelve a activar en silencio.

**La pestaña *MCP* ha desaparecido.** La conexión MCP está desactivada. Actívela en el paso 1.

**Una página web en su navegador no puede comunicarse con el puente.** El puente rechaza cada solicitud que llega desde un navegador, y cada solicitud sin el token correcto.

## Sin la aplicación

También hay un servidor MCP que funciona sin la aplicación de escritorio: el **servidor MCP sin interfaz**. Ofrece las mismas herramientas `planner_*`, pero trabaja con un archivo de planificación en el disco en lugar de con su proyecto abierto. Por eso no ve los cambios en el diagrama de Gantt, y *Deshacer* de la aplicación no se aplica a ellos. Úselo si no quiere tener la aplicación abierta, o en un equipo sin pantalla.

La extensión para Claude Desktop inicia este servidor por sí sola cuando la aplicación está cerrada (consulte el paso 3). Los pasos siguientes son para otro cliente MCP, como Claude Code.

La publicación no incluye una descarga lista para usar del servidor. Usted lo compila a partir del código fuente con `npm run build:mcp-server`; para eso necesita Node.js 22 o más reciente. El resultado es un único archivo, `server.mjs`.

1. Elija una carpeta de trabajo con sus archivos de planificación. El servidor lee y escribe solo en esa carpeta.
2. Conecte su cliente MCP. Para Claude Code, el comando está debajo de estos pasos.
3. Pida a su cliente MCP que abra una planificación, por ejemplo `~/plan.ifc`. En este servidor, `~` significa la carpeta de trabajo.
4. Pida a su cliente MCP que guarde el resultado. No hay guardado automático: el cliente MCP escribe el archivo con `planner_export_ifc`. Lo que no se guarda se pierde cuando se detiene el servidor.

Para el paso 2 en Claude Code, dé este comando en una terminal, con sus propias rutas:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Antes del primer cambio en cada documento, el servidor hace una copia de seguridad MCP, igual que la aplicación. Un cliente MCP que elige una ruta fuera de la carpeta de trabajo, también mediante un acceso directo (enlace simbólico), recibe un rechazo. Mientras la aplicación está abierta, el servidor no sobrescribe un archivo existente.

## Consulte también

- [Enviar comentarios](docs://howto-feedback-geven): si la conexión funciona de otra manera que la descrita aquí, comuníquelo.
- [Herramientas MCP](docs://ref-ai-tools): todas las herramientas `planner_*` por grupo, los códigos de error y el tiempo que se conservan las copias de seguridad.
- [Configuración de la aplicación](docs://ref-instellingen): la configuración de MCP.
