import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  accentColor?: string;
  delay?: number;
}

export function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  accentColor = 'var(--color-neon-indigo)',
  delay = 0,
}: MetricCardProps) {
  return (
    <div
      className="glass-card p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          }}
        >
          <Icon size={20} strokeWidth={1.8} style={{ color: accentColor }} />
        </div>
        {trend !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-1 rounded-md"
            style={{
              color: trend >= 0 ? 'var(--color-neon-green)' : 'var(--color-neon-rose)',
              background: trend >= 0
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(244, 63, 94, 0.1)',
            }}
          >
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-txt-muted)' }}>
          {title}
        </p>
        <p className="text-2xl font-bold metric-value" style={{ color: 'var(--color-txt-primary)' }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-txt-muted)' }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
