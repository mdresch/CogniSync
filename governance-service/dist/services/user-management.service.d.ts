import { PrismaClient, User, Role } from '@prisma/client';
export interface CreateUserRequest {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    roleIds?: string[];
    tenantId: string;
}
export interface UpdateUserRequest {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    roleIds?: string[];
}
export interface CreateRoleRequest {
    name: string;
    description?: string;
    permissions: string[];
    tenantId: string;
}
export interface AuthResult {
    user: Omit<User, 'password'>;
    token: string;
    refreshToken: string;
    roles: Role[];
    permissions: string[];
}
export interface Permission {
    resource: string;
    action: string;
    conditions?: any;
}
export declare class UserManagementService {
    private prisma;
    constructor(prisma: PrismaClient);
    createUser(userData: CreateUserRequest): Promise<User>;
    updateUser(userId: string, updateData: UpdateUserRequest, tenantId: string): Promise<User>;
    deleteUser(userId: string, tenantId: string): Promise<void>;
    getUser(userId: string, tenantId: string): Promise<User | null>;
    getUsers(tenantId: string, filters?: {
        isActive?: boolean;
        roleId?: string;
        search?: string;
    }): Promise<User[]>;
    createRole(roleData: CreateRoleRequest): Promise<Role>;
    updateRole(roleId: string, updateData: Partial<CreateRoleRequest>, tenantId: string): Promise<Role>;
    deleteRole(roleId: string, tenantId: string): Promise<void>;
    getRoles(tenantId: string): Promise<Role[]>;
    assignRolesToUser(userId: string, roleIds: string[]): Promise<void>;
    updateUserRoles(userId: string, roleIds: string[]): Promise<void>;
    getUserRoles(userId: string): Promise<Role[]>;
    getUserPermissions(userId: string): Promise<string[]>;
    authenticate(email: string, password: string, tenantId: string): Promise<AuthResult>;
    refreshToken(refreshToken: string): Promise<AuthResult>;
    changePassword(userId: string, currentPassword: string, newPassword: string, tenantId: string): Promise<void>;
    hasPermission(userId: string, permission: string): Promise<boolean>;
    hasAnyPermission(userId: string, permissions: string[]): Promise<boolean>;
    hasAllPermissions(userId: string, permissions: string[]): Promise<boolean>;
    checkResourceAccess(userId: string, resource: string, action: string, resourceId?: string): Promise<boolean>;
    private generateAccessToken;
    private generateRefreshToken;
    initializeDefaultRoles(tenantId: string): Promise<void>;
}
//# sourceMappingURL=user-management.service.d.ts.map