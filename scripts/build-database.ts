/**
 * Database Builder Script
 * Builds SQLite database from extracted metadata
 */

import 'dotenv/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { XppSymbolIndex } from '../src/metadata/symbolIndex.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { isCustomModel, isStandardModel, getCustomModels } from '../src/utils/modelClassifier.js';
import { indexAllLabels } from '../src/metadata/labelParser.js';

const INPUT_PATH = process.env.METADATA_PATH || './extracted-metadata';
const OUTPUT_DB = process.env.DB_PATH || './data/xpp-metadata.db';
const EXTRACT_MODE = process.env.EXTRACT_MODE || 'all';
const CUSTOM_MODELS = getCustomModels();
const FORCE_VACUUM = process.env.VACUUM === 'true';
// Labels are indexed from PackagesLocalDirectory directly (not from extracted-metadata)
const PACKAGES_PATH = process.env.PACKAGES_PATH || 'K:\\AosService\\PackagesLocalDirectory';
const INCLUDE_LABELS = process.env.INCLUDE_LABELS !== 'false'; // default: true
// Two-phase CI build: Phase 1 indexes symbols only (SKIP_FTS=true), Phase 2 runs build-fts
const SKIP_FTS = process.env.SKIP_FTS === 'true';
// Resume interrupted build: skip already-indexed models (progress tracked in _build_progress table)
const RESUME = process.env.RESUME === 'true';

