import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      'Email credentials not configured. Set EMAIL_USER and EMAIL_PASS in your .env file. ' +
      'EMAIL_USER should be your Gmail address. EMAIL_PASS should be a Google App Password ' +
      '(generate one at https://myaccount.google.com/apppasswords).'
    );
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
};

const sendOtpEmail = async (email, otp) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7fc; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
    .body { padding: 32px 24px; }
    .otp-box { background: #f0f5ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code { font-size: 36px; font-weight: 800; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace; }
    .expiry { text-align: center; color: #6b7280; font-size: 13px; margin-top: 12px; }
    .footer { text-align: center; padding: 20px 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>School Management System</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <p style="font-size: 14px; color: #374151;">You requested a password reset. Use the OTP below to verify your identity.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <p class="expiry">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">If you did not request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} School Management System. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `"School Management" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset OTP - School Management System',
    html,
  };

  await getTransporter().sendMail(mailOptions);
};

const sendEmailChangeOtp = async (email, otp) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7fc; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
    .body { padding: 32px 24px; }
    .otp-box { background: #f0f5ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code { font-size: 36px; font-weight: 800; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace; }
    .expiry { text-align: center; color: #6b7280; font-size: 13px; margin-top: 12px; }
    .footer { text-align: center; padding: 20px 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>School Management System</h1>
      <p>Email Change Request</p>
    </div>
    <div class="body">
      <p style="font-size: 14px; color: #374151;">You requested an email change for your account. Use the OTP below to verify your new email address.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <p class="expiry">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">If you did not request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} School Management System. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `"School Management" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Email Change OTP - School Management System',
    html,
  };

  await getTransporter().sendMail(mailOptions);
};

const sendPasswordChangeOtp = async (email, otp) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7fc; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
    .body { padding: 32px 24px; }
    .otp-box { background: #f0f5ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code { font-size: 36px; font-weight: 800; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace; }
    .expiry { text-align: center; color: #6b7280; font-size: 13px; margin-top: 12px; }
    .footer { text-align: center; padding: 20px 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>School Management System</h1>
      <p>Password Change Request</p>
    </div>
    <div class="body">
      <p style="font-size: 14px; color: #374151;">You requested a password change for your account. Use the OTP below to proceed.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <p class="expiry">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">If you did not request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} School Management System. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `"School Management" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Change OTP - School Management System',
    html,
  };

  await getTransporter().sendMail(mailOptions);
};

export { sendOtpEmail, sendEmailChangeOtp, sendPasswordChangeOtp };
