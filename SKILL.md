# v6.6.0 Realism Enhancement System Documentation

## Overview

The Realism Prompt Enhancer is a **soft knowledge injection layer** that improves the photorealism of AI-generated video outputs without changing the existing system architecture, main pipeline modules, or field definitions.

## Core Design Philosophy

> **"Controlled imperfection is more real than perfection itself."**

AI-generated content typically suffers from "over-smoothing" - flawless skin, overly uniform lighting, lack of micro-details. This system introduces **controlled imperfections** to enhance realism.

## 7-Dimensional Quality Model

### 1. Camera Body (摄影机)
- **Primary**: `Arri Alexa 65`, `Arri Alexa Mini LF` (65mm large format sensor, shallow depth of field, cinematic dynamic range)
- **Secondary**: `RED V-RAPTOR`, `Sony Venice 2`
- **Auxiliary**: `65mm sensor`, `large format`, `IMAX 70mm`

### 2. Lens System (镜头)
- **Primary**: `Cooke S7/i` (warm, soft, vintage feel), `Arri Master Prime`
- **Secondary**: `Leica Summilux`, `Zeiss Otus`, `Panavision Primo`
- **Modifiers**: `anamorphic 2.39:1`, `widescreen cinematic`

### 3. Aperture & DOF (光圈)
- **Range**: `f/1.8` - `f/2.8` (shallow depth of field)
- **Modifiers**: `shallow DOF`, `soft bokeh`, `background falls off smoothly`
- **Avoid**: `f/8` - `f/16` (deep depth of field = AI look)

### 4. Lighting (光线)
- **Primary**: `natural diffused overcast` (overcast diffuse lighting, no hard shadows)
- **Modifiers**: `soft shadows`, `no hard light`
- **Avoid**: `studio lighting`, `perfect lighting`, `dramatic hard shadows`

### 5. Color Science (色彩)
- **Primary**: `muted desaturated earth tones`
- **Modifiers**: `teal shadows, warm highlights`, `cinematic LUT`
- **Avoid**: `highly saturated`, `vivid colors`, `colorful`

### 6. Material & Micro-Details (材质)
- **Primary**: `subsurface scattering`, `individual hair strands`, `skin pores visible`, `fabric weave texture`
- **Auxiliary**: `subtle imperfections`, `microscopic surface detail`
- **Advanced**: `dust particles in sunlight`, `tiny water droplets on skin`

### 7. Motion & Atmosphere (动态)
- **Primary**: `motion blur on fast elements`, `wind blowing hair and fabric`
- **Auxiliary**: `dust particles floating in air`, `natural micro-movements`
- **Advanced**: `handheld camera subtle shake`, `lens flare from practical light`

## Anti-Patterns (Avoid These)

| AI-Looking Phrase | Replacement |
|-------------------|-------------|
| `perfect skin` | `skin pores visible, subtle imperfections` |
| `vivid colors` | `muted desaturated earth tones` |
| `studio lighting` | `natural diffused overcast lighting` |
| `everything in sharp focus` | `shallow DOF, f/1.8` |
| `clean digital look` | `subtle film grain, organic texture` |
| `cinematic` (alone) | `Arri Alexa 65, Cooke S7/i` |
| `static pose` | `natural micro-movements, wind blowing hair` |

## Scene Templates

### Portrait Template
```
Arri Alexa 65, Cooke S7/i, anamorphic 2.39:1, f/1.8 shallow DOF, 
natural diffused overcast, soft shadows, no hard light, 
muted desaturated earth tones, teal shadows, warm highlights, 
subsurface scattering, skin pores visible, individual hair strands, 
wind blowing hair, motion blur, subtle film grain
```

### Wildlife Template
```
Arri Alexa Mini LF, Master Prime, widescreen cinematic, f/2.8 shallow DOF, 
natural diffused overcast, muted earth tones, individual fur strands visible, 
wind blowing fur and grass, dust particles in air, motion blur, 
documentary wildlife style, subtle film grain, RAW quality
```

### Interior Template
```
Arri Alexa 65, Cooke S7/i, 2.39:1 anamorphic, f/2.0 shallow DOF, 
natural light through window, soft shadows, practical lights visible, 
muted warm earth tones, fabric weave texture, subtle film grain, 
subtle rim light separating subjects from background
```

## Integration

The enhancer is integrated into the pipeline at **Stage 5B** (Visual Prompt Generation) as a post-processing step:

```
[Visual Prompt Generation] → [Realism Enhancer] → [Quality Gate] → [Render]
```

### Modes

1. **Smart Mode** (default): Analyzes existing prompt coverage, adds missing dimensions only
2. **Full Mode**: Appends complete 7-dimensional template
3. **Minimal Mode**: Only top 10 ROI keywords

### Configuration

```javascript
const enhancer = new RealismPromptEnhancer({
  enabled: true,     // Master switch
  mode: 'smart',     // 'smart' | 'full' | 'minimal'
  sceneType: 'general' // 'portrait' | 'wildlife' | 'interior' | 'general' | 'minimal'
});
```

## Files

- `systems/realism-prompt-enhancer.js` - Core enhancement engine
- `designs/ai-video-realism-methodology.md` - Full methodology documentation

## Version

v6.6.0
