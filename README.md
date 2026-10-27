# RoboEval Live

Aplicación para consultar inscripciones de MongoDB, calificar proyectos y sincronizar resultados en tiempo real.

## Desarrollo local

1. Instala las dependencias con `npm install`.
2. Completa `.env` con `MONGODB_URI` y `MONGODB_DB`. El servidor lee la colección `registrations` de esa base.
3. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Las credenciales iniciales del administrador son `AlcaldiaNobsa` / `T1cN0b54`. Puedes definir `ADMIN_USERNAME` y `ADMIN_PASSWORD` antes del primer inicio. Las cuentas se crean en `roboeval_accounts`; el cambio posterior de esas variables no reemplaza una cuenta ya existente.

## Estructura MongoDB

- Los proyectos se leen de `registrations` usando `code`, `projectTitle`, `category` y `categoryName`. Se asignan así:
  - `category: "seguidores"` / `categoryName: "Seguidores de línea"` → Seguidores de Línea.
  - `category: "automatizacion"` / `categoryName: "Proyecto de automatización electrónica"` → Bachillerato.
  - `category: "educativos"` / `categoryName: "Proyectos educativos en robótica"` → Primaria.
- `registrations` es de solo lectura desde RoboEval. Las inscripciones se gestionan desde el sistema que ya las crea; se reflejan al volver a cargar la aplicación.
- Evaluaciones, intentos, cuentas de jurado y sesiones se guardan por separado en `roboeval_evaluations`, `roboeval_accounts`, `roboeval_sessions` y `roboeval_state`. RoboEval no modifica los documentos de inscripción.
- La cuenta inicial se inserta en `roboeval_accounts`; las contraseñas se guardan con hash scrypt. Las sesiones tienen vencimiento y el token se guarda con hash.

Los demás datos del equipo, institución o descripción son opcionales; el mapeo usa los campos habituales si existen y valores de reemplazo si faltan.

## Vercel y actualizaciones en vivo

Cada endpoint tiene su propia función bajo `api/` y `api/ws.ts` exporta el servidor HTTP para WebSockets. El backend compartido está en `backend.ts` y no se usa como función en la raíz, para evitar que Vercel lo trate como un handler distinto. Configura en Vercel `MONGODB_URI` y, si el nombre de la base no está en la URI, `MONGODB_DB`. Configura también `ADMIN_USERNAME` y `ADMIN_PASSWORD` como variables de entorno antes del primer despliegue. Mantén acceso de red de Atlas permitido para Vercel.

WebSockets usa MongoDB Change Streams sobre `roboeval_state` para notificar cambios entre instancias; requiere un clúster Atlas compatible con Change Streams. Las conexiones WebSocket de Vercel son beta y pueden cerrarse por duración máxima; el cliente se reconecta y recibe el estado actual al reconectar. Las inscripciones externas aparecen al recargar la app, mientras que las calificaciones se sincronizan en vivo.

Para validar cambios: `npm run lint` y `npm run build`.
# CalificacionesFeriaNobsa2026
