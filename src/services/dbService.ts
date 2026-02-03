import { supabase } from './supabaseClient';
import type { SavedItem } from '../store/useAppStore';

export const dbService = {
    // 1. Fetch all saved videos for user
    async getSavedVideos(userId: string) {
        const { data, error } = await supabase
            .from('saved_videos')
            .select('*')
            .eq('user_id', userId)
            .order('saved_at', { ascending: false });

        if (error) throw error;

        // Map DB schema to SavedItem interface
        return data.map(item => ({
            id: item.video_id,
            title: item.title,
            thumbnail: item.thumbnail,
            channelTitle: item.channel_title,
            channelId: item.channel_id,
            publishedAt: item.published_at,
            description: '', // Optional in DB for now
            tags: item.tags || [],
            note: item.note || '',
            savedAt: item.saved_at,
            viewCount: item.view_count,
            likeCount: item.like_count,
            duration: item.duration,
            subscriberCount: item.subscriber_count,
            channelTotalViews: '0', // Need to handle total views if needed
            performanceRatio: Number(item.performance_ratio),
            contributionScore: Number(item.contribution_score),
            isSecondary: item.is_secondary || false,
            searchQuery: item.search_query || ''
        })) as SavedItem[];
    },

    // 2. Save video(s) to Supabase
    async saveVideos(userId: string, items: SavedItem[]) {
        const dbItems = items.map(item => ({
            user_id: userId,
            video_id: item.id,
            title: item.title,
            thumbnail: item.thumbnail,
            channel_title: item.channelTitle,
            channel_id: item.channelId,
            published_at: item.publishedAt,
            view_count: item.viewCount,
            like_count: item.likeCount,
            duration: item.duration,
            subscriber_count: item.subscriberCount,
            performance_ratio: item.performanceRatio,
            contribution_score: item.contributionScore,
            note: item.note,
            tags: item.tags,
            is_secondary: item.isSecondary || false,
            search_query: item.searchQuery || ''
        }));

        const { error } = await supabase
            .from('saved_videos')
            .upsert(dbItems, { onConflict: 'user_id, video_id' });

        if (error) throw error;
    },

    // 3. Remove videos
    async removeVideos(userId: string, videoIds: string[]) {
        const { error } = await supabase
            .from('saved_videos')
            .delete()
            .eq('user_id', userId)
            .in('video_id', videoIds);

        if (error) throw error;
    },

    // 4. Update single video (note/tags)
    async updateVideo(userId: string, videoId: string, updates: Partial<SavedItem>) {
        const dbUpdates: any = {};
        if (updates.note !== undefined) dbUpdates.note = updates.note;
        if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

        const { error } = await supabase
            .from('saved_videos')
            .update(dbUpdates)
            .eq('user_id', userId)
            .eq('video_id', videoId);

        if (error) throw error;
    },

    // 5. Profile Sync
    async getProfile(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // ignore not found
        return data;
    },

    async updateProfile(userId: string, email: string, apiKey: string) {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email,
                youtube_api_key: apiKey,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    }
};
