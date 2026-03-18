// @ts-nocheck
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, getSession } from 'next-auth/react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

export default function LoginPage() {
  const router = useRouter();
  const { error: queryError } = router.query;

  const [orgName, setOrgName] = useState('Fanek');
  const [orgLogo, setOrgLogo] = useState(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.setupComplete === false) {
          router.replace('/setup');
          return;
        }
        if (data.orgName) setOrgName(data.orgName);
        if (data.orgLogo) setOrgLogo(data.orgLogo);
        setGoogleEnabled(!!data.googleOAuthEnabled);
      } catch {
        // Continue with defaults if settings fetch fails
      }
    }
    loadSettings();
  }, [router]);

  const errorMessages = {
    CredentialsSignin: 'Invalid email or password. Please try again.',
    OAuthSignin: 'Could not sign in with Google. Please try again.',
    OAuthCallback: 'Google sign-in was cancelled or failed.',
    Default: 'An error occurred during sign-in. Please try again.',
  };

  const displayError =
    formError ||
    (queryError ? (errorMessages[queryError] ?? errorMessages.Default) : null);

  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setFormError('Invalid email or password. Please try again.');
      setSubmitting(false);
    } else {
      router.replace('/dashboard');
    }
  }

  async function handleGoogleSignIn() {
    setFormError(null);
    await signIn('google', { callbackUrl: '/dashboard' });
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 0',
      }}
    >
      <Container size={420} w="100%">
        <Paper p="xl" radius="md">
          <Stack align="center" mb="lg" gap="xs">
            {orgLogo ? (
              <Avatar
                src={orgLogo}
                alt={orgName}
                radius="sm"
                size={72}
              />
            ) : (
              <Avatar
                radius="sm"
                size={72}
                color="brand"
                style={{ fontSize: '1.75rem', fontWeight: 700 }}
              >
                {orgName.charAt(0).toUpperCase()}
              </Avatar>
            )}
            <Title order={2} fw={700} ta="center">
              {orgName}
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              Sign in to your account
            </Text>
          </Stack>

          {displayError && (
            <Alert color="red" mb="md">
              {displayError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleCredentialsSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Button
                type="submit"
                fullWidth
                size="md"
                loading={submitting}
                mt="xs"
              >
                {submitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </Stack>
          </Box>

          {googleEnabled && (
            <>
              <Divider my="md" label="OR" labelPosition="center" />
              <Button
                variant="outline"
                fullWidth
                size="md"
                onClick={handleGoogleSignIn}
                leftSection={
                  <Box
                    component="img"
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    style={{ width: 20, height: 20 }}
                  />
                }
              >
                Sign in with Google
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (session) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}
