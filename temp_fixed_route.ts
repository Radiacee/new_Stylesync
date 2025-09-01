// This is a temporary file to hold the fixed code section

function sanitizeModelOutput(s: string): string {
  if (!s) return s;
  
  console.log('BEFORE sanitization:', JSON.stringify(s.slice(0, 150), null, 2));
  console.log('BEFORE sanitization (end):', JSON.stringify(s.slice(-150)));
  
  // Remove leading common prefaces and prompt leakage
  s = s.replace(/^\s*(Here(?:'| i)s[^\n]*?:?\s*)/i, '');
  s = s.replace(/^\s*(Paraphrased (?:version|text)[:\-]?\s*)/i, '');
  s = s.replace(/^\s*(I(?:'ve| have)[^\n]*?:?\s*)/i, '');
  s = s.replace(/^\s*(A rewritten version of the text:\s*)/i, '');
  s = s.replace(/^\s*(Rewritten version:\s*)/i, '');
  s = s.replace(/^\s*(The rewritten text:\s*)/i, '');
  
  // Remove any system prompt leakage at the beginning
  s = s.replace(/^\s*(?:System|Assistant|User):\s*/i, '');
  s = s.replace(/^\s*(?:Paraphrase|Rewrite)[^\n]*?:\s*/i, '');
  
  // AGGRESSIVE: Remove problematic lexicon word insertions that break sentences
  s = s.replace(/\b(?:factually|especially|clearly|confidently|frequently)\s+(?:factually|especially|clearly|confidently|frequently)\b/gi, '');
  s = s.replace(/\b(?:in|at|of|to|with|by|for|from|into|onto|upon|during|before|after|through|across|around|between|among|within|without|beneath|beside|behind|beyond|above|below)\s+(?:factually|especially|clearly|confidently|frequently)\b/gi, '$1');
  s = s.replace(/\b(?:factually|especially|clearly|confidently|frequently)\s+(?:in|at|of|to|with|by|for|from|into|onto|upon|during|before|after|through|across|around|between|among|within|without|beneath|beside|behind|beyond|above|below)\b/gi, '$2');
  
  // Remove lexicon words that are inserted in grammatically wrong places
  s = s.replace(/\b(\w+)\s+(factually|especially|clearly|confidently|frequently)\s+(is|are|was|were|will|would|can|could|has|have|had|do|does|did)\b/gi, '$1 $3');
  s = s.replace(/\b(Artificial|Digital|Virtual|Social|Global|National|International|Local|Regional|Modern|Ancient|Current|Recent|Future|Past|Present)\s+(factually|especially|clearly|confidently|frequently)\s+(intelligence|media|reality|network|system|technology|development|advancement|progress|change)\b/gi, '$1 $3');
  
  // Remove trailing explanation sections
  const splitMarkers = /(\n\n(?:I['\s]?(?:ve| have) maintained|Tone:|Formality:|Pacing:|Descriptiveness:|Directness:|Note:|This maintains|The rewritten))/i;
  const m = s.split(splitMarkers);
  if (m.length > 1) {
    s = m[0].trim();
  }
  
  // Remove lexicon notes that might appear at the end
  s = s.replace(/\n\n?(?:Lexicon notes?:.*|Preferred (?:vocabulary|words?):.*|Custom lexicon:.*)$/gmi, '');
  s = s.replace(/\n\n?(?:Words? used:.*|Vocabulary applied:.*|Lexicon:.*|Custom words?:.*)$/gmi, '');
  
  // More aggressive lexicon note removal - handle various formats
  s = s.replace(/\s*Lexicon notes?:\s*[^\n]*$/gmi, '');
  s = s.replace(/\s*(?:Custom )?[Ll]exicon:\s*[^\n]*$/gmi, '');
  s = s.replace(/\s*(?:Preferred|Custom) (?:vocabulary|words?):\s*[^\n]*$/gmi, '');
  
  // SUPER AGGRESSIVE: Remove the exact pattern we're seeing
  s = s.replace(/\s*\.?\s*Lexicon notes:\s*especially,\s*clearly,\s*confidently,\s*factually,\s*frequently\s*$/gi, '');
  s = s.replace(/\s*especially,\s*clearly,\s*confidently,\s*factually,\s*frequently\s*$/gi, '');
  
  // Fix excessive comma patterns that appear when lexicon words are missing
  s = s.replace(/,\s*,\s*,/g, '');  // Remove triple commas
  s = s.replace(/,\s*,/g, ',');     // Fix double commas to single
  s = s.replace(/\s+,/g, ',');      // Fix space before comma
  s = s.replace(/,{2,}/g, ',');     // Multiple commas to single
  
  // Handle the specific problematic patterns we're seeing
  s = s.replace(/(\w+)\s*,\s*,\s*,\s*(that|which|who|when|where)/gi, '$1, $2');
  s = s.replace(/(\w+)\s*,\s*,\s*(that|which|who|when|where)/gi, '$1, $2');
  s = s.replace(/(\w+)\s*,\s*,\s*(inform|spark|ensure|produce|create)/gi, '$1 $2');
  
  // Remove comma patterns that appear when words are missing
  s = s.replace(/(\w+),\s*,\s*,\s*(\w+)/g, '$1, $2');
  s = s.replace(/(\w+)\s+,\s*,\s*,/g, '$1');
  s = s.replace(/,\s*,\s*,\s*([.!?])/g, '$1');
  
  // Clean up comma patterns around specific words that commonly get mangled
  s = s.replace(/\b(uncovering|producing|creating|ensuring|developing)\s+(insights|art|music|innovation)\s*,\s*,\s*/gi, '$1 $2 ');
  s = s.replace(/\b(process|analyze|examine|evaluate)\s+(data|information|content)\s*,\s*,\s*/gi, '$1 $2 ');
  
  // Remove specific lexicon word patterns (not any random word lists)
  const lexiconWords = ['especially', 'clearly', 'confidently', 'factually', 'frequently'];
  const lexiconPattern = lexiconWords.join('|');
  
  // Only remove word lists if they contain lexicon words
  s = s.replace(new RegExp(`\\s+(?:${lexiconPattern})(?:,\\s*(?:${lexiconPattern}|\\w+)){2,}\\s*$`, 'gi'), '');
  
  // Strip trailing explanation that starts with bullets or dashes
  s = s.replace(/\n\n(?:[-*•]\s.*)+$/gms, '');
  s = s.replace(/\n\n(?:Note:|This|The above).*$/gms, '');
  
  // Remove any standalone lexicon mentions anywhere in the text
  s = s.replace(/\b(?:Lexicon|Custom lexicon|Preferred vocabulary):\s*[^\n]*(?:\n|$)/gi, '');
  
  // Final cleanup - remove any remaining lexicon word combinations at the end
  s = s.replace(new RegExp(`\\s+(?:${lexiconPattern})(?:\\s*,\\s*(?:${lexiconPattern}))*\\s*$`, 'gi'), '');
  
  // Remove specific pattern "clearly, confidently. frequently." and variations
  s = s.replace(/\s*clearly,\s*confidently\.?\s*frequently\.?\s*$/gi, '');
  s = s.replace(/\s*,?\s*clearly,\s*confidently\.?\s*frequently\.?\s*$/gi, '');
  
  // Remove any trailing fragment with these specific lexicon words only
  s = s.replace(new RegExp(`\\s*(?:${lexiconPattern})(?:\\s*,\\s*(?:${lexiconPattern}))*\\.?\\s*$`, 'gi'), '');
  
  // Remove repetitive word patterns (basic detection)
  s = s.replace(/\b(\w+)(\s+\1){2,}\b/gi, '$1');
  
  // Remove incomplete sentences at the end
  const sentences = s.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) {
    const lastSentence = sentences[sentences.length - 1];
    if (!/[.!?]$/.test(lastSentence.trim()) && lastSentence.trim().length < 20) {
      sentences.pop();
      s = sentences.join(' ');
    }
  }
  
  const finalResult = s.trim();
  console.log('AFTER sanitization:', JSON.stringify(finalResult.slice(-100)));
  
  return finalResult;
}

function cleanupCommaPatterns(text: string): string {
  if (!text) return text;

  let cleaned = text;
  console.log('COMMA CLEANUP - Before:', JSON.stringify(cleaned));

  // Fix excessive comma patterns like ",,," which appear when lexicon words are missing
  cleaned = cleaned.replace(/,\s*,\s*,+/g, ','); // ",  , ," or ", ,," -> ","
  cleaned = cleaned.replace(/,\s*,\s*/g, ',');    // ", ," -> ","
  cleaned = cleaned.replace(/,{2,}/g, ',');       // ",," -> ","

  // Fix the specific patterns we're seeing: "data , uncovering insights , , that"
  cleaned = cleaned.replace(/(\w+)\s*,\s*,\s*,\s*(\w+)/g, '$1, $2');  // "word , , , word" -> "word, word"
  cleaned = cleaned.replace(/(\w+)\s*,\s*,\s*(\w+)/g, '$1, $2');      // "word , , word" -> "word, word"

  // Handle patterns where comma appears before conjunctions/words
  cleaned = cleaned.replace(/,\s*,\s*,\s*(that|which|who|when|where|how|why)\b/gi, ', $1');
  cleaned = cleaned.replace(/,\s*,\s*(that|which|who|when|where|how|why)\b/gi, ', $1');

  // Fix patterns around conjunctions
  cleaned = cleaned.replace(/\b(and|but|or|so|yet|for)\s*,\s*,\s*,/gi, '$1');
  cleaned = cleaned.replace(/\b(and|but|or|so|yet|for)\s*,\s*,/gi, '$1');

  // Handle patterns at sentence boundaries
  cleaned = cleaned.replace(/,\s*,\s*,\s*([.!?])/g, '$1');  // ", , ." -> "."
  cleaned = cleaned.replace(/,\s*,\s*([.!?])/g, '$1');      // ", ." -> "."

  // Clean up any remaining double commas that might have been created
  cleaned = cleaned.replace(/,\s*,/g, ',');

  // Fix spacing around commas (normalize)
  cleaned = cleaned.replace(/\s*,\s*/g, ', ');

  // Remove trailing comma patterns and fix sentence endings
  cleaned = cleaned.replace(/,\s*,\s*,?\s*$/g, '');
  cleaned = cleaned.replace(/,\s*$/g, '');

  // Handle edge cases with specific problematic patterns
  cleaned = cleaned.replace(/\b(process|inform|spark|ensure|produce|create|develop)\s+,\s*,\s*/gi, '$1 ');
  cleaned = cleaned.replace(/\b(data|insights|decisions|art|music|literature|innovation|technology)\s*,\s*,\s*/gi, '$1 ');

  console.log('COMMA CLEANUP - After:', JSON.stringify(cleaned));
  return cleaned.trim();
}
