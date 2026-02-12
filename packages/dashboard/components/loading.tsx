export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="h-8 w-40 rounded-lg animate-pulse"
            style={{ background: 'var(--color-obsidian-elevated)' }}
          />
          <div
            className="h-4 w-64 rounded-lg animate-pulse mt-2"
            style={{ background: 'var(--color-obsidian-elevated)' }}
          />
        </div>
        <div
          className="h-10 w-48 rounded-xl animate-pulse"
          style={{ background: 'var(--color-obsidian-elevated)' }}
        />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="glass-card p-5 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div
              className="w-10 h-10 rounded-xl mb-4"
              style={{ background: 'var(--color-obsidian-border)' }}
            />
            <div
              className="h-3 w-20 rounded mb-2"
              style={{ background: 'var(--color-obsidian-border)' }}
            />
            <div
              className="h-7 w-28 rounded"
              style={{ background: 'var(--color-obsidian-border)' }}
            />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="glass-card p-6 animate-pulse">
        <div
          className="h-5 w-36 rounded mb-6"
          style={{ background: 'var(--color-obsidian-border)' }}
        />
        <div
          className="h-[300px] rounded-xl"
          style={{ background: 'var(--color-obsidian-elevated)' }}
        />
      </div>
    </div>
  );
}
