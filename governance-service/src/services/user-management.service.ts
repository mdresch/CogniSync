import { PrismaClient, User, Role, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

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

export class UserManagementService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // A062: User Management
  async createUser(userData: CreateUserRequest): Promise<User> {
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
      const hashedPassword = await bcrypt.hash(userData.password, 12);

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

      logger.info(`User created: ${user.id} (${user.email})`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updateData: UpdateUserRequest, tenantId: string): Promise<User> {
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

      logger.info(`User updated: ${userId}`);
      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string, tenantId: string): Promise<void> {
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

      logger.info(`User deactivated: ${userId}`);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  async getUser(userId: string, tenantId: string): Promise<User | null> {
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

  async getUsers(tenantId: string, filters?: {
    isActive?: boolean;
    roleId?: string;
    search?: string;
  }): Promise<User[]> {
    const where: any = { tenantId };

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
  async createRole(roleData: CreateRoleRequest): Promise<Role> {
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

      logger.info(`Role created: ${role.id} (${role.name})`);
      return role;
    } catch (error) {
      logger.error('Error creating role:', error);
      throw error;
    }
  }

  async updateRole(roleId: string, updateData: Partial<CreateRoleRequest>, tenantId: string): Promise<Role> {
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

      logger.info(`Role updated: ${roleId}`);
      return role;
    } catch (error) {
      logger.error('Error updating role:', error);
      throw error;
    }
  }

  async deleteRole(roleId: string, tenantId: string): Promise<void> {
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

      logger.info(`Role deleted: ${roleId}`);
    } catch (error) {
      logger.error('Error deleting role:', error);
      throw error;
    }
  }

  async getRoles(tenantId: string): Promise<Role[]> {
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

  async assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
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

      logger.info(`Roles assigned to user ${userId}: ${roleIds.join(', ')}`);
    } catch (error) {
      logger.error('Error assigning roles to user:', error);
      throw error;
    }
  }

  async updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
    return this.assignRolesToUser(userId, roleIds);
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.map(ur => ur.role);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const permissions = new Set<string>();

    roles.forEach(role => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach(permission => permissions.add(permission));
      }
    });

    return Array.from(permissions);
  }

  // A062: Authentication
  async authenticate(email: string, password: string, tenantId: string): Promise<AuthResult> {
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
      const isValidPassword = await bcrypt.compare(password, user.password);
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

      logger.info(`User authenticated: ${user.id} (${user.email})`);

      return {
        user: userWithoutPassword,
        token,
        refreshToken,
        roles,
        permissions,
      };
    } catch (error) {
      logger.error('Authentication error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as any;
      
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
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, tenantId: string): Promise<void> {
    try {
      // Get user
      const user = await this.prisma.user.findFirst({
        where: { id: userId, tenantId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Password changed for user: ${userId}`);
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  // A062: Authorization
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission) || permissions.includes('*');
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some(permission => 
      userPermissions.includes(permission) || userPermissions.includes('*')
    );
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every(permission => 
      userPermissions.includes(permission) || userPermissions.includes('*')
    );
  }

  async checkResourceAccess(userId: string, resource: string, action: string, resourceId?: string): Promise<boolean> {
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

  private generateAccessToken(user: User, roles: Role[], permissions: string[]): string {
    const payload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: roles.map(r => r.name),
      permissions,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn || '1h',
      issuer: 'governance-service',
      audience: 'cogni-sync-platform',
    });
  }

  private generateRefreshToken(userId: string): string {
    const payload = { userId };

    return jwt.sign(payload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiresIn || '7d',
      issuer: 'governance-service',
      audience: 'cogni-sync-platform',
    });
  }

  // Initialize default roles and admin user
  async initializeDefaultRoles(tenantId: string): Promise<void> {
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

      logger.info(`Default roles initialized for tenant: ${tenantId}`);
    } catch (error) {
      logger.error('Error initializing default roles:', error);
      throw error;
    }
  }
}