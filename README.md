# Proyectos Popoyan

Monorepo con:
- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Orquestación: Docker Compose (desarrollo)

Incluye hot-reload en desarrollo, migraciones automáticas.

## Requisitos

- Docker Desktop (Windows/macOS) o Docker + Docker Compose (Linux)
- Git

## Estructura

- popoyan-frontend/
- popoyan-backend/
- docker-compose.dev.yml
- docker-compose.prod.yml
- README.md

## Base de datos: dump y scripts
- El repositorio incluye un volcado SQL (dump) y un script para gestionar la base de datos.
- Importante: el proyecto realiza una migración automática del esquema de la base al iniciarse, por lo que no es necesario importar el dump ni ejecutar los scripts manualmente para desarrollo. Úsalos solo si deseas restaurar datos/estructura manualmente o revisar el esquema.

## Variables de entorno
Backend (desarrollo) — popoyan-backend/.env.docker:
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/popoyan
CORS_ORIGIN=http://localhost:5173
PLANTID_API_KEY=REEMPLAZAR
PLANTID_BASE_URL=https://plant.id/api/v3
```

Frontend (Vite) usa variables que comiencen con VITE_:
- Dev: defínelas en docker-compose.dev.yml (servicio frontend) o en popoyan-frontend/.env.local.

## Levantar en desarrollo

Arrancar todo (hot-reload):
```
docker compose -f docker-compose.dev.yml up --build
```

Accesos:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

Comandos útiles:
- Reiniciar servicios tras cambiar .env:
    - Backend: docker compose -f docker-compose.dev.yml restart backend
    - Frontend: docker compose -f docker-compose.dev.yml restart frontend
- Reconstruir si cambiaste Dockerfile o package.json:
    - docker compose -f docker-compose.dev.yml up -d --build
- Logs:
    - docker compose -f docker-compose.dev.yml logs -f backend
    - docker compose -f docker-compose.dev.yml logs -f frontend
    - docker compose -f docker-compose.dev.yml logs -f postgres

Reset completo (DB y caché):
```
docker compose -f docker-compose.dev.yml down -v --remove-orphans
docker image prune -af
docker builder prune -af
docker compose -f docker-compose.dev.yml up --build
```

## Problemas comunes

- Conexión a DB desde contenedor:
    - Usa host postgres (nombre del servicio), no localhost.
    - DATABASE_URL ejemplo: postgresql://usuario:pass@postgres:5432/popoyan
- “The server does not support SSL connections”:
    - Postgres en Docker no tiene SSL: define DB_SSL=false y evita sslmode=require en la URL.
- “password authentication failed for user postgres”:
    - La password solo se fija al crear el volumen por primera vez; si cambias la env, o alteras la password en la DB o reseteas el volumen (down -v).
- “nodemon: not found” en dev:
    - Asegura que el contenedor instale devDependencies y/o usa npx nodemon. Reconstruye sin caché.

## Scripts útiles (sugeridos)

- Dev:
    - up: docker compose -f docker-compose.dev.yml up --build
    - rebuild servicio: docker compose -f docker-compose.dev.yml up -d --build backend
    - reset: docker compose -f docker-compose.dev.yml down -v --remove-orphans && docker compose -f docker-compose.dev.yml up --build
