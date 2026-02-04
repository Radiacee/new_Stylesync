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

    // Allow multiple entries per profile - each paraphrase is tracked separately
    // (Removed duplicate profile_id check to track every paraphrase)

    // Insert new analytics data (every paraphrase creates a new entry)
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
