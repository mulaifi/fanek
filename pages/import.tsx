import { useState, useEffect } from 'react';
import { getServerSession } from 'next-auth/next';
import type { GetServerSidePropsContext } from 'next';
import { useTranslations } from 'next-intl';
import { getAuthOptions } from '@/lib/auth/options';
import AppShell from '@/components/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImportWizard, { type ServiceTypeLite } from '@/components/import/ImportWizard';

export default function ImportPage() {
  const t = useTranslations('import');
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeLite[]>([]);

  useEffect(() => {
    fetch('/api/service-types?active=true')
      .then((r) => r.json())
      .then((d) => setServiceTypes(d.data ?? d ?? []))
      .catch(() => setServiceTypes([]));
  }, []);

  return (
    <AppShell title={t('title')}>
      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">{t('tabCustomers')}</TabsTrigger>
          <TabsTrigger value="services">{t('tabServices')}</TabsTrigger>
        </TabsList>
        <TabsContent value="customers"><ImportWizard entity="customer" /></TabsContent>
        <TabsContent value="services"><ImportWizard entity="service" serviceTypes={serviceTypes} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, await getAuthOptions());
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.role === 'VIEWER') return { redirect: { destination: '/dashboard', permanent: false } };
  return { props: {} };
}
