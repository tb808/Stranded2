const fs=require('fs');let p='src/ui/HudView.ts',s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
s=s.replace(`    const projection = createMapProjection(model.islands, 320, 190);
    const ns = 'http://www.w3.org/2000/svg';`, `    const expanded = model.islands.some((island) => island.id === 'rieseninsel');
    this.map.dataset.expanded = String(expanded);
    this.mapSvg.setAttribute('viewBox', expanded ? '0 0 640 190' : '0 0 320 190');
    this.mapSvg.style.aspectRatio = expanded ? '640 / 190' : '320 / 190';
    const panels = expanded
      ? [{ islands: model.islands.filter((island) => island.id !== 'rieseninsel'), offset: 0, overview: false },
         { islands: model.islands, offset: 320, overview: true }]
      : [{ islands: model.islands, offset: 0, overview: false }];
    const ns = 'http://www.w3.org/2000/svg';
    for (const panel of panels) {
    const projection = createMapProjection(panel.islands, 320, 190);
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('transform', 'translate(' + panel.offset + ' 0)');
    layer.setAttribute('aria-label', panel.overview ? 'Fernreise zur Rieseninsel' : 'Bekanntes Archipel');
    this.mapSvg.append(layer);`);
// Only within the drawing body; the layer itself must still be appended to the SVG.
s=s.replace('this.mapSvg.append(ocean);','layer.append(ocean);').replace('this.mapSvg.append(north);','layer.append(north);')
.replace('for (const island of model.islands)', 'for (const island of panel.islands)')
.replace('this.mapSvg.append(shape);','layer.append(shape);\n      const title = document.createElementNS(ns, "title"); title.textContent = island.label; shape.append(title);')
.replace('this.mapSvg.append(label);',`if (!panel.overview || island.isCurrent || island.isStart || island.id === 'rieseninsel') layer.append(label);
      if (island.id === 'rieseninsel') {
        const lake = document.createElementNS(ns, 'ellipse');
        lake.setAttribute('cx', center.x.toFixed(2)); lake.setAttribute('cy', center.y.toFixed(2));
        lake.setAttribute('rx', projection.scaleLength(180).toFixed(2)); lake.setAttribute('ry', projection.scaleLength(135).toFixed(2));
        lake.setAttribute('fill', '#42a6b6'); layer.append(lake);
      }`)
.replace('this.mapSvg.append(player);','layer.append(player);\n    }');
fs.writeFileSync(p,s);
p='src/styles.css'; s=fs.readFileSync(p,'utf8');s += '\n.hud-map[data-expanded="true"] { width: clamp(28rem, 43vw, 36rem); max-width: calc(100vw - 2.8rem); }\n';fs.writeFileSync(p,s);
