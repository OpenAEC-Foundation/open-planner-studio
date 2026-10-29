# Generar festivos y vacaciones de construcción

Objetivo: cargar en un calendario los festivos de un país y, si hace falta, las vacaciones de construcción, y añadir un día o un período libre propio donde haga falta.

## Cuándo lo necesita

Sin festivos, la aplicación planifica simplemente trabajo en Navidad o en el Día del Rey. Un proyecto nuevo ya recibe los festivos de los Países Bajos, siempre que *Modo construcción* esté activado. Vuelva a generar los festivos si necesita otro país o región, si quiere incluir las vacaciones de construcción o si su proyecto cae fuera de los años para los que se crearon los festivos. Esos años importan: para la aplicación, un día fuera de ellos es simplemente un día laborable. Cómo tiene en cuenta la aplicación un festivo al contar, lo puede leer en [Calendarios y días laborables](docs://uitleg-kalenders).

Las **vacaciones de construcción** (*bouwvak*) son las vacaciones colectivas del sector de la construcción de los Países Bajos, tres semanas en verano. De forma predeterminada, en la aplicación están desactivadas.

## Pasos

### Generar festivos

1. Elija *Planificación › Calendario › Calendario* y seleccione a la izquierda el calendario donde deben ir los festivos.
2. Haga clic en *Generar festivos…*. Debajo del botón se abre un bloque con las opciones.
3. Elija el *País*: Países Bajos, Alemania, Bélgica, Francia, Reino Unido, Austria, Suiza o *Sin festivos*. Para algunos países aparece también una lista *Región*, por ejemplo un estado federado en Alemania. *Nacional* deja solo los festivos que valen en todas partes.
4. En los Países Bajos, elija las *Vacaciones de construcción*: *Ninguna* (predeterminado), *Norte*, *Centro* o *Sur*. Las vacaciones de construcción aparecen como un período en la lista, por ejemplo *Vacaciones de construcción (Norte)*, tres semanas de lunes a viernes. Solo ve esta opción si *Modo construcción* está activado.
5. Debajo de las opciones hay un resumen, por ejemplo *21 festivos, 2026–2028*. Haga clic en él para ver las fechas.
6. Haga clic en *Generar*. La lista *Festivos* ya está rellena.
7. Haga clic en *Aplicar*. La aplicación recalcula la planificación de inmediato.

En los Países Bajos, la aplicación incluye cada año en la lista Nieuwjaar, Goede Vrijdag, Pasen (dos días), Koningsdag, Hemelvaart, Pinksteren (dos días) y Kerst (25 y 26 de diciembre) (Año Nuevo, Viernes Santo, Pascua, Día del Rey, Ascensión, Pentecostés y Navidad). Si el Día del Rey cae en domingo, es el 26 de abril. Bevrijdingsdag (Día de la Liberación) solo está en la lista en los años múltiplos de cinco, como 2025 y 2030.

Los años dependen del período del proyecto: desde el año anterior a la fecha de inicio hasta el año posterior a la fecha de fin. Si el proyecto no tiene fecha de fin, hasta tres años después del año de inicio. Ajuste la fecha de inicio y la de fin en *Configuración › Proyecto › Ajustes del proyecto*.

### Regenerar tras un nuevo período del proyecto

Si su proyecto se desplaza o recibe una fecha de fin posterior, los festivos ya no cubren los años nuevos. La aplicación lo indica en la ventana *Calendarios*, por ejemplo *Los festivos cubren 2025–2028. ¿Desea volver a generar hasta 2030 inclusive?* Haga clic después en *Regenerar*. La aplicación usa las mismas opciones que la vez anterior (país, región, vacaciones de construcción) para los años del proyecto. Después haga clic en *Aplicar*. Solo ve este mensaje en un calendario cuyos festivos se generaron antes.

### Añadir un día o un período libre propio

1. En la ventana *Calendarios*, haga clic en *Añadir festivo*. Al final de la lista aparece una fila nueva, con la fecha de hoy en *Desde*.
2. Rellene la *Descripción*, por ejemplo *Excursión de empresa*.
3. Ajuste *Desde*. Deje *Hasta* vacío para un solo día, o rellene el último día libre de un período, por ejemplo para unas vacaciones de invierno.
4. Haga clic en *Aplicar*.

Con la papelera que hay al final de una fila, elimine un festivo.

### Eliminar todos los festivos

Elija *Sin festivos* en *País* y haga clic en *Generar*. La lista queda entonces vacía.

## Problemas frecuentes y qué hace la aplicación entonces

**Generar reemplaza la lista completa.** Los días que usted añadió también desaparecen. Añádalos de nuevo después.

**Goede Vrijdag (Viernes Santo) está incluido.** Si su empresa trabaja en Viernes Santo, o en el Día de la Liberación (Bevrijdingsdag) en un año de lustro, elimine esa fila con la papelera.

**Las fechas de las vacaciones de construcción son orientativas.** La aplicación las conoce de 2025 hasta 2028 incluido; para otros años hace una estimación aproximada. Si elige unas vacaciones de construcción, la aplicación muestra por eso *Fechas orientativas — verificar con Bouwend Nederland*. Ajuste el período en la lista si hace falta.

**Una fila no válida.** Una fila sin *Desde* válido, un *Hasta* anterior a *Desde* o una fecha que no se puede leer recibe un mensaje en rojo, por ejemplo *La fecha de fin es anterior a la fecha de inicio.* *Aplicar* queda desactivado hasta que la corrija.

**Con un proyecto nuevo.** La ventana *Nuevo proyecto* tiene las mismas opciones en *Conjunto de festivos*. Con *Personalizado…* empieza sin festivos; al crear el proyecto se abre la ventana *Calendarios* para que los rellene usted mismo.

## Véase también

- [Calendarios y días laborables](docs://uitleg-kalenders): cómo tiene en cuenta la aplicación los festivos y las vacaciones de construcción al contar días laborables.
- [Crear y asignar un calendario](docs://howto-kalender-maken-en-toewijzen): crear un calendario propio en el que incluir festivos.
- [Ventanas de calendario](docs://ref-kalenders): todos los campos de las ventanas de calendario.
- [Nuevo proyecto y Ajustes del proyecto](docs://ref-projectinfo): el conjunto de festivos para un proyecto nuevo.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): además de los festivos, el calendario del proyecto tiene un período libre *Frost delay, foundations*.
