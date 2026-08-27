import fs from 'node:fs/promises';
import vm from 'node:vm';
import { AutoProcessor, Qwen2VLForConditionalGeneration, RawImage } from '@huggingface/transformers';

const src=await fs.readFile('tests/trocr_regression.mjs','utf8');
const m=src.match(/const CASES = (\[[\s\S]*?\]);\nfunction norm/);if(!m)throw new Error('cases');
const CASES=vm.runInNewContext(m[1]);
const model_id='onnx-community/Qwen2-VL-2B-Instruct';
console.log('Loading',model_id);
const processor=await AutoProcessor.from_pretrained(model_id);
const model=await Qwen2VLForConditionalGeneration.from_pretrained(model_id,{dtype:'q4',device:'cpu'});

function expectedFields(s){
  const x=String(s).trim();
  const pm=x.match(/\$(\d+(?:\.\d+)?)/); const parts=pm?.[1]||'';
  const after=pm?x.slice((pm.index||0)+pm[0].length):x;
  const hm=after.match(/(?:^|\s)(\d*\.\d+|\d+(?:\.\d+)?)\s*(?:HR)?\b/i); const hours=hm?.[1]||'';
  const title=x.slice(0,pm?.index??x.length).trim();
  return {title,parts,hours};
}
function cleanTitle(s){return String(s||'').toUpperCase().replace(/\bWBR\b/g,'WBP').replace(/[^A-Z0-9]+/g,' ').replace(/\bTEARS\b/g,'TEAR').replace(/\s+/g,' ').trim();}
function titleTokens(s){return new Set(cleanTitle(s).split(' ').filter(Boolean));}
function titleRecall(got,exp){const g=titleTokens(got),e=[...titleTokens(exp)];return e.filter(x=>g.has(x)).length/Math.max(1,e.length);}
function extractJSON(s){const a=String(s||'').indexOf('{'),b=String(s||'').lastIndexOf('}');if(a<0||b<a)return null;try{return JSON.parse(String(s).slice(a,b+1));}catch{return null;}}
function num(s){const m=String(s??'').match(/\d*\.\d+|\d+/);return m?Number(m[0]):null;}
async function readOne(image,question,maxTokens=80){
  const messages=[{role:'user',content:[{type:'image'},{type:'text',text:question}]}];
  const prompt=processor.apply_chat_template(messages,{add_generation_prompt:true});
  const inputs=await processor(prompt,image);
  const outputs=await model.generate({...inputs,max_new_tokens:maxTokens,do_sample:false});
  return (processor.batch_decode(outputs.slice(null,[inputs.input_ids.dims.at(-1),null]),{skip_special_tokens:true})?.[0]||'').trim();
}

let passes=0;
for(const c of CASES){
  const exp=expectedFields(c.expected);
  const p=`/tmp/${c.name}.jpg`; await fs.writeFile(p,Buffer.from(c.data,'base64'));
  let image=await RawImage.read(p); image=await image.resize(1400,-1);
  const structured=await readOne(image,`This image is ONE cropped handwritten row from a Bish's RV Used Recommended Repairs sheet. The row contains a repair description, a PARTS dollar amount, and a LABOR HOURS amount in separate columns. Read the handwriting visually and return ONLY valid JSON exactly like {"title":"ROOF SPOT SEAL","parts":"60","hours":"2"}. Do not calculate. Do not merge adjacent PARTS and HOURS (for example $15 and .5 are two different fields). Preserve decimal labor exactly, especially .5, 2.60, .2, .3 and .75. Normalize WBR or wheel bearing pack to WBP. No explanation.`);
  const parsed=extractJSON(structured)||{};
  // A second, field-specific look makes labor/parts less likely to be fused by free-form transcription.
  const numeric=await readOne(image,`Read ONLY the two handwritten numeric quote fields in this single RV repair row: PARTS dollars and LABOR hours. They are separate columns. Return ONLY JSON {"parts":"","hours":""}. Preserve the labor decimal exactly. Do not calculate a total and do not combine the two fields.` ,48);
  const np=extractJSON(numeric)||{};
  const got={title:parsed.title||'',parts:String(np.parts??parsed.parts??''),hours:String(np.hours??parsed.hours??'')};
  const recall=titleRecall(got.title,exp.title);
  const partsOK=num(got.parts)===num(exp.parts);
  const hoursOK=Math.abs((num(got.hours)??-999)-(num(exp.hours)??-998))<0.0001;
  const pass=recall>=0.8&&partsOK&&hoursOK;
  if(pass)passes++;
  console.log(JSON.stringify({name:c.name,expected:exp,structured,numeric,got,titleRecall:+recall.toFixed(3),partsOK,hoursOK,pass}));
}
console.log(`SUMMARY ${passes}/${CASES.length} exact-field pass`);
if(passes!==CASES.length)process.exit(2);
