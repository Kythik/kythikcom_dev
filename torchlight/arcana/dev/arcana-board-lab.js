// Arcana Board Dev Lab v4
// Deterministic 20-row visual QA board. Board-only sandbox; no production code.

const samplePattern = [
  { type:'start', label:'Start', icon:'✦', cls:'pos' },
  { type:'move', label:'Move +1', step:'+1', tone:'teal' },
  { type:'question', label:'Unknown', icon:'?' },
  { type:'life', label:'+1 Life', step:'+1', link:'4 ➜ 5' },

  { type:'move', label:'Move +2', step:'+2', tone:'teal' },
  { type:'empty', label:'Quiet', icon:'✧' },
  { type:'trap', label:'Trap', icon:'◆' },
  { type:'chest', label:'Green', rarity:'green', chest:'green', link:'8 ➜ 9' },

  { type:'question', label:'Mystery', icon:'?' },
  { type:'empty', label:'Quiet', icon:'✧' },
  { type:'life', label:'+1 Life', step:'+1' },
  { type:'empty', label:'Quiet', icon:'✧', cls:'done', link:'12 ➜ 13' },

  { type:'move', label:'Move +3', step:'+3', tone:'rose' },
  { type:'empty', label:'Quiet', icon:'✧' },
  { type:'upgrade', label:'Up Blue', step:'Up', tone:'blue' },
  { type:'chest', label:'Blue', rarity:'blue', chest:'blue', link:'16 ➜ 17' },

  { type:'chest', label:'Purple', rarity:'purple', chest:'purple' },
  { type:'upgrade', label:'Up Purple', step:'Up', tone:'purple' },
  { type:'trap', label:'Trap', icon:'◆', cls:'suggest' },
  { type:'chest', label:'Orange', rarity:'orange', chest:'orange', link:'20 ➜ 21' },

  { type:'upgrade', label:'Up Blue', step:'Up', tone:'blue' },
  { type:'upgrade', label:'Up Gold', step:'Up', tone:'gold' },
  { type:'chest', label:'Red', rarity:'red', chest:'red' },
  { type:'chest', label:'Rainbow', rarity:'rainbow', chest:'rainbow', link:'24 ➜ 25' },

  { type:'trap', label:'Trap', icon:'◆' },
  { type:'move', label:'Back +1', step:'+1', tone:'violet', variant:'back' },
  { type:'move', label:'Back +2', step:'+2', tone:'violet', variant:'back', cls:'reach', land:2 },
  { type:'move', label:'Back +3', step:'+3', tone:'violet', variant:'back', land:5, link:'28 ➜ 29' },

  { type:'empty', label:'Rune', icon:'✦' },
  { type:'life', label:'Life+', step:'+1', plus:true },
  { type:'move', label:'Move +1+', step:'+1', tone:'teal', plus:true },
  { type:'question', label:'Mystery+', icon:'?', plus:true, link:'32 ➜ 33' }
];

function buildRows(rowCount = 20, cols = 4){
  const rows = [];
  for(let r = 0; r < rowCount; r++){
    const row = [];
    for(let c = 0; c < cols; c++){
      const idx = (r * cols + c) % samplePattern.length;
      const tile = {...samplePattern[idx]};
      tile.num = r * cols + c + 1;
      if(r > 0 && idx === 0) tile.type = 'empty', tile.label = 'Quiet', tile.icon = '✧', tile.cls = '';
      if(c === cols - 1) tile.link = tile.link || `${tile.num} ➜ ${tile.num + 1}`;
      row.push(tile);
    }
    rows.push(row);
  }
  return rows;
}

const rows = buildRows(20, 4);

function tileClass(t){
  const parts = ['tile', `type-${t.type}`];
  if(t.rarity) parts.push(`rarity-${t.rarity}`);
  if(t.tone) parts.push(`tone-${t.tone}`);
  if(t.plus) parts.push('is-plus');
  if(t.variant) parts.push(`variant-${t.variant}`);
  if(t.cls) parts.push(...String(t.cls).split(/\s+/).filter(Boolean));
  if(t.land) parts.push('landed');
  return parts.join(' ');
}

function iconHtml(t){
  if(t.type === 'chest') return `<span class="tileArt chestArt"><span class="lid"></span><span class="body"></span><span class="lock"></span></span>`;
  if(t.type === 'move' || t.type === 'upgrade') return `<span class="tileArt cardArt"><span class="cardGlyph">${t.type === 'upgrade' ? '⇧' : '↟'}</span><span class="cardStep">${t.step || ''}</span></span>`;
  if(t.type === 'life') return `<span class="tileArt lifeArt"><span>♥</span><em>${t.step || ''}</em></span>`;
  if(t.type === 'question') return `<span class="tileArt questionArt">?</span>`;
  if(t.type === 'trap') return `<span class="tileArt trapArt">◆</span>`;
  if(t.type === 'start') return `<span class="tileArt startArt">✦</span>`;
  return `<span class="tileArt emptyArt">${t.icon || '✧'}</span>`;
}

function render(){
  const board = document.getElementById('board');
  board.innerHTML = rows.map((row, rowIndex) => {
    const reverse = rowIndex % 2 === 1;
    const ordered = reverse ? [...row].reverse() : row;
    const cells = ordered.map((t) => `<button class="${tileClass(t)}" title="${t.num}: ${t.label}">
      <span class="n">${t.num}</span>
      ${iconHtml(t)}
      ${t.cls && String(t.cls).split(/\s+/).includes('pos') ? `<span class="currentMarker" aria-label="Current position"></span>` : ''}
      <span class="label">${t.label}</span>
      ${t.land ? `<span class="land">${t.land}</span>` : ''}
    </button>`).join('');
    const connectorHtml = rowIndex < rows.length - 1 ? `<span class="rowConnector ${reverse ? 'left' : 'right'}" aria-hidden="true"></span>` : '';
    return `<div class="boardRow ${reverse ? 'reverse' : ''}">${cells}${connectorHtml}</div>`;
  }).join('');
}

render();
