// Strict style rule prompt and rule enforcement utilities.

export const STYLE_RULE_PROMPT = `🎯 YOU ARE A SENTENCE STRUCTURE TRANSFORMER

Your job: Rewrite text to match the user's sentence structure and writing patterns from their essay samples.

🚨 ABSOLUTE RULES:
1. PRESERVE 100% OF CONTENT
   - Keep every fact, detail, concept, and piece of information
   - Do NOT summarize, condense, or omit anything
   - Do NOT add new information or interpretations
   
2. RESTRUCTURE TO MATCH USER'S STYLE
   - Change HOW sentences are built (structure, word order)
   - Change HOW ideas flow (transitions, connections)
   - Match the user's sentence patterns from their essays
   - Adjust pronouns and perspective to match the user's essay style
   - Make it sound EXACTLY like the user wrote it

3. OUTPUT FORMAT
   - Return ONLY the restructured text
   - No "Here is..." or explanatory prefixes
   - No meta-commentary about what you did

❌ DO NOT:
- Change the meaning or facts
- Summarize or shorten
- Add information not in the input
- Use robotic AI phrases like "in order to", "utilize", "delve into"
- Make it sound artificial

✅ DO:
- Make it sound like the user wrote it themselves
- Match their sentence length patterns
- Match their punctuation style
- Match their vocabulary level (formal vs casual)
- Match their point of view (first/second/third person) from their essays
- Keep it natural and human`;


const BANNED_PATTERNS: RegExp[] = [
  /delve/gi,
  /embark/gi,
  /enlightening/gi,
  /esteemed/gi,
  /shed light/gi,
  /craft(?:ing)?/gi,
  /imagine this/gi,
  /\brealm\b/gi,
  /game-?changer/gi,
  /unlock/gi,
  /skyrocket(?:ing)?/gi,
  /abyss/gi,
  /in a world where/gi,
  /revolutionize/gi,
  /disruptive/gi,
  /utiliz(?:e|ing)/gi,
  /dive deep/gi,
  /tapestry/gi,
  /illuminat(?:e|ing)/gi,
  /unveil/gi,
  /pivotal/gi,
  /intricate/gi,
  /elucidate/gi,
  /harness/gi,
  /exciting/gi,
  /groundbreaking/gi,
  /cutting-edge/gi,
  /remarkable/gi,
  /remains to be seen/gi,
  /glimpse into/gi,
  /navigating/gi,
  /ever-evolving/gi,
  /shimmering/gi,
  /testament/gi,
  /in summary/gi,
  /in conclusion/gi,
  /moreover/gi,
  /furthermore/gi,
  /meanwhile/gi,
  /consequently/gi
];

