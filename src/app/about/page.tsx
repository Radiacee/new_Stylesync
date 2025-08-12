export default function AboutPage() {
  return (
    <div className="prose prose-invert max-w-3xl">
      <h1>About Stylesync</h1>
      <p>Stylesync is an experimental interface for exploring personalized, ethical paraphrasing. It creates a lightweight style profile based on explicit answers and sample text you provide. The profile is stored locally in your browser for this prototype.</p>
      <h2>Responsible Use</h2>
      <ul>
        <li>Disclose AI assistance when sharing output.</li>
        <li>Do not attempt to use this project to evade detection or academic integrity policies.</li>
        <li>Respect copyright & originality of source materials.</li>
      </ul>
      <h2>Extending</h2>
      <p>Swap the heuristic paraphraser with an LLM call and use the style profile fields as system / style directives. Add authentication + encrypted storage for multi-device sync. Evaluate outputs for faithfulness and bias.</p>
    </div>
  );
}
