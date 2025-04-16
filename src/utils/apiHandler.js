import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = 'https://api.starcitizen-api.com';
const API_KEY = process.env.STARCITIZEN_API_KEY;
const API_MODE = process.env.STARCITIZEN_API_MODE

class ApiHandler {
    static async fetchData(endpoint, params = {}) {
        try {
            const response = await axios.get(`${API_BASE_URL}/${API_KEY}/v1/${API_MODE}/${endpoint}`, {
                params
            });
            return response.data;
        } catch (error) {
            console.error('API Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch data from Star Citizen API');
        }
    }
}

export default ApiHandler;