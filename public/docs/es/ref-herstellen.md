# Recuperarse tras un fallo

La aplicación de escritorio conserva automáticamente instantáneas de recuperación de su trabajo. Si la aplicación se cierra inesperadamente (fallo, corte de energía), ofrece recuperar ese trabajo en el siguiente arranque.

## Cómo funciona el guardado automático

- Poco después de cada cambio (menos de un segundo) la aplicación escribe una instantánea por cada documento abierto en su propia carpeta de datos — para todas las pestañas abiertas, incluidos los documentos que nunca se han guardado.
- Esto no sustituye al guardado: el propio archivo de su proyecto no cambia. Así que siga guardando su trabajo con Ctrl+S.
- Las instantáneas se limpian en cuanto elige una opción en la ventana de recuperación (**Restaurar** o **No restaurar**).
- **Solo aplicación de escritorio.** La versión de navegador no tiene guardado automático ni recuperación — guarde allí regularmente usted mismo.

## La ventana "Restaurar trabajo no guardado"

Aparece al iniciar cuando se encuentran instantáneas: "Open Planner Studio no se cerró correctamente. Los siguientes documentos tenían cambios sin guardar que se pueden restaurar:" Para cada documento muestra:

- el **nombre** (nombre de archivo o nombre de proyecto; sin nombre: "Proyecto sin título");
- la **ruta del archivo**, si el documento se guardó alguna vez;
- el **número de tareas** en la instantánea;
- **Guardado** — la hora de la instantánea más reciente.

## Las opciones

- **Restaurar** (o **Intro**) — todos los documentos listados vuelven como pestañas abiertas. Entonces cuentan como sin guardar: guárdelos usted mismo.
- **No restaurar** — las instantáneas se descartan; empieza con un proyecto vacío.
- **Cruz de cierre**, **Esc** o un clic fuera de la ventana — posponer con seguridad: nada se descarta y nada se restaura; la pregunta reaparece en el siguiente arranque.

## Siga leyendo

- [Inicio rápido](docs://quick-start) — guardar y abrir proyectos.
