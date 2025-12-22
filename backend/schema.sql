-- Enable Vector Extension
create extension if not exists vector;

-- 1. Users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  google_refresh_token text, -- For Gmail/Calendar Sync
  created_at timestamp with time zone default now()
);

-- 2. Raw Dumps (The "Input")
create table raw_dumps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  content_text text, -- Extracted text or user note
  media_url text, -- S3/Supabase Storage URL for screenshots
  source_type text, -- 'screenshot', 'text', 'voice', 'gmail_forward'
  embedding vector(768), -- For RAG (Dimension depends on embedding model)
  processed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 3. The Smart Inbox (The "Traffic Light" Staging Area)
create table smart_inbox (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid references raw_dumps(id),
  user_id uuid references users(id),
  
  -- AI Proposals
  proposed_data jsonb, -- { title, date, category, etc. }
  ai_confidence_score float, -- 0.0 to 1.0
  status text default 'pending', -- 'pending', 'approved', 'rejected', 'needs_info'
  flag_reason text, -- 'conflict_detected', 'missing_context', 'ambiguous'
  
  created_at timestamp with time zone default now()
);

-- 4. Finalized Events (Internal Calendar)
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  title text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  is_all_day boolean default false,
  location text,
  category text,
  gcal_event_id text, -- ID if synced to Google Calendar
  origin_dump_id uuid references raw_dumps(id)
);

