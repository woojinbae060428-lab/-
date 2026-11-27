import type { ApiErrorPayload } from '../types/band';

export class ApiError extends Error {
  status: number;
  code?: string;
  missing?: string[];

  constructor(message: string, status: number, code?: string, missing?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.missing = missing;
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as Partial<ApiErrorPayload> & T;

  if (!res.ok) {
    throw new ApiError(
      data.error || '요청을 처리하는 중 문제가 발생했어요.',
      res.status,
      data.code,
      data.missing
    );
  }

  return data as T;
}
