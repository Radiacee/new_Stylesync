import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/update-satisfaction
 * Update satisfaction feedback for the most recent analytics entry
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
      verification_score,
      rating // Changed from satisfaction
    } = body;

    // Validate required fields
    if (!userId || rating === undefined || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ 
        error: 'Missing or invalid required fields (rating must be 1-5)' 
      }, { status: 400 });
    }

    // Find the most recent analytics entry for this user.
    // Prefer matching profile and verification score if provided,
    // otherwise use the latest entry by user.
    let query = supabase
      .from('paraphrase_analytics')
      .select('id')
      .eq('user_id', userId);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    if (typeof verification_score === 'number' && verification_score > 0) {
      query = query.eq('verification_score', verification_score);
    }

    const { data: recentEntry, error: selectError } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (selectError) {
      console.error('Database error querying recent analytics entry:', selectError);
    }

    if (recentEntry && !selectError) {
      // Update the most recent entry with either the new rating field
      // or the legacy satisfaction field if rating is unavailable.
      let updateError = null;
      let fallbackSucceeded = false;

      const { error: ratingError } = await supabase
        .from('paraphrase_analytics')
        .update({ rating })
        .eq('id', recentEntry.id);

      if (!ratingError) {
        fallbackSucceeded = true;
      } else {
        const { error: satisfactionError } = await supabase
          .from('paraphrase_analytics')
          .update({ satisfaction: rating })
          .eq('id', recentEntry.id);

        if (!satisfactionError) {
          fallbackSucceeded = true;
        } else {
          updateError = satisfactionError;
        }
      }

      if (!fallbackSucceeded) {
        console.error('Database error updating satisfaction:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update satisfaction',
          details: updateError?.message || 'Unknown database error'
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        updated: true,
        id: recentEntry.id,
        message: 'Satisfaction feedback recorded' 
      });
    }

    return NextResponse.json({ 
      success: false,
      error: 'No recent analytics entry found to update' 
    }, { status: 404 });
  } catch (error) {
    console.error('Error updating satisfaction:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

