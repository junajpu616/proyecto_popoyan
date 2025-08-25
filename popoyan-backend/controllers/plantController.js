const plantService = require('../services/plantService');
const plantIdService = require('../services/plantIdService');
const db = require('../config/database');

class PlantController {
  async searchPlants(req, res) {
    try {
      const { q: query, page = 1, limit = 25 } = req.query;

      if (!query) {
        return res.status(400).json({
          error: 'El párametro "q" es requerido'
        });
      }

      const result = await plantService.searchPlants(
        query,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result,
        message: `Found ${result.total} plants`
      });
    } catch (error) {
      console.error('Error al buscar las plantas:', error);
      res.status(500).json({
        error: 'Fallo al buscar las plantas',
        message: error.message
      });
    }
  }

  async getAllPlants(req, res) {
    try {
      const { page = 1, limit = 25 } = req.query;
      const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : req.query.status;
      const status = rawStatus === '' ? null : rawStatus;

      const result = await plantService.getAllPlants(
        parseInt(page),
        parseInt(limit),
        status
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get all plants error:', error);
      res.status(500).json({
        error: 'Fallo al obtener todas las plantas',
        message: error.message
      });
    }
  }

  async getFamilies(req, res) {
    try {
      const { page = 1, limit = 25 } = req.query;
      const result = await plantService.getFamilies(parseInt(page), parseInt(limit));
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Get families error:', error);
      res.status(500).json({
        error: 'Fallo al obtener las familias',
        message: error.message
      });
    }
  }

  async getPlantById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          error: 'Se requiere un ID válido'
        });
      }

      const plant = await plantService.getPlantById(parseInt(id));

      if (!plant) {
        return res.status(404).json({
          error: 'Planta no encontrada'
        });
      }

      res.json({
        success: true,
        data: plant
      });
    } catch (error) {
      console.error('Get plant by ID error:', error);
      res.status(500).json({
        error: 'Fallo al obtener la planta por ID',
        message: error.message
      });
    }
  }

  async createPlant(req, res) {
    try {
      const plantData = req.body;
      const newPlant = await plantService.createPlant(plantData);

      res.status(201).json({
        success: true,
        data: newPlant,
        message: 'Planta creada exitosamente'
      });
    } catch (error) {
      console.error('Create plant error:', error);

      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: error.message
        });
      }

      res.status(500).json({
        error: 'Fallo al crear la planta',
        message: error.message
      });
    }
  }

  async updatePlant(req, res) {
    try {
      const { id } = req.params;
      let updates = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          error: 'Se requiere un ID válido'
        });
      }

      const normalized = {};

      if (typeof updates.entity_name !== 'undefined') {
        normalized.entity_name = updates.entity_name || null;
      }
      if (typeof updates.scientific_name !== 'undefined') {
        normalized.scientific_name = updates.scientific_name || null;
      }

      if (typeof updates.common_names !== 'undefined') {
        if (Array.isArray(updates.common_names)) {
          normalized.common_names = updates.common_names;
        } else if (typeof updates.common_names === 'string') {
          const arr = updates.common_names
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          if (arr.length > 0) normalized.common_names = arr;
        }
      }

      if (typeof updates.images !== 'undefined') {
        if (Array.isArray(updates.images)) {
          normalized.images = updates.images;
        } else if (typeof updates.images === 'string') {
          const arr = updates.images
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          if (arr.length > 0) normalized.images = arr;
        }
      }

      if (typeof updates.taxonomy !== 'undefined') {
        if (updates.taxonomy && typeof updates.taxonomy === 'object') {
          normalized.taxonomy = updates.taxonomy;
        } else if (typeof updates.taxonomy === 'string') {
          try {
            const parsed = JSON.parse(updates.taxonomy);
            if (parsed && typeof parsed === 'object') {
              normalized.taxonomy = parsed;
            }
          } catch (e) {
            return res.status(400).json({
              error: 'Invalid taxonomy JSON'
            });
          }
        } else if (updates.taxonomy === null) {
          normalized.taxonomy = null;
        }
      }

      if (typeof updates.description !== 'undefined') {
        normalized.description = updates.description || null;
      }

      if (typeof updates.access_token !== 'undefined') {
        normalized.access_token = updates.access_token || null;
      }

      if (Object.keys(normalized).length === 0) {
        return res.status(400).json({ error: 'No hay datos para actualizar' });
      }

      const updatedPlant = await plantService.updatePlant(parseInt(id), normalized);

      if (!updatedPlant) {
        return res.status(404).json({
          error: 'Planta no encontrada'
        });
      }

      res.json({
        success: true,
        data: updatedPlant,
        message: 'Planta actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error al actualizar la planta:', error);
      res.status(500).json({
        error: 'Fallo al actualizar la planta',
        message: error.message
      });
    }
  }

  async getSearchHistory(req, res) {
    try {
      const { page = 1, limit = 25 } = req.query;

      const result = await plantService.getSearchHistory(
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get search history error:', error);
      res.status(500).json({
        error: 'Fallo al obtenere historial',
        message: error.message
      });
    }
  }

  async getPlantDetails(req, res) {
    try {
      const { accessToken } = req.params;

      if (!accessToken) {
        return res.status(400).json({
          error: 'Access token es requerido'
        });
      }

      const details = await plantService.getAndCachePlantDetails(accessToken);

      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      console.error('Get plant details error:', error);
      res.status(500).json({ 
        error: 'Fallo al obtener los detalles de la planta',
        message: error.message 
      });
    }
  }

  async getPlantDetailsByName(req, res) {
    try {
      const { plantName } = req.params;
      
      if (!plantName) {
        return res.status(400).json({ 
          error: 'Nombre de la planta es requerido',
        });
      }

      const result = await plantService.getAndCachePlantDetailsByName(plantName);

      if (!result) {
        return res.status(404).json({ error: 'Planta no encontrada' });
      }

      res.json({
        success: true,
        data: result.details,
        access_token: result.accessToken,
        source: 'api-or-db' // depende de si ya existía el token en DB
      });
    } catch (error) {
      console.error('Get plant details by name error:', error);
      res.status(500).json({ 
        error: 'Fallo al obtener los detalles de la planta por nombre',
        message: error.message 
      });
    }
  }

  async changeStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          error: 'Se requiere un ID válido'
        });
      }

      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          error: 'Status es requerido y debe ser "active" o "inactive"'
        });
      }

      const updatedPlant = await plantService.changeStatus(parseInt(id), status);

      if (!updatedPlant) {
        return res.status(404).json({
          error: 'Planta no encontrada'
        });
      }

      res.json({
        success: true,
        data: updatedPlant,
        message: `Status de la planta cambiada a: ${status}`
      });
    } catch (error) {
      console.error('Change plant status error:', error);
      res.status(500).json({
        error: 'Fallo al cambiar el status de la planta',
        message: error.message
      });
    }
  }
}

module.exports = new PlantController();
