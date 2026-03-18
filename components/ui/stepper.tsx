import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {steps.map((step, i) => (
        <li
          key={i}
          className={cn(
            'flex items-center gap-2',
            i <= currentStep ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium',
              i < currentStep
                ? 'bg-primary text-primary-foreground'
                : i === currentStep
                  ? 'border-2 border-primary text-primary'
                  : 'border-2 border-muted text-muted-foreground'
            )}
          >
            {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          <span className="hidden sm:inline text-sm">{step.label}</span>
          {i < steps.length - 1 && (
            <Separator className="w-8" orientation="horizontal" />
          )}
        </li>
      ))}
    </ol>
  );
}
