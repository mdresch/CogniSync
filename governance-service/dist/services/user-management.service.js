"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManagementService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
class UserManagementService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // A062: User Management
    async createUser(userData) {
        try {
            // Check if user already exists
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { email: userData.email },
                        { username: userData.username },
                    ],
                    tenantId: userData.tenantId,
                },
            });
            if (existingUser) {
                throw new Error('User with this email or username already exists');
            }
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(userData.password, 12);
            // Create user
            const user = await this.prisma.user.create({
                data: {
                    email: userData.email,
                    username: userData.username,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    password: hashedPassword,
                    tenantId: userData.tenantId,
                },
            });
            // Assign roles if provided
            if (userData.roleIds && userData.roleIds.length > 0) {
                await this.assignRolesToUser(user.id, userData.roleIds);
            }
            logger_1.logger.info(`User created: ${user.id} (${user.email})`);
            return user;
        }
        catch (error) {
            logger_1.logger.error('Error creating user:', error);
            throw error;
        }
    }
    async updateUser(userId, updateData, tenantId) {
        try {
            // Verify user exists and belongs to tenant
            const existingUser = await this.prisma.user.findFirst({
                where: { id: userId, tenantId },
            });
            if (!existingUser) {
                throw new Error('User not found');
            }
            // Check for email/username conflicts if being updated
            if (updateData.email || updateData.username) {
                const conflictUser = await this.prisma.user.findFirst({
                    where: {
                        OR: [
                            ...(updateData.email ? [{ email: updateData.email }] : []),
                            ...(updateData.username ? [{ username: updateData.username }] : []),
                        ],
                        tenantId,
                        NOT: { id: userId },
                    },
                });
                if (conflictUser) {
                    throw new Error('Email or username already in use');
                }
            }
            // Update user
            const user = await this.prisma.user.update({
                where: { id: userId },
                data: {
                    email: updateData.email,
                    username: updateData.username,
                    firstName: updateData.firstName,
                    lastName: updateData.lastName,
                    isActive: updateData.isActive,
                    updatedAt: new Date(),
                },
            });
            // Update roles if provided
            if (updateData.roleIds !== undefined) {
                await this.updateUserRoles(userId, updateData.roleIds);
            }
            logger_1.logger.info(`User updated: ${userId}`);
            return user;
        }
        catch (error) {
            logger_1.logger.error('Error updating user:', error);
            throw error;
        }
    }
    async deleteUser(userId, tenantId) {
        try {
            // Verify user exists and belongs to tenant
            const user = await this.prisma.user.findFirst({
                where: { id: userId, tenantId },
            });
            if (!user) {
                throw new Error('User not found');
            }
            // Soft delete by deactivating
            await this.prisma.user.update({
                where: { id: userId },
                data: { isActive: false },
            });
            logger_1.logger.info(`User deactivated: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error deleting user:', error);
            throw error;
        }
    }
    async getUser(userId, tenantId) {
        return this.prisma.user.findFirst({
            where: { id: userId, tenantId },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });
    }
    async getUsers(tenantId, filters) {
        const where = { tenantId };
        if (filters?.isActive !== undefined) {
            where.isActive = filters.isActive;
        }
        if (filters?.roleId) {
            where.roles = {
                some: {
                    roleId: filters.roleId,
                },
            };
        }
        if (filters?.search) {
            where.OR = [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
                { username: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        return this.prisma.user.findMany({
            where,
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    // A062: Role-Based Access Control (RBAC)
    async createRole(roleData) {
        try {
            // Check if role already exists
            const existingRole = await this.prisma.role.findFirst({
                where: {
                    name: roleData.name,
                    tenantId: roleData.tenantId,
                },
            });
            if (existingRole) {
                throw new Error('Role with this name already exists');
            }
            const role = await this.prisma.role.create({
                data: {
                    name: roleData.name,
                    description: roleData.description,
                    permissions: roleData.permissions,
                    tenantId: roleData.tenantId,
                },
            });
            logger_1.logger.info(`Role created: ${role.id} (${role.name})`);
            return role;
        }
        catch (error) {
            logger_1.logger.error('Error creating role:', error);
            throw error;
        }
    }
    async updateRole(roleId, updateData, tenantId) {
        try {
            // Verify role exists and belongs to tenant
            const existingRole = await this.prisma.role.findFirst({
                where: { id: roleId, tenantId },
            });
            if (!existingRole) {
                throw new Error('Role not found');
            }
            if (existingRole.isSystem) {
                throw new Error('Cannot modify system roles');
            }
            const role = await this.prisma.role.update({
                where: { id: roleId },
                data: {
                    name: updateData.name,
                    description: updateData.description,
                    permissions: updateData.permissions,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Role updated: ${roleId}`);
            return role;
        }
        catch (error) {
            logger_1.logger.error('Error updating role:', error);
            throw error;
        }
    }
    async deleteRole(roleId, tenantId) {
        try {
            // Verify role exists and belongs to tenant
            const role = await this.prisma.role.findFirst({
                where: { id: roleId, tenantId },
            });
            if (!role) {
                throw new Error('Role not found');
            }
            if (role.isSystem) {
                throw new Error('Cannot delete system roles');
            }
            // Check if role is assigned to any users
            const userCount = await this.prisma.userRole.count({
                where: { roleId },
            });
            if (userCount > 0) {
                throw new Error('Cannot delete role that is assigned to users');
            }
            await this.prisma.role.delete({
                where: { id: roleId },
            });
            logger_1.logger.info(`Role deleted: ${roleId}`);
        }
        catch (error) {
            logger_1.logger.error('Error deleting role:', error);
            throw error;
        }
    }
    async getRoles(tenantId) {
        return this.prisma.role.findMany({
            where: { tenantId },
            include: {
                users: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async assignRolesToUser(userId, roleIds) {
        try {
            // Remove existing roles
            await this.prisma.userRole.deleteMany({
                where: { userId },
            });
            // Add new roles
            if (roleIds.length > 0) {
                await this.prisma.userRole.createMany({
                    data: roleIds.map(roleId => ({
                        userId,
                        roleId,
                    })),
                });
            }
            logger_1.logger.info(`Roles assigned to user ${userId}: ${roleIds.join(', ')}`);
        }
        catch (error) {
            logger_1.logger.error('Error assigning roles to user:', error);
            throw error;
        }
    }
    async updateUserRoles(userId, roleIds) {
        return this.assignRolesToUser(userId, roleIds);
    }
    async getUserRoles(userId) {
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: { role: true },
        });
        return userRoles.map(ur => ur.role);
    }
    async getUserPermissions(userId) {
        const roles = await this.getUserRoles(userId);
        const permissions = new Set();
        roles.forEach(role => {
            if (Array.isArray(role.permissions)) {
                role.permissions.filter(Boolean).forEach(permission => permissions.add(permission));
            }
        });
        return Array.from(permissions);
    }
    // A062: Authentication
    async authenticate(email, password, tenantId) {
        try {
            // Find user
            const user = await this.prisma.user.findFirst({
                where: {
                    email,
                    tenantId,
                    isActive: true,
                },
                include: {
                    roles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });
            if (!user) {
                throw new Error('Invalid credentials');
            }
            // Verify password
            const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
            if (!isValidPassword) {
                throw new Error('Invalid credentials');
            }
            // Update last login
            await this.prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() },
            });
            // Get roles and permissions
            const roles = user.roles.map(ur => ur.role);
            const permissions = await this.getUserPermissions(user.id);
            // Generate tokens
            const token = this.generateAccessToken(user, roles, permissions);
            const refreshToken = this.generateRefreshToken(user.id);
            // Remove password from user object
            const { password: _, ...userWithoutPassword } = user;
            logger_1.logger.info(`User authenticated: ${user.id} (${user.email})`);
            return {
                user: userWithoutPassword,
                token,
                refreshToken,
                roles,
                permissions,
            };
        }
        catch (error) {
            logger_1.logger.error('Authentication error:', error);
            throw error;
        }
    }
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.config.jwtRefreshSecret);
            // Get user with roles
            const user = await this.prisma.user.findFirst({
                where: {
                    id: decoded.userId,
                    isActive: true,
                },
                include: {
                    roles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });
            if (!user) {
                throw new Error('Invalid refresh token');
            }
            // Get roles and permissions
            const roles = user.roles.map(ur => ur.role);
            const permissions = await this.getUserPermissions(user.id);
            // Generate new tokens
            const token = this.generateAccessToken(user, roles, permissions);
            const newRefreshToken = this.generateRefreshToken(user.id);
            // Remove password from user object
            const { password: _, ...userWithoutPassword } = user;
            return {
                user: userWithoutPassword,
                token,
                refreshToken: newRefreshToken,
                roles,
                permissions,
            };
        }
        catch (error) {
            logger_1.logger.error('Token refresh error:', error);
            throw new Error('Invalid refresh token');
        }
    }
    async changePassword(userId, currentPassword, newPassword, tenantId) {
        try {
            // Get user
            const user = await this.prisma.user.findFirst({
                where: { id: userId, tenantId },
            });
            if (!user) {
                throw new Error('User not found');
            }
            // Verify current password
            const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }
            // Hash new password
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
            // Update password
            await this.prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });
            logger_1.logger.info(`Password changed for user: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error changing password:', error);
            throw error;
        }
    }
    // A062: Authorization
    async hasPermission(userId, permission) {
        const permissions = await this.getUserPermissions(userId);
        return permissions.includes(permission) || permissions.includes('*');
    }
    async hasAnyPermission(userId, permissions) {
        const userPermissions = await this.getUserPermissions(userId);
        return permissions.some(permission => userPermissions.includes(permission) || userPermissions.includes('*'));
    }
    async hasAllPermissions(userId, permissions) {
        const userPermissions = await this.getUserPermissions(userId);
        return permissions.every(permission => userPermissions.includes(permission) || userPermissions.includes('*'));
    }
    async checkResourceAccess(userId, resource, action, resourceId) {
        const permission = `${resource}:${action}`;
        const hasGeneralPermission = await this.hasPermission(userId, permission);
        if (hasGeneralPermission) {
            return true;
        }
        // Check for resource-specific permissions
        if (resourceId) {
            const specificPermission = `${resource}:${action}:${resourceId}`;
            return this.hasPermission(userId, specificPermission);
        }
        return false;
    }
    generateAccessToken(user, roles, permissions) {
        const payload = {
            userId: user.id,
            email: user.email,
            tenantId: user.tenantId,
            roles: roles.map(r => r.name),
            permissions,
        };
        // Ensure secret is a string or Buffer
        const secret = typeof config_1.config.jwtSecret === 'string' ? config_1.config.jwtSecret : Buffer.from(String(config_1.config.jwtSecret));
        const options = {
            expiresIn: config_1.config.jwtExpiresIn || '1h',
            issuer: 'governance-service',
            audience: 'cogni-sync-platform',
        };
        return jsonwebtoken_1.default.sign(payload, secret, options);
    }
    generateRefreshToken(userId) {
        const payload = { userId };
        // Ensure secret is a string or Buffer
        const secret = typeof config_1.config.jwtRefreshSecret === 'string' ? config_1.config.jwtRefreshSecret : Buffer.from(String(config_1.config.jwtRefreshSecret));
        const options = {
            expiresIn: config_1.config.jwtRefreshExpiresIn || '7d',
            issuer: 'governance-service',
            audience: 'cogni-sync-platform',
        };
        return jsonwebtoken_1.default.sign(payload, secret, options);
    }
    // Initialize default roles and admin user
    async initializeDefaultRoles(tenantId) {
        try {
            const defaultRoles = [
                {
                    name: 'Super Admin',
                    description: 'Full system access',
                    permissions: ['*'],
                    isSystem: true,
                },
                {
                    name: 'Admin',
                    description: 'Administrative access',
                    permissions: [
                        'users:read', 'users:write', 'users:delete',
                        'roles:read', 'roles:write', 'roles:delete',
                        'workflows:read', 'workflows:write', 'workflows:delete',
                        'documents:read', 'documents:write', 'documents:delete',
                        'dashboards:read', 'dashboards:write',
                        'reports:read', 'reports:write',
                        'analytics:read',
                    ],
                    isSystem: true,
                },
                {
                    name: 'Manager',
                    description: 'Management access',
                    permissions: [
                        'users:read',
                        'workflows:read', 'workflows:write',
                        'documents:read', 'documents:write',
                        'dashboards:read',
                        'reports:read', 'reports:write',
                        'analytics:read',
                    ],
                    isSystem: true,
                },
                {
                    name: 'User',
                    description: 'Basic user access',
                    permissions: [
                        'workflows:read',
                        'documents:read',
                        'dashboards:read',
                        'reports:read',
                    ],
                    isSystem: true,
                },
            ];
            for (const roleData of defaultRoles) {
                const existingRole = await this.prisma.role.findFirst({
                    where: { name: roleData.name, tenantId },
                });
                if (!existingRole) {
                    await this.prisma.role.create({
                        data: {
                            ...roleData,
                            tenantId,
                        },
                    });
                }
            }
            logger_1.logger.info(`Default roles initialized for tenant: ${tenantId}`);
        }
        catch (error) {
            logger_1.logger.error('Error initializing default roles:', error);
            throw error;
        }
    }
}
exports.UserManagementService = UserManagementService;
//# sourceMappingURL=user-management.service.js.map