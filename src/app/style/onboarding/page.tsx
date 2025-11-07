"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { saveProfile, type StyleProfile, saveProfileRemote, upsertProfileLocal, setActiveProfileId, listProfiles } from '../../../lib/styleProfile.ts';
import { analyzeSampleStyle, type SampleStyle } from '../../../lib/paraphrase.ts';
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
  
  // Simple state
  const [profileName, setProfileName] = useState('');
  const [currentSample, setCurrentSample] = useState('');
  const [samples, setSamples] = useState<string[]>([]);
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

  // Add a sample
  function handleAddSample() {
    const wordCount = currentSample.trim().split(/\s+/).length;
    
    if (wordCount < 50) {
      alert(`Sample too short (${wordCount} words). Please provide at least 50 words.`);
      return;
    }
    
    if (wordCount > 500) {
      alert(`Sample too long (${wordCount} words). Please limit to 500 words per sample.`);
      return;
    }
    
    setSamples([...samples, currentSample.trim()]);
    setCurrentSample('');
    setAnalysis(null); // Reset analysis when adding new sample
  }

  // Remove a sample
  function handleRemoveSample(index: number) {
    setSamples(samples.filter((_, i) => i !== index));
    setAnalysis(null); // Reset analysis when removing sample
  }

  // Analyze all samples
  function handleAnalyze() {
    if (samples.length === 0) {
      alert('Please add at least one writing sample first.');
      return;
    }
    
    // Analyze all samples together
    const result = analyzeSampleStyle(samples);
    setAnalysis(result);
  }

  // Save the profile
  async function handleSave() {
    if (!profileName.trim()) {
      alert('Please provide a profile name.');
      return;
    }
    
    if (samples.length === 0) {
      alert('Please add at least one writing sample.');
      return;
    }
    
    if (!analysis) {
      alert('Please analyze your samples first.');
      return;
    }

    setBusy(true);
    
    try {
      // Create profile from analysis
      const now = Date.now();
      const combinedText = samples.join('\n\n');
      
      const newProfile: StyleProfile = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        name: profileName.trim(),
        tone: analysis.toneBalance === 'positive' ? 'encouraging' : 
              analysis.toneBalance === 'negative' ? 'critical' : 'balanced',
        
        // Calculate formality from analysis
        formality: analysis.usesContractions 
          ? 0.2 + (1 - analysis.vocabularyComplexity) * 0.3
          : 0.6 + (analysis.vocabularyComplexity * 0.3),
        
        // Calculate pacing from sentence length
        pacing: analysis.avgSentenceLength > 20 ? 0.3 :
                analysis.avgSentenceLength < 12 ? 0.7 : 0.5,
        
        // Descriptiveness from adjective density
        descriptiveness: Math.min(0.9, Math.max(0.1, analysis.adjectiveDensity * 6)),
        
        // Directness from personal voice and questions
        directness: analysis.personalVoice === 'second-person' ? 0.7 :
                   analysis.personalVoice === 'first-person' ? 0.6 : 0.5,
        
        sampleExcerpt: combinedText,
        sampleExcerpts: samples,
        customLexicon: [
          ...analysis.topAdverbs.slice(0, 3),
          ...analysis.preferredTransitions.slice(0, 2)
        ].slice(0, 8),
        notes: '',
        styleAnalysis: analysis
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

  const currentWordCount = currentSample.trim().split(/\s+/).length;
  const totalWords = samples.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0);
  const canAddSample = currentWordCount >= 50 && currentWordCount <= 500;
  const canAnalyze = samples.length > 0;
  const canSave = profileName.trim() && samples.length > 0 && analysis;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="glass-panel p-6 mb-6">
          <h1 className="text-3xl font-bold text-brand-300 mb-2">Create Your Writing Style</h1>
          <p className="text-slate-300">
            Add one or more samples of your writing (essays, articles, etc.) and we'll learn your style to paraphrase text just like you write.
          </p>
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

          {/* Saved Samples */}
          {samples.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white">
                  Your Samples ({samples.length}) • {totalWords} total words
                </label>
                {!analysis && (
                  <button 
                    onClick={handleAnalyze}
                    className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
                  >
                    Analyze All
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {samples.map((sample, index) => (
                  <div key={index} className="glass-panel p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-brand-300">
                        Sample {index + 1} • {sample.trim().split(/\s+/).length} words
                      </span>
                      <button
                        onClick={() => handleRemoveSample(index)}
                        className="text-xs text-slate-400 hover:text-red-400 transition px-2 py-1 rounded bg-slate-700 hover:bg-red-900/30"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{sample}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Sample */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white">
                {samples.length === 0 ? 'Add Your First Sample' : 'Add Another Sample (Optional)'}
              </label>
              <span className={`text-xs ${currentWordCount < 50 ? 'text-amber-400' : currentWordCount > 500 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {currentWordCount} words
                {currentWordCount < 50 && ' (need 50+)'}
                {currentWordCount > 500 && ' (max 500)'}
              </span>
            </div>
            <textarea 
              value={currentSample} 
              onChange={e => setCurrentSample(e.target.value)} 
              rows={8} 
              className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500" 
              placeholder="Paste your writing here... (50-500 words per sample)"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                💡 Tip: Add 2-3 different samples for better accuracy
              </p>
              <button 
                onClick={handleAddSample}
                disabled={!canAddSample}
                className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Sample
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

                <div className="grid grid-cols-2 gap-4 text-sm">
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
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Tone</p>
                    <p className="text-white font-medium">{analysis.toneBalance}</p>
                  </div>
                </div>

                {/* New metrics: lexical density & variety scores */}
                <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Lexical Density</p>
                    <p className="text-white font-medium">{typeof analysis.lexicalDensity === 'number' ? `${Math.round(analysis.lexicalDensity * 100)}%` : 'N/A'}</p>
                    <p className="text-xs text-slate-400">% content words vs function words</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Sentence Variety</p>
                    <p className="text-white font-medium">{typeof analysis.sentenceLengthVariety === 'number' ? `${analysis.sentenceLengthVariety.toFixed(1)} sd` : 'N/A'}</p>
                    <p className="text-xs text-slate-400">Std dev of words per sentence</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Paragraph Variety</p>
                    <p className="text-white font-medium">{typeof analysis.paragraphLengthVariety === 'number' ? `${analysis.paragraphLengthVariety.toFixed(1)} sd` : 'N/A'}</p>
                    <p className="text-xs text-slate-400">Std dev of words per paragraph</p>
                  </div>
                </div>

                {analysis.topAdverbs.length > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs mb-2">Common Words in Your Style</p>
                    <div className="flex flex-wrap gap-2">
                      {[...analysis.topAdverbs.slice(0, 3), ...analysis.preferredTransitions.slice(0, 2)].map((word, i) => (
                        <span key={i} className="px-2 py-1 bg-brand-500/20 text-brand-300 rounded text-xs">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Simple Style Explanation */}
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
                        ? "You use longer, more complex sentences." 
                        : analysis.avgSentenceLength < 12
                        ? "You use short, punchy sentences."
                        : "You balance short and longer sentences."
                    }
                  </p>
                  <p>
                    <span className="font-medium">Perspective:</span> {
                      analysis.personalVoice === 'first-person'
                        ? "You often use \"I\" and \"we\" (personal perspective)."
                        : analysis.personalVoice === 'second-person'
                        ? "You often address the reader as \"you\" (direct approach)."
                        : "You use a neutral, third-person perspective."
                    }
                  </p>
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
               samples.length === 0 ? '↑ Add at least one writing sample' :
               !analysis ? '↑ Analyze your samples first' : ''}
            </p>
          )}
        </div>
      </div>

      {busy && <FullScreenSpinner label="Saving your style profile..." />}
      {!authChecked && <FullScreenSpinner label="Checking authentication..." />}

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
                    <li>• Added contractions ("{analysis.usesContractions ? "it's, you're, can't" : "no contractions"}") to match your casual tone</li>
                  )}
                  {analysis.personalVoice === 'second-person' && (
                    <li>• Used "you" to match your direct, conversational approach</li>
                  )}
                  {analysis.personalVoice === 'first-person' && (
                    <li>• Incorporated personal perspective like in your writing</li>
                  )}
                  <li>• {
                    analysis.avgSentenceLength > 20 
                      ? "Made sentences longer and more detailed (like yours)" 
                      : analysis.avgSentenceLength < 12
                      ? "Shortened sentences to be punchy and direct (like yours)"
                      : "Balanced sentence lengths (like yours)"
                  }</li>
                  {!analysis.usesContractions && (
                    <li>• Kept formal language without contractions (matching your style)</li>
                  )}
                  {analysis.topAdverbs.length > 0 && (
                    <li>• Used words you commonly use: {analysis.topAdverbs.slice(0, 2).join(', ')}</li>
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
