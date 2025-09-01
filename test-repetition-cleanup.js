const testRepetitionCleanup = () => {
  // Test cases for repetition cleanup
  const testCases = [
    {
      input: "in other in other in other words",
      expected: "in other words"
    },
    {
      input: "the the data shows",
      expected: "the data shows"
    },
    {
      input: "for for the analysis",
      expected: "for the analysis"
    },
    {
      input: "This is a test. This is a test. This is a test.",
      expected: "This is a test."
    },
    {
      input: "data analysis data analysis reveals",
      expected: "data analysis reveals"
    }
  ];

  console.log("Testing repetition cleanup...");

  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}:`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: "${testCase.expected}"`);

    // Simulate the improved finalRepetitionCleanup function logic
    let cleaned = testCase.input;

    // Remove obvious word repetitions like "in other in other"
    cleaned = cleaned.replace(/\b(\w+)(\s+\1){1,}\b/gi, '$1');

    // Remove repetitive phrase patterns (2-3 words repeated)
    cleaned = cleaned.replace(/\b(\w+\s+\w+)(\s+\1){1,}\b/gi, '$1');
    cleaned = cleaned.replace(/\b(\w+\s+\w+\s+\w+)(\s+\1){1,}\b/gi, '$1');

    // Remove repetitive preposition patterns
    cleaned = cleaned.replace(/\b(in|on|at|for|with|by|to|from|of|as|at)\s+\1\b/gi, '$1');

    // Remove repetitive article + word patterns
    cleaned = cleaned.replace(/\b(the|a|an|this|that|these|those)\s+(\w+)\s+\1\s+\2\b/gi, '$1 $2');

    // Remove consecutive identical short phrases (sentence level)
    const phrases = cleaned.split(/([.!?]\s*)/);
    for (let i = 0; i < phrases.length - 2; i++) {
      if (phrases[i].trim() && phrases[i].trim().toLowerCase() === phrases[i + 2]?.trim().toLowerCase()) {
        phrases.splice(i + 2, 1);
        i--; // Adjust index
      }
    }
    cleaned = phrases.join('');

    // Clean up any resulting spacing issues
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    console.log(`Actual: "${cleaned}"`);
    console.log(`Match: ${cleaned === testCase.expected ? '✅' : '❌'}`);
  });
};

// Run the test
testRepetitionCleanup();
