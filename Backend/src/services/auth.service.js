import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertText } from '../utils/validation.js';
import { sendOtpEmail } from '../utils/email.js';
import {
  createRole,
  createUser,
  createCustomer,
  findPermissionsByIds,
  findRoleByCode,
  findRoleById,
  findUserByEmail,
  findUserAuthorization,
  listPermissions,
  listRoles,
  listUsers,
  replaceRolePermissions,
  updateRole,
  updateUser,
  updateUserPassword,
  updateLastLogin,
  writeAuditLog
} from '../models/auth.model.js';

// Lưu trữ mã OTP tạm thời (in-memory, TTL 5 phút)
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const generateOtpCode = () => String(crypto.randomInt(100000, 1000000));
const getOtpKey = (purpose, email) => `${purpose}:${email}`;

const createAndSaveOtp = (purpose, email, payload = {}) => {
  const otp = generateOtpCode();
  const key = getOtpKey(purpose, email);
  otpStore.set(key, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    payload,
  });
  return otp;
};

const verifySavedOtp = (purpose, email, inputOtp) => {
  const key = getOtpKey(purpose, email);
  const record = otpStore.get(key);
  if (!record) {
    throw new AppError(400, 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.');
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    throw new AppError(400, 'Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi lại mã mới.');
  }
  const cleanOtp = String(inputOtp || '').trim();
  if (!cleanOtp || cleanOtp !== record.otp) {
    record.attempts += 1;
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(key);
      throw new AppError(400, 'Bạn đã nhập sai OTP quá số lần quy định. Vui lòng yêu cầu gửi lại mã mới.');
    }
    throw new AppError(400, `Mã OTP không chính xác (còn ${OTP_MAX_ATTEMPTS - record.attempts} lần thử).`);
  }
  otpStore.delete(key);
  return record;
};

const publicUser = (user) => {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isRoleCode = (value) => /^[a-z][a-z0-9_]{2,49}$/.test(value);

const ensureJwtConfig = () => {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new AppError(500, 'JWT_SECRET phải được cấu hình và có ít nhất 32 ký tự');
  }
};

export const login = async ({ email, password }) => {
  ensureJwtConfig();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || typeof password !== 'string' || !password || normalizedEmail.length > 255 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new AppError(400, 'email và password là bắt buộc');
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'Email hoặc mật khẩu không đúng');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'Tài khoản không ở trạng thái hoạt động');
  }

  await updateLastLogin(user.id);
  const authorization = await findUserAuthorization(user.id);
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: authorization.role_code },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return { accessToken: token, tokenType: 'Bearer', expiresIn: env.jwtExpiresIn, user: publicUser(authorization) };
};

export const getMe = (user) => publicUser(user);

export const sendRegisterOtp = async (input) => {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) {
    throw new AppError(400, 'Email không hợp lệ');
  }
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError(409, 'Email này đã được đăng ký tài khoản');
  }
  const otp = createAndSaveOtp('register', email);
  const mailResult = await sendOtpEmail({ email, otp, purpose: 'register' });
  return {
    email,
    expiresInSeconds: OTP_TTL_MS / 1000,
    sentViaSmtp: mailResult.sentViaSmtp,
    previewUrl: mailResult.previewUrl,
    devOtp: mailResult.devOtp,
    message: mailResult.sentViaSmtp
      ? `Mã xác thực OTP đã được gửi tới email ${email}`
      : `Mã OTP đã được tạo cho ${email} (Chế độ Dev: xem mã OTP bên dưới hoặc trong console Backend)`,
  };
};

export const register = async (input) => {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) throw new AppError(400, 'email không hợp lệ');
  if (typeof input.password !== 'string' || input.password.length < 8 || Buffer.byteLength(input.password, 'utf8') > 72) {
    throw new AppError(400, 'password phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8');
  }
  if (input.roleId !== undefined || input.role !== undefined || input.status !== undefined) throw new AppError(400, 'Đăng ký chỉ tạo tài khoản khách hàng; không được chỉ định vai trò/trạng thái');
  if (!input.otp) {
    throw new AppError(400, 'Vui lòng nhập mã OTP xác thực email');
  }
  verifySavedOtp('register', email, input.otp);

  const fullName = assertText(input.fullName, 'fullName', 150);
  const phone = input.phone === undefined ? null : assertText(input.phone, 'phone', 30);
  const role = await findRoleByCode('customer');
  if (!role) throw new AppError(503, 'Chưa khởi tạo vai trò khách hàng');
  try { return await createCustomer({ email, fullName, phone, roleId: role.id,
    passwordHash: await bcrypt.hash(input.password, env.bcryptSaltRounds) }); }
  catch (error) { if (error.code === '23505') throw new AppError(409, 'Email đã được đăng ký'); throw error; }
};

export const sendForgotPasswordOtp = async (input) => {
  const email = normalizeEmail(input?.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) {
    throw new AppError(400, 'Vui lòng nhập địa chỉ email hợp lệ');
  }
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(404, 'Không tìm thấy tài khoản nào đăng ký với địa chỉ email này');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'Tài khoản này đang bị khóa hoặc ngừng hoạt động');
  }
  const otp = createAndSaveOtp('reset_password', email, { userId: user.id });
  const mailResult = await sendOtpEmail({ email, otp, purpose: 'reset_password' });
  return {
    email,
    expiresInSeconds: OTP_TTL_MS / 1000,
    sentViaSmtp: mailResult.sentViaSmtp,
    previewUrl: mailResult.previewUrl,
    devOtp: mailResult.devOtp,
    message: mailResult.sentViaSmtp
      ? `Mã OTP đặt lại mật khẩu đã được gửi tới email ${email}`
      : `Mã OTP đặt lại mật khẩu đã được tạo cho ${email} (Chế độ Dev: xem mã OTP bên dưới hoặc trong console Backend)`,
  };
};

