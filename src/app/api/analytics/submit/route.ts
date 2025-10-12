import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/submit
 * Submit analytics data for all paraphrase results
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const {
      userId,
      profileId,
      profileName,
      styleOptions,
      sampleExcerpt,
      verificationScore,
      inputLength,
      outputLength,
      consentGiven
    } = body;

    // Validate required fields
    if (!userId || !styleOptions || typeof verificationScore !== 'number') {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Check if user has already submitted analytics for this saved profile
    // Only ONE entry allowed per user per saved style profile (by profile_id)
    if (profileId) {
      const { data: existingEntry } = await supabase
        .from('paraphrase_analytics')
        .select('id, created_at, verification_score')
        .eq('user_id', userId)
        .eq('profile_id', profileId)
        .single();

      // If entry already exists for this profile, skip submission
      if (existingEntry) {
        console.log('Analytics already exists for this profile, skipping duplicate');
        return NextResponse.json({ 
          success: true,
          skipped: true,
          existingId: existingEntry.id,
          message: 'Analytics already recorded for this saved style profile'
        });
      }
    }

    // Insert new analytics data (first time for this style profile)
    const { data, error } = await supabase
      .from('paraphrase_analytics')
      .insert({
        user_id: userId,
        profile_id: profileId || null,
        profile_name: profileName || null,
        tone: styleOptions.tone,
        formality: styleOptions.formality,
        pacing: styleOptions.pacing,
        descriptiveness: styleOptions.descriptiveness,
        directness: styleOptions.directness,
        custom_lexicon: styleOptions.customLexicon || [],
        sample_excerpt: consentGiven ? sampleExcerpt : null,
        verification_score: verificationScore,
        input_length: inputLength,
        output_length: outputLength,
        consent_given: consentGiven,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to save analytics data' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      id: data.id,
      message: 'Analytics data submitted successfully' 
    });
  } catch (error) {
    console.error('Error submitting analytics:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
