import { Box, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import {
  IconCloud,
  IconDeviceDesktopAnalytics,
  IconSettings,
  IconLayersOff,
} from '@tabler/icons-react';

const TEMPLATES = [
  {
    id: 'cloud',
    title: 'Cloud Provider',
    description: 'Virtual data centers, DR, backup, network links, and hardware assets.',
    Icon: IconCloud,
  },
  {
    id: 'telecom',
    title: 'Telecom',
    description: 'Voice lines, data circuits, internet services, CPE equipment, and SLAs.',
    Icon: IconDeviceDesktopAnalytics,
  },
  {
    id: 'msp',
    title: 'MSP',
    description: 'Managed servers, endpoints, security services, backups, and licenses.',
    Icon: IconSettings,
  },
  {
    id: null,
    title: 'Blank',
    description: 'Start with no service types. Define your own catalog from scratch.',
    Icon: IconLayersOff,
  },
];

export default function StepTemplate({ selected, onSelect }) {
  return (
    <SimpleGrid cols={2} spacing="sm">
      {TEMPLATES.map(({ id, title, description, Icon }) => {
        const isSelected = selected === id;
        return (
          <Paper
            key={String(id)}
            p="md"
            radius="sm"
            withBorder
            onClick={() => onSelect(id)}
            style={{
              cursor: 'pointer',
              borderColor: isSelected ? 'var(--mantine-color-brand-6)' : undefined,
              borderWidth: isSelected ? 2 : 1,
              transition: 'border-color 0.2s',
            }}
          >
            <Stack gap="xs">
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Icon
                  size={28}
                  style={{
                    color: isSelected
                      ? 'var(--mantine-color-brand-6)'
                      : 'var(--mantine-color-dimmed)',
                  }}
                />
                <Text fw={600} size="sm">
                  {title}
                </Text>
              </Box>
              <Text size="xs" c="dimmed">
                {description}
              </Text>
            </Stack>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
