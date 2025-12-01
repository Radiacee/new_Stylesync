"use client";
import { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Check, AlertTriangle, Info, Lightbulb, Target, Zap } from 'lucide-react';

interface QualitySuggestionsProps {
  input: string;
  output: string;
  styleType?: string;
  profileSample?: string;
}

interface Suggestion {
  id: string;
  type: 'improvement' | 'warning' | 'tip' | 'success';
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  action?: string;
  context: string; // Why this suggestion is relevant
}

// Detect the context/domain of the text
function detectContext(text: string): { domain: string; purpose: string; audience: string } {
  const lowerText = text.toLowerCase();
  
  // Academic/Research context
  if (/\b(research|study|findings|hypothesis|methodology|analysis|conclusion|abstract|literature|evidence|theory)\b/.test(lowerText)) {
    return { domain: 'academic', purpose: 'research/educational', audience: 'scholarly' };
  }
  
  // Business/Professional context
  if (/\b(revenue|strategy|stakeholder|roi|kpi|deliverable|objective|implementation|initiative|optimize)\b/.test(lowerText)) {
    return { domain: 'business', purpose: 'professional communication', audience: 'corporate' };
  }
  
  // Technical/Development context
  if (/\b(api|function|algorithm|database|server|code|implementation|deploy|architecture|framework)\b/.test(lowerText)) {
    return { domain: 'technical', purpose: 'documentation/explanation', audience: 'developers' };
  }
  
  // Creative/Narrative context
  if (/\b(story|character|scene|narrative|emotion|imagine|journey|adventure|dream)\b/.test(lowerText)) {
    return { domain: 'creative', purpose: 'storytelling', audience: 'general readers' };
  }
  
  // Email/Communication context
  if (/\b(dear|sincerely|regards|attached|please find|following up|reaching out|let me know)\b/.test(lowerText)) {
    return { domain: 'correspondence', purpose: 'communication', audience: 'recipients' };
  }
  
  return { domain: 'general', purpose: 'communication', audience: 'general' };
}

