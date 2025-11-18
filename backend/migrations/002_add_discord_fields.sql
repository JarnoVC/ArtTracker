-- Add Discord notification fields to users table
-- Run this migration to add Discord webhook support

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS discord_user_id VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN users.discord_webhook_url IS 'Discord webhook URL for notifications';
COMMENT ON COLUMN users.discord_user_id IS 'Discord user ID for @mentions (optional)';

