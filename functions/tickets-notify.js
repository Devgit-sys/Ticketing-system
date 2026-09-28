const nodemailer = require('nodemailer');

exports.handler = async function (event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const subject = String(payload.subject || '').replace(/[\r\n]+/g, ' ').slice(0, 300);
    const description = String(payload.description || '');

    if (!subject || !description) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Missing subject or description' }) };
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return { statusCode: 202, headers, body: JSON.stringify({ ok: true, mode: 'smtp-disabled', message: 'Ticket notification skipped because SMTP is not configured.' }) };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: process.env.TICKET_NOTIFY_TO || smtpUser,
      subject,
      text: [
        'A new support ticket has been raised.',
        '',
        'Ticket details:',
        'Subject: ' + subject,
        'Category: ' + (payload.category || 'N/A'),
        'Priority: ' + (payload.priority || 'N/A'),
        'Department: ' + (payload.dept || 'N/A'),
        'Location: ' + (payload.location || 'N/A'),
        'Requester: ' + (payload.requester || 'N/A'),
        'Created: ' + (payload.created || new Date().toISOString()),
        '',
        'Description:',
        description,
        '',
        'System link: ' + (payload.link || 'N/A')
      ].join('\n')
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'Email sent', mode: 'smtp' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: 'Email delivery failed', error: error.message }) };
  }
};