async function buildDatabase() {
  console.log('🔨 Building X++ Metadata Database');
  console.log(`📂 Input: ${INPUT_PATH}`);
  console.log(`💾 Output: ${OUTPUT_DB}`);
  console.log(`⚙️  Extract Mode: ${EXTRACT_MODE}`);
  console.log(`🧹 VACUUM: ${EXTRACT_MODE === 'all' || FORCE_VACUUM ? 'Enabled' : 'Disabled (incremental build)'}`);
  console.log('');

  // Create symbol index
  const symbolIndex = new XppSymbolIndex(OUTPUT_DB);

  // Optimize for bulk loading: use MEMORY journal during build
  console.log('⚡ Setting bulk load optimizations (MEMORY journal)...');
  symbolIndex.db.pragma('journal_mode = MEMORY'); // Fastest for bulk inserts
  symbolIndex.db.pragma('synchronous = OFF');     // Maximum speed (safe for build process)
  symbolIndex.db.pragma('locking_mode = EXCLUSIVE'); // No concurrent access needed during build

  // Determine which models to rebuild based on EXTRACT_MODE
  let modelsToRebuild: string[] = [];
  
  // Determine if VACUUM should run:
  // - Always for full rebuild (EXTRACT_MODE=all)
  // - For incremental builds only if explicitly requested (VACUUM=true)
  const shouldVacuum = EXTRACT_MODE === 'all' || FORCE_VACUUM;
  
  if (RESUME) {
    // Resume mode: skip clearing, continue from progress checkpoint
    const done = symbolIndex.getIndexedModels();
    console.log(`♻️  Resume mode: ${done.size} model(s) already indexed, continuing from checkpoint`);
  } else if (EXTRACT_MODE === 'all') {
    // Clear entire database for full rebuild
    console.log('🗑️  Clearing entire database for full rebuild...');
    symbolIndex.clear();
    symbolIndex.clearProgressTracking();
  } else if (EXTRACT_MODE === 'custom') {
    // Clear only custom models
    if (CUSTOM_MODELS.length > 0) {
      // Expand wildcards in custom models
      const allModels = fsSync.readdirSync(INPUT_PATH, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
      
      // Expand patterns (e.g., "Asl*" → ["AslCore", "AslFinanceCore", ...])
      const expandedModels: string[] = [];
      for (const pattern of CUSTOM_MODELS) {
        if (pattern.includes('*')) {
          // Wildcard pattern - match against all models
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
          const matched = allModels.filter(m => regex.test(m));
          expandedModels.push(...matched);
        } else {
          // Exact model name
          if (allModels.includes(pattern)) {
            expandedModels.push(pattern);
          }
        }
      }
      
      modelsToRebuild = [...new Set(expandedModels)]; // Remove duplicates
      console.log(`🗑️  Cleared symbols for models: ${CUSTOM_MODELS.join(', ')}`);
      if (modelsToRebuild.length !== CUSTOM_MODELS.length) {
        console.log(`   📌 Expanded to ${modelsToRebuild.length} models: ${modelsToRebuild.slice(0, 5).join(', ')}${modelsToRebuild.length > 5 ? '...' : ''}`);
      }
      symbolIndex.clearModels(modelsToRebuild, shouldVacuum);
    } else {
      // Clear all custom models (exclude standard)
      const allModels = fsSync.readdirSync(INPUT_PATH, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
      modelsToRebuild = allModels.filter(m => isCustomModel(m));
      symbolIndex.clearModels(modelsToRebuild, shouldVacuum);
    }
  } else if (EXTRACT_MODE === 'standard') {
    // Clear only standard models (all except custom)
    const allModels = fsSync.readdirSync(INPUT_PATH, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    modelsToRebuild = allModels.filter(m => isStandardModel(m));
    symbolIndex.clearModels(modelsToRebuild, shouldVacuum);
  }

  // Index the extracted metadata
  console.log('📖 Indexing metadata...');
  const startTime = Date.now();
  
  if (modelsToRebuild.length > 0) {
    // Index specific models
    console.log(`📦 Indexing ${modelsToRebuild.length} model(s): ${modelsToRebuild.join(', ')}`);
    for (const modelName of modelsToRebuild) {
      await symbolIndex.indexMetadataDirectory(INPUT_PATH, modelName);
    }
  } else {
    // Index all models in the directory
    await symbolIndex.indexMetadataDirectory(INPUT_PATH);
  }
  
  console.log(`\n📊 Indexing complete, now collecting statistics...`);
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Compute usage statistics (usage_frequency, called_by_count)
  // IMPORTANT: This is SLOW (1-2 minutes for 300k+ methods)
  // Only enable explicitly via COMPUTE_STATS=true (not automatic even for full rebuilds)
  const shouldComputeStats = process.env.COMPUTE_STATS === 'true';
  if (shouldComputeStats) {
    console.log('📈 Computing usage statistics (this may take 1-2 minutes)...');
    symbolIndex.computeUsageStatistics();
    console.log('✅ Usage statistics computed');
  } else {
    console.log('⏭️  Skipping usage statistics computation (use COMPUTE_STATS=true to enable)');
    console.log('    ℹ️  Statistics provide usage_frequency and called_by_count fields');
  }

  const count = symbolIndex.getSymbolCount();
  console.log(`✅ Database built successfully in ${duration}s!`);
  console.log(`📊 Total symbols: ${count}`);

  // ── Label Indexing ─────────────────────────────────────────────────────────
  if (SKIP_FTS) {
    console.log('\n⏭️  Skipping label indexing (SKIP_FTS=true) — will be indexed by build-fts step');
  } else if (INCLUDE_LABELS) {
    console.log(`\n🏷️  Indexing AxLabelFile labels from: ${PACKAGES_PATH}`);
    if (!fsSync.existsSync(PACKAGES_PATH)) {
      console.log(`   ⚠️  PackagesLocalDirectory not found at "${PACKAGES_PATH}" — skipping labels.`);
      console.log(`   ℹ️  Set PACKAGES_PATH env var to the correct path, or INCLUDE_LABELS=false to suppress this message.`);
    } else {
      const labelStart = Date.now();

      // For incremental builds, clear only the affected models' labels
      if (modelsToRebuild.length > 0) {
        symbolIndex.clearLabelsForModels(modelsToRebuild);
        const { totalLabels, modelsIndexed } = await indexAllLabels(
          symbolIndex,
          PACKAGES_PATH,
          (modelName) => modelsToRebuild.includes(modelName),
        );
        const labelDuration = ((Date.now() - labelStart) / 1000).toFixed(2);
        console.log(`   ✅ ${totalLabels} label entries indexed across ${modelsIndexed} models in ${labelDuration}s`);
      } else {
        // Full rebuild — determine model filter based on EXTRACT_MODE
        let labelModelFilter: ((m: string) => boolean) | undefined;
        if (EXTRACT_MODE === 'custom') {
          labelModelFilter = (m) => isCustomModel(m);
        } else if (EXTRACT_MODE === 'standard') {
          labelModelFilter = (m) => isStandardModel(m);
        }
        // else: no filter — index all models

        const { totalLabels, modelsIndexed } = await indexAllLabels(
          symbolIndex,
          PACKAGES_PATH,
          labelModelFilter,
        );
        const labelDuration = ((Date.now() - labelStart) / 1000).toFixed(2);
        console.log(`   ✅ ${totalLabels} label entries indexed across ${modelsIndexed} models in ${labelDuration}s`);
      }

      const labelCount = symbolIndex.getLabelCount();
      console.log(`   📊 Total labels in database: ${labelCount}`);
    }
  } else {
    console.log('\n⏭️  Skipping label indexing (INCLUDE_LABELS=false)');
  }

  if (SKIP_FTS) {
    console.log('\n⏭️  Skipping WAL conversion (database will be finalized by build-fts step)');
    console.log('   ℹ️  Upload this database as a pipeline artifact, then run: npm run build-fts');
  } else {
    // Convert to WAL mode for production use (better concurrency)
    console.log('\n🔄 Converting database to WAL mode for production...');
    symbolIndex.db.pragma('locking_mode = NORMAL');  // Re-enable shared access
    symbolIndex.db.pragma('journal_mode = WAL');     // Enable WAL for runtime
    symbolIndex.db.pragma('synchronous = NORMAL');   // Balance speed/safety
    console.log('✅ Database converted to WAL mode');

    // ANALYZE + optimize: persist query-planner stats into the DB so the production
    // server can open it with zero warmup cost (skipped when SKIP_FTS=true because
    // build-fts will run these tasks at the end of phase 2).
    symbolIndex.runPostBuildTasks();
  }

  // Show breakdown by type
  const breakdown = symbolIndex.getSymbolCountByType();
  console.log('\n📋 Symbol breakdown:');
  for (const [type, typeCount] of Object.entries(breakdown)) {
    console.log(`   ${type}: ${typeCount}`);
  }
}

buildDatabase().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
