window.PaintTools = window.PaintTools || {};

window.PaintTools['brush'] = function(ctx, x, y, size, intensity, hardness, color) {
    const radius = size / 2;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = intensity / 100;
    ctx.fillStyle = window.PaintUtils.getRadialGradient(ctx, x, y, radius, color, hardness);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    // Return dirty rectangle bounding box
    return { x: x - radius - 2, y: y - radius - 2, w: size + 4, h: size + 4 };
};
