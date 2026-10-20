import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/button';
import { AlertTriangle } from 'lucide-react';
function Fallback({ error, resetErrorBoundary }) {
    const isChunkError = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);
    return (<div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive"/>
      <h2 className="text-lg font-semibold">
        {isChunkError ? 'App Update Available' : 'Something went wrong on this page'}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {isChunkError
          ? 'A newer version of this page is available. Please refresh to load the latest update.'
          : (error instanceof Error ? error.message : 'Unexpected error.') + ' Your data is safe.'}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>Refresh App</Button>
        {!isChunkError && <Button variant="outline" onClick={resetErrorBoundary}>Try again</Button>}
      </div>
    </div>);
}
export default function AppErrorBoundary({ children }) {
    const location = useLocation();
    return (<ErrorBoundary FallbackComponent={Fallback} resetKeys={[location.pathname]} onError={(error) => {
            console.error('[UI error]', location.pathname, error);
            // After a new deploy, old page chunk files change — reload automatically to get the latest bundle.
            if (error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message)) {
                const now = Date.now();
                const lastReload = Number(sessionStorage.getItem('last_chunk_reload') || 0);
                if (now - lastReload > 3000) {
                    sessionStorage.setItem('last_chunk_reload', String(now));
                    window.location.reload();
                }
            }
        }}>
      {children}
    </ErrorBoundary>);
}
