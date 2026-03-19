import type { LucideProps } from 'lucide-react';
import {
  Server,
  RefreshCw,
  Archive,
  Cable,
  Wrench,
  Phone,
  Globe,
  Network,
  Router,
  ShieldCheck,
  HardDrive,
  Monitor,
  Shield,
  Key,
  Layers,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  Server,
  RefreshCw,
  Archive,
  Cable,
  Wrench,
  Phone,
  Globe,
  Network,
  Router,
  ShieldCheck,
  HardDrive,
  Monitor,
  Shield,
  Key,
  Layers,
};

/** All icon names available for service types. */
export const serviceIconNames = Object.keys(iconMap);

interface ServiceIconProps extends Omit<LucideProps, 'name'> {
  name?: string | null;
}

export default function ServiceIcon({ name, ...props }: ServiceIconProps) {
  if (!name) return null;
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon {...props} />;
}
