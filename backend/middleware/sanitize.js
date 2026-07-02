// backend/middleware/sanitize.js

/**
 * Escapes HTML characters to prevent XSS.
 * Also neutralizes template delimiters (SSTI).
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // Validate UTF-8 by checking for malformed surrogate pairs
  try {
    encodeURIComponent(str);
  } catch (e) {
    throw new Error('Invalid UTF-8 sequence');
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\{\{/g, '&#x7B;&#x7B;')
    .replace(/\}\}/g, '&#x7D;&#x7D;')
    .replace(/\$\{/g, '&#x24;&#x7B;');
}

/**
 * Recursively inspects and sanitizes keys and values in an object/array.
 * Throws an error if any key starts with '$' or contains '.' (NoSQL injection).
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') {
        return sanitizeString(item);
      } else if (typeof item === 'object') {
        return sanitizeObject(item);
      }
      return item;
    });
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      // Prevent NoSQL injection via MongoDB operators in keys
      if (key.startsWith('$') || key.includes('.')) {
        throw new Error(`Forbidden input key pattern: "${key}"`);
      }

      const val = obj[key];
      if (typeof val === 'string') {
        sanitized[key] = sanitizeString(val);
      } else if (typeof val === 'object') {
        sanitized[key] = sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

module.exports = function sanitize(req, res, next) {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    next();
  } catch (err) {
    res.status(400).json({
      message: 'Malicious or invalid input detected',
      error: err.message
    });
  }
};
