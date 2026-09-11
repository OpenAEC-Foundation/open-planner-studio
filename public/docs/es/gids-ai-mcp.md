# Conectar un asistente de IA (MCP)

Open Planner Studio puede abrirse a un asistente de IA. Active el modo IA y la aplicación se convierte en un **servidor MCP**: un asistente como Claude se conecta a la ventana que tiene abierta en ese momento, lee su planificación y puede modificarla. Usted lo ve suceder en directo — cada tarea que añade aparece de inmediato en el Gantt — y todo lo que hace el asistente lo deshace con un solo Ctrl+Z.

Ese es un modelo fundamentalmente distinto al de exportar un archivo, editarlo en otro sitio y volver a importarlo. No hay copia, ni formato intermedio, ni un momento en el que usted y el asistente estén mirando cosas distintas. Esta guía muestra cómo se activa, cómo se conecta un asistente, qué puede y qué no puede hacer, y qué probar cuando algo no funciona.

## Lo que aprenderá aquí

- Activar el modo IA y encontrar la pestaña de IA.
- Iniciar el puente, y hacer que arranque automáticamente con la aplicación.
- Conectar un asistente — con una indicación lista para usar o con un fragmento de configuración.
- Qué puede hacer un asistente con su planificación.
- Los controles de seguridad: pausar, solo lectura, copia de seguridad automática y el panel de actividad.
- Qué hacer cuando la conexión no se establece.

El puente solo funciona **en la aplicación de escritorio**. La pestaña de IA es visible también en la versión de navegador, pero el servidor en sí se ejecuta en la capa de escritorio y no puede arrancar ahí.

## Activarlo

El modo IA está desactivado de forma predeterminada. Actívelo en **Configuración → Aplicación → Activar modo IA** — mediante el engranaje (⚙), la pestaña de la cinta Configuración o Archivo → Configuración; las tres muestran el mismo interruptor.

En cuanto está activado, aparece una pestaña adicional **IA** en la cinta. Vuelva a desactivar el modo IA y la pestaña desaparece y un puente en marcha se detiene de inmediato — así que nunca queda un servidor escuchando sin que la pestaña esté ahí.

Justo debajo está **Iniciar el puente automáticamente**. Con ese interruptor activado, el servidor se pone en marcha en cuanto abre la aplicación, de modo que un asistente puede conectarse sin que usted visite antes la pestaña de IA. Está desactivado de forma predeterminada: abrir un puerto a la escucha en su propio equipo debe ser una decisión consciente.

## La pestaña de IA

La pestaña tiene cuatro grupos.

**Servidor** — el botón **Iniciar puente** (o **Detener puente**) con el estado justo al lado: *Desactivado*, *Activo en el puerto 3877*, *Puerto … ocupado* o *Error*. El mismo estado aparece como un punto de color abajo a la derecha en la barra de estado, así que puede ver si el puente sigue vivo desde cualquier otra pestaña.

**Conexión** — el número de puerto (solo editable mientras el servidor está detenido; un servidor en marcha conserva su puerto), el token, y el botón **Conectar**. El token está oculto de forma predeterminada; el botón del ojo lo revela, el botón de copiar lo toma, y **Nuevo token** genera uno nuevo. Tenga en cuenta que esto último rompe *todas* las conexiones existentes, ya que todas llevan el token antiguo — por eso la aplicación pide confirmación primero.

**Seguridad** — **Pausar**, **Solo lectura**, el interruptor **Copia de seguridad automática**, y los botones **Crear copia de seguridad ahora** y **Abrir carpeta de copias de seguridad**. Lo que hace cada uno se describe más abajo, en *Los controles de seguridad*.

**Actividad** — el botón **Panel de actividad** abre una lista con cada llamada que hace el asistente: hora, nombre de la herramienta, cuánto tardó, y si tuvo éxito. Despliegue cualquier fila para ver los argumentos y la respuesta. Ese es su registro: no tiene que fiarse de la palabra del asistente sobre lo que hizo.

## Conectar un asistente

Haga clic en **Conectar**. La ventana que se abre contiene cuatro bloques que puede copiar uno a uno:

