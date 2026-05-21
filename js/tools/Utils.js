window.PaintUtils = {
    getRadialGradient: function(ctx, x, y, radius, colorHex, hardness) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        
        let r=0, g=0, b=0, a=1;
        if (colorHex.startsWith('rgba')) {
            const parts = colorHex.substring(5, colorHex.length-1).split(',');
            r = parseInt(parts[0].trim()); 
            g = parseInt(parts[1].trim()); 
            b = parseInt(parts[2].trim()); 
            a = parseFloat(parts[3].trim());
        } else {
            // Very simple hex to rgb (without Three.js dependency just in case)
            if (colorHex.startsWith('#')) {
                const hex = colorHex.substring(1);
                r = parseInt(hex.substring(0,2), 16);
                g = parseInt(hex.substring(2,4), 16);
                b = parseInt(hex.substring(4,6), 16);
            }
        }

        const stopPoint = Math.max(0.001, hardness / 100);
        
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        if (stopPoint < 1) {
            grad.addColorStop(stopPoint, `rgba(${r},${g},${b},${a})`);
        }
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        
        return grad;
    }
};
