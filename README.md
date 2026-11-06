# RoboEval Live

Aplicación para consultar inscripciones de MongoDB, calificar proyectos y sincronizar resultados en tiempo real.

## Desarrollo local

1. Instala las dependencias con `npm install`.
2. Completa `.env` con `MONGODB_URI` y `MONGODB_DB`. El servidor lee la colección `registrations` de esa base.
3. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Las credenciales iniciales del administrador son `AlcaldiaNobsa` / `T1cN0b54`. Puedes definir `ADMIN_USERNAME` y `ADMIN_PASSWORD` antes del primer inicio. Las cuentas se crean en `roboeval_accounts`; el cambio posterior de esas variables no reemplaza una cuenta ya existente.

## Estructura MongoDB

- Los proyectos se leen de todos los documentos de `registrations` usando `code`, `projectTitle`, `category` y `categoryName`. La categoría se resuelve primero por `category` y, si falta o no coincide, por `categoryName` (ignorando tildes). Se asignan así:
  - `category: "seguidores"` / `categoryName: "Seguidores de línea"` → Seguidores de Línea.
  - `category: "automatizacion"` / `categoryName: "Proyecto de automatización electrónica"` → Automatización de Bachillerato.
  - `category: "educativos"` / `categoryName: "Proyectos educativos en robótica"` → Primaria / Educativos.
- `registrations` es de solo lectura desde RoboEval. Las inscripciones se gestionan desde el sistema que ya las crea; se reflejan al volver a cargar la aplicación.
- Los accesos nuevos se crean para Automatización (Primaria y Bachillerato) o Seguidores de Línea. Los mismos jurados de Automatización pueden evaluar ambas categorías; las cuentas existentes de jurado de Primaria se conservan como cuentas compartidas.
- Los visitantes deben ingresar la clave del podio para ver Primaria / Educativos o Automatización / Bachillerato. La verificación se hace en el servidor con `PODIUM_ACCESS_PASSWORD` (por defecto, `T1cN0b54`); los usuarios con sesión iniciada no necesitan esa clave.
- La ruta `GET /api/projects` consulta directamente `registrations` y devuelve todos los proyectos con su categoría y calificaciones. Se puede filtrar con `?category=primaria`, `?category=bachillerato` o `?category=linea`; el panel de administración permite consultar todas las categorías con el botón de actualización.
- Evaluaciones, intentos, cuentas de jurado y sesiones se guardan por separado en `roboeval_evaluations`, `roboeval_accounts`, `roboeval_sessions` y `roboeval_state`. RoboEval no modifica los documentos de inscripción.
- La cuenta inicial se inserta en `roboeval_accounts`; las contraseñas se guardan con hash scrypt. Las sesiones tienen vencimiento y el token se guarda con hash.

Los demás datos del equipo, institución o descripción son opcionales; el mapeo usa los campos habituales si existen y valores de reemplazo si faltan.

## Vercel y actualizaciones en vivo

Cada endpoint tiene su propia función bajo `api/`; `api/health.ts` comprueba la conexión y `api/ws.ts` exporta el servidor HTTP para WebSockets. El backend compartido está en `backend.ts` y no se usa como función en la raíz, para evitar que Vercel lo trate como un handler distinto. Configura en Vercel `MONGODB_URI` y, si el nombre de la base no está en la URI, `MONGODB_DB`. Configura también `ADMIN_USERNAME` y `ADMIN_PASSWORD` como variables de entorno antes del primer despliegue. Mantén acceso de red de Atlas permitido para Vercel.

Para diagnosticar una conexión publicada, abre `https://<tu-dominio>/api/health`. La respuesta muestra si falta la URI, si falló la conexión, si se rechazó la autenticación o si MongoDB no permitió preparar las colecciones, sin exponer la URI ni sus credenciales. Cuando MongoDB responde, también informa el nombre de la base seleccionada, el total de documentos en `registrations` y cuántos se reconocieron por categoría, sin mostrar datos de los participantes. Un `404` en los endpoints API significa que las funciones no están incluidas en el despliegue actual.

WebSockets usa MongoDB Change Streams sobre `roboeval_state` para notificar cambios entre instancias; requiere un clúster Atlas compatible con Change Streams. Las conexiones WebSocket de Vercel son beta y pueden cerrarse por duración máxima; el cliente se reconecta y recibe el estado actual al reconectar. Las inscripciones externas aparecen al recargar la app, mientras que las calificaciones se sincronizan en vivo.

En celular, la página inicial ofrece acceso directo a la evaluación o a podios/clasificación. El jurado puede buscar proyectos por nombre del proyecto o participante, abrir la rúbrica en un modal y volver a modificar sus propias calificaciones; cada jurado solo modifica su evaluación individual.

El guardado de calificaciones espera confirmación del servidor antes de mostrarse como exitoso. MongoDB actualiza atómicamente el campo de cada jurado dentro de la evaluación del proyecto, por lo que las calificaciones simultáneas de jurados distintos se conservan; ante un error, el formulario lo informa y permite reintentar.

Mientras se califica, el formulario respalda automáticamente el borrador en el almacenamiento local del navegador, separado por jurado y proyecto. Si se pierde internet, el borrador permanece en ese mismo dispositivo y se puede reintentar el guardado al recuperar la conexión. El respaldo local no reemplaza la confirmación del servidor ni se comparte entre dispositivos o navegadores; no borres los datos del sitio hasta que aparezca la confirmación de guardado.

Primaria / Educativos usa cuatro criterios con notas de 1.0 a 5.0 en incrementos de 0.1 (25% cada uno): Innovación y originalidad, Diseño técnico y funcionalidad, Sustentación y dominio temático, e Impacto, acabado y viabilidad. Automatización / Bachillerato conserva cinco criterios con calificaciones enteras de 10 a 100: Innovación y creatividad (30%), Estética y presentación (20%), Impacto del proyecto al entorno (15%), Diseño y claridad del póster (10%) y Sustentación (25%). Las evaluaciones antiguas de proyectos educativos calificadas con la rúbrica de 100 puntos se convierten al formato de Primaria al consultarlas; el criterio técnico sin equivalente anterior se muestra como 3.5/5 y queda indicado en las observaciones.

Para validar cambios: `npm run lint` y `npm run build`.
# CalificacionesFeriaNobsa2026
