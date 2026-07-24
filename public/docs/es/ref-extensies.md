# Gestionar e instalar extensiones

Las extensiones añaden funciones a la aplicación, como formatos de importación adicionales o botones de cinta personalizados. Son de nivel de aplicación: pertenecen a esta instalación en este dispositivo, no a un archivo de proyecto.

## Abrir

**Archivo** → **Extensiones** (Backstage). Arriba hay dos pestañas — **Instaladas** y **Explorar** — junto a los botones **ZIP** y **JS**, con un campo de búsqueda debajo (**Buscar extensiones...**).

## Instaladas

Una tarjeta por extensión con nombre, versión, categoría, descripción y autor, más:

- **Interruptor de activar/desactivar** — activa o desactiva la extensión sin eliminarla.
- **Eliminar** — haga clic en **Confirmar** una vez más para eliminarla definitivamente.

Una extensión que no se pudo cargar muestra un mensaje de error en su tarjeta. Sin extensiones, la pestaña informa: "Aún no hay extensiones instaladas."

## Explorar (catálogo)

La pestaña **Explorar** obtiene el catálogo de extensiones en línea (requiere conexión a internet). Cada entrada del catálogo es una tarjeta con **Instalar**; las extensiones ya instaladas muestran la insignia **Instalada**. Si la carga falla, aparece un mensaje de error con **Reintentar**.

## Instalar desde un archivo

- **ZIP** — instala un ZIP de extensión (con `manifest.json` + `main.js`).
- **JS** — instala un único archivo `.js` con un manifiesto incrustado.

Tras la instalación, la extensión se activa de inmediato y cualquier botón de cinta aparece enseguida.

## Importar mediante extensiones

**Archivo** → **Importar** lista los formatos de importación ofrecidos por las extensiones instaladas; haga clic en un formato y elija un archivo. Sin extensiones de importación, la página informa: "No hay extensiones de importación instaladas. Añade una en Extensiones." Los formatos de importación integrados (CSV, MS Project, P6) son independientes de esto — vea [Importación/exportación](docs://gids-import-export).

## Escribir sus propias extensiones

La guía para autores de extensiones (manifiesto, API, permisos) vive en el repositorio: `github.com/OpenAEC-Foundation/open-planner-studio`, archivo `docs/extensions.md`.
