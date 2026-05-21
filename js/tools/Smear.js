window.PaintTools = window.PaintTools || {};

window.PaintTools['smear'] = function(ctx, x, y, size, intensity, hardness, layerCanvas) {
    const now = Date.now();
    if (!window._smearLastTime || now - window._smearLastTime > 150) {
        window._smearLastX = x;
        window._smearLastY = y;
    }
    window._smearLastTime = now;
    
    const prevX = window._smearLastX;
    const prevY = window._smearLastY;
    window._smearLastX = x;
    window._smearLastY = y;
    
    if (Math.abs(x - prevX) < 0.1 && Math.abs(y - prevY) < 0.1) return null;
    
    const radius = Math.floor(size / 2);
    
    const minX = Math.floor(Math.min(prevX, x) - radius);
    const minY = Math.floor(Math.min(prevY, y) - radius);
    const maxX = Math.ceil(Math.max(prevX, x) + radius);
    const maxY = Math.ceil(Math.max(prevY, y) + radius);
    
    const cStartX = Math.max(0, minX);
    const cStartY = Math.max(0, minY);
    const cW = Math.min(layerCanvas.width, maxX) - cStartX;
    const cH = Math.min(layerCanvas.height, maxY) - cStartY;
    
    if (cW <= 0 || cH <= 0) return null;
    
    const imgData = ctx.getImageData(cStartX, cStartY, cW, cH);
    const data = imgData.data;
    const outData = new Uint8ClampedArray(data);
    
    const smearPower = (intensity / 100);
    
    for (let py = 0; py < cH; py++) {
        for (let px = 0; px < cW; px++) {
            const worldX = cStartX + px;
            const worldY = cStartY + py;
            
            const dx = worldX - x;
            const dy = worldY - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > radius) continue;
            
            const srcWorldX = worldX - (x - prevX);
            const srcWorldY = worldY - (y - prevY);
            
            const sx = Math.round(srcWorldX) - cStartX;
            const sy = Math.round(srcWorldY) - cStartY;
            
            if (sx >= 0 && sx < cW && sy >= 0 && sy < cH) {
                const sIdx = (sy * cW + sx) * 4;
                const dIdx = (py * cW + px) * 4;
                
                const sA = data[sIdx+3];
                if (sA === 0) continue; 
                
                const falloff = 1 - Math.max(0, (dist - radius * (hardness/100)) / (radius * (1 - hardness/100) + 0.001));
                const blend = smearPower * falloff;
                
                const dA = data[dIdx+3];
                
                const outA = sA * blend + dA * (1 - blend);
                if (outA > 0) {
                    outData[dIdx]   = (data[sIdx] * sA * blend + data[dIdx] * dA * (1 - blend)) / outA;
                    outData[dIdx+1] = (data[sIdx+1] * sA * blend + data[dIdx+1] * dA * (1 - blend)) / outA;
                    outData[dIdx+2] = (data[sIdx+2] * sA * blend + data[dIdx+2] * dA * (1 - blend)) / outA;
                }
                outData[dIdx+3] = outA;
            }
        }
    }
    
    imgData.data.set(outData);
    ctx.putImageData(imgData, cStartX, cStartY);
    
    return { x: cStartX, y: cStartY, w: cW, h: cH };
};
