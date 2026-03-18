import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Orange accent - 10-shade tuple
const brand: MantineColorsTuple = [
  '#fff7ed', // 0
  '#ffedd5', // 1
  '#fed7aa', // 2
  '#fdba74', // 3
  '#fb923c', // 4
  '#f97316', // 5 - dark mode base
  '#ea580c', // 6 - light mode base
  '#c2410c', // 7
  '#9a3412', // 8
  '#7c2d12', // 9
];

// Chart / data visualization palette (8 colors)
const chartColors: { dark: string[]; light: string[] } = {
  dark: ['#f97316', '#06b6d4', '#8b5cf6', '#10b981', '#f43f5e', '#eab308', '#6366f1', '#ec4899'],
  light: ['#ea580c', '#0891b2', '#7c3aed', '#059669', '#e11d48', '#ca8a04', '#4f46e5', '#db2777'],
};

// Status color mapping
const statusColors: Record<string, string> = {
  Active: 'green',
  Evaluation: 'yellow',
  Implementation: 'blue',
  Suspended: 'red',
  Closed: 'gray',
};

const dark: MantineColorsTuple = [
  '#f0f6fc', // 0 - emphasis text
  '#e6edf3', // 1 - primary text
  '#c9d1d9', // 2 - secondary text
  '#8b949e', // 3 - tertiary text
  '#484f58', // 4 - muted text
  '#30363d', // 5 - borders
  '#21262d', // 6 - elevated/input bg
  '#161b22', // 7 - card/surface bg
  '#0d1117', // 8 - page bg
  '#010409', // 9 - sidebar/tab bar bg
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: {
    brand,
    // GitHub-inspired dark palette overrides
    dark,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  defaultRadius: 'sm',
  other: {
    chartColors,
    statusColors,
  },
  components: {
    Paper: {
      defaultProps: {
        withBorder: true,
      },
    },
    Badge: {
      defaultProps: {
        variant: 'light',
        size: 'sm',
      },
    },
    Button: {
      defaultProps: {
        radius: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Select: {
      defaultProps: {
        radius: 'sm',
      },
    },
    ActionIcon: {
      defaultProps: {
        variant: 'subtle',
      },
    },
  },
});

export { chartColors, statusColors };
