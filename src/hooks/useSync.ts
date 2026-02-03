import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { dbService } from '../services/dbService';

export const useSync = () => {
    const { user, library, setLibrary } = useAppStore();

    // 1. Initial Sync when user logs in
    useEffect(() => {
        if (user) {
            const syncData = async () => {
                try {
                    // Fetch data and profile
                    const [remoteData, profile] = await Promise.all([
                        dbService.getSavedVideos(user.id),
                        dbService.getProfile(user.id)
                    ]);

                    // Sync API Key
                    if (profile?.youtube_api_key && !useAppStore.getState().apiKey) {
                        useAppStore.getState().setApiKey(profile.youtube_api_key);
                        useAppStore.getState().setIsValidated(true);
                    }

                    if (library.length > 0) {
                        // If we have local data, migrate it to Supabase
                        // Merge logic: local items not in remote are added to remote
                        const remoteIds = new Set(remoteData.map(item => item.id));
                        const newLocalItems = library.filter(item => !remoteIds.has(item.id));

                        if (newLocalItems.length > 0) {
                            await dbService.saveVideos(user.id, newLocalItems);
                            const updatedRemote = await dbService.getSavedVideos(user.id);
                            setLibrary(updatedRemote);
                        } else {
                            setLibrary(remoteData);
                        }
                    } else {
                        setLibrary(remoteData);
                    }
                } catch (error) {
                    console.error('Sync failed:', error);
                }
            };
            syncData();
        }
    }, [user]); // Only run on login/logout
};
