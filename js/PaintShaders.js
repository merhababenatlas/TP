window.PaintShaders = {
    // Basic Vertex Shader for full-screen quad
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    // Brush Shader
    brushFragmentShader: `
        varying vec2 vUv;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uHardness;

        void main() {
            float dist = distance(vUv, uCenter);
            if (dist > uRadius) discard;
            
            float hardRadius = max(0.001, uRadius * uHardness);
            float alpha = 1.0;
            
            if (dist > hardRadius) {
                // Linear falloff for accurate soft brush
                alpha = 1.0 - ((dist - hardRadius) / (uRadius - hardRadius));
                alpha = clamp(alpha, 0.0, 1.0);
            }
            
            // Premultiplied alpha output
            float finalAlpha = alpha * uIntensity;
            gl_FragColor = vec4(uColor * finalAlpha, finalAlpha);
        }
    `,

    // Blur Shader (Single pass 9-tap pseudo-gaussian)
    blurFragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform float uIntensity;
        uniform float uHardness;
        uniform float uTexSize;

        void main() {
            vec4 original = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, uCenter);
            
            if (dist > uRadius) {
                gl_FragColor = original;
                return;
            }
            
            float hardRadius = max(0.001, uRadius * uHardness);
            float alpha = 1.0;
            if (dist > hardRadius) {
                alpha = 1.0 - ((dist - hardRadius) / (uRadius - hardRadius));
                alpha = clamp(alpha, 0.0, 1.0);
            }
            
            // Blur radius scales with intensity
            float blurSize = max(1.0, 5.0 * uIntensity);
            vec2 texel = vec2(blurSize / uTexSize);
            vec4 color = vec4(0.0);
            
            color += texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel) * 1.0;
            color += texture2D(tDiffuse, vUv + vec2(0.0, -1.0) * texel) * 2.0;
            color += texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * texel) * 1.0;
            
            color += texture2D(tDiffuse, vUv + vec2(-1.0, 0.0) * texel) * 2.0;
            color += texture2D(tDiffuse, vUv) * 4.0;
            color += texture2D(tDiffuse, vUv + vec2(1.0, 0.0) * texel) * 2.0;
            
            color += texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * texel) * 1.0;
            color += texture2D(tDiffuse, vUv + vec2(0.0, 1.0) * texel) * 2.0;
            color += texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * texel) * 1.0;
            
            color /= 16.0;
            
            gl_FragColor = mix(original, color, alpha * uIntensity);
        }
    `,

    // Smear Shader
    smearFragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform float uIntensity;
        uniform float uHardness;
        uniform vec2 uDirection;

        void main() {
            vec4 original = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, uCenter);
            
            if (dist > uRadius) {
                gl_FragColor = original;
                return;
            }
            
            float hardRadius = max(0.001, uRadius * uHardness);
            float alpha = 1.0;
            if (dist > hardRadius) {
                alpha = 1.0 - ((dist - hardRadius) / (uRadius - hardRadius));
                alpha = clamp(alpha, 0.0, 1.0);
            }
            
            // Smear pulls pixels from opposite of movement direction
            // uDirection is (currentMouse - lastMouse) in UV space
            // So we sample from UV - uDirection
            
            vec2 sampleUv = vUv - uDirection * alpha * uIntensity * 0.5; // Scale factor
            sampleUv = clamp(sampleUv, 0.0, 1.0);
            
            gl_FragColor = texture2D(tDiffuse, sampleUv);
        }
    `,

    // Composite Shader (For merging layers and rendering final texture)
    compositeFragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tLayer;
        uniform float uOpacity;

        void main() {
            vec4 layerColor = texture2D(tLayer, vUv);
            
            // We expect the layer to already contain premultiplied RGB
            // Multiply both RGB and Alpha by uOpacity to maintain premultiplication
            gl_FragColor = layerColor * uOpacity;
        }
    `,

    // Premultiply Shader (For loading straight alpha images into premultiplied RTs)
    premultiplyFragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tLayer;
        uniform float uOpacity;

        void main() {
            vec4 color = texture2D(tLayer, vUv);
            // Convert straight alpha to premultiplied alpha
            gl_FragColor = vec4(color.rgb * color.a * uOpacity, color.a * uOpacity);
        }
    `,

    // Unpack Shader (For Double-Wide PNG)
    unpackFragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tPacked;
        
        void main() {
            // Left side (0.0 to 0.5) has RGB, Right side (0.5 to 1.0) has Alpha in R channel
            vec4 rgbColor = texture2D(tPacked, vec2(vUv.x * 0.5, vUv.y));
            vec4 alphaColor = texture2D(tPacked, vec2(vUv.x * 0.5 + 0.5, vUv.y));
            
            // Reconstruct the exact RGBA that was saved (which is already premultiplied)
            gl_FragColor = vec4(rgbColor.rgb, alphaColor.r);
        }
    `
};
