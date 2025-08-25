const db = require('../config/database');
const plantIdService = require('./plantIdService');

class PlantService {
  async searchPlants(query, page = 1, limit = 20) {
    const q = typeof query === 'string' ? query.trim() : '';
    
    const pageSize = Math.max(1, Math.min(parseInt(limit) || 25, 25));
    const safePage = Math.max(1, parseInt(page) || 1);
    const offset = (safePage - 1) * pageSize;

    try {
      // Si el query es muy corto, no llamamos a la API; probamos solo local
      if (q.length < 2) {
        const onlyLocal = await this.searchPlantsLocally(q, pageSize, offset);
        return onlyLocal.plants.length > 0
          ? onlyLocal
          : { plants: [], total: 0, page: safePage, limit: pageSize, totalPages: 0 };
      }

      // Primero buscar localmente
      const localResults = await this.searchPlantsLocally(q, pageSize, offset);

      if (localResults.plants.length > 0) {
        return localResults;
      }

      // Sin resultados locales: intentar API externa (máx 20)
      const apiLimit = Math.min(pageSize, 20);
      let apiResults;
      try {
        apiResults = await plantIdService.searchPlantsByName(q, apiLimit, 1);
      } catch (apiErr) {
        if (apiErr.status === 400) {
          return { plants: [], total: 0, page: safePage, limit: pageSize, totalPages: 0 };
        }
        throw apiErr;
      }

      const entities = Array.isArray(apiResults.entities) ? apiResults.entities.slice(0, apiLimit) : [];

      if (entities.length > 0) {
        await this.storeApiResults({ ...apiResults, entities, limit: pageSize }, q);
        await this.saveEntitiesToPlants(entities);
        await this.fetchAndCacheDetailsForEntities(entities, 1);
        return await this.formatSearchResults(entities, safePage, pageSize);
      }

      return { plants: [], total: 0, page: safePage, limit: pageSize, totalPages: 0 };
    } catch (error) {
      console.error('Plant search error:', error);
      throw error;
    }
  }

