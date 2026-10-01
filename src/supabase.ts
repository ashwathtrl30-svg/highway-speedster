import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iatfphxrhhaffgvtfrtu.supabase.co'
const supabaseAnonKey = 'sb_publishable_Wh5xFjsVYK8kkXgVwHpWbg_Io5b85cD'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

let authReadyPromise: Promise<boolean> | null = null

/**
 * The game has no visible sign-in screen, but analytics writes use Supabase's
 * authenticated role. Keep the player experience anonymous while still giving
 * each browser a Supabase Auth user/session for RLS-protected analytics.
 */
export async function ensureSupabaseAuth(): Promise<boolean> {
  if (authReadyPromise) return authReadyPromise

  authReadyPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (data.session?.user) return true

      const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously()
      if (signInError || !signInData.user) {
        throw signInError || new Error('Anonymous Supabase sign-in returned no user')
      }
      return true
    } catch (error) {
      console.error('Supabase anonymous auth unavailable; analytics will retry:', error)
      authReadyPromise = null
      return false
    }
  })()

  return authReadyPromise
}

export async function syncAnalyticsToSupabase(
  playerId: string, username: string, playtimeSeconds: number, highScore: number, totalCoins: number
) {
  const cleanPlayerId = playerId.trim()
  const cleanUsername = username.trim()
  const safePlaytime = Math.max(0, Math.floor(playtimeSeconds))
  const safeHighScore = Math.max(0, Math.floor(highScore))
  const safeCoins = Math.max(0, Math.floor(totalCoins))

  if (!cleanPlayerId || !cleanUsername) return
  if (!(await ensureSupabaseAuth())) return
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return

  // Analytics values are lossless at whole-second / whole-point precision.
  // A valid value of exactly 1 is written exactly as 1.
  const payload = {
    player_id: cleanPlayerId,
    auth_user_id: session.session.user.id,
    username: cleanUsername,
    playtime_seconds: safePlaytime,
    high_score: safeHighScore,
    total_coins: safeCoins,
    last_updated: new Date().toISOString(),
  }

  const { error } = await supabase.from('user_analytics').upsert(payload, { onConflict: 'player_id' })
  if (error) console.error('Error syncing analytics:', error)
}

export async function recordPlaytimeEvent(playerId: string, username: string, seconds: number) {
  const cleanPlayerId = playerId.trim()
  const cleanUsername = username.trim()
  const eventSeconds = Math.min(60, Math.floor(seconds))

  if (!cleanPlayerId || !cleanUsername || eventSeconds <= 0) return

  try {
    // Prefer an authenticated session when available. When anonymous sign-ins
    // are disabled, this still records to the public append-only analytics sink.
    const { data: sessionData } = await supabase.auth.getSession()
    const authUserId = sessionData.session?.user?.id ?? null

    const payload: {
      player_id: string
      username: string
      seconds: number
      auth_user_id?: string
    } = {
      player_id: cleanPlayerId,
      username: cleanUsername,
      seconds: eventSeconds,
    }

    if (authUserId) payload.auth_user_id = authUserId

    const { error } = await supabase.from('playtime_events').insert(payload)
    if (error) throw error
  } catch (error) {
    console.error('Error recording playtime event:', error)
  }
}



export async function fetchAllAnalytics() {
  try {
    const { data, error } = await supabase.rpc('get_public_playtime_leaderboard', { p_period: 'all', p_limit: 500 })
    if (error) throw error
    return { users: (data || []).map((u: any) => ({ username: String(u.username || ''), playtime_seconds: Number(u.seconds || 0), is_me: Boolean(u.is_me) })), events: [] }
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return { users: [], events: [] }
  }
}


