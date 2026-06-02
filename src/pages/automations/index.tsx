import AppLayout from '@app/components/AppLayout';
import Card from '@app/components/Card';
import EmptyState from '@app/components/EmptyState';
import SidebarNav from '@app/components/SidebarNav';
import TopBar from '@app/components/TopBar';
import { requireAuth } from '@app/lib/utils/requireAuth';
import { Zap } from 'lucide-react';
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

const ZapIcon = () => <Zap className="w-12 h-12" strokeWidth={1.5} />;

export default function AutomationsPage() {
  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar
          title="Automations"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]}
          actions={
            <button
              type="button"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg"
            >
              + New automation
            </button>
          }
        />
      }
    >
      <div className="p-6">
        <Card variant="outlined" padding="none">
          <EmptyState
            icon={<ZapIcon />}
            title="No automations yet"
            description="An automation pairs a saved query with a scheduled task. Define a filter in the media page, then configure an automation to run it on a schedule."
            action={{ label: '+ New automation', onClick: () => {} }}
          />
        </Card>
      </div>
    </AppLayout>
  );
}
