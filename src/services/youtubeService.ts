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

    // 1. Core Simple Search (Minimal data)
    searchVideosBasic: async (apiKey: string, query: string, params: any = {}) => {
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
    },

    // 2. Optimized Multi-Region Search
    searchMultiRegion: async (apiKey: string, query: string, selectedRegions: string[], commonParams: any = {}) => {
        try {
            const allItems: any[] = [];
            const seenVideoIds = new Set<string>();

            // Phase 1: Parallel Region Search (Minimal payload)
            // If no regions, default to 'global' (empty regionCode)
            const regionsToSearch = selectedRegions.length === 0 ? [''] : selectedRegions;

            const regionRequests = regionsToSearch.map(regionCode => {
                const searchParams = regionCode ? { ...commonParams, regionCode } : commonParams;
                return youtubeService.searchVideosBasic(apiKey, query, searchParams)
                    .then(data => {
                        const items = data?.items || [];
                        return items.map((item: any) => ({ ...item, _searchRegion: regionCode || 'GL' }));
                    })
                    .catch(err => {
                        console.error(`Search error for region ${regionCode}:`, err);
                        return [];
                    });
            });

            const resultsByRegion = await Promise.all(regionRequests);
            const flatResults = resultsByRegion.flat();

            // Deduplicate and collect IDs
            flatResults.forEach((item: any) => {
                const vId = item.id?.videoId || item.id;
                if (vId && !seenVideoIds.has(vId)) {
                    seenVideoIds.add(vId);
                    allItems.push(item);
                }
            });

            if (allItems.length === 0) return { items: [] };

            // Phase 2: Bulk Detail Fetching (50 at a time)
            const videoIdsArr = allItems.map(item => item.id?.videoId || item.id);
            const channelIdsArray = [...new Set(allItems.map(item => item.snippet?.channelId))].filter(Boolean) as string[];

            const videoStatsMap: any = {};
            const channelStatsMap: any = {};

            // Helper to chunk arrays
            const chunkArray = (arr: any[], size: number) =>
                Array.from({ length: Math.ceil(arr.length / size) }, (_v, i) => arr.slice(i * size, i * size + size));

            // Fetch Video Stats in Parallel (Chunked by 50)
            const videoChunks = chunkArray(videoIdsArr, 50);
            await Promise.all(videoChunks.map(async (ids) => {
                try {
                    const res = await axios.get(`${BASE_URL}/videos`, {
                        params: { key: apiKey, part: 'statistics,contentDetails', id: ids.join(',') }
                    });
                    (res.data.items || []).forEach((v: any) => {
                        videoStatsMap[v.id] = { statistics: v.statistics || {}, contentDetails: v.contentDetails || {} };
                    });
                } catch (err) {
                    console.error('Error fetching video stats batch:', err);
                }
            }));

            // Fetch Channel Stats in Parallel (Chunked by 50)
            const channelChunks = chunkArray(channelIdsArray, 50);
            await Promise.all(channelChunks.map(async (ids) => {
                try {
                    const res = await axios.get(`${BASE_URL}/channels`, {
                        params: { key: apiKey, part: 'statistics', id: ids.join(',') }
                    });
                    (res.data.items || []).forEach((c: any) => {
                        channelStatsMap[c.id] = c.statistics || {};
                    });
                } catch (err) {
                    console.error('Error fetching channel stats batch:', err);
                }
            }));

            // Phase 3: Final Merge & Slim Down
            const finalItems = allItems.map(item => {
                const vId = item.id?.videoId || item.id;
                const cId = item.snippet?.channelId;
                const vStats = videoStatsMap[vId] || {};
                const cInfo = channelStatsMap[cId] || {};

                return {
                    id: { videoId: vId },
                    searchRegion: item._searchRegion,
                    snippet: {
                        title: item.snippet?.title || 'Unknown Title',
                        channelTitle: item.snippet?.channelTitle || 'Unknown Channel',
                        channelId: cId,
                        publishedAt: item.snippet?.publishedAt,
                        thumbnails: {
                            medium: { url: item.snippet?.thumbnails?.medium?.url }
                        }
                    },
                    statistics: {
                        viewCount: vStats.statistics?.viewCount || '0',
                        likeCount: vStats.statistics?.likeCount || '0',
                    },
                    contentDetails: {
                        duration: vStats.contentDetails?.duration || ''
                    },
                    channelStatistics: {
                        subscriberCount: cInfo.subscriberCount || '0',
                        viewCount: cInfo.viewCount || '0',
                    }
                };
            });

            return { items: finalItems };
        } catch (error) {
            console.error('Multi-Region Search Error:', error);
            throw error;
        }
    },

    // Fallback/Legacy
    searchVideos: async (apiKey: string, query: string, params: any = {}) => {
        return youtubeService.searchMultiRegion(apiKey, query, params.regionCode ? [params.regionCode] : [], params);
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
            const items = response.data?.items || [];
            return items.map((item: any) => ({
                id: item.snippet.gl,
                name: item.snippet.name,
            }));
        } catch (error) {
            console.error('Fetch Regions Error:', error);
            return [];
        }
    },
};
