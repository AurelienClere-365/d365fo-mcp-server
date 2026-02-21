/**
 * Tests for Model Classifier with Auto-Detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  isCustomModel, 
  isStandardModel, 
  registerCustomModel,
  isAutoDetectedCustomModel,
  clearAutoDetectedModels,
  getCustomModels 
} from '../src/utils/modelClassifier.js';

describe('ModelClassifier with Auto-Detection', () => {
  beforeEach(() => {
    // Reset auto-detected models between tests to avoid cross-test contamination
    clearAutoDetectedModels();
  });
  
  describe('Standard Microsoft Models', () => {
    it('should recognize ApplicationSuite as standard', () => {
      expect(isStandardModel('ApplicationSuite')).toBe(true);
      expect(isCustomModel('ApplicationSuite')).toBe(false);
    });

    it('should recognize ApplicationPlatform as standard', () => {
      expect(isStandardModel('ApplicationPlatform')).toBe(true);
      expect(isCustomModel('ApplicationPlatform')).toBe(false);
    });

    it('should recognize ApplicationFoundation as standard', () => {
      expect(isStandardModel('ApplicationFoundation')).toBe(true);
      expect(isCustomModel('ApplicationFoundation')).toBe(false);
    });
  });

  describe('Auto-Detected Custom Models', () => {
    it('should register and recognize auto-detected model as custom', () => {
      // Use a unique name to avoid collision with models registered by concurrent test files
      const testModel = 'AutoDetect_' + Date.now();
      
      // Before registration - should be standard (unknown model)
      expect(isCustomModel(testModel)).toBe(false);
      expect(isStandardModel(testModel)).toBe(true);
      
      // Register as auto-detected custom
      registerCustomModel(testModel);
      
      // After registration - should be custom
      expect(isAutoDetectedCustomModel(testModel)).toBe(true);
      expect(isCustomModel(testModel)).toBe(true);
      expect(isStandardModel(testModel)).toBe(false);
    });

    it('should handle multiple auto-detected models', () => {
      const model1 = 'CustomModelA';
      const model2 = 'CustomModelB';
      
      registerCustomModel(model1);
      registerCustomModel(model2);
      
      expect(isCustomModel(model1)).toBe(true);
      expect(isCustomModel(model2)).toBe(true);
      expect(isStandardModel(model1)).toBe(false);
      expect(isStandardModel(model2)).toBe(false);
    });

    it('should not affect Microsoft models', () => {
      registerCustomModel('MyCustomModel');
      
      // Microsoft models should still be standard
      expect(isStandardModel('ApplicationSuite')).toBe(true);
      expect(isStandardModel('ApplicationPlatform')).toBe(true);
      expect(isCustomModel('ApplicationSuite')).toBe(false);
    });
  });

  describe('Priority Order', () => {
    it('auto-detected models should take priority over environment config', () => {
      // Even if not in CUSTOM_MODELS env var, auto-detected should be custom
      const autoModel = 'AutoDetectedModel_' + Date.now();
      
      // Verify not in env var list
      const envModels = getCustomModels();
      expect(envModels).not.toContain(autoModel);
      
      // Register as auto-detected
      registerCustomModel(autoModel);
      
      // Should be custom despite not being in env var
      expect(isCustomModel(autoModel)).toBe(true);
    });
  });
});
