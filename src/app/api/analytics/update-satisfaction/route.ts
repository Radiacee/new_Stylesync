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
      verification_score,
      satisfaction
    } = body;

    // Validate required fields
    if (!userId || !satisfaction || typeof verification_score !== 'number') {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Find the most recent analytics entry for this user that was just created/submitted
    // This should be the paraphrase the user is currently viewing
    const { data: recentEntry, error: selectError } = await supabase
      .from('paraphrase_analytics')
      .select('id')
      .eq('user_id', userId)
      .eq('verification_score', verification_score)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentEntry && !selectError) {
      // Update the most recent entry with satisfaction
      const { error: updateError } = await supabase
        .from('paraphrase_analytics')
        .update({ satisfaction })
        .eq('id', recentEntry.id);

      if (updateError) {
        console.error('Database error updating satisfaction:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update satisfaction' 
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

