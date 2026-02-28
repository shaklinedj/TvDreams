-- Add hls_path column to media table for HLS streaming support
-- This allows storing the path to the HLS playlist (.m3u8) for each video

ALTER TABLE media ADD COLUMN hls_path VARCHAR(500) DEFAULT NULL AFTER thumbnail;

-- Add index for better query performance
CREATE INDEX idx_hls_path ON media(hls_path);
