import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedItem {
    id: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
    tags: string[];
    note: string;
    savedAt: string;
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
        }),
        {
            name: 'tube-insight-storage',
        }
    )
);
