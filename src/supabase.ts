import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iatfphxrhhaffgvtfrtu.supabase.co'
const supabaseAnonKey = 'sb_publishable_Wh5xFjsVYK8kkXgVwHpWbg_Io5b85cD'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function syncAnalyticsToSupabase(
  playerId: string, username: string, playtimeSeconds: number, highScore: number, totalCoins: number
) {
  if (!playerId.trim() || !username.trim()) return
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return
  const { error } = await supabase.from('user_analytics').upsert({
    player_id: playerId, auth_user_id: session.session.user.id, username,
    playtime_seconds: Math.max(0, Math.floor(playtimeSeconds)),
    high_score: Math.max(0, Math.floor(highScore)),
    total_coins: Math.max(0, Math.floor(totalCoins)),
    last_updated: new Date().toISOString()
  }, { onConflict: 'player_id' })
  if (error) console.error('Error syncing analytics:', error)
}

export async function recordPlaytimeEvent(playerId: string, username: string, seconds: number) {
  if (!playerId.trim() || !username.trim() || seconds <= 0) return
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return
    const { error } = await supabase.from('playtime_events').insert({
      player_id: playerId,
      auth_user_id: authData.user.id,
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
    const { data, error } = await supabase.rpc('get_public_playtime_leaderboard', { p_period: 'all', p_limit: 500 })
    if (error) throw error
    return { users: data || [], events: [] }
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return { users: [], events: [] }
  }
}


export async function fetchMyPlaytimeRank(): Promise<{ rank: number; playtimeSeconds: number; totalPlayers: number } | null> {
  try {
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
        playtime_seconds: Math.max(Number(existing?.playtime_seconds || 0), Math.floor(progress.totalPlaytime)),
        high_score: Math.max(Number(existing?.high_score || 0), Math.floor(progress.highScore)),
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

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

function getAuthRedirectUrl() {
  // The production URL must also be present in Supabase Auth > URL Configuration.
  return window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`
}

async function ensureOAuthProviderEnabled(provider: 'google' | 'apple') {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    })
    if (!response.ok) return true
    const settings = await response.json()
    if (settings?.external && settings.external[provider] === false) {
      throw new Error(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not enabled in the game's Supabase authentication settings yet.`)
    }
  } catch (error: any) {
    // Keep the normal OAuth flow available when the settings endpoint is unavailable.
    if (error?.message?.includes('sign-in is not enabled')) throw error
  }
  return true
}

export async function loginWithGoogle() {
  await ensureOAuthProviderEnabled('google')
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getAuthRedirectUrl() },
  })
}

export async function loginWithApple() {
  await ensureOAuthProviderEnabled('apple')
  return supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: getAuthRedirectUrl() },
  })
}

export async function sendEmailLogin(email: string) {
  return supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: getAuthRedirectUrl() },
  })
}

export async function claimPlayerForAccount(playerId: string, username: string) {
  const { data, error } = await supabase.rpc('get_or_claim_player', {
    p_local_player_id: playerId,
    p_username: username
  })
  if (error) throw error
  return data
}

export function watchAuth(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}
