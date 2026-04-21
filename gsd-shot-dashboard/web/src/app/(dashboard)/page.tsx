import { FeedList } from '@/components/feed/FeedList';
import { ItemDetail } from '@/components/feed/ItemDetail';
import { SourceHealthPanel } from '@/components/health/SourceHealthPanel';

export default function DashboardPage() {
  return (
    <div
      data-testid="dashboard-shell"
      className="flex h-full w-full min-h-0"
    >
      <section className="flex min-w-0 flex-1">
        <FeedList />
      </section>
      <SourceHealthPanel />
      <ItemDetail />
    </div>
  );
}
