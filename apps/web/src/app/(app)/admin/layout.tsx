import { AdminTabs } from "./admin-tabs";

/** Admin pages share tabs: player import, price plans and accounts. Each page checks the admin itself. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <AdminTabs />
      {children}
    </div>
  );
}
