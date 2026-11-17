import { AdminTabs } from "./admin-tabs";

/** Admin pages share tabs (player import, price plans, accounts, competition, exercise bank). Each page checks the admin itself. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <AdminTabs />
      {children}
    </div>
  );
}
