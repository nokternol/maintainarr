import AppLayout from '@app/components/AppLayout';
import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import SidebarNav from '@app/components/SidebarNav';
import TopBar from '@app/components/TopBar';
import { requireAuth } from '@app/lib/utils/requireAuth';
import { Activity } from 'lucide-react';
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

const ActivityIcon = () => <Activity className="w-12 h-12" strokeWidth={1.5} />;

export default function ActivityPage() {
  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar title="Activity" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]} />
      }
    >
      <div className="p-6">
        <Card variant="outlined" padding="none">
          <EmptyState
            icon={<ActivityIcon />}
            title="No activity yet"
            description="Run history and task events will appear here once your automations have executed."
          />
        </Card>
      </div>
    </AppLayout>
  );
}
