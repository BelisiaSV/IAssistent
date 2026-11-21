/** Admin pages: the side bar shows them (ADMIN_NAV). Each page checks the admin itself. */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="space-y-4">{children}</div>;
}
