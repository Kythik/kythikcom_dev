const rows = [
  [
    {type:'start', label:'Start', cls:'pos'},
    {type:'movement', label:'Move Card'},
    {type:'question', label:'?'},
    {type:'chest', label:'Gold', rarity:'orange', link:'4→5'}
  ],
  [
    {type:'chest', label:'Purple', rarity:'purple'},
    {type:'trap', label:'Trap'},
    {type:'empty', label:'Empty'},
    {type:'life', label:'+Life', cls:'reach'}
  ],
  [
    {type:'upgrade', label:'Up Blue'},
    {type:'movement', label:'Move Card', cls:'suggest'},
    {type:'chest', label:'Red', rarity:'red'},
    {type:'empty', label:'Empty', land:5, link:'12→13'}
  ],
  [
    {type:'chest', label:'Green', rarity:'green'},
    {type:'question', label:'?'},
    {type:'chest', label:'Rainbow', rarity:'rainbow'},
    {type:'empty', label:'Empty'}
  ],
  [
    {type:'empty', label:'Empty'},
    {type:'movement', label:'Move Card'},
    {type:'upgrade', label:'Up Gold'},
    {type:'chest', label:'Blue', rarity:'blue'}
  ]
];

function tileClass(t){
  const parts = ['tile'];
  if(t.type === 'chest') parts.push('chest', t.rarity || 'green');
  else parts.push(t.type);
  if(t.cls) parts.push(t.cls);
  if(t.land) parts.push('landed');
  return parts.join(' ');
}
function render(){
  const board = document.getElementById('board');
  board.innerHTML = rows.map((row, rowIndex) => {
    const reverse = rowIndex % 2 === 1;
    const cells = row.map((t, i) => {
      const tileNum = rowIndex * 4 + i + 1;
      return `<button class="${tileClass(t)}">
        <span class="n">${tileNum}</span>
        <span class="c">${t.label}</span>
        ${t.land ? `<span class="land">${t.land}</span>` : ''}
      </button>`;
    }).join('');
    const link = row[row.length-1]?.link || row[0]?.link;
    const linkHtml = link ? `<span class="rowEndLink ${reverse ? 'left' : ''}">${link}</span>` : '';
    return `<div class="boardRow ${reverse ? 'reverse' : ''}">${cells}${linkHtml}</div>`;
  }).join('');
}
render();
