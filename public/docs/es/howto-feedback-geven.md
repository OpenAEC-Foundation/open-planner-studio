# Enviar comentarios

Objetivo: informar de un error o transmitir una idea, opcionalmente con una captura de pantalla, directamente desde la aplicación.

## Cuándo lo necesita

La planificación calcula algo que no entiende, un botón no hace lo que debe o se le escapa algo en la aplicación. Un buen informe ayuda a los desarrolladores a encontrar el problema. Por eso la aplicación añade por sí misma la versión, el sistema operativo y el idioma a su informe. Lo que usted mismo describe decide si pueden hacer algo con él: qué hizo, qué esperaba y qué ocurrió.

## Pasos

1. Haga clic en el botón *Enviar comentarios* en la parte superior de la ventana. Ese botón siempre está en la barra de título. Su texto cambia cada diez minutos: *Enviar comentarios*, *Reportar un error* y *Sugerir una nueva función*. Es siempre el mismo botón. Se abre la ventana *Enviar comentarios*.
2. Elija el tipo de informe. *Algo no funciona* es para un error: algo no hace lo que debería. *Idea* es para algo que echa de menos o que quiere que sea diferente. *Pregunta o comentario* es para lo demás. *Algo no funciona* viene seleccionado de forma predeterminada.
3. Rellene el *Título* y después la *Descripción*. Los campos vacíos muestran un ejemplo: un título como *Ej.: La ruta crítica cambia al guardar*, y para la descripción la pregunta *¿Qué hizo, qué esperaba y qué ocurrió?* Mientras el botón *Enviar* esté gris, una línea gris junto a él indica el motivo, por ejemplo *Escriba un título.* o que debe escribir al menos 10 caracteres entre el título y la descripción juntos.
4. Si quiere recibir una respuesta, rellene su *Correo electrónico*. Ese campo es opcional. La aplicación recuerda la dirección tras un informe correcto, así que ya está ahí la próxima vez.
5. Si quiere mostrar algo, active *Adjuntar captura de pantalla*. La aplicación hace entonces una captura de la pantalla sin esta ventana. Un momento después ve una vista previa pequeña con tres botones al lado: *Anotar*, *Repetir captura* y *Quitar*.
6. *Anotar* abre un editor. En él, coloca flechas, rectángulos, líneas a mano alzada y texto sobre la imagen. Con *Cubrir* dibuja una zona negra sobre algo que no debe enviarse, como un nombre o un importe. Esa parte desaparece de verdad de la imagen que envía la aplicación. Usted elige el color y deshace su última acción con *Deshacer*, o empieza de nuevo con *Borrar todo*. Haga clic en *Listo* para conservar los cambios, o en *Cancelar* (o Esc) para descartarlos.
7. *Repetir captura* hace una captura nueva y borra sus anotaciones. *Quitar* quita la captura de pantalla y desactiva la casilla.
8. Mire la línea gris *Enviado con* debajo del formulario. Muestra lo que la aplicación envía por sí misma: la versión, el sistema operativo y el idioma, por ejemplo *Enviado con: v2026.10.1 · Windows · English*.
9. Haga clic en *Enviar*. Mientras se envía, el botón dice *Enviando…*.
10. Ve *Gracias, su mensaje se ha enviado.* Si se creó una incidencia en GitHub para su informe, también aparece el botón *Ver en GitHub*. Haga clic en *Cerrar*.

## Adónde va su informe

La aplicación envía su informe a Open Feedback Studio de OpenAEC. Para ello no necesita una cuenta, tampoco en GitHub. Los desarrolladores ven su informe en su resumen. Si la aplicación está conectada a GitHub allí, Open Feedback Studio también lo convierte en una incidencia pública en GitHub. Con *Algo no funciona* la incidencia recibe la etiqueta *bug*, con *Idea* la etiqueta *enhancement*. Debajo de su descripción aparece entonces una línea con la versión de Open Planner Studio, su sistema operativo y el idioma de la aplicación.

## Problemas posibles y qué hace entonces la aplicación

**Su informe puede hacerse público.** No ponga nada en él que no quiera compartir. Eso también vale para la captura de pantalla: la imagen muestra todo lo que es visible en la aplicación en ese momento, como nombres de tareas y recursos de su proyecto. La aplicación hace la captura en el momento en que activa *Adjuntar captura de pantalla*. Si la pantalla todavía no está bien, cierre la ventana, ajuste la pantalla como quiere, vuelva a abrir la ventana y haga clic en *Repetir captura*. Utilice *Cubrir* para ocultar lo que no quiere mostrar.

