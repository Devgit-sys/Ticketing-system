const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const SMTP_ENABLED = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// Baseline security headers (no extra dependency required)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Minimal in-memory rate limiter (per IP, sliding window). Good enough for a
// single-instance deployment; swap for a shared store (e.g. Redis) if this
// ever runs behind multiple instances.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(key) || []).filter((t) => t > windowStart);
    if (timestamps.length >= max) {
      return res.status(429).json({ ok: false, message: 'Too many requests, please try again shortly.' });
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

const notifyLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 }); // 10 ticket emails/min/IP
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });   // 20 auth attempts/min/IP

const transporter = SMTP_ENABLED ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}) : null;

if (!SMTP_ENABLED) {
  console.warn('SMTP is not configured. Ticket email notifications are disabled until SMTP_HOST, SMTP_USER, and SMTP_PASS are set.');
}

app.post('/api/tickets/notify', notifyLimiter, async (req, res) => {
  try {
    const { subject, category, priority, dept, location, requester, created, description, link } = req.body || {};

    if (!subject || !description) {
      return res.status(400).json({ ok: false, message: 'Missing subject or description' });
    }

    // Defense in depth: nodemailer already strips header line-breaks, but
    // scrub here too so a crafted subject can never smuggle extra headers.
    const safeSubject = String(subject).replace(/[\r\n]+/g, ' ').slice(0, 300);

    if (!transporter) {
      return res.status(202).json({
        ok: true,
        mode: 'smtp-disabled',
        message: 'Ticket notification skipped because SMTP is not configured.'
      });
    }

    const mail = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost',
      to: process.env.TICKET_NOTIFY_TO || 'aiatechworldltd@outlook.com',
      subject: safeSubject,
      text: [
        'A new support ticket has been raised.',
        '',
        'Ticket details:',
        'Subject: ' + safeSubject,
        'Category: ' + (category || 'N/A'),
        'Priority: ' + (priority || 'N/A'),
        'Department: ' + (dept || 'N/A'),
        'Location: ' + (location || 'N/A'),
        'Requester: ' + (requester || 'N/A'),
        'Created: ' + (created || new Date().toISOString()),
        '',
        'Description:',
        description,
        '',
        'System link: ' + (link || 'N/A')
      ].join('\n')
    };

    await transporter.sendMail(mail);
    return res.json({ ok: true, message: 'Email sent', mode: 'smtp' });
  } catch (error) {
    console.error('Email send failed:', error);
    return res.status(500).json({ ok: false, message: 'Email delivery failed', error: error.message });
  }
});

// Public client config (safe: a Google Client ID is public by design).
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

// Verify a Google sign-in. Requires a real idToken — there is no unverified
// fallback, since accepting a bare { profile: { email } } would let anyone
// log in as any address just by POSTing it (no proof of identity at all).
app.post('/api/auth/google', authLimiter, (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ ok: false, message: 'Missing idToken' });
  }
  const https = require('https');
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  https.get(url, (r) => {
    let raw = '';
    r.on('data', (c) => { raw += c; });
    r.on('end', () => {
      try {
        const info = JSON.parse(raw);
        if (GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID) {
          return res.status(401).json({ ok: false, message: 'Token audience mismatch' });
        }
        if (!info.email) return res.status(401).json({ ok: false, message: 'No email in token' });
        return res.json({
          ok: true,
          user: { email: info.email, name: info.name || info.email, sub: info.sub, picture: info.picture || '' }
        });
      } catch (e) {
        return res.status(401).json({ ok: false, message: 'Invalid Google token' });
      }
    });
  }).on('error', () => res.status(500).json({ ok: false, message: 'Google verification failed' }));
});

// Serve only the folders the frontend actually needs, and index.html itself —
// not the whole project root. Previously express.static(__dirname) served
// server.js, package.json and package-lock.json to any visitor, exposing the
// backend's source and dependency list for no reason.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('IEPM email server running on http://localhost:' + PORT);
});
