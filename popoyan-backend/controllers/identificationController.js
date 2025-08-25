const identificationService = require('../services/identificationService');
const plantIdService = require('../services/plantIdService');
const db = require('../config/database');

class IdentificationController {
  async identifyPlant(req, res) {
    try {
      const file = req.file;
      const imageData = req.body.image || null;

      if (!file && !imageData) {
        return res.status(400).json({ error: 'La imagen es requerida' });
      }

      const imgBase64 = imageData || file.buffer.toString('base64');

      const filename = file?.originalname || null;
      const result = await identificationService.identifyPlant(imgBase64, filename);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('identifyPlant error:', error);
      res.status(500).json({
        error: 'Fallo al identificar la planta',
        message: error.message
      });
    }
  }

  async getIdentificationHistory(req, res) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '25', 10);

      const result = await identificationService.getIdentificationHistory(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('getIdentificationHistory error:', error);
      res.status(500).json({
        error: 'Fallo al obtener el historial de identificaciones',
        message: error.message
      });
    }
  }

  async updateIdentificationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'Se requiere un ID válido' });
      }

      if (!status) {
        return res.status(400).json({ error: 'Status es requerido' });
      }

      const updated = await identificationService.updateIdentificationStatus(parseInt(id, 10), status);

      if (!updated) {
        return res.status(404).json({ error: 'Identificación no encontrada' });
      }

      res.json({
        success: true,
        data: updated,
        message: 'Identification status updated'
      });
    } catch (error) {
      console.error('updateIdentificationStatus error:', error);
      res.status(500).json({
        error: 'Fallo al cambiar el status',
        message: error.message
      });
    }
  }

  async conversationAsk(req, res) {
    try {
      const { accessToken } = req.params;
      const { question, prompt, temperature, app_name, stream } = req.body || {};

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token es requerido' });
      }
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Pregunta es requerida y debe ser una cadena de texto' });
      }

      const data = await plantIdService.askChat(accessToken, { question, prompt, temperature, app_name, stream });

      try {
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        for (const m of msgs) {
          if (!m?.content || !m?.type) continue;
          await db.query(
            `
            INSERT INTO plant_chat_messages (identification_access_token, content, type, created_at)
            VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))
            ON CONFLICT (identification_access_token, content, type, created_at) DO NOTHING
            `,
            [
              accessToken,
              String(m.content),
              String(m.type),
              m.created ? new Date(m.created).toISOString() : null
            ]
          );
        }
      } catch (persistErr) {
        console.error('Fallo para mostrar los chats', persistErr.message);
      }

      return res.json({ success: true, data });
    } catch (error) {
      console.error('conversationAsk error:', error);
      res.status(error.status || 500).json({
        error: 'Fallo al enviar la pregunta al chatbot',
        message: error.message
      });
    }
  }

  async conversationHistory(req, res) {
    try {
      const { accessToken } = req.params;
      if (!accessToken) {
        return res.status(400).json({ error: 'Access token es requerido' });
      }

      const { rows } = await db.query(
        `SELECT id, content, type, created_at
         FROM plant_chat_messages
         WHERE identification_access_token = $1
         ORDER BY created_at ASC,
                  CASE WHEN type = 'question' THEN 0 ELSE 1 END,
                  id ASC`,
        [accessToken]
      );

      res.json({
        success: true,
        data: {
          access_token: accessToken,
          messages: rows
        }
      });
    } catch (error) {
      console.error('conversationHistory error:', error);
      res.status(500).json({
        error: 'Fallo al obtener el historial de chat',
        message: error.message
      });
    }
  }

  async getConversationSnapshot(accessToken) {
    try {
      const path = `/identification/${encodeURIComponent(accessToken)}/conversation`;
      const response = await this.client.post(path, {
        question: 'Return conversation history only.',
        app_name: 'HistoryBot',
        temperature: 0.0
      });
      return response.data; // { messages, identification, remaining_calls, ... }
    } catch (error) {
      const status = error.response?.status;
      const apiMsg = error.response?.data?.error || error.response?.data || error.message;
      const err = new Error(`Conversation snapshot failed: ${apiMsg}`);
      err.status = status;
      throw err;
    }
  }

  // Devuelve snapshot remoto de la conversación (no persiste en DB)
  async conversationRemote(req, res) {
    try {
      const { accessToken } = req.params;
      if (!accessToken) {
        return res.status(400).json({ error: 'Access token es requerido' });
      }

      const data = await plantIdService.getConversationSnapshot(accessToken);

      return res.json({
        success: true,
        data: {
          access_token: accessToken,
          messages: Array.isArray(data.messages) ? data.messages : [],
          remaining_calls: data.remaining_calls ?? null,
          model_parameters: data.model_parameters ?? null
        }
      });
    } catch (error) {
      console.error('conversationRemote error:', error);
      res.status(error.status || 500).json({
        error: 'Fallo al obtener el historial de chat',
        message: error.message
      });
    }
  }

  async conversationHistoryAll(req, res) {
    try {
      const { rows } = await db.query(
        `SELECT id,
                identification_access_token AS access_token,
                content,
                type,
                created_at
         FROM plant_chat_messages
         ORDER BY created_at ASC,
                  CASE WHEN type = 'question' THEN 0 ELSE 1 END,
                  id ASC`
      );

      res.json({
        success: true,
        data: {
          messages: rows
        }
      });
    } catch (error) {
      console.error('conversationHistoryAll error:', error);
      res.status(500).json({
        error: 'Fallo al obtener el historial de chat',
        message: error.message
      });
    }
  }
}

module.exports = new IdentificationController();