1. **Punto de conexión** — la dirección en la que escucha el puente, `http://localhost:3877/mcp` de forma predeterminada. El transporte es HTTP en streaming.
2. **Autenticación** — el encabezado HTTP que debe acompañar a cada solicitud, con la forma `Authorization: Bearer …`.
3. **Fragmento de configuración** — un bloque JSON listo para usar que pega en la configuración MCP de su cliente.
4. **Indicación de conexión** — un fragmento de texto que pega directamente en su asistente; este se conecta solo y después verifica su propia lista de herramientas.

Esa última opción es el camino más corto y funciona con cualquier asistente que pueda añadir servidores MCP. La indicación es deliberadamente neutral respecto al proveedor: solo menciona la dirección, el token y qué debe comprobar el asistente después, así que funciona igual de bien con un proveedor que con otro.

La conexión está completa en cuanto el asistente puede listar sus herramientas. Debería ver cerca de cuarenta, todas empezando por `planner_`. Si no ve ninguna, el puente no está en marcha o el token no es correcto.

El token da acceso al plan que tiene abierto en ese momento. Trátelo como una contraseña: no lo ponga en un documento compartido, ni lo comparta en una conversación con otras personas.

## Lo que un asistente puede hacer

Las herramientas cubren aproximadamente todo lo que usted mismo hace en la aplicación:

- **Leer** — resumen del proyecto, lista de tareas, una tarea concreta en detalle, la ruta crítica, los recursos y su histograma, calendarios, baselines, y la comparación con una baseline.
- **Planificar** — crear tareas (una WBS completa con fases y subtareas de una vez), editarlas, moverlas y eliminarlas; añadir, cambiar y quitar relaciones; registrar progreso.
- **Configurar** — crear y asignar recursos, gestionar calendarios y días no laborables, guardar y activar baselines, nivelar.
- **Gestionar** — crear, duplicar y cambiar de documento, importar archivos de planificación, y exportar a IFC.

Dos cosas importan más que la lista en sí.

**Un asistente puede trabajar con un solo guion.** En lugar de llamar a una herramienta tras otra, puede enviar una secuencia de pasos como un todo. Eso no es solo más rápido: el guion completo se convierte en un único paso de su historial. Si construye de una vez una planificación de cuarenta tareas con todas sus relaciones, un solo Ctrl+Z la elimina otra vez por completo. Si algo falla estructuralmente a mitad de camino, se deshace el guion entero en lugar de dejarle con una planificación a medio terminar.

**La planificación se recalcula después de cada cambio.** El asistente no tiene que pedirlo aparte, así que no puede seguir trabajando por accidente sobre fechas desactualizadas.

## Lo que un asistente no puede hacer

El puente es deliberadamente más estrecho que la aplicación. Hay unas cuantas cosas que un asistente simplemente no puede hacer, aunque se lo pida — recibe una negativa que explica cuál es la vía correcta. Esto no es un control parental: cada caso es algo que va más allá del proyecto que tiene abierto en ese momento.

**La biblioteca de recursos en sí.** Un asistente no puede crear, cambiar ni eliminar un recurso o un calendario de la biblioteca. Una biblioteca es información de toda la aplicación, compartida por todos sus proyectos, y las modificaciones en ella quedan fuera del historial normal de deshacer. Un solo cambio de tarifa se propagaría entonces a proyectos que ni siquiera están abiertos, sin forma de revertirlo. Eso lo hace usted mismo, en Archivo → Biblioteca.

**Los campos fijos de un recurso heredado.** Si un recurso viene de una biblioteca, es esa biblioteca la que determina qué *es* el recurso: nombre, tipo, descripción, tarifa por hora y unidad. Esos campos aparecen como texto plano en la pestaña Recursos por una razón — tampoco usted puede editarlos ahí — y el asistente no puede acceder a ellos ni un poco más que usted. Lo que decide el *proyecto* sigue estando a su disposición: unidades máx., la capacidad escalonada en el tiempo, el calendario y la pertenencia a una cuadrilla. Pida de todos modos una tarifa por hora distinta, y la negativa nombrará las dos vías reales: cambiarla en la biblioteca (lo que entonces se aplica a todos los proyectos), o desvincular primero el recurso de la biblioteca — después de eso pasa a ser propio del proyecto y totalmente editable, y ese desvincular se deshace con Ctrl+Z.

**Qué calendario es el calendario del proyecto.** Puede editar el contenido de ese calendario, pero cambiar cuál usa el proyecto es algo que hace usted mismo en la biblioteca de calendarios. Lo mismo vale para opciones de planificación como la de varias rutas críticas.

