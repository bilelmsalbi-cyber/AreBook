type VerifyEmailData = {
  firstName: string;
  verifyUrl: string;
};

export function buildVerifyEmail(data: VerifyEmailData) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #16324F;">
      <div style="background: linear-gradient(90deg, #1D4ED8, #60A5FA); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Confirm your email</h1>
      </div>
      <div style="padding: 24px;">
        <p>Dear ${data.firstName},</p>
        <p>Thanks for creating an AreBook account. Please confirm this is your email address to activate your account.</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${data.verifyUrl}"
             style="display: inline-block; background: linear-gradient(90deg, #2563EB, #3B82F6); color: white; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600;">
            Confirm my email
          </a>
        </div>

        <p style="color: #5C7A96; font-size: 13px;">This link expires in 24 hours. If you didn't create an AreBook account, you can safely ignore this email.</p>
        <p style="color: #5C7A96; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br />${data.verifyUrl}</p>
      </div>
    </div>
  `;

  const text = `Dear ${data.firstName},

Thanks for creating an AreBook account. Please confirm your email address to activate your account:

${data.verifyUrl}

This link expires in 24 hours. If you didn't create an AreBook account, you can safely ignore this email.`;

  return { html, text };
}