// Analyze text quality and generate context-aware suggestions
function analyzeQuality(input: string, output: string, styleType?: string, profileSample?: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const context = detectContext(input);
  
  const inputWords = input.split(/\s+/).filter(w => w.length > 0);
  const outputWords = output.split(/\s+/).filter(w => w.length > 0);
  const inputSentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const outputSentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Calculate metrics
  const lengthChange = ((outputWords.length - inputWords.length) / inputWords.length) * 100;
  const avgInputSentenceLen = inputWords.length / Math.max(inputSentences.length, 1);
  const avgOutputSentenceLen = outputWords.length / Math.max(outputSentences.length, 1);
  
  // Check for repetitive words in output
  const wordFrequency: Record<string, number> = {};
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this', 'with', 'as', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'its']);
  outputWords.forEach(w => {
    const lower = w.toLowerCase().replace(/[^a-z]/g, '');
    if (lower.length > 3 && !commonWords.has(lower)) {
      wordFrequency[lower] = (wordFrequency[lower] || 0) + 1;
    }
  });
  const repetitiveWords = Object.entries(wordFrequency).filter(([_, count]) => count >= 4);
  
  // Check sentence variety
  const sentenceLengths = outputSentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const allSimilarLength = sentenceLengths.length > 2 && 
    sentenceLengths.every(len => Math.abs(len - avgOutputSentenceLen) < 4);
  
  // Check for passive voice
  const passivePattern = /\b(was|were|is|are|been|being)\s+\w+ed\b/gi;
  const passiveMatches = output.match(passivePattern) || [];
  const passiveRatio = passiveMatches.length / Math.max(outputSentences.length, 1);
  
  // Check sentence starters
  const starters = outputSentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const starterCounts: Record<string, number> = {};
  starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
  const repetitiveStarters = Object.entries(starterCounts).filter(([_, count]) => count >= 3);

  // Context-aware suggestions based on domain
  
  // === LENGTH ANALYSIS ===
  if (lengthChange > 50) {
    suggestions.push({
      id: 'length-increase',
      type: 'warning',
      priority: 'medium',
      category: 'Length',
      title: 'Significant Length Increase',
      description: `Output is ${Math.round(lengthChange)}% longer than input (${inputWords.length} → ${outputWords.length} words).`,
      action: context.domain === 'academic' 
        ? 'For academic writing, conciseness is valued. Consider trimming redundant explanations.'
        : context.domain === 'business'
        ? 'Business communications should be concise. Remove filler phrases.'
        : 'Consider if all added content is necessary for clarity.',
      context: `In ${context.domain} contexts, ${context.audience} typically prefer concise communication.`
    });
  } else if (lengthChange < -30) {
    suggestions.push({
      id: 'length-decrease',
      type: 'tip',
      priority: 'low',
      category: 'Length',
      title: 'Content Condensed',
      description: `Output is ${Math.round(Math.abs(lengthChange))}% shorter than input.`,
      action: 'Verify that no important information was lost in the paraphrase.',
      context: 'Shorter text can be more impactful, but ensure key points remain.'
    });
  }

  // === REPETITION ANALYSIS ===
  if (repetitiveWords.length > 0) {
    const topRepeated = repetitiveWords.slice(0, 3).map(([word, count]) => `"${word}" (${count}x)`).join(', ');
    suggestions.push({
      id: 'word-repetition',
      type: 'improvement',
      priority: 'high',
      category: 'Vocabulary',
      title: 'Word Repetition Detected',
      description: `Some words appear frequently: ${topRepeated}`,
      action: context.domain === 'academic'
        ? 'Academic writing benefits from varied vocabulary. Use synonyms or restructure sentences.'
        : context.domain === 'technical'
        ? 'Technical terms can repeat, but consider varying explanatory language.'
        : 'Try using synonyms to make the text more engaging.',
      context: `For ${context.audience} readers, varied vocabulary improves readability.`
    });
  }

  // === SENTENCE STRUCTURE ===
  if (allSimilarLength && outputSentences.length > 3) {
    suggestions.push({
      id: 'sentence-variety',
      type: 'improvement',
      priority: 'medium',
      category: 'Structure',
      title: 'Monotonous Sentence Length',
      description: `All sentences are similar in length (avg: ${Math.round(avgOutputSentenceLen)} words).`,
      action: context.domain === 'creative'
        ? 'Mix short punchy sentences with longer flowing ones for rhythm.'
        : context.domain === 'academic'
        ? 'Vary sentence structure to maintain reader engagement in longer texts.'
        : 'Alternate between short and long sentences for better flow.',
      context: `Sentence variety keeps ${context.audience} engaged and improves comprehension.`
    });
  }

  if (repetitiveStarters.length > 0) {
    const topStarters = repetitiveStarters.slice(0, 2).map(([word, count]) => `"${word}" (${count} times)`).join(', ');
    suggestions.push({
      id: 'starter-repetition',
      type: 'improvement',
      priority: 'medium',
      category: 'Structure',
      title: 'Repetitive Sentence Starters',
      description: `Multiple sentences begin with: ${topStarters}`,
      action: 'Try varying how you begin sentences. Use transitions, dependent clauses, or different subjects.',
      context: `Varied sentence openings create better flow for ${context.audience}.`
    });
  }

  // === VOICE ANALYSIS ===
  if (passiveRatio > 0.4) {
    suggestions.push({
      id: 'passive-voice',
      type: 'tip',
      priority: context.domain === 'business' ? 'high' : 'medium',
      category: 'Voice',
      title: 'Heavy Passive Voice Usage',
      description: `${Math.round(passiveRatio * 100)}% of sentences use passive voice.`,
      action: context.domain === 'academic'
        ? 'Some fields prefer passive voice, but active voice often improves clarity.'
        : context.domain === 'business'
        ? 'Business writing typically uses active voice for directness and accountability.'
        : 'Consider using more active voice for stronger, clearer statements.',
      context: `${context.domain === 'academic' ? 'Check your field\'s conventions for voice preference.' : 'Active voice tends to be more engaging and direct.'}`
    });
  }

  // === CONTEXT-SPECIFIC SUGGESTIONS ===
  
  // Academic-specific
  if (context.domain === 'academic') {
    // Check for hedging language
    const hedgingWords = /\b(might|could|possibly|perhaps|seems|appears|somewhat|relatively)\b/gi;
    const hedgingCount = (output.match(hedgingWords) || []).length;
    if (hedgingCount > outputSentences.length * 0.3) {
      suggestions.push({
        id: 'academic-hedging',
        type: 'tip',
        priority: 'low',
        category: 'Academic Style',
        title: 'Hedging Language Balance',
        description: 'Text contains significant hedging language (might, could, possibly, etc.).',
        action: 'While hedging is important in academic writing, ensure claims are appropriately confident where evidence supports them.',
        context: 'Balance between certainty and appropriate caution is key in scholarly work.'
      });
    }
    
    // Check for citations context
    if (/\b(according to|studies show|research indicates)\b/i.test(output) && !/\(\d{4}\)|\[\d+\]/.test(output)) {
      suggestions.push({
        id: 'academic-citations',
        type: 'warning',
        priority: 'high',
        category: 'Academic Style',
        title: 'Citation Placeholders Needed',
        description: 'Text references research but may need proper citations.',
        action: 'Add proper citations (APA, MLA, etc.) where research is referenced.',
        context: 'Academic writing requires proper attribution of sources.'
      });
    }
  }

  // Business-specific
  if (context.domain === 'business') {
    // Check for actionable language
    const actionWords = /\b(will|shall|must|need to|recommend|propose|suggest|implement)\b/gi;
    const actionCount = (output.match(actionWords) || []).length;
    if (actionCount < 1 && outputSentences.length > 3) {
      suggestions.push({
        id: 'business-action',
        type: 'tip',
        priority: 'medium',
        category: 'Business Impact',
        title: 'Add Action-Oriented Language',
        description: 'Text could benefit from clearer calls to action.',
        action: 'Include specific recommendations or next steps for stakeholders.',
        context: 'Business communications are most effective when they drive action.'
      });
    }

    // Check for jargon overuse
    const jargonWords = /\b(synergy|leverage|paradigm|holistic|bandwidth|circle back|deep dive|low-hanging fruit)\b/gi;
    const jargonCount = (output.match(jargonWords) || []).length;
    if (jargonCount > 2) {
      suggestions.push({
        id: 'business-jargon',
        type: 'improvement',
        priority: 'medium',
        category: 'Clarity',
        title: 'Consider Reducing Jargon',
        description: 'Text contains business jargon that could be simplified.',
        action: 'Replace buzzwords with clear, specific language for better comprehension.',
        context: 'Clear communication resonates better with all stakeholders.'
      });
    }
  }

  // Technical-specific
  if (context.domain === 'technical') {
    // Check for explanation of technical terms
    const techTerms = /\b(API|SDK|REST|JSON|SQL|OAuth|JWT|CRUD|MVC)\b/g;
    const techMatches = output.match(techTerms) || [];
    const uniqueTech = [...new Set(techMatches)];
    if (uniqueTech.length > 3) {
      suggestions.push({
        id: 'tech-acronyms',
        type: 'tip',
        priority: 'low',
        category: 'Technical Clarity',
        title: 'Multiple Technical Acronyms',
        description: `Contains ${uniqueTech.length} technical acronyms: ${uniqueTech.slice(0, 4).join(', ')}`,
        action: 'Consider defining acronyms on first use if audience may not be familiar.',
        context: 'Even technical audiences appreciate clarity on specialized terms.'
      });
    }
  }

  // === SUCCESS INDICATORS ===
  
  // Good length preservation
  if (Math.abs(lengthChange) < 15 && repetitiveWords.length === 0) {
    suggestions.push({
      id: 'good-length',
      type: 'success',
      priority: 'low',
      category: 'Quality',
      title: 'Good Length Balance',
      description: 'Output maintains appropriate length while paraphrasing effectively.',
      context: 'Well-balanced paraphrasing preserves meaning without unnecessary expansion.'
    });
  }

  // Good variety
  if (!allSimilarLength && repetitiveStarters.length === 0 && outputSentences.length > 2) {
    suggestions.push({
      id: 'good-variety',
      type: 'success',
      priority: 'low',
      category: 'Quality',
      title: 'Good Sentence Variety',
      description: 'Output shows good variety in sentence structure and length.',
      context: 'Varied writing keeps readers engaged.'
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const typeOrder = { warning: 0, improvement: 1, tip: 2, success: 3 };
  suggestions.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return suggestions;
}

export default function QualitySuggestions({ input, output, styleType, profileSample }: QualitySuggestionsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const suggestions = useMemo(() => 
    analyzeQuality(input, output, styleType, profileSample), 
    [input, output, styleType, profileSample]
  );

  const context = useMemo(() => detectContext(input), [input]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getTypeIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'success': return <Check className="w-4 h-4 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'improvement': return <Target className="w-4 h-4 text-blue-400" />;
      case 'tip': return <Lightbulb className="w-4 h-4 text-purple-400" />;
    }
  };

  const getTypeBg = (type: Suggestion['type']) => {
    switch (type) {
      case 'success': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'improvement': return 'bg-blue-500/10 border-blue-500/30';
      case 'tip': return 'bg-purple-500/10 border-purple-500/30';
    }
  };

  const getPriorityBadge = (priority: Suggestion['priority']) => {
    switch (priority) {
      case 'high': return <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 uppercase tracking-wide">High</span>;
      case 'medium': return <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 uppercase tracking-wide">Med</span>;
      case 'low': return null;
    }
  };

  if (!input || !output || output.trim().length < 20) {
    return null;
  }

  const improvements = suggestions.filter(s => s.type === 'improvement' || s.type === 'warning');
  const successes = suggestions.filter(s => s.type === 'success');
  const tips = suggestions.filter(s => s.type === 'tip');

  return (
    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Quality Suggestions
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {context.domain}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {improvements.length} improvements · {successes.length} strengths · {tips.length} tips
            </p>
          </div>
        </div>
        {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Context Banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/50 border border-white/5">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-300">
                <span className="font-medium">Detected Context:</span> {context.domain.charAt(0).toUpperCase() + context.domain.slice(1)} writing for {context.audience} audience
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Suggestions are tailored to {context.purpose} standards
              </p>
            </div>
          </div>

          {/* Suggestions List */}
          <div className="space-y-2">
            {suggestions.map(suggestion => (
              <div 
                key={suggestion.id}
                className={`rounded-lg border ${getTypeBg(suggestion.type)}`}
              >
                <button
                  onClick={() => toggleExpand(suggestion.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getTypeIcon(suggestion.type)}
                    <span className="text-sm font-medium text-white truncate">{suggestion.title}</span>
                    {getPriorityBadge(suggestion.priority)}
                    <span className="text-[10px] text-slate-500 hidden sm:inline">({suggestion.category})</span>
                  </div>
                  {expanded.has(suggestion.id) 
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </button>
                
                {expanded.has(suggestion.id) && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5">
                    <p className="text-xs text-slate-300">{suggestion.description}</p>
                    {suggestion.action && (
                      <div className="flex items-start gap-2 p-2 rounded bg-slate-900/50">
                        <Zap className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-200">{suggestion.action}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 italic">{suggestion.context}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {suggestions.length === 0 && (
            <div className="text-center py-4">
              <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-300">Output looks great!</p>
              <p className="text-xs text-slate-500">No significant quality issues detected.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
