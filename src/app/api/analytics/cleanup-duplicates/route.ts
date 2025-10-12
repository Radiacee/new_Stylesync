import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/cleanup-duplicates
 * Remove duplicate analytics entries (admin only)
 * Keeps ONLY the FIRST entry for each unique combination of user + profile_id
 * Falls back to style settings for entries without profile_id
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Fetch all analytics entries
    const { data: allEntries, error: fetchError } = await supabase
      .from('paraphrase_analytics')
      .select('*')
      .order('created_at', { ascending: true }); // Oldest first

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch analytics data' 
      }, { status: 500 });
    }

    if (!allEntries || allEntries.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No analytics data to clean up',
        duplicatesRemoved: 0
      });
    }

    // Group entries by user_id + profile_id (or style settings if no profile_id)
    // Keep track of first entry for each unique combination
    const seen = new Map<string, string>(); // key -> first entry ID
    const idsToDelete: string[] = [];

    for (const entry of allEntries) {
      // Create a unique key based on user and profile (prefer profile_id, fall back to style settings)
      let key: string;
      if (entry.profile_id) {
        // Use profile_id for saved profiles (primary method)
        key = `${entry.user_id}|profile:${entry.profile_id}`;
      } else {
        // Fall back to style settings for on-the-fly styles
        key = `${entry.user_id}|style:${entry.tone}|${entry.formality}|${entry.pacing}|${entry.descriptiveness}|${entry.directness}`;
      }
      
      if (seen.has(key)) {
        // This is a duplicate - mark for deletion
        idsToDelete.push(entry.id);
      } else {
        // This is the first entry for this combination - keep it
        seen.set(key, entry.id);
      }
    }

    // Delete duplicates
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('paraphrase_analytics')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json({ 
          error: 'Failed to delete duplicates' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully cleaned up ${idsToDelete.length} duplicate entries`,
      duplicatesRemoved: idsToDelete.length,
      totalEntries: allEntries.length,
      remainingEntries: allEntries.length - idsToDelete.length,
      uniqueProfiles: seen.size
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
