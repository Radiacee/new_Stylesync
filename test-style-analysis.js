// Test the enhanced style analysis functionality
import { analyzeSampleStyle } from '../src/lib/paraphrase.ts';

const testSample1 = `I'm really excited about this new feature! It's going to change everything. When users see how easy it is, they'll love it. However, we need to make sure the implementation is solid. The testing phase will be crucial.`;

const testSample2 = `The implementation of this feature represents a significant advancement in our product capabilities. We must ensure that the development process adheres to the highest standards. Therefore, comprehensive testing will be required before deployment.`;

console.log('=== Casual Style Analysis ===');
const casual = analyzeSampleStyle(testSample1);
console.log(JSON.stringify(casual, null, 2));

console.log('\n=== Formal Style Analysis ===');  
const formal = analyzeSampleStyle(testSample2);
console.log(JSON.stringify(formal, null, 2));
