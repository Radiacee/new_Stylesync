"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadProfile, saveProfile, type StyleProfile, loadProfileRemote, saveProfileRemote, styleProfilesTableExists, upsertProfileLocal, setActiveProfileId, listProfiles } from '../../../lib/styleProfile.ts';
import { analyzeSampleStyle, type SampleStyle } from '../../../lib/paraphrase.ts';
import { supabase } from '../../../lib/supabaseClient.ts';
import { FullScreenSpinner } from '../../../components/FullScreenSpinner';
import StyleOptionsHelp from '../../../components/StyleOptionsHelp';

const initial: StyleProfile = {
  id: 'local',
  createdAt: 0,
  updatedAt: 0,
  name: 'Default Style',
  tone: 'balanced',
  formality: 0.5,
  pacing: 0.5,
  descriptiveness: 0.5,
  directness: 0.5,
  sampleExcerpt: '',
  customLexicon: [],
  notes: ''
};

export default function StyleOnboardingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile>(initial);
  const [saved, setSaved] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<'idle'|'saving'|'ok'|'error'|'missing'>('idle');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remoteTableMissing, setRemoteTableMissing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SampleStyle | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [hasAppliedAnalysis, setHasAppliedAnalysis] = useState(false);
  const [showAppliedChanges, setShowAppliedChanges] = useState(false);
  const [appliedChanges, setAppliedChanges] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    { number: 1, name: 'Basic Info', description: 'Profile name and tone' },
    { number: 2, name: 'Sample Text', description: 'Analyze your writing' },
    { number: 3, name: 'Style Parameters', description: 'Fine-tune settings' },
    { number: 4, name: 'Review & Save', description: 'Complete your profile' }
  ];

  useEffect(() => {
    // Check authentication first
    (async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/sign-in');
          return;
        }
      } else {
        // No supabase - redirect to sign in
        router.push('/auth/sign-in');
        return;
      }
      setAuthChecked(true);
    })();

    // Always create a fresh blank profile for the onboarding page
    const now = Date.now();
    const blank: StyleProfile = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      name: '',
      tone: 'balanced',
      formality: 0.5,
      pacing: 0.5,
      descriptiveness: 0.5,
      directness: 0.5,
      sampleExcerpt: '',
      customLexicon: [],
      notes: ''
    };
    setProfile(blank);
    // Reset all analysis states
    setHasAnalyzed(false);
    setHasAppliedAnalysis(false);
    setAnalysisResult(null);
    setShowAnalysis(false);
    setShowAppliedChanges(false);
    setCurrentStep(1);
  }, [search, router]);

  function update<K extends keyof StyleProfile>(key: K, value: StyleProfile[K]) {
    setProfile(p => ({ ...p, [key]: value, updatedAt: Date.now(), createdAt: p.createdAt || Date.now() }));
    setSaved(false);
    
    // Reset analysis states when sample text changes
    if (key === 'sampleExcerpt') {
      setHasAnalyzed(false);
      setHasAppliedAnalysis(false);
      setAnalysisResult(null);
    }
  }

  function clearCustomLexicon() {
    setProfile(p => ({ ...p, customLexicon: [], updatedAt: Date.now() }));
    setSaved(false);
  }

  function canGoToNextStep() {
    switch (currentStep) {
      case 1:
        return profile.name?.trim() && profile.tone?.trim();
      case 2:
        return hasAnalyzed && hasAppliedAnalysis;
      case 3:
        return true; // Parameters are optional
      case 4:
        return canCreateProfile().canCreate;
      default:
        return false;
    }
  }

  function handleNext() {
    if (canGoToNextStep() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function isAnalysisRequired() {
    const text = profile.sampleExcerpt.trim();
    if (!text) return { required: false, reason: 'No sample text provided' };
    
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 150) {
      return { required: true, reason: `Sample text too short (${wordCount} words). Please provide at least 150 words for accurate analysis.` };
    }
    if (wordCount > 400) {
      return { required: true, reason: `Sample text too long (${wordCount} words). Please limit to 400 words for optimal analysis.` };
    }
    
    return { required: false, reason: '' };
  }

  function canCreateProfile() {
    const analysis = isAnalysisRequired();
    if (analysis.required) return { canCreate: false, reason: analysis.reason };
    if (!hasAnalyzed) return { canCreate: false, reason: 'Please analyze your sample text first.' };
    if (!hasAppliedAnalysis) return { canCreate: false, reason: 'Please apply the analysis results to your profile.' };
    if (!profile.name?.trim()) return { canCreate: false, reason: 'Please provide a profile name.' };
    
    return { canCreate: true, reason: '' };
  }

  function handleAnalyze() {
    if (!profile.sampleExcerpt.trim()) {
      alert('Please enter some sample text to analyze.');
      return;
    }
    
    const analysis = analyzeSampleStyle(profile.sampleExcerpt);
    setAnalysisResult(analysis);
    setShowAnalysis(true);
    setHasAnalyzed(true);
    // Reset applied status when new analysis is performed
    setHasAppliedAnalysis(false);
  }

  function handleApplyAnalysis() {
    if (!analysisResult) return;
    
    // Apply insights from analysis to the profile - calculate directly from analysis, not from current profile
    const updates: Partial<StyleProfile> = {};
    
    // ALWAYS start with empty customLexicon to ensure clean slate
    updates.customLexicon = [];
    
    // Set formality based on contractions usage and vocabulary complexity
    if (analysisResult.usesContractions) {
      // More casual - combine contractions with vocabulary complexity
      const casualScore = 0.2 + (1 - analysisResult.vocabularyComplexity) * 0.3;
      updates.formality = Math.max(0.1, Math.min(0.4, casualScore));
    } else {
      // More formal - use vocabulary complexity and average word length
      const formalScore = 0.5 + (analysisResult.vocabularyComplexity * 0.3) + ((analysisResult.avgWordLength - 4) * 0.05);
      updates.formality = Math.min(0.9, Math.max(0.6, formalScore));
    }
    
    // Set descriptiveness directly from adjective density (scale it appropriately)
    const descriptiveScore = Math.min(0.9, Math.max(0.1, analysisResult.adjectiveDensity * 6));
    updates.descriptiveness = descriptiveScore;
    
    // Set pacing based on sentence length and conjunction density
    const avgLength = analysisResult.avgSentenceLength;
    const conjunctionFactor = Math.min(0.3, analysisResult.conjunctionDensity * 0.2);
    
    if (avgLength > 20) {
      // Longer sentences = slower pacing
      const lengthFactor = Math.min(0.4, (avgLength - 15) * 0.02);
      updates.pacing = Math.max(0.1, 0.3 - lengthFactor + conjunctionFactor);
    } else if (avgLength < 12) {
      // Shorter sentences = faster pacing
      const lengthFactor = Math.min(0.5, (15 - avgLength) * 0.04);
      updates.pacing = Math.min(0.9, 0.4 + lengthFactor - conjunctionFactor);
    } else {
      // Average length = balanced pacing with conjunction influence
      updates.pacing = 0.5 + conjunctionFactor;
    }
    
    // Set directness based on question ratio, personal voice, and sentence complexity
    let directnessScore = 0.5; // Start with neutral
    
    // Questions and second-person = more direct
    if (analysisResult.questionRatio > 0.1) {
      directnessScore += analysisResult.questionRatio * 3; // Questions boost directness
    }
    
    if (analysisResult.personalVoice === 'second-person') {
      directnessScore += 0.2; // "You" voice is more direct
    } else if (analysisResult.personalVoice === 'first-person') {
      directnessScore += 0.1; // "I" voice is somewhat direct
    } else if (analysisResult.personalVoice === 'third-person') {
      directnessScore -= 0.1; // Third-person is less direct
    }
    
    // Complex sentences reduce directness
    if (analysisResult.avgSentenceLength > 18) {
      directnessScore -= (analysisResult.avgSentenceLength - 18) * 0.02;
    }
    
    updates.directness = Math.max(0.1, Math.min(0.9, directnessScore));
    
    // Update tone based on analysis - be more specific
    if (analysisResult.toneBalance === 'positive') {
      updates.tone = 'encouraging';
    } else if (analysisResult.toneBalance === 'negative') {
      updates.tone = 'critical';
    } else {
      updates.tone = 'balanced'; // Default for neutral
    }
    
    // Add preferred adverbs and transitions to custom lexicon but start fresh
    const newLexicon: string[] = [];
    
    // Add top adverbs if they're not too common
    if (analysisResult.topAdverbs && analysisResult.topAdverbs.length > 0) {
      const commonAdverbs = ['really', 'very', 'quite', 'pretty', 'fairly', 'just', 'only', 'even', 'still', 'already'];
      const uniqueAdverbs = analysisResult.topAdverbs
        .filter(adv => !commonAdverbs.includes(adv.toLowerCase()))
        .slice(0, 3); // Limit to top 3
      newLexicon.push(...uniqueAdverbs);
    }
    
    // Add preferred transitions if they exist
    if (analysisResult.preferredTransitions && analysisResult.preferredTransitions.length > 0) {
      const transitions = analysisResult.preferredTransitions.slice(0, 2); // Limit to top 2
      newLexicon.push(...transitions);
    }
    
    // Set the new lexicon (limit total to 8 items for manageability)
    updates.customLexicon = newLexicon.slice(0, 8);
    
    // Apply all updates at once
    setProfile(p => ({ 
      ...p, 
      ...updates, 
      styleAnalysis: analysisResult, // Store the analysis for future reference
      updatedAt: Date.now() 
    }));
    
    setSaved(false);
    setShowAnalysis(false);
    setHasAppliedAnalysis(true);
    
    // Show success popup with details instead of alert
    const changesApplied = [];
    if (updates.tone) changesApplied.push(`Tone: ${updates.tone}`);
    if (updates.formality !== undefined) changesApplied.push(`Formality: ${Math.round(updates.formality * 100)}%`);
    if (updates.descriptiveness !== undefined) changesApplied.push(`Descriptiveness: ${Math.round(updates.descriptiveness * 100)}%`);
    if (updates.pacing !== undefined) changesApplied.push(`Pacing: ${Math.round(updates.pacing * 100)}%`);
    if (updates.directness !== undefined) changesApplied.push(`Directness: ${Math.round(updates.directness * 100)}%`);
    if (updates.customLexicon && updates.customLexicon.length > 0) changesApplied.push(`Keywords: ${updates.customLexicon.join(', ')}`);
    
    setAppliedChanges(changesApplied);
    setShowAppliedChanges(true);
  }

  async function handleSave() {
    // Final validation check before saving
    const validation = canCreateProfile();
    if (!validation.canCreate) {
      alert(validation.reason);
      return;
    }
    
    setBusy(true); setSaved(false); setRemoteError(null);
    try {
      // For new profiles, ensure we have a unique ID that doesn't conflict with existing ones
      let profileToSave = profile;
      const isNew = search.get('new') === '1';
      if (isNew) {
        const existingProfiles = listProfiles();
        // Make sure we have a truly unique ID
        let newId = profileToSave.id;
        while (existingProfiles.some((p: StyleProfile) => p.id === newId)) {
          newId = crypto.randomUUID();
        }
        profileToSave = { ...profile, id: newId };
      }
      
      // Ensure profile has a stable UUID (migrate legacy 'local')
      const withId: StyleProfile = profileToSave.id === 'local' ? { ...profileToSave, id: crypto.randomUUID() } : profileToSave;
      // Ensure name is properly set - use the current profile's name from the form
      const withName: StyleProfile = { ...withId, name: profile.name };
      
      saveProfile(withName); // legacy single-slot
      // Also add/update in multi-profile list
      upsertProfileLocal(withName);
      setActiveProfileId(withName.id);
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            setRemoteStatus('saving');
            const newId = await saveProfileRemote({ ...withName, userId: user.id, id: withName.id });
            if (newId && newId !== withName.id) {
              const updatedProfile = { ...withName, id: newId };
              setProfile(p => updatedProfile);
              upsertProfileLocal(updatedProfile);
              setActiveProfileId(newId);
            } else {
              setProfile(withName);
            }
            setRemoteStatus('ok');
            setSaved(true);
            // Redirect to paraphrase page after successful save
            setTimeout(() => router.push('/paraphrase'), 1000);
            return; // success path
          } catch (e: any) {
            console.error(e);
            setRemoteStatus(remoteTableMissing ? 'missing' : 'error');
            setRemoteError(e?.message || 'Remote save failed');
          }
        }
      }
      setSaved(true);
      // Redirect to paraphrase page after successful local save
      setTimeout(() => router.push('/paraphrase'), 1000);
    } finally { setBusy(false); }
  }

  return (
    <div className="py-0">
      {/* Style Parameters Header Section */}
      {/* <div className="max-w-5xl mx-auto mb-8">
        <div className="glass-panel p-6 text-center space-y-2">
          <h1 className="text-3xl font-bold text-brand-300">Create Style Profile</h1>
          <p className="text-slate-300">Follow the steps to define your unique writing style.</p>
        </div>
      </div> */}
      
      {/* Progress Bar */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition ${
                    currentStep === step.number 
                      ? 'bg-brand-500 text-slate-900' 
                      : currentStep > step.number 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {currentStep > step.number ? '✓' : step.number}
                  </div>
                  <div className="text-center mt-1.5">
                    <p className={`text-[10px] font-medium ${
                      currentStep === step.number ? 'text-brand-300' : 'text-slate-400'
                    }`}>
                      {step.name}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-6 transition ${
                    currentStep > step.number ? 'bg-emerald-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Content - Step Based */}
      <div className="max-w-5xl mx-auto">
        <div className="space-y-8">
          <div className="glass-panel p-8 space-y-6 min-h-[500px]">
            {remoteTableMissing && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-3">
                Remote table <code>style_profiles</code> not found. Run the provided SQL in your Supabase project then refresh this page.
              </div>
            )}
            
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">Basic Information</h2>
                  <p className="text-slate-300">Start by giving your profile a name and choosing an overall tone.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Profile name *</label>
                    <input 
                      value={profile.name || ''} 
                      onChange={e => update('name', e.target.value)} 
                      className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" 
                      placeholder="e.g. Academic Concise, Professional Friendly" 
                    />
                    <p className="text-xs text-slate-400">Choose a descriptive name that reflects this writing style</p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Overall tone keyword *</label>
                    <input 
                      value={profile.tone} 
                      onChange={e => update('tone', e.target.value)} 
                      className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" 
                      placeholder="e.g. balanced, encouraging, critical"
                    />
                    <p className="text-xs text-slate-400">This keyword will guide the overall feeling of your paraphrased text</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 2: Sample Text */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">Analyze Your Writing</h2>
                  <p className="text-slate-300">Paste a sample of your writing (150-400 words) so we can analyze your unique style.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Sample excerpt *
                      <span className="text-xs text-slate-400 font-normal">(150-400 words)</span>
                      {hasAnalyzed && hasAppliedAnalysis && (
                        <span className="text-xs text-emerald-400 font-medium">✓ Analyzed & Applied</span>
                      )}
                      {hasAnalyzed && !hasAppliedAnalysis && (
                        <span className="text-xs text-amber-400 font-medium">⚠ Apply Analysis</span>
                      )}
                    </label>
                    <button 
                      onClick={handleAnalyze}
                      disabled={!profile.sampleExcerpt.trim() || isAnalysisRequired().required}
                      className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {hasAnalyzed ? 'Re-analyze' : 'Analyze'}
                    </button>
                  </div>
                  <textarea 
                    value={profile.sampleExcerpt} 
                    onChange={e => update('sampleExcerpt', e.target.value)} 
                    rows={12} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500" 
                    placeholder="Paste a paragraph or two you wrote..." 
                  />
                  
                  {/* Validation Messages */}
                  {profile.sampleExcerpt.trim() && (
                    <div className="text-xs">
                      {(() => {
                        const wordCount = profile.sampleExcerpt.trim().split(/\s+/).length;
                        const analysis = isAnalysisRequired();
                        
                        if (analysis.required) {
                          return <p className="text-amber-400">{analysis.reason}</p>;
                        } else {
                          return <p className="text-emerald-400">✓ Text length optimal ({wordCount} words)</p>;
                        }
                      })()}
                    </div>
                  )}
                </div>
                
                {!hasAppliedAnalysis && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-sm text-blue-300">
                      Click "Analyze" to extract your writing patterns, then apply the results to continue.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 3: Style Parameters */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">Fine-Tune Parameters</h2>
                  <p className="text-slate-300">Adjust these values or keep the analyzed settings. You can also add custom keywords.</p>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-brand-300">Style Parameters</h3>
                    <div className="grid gap-8">
                      <SliderField label="Formality" value={profile.formality} onChange={v => update('formality', v)} helper="Casual ↔ Academic" />
                      <SliderField label="Pacing" value={profile.pacing} onChange={v => update('pacing', v)} helper="Measured ↔ Rapid" />
                      <SliderField label="Descriptiveness" value={profile.descriptiveness} onChange={v => update('descriptiveness', v)} helper="Minimal ↔ Vivid" />
                      <SliderField label="Directness" value={profile.directness} onChange={v => update('directness', v)} helper="Implicit ↔ Straightforward" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Keywords (optional)</label>
                      {profile.customLexicon.length > 0 && (
                        <button 
                          onClick={clearCustomLexicon}
                          className="text-xs text-slate-400 hover:text-white transition px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        value={profile.customLexicon.join(',')} 
                        onChange={e => update('customLexicon', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
                        className="flex-1 rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" 
                        placeholder="e.g. innovative, strategic, efficient" 
                      />
                    </div>
                    <p className="text-xs text-slate-400">Keywords extracted from your sample text or add your own</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 4: Review & Save */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">Review & Save</h2>
                  <p className="text-slate-300">Review your profile settings and add optional notes before saving.</p>
                </div>
                
                {/* Profile Summary */}
                <div className="bg-slate-800/30 rounded-lg p-6 space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Profile Name</p>
                    <p className="text-lg font-semibold text-white">{profile.name}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Tone</p>
                      <p className="text-sm text-white">{profile.tone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Sample Words</p>
                      <p className="text-sm text-white">{profile.sampleExcerpt.trim().split(/\s+/).length} words</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Formality</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${profile.formality * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-300">{Math.round(profile.formality * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Pacing</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${profile.pacing * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-300">{Math.round(profile.pacing * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Descriptiveness</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${profile.descriptiveness * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-300">{Math.round(profile.descriptiveness * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Directness</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${profile.directness * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-300">{Math.round(profile.directness * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {profile.customLexicon.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.customLexicon.map((word, i) => (
                          <span key={i} className="px-2 py-1 bg-brand-500/20 text-brand-300 rounded text-xs">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <textarea 
                    value={profile.notes} 
                    onChange={e => update('notes', e.target.value)} 
                    rows={3} 
                    className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-3 py-2 text-sm" 
                    placeholder="e.g. Professional tone, avoid jargon" 
                  />
                </div>
                
                {/* Validation Status */}
                {(() => {
                  const validation = canCreateProfile();
                  if (!validation.canCreate) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <p className="text-xs text-amber-400">{validation.reason}</p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                      <p className="text-xs text-emerald-400">✓ Ready to create profile</p>
                    </div>
                  );
                })()}
                
                <button 
                  onClick={handleSave} 
                  className="w-full px-5 py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition disabled:opacity-50" 
                  disabled={!canCreateProfile().canCreate || busy}
                >
                  {busy ? 'Saving…' : 'Create Profile'}
                </button>
                
                <div className="space-y-1">
                  {saved && (
                    <p className="text-xs text-emerald-400 flex items-center gap-2">
                      <span>Saved locally ✓</span>
                      {supabase && remoteStatus === 'ok' && <span className="text-emerald-300">Remote ✓</span>}
                      {supabase && remoteStatus === 'saving' && <span className="text-slate-400">Syncing…</span>}
                      {supabase && remoteStatus === 'missing' && <span className="text-amber-400">Remote table missing</span>}
                      {supabase && remoteStatus === 'error' && <span className="text-amber-400">Remote failed</span>}
                    </p>
                  )}
                  {remoteError && (
                    <p className="text-[10px] text-amber-400">{remoteError}</p>
                  )}
                  {remoteStatus === 'missing' && (
                    <details className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                      <summary className="cursor-pointer mb-1">Create style_profiles table (SQL)</summary>
                      <pre className="whitespace-pre-wrap leading-snug">
create table if not exists public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  tone text not null,
  formality real not null,
  pacing real not null,
  descriptiveness real not null,
  directness real not null,
  sample_excerpt text,
  custom_lexicon text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.style_profiles enable row level security;
create policy if not exists "Allow user select own" on public.style_profiles for select using (auth.uid() = user_id);
create policy if not exists "Allow user insert own" on public.style_profiles for insert with check (auth.uid() = user_id);
create policy if not exists "Allow user update own" on public.style_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "Allow user delete own" on public.style_profiles for delete using (auth.uid() = user_id);
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-white/10">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Back
              </button>
              
              <div className="text-xs text-slate-400">
                Step {currentStep} of {steps.length}
              </div>
              
              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  disabled={!canGoToNextStep()}
                  className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              ) : (
                <div className="w-20" /> // Spacer when on last step
              )}
            </div>
          </div>
        </div>
      </div>
      
      {busy && <FullScreenSpinner label="Saving style profile" />}
      {!authChecked && <FullScreenSpinner label="Checking authentication" />}
      
      {/* Style Options Help Tool */}
      <StyleOptionsHelp />
      
      {/* Analysis Results Modal */}
      {showAnalysis && analysisResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-white/10 max-w-2xl w-full max-h-[85vh] overflow-y-auto my-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Writing Style Analysis</h3>
                <button 
                  onClick={() => setShowAnalysis(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                {/* Sentence Structure */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">Sentence Structure</h4>
                  <div className="space-y-1 text-slate-300">
                    <p>• Average sentence length: <span className="text-white font-medium">{Math.round(analysisResult.avgSentenceLength)} words</span></p>
                    <p>• Length variation: <span className="text-white font-medium">±{Math.round(analysisResult.sentenceLengthStd)} words</span></p>
                    <p>• Average clauses per sentence: <span className="text-white font-medium">{analysisResult.avgClausesPerSentence?.toFixed(1) || 'N/A'}</span></p>
                    <p>• Uses contractions: <span className="text-white font-medium">{analysisResult.usesContractions ? 'Yes' : 'No'}</span></p>
                    {analysisResult.questionRatio > 0 && (
                      <p>• Questions: <span className="text-white font-medium">{(analysisResult.questionRatio * 100).toFixed(1)}%</span> of sentences</p>
                    )}
                    {analysisResult.exclamatoryRatio > 0 && (
                      <p>• Exclamations: <span className="text-white font-medium">{(analysisResult.exclamatoryRatio * 100).toFixed(1)}%</span> of sentences</p>
                    )}
                  </div>
                </div>
                
                {/* Construction Patterns */}
                {analysisResult.constructionPatterns && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="font-medium text-white mb-2">Sentence Construction</h4>
                    <div className="space-y-1 text-slate-300">
                      {analysisResult.constructionPatterns.subordinateClauseRatio > 0.2 && (
                        <p>• Subordinate clauses: <span className="text-white font-medium">{(analysisResult.constructionPatterns.subordinateClauseRatio * 100).toFixed(0)}%</span> (because, although, when)</p>
                      )}
                      {analysisResult.constructionPatterns.coordinateClauseRatio > 0.2 && (
                        <p>• Coordinate clauses: <span className="text-white font-medium">{(analysisResult.constructionPatterns.coordinateClauseRatio * 100).toFixed(0)}%</span> (and, but, or)</p>
                      )}
                      {analysisResult.constructionPatterns.parentheticalRatio > 0.1 && (
                        <p>• Parenthetical elements: <span className="text-white font-medium">{(analysisResult.constructionPatterns.parentheticalRatio * 100).toFixed(0)}%</span> of sentences</p>
                      )}
                      {analysisResult.constructionPatterns.frontLoadedDependentRatio > 0.1 && (
                        <p>• Front-loaded dependent clauses: <span className="text-white font-medium">{(analysisResult.constructionPatterns.frontLoadedDependentRatio * 100).toFixed(0)}%</span></p>
                      )}
                      {analysisResult.parallelStructureRatio > 0.05 && (
                        <p>• Parallel structures: <span className="text-white font-medium">{(analysisResult.parallelStructureRatio * 100).toFixed(0)}%</span> (X, Y, and Z patterns)</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Voice & Tone */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">Voice & Tone</h4>
                  <div className="space-y-1 text-slate-300">
                    <p>• Personal voice: <span className="text-white font-medium">{analysisResult.personalVoice}</span> perspective</p>
                    <p>• Tone balance: <span className="text-white font-medium">{analysisResult.toneBalance}</span></p>
                    <p>• Vocabulary complexity: <span className="text-white font-medium">{(analysisResult.vocabularyComplexity * 100).toFixed(1)}%</span> complex words</p>
                    <p>• Average word length: <span className="text-white font-medium">{analysisResult.avgWordLength.toFixed(1)} characters</span></p>
                  </div>
                </div>
                
                {/* Writing Patterns */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-2">Writing Patterns</h4>
                  <div className="space-y-1 text-slate-300">
                    <p>• Descriptive language: <span className="text-white font-medium">{(analysisResult.adjectiveDensity * 100).toFixed(1)}%</span> of words</p>
                    <p>• Conjunction density: <span className="text-white font-medium">{analysisResult.conjunctionDensity.toFixed(1)} per sentence</span></p>
                    {analysisResult.preferredTransitions.length > 0 && (
                      <p>• Preferred transitions: <span className="text-white font-medium">{analysisResult.preferredTransitions.join(', ')}</span></p>
                    )}
                    {analysisResult.topAdverbs.length > 0 && (
                      <p>• Common adverbs: <span className="text-white font-medium">{analysisResult.topAdverbs.join(', ')}</span></p>
                    )}
                    {analysisResult.commonStarters.length > 0 && (
                      <p>• Common sentence starters: <span className="text-white font-medium">{analysisResult.commonStarters.join(', ')}</span></p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={handleApplyAnalysis}
                  className="flex-1 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-900 font-semibold transition"
                >
                  Apply to Profile
                </button>
                <button 
                  onClick={() => setShowAnalysis(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Applied Changes Success Popup */}
      {showAppliedChanges && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-emerald-500/30 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-2xl">✓</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Analysis Applied!</h3>
                </div>
                <button 
                  onClick={() => setShowAppliedChanges(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-sm text-slate-300 mb-4">
                Your profile has been updated with the following changes:
              </p>
              
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 mb-6">
                {appliedChanges.map((change, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span className="text-slate-200">{change}</span>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={() => setShowAppliedChanges(false)}
                className="w-full px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderField({ label, value, onChange, helper }: { label: string; value: number; onChange: (v: number) => void; helper: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-500">{Math.round(value * 100)}</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-brand-500" />
      <div className="text-[10px] text-slate-500">{helper}</div>
    </div>
  );
}