**La captura de pantalla es demasiado grande.** La aplicación reduce la captura antes de enviarla. Si sigue siendo demasiado grande, su informe se envía sin imagen. La pantalla de agradecimiento dice entonces *La captura de pantalla era demasiado grande y no se ha enviado.*

**El envío no funciona.** Aparece un mensaje en la ventana y su texto se conserva. Hay cuatro casos:

- *El informe no fue aceptado.* Revise el texto y el correo electrónico. Un informe que consiste sobre todo en enlaces se rechaza.
- *Ha enviado muchos informes en poco tiempo.* Vuelva a intentarlo dentro de una hora.
- *El envío falló.* No hay conexión o el servidor no responde. Vuelva a intentarlo, o haga clic en *Abrir en GitHub*. Ese botón no aparece si un intento anterior fue incierto (véase abajo).
- *No sabemos si su mensaje ha llegado. Espere un minuto y envíelo de nuevo; si ya está, lo veremos automáticamente.* La conexión se cortó después de que la aplicación enviara su informe. Su texto se conserva. No hay botón *Abrir en GitHub*, porque su informe todavía puede llegar. Eso se mantiene hasta que su informe se envíe o ya esté recibido, también si cierra la ventana entre medias y la vuelve a abrir.

**Su informe ya se ha recibido.** Si envía un informe que ya está, el formulario se queda con esto encima: *Ya hemos recibido este mensaje. ¿Quiere añadir algo? Entonces cambie el texto y envíelo de nuevo.* Su texto se conserva y su correo electrónico se recuerda. Haga clic en *Cerrar* si no quiere añadir nada; la próxima vez el formulario estará vacío. Si escribe algo más, el mensaje desaparece y puede enviar de nuevo; el botón se llama entonces otra vez *Guardar y cerrar* y su texto se conserva.

**Abrir en GitHub.** Esta es la ruta sin Open Feedback Studio. Para esto sí necesita una cuenta en GitHub. Sin captura de pantalla, la página de GitHub en la que crea una incidencia nueva se abre enseguida en su navegador, con su título y descripción ya rellenados. Con captura de pantalla, primero ve *Casi listo — tu captura de pantalla está en el portapapeles.* con cuatro pasos. Haga clic en *OK, ir a GitHub*, haga clic dentro del área de texto grande de la página de la incidencia y pulse Ctrl+V (Cmd+V en un Mac). Después haga clic en *Enviar nueva incidencia* abajo. Solo entonces se envía su informe.

**Pegar no funciona.** En la ruta de GitHub, la captura también se guarda como archivo en su equipo. En la aplicación de escritorio, la ventana indica la ruta: *¿No puede pegar? También guardamos la captura de pantalla en* esa ruta *— arrastre ese archivo al área de texto.* En el navegador, la aplicación descarga la imagen como `feedback-` con un número y la extensión `.png`. La encuentra en su carpeta de descargas y la arrastra al área de texto.

**Falla la captura de pantalla.** Aparece *No se pudo capturar la pantalla. Aún puedes enviar comentarios sin captura.* La casilla se desactiva y puede enviar su informe sin imagen.

**Cierra la ventana antes de enviar.** Si hay algo en el formulario, el botón de abajo se llama *Guardar y cerrar*; con un formulario vacío se llama *Cerrar*. *Guardar y cerrar*, la cruz y Esc cierran la ventana, y su informe se guarda como borrador hasta que lo envíe o haga clic en *Borrar*. Al volver a abrir la ventana, el tipo, su texto, el correo electrónico y la captura de pantalla con anotaciones siguen ahí. El borrador se conserva mientras la aplicación esté abierta; después de cerrar la aplicación, desaparece. Tras un informe correcto, el formulario vuelve a quedar vacío. Si quiere empezar de nuevo usted mismo, haga clic en *Borrar* abajo a la izquierda. Un clic al lado de la ventana no la cierra. Mientras se envía, Esc no cierra la ventana.

## Véase también

- [Actualizar la aplicación](docs://howto-app-bijwerken): antes de enviar un informe, compruebe si tiene la versión más reciente.
