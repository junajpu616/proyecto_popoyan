const express = require('express');
const multer = require('multer');
const router = express.Router();
const identificationController = require('../controllers/identificationController');
const { validatePagination } = require('../middleware/validation');

// Configure multer para image upload
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo imágenes son permitidos'), false);
    }
  }
});

// Identificación por imagen (archivo o base64)
router.post('/', upload.single('image'), identificationController.identifyPlant);

// Historial de identificaciones
router.get('/history', validatePagination, identificationController.getIdentificationHistory);

// Actualizar estado de una identificación
router.patch('/:id/status', identificationController.updateIdentificationStatus);

// Chatbot: preguntar
router.post('/:accessToken/conversation', (req, res) => identificationController.conversationAsk(req, res));

// Chatbot: historial local
router.get('/:accessToken/conversation', (req, res) => identificationController.conversationHistory(req, res));

// Chatbot: snapshot remoto (no persiste)
router.get('/:accessToken/conversation/remote', (req, res) => identificationController.conversationRemote(req, res));

// Nuevo: historial local global (todos los chats)
router.get('/conversation', (req, res) => identificationController.conversationHistoryAll(req, res));

module.exports = router;