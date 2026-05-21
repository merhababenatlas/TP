window.PaintTools = window.PaintTools || {};

window.PaintTools['eraser'] = function(ctx, x, y, size, intensity, hardness) {
    const radius = size / 2;
    
    // Eraser always draws a solid mask into the strokeCanvas.
    // The actual erasing (destination-out) happens during compositing in LayerManager/ThreeEngine.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = intensity / 100; // Will be 1.0 during stroke
    
    // Draw white mask (color doesn't matter, only alpha matters for destination-out mask)
    ctx.fillStyle = window.PaintUtils.getRadialGradient(ctx, x, y, radius, 'rgba(255,255,255,1)', hardness);
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 1.0;
    
    return { x: x - radius - 2, y: y - radius - 2, w: size + 4, h: size + 4 };
};
