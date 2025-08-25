const Joi = require('joi');

const createSchema = Joi.object({
  entity_name: Joi.string().trim().min(1).required(),
  scientific_name: Joi.string().trim().allow(null, ''),
  common_names: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  taxonomy: Joi.alternatives().try(
    Joi.object(),
    Joi.string().trim()
  ).optional(),
  description: Joi.string().allow(null, ''),
  images: Joi.alternatives().try(
    Joi.array().items(Joi.string().uri().trim()),
    Joi.string().trim()
  ).optional(),
  access_token: Joi.string().trim().allow(null, '')
}).required();

const updateSchema = Joi.object({
  entity_name: Joi.string().trim().min(1),
  scientific_name: Joi.string().trim().allow(null, ''),

  common_names: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()).min(1),
    Joi.string().trim().min(1)
  ),

  taxonomy: Joi.alternatives().try(
    Joi.object(),
    Joi.string().trim().min(2)
  ),

  description: Joi.string().allow(null, ''),
  images: Joi.alternatives().try(
    Joi.array().items(Joi.string().uri().trim()).min(1),
    Joi.string().trim().min(1)
  ),
  access_token: Joi.string().trim().allow(null, '')
})
  .min(1) // al menos un campo a actualizar
  .messages({
    'object.min': 'Provee al menos un campo para actualizar',
  });

// Paginación
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  // Permitir vacío ('') y null para representar "todas"
  status: Joi.string().valid('active', 'inactive').allow('', null).optional()
});

// Middlewares
function validatePlantCreation(req, res, next) {
  const { error, value } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'Error al crear la planta',
      details: error.details.map(d => d.message)
    });
  }
  req.body = value;
  next();
}

function validatePlantUpdate(req, res, next) {
  const { error, value } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'Error al actualizar la planta',
      details: error.details.map(d => d.message)
    });
  }
  req.body = value;
  next();
}

function validatePagination(req, res, next) {
  const { error, value } = paginationSchema.validate(req.query,
      { abortEarly: false, allowUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'Error al paginar',
      details: error.details.map(d => d.message)
    });
  }

  const normalized = { ...value };
  if (typeof normalized.status === 'string' && normalized.status.trim() === '') {
    delete normalized.status;
  }
  req.query = { ...req.query, ...normalized };
  next();
}

module.exports = {
  validatePlantCreation,
  validatePlantUpdate,
  validatePagination
};