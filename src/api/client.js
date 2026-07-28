import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your local IP address if testing on a physical device
// Automatically use the cloud backend URL from .env
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://merge-backend.onrender.com/api'; 
export const SOCKET_URL = BASE_URL.replace('/api', '');

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // Increased to 60s for Render cold starts
});

// Add a request interceptor to add the auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to clear auth on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
