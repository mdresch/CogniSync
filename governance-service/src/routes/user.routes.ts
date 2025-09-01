import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, requirePermission } from '../middleware/auth.middleware';
import { enforceTenantIsolation } from '../middleware/tenant.middleware';
import { UserManagementService } from '../services/user-management.service';
import { logger, logAudit } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();
const userManagementService = new UserManagementService(prisma);

// Validation schemas
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  firstName: Joi.string().required().max(100),
  lastName: Joi.string().required().max(100),
  password: Joi.string().min(8).required(),
  roleIds: Joi.array().items(Joi.string()).optional(),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  username: Joi.string().alphanum().min(3).max(30).optional(),
  firstName: Joi.string().optional().max(100),
  lastName: Joi.string().optional().max(100),
  isActive: Joi.boolean().optional(),
  roleIds: Joi.array().items(Joi.string()).optional(),
});

const createRoleSchema = Joi.object({
  name: Joi.string().required().max(100),
  description: Joi.string().optional().max(500),
  permissions: Joi.array().items(Joi.string()).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

// Apply middleware
router.use(enforceTenantIsolation);

// Authentication routes (no auth required)
router.post('/auth/login', async (req, res: Response) => {
  try {
    const { email, password, tenantId } = req.body;

    if (!email || !password || !tenantId) {
      throw new ValidationError('Email, password, and tenantId are required');
    }

    const authResult = await userManagementService.authenticate(email, password, tenantId);

    logAudit('user_login', authResult.user.id, 'user', authResult.user.id, {
      email: authResult.user.email,
    });

    res.json({
      success: true,
      data: authResult,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid credentials',
      },
    });
  }
});

router.post('/auth/refresh', async (req, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const authResult = await userManagementService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: authResult,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      },
    });
  }
});

// User management routes (auth required)
router.get('/', requirePermission('users:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isActive, roleId, search } = req.query;
    
    const users = await userManagementService.getUsers(req.user!.tenantId, {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      roleId: roleId as string,
      search: search as string,
    });

    // Remove password from response
    const sanitizedUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json({
      success: true,
      data: sanitizedUsers,
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    throw error;
  }
});

router.post('/', requirePermission('users:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid user data', error.details);
    }

    const user = await userManagementService.createUser({
      ...value,
      tenantId: req.user!.tenantId,
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    logAudit('user_created', req.user!.userId, 'user', user.id, {
      email: user.email,
      username: user.username,
    });

    res.status(201).json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
});

router.get('/:id', requirePermission('users:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userManagementService.getUser(req.params.id, req.user!.tenantId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    throw error;
  }
});

router.put('/:id', requirePermission('users:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid user data', error.details);
    }

    const user = await userManagementService.updateUser(req.params.id, value, req.user!.tenantId);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    logAudit('user_updated', req.user!.userId, 'user', req.params.id, {
      changes: value,
    });

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
});

router.delete('/:id', requirePermission('users:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await userManagementService.deleteUser(req.params.id, req.user!.tenantId);

    logAudit('user_deleted', req.user!.userId, 'user', req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
});

router.post('/:id/change-password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Users can only change their own password unless they have admin permission
    if (req.params.id !== req.user!.userId && !req.user!.permissions.includes('users:write')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only change your own password',
        },
      });
      return;
    }

    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid password data', error.details);
    }

    await userManagementService.changePassword(
      req.params.id,
      value.currentPassword,
      value.newPassword,
      req.user!.tenantId
    );

    logAudit('password_changed', req.user!.userId, 'user', req.params.id);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    throw error;
  }
});

// Role management routes
router.get('/roles', requirePermission('roles:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await userManagementService.getRoles(req.user!.tenantId);

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    logger.error('Error fetching roles:', error);
    throw error;
  }
});

router.post('/roles', requirePermission('roles:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createRoleSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid role data', error.details);
    }

    const role = await userManagementService.createRole({
      ...value,
      tenantId: req.user!.tenantId,
    });

    logAudit('role_created', req.user!.userId, 'role', role.id, {
      roleName: role.name,
      permissions: role.permissions,
    });

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    logger.error('Error creating role:', error);
    throw error;
  }
});

router.put('/roles/:id', requirePermission('roles:write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createRoleSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid role data', error.details);
    }

    const role = await userManagementService.updateRole(req.params.id, value, req.user!.tenantId);

    logAudit('role_updated', req.user!.userId, 'role', req.params.id, {
      changes: value,
    });

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    logger.error('Error updating role:', error);
    throw error;
  }
});

router.delete('/roles/:id', requirePermission('roles:delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await userManagementService.deleteRole(req.params.id, req.user!.tenantId);

    logAudit('role_deleted', req.user!.userId, 'role', req.params.id);

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting role:', error);
    throw error;
  }
});

// User permissions
router.get('/:id/permissions', requirePermission('users:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = await userManagementService.getUserPermissions(req.params.id);

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    throw error;
  }
});

router.get('/:id/roles', requirePermission('users:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await userManagementService.getUserRoles(req.params.id);

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    logger.error('Error fetching user roles:', error);
    throw error;
  }
});

// Current user profile
router.get('/me/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await userManagementService.getUser(req.user!.userId, req.user!.tenantId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw error;
  }
});

router.put('/me/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'email'];
    const updateData: { [key: string]: any } = {};
    // Only allow users to update their own basic profile fields
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const user = await userManagementService.updateUser(req.user!.userId, updateData, req.user!.tenantId);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    logAudit('profile_updated', req.user!.userId, 'user', req.user!.userId, {
      changes: updateData,
    });

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw error;
  }
});

export { router as userRoutes };