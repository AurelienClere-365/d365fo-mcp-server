/**
 * Azure Blob Storage Database Download Utility
 * Downloads SQLite database from Azure Blob Storage on startup
 */

import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';

interface DownloadOptions {
  connectionString?: string;
  containerName?: string;
  blobName?: string;
  localPath?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Validate SQLite database integrity
 */
async function validateDatabase(filePath: string): Promise<boolean> {
  try {
    const db = new Database(filePath, { readonly: true });
    
    // Use quick_check instead of integrity_check for faster startup
    // quick_check: 10-100x faster, still validates most corruption issues
    // integrity_check: thorough but very slow (minutes on large DBs)
    const result = db.pragma('quick_check') as Array<{ quick_check: string }>;
    db.close();
    
    return result.length === 1 && result[0].quick_check === 'ok';
  } catch (error) {
    console.error(`   Database validation failed:`, error);
    return false;
  }
}

/**
 * Sleep helper for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Remove a SQLite temp file together with its companion WAL files.
 * When validateDatabase() opens a file SQLite creates <file>-shm and <file>-wal
 * alongside it.  If the main file is later deleted (e.g. on validation failure)
 * those WAL files become orphaned.  On the next download attempt SQLite finds the
 * orphaned WAL for the NEW temp file and tries to replay it — causing
 * "unable to open database" / deserialization errors.
 */
async function cleanupTempFiles(tmpPath: string): Promise<void> {
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      await fs.unlink(`${tmpPath}${suffix}`);
    } catch {
      // Ignore if file does not exist
    }
  }
}

export async function downloadDatabaseFromBlob(options?: DownloadOptions): Promise<string> {
  const connectionString = options?.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = options?.containerName || process.env.BLOB_CONTAINER_NAME || 'xpp-metadata';
  const blobName = options?.blobName || process.env.BLOB_DATABASE_NAME || 'databases/xpp-metadata-latest.db';
  const localPath = options?.localPath || process.env.DB_PATH || './data/xpp-metadata.db';
  const labelsDbPath = localPath.replace('.db', '-labels.db');
  const maxRetries = options?.maxRetries || 3;
  const timeoutMs = options?.timeoutMs || 300000; // 5 minutes default

  if (!connectionString) {
    throw new Error('Azure Storage connection string not configured');
  }

  console.log(`📥 Downloading databases from blob storage...`);
  console.log(`   Container: ${containerName}`);
  console.log(`   Symbols blob: ${blobName}`);
  console.log(`   Symbols path: ${localPath}`);
  console.log(`   Labels path: ${labelsDbPath}`);
  console.log(`   Timeout: ${timeoutMs / 1000}s`);

  // Ensure directory exists
  const dir = path.dirname(localPath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = `${localPath}.tmp`;
  
  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries}...`);
      
      // Clean up temp file + companion SQLite WAL files if they exist
      await cleanupTempFiles(tmpPath);

      // Create blob service client
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      // Check if blob exists
      const exists = await blobClient.exists();
      if (!exists) {
        throw new Error(`Blob "${blobName}" not found in container "${containerName}"`);
      }

      // Get blob properties
      const properties = await blobClient.getProperties();
      const sizeInMB = ((properties.contentLength || 0) / (1024 * 1024)).toFixed(2);
      console.log(`   Size: ${sizeInMB} MB`);

      // Download to temporary file with timeout.
      // AbortController cancels the underlying stream so it stops writing to
      // tmpPath after the deadline fires (unlike Promise.race which leaves the
      // stream running and producing a corrupted temp file).
      const startTime = Date.now();
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), timeoutMs);
      try {
        await blobClient.downloadToFile(tmpPath, 0, undefined, {
          maxRetryRequests: 5,
          abortSignal: abortCtrl.signal,
        });
      } catch (err: any) {
        if (err.name === 'AbortError' || err.code === 'ERR_ABORTED') {
          throw new Error(`Download timeout after ${timeoutMs / 1000}s`);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   Downloaded in ${duration}s`);

      // Validate database integrity
      console.log(`   Validating symbols database integrity...`);
      const isValid = await validateDatabase(tmpPath);
      
      if (!isValid) {
        throw new Error('Downloaded symbols database is corrupted (failed integrity check)');
      }
      
      console.log(`   ✅ Symbols database validation passed`);

      // Atomic move: rename temp to final
      await fs.rename(tmpPath, localPath);
      
      // Download labels database (separate file)
      const labelsBlobName = blobName.replace('.db', '-labels.db').replace('xpp-metadata-latest', 'xpp-metadata-labels-latest');
      const labelsBlobClient = containerClient.getBlobClient(labelsBlobName);
      const labelsTmpPath = `${labelsDbPath}.tmp`;

      console.log(`   📥 Downloading labels database...`);
      try {
        const labelsExists = await labelsBlobClient.exists();
        if (labelsExists) {
          const labelsProperties = await labelsBlobClient.getProperties();
          const labelsSizeInMB = ((labelsProperties.contentLength || 0) / (1024 * 1024)).toFixed(2);
          console.log(`   Labels size: ${labelsSizeInMB} MB`);

          const labelsAbortCtrl = new AbortController();
          const labelsTimeoutId = setTimeout(() => labelsAbortCtrl.abort(), timeoutMs);
          try {
            await labelsBlobClient.downloadToFile(labelsTmpPath, 0, undefined, {
              abortSignal: labelsAbortCtrl.signal,
            });
          } catch (err: any) {
            if (err.name === 'AbortError' || err.code === 'ERR_ABORTED') {
              throw new Error(`Labels download timeout after ${timeoutMs / 1000}s`);
            }
            throw err;
          } finally {
            clearTimeout(labelsTimeoutId);
          }

          // Validate labels database
          console.log(`   Validating labels database integrity...`);
          const labelsIsValid = await validateDatabase(labelsTmpPath);

          if (!labelsIsValid) {
            throw new Error('Downloaded labels database is corrupted');
          }

          console.log(`   ✅ Labels database validation passed`);

          // Move to final location
          await fs.rename(labelsTmpPath, labelsDbPath);
          console.log(`   ✅ Labels database downloaded`);
        } else {
          console.log(`   ⚠️  Labels database not found (may be old single-DB format)`);
        }
      } catch (labelsError: any) {
        console.warn(`   ⚠️  Failed to download labels database: ${labelsError.message}`);
        console.warn(`   Continuing with symbols database only (labels will not be available)`);
        // Clean up labels temp file + companion SQLite WAL files
        await cleanupTempFiles(labelsTmpPath);
      }
      
      console.log(`✅ Database download complete`);
      return localPath;
      
    } catch (error) {
      console.error(`   ❌ Attempt ${attempt} failed:`, error);
      
      // Clean up temp file + companion SQLite WAL files
      await cleanupTempFiles(tmpPath);
      
      // If this was the last attempt, also clean up potentially corrupted final file
      if (attempt === maxRetries) {
        console.log(`   🧹 Cleaning up potentially corrupted database file...`);
        try {
          await fs.unlink(localPath);
        } catch {
          // Ignore if doesn't exist
        }
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`   ⏳ Retrying in ${backoffMs / 1000}s...`);
      await sleep(backoffMs);
    }
  }

  throw new Error('Download failed after all retries');
}

