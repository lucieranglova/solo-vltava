const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');

initializeApp();
const db = getFirestore();

const STRAVA_CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

const cors = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
};

// POST { code } → exchange OAuth code, store tokens, return aggregated stats
exports.exchangeStravaCode = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const { code } = req.body;
  if (!code) { res.status(400).json({ error: 'missing code' }); return; }

  try {
    const tokenResp = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at, athlete } = tokenResp.data;

    // Tokens se ukládají pouze server-side (Firestore rules blokují klientský přístup)
    await db.collection('stravaTokens').doc('main').set({
      access_token, refresh_token, expires_at,
      athleteId: athlete?.id,
      updatedAt: new Date().toISOString()
    });

    const stats = await fetchStravaStats(access_token, athlete?.id);
    res.json(stats);
  } catch (e) {
    console.error('exchangeStravaCode error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST {} → refresh tokens if needed, re-sync stats
exports.syncStravaStats = onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  try {
    const tokenDoc = await db.collection('stravaTokens').doc('main').get();
    if (!tokenDoc.exists) { res.status(400).json({ error: 'Strava not connected' }); return; }

    let { access_token, refresh_token, expires_at, athleteId } = tokenDoc.data();

    // Obnov token pokud expiroval
    if (Date.now() / 1000 > expires_at - 300) {
      const refreshResp = await axios.post('https://www.strava.com/oauth/token', {
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token'
      });
      access_token = refreshResp.data.access_token;
      refresh_token = refreshResp.data.refresh_token;
      expires_at = refreshResp.data.expires_at;
      await db.collection('stravaTokens').doc('main').update({ access_token, refresh_token, expires_at });
    }

    const stats = await fetchStravaStats(access_token, athleteId);
    res.json(stats);
  } catch (e) {
    console.error('syncStravaStats error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

async function fetchStravaStats(accessToken, athleteId) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [statsResp, activitiesResp] = await Promise.all([
    axios.get(`https://www.strava.com/api/v3/athletes/${athleteId}/stats`, { headers }),
    axios.get('https://www.strava.com/api/v3/athlete/activities?per_page=200', { headers })
  ]);

  const s = statsResp.data;
  const totalKm = Math.round((s.all_run_totals?.distance || 0) / 1000);
  const totalElevationM = Math.round(s.all_run_totals?.elevation_gain || 0);
  const totalTrainings = s.all_run_totals?.count || 0;

  // Ulož do Firestore
  await db.collection('performanceStats').doc('main').set({
    totalKm, totalElevationM, totalTrainings,
    source: 'strava',
    lastUpdatedAt: new Date().toISOString()
  }, { merge: true });

  return { totalKm, totalElevationM, totalTrainings };
}
