const db = require('../config/database');
const plantIdService = require('./plantIdService');

class IdentificationService {
  async identifyPlant(imageData, filename = null) {
    try {
      // Llamar a la API de plantId
      const identification = await plantIdService.identifyPlant(imageData);
      
      // Calcular el score de confianza
      const confidenceScore = identification.suggestions?.[0]?.probability || 0;
      
      // Almacenar en la base de datos
      const result = await db.query(`
        INSERT INTO plant_identifications (
          original_filename, image_data, identification_results, confidence_score
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        filename,
        imageData,
        JSON.stringify(identification),
        confidenceScore
      ]);

      return {
        id: result.rows[0].id,
        identification,
        confidence_score: confidenceScore,
        created_at: result.rows[0].created_at
      };
    } catch (error) {
      console.error('Error de identificación:', error);
      throw error;
    }
  }

  async getIdentificationHistory(page = 1, limit = 25) {
    try {
      const offset = (page - 1) * limit;
      
      const [identifications, countResult] = await Promise.all([
        db.query(`
          SELECT 
            id, original_filename, identification_results, 
            confidence_score, status, created_at
          FROM plant_identifications 
          ORDER BY created_at DESC 
          LIMIT $1 OFFSET $2
        `, [limit, offset]),
        
        db.query('SELECT COUNT(*) as total FROM plant_identifications')
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        identifications: identifications.rows,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      throw error;
    }
  }

  async updateIdentificationStatus(id, status) {
    try {
      const result = await db.query(`
        UPDATE plant_identifications 
        SET status = $1 
        WHERE id = $2 
        RETURNING *
      `, [status, id]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new IdentificationService();
