import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL,
    timeout: 30000,
});

// Add API key to all requests
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const apiKey = sessionStorage.getItem('admin_api_key');
        if (apiKey) {
            config.headers['x-admin-key'] = apiKey;
        }
    }
    return config;
});

// Handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Unauthorized - clear session and redirect to login
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('admin_api_key');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
