# HLS Support - Database Migration

## Overview
This migration adds HLS (HTTP Live Streaming) support to the CMS by adding a `hls_path` column to the `media` table.

## What Changed

### Database Schema
- Added `hls_path VARCHAR(500)` column to `media` table
- Added index on `hls_path` for better query performance

### Server-Side Changes
- Added `generateHLS()` function to create HLS playlists and segments
- Modified video upload process to automatically generate HLS version
- HLS directory naming: `{filename}_sdr_hls/playlist.m3u8`
- API now returns `hls_path` field for videos

## How to Apply Migration

### For Existing Database

Run the migration SQL:
```bash
mysql -u cms_user -p cms_usuarios_jules < database/add-hls-path.sql
```

Or manually in MySQL:
```sql
ALTER TABLE media ADD COLUMN hls_path VARCHAR(500) DEFAULT NULL AFTER thumbnail;
CREATE INDEX idx_hls_path ON media(hls_path);
```

### For New Database

The `database/full-schema.sql` file has been updated to include the new column, so new installations will have it automatically.

## How It Works

### Upload Flow
1. Video uploaded → saved with random filename (e.g., `ZBXtIl4.mp4`)
2. Video converted to SDR for Android TV compatibility
3. **HLS version generated** → `ZBXtIl4_sdr_hls/` folder with:
   - `playlist.m3u8` (master playlist)
   - `segment_000.ts`, `segment_001.ts`, etc. (video segments)
4. Database stores:
   - `path`: `/uploads/folder/ZBXtIl4.mp4` (original MP4)
   - `hls_path`: `/uploads/folder/ZBXtIl4_sdr_hls/playlist.m3u8` (HLS)

### API Response Example
```json
{
  "id": 482,
  "name": "My Video",
  "type": "video/mp4",
  "path": "/uploads/especiales/ZBXtIl4.mp4",
  "hls_path": "/uploads/especiales/ZBXtIl4_sdr_hls/playlist.m3u8",
  "size": 30101155,
  "folder": "especiales",
  "thumbnail": "/uploads/especiales/abc123_thumb.jpg"
}
```

### Display Client Behavior
The display client automatically detects and uses HLS:
1. If `hls_path` exists → uses HLS streaming
2. If `hls_path` is null or HLS fails → falls back to MP4

## Benefits
- ✅ **Better streaming**: Adaptive bitrate, better buffering
- ✅ **Android TV compatible**: HLS works better on TV devices
- ✅ **Automatic**: Generated on upload, no manual intervention
- ✅ **Backward compatible**: Old videos without HLS still work

## Troubleshooting

### HLS generation fails
- Check FFmpeg is installed: `ffmpeg -version`
- Check server logs for error messages
- Video will still play as MP4 (fallback)

### Old videos don't have HLS
- HLS is only generated for newly uploaded videos
- To regenerate HLS for existing videos, re-upload them
- Or manually run the HLS generation script (if created)

### Display shows MP4 instead of HLS
- Check database: `SELECT id, name, path, hls_path FROM media WHERE type LIKE 'video%';`
- Verify HLS files exist on disk
- Check browser console for HLS errors
