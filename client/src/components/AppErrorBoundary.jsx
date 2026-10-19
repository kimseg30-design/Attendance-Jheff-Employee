import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { AlertTriangle } from 'lucide-react';
function Fallback({ error, resetErrorBoundary }) {
    return (<div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive"/>
      <h2 className="text-lg font-semibold">Something went wrong on this page</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error instanceof Error ? error.message : 'Unexpected error.'} Your data is safe — try again or open another section.
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>);
}
export default function AppErrorBoundary({ children }) {
    const location = useLocation();
    return (<ErrorBoundary FallbackComponent={Fallback} resetKeys={[location.pathname]} onError={(error) => {
            console.error('[UI error]', location.pathname, error);
            // After a new deploy, old page files disappear — reload once to get the latest version.
            if (error instanceof Error && /dynamically imported module|Importing a module script failed/i.test(error.message) && !sessionStorage.getItem('chunk-reload')) {
                sessionStorage.setItem('chunk-reload', '1');
                window.location.reload();
            }
        }}>
      {children}
    </ErrorBoundary>);
}
