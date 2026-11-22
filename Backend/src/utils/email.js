import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  return transporter;
};

export const sendOtpEmail = async ({ email, otp, purpose }) => {
  const isRegister = purpose === 'register';
  const subject = isRegister
    ? '[Karat Retail] Mã OTP xác thực đăng ký tài khoản'
    : '[Karat Retail] Mã OTP đặt lại mật khẩu';

  const actionTitle = isRegister ? 'Xác thực đăng ký tài khoản' : 'Yêu cầu đặt lại mật khẩu';
  const actionDesc = isRegister
    ? 'Cảm ơn bạn đã đăng ký tài khoản tại Karat Retail. Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc xác thực email:'
    : 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP dưới đây để đặt lại mật khẩu:';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #0f172a;">
      <div style="text-align: center; margin-bottom: 16px;">
        <h2 style="margin: 0; color: #2563eb;">Karat Retail</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Hệ thống quản lý bán hàng & kho</p>
      </div>
      <h3 style="font-size: 16px; margin-bottom: 12px;">${actionTitle}</h3>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">${actionDesc}</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 12px 24px; background: #eff6ff; color: #1d4ed8; border: 1px dashed #93c5fd; border-radius: 8px;">
          ${otp}
        </span>
      </div>
      <p style="font-size: 13px; color: #64748b;">Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
    </div>
  `;

  // Always log to console in development or when SMTP is not configured
  console.log(`\n==================================================`);
  console.log(`[EMAIL OTP - ${purpose.toUpperCase()}] To: ${email} | OTP: ${otp}`);
  console.log(`==================================================\n`);

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return { sentViaSmtp: false, devOtp: env.nodeEnv !== 'production' ? otp : undefined };
  }

  try {
    const info = await mailTransporter.sendMail({
      from: env.smtpFrom || `"Karat Retail" <${env.smtpUser}>`,
      to: email,
      subject,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[EmailService] Xem trực tiếp hộp thư Email đã gửi tại: ${previewUrl}`);
    }
    return {
      sentViaSmtp: true,
      previewUrl,
      devOtp: env.nodeEnv !== 'production' ? otp : undefined,
    };
  } catch (err) {
    console.error('[EmailService] Lỗi gửi email qua SMTP, sử dụng fallback console:', err.message);
    return { sentViaSmtp: false, devOtp: env.nodeEnv !== 'production' ? otp : undefined };
  }
};
