
(function(global){
  function cap(s){ return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : ''; }
  function chestLabel(r){ return ({green:'Green',blue:'Blue',purple:'Purple',orange:'Orange',red:'Red',rainbow:'Rainbow'})[r] || cap(r) || 'Chest'; }
  function upgradeLabel(r){ return ({blue:'Blue',purple:'Purple',orange:'Gold',red:'Red',rainbow:'Rainbow'})[r] || cap(r) || 'Upgrade'; }
  function toneForUpgrade(r){ return ({blue:'blue',purple:'purple',orange:'gold',red:'red',rainbow:'gold'})[r] || 'blue'; }
  function cardTileCount(tile){ return Math.max(1, Math.min(3, Number.isFinite(tile?.cardCount) ? tile.cardCount : 1)); }

  function tileLabel(tile, spent){
    if(spent) return 'Empty';
    if(!tile) return 'Empty';
    switch(tile.type){
      case 'start': return 'Start';
      case 'chest': return chestLabel(tile.rarity);
      case 'trap': return 'Trap';
      case 'movement': return Number.isFinite(tile.fixedN) ? ('Move +' + tile.fixedN) : (cardTileCount(tile) + ' Card' + (cardTileCount(tile) === 1 ? '' : 's'));
      case 'upgrade': return upgradeLabel(tile.fixedFrom);
      case 'life': return Number.isFinite(tile.fixedN) ? ('+' + tile.fixedN + ' Life') : 'Life';
      case 'question': return 'Mystery';
      default: return 'Empty';
    }
  }

  function tileClasses(tile, ctx){
    const parts = ['tile'];
    const spent = !!ctx.spent && !ctx.isCurrent;
    const baseType = spent ? 'empty' : (tile?.type || 'empty');
    parts.push('type-' + baseType);
    if(baseType === 'movement') parts.push('type-movement');
    if(baseType === 'upgrade') parts.push('type-upgrade');
    if(baseType === 'question') parts.push('type-question');
    if(baseType === 'trap') parts.push('type-trap');
    if(baseType === 'life') parts.push('type-life');
    if(baseType === 'start') parts.push('type-start');
    if(baseType === 'empty') parts.push('type-empty');
    if(tile?.rarity && !spent) parts.push('rarity-' + tile.rarity, tile.rarity);
    if(baseType === 'upgrade' && !spent) parts.push('tone-' + toneForUpgrade(tile.fixedFrom));
    if(baseType === 'movement' && !spent) parts.push('tone-yellow');
    if(ctx.spent && !ctx.isCurrent) parts.push('done');
    if(ctx.visit >= 0) parts.push('landed');
    if(ctx.isCurrent) parts.push('pos');
    if(ctx.isReach) parts.push('reach');
    if(ctx.isPending) parts.push('pendingPreview');
    if(ctx.isSuggest) parts.push('suggest');
    return parts.join(' ');
  }

  function iconHtml(tile, ctx){
    const spent = !!ctx.spent && !ctx.isCurrent;
    if(ctx.isCurrent) return '<span class="tileArt currentPosArt" aria-hidden="true"></span>';
    if(spent || !tile || tile.type === 'empty') return '<span class="tileArt emptyArt">✧</span>';
    switch(tile.type){
      case 'start':
        return '<span class="tileArt startArt"></span>';
      case 'chest':
        return '<span class="tileArt chestArt"><span class="lid"></span><span class="body"></span><span class="lock"></span></span>';
      case 'movement':
        return '<span class="tileArt cardArt moveArt"><span class="cardStep">' + (Number.isFinite(tile.fixedN) ? ('+' + tile.fixedN) : ('×' + cardTileCount(tile))) + '</span></span>';
      case 'upgrade':
        return '<span class="tileArt cardArt upgradeArt"><span class="cardGlyph">⇧</span></span>';
      case 'life':
        return '<span class="tileArt lifeArt"><span>♥</span><em>' + (Number.isFinite(tile.fixedN) ? ('+' + tile.fixedN) : '+') + '</em></span>';
      case 'question':
        return '<span class="tileArt questionArt">?</span>';
      case 'trap':
        return '<span class="tileArt trapArt">◆</span>';
      default:
        return '<span class="tileArt emptyArt">✧</span>';
    }
  }

  function tileHtml(tile, i, ctx){
    const label = tileLabel(tile, ctx.spent && !ctx.isCurrent);
    const land = ctx.visit >= 0 ? '<span class="land">' + (ctx.visit + 1) + '</span>' : '';
    const title = (i + 1) + ': ' + label;
    return '<button class="' + tileClasses(tile, ctx) + '" onclick="clickTile(' + i + ')" title="' + title.replace(/"/g, '&quot;') + '">' +
      '<span class="n">' + (i + 1) + '</span>' +
      iconHtml(tile, ctx) +
      '<span class="label">' + label + '</span>' +
      land +
    '</button>';
  }

  function render(args){
    const state = args.state;
    const total = args.totalTiles || (state?.tiles?.length || 0);
    const targets = Array.isArray(args.targets) ? args.targets : [];
    const pendingMove = args.pendingMove || null;
    const suggested = args.suggested || null;
    if(!state || !Array.isArray(state.tiles)) return '';
    const rows = [];
    const rowCount = Math.ceil(state.tiles.length / 4);
    for(let r = 0; r < rowCount; r++){
      const start = r * 4;
      const reverse = r % 2 === 1;
      const rowItems = state.tiles.slice(start, start + 4).map((t, off) => ({ t, i: start + off }));
      const cells = rowItems.map(({ t, i }) => {
        const visit = state.path.indexOf(i + 1);
        return tileHtml(t, i, {
          visit,
          spent: visit >= 0,
          isCurrent: i === state.pos,
          isReach: targets.includes(i),
          isPending: !!(pendingMove && i === pendingMove.idx),
          isSuggest: !!(suggested && i === suggested.idx)
        });
      }).join('');
      const connector = r < rowCount - 1 ? '<span class="rowConnector ' + (reverse ? 'left' : 'right') + '" aria-hidden="true"></span>' : '';
      rows.push('<div class="boardRow ' + (reverse ? 'reverse' : 'forward') + '">' + cells + connector + '</div>');
    }
    return rows.join('');
  }

  global.ArcanaBoard = { render };
})(window);
