import { NextRequest, NextResponse } from 'next/server';
import { compareStyleTransformation, calculateStructuredStyleSimilarity } from '../../../lib/styleComparison';

/**
 * POST /api/style-comparison
 * 
 * Supports both legacy and new structured style analysis formats.
 * 
 * Request body (legacy):
 * {
 *   userSampleText: string
 *   originalText: string
 *   paraphrasedText: string
 * }
 * 
 * Request body (new - with structured parameter):
 * {
 *   userSampleText: string
 *   originalText: string
 *   paraphrasedText: string
 *   structured: true
 * }
 * 
 * Response (legacy):
 * { transformation: StyleTransformation }
 * 
 * Response (new):
 * { structured: StructuredStyleComparison }
 */
export async function POST(request: NextRequest) {
  try {
    const { userSampleText, originalText, paraphrasedText, structured } = await request.json();

    if (!userSampleText || !originalText || !paraphrasedText) {
      return NextResponse.json(
        { error: 'Missing required parameters: userSampleText, originalText, paraphrasedText' }, 
        { status: 400 }
      );
    }

    console.log('Generating style comparison analysis...');
    console.log('User sample length:', userSampleText.length);
    console.log('Original text length:', originalText.length);
    console.log('Paraphrased text length:', paraphrasedText.length);
    console.log('Structured format:', structured === true);

    // If structured is true, return the new metric groups format
    if (structured === true) {
      console.log('Using new structured style comparison...');
      const structuredComparison = calculateStructuredStyleSimilarity(
        userSampleText,
        originalText,
        paraphrasedText
      );
      console.log('Structured comparison completed. Overall similarity:', structuredComparison.overallSimilarity);
      return NextResponse.json({ structured: structuredComparison });
    }

    // Otherwise, use legacy format for backward compatibility
    const transformation = compareStyleTransformation(
      userSampleText,
      originalText,
      paraphrasedText
    );

    console.log('Style comparison completed. Alignment score:', transformation.alignmentScore);

    return NextResponse.json({ transformation });

  } catch (error: any) {
    console.error('Style comparison error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze style transformation' }, 
      { status: 500 }
    );
  }
}
