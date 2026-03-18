/**
 * Status color mappings for Tailwind CSS classes.
 * Maps customer status strings to Tailwind color utility classes
 * used on Badge components (as className additions).
 */
export const statusColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Evaluation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  Implementation: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  Suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * CSS variable references for Recharts chart colors.
 * These map to the --chart-N variables defined in globals.css.
 */
export const chartColors = {
  vars: [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ],
};
