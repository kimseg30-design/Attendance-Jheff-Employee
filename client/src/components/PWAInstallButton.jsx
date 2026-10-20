import { useState } from 'react';
import { usePWAInstall } from '@/shared/hooks/usePWAInstall';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Download, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';

export function PWAInstallButton({ variant = 'default', size = 'sm', className = '' }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in standalone mode as an installed PWA
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else {
      setShowGuide(true);
    }
  };

  if (justInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" /> App Installed
      </div>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleInstallClick}
        className={`flex items-center gap-1.5 font-medium transition-all shadow-sm ${className}`}
        title="Install Sahod app on your device"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Install App</span>
      </Button>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Install Sahod on Your Device
            </DialogTitle>
            <DialogDescription>
              Install this app directly onto your home screen or desktop for fast offline access and fullscreen app experience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-foreground">
            {isIOS ? (
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5">
                <span className="font-semibold block text-primary">Instructions for iPhone & iPad (Safari):</span>
                <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <li>
                    Tap the <strong className="text-foreground inline-flex items-center gap-1"><Share className="h-3.5 w-3.5 inline" /> Share</strong> button in Safari's bottom toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong className="text-foreground inline-flex items-center gap-1"><PlusSquare className="h-3.5 w-3.5 inline" /> Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-foreground">Add</strong> in the top right corner. The Sahod icon will appear on your home screen!
                  </li>
                </ol>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5">
                <span className="font-semibold block text-primary">Chrome, Edge & Android:</span>
                <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <li>
                    Click the <strong className="text-foreground">Install icon</strong> in your browser address bar (top right on Desktop, or bottom on Android).
                  </li>
                  <li>
                    Or tap browser menu <strong className="text-foreground">(⋮)</strong> and select <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home Screen</strong>.
                  </li>
                </ol>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={() => setShowGuide(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PWAInstallButton;
