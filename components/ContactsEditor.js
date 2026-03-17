import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, Divider, Group, Paper, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconMail, IconPhone, IconPlus, IconTrash, IconUserPlus, IconEdit } from '@tabler/icons-react';

const EMAIL_CATEGORIES = ['Work', 'Personal', 'Other'];
const PHONE_CATEGORIES = ['Mobile', 'Work', 'Direct', 'Fax', 'Other'];

function newContact() {
  return { name: '', title: '', emails: [], phones: [] };
}

function newEmail() {
  return { value: '', category: 'Work' };
}

function newPhone() {
  return { value: '', category: 'Mobile' };
}

/** Read-only display of a single contact */
function ContactView({ contact, onEdit, onRemove, canEdit }) {
  return (
    <Paper withBorder p="md" mb="md">
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <Text size="sm" fw={600}>{contact.name || 'Unnamed Contact'}</Text>
          {contact.title && <Text size="sm" c="dimmed">{contact.title}</Text>}
        </Group>
        {canEdit && (
          <Group gap={4}>
            <Tooltip label="Edit contact">
              <ActionIcon size="sm" variant="subtle" onClick={onEdit}>
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Remove contact">
              <ActionIcon size="sm" color="red" variant="subtle" onClick={onRemove}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {contact.emails?.length > 0 && (
        <Group gap="xs" mb="xs">
          <IconMail size={14} color="var(--mantine-color-dimmed)" />
          {contact.emails.map((email, i) => (
            <Group key={i} gap={4}>
              <Text size="sm">{email.value}</Text>
              <Badge size="xs" variant="light" color="gray">{email.category}</Badge>
              {i < contact.emails.length - 1 && <Text size="sm" c="dimmed">|</Text>}
            </Group>
          ))}
        </Group>
      )}

      {contact.phones?.length > 0 && (
        <Group gap="xs">
          <IconPhone size={14} color="var(--mantine-color-dimmed)" />
          {contact.phones.map((phone, i) => (
            <Group key={i} gap={4}>
              <Text size="sm">{phone.value}</Text>
              <Badge size="xs" variant="light" color="gray">{phone.category}</Badge>
              {i < contact.phones.length - 1 && <Text size="sm" c="dimmed">|</Text>}
            </Group>
          ))}
        </Group>
      )}

      {!contact.emails?.length && !contact.phones?.length && (
        <Text size="sm" c="dimmed">No contact details added.</Text>
      )}
    </Paper>
  );
}

/** Inline edit form for a single contact */
function ContactEditForm({ contact, ci, onUpdate, onRemove, onDone, saving,
  addEmail, updateEmail, removeEmail, addPhone, updatePhone, removePhone }) {
  return (
    <Paper withBorder p="md" mb="md" style={{ borderColor: 'var(--mantine-color-brand-5)', borderWidth: 2 }}>
      <Group justify="space-between" mb="md">
        <Text size="sm" fw={600}>Editing Contact {ci + 1}</Text>
        <Group gap={4}>
          <Button size="xs" color="brand" loading={saving} onClick={onDone}>Save & Close</Button>
          <Tooltip label="Remove contact">
            <ActionIcon size="sm" color="red" variant="subtle" onClick={onRemove}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group grow mb="md">
        <TextInput
          label="Name"
          value={contact.name}
          onChange={(e) => onUpdate({ ...contact, name: e.currentTarget.value })}
          size="sm"
        />
        <TextInput
          label="Title / Role"
          value={contact.title}
          onChange={(e) => onUpdate({ ...contact, title: e.currentTarget.value })}
          size="sm"
        />
      </Group>

      <Divider mb="md" />

      <Text size="xs" c="dimmed" fw={600} mb="xs">EMAILS</Text>
      <Stack gap="xs" mb="xs">
        {contact.emails.map((email, ei) => (
          <Group key={ei} align="flex-end" gap="xs">
            <TextInput
              label={ei === 0 ? 'Email' : undefined}
              aria-label={ei > 0 ? `Email ${ei + 1}` : undefined}
              type="email"
              value={email.value}
              onChange={(e) => updateEmail(ci, ei, { ...email, value: e.currentTarget.value })}
              size="sm"
              leftSection={<IconMail size={14} />}
              style={{ flex: 2 }}
            />
            <Select
              label={ei === 0 ? 'Category' : undefined}
              value={email.category}
              onChange={(val) => updateEmail(ci, ei, { ...email, category: val })}
              data={EMAIL_CATEGORIES}
              size="sm"
              style={{ flex: 1 }}
            />
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => removeEmail(ci, ei)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
      <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={() => addEmail(ci)} mb="md">
        Add Email
      </Button>

      <Divider mb="md" />

      <Text size="xs" c="dimmed" fw={600} mb="xs">PHONES</Text>
      <Stack gap="xs" mb="xs">
        {contact.phones.map((phone, pi) => (
          <Group key={pi} align="flex-end" gap="xs">
            <TextInput
              label={pi === 0 ? 'Phone' : undefined}
              aria-label={pi > 0 ? `Phone ${pi + 1}` : undefined}
              type="tel"
              value={phone.value}
              onChange={(e) => updatePhone(ci, pi, { ...phone, value: e.currentTarget.value })}
              size="sm"
              leftSection={<IconPhone size={14} />}
              style={{ flex: 2 }}
            />
            <Select
              label={pi === 0 ? 'Category' : undefined}
              value={phone.category}
              onChange={(val) => updatePhone(ci, pi, { ...phone, category: val })}
              data={PHONE_CATEGORIES}
              size="sm"
              style={{ flex: 1 }}
            />
            <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => removePhone(ci, pi)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
      <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={() => addPhone(ci)}>
        Add Phone
      </Button>
    </Paper>
  );
}

export default function ContactsEditor({ contacts = [], onChange, onSave, saving }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const canEdit = !!onChange;

  function handleDone() {
    setEditingIndex(null);
    if (onSave) onSave();
  }

  function updateContact(index, updated) {
    const next = contacts.map((c, i) => (i === index ? updated : c));
    onChange(next);
  }

  function removeContact(index) {
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
    onChange(contacts.filter((_, i) => i !== index));
  }

  function addContact() {
    onChange([...contacts, newContact()]);
    setEditingIndex(contacts.length); // auto-edit the new contact
  }

  function addEmail(contactIndex) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, { ...contact, emails: [...contact.emails, newEmail()] });
  }

  function updateEmail(contactIndex, emailIndex, updated) {
    const contact = contacts[contactIndex];
    const emails = contact.emails.map((e, i) => (i === emailIndex ? updated : e));
    updateContact(contactIndex, { ...contact, emails });
  }

  function removeEmail(contactIndex, emailIndex) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, {
      ...contact,
      emails: contact.emails.filter((_, i) => i !== emailIndex),
    });
  }

  function addPhone(contactIndex) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, { ...contact, phones: [...contact.phones, newPhone()] });
  }

  function updatePhone(contactIndex, phoneIndex, updated) {
    const contact = contacts[contactIndex];
    const phones = contact.phones.map((p, i) => (i === phoneIndex ? updated : p));
    updateContact(contactIndex, { ...contact, phones });
  }

  function removePhone(contactIndex, phoneIndex) {
    const contact = contacts[contactIndex];
    updateContact(contactIndex, {
      ...contact,
      phones: contact.phones.filter((_, i) => i !== phoneIndex),
    });
  }

  return (
    <Box>
      {contacts.length === 0 && !canEdit && (
        <Text size="sm" c="dimmed">No contacts.</Text>
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
        <Button variant="light" leftSection={<IconUserPlus size={16} />} onClick={addContact}>
          Add Contact
        </Button>
      )}
    </Box>
  );
}
