# Proyectos Popoyan

Monorepo con:
- Frontend: React + Vite
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Orquestación: Docker Compose (desarrollo)

Incluye hot-reload en desarrollo, migraciones automáticas, guía de backup/restore.

## Requisitos

- Docker Desktop (Windows/macOS) o Docker + Docker Compose (Linux)
- Git

## Estructura

- popoyan-frontend/
- popoyan-backend/
- docker-compose.dev.yml
- docker-compose.prod.yml
- db_backups/ (opcional, para dumps de DB)
- README.md

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

## Backup y restore de base de datos

Crear dump “custom” (recomendado):
```
docker compose -f docker-compose.dev.yml exec -T postgres sh -lc \
  'pg_dump -U postgres -d popoyan -Fc -f /tmp/seed.dump'
docker compose -f docker-compose.dev.yml cp postgres:/tmp/seed.dump ./db_backups/seed.dump
```

Restaurar solo datos:
```
# (Opcional) vaciar tablas
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d popoyan -c \
"DO $$DECLARE r record; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE'; END LOOP; END$$;"

# Restaurar
docker compose -f docker-compose.dev.yml exec -T postgres pg_restore \
  -U postgres -d popoyan --data-only --no-owner --no-privileges --disable-triggers --schema=public \
  /db_backups/seed.dump
```

Mover datos a otra PC: copia db_backups/seed.dump y ejecuta el restore en esa PC.

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
