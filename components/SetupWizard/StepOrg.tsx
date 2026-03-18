import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, X } from 'lucide-react';

const MAX_LOGO_SIZE = 256 * 1024; // 256 KB

interface OrgData {
  name?: string;
  logo?: string | null;
}

interface StepOrgProps {
  data: OrgData;
  onChange: (data: OrgData) => void;
  errors?: Record<string, string | undefined>;
}

export default function StepOrg({ data, onChange, errors }: StepOrgProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE) {
      alert('Logo must be smaller than 256 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...data, logo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected after clearing
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">
          Organization Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="org-name"
          value={data.name || ''}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          required
          autoFocus
        />
        {errors?.orgName && <p className="text-sm text-destructive">{errors.orgName}</p>}
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Organization Logo (optional, max 256 KB)
        </p>
        <div className="flex items-center gap-4">
          <Avatar className="h-[72px] w-[72px] rounded-sm">
            {data.logo ? (
              <AvatarImage src={data.logo} alt="Organization logo preview" />
            ) : (
              <AvatarFallback className="rounded-sm">
                <Upload className="h-7 w-7 text-muted-foreground" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {data.logo ? 'Change Logo' : 'Upload Logo'}
            </Button>
            {data.logo && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onChange({ ...data, logo: null })}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleLogoChange}
        />
      </div>
    </div>
  );
}
