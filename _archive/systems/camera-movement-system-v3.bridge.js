const { CameraMovementSystemV3 } = require('./camera-movement-system-v3');

class CameraMovementSystemV3Bridge {
  constructor(options = {}) {
    this.engine = new CameraMovementSystemV3(options);
  }

  /**
   * 标准字段输出
   * @param {Object} shot
   * @param {Object} context
   * @returns {Object}
   */
  generateFields(shot = {}, context = {}) {
    const sceneName = shot.scene || shot.sceneName || context.sceneName || '青丘灵原';
    const emotionPhase = shot.emotionPhase || shot.emotion || 'establishing';
    const duration = shot.duration || 5;

    let result;
    try {
      result = this.engine.generateIntraShotTimeline(sceneName, emotionPhase, {
        duration,
        shotType: shot.type || shot.shotType || ''
      });
    } catch (e) {
      return {
        CAMERA: shot.camera || '',
        LIGHTING: '',
        DIRECTOR: ''
      };
    }

    // 只取字段级结果，不直接返回完整大段prompt
    const cameraText = this._buildCameraField(result);
    const lightingText = this._buildLightingField(result);
    const directorText = this._buildDirectorField(result);

    return {
      CAMERA: cameraText,
      LIGHTING: lightingText,
      DIRECTOR: directorText,
      meta: {
        source: 'camera-movement-system-v3',
        raw: result
      }
    };
  }

  _buildCameraField(result) {
    const timeline = result?.intraShotTimeline?.segments || [];
    const baseDesc = result?.baseMovement?.description || '';

    const segmentDesc = timeline
      .slice(0, 3)
      .map(seg => {
        const move = seg.movement || seg.camera || '';
        const shotSize = seg.shotSizeDesc || seg.shotSize || '';
        return [move, shotSize].filter(Boolean).join('，');
      })
      .filter(Boolean)
      .join('；');

    return [baseDesc, segmentDesc]
      .filter(Boolean)
      .join('；')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _buildLightingField(result) {
    const timeline = result?.intraShotTimeline?.segments || [];

    const lightingDesc = timeline
      .map(seg => {
        if (!seg.lighting) return '';
        const effect = seg.lighting.effect || '';
        const temp = seg.lighting.colorTemp ? `${seg.lighting.colorTemp}K` : '';
        return [effect, temp].filter(Boolean).join(' ');
      })
      .filter(Boolean)
      .slice(0, 3)
      .join('；');

    return lightingDesc;
  }

  _buildDirectorField(result) {
    const cfg = result?.config || {};
    const parts = [];
    if (cfg.transitionType) parts.push(`景别策略:${cfg.transitionType}`);
    if (cfg.lightingType) parts.push(`光影策略:${cfg.lightingType}`);
    if (cfg.speedCurve) parts.push(`速度曲线:${cfg.speedCurve}`);
    return parts.join('；');
  }
}

module.exports = { CameraMovementSystemV3Bridge };
