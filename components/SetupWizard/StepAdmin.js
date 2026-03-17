import { Box, PasswordInput, Progress, Stack, Text, TextInput } from '@mantine/core';

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: 'red' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['red', 'red', 'orange', 'yellow', 'green', 'teal'];
  return { score, label: labels[score], color: colors[score] };
}

export default function StepAdmin({ data, onChange, errors = {} }) {
  const strength = getPasswordStrength(data.password);

  return (
    <Stack gap="md">
      <TextInput
        label="Full Name"
        value={data.name || ''}
        onChange={(e) => onChange({ ...data, name: e.target.value })}
        error={errors.name}
        required
        autoFocus
      />
      <TextInput
        label="Email Address"
        type="email"
        value={data.email || ''}
        onChange={(e) => onChange({ ...data, email: e.target.value })}
        error={errors.email}
        required
      />
      <Box>
        <PasswordInput
          label="Password"
          value={data.password || ''}
          onChange={(e) => onChange({ ...data, password: e.target.value })}
          error={errors.password}
          required
        />
        {data.password && (
          <Box mt="xs">
            <Progress
              value={(strength.score / 5) * 100}
              color={strength.color}
              size="sm"
              radius="xl"
            />
            <Text size="xs" c={strength.color} mt={4}>
              Password strength: {strength.label}
            </Text>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
