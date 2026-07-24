# Importación/exportación

Open Planner Studio guarda un proyecto como IFC por defecto — sin un archivo de proyecto aparte junto a él. Pero
a veces una planificación también necesita existir fuera de la aplicación: en Primavera P6, en Microsoft Project, o como
una tabla plana para una hoja de cálculo. Esta guía explica qué significa realmente que "IFC es el formato nativo", qué
lleva y qué no lleva cada formato de exportación, y dónde vive la importación/exportación en la aplicación.

## Lo que aprenderá aquí

- Qué significa exactamente "IFC es el formato nativo" para abrir y guardar.
- Qué se incluye y qué no al exportar a MS Project (MSPDI) y Primavera P6 XML.
- Qué contiene la exportación CSV — y qué se deja fuera deliberadamente.
- Dónde importar y exportar: **Backstage → Exportar** y **Backstage → Importar**.
- Cómo las extensiones pueden añadir formatos de importación adicionales.

## IFC: el formato nativo

Un proyecto de Open Planner Studio *es* un archivo IFC 4x3 (el estándar de buildingSMART). No hay un
archivo JSON o de proyecto aparte junto a él: **Guardar** y **Abrir** (Backstage, o **Ctrl+S**/**Ctrl+O**)
leen y escriben IFC directamente. Eso significa que todo lo que hace en la aplicación — tareas, WBS, relaciones con
restricciones, recursos y asignaciones, calendarios (tanto el calendario del proyecto como los calendarios
de recursos), baselines, progreso, notas, códigos de actividad y campos personalizados, enlaces externos entre
proyectos — termina en el mismo archivo y vuelve por completo la próxima vez que **Abra** el archivo. Si se encuentra
con un nuevo tipo de dato de proyecto en la aplicación, puede asumir que hace el recorrido de ida y vuelta a través de IFC; si algo
*no* hace ese recorrido, se indica explícitamente más abajo.

IFC es también cómo esta aplicación se conecta con el resto del conjunto de herramientas OpenAEC: el mismo archivo puede ser leído por
software BIM para el enlace 4D (planificación junto al modelo del edificio).

## Exportar a otros formatos

Abra **Backstage → Exportar** para cuatro formatos:

- **CSV (separado por punto y coma)** — exportación de tabla universal. Todas las tareas con fechas y duraciones.
- **MS Project XML** — se abre en Microsoft Project. Estructura WBS completa.
- **Primavera P6 XML** — para Oracle Primavera P6.
- **IFC 4x3** — el estándar de buildingSMART, el mismo que el formato nativo (útil como "guardar como" en un
  archivo aparte, o para compartir una copia sin tocar el resto de sus documentos abiertos).

Cada formato tiene sus propias limitaciones: cuanto más rico es el formato de destino, más se incluye, pero ninguno de
los tres formatos externos es un espejo completo de IFC.

### CSV

La exportación CSV contiene **solo la tabla de tareas**: código WBS, nombre, duración (días), inicio, fin,
predecesoras (como código de texto, por ejemplo `2.1FS+3d`), tipo de tarea, estado, progreso (%), inicio/fin
real, crítica (sí/no), holgura total y descripción. **Los recursos, las asignaciones, los calendarios
y las baselines se dejan fuera deliberadamente** — el CSV es puramente una tabla de tareas para quien quiera ver
o editar la planificación en una hoja de cálculo, no un intercambio de proyecto de fidelidad completa. Al **importar**
de nuevo un archivo CSV, las baselines quedan por tanto vacías (no había nada de donde leerlas).

### MS Project XML (MSPDI)

MSPDI es considerablemente más rico que CSV: los recursos, las asignaciones (incluida su curva de carga),
los calendarios y las baselines sí se incluyen. Aun así, no todo es expresable en MSPDI. Al exportar, la
aplicación avisa en la consola de desarrollador (`console.warn`) siempre que se pierde algo, con el número exacto
de elementos afectados:

- Los **enlaces externos** entre proyectos se pierden (la referencia "fantasma" de la otra tarea permanece
  solo dentro de la aplicación).
- Las restricciones **Start On/Finish On flexibles** (MSO/MFO flexibles) se degradan a SNET/FNET — los códigos MSPDI
  2/3 son *estrictos* (Must), así que se pierde el límite superior de la variante flexible. Los MSO/MFO estrictos se exportan exactamente.
- Las **restricciones secundarias** se pierden — MSPDI solo tiene un campo de restricción por tarea.
- Las **tareas hammock** (duración derivada) se exportan como una tarea normal con las fechas calculadas — MSPDI
  no tiene un tipo nativo de hammock/LOE.
- Las **notas de tarea** deliberadamente **no** se exportan, aunque MSPDI tenga un campo `<Notes>`: nuestras
  notas son una lista de comprobación con casillas que no se traduce limpiamente a texto plano.
- La **definición de la ruta crítica** (modo/umbral de casi crítico) y otras opciones de planificación no son
  expresables de forma nativa en MSPDI y, por tanto, se pierden — esas solo se conservan mediante IFC.

### Primavera P6 XML

El mismo tipo de compromiso que con MSPDI, con algunas peculiaridades propias de P6:

- Los **enlaces externos** y las **tareas hammock** se pierden/simplifican de la misma manera que con
  MSPDI, cada uno con un aviso.
- Las **notas de tarea** también se dejan fuera aquí — P6 XML no tiene un campo adecuado para ellas.
- El **desfase porcentual** en una relación (por ejemplo 40% de la duración de la predecesora) se "hornea" en un
  número fijo de días, porque P6 no tiene un concepto de desfase porcentual.
- El **desfase en días naturales** (desfase en días transcurridos en lugar de días laborables) se exporta como un
  desfase simple basado en horas — P6 no tiene una unidad de desfase separada por relación.
- La curva de carga **LATE_PEAK** no tiene equivalente en P6 y se exporta como la aproximación más cercana
  ("Early Peak").
- Las opciones de planificación (igual que con MSPDI) no se exportan.

Estos avisos no son descuido — son una elección deliberada y explícita: un aviso visible por cada elemento
descartado es mejor que una pérdida de datos silenciosa. Abra, por ejemplo, el ejemplo
[Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (tiene notas de tarea
y una relación con un desfase porcentual) y expórtelo a P6 o a MS Project XML: la consola de desarrollador
muestra entonces exactamente qué elementos se descartaron o simplificaron, y cuántos.

## Importar

**Archivo → Abrir** (o **Backstage → Abrir**) acepta archivos `.ifc`, `.csv` y `.xml`. Para un archivo
`.xml`, la aplicación detecta por sí misma si se trata de un archivo de Primavera P6 o de MS Project, según el
contenido. Como se ha descrito arriba: una importación CSV o P6 produce un proyecto **sin baselines** (no
había ninguna en el origen), mientras que IFC y MSPDI sí traen baselines consigo.

## Importadores de extensiones

Más allá de los formatos fijos anteriores, las extensiones instaladas pueden añadir sus propios importadores — por ejemplo para un
formato que no se admite por defecto. Estos aparecen en **Backstage → Importar**, cada uno con su propio
nombre, descripción y extensiones de archivo coincidentes; sin ninguna extensión de importación instalada, esa
sección está vacía. Consulte **Backstage → Extensiones** para ver qué hay disponible.

## Siga leyendo

- Las baselines solo se incluyen mediante IFC y MS Project XML, no mediante CSV o P6 — lea la guía
  [Baselines y progreso](docs://gids-baselines-voortgang) para saber cómo registrar una baseline.
- Recursos, asignaciones y curvas de carga — lea la guía
  [Recursos, histograma y nivelación](docs://gids-resources-histogram) para saber cómo se construyen antes de
  exportar.
