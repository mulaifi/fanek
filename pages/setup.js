import { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Stepper,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';

import StepAdmin from '@/components/SetupWizard/StepAdmin';
import StepOrg from '@/components/SetupWizard/StepOrg';
import StepTemplate from '@/components/SetupWizard/StepTemplate';
import StepComplete from '@/components/SetupWizard/StepComplete';
import { getSettings } from '@/lib/settings';

const STEPS = ['Admin Account', 'Organization', 'Service Template', 'Complete'];

export default function SetupPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [adminData, setAdminData] = useState({ name: '', email: '', password: '' });
  const [orgData, setOrgData] = useState({ name: '', logo: null });
  const [template, setTemplate] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  function validateAdmin() {
    const errors = {};
    if (!adminData.name.trim()) errors.name = 'Name is required';
    if (!adminData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) errors.email = 'Enter a valid email address';
    if (!adminData.password) errors.password = 'Password is required';
    return errors;
  }

  function validateOrg() {
    const errors = {};
    if (!orgData.name.trim()) errors.orgName = 'Organization name is required';
    return errors;
  }

  async function handleNext() {
    setError(null);

    if (activeStep === 0) {
      const errors = validateAdmin();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
    }

    if (activeStep === 1) {
      const errors = validateOrg();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
    }

    if (activeStep === 2) {
      // Submit to API
      setSubmitting(true);
      try {
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            admin: adminData,
            org: { name: orgData.name, logo: orgData.logo },
            template,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Setup failed. Please try again.');
          setSubmitting(false);
          return;
        }
        setActiveStep(3);
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.replace('/dashboard');
        }, 2500);
      } catch {
        setError('Network error. Please check your connection and try again.');
        setSubmitting(false);
      }
      return;
    }

    if (activeStep < 3) {
      setActiveStep((s) => s + 1);
    }
  }

  function handleBack() {
    setError(null);
    setFieldErrors({});
    setActiveStep((s) => s - 1);
  }

  const isLastInputStep = activeStep === 2;
  const isComplete = activeStep === 3;

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
      <Container size="sm" w="100%">
        <Paper p="xl" radius="md">
          <Stack gap="xs" mb="xl" align="center">
            <img src="/fanek-logo.svg" alt="Fanek" style={{ width: 48, height: 48 }} />
            <Title order={2} fw={700} ta="center">
              Fanek Setup
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              Configure your Client Information Manager
            </Text>
          </Stack>

          <Stepper active={activeStep} mb="xl" size="sm">
            {STEPS.map((label) => (
              <Stepper.Step key={label} label={label} />
            ))}
          </Stepper>

          {error && (
            <Alert color="red" mb="lg">
              {error}
            </Alert>
          )}

          <Box style={{ minHeight: 240 }}>
            {activeStep === 0 && (
              <StepAdmin data={adminData} onChange={setAdminData} errors={fieldErrors} />
            )}
            {activeStep === 1 && (
              <StepOrg data={orgData} onChange={setOrgData} errors={fieldErrors} />
            )}
            {activeStep === 2 && (
              <StepTemplate selected={template} onSelect={setTemplate} />
            )}
            {activeStep === 3 && <StepComplete />}
          </Box>

          {!isComplete && (
            <Group justify="space-between" mt="xl">
              <Button
                variant="outline"
                leftSection={<IconArrowLeft size={16} />}
                onClick={handleBack}
                disabled={activeStep === 0 || submitting}
              >
                Back
              </Button>
              <Button
                rightSection={<IconArrowRight size={16} />}
                onClick={handleNext}
                loading={submitting}
              >
                {isLastInputStep ? (submitting ? 'Setting up...' : 'Finish Setup') : 'Next'}
              </Button>
            </Group>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export async function getServerSideProps() {
  try {
    const settings = await getSettings();
    if (settings?.setupComplete) {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }
  } catch {
    // If DB is unavailable, allow setup page to render so user can proceed
  }
  return { props: {} };
}
