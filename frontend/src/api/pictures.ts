import { request } from './request';

export interface Picture {
  id: string;
  title?: string | null;
  description?: string | null;
  dataUrl: string;
  isActive: boolean;
  createdAt: string;
}

export const getPictures = () => request<Picture[]>('/pictures');
export const getAdminPictures = () => request<Picture[]>('/pictures/admin', { auth: true });
export const createPicture = (data: { title?: string; description?: string; dataUrl: string; isActive: boolean }) => request<Picture>('/pictures', { method: 'POST', body: data, auth: true });
export const updatePicture = (id: string, data: Partial<Pick<Picture, 'title' | 'description' | 'dataUrl' | 'isActive'>>) => request<Picture>(`/pictures/${id}`, { method: 'PUT', body: data, auth: true });
export const deletePicture = (id: string) => request<{ success: boolean }>(`/pictures/${id}`, { method: 'DELETE', auth: true });
export const generatePictureDescription = (id: string) => request<Picture>(`/pictures/${id}/ai-description`, { method: 'POST', auth: true });