**La aplicación en sí.** No hay ninguna herramienta para la configuración, el tema, el idioma, las extensiones o el actualizador. Un asistente no cambia nada sobre cómo está configurado su programa.

**Archivos — sí, pero con límites.** Importar significa que puede leer un archivo de planificación de su disco, y exportar que puede escribir un IFC. La escritura queda confinada a su carpeta personal, y un archivo existente nunca se sobrescribe a menos que se haya pedido explícitamente. Una exportación tampoco es un "guardar": su documento sigue marcado como no guardado en la aplicación, así que no puede sustituir su archivo de proyecto a sus espaldas.

Cuando pide la lista de recursos, un asistente ve de inmediato qué recursos vienen de una biblioteca, a qué biblioteca de recursos pertenecen, y qué campos están fijados. No tiene que chocar antes con el límite para averiguarlo.

## Los controles de seguridad

**Pausar** mantiene el puente en marcha pero rechaza cualquier cambio; la lectura sigue permitida. Útil cuando quiere hacer algo usted mismo sin cortar la conexión.

**Solo lectura** hace lo mismo, pero como postura en lugar de como pausa: deje que un asistente analice, informe o compare su planificación sin que pueda cambiar nada.

**Copia de seguridad automática** crea automáticamente una copia IFC antes del primer cambio en un documento. Eso ocurre una vez por documento y por sesión, así que no acumula un montón de archivos con cada llamada. **Crear copia de seguridad ahora** lo hace de inmediato — útil justo antes de dejar que un asistente haga algo drástico. **Abrir carpeta de copias de seguridad** le lleva a donde viven; la aplicación conserva las últimas diez por documento.

Además de eso está el historial normal de deshacer, que un asistente comparte con usted. Todo lo que hace, usted puede deshacerlo — y el asistente también, porque deshacer y rehacer están en su caja de herramientas.

## Cuando no funciona

**"Puerto … ocupado."** Algo ya está escuchando en ese puerto. Normalmente es una segunda ventana de esta aplicación: el puente solo puede atender a una a la vez. Cierre la otra ventana, o elija otro número de puerto mientras el servidor está detenido.

**El asistente no recibe respuesta, o se queda colgado.** Esto pasa cuando la ventana detrás del servidor ha desaparecido o se ha recargado. Detenga el puente y vuelva a iniciarlo; si eso no ayuda, reinicie la aplicación. Si no está seguro de si sigue vivo, mire el punto de estado en la barra de estado.

**El asistente no ve herramientas, o recibe un error de acceso.** Entonces el token no es correcto. Esto pasa sobre todo después de hacer clic en **Nuevo token** cuando ya había una conexión establecida: el asistente sigue llevando el token antiguo. Copie el nuevo desde la ventana **Conectar** y actualice la configuración de su cliente.

**No ocurre nada aunque el asistente dice que ha funcionado.** Compruebe en el panel de actividad qué llamó realmente y qué recibió de vuelta. Si hay una negativa, casi siempre nombrará también el campo que fallaba y la alternativa.

## Haga que su asistente de IA planifique bien

Un asistente que conoce las herramientas todavía puede construir un cronograma que no le sirve a ningún planificador: tareas sin vínculos, una fecha fija en cada tarea, o un desglose demasiado fino para mantenerlo. Los principios que lo evitan están en la guía [Planificar bien: de los requisitos a un cronograma fiable](docs://gids-goed-plannen) — haga que su asistente la lea antes de empezar, o remítase a ella en su encargo. Además, el código fuente de Open Planner Studio incluye una breve habilidad de agente en `.claude/skills/goed-plannen/`, que remite a esa misma guía para el contenido y solo añade lo específico del agente: en qué orden usar las herramientas `planner_` y qué debe informarle al usuario.

## Siga leyendo

- [Baselines y progreso](docs://gids-baselines-voortgang) — qué le hace la fecha de estado a su planificación. Bueno saberlo antes de dejar que un asistente la establezca: no es solo una fecha de referencia, también adelanta el trabajo aún no iniciado.
- [Importación/exportación](docs://gids-import-export) — cómo se relacionan entre sí IFC, CSV, MS Project y P6.
- [Configuración](docs://ref-instellingen) — todos los ajustes en un solo sitio, incluidos los dos interruptores de IA.
