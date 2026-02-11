export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-800 rounded w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>
        ))}
      </div>
      <div className="h-64 bg-gray-800 rounded-lg"></div>
    </div>
  );
}
