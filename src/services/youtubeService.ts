import axios from 'axios';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const youtubeService = {
    validateApiKey: async (apiKey: string) => {
        try {
            // Small request to check if the key is valid
            const response = await axios.get(`${BASE_URL}/search`, {
                params: {
                    key: apiKey,
                    part: 'snippet',
                    maxResults: 1,
                    q: 'test',
                },
            });
            return response.status === 200;
        } catch (error) {
            console.error('API Validation Error:', error);
            return false;
        }
    },

    searchVideos: async (apiKey: string, query: string, params: any = {}) => {
        try {
            const response = await axios.get(`${BASE_URL}/search`, {
                params: {
                    key: apiKey,
                    part: 'snippet',
                    type: 'video',
                    q: query,
                    maxResults: 20,
                    ...params,
                },
            });
            return response.data;
        } catch (error) {
            console.error('YouTube Search Error:', error);
            throw error;
        }
    },
};
