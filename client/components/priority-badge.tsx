import { Badge } from '@/components/ui/badge';

interface PriorityBadgeProps {
  priority: string;
  variant?: 'default' | 'outline';
}

export function PriorityBadge({ priority, variant = 'default' }: PriorityBadgeProps) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
    low: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  };

  return (
    <Badge 
      variant={variant}
      className={variant === 'default' ? colors[priority] || 'bg-gray-500/10 text-gray-500' : ''}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}
