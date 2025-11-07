import { CheckCircle, Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  showLabel?: boolean;
}

export function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'in-progress':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {getStatusIcon()}
      {showLabel && (
        <span className="text-sm capitalize">
          {status.replace('-', ' ')}
        </span>
      )}
    </div>
  );
}
