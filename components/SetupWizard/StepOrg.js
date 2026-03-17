import { useRef } from 'react';
import { Avatar, Box, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconUpload, IconX } from '@tabler/icons-react';

const MAX_LOGO_SIZE = 256 * 1024; // 256 KB

export default function StepOrg({ data, onChange, errors }) {
  const fileInputRef = useRef(null);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE) {
      alert('Logo must be smaller than 256 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...data, logo: ev.target.result });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected after clearing
    e.target.value = '';
  }

  return (
    <Stack gap="md">
      <TextInput
        label="Organization Name"
        value={data.name || ''}
        onChange={(e) => onChange({ ...data, name: e.target.value })}
        required
        autoFocus
        error={errors?.orgName}
      />

      <Box>
        <Text size="sm" c="dimmed" mb="xs">
          Organization Logo (optional, max 256 KB)
        </Text>
        <Group gap="md" align="center">
          {data.logo ? (
            <Avatar
              src={data.logo}
              alt="Organization logo preview"
              radius="sm"
              size={72}
            />
          ) : (
            <Avatar radius="sm" size={72} color="gray">
              <IconUpload size={28} />
            </Avatar>
          )}
          <Stack gap="xs">
            <Button
              variant="outline"
              size="xs"
              leftSection={<IconUpload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {data.logo ? 'Change Logo' : 'Upload Logo'}
            </Button>
            {data.logo && (
              <Button
                variant="subtle"
                size="xs"
                color="red"
                leftSection={<IconX size={14} />}
                onClick={() => onChange({ ...data, logo: null })}
              >
                Remove
              </Button>
            )}
          </Stack>
        </Group>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleLogoChange}
        />
      </Box>
    </Stack>
  );
}
