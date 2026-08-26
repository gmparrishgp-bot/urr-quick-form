import fs from 'node:fs/promises';
import vm from 'node:vm';
import { AutoProcessor, Qwen2VLForConditionalGeneration, RawImage } from '@huggingface/transformers';

const src=await fs.readFile('tests/trocr_regression.mjs','utf8');
const m=src.match(/const CASES = (\[[\s\S]*?\]);\nfunction norm/);if(!m)throw new Error('cases');
const CASES=vm.runInNewContext(m[1]);
function norm(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9.$]+/g,' ').replace(/\s+/g,' ').trim();}
function wer(a,b){a=norm(a).split(' ');b=norm(b).split(' ');const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]/Math.max(1,b.length);}

const model_id='onnx-community/Qwen2-VL-2B-Instruct';
console.log('Loading',model_id);
const processor=await AutoProcessor.from_pretrained(model_id);
const model=await Qwen2VLForConditionalGeneration.from_pretrained(model_id,{dtype:'q4',device:'cpu'});
let passes=0;
for(const c of CASES){
  const p=`/tmp/${c.name}.jpg`;await fs.writeFile(p,Buffer.from(c.data,'base64'));let image=await RawImage.read(p);image=await image.resize(896,-1);
  const messages=[{role:'user',content:[{type:'image'},{type:'text',text:'Read this cropped handwritten RV repair row. Output ONLY the handwriting visible in the row. Preserve the repair description, dollar amount, decimal labor time, and HR. Do not explain or infer. Preserve abbreviations DS, ODS, WBP, LP, WH.'}]}];
  const prompt=processor.apply_chat_template(messages,{add_generation_prompt:true});
  const inputs=await processor(prompt,image);
  const outputs=await model.generate({...inputs,max_new_tokens:64,do_sample:false});
  const decoded=processor.batch_decode(outputs.slice(null,[inputs.input_ids.dims.at(-1),null]),{skip_special_tokens:true});
  const got=(decoded?.[0]||'').trim();const e=wer(got,c.expected);const pass=e<=.35;if(pass)passes++;
  console.log(JSON.stringify({name:c.name,expected:c.expected,got,wer:+e.toFixed(3),pass}));
}
console.log(`SUMMARY ${passes}/${CASES.length} pass`);if(passes<2)process.exit(2);
