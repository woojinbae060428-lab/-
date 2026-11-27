import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export interface DbConfigStatus {
  configured: boolean;
  missing: string[];
}

export function getDbConfigStatus(): DbConfigStatus {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'] as const;
  const missing = required.filter((key) => {
    const val = process.env[key];
    return !val || val.trim() === '';
  });
  return {
    configured: missing.length === 0,
    missing,
  };
}

export function getDbPool(): Pool {
  const status = getDbConfigStatus();
  if (!status.configured) {
    const err = new Error(`데이터베이스 환경변수가 설정되지 않았습니다: ${status.missing.join(', ')}`);
    (err as Error & { code?: string }).code = 'DB_NOT_CONFIGURED';
    throw err;
  }

  if (!pool) {
    const port = Number(process.env.DB_PORT || '4000');
    const database = process.env.DB_NAME || 'band_db';

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number.isFinite(port) && port > 0 ? port : 4000,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    });
  }

  return pool;
}

export function getTodayKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
