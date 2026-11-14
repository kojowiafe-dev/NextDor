export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 space-y-6">
      <div className="w-full min-h-[410px] sm:min-h-[360px] sm:aspect-[16/7] lg:aspect-[16/5] rounded-2xl sm:rounded-3xl bg-zinc-200/70 animate-pulse" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-xl bg-zinc-200/60 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
