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

  try {
    const { data, error } = await supabase.rpc('sync_account_metrics', {
      p_player_id: cleanPlayerId,
      p_username: cleanUsername,
      p_playtime_seconds: safePlaytime,
      p_high_score: safeHighScore,
      p_total_coins: safeCoins,
    })
    if (error) throw error
    if (data === false) console.error('Analytics account sync rejected')
  } catch (error) {
    console.error('Error syncing analytics:', error)
  }
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
    const { data, error } = await supabase.rpc('get_public_playtime_leaderboard_v2', { p_period: 'all', p_limit: 500 })
    if (error) throw error
    return { users: (data || []).map((u: any) => ({ player_id: String(u.player_id || ''), username: String(u.username || ''), playtime_seconds: Number(u.seconds || 0), is_me: Boolean(u.is_me) })), events: [] }
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return { users: [], events: [] }
  }
}


export async function fetchMyPlaytimeRank(playerId: string): Promise<{ rank: number; playtimeSeconds: number; totalPlayers: number } | null> {
  const cleanPlayerId = playerId.trim()
  if (!cleanPlayerId) return null

  try {
    const { data, error } = await supabase.rpc('get_my_playtime_rank_by_player_id', {
      p_player_id: cleanPlayerId,
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

export interface CloudAccountProgress extends CloudGameProgress {
  playerId: string
  username: string
}

export async function fetchUserGameProgress(playerId: string): Promise<CloudAccountProgress | null> {
  const cleanPlayerId = playerId.trim()
  if (!cleanPlayerId) return null

  try {
    const { data, error } = await supabase.rpc('get_game_account', {
      p_player_id: cleanPlayerId,
    })
    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== 'object' || !row.game_progress) return null

    const progress = row.game_progress as CloudGameProgress
    return {
      ...progress,
      playerId: String(row.player_id || cleanPlayerId),
      username: String(row.username || '').trim(),
      totalCoins: Math.max(
        Number(progress.totalCoins || 0),
        Number.isFinite(Number(row.total_coins)) ? Number(row.total_coins || 0) : 0
      ),
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
  const cleanPlayerId = playerId.trim()
  const cleanUsername = username.trim()
  if (!cleanPlayerId || !cleanUsername) return false

  try {
    const { data, error } = await supabase.rpc('save_game_account', {
      p_player_id: cleanPlayerId,
      p_username: cleanUsername,
      p_playtime_seconds: Math.max(0, Math.floor(progress.totalPlaytime)),
      p_high_score: Math.max(0, Math.floor(progress.highScore)),
      p_total_coins: Math.max(0, Math.floor(progress.totalCoins)),
      p_game_progress: progress,
    })
    if (error) throw error
    return data !== false
  } catch (error) {
    console.error('Error saving game progress:', error)
    return false
  }
}

export async function fetchUserHighScore(playerId: string): Promise<number | null> {
  const cleanPlayerId = playerId.trim()
  if (!cleanPlayerId) return null

  try {
    const { data, error } = await supabase.rpc('get_game_account', {
      p_player_id: cleanPlayerId,
    })
    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    return row ? Math.max(0, Number(row.high_score || 0)) : 0
  } catch (error) {
    console.error('Error fetching user high score:', error)
    return null
  }
}



export async function changeGameUsername(playerId: string, newUsername: string) {
  const cleanPlayerId = playerId.trim()
  const cleanUsername = newUsername.trim()
  if (!cleanPlayerId || !cleanUsername) return { success: false, username: '', remainingChanges: 0, message: 'Enter a valid username.' }
  try {
    const { data, error } = await supabase.rpc('change_game_username', {
      p_player_id: cleanPlayerId,
      p_new_username: cleanUsername,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      success: Boolean(row?.success),
      username: String(row?.username || ''),
      remainingChanges: Math.max(0, Number(row?.remaining_changes || 0)),
      message: String(row?.message || ''),
    }
  } catch (error) {
    console.error('Error changing username:', error)
    return { success: false, username: '', remainingChanges: 0, message: 'Unable to change username right now.' }
  }
}

export async function fetchHighScoreLeaderboard(playerId = ''): Promise<Array<{ username: string; high_score: number; is_me: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('get_public_high_score_leaderboard', {
      p_limit: 500,
      p_player_id: playerId.trim() || null,
    })
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


export async function fetchLeaderboardAnalytics(
  period: 'all'|'7d'|'30d'|'90d'|'180d'|'365d' = 'all',
  playerId = ''
) {
  try {
    const { data, error } = await supabase.rpc('get_public_playtime_leaderboard_v2', {
      p_period: period,
      p_limit: 500,
      p_player_id: playerId.trim() || null,
    })
    if (error) throw error
    return { users: (data || []).map((u: any) => ({
      player_id: String(u.player_id || ''),
      username: String(u.username || ''),
      playtime_seconds: Number(u.seconds || 0),
      is_me: Boolean(u.is_me)
    })), events: [] }
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return { users: [], events: [] }
  }
}
