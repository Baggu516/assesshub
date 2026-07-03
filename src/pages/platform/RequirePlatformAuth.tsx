import { Navigate } from 'react-router-dom';
import { hasPlatformAccess } from '@/lib/platformApi';

export function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  if (!hasPlatformAccess()) {
    return <Navigate to="/platform/login" replace />;
  }
  return <>{children}</>;
}
