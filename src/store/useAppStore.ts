import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedItem {
    id: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
    description: string;
    tags: string[];
    note: string;
    savedAt: string;
    // New Metrics
    viewCount: string;
    likeCount: string;
    duration: string;
    subscriberCount: string;
    channelTotalViews: string;
    performanceRatio: number;
    contributionScore: number;
}

interface AppState {
    apiKey: string;
    setApiKey: (key: string) => void;
    isValidated: boolean;
    setIsValidated: (status: boolean) => void;
    library: SavedItem[];
    addToLibrary: (items: SavedItem[]) => void;
    removeFromLibrary: (ids: string[]) => void;
    updateLibraryItem: (id: string, updates: Partial<SavedItem>) => void;
    setLibrary: (items: SavedItem[]) => void;
    // Supabase States
    user: any | null;
    setUser: (user: any) => void;
    session: any | null;
    setSession: (session: any) => void;
    // Search Persistence States
    searchState: {
        query: string;
        results: any[];
        selectedRegions: string[];
        publishedAfter: string;
        duration: string;
        sortKey: string;
        sortOrder: 'asc' | 'desc';
        minContribution: number;
        minPerformance: number;
        resultsQuery: string;
    };
    setSearchState: (updates: Partial<AppState['searchState']>) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            apiKey: '',
            setApiKey: (key) => set({ apiKey: key, isValidated: false }),
            isValidated: false,
            setIsValidated: (status) => set({ isValidated: status }),
            library: [],
            addToLibrary: (items) => set((state) => {
                const existingIds = new Set(state.library.map(i => i.id));
                const newItems = items.filter(item => !existingIds.has(item.id));
                return { library: [...state.library, ...newItems] };
            }),
            removeFromLibrary: (ids) => set((state) => ({
                library: state.library.filter(item => !ids.includes(item.id))
            })),
            updateLibraryItem: (id, updates) => set((state) => ({
                library: state.library.map(item => item.id === id ? { ...item, ...updates } : item)
            })),
            setLibrary: (library) => set({ library }),
            user: null,
            setUser: (user) => set({ user }),
            session: null,
            setSession: (session) => set({ session }),
            searchState: {
                query: '',
                results: [],
                selectedRegions: ['KR'],
                publishedAfter: '',
                duration: 'any',
                sortKey: 'publishedAt',
                sortOrder: 'desc',
                minContribution: 0,
                minPerformance: 0,
                resultsQuery: '',
            },
            setSearchState: (updates) => set((state) => ({
                searchState: { ...(state.searchState || {}), ...updates }
            })),
        }),
        {
            name: 'tube-insight-storage',
            version: 1,
            migrate: (persistedState: any, version: number) => {
                if (version === 0) {
                    // Force reset search state if it's from an older or potentially broken version
                    return {
                        ...persistedState,
                        searchState: {
                            query: '',
                            results: [],
                            selectedRegions: ['KR'],
                            publishedAfter: '',
                            duration: 'any',
                            sortKey: 'publishedAt',
                            sortOrder: 'desc',
                            minContribution: 0,
                            minPerformance: 0,
                            resultsQuery: '',
                        }
                    };
                }
                return persistedState;
            }
        }
    )
);

// Formatting Utils
export const formatNumber = (numStr: string) => {
    const num = parseInt(numStr, 10);
    if (isNaN(num)) return '0';
    if (num >= 100000000) return (num / 100000000).toFixed(1) + '억';
    if (num >= 10000) return (num / 10000).toFixed(1) + '만';
    return num.toLocaleString();
};

export const formatDuration = (pt: string) => {
    if (!pt) return '00:00';
    const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return pt;
    const hours = (parseInt(match[1] || '0', 10));
    const minutes = (parseInt(match[2] || '0', 10));
    const seconds = (parseInt(match[3] || '0', 10));

    const h = hours > 0 ? `${hours}:` : '';
    const m = minutes.toString().padStart(hours > 0 ? 2 : 1, '0');
    const s = seconds.toString().padStart(2, '0');
    return `${h}${m}:${s}`;
};
