import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iatfphxrhhaffgvtfrtu.supabase.co'
const supabaseAnonKey = 'sb_publishable_Wh5xFjsVYK8kkXgVwHpWbg_Io5b85cD'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function syncAnalyticsToSupabase(
  username: string,
  playtimeSeconds: number,
  highScore: number,
  totalCoins: number
) {
  if (!username.trim()) return
  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_analytics')
      .select('high_score')
      .eq('username', username)
      .maybeSingle()

    if (fetchError) throw fetchError

    const { error } = await supabase
      .from('user_analytics')
      .upsert({
        username,
        playtime_seconds: Math.max(0, Math.floor(playtimeSeconds)),
        high_score: Math.max(existingUser?.high_score ?? 0, highScore),
        total_coins: totalCoins,
        last_updated: new Date().toISOString()
      }, { onConflict: 'username' })

    if (error) throw error
  } catch (error) {
    console.error('Error syncing analytics:', error)
  }
}

export async function recordPlaytimeEvent(username: string, seconds: number) {
  if (!username.trim() || seconds <= 0) return
  try {
    const { error } = await supabase
      .from('playtime_events')
      .insert({
        username,
        seconds: Math.floor(seconds)
      })

    if (error) throw error
  } catch (error) {
    console.error('Error recording playtime event:', error)
  }
}

export async function fetchAllAnalytics() {
  try {
    const [{ data: users, error: usersError }, { data: events, error: eventsError }] = await Promise.all([
      supabase.from('user_analytics').select('*').order('playtime_seconds', { ascending: false }),
      supabase.from('playtime_events').select('username, seconds, recorded_at').order('recorded_at', { ascending: false })
    ])

    if (usersError) throw usersError
    if (eventsError) throw eventsError

    return {
      users: users || [],
      events: events || []
    }
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return { users: [], events: [] }
  }
}


export async function fetchMyPlaytimeRank(username: string): Promise<{ rank: number; playtimeSeconds: number; totalPlayers: number } | null> {
  if (!username.trim()) return null
  try {
    const { data, error } = await supabase.rpc('get_my_playtime_rank', {
      p_username: username.trim()
    })

    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null

    return {
      rank: Number(row.player_rank || 0),
      playtimeSeconds: Number(row.playtime_seconds || 0),
      totalPlayers: Number(row.total_players || 0)
    }
  } catch (error) {
    console.error('Error fetching playtime rank:', error)
    return null
  }
}

export async function fetchUserHighScore(username: string): Promise<number | null> {
  if (!username.trim()) return null
  try {
    const { data, error } = await supabase
      .from('user_analytics')
      .select('high_score')
      .eq('username', username)
      .maybeSingle()

    if (error) throw error
    return data ? Math.max(0, Number(data.high_score || 0)) : 0
  } catch (error) {
    console.error('Error fetching user high score:', error)
    return null
  }
}


export async function fetchLeaderboardAnalytics() {
  try {
    const [{ data: users, error: usersError }, { data: events, error: eventsError }] = await Promise.all([
      supabase
        .from('user_analytics')
        .select('username, playtime_seconds')
        .order('playtime_seconds', { ascending: false }),
      supabase
        .from('playtime_events')
        .select('username, seconds, recorded_at')
        .order('recorded_at', { ascending: false })
    ])

    if (usersError) throw usersError
    if (eventsError) throw eventsError

    return {
      users: users || [],
      events: events || []
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return { users: [], events: [] }
  }
}
