import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hbmgujfjhboeasuibyxg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibWd1amZqaGJvZWFzdWlieXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1OTc5MjEsImV4cCI6MjEwNjE3MzkyMX0.k1gfOztV3YdE1wwZqfb8yy0kQZ0ZAsiynAH4AcxfC3A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Sync user analytics to Supabase
export async function syncAnalyticsToSupabase(
  username: string,
  playtimeSeconds: number,
  highScore: number,
  totalCoins: number
) {
  try {
    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('username', username)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError)
      return
    }

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('user_analytics')
        .update({
          playtime_seconds: playtimeSeconds,
          high_score: Math.max(existingUser.high_score, highScore),
          total_coins: totalCoins,
          last_updated: new Date().toISOString()
        })
        .eq('username', username)

      if (updateError) {
        console.error('Error updating user:', updateError)
      }
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('user_analytics')
        .insert({
          username,
          playtime_seconds: playtimeSeconds,
          high_score: highScore,
          total_coins: totalCoins,
          last_updated: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error inserting user:', insertError)
      }
    }
  } catch (error) {
    console.error('Error syncing analytics:', error)
  }
}

// Fetch all users analytics from Supabase
export async function fetchAllAnalytics() {
  try {
    const { data, error } = await supabase
      .from('user_analytics')
      .select('*')
      .order('playtime_seconds', { ascending: false })

    if (error) {
      console.error('Error fetching analytics:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return []
  }
}
