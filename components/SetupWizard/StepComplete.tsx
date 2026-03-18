import { Group, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

export default function StepComplete() {
  return (
    <Stack align="center" justify="center" gap="lg" py="xl" style={{ textAlign: 'center' }}>
      <ThemeIcon color="green" size={72} radius="xl" variant="light">
        <IconCheck size={40} />
      </ThemeIcon>
      <Title order={3} fw={600}>
        Setup Complete!
      </Title>
      <Text c="dimmed">
        Your organization has been configured and your admin account is ready.
      </Text>
      <Group gap="sm" align="center">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Redirecting to dashboard...
        </Text>
      </Group>
    </Stack>
  );
}
