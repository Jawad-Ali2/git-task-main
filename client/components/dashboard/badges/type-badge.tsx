import { Badge } from '@/components/ui/badge';

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const colors: Record<string, string> = {
    TODO: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    FIXME: 'bg-red-500/10 text-red-500 border-red-500/20',
    HACK: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    NOTE: 'bg-green-500/10 text-green-500 border-green-500/20',
    BUG: 'bg-red-600/10 text-red-600 border-red-600/20',
  };

  return (
    <Badge className={colors[type] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}>
      {type}
    </Badge>
  );
}
