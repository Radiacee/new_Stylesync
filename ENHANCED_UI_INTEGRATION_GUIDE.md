# Step 5: Enhanced Style Analysis UI - Implementation Guide

## Overview
This document explains how to integrate the new `EnhancedStyleComparisonPanel` component with the structured metrics data returned by the enhanced API endpoint.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Component                       │
│              (e.g., StylePageOrParaphrase)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          useStructuredComparison() Hook                      │
│   (src/hooks/useStructuredComparison.ts)                    │
│                                                             │
│  - Manages comparison state (data, loading, error)          │
│  - Calls: POST /api/style-comparison                       │
│  - Returns: StructuredStyleComparison data                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          API Endpoint: /api/style-comparison               │
│   (src/app/api/style-comparison/route.ts)                  │
│                                                             │
│  - Accepts: userSampleText, originalText, paraphrasedText  │
│  - Parameter: structured=true (to use new format)          │
│  - Calls: calculateStructuredStyleSimilarity()             │
│  - Returns: { structured: StructuredStyleComparison }      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│       calculateStructuredStyleSimilarity()                  │
│   (src/lib/styleComparison.ts)                             │
│                                                             │
│  - Input: userSample, original, paraphrased texts         │
│  - Extracts: 5 MetricGroups with 14 total metrics         │
│  - Calculates: Alignment ratings, percent differences      │
│  - Output: StructuredStyleComparison object               │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  (Advanced Metrics)        (Existing Functions)
  - Lexical Density         - analyzeText()
  - Sentence Variety        - analyzeSampleStyle()
  - Paragraph Variety       - calculateAlignmentScore()
        │                         │
        └────────────┬────────────┘
                     ▼
        (Metric values & alignment data)
```

## Data Flow Example

### 1. Component Usage

```typescript
import EnhancedStyleComparisonPanel from '@/components/EnhancedStyleComparisonPanel';
import { useStructuredComparison } from '@/hooks/useStructuredComparison';

export default function MyComponent() {
  const { comparison, loading, error, fetchComparison } = useStructuredComparison();

  // After paraphrasing is complete, fetch metrics
  const handleParaphraseComplete = async (original: string, paraphrased: string) => {
    await fetchComparison(userSample, original, paraphrased);
  };

  return (
    <div>
      {loading && <div>Loading analysis...</div>}
      {error && <div className="text-red-400">Error: {error}</div>}
      {comparison && (
        <EnhancedStyleComparisonPanel comparison={comparison} />
      )}
    </div>
  );
}
```

### 2. Hook Execution

The hook sends a POST request to `/api/style-comparison`:

```json
{
  "userSampleText": "The quick brown fox...",
  "originalText": "The quick brown fox jumps over the lazy dog...",
  "paraphrasedText": "Swift auburn fox leaps across the sluggish canine...",
  "structured": true
}
```

### 3. API Processing

The endpoint calls `calculateStructuredStyleSimilarity()` which returns:

```json
{
  "overallSimilarity": 0.82,
  "metricGroups": [
    {
      "groupName": "Structural Analysis",
      "description": "Sentence length, variety, and text density patterns",
      "metrics": [
        {
          "name": "Average Sentence Length",
          "original": 18,
          "paraphrased": 20,
          "target": 18,
          "alignment": "good",
          "percentDifference": 11,
          "explanation": "Paraphrased sentences are slightly longer..."
        },
        // ... more metrics
      ]
    },
    // ... more groups (Vocabulary, Sentence Style, Tone, Descriptiveness)
  ],
  "summary": "Excellent style preservation (82%): Your paraphrasing maintained most of your original writing patterns..."
}
```

### 4. UI Rendering

The `EnhancedStyleComparisonPanel` renders:

1. **Header Section**
   - Title: "Style Analysis Report"
   - Overall Match % (82%)
   - Summary text

2. **5 Collapsible Metric Groups**
   - Structural Analysis
   - Vocabulary & Complexity
   - Sentence Style & Flow
   - Tone & Formality
   - Descriptiveness & Detail

3. **For Each Metric**
   - Metric name
   - Alignment badge (✓ Excellent, ✓ Good, ~ Fair, ✗ Poor)
   - 3-column value display: Your Style | Original | Paraphrased
   - Percent difference indicator
   - Explanation text

4. **Footer Legend**
   - Color-coded alignment thresholds

## Integration Steps

### Step 1: Import the New Components
In any page that needs the enhanced analysis:

```typescript
import EnhancedStyleComparisonPanel from '@/components/EnhancedStyleComparisonPanel';
import { useStructuredComparison } from '@/hooks/useStructuredComparison';
```

### Step 2: Initialize the Hook
```typescript
const { comparison, loading, error, fetchComparison } = useStructuredComparison();
```

### Step 3: Call After Paraphrasing
```typescript
// After successful paraphrasing
await fetchComparison(userSample, originalText, paraphrasedText);
```

### Step 4: Render the Panel
```typescript
{comparison && <EnhancedStyleComparisonPanel comparison={comparison} />}
```

## File Locations

| File | Purpose |
|------|---------|
| `src/components/EnhancedStyleComparisonPanel.tsx` | New UI component with collapsible metric groups |
| `src/hooks/useStructuredComparison.ts` | Hook to fetch structured comparison data |
| `src/app/api/style-comparison/route.ts` | Updated API endpoint (backward compatible) |
| `src/lib/styleComparison.ts` | `calculateStructuredStyleSimilarity()` function |
| `src/lib/deepStyleMatch.ts` | New metric helpers (lexical density, variety) |
| `src/lib/paraphrase.ts` | Updated `analyzeSingleSample()` with new metrics |

## Metric Groups Explained

### 1. Structural Analysis
- **Average Sentence Length**: Words per sentence (target ~18)
- **Sentence Length Variety**: Std dev of sentence word counts (variety indicator)
- **Lexical Density**: Content word ratio (0-1, higher = more formal)

### 2. Vocabulary & Complexity
- **Complexity %**: Longer words (7+ letters) ratio
- **Average Word Length**: Words' character count
- **Contractions**: Casual/informal indicator

### 3. Sentence Style & Flow
- **Compound Sentences %**: Multi-clause sentences
- **Transition Words**: Discourse markers (however, therefore, etc.)
- **Question Usage**: Rhetorical question percentage

### 4. Tone & Formality
- **Formality Level**: High/Medium/Low rating
- **Exclamation Usage**: Emotional intensity
- **Personal Voice**: First-person pronoun usage

### 5. Descriptiveness & Detail
- **Adjective Density**: Descriptive word ratio
- **Adverb Density**: Manner/quality word ratio

## Alignment Scoring

| Alignment | Threshold | Color | Icon |
|-----------|-----------|-------|------|
| Excellent | < 5% difference | Green | ✓ |
| Good | 5-15% difference | Blue | ✓ |
| Fair | 15-30% difference | Yellow | ~ |
| Poor | > 30% difference | Red | ✗ |

## Styling Features

- **Dark Theme**: Integrates with existing dark mode
- **Collapsible Sections**: All 5 groups expand/collapse independently
- **Color Coding**: Visual indicators for alignment quality
- **Responsive Grid**: 3-column layout for value comparison
- **Hover Effects**: Subtle transitions and interactive feedback
- **Legend**: Footer explains all color codes

## Advanced Usage

### Customizing Colors
Edit the `getAlignmentColor()` function in `EnhancedStyleComparisonPanel.tsx`:

```typescript
const getAlignmentColor = (alignment) => {
  switch (alignment) {
    case 'excellent': return 'bg-green-900/20 border-green-500/30 text-green-400';
    // Modify these Tailwind classes as needed
  }
};
```

### Expanding/Collapsing Groups Programmatically
```typescript
// In parent component, pass ref if needed
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
  new Set(comparison.metricGroups.map(g => g.groupName))
);
```

### Adding Tooltips to Explanations
Wrap explanation text in a tooltip component:

```typescript
import { Tooltip } from '@/components/Tooltip';

