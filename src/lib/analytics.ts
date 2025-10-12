/**
 * Analytics Service
 * Collects all paraphrase results for admin insights and user suggestions
 */

import { supabase } from './supabaseClient';
import type { StyleProfile } from './styleProfile';

export interface AnalyticsData {
  userId: string;
  profileId?: string; // Optional: ID of saved style profile for duplicate detection
  profileName?: string; // Optional: Name of saved style profile
  styleOptions: {
    tone: string;
    formality: number;
    pacing: number;
    descriptiveness: number;
    directness: number;
    customLexicon?: string[];
  };
  sampleExcerpt?: string; // Optional, requires user consent
  verificationScore: number;
  inputLength: number;
  outputLength: number;
  timestamp: string;
  consentGiven: boolean;
}

export interface AnalyticsSuggestion {
  id: string;
  styleOptions: {
    tone: string;
    formality: number;
    pacing: number;
    descriptiveness: number;
    directness: number;
    customLexicon?: string[];
  };
  sampleExcerpt?: string;
  verificationScore: number;
  usageCount: number;
  averageScore: number;
  createdAt: string;
  isPublic: boolean;
}

/**
 * Check if analytics should be collected
 */
export function shouldCollectAnalytics(verificationScore: number): boolean {
  return true; // Collect all results
}

/**
 * Prepare analytics data from paraphrase result
 */
export function prepareAnalyticsData(
  userId: string,
  profile: StyleProfile,
  verificationScore: number,
  inputLength: number,
  outputLength: number,
  consentGiven: boolean
): AnalyticsData {
  return {
    userId,
    profileId: profile.id, // Include profile ID for duplicate detection
    profileName: profile.name, // Include profile name for display
    styleOptions: {
      tone: profile.tone,
      formality: profile.formality,
      pacing: profile.pacing,
      descriptiveness: profile.descriptiveness,
      directness: profile.directness,
      customLexicon: profile.customLexicon.length > 0 ? profile.customLexicon : undefined
    },
    sampleExcerpt: consentGiven ? profile.sampleExcerpt : undefined,
    verificationScore,
    inputLength,
    outputLength,
    timestamp: new Date().toISOString(),
    consentGiven
  };
}

/**
 * Submit analytics data to the server
 */
export async function submitAnalytics(data: AnalyticsData): Promise<boolean> {
  try {
    const response = await fetch('/api/analytics/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.userId,
        profileId: data.profileId,
        profileName: data.profileName,
        styleOptions: data.styleOptions,
        sampleExcerpt: data.sampleExcerpt,
        verificationScore: data.verificationScore,
        inputLength: data.inputLength,
        outputLength: data.outputLength,
        consentGiven: data.consentGiven
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to submit analytics:', errorText);
      return false;
    }

    const result = await response.json();
    
    // Check if analytics was skipped (duplicate)
    if (result.skipped) {
      console.log('Analytics skipped - already recorded for this style profile');
      return true; // Still considered success (no error)
    }

    console.log('Analytics submitted successfully');
    return true;
  } catch (error) {
    console.error('Error submitting analytics:', error);
    return false;
  }
}

/**
 * Get user's consent status for analytics sharing
 */
export async function getUserConsent(userId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('analytics_consent')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return false;
    return data.analytics_consent || false;
  } catch (error) {
    console.error('Error getting user consent:', error);
    return false;
  }
}

/**
 * Update user's consent status for analytics sharing
 */
export async function updateUserConsent(userId: string, consent: boolean): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        analytics_consent: consent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    return !error;
  } catch (error) {
    console.error('Error updating user consent:', error);
    return false;
  }
}

/**
 * Fetch public style suggestions for users to try
 */
export async function getStyleSuggestions(limit: number = 10): Promise<AnalyticsSuggestion[]> {
  try {
    const response = await fetch(`/api/analytics/suggestions?limit=${limit}`);
    
    if (!response.ok) {
      console.error('Failed to fetch suggestions');
      return [];
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return [];
  }
}

/**
 * Calculate verification score from style verification metrics
 */
export function calculateVerificationScore(metrics: {
  sentenceStructureMatch?: number;
  vocabularyMatch?: number;
  toneMatch?: number;
  formalityMatch?: number;
  overallMatch?: number;
}): number {
  // Use overallMatch if available, otherwise calculate average
  if (metrics.overallMatch !== undefined) {
    return metrics.overallMatch * 100;
  }

  const scores = [
    metrics.sentenceStructureMatch,
    metrics.vocabularyMatch,
    metrics.toneMatch,
    metrics.formalityMatch
  ].filter((score): score is number => score !== undefined);

  if (scores.length === 0) return 0;

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return average * 100;
}
