/**
 * Utility functions for file operations and formatting
 */

/**
 * Format bytes as human-readable text.
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 */
export function formatFileSize(bytes: number, si = false, dp = 2): string {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 Bytes';

  const thresh = si ? 1000 : 1024;
  const units = si
    ? ['Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  if (Math.abs(bytes) < thresh) {
    return bytes + ' Bytes';
  }

  // Calculate the appropriate unit index
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(thresh));
  const unitIndex = Math.min(i, units.length - 1);
  
  // Calculate the value in the appropriate unit
  const value = bytes / Math.pow(thresh, unitIndex);
  
  return value.toFixed(dp) + ' ' + units[unitIndex];
}

/**
 * Get human readable file size for validation messages
 * @param bytes Number of bytes
 */
export function getReadableFileSize(bytes: number): string {
  return formatFileSize(bytes, false, 0);
}

/**
 * Convert bytes to specific unit
 * @param bytes Number of bytes
 * @param unit Target unit (KB, MB, GB, TB, etc.)
 */
export function convertBytesToUnit(bytes: number, unit: string): number {
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const index = units.indexOf(unit.toUpperCase());
  
  if (index === -1) {
    throw new Error(`Invalid unit: ${unit}`);
  }
  
  if (index === 0) return bytes;
  
  return bytes / Math.pow(1024, index);
}