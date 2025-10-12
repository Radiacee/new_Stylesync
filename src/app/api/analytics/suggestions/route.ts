import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/suggestions
 * Get public style suggestions based on high-performing analytics data
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch aggregated successful style combinations
    // Group by similar style options and get the highest performing ones
    const { data, error } = await supabase
      .from('paraphrase_analytics')
      .select('*')
      .gte('verification_score', 70) // Only show high-quality suggestions (70%+)
      .order('verification_score', { ascending: false })
      .limit(limit * 3); // Fetch more for deduplication

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch suggestions' 
      }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Group similar style profiles and aggregate metrics
    const grouped = new Map<string, any[]>();
    
    data.forEach(item => {
      // Create a key based on style parameters (rounded to nearest 0.1)
      const key = `${item.tone}_${Math.round(item.formality * 10)}_${Math.round(item.pacing * 10)}_${Math.round(item.descriptiveness * 10)}_${Math.round(item.directness * 10)}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    // Create suggestions from grouped data
    const suggestions = Array.from(grouped.entries())
      .map(([key, items]) => {
        const avgScore = items.reduce((sum, item) => sum + item.verification_score, 0) / items.length;
        const hasConsent = items.some(item => item.consent_given && item.sample_excerpt);
        const sampleItem = items.find(item => item.consent_given && item.sample_excerpt) || items[0];

        return {
          id: key,
          styleOptions: {
            tone: sampleItem.tone,
            formality: sampleItem.formality,
            pacing: sampleItem.pacing,
            descriptiveness: sampleItem.descriptiveness,
            directness: sampleItem.directness,
            customLexicon: sampleItem.custom_lexicon || []
          },
          sampleExcerpt: hasConsent ? sampleItem.sample_excerpt : undefined,
          verificationScore: Math.round(avgScore * 10) / 10,
          usageCount: items.length,
          averageScore: Math.round(avgScore * 10) / 10,
          createdAt: items[0].created_at,
          isPublic: true
        };
      })
      .sort((a, b) => {
        // Sort by average score first, then usage count
        const scoreDiff = b.averageScore - a.averageScore;
        return scoreDiff !== 0 ? scoreDiff : b.usageCount - a.usageCount;
      })
      .slice(0, limit);

    return NextResponse.json({ 
      suggestions,
      total: suggestions.length 
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
