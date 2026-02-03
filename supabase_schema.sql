-- 1. Profiles Table (User settings)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  youtube_api_key TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Saved Videos Table
CREATE TABLE saved_videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  channel_title TEXT,
  channel_id TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  view_count TEXT,
  like_count TEXT,
  duration TEXT,
  subscriber_count TEXT,
  performance_ratio NUMERIC,
  contribution_score NUMERIC,
  note TEXT,
  tags TEXT[], -- Array of strings
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(user_id, video_id)
);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_videos ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Profiles: Users can only view/edit their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Saved Videos: Users can only manage their own videos
CREATE POLICY "Users can view own videos" ON saved_videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own videos" ON saved_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos" ON saved_videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos" ON saved_videos FOR DELETE USING (auth.uid() = user_id);
