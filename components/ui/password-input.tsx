import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  label?: string;
  error?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const t = useTranslations();
    const [visible, setVisible] = React.useState(false);
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium leading-none">
            {label}
          </label>
        )}
        <div className="relative">
          <Input
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={cn('pe-10', error && 'border-destructive', className)}
            ref={ref}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setVisible(!visible)}
            tabIndex={-1}
            aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