export async function fetchMyPlaytimeRank(): Promise<{ rank: number; playtimeSeconds: number; totalPlayers: number } | null> {
  try {
    if (!(await ensureSupabaseAuth())) return null
    const { data, error } = await supabase.rpc('get_my_playtime_rank')
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
  bikeSkins: Record<string, any>
  carColors: Record<string, string>
  selectedCarColor: string
  totalCoins: number
  inventory: any
  vehicleMode: 'bike' | 'car'
  selectedBikeId: string
  selectedCarId: string
  selectedSkin: string
  totalPlaytime: number
  userPlaytime: Record<string, number>
  playtimeHistory: Array<{ date: string; seconds: number }>
}

export async function fetchUserGameProgress(playerId: string, username: string): Promise<CloudGameProgress | null> {
  if (!playerId.trim() || !username.trim()) return null
  try {
    if (!(await ensureSupabaseAuth())) return null
    const { data, error } = await supabase
      .from('user_analytics')
      .select('game_progress, total_coins')
      .eq('player_id', playerId.trim())
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
  playerId: string,
  username: string,
  progress: CloudGameProgress
): Promise<boolean> {
  if (!playerId.trim() || !username.trim()) return false
  try {
    if (!(await ensureSupabaseAuth())) return false
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return false
    const { data: existing, error: existingError } = await supabase
      .from('user_analytics')
      .select('high_score, playtime_seconds, total_coins')
      .eq('player_id', playerId.trim())
      .maybeSingle()

    if (existingError) throw existingError

    const { error } = await supabase
      .from('user_analytics')
      .upsert({
        player_id: playerId.trim(),
        auth_user_id: authData.user.id,
        username: username.trim(),
        ...(Math.max(Number(existing?.playtime_seconds || 0), Math.floor(progress.totalPlaytime)) !== 1
          ? { playtime_seconds: Math.max(Number(existing?.playtime_seconds || 0), Math.floor(progress.totalPlaytime)) }
          : {}),
        ...(Math.max(Number(existing?.high_score || 0), Math.floor(progress.highScore)) !== 1
          ? { high_score: Math.max(Number(existing?.high_score || 0), Math.floor(progress.highScore)) }
          : {}),
        // total_coins is the player's current spendable balance. Keep it in sync with game_progress.
        total_coins: Math.max(0, Math.floor(progress.totalCoins)),
        game_progress: progress,
        last_updated: new Date().toISOString()
      }, { onConflict: 'player_id' })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error saving game progress:', error)
    return false
  }
}

export async function fetchUserHighScore(playerId: string): Promise<number | null> {
  if (!playerId.trim()) return null
  try {
    if (!(await ensureSupabaseAuth())) return null
    const { data, error } = await supabase
      .from('user_analytics')
      .select('high_score')
      .eq('player_id', playerId)
      .maybeSingle()

    if (error) throw error
    return data ? Math.max(0, Number(data.high_score || 0)) : 0
  } catch (error) {
    console.error('Error fetching user high score:', error)
    return null
  }
}


export async function fetchHighScoreLeaderboard(): Promise<Array<{ username: string; high_score: number; is_me: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('get_public_high_score_leaderboard', { p_limit: 500 })
    if (error) throw error
    return (data || []).map((user: any) => ({
      username: String(user.username || '').trim(),
      high_score: Math.max(0, Number(user.high_score || 0)),
      is_me: Boolean(user.is_me)
    })).filter((user: any) => user.username)
  } catch (error) {
    console.error('Error fetching high score leaderboard:', error)
    return []
  }
}


export async function fetchLeaderboardAnalytics(period: 'all'|'7d'|'30d'|'90d'|'180d'|'365d' = 'all') {
  try {
    const { data, error } = await supabase.rpc('get_public_playtime_leaderboard', { p_period: period, p_limit: 500 })
    if (error) throw error
    return { users: (data || []).map((u: any) => ({
      username: String(u.username || ''),
      playtime_seconds: Number(u.seconds || 0),
      is_me: Boolean(u.is_me)
    })), events: [] }
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return { users: [], events: [] }
  }
}