export const resetPasswordWithOtp = async (input) => {
  const email = normalizeEmail(input?.email);
  const otp = input?.otp;
  const newPassword = input?.newPassword;

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) {
    throw new AppError(400, 'Email không hợp lệ');
  }
  if (!otp) {
    throw new AppError(400, 'Vui lòng nhập mã OTP');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw new AppError(400, 'Mật khẩu mới phải có ít nhất 8 ký tự và tối đa 72 byte');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(404, 'Không tìm thấy tài khoản');
  }

  verifySavedOtp('reset_password', email, otp);

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  await updateUserPassword(user.id, passwordHash);
  await writeAuditLog({
    actorUserId: user.id,
    action: 'reset_password',
    entityType: 'user',
    entityId: user.id,
    metadata: { email: user.email },
    ipAddress: null,
  });

  return { message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' };
};

export const getUsers = async (params) => {
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
  const page = Math.max(Number(params.page) || 1, 1);
  const result = await listUsers({ limit, offset: (page - 1) * limit, search: params.search?.trim(), status: params.status });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};

export const addUser = async ({ email, password, fullName, phone, roleId }, actor) => {
  const normalizedEmail = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new AppError(400, 'email không đúng định dạng');
  if (String(password || '').length < 8) throw new AppError(400, 'password phải có ít nhất 8 ký tự');
  if (!String(fullName || '').trim()) throw new AppError(400, 'fullName là bắt buộc');
  if (!isUuid(roleId)) throw new AppError(400, 'roleId không hợp lệ');
  if (!(await findRoleById(roleId))) throw new AppError(400, 'roleId không tồn tại');

  try {
    const user = await createUser({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, env.bcryptSaltRounds),
      fullName: fullName.trim(),
      phone: phone?.trim(),
      roleId
    });
    await writeAuditLog({ actorUserId: actor.id, action: 'create', entityType: 'user', entityId: user.id, metadata: { email: user.email }, ipAddress: actor.ipAddress });
    return user;
  } catch (error) {
    if (error.code === '23505') throw new AppError(409, 'Email đã tồn tại');
    throw error;
  }
};

export const editUser = async (userId, input, actor) => {
  if (!isUuid(userId)) throw new AppError(400, 'userId không hợp lệ');
  if (input.status && !['active', 'inactive', 'locked'].includes(input.status)) throw new AppError(400, 'status không hợp lệ');
  if (input.roleId && (!isUuid(input.roleId) || !(await findRoleById(input.roleId)))) throw new AppError(400, 'roleId không tồn tại');
  if (input.fullName !== undefined && !String(input.fullName).trim()) throw new AppError(400, 'fullName không được rỗng');
  if (userId === actor.id && input.status && input.status !== 'active') throw new AppError(400, 'Không thể tự vô hiệu hóa tài khoản đang đăng nhập');

  const user = await updateUser(userId, { ...input, fullName: input.fullName?.trim(), phone: input.phone?.trim() });
  if (!user) throw new AppError(404, 'Không tìm thấy tài khoản');
  await writeAuditLog({ actorUserId: actor.id, action: 'update', entityType: 'user', entityId: user.id, metadata: input, ipAddress: actor.ipAddress });
  return user;
};

export const getRoles = () => listRoles();

export const addRole = async ({ code, name, description }, actor) => {
  if (!isRoleCode(code)) throw new AppError(400, 'code phải gồm chữ thường, số hoặc dấu gạch dưới');
  if (!String(name || '').trim()) throw new AppError(400, 'name là bắt buộc');
  try {
    const role = await createRole({ code, name: name.trim(), description });
    await writeAuditLog({ actorUserId: actor.id, action: 'create', entityType: 'role', entityId: role.id, metadata: { code }, ipAddress: actor.ipAddress });
    return role;
  } catch (error) {
    if (error.code === '23505') throw new AppError(409, 'Role code đã tồn tại');
    throw error;
  }
};

export const editRole = async (roleId, input, actor) => {
  if (!isUuid(roleId)) throw new AppError(400, 'roleId không hợp lệ');
  const role = await findRoleById(roleId);
  if (!role) throw new AppError(404, 'Không tìm thấy role');
  if (role.is_system && input.name === undefined && input.description === undefined) throw new AppError(400, 'Dữ liệu cập nhật role không hợp lệ');
  const updated = await updateRole(roleId, input);
  await writeAuditLog({ actorUserId: actor.id, action: 'update', entityType: 'role', entityId: roleId, metadata: input, ipAddress: actor.ipAddress });
  return updated;
};

export const getPermissions = () => listPermissions();

export const setRolePermissions = async (roleId, permissionIds, actor) => {
  if (!isUuid(roleId)) throw new AppError(400, 'roleId không hợp lệ');
  if (!Array.isArray(permissionIds) || permissionIds.some((id) => !isUuid(id))) throw new AppError(400, 'permissionIds phải là mảng UUID');
  if (!(await findRoleById(roleId))) throw new AppError(404, 'Không tìm thấy role');
  const permissions = await findPermissionsByIds(permissionIds);
  if (permissions.length !== permissionIds.length) throw new AppError(400, 'Danh sách permissionIds có quyền không tồn tại');
  await replaceRolePermissions(roleId, permissionIds);
  await writeAuditLog({ actorUserId: actor.id, action: 'replace_permissions', entityType: 'role', entityId: roleId, metadata: { permissionIds }, ipAddress: actor.ipAddress });
  return { roleId, permissionIds };
};
