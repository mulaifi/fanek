import { Check, Loader2 } from 'lucide-react';

export default function StepComplete() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="flex items-center justify-center h-[72px] w-[72px] rounded-full bg-green-100 text-green-700">
        <Check className="h-10 w-10" />
      </div>
      <h3 className="text-xl font-semibold">Setup Complete!</h3>
      <p className="text-muted-foreground">
        Your organization has been configured and your admin account is ready.
      </p>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Redirecting to dashboard...</span>
      </div>
    </div>
  );
}
