# Gestionar y compartir bibliotecas de recursos

Objetivo: crear y eliminar bibliotecas de recursos, poner calendarios en ellas, y exportar o importar una biblioteca, como copia de seguridad o para usarla en otro equipo.

## Cuándo lo necesita

La biblioteca no está en los archivos de su proyecto, sino en la aplicación: en la aplicación de escritorio, en un archivo de este equipo; en el navegador, en el almacenamiento de ese navegador. No se sincroniza. Si borra los datos del sitio en el navegador, la biblioteca desaparece; por eso expórtela como copia de seguridad. Si un compañero quiere trabajar con las mismas cuadrillas y tarifas, también le entrega la biblioteca como archivo. Si su organización tiene varias empresas operativas con cuadrillas propias, cree una biblioteca aparte para cada una. Para un proyecto nuevo, elija qué biblioteca utiliza.

Qué es una biblioteca se explica en [La biblioteca de recursos](docs://uitleg-resourcebibliotheek). Aquí no edita los recursos en sí, sino en el panel de recursos; véase [Usar la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken).

## Pasos

### Abrir la pantalla de gestión

Elija *Archivo › Biblioteca*. A la izquierda está la lista *Bibliotecas de recursos*. A la derecha están los detalles de la biblioteca en la que haga clic: nombre, los botones y la lista *Calendarios*. En la parte superior se indica que los recursos se gestionan en la pestaña *Recursos*.

### Crear, renombrar y elegir una biblioteca predeterminada

1. Haga clic en el signo + sobre la lista (*Añadir biblioteca de recursos*). Se añade una biblioteca *Nueva biblioteca de recursos*, y queda seleccionada de inmediato.
2. Escriba el nombre nuevo en el campo de nombre de la parte superior de la parte derecha y pulse Intro, o haga clic fuera del campo. La aplicación no acepta un nombre vacío.
3. Haga clic en *Establecer como predeterminada* para que esta biblioteca quede preseleccionada en los proyectos nuevos a partir de ahora. La biblioteca predeterminada tiene una estrella en la lista.

### Poner un calendario en la biblioteca

1. En *Calendarios*, haga clic en *Desde el proyecto*. Se abre una lista con los calendarios de su proyecto activo.
2. Haga clic en la pequeña flecha después del calendario que quiera incorporar. Encima de la lista aparece *Añadido.* Un calendario que ya está vinculado a esta biblioteca tiene *ya vinculado* después de su nombre.
3. El calendario ya está en la lista *Calendarios* de la biblioteca. Con el lápiz (*Editar*) cambia el nombre, y guarda con la marca de verificación. El icono de papelera elimina el calendario de inmediato, sin pedir confirmación. Las copias de los proyectos se conservan.

Después de *Calendarios* aparece un número de versión, por ejemplo *v2*. Sube con cada cambio en la biblioteca. Un calendario de la biblioteca pasa al proyecto cuando asigna un recurso que lo usa. Lo asocia a un recurso en *Recursos*, vista *Biblioteca*, en la columna *Calendario*.

### Exportar una biblioteca

1. Elija la biblioteca en la lista.
2. Haga clic en *Exportar*.
3. En la aplicación de escritorio, en Chrome y en Edge, elija dónde se guarda el archivo. En otros navegadores, el archivo va directamente a su carpeta de descargas, y la aplicación se lo indica. El archivo se llama `bibliotheek-` seguido del nombre de la biblioteca, con la extensión `.ifc`.

Debajo de los botones aparece *Exportar también es tu copia de seguridad: guarda el archivo en un lugar seguro.*

### Importar una biblioteca

1. Haga clic en *Importar*. Se abre la ventana *Importar biblioteca* para la biblioteca que había seleccionado en la lista.
2. Haga clic en *Elegir archivo…* y elija el archivo `.ifc` de una exportación. Si el archivo no contiene una biblioteca, aparece *Este archivo IFC no contiene una biblioteca de recursos.*
3. La aplicación muestra lo que contiene el archivo, por ejemplo *2 calendarios, 5 recursos (versión 3).*
4. Elija qué quiere hacer con él; véase más abajo.
5. Haga clic en *Añadir* o *Reemplazar*, o en *Cancelar* para detener la operación.

Tiene dos opciones:

- *Añadir como nueva biblioteca de recursos*: el archivo se convierte en una biblioteca aparte, junto a las existentes. Debajo se indica con qué nombre, por ejemplo *Se añadirá como “Mijn resourcebibliotheek (2)”.* No se pierde nada, y su proyecto activo sigue vinculado a su propia biblioteca.
- *Reemplazar una biblioteca de recursos existente*: todo el contenido de la biblioteca elegida se sustituye por el del archivo. También lo indica: *Importar reemplaza TODO el pool de la biblioteca de recursos seleccionada.* Si tiene dos o más bibliotecas, elija cuál en *Importar en la biblioteca de recursos*. Si su biblioteca es más reciente que el archivo, la aplicación avisa: *Tu biblioteca local es más reciente — importar puede sobrescribir tus cambios.*

La aplicación propone una opción por sí misma. Si el archivo contenía la biblioteca predeterminada, aparece preseleccionada *Añadir como nueva biblioteca de recursos*. Si la biblioteca del archivo ya existe en su equipo y no es la predeterminada, aparece preseleccionada *Reemplazar una biblioteca de recursos existente*, con esa biblioteca elegida. En caso de duda, elija añadir: así no se sobrescribe nada.

### Eliminar una biblioteca

1. Elija la biblioteca en la lista y haga clic en *Eliminar biblioteca de recursos*. El botón está en gris en la última biblioteca, porque siempre queda una.
2. Confirme con *Eliminar*. La pregunta es *¿Eliminar esta biblioteca de recursos?* Si hay proyectos abiertos vinculados a ella, aparece *Esta biblioteca de recursos está vinculada a 1 proyecto abierto. Eliminarla desvinculará ese proyecto. ¿Continuar?* Para más proyectos aparece lo mismo con el número, por ejemplo *vinculada a 2 proyectos abiertos*.

La biblioteca desaparece entonces, con todos sus recursos y calendarios. Los proyectos abiertos que la usaban quedan desvinculados: sus recursos siguen siendo recursos normales del proyecto. Exporte primero si quiere conservar el contenido.

### Entregar un proyecto junto con su biblioteca

Un archivo de proyecto contiene sus propias copias de los recursos. Si también quiere entregar toda la biblioteca, haga lo siguiente. La exportación en sí también se describe en [Exportar](docs://howto-exporteren).

1. Abra un proyecto vinculado a una biblioteca y elija *Archivo › Exportar*.
2. Marque *Guardar también el archivo de biblioteca*. La casilla solo aparece en un proyecto vinculado.
3. Elija la tarjeta *IFC* y guarde el archivo. Después la aplicación pide también un segundo archivo. Se llama igual que el proyecto, con `-bibliotheek` al final, y contiene la biblioteca.

La casilla solo funciona en la exportación IFC, no en los demás formatos de exportación. Su compañero importa el segundo archivo tal como se describe arriba.

## Trampas habituales y qué hace entonces la aplicación

**Dos planificadores, dos bibliotecas.** La aplicación no sincroniza bibliotecas entre equipos. La ventana de importar muestra siempre un aviso al respecto: *Nota: las bibliotecas no se sincronizan entre equipos. Si dos planificadores trabajan con la misma biblioteca de recursos, las bibliotecas pueden divergir. Si su organización comparte cuadrillas entre empresas operativas, elija deliberadamente un pool compartido.*

**Reemplazar sobrescribe todo.** Todo lo que tenía en la biblioteca elegida desaparece, y un cambio en la biblioteca queda fuera de *Deshacer*. Exporte primero si no está seguro. Sus proyectos conservan sus copias. La aplicación actualiza las copias que siguen existiendo en el archivo nuevo. Las copias que ya no están en él reciben la marca *ya no está en la biblioteca* y siguen funcionando. Si una copia difiere, se abre la ventana *Vincular biblioteca de recursos* (véase [Usar la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken)).

**Eliminar un calendario de la lista se hace de inmediato.** La aplicación no pide confirmación, mientras que al eliminar un recurso sí la pide. Eso parece una deficiencia. Los cambios en la biblioteca quedan fuera de *Deshacer*.

## Véase también

- [La biblioteca de recursos](docs://uitleg-resourcebibliotheek): cómo se relacionan la biblioteca y el proyecto.
- [Usar la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken): vincular recursos, asignarlos y resolver desviaciones.
- [Exportar](docs://howto-exporteren): los formatos de exportación, incluido IFC con un archivo de biblioteca.
