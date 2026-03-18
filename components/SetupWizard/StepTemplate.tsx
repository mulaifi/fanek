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

const TEMPLATES: TemplateOption[] = [
  {
    id: 'cloud',
    title: 'Cloud Provider',
    description: 'Virtual data centers, DR, backup, network links, and hardware assets.',
    Icon: Cloud,
  },
  {
    id: 'telecom',
    title: 'Telecom',
    description: 'Voice lines, data circuits, internet services, CPE equipment, and SLAs.',
    Icon: Monitor,
  },
  {
    id: 'msp',
    title: 'MSP',
    description: 'Managed servers, endpoints, security services, backups, and licenses.',
    Icon: Settings,
  },
  {
    id: null,
    title: 'Blank',
    description: 'Start with no service types. Define your own catalog from scratch.',
    Icon: PackageOpen,
  },
];

export default function StepTemplate({ selected, onSelect }: StepTemplateProps) {
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
