// API service for interacting with the backend
import { getClientConfig } from './config';
import useAuthStore from '@/hooks/useAuth';

// Use relative URLs for development (they'll go through Vite proxy)
// and fallback to absolute URLs if needed
let API_URL = '/api';

// Initialize configuration
const initConfig = async () => {
  try {
    const clientConfig = await getClientConfig();
    // In development, use relative URLs to work with Vite proxy
    // In production, you might want to use the absolute URL
    API_URL = '/api';
  } catch (error) {
    console.warn('Failed to load client config, using fallback');
  }
};

// Initialize configuration immediately but don't wait for it
initConfig();

export { API_URL as API_BASE_URL };

import { Screen, MediaFile } from '@/types';

class ApiService {
  private getAuthHeaders(isFormData: boolean = false) {
    const { token } = useAuthStore.getState();
    const headers: HeadersInit = {};

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // --- Media Files Management ---
  async getMediaFiles(): Promise<MediaFile[]> {
    const response = await fetch(`${API_URL}/media`, { headers: this.getAuthHeaders() });
    if (!response.ok) {
      throw new Error('Failed to fetch media files');
    }
    return response.json();
  }

  async addMediaFile(file: File, folder: string): Promise<MediaFile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch(`${API_URL}/media`, {
      method: 'POST',
      headers: this.getAuthHeaders(true),
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload media file');
    }
    return response.json();
  }

  async deleteMediaFile(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/media/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete media file');
    }
  }

  // --- Screens Management ---
  async getScreens(): Promise<Screen[]> {
    const response = await fetch(`${API_URL}/screens`, { headers: this.getAuthHeaders() });
    if (!response.ok) {
      throw new Error('Failed to fetch screens');
    }
    return response.json();
  }

  async addScreen(screenData: Partial<Screen>): Promise<Screen> {
    const response = await fetch(`${API_URL}/screens`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(screenData),
    });
    if (!response.ok) {
      throw new Error('Failed to add screen');
    }
    return response.json();
  }

  async updateScreen(id: number, updates: Partial<Screen>): Promise<Screen> {
    const response = await fetch(`${API_URL}/screens/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update screen');
    }
    return response.json();
  }

  async deleteScreen(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/screens/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete screen' }));
      throw new Error(errorData.error || 'Failed to delete screen');
    }
  }

  async updateMedia(id: number, name: string): Promise<MediaFile> {
    const response = await fetch(`${API_URL}/media/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error('Failed to update media');
    }
    return response.json();
  }

  // --- Users Management ---
  async getUsers(): Promise<unknown[]> {
    const response = await fetch(`${API_URL}/users`, { headers: this.getAuthHeaders() });
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  }

  async updateUser(id: number, data: { role: string }): Promise<unknown> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    return response.json();
  }

  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  }

  // --- Auth Management ---
  async login(credentials: { username: string; password: string }): Promise<{ token: string }> {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errorData.error);
    }
    return response.json();
  }

  async register(credentials: { username: string; password: string; role?: string }): Promise<unknown> {
    const response = await fetch(`${API_URL}/users/register`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errorData.error);
    }
    return response.json();
  }
}

export const mockBackend = new ApiService();
// Backward-compat alias (prefer mockBackend)
export const apiService = mockBackend;