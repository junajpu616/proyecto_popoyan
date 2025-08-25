import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 20000,
});

export const searchPlants = async (q, page = 1, limit = 25) => {
  const { data } = await api.get('/plants/search', { params: { q, page, limit } });
  return data.data;
};

export const getPlantDetailsByToken = async (accessToken) => {
  const { data } = await api.get(`/plants/details/${encodeURIComponent(accessToken)}`);
  return data.data;
};

export const getPlantDetailsByName = async (plantName) => {
  const { data } = await api.get(`/plants/details-by-name/${encodeURIComponent(plantName)}`);
  return { details: data.data, accessToken: data.access_token };
};

export const listPlants = async (page = 1, limit = 25, status = 'active') => {
  const { data } = await api.get('/plants', { params: { page, limit, status } });
  return data.data;
};

export const getPlantById = async (id) => {
  const { data } = await api.get(`/plants/${id}`);
  return data.data;
};

export const createPlant = async (payload) => {
  const { data } = await api.post('/plants', payload);
  return data.data;
};

export const updatePlant = async (id, payload) => {
  const { data } = await api.put(`/plants/${id}`, payload);
  return data.data;
};

export const changePlantStatus = async (id, status) => {
  const { data } = await api.patch(`/plants/${id}/status`, { status });
  return data.data;
};

export const identifyPlantByImageFile = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post('/identification', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const getIdentificationHistory = async (page = 1, limit = 25) => {
  const { data } = await api.get('/identification/history', { params: { page, limit } });
  return data.data;
};

export const getFamilies = async (page = 1, limit = 25) => {
  const { data } = await api.get('/plants/families', { params: { page, limit } });
  return data.data; // { families, total, page, limit, totalPages }
};

export const getUsageInfo = async () => {
    const { data } = await api.get('/plants/usage/info'); // moved under /plants
    return data.data;
};

export const chatbotAsk = async (accessToken, payload) => {
  const { data } = await api.post(`/identification/${encodeURIComponent(accessToken)}/conversation`, payload);
  return data.data;
};

export const chatbotHistory = async (accessToken) => {
  const { data } = await api.get(`/identification/${encodeURIComponent(accessToken)}/conversation`);
  return data.data;
};

export const chatbotHistoryAll = async () => {
  const { data } = await api.get('/identification/conversation');
  return data.data;
};

export const chatbotRemoteConversation = async (accessToken) => {
  const { data } = await api.get(`/identification/${encodeURIComponent(accessToken)}/conversation/remote`);
  return data.data;
};
