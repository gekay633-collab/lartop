import axios from 'axios';

// --- CONFIGURAÇÃO DE URL LARTOP ---
const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api'; 

const nodeApi = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' }
});

/**
 * Valida IDs e limpa o prefixo 'eq.' antigo
 */
const isValidId = (id: any) => {
  if (!id) return false;
  const cleanId = String(id).replace('eq.', '');
  return cleanId !== 'undefined' && cleanId !== 'null' && !isNaN(Number(cleanId));
};

/**
 * Garante que o endpoint não tenha barras duplicadas
 */
const cleanEndpoint = (endpoint: string) => {
  return endpoint.replace(/^\/?api\//, '').replace(/^\//, '');
};

export const api = {
  // --- MÉTODOS GET ---
  get: async (endpoint: string) => {
    if (endpoint.includes('undefined') || endpoint.includes('null')) {
      return { data: [] };
    }

    let path = cleanEndpoint(endpoint);

    // --- 1. CORREÇÃO DE REVIEWS ---
    if (path.includes('reviews')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const providerId = urlParams.get('provider_id')?.replace('eq.', '');
      
      if (isValidId(providerId)) {
        return await nodeApi.get(`/providers/${providerId}/reviews`);
      }
    }

    // --- 2. CORREÇÃO DE ROTA DE PERFIL ---
    const isProfileRequest = 
      path.includes('professional_profiles') || 
      ((path.startsWith('providers/') || path.startsWith('users/')) && path.split('/').length === 2);

    if (isProfileRequest) {
      const parts = path.split('/');
      const targetId = parts[parts.length - 1].replace('id=eq.', '');
      
      try {
        const response = await nodeApi.get('/providers'); 
        const allProviders = response.data || [];
        const found = allProviders.find((p: any) => 
          String(p.id) === String(targetId) || String(p.user_id) === String(targetId)
        );

        if (found) return { data: [found] }; 
        return { data: [] };
      } catch (error) {
        return { data: [] };
      }
    }

    // --- 3. CORREÇÃO DE PEDIDOS (Orders) ---
    if (path.includes('service_orders') || path.includes('orders')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1]);
      const providerId = urlParams.get('provider_id')?.replace('eq.', '');
      const userId = urlParams.get('user_id')?.replace('eq.', '');

      if (isValidId(providerId)) return await nodeApi.get(`/orders/provider/${providerId}`);
      if (isValidId(userId)) return await nodeApi.get(`/orders/user/${userId}`);
    }

    return await nodeApi.get(`/${path}`);
  },

  // --- MÉTODOS POST ---
  post: async (endpoint: string, body: any) => {
    const path = cleanEndpoint(endpoint);
    return await nodeApi.post(`/${path}`, body);
  },

  // --- MÉTODOS PATCH ---
  patch: async (endpoint: string, body: any) => {
    let path = cleanEndpoint(endpoint);

    if (path.includes('service_orders') && path.includes('id=eq.')) {
      const id = path.split('id=eq.')[1];
      return await nodeApi.patch(`/orders/${id}`, body);
    }

    return await nodeApi.patch(`/${path}`, body);
  },

  // --- MÉTODOS PUT ---
  put: async (endpoint: string, body: any) => {
    let path = cleanEndpoint(endpoint);
    const id = path.split('/').pop()?.replace('id=eq.', '');

    const cleanBody = { ...body };
    delete cleanBody.id;
    delete cleanBody.created_at;
    delete cleanBody.email;
    delete cleanBody.tipo;

    try {
      return await nodeApi.put(`/providers/${id}`, cleanBody);
    } catch (error: any) {
      if (error.response?.status === 404) {
        try {
          return await nodeApi.put(`/users/${id}`, cleanBody);
        } catch (innerError) {
          return await nodeApi.patch(`/users/${id}`, cleanBody);
        }
      }
      throw error;
    }
  },

  // --- GESTÃO DE MÍDIA (CLOUDINARY) ---
  uploadPhoto: async (file: File) => {
    const cloudName = 'dtqshamro'; 
    const uploadPreset = 'lartop_preset'; 

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData
      );
      return res.data.secure_url;
    } catch (error) {
      return null;
    }
  }
};

export default api;