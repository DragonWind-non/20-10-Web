import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PropDelivery, sampleDelivery } from '../public/js/prop-delivery.js';
import { CONFIG } from '../public/config.js';

for(let time=-.1;time<30;time+=.01) {
  for(const value of Object.values(sampleDelivery(time))) assert(Number.isFinite(value) && value>=-1e-10 && value<=1+1e-10);
}
assert.equal(sampleDelivery(.55).travel,0);
assert.equal(sampleDelivery(2.6).travel,1);
assert.equal(sampleDelivery(3.25).lift,0,'Do not produce the keepsake before reaching the prop');
assert.equal(sampleDelivery(3.8).approach,0,'Pick up the keepsake before bringing it to the viewer');
assert.equal(sampleDelivery(6.8).offer,1);
for(const gift of Object.values(CONFIG.gifts)) {
  const text=[gift.opening,...CONFIG.giftWishes,gift.ending].join(' ');
  assert(text.includes('20/10'));
  assert(text.split(/\s+/).length>=300,'The keepsake must contain a full letter');
}
const originalPassages=[2,3,4,5].map(stage=>[CONFIG.seasons[`stage${stage}`].poem,CONFIG.seasons[`stage${stage}`].wish]);
assert.equal(createHash('sha256').update(JSON.stringify(originalPassages)).digest('hex'),
  '3b2d8ad10ad1b4014fd67d917647b81451137281fa68968480ae8cbc786645aa',
  'The four poems and their following wishes must remain exactly as requested');
const oldAddress=/(?<!\p{L})(anh|em|tớ|cậu)(?!\p{L})/iu;
for(const season of Object.values(CONFIG.seasons)) {
  assert(!oldAddress.test(season.dialogue));
  assert(!oldAddress.test(season.climaxWish||''));
}
assert.equal(CONFIG.recipientName,'các bạn nữ');
for(const text of CONFIG.wishesStream) assert(!oldAddress.test(text));
globalThis.document={createElement:()=>({textContent:''})};
for(const stage of [1,2,3,4,5]) {
  let paragraphs=[];
  const body={replaceChildren:(...nodes)=>paragraphs=nodes.map(n=>n.textContent)};
  const heading={focus:()=>{}};
  const delivery=Object.assign(Object.create(PropDelivery.prototype),{
    app:{motionQuery:{matches:true}},prop:{stage},revealed:false,
    dialog:{querySelector:selector=>selector==='h2'?heading:body,showModal:()=>{}}
  });
  delivery.showLetter();
  assert(paragraphs[0]==='Gửi các bạn nữ,');
  assert(!oldAddress.test(paragraphs.join(' ')), 'Every delivered letter must use the new address');
  assert(body.scrollTop===0);
}
console.log('PASS: choreography, five full letters addressed to women, four original poems and wishes preserved');
