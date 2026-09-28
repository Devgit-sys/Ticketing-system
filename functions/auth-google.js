const https = require('https');

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
    const data = JSON.parse(event.body || '{}');
    const idToken = data.idToken || null;

    if (!idToken) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Missing idToken' }) };
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

    const info = await new Promise((resolve, reject) => {
      const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
      https.get(url, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error('Invalid Google token'));
          }
        });
      }).on('error', reject);
    });

    if (googleClientId && info.aud !== googleClientId) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, message: 'Token audience mismatch' }) };
    }

    if (!info.email) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, message: 'No email in token' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        user: {
          email: info.email,
          name: info.name || info.email,
          sub: info.sub,
          picture: info.picture || ''
        }
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: 'Google verification failed', error: error.message }) };
  }
};
