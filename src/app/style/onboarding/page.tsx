"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { saveProfile, type StyleProfile, saveProfileRemote, upsertProfileLocal, setActiveProfileId, listProfiles } from '../../../lib/styleProfile.ts';
import { analyzeSampleStyle, type SampleStyle } from '../../../lib/paraphrase.ts';
import { calculateLexicalDensity, calculateSentenceLengthVariety, calculateParagraphLengthVariety } from '../../../lib/deepStyleMatch.ts';
import { supabase } from '../../../lib/supabaseClient.ts';
import { FullScreenSpinner } from '../../../components/FullScreenSpinner';

export default function StyleOnboardingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  
  // Multi-essay state
  const [profileName, setProfileName] = useState('');
  const [essays, setEssays] = useState<string[]>(['']); // Start with one empty essay
  const [analysis, setAnalysis] = useState<SampleStyle | null>(null);
  const [busy, setBusy] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Check auth on mount
  useEffect(() => {
    (async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/sign-in');
          return;
        }
      } else {
        router.push('/auth/sign-in');
        return;
      }
      setAuthChecked(true);
    })();
  }, [router]);

  // Add a new essay slot
  function addEssay() {
    setEssays([...essays, '']);
    setAnalysis(null);
  }

  // Remove an essay by index
  function removeEssay(index: number) {
    if (essays.length <= 1) return;
    setEssays(essays.filter((_, i) => i !== index));
    setAnalysis(null);
  }

  // Update essay at index
  function updateEssay(index: number, value: string) {
    const updated = [...essays];
    updated[index] = value;
    setEssays(updated);
    setAnalysis(null);
  }

  // Get non-empty essays
  function getValidEssays() {
    return essays.filter(e => e.trim().length > 0);
  }

  // Analyze all essays
  function handleAnalyze() {
    const valid = getValidEssays();
    if (valid.length === 0) {
      alert('Please paste at least one essay sample.');
      return;
    }
    // Join all essays for analysis
    const result = analyzeSampleStyle(valid.join('\n\n'));
    setAnalysis(result);
  }

  // Save the profile
  async function handleSave() {
    if (!profileName.trim()) {
      alert('Please provide a profile name.');
      return;
    }
    
    const validEssays = getValidEssays();
    if (validEssays.length === 0) {
      alert('Please paste at least one writing sample before saving.');
      return;
    }

    // Ensure we have analysis (analyze automatically if missing)
    let finalAnalysis = analysis;
    if (!finalAnalysis) {
      finalAnalysis = analyzeSampleStyle(validEssays.join('\n\n'));
      setAnalysis(finalAnalysis);
    }

    setBusy(true);
    
    try {
      // Create profile from COMPLETE analysis
      const now = Date.now();
      const combinedText = validEssays.join('\n\n');
      const a = finalAnalysis!;

      // --- Derive tone accurately from analysis ---
      const formalMarkerCount = (combinedText.match(/\b(therefore|consequently|furthermore|nevertheless|subsequently|thus|hence|regarding|pertaining|aforementioned)\b/gi) || []).length;
      const casualMarkerCount = (combinedText.match(/\b(gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|cool|awesome|stuff|things)\b/gi) || []).length;
      let tone = 'balanced';
      if (a.usesContractions && casualMarkerCount > formalMarkerCount + 1) tone = 'casual';
      else if (!a.usesContractions && formalMarkerCount > casualMarkerCount + 1) tone = 'formal';
      else if (a.usesContractions) tone = 'conversational';
      else tone = 'neutral';

      // --- Derive formality on a nuanced 0-1 scale ---
      // Base: contractions = casual, no contractions = formal
      let formality = a.usesContractions ? 0.3 : 0.7;
      // Adjust for vocabulary complexity
      if ((a.vocabularyComplexity ?? 0) > 0.25) formality = Math.min(1, formality + 0.15);
      else if ((a.vocabularyComplexity ?? 0) < 0.1) formality = Math.max(0, formality - 0.1);
      // Adjust for formal/casual markers
      if (formalMarkerCount > 3) formality = Math.min(1, formality + 0.1);
      if (casualMarkerCount > 3) formality = Math.max(0, formality - 0.1);
      formality = Math.round(formality * 100) / 100;

      // --- Derive pacing from sentence length (0=slow/long, 1=fast/short) ---
      const avgLen = a.avgSentenceLength;
      const pacing = avgLen > 25 ? 0.15 : avgLen > 20 ? 0.3 : avgLen > 15 ? 0.5 : avgLen > 10 ? 0.7 : 0.85;

      // --- Derive descriptiveness from vocabulary complexity + adjective density ---
      const vocabFactor = Math.min(1, (a.vocabularyComplexity ?? 0) * 3);
      const adjFactor = Math.min(1, (a.adjectiveDensity ?? 0) * 8);
      const descriptiveness = Math.round(Math.min(1, Math.max(0.1, (vocabFactor * 0.6 + adjFactor * 0.4))) * 100) / 100;

      // --- Derive directness from voice, questions, sentence length ---
      let directness = 0.5;
      if (a.personalVoice === 'second-person') directness = 0.75;
      else if (a.personalVoice === 'first-person') directness = 0.65;
      if ((a.questionRatio ?? 0) > 0.1) directness = Math.min(1, directness + 0.1);
      if (avgLen < 12) directness = Math.min(1, directness + 0.1);
      directness = Math.round(directness * 100) / 100;

      // --- Build comprehensive customLexicon from signature words ---
      const lexicon = [
        ...(a.highFrequencyWords || []).slice(0, 5),
        ...(a.topAdverbs || []).slice(0, 3),
        ...(a.preferredTransitions || []).slice(0, 2)
      ];
      // Deduplicate
      const uniqueLexicon = [...new Set(lexicon)].slice(0, 10);

      // --- Calculate deep style metrics ---
      const lexicalDensity = calculateLexicalDensity(combinedText);
      const sentenceLengthVariety = calculateSentenceLengthVariety(combinedText);
      const paragraphLengthVariety = calculateParagraphLengthVariety(combinedText);

      const newProfile: StyleProfile = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        name: profileName.trim(),
        tone,
        formality,
        pacing,
        descriptiveness,
        directness,
        sampleExcerpt: combinedText,
        sampleExcerpts: validEssays,
        customLexicon: uniqueLexicon,
        notes: '',
        styleAnalysis: a,
        lexicalDensity,
        sentenceLengthVariety,
        paragraphLengthVariety,
      };

      // Ensure unique ID
      const existingProfiles = listProfiles();
      let finalId = newProfile.id;
      while (existingProfiles.some(p => p.id === finalId)) {
        finalId = crypto.randomUUID();
      }
      const finalProfile = { ...newProfile, id: finalId };

      // Save locally
      saveProfile(finalProfile);
      upsertProfileLocal(finalProfile);
      setActiveProfileId(finalProfile.id);

      // Save remotely if authenticated
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            await saveProfileRemote({ ...finalProfile, userId: user.id });
          } catch (e) {
            console.error('Remote save failed:', e);
            // Continue anyway - local save succeeded
          }
        }
      }

      // Success! Redirect to paraphrase page
      setTimeout(() => router.push('/paraphrase'), 500);
      
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const validEssays = getValidEssays();
  const totalWords = validEssays.reduce((sum, e) => sum + e.trim().split(/\s+/).filter(Boolean).length, 0);
  const canAnalyze = validEssays.length > 0;
  const canSave = profileName.trim() && analysis;

  // Show loading spinner until auth is checked
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FullScreenSpinner label="Checking authentication..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="glass-panel p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-brand-300 mb-2">Create Your Writing Style</h1>
              <p className="text-slate-300">
                Add one or more samples of your writing (essays, articles, etc.) and we'll learn your style to paraphrase text just like you write.
              </p>
            </div>
            <Link
              href="/writing-guide"
              className="flex-shrink-0 ml-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all duration-200 group"
              title="Writing Guide - Learn to improve your writing"
            >
              <Lightbulb className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Main Form */}
        <div className="glass-panel p-6 space-y-6">
          {/* Profile Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Profile Name</label>
            <input 
              type="text"
              value={profileName} 
              onChange={e => setProfileName(e.target.value)} 
              className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" 
              placeholder="e.g., My Academic Style, Casual Blog Style" 
            />
          </div>

          {/* Multi-Essay Interface */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white">Your Writing Samples</label>
              <span className={`text-xs ${totalWords < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {validEssays.length} essay{validEssays.length !== 1 ? 's' : ''} · {totalWords} words total
              </span>
            </div>

            {/* Essay Cards */}
            <div className="space-y-3">
              {essays.map((essay, index) => {
                const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
                return (
                  <div key={index} className="bg-slate-800/40 rounded-xl border border-white/10 overflow-hidden">
                    {/* Essay Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/60 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-300">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium text-white">Essay {index + 1}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${wordCount > 0 ? 'text-slate-400' : 'text-slate-500'}`}>
                          {wordCount} words
                        </span>
                        {essays.length > 1 && (
                          <button
                            onClick={() => removeEssay(index)}
                            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                            title="Remove this essay"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Essay Textarea */}
                    <textarea
                      value={essay}
                      onChange={e => updateEssay(index, e.target.value)}
                      rows={6}
                      className="w-full bg-transparent px-4 py-3 text-sm leading-relaxed focus:outline-none resize-none text-slate-200 placeholder-slate-500"
                      placeholder="Paste your essay or writing sample here..."
                    />
                  </div>
                );
              })}
            </div>

            {/* Add New Essay Button */}
            <button
              onClick={addEssay}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-700 hover:border-brand-500/50 hover:bg-brand-500/5 text-slate-400 hover:text-brand-300 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Another Essay
            </button>

            {/* Tips and Analyze Button */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">💡 Tip: Add 2-3 essays for the best style matching</p>
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Analyze Style
              </button>
            </div>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="space-y-4">
              <div className="bg-slate-800/30 rounded-lg p-6 space-y-4 border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-lg">✓</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Style Detected!</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Formality</p>
                    <p className="text-white font-medium">
                      {analysis.usesContractions ? 'Casual' : 'Formal'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Sentence Length</p>
                    <p className="text-white font-medium">{Math.round(analysis.avgSentenceLength)} words avg</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Voice</p>
                    <p className="text-white font-medium">{analysis.personalVoice}</p>
                  </div>
                  {(analysis.vocabularyComplexity ?? 0) > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Vocabulary</p>
                      <p className="text-white font-medium">
                        {(analysis.vocabularyComplexity ?? 0) > 0.25 ? 'Advanced' : (analysis.vocabularyComplexity ?? 0) < 0.1 ? 'Simple' : 'Moderate'}
                      </p>
                    </div>
                  )}
                  {(analysis.questionRatio ?? 0) > 0.05 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Questions</p>
                      <p className="text-white font-medium">{Math.round((analysis.questionRatio ?? 0) * 100)}% of sentences</p>
                    </div>
                  )}
                  {(analysis.commaPerSentence ?? 0) > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Comma Usage</p>
                      <p className="text-white font-medium">{(analysis.commaPerSentence ?? 0).toFixed(1)} per sentence</p>
                    </div>
                  )}
                </div>

                {/* Signature words: high-frequency words + adverbs + transitions */}
                {((analysis.highFrequencyWords?.length ?? 0) > 0 || (analysis.topAdverbs?.length ?? 0) > 0 || analysis.preferredTransitions.length > 0) && (
                  <div>
                    <p className="text-slate-400 text-xs mb-2">Your Signature Words</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ...(analysis.highFrequencyWords || []).slice(0, 5),
                        ...(analysis.topAdverbs || []).slice(0, 3),
                        ...analysis.preferredTransitions.slice(0, 2)
                      ].filter((w, i, arr) => arr.indexOf(w) === i).map((word, i) => (
                        <span key={i} className="px-2 py-1 bg-brand-500/20 text-brand-300 rounded text-xs">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Style Explanation */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-blue-300">📊 What This Means</h4>
                <div className="text-xs text-blue-200 space-y-2">
                  <p>
                    <span className="font-medium">Your writing style:</span> {
                      analysis.usesContractions 
                        ? "You write casually with contractions (like \"it's\" and \"don't\")." 
                        : "You write formally without contractions."
                    }
                  </p>
                  <p>
                    <span className="font-medium">Sentence structure:</span> {
                      analysis.avgSentenceLength > 20 
                        ? `You use longer, more complex sentences (~${Math.round(analysis.avgSentenceLength)} words each).` 
                        : analysis.avgSentenceLength < 12
                        ? `You use short, punchy sentences (~${Math.round(analysis.avgSentenceLength)} words each).`
                        : `You balance short and longer sentences (~${Math.round(analysis.avgSentenceLength)} words avg).`
                    }
                  </p>
                  {(analysis.vocabularyComplexity ?? 0) > 0 && (
                    <p>
                      <span className="font-medium">Vocabulary:</span> {
                        (analysis.vocabularyComplexity ?? 0) > 0.25
                          ? "You use sophisticated, complex vocabulary."
                          : (analysis.vocabularyComplexity ?? 0) < 0.1
                          ? "You prefer clear, simple language."
                          : "You use a balanced mix of common and advanced words."
                      }
                    </p>
                  )}
                  {analysis.personalVoice !== 'third-person' && (
                    <p>
                      <span className="font-medium">Voice:</span> {
                        analysis.personalVoice === 'first-person'
                          ? "You write with a personal touch using \"I\" and \"we\"."
                          : "You address the reader directly using \"you\"."
                      }
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowComparison(true)}
                  className="w-full mt-2 px-3 py-2 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
                >
                  Show Example: Before vs After
                </button>
              </div>
            </div>
          )}

          {/* Save Button */}
          <button 
            onClick={handleSave}
            disabled={!canSave || busy}
            className="w-full px-4 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving...' : 'Create Profile & Start Paraphrasing'}
          </button>

          {!canSave && (
            <p className="text-xs text-center text-amber-400">
              {!profileName.trim() ? '↑ Enter a profile name' :
               validEssays.length === 0 ? '↑ Add at least one writing sample' :
               !analysis ? '↑ Analyze your samples first' : ''}
            </p>
          )}
        </div>
      </div>

      {busy && <FullScreenSpinner label="Saving your style profile..." />}

      {/* Before/After Comparison Modal */}
      {showComparison && analysis && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-white/10 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">See Your Style in Action</h3>
                <button 
                  onClick={() => setShowComparison(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-slate-300">
                Here's how the same text looks <strong>before</strong> and <strong>after</strong> applying your style:
              </p>

              {/* Example Text */}
              <div className="space-y-4">
                {/* Before */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">1</div>
                    <h4 className="text-sm font-semibold text-slate-300">Generic Text (Before)</h4>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      The implementation of artificial intelligence in modern business practices has become increasingly prevalent. Organizations are discovering that it is essential to adapt to technological changes. The adoption of AI can help to improve efficiency and reduce operational costs significantly.
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="text-brand-400 text-2xl">↓</div>
                </div>

                {/* After */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-slate-900">2</div>
                    <h4 className="text-sm font-semibold text-brand-300">Your Style (After)</h4>
                  </div>
                  <div className="bg-brand-500/10 rounded-lg p-4 border border-brand-500/30">
                    <p className="text-sm text-white leading-relaxed">
                      {analysis.usesContractions && analysis.personalVoice === 'second-person' ? (
                        // Casual, direct style
                        <>You're seeing AI pop up everywhere in business these days, right? It's pretty clear companies need to keep up with tech changes. The good news? AI can boost your efficiency and cut costs big time.</>
                      ) : analysis.usesContractions ? (
                        // Casual style
                        <>AI's becoming a big deal in modern business. Companies are finding it's crucial to adapt to tech changes. Adopting AI can really help improve efficiency and cut operational costs.</>
                      ) : analysis.avgSentenceLength > 20 ? (
                        // Formal, complex style
                        <>The integration of artificial intelligence into contemporary business operations has demonstrated considerable growth, with organizations recognizing the imperative nature of technological adaptation. Through the strategic implementation of AI systems, enterprises can achieve substantial improvements in operational efficiency while simultaneously reducing associated costs.</>
                      ) : (
                        // Formal, concise style
                        <>Artificial intelligence has transformed modern business practices. Organizations must adapt to technological advances. AI adoption improves efficiency and reduces operational costs substantially.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-300 mb-2">✨ What Changed?</h4>
                <ul className="text-xs text-blue-200 space-y-1.5">
                  {analysis.usesContractions && (
                    <li>• Added contractions ("it's, you're, can't") to match your casual tone</li>
                  )}
                  {!analysis.usesContractions && (
                    <li>• Kept formal language without contractions (matching your style)</li>
                  )}
                  {analysis.personalVoice === 'second-person' && (
                    <li>• Used "you" to match your direct, conversational approach</li>
                  )}
                  {analysis.personalVoice === 'first-person' && (
                    <li>• Used personal voice ("I", "we") to match your writing perspective</li>
                  )}
                  <li>• {
                    analysis.avgSentenceLength > 20 
                      ? `Made sentences longer and more complex (~${Math.round(analysis.avgSentenceLength)} words, like yours)` 
                      : analysis.avgSentenceLength < 12
                      ? `Shortened sentences to be punchy and direct (~${Math.round(analysis.avgSentenceLength)} words, like yours)`
                      : `Balanced sentence lengths (~${Math.round(analysis.avgSentenceLength)} words avg, like yours)`
                  }</li>
                  {(analysis.vocabularyComplexity ?? 0) > 0.25 && (
                    <li>• Matched your sophisticated vocabulary level</li>
                  )}
                  {(analysis.vocabularyComplexity ?? 0) < 0.1 && (analysis.vocabularyComplexity ?? 0) > 0 && (
                    <li>• Used simple, clear language (like yours)</li>
                  )}
                  {analysis.highFrequencyWords && analysis.highFrequencyWords.length > 0 && (
                    <li>• Incorporated your signature words: {analysis.highFrequencyWords.slice(0, 3).join(', ')}</li>
                  )}
                  {analysis.topAdverbs && analysis.topAdverbs.length > 0 && (
                    <li>• Used adverbs you commonly use: {analysis.topAdverbs.slice(0, 2).join(', ')}</li>
                  )}
                  {analysis.preferredTransitions.length > 0 && (
                    <li>• Added your preferred transition words: {analysis.preferredTransitions.slice(0, 2).join(', ')}</li>
                  )}
                </ul>
              </div>

              <button 
                onClick={() => setShowComparison(false)}
                className="w-full px-4 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition"
              >
                Got it! This looks like my style
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