<Tooltip content={metric.explanation}>
  <p className="text-xs text-slate-400 cursor-help">
    {metric.explanation}
  </p>
</Tooltip>
```

## Backward Compatibility

The updated API endpoint supports both formats:

**Legacy (old format):**
```typescript
// No `structured` parameter or structured=false
const response = await fetch('/api/style-comparison', {
  method: 'POST',
  body: JSON.stringify({
    userSampleText,
    originalText,
    paraphrasedText
  })
});
// Returns: { transformation: StyleTransformation }
```

**New (structured format):**
```typescript
// With structured=true
const response = await fetch('/api/style-comparison', {
  method: 'POST',
  body: JSON.stringify({
    userSampleText,
    originalText,
    paraphrasedText,
    structured: true
  })
});
// Returns: { structured: StructuredStyleComparison }
```

## Testing the Integration

1. **Test the Hook**
   ```typescript
   const { comparison, loading, error, fetchComparison } = useStructuredComparison();
   await fetchComparison(sample, original, paraphrased);
   expect(comparison).toHaveProperty('metricGroups');
   ```

2. **Test the Component**
   ```typescript
   render(<EnhancedStyleComparisonPanel comparison={mockComparison} />);
   expect(screen.getByText('Style Analysis Report')).toBeInTheDocument();
   ```

3. **Test API Endpoint**
   ```bash
   curl -X POST http://localhost:3000/api/style-comparison \
     -H "Content-Type: application/json" \
     -d '{
       "userSampleText": "Sample text",
       "originalText": "Original text",
       "paraphrasedText": "Paraphrased text",
       "structured": true
     }'
   ```

## Performance Considerations

- **Calculation Speed**: `calculateStructuredStyleSimilarity()` typically completes in 50-150ms
- **API Response Time**: Usually < 200ms (plus network latency)
- **Component Rendering**: Collapsible groups render efficiently with React
- **State Management**: Hook uses `useCallback` to prevent unnecessary re-renders

## Future Enhancements

1. **Export Functionality**: Download analysis as PDF/JSON
2. **Historical Tracking**: Compare multiple paraphrasing attempts
3. **Advanced Filters**: Filter metrics by importance or category
4. **Custom Thresholds**: Let users set their own alignment targets
5. **Metric Explanations**: Hover tooltips explaining each metric
6. **Diff Highlighting**: Show exact differences in the text

## Troubleshooting

**Issue**: Component shows "Error: Missing structured data"
- **Solution**: Ensure API endpoint has `structured: true` parameter

**Issue**: Metrics showing 0 or NaN values
- **Solution**: Verify input texts are non-empty and valid strings

**Issue**: Slow performance
- **Solution**: Calculation is CPU-bound; consider moving to Web Worker for very large texts

**Issue**: Styling looks off
- **Solution**: Ensure Tailwind CSS is properly configured with `text-slate-*` color palette

## Summary

The new Enhanced Style Analysis UI provides users with:
- ✅ Detailed 14-metric breakdown across 5 categories
- ✅ Alignment scoring for each metric (excellent/good/fair/poor)
- ✅ Overall similarity percentage (0-100%)
- ✅ Human-readable explanations for each metric
- ✅ Collapsible interface for easy navigation
- ✅ Color-coded visual feedback
- ✅ Full backward compatibility with legacy code

This completes **Step 5: Build the New UI Panel** and fulfills the MVP requirements for the comprehensive style analysis engine enhancement.
