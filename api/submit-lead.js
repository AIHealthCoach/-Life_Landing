// POST /api/submit-lead  { name: string, email: string }
// → 200 { success: true }  on success
// → 400 { error: string }  on bad input
// → 500 { error: string }  on server/Notion failure
// → 502 { error: string }  if Notion responds non-2xx

const NOTION_DATABASE_ID = '30b8036c7c8a4f1fa8745efef50d7773';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim())
    return res.status(400).json({ error: 'Name is required' });
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim()))
    return res.status(400).json({ error: 'Valid email is required' });

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error('[submit-lead] NOTION_TOKEN env var not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: name.trim() } }] },
          Email: { email: email.trim().toLowerCase() },
        },
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      console.error('[submit-lead] Notion error', r.status, body);
      return res.status(502).json({ error: 'Failed to save — please try again' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[submit-lead] Unexpected error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
