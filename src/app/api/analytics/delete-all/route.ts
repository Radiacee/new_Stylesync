import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

/**
 * DELETE /api/analytics/delete-all
 * Delete all analytics entries (admin only)
 * 
 * Security: Should only be accessible to admin users
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    // Count total entries before deletion
    const { count: beforeCount, error: countError } = await supabase
      .from('paraphrase_analytics')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting analytics:', countError);
      return NextResponse.json(
        { error: 'Failed to count analytics entries' },
        { status: 500 }
      );
    }

    // Delete all entries
    const { error: deleteError } = await supabase
      .from('paraphrase_analytics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except non-existent ID

    if (deleteError) {
      console.error('Error deleting analytics:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete analytics entries', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Deleted all ${beforeCount || 0} analytics entries`);

    return NextResponse.json({
      success: true,
      deletedCount: beforeCount || 0,
      message: 'All analytics entries deleted successfully'
    });

  } catch (error) {
    console.error('Error in delete-all endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
