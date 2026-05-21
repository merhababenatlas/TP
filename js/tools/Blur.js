window.PaintTools = window.PaintTools || {};

window.PaintTools['blur'] = function(ctx, x, y, size, intensity, hardness, layerCanvas) {
    const radius = Math.floor(size / 2);
    const startX = Math.floor(x - radius);
    const startY = Math.floor(y - radius);
    const w = radius * 2;
    const h = radius * 2;
    
    if (w <= 0 || h <= 0) return null;

    const cStartX = Math.max(0, startX);
    const cStartY = Math.max(0, startY);
    const cEndX = Math.min(layerCanvas.width, startX + w);
    const cEndY = Math.min(layerCanvas.height, startY + h);
    
    const cW = cEndX - cStartX;
    const cH = cEndY - cStartY;
    
    if (cW <= 0 || cH <= 0) return null;

    const imgData = ctx.getImageData(cStartX, cStartY, cW, cH);
    const data = imgData.data;
    const outData = new Uint8ClampedArray(data.length);
    
    const blurRadius = Math.max(1, Math.floor((intensity / 100) * (size / 6)));
    const temp = new Float32Array(cW * cH * 4);
    
    // Pass 1: Horizontal Blur (Alpha-weighted)
    for (let py = 0; py < cH; py++) {
        for (let px = 0; px < cW; px++) {
            let r=0, g=0, b=0, a=0, wSum=0;
            for (let k = -blurRadius; k <= blurRadius; k++) {
                const nx = px + k;
                if (nx >= 0 && nx < cW) {
                    const idx = (py * cW + nx) * 4;
                    const alpha = data[idx+3];
                    const weight = alpha / 255;
                    r += data[idx] * weight;
                    g += data[idx+1] * weight;
                    b += data[idx+2] * weight;
                    a += alpha;
                    wSum += weight;
                }
            }
            const idx = (py * cW + px) * 4;
            if (wSum > 0) {
                temp[idx] = r / wSum;
                temp[idx+1] = g / wSum;
                temp[idx+2] = b / wSum;
            }
            const taps = Math.min(cW - 1, px + blurRadius) - Math.max(0, px - blurRadius) + 1;
            temp[idx+3] = a / taps;
        }
    }
    
    // Pass 2: Vertical Blur (Alpha-weighted) & Masking
    for (let py = 0; py < cH; py++) {
        for (let px = 0; px < cW; px++) {
            const dx = (cStartX + px) - x;
            const dy = (cStartY + py) - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            const idx = (py * cW + px) * 4;
            
            if (dist > radius) {
                outData[idx] = data[idx];
                outData[idx+1] = data[idx+1];
                outData[idx+2] = data[idx+2];
                outData[idx+3] = data[idx+3];
                continue;
            }
            
            let r=0, g=0, b=0, a=0, wSum=0;
            for (let k = -blurRadius; k <= blurRadius; k++) {
                const ny = py + k;
                if (ny >= 0 && ny < cH) {
                    const tidx = (ny * cW + px) * 4;
                    const alpha = temp[tidx+3];
                    const weight = alpha / 255;
                    r += temp[tidx] * weight;
                    g += temp[tidx+1] * weight;
                    b += temp[tidx+2] * weight;
                    a += alpha;
                    wSum += weight;
                }
            }
            
            let br = data[idx], bg = data[idx+1], bb = data[idx+2], ba = data[idx+3];
            if (wSum > 0) {
                br = r / wSum;
                bg = g / wSum;
                bb = b / wSum;
            }
            const taps = Math.min(cH - 1, py + blurRadius) - Math.max(0, py - blurRadius) + 1;
            ba = a / taps;
            
            const falloff = 1 - Math.max(0, (dist - radius * (hardness/100)) / (radius * (1 - hardness/100) + 0.001));
            
            outData[idx] = data[idx] + (br - data[idx]) * falloff;
            outData[idx+1] = data[idx+1] + (bg - data[idx+1]) * falloff;
            outData[idx+2] = data[idx+2] + (bb - data[idx+2]) * falloff;
            outData[idx+3] = data[idx+3] + (ba - data[idx+3]) * falloff;
        }
    }
    
    imgData.data.set(outData);
    ctx.putImageData(imgData, cStartX, cStartY);
    
    return { x: cStartX, y: cStartY, w: cW, h: cH };
};
