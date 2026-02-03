import axios from 'axios';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Mapping: Region Code (ISO 3166-1 alpha-2) -> Language Code (ISO 639-1)
// This ensures that searching for a region prioritizes content in that region's primary language.
// Fallback is 'en' if not listed.
const REGION_LANGUAGE_MAP: Record<string, string> = {
    // East Asia
    'KR': 'ko', // South Korea -> Korean
    'JP': 'ja', // Japan -> Japanese
    'TW': 'zh-Hant', // Taiwan -> Traditional Chinese (YouTube uses zh-Hant or zh)
    'HK': 'zh-Hant', // Hong Kong -> Traditional Chinese
    'CN': 'zh-Hans', // China -> Simplified Chinese

    // English Speaking
    'US': 'en', 'GB': 'en', 'CA': 'en', 'AU': 'en',
    'NZ': 'en', 'IE': 'en', 'SG': 'en',

    // Europe
    'FR': 'fr', 'DE': 'de', 'IT': 'it', 'ES': 'es',
    'RU': 'ru', 'PT': 'pt', 'NL': 'nl',

    // Americas
    'MX': 'es', 'AR': 'es', 'BR': 'pt',

    // SE Asia
    'VN': 'vi', 'TH': 'th', 'ID': 'id', 'PH': 'en', // Philippines often uses English/Tagalog mixed
    'MY': 'ms',

    // Others
    'IN': 'hi', // India -> Hindi (or English, but Hindi ensures local content)
    'SA': 'ar', 'EG': 'ar', 'AE': 'ar', // Arab world -> Arabic
    'TR': 'tr',
};

