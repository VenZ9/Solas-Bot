const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { LIMITS } = require('../constants');

/**
 * Validates image metadata and prevents path traversal
 */
function validateImageUpload(attachment) {
  if (!attachment) {
    return { valid: false, error: 'No attachment provided.' };
  }

  // Size check
  if (attachment.size > LIMITS.MAX_IMAGE_UPLOAD_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the limit of ${LIMITS.MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)}MB.`,
    };
  }

  // MIME type check
  const contentType = (attachment.contentType || '').toLowerCase();
  if (!LIMITS.ALLOWED_IMAGE_MIMES.includes(contentType)) {
    return {
      valid: false,
      error: `Invalid image type "${contentType}". Allowed: PNG, JPEG, WEBP, GIF.`,
    };
  }

  // Safe file extension extraction
  const allowedExts = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  const ext = allowedExts[contentType] || '.png';

  return { valid: true, ext };
}

/**
 * Generates a collision-resistant, path-traversal-proof filename and absolute path
 */
function getSafeImagePath(targetDir, guildId, ext) {
  const safeGuildId = guildId.replace(/[^a-zA-Z0-9]/g, '');
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const filename = `welcome_${safeGuildId}_${randomSuffix}${ext}`;
  const resolvedPath = path.resolve(targetDir, filename);

  // Strict path traversal containment check
  if (!resolvedPath.startsWith(path.resolve(targetDir))) {
    throw new Error('Path traversal security violation detected.');
  }

  return { filename, absolutePath: resolvedPath };
}

/**
 * HTML escaping to prevent XSS in transcripts
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  validateImageUpload,
  getSafeImagePath,
  escapeHtml,
};
