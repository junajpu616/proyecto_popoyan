const axios = require('axios');

class PlantIdService {
  constructor() {
    this.apiKey = process.env.PLANTID_API_KEY;
    this.baseUrl = process.env.PLANTID_BASE_URL || 'https://plant.id/api/v3';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.apiKey
      }
    });
  }

  // Buscar plantas por nombre
  async searchPlantsByName(query, limit = 25) {
    try {
      const q = typeof query === 'string' ? query.trim() : '';
      // Solo permitimos busquedas de 1 a 20 plantas por consulta (la API solo permite 20 por consulta)
      const lim = Math.max(1, Math.min(parseInt(limit) || 20, 20));
      const response = await this.client.get('/kb/plants/name_search', {
        params: { q, limit: lim }
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const apiMsg = error.response?.data?.error || error.response?.data || error.message;
      console.error('PlantId API error:', apiMsg);
      const err = new Error(`Error al buscar planta: ${apiMsg}`);
      err.status = status;
      throw err;
    }
  }

  // Obtener detalles de una planta por su access_token
  async getPlantDetails(accessToken) {
    try {
      const response = await this.client.get(`/kb/plants/${accessToken}`, {
        params: {
          details: 'common_names,url,description,taxonomy,rank,gbif_id,inaturalist_id,image,synonyms,edible_parts,watering,propagation_methods',
          language: 'es'
        }
      });
      return response.data;
    } catch (error) {
      console.error('PlantId API details error:', error.response?.data || error.message);
      throw new Error(`Fallo al obtener detalles: ${error.response?.data?.error || error.message}`);
    }
  }
  // Identificar una planta por imagen (Plant.ID v3)
  // imageData: base64 string
  // options: { latitude?: number, longitude?: number, similar_images?: boolean }
  async identifyPlant(imageData, options = {}) {
    try {
      const payload = {
        images: [imageData],
        ...(typeof options.latitude === 'number' && { latitude: options.latitude }),
        ...(typeof options.longitude === 'number' && { longitude: options.longitude }),
        similar_images: typeof options.similar_images === 'boolean' ? options.similar_images : true
      };

      const response = await this.client.post('/identification', payload);
      return response.data;
    } catch (error) {
      const apiData = error.response?.data;
      console.error('PlantId API identification error:', apiData || error.message);
      const apiMsg = apiData?.error || apiData || error.message;
      throw new Error(`Plant identification failed: ${apiMsg}`);
    }
  }

  // Usage info (créditos y estado del API Key)
  async getUsageInfo() {
    try {
      const response = await this.client.get('/usage_info');
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const apiMsg = error.response?.data?.error || error.response?.data || error.message;
      const err = new Error(`Usage info fetch failed: ${apiMsg}`);
      err.status = status;
      throw err;
    }
  }

  // Chatbot sobre una identificación (Plant.ID v3)
  // payload: { question: string, prompt?: string, temperature?: number, app_name?: string, stream?: boolean }
  async askChat(accessToken, payload) {
    try {
      const path = `/identification/${encodeURIComponent(accessToken)}/conversation`;
      const response = await this.client.post(path, {
        question: payload.question,
        ...(payload.prompt ? { prompt: payload.prompt } : {}),
        ...(typeof payload.temperature === 'number' ? { temperature: payload.temperature } : {}),
        ...(payload.app_name ? { app_name: payload.app_name } : {}),
        ...(typeof payload.stream === 'boolean' ? { flow: payload.stream } : {})
      });
      return response.data; // { messages: [...], identification, remaining_calls, ... }
    } catch (error) {
      const status = error.response?.status;
      const apiMsg = error.response?.data?.error || error.response?.data || error.message;
      const err = new Error(`Chatbot request failed: ${apiMsg}`);
      err.status = status;
      throw err;
    }
  }

  // Snapshot remoto de la conversación (devuelve todo el hilo actual)
  async getConversationSnapshot(accessToken) {
    const path = `/identification/${encodeURIComponent(accessToken)}/conversation`;
    const response = await this.client.post(path, {
      question: 'Return conversation history only.',
      app_name: 'HistoryBot',
      temperature: 0.0
    });
    return response.data;
  }
}

module.exports = new PlantIdService();