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

const sendViaResendApi = async ({ from, to, subject, html }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Resend API HTTP ${response.status}`);
  }
  return data;
};

export const sendOtpEmail = async ({ email, otp, purpose }) => {
  const isRegister = purpose === 'register';
  const subject = isRegister
    ? '[Karat Retail] Mã OTP xác thực đăng ký tài khoản'
    : '[Karat Retail] Mã OTP đặt lại mật khẩu';

  const actionTitle = isRegister ? 'Xác thực đăng ký tài khoản' : 'Yêu cầu đặt lại mật khẩu';
  const actionDesc = isRegister
    ? 'Cảm ơn bạn đã đăng ký tài khoản tại Karat Retail (karats.studio). Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc xác thực email:'
    : 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại Karat Retail (karats.studio). Vui lòng sử dụng mã OTP dưới đây để đặt lại mật khẩu:';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #0f172a;">
      <div style="text-align: center; margin-bottom: 16px;">
        <h2 style="margin: 0; color: #2563eb;">Karat Retail</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Hệ thống quản lý bán hàng & kho — karats.studio</p>
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
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Email được gửi tự động từ hệ thống Karat Retail (https://karats.studio).</p>
    </div>
  `;

  const fromAddress = env.smtpFrom || 'Karat Retail <no-reply@karats.studio>';

  console.log(`\n==================================================`);
  console.log(`[EMAIL OTP - ${purpose.toUpperCase()}] From: ${fromAddress} -> To: ${email} | OTP: ${otp}`);
  console.log(`==================================================\n`);

  // 1. Ưu tiên gửi Email thật 100% qua Resend API (no-reply@karats.studio) nếu đã điền RESEND_API_KEY
  if (env.resendApiKey) {
    try {
      const resendData = await sendViaResendApi({
        from: fromAddress,
        to: email,
        subject,
        html,
      });
      console.log(`[EmailService] Đã gửi Email thật qua Resend (no-reply@karats.studio), ID: ${resendData.id}`);
      return {
        sentViaSmtp: true,
        provider: 'resend',
        devOtp: env.nodeEnv !== 'production' ? otp : undefined,
      };
    } catch (resendErr) {
      console.error('[EmailService] Lỗi gửi qua Resend API, chuyển sang SMTP fallback:', resendErr.message);
    }
  }

  // 2. Gửi qua SMTP (Gmail SMTP hoặc Ethereal SMTP)
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return { sentViaSmtp: false, devOtp: env.nodeEnv !== 'production' ? otp : undefined };
  }

  try {
    const info = await mailTransporter.sendMail({
      from: fromAddress,
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
      provider: previewUrl ? 'ethereal' : 'smtp',
      previewUrl,
      devOtp: env.nodeEnv !== 'production' ? otp : undefined,
    };
  } catch (err) {
    console.error('[EmailService] Lỗi gửi email qua SMTP, sử dụng fallback console:', err.message);
    return { sentViaSmtp: false, devOtp: env.nodeEnv !== 'production' ? otp : undefined };
  }
};
