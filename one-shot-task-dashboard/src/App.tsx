import { Layout } from './components/layout/Layout';
import { useDashboardStore } from './stores/dashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { useItems } from './hooks/useItems';
import { useStats } from './hooks/useStats';

function DashboardView() {
  return <div className="text-gray-400">Dashboard widgets coming next...</div>;
}

function TimelineView() {
  return <div className="text-gray-400">Timeline view coming next...</div>;
}

function SettingsView() {
  return <div className="text-gray-400">Settings coming next...</div>;
}

const VIEWS = {
  dashboard: DashboardView,
  timeline: TimelineView,
  settings: SettingsView,
};

export function App() {
  useWebSocket();
  useItems();
  useStats();
  const { activeView } = useDashboardStore();
  const View = VIEWS[activeView];

  return (
    <Layout>
      <View />
    </Layout>
  );
}