const FORBIDDEN_OPENERS = [
  /^here('?|)s a (?:paraphrased|rewritten) (?:version|take)[:\-]?\s*/i,
  /^paraphrased (?:version|text)[:\-]\s*/i
];

export interface StyleRuleAction { code: string; meta?: any }

export function enforceStyleRulesWithActions(text: string, maxPasses = 3): { text: string; actions: StyleRuleAction[] } {
  let t = text.trim();
  const actions: StyleRuleAction[] = [];
  FORBIDDEN_OPENERS.forEach(rx => {
    if (rx.test(t)) { actions.push({ code: 'removeOpener', meta: rx.source }); t = t.replace(rx, ''); }
  });

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    if (t.includes('—')) { t = t.replace(/—/g, '. '); actions.push({ code: 'replaceEmDash' }); changed = true; }
    if (t.includes(';')) { t = t.replace(/;/g, '. '); actions.push({ code: 'replaceSemicolon' }); changed = true; }
    const beforeBullet = t;
    t = t.replace(/^[#>*\-+]+\s+/gm, '');
    if (beforeBullet !== t) { actions.push({ code: 'stripBullets' }); changed = true; }
    BANNED_PATTERNS.forEach(rx => {
      if (!rx.test(t)) return;
      t = t.replace(rx, (m) => {
        const lowered = m.toLowerCase();
        const replacement = simpleReplacement(lowered);
        if (replacement === '__KEEP__') {
          return m; // do not alter
        }
        actions.push({ code: 'removeBanned', meta: lowered });
        return replacement; // may be '' for true fillers
      });
      changed = true;
    });
    const sentences = t.split(/(?<=[.!?])\s+/).flatMap(s => {
      const words = s.trim().split(/\s+/);
      if (words.length > 22) {
        actions.push({ code: 'splitLongSentence', meta: { length: words.length } });
        const cut = Math.ceil(words.length / 2);
        return [words.slice(0, cut).join(' ') + '.', words.slice(cut).join(' ') + '.'];
      }
      return [s];
    });
    const joined = sentences.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (joined !== t) { t = joined; changed = true; }
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (!changed) break;
  }
  const finalBefore = t;
  t = t.replace(/(\.){2,}/g, '.');
  if (finalBefore !== t) actions.push({ code: 'collapsePeriods' });
  t = t.replace(/^[\-\*\•\s]+/, '').trim();
  t = cleanArtifacts(t);
  return { text: t, actions };
}

// Backwards-compatible simple wrapper
export function enforceStyleRules(text: string, maxPasses = 3): string {
  return enforceStyleRulesWithActions(text, maxPasses).text;
}

function simpleReplacement(word: string): string {
  const map: Record<string, string> = {
    'delve': 'explore',
    'embark': 'start',
    'enlightening': 'eye-opening',
    'esteemed': 'respected',
    'shed light': 'explain',
    'craft': 'build',
    'crafting': 'building',
    'imagine this': 'imagine',
    'realm': 'field',
    'game-changer': 'major shift',
    'unlock': 'open up',
    'skyrocketing': 'soaring',
    'skyrocket': 'soar',
    'abyss': 'gap',
    'in a world where': 'when',
    'revolutionize': 'transform',
    'disruptive': 'bold',
    'utilize': 'use',
    'utilizing': 'using',
    'dive deep': 'explore',
    'tapestry': 'mix',
    'illuminate': 'clarify',
    'illuminating': 'clarifying',
    'unveil': 'reveal',
    'pivotal': 'key',
    'intricate': 'complex',
    'elucidate': 'clarify',
    'harness': 'use',
    'exciting': 'interesting',
    'groundbreaking': 'new',
    'cutting-edge': 'advanced',
    'remarkable': 'notable',
    'remains to be seen': 'is unclear',
    'glimpse into': 'look at',
    'navigating': 'handling',
    'ever-evolving': 'changing',
    'shimmering': 'bright',
    'testament': 'proof',
    'in summary': 'in short',
    'in conclusion': 'finally',
    'moreover': 'also',
    'furthermore': 'also',
    'meanwhile': 'at the same time',
    'consequently': 'so'
  };
  return map[word] !== undefined ? map[word] : '';
}

function cleanArtifacts(s: string): string {
  let result = s;
  
  // Fix punctuation issues - be thorough
  result = result.replace(/,\s*\./g, '.'); // comma then period -> period
  result = result.replace(/\.\s*,/g, '.'); // period then comma -> period
  result = result.replace(/,,+/g, ','); // multiple commas -> single comma
  result = result.replace(/\.\.+/g, '.'); // multiple periods -> single period
  result = result.replace(/,\s*,/g, ','); // comma space comma -> single comma
  result = result.replace(/\.\s*\./g, '.'); // period space period -> single period
  result = result.replace(/\s+'s\b/g, "'s");
  result = result.replace(/\bof\s+of\b/gi, 'of');
  result = result.replace(/\s{2,}/g, ' ');
  result = result.replace(/\b(an)\s+(?=of\b)/gi, ''); // remove stray 'an' before 'of' after adjective removal
  
  return result.trim();
}
