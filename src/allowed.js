/**
 * allowed.js — Input validation
 *
 * Validates keywords (namespace/package/version), file-system paths, and URLs.
 */

"use strict";

const AllowedType = Object.freeze({
  Keyword: 0,
  Path: 1,
  URL: 2,
});

const allowedPatterns = {
  // Keyword: lowercase alphanumeric + hyphen, must start with alnum
  [AllowedType.Keyword]: /^[a-z0-9][a-z0-9-]*$/,

  // Path: Unix absolute (/opt/x), relative (./x, ../x),
  // Windows drive (C:\x, C:/x), UNC (\\server\share)
  [AllowedType.Path]: /^(?:(?:(?:[A-Za-z]:[/\\])|(?:\\\\)|\/|\.\/|\.\.\/).+)?$/,

  // URL: common scheme URLs (https://, s3://, file://, etc.)
  [AllowedType.URL]: /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+)?$/,
};

class Allowed {
  match(t, s) {
    const re = allowedPatterns[t];
    if (!re) return false;
    return re.test(s);
  }

  isKeyword(s) {
    return this.match(AllowedType.Keyword, s);
  }

  isPath(s) {
    return this.match(AllowedType.Path, s);
  }

  isURL(s) {
    return this.match(AllowedType.URL, s);
  }

  /**
   * Detect returns the first matched AllowedType in order: URL -> Path -> Keyword.
   */
  detect(s) {
    if (this.match(AllowedType.URL, s)) {
      return { type: AllowedType.URL, matched: true };
    }
    if (this.match(AllowedType.Path, s)) {
      return { type: AllowedType.Path, matched: true };
    }
    if (this.match(AllowedType.Keyword, s)) {
      return { type: AllowedType.Keyword, matched: true };
    }
    return { type: AllowedType.Keyword, matched: false };
  }
}

/** Module-level singleton */
const allowed = new Allowed();

module.exports = { allowed, AllowedType };