  // Búsqueda local en la tabla plants con paginación
  async searchPlantsLocally(query, limit, offset) {
    try {
      const searchPattern = `%${query}%`;

      const searchQuery = `
        SELECT 
          id, entity_name, scientific_name, common_names, 
          taxonomy, images, status, created_at, updated_at, access_token
        FROM plants 
        WHERE status = 'active' 
          AND (
            entity_name ILIKE $1
            OR scientific_name ILIKE $1
            OR EXISTS (
              SELECT 1
              FROM unnest(COALESCE(common_names, ARRAY[]::text[])) AS cn(name)
              WHERE cn.name ILIKE $1
            )
            OR taxonomy::text ILIKE $1
            OR lower(access_token) = lower($2::text)
          )
        ORDER BY entity_name NULLS LAST, id
        LIMIT $3 OFFSET $4
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM plants 
        WHERE status = 'active' 
          AND (
            entity_name ILIKE $1
            OR scientific_name ILIKE $1
            OR EXISTS (
              SELECT 1
              FROM unnest(COALESCE(common_names, ARRAY[]::text[])) AS cn(name)
              WHERE cn.name ILIKE $1
            )
            OR taxonomy::text ILIKE $1
            OR lower(access_token) = lower($2::text)
          )
      `;

      const [plantsResult, countResult] = await Promise.all([
        db.query(searchQuery, [searchPattern, query || null, Number(limit), Number(offset)]),
        db.query(countQuery, [searchPattern, query || null])
      ]);

      const total = parseInt(countResult.rows[0].total, 10);
      const totalPages = Math.ceil(total / limit);

      return {
        plants: plantsResult.rows,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error al consultar localmente:', error);
      throw error;
    }
  }

  async getAllPlants(page = 1, limit = 25, status = null) {
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.max(1, Math.min(parseInt(limit) || 25, 100));
    const offset = (safePage - 1) * safeLimit;

    try {
      const listQuery = `
        SELECT 
          id, entity_name, scientific_name, common_names, taxonomy, description, images, status, access_token,
          created_at, updated_at
        FROM plants
        WHERE (NULLIF($1::text, '') IS NULL OR status = NULLIF($1::text, ''))
        ORDER BY entity_name NULLS LAST, id
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) AS total
        FROM plants
        WHERE (NULLIF($1::text, '') IS NULL OR status = NULLIF($1::text, ''))
      `;

      const [rowsRes, countRes] = await Promise.all([
        db.query(listQuery, [status ?? null, Number(safeLimit), Number(offset)]),
        db.query(countQuery, [status ?? null])
      ]);

      const total = parseInt(countRes.rows[0].total, 10);
      const totalPages = Math.ceil(total / safeLimit);

      return {
        plants: rowsRes.rows,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages
      };
    } catch (error) {
      console.error('Error al obtener todas las plantas:', error);
      throw error;
    }
  }

  // Descarga detalles y hace upsert para cada entidad con concurrencia limitada
  async fetchAndCacheDetailsForEntities(entities, concurrency = 1) {
    const queue = entities.slice(); // copia
    const workers = [];

    const worker = async () => {
      while (queue.length > 0) {
        const ent = queue.shift();
        const token = (ent.access_token || '').trim();
        if (!token) continue;

        try {
          const details = await plantIdService.getPlantDetails(token);
          await this.upsertPlantFromDetails(details, token);
        } catch (e) {
          console.error(`Fallo al cachear desde token ${token}:`, e.message);
        }
      }
    };

    const n = Math.max(1, Math.min(concurrency, 10));
    for (let i = 0; i < n; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  // Upsert sin depender de constraints: 1) UPDATE por token, 2) UPDATE por nombre científico (lower), 3) INSERT
  async upsertPlantFromDetails(details, accessToken) {
    const token = (accessToken || '').trim();
    if (!token) return;

    // Normalización básica
    const scientificName =
      details?.scientific_name || details?.scientificName || details?.name || null;
    const entityName =
      details?.entity_name || details?.preferred_common_name || details?.name || scientificName || null;

    const commonNamesArr = Array.isArray(details?.common_names) && details.common_names.length > 0
      ? details.common_names
      : (Array.isArray(details?.commonNames) && details.commonNames.length > 0 ? details.commonNames : null);

    const taxonomyJson = details?.taxonomy
      ? JSON.stringify(details.taxonomy)
      : (details?.classification ? JSON.stringify(details.classification) : null);

    const descriptionText =
      (typeof details?.description?.value === 'string' && details.description.value) ||
      (typeof details?.description === 'string' && details.description) ||
      (typeof details?.wiki_description?.value === 'string' && details.wiki_description.value) ||
      (typeof details?.summary === 'string' && details.summary) ||
      null;

    const imageUrl =
      details?.image?.value ||
      details?.image_url ||
      details?.image?.url ||
      (Array.isArray(details?.images) ? details.images[0] : null) ||
      details?.picture?.url ||
      null;

    const imagesArr = imageUrl ? [imageUrl] : null;

    // 1) UPDATE por access_token
    const byToken = await db.query(`
      UPDATE plants
      SET 
        entity_name     = COALESCE($1, entity_name),
        scientific_name = COALESCE($2, scientific_name),
        common_names    = COALESCE($3::text[], common_names),
        taxonomy        = COALESCE($4::jsonb, taxonomy),
        description     = COALESCE($5, description),
        images          = COALESCE($6::text[], images),
        status          = 'active',
        updated_at      = NOW()
      WHERE lower(access_token) = lower($7)
      RETURNING id
    `, [
      entityName || null,
      scientificName || null,
      commonNamesArr,
      taxonomyJson,
      descriptionText,
      imagesArr,
      token
    ]);
    if (byToken.rows.length > 0) return;

    // 2) UPDATE por scientific_name (si lo tenemos)
    if (scientificName) {
      const bySci = await db.query(`
        UPDATE plants
        SET
          entity_name     = COALESCE($1, entity_name),
          scientific_name = COALESCE($2, scientific_name),
          common_names    = COALESCE($3::text[], common_names),
          taxonomy        = COALESCE($4::jsonb, taxonomy),
          description     = COALESCE($5, description),
          images          = COALESCE($6::text[], images),
          access_token    = COALESCE($7, access_token),
          status          = 'active',
          updated_at      = NOW()
        WHERE lower(scientific_name) = lower($2)
        RETURNING id
      `, [
        entityName || null,
        scientificName,
        commonNamesArr,
        taxonomyJson,
        descriptionText,
        imagesArr,
        token
      ]);
      if (bySci.rows.length > 0) return;
    }

    // 3) INSERT si no existe ni por token ni por scientific_name
    await db.query(`
      INSERT INTO plants (
        entity_name, scientific_name, common_names, taxonomy, description, images, access_token, status
      ) VALUES ($1, $2, $3::text[], $4::jsonb, $5, $6::text[], $7, 'active')
    `, [
      entityName || scientificName || null,
      scientificName || null,
      commonNamesArr,
      taxonomyJson,
      descriptionText,
      imagesArr,
      token
    ]);
  }

  // Guarda resultados de API (historial)
  async storeApiResults(apiResults, query) {
    try {
      const { entities, entities_trimmed, limit } = apiResults;
      const totalResults = entities.length;

      const searchResult = await db.query(`
        INSERT INTO plant_search_results (
          search_query, api_response, total_results, entities_trimmed, limit_value
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        query,
        JSON.stringify(apiResults),
        totalResults,
        entities_trimmed ?? false,
        limit ?? null
      ]);

      const searchResultId = searchResult.rows[0].id;

      for (const entity of entities) {
        await db.query(`
          INSERT INTO plant_search_entities (
            search_result_id, plant_id, entity_name, access_token, 
            matched_in, matched_in_type, match_position, match_length
          )
          VALUES (
            $1,
            (SELECT id FROM plants WHERE lower(access_token) = lower($2) LIMIT 1),
            $3, $2, $4, $5, $6, $7
          )
        `, [
          searchResultId,
          entity.access_token || null,
          entity.entity_name || null,
          entity.matched_in || null,
          entity.matched_in_type || null,
          entity.match_position ?? null,
          entity.match_length ?? null
        ]);
      }

      return searchResultId;
    } catch (error) {
      console.error('Error al almacenar datos de la API:', error);
    }
  }

  // Inserta mínimamente entidades en plants si no existen (por token)
  async saveEntitiesToPlants(entities) {
    for (const e of entities) {
      try {
        const token = (e.access_token || '').trim();
        if (!token) continue;

        const exists = await db.query(
          `SELECT id FROM plants WHERE lower(access_token) = lower($1) LIMIT 1`,
          [token]
        );
        if (exists.rows.length > 0) continue;

        await db.query(`
          INSERT INTO plants (entity_name, access_token, status)
          VALUES ($1, $2, 'active')
        `, [
          e.entity_name || null,
          token
        ]);
      } catch (err) {
        if (err.code !== '23505') {
          console.error('saveEntitiesToPlants insert error:', err.message);
        }
      }
    }
  }

  async formatSearchResults(entities, page, limit) {
    // Si son entidades de la API, intentar obtener datos ricos de la DB por access_token
    const enrichedPlants = await Promise.all(
      entities.map(async (entity) => {
        const token = (entity.access_token || '').trim();
        if (!token) {
          return {
            entity_name: entity.entity_name,
            access_token: entity.access_token,
            matched_in: entity.matched_in,
            matched_in_type: entity.matched_in_type
          };
        }

        // Buscar datos ricos en DB por token
        try {
          const dbPlant = await db.query(`
            SELECT entity_name, scientific_name, common_names, taxonomy, images, access_token
            FROM plants 
            WHERE lower(access_token) = lower($1) 
            LIMIT 1
          `, [token]);

          if (dbPlant.rows.length > 0) {
            const plant = dbPlant.rows[0];
            return {
              entity_name: plant.entity_name,
              scientific_name: plant.scientific_name,
              common_names: plant.common_names,
              taxonomy: plant.taxonomy,
              images: plant.images,
              access_token: plant.access_token,
              matched_in: entity.matched_in,
              matched_in_type: entity.matched_in_type
            };
          }
        } catch (err) {
          console.error('Error enriching search result:', err.message);
        }

        // Fallback: datos básicos de la entidad
        return {
          entity_name: entity.entity_name,
          access_token: entity.access_token,
          matched_in: entity.matched_in,
          matched_in_type: entity.matched_in_type
        };
      })
    );

    return {
      plants: enrichedPlants,
      total: entities.length,
      page,
      limit,
      totalPages: Math.ceil(entities.length / limit)
    };
  }

  async getAndCachePlantDetails(accessToken) {
    const details = await plantIdService.getPlantDetails(accessToken);
    await this.upsertPlantFromDetails(details, accessToken);
    return details;
  }

  async getAndCachePlantDetailsByName(plantName) {
    const dbRes = await db.query(`
      SELECT access_token 
      FROM plants 
      WHERE entity_name = $1 
         OR $1 = ANY(common_names)
         OR scientific_name = $1
      LIMIT 1
    `, [plantName]);

    let accessToken = dbRes.rows[0]?.access_token || null;

    if (!accessToken) {
      const apiResults = await plantIdService.searchPlantsByName(plantName, 1);
      if (apiResults.entities && apiResults.entities.length > 0) {
        accessToken = apiResults.entities[0].access_token;
        await this.saveEntitiesToPlants([{ entity_name: apiResults.entities[0].entity_name, access_token: accessToken }]);
      } else {
        return null;
      }
    }

    const details = await plantIdService.getPlantDetails(accessToken);
    await this.upsertPlantFromDetails(details, accessToken);
    return { details, accessToken };
  }

  async getPlantById(id) {
    const res = await db.query(
      `SELECT id, entity_name, scientific_name, common_names, taxonomy, description, images, status, access_token, created_at, updated_at
       FROM plants
       WHERE id = $1 AND status = 'active'`,
      [id]
    );
    return res.rows[0] || null;
  }

  // Crear planta (mínimo entity_name; arrays y JSONB opcionales)
  async createPlant(plantData) {
    const commonNames = Array.isArray(plantData.common_names) ? plantData.common_names : [];
    const images = Array.isArray(plantData.images) ? plantData.images : [];
    const taxonomyJson = plantData.taxonomy ? JSON.stringify(plantData.taxonomy) : null;

    try {
      const res = await db.query(`
        INSERT INTO plants (
          entity_name, scientific_name, common_names, taxonomy, description, images, access_token, status
        ) VALUES ($1, $2, $3::text[], $4::jsonb, $5, $6::text[], $7, COALESCE($8, 'active'))
        RETURNING *
      `, [
        plantData.entity_name,
        plantData.scientific_name || null,
        commonNames.length ? commonNames : null, // null para no forzar []
        taxonomyJson,
        plantData.description || null,
        images.length ? images : null,
        plantData.access_token || null,
        plantData.status || 'active'
      ]);
      return res.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Plant with this scientific name or access token already exists');
      }
      throw err;
    }
  }

  // Actualizar planta parcialmente (maneja JSONB y text[])
  async updatePlant(id, updates) {
    const fields = [];
    const values = [];
    let i = 1;

    const push = (sql, val) => { fields.push(sql); values.push(val); i++; };

    if (typeof updates.entity_name !== 'undefined') {
      push(`entity_name = $${i}`, updates.entity_name);
    }
    if (typeof updates.scientific_name !== 'undefined') {
      push(`scientific_name = $${i}`, updates.scientific_name);
    }
    if (typeof updates.common_names !== 'undefined') {
      const arr = Array.isArray(updates.common_names) ? updates.common_names : null;
      // casteo a text[]; si viene null, no se toca, si quieres limpiar, pasa []
      push(`common_names = COALESCE($${i}::text[], common_names)`, arr && arr.length ? arr : null);
    }
    if (typeof updates.taxonomy !== 'undefined') {
      const tx = updates.taxonomy ? JSON.stringify(updates.taxonomy) : null;
      push(`taxonomy = COALESCE($${i}::jsonb, taxonomy)`, tx);
    }
    if (typeof updates.description !== 'undefined') {
      push(`description = COALESCE($${i}, description)`, updates.description || null);
    }
    if (typeof updates.images !== 'undefined') {
      const arr = Array.isArray(updates.images) ? updates.images : null;
      push(`images = COALESCE($${i}::text[], images)`, arr && arr.length ? arr : null);
    }
    if (typeof updates.access_token !== 'undefined') {
      push(`access_token = COALESCE($${i}, access_token)`, updates.access_token || null);
    }

    if (fields.length === 0) {
      throw new Error('Campos invalidos para actualizar');
    }

    // updated_at
    fields.push(`updated_at = NOW()`);

    // WHERE id
    values.push(id);

    const sql = `
      UPDATE plants
      SET ${fields.join(', ')}
      WHERE id = $${i}
      RETURNING *
    `;

    const res = await db.query(sql, values);
    return res.rows[0] || null;
  }

  // Cambiar status (active/inactive)
  async changeStatus(id, status) {
    const res = await db.query(`
      UPDATE plants
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    return res.rows[0] || null;
  }

  // Familias (distintas), con conteo e imagen de muestra
  async getFamilies(page = 1, limit = 25) {
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.max(1, Math.min(parseInt(limit) || 25, 100));
    const offset = (safePage - 1) * safeLimit;

    // total de familias distintas
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT DISTINCT (taxonomy->>'family') AS family
        FROM plants
        WHERE status = 'active'
          AND taxonomy ? 'family'
          AND COALESCE(NULLIF(taxonomy->>'family',''), '') <> ''
      ) t
    `;

    // listado paginado con conteo e imagen de muestra
    const listSql = `
      SELECT
        family,
        COUNT(*)::int AS plant_count,
        MAX(CASE WHEN images IS NOT NULL AND array_length(images,1) > 0 THEN images[1] END) AS sample_image
      FROM (
        SELECT
          (taxonomy->>'family') AS family,
          images
        FROM plants
        WHERE status = 'active'
          AND taxonomy ? 'family'
          AND COALESCE(NULLIF(taxonomy->>'family',''), '') <> ''
      ) p
      GROUP BY family
      ORDER BY family
      LIMIT $1 OFFSET $2
    `;

    const [countRes, listRes] = await Promise.all([
      db.query(countSql),
      db.query(listSql, [Number(safeLimit), Number(offset)])
    ]);

    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / safeLimit);

    return {
      families: listRes.rows.map(r => ({
        family: r.family,
        plant_count: r.plant_count,
        sample_image: r.sample_image || null
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages
    };
  }
}

module.exports = new PlantService();
