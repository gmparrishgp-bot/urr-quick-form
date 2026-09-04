import { pipeline, RawImage } from '@huggingface/transformers';

const reader = await pipeline('image-to-text', 'Xenova/trocr-base-handwritten', { dtype: 'q8' });
const image = await RawImage.read('./tests/01.jpg');
const result = await reader(image, { max_new_tokens: 60 });
const item = Array.isArray(result) ? result[0] : result;
const text = String(item?.generated_text || '').trim();
console.log('TROCR_OUTPUT=' + text);
const norm = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const required = ['roof','spot','seal'];
const matched = required.filter(w => norm.includes(w));
console.log('MATCHED=' + matched.join(','));
if (!norm.includes('roof') || matched.length < 2) {
  console.error('Regression failed: expected recognizable ROOF SPOT SEAL handwriting.');
  process.exit(1);
}
console.log('OCR_REGRESSION_PASS');
