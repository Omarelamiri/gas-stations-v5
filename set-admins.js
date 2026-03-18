// set-admins.js
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function grantAdminClaims() {
  // Replace with your REAL user UIDs (find them in Authentication → Users tab)
  const adminUids = [
    '6ZypinhvpjZWPdrLiUmBVh79NVk1',   // your current user
    'YKaso0Rv0HduJl1ysS0ASaBWMdS2',
    'J2DcdeJtWff0dqujd9zhhjppTXy2'
    // example: a colleague's UID
  ];

  for (const uid of adminUids) {
    try {
      await auth.setCustomUserClaims(uid, { admin: true });
      console.log(`Admin claim granted to: ${uid}`);

      // Optional: verify
      const user = await auth.getUser(uid);
      console.log(`Current claims for ${uid}:`, user.customClaims);
    } catch (error) {
      console.error(`Error for UID ${uid}:`, error);
    }
  }

  console.log('Done. Users must sign out & sign in again (or wait ~1h) for claims to take effect.');
  process.exit(0);
}

grantAdminClaims().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});