// Helper: Evaluate candidate relevance (Keep / Drop / Review)
const evaluateCandidate = (item: any, targetRegion: string, targetLang: string) => {
    // Stage 1: English / Global Context
    // If target is globally common (like US/GB), we are lenient.
    if (targetLang === 'en') return true;

    // Stage 2: Strict Metadata Check (Language)
    const audioLang = item.snippet?.defaultAudioLanguage;
    const defaultLang = item.snippet?.defaultLanguage;

    // Explicit Match -> KEEP
    if (audioLang && audioLang.startsWith(targetLang)) return true;
    if (defaultLang && defaultLang.startsWith(targetLang)) return true;

    // Explicit Mismatch (e.g. 'en' audio when looking for 'ko') -> DROP (strictly)
    // We only drop if we are sure it's a mismatch. 
    // If metadata is missing, we proceed to Review.
    if (audioLang && !audioLang.startsWith(targetLang)) return false;

    // Stage 3: Channel Origin Check (Heuristic)
    // If language metadata was inconclusive, check channel country.
    const channelCountry = item.snippet?.channelCountry;
    if (channelCountry && channelCountry === targetRegion) return true; // KEEP

    // Stage 4: Text Heuristic (Final Fallback)
    const textToCheck = `${item.snippet?.title || ''} ${item.snippet?.description || ''} ${item.snippet?.channelTitle || ''}`;

    if (targetLang === 'ko') return /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(textToCheck);
    if (targetLang === 'ja') return /[\u3040-\u309F\u30A0-\u30FF]/.test(textToCheck);
    if (targetLang.startsWith('zh')) return /[\u4E00-\u9FFF]/.test(textToCheck);
    if (targetLang === 'ar') return /[\u0600-\u06FF]/.test(textToCheck);
    if (targetLang === 'ru') return /[\u0400-\u04FF]/.test(textToCheck);

    // Default: If purely ambiguous, let it pass (Review -> Keep) to avoid over-filtering,
    // or return false if we want extreme strictness. 
    // Given 'need to filter foreign content', we'll lean strict for KR/JP.
    if (['ko', 'ja'].includes(targetLang)) return false;

    return true;
};

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
                maxResults: 50,
                ...params,
            },
        });
        return response.data;
    },

    // 2. Optimized Multi-Region Search
    searchMultiRegion: async (apiKey: string, query: string, selectedRegions: string[], commonParams: any = {}, pageTokens: Record<string, string> = {}) => {
        try {
            const allItems: any[] = [];
            const seenVideoIds = new Set<string>();
            const nextPageTokens: Record<string, string> = {};

            // Phase 1: Parallel Region Search (Minimal payload)
            // If no regions, default to 'global' (empty regionCode)
            const regionsToSearch = selectedRegions.length === 0 ? [''] : selectedRegions;

            const regionRequests = regionsToSearch.map(regionCode => {
                const targetLang = REGION_LANGUAGE_MAP[regionCode] || 'en'; // Default to English if unknown
                const pageToken = pageTokens[regionCode];

                // If we have a token for this region but it's null/undefined (end of list), skip it
                // But initially pageTokens is {}, so undefined means "start from fresh"
                if (pageTokens && Object.keys(pageTokens).length > 0 && !pageToken) {
                    // If we provided tokens map but this region has no token, it implies we reached end for this region?
                    // Or maybe we just haven't searched it yet?
                    // Let's assume if the key exists and is null, it's done.
                    if (regionCode in pageTokens && !pageTokens[regionCode]) return Promise.resolve(null);
                }

                const searchParams = regionCode
                    ? { ...commonParams, regionCode, relevanceLanguage: targetLang, maxResults: 50, pageToken }
                    : { ...commonParams, maxResults: 50, pageToken };

                return youtubeService.searchVideosBasic(apiKey, query, searchParams)
                    .then(data => {
                        const items = data?.items || [];
                        if (data?.nextPageToken) {
                            nextPageTokens[regionCode] = data.nextPageToken;
                        }
                        return items.map((item: any) => ({ ...item, _searchRegion: regionCode || 'GL' }));
                    })
                    .catch(err => {
                        console.error(`Search error for region ${regionCode}:`, err);
                        return [];
                    });
            });

            const resultsByRegion = await Promise.all(regionRequests);
            const flatResults = resultsByRegion.filter(r => r !== null).flat();

            // Deduplicate and collect IDs
            flatResults.forEach((item: any) => {
                const vId = item.id?.videoId || item.id;
                if (vId && !seenVideoIds.has(vId)) {
                    seenVideoIds.add(vId);
                    allItems.push(item);
                }
            });

            if (allItems.length === 0) return { items: [], secondaryItems: [], nextPageTokens };

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
                        params: { key: apiKey, part: 'snippet,statistics,contentDetails', id: ids.join(',') }
                    });
                    (res.data.items || []).forEach((v: any) => {
                        videoStatsMap[v.id] = {
                            statistics: v.statistics || {},
                            contentDetails: v.contentDetails || {},
                            snippet: v.snippet || {} // Capture snippet for language check
                        };
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
                        // Added 'snippet' to fetch country
                        params: { key: apiKey, part: 'snippet,statistics', id: ids.join(',') }
                    });
                    (res.data.items || []).forEach((c: any) => {
                        channelStatsMap[c.id] = {
                            ...c.statistics,
                            snippet: c.snippet // Store branding/country info check
                        };
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
                const cStats = channelStatsMap[cId] || {}; // This is now statistics + snippet
                const detailedSnippet = vStats.snippet || {};

                // Merge basic snippet with detailed snippet (for language info)
                const mergedSnippet = { ...item.snippet, ...detailedSnippet };

                // Extract channel country
                const channelCountry = cStats.snippet?.country;

                return {
                    id: { videoId: vId },
                    searchRegion: item._searchRegion,
                    snippet: {
                        title: mergedSnippet.title || 'Unknown Title',
                        channelTitle: mergedSnippet.channelTitle || 'Unknown Channel',
                        channelId: cId,
                        publishedAt: mergedSnippet.publishedAt,
                        thumbnails: {
                            medium: { url: mergedSnippet.thumbnails?.medium?.url }
                        },
                        defaultAudioLanguage: mergedSnippet.defaultAudioLanguage,
                        defaultLanguage: mergedSnippet.defaultLanguage,
                        description: mergedSnippet.description || '',
                        channelCountry: channelCountry
                    },
                    statistics: {
                        viewCount: vStats.statistics?.viewCount || '0',
                        likeCount: vStats.statistics?.likeCount || '0',
                    },
                    contentDetails: {
                        duration: vStats.contentDetails?.duration || ''
                    },
                    channelStatistics: {
                        subscriberCount: cStats.subscriberCount || '0',
                        viewCount: cStats.viewCount || '0',
                    }
                };
            }).reduce((acc: any, item: any) => {
                // Apply Advanced 3-Stage Filter
                const region = item.searchRegion;
                const targetLang = REGION_LANGUAGE_MAP[region] || 'en';

                const isPrimary = evaluateCandidate(item, region, targetLang);

                if (isPrimary) {
                    acc.items.push(item);
                } else {
                    acc.secondaryItems.push(item);
                }
                return acc;
            }, { items: [], secondaryItems: [] });

            return { items: finalItems.items, secondaryItems: finalItems.secondaryItems, nextPageTokens };
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
