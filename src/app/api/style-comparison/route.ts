import { NextRequest, NextResponse } from 'next/server';
import { compareStyleTransformation } from '../../../lib/styleComparison';

export async function POST(request: NextRequest) {
  try {
    const { userSampleText, originalText, paraphrasedText } = await request.json();

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
