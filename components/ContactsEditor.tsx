import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mail, Phone, Plus, Trash2, Pencil, UserPlus, Loader2 } from 'lucide-react';
import type { ContactInput } from '@/lib/validation';

const EMAIL_CATEGORIES = ['Work', 'Personal', 'Other'];
const PHONE_CATEGORIES = ['Mobile', 'Work', 'Direct', 'Fax', 'Other'];

interface ContactEntryItem {
  value: string;
  category: string;
}

function newContact(): ContactInput {
  return { name: '', title: '', emails: [], phones: [] };
}

function newEmail(): ContactEntryItem {
  return { value: '', category: 'Work' };
}

function newPhone(): ContactEntryItem {
  return { value: '', category: 'Mobile' };
}

interface ContactViewProps {
  contact: ContactInput;
  onEdit: () => void;
  onRemove: () => void;
  canEdit: boolean;
}

/** Read-only display of a single contact */
function ContactView({ contact, onEdit, onRemove, canEdit }: ContactViewProps) {
  const t = useTranslations();
  return (
    <Card className="mb-3">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{contact.name || t('customers.unnamedContact')}</span>
            {contact.title && <span className="text-sm text-muted-foreground">{contact.title}</span>}
          </div>
          {canEdit && (
            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('customers.editContact')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={onRemove}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('customers.removeContact')}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>

        {(contact.emails?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {contact.emails!.map((email, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-sm">{email.value}</span>
                <Badge variant="secondary" className="text-xs px-1 py-0">{email.category}</Badge>
                {i < contact.emails!.length - 1 && (
                  <span className="text-sm text-muted-foreground">|</span>
                )}
              </div>
            ))}
          </div>
        )}

        {(contact.phones?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {contact.phones!.map((phone, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-sm">{phone.value}</span>
                <Badge variant="secondary" className="text-xs px-1 py-0">{phone.category}</Badge>
                {i < contact.phones!.length - 1 && (
                  <span className="text-sm text-muted-foreground">|</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!contact.emails?.length && !contact.phones?.length && (
          <p className="text-sm text-muted-foreground">{t('customers.noContactDetails')}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface ContactEditFormProps {
  contact: ContactInput;
  ci: number;
  onUpdate: (updated: ContactInput) => void;
  onRemove: () => void;
  onDone: () => void;
  saving?: boolean;
  addEmail: (contactIndex: number) => void;
  updateEmail: (contactIndex: number, emailIndex: number, updated: ContactEntryItem) => void;
  removeEmail: (contactIndex: number, emailIndex: number) => void;
  addPhone: (contactIndex: number) => void;
  updatePhone: (contactIndex: number, phoneIndex: number, updated: ContactEntryItem) => void;
  removePhone: (contactIndex: number, phoneIndex: number) => void;
}

/** Inline edit form for a single contact */
function ContactEditForm({
  contact, ci, onUpdate, onRemove, onDone, saving,
  addEmail, updateEmail, removeEmail, addPhone, updatePhone, removePhone,
}: ContactEditFormProps) {
  const t = useTranslations();
  return (
    <Card className="mb-3 border-2 border-primary">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold">{t('customers.editingContact', { n: ci + 1 })}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={onDone} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
              {t('customers.saveAndClose')}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={onRemove}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('customers.removeContact')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1">
            <Label>{t('common.name')}</Label>
            <Input
              value={contact.name}
              onChange={(e) => onUpdate({ ...contact, name: e.currentTarget.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('customers.titleRole')}</Label>
            <Input
              value={contact.title ?? ''}
              onChange={(e) => onUpdate({ ...contact, title: e.currentTarget.value })}
            />
          </div>
        </div>

        <Separator className="mb-4" />

        <p className="text-xs text-muted-foreground font-semibold mb-2">{t('customers.emailsLabel')}</p>
        <div className="space-y-2 mb-2">
          {(contact.emails ?? []).map((email, ei) => (
            <div key={ei} className="flex items-end gap-2">
              <div className="space-y-1 flex-[2]">
                {ei === 0 && <Label>{t('common.email')}</Label>}
                <div className="relative">
                  <Mail className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    aria-label={ei > 0 ? `${t('common.email')} ${ei + 1}` : undefined}
                    type="email"
                    value={email.value}
                    onChange={(e) => updateEmail(ci, ei, { ...email, value: e.currentTarget.value })}
                    className="ps-8"
                  />
                </div>
              </div>
              <div className="space-y-1 flex-1">
                {ei === 0 && <Label>{t('customers.category')}</Label>}
                <Select
                  value={email.category}
                  onValueChange={(val) => updateEmail(ci, ei, { ...email, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={() => removeEmail(ci, ei)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => addEmail(ci)}
        >
          <Plus className="h-3.5 w-3.5 me-1" />
          {t('customers.addEmail')}
        </Button>

        <Separator className="mb-4" />

        <p className="text-xs text-muted-foreground font-semibold mb-2">{t('customers.phonesLabel')}</p>
        <div className="space-y-2 mb-2">
          {(contact.phones ?? []).map((phone, pi) => (
            <div key={pi} className="flex items-end gap-2">
              <div className="space-y-1 flex-[2]">
                {pi === 0 && <Label>{t('common.phone')}</Label>}
                <div className="relative">
                  <Phone className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    aria-label={pi > 0 ? `${t('common.phone')} ${pi + 1}` : undefined}
                    type="tel"
                    value={phone.value}
                    onChange={(e) => updatePhone(ci, pi, { ...phone, value: e.currentTarget.value })}
                    className="ps-8"
                  />
                </div>
              </div>
              <div className="space-y-1 flex-1">
                {pi === 0 && <Label>{t('customers.category')}</Label>}
                <Select
                  value={phone.category}
                  onValueChange={(val) => updatePhone(ci, pi, { ...phone, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={() => removePhone(ci, pi)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addPhone(ci)}
        >
          <Plus className="h-3.5 w-3.5 me-1" />
          {t('customers.addPhone')}
        </Button>
      </CardContent>
    </Card>
  );
}

interface ContactsEditorProps {
  contacts?: ContactInput[];
  onChange?: (contacts: ContactInput[]) => void;
  onSave?: () => void;
  saving?: boolean;
}

export default function ContactsEditor({ contacts = [], onChange, onSave, saving }: ContactsEditorProps) {
  const t = useTranslations();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const canEdit = !!onChange;

  function handleDone() {
    setEditingIndex(null);
    if (onSave) onSave();
  }

  function updateContact(index: number, updated: ContactInput) {
    const next = contacts.map((c, i) => (i === index ? updated : c));
    onChange!(next);
  }

  function removeContact(index: number) {
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
    onChange!(contacts.filter((_, i) => i !== index));
  }

  function addContact() {
    onChange!([...contacts, newContact()]);
    setEditingIndex(contacts.length); // auto-edit the new contact
  }

  function addEmail(contactIndex: number) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, { ...contact, emails: [...(contact.emails ?? []), newEmail()] });
  }

  function updateEmail(contactIndex: number, emailIndex: number, updated: ContactEntryItem) {
    const contact = contacts[contactIndex];
    const emails = (contact.emails ?? []).map((e, i) => (i === emailIndex ? updated : e));
    updateContact(contactIndex, { ...contact, emails });
  }

  function removeEmail(contactIndex: number, emailIndex: number) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, {
      ...contact,
      emails: (contact.emails ?? []).filter((_, i) => i !== emailIndex),
    });
  }

  function addPhone(contactIndex: number) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, { ...contact, phones: [...(contact.phones ?? []), newPhone()] });
  }

  function updatePhone(contactIndex: number, phoneIndex: number, updated: ContactEntryItem) {
    const contact = contacts[contactIndex];
    const phones = (contact.phones ?? []).map((p, i) => (i === phoneIndex ? updated : p));
    updateContact(contactIndex, { ...contact, phones });
  }

  function removePhone(contactIndex: number, phoneIndex: number) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, {
      ...contact,
      phones: (contact.phones ?? []).filter((_, i) => i !== phoneIndex),
    });
  }

  return (
    <div>
      {contacts.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">{t('customers.noContacts')}</p>
      )}

      {contacts.map((contact, ci) =>
        editingIndex === ci && canEdit ? (
          <ContactEditForm
            key={ci}
            contact={contact}
            ci={ci}
            onUpdate={(updated) => updateContact(ci, updated)}
            onRemove={() => removeContact(ci)}
            onDone={handleDone}
            saving={saving}
            addEmail={addEmail}
            updateEmail={updateEmail}
            removeEmail={removeEmail}
            addPhone={addPhone}
            updatePhone={updatePhone}
            removePhone={removePhone}
          />
        ) : (
          <ContactView
            key={ci}
            contact={contact}
            canEdit={canEdit}
            onEdit={() => setEditingIndex(ci)}
            onRemove={() => removeContact(ci)}
          />
        )
      )}

      {canEdit && (
        <Button variant="outline" onClick={addContact}>
          <UserPlus className="h-4 w-4 me-2" />
          {t('customers.addContact')}
        </Button>
      )}
    </div>
  );
}