/**
 * Check local database version against blob storage
 */
export async function checkDatabaseVersion(localPath: string, options?: DownloadOptions): Promise<{
  needsUpdate: boolean;
  localModified?: Date;
  remoteModified?: Date;
}> {
  const connectionString = options?.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = options?.containerName || process.env.BLOB_CONTAINER_NAME || 'xpp-metadata';
  const blobName = options?.blobName || process.env.BLOB_DATABASE_NAME || 'databases/xpp-metadata-latest.db';

  if (!connectionString) {
    return { needsUpdate: false };
  }

  try {
    // Check local file
    const localStats = await fs.stat(localPath);
    const localModified = localStats.mtime;

    // Check remote blob
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    
    const properties = await blobClient.getProperties();
    const remoteModified = properties.lastModified;

    if (!remoteModified) {
      return { needsUpdate: false, localModified };
    }

    // Compare timestamps
    const needsUpdate = remoteModified > localModified;

    return {
      needsUpdate,
      localModified,
      remoteModified,
    };
  } catch (error) {
    // If local file doesn't exist, needs download
    return { needsUpdate: true };
  }
}

/**
 * Initialize database (download if needed)
 */
export async function initializeDatabase(options?: DownloadOptions): Promise<string> {
  const localPath = options?.localPath || process.env.DB_PATH || './data/xpp-metadata.db';

  // Check if we should use blob storage
  const useBlob = !!process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!useBlob) {
    console.log('ℹ️  No Azure Storage connection configured, using local database');
    return localPath;
  }

  // Check if update is needed
  const versionCheck = await checkDatabaseVersion(localPath, options);

  if (versionCheck.needsUpdate) {
    console.log('🔄 Database update available or local file missing');
    await downloadDatabaseFromBlob(options);
  } else {
    console.log('✅ Local database is up to date');
    if (versionCheck.localModified) {
      console.log(`   Last modified: ${versionCheck.localModified.toISOString()}`);
    }
  }

  return localPath;
}
