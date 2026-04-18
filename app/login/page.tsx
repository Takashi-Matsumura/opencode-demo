type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          opencode-demo
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          続行するには LionFrame でログインしてください。
        </p>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <a
          href="/api/oidc/auth"
          className="block w-full rounded bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-slate-800"
        >
          LionFrame でログイン
        </a>
      </div>
    </main>
  );
}
