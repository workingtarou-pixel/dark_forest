import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';

/**
 * Post-build obfuscation script
 * Obfuscates all JS files in dist/assets/ after Vite build
 */
const DIST_DIR = join(process.cwd(), 'dist', 'assets');

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  debugProtection: false,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

function processDir(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.js')) {
      console.log(`[Obfuscate] ${file}`);
      const code = readFileSync(fullPath, 'utf8');
      try {
        const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
        writeFileSync(fullPath, result.getObfuscatedCode());
        console.log(`[Obfuscate] ✓ ${file} done`);
      } catch (e) {
        console.error(`[Obfuscate] ✗ ${file} failed:`, e.message);
      }
    }
  }
}

console.log('[Obfuscate] Starting post-build obfuscation...');
try {
  processDir(DIST_DIR);
  console.log('[Obfuscate] ✓ All files obfuscated successfully');
} catch (e) {
  console.error('[Obfuscate] Error:', e.message);
  console.log('[Obfuscate] Build completed without obfuscation');
}
