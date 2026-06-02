import AppLayout from '@app/components/AppLayout';
import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import SidebarNav from '@app/components/SidebarNav';
import TopBar from '@app/components/TopBar';
import { requireAuth } from '@app/lib/utils/requireAuth';
import { Monitor } from 'lucide-react';
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

const MonitorIcon = () => <Monitor className="w-12 h-12" strokeWidth={1.5} />;

export default function SystemPage() {
  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={<TopBar title="System" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]} />}
    >
      <div className="p-6">
        <Card variant="outlined" padding="none">
          <EmptyState
            icon={<MonitorIcon />}
            title="System information"
            description="Server status, version details, and diagnostics will be displayed here."
          />
        </Card>
      </div>
    </AppLayout>
  );
}
