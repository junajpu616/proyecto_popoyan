const plantIdService = require('../services/plantIdService');

class UsageController {
  async getUsageInfo(req, res) {
    try {
      const data = await plantIdService.getUsageInfo();

      // Estructura directa de la API + resumen útil
      const summary = {
        active: data.active,
        can_use: data.can_use_credits?.value ?? null,
        reason: data.can_use_credits?.reason ?? null,
        credit_limits: data.credit_limits,
        used: data.used,
        remaining: data.remaining
      };

      res.json({ success: true, data: summary, raw: data });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        error: 'Failed to fetch usage info',
        message: error.message
      });
    }
  }
}

module.exports = new UsageController();