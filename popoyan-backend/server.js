const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const plantRoutes = require('./routes/plantRoutes');
const identificationRoutes = require('./routes/identificationRoutes');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Limite de solicitudes por IP
// 15 minutes, 100 requests per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limite de solicitudes por IP
});

// Middleware
app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.use('/api/plants', plantRoutes);
app.use('/api/identification', identificationRoutes);

// Salud check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error de los middlewares
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: '¡Algo salió mal!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar el servidor
app.listen(PORT, async () => {
  try {
    await db.testConnection();
    console.log(`Servidor escuchando en el puerto ${PORT}...`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  } catch (error) {
    console.error('Fallo al iniciar el servidor', error);
    process.exit(1);
  }
});