// api/submit-lead.js  (v1.1 — GitHub Issues backend)
// POST /api/submit-lead  { name: string, email: string }
// → 200 { success: true }
// → 400 { error: string }  bad input
// → 500 { error: string }  config/server failure
// → 502 { error: string }  GitHub API non-2xx

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

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_ISSUES_REPO;

  if (!token || !repo) {
    console.error('[submit-lead] GITHUB_TOKEN or GITHUB_ISSUES_REPO env var not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  const issueBody = [
    `## Lead submission`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Name** | ${cleanName} |`,
    `| **Email** | ${cleanEmail} |`,
    `| **Submitted at** | ${new Date().toISOString()} |`,
  ].join('\n');

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `Lead: ${cleanName} <${cleanEmail}>`,
        body: issueBody,
        labels: ['lead'],
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      console.error('[submit-lead] GitHub error', r.status, body);
      return res.status(502).json({ error: 'Failed to save — please try again' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[submit-lead] Unexpected error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
