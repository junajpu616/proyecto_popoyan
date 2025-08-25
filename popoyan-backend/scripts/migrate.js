require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  console.log('Connected to database');

  async function execSQL(label, sql) {
    console.log(`-> ${label}`);
    await client.query(sql);
  }

  try {
    await client.query('BEGIN');

    // 0) Extensiones útiles
    await execSQL('Ensure pg_trgm extension', `
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

    // 1) Tabla principal mínima: plants
    await execSQL('Create plants table (minimal schema)', `
      CREATE TABLE IF NOT EXISTS plants (
        id BIGSERIAL PRIMARY KEY,
        entity_name TEXT NOT NULL,
        scientific_name TEXT,
        common_names TEXT[] DEFAULT ARRAY[]::text[],
        taxonomy JSONB DEFAULT '{}'::jsonb,
        description TEXT,
        images TEXT[] DEFAULT ARRAY[]::text[],
        status TEXT NOT NULL DEFAULT 'active',
        access_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_plants_status CHECK (status IN ('active','inactive'))
      );
    `);

    // 2) Índices y constraints para evitar duplicados y acelerar búsqueda
    await execSQL('Add plants indexes', `
      -- Único por access_token (normalizado) cuando no es nulo
      CREATE UNIQUE INDEX IF NOT EXISTS ux_plants_access_token_lower
      ON plants ((lower(access_token)))
      WHERE access_token IS NOT NULL;

      -- Único por scientific_name (normalizado) cuando no es nulo
      CREATE UNIQUE INDEX IF NOT EXISTS ux_plants_scientific_name_lower
      ON plants ((lower(scientific_name)))
      WHERE scientific_name IS NOT NULL;

      -- Búsquedas y filtros frecuentes
      CREATE INDEX IF NOT EXISTS ix_plants_status ON plants (status);
      CREATE INDEX IF NOT EXISTS ix_plants_created_at ON plants (created_at DESC);

      -- Aceleran ILIKE y similitud (pg_trgm)
      CREATE INDEX IF NOT EXISTS ix_plants_entity_trgm ON plants USING gin (entity_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS ix_plants_scientific_trgm ON plants USING gin (scientific_name gin_trgm_ops);

      -- Para filtros por claves dentro de taxonomy si lo usas
      CREATE INDEX IF NOT EXISTS ix_plants_taxonomy_gin ON plants USING gin (taxonomy);
    `);

    // 3) Trigger para updated_at
    await execSQL('Trigger for plants.updated_at', `
      CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_plants_updated ON plants;
      CREATE TRIGGER trg_plants_updated
      BEFORE UPDATE ON plants
      FOR EACH ROW
      EXECUTE FUNCTION trg_set_updated_at();
    `);

    // 4) Tablas de historial de búsqueda
    await execSQL('Create plant_search_results', `
      CREATE TABLE IF NOT EXISTS plant_search_results (
        id BIGSERIAL PRIMARY KEY,
        search_query TEXT NOT NULL,
        api_response JSONB,
        total_results INT NOT NULL DEFAULT 0,
        entities_trimmed BOOLEAN DEFAULT FALSE,
        limit_value INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_search_results_created ON plant_search_results (created_at DESC);
    `);

    await execSQL('Create plant_search_entities', `
      CREATE TABLE IF NOT EXISTS plant_search_entities (
        id BIGSERIAL PRIMARY KEY,
        search_result_id BIGINT NOT NULL REFERENCES plant_search_results(id) ON DELETE CASCADE,
        plant_id BIGINT REFERENCES plants(id) ON DELETE SET NULL,
        entity_name TEXT,
        access_token TEXT,
        matched_in TEXT,
        matched_in_type TEXT,
        match_position INT,
        match_length INT
      );
      CREATE INDEX IF NOT EXISTS ix_search_entities_result ON plant_search_entities (search_result_id);
      CREATE INDEX IF NOT EXISTS ix_search_entities_access_token ON plant_search_entities ((lower(access_token)));
    `);
    await execSQL('Create plant_identifications (used by identificationService)', `
      CREATE TABLE IF NOT EXISTS plant_identifications (
        id BIGSERIAL PRIMARY KEY,
        original_filename TEXT,
        image_data TEXT NOT NULL, -- base64 u otro formato
        identification_results JSONB NOT NULL,
        confidence_score NUMERIC(6,5) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_ident_created ON plant_identifications (created_at DESC);
      CREATE INDEX IF NOT EXISTS ix_ident_status ON plant_identifications (status);
    `);
    await execSQL('Create plant_chat_messages (chat history for chatbot)', `
      CREATE TABLE IF NOT EXISTS plant_chat_messages (
        id BIGSERIAL PRIMARY KEY,
        identification_access_token TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('question', 'answer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_chat_by_token_created ON plant_chat_messages (identification_access_token, created_at);
    `);

    // Limpieza de duplicados preexistentes (mantener el primer id por grupo)
    await execSQL('Deduplicate plant_chat_messages', `
      WITH dups AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY identification_access_token, content, type, created_at
            ORDER BY id
          ) AS rn
        FROM plant_chat_messages
      )
      DELETE FROM plant_chat_messages p
      USING dups d
      WHERE p.id = d.id
        AND d.rn > 1;
    `);

    // Evita duplicados futuros cuando la API devuelve el hilo completo en cada llamada
    await execSQL('Create unique index on plant_chat_messages', `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_unique
      ON plant_chat_messages (identification_access_token, content, type, created_at);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully (lean schema)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});