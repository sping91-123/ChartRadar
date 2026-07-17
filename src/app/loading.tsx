export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-4" aria-live="polite" aria-busy="true">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ui-line border-t-ui-brand" aria-hidden />
        <p className="mt-4 text-sm font-semibold text-ui-muted">시장 데이터를 불러오고 있습니다.</p>
      </div>
    </main>
  );
}
