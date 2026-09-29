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

export interface CloudGameProgress {
  highScore: number
  bikeHighScore: number
  carHighScore: number
  unlockedBikes: string[]
  unlockedCars: string[]
  bikeSkins: Record<string, string>
  totalCoins: number
  inventory: Record<string, number>
  vehicleMode: 'bike' | 'car'
  selectedBikeId: string
  selectedCarId: string
  selectedSkin: string
  totalPlaytime: number
  userPlaytime: Record<string, number>
  playtimeHistory: Array<{ date: string; seconds: number }>
}

export async function fetchUserGameProgress(username: string): Promise<CloudGameProgress | null> {
  if (!username.trim()) return null
  try {
    const { data, error } = await supabase
      .from('user_analytics')
      .select('game_progress, total_coins')
      .eq('username', username.trim())
      .maybeSingle()

    if (error) throw error
    if (!data?.game_progress || typeof data.game_progress !== 'object') return null

    const progress = data.game_progress as CloudGameProgress
    // Older saves may have the correct balance in user_analytics.total_coins
    // even when game_progress.totalCoins was not persisted correctly.
    const storedTotalCoins = Number(data.total_coins || 0)
    return {
      ...progress,
      totalCoins: Math.max(Number(progress.totalCoins || 0), Number.isFinite(storedTotalCoins) ? storedTotalCoins : 0),
    }
  } catch (error) {
    console.error('Error fetching game progress:', error)
    return null
  }
}

export async function saveUserGameProgress(
  username: string,
  progress: CloudGameProgress
): Promise<boolean> {
  if (!username.trim()) return false
  try {
    const { data: existing, error: existingError } = await supabase
      .from('user_analytics')
      .select('high_score, playtime_seconds, total_coins')
      .eq('username', username.trim())
      .maybeSingle()

    if (existingError) throw existingError

    const { error } = await supabase
      .from('user_analytics')
      .upsert({
        username: username.trim(),
        playtime_seconds: Math.max(Number(existing?.playtime_seconds || 0), Math.floor(progress.totalPlaytime)),
        high_score: Math.max(Number(existing?.high_score || 0), Math.floor(progress.highScore)),
        // total_coins is the player's current spendable balance. Keep it in sync with game_progress.
        total_coins: Math.max(0, Math.floor(progress.totalCoins)),
        game_progress: progress,
        last_updated: new Date().toISOString()
      }, { onConflict: 'username' })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error saving game progress:', error)
    return false
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


export async function fetchHighScoreLeaderboard(): Promise<Array<{ username: string; high_score: number; last_updated: string | null }>> {
  try {
    const { data, error } = await supabase
      .from('user_analytics')
      .select('username, high_score, last_updated')
      .order('high_score', { ascending: false })
      .order('username', { ascending: true })

    if (error) throw error

    return (data || []).map((user: any) => ({
      username: String(user.username || '').trim(),
      high_score: Math.max(0, Number(user.high_score || 0)),
      last_updated: user.last_updated || null,
    })).filter((user) => user.username)
  } catch (error) {
    console.error('Error fetching high score leaderboard:', error)
    return []
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
