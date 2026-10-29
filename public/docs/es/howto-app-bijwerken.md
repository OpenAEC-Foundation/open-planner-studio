# Actualizar la aplicación

Objetivo: saber si tiene la versión más reciente, actualizar la aplicación y leer qué hay de nuevo en una versión.

## Cuándo necesita esto

Una nueva versión de Open Planner Studio sale con regularidad. Quiere saber si ya la tiene, por ejemplo antes de notificar un error o porque una extensión pide una versión más reciente. O acaba de actualizar y quiere ver qué ha cambiado.

La actualización solo funciona en la aplicación de escritorio. La versión para navegador no tiene actualizador.

## Pasos

### Actualizar cuando la propia aplicación indica una nueva versión

1. Inicie la aplicación de escritorio. Al iniciarla, la aplicación comprueba en segundo plano si hay una nueva versión. Si no hay una nueva versión, o la comprobación falla, por ejemplo sin internet, no notará nada.
2. Si hay una nueva versión, se abre la ventana *Actualización de software*. Muestra la *Versión actual*, la *Versión nueva*, el mensaje *Hay una nueva versión disponible* y, debajo de *Novedades*, el texto que acompaña a la actualización.
3. Guarde sus proyectos abiertos.
4. Haga clic en *Descargar e instalar*. Una barra de progreso muestra *Descargando…* y después sigue la instalación. No puede cerrar la ventana mientras se descarga.
5. Espere hasta que la aplicación se reinicie sola. Esa es la nueva versión.

Justo antes de instalar la actualización, la aplicación también guarda una instantánea de recuperación (para la recuperación tras un fallo) de sus proyectos abiertos. Véase [Recuperarse tras un fallo](docs://howto-herstellen-na-een-crash).

### Buscar usted mismo una nueva versión

1. Elija *Configuración › Proyecto › Configuración*. También puede elegir *Archivo › Configuración*, o el engranaje de la parte superior.
2. Elija la pestaña *Avanzado*. Debajo de *Versión* está el número de su versión actual.
3. Haga clic en *Buscar actualizaciones*. Se abre la ventana *Actualización de software* y dice *Comprobando…*. Después dice *Estás usando la versión más reciente* o el mensaje de que hay una nueva versión, con el mismo botón *Descargar e instalar*.

En el navegador este botón no hace nada especial: la ventana dice de inmediato *Estás usando la versión más reciente*, sin que la aplicación compruebe nada.

### Leer qué hay de nuevo

1. Si inicia la aplicación de escritorio por primera vez en una versión distinta a la anterior, se abre sola una ventana. En inglés se llama *You've been updated!*, en español *¡Ya estás actualizado!*. Después de una instalación nueva no se abre: el primer inicio no es una actualización. Si aun así quiere verla, use el botón *Novedades* (véase abajo).
2. Arriba está el salto de la versión anterior a la nueva. Con el botón *Novedades* solo se muestra la nueva versión.
3. Si la aplicación tiene un resumen integrado para esta versión, verá un punto principal y cuatro puntos más pequeños. El punto principal puede tener el botón *Leer la guía*. Si no, solo verá el salto de versión y lo que hay debajo.
4. Con *Ver notas de versión completas* abre el registro de cambios en GitHub. Si eso no funciona, aparece *No se pudieron abrir las notas de versión.*
5. Debajo de *Esta actualización en cifras* están el número de días desde la versión anterior, el número de commits y el número de líneas de código añadidas. Si la aplicación puede consultar la diferencia de tamaño del paquete de instalación, también se muestra. Cada cifra solo se muestra si está disponible.
6. Haga clic en *Entendido* para cerrar la ventana.

Si más adelante quiere ver esta ventana otra vez, elija *Configuración › Proyecto › Configuración*, la pestaña *Avanzado* y, debajo de *Versión*, el botón *Novedades*. Entonces la ventana se abre para su versión actual, sin versión anterior.

## Problemas posibles y qué hace la aplicación entonces

**La actualización falla.** La ventana muestra *Algo salió mal al actualizar* con el motivo técnico debajo, y el botón *Reintentar*.

**Instaló la aplicación como paquete .deb y la instalación falla.** La ventana lo explica: *Actualiza manualmente ejecutando este comando en una terminal, o descarga el último paquete.* Debajo de *Comando de instalación* está el comando, con el botón *Copiar comando* (después dice *Copiado*). Con *Abrir página de descargas* va a la página de descarga de la última versión.

**Tiene la aplicación a través de la Snap Store.** Entonces la aplicación no se actualiza sola y tampoco comprueba al iniciarse. Eso lo hace la Snap Store. En la ventana dice *Esta versión se actualiza automáticamente a través de la Snap Store — no tienes que hacer nada.*

**No aparece nada al iniciar.** Es normal si ya tiene la última versión. La comprobación al iniciar no informa de errores. Si quiere estar seguro de que está actualizado, compruébelo usted mismo, como se indicó arriba.

## Véase también

- [Enviar comentarios](docs://howto-feedback-geven): notifique un error en la versión más reciente.
