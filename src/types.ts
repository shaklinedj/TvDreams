export interface MediaFile {
  id: number;
  name: string;
  type: string;
  path: string;
  size: number;
  folder: string;
  assignedScreens?: string[]; // Screens this media is assigned to
  thumbnail?: string; // Thumbnail path for videos and preview for images
  // The following fields are from the old mock interface for compatibility
  url?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Screen {
  id: number;
  name: string;
  location: string;
  resolution: string;
  orientation?: 'landscape' | 'portrait';
  assignedFolder: string;
  transitionType: 'fade' | 'slide';
  duration: number;
  // The following fields are from the old mock interface for compatibility
  status?: 'online' | 'offline' | 'maintenance';
  createdAt?: Date;
  updatedAt?: Date;
}
