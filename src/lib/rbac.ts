import { Role } from "@prisma/client";

// Permission definitions enforced at the API layer
export const permissions = {
  // Warehouse operations
  "warehouse:create": [Role.ADMIN],
  "warehouse:read": [Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.OPERATOR],
  "warehouse:update": [Role.ADMIN, Role.WAREHOUSE_MANAGER],
  "warehouse:delete": [Role.ADMIN],

  // Inventory operations
  "inventory:create": [Role.ADMIN, Role.WAREHOUSE_MANAGER],
  "inventory:read": [Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.OPERATOR],
  "inventory:update": [Role.ADMIN, Role.WAREHOUSE_MANAGER],
  "inventory:delete": [Role.ADMIN],

  // Stock movement operations
  "movement:create": [Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.OPERATOR],
  "movement:read": [Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.OPERATOR],

  // User management
  "user:create": [Role.ADMIN],
  "user:read": [Role.ADMIN, Role.WAREHOUSE_MANAGER],
  "user:update": [Role.ADMIN],
  "user:delete": [Role.ADMIN],

  // Analytics
  "analytics:read": [Role.ADMIN, Role.WAREHOUSE_MANAGER],
} as const;

export type Permission = keyof typeof permissions;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (permissions[permission] as readonly Role[]).includes(role);
}

export function assertPermission(role: string, permission: Permission): void {
  if (!hasPermission(role as Role, permission)) {
    throw new Error(
      `Forbidden: role '${role}' does not have permission '${permission}'`
    );
  }
}
