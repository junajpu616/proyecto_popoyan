const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');
const { validatePlantCreation, validatePlantUpdate, validatePagination } = require('../middleware/validation');
const usageController = require('../controllers/usageController'); // ← agregar import

// Buscar plantas por nombre
router.get('/search', validatePagination, plantController.searchPlants);

router.get('/history', validatePagination, plantController.getSearchHistory); // Endpoint para buscar por historial

// Obtener detalles de una planta por su access token
router.get('/details/:accessToken', plantController.getPlantDetails);

// Obtener detalles de una planta por nombre
router.get('/details-by-name/:plantName', plantController.getPlantDetailsByName);

// Obtener todas las plantas con paginación
router.get('/', validatePagination, plantController.getAllPlants);

// Familias (mosaico) con paginación
router.get('/families', validatePagination, plantController.getFamilies);

// Estadísticas de uso del API Key (unificado aquí)
router.get('/usage/info', (req, res) => usageController.getUsageInfo(req, res));

// Obtener plantas por ID
router.get('/:id', plantController.getPlantById);

// Crear nueva planta
router.post('/', validatePlantCreation, plantController.createPlant);

// Actualizar planta por ID
router.put('/:id', validatePlantUpdate, plantController.updatePlant);

// Cambiar estado de una planta por ID
router.patch('/:id/status', plantController.changeStatus);

module.exports = router;