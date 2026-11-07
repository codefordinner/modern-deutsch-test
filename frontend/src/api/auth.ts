import { request } from './request';

export function login(password: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/admin/login', { method: 'POST', body: { password } });
}
export const logout = () => request<unknown>('/admin/logout', { method: 'POST' });
export async function checkSession(): Promise<boolean> {
  const data = await request<{ authenticated?: boolean }>('/admin/check');
  return data.authenticated === true;
}
