export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    console.error('Supabase keepalive configuration is missing.')
    return res.status(500).json({ success: false, error: 'Health check is not configured' })
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_public_high_score_leaderboard`,
      {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_limit: 1 }),
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      console.error('Supabase keepalive failed with HTTP status:', response.status)
      return res.status(502).json({ success: false, error: 'Supabase health check failed' })
    }

    // Consume the response without returning any leaderboard or player data.
    await response.arrayBuffer()
    return res.status(200).json({ success: true, checkedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Supabase keepalive request failed:', error)
    return res.status(502).json({ success: false, error: 'Supabase health check failed' })
  }
}
