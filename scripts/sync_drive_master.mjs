import crypto from "node:crypto";
import fs from "node:fs";

const creds = {
  type: "service_account",
  project_id: "landmine-lab-level-pro",
  private_key_id: "f12a0fb3f48bd15c458740288a8ca0762caf0617",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDpPC+nKFWPGxvF\nFRpBUCYWNruYlikCCB4dNVFifVTkof847hde7XzLDa8s+PAfhrxbX/vxjMlI+R9i\nogLrG5p46+S1eoflGNCwedeuNgGVqW4rqw+Hs5x3RetXPHPzq0coua3IQNI6x81g\nJjXTAhM5rTa+5L0bfCu4F/tYYAuJCiNGP+amrFw+iPnZsfwowgeOJaZ07bTgifMJ\n8rDTTBomPBDfzY8oHdv4SeDYGbywIvCjgiuXkF+649RpLLuRtk7rLL/9w7tXi35w\n1LdFbilaHA6bq4c4OJLZKT1j5T39EKshmuXLRzT2VZ1otv/RA4sZW27vmZTw+JNj\n0kj60G3/AgMBAAECggEACIX9i9NKhSdNdX9W7UobijZH1sSuDPf0+cZIChxgbNaK\nuC7jRcHSDK2cWD1ksRJAceppD6PAe103S2h2SNdCZubf/c3Th4jHn5tkSWaJ2klN\n0GS49ZGXxzgT6KU564631AItGqNby3AfzkK3NtXdk/8DgChlzMpV4q1lrw4bfc+C\nKPdIXYLP8M+MvjjoFpo+IIIGbL5Y1r+etmjLaOcJ6M23fPZ0vuS3RBcQoSltOpZi\nyXLegBuQrq+3W+3VOWzaPyh2VxmBkzvkmEGSb3nITzlCjC6qu1HFZIydH4T6IR19\npeIKqFm5HfG3wsS60iVNl8pjUuzBBfYLb27+eosISQKBgQD+Drnuv6w2R4Vk+Z1C\nb0THh8i65HDDyVL6DFR7tQ+T6s8K4g0VRsUSspS7JoIvfs6DlBDuAxLtxn5knsZG\nr/U0o6Nh7/GhaNkicuD4hKItSqWZURo1tnTqP2ZL+MQczpUEHlA+tgoHtEaYTPr1\n2ZWdjXYk9KxXnNDmT9F2amxg/QKBgQDrBLQb8jR5znNUH+5tB83ERg2CMjxs27w2\n4GIMUZot9Viu6SDQh7llrBJ92mrv2Z1kNMiTGBBVY2ljAHc4yE5yCNLaoH1EExiQ\nWhKrS01X/A4NPZxxrpqk00RryuQ9f1T719IhbeqbtdZmbrwwkR9/wta9YyKwlf3X\nCNdAfunJqwKBgC6gjUdgLj8YCUdq+I3E1h64sQJ8AqYsQOpbcPXzWRSQt8cLjdMl\n1e2EkP94JdSJtWU4u5KzRboWAAR/j2xRxvMORWIoI3S4RYGpC9kQnqMpXBMza1gI\nUJTdZezzjyqqT3ceCSQ5TMX1NC+nkTel42uzFsfZj/fUdBKQ+6R8C8ARAoGBAJ7z\nhnFkRhOgCyZ5lkONxKCcFKTbHz0s/MZMymO0iUfOKZXbPQNs2Hqof7U5FZx1HVtZ\ny9KYsutdmjiIZxozd8LurtWJOE/jbnirQvcxrfT1F/filL3aruMNtLgG+ImTZkIS\n/R74/XUk7gZHnOZoMNqzR5O9ygeO2qkmZJdNfweTAoGASpJvdiWY0OBlF4DlkXsC\nycgiiqzqhIM1di1IcaDg3yFm1bVl6ybU73Bj+8QRqI8Lt59+vmKSWh3vc/Oa6Bgv\n6JptY/0yFilq2AAWH4NEAuYdH4FuPKcjcLCHYsOZiemwKY4sMIZkMN9vnOQdUeEH\npoUCIINFimi2Qu2AFcE+w2k=\n-----END PRIVATE KEY-----\n",
  client_email: "bot-allenamenti@landmine-lab-level-pro.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token"
};

function base64url(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function run() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: creds.token_uri,
    exp: now + 3600,
    iat: now
  }));
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${claim}`);
  const sig = sign.sign(creds.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const assertion = `${header}.${claim}.${sig}`;

  const res = await fetch(creds.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
  });
  const tokenData = await res.json();
  const token = tokenData.access_token;

  const fileId = "129ts4wdwsypvWCB2cBHXWw3WTIKmtktA";
  const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const driveDb = await getRes.json();

  const localDemo = JSON.parse(fs.readFileSync("demo-data.json", "utf-8"));
  driveDb.allenamenti = localDemo.allenamenti;
  driveDb.database_esercizi = localDemo.database_esercizi;
  driveDb.last_cloud_sync = new Date().toISOString();

  const patchRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(driveDb)
  });
  console.log("Drive PATCH status:", patchRes.status);
  console.log("✅ Google Drive Master Data aggiornato con successo (totale:", driveDb.allenamenti.length, "allenamenti)!");
}

run().catch(console.error);
