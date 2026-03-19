import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Cloud, Monitor, Settings, PackageOpen, type LucideIcon } from 'lucide-react';

interface TemplateOption {
  id: string | null;
  title: string;
  description: string;
  Icon: LucideIcon;
}

interface StepTemplateProps {
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function StepTemplate({ selected, onSelect }: StepTemplateProps) {
  const t = useTranslations();

  const TEMPLATES: TemplateOption[] = [
    {
      id: 'cloud',
      title: t('setup.templateCloud'),
      description: t('setup.templateCloudDesc'),
      Icon: Cloud,
    },
    {
      id: 'telecom',
      title: t('setup.templateTelecom'),
      description: t('setup.templateTelecomDesc'),
      Icon: Monitor,
    },
    {
      id: 'msp',
      title: t('setup.templateMSP'),
      description: t('setup.templateMSPDesc'),
      Icon: Settings,
    },
    {
      id: null,
      title: t('setup.templateBlank'),
      description: t('setup.templateBlankDesc'),
      Icon: PackageOpen,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {TEMPLATES.map(({ id, title, description, Icon }) => {
        const isSelected = selected === id;
        return (
          <Card
            key={String(id)}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(id);
              }
            }}
            className={`cursor-pointer transition-colors ${
              isSelected
                ? 'border-2 border-primary'
                : 'border hover:border-primary/50'
            }`}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-7 w-7 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="font-semibold text-sm">{title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
