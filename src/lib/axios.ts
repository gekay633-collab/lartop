import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001', // Verifique se o seu servidor roda na 3001
});

export default api;