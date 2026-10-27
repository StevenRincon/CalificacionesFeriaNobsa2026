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
  - `category: "automatizacion"` / `categoryName: "Proyecto de automatización electrónica"` → Automatización.
  - `category: "educativos"` / `categoryName: "Proyectos educativos en robótica"` → Automatización.
- `registrations` es de solo lectura desde RoboEval. Las inscripciones se gestionan desde el sistema que ya las crea; se reflejan al volver a cargar la aplicación.
- Los accesos nuevos se crean para Automatización o Seguidores de Línea. Ambos tipos de inscripciones indicados arriba se muestran en la categoría Automatización y comparten el mismo panel de evaluación.
- La ruta `GET /api/projects` consulta directamente `registrations` y devuelve todos los proyectos con su categoría y calificaciones. Se puede filtrar con `?category=bachillerato` o `?category=linea`; al seleccionar una categoría desde la interfaz, el navegador solicita esa categoría y registra en consola el estado HTTP y la cantidad recibida. El panel de administración permite consultar todas las categorías con el botón de actualización.
- Evaluaciones, intentos, cuentas de jurado y sesiones se guardan por separado en `roboeval_evaluations`, `roboeval_accounts`, `roboeval_sessions` y `roboeval_state`. RoboEval no modifica los documentos de inscripción.
- La cuenta inicial se inserta en `roboeval_accounts`; las contraseñas se guardan con hash scrypt. Las sesiones tienen vencimiento y el token se guarda con hash.

Los demás datos del equipo, institución o descripción son opcionales; el mapeo usa los campos habituales si existen y valores de reemplazo si faltan.

## Vercel y actualizaciones en vivo

Cada endpoint tiene su propia función bajo `api/`; `api/health.ts` comprueba la conexión y `api/ws.ts` exporta el servidor HTTP para WebSockets. El backend compartido está en `backend.ts` y no se usa como función en la raíz, para evitar que Vercel lo trate como un handler distinto. Configura en Vercel `MONGODB_URI` y, si el nombre de la base no está en la URI, `MONGODB_DB`. Configura también `ADMIN_USERNAME` y `ADMIN_PASSWORD` como variables de entorno antes del primer despliegue. Mantén acceso de red de Atlas permitido para Vercel.

Para diagnosticar una conexión publicada, abre `https://<tu-dominio>/api/health`. La respuesta muestra si falta la URI, si falló la conexión, si se rechazó la autenticación o si MongoDB no permitió preparar las colecciones, sin exponer la URI ni sus credenciales. Cuando MongoDB responde, también informa el nombre de la base seleccionada, el total de documentos en `registrations` y cuántos se reconocieron por categoría, sin mostrar datos de los participantes. Un `404` en los endpoints API significa que las funciones no están incluidas en el despliegue actual.

WebSockets usa MongoDB Change Streams sobre `roboeval_state` para notificar cambios entre instancias; requiere un clúster Atlas compatible con Change Streams. Las conexiones WebSocket de Vercel son beta y pueden cerrarse por duración máxima; el cliente se reconecta y recibe el estado actual al reconectar. Las inscripciones externas aparecen al recargar la app, mientras que las calificaciones se sincronizan en vivo.

En celular, la página inicial ofrece acceso directo a la evaluación o a podios/clasificación. El jurado puede buscar proyectos por nombre del proyecto o participante, abrir la rúbrica en un modal y volver a modificar sus propias calificaciones; cada jurado solo modifica su evaluación individual.

Para validar cambios: `npm run lint` y `npm run build`.
# CalificacionesFeriaNobsa2026
