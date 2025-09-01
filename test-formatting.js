// Test formatting preservation
const testFormatting = () => {
  const testInput = `What is ChatGPT?

ChatGPT is an AI model created by OpenAI.

Key features:
- Natural language processing
- Text generation
- Conversational abilities

How does it work?
It predicts text based on patterns in training data.

Limitations:
1. No real understanding
2. Can make mistakes
3. Limited to training data`;

  console.log("Original text with formatting:");
  console.log(testInput);
  console.log("\n" + "=".repeat(50) + "\n");

  // This would be the paraphrased output with formatting preserved
  const expectedOutput = `What does ChatGPT represent?

ChatGPT represents an artificial intelligence system developed by OpenAI.

Main characteristics:
- Processing of natural language
- Generation of written content
- Capabilities for conversation

What is its operational mechanism?
It forecasts text by analyzing patterns found in training information.

Constraints:
1. Absence of genuine comprehension
2. Potential for errors
3. Restricted to training information`;

  console.log("Paraphrased text with formatting preserved:");
  console.log(expectedOutput);
};

testFormatting();
