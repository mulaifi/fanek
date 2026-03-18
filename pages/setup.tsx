import { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Stepper } from '@/components/ui/stepper';

import StepAdmin from '@/components/SetupWizard/StepAdmin';
import StepOrg from '@/components/SetupWizard/StepOrg';
import StepTemplate from '@/components/SetupWizard/StepTemplate';
import StepComplete from '@/components/SetupWizard/StepComplete';
import { getSettings } from '@/lib/settings';

const STEPS = [
  { label: 'Admin Account' },
  { label: 'Organization' },
  { label: 'Service Template' },
  { label: 'Complete' },
];

export default function SetupPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [adminData, setAdminData] = useState<{ name: string; email: string; password: string }>({
    name: '',
    email: '',
    password: '',
  });
  const [orgData, setOrgData] = useState<{ name: string; logo: string | null }>({
    name: '',
    logo: null,
  });
  const [template, setTemplate] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validateAdmin(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!adminData.name.trim()) errors.name = 'Name is required';
    if (!adminData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email))
      errors.email = 'Enter a valid email address';
    if (!adminData.password) errors.password = 'Password is required';
    return errors;
  }

  function validateOrg(): Record<string, string> {
    const errors: Record<string, string> = {};
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
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2 mb-8">
              <img src="/fanek-logo.svg" alt="Fanek" className="w-16 h-16" />
              <h2 className="text-xl font-bold text-center">Fanek Setup</h2>
              <p className="text-sm text-muted-foreground text-center">
                Configure your Client Information Manager
              </p>
            </div>

            <div className="mb-8">
              <Stepper steps={STEPS} currentStep={activeStep} />
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="min-h-[240px]">
              {activeStep === 0 && (
                <StepAdmin
                  data={adminData}
                  onChange={(d) =>
                    setAdminData((prev) => ({
                      ...prev,
                      name: d.name ?? prev.name,
                      email: d.email ?? prev.email,
                      password: d.password ?? prev.password,
                    }))
                  }
                  errors={fieldErrors}
                />
              )}
              {activeStep === 1 && (
                <StepOrg
                  data={orgData}
                  onChange={(d) =>
                    setOrgData((prev) => ({
                      name: d.name ?? prev.name,
                      logo: d.logo !== undefined ? d.logo : prev.logo,
                    }))
                  }
                  errors={fieldErrors}
                />
              )}
              {activeStep === 2 && (
                <StepTemplate selected={template} onSelect={setTemplate} />
              )}
              {activeStep === 3 && <StepComplete />}
            </div>

            {!isComplete && (
              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={activeStep === 0 || submitting}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : isLastInputStep ? (
                    <>
                      Finish Setup
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
