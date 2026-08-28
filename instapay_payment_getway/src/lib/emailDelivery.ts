import nodemailer from 'nodemailer'

interface SendOtpEmailInput {
  to: string
  otp: string
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || 'InstaPay Gateway <no-reply@instapay-gateway.local>'
}

async function sendViaResend(input: SendOtpEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: input.to,
      subject: 'Your InstaPay Gateway verification code',
      html: renderOtpHtml(input.otp),
      text: renderOtpText(input.otp),
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`Resend email delivery failed: ${response.status} ${message}`)
  }

  return true
}

async function sendViaSmtp(input: SendOtpEmailInput): Promise<boolean> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return false

  const port = Number(process.env.SMTP_PORT || 465)
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: getFromAddress(),
    to: input.to,
    subject: 'Your InstaPay Gateway verification code',
    html: renderOtpHtml(input.otp),
    text: renderOtpText(input.otp),
  })

  return true
}

export async function sendOtpEmail(input: SendOtpEmailInput) {
  if (await sendViaResend(input)) return
  if (await sendViaSmtp(input)) return

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[email-otp] ${input.to}: ${input.otp}`)
    return
  }

  throw new Error('Email delivery is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.')
}

function renderOtpText(otp: string): string {
  return [
    'Your InstaPay Gateway verification code',
    '',
    `Code: ${otp}`,
    '',
    'This code expires in 10 minutes. If you did not request this, ignore this email.',
  ].join('\n')
}

function renderOtpHtml(otp: string): string {
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#070a12;color:#f8fafc;padding:32px">
      <div style="max-width:520px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:28px">
        <h1 style="font-size:22px;margin:0 0 12px">Verify your email</h1>
        <p style="color:#94a3b8;line-height:1.6;margin:0 0 22px">Use this code to continue your InstaPay Gateway account verification.</p>
        <div style="letter-spacing:8px;font-size:34px;font-weight:800;background:#111827;border-radius:18px;padding:18px;text-align:center">${otp}</div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:22px 0 0">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
      </div>
    </div>
  `
}
