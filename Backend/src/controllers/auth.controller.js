import * as authService from '../services/auth.service.js';

const actor = (request) => ({ ...request.user, ipAddress: request.ip });

export const login = async (request, response) => {
  response.status(200).json({ data: await authService.login(request.body) });
};
export const register = async (request, response) => response.status(201).json({ data: await authService.register(request.body) });

export const me = async (request, response) => {
  response.status(200).json({ data: authService.getMe(request.user) });
};

export const listUsers = async (request, response) => {
  response.status(200).json(await authService.getUsers(request.query));
};

export const createUser = async (request, response) => {
  response.status(201).json({ data: await authService.addUser(request.body, actor(request)) });
};

export const updateUser = async (request, response) => {
  response.status(200).json({ data: await authService.editUser(request.params.userId, request.body, actor(request)) });
};

export const listRoles = async (request, response) => {
  response.status(200).json({ data: await authService.getRoles() });
};

export const createRole = async (request, response) => {
  response.status(201).json({ data: await authService.addRole(request.body, actor(request)) });
};

export const updateRole = async (request, response) => {
  response.status(200).json({ data: await authService.editRole(request.params.roleId, request.body, actor(request)) });
};

export const listPermissions = async (request, response) => {
  response.status(200).json({ data: await authService.getPermissions() });
};

export const replaceRolePermissions = async (request, response) => {
  response.status(200).json({ data: await authService.setRolePermissions(request.params.roleId, request.body.permissionIds, actor(request)) });
};
