import axios from 'axios';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const youtubeService = {
    validateApiKey: async (apiKey: string) => {
        try {
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
            // 1. Initial Search
            const searchResponse = await axios.get(`${BASE_URL}/search`, {
                params: {
                    key: apiKey,
                    part: 'snippet',
                    type: 'video',
                    q: query,
                    maxResults: 20,
                    ...params,
                },
            });

            const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId).join(',');
            const channelIds = [...new Set(searchResponse.data.items.map((item: any) => item.snippet.channelId))].join(',');

            // 2. Fetch Video Detailed Stats & Duration
            const videosResponse = await axios.get(`${BASE_URL}/videos`, {
                params: {
                    key: apiKey,
                    part: 'statistics,contentDetails',
                    id: videoIds,
                },
            });

            // 3. Fetch Channel Detailed Stats (Subscribers, Total Views)
            const channelsResponse = await axios.get(`${BASE_URL}/channels`, {
                params: {
                    key: apiKey,
                    part: 'statistics',
                    id: channelIds,
                },
            });

            const videoStatsMap = videosResponse.data.items.reduce((acc: any, item: any) => {
                acc[item.id] = {
                    statistics: item.statistics,
                    contentDetails: item.contentDetails,
                };
                return acc;
            }, {});

            const channelStatsMap = channelsResponse.data.items.reduce((acc: any, item: any) => {
                acc[item.id] = item.statistics;
                return acc;
            }, {});

            // 4. Merge Data
            const mergedItems = searchResponse.data.items.map((item: any) => {
                const vId = item.id.videoId;
                const cId = item.snippet.channelId;
                const vStats = videoStatsMap[vId] || {};
                const cStats = channelStatsMap[cId] || {};

                return {
                    ...item,
                    statistics: vStats.statistics || {},
                    contentDetails: vStats.contentDetails || {},
                    channelStatistics: cStats || {},
                };
            });

            return {
                ...searchResponse.data,
                items: mergedItems,
            };
        } catch (error) {
            console.error('YouTube Search Error:', error);
            throw error;
        }
    },

    getRegions: async (apiKey: string) => {
        try {
            const response = await axios.get(`${BASE_URL}/i18nRegions`, {
                params: {
                    key: apiKey,
                    part: 'snippet',
                    hl: 'ko', // Korean display names
                },
            });
            return response.data.items.map((item: any) => ({
                id: item.snippet.gl,
                name: item.snippet.name,
            }));
        } catch (error) {
            console.error('Fetch Regions Error:', error);
            return [];
        }
    },
};
