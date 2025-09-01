"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const user_management_service_1 = require("../services/user-management.service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.userRoutes = router;
const prisma = new client_1.PrismaClient();
const userManagementService = new user_management_service_1.UserManagementService(prisma);
// Validation schemas
const createUserSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    username: joi_1.default.string().alphanum().min(3).max(30).required(),
    firstName: joi_1.default.string().required().max(100),
    lastName: joi_1.default.string().required().max(100),
    password: joi_1.default.string().min(8).required(),
    roleIds: joi_1.default.array().items(joi_1.default.string()).optional(),
});
const updateUserSchema = joi_1.default.object({
    email: joi_1.default.string().email().optional(),
    username: joi_1.default.string().alphanum().min(3).max(30).optional(),
    firstName: joi_1.default.string().optional().max(100),
    lastName: joi_1.default.string().optional().max(100),
    isActive: joi_1.default.boolean().optional(),
    roleIds: joi_1.default.array().items(joi_1.default.string()).optional(),
});
const createRoleSchema = joi_1.default.object({
    name: joi_1.default.string().required().max(100),
    description: joi_1.default.string().optional().max(500),
    permissions: joi_1.default.array().items(joi_1.default.string()).required(),
});
const changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required(),
    newPassword: joi_1.default.string().min(8).required(),
});
// Apply middleware
router.use(tenant_middleware_1.enforceTenantIsolation);
// Authentication routes (no auth required)
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password, tenantId } = req.body;
        if (!email || !password || !tenantId) {
            throw new error_handler_1.ValidationError('Email, password, and tenantId are required');
        }
        const authResult = await userManagementService.authenticate(email, password, tenantId);
        (0, logger_1.logAudit)('user_login', authResult.user.id, 'user', authResult.user.id, {
            email: authResult.user.email,
        });
        res.json({
            success: true,
            data: authResult,
        });
    }
    catch (error) {
        logger_1.logger.error('Login error:', error);
        res.status(401).json({
            success: false,
            error: {
                code: 'AUTHENTICATION_FAILED',
                message: 'Invalid credentials',
            },
        });
    }
});
router.post('/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new error_handler_1.ValidationError('Refresh token is required');
        }
        const authResult = await userManagementService.refreshToken(refreshToken);
        res.json({
            success: true,
            data: authResult,
        });
    }
    catch (error) {
        logger_1.logger.error('Token refresh error:', error);
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
router.get('/', (0, auth_middleware_1.requirePermission)('users:read'), async (req, res) => {
    try {
        const { isActive, roleId, search } = req.query;
        const users = await userManagementService.getUsers(req.user.tenantId, {
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            roleId: roleId,
            search: search,
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
    }
    catch (error) {
        logger_1.logger.error('Error fetching users:', error);
        throw error;
    }
});
router.post('/', (0, auth_middleware_1.requirePermission)('users:write'), async (req, res) => {
    try {
        const { error, value } = createUserSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid user data', error.details);
        }
        const user = await userManagementService.createUser({
            ...value,
            tenantId: req.user.tenantId,
        });
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        (0, logger_1.logAudit)('user_created', req.user.userId, 'user', user.id, {
            email: user.email,
            username: user.username,
        });
        res.status(201).json({
            success: true,
            data: userWithoutPassword,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating user:', error);
        throw error;
    }
});
router.get('/:id', (0, auth_middleware_1.requirePermission)('users:read'), async (req, res) => {
    try {
        const user = await userManagementService.getUser(req.params.id, req.user.tenantId);
        if (!user) {
            throw new error_handler_1.NotFoundError('User not found');
        }
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.json({
            success: true,
            data: userWithoutPassword,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user:', error);
        throw error;
    }
});
router.put('/:id', (0, auth_middleware_1.requirePermission)('users:write'), async (req, res) => {
    try {
        const { error, value } = updateUserSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid user data', error.details);
        }
        const user = await userManagementService.updateUser(req.params.id, value, req.user.tenantId);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        (0, logger_1.logAudit)('user_updated', req.user.userId, 'user', req.params.id, {
            changes: value,
        });
        res.json({
            success: true,
            data: userWithoutPassword,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating user:', error);
        throw error;
    }
});
router.delete('/:id', (0, auth_middleware_1.requirePermission)('users:delete'), async (req, res) => {
    try {
        await userManagementService.deleteUser(req.params.id, req.user.tenantId);
        (0, logger_1.logAudit)('user_deleted', req.user.userId, 'user', req.params.id);
        res.json({
            success: true,
            message: 'User deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting user:', error);
        throw error;
    }
});
router.post('/:id/change-password', async (req, res) => {
    try {
        // Users can only change their own password unless they have admin permission
        if (req.params.id !== req.user.userId && !req.user.permissions.includes('users:write')) {
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
            throw new error_handler_1.ValidationError('Invalid password data', error.details);
        }
        await userManagementService.changePassword(req.params.id, value.currentPassword, value.newPassword, req.user.tenantId);
        (0, logger_1.logAudit)('password_changed', req.user.userId, 'user', req.params.id);
        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error changing password:', error);
        throw error;
    }
});
// Role management routes
router.get('/roles', (0, auth_middleware_1.requirePermission)('roles:read'), async (req, res) => {
    try {
        const roles = await userManagementService.getRoles(req.user.tenantId);
        res.json({
            success: true,
            data: roles,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching roles:', error);
        throw error;
    }
});
router.post('/roles', (0, auth_middleware_1.requirePermission)('roles:write'), async (req, res) => {
    try {
        const { error, value } = createRoleSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid role data', error.details);
        }
        const role = await userManagementService.createRole({
            ...value,
            tenantId: req.user.tenantId,
        });
        (0, logger_1.logAudit)('role_created', req.user.userId, 'role', role.id, {
            roleName: role.name,
            permissions: role.permissions,
        });
        res.status(201).json({
            success: true,
            data: role,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating role:', error);
        throw error;
    }
});
router.put('/roles/:id', (0, auth_middleware_1.requirePermission)('roles:write'), async (req, res) => {
    try {
        const { error, value } = createRoleSchema.validate(req.body);
        if (error) {
            throw new error_handler_1.ValidationError('Invalid role data', error.details);
        }
        const role = await userManagementService.updateRole(req.params.id, value, req.user.tenantId);
        (0, logger_1.logAudit)('role_updated', req.user.userId, 'role', req.params.id, {
            changes: value,
        });
        res.json({
            success: true,
            data: role,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating role:', error);
        throw error;
    }
});
router.delete('/roles/:id', (0, auth_middleware_1.requirePermission)('roles:delete'), async (req, res) => {
    try {
        await userManagementService.deleteRole(req.params.id, req.user.tenantId);
        (0, logger_1.logAudit)('role_deleted', req.user.userId, 'role', req.params.id);
        res.json({
            success: true,
            message: 'Role deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting role:', error);
        throw error;
    }
});
// User permissions
router.get('/:id/permissions', (0, auth_middleware_1.requirePermission)('users:read'), async (req, res) => {
    try {
        const permissions = await userManagementService.getUserPermissions(req.params.id);
        res.json({
            success: true,
            data: permissions,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user permissions:', error);
        throw error;
    }
});
router.get('/:id/roles', (0, auth_middleware_1.requirePermission)('users:read'), async (req, res) => {
    try {
        const roles = await userManagementService.getUserRoles(req.params.id);
        res.json({
            success: true,
            data: roles,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user roles:', error);
        throw error;
    }
});
// Current user profile
router.get('/me/profile', async (req, res) => {
    try {
        const user = await userManagementService.getUser(req.user.userId, req.user.tenantId);
        if (!user) {
            throw new error_handler_1.NotFoundError('User not found');
        }
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.json({
            success: true,
            data: userWithoutPassword,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching user profile:', error);
        throw error;
    }
});
router.put('/me/profile', async (req, res) => {
    try {
        const allowedFields = ['firstName', 'lastName', 'email'];
        const updateData = {};
        // Only allow users to update their own basic profile fields
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        const user = await userManagementService.updateUser(req.user.userId, updateData, req.user.tenantId);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        (0, logger_1.logAudit)('profile_updated', req.user.userId, 'user', req.user.userId, {
            changes: updateData,
        });
        res.json({
            success: true,
            data: userWithoutPassword,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating user profile:', error);
        throw error;
    }
});
//# sourceMappingURL=user.routes.js.map