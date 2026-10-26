export default function Loading() {
  return (
    <div className="space-y-4 pt-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-rule/70" />
      <div className="h-24 max-w-xl animate-pulse rounded-2xl bg-rule/50" />
      <div className="h-40 max-w-xl animate-pulse rounded-2xl bg-rule/40" />
    </div>
  );
}
