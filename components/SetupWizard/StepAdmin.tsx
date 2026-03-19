import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { PasswordInput } from '@/components/ui/password-input';

interface AdminData {
  name?: string;
  email?: string;
  password?: string;
}

interface StepAdminProps {
  data: AdminData;
  onChange: (data: AdminData) => void;
  errors?: Record<string, string | undefined>;
}

interface PasswordStrength {
  score: number;
  labelKey: string;
  colorClass: string;
}

function getPasswordStrength(password: string | undefined): PasswordStrength {
  if (!password) return { score: 0, labelKey: '', colorClass: 'text-destructive' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const labelKeys = [
    '',
    'setup.strengthVeryWeak',
    'setup.strengthWeak',
    'setup.strengthFair',
    'setup.strengthStrong',
    'setup.strengthVeryStrong',
  ];
  const colorClasses = [
    'text-destructive',
    'text-destructive',
    'text-orange-500',
    'text-yellow-500',
    'text-green-600',
    'text-teal-600',
  ];
  return { score, labelKey: labelKeys[score], colorClass: colorClasses[score] };
}

export default function StepAdmin({ data, onChange, errors = {} }: StepAdminProps) {
  const t = useTranslations();
  const strength = getPasswordStrength(data.password);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-name">
          {t('setup.adminName')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="admin-name"
          value={data.name || ''}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          autoFocus
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-email">
          {t('setup.adminEmail')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="admin-email"
          type="email"
          value={data.email || ''}
          onChange={(e) => onChange({ ...data, email: e.target.value })}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>

      <div>
        <PasswordInput
          label={t('setup.adminPassword')}
          value={data.password || ''}
          onChange={(e) => onChange({ ...data, password: (e.target as HTMLInputElement).value })}
          error={errors.password}
          required
        />
        {data.password && (
          <div className="mt-2">
            <Progress
              value={(strength.score / 5) * 100}
              className="h-1.5"
            />
            <p className={`text-xs mt-1 ${strength.colorClass}`}>
              {strength.labelKey ? t('setup.passwordStrength', { label: t(strength.labelKey as Parameters<typeof t>[0]) }) : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
