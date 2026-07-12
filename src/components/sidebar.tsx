"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  session: {
    email: string;
    role: string;
    organisationId: string;
    name?: string;
    organisationName?: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/warehouses", label: "Warehouses", icon: "🏭" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "📦" },
  { href: "/dashboard/movements", label: "Movements", icon: "🔄" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈", roles: ["ADMIN", "WAREHOUSE_MANAGER"] },
];

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(session.role)
  );

  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-bold text-gray-900">WMS</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {session.organisationName || "Organisation"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-4 border-t">
        <div className="text-sm">
          <p className="font-medium text-gray-900 truncate">{session.name || session.email}</p>
          <p className="text-xs text-gray-500 capitalize">
            {session.role.toLowerCase().replace("_", " ")}
          </p>
        </div>
        <a
          href="/api/auth/logout"
          className="mt-3 block text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </a>
      </div>
    </aside>
  );
}
