-- ============================================================
-- Migration: Tweet Drafts Table
-- UFC ELO Ratings — Twitter Automation
-- ============================================================
-- Add this to your Supabase SQL editor or run via psql.
-- Stores generated tweet content for review before posting.

CREATE TABLE IF NOT EXISTS tweet_drafts (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid        REFERENCES events(id),           -- the UFC event that triggered this batch
    tweet_type      text        NOT NULL,                        -- 'leaderboard' | 'movers' | 'snub_list'
    weight_class    text,                                        -- null = cross-division (e.g. movers)
    thread_index    integer     NOT NULL DEFAULT 0,              -- 0 = root tweet, 1+ = replies in thread
    content         text        NOT NULL,                        -- the actual tweet text (max 280 chars)
    char_count      integer     GENERATED ALWAYS AS (char_length(content)) STORED,
    status          text        NOT NULL DEFAULT 'pending',      -- 'pending' | 'approved' | 'posted' | 'skipped'
    twitter_id      text,                                        -- filled in after successful post
    posted_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for the poster job: fetch pending/approved drafts for an event
CREATE INDEX idx_tweet_drafts_event_status
    ON tweet_drafts(event_id, status);

-- Index for audit: find all tweets for a given type
CREATE INDEX idx_tweet_drafts_type
    ON tweet_drafts(tweet_type, created_at DESC);

-- RLS: public can read (so the review email can link to a simple query), 
-- but only service role can write
ALTER TABLE tweet_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
    ON tweet_drafts FOR SELECT
    USING (true);

CREATE POLICY "Service role full access"
    ON tweet_drafts FOR ALL
    USING (auth.role() = 'service_role');

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tweet_drafts_updated_at
    BEFORE UPDATE ON tweet_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tweet_drafts IS
    'Append-only staging table for generated tweet content. '
    'Tweets are inserted as pending, reviewed manually, then posted '
    'via the approve_tweets GitHub Actions workflow.';