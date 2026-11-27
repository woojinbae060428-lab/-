import { AlertCircle, Database, RefreshCw } from 'lucide-react';
import { ApiError } from '../lib/api';

interface DbSetupNoticeProps {
  error: unknown;
  onRetry: () => void;
}

export function DbSetupNotice({ error, onRetry }: DbSetupNoticeProps) {
  const isApiErr = error instanceof ApiError;
  const isNotConfigured = isApiErr && error.code === 'DB_NOT_CONFIGURED';
  const missing = isApiErr && error.missing ? error.missing : ['DB_HOST', 'DB_USER', 'DB_PASSWORD'];
  const message =
    error instanceof Error ? error.message : '데이터베이스 연결 상태를 확인해 주세요.';

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
            {isNotConfigured ? <Database className="h-5 w-5" /> : <AlertCircle className="h-5 w-5 text-rose-600" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {isNotConfigured ? 'TiDB Cloud 연결 설정이 필요해요' : '데이터를 불러오지 못했어요'}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600">{message}</p>
            {isNotConfigured && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs leading-relaxed text-zinc-700">
                <p className="font-medium text-zinc-900">AI Studio Secrets에 아래 환경변수를 등록해 주세요</p>
                <p className="mt-1 font-mono-tabular text-zinc-600">
                  {missing.join(' · ')} (선택: DB_PORT=4000 · DB_NAME=band_db)
                </p>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
      </div>
    </section>
  );
}
