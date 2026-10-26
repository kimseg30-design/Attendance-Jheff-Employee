import { Shield, Eye, CalendarClock } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { useRole } from '../services/role';

export default function RoleSwitcher() {
  const { role, permissions, isLoading } = useRole();
  const Icon = role === 'Viewer' ? Eye : role === 'Editor' ? CalendarClock : Shield;
  const label = role === 'Editor'
    ? `Editor (${permissions.map((p) => p === 'cashAdvances' ? 'Advances' : 'Attendance').join(', ') || 'Restricted'})`
    : role;

  return (
    <Badge variant="outline" className="gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {isLoading ? 'Checking role…' : label}
    </Badge>
  );
}
