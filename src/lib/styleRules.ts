// Strict style rule prompt and rule enforcement utilities.

export const STYLE_RULE_PROMPT = `FOLLOW THIS WRITING STYLE STRICTLY:\n• Use clear, simple language.\n• Be spartan and informative.\n• Short, impactful sentences (aim <= 18 words; split longer ones).\n• Active voice (avoid passive like "was done").\n• Practical, actionable insights.\n• Bullet lists ONLY if original text clearly was a list; else plain paragraphs.\n• Use data/examples ONLY if present in original (never fabricate).\n• Address the reader with "you" / "your" for guidance.\n• NO em dashes.\n• NO metaphors, clichés, generic openings/closings.\n• NO constructions like "not just X, but also Y".\n• NO setup phrases (in conclusion, in closing, overall, it is important to note, etc.).\n• NO warnings, meta commentary, or explanation of what you did.\n• NO hashtags, markdown formatting, asterisks, decorative symbols.\n• NO semicolons.\n• Avoid these (case-insensitive): can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, however, harness, exciting, groundbreaking, cutting-edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving.\nReturn ONLY the rewritten text. No prefatory phrases like "Here is". No extra commentary.`;

const BANNED_PATTERNS: RegExp[] = [
  /\bcan\b/gi, /\bmay\b/gi, /\bjust\b/gi, /\bvery\b/gi, /\breally\b/gi, /\bliterally\b/gi, /\bactually\b/gi,
  /\bcertainly\b/gi, /\bprobably\b/gi, /\bbasically\b/gi, /\bcould\b/gi, /\bmaybe\b/gi, /delve/gi, /embark/gi,
  /enlightening/gi, /esteemed/gi, /shed light/gi, /craft(?:ing)?/gi, /imagine/gi, /\brealm\b/gi, /game-?changer/gi, /unlock/gi,
  /skyrocket(?:ing)?/gi, /abyss/gi, /not alone/gi, /in a world where/gi, /revolutionize/gi, /disruptive/gi, /utiliz(?:e|ing)/gi,
  /dive deep/gi, /tapestry/gi, /illuminat(?:e|ing)/gi, /unveil/gi, /pivotal/gi, /intricate/gi, /elucidate/gi, /hence/gi,
  /furthermore/gi, /however/gi, /harness/gi, /exciting/gi, /groundbreaking/gi, /cutting-edge/gi, /remarkable/gi,
  /remains to be seen/gi, /glimpse into/gi, /navigating/gi, /landscape/gi, /stark/gi, /testament/gi, /in summary/gi,
  /in conclusion/gi, /moreover/gi, /boost/gi, /opened up/gi, /powerful/gi, /inquiries/gi, /ever-evolving/gi
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
    'however': 'but',
    'furthermore': 'also',
    'moreover': 'also',
    'hence': 'so',
    'thus': 'so',
    'therefore': 'so',
    'actually': '',
    'very': '',
    // Avoid destructive removals: supply neutral substitutes
    'tapestry': 'mesh',
    'intricate': 'complex',
    'pivotal': 'key',
    'illuminate': 'clarify',
    'illuminating': 'clarifying',
    'unveil': 'reveal',
    'groundbreaking': 'new',
    'cutting-edge': 'advanced',
    'remarkable': 'notable',
    'exciting': 'interesting',
    'powerful': 'strong',
    'ever-evolving': 'changing',
    'landscape': 'field',
    'realm': 'field',
    'craft': 'build',
    'crafting': 'building',
    'harness': 'use',
    'unlock': 'enable',
    'game-changer': 'major shift',
    'revolutionize': 'transform',
    // Keep structural words that hurt grammar if removed
    'that': '__KEEP__'
  };
  return map[word] !== undefined ? map[word] : '';
}

function cleanArtifacts(s: string): string {
  return s
    .replace(/,\./g, ',')
    .replace(/\.,/g, '.')
    .replace(/\s+'s\b/g, "'s")
    .replace(/\bof\s+of\b/gi, 'of')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*\./g, '.')
    .replace(/\b(an)\s+(?=of\b)/gi, '') // remove stray 'an' before 'of' after adjective removal
    .trim();
}
