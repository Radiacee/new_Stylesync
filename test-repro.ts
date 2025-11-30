
import { humanizeText, paraphraseWithProfile } from './src/lib/paraphrase';

// Mocking the critical parts of "enforceStylePatterns" from the API route
// because they aren't exported.
function mockEnforceStylePatterns(text: string, profile: any) {
    let enforced = text;

    // Simulate "Adjust Formality" (which was identified as a culprit)
    if (profile.formality > 0.7) {
        // From route.ts: replace informal words
         const informalToFormal: Record<string, string> = {
            "get": "obtain",
            "got": "obtained",
            "make": "create",
            "do": "perform",
            "help": "assist",
            "need": "require",
            "want": "desire",
            "really": "",
            "very": "",
             "just": ""
        };
        for (const [informal, formal] of Object.entries(informalToFormal)) {
            const regex = new RegExp(`\\b${informal}\\b`, 'gi');
            enforced = enforced.replace(regex, formal);
        }
    }

    // Simulate "aggressiveDirectSimplify" if active
    if (profile.directness > 0.9) {
         // This logic is actually in paraphraseWithProfile but simulating the effect
    }

    return enforced;
}

const sampleText = "I really want to get help with my project because it is very hard to do.";

const profile = {
    formality: 0.8, // High formality triggers replacement
    directness: 0.5,
    pacing: 0.5,
    descriptiveness: 0.5,
    tone: 'Professional'
};

console.log("Original:", sampleText);

// 1. Test Heuristic Paraphrase (Local)
const heuristicResult = paraphraseWithProfile(sampleText, profile);
console.log("\nHeuristic Result:", heuristicResult);

// 2. Test Mocked Enforcement (Simulating the API post-processing)
const enforcedResult = mockEnforceStylePatterns(sampleText, profile);
console.log("\nMocked Enforced Result (simulating robotic errors):", enforcedResult);

// Check for grammar errors introduced
if (enforcedResult.includes("obtain help")) console.log("-> Artifact: 'obtain help' (awkward)");
if (enforcedResult.includes("desire to obtain")) console.log("-> Artifact: 'desire to obtain' (robotic)");
