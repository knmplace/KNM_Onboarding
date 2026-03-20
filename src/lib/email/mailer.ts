import nodemailer from "nodemailer";

export interface MailerConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

function getDefaultMailerConfig(): MailerConfig {
  return {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: process.env.SMTP_SECURE === "true",
    username: process.env.SMTP_USERNAME!,
    password: process.env.SMTP_PASSWORD!,
    fromEmail: process.env.SMTP_FROM_EMAIL || "no-reply@yourdomain.com",
    fromName: process.env.SMTP_FROM_NAME || "Onboarding",
  };
}

export async function sendEmail(
  { to, subject, html }: SendEmailOptions,
  config: MailerConfig = getDefaultMailerConfig()
) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  const from = `${config.fromName} <${config.fromEmail}>`;

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

export async function verifyMailer(
  config: MailerConfig = getDefaultMailerConfig()
) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  return transporter.verify();
}
