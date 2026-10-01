var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// local-api.ts
import fs4 from "node:fs";
import path3 from "node:path";
import crypto8 from "node:crypto";
import { fileURLToPath } from "node:url";

// node_modules/nodemailer/dist/esm/mailer/index.js
import { EventEmitter } from "node:events";

// node_modules/nodemailer/dist/esm/shared/url.js
import net from "node:net";
import urllib from "node:url";

// node_modules/nodemailer/dist/esm/punycode/index.js
var maxInt = 2147483647;
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128;
var delimiter = "-";
var regexPunycode = /^xn--/;
var regexNonASCII = /[^\0-\x7F]/;
var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
var errors = {
  overflow: "Overflow: input needs wider integers to process",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "invalid-input": "Invalid input"
};
var baseMinusTMin = base - tMin;
var floor = Math.floor;
var stringFromCharCode = String.fromCharCode;
function error(type) {
  throw new RangeError(errors[type]);
}
function map(array, callback) {
  const result = [];
  let length = array.length;
  while (length--) {
    result[length] = callback(array[length]);
  }
  return result;
}
function mapDomain(domain, callback) {
  const parts = domain.split("@");
  let result = "";
  if (parts.length > 1) {
    result = parts[0] + "@";
    domain = parts[1];
  }
  domain = domain.replace(regexSeparators, ".");
  const labels = domain.split(".");
  const encoded = map(labels, callback).join(".");
  return result + encoded;
}
function ucs2decode(string) {
  const output = [];
  let counter = 0;
  const length = string.length;
  while (counter < length) {
    const value = string.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length) {
      const extra = string.charCodeAt(counter++);
      if ((extra & 64512) == 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
var basicToDigit = function(codePoint) {
  if (codePoint >= 48 && codePoint < 58) {
    return 26 + (codePoint - 48);
  }
  if (codePoint >= 65 && codePoint < 91) {
    return codePoint - 65;
  }
  if (codePoint >= 97 && codePoint < 123) {
    return codePoint - 97;
  }
  return base;
};
var digitToBasic = function(digit, flag) {
  return digit + 22 + 75 * Number(digit < 26) - (Number(flag != 0) << 5);
};
var adapt = function(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? floor(delta / damp) : delta >> 1;
  delta += floor(delta / numPoints);
  for (
    ;
    /* no initialization */
    delta > baseMinusTMin * tMax >> 1;
    k += base
  ) {
    delta = floor(delta / baseMinusTMin);
  }
  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};
var decode = function(input) {
  const output = [];
  const inputLength = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;
  let basic = input.lastIndexOf(delimiter);
  if (basic < 0) {
    basic = 0;
  }
  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 128) {
      error("not-basic");
    }
    output.push(input.charCodeAt(j));
  }
  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (index >= inputLength) {
        error("invalid-input");
      }
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= base) {
        error("invalid-input");
      }
      if (digit > floor((maxInt - i) / w)) {
        error("overflow");
      }
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }
      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) {
        error("overflow");
      }
      w *= baseMinusT;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi == 0);
    if (floor(i / out) > maxInt - n) {
      error("overflow");
    }
    n += floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
};
var encode = function(input) {
  const output = [];
  const codePoints = ucs2decode(input);
  const inputLength = codePoints.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (const currentValue of codePoints) {
    if (currentValue < 128) {
      output.push(stringFromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (const currentValue of codePoints) {
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (const currentValue of codePoints) {
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
          q = floor(qMinusT / baseMinusT);
        }
        output.push(stringFromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
};
var toUnicode = function(input) {
  return mapDomain(input, function(string) {
    return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
  });
};
var toASCII = function(input) {
  return mapDomain(input, function(string) {
    return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
  });
};

// node_modules/nodemailer/dist/esm/shared/url.js
var SLASHLESS_AUTHORITY = /^([a-zA-Z][a-zA-Z0-9+.-]*:)(?!\/\/)([\s\S]+)$/;
var SURROUNDING_WHITESPACE = /^[\x00-\x20]+|[\x00-\x20]+$/g;
var LEGACY_TRIM = /^[\x00-\x20\u00a0\ufeff]+/;
var AUTHORITY = /^([a-zA-Z0-9+.-]+:)?[\\/]{2}([^\\/?#]*)/;
var FORBIDDEN_HOST_CHARS = /[\x00-\x20#/:<>?@[\\\]^|\x7f]/;
var CONTROL_CHARS = /[\x00-\x1f\x7f]/;
function invalidUrl(input) {
  const err = new TypeError("Invalid URL");
  err.code = "ERR_INVALID_URL";
  err.input = input;
  return err;
}
function legacyParse(input, parseQueryString, whatwgError, slashesDenoteHost) {
  const parsed = urllib.parse(input, parseQueryString, slashesDenoteHost);
  const authority = AUTHORITY.exec(input.replace(LEGACY_TRIM, ""));
  if (authority && (authority[1] || parsed.hostname !== null)) {
    const written = authority[2].slice(authority[2].lastIndexOf("@") + 1);
    if (!written || CONTROL_CHARS.test(written) || (parsed.host || "").toLowerCase() !== toASCII(written.toLowerCase())) {
      throw whatwgError;
    }
    if (written.charAt(0) === "[" && !net.isIPv6(written.slice(1, written.indexOf("]")))) {
      throw whatwgError;
    }
  } else if (parsed.hostname !== null) {
    throw whatwgError;
  }
  const legacyAuth = parsed.auth === null || parsed.auth === void 0 ? null : parsed.auth.split(":");
  const result = parsed;
  result.username = legacyAuth ? legacyAuth.shift() : null;
  result.password = legacyAuth && legacyAuth.length ? legacyAuth.join(":") : null;
  return result;
}
function safeDecode(str) {
  try {
    return decodeURIComponent(str);
  } catch (_err) {
    return str;
  }
}
function normalizeHostname(raw, href) {
  const hostname = raw || "";
  if (!hostname) {
    return "";
  }
  if (hostname.charAt(0) === "[" && hostname.charAt(hostname.length - 1) === "]") {
    return hostname.slice(1, -1);
  }
  const decoded = safeDecode(hostname);
  const mapped = FORBIDDEN_HOST_CHARS.test(decoded) ? "" : urllib.domainToASCII(decoded);
  if (!mapped) {
    throw invalidUrl(href);
  }
  return mapped;
}
var parse = (input, parseQueryString) => {
  input = (input || "").replace(SURROUNDING_WHITESPACE, "");
  const slashless = SLASHLESS_AUTHORITY.exec(input);
  const normalized2 = slashless ? slashless[1] + "//" + slashless[2] : input;
  let u;
  try {
    u = new URL(normalized2);
  } catch (err) {
    return legacyParse(normalized2, parseQueryString, err);
  }
  const hostname = normalizeHostname(u.hostname, u.href);
  const port = u.port || null;
  const pathname = u.pathname || null;
  const search = u.search || null;
  let auth = null;
  let username = null;
  let password = null;
  if (u.username || u.password) {
    username = safeDecode(u.username);
    password = u.password ? safeDecode(u.password) : null;
    auth = username + (password !== null ? ":" + password : "");
  }
  let query;
  if (parseQueryString) {
    const parsed = /* @__PURE__ */ Object.create(null);
    u.searchParams.forEach((value, key) => {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        const existing = parsed[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          parsed[key] = [existing, value];
        }
      } else {
        parsed[key] = value;
      }
    });
    query = parsed;
  } else {
    query = search ? search.slice(1) : null;
  }
  return {
    protocol: u.protocol || null,
    host: u.host || null,
    hostname,
    port,
    pathname,
    search,
    path: (pathname || "") + (search || "") || null,
    href: u.href,
    auth,
    username,
    password,
    query
  };
};
var resolve = (from, to) => {
  try {
    return new URL(to, from).href;
  } catch (err) {
    legacyParse(from, false, err, true);
    legacyParse(to, false, err, true);
    return urllib.resolve(from, to);
  }
};

// node_modules/nodemailer/dist/esm/shared/index.js
import util from "node:util";
import fs from "node:fs";

// node_modules/nodemailer/dist/esm/fetch/index.js
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { PassThrough } from "node:stream";

// node_modules/nodemailer/dist/esm/fetch/cookies.js
import net2 from "node:net";
var SESSION_TIMEOUT = 1800;
var Cookies = class {
  constructor(options) {
    this.options = options || {};
    this.cookies = [];
  }
  /**
   * Stores a cookie string to the cookie storage
   *
   * @param cookieStr Value from the 'Set-Cookie:' header
   * @param url Current URL
   */
  set(cookieStr, url) {
    const urlparts = parse(url || "");
    const cookie = this.parse(cookieStr);
    let domain;
    if (cookie.domain) {
      domain = cookie.domain.replace(/^\./, "");
      if (
        // can't be valid if the requested domain is shorter than current hostname
        urlparts.hostname.length < domain.length || // a top level domain is not a valid scope, 'Domain=com' would otherwise be
        // sent to every .com host. A trailing dot does not make 'com.' any better
        domain.indexOf(".") < 0 || domain.endsWith(".") || // an IP address has no subdomains, so cookies set on it stay host-only
        net2.isIP(urlparts.hostname) || // prefix domains with dot to be sure that partial matches are not used
        !("." + urlparts.hostname).endsWith("." + domain)
      ) {
        cookie.domain = urlparts.hostname;
      }
    } else {
      cookie.domain = urlparts.hostname;
    }
    if (!cookie.path) {
      cookie.path = this.getPath(urlparts.pathname);
    }
    if (!cookie.expires) {
      cookie.expires = new Date(Date.now() + (Number(this.options.sessionTimeout || SESSION_TIMEOUT) || SESSION_TIMEOUT) * 1e3);
    }
    return this.add(cookie);
  }
  /**
   * Returns cookie string for the 'Cookie:' header.
   *
   * @param url URL to check for
   * @returns Cookie header or empty string if no matches were found
   */
  get(url) {
    return this.list(url).map((cookie) => cookie.name + "=" + cookie.value).join("; ");
  }
  /**
   * Lists all valied cookie objects for the specified URL
   *
   * @param url URL to check for
   * @returns An array of cookie objects
   */
  list(url) {
    const result = [];
    for (let i = this.cookies.length - 1; i >= 0; i--) {
      const cookie = this.cookies[i];
      if (this.isExpired(cookie)) {
        this.cookies.splice(i, 1);
        continue;
      }
      if (this.match(cookie, url)) {
        result.unshift(cookie);
      }
    }
    return result;
  }
  /**
   * Parses cookie string from the 'Set-Cookie:' header
   *
   * @param cookieStr String from the 'Set-Cookie:' header
   * @returns Cookie object
   */
  parse(cookieStr) {
    const cookie = {};
    (cookieStr || "").toString().split(";").forEach((cookiePart) => {
      const valueParts = cookiePart.split("=");
      const key = valueParts.shift().trim().toLowerCase();
      let value = valueParts.join("=").trim();
      let domain;
      if (!key) {
        return;
      }
      switch (key) {
        case "expires": {
          const expires = new Date(value);
          if (expires.toString() !== "Invalid Date") {
            cookie.expires = expires;
          }
          break;
        }
        case "path":
          cookie.path = value;
          break;
        case "domain":
          domain = value.toLowerCase();
          if (domain.length && domain.charAt(0) !== ".") {
            domain = "." + domain;
          }
          cookie.domain = domain;
          break;
        case "max-age":
          cookie.expires = new Date(Date.now() + (Number(value) || 0) * 1e3);
          break;
        case "secure":
          cookie.secure = true;
          break;
        case "httponly":
          cookie.httponly = true;
          break;
        default:
          if (!cookie.name) {
            cookie.name = key;
            cookie.value = value;
          }
      }
    });
    return cookie;
  }
  /**
   * Checks if a cookie object is valid for a specified URL
   *
   * @param cookie Cookie object
   * @param url URL to check for
   * @returns true if cookie is valid for specifiec URL
   */
  match(cookie, url) {
    const urlparts = parse(url || "");
    if (urlparts.hostname !== cookie.domain && (cookie.domain.charAt(0) !== "." || ("." + urlparts.hostname).substr(-cookie.domain.length) !== cookie.domain)) {
      return false;
    }
    const pathname = urlparts.pathname || "/";
    const cookiePath = cookie.path;
    const pathMatches = pathname === cookiePath || pathname.startsWith(cookiePath) && (cookiePath.endsWith("/") || pathname.charAt(cookiePath.length) === "/");
    if (!pathMatches) {
      return false;
    }
    if (cookie.secure && urlparts.protocol !== "https:") {
      return false;
    }
    return true;
  }
  /**
   * Adds (or updates/removes if needed) a cookie object to the cookie storage
   *
   * @param cookie Cookie value to be stored
   */
  add(cookie) {
    if (!cookie || !cookie.name) {
      return false;
    }
    for (let i = 0, len = this.cookies.length; i < len; i++) {
      if (this.compare(this.cookies[i], cookie)) {
        if (this.isExpired(cookie)) {
          this.cookies.splice(i, 1);
          return false;
        }
        this.cookies[i] = cookie;
        return true;
      }
    }
    if (!this.isExpired(cookie)) {
      this.cookies.push(cookie);
    }
    return true;
  }
  /**
   * Checks if two cookie objects are the same
   *
   * @param a Cookie to check against
   * @param b Cookie to check against
   * @returns True, if the cookies are the same
   */
  compare(a, b) {
    return a.name === b.name && a.path === b.path && a.domain === b.domain && a.secure === b.secure && a.httponly === b.httponly;
  }
  /**
   * Checks if a cookie is expired
   *
   * @param cookie Cookie object to check against
   * @returns True, if the cookie is expired
   */
  isExpired(cookie) {
    return cookie.expires && cookie.expires < /* @__PURE__ */ new Date() || !cookie.value;
  }
  /**
   * Returns the default path for an URL path argument, the default-path of
   * RFC 6265 section 5.1.4. A cookie that carries no Path attribute is scoped
   * to the directory of the URL it was set from
   *
   * @param pathname
   * @returns Default path
   */
  getPath(pathname) {
    const pathParts = (pathname || "/").split("/");
    pathParts.pop();
    const path4 = pathParts.join("/").trim();
    if (path4.charAt(0) !== "/") {
      return "/";
    }
    return path4;
  }
};
var cookies_default = Cookies;

// node_modules/nodemailer/dist/esm/package-info.js
var name = "nodemailer";
var version = "10.0.13";
var homepage = "https://nodemailer.com/";

// node_modules/nodemailer/dist/esm/fetch/index.js
import net3 from "node:net";

// node_modules/nodemailer/dist/esm/errors.js
var ECONNECTION = "ECONNECTION";
var ENOAUTH = "ENOAUTH";
var EOAUTH2 = "EOAUTH2";
var EMAXLIMIT = "EMAXLIMIT";
var EMAXRECIPIENTS = "EMAXRECIPIENTS";
var ESENDMAIL = "ESENDMAIL";
var ESES = "ESES";
var ECONFIG = "ECONFIG";
var EPROXY = "EPROXY";
var EFILEACCESS = "EFILEACCESS";
var EURLACCESS = "EURLACCESS";
var EFETCH = "EFETCH";

// node_modules/nodemailer/dist/esm/shared/objects.js
var isProtoKey = (key) => key === "__proto__";
var copyOwnKeys = (target, source, skip) => {
  Object.keys(source || {}).forEach((key) => {
    if (isProtoKey(key) || skip && skip(key)) {
      return;
    }
    target[key] = source[key];
  });
  return target;
};

// node_modules/nodemailer/dist/esm/fetch/index.js
var MAX_REDIRECTS = 5;
var DEFAULT_TIMEOUT = 60 * 1e3;
var DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
var TLS_OPTION_KEYS = [
  "ALPNProtocols",
  "ca",
  "cert",
  "checkServerIdentity",
  "ciphers",
  "crl",
  "dhparam",
  "ecdhCurve",
  "honorCipherOrder",
  "key",
  "maxVersion",
  "minVersion",
  "passphrase",
  "pfx",
  "rejectUnauthorized",
  "secureContext",
  "secureOptions",
  "secureProtocol",
  "servername",
  "sessionIdContext",
  "sigalgs"
];
function parseFetchUrl(url) {
  let parsed;
  try {
    parsed = parse(url);
  } catch (_err) {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  return parsed;
}
function nmfetch(url, options) {
  options = options || {};
  options.fetchRes = options.fetchRes || new PassThrough();
  options.cookies = options.cookies || new cookies_default();
  options.redirects = options.redirects || 0;
  options.maxRedirects = isNaN(options.maxRedirects) ? MAX_REDIRECTS : options.maxRedirects;
  const fetchRes = options.fetchRes;
  const parsed = parseFetchUrl(url);
  if (!parsed) {
    if (options.body && typeof options.body.destroy === "function") {
      options.body.on("error", () => false);
      options.body.destroy();
    }
    setImmediate(() => {
      const err = new Error("Unsupported protocol for URL " + url);
      err.code = EFETCH;
      err.sourceUrl = url;
      fetchRes.emit("error", err);
    });
    return fetchRes;
  }
  if (options.cookie) {
    [].concat(options.cookie || []).forEach((cookie) => {
      options.cookies.set(cookie, url);
    });
    options.cookie = false;
  }
  let method = (options.method || "").toString().trim().toUpperCase() || "GET";
  let finished = false;
  let cookies;
  let body;
  const handler2 = parsed.protocol === "https:" ? https : http;
  const headers = {
    "accept-encoding": "gzip,deflate",
    "user-agent": "nodemailer/" + version
  };
  Object.keys(options.headers || {}).forEach((key) => {
    if (isProtoKey(key.toLowerCase().trim())) {
      return;
    }
    headers[key.toLowerCase().trim()] = options.headers[key];
  });
  if (options.userAgent) {
    headers["user-agent"] = options.userAgent;
  }
  if (parsed.auth) {
    headers.Authorization = "Basic " + Buffer.from(parsed.auth).toString("base64");
  }
  if (cookies = options.cookies.get(url)) {
    headers.cookie = cookies;
  }
  if (options.body) {
    if (options.contentType !== false) {
      headers["Content-Type"] = options.contentType || "application/x-www-form-urlencoded";
    }
    if (typeof options.body.pipe === "function") {
      headers["Transfer-Encoding"] = "chunked";
      body = options.body;
      body.on("error", (err) => {
        if (finished) {
          return;
        }
        finished = true;
        err.code = EFETCH;
        err.sourceUrl = url;
        fetchRes.emit("error", err);
      });
    } else {
      if (options.body instanceof Buffer) {
        body = options.body;
      } else if (typeof options.body === "object") {
        try {
          body = Buffer.from(Object.keys(options.body).map((key) => {
            const value = options.body[key].toString().trim();
            return encodeURIComponent(key) + "=" + encodeURIComponent(value);
          }).join("&"));
        } catch (E) {
          finished = true;
          E.code = EFETCH;
          E.sourceUrl = url;
          setImmediate(() => fetchRes.emit("error", E));
          return fetchRes;
        }
      } else {
        body = Buffer.from(options.body.toString().trim());
      }
      headers["Content-Type"] = options.contentType || "application/x-www-form-urlencoded";
      headers["Content-Length"] = body.length;
    }
    method = (options.method || "").toString().trim().toUpperCase() || "POST";
  }
  let req;
  const reqOptions = {
    method,
    host: parsed.hostname,
    path: parsed.path,
    port: parsed.port ? parsed.port : parsed.protocol === "https:" ? 443 : 80,
    headers,
    // Validate TLS certificates by default. Callers that genuinely need to
    // reach a self-signed/internal host opt out explicitly with
    // options.tls = { rejectUnauthorized: false }.
    rejectUnauthorized: true,
    agent: false
  };
  if (options.tls) {
    Object.keys(options.tls).forEach((key) => {
      if (TLS_OPTION_KEYS.includes(key)) {
        reqOptions[key] = options.tls[key];
      }
    });
  }
  if (parsed.protocol === "https:" && parsed.hostname && parsed.hostname !== reqOptions.host && !net3.isIP(parsed.hostname) && !reqOptions.servername) {
    reqOptions.servername = parsed.hostname;
  }
  try {
    req = handler2.request(reqOptions);
  } catch (E) {
    finished = true;
    setImmediate(() => {
      E.code = EFETCH;
      E.sourceUrl = url;
      fetchRes.emit("error", E);
    });
    return fetchRes;
  }
  const fail = (err, sourceUrl = url) => {
    if (finished) {
      return;
    }
    finished = true;
    err.code = EFETCH;
    err.sourceUrl = sourceUrl;
    fetchRes.emit("error", err);
    req.abort();
  };
  const timeout = typeof options.timeout === "number" && options.timeout >= 0 ? options.timeout : DEFAULT_TIMEOUT;
  if (timeout) {
    req.setTimeout(timeout, () => fail(new Error("Request Timeout")));
  }
  req.on("error", (err) => fail(err));
  req.on("response", (res) => {
    let inflate;
    if (finished) {
      return;
    }
    switch (res.headers["content-encoding"]) {
      case "gzip":
      case "deflate":
        inflate = zlib.createUnzip();
        break;
    }
    if (res.headers["set-cookie"]) {
      [].concat(res.headers["set-cookie"] || []).forEach((cookie) => {
        options.cookies.set(cookie, url);
      });
    }
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      options.redirects++;
      if (options.redirects > options.maxRedirects) {
        return fail(new Error("Maximum redirect count exceeded"));
      }
      options.method = "GET";
      options.body = false;
      let redirectUrl;
      try {
        redirectUrl = resolve(url, res.headers.location);
      } catch (_err) {
        redirectUrl = res.headers.location;
      }
      const redirectParsed = parseFetchUrl(redirectUrl);
      if (!redirectParsed) {
        return fail(new Error("Unsupported protocol for URL " + redirectUrl), redirectUrl);
      }
      const crossHost = redirectParsed.hostname !== parsed.hostname;
      const downgrade = parsed.protocol === "https:" && redirectParsed.protocol === "http:";
      if (options.headers && (crossHost || downgrade)) {
        const sensitive = ["authorization", "cookie", "proxy-authorization"];
        Object.keys(options.headers).forEach((key) => {
          if (sensitive.includes(key.toLowerCase())) {
            delete options.headers[key];
          }
        });
      }
      finished = true;
      res.resume();
      req.abort();
      return nmfetch(redirectUrl, options);
    }
    fetchRes.statusCode = res.statusCode;
    fetchRes.headers = res.headers;
    if (res.statusCode >= 300 && !options.allowErrorResponse) {
      return fail(new Error("Invalid status code " + res.statusCode));
    }
    res.on("error", (err) => fail(err));
    const maxBytes = typeof options.maxBytes === "number" && options.maxBytes > 0 ? options.maxBytes : DEFAULT_MAX_BYTES;
    const source = inflate || res;
    let received = 0;
    source.on("data", (chunk) => {
      received += chunk.length;
      if (received <= maxBytes || finished) {
        return;
      }
      source.unpipe(fetchRes);
      fail(new Error("Response size exceeds the allowed " + maxBytes + " bytes"));
    });
    if (inflate) {
      res.pipe(inflate).pipe(fetchRes);
      inflate.on("error", (err) => fail(err));
    } else {
      res.pipe(fetchRes);
    }
  });
  setImmediate(() => {
    if (body) {
      try {
        if (typeof body.pipe === "function") {
          return body.pipe(req);
        }
        req.write(body);
      } catch (err) {
        return fail(err);
      }
    }
    req.end();
  });
  return fetchRes;
}
nmfetch.Cookies = cookies_default;
nmfetch.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
var fetch_default = nmfetch;

// node_modules/nodemailer/dist/esm/shared/index.js
import dns from "node:dns";
import net4 from "node:net";
import os from "node:os";
var DNS_TTL = 5 * 60 * 1e3;
var CACHE_CLEANUP_INTERVAL = 30 * 1e3;
var MAX_CACHE_SIZE = 1e3;
var lastCacheCleanup = 0;
var networkInterfaces;
try {
  networkInterfaces = os.networkInterfaces();
} catch (_err) {
}
var isFamilySupported = (family, allowInternal) => {
  const addresses = Object.values(networkInterfaces || {}).flat();
  if (!addresses.length) {
    return true;
  }
  return addresses.filter((i) => !i.internal || allowInternal).some((i) => i.family === "IPv" + family || i.family === family);
};
var resolve2 = (family, hostname, options, callback) => {
  options = options || {};
  if (!isFamilySupported(family, options.allowInternalNetworkInterfaces)) {
    return callback(null, []);
  }
  const dnsResolver = dns.Resolver ? new dns.Resolver(options) : dns;
  dnsResolver["resolve" + family](hostname, (err, addresses) => {
    if (err) {
      switch (err.code) {
        case dns.NODATA:
        case dns.NOTFOUND:
        case dns.NOTIMP:
        case dns.SERVFAIL:
        case dns.CONNREFUSED:
        case dns.REFUSED:
        case "EAI_AGAIN":
          return callback(null, []);
      }
      return callback(err);
    }
    return callback(null, Array.isArray(addresses) ? addresses : [].concat(addresses || []));
  });
};
var dnsCache = /* @__PURE__ */ new Map();
var formatDNSValue = (value, extra) => {
  if (!value) {
    return Object.assign({}, extra || {});
  }
  const addresses = value.addresses || [];
  const host = addresses.length > 0 ? addresses[Math.floor(Math.random() * addresses.length)] : null;
  return Object.assign({
    host,
    // Include all addresses for connection fallback support
    _addresses: addresses
  }, extra || {});
};
var resolveHostname = (options, callback) => {
  options = options || {};
  if (!options.host && options.servername) {
    options.host = options.servername;
  }
  if (!options.host || net4.isIP(options.host)) {
    const value = {
      addresses: [options.host]
    };
    return callback(null, formatDNSValue(value, {
      servername: options.servername || false,
      cached: false
    }));
  }
  const host = options.host;
  const servername = options.servername || host;
  let cached;
  if (dnsCache.has(options.host)) {
    cached = dnsCache.get(options.host);
    const now = Date.now();
    if (now - lastCacheCleanup > CACHE_CLEANUP_INTERVAL) {
      lastCacheCleanup = now;
      for (const [host2, entry] of dnsCache.entries()) {
        if (entry.expires && entry.expires < now) {
          dnsCache.delete(host2);
        }
      }
      if (dnsCache.size > MAX_CACHE_SIZE) {
        const toDelete = Math.floor(MAX_CACHE_SIZE * 0.1);
        const keys = Array.from(dnsCache.keys()).slice(0, toDelete);
        keys.forEach((key) => dnsCache.delete(key));
      }
    }
    if (!cached.expires || cached.expires >= now) {
      return callback(null, formatDNSValue(cached.value, {
        servername,
        cached: true
      }));
    }
  }
  let ipv4Addresses = [];
  let ipv6Addresses = [];
  let ipv4Error = null;
  let ipv6Error = null;
  resolve2(4, options.host, options, (err, addresses) => {
    if (err) {
      ipv4Error = err;
    } else {
      ipv4Addresses = addresses || [];
    }
    resolve2(6, host, options, (err2, addresses2) => {
      if (err2) {
        ipv6Error = err2;
      } else {
        ipv6Addresses = addresses2 || [];
      }
      const allAddresses = ipv4Addresses.concat(ipv6Addresses);
      if (allAddresses.length) {
        const value = {
          addresses: allAddresses
        };
        dnsCache.set(host, {
          value,
          expires: Date.now() + (options.dnsTtl || DNS_TTL)
        });
        return callback(null, formatDNSValue(value, {
          servername,
          cached: false
        }));
      }
      if (ipv4Error && ipv6Error) {
        if (cached) {
          dnsCache.set(host, {
            value: cached.value,
            expires: Date.now() + (options.dnsTtl || DNS_TTL)
          });
          return callback(null, formatDNSValue(cached.value, {
            servername,
            cached: true,
            error: ipv4Error
          }));
        }
      }
      try {
        dns.lookup(host, { all: true }, (err3, addresses3) => {
          if (err3) {
            if (cached) {
              dnsCache.set(host, {
                value: cached.value,
                expires: Date.now() + (options.dnsTtl || DNS_TTL)
              });
              return callback(null, formatDNSValue(cached.value, {
                servername,
                cached: true,
                error: err3
              }));
            }
            return callback(err3);
          }
          const supportedAddresses = addresses3 ? addresses3.filter((addr) => isFamilySupported(addr.family)).map((addr) => addr.address) : [];
          if (addresses3 && addresses3.length && !supportedAddresses.length) {
            console.warn(`Failed to resolve IPv${addresses3[0].family} addresses with current network`);
          }
          if (!supportedAddresses.length && cached) {
            return callback(null, formatDNSValue(cached.value, {
              servername,
              cached: true
            }));
          }
          const value = {
            addresses: supportedAddresses.length ? supportedAddresses : [host]
          };
          dnsCache.set(host, {
            value,
            expires: Date.now() + (options.dnsTtl || DNS_TTL)
          });
          return callback(null, formatDNSValue(value, {
            servername,
            cached: false
          }));
        });
      } catch (lookupErr) {
        if (cached) {
          dnsCache.set(host, {
            value: cached.value,
            expires: Date.now() + (options.dnsTtl || DNS_TTL)
          });
          return callback(null, formatDNSValue(cached.value, {
            servername,
            cached: true,
            error: lookupErr
          }));
        }
        return callback(ipv4Error || ipv6Error || lookupErr);
      }
    });
  });
};
var parseConnectionUrl = (str) => {
  str = str || "";
  const options = {};
  const url = parse(str, true);
  switch (url.protocol) {
    case "smtp:":
      options.secure = false;
      break;
    case "smtps:":
      options.secure = true;
      break;
    case "direct:":
      options.direct = true;
      break;
  }
  if (!isNaN(url.port) && Number(url.port)) {
    options.port = Number(url.port);
  }
  if (url.hostname) {
    options.host = url.hostname;
  }
  if (url.username || url.password) {
    options.auth = {
      user: url.username || "",
      pass: url.password || ""
    };
  }
  Object.keys(url.query || {}).forEach((key) => {
    let obj = options;
    let lKey = key;
    let value = url.query[key];
    if (!isNaN(value)) {
      value = Number(value);
    }
    switch (value) {
      case "true":
        value = true;
        break;
      case "false":
        value = false;
        break;
    }
    if (key.indexOf("tls.") === 0) {
      lKey = key.substr(4);
      if (!options.tls) {
        options.tls = {};
      }
      obj = options.tls;
    } else if (key.indexOf(".") >= 0) {
      return;
    }
    if (!isProtoKey(lKey) && !(lKey in obj)) {
      obj[lKey] = value;
    }
  });
  return options;
};
var _logFunc = (logger, level, defaults, data, message, ...args) => {
  const entry = Object.assign({}, defaults || {}, data || {});
  delete entry.level;
  let logLevel = level;
  if (typeof logger[logLevel] !== "function") {
    logLevel = ["info", "debug", "log", "trace", "warn", "error"].find((name2) => typeof logger[name2] === "function");
  }
  if (logLevel) {
    logger[logLevel](entry, message, ...args);
  }
};
var getLogger = (options, defaults) => {
  options = options || {};
  const response = {};
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"];
  if (!options.logger) {
    levels.forEach((level) => {
      response[level] = () => false;
    });
    return response;
  }
  const logger = options.logger === true ? createDefaultLogger(levels) : options.logger;
  levels.forEach((level) => {
    response[level] = (...args) => {
      const data = typeof args[0] === "string" ? void 0 : args.shift();
      _logFunc(logger, level, defaults, data, ...args);
    };
  });
  return response;
};
var callbackPromise = (resolve3, reject) => function(...args) {
  const err = args.shift();
  if (err) {
    reject(err);
  } else {
    resolve3(...args);
  }
};
var parseDataURI = (uri) => {
  if (typeof uri !== "string") {
    return null;
  }
  if (!uri.startsWith("data:")) {
    return null;
  }
  const commaPos = uri.indexOf(",");
  if (commaPos === -1) {
    return null;
  }
  const data = uri.substring(commaPos + 1);
  const metaStr = uri.substring("data:".length, commaPos);
  let encoding;
  const metaEntries = metaStr.split(";");
  if (metaEntries.length > 0) {
    const lastEntry = metaEntries[metaEntries.length - 1].toLowerCase().trim();
    if (["base64", "utf8", "utf-8"].includes(lastEntry) && lastEntry.indexOf("=") === -1) {
      encoding = lastEntry;
      metaEntries.pop();
    }
  }
  const contentType = metaEntries.length > 0 ? metaEntries.shift() : "application/octet-stream";
  const params = {};
  for (let i = 0; i < metaEntries.length; i++) {
    const entry = metaEntries[i];
    const sepPos = entry.indexOf("=");
    if (sepPos > 0) {
      const key = entry.substring(0, sepPos).trim();
      const value = entry.substring(sepPos + 1).trim();
      if (key && !isProtoKey(key)) {
        params[key] = value;
      }
    }
  }
  let bufferData;
  try {
    if (encoding === "base64") {
      bufferData = Buffer.from(data, "base64");
    } else {
      try {
        bufferData = Buffer.from(decodeURIComponent(data));
      } catch (_decodeError) {
        bufferData = Buffer.from(data);
      }
    }
  } catch (_bufferError) {
    bufferData = Buffer.alloc(0);
  }
  return {
    data: bufferData,
    encoding: encoding || null,
    contentType: contentType || "application/octet-stream",
    params
  };
};
function resolveContent(data, key, options, callback) {
  if (!callback && typeof options === "function") {
    callback = options;
    options = false;
  }
  options = options || {};
  let promise;
  if (!callback) {
    promise = new Promise((resolve3, reject) => {
      callback = callbackPromise(resolve3, reject);
    });
  }
  resolveContentValue(data, key, options, callback);
  return promise;
}
function resolveContentValue(data, key, options, callback) {
  let content = data && data[key] && data[key].content || data[key];
  const encoding = (typeof data[key] === "object" && data[key].encoding || "utf8").toString().toLowerCase().replace(/[-_\s]/g, "");
  if (!content) {
    return callback(null, content);
  }
  if (typeof content === "object") {
    if (typeof content.pipe === "function") {
      return resolveStream(content, (err, value) => {
        if (err) {
          return callback(err);
        }
        if (data[key].content) {
          data[key].content = value;
        } else {
          data[key] = value;
        }
        callback(null, value);
      });
    } else if (/^data:/i.test(content.path || content.href)) {
      const parsedDataUri = parseDataURI(content.path || content.href);
      return callback(null, parsedDataUri && parsedDataUri.data ? parsedDataUri.data : Buffer.alloc(0));
    } else if (content.href || /^https?:\/\//i.test(content.path)) {
      const url = content.href || content.path;
      if (options.disableUrlAccess) {
        setImmediate(() => {
          const err = new Error("Url access rejected for " + url);
          err.code = EURLACCESS;
          callback(err);
        });
        return;
      }
      return resolveStream(fetch_default(url, { headers: content.httpHeaders, tls: content.tls }), callback);
    } else if (content.path) {
      if (options.disableFileAccess) {
        setImmediate(() => {
          const err = new Error("File access rejected for " + content.path);
          err.code = EFILEACCESS;
          callback(err);
        });
        return;
      }
      return resolveStream(fs.createReadStream(content.path), callback);
    }
  }
  if (typeof data[key].content === "string" && !["utf8", "usascii", "ascii"].includes(encoding)) {
    content = Buffer.from(data[key].content, encoding);
  }
  setImmediate(() => callback(null, content));
}
var assign = function(...args) {
  const target = args.shift() || {};
  args.forEach((source) => {
    Object.keys(source || {}).forEach((key) => {
      if (isProtoKey(key)) {
        return;
      }
      if (["tls", "auth"].includes(key) && source[key] && typeof source[key] === "object") {
        target[key] = copyOwnKeys(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    });
  });
  return target;
};
var encodeXText = (str) => {
  if (!/[^\x21-\x2A\x2C-\x3C\x3E-\x7E]/.test(str)) {
    return str;
  }
  const buf = Buffer.from(str);
  let result = "";
  for (let i = 0, len = buf.length; i < len; i++) {
    const c = buf[i];
    if (c < 33 || c > 126 || c === 43 || c === 61) {
      result += "+" + (c < 16 ? "0" : "") + c.toString(16).toUpperCase();
    } else {
      result += String.fromCharCode(c);
    }
  }
  return result;
};
function resolveStream(stream, callback) {
  let responded = false;
  const chunks = [];
  let chunklen = 0;
  stream.on("error", (err) => {
    if (responded) {
      return;
    }
    responded = true;
    callback(err);
  });
  stream.on("readable", () => {
    let chunk;
    while ((chunk = stream.read()) !== null) {
      chunks.push(chunk);
      chunklen += chunk.length;
    }
  });
  stream.on("end", () => {
    if (responded) {
      return;
    }
    responded = true;
    let value;
    try {
      value = Buffer.concat(chunks, chunklen);
    } catch (E) {
      return callback(E);
    }
    callback(null, value);
  });
}
function createDefaultLogger(levels) {
  const levelMaxLen = levels.reduce((max, level) => Math.max(max, level.length), 0);
  const levelNames = /* @__PURE__ */ new Map();
  levels.forEach((level) => {
    let levelName = level.toUpperCase();
    if (levelName.length < levelMaxLen) {
      levelName += " ".repeat(levelMaxLen - levelName.length);
    }
    levelNames.set(level, levelName);
  });
  const print = (level, entry, message, ...args) => {
    let prefix = "";
    if (entry) {
      if (entry.tnx === "server") {
        prefix = "S: ";
      } else if (entry.tnx === "client") {
        prefix = "C: ";
      }
      if (entry.sid) {
        prefix = "[" + entry.sid + "] " + prefix;
      }
      if (entry.cid) {
        prefix = "[#" + entry.cid + "] " + prefix;
      }
    }
    message = util.format(message, ...args);
    message.split(/\r?\n/).forEach((line) => {
      console.log("[%s] %s %s", (/* @__PURE__ */ new Date()).toISOString().substr(0, 19).replace(/T/, " "), levelNames.get(level), prefix + line);
    });
  };
  const logger = {};
  levels.forEach((level) => {
    logger[level] = print.bind(null, level);
  });
  return logger;
}

// node_modules/nodemailer/dist/esm/mime-funcs/mime-types.js
import path from "node:path";
var defaultMimeType = "application/octet-stream";
var defaultExtension = "bin";
var mimeTypes = /* @__PURE__ */ new Map([
  ["application/acad", "dwg"],
  ["application/applixware", "aw"],
  ["application/arj", "arj"],
  ["application/atom+xml", "xml"],
  ["application/atomcat+xml", "atomcat"],
  ["application/atomsvc+xml", "atomsvc"],
  ["application/base64", ["mm", "mme"]],
  ["application/binhex", "hqx"],
  ["application/binhex4", "hqx"],
  ["application/book", ["book", "boo"]],
  ["application/ccxml+xml,", "ccxml"],
  ["application/cdf", "cdf"],
  ["application/cdmi-capability", "cdmia"],
  ["application/cdmi-container", "cdmic"],
  ["application/cdmi-domain", "cdmid"],
  ["application/cdmi-object", "cdmio"],
  ["application/cdmi-queue", "cdmiq"],
  ["application/clariscad", "ccad"],
  ["application/commonground", "dp"],
  ["application/cu-seeme", "cu"],
  ["application/davmount+xml", "davmount"],
  ["application/drafting", "drw"],
  ["application/dsptype", "tsp"],
  ["application/dssc+der", "dssc"],
  ["application/dssc+xml", "xdssc"],
  ["application/dxf", "dxf"],
  ["application/ecmascript", ["js", "es"]],
  ["application/emma+xml", "emma"],
  ["application/envoy", "evy"],
  ["application/epub+zip", "epub"],
  ["application/excel", ["xls", "xl", "xla", "xlb", "xlc", "xld", "xlk", "xll", "xlm", "xlt", "xlv", "xlw"]],
  ["application/exi", "exi"],
  ["application/font-tdpfr", "pfr"],
  ["application/fractals", "fif"],
  ["application/freeloader", "frl"],
  ["application/futuresplash", "spl"],
  ["application/geo+json", "geojson"],
  ["application/gnutar", "tgz"],
  ["application/groupwise", "vew"],
  ["application/hlp", "hlp"],
  ["application/hta", "hta"],
  ["application/hyperstudio", "stk"],
  ["application/i-deas", "unv"],
  ["application/iges", ["iges", "igs"]],
  ["application/inf", "inf"],
  ["application/internet-property-stream", "acx"],
  ["application/ipfix", "ipfix"],
  ["application/java", "class"],
  ["application/java-archive", "jar"],
  ["application/java-byte-code", "class"],
  ["application/java-serialized-object", "ser"],
  ["application/java-vm", "class"],
  ["application/javascript", "js"],
  ["application/json", "json"],
  ["application/lha", "lha"],
  ["application/lzx", "lzx"],
  ["application/mac-binary", "bin"],
  ["application/mac-binhex", "hqx"],
  ["application/mac-binhex40", "hqx"],
  ["application/mac-compactpro", "cpt"],
  ["application/macbinary", "bin"],
  ["application/mads+xml", "mads"],
  ["application/marc", "mrc"],
  ["application/marcxml+xml", "mrcx"],
  ["application/mathematica", "ma"],
  ["application/mathml+xml", "mathml"],
  ["application/mbedlet", "mbd"],
  ["application/mbox", "mbox"],
  ["application/mcad", "mcd"],
  ["application/mediaservercontrol+xml", "mscml"],
  ["application/metalink4+xml", "meta4"],
  ["application/mets+xml", "mets"],
  ["application/mime", "aps"],
  ["application/mods+xml", "mods"],
  ["application/mp21", "m21"],
  ["application/mp4", "mp4"],
  ["application/mspowerpoint", ["ppt", "pot", "pps", "ppz"]],
  ["application/msword", ["doc", "dot", "w6w", "wiz", "word"]],
  ["application/mswrite", "wri"],
  ["application/mxf", "mxf"],
  ["application/netmc", "mcp"],
  ["application/octet-stream", ["*"]],
  ["application/oda", "oda"],
  ["application/oebps-package+xml", "opf"],
  ["application/ogg", "ogx"],
  ["application/olescript", "axs"],
  ["application/onenote", "onetoc"],
  ["application/patch-ops-error+xml", "xer"],
  ["application/pdf", "pdf"],
  ["application/pgp-encrypted", "asc"],
  ["application/pgp-signature", "pgp"],
  ["application/pics-rules", "prf"],
  ["application/pkcs-12", "p12"],
  ["application/pkcs-crl", "crl"],
  ["application/pkcs10", "p10"],
  ["application/pkcs7-mime", ["p7c", "p7m"]],
  ["application/pkcs7-signature", "p7s"],
  ["application/pkcs8", "p8"],
  ["application/pkix-attr-cert", "ac"],
  ["application/pkix-cert", ["cer", "crt"]],
  ["application/pkix-crl", "crl"],
  ["application/pkix-pkipath", "pkipath"],
  ["application/pkixcmp", "pki"],
  ["application/plain", "text"],
  ["application/pls+xml", "pls"],
  ["application/postscript", ["ps", "ai", "eps"]],
  ["application/powerpoint", "ppt"],
  ["application/pro_eng", ["part", "prt"]],
  ["application/prs.cww", "cww"],
  ["application/pskc+xml", "pskcxml"],
  ["application/rdf+xml", "rdf"],
  ["application/reginfo+xml", "rif"],
  ["application/relax-ng-compact-syntax", "rnc"],
  ["application/resource-lists+xml", "rl"],
  ["application/resource-lists-diff+xml", "rld"],
  ["application/ringing-tones", "rng"],
  ["application/rls-services+xml", "rs"],
  ["application/rsd+xml", "rsd"],
  ["application/rss+xml", "xml"],
  ["application/rtf", ["rtf", "rtx"]],
  ["application/sbml+xml", "sbml"],
  ["application/scvp-cv-request", "scq"],
  ["application/scvp-cv-response", "scs"],
  ["application/scvp-vp-request", "spq"],
  ["application/scvp-vp-response", "spp"],
  ["application/sdp", "sdp"],
  ["application/sea", "sea"],
  ["application/set", "set"],
  ["application/set-payment-initiation", "setpay"],
  ["application/set-registration-initiation", "setreg"],
  ["application/shf+xml", "shf"],
  ["application/sla", "stl"],
  ["application/smil", ["smi", "smil"]],
  ["application/smil+xml", "smi"],
  ["application/solids", "sol"],
  ["application/sounder", "sdr"],
  ["application/sparql-query", "rq"],
  ["application/sparql-results+xml", "srx"],
  ["application/srgs", "gram"],
  ["application/srgs+xml", "grxml"],
  ["application/sru+xml", "sru"],
  ["application/ssml+xml", "ssml"],
  ["application/step", ["step", "stp"]],
  ["application/streamingmedia", "ssm"],
  ["application/tei+xml", "tei"],
  ["application/thraud+xml", "tfi"],
  ["application/timestamped-data", "tsd"],
  ["application/toolbook", "tbk"],
  ["application/vda", "vda"],
  ["application/vnd.3gpp.pic-bw-large", "plb"],
  ["application/vnd.3gpp.pic-bw-small", "psb"],
  ["application/vnd.3gpp.pic-bw-var", "pvb"],
  ["application/vnd.3gpp2.tcap", "tcap"],
  ["application/vnd.3m.post-it-notes", "pwn"],
  ["application/vnd.accpac.simply.aso", "aso"],
  ["application/vnd.accpac.simply.imp", "imp"],
  ["application/vnd.acucobol", "acu"],
  ["application/vnd.acucorp", "atc"],
  ["application/vnd.adobe.air-application-installer-package+zip", "air"],
  ["application/vnd.adobe.fxp", "fxp"],
  ["application/vnd.adobe.xdp+xml", "xdp"],
  ["application/vnd.adobe.xfdf", "xfdf"],
  ["application/vnd.ahead.space", "ahead"],
  ["application/vnd.airzip.filesecure.azf", "azf"],
  ["application/vnd.airzip.filesecure.azs", "azs"],
  ["application/vnd.amazon.ebook", "azw"],
  ["application/vnd.americandynamics.acc", "acc"],
  ["application/vnd.amiga.ami", "ami"],
  ["application/vnd.android.package-archive", "apk"],
  ["application/vnd.anser-web-certificate-issue-initiation", "cii"],
  ["application/vnd.anser-web-funds-transfer-initiation", "fti"],
  ["application/vnd.antix.game-component", "atx"],
  ["application/vnd.apple.installer+xml", "mpkg"],
  ["application/vnd.apple.mpegurl", "m3u8"],
  ["application/vnd.aristanetworks.swi", "swi"],
  ["application/vnd.audiograph", "aep"],
  ["application/vnd.blueice.multipass", "mpm"],
  ["application/vnd.bmi", "bmi"],
  ["application/vnd.businessobjects", "rep"],
  ["application/vnd.chemdraw+xml", "cdxml"],
  ["application/vnd.chipnuts.karaoke-mmd", "mmd"],
  ["application/vnd.cinderella", "cdy"],
  ["application/vnd.claymore", "cla"],
  ["application/vnd.cloanto.rp9", "rp9"],
  ["application/vnd.clonk.c4group", "c4g"],
  ["application/vnd.cluetrust.cartomobile-config", "c11amc"],
  ["application/vnd.cluetrust.cartomobile-config-pkg", "c11amz"],
  ["application/vnd.commonspace", "csp"],
  ["application/vnd.contact.cmsg", "cdbcmsg"],
  ["application/vnd.cosmocaller", "cmc"],
  ["application/vnd.crick.clicker", "clkx"],
  ["application/vnd.crick.clicker.keyboard", "clkk"],
  ["application/vnd.crick.clicker.palette", "clkp"],
  ["application/vnd.crick.clicker.template", "clkt"],
  ["application/vnd.crick.clicker.wordbank", "clkw"],
  ["application/vnd.criticaltools.wbs+xml", "wbs"],
  ["application/vnd.ctc-posml", "pml"],
  ["application/vnd.cups-ppd", "ppd"],
  ["application/vnd.curl.car", "car"],
  ["application/vnd.curl.pcurl", "pcurl"],
  ["application/vnd.data-vision.rdz", "rdz"],
  ["application/vnd.denovo.fcselayout-link", "fe_launch"],
  ["application/vnd.dna", "dna"],
  ["application/vnd.dolby.mlp", "mlp"],
  ["application/vnd.dpgraph", "dpg"],
  ["application/vnd.dreamfactory", "dfac"],
  ["application/vnd.dvb.ait", "ait"],
  ["application/vnd.dvb.service", "svc"],
  ["application/vnd.dynageo", "geo"],
  ["application/vnd.ecowin.chart", "mag"],
  ["application/vnd.enliven", "nml"],
  ["application/vnd.epson.esf", "esf"],
  ["application/vnd.epson.msf", "msf"],
  ["application/vnd.epson.quickanime", "qam"],
  ["application/vnd.epson.salt", "slt"],
  ["application/vnd.epson.ssf", "ssf"],
  ["application/vnd.eszigno3+xml", "es3"],
  ["application/vnd.ezpix-album", "ez2"],
  ["application/vnd.ezpix-package", "ez3"],
  ["application/vnd.fdf", "fdf"],
  ["application/vnd.fdsn.seed", "seed"],
  ["application/vnd.flographit", "gph"],
  ["application/vnd.fluxtime.clip", "ftc"],
  ["application/vnd.framemaker", "fm"],
  ["application/vnd.frogans.fnc", "fnc"],
  ["application/vnd.frogans.ltf", "ltf"],
  ["application/vnd.fsc.weblaunch", "fsc"],
  ["application/vnd.fujitsu.oasys", "oas"],
  ["application/vnd.fujitsu.oasys2", "oa2"],
  ["application/vnd.fujitsu.oasys3", "oa3"],
  ["application/vnd.fujitsu.oasysgp", "fg5"],
  ["application/vnd.fujitsu.oasysprs", "bh2"],
  ["application/vnd.fujixerox.ddd", "ddd"],
  ["application/vnd.fujixerox.docuworks", "xdw"],
  ["application/vnd.fujixerox.docuworks.binder", "xbd"],
  ["application/vnd.fuzzysheet", "fzs"],
  ["application/vnd.genomatix.tuxedo", "txd"],
  ["application/vnd.geogebra.file", "ggb"],
  ["application/vnd.geogebra.tool", "ggt"],
  ["application/vnd.geometry-explorer", "gex"],
  ["application/vnd.geonext", "gxt"],
  ["application/vnd.geoplan", "g2w"],
  ["application/vnd.geospace", "g3w"],
  ["application/vnd.gmx", "gmx"],
  ["application/vnd.google-earth.kml+xml", "kml"],
  ["application/vnd.google-earth.kmz", "kmz"],
  ["application/vnd.grafeq", "gqf"],
  ["application/vnd.groove-account", "gac"],
  ["application/vnd.groove-help", "ghf"],
  ["application/vnd.groove-identity-message", "gim"],
  ["application/vnd.groove-injector", "grv"],
  ["application/vnd.groove-tool-message", "gtm"],
  ["application/vnd.groove-tool-template", "tpl"],
  ["application/vnd.groove-vcard", "vcg"],
  ["application/vnd.hal+xml", "hal"],
  ["application/vnd.handheld-entertainment+xml", "zmm"],
  ["application/vnd.hbci", "hbci"],
  ["application/vnd.hhe.lesson-player", "les"],
  ["application/vnd.hp-hpgl", ["hgl", "hpg", "hpgl"]],
  ["application/vnd.hp-hpid", "hpid"],
  ["application/vnd.hp-hps", "hps"],
  ["application/vnd.hp-jlyt", "jlt"],
  ["application/vnd.hp-pcl", "pcl"],
  ["application/vnd.hp-pclxl", "pclxl"],
  ["application/vnd.hydrostatix.sof-data", "sfd-hdstx"],
  ["application/vnd.hzn-3d-crossword", "x3d"],
  ["application/vnd.ibm.minipay", "mpy"],
  ["application/vnd.ibm.modcap", "afp"],
  ["application/vnd.ibm.rights-management", "irm"],
  ["application/vnd.ibm.secure-container", "sc"],
  ["application/vnd.iccprofile", "icc"],
  ["application/vnd.igloader", "igl"],
  ["application/vnd.immervision-ivp", "ivp"],
  ["application/vnd.immervision-ivu", "ivu"],
  ["application/vnd.insors.igm", "igm"],
  ["application/vnd.intercon.formnet", "xpw"],
  ["application/vnd.intergeo", "i2g"],
  ["application/vnd.intu.qbo", "qbo"],
  ["application/vnd.intu.qfx", "qfx"],
  ["application/vnd.ipunplugged.rcprofile", "rcprofile"],
  ["application/vnd.irepository.package+xml", "irp"],
  ["application/vnd.is-xpr", "xpr"],
  ["application/vnd.isac.fcs", "fcs"],
  ["application/vnd.jam", "jam"],
  ["application/vnd.jcp.javame.midlet-rms", "rms"],
  ["application/vnd.jisp", "jisp"],
  ["application/vnd.joost.joda-archive", "joda"],
  ["application/vnd.kahootz", "ktz"],
  ["application/vnd.kde.karbon", "karbon"],
  ["application/vnd.kde.kchart", "chrt"],
  ["application/vnd.kde.kformula", "kfo"],
  ["application/vnd.kde.kivio", "flw"],
  ["application/vnd.kde.kontour", "kon"],
  ["application/vnd.kde.kpresenter", "kpr"],
  ["application/vnd.kde.kspread", "ksp"],
  ["application/vnd.kde.kword", "kwd"],
  ["application/vnd.kenameaapp", "htke"],
  ["application/vnd.kidspiration", "kia"],
  ["application/vnd.kinar", "kne"],
  ["application/vnd.koan", "skp"],
  ["application/vnd.kodak-descriptor", "sse"],
  ["application/vnd.las.las+xml", "lasxml"],
  ["application/vnd.llamagraphics.life-balance.desktop", "lbd"],
  ["application/vnd.llamagraphics.life-balance.exchange+xml", "lbe"],
  ["application/vnd.lotus-1-2-3", "123"],
  ["application/vnd.lotus-approach", "apr"],
  ["application/vnd.lotus-freelance", "pre"],
  ["application/vnd.lotus-notes", "nsf"],
  ["application/vnd.lotus-organizer", "org"],
  ["application/vnd.lotus-screencam", "scm"],
  ["application/vnd.lotus-wordpro", "lwp"],
  ["application/vnd.macports.portpkg", "portpkg"],
  ["application/vnd.mcd", "mcd"],
  ["application/vnd.medcalcdata", "mc1"],
  ["application/vnd.mediastation.cdkey", "cdkey"],
  ["application/vnd.mfer", "mwf"],
  ["application/vnd.mfmp", "mfm"],
  ["application/vnd.micrografx.flo", "flo"],
  ["application/vnd.micrografx.igx", "igx"],
  ["application/vnd.mif", "mif"],
  ["application/vnd.mobius.daf", "daf"],
  ["application/vnd.mobius.dis", "dis"],
  ["application/vnd.mobius.mbk", "mbk"],
  ["application/vnd.mobius.mqy", "mqy"],
  ["application/vnd.mobius.msl", "msl"],
  ["application/vnd.mobius.plc", "plc"],
  ["application/vnd.mobius.txf", "txf"],
  ["application/vnd.mophun.application", "mpn"],
  ["application/vnd.mophun.certificate", "mpc"],
  ["application/vnd.mozilla.xul+xml", "xul"],
  ["application/vnd.ms-artgalry", "cil"],
  ["application/vnd.ms-cab-compressed", "cab"],
  ["application/vnd.ms-excel", ["xls", "xla", "xlc", "xlm", "xlt", "xlw", "xlb", "xll"]],
  ["application/vnd.ms-excel.addin.macroenabled.12", "xlam"],
  ["application/vnd.ms-excel.sheet.binary.macroenabled.12", "xlsb"],
  ["application/vnd.ms-excel.sheet.macroenabled.12", "xlsm"],
  ["application/vnd.ms-excel.template.macroenabled.12", "xltm"],
  ["application/vnd.ms-fontobject", "eot"],
  ["application/vnd.ms-htmlhelp", "chm"],
  ["application/vnd.ms-ims", "ims"],
  ["application/vnd.ms-lrm", "lrm"],
  ["application/vnd.ms-officetheme", "thmx"],
  ["application/vnd.ms-outlook", "msg"],
  ["application/vnd.ms-pki.certstore", "sst"],
  ["application/vnd.ms-pki.pko", "pko"],
  ["application/vnd.ms-pki.seccat", "cat"],
  ["application/vnd.ms-pki.stl", "stl"],
  ["application/vnd.ms-pkicertstore", "sst"],
  ["application/vnd.ms-pkiseccat", "cat"],
  ["application/vnd.ms-pkistl", "stl"],
  ["application/vnd.ms-powerpoint", ["ppt", "pot", "pps", "ppa", "pwz"]],
  ["application/vnd.ms-powerpoint.addin.macroenabled.12", "ppam"],
  ["application/vnd.ms-powerpoint.presentation.macroenabled.12", "pptm"],
  ["application/vnd.ms-powerpoint.slide.macroenabled.12", "sldm"],
  ["application/vnd.ms-powerpoint.slideshow.macroenabled.12", "ppsm"],
  ["application/vnd.ms-powerpoint.template.macroenabled.12", "potm"],
  ["application/vnd.ms-project", "mpp"],
  ["application/vnd.ms-word.document.macroenabled.12", "docm"],
  ["application/vnd.ms-word.template.macroenabled.12", "dotm"],
  ["application/vnd.ms-works", ["wks", "wcm", "wdb", "wps"]],
  ["application/vnd.ms-wpl", "wpl"],
  ["application/vnd.ms-xpsdocument", "xps"],
  ["application/vnd.mseq", "mseq"],
  ["application/vnd.musician", "mus"],
  ["application/vnd.muvee.style", "msty"],
  ["application/vnd.neurolanguage.nlu", "nlu"],
  ["application/vnd.noblenet-directory", "nnd"],
  ["application/vnd.noblenet-sealer", "nns"],
  ["application/vnd.noblenet-web", "nnw"],
  ["application/vnd.nokia.configuration-message", "ncm"],
  ["application/vnd.nokia.n-gage.data", "ngdat"],
  ["application/vnd.nokia.n-gage.symbian.install", "n-gage"],
  ["application/vnd.nokia.radio-preset", "rpst"],
  ["application/vnd.nokia.radio-presets", "rpss"],
  ["application/vnd.nokia.ringing-tone", "rng"],
  ["application/vnd.novadigm.edm", "edm"],
  ["application/vnd.novadigm.edx", "edx"],
  ["application/vnd.novadigm.ext", "ext"],
  ["application/vnd.oasis.opendocument.chart", "odc"],
  ["application/vnd.oasis.opendocument.chart-template", "otc"],
  ["application/vnd.oasis.opendocument.database", "odb"],
  ["application/vnd.oasis.opendocument.formula", "odf"],
  ["application/vnd.oasis.opendocument.formula-template", "odft"],
  ["application/vnd.oasis.opendocument.graphics", "odg"],
  ["application/vnd.oasis.opendocument.graphics-template", "otg"],
  ["application/vnd.oasis.opendocument.image", "odi"],
  ["application/vnd.oasis.opendocument.image-template", "oti"],
  ["application/vnd.oasis.opendocument.presentation", "odp"],
  ["application/vnd.oasis.opendocument.presentation-template", "otp"],
  ["application/vnd.oasis.opendocument.spreadsheet", "ods"],
  ["application/vnd.oasis.opendocument.spreadsheet-template", "ots"],
  ["application/vnd.oasis.opendocument.text", "odt"],
  ["application/vnd.oasis.opendocument.text-master", "odm"],
  ["application/vnd.oasis.opendocument.text-template", "ott"],
  ["application/vnd.oasis.opendocument.text-web", "oth"],
  ["application/vnd.olpc-sugar", "xo"],
  ["application/vnd.oma.dd2+xml", "dd2"],
  ["application/vnd.openofficeorg.extension", "oxt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.slide", "sldx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.slideshow", "ppsx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.template", "potx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.template", "xltx"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.template", "dotx"],
  ["application/vnd.osgeo.mapguide.package", "mgp"],
  ["application/vnd.osgi.dp", "dp"],
  ["application/vnd.palm", "pdb"],
  ["application/vnd.pawaafile", "paw"],
  ["application/vnd.pg.format", "str"],
  ["application/vnd.pg.osasli", "ei6"],
  ["application/vnd.picsel", "efif"],
  ["application/vnd.pmi.widget", "wg"],
  ["application/vnd.pocketlearn", "plf"],
  ["application/vnd.powerbuilder6", "pbd"],
  ["application/vnd.previewsystems.box", "box"],
  ["application/vnd.proteus.magazine", "mgz"],
  ["application/vnd.publishare-delta-tree", "qps"],
  ["application/vnd.pvi.ptid1", "ptid"],
  ["application/vnd.quark.quarkxpress", "qxd"],
  ["application/vnd.realvnc.bed", "bed"],
  ["application/vnd.recordare.musicxml", "mxl"],
  ["application/vnd.recordare.musicxml+xml", "musicxml"],
  ["application/vnd.rig.cryptonote", "cryptonote"],
  ["application/vnd.rim.cod", "cod"],
  ["application/vnd.rn-realmedia", "rm"],
  ["application/vnd.rn-realplayer", "rnx"],
  ["application/vnd.route66.link66+xml", "link66"],
  ["application/vnd.sailingtracker.track", "st"],
  ["application/vnd.seemail", "see"],
  ["application/vnd.sema", "sema"],
  ["application/vnd.semd", "semd"],
  ["application/vnd.semf", "semf"],
  ["application/vnd.shana.informed.formdata", "ifm"],
  ["application/vnd.shana.informed.formtemplate", "itp"],
  ["application/vnd.shana.informed.interchange", "iif"],
  ["application/vnd.shana.informed.package", "ipk"],
  ["application/vnd.simtech-mindmapper", "twd"],
  ["application/vnd.smaf", "mmf"],
  ["application/vnd.smart.teacher", "teacher"],
  ["application/vnd.solent.sdkm+xml", "sdkm"],
  ["application/vnd.spotfire.dxp", "dxp"],
  ["application/vnd.spotfire.sfs", "sfs"],
  ["application/vnd.stardivision.calc", "sdc"],
  ["application/vnd.stardivision.draw", "sda"],
  ["application/vnd.stardivision.impress", "sdd"],
  ["application/vnd.stardivision.math", "smf"],
  ["application/vnd.stardivision.writer", "sdw"],
  ["application/vnd.stardivision.writer-global", "sgl"],
  ["application/vnd.stepmania.stepchart", "sm"],
  ["application/vnd.sun.xml.calc", "sxc"],
  ["application/vnd.sun.xml.calc.template", "stc"],
  ["application/vnd.sun.xml.draw", "sxd"],
  ["application/vnd.sun.xml.draw.template", "std"],
  ["application/vnd.sun.xml.impress", "sxi"],
  ["application/vnd.sun.xml.impress.template", "sti"],
  ["application/vnd.sun.xml.math", "sxm"],
  ["application/vnd.sun.xml.writer", "sxw"],
  ["application/vnd.sun.xml.writer.global", "sxg"],
  ["application/vnd.sun.xml.writer.template", "stw"],
  ["application/vnd.sus-calendar", "sus"],
  ["application/vnd.svd", "svd"],
  ["application/vnd.symbian.install", "sis"],
  ["application/vnd.syncml+xml", "xsm"],
  ["application/vnd.syncml.dm+wbxml", "bdm"],
  ["application/vnd.syncml.dm+xml", "xdm"],
  ["application/vnd.tao.intent-module-archive", "tao"],
  ["application/vnd.tmobile-livetv", "tmo"],
  ["application/vnd.trid.tpt", "tpt"],
  ["application/vnd.triscape.mxs", "mxs"],
  ["application/vnd.trueapp", "tra"],
  ["application/vnd.ufdl", "ufd"],
  ["application/vnd.uiq.theme", "utz"],
  ["application/vnd.umajin", "umj"],
  ["application/vnd.unity", "unityweb"],
  ["application/vnd.uoml+xml", "uoml"],
  ["application/vnd.vcx", "vcx"],
  ["application/vnd.visio", "vsd"],
  ["application/vnd.visionary", "vis"],
  ["application/vnd.vsf", "vsf"],
  ["application/vnd.wap.wbxml", "wbxml"],
  ["application/vnd.wap.wmlc", "wmlc"],
  ["application/vnd.wap.wmlscriptc", "wmlsc"],
  ["application/vnd.webturbo", "wtb"],
  ["application/vnd.wolfram.player", "nbp"],
  ["application/vnd.wordperfect", "wpd"],
  ["application/vnd.wqd", "wqd"],
  ["application/vnd.wt.stf", "stf"],
  ["application/vnd.xara", ["web", "xar"]],
  ["application/vnd.xfdl", "xfdl"],
  ["application/vnd.yamaha.hv-dic", "hvd"],
  ["application/vnd.yamaha.hv-script", "hvs"],
  ["application/vnd.yamaha.hv-voice", "hvp"],
  ["application/vnd.yamaha.openscoreformat", "osf"],
  ["application/vnd.yamaha.openscoreformat.osfpvg+xml", "osfpvg"],
  ["application/vnd.yamaha.smaf-audio", "saf"],
  ["application/vnd.yamaha.smaf-phrase", "spf"],
  ["application/vnd.yellowriver-custom-menu", "cmp"],
  ["application/vnd.zul", "zir"],
  ["application/vnd.zzazz.deck+xml", "zaz"],
  ["application/vocaltec-media-desc", "vmd"],
  ["application/vocaltec-media-file", "vmf"],
  ["application/voicexml+xml", "vxml"],
  ["application/widget", "wgt"],
  ["application/winhlp", "hlp"],
  ["application/wordperfect", ["wp", "wp5", "wp6", "wpd"]],
  ["application/wordperfect6.0", ["w60", "wp5"]],
  ["application/wordperfect6.1", "w61"],
  ["application/wsdl+xml", "wsdl"],
  ["application/wspolicy+xml", "wspolicy"],
  ["application/x-123", "wk1"],
  ["application/x-7z-compressed", "7z"],
  ["application/x-abiword", "abw"],
  ["application/x-ace-compressed", "ace"],
  ["application/x-aim", "aim"],
  ["application/x-authorware-bin", "aab"],
  ["application/x-authorware-map", "aam"],
  ["application/x-authorware-seg", "aas"],
  ["application/x-bcpio", "bcpio"],
  ["application/x-binary", "bin"],
  ["application/x-binhex40", "hqx"],
  ["application/x-bittorrent", "torrent"],
  ["application/x-bsh", ["bsh", "sh", "shar"]],
  ["application/x-bytecode.elisp", "elc"],
  ["application/x-bytecode.python", "pyc"],
  ["application/x-bzip", "bz"],
  ["application/x-bzip2", ["boz", "bz2"]],
  ["application/x-cdf", "cdf"],
  ["application/x-cdlink", "vcd"],
  ["application/x-chat", ["cha", "chat"]],
  ["application/x-chess-pgn", "pgn"],
  ["application/x-cmu-raster", "ras"],
  ["application/x-cocoa", "cco"],
  ["application/x-compactpro", "cpt"],
  ["application/x-compress", "z"],
  ["application/x-compressed", ["tgz", "gz", "z", "zip"]],
  ["application/x-conference", "nsc"],
  ["application/x-cpio", "cpio"],
  ["application/x-cpt", "cpt"],
  ["application/x-csh", "csh"],
  ["application/x-debian-package", "deb"],
  ["application/x-deepv", "deepv"],
  ["application/x-director", ["dir", "dcr", "dxr"]],
  ["application/x-doom", "wad"],
  ["application/x-dtbncx+xml", "ncx"],
  ["application/x-dtbook+xml", "dtb"],
  ["application/x-dtbresource+xml", "res"],
  ["application/x-dvi", "dvi"],
  ["application/x-elc", "elc"],
  ["application/x-envoy", ["env", "evy"]],
  ["application/x-esrehber", "es"],
  ["application/x-excel", ["xls", "xla", "xlb", "xlc", "xld", "xlk", "xll", "xlm", "xlt", "xlv", "xlw"]],
  ["application/x-font-bdf", "bdf"],
  ["application/x-font-ghostscript", "gsf"],
  ["application/x-font-linux-psf", "psf"],
  ["application/x-font-otf", "otf"],
  ["application/x-font-pcf", "pcf"],
  ["application/x-font-snf", "snf"],
  ["application/x-font-ttf", "ttf"],
  ["application/x-font-type1", "pfa"],
  ["application/x-font-woff", "woff"],
  ["application/x-frame", "mif"],
  ["application/x-freelance", "pre"],
  ["application/x-futuresplash", "spl"],
  ["application/x-gnumeric", "gnumeric"],
  ["application/x-gsp", "gsp"],
  ["application/x-gss", "gss"],
  ["application/x-gtar", "gtar"],
  ["application/x-gzip", ["gz", "gzip"]],
  ["application/x-hdf", "hdf"],
  ["application/x-helpfile", ["help", "hlp"]],
  ["application/x-httpd-imap", "imap"],
  ["application/x-ima", "ima"],
  ["application/x-internet-signup", ["ins", "isp"]],
  ["application/x-internett-signup", "ins"],
  ["application/x-inventor", "iv"],
  ["application/x-ip2", "ip"],
  ["application/x-iphone", "iii"],
  ["application/x-java-class", "class"],
  ["application/x-java-commerce", "jcm"],
  ["application/x-java-jnlp-file", "jnlp"],
  ["application/x-javascript", "js"],
  ["application/x-koan", ["skd", "skm", "skp", "skt"]],
  ["application/x-ksh", "ksh"],
  ["application/x-latex", ["latex", "ltx"]],
  ["application/x-lha", "lha"],
  ["application/x-lisp", "lsp"],
  ["application/x-livescreen", "ivy"],
  ["application/x-lotus", "wq1"],
  ["application/x-lotusscreencam", "scm"],
  ["application/x-lzh", "lzh"],
  ["application/x-lzx", "lzx"],
  ["application/x-mac-binhex40", "hqx"],
  ["application/x-macbinary", "bin"],
  ["application/x-magic-cap-package-1.0", "mc$"],
  ["application/x-mathcad", "mcd"],
  ["application/x-meme", "mm"],
  ["application/x-midi", ["mid", "midi"]],
  ["application/x-mif", "mif"],
  ["application/x-mix-transfer", "nix"],
  ["application/x-mobipocket-ebook", "prc"],
  ["application/x-mplayer2", "asx"],
  ["application/x-ms-application", "application"],
  ["application/x-ms-wmd", "wmd"],
  ["application/x-ms-wmz", "wmz"],
  ["application/x-ms-xbap", "xbap"],
  ["application/x-msaccess", "mdb"],
  ["application/x-msbinder", "obd"],
  ["application/x-mscardfile", "crd"],
  ["application/x-msclip", "clp"],
  ["application/x-msdownload", ["exe", "dll"]],
  ["application/x-msexcel", ["xls", "xla", "xlw"]],
  ["application/x-msmediaview", ["mvb", "m13", "m14"]],
  ["application/x-msmetafile", "wmf"],
  ["application/x-msmoney", "mny"],
  ["application/x-mspowerpoint", "ppt"],
  ["application/x-mspublisher", "pub"],
  ["application/x-msschedule", "scd"],
  ["application/x-msterminal", "trm"],
  ["application/x-mswrite", "wri"],
  ["application/x-navi-animation", "ani"],
  ["application/x-navidoc", "nvd"],
  ["application/x-navimap", "map"],
  ["application/x-navistyle", "stl"],
  ["application/x-netcdf", ["cdf", "nc"]],
  ["application/x-newton-compatible-pkg", "pkg"],
  ["application/x-nokia-9000-communicator-add-on-software", "aos"],
  ["application/x-omc", "omc"],
  ["application/x-omcdatamaker", "omcd"],
  ["application/x-omcregerator", "omcr"],
  ["application/x-pagemaker", ["pm4", "pm5"]],
  ["application/x-pcl", "pcl"],
  ["application/x-perfmon", ["pma", "pmc", "pml", "pmr", "pmw"]],
  ["application/x-pixclscript", "plx"],
  ["application/x-pkcs10", "p10"],
  ["application/x-pkcs12", ["p12", "pfx"]],
  ["application/x-pkcs7-certificates", ["p7b", "spc"]],
  ["application/x-pkcs7-certreqresp", "p7r"],
  ["application/x-pkcs7-mime", ["p7m", "p7c"]],
  ["application/x-pkcs7-signature", ["p7s", "p7a"]],
  ["application/x-pointplus", "css"],
  ["application/x-portable-anymap", "pnm"],
  ["application/x-project", ["mpc", "mpt", "mpv", "mpx"]],
  ["application/x-qpro", "wb1"],
  ["application/x-rar-compressed", "rar"],
  ["application/x-rtf", "rtf"],
  ["application/x-sdp", "sdp"],
  ["application/x-sea", "sea"],
  ["application/x-seelogo", "sl"],
  ["application/x-sh", "sh"],
  ["application/x-shar", ["shar", "sh"]],
  ["application/x-shockwave-flash", "swf"],
  ["application/x-silverlight-app", "xap"],
  ["application/x-sit", "sit"],
  ["application/x-sprite", ["spr", "sprite"]],
  ["application/x-stuffit", "sit"],
  ["application/x-stuffitx", "sitx"],
  ["application/x-sv4cpio", "sv4cpio"],
  ["application/x-sv4crc", "sv4crc"],
  ["application/x-tar", "tar"],
  ["application/x-tbook", ["sbk", "tbk"]],
  ["application/x-tcl", "tcl"],
  ["application/x-tex", "tex"],
  ["application/x-tex-tfm", "tfm"],
  ["application/x-texinfo", ["texi", "texinfo"]],
  ["application/x-troff", ["roff", "t", "tr"]],
  ["application/x-troff-man", "man"],
  ["application/x-troff-me", "me"],
  ["application/x-troff-ms", "ms"],
  ["application/x-troff-msvideo", "avi"],
  ["application/x-ustar", "ustar"],
  ["application/x-visio", ["vsd", "vst", "vsw"]],
  ["application/x-vnd.audioexplosion.mzz", "mzz"],
  ["application/x-vnd.ls-xpix", "xpix"],
  ["application/x-vrml", "vrml"],
  ["application/x-wais-source", ["src", "wsrc"]],
  ["application/x-winhelp", "hlp"],
  ["application/x-wintalk", "wtk"],
  ["application/x-world", ["wrl", "svr"]],
  ["application/x-wpwin", "wpd"],
  ["application/x-wri", "wri"],
  ["application/x-x509-ca-cert", ["cer", "crt", "der"]],
  ["application/x-x509-user-cert", "crt"],
  ["application/x-xfig", "fig"],
  ["application/x-xpinstall", "xpi"],
  ["application/x-zip-compressed", "zip"],
  ["application/xcap-diff+xml", "xdf"],
  ["application/xenc+xml", "xenc"],
  ["application/xhtml+xml", "xhtml"],
  ["application/xml", "xml"],
  ["application/xml-dtd", "dtd"],
  ["application/xop+xml", "xop"],
  ["application/xslt+xml", "xslt"],
  ["application/xspf+xml", "xspf"],
  ["application/xv+xml", "mxml"],
  ["application/yang", "yang"],
  ["application/yin+xml", "yin"],
  ["application/ynd.ms-pkipko", "pko"],
  ["application/zip", "zip"],
  ["audio/adpcm", "adp"],
  ["audio/aiff", ["aiff", "aif", "aifc"]],
  ["audio/basic", ["snd", "au"]],
  ["audio/it", "it"],
  ["audio/make", ["funk", "my", "pfunk"]],
  ["audio/make.my.funk", "pfunk"],
  ["audio/mid", ["mid", "rmi"]],
  ["audio/midi", ["midi", "kar", "mid"]],
  ["audio/mod", "mod"],
  ["audio/mp4", "mp4a"],
  ["audio/mpeg", ["mpga", "mp3", "m2a", "mp2", "mpa", "mpg"]],
  ["audio/mpeg3", "mp3"],
  ["audio/nspaudio", ["la", "lma"]],
  ["audio/ogg", "oga"],
  ["audio/s3m", "s3m"],
  ["audio/tsp-audio", "tsi"],
  ["audio/tsplayer", "tsp"],
  ["audio/vnd.dece.audio", "uva"],
  ["audio/vnd.digital-winds", "eol"],
  ["audio/vnd.dra", "dra"],
  ["audio/vnd.dts", "dts"],
  ["audio/vnd.dts.hd", "dtshd"],
  ["audio/vnd.lucent.voice", "lvp"],
  ["audio/vnd.ms-playready.media.pya", "pya"],
  ["audio/vnd.nuera.ecelp4800", "ecelp4800"],
  ["audio/vnd.nuera.ecelp7470", "ecelp7470"],
  ["audio/vnd.nuera.ecelp9600", "ecelp9600"],
  ["audio/vnd.qcelp", "qcp"],
  ["audio/vnd.rip", "rip"],
  ["audio/voc", "voc"],
  ["audio/voxware", "vox"],
  ["audio/wav", "wav"],
  ["audio/webm", "weba"],
  ["audio/x-aac", "aac"],
  ["audio/x-adpcm", "snd"],
  ["audio/x-aiff", ["aiff", "aif", "aifc"]],
  ["audio/x-au", "au"],
  ["audio/x-gsm", ["gsd", "gsm"]],
  ["audio/x-jam", "jam"],
  ["audio/x-liveaudio", "lam"],
  ["audio/x-mid", ["mid", "midi"]],
  ["audio/x-midi", ["midi", "mid"]],
  ["audio/x-mod", "mod"],
  ["audio/x-mpeg", "mp2"],
  ["audio/x-mpeg-3", "mp3"],
  ["audio/x-mpegurl", "m3u"],
  ["audio/x-mpequrl", "m3u"],
  ["audio/x-ms-wax", "wax"],
  ["audio/x-ms-wma", "wma"],
  ["audio/x-nspaudio", ["la", "lma"]],
  ["audio/x-pn-realaudio", ["ra", "ram", "rm", "rmm", "rmp"]],
  ["audio/x-pn-realaudio-plugin", ["ra", "rmp", "rpm"]],
  ["audio/x-psid", "sid"],
  ["audio/x-realaudio", "ra"],
  ["audio/x-twinvq", "vqf"],
  ["audio/x-twinvq-plugin", ["vqe", "vql"]],
  ["audio/x-vnd.audioexplosion.mjuicemediafile", "mjf"],
  ["audio/x-voc", "voc"],
  ["audio/x-wav", "wav"],
  ["audio/xm", "xm"],
  ["chemical/x-cdx", "cdx"],
  ["chemical/x-cif", "cif"],
  ["chemical/x-cmdf", "cmdf"],
  ["chemical/x-cml", "cml"],
  ["chemical/x-csml", "csml"],
  ["chemical/x-pdb", ["pdb", "xyz"]],
  ["chemical/x-xyz", "xyz"],
  ["drawing/x-dwf", "dwf"],
  ["i-world/i-vrml", "ivr"],
  ["image/bmp", ["bmp", "bm"]],
  ["image/cgm", "cgm"],
  ["image/cis-cod", "cod"],
  ["image/cmu-raster", ["ras", "rast"]],
  ["image/fif", "fif"],
  ["image/florian", ["flo", "turbot"]],
  ["image/g3fax", "g3"],
  ["image/gif", "gif"],
  ["image/ief", ["ief", "iefs"]],
  ["image/jpeg", ["jpeg", "jpe", "jpg", "jfif", "jfif-tbnl"]],
  ["image/jutvision", "jut"],
  ["image/ktx", "ktx"],
  ["image/naplps", ["nap", "naplps"]],
  ["image/pict", ["pic", "pict"]],
  ["image/pipeg", "jfif"],
  ["image/pjpeg", ["jfif", "jpe", "jpeg", "jpg"]],
  ["image/png", ["png", "x-png"]],
  ["image/prs.btif", "btif"],
  ["image/svg+xml", "svg"],
  ["image/tiff", ["tif", "tiff"]],
  ["image/vasa", "mcf"],
  ["image/vnd.adobe.photoshop", "psd"],
  ["image/vnd.dece.graphic", "uvi"],
  ["image/vnd.djvu", "djvu"],
  ["image/vnd.dvb.subtitle", "sub"],
  ["image/vnd.dwg", ["dwg", "dxf", "svf"]],
  ["image/vnd.dxf", "dxf"],
  ["image/vnd.fastbidsheet", "fbs"],
  ["image/vnd.fpx", "fpx"],
  ["image/vnd.fst", "fst"],
  ["image/vnd.fujixerox.edmics-mmr", "mmr"],
  ["image/vnd.fujixerox.edmics-rlc", "rlc"],
  ["image/vnd.ms-modi", "mdi"],
  ["image/vnd.net-fpx", ["fpx", "npx"]],
  ["image/vnd.rn-realflash", "rf"],
  ["image/vnd.rn-realpix", "rp"],
  ["image/vnd.wap.wbmp", "wbmp"],
  ["image/vnd.xiff", "xif"],
  ["image/webp", "webp"],
  ["image/x-cmu-raster", "ras"],
  ["image/x-cmx", "cmx"],
  ["image/x-dwg", ["dwg", "dxf", "svf"]],
  ["image/x-freehand", "fh"],
  ["image/x-icon", "ico"],
  ["image/x-jg", "art"],
  ["image/x-jps", "jps"],
  ["image/x-niff", ["niff", "nif"]],
  ["image/x-pcx", "pcx"],
  ["image/x-pict", ["pct", "pic"]],
  ["image/x-portable-anymap", "pnm"],
  ["image/x-portable-bitmap", "pbm"],
  ["image/x-portable-graymap", "pgm"],
  ["image/x-portable-greymap", "pgm"],
  ["image/x-portable-pixmap", "ppm"],
  ["image/x-quicktime", ["qif", "qti", "qtif"]],
  ["image/x-rgb", "rgb"],
  ["image/x-tiff", ["tif", "tiff"]],
  ["image/x-windows-bmp", "bmp"],
  ["image/x-xbitmap", "xbm"],
  ["image/x-xbm", "xbm"],
  ["image/x-xpixmap", ["xpm", "pm"]],
  ["image/x-xwd", "xwd"],
  ["image/x-xwindowdump", "xwd"],
  ["image/xbm", "xbm"],
  ["image/xpm", "xpm"],
  ["message/rfc822", ["eml", "mht", "mhtml", "nws", "mime"]],
  ["model/iges", ["iges", "igs"]],
  ["model/mesh", "msh"],
  ["model/vnd.collada+xml", "dae"],
  ["model/vnd.dwf", "dwf"],
  ["model/vnd.gdl", "gdl"],
  ["model/vnd.gtw", "gtw"],
  ["model/vnd.mts", "mts"],
  ["model/vnd.vtu", "vtu"],
  ["model/vrml", ["vrml", "wrl", "wrz"]],
  ["model/x-pov", "pov"],
  ["multipart/x-gzip", "gzip"],
  ["multipart/x-ustar", "ustar"],
  ["multipart/x-zip", "zip"],
  ["music/crescendo", ["mid", "midi"]],
  ["music/x-karaoke", "kar"],
  ["paleovu/x-pv", "pvu"],
  ["text/asp", "asp"],
  ["text/calendar", "ics"],
  ["text/css", "css"],
  ["text/csv", "csv"],
  ["text/ecmascript", "js"],
  ["text/h323", "323"],
  ["text/html", ["html", "htm", "stm", "acgi", "htmls", "htx", "shtml"]],
  ["text/iuls", "uls"],
  ["text/javascript", "js"],
  ["text/mcf", "mcf"],
  ["text/n3", "n3"],
  ["text/pascal", "pas"],
  [
    "text/plain",
    [
      "txt",
      "bas",
      "c",
      "h",
      "c++",
      "cc",
      "com",
      "conf",
      "cxx",
      "def",
      "f",
      "f90",
      "for",
      "g",
      "hh",
      "idc",
      "jav",
      "java",
      "list",
      "log",
      "lst",
      "m",
      "mar",
      "pl",
      "sdml",
      "text"
    ]
  ],
  ["text/plain-bas", "par"],
  ["text/prs.lines.tag", "dsc"],
  ["text/richtext", ["rtx", "rt", "rtf"]],
  ["text/scriplet", "wsc"],
  ["text/scriptlet", "sct"],
  ["text/sgml", ["sgm", "sgml"]],
  ["text/tab-separated-values", "tsv"],
  ["text/troff", "t"],
  ["text/turtle", "ttl"],
  ["text/uri-list", ["uni", "unis", "uri", "uris"]],
  ["text/vnd.abc", "abc"],
  ["text/vnd.curl", "curl"],
  ["text/vnd.curl.dcurl", "dcurl"],
  ["text/vnd.curl.mcurl", "mcurl"],
  ["text/vnd.curl.scurl", "scurl"],
  ["text/vnd.fly", "fly"],
  ["text/vnd.fmi.flexstor", "flx"],
  ["text/vnd.graphviz", "gv"],
  ["text/vnd.in3d.3dml", "3dml"],
  ["text/vnd.in3d.spot", "spot"],
  ["text/vnd.rn-realtext", "rt"],
  ["text/vnd.sun.j2me.app-descriptor", "jad"],
  ["text/vnd.wap.wml", "wml"],
  ["text/vnd.wap.wmlscript", "wmls"],
  ["text/webviewhtml", "htt"],
  ["text/x-asm", ["asm", "s"]],
  ["text/x-audiosoft-intra", "aip"],
  ["text/x-c", ["c", "cc", "cpp"]],
  ["text/x-component", "htc"],
  ["text/x-fortran", ["for", "f", "f77", "f90"]],
  ["text/x-h", ["h", "hh"]],
  ["text/x-java-source", ["java", "jav"]],
  ["text/x-java-source,java", "java"],
  ["text/x-la-asf", "lsx"],
  ["text/x-m", "m"],
  ["text/x-pascal", "p"],
  ["text/x-script", "hlb"],
  ["text/x-script.csh", "csh"],
  ["text/x-script.elisp", "el"],
  ["text/x-script.guile", "scm"],
  ["text/x-script.ksh", "ksh"],
  ["text/x-script.lisp", "lsp"],
  ["text/x-script.perl", "pl"],
  ["text/x-script.perl-module", "pm"],
  ["text/x-script.phyton", "py"],
  ["text/x-script.rexx", "rexx"],
  ["text/x-script.scheme", "scm"],
  ["text/x-script.sh", "sh"],
  ["text/x-script.tcl", "tcl"],
  ["text/x-script.tcsh", "tcsh"],
  ["text/x-script.zsh", "zsh"],
  ["text/x-server-parsed-html", ["shtml", "ssi"]],
  ["text/x-setext", "etx"],
  ["text/x-sgml", ["sgm", "sgml"]],
  ["text/x-speech", ["spc", "talk"]],
  ["text/x-uil", "uil"],
  ["text/x-uuencode", ["uu", "uue"]],
  ["text/x-vcalendar", "vcs"],
  ["text/x-vcard", "vcf"],
  ["text/xml", "xml"],
  ["video/3gpp", "3gp"],
  ["video/3gpp2", "3g2"],
  ["video/animaflex", "afl"],
  ["video/avi", "avi"],
  ["video/avs-video", "avs"],
  ["video/dl", "dl"],
  ["video/fli", "fli"],
  ["video/gl", "gl"],
  ["video/h261", "h261"],
  ["video/h263", "h263"],
  ["video/h264", "h264"],
  ["video/jpeg", "jpgv"],
  ["video/jpm", "jpm"],
  ["video/mj2", "mj2"],
  ["video/mp4", "mp4"],
  ["video/mpeg", ["mpeg", "mp2", "mpa", "mpe", "mpg", "mpv2", "m1v", "m2v", "mp3"]],
  ["video/msvideo", "avi"],
  ["video/ogg", "ogv"],
  ["video/quicktime", ["mov", "qt", "moov"]],
  ["video/vdo", "vdo"],
  ["video/vivo", ["viv", "vivo"]],
  ["video/vnd.dece.hd", "uvh"],
  ["video/vnd.dece.mobile", "uvm"],
  ["video/vnd.dece.pd", "uvp"],
  ["video/vnd.dece.sd", "uvs"],
  ["video/vnd.dece.video", "uvv"],
  ["video/vnd.fvt", "fvt"],
  ["video/vnd.mpegurl", "mxu"],
  ["video/vnd.ms-playready.media.pyv", "pyv"],
  ["video/vnd.rn-realvideo", "rv"],
  ["video/vnd.uvvu.mp4", "uvu"],
  ["video/vnd.vivo", ["viv", "vivo"]],
  ["video/vosaic", "vos"],
  ["video/webm", "webm"],
  ["video/x-amt-demorun", "xdr"],
  ["video/x-amt-showrun", "xsr"],
  ["video/x-atomic3d-feature", "fmf"],
  ["video/x-dl", "dl"],
  ["video/x-dv", ["dif", "dv"]],
  ["video/x-f4v", "f4v"],
  ["video/x-fli", "fli"],
  ["video/x-flv", "flv"],
  ["video/x-gl", "gl"],
  ["video/x-isvideo", "isu"],
  ["video/x-la-asf", ["lsf", "lsx"]],
  ["video/x-m4v", "m4v"],
  ["video/x-motion-jpeg", "mjpg"],
  ["video/x-mpeg", ["mp3", "mp2"]],
  ["video/x-mpeq2a", "mp2"],
  ["video/x-ms-asf", ["asf", "asr", "asx"]],
  ["video/x-ms-asf-plugin", "asx"],
  ["video/x-ms-wm", "wm"],
  ["video/x-ms-wmv", "wmv"],
  ["video/x-ms-wmx", "wmx"],
  ["video/x-ms-wvx", "wvx"],
  ["video/x-msvideo", "avi"],
  ["video/x-qtc", "qtc"],
  ["video/x-scm", "scm"],
  ["video/x-sgi-movie", ["movie", "mv"]],
  ["windows/metafile", "wmf"],
  ["www/mime", "mime"],
  ["x-conference/x-cooltalk", "ice"],
  ["x-music/x-midi", ["mid", "midi"]],
  ["x-world/x-3dmf", ["3dm", "3dmf", "qd3", "qd3d"]],
  ["x-world/x-svr", "svr"],
  ["x-world/x-vrml", ["flr", "vrml", "wrl", "wrz", "xaf", "xof"]],
  ["x-world/x-vrt", "vrt"],
  ["xgl/drawing", "xgz"],
  ["xgl/movie", "xmz"]
]);
var extensions = /* @__PURE__ */ new Map([
  ["123", "application/vnd.lotus-1-2-3"],
  ["323", "text/h323"],
  ["*", "application/octet-stream"],
  ["3dm", "x-world/x-3dmf"],
  ["3dmf", "x-world/x-3dmf"],
  ["3dml", "text/vnd.in3d.3dml"],
  ["3g2", "video/3gpp2"],
  ["3gp", "video/3gpp"],
  ["7z", "application/x-7z-compressed"],
  ["a", "application/octet-stream"],
  ["aab", "application/x-authorware-bin"],
  ["aac", "audio/x-aac"],
  ["aam", "application/x-authorware-map"],
  ["aas", "application/x-authorware-seg"],
  ["abc", "text/vnd.abc"],
  ["abw", "application/x-abiword"],
  ["ac", "application/pkix-attr-cert"],
  ["acc", "application/vnd.americandynamics.acc"],
  ["ace", "application/x-ace-compressed"],
  ["acgi", "text/html"],
  ["acu", "application/vnd.acucobol"],
  ["acx", "application/internet-property-stream"],
  ["adp", "audio/adpcm"],
  ["aep", "application/vnd.audiograph"],
  ["afl", "video/animaflex"],
  ["afp", "application/vnd.ibm.modcap"],
  ["ahead", "application/vnd.ahead.space"],
  ["ai", "application/postscript"],
  ["aif", ["audio/aiff", "audio/x-aiff"]],
  ["aifc", ["audio/aiff", "audio/x-aiff"]],
  ["aiff", ["audio/aiff", "audio/x-aiff"]],
  ["aim", "application/x-aim"],
  ["aip", "text/x-audiosoft-intra"],
  ["air", "application/vnd.adobe.air-application-installer-package+zip"],
  ["ait", "application/vnd.dvb.ait"],
  ["ami", "application/vnd.amiga.ami"],
  ["ani", "application/x-navi-animation"],
  ["aos", "application/x-nokia-9000-communicator-add-on-software"],
  ["apk", "application/vnd.android.package-archive"],
  ["application", "application/x-ms-application"],
  ["apr", "application/vnd.lotus-approach"],
  ["aps", "application/mime"],
  ["arc", "application/octet-stream"],
  ["arj", ["application/arj", "application/octet-stream"]],
  ["art", "image/x-jg"],
  ["asf", "video/x-ms-asf"],
  ["asm", "text/x-asm"],
  ["aso", "application/vnd.accpac.simply.aso"],
  ["asp", "text/asp"],
  ["asr", "video/x-ms-asf"],
  ["asx", ["video/x-ms-asf", "application/x-mplayer2", "video/x-ms-asf-plugin"]],
  ["atc", "application/vnd.acucorp"],
  ["atomcat", "application/atomcat+xml"],
  ["atomsvc", "application/atomsvc+xml"],
  ["atx", "application/vnd.antix.game-component"],
  ["au", ["audio/basic", "audio/x-au"]],
  ["avi", ["video/avi", "video/msvideo", "application/x-troff-msvideo", "video/x-msvideo"]],
  ["avs", "video/avs-video"],
  ["aw", "application/applixware"],
  ["axs", "application/olescript"],
  ["azf", "application/vnd.airzip.filesecure.azf"],
  ["azs", "application/vnd.airzip.filesecure.azs"],
  ["azw", "application/vnd.amazon.ebook"],
  ["bas", "text/plain"],
  ["bcpio", "application/x-bcpio"],
  ["bdf", "application/x-font-bdf"],
  ["bdm", "application/vnd.syncml.dm+wbxml"],
  ["bed", "application/vnd.realvnc.bed"],
  ["bh2", "application/vnd.fujitsu.oasysprs"],
  [
    "bin",
    ["application/octet-stream", "application/mac-binary", "application/macbinary", "application/x-macbinary", "application/x-binary"]
  ],
  ["bm", "image/bmp"],
  ["bmi", "application/vnd.bmi"],
  ["bmp", ["image/bmp", "image/x-windows-bmp"]],
  ["boo", "application/book"],
  ["book", "application/book"],
  ["box", "application/vnd.previewsystems.box"],
  ["boz", "application/x-bzip2"],
  ["bsh", "application/x-bsh"],
  ["btif", "image/prs.btif"],
  ["bz", "application/x-bzip"],
  ["bz2", "application/x-bzip2"],
  ["c", ["text/plain", "text/x-c"]],
  ["c++", "text/plain"],
  ["c11amc", "application/vnd.cluetrust.cartomobile-config"],
  ["c11amz", "application/vnd.cluetrust.cartomobile-config-pkg"],
  ["c4g", "application/vnd.clonk.c4group"],
  ["cab", "application/vnd.ms-cab-compressed"],
  ["car", "application/vnd.curl.car"],
  ["cat", ["application/vnd.ms-pkiseccat", "application/vnd.ms-pki.seccat"]],
  ["cc", ["text/plain", "text/x-c"]],
  ["ccad", "application/clariscad"],
  ["cco", "application/x-cocoa"],
  ["ccxml", "application/ccxml+xml,"],
  ["cdbcmsg", "application/vnd.contact.cmsg"],
  ["cdf", ["application/cdf", "application/x-cdf", "application/x-netcdf"]],
  ["cdkey", "application/vnd.mediastation.cdkey"],
  ["cdmia", "application/cdmi-capability"],
  ["cdmic", "application/cdmi-container"],
  ["cdmid", "application/cdmi-domain"],
  ["cdmio", "application/cdmi-object"],
  ["cdmiq", "application/cdmi-queue"],
  ["cdx", "chemical/x-cdx"],
  ["cdxml", "application/vnd.chemdraw+xml"],
  ["cdy", "application/vnd.cinderella"],
  ["cer", ["application/pkix-cert", "application/x-x509-ca-cert"]],
  ["cgm", "image/cgm"],
  ["cha", "application/x-chat"],
  ["chat", "application/x-chat"],
  ["chm", "application/vnd.ms-htmlhelp"],
  ["chrt", "application/vnd.kde.kchart"],
  ["cif", "chemical/x-cif"],
  ["cii", "application/vnd.anser-web-certificate-issue-initiation"],
  ["cil", "application/vnd.ms-artgalry"],
  ["cla", "application/vnd.claymore"],
  [
    "class",
    ["application/octet-stream", "application/java", "application/java-byte-code", "application/java-vm", "application/x-java-class"]
  ],
  ["clkk", "application/vnd.crick.clicker.keyboard"],
  ["clkp", "application/vnd.crick.clicker.palette"],
  ["clkt", "application/vnd.crick.clicker.template"],
  ["clkw", "application/vnd.crick.clicker.wordbank"],
  ["clkx", "application/vnd.crick.clicker"],
  ["clp", "application/x-msclip"],
  ["cmc", "application/vnd.cosmocaller"],
  ["cmdf", "chemical/x-cmdf"],
  ["cml", "chemical/x-cml"],
  ["cmp", "application/vnd.yellowriver-custom-menu"],
  ["cmx", "image/x-cmx"],
  ["cod", ["image/cis-cod", "application/vnd.rim.cod"]],
  ["com", ["application/octet-stream", "text/plain"]],
  ["conf", "text/plain"],
  ["cpio", "application/x-cpio"],
  ["cpp", "text/x-c"],
  ["cpt", ["application/mac-compactpro", "application/x-compactpro", "application/x-cpt"]],
  ["crd", "application/x-mscardfile"],
  ["crl", ["application/pkix-crl", "application/pkcs-crl"]],
  ["crt", ["application/pkix-cert", "application/x-x509-user-cert", "application/x-x509-ca-cert"]],
  ["cryptonote", "application/vnd.rig.cryptonote"],
  ["csh", ["text/x-script.csh", "application/x-csh"]],
  ["csml", "chemical/x-csml"],
  ["csp", "application/vnd.commonspace"],
  ["css", ["text/css", "application/x-pointplus"]],
  ["csv", "text/csv"],
  ["cu", "application/cu-seeme"],
  ["curl", "text/vnd.curl"],
  ["cww", "application/prs.cww"],
  ["cxx", "text/plain"],
  ["dae", "model/vnd.collada+xml"],
  ["daf", "application/vnd.mobius.daf"],
  ["davmount", "application/davmount+xml"],
  ["dcr", "application/x-director"],
  ["dcurl", "text/vnd.curl.dcurl"],
  ["dd2", "application/vnd.oma.dd2+xml"],
  ["ddd", "application/vnd.fujixerox.ddd"],
  ["deb", "application/x-debian-package"],
  ["deepv", "application/x-deepv"],
  ["def", "text/plain"],
  ["der", "application/x-x509-ca-cert"],
  ["dfac", "application/vnd.dreamfactory"],
  ["dif", "video/x-dv"],
  ["dir", "application/x-director"],
  ["dis", "application/vnd.mobius.dis"],
  ["djvu", "image/vnd.djvu"],
  ["dl", ["video/dl", "video/x-dl"]],
  ["dll", "application/x-msdownload"],
  ["dms", "application/octet-stream"],
  ["dna", "application/vnd.dna"],
  ["doc", "application/msword"],
  ["docm", "application/vnd.ms-word.document.macroenabled.12"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["dot", "application/msword"],
  ["dotm", "application/vnd.ms-word.template.macroenabled.12"],
  ["dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template"],
  ["dp", ["application/commonground", "application/vnd.osgi.dp"]],
  ["dpg", "application/vnd.dpgraph"],
  ["dra", "audio/vnd.dra"],
  ["drw", "application/drafting"],
  ["dsc", "text/prs.lines.tag"],
  ["dssc", "application/dssc+der"],
  ["dtb", "application/x-dtbook+xml"],
  ["dtd", "application/xml-dtd"],
  ["dts", "audio/vnd.dts"],
  ["dtshd", "audio/vnd.dts.hd"],
  ["dump", "application/octet-stream"],
  ["dv", "video/x-dv"],
  ["dvi", "application/x-dvi"],
  ["dwf", ["model/vnd.dwf", "drawing/x-dwf"]],
  ["dwg", ["application/acad", "image/vnd.dwg", "image/x-dwg"]],
  ["dxf", ["application/dxf", "image/vnd.dwg", "image/vnd.dxf", "image/x-dwg"]],
  ["dxp", "application/vnd.spotfire.dxp"],
  ["dxr", "application/x-director"],
  ["ecelp4800", "audio/vnd.nuera.ecelp4800"],
  ["ecelp7470", "audio/vnd.nuera.ecelp7470"],
  ["ecelp9600", "audio/vnd.nuera.ecelp9600"],
  ["edm", "application/vnd.novadigm.edm"],
  ["edx", "application/vnd.novadigm.edx"],
  ["efif", "application/vnd.picsel"],
  ["ei6", "application/vnd.pg.osasli"],
  ["el", "text/x-script.elisp"],
  ["elc", ["application/x-elc", "application/x-bytecode.elisp"]],
  ["eml", "message/rfc822"],
  ["emma", "application/emma+xml"],
  ["env", "application/x-envoy"],
  ["eol", "audio/vnd.digital-winds"],
  ["eot", "application/vnd.ms-fontobject"],
  ["eps", "application/postscript"],
  ["epub", "application/epub+zip"],
  ["es", ["application/ecmascript", "application/x-esrehber"]],
  ["es3", "application/vnd.eszigno3+xml"],
  ["esf", "application/vnd.epson.esf"],
  ["etx", "text/x-setext"],
  ["evy", ["application/envoy", "application/x-envoy"]],
  ["exe", ["application/octet-stream", "application/x-msdownload"]],
  ["exi", "application/exi"],
  ["ext", "application/vnd.novadigm.ext"],
  ["ez2", "application/vnd.ezpix-album"],
  ["ez3", "application/vnd.ezpix-package"],
  ["f", ["text/plain", "text/x-fortran"]],
  ["f4v", "video/x-f4v"],
  ["f77", "text/x-fortran"],
  ["f90", ["text/plain", "text/x-fortran"]],
  ["fbs", "image/vnd.fastbidsheet"],
  ["fcs", "application/vnd.isac.fcs"],
  ["fdf", "application/vnd.fdf"],
  ["fe_launch", "application/vnd.denovo.fcselayout-link"],
  ["fg5", "application/vnd.fujitsu.oasysgp"],
  ["fh", "image/x-freehand"],
  ["fif", ["application/fractals", "image/fif"]],
  ["fig", "application/x-xfig"],
  ["fli", ["video/fli", "video/x-fli"]],
  ["flo", ["image/florian", "application/vnd.micrografx.flo"]],
  ["flr", "x-world/x-vrml"],
  ["flv", "video/x-flv"],
  ["flw", "application/vnd.kde.kivio"],
  ["flx", "text/vnd.fmi.flexstor"],
  ["fly", "text/vnd.fly"],
  ["fm", "application/vnd.framemaker"],
  ["fmf", "video/x-atomic3d-feature"],
  ["fnc", "application/vnd.frogans.fnc"],
  ["for", ["text/plain", "text/x-fortran"]],
  ["fpx", ["image/vnd.fpx", "image/vnd.net-fpx"]],
  ["frl", "application/freeloader"],
  ["fsc", "application/vnd.fsc.weblaunch"],
  ["fst", "image/vnd.fst"],
  ["ftc", "application/vnd.fluxtime.clip"],
  ["fti", "application/vnd.anser-web-funds-transfer-initiation"],
  ["funk", "audio/make"],
  ["fvt", "video/vnd.fvt"],
  ["fxp", "application/vnd.adobe.fxp"],
  ["fzs", "application/vnd.fuzzysheet"],
  ["g", "text/plain"],
  ["g2w", "application/vnd.geoplan"],
  ["g3", "image/g3fax"],
  ["g3w", "application/vnd.geospace"],
  ["gac", "application/vnd.groove-account"],
  ["gdl", "model/vnd.gdl"],
  ["geo", "application/vnd.dynageo"],
  ["geojson", "application/geo+json"],
  ["gex", "application/vnd.geometry-explorer"],
  ["ggb", "application/vnd.geogebra.file"],
  ["ggt", "application/vnd.geogebra.tool"],
  ["ghf", "application/vnd.groove-help"],
  ["gif", "image/gif"],
  ["gim", "application/vnd.groove-identity-message"],
  ["gl", ["video/gl", "video/x-gl"]],
  ["gmx", "application/vnd.gmx"],
  ["gnumeric", "application/x-gnumeric"],
  ["gph", "application/vnd.flographit"],
  ["gqf", "application/vnd.grafeq"],
  ["gram", "application/srgs"],
  ["grv", "application/vnd.groove-injector"],
  ["grxml", "application/srgs+xml"],
  ["gsd", "audio/x-gsm"],
  ["gsf", "application/x-font-ghostscript"],
  ["gsm", "audio/x-gsm"],
  ["gsp", "application/x-gsp"],
  ["gss", "application/x-gss"],
  ["gtar", "application/x-gtar"],
  ["gtm", "application/vnd.groove-tool-message"],
  ["gtw", "model/vnd.gtw"],
  ["gv", "text/vnd.graphviz"],
  ["gxt", "application/vnd.geonext"],
  ["gz", ["application/x-gzip", "application/x-compressed"]],
  ["gzip", ["multipart/x-gzip", "application/x-gzip"]],
  ["h", ["text/plain", "text/x-h"]],
  ["h261", "video/h261"],
  ["h263", "video/h263"],
  ["h264", "video/h264"],
  ["hal", "application/vnd.hal+xml"],
  ["hbci", "application/vnd.hbci"],
  ["hdf", "application/x-hdf"],
  ["help", "application/x-helpfile"],
  ["hgl", "application/vnd.hp-hpgl"],
  ["hh", ["text/plain", "text/x-h"]],
  ["hlb", "text/x-script"],
  ["hlp", ["application/winhlp", "application/hlp", "application/x-helpfile", "application/x-winhelp"]],
  ["hpg", "application/vnd.hp-hpgl"],
  ["hpgl", "application/vnd.hp-hpgl"],
  ["hpid", "application/vnd.hp-hpid"],
  ["hps", "application/vnd.hp-hps"],
  [
    "hqx",
    [
      "application/mac-binhex40",
      "application/binhex",
      "application/binhex4",
      "application/mac-binhex",
      "application/x-binhex40",
      "application/x-mac-binhex40"
    ]
  ],
  ["hta", "application/hta"],
  ["htc", "text/x-component"],
  ["htke", "application/vnd.kenameaapp"],
  ["htm", "text/html"],
  ["html", "text/html"],
  ["htmls", "text/html"],
  ["htt", "text/webviewhtml"],
  ["htx", "text/html"],
  ["hvd", "application/vnd.yamaha.hv-dic"],
  ["hvp", "application/vnd.yamaha.hv-voice"],
  ["hvs", "application/vnd.yamaha.hv-script"],
  ["i2g", "application/vnd.intergeo"],
  ["icc", "application/vnd.iccprofile"],
  ["ice", "x-conference/x-cooltalk"],
  ["ico", "image/x-icon"],
  ["ics", "text/calendar"],
  ["idc", "text/plain"],
  ["ief", "image/ief"],
  ["iefs", "image/ief"],
  ["ifm", "application/vnd.shana.informed.formdata"],
  ["iges", ["application/iges", "model/iges"]],
  ["igl", "application/vnd.igloader"],
  ["igm", "application/vnd.insors.igm"],
  ["igs", ["application/iges", "model/iges"]],
  ["igx", "application/vnd.micrografx.igx"],
  ["iif", "application/vnd.shana.informed.interchange"],
  ["iii", "application/x-iphone"],
  ["ima", "application/x-ima"],
  ["imap", "application/x-httpd-imap"],
  ["imp", "application/vnd.accpac.simply.imp"],
  ["ims", "application/vnd.ms-ims"],
  ["inf", "application/inf"],
  ["ins", ["application/x-internet-signup", "application/x-internett-signup"]],
  ["ip", "application/x-ip2"],
  ["ipfix", "application/ipfix"],
  ["ipk", "application/vnd.shana.informed.package"],
  ["irm", "application/vnd.ibm.rights-management"],
  ["irp", "application/vnd.irepository.package+xml"],
  ["isp", "application/x-internet-signup"],
  ["isu", "video/x-isvideo"],
  ["it", "audio/it"],
  ["itp", "application/vnd.shana.informed.formtemplate"],
  ["iv", "application/x-inventor"],
  ["ivp", "application/vnd.immervision-ivp"],
  ["ivr", "i-world/i-vrml"],
  ["ivu", "application/vnd.immervision-ivu"],
  ["ivy", "application/x-livescreen"],
  ["jad", "text/vnd.sun.j2me.app-descriptor"],
  ["jam", ["application/vnd.jam", "audio/x-jam"]],
  ["jar", "application/java-archive"],
  ["jav", ["text/plain", "text/x-java-source"]],
  ["java", ["text/plain", "text/x-java-source,java", "text/x-java-source"]],
  ["jcm", "application/x-java-commerce"],
  ["jfif", ["image/pipeg", "image/jpeg", "image/pjpeg"]],
  ["jfif-tbnl", "image/jpeg"],
  ["jisp", "application/vnd.jisp"],
  ["jlt", "application/vnd.hp-jlyt"],
  ["jnlp", "application/x-java-jnlp-file"],
  ["joda", "application/vnd.joost.joda-archive"],
  ["jpe", ["image/jpeg", "image/pjpeg"]],
  ["jpeg", ["image/jpeg", "image/pjpeg"]],
  ["jpg", ["image/jpeg", "image/pjpeg"]],
  ["jpgv", "video/jpeg"],
  ["jpm", "video/jpm"],
  ["jps", "image/x-jps"],
  ["js", ["application/javascript", "application/ecmascript", "text/javascript", "text/ecmascript", "application/x-javascript"]],
  ["json", "application/json"],
  ["jut", "image/jutvision"],
  ["kar", ["audio/midi", "music/x-karaoke"]],
  ["karbon", "application/vnd.kde.karbon"],
  ["kfo", "application/vnd.kde.kformula"],
  ["kia", "application/vnd.kidspiration"],
  ["kml", "application/vnd.google-earth.kml+xml"],
  ["kmz", "application/vnd.google-earth.kmz"],
  ["kne", "application/vnd.kinar"],
  ["kon", "application/vnd.kde.kontour"],
  ["kpr", "application/vnd.kde.kpresenter"],
  ["ksh", ["application/x-ksh", "text/x-script.ksh"]],
  ["ksp", "application/vnd.kde.kspread"],
  ["ktx", "image/ktx"],
  ["ktz", "application/vnd.kahootz"],
  ["kwd", "application/vnd.kde.kword"],
  ["la", ["audio/nspaudio", "audio/x-nspaudio"]],
  ["lam", "audio/x-liveaudio"],
  ["lasxml", "application/vnd.las.las+xml"],
  ["latex", "application/x-latex"],
  ["lbd", "application/vnd.llamagraphics.life-balance.desktop"],
  ["lbe", "application/vnd.llamagraphics.life-balance.exchange+xml"],
  ["les", "application/vnd.hhe.lesson-player"],
  ["lha", ["application/octet-stream", "application/lha", "application/x-lha"]],
  ["lhx", "application/octet-stream"],
  ["link66", "application/vnd.route66.link66+xml"],
  ["list", "text/plain"],
  ["lma", ["audio/nspaudio", "audio/x-nspaudio"]],
  ["log", "text/plain"],
  ["lrm", "application/vnd.ms-lrm"],
  ["lsf", "video/x-la-asf"],
  ["lsp", ["application/x-lisp", "text/x-script.lisp"]],
  ["lst", "text/plain"],
  ["lsx", ["video/x-la-asf", "text/x-la-asf"]],
  ["ltf", "application/vnd.frogans.ltf"],
  ["ltx", "application/x-latex"],
  ["lvp", "audio/vnd.lucent.voice"],
  ["lwp", "application/vnd.lotus-wordpro"],
  ["lzh", ["application/octet-stream", "application/x-lzh"]],
  ["lzx", ["application/lzx", "application/octet-stream", "application/x-lzx"]],
  ["m", ["text/plain", "text/x-m"]],
  ["m13", "application/x-msmediaview"],
  ["m14", "application/x-msmediaview"],
  ["m1v", "video/mpeg"],
  ["m21", "application/mp21"],
  ["m2a", "audio/mpeg"],
  ["m2v", "video/mpeg"],
  ["m3u", ["audio/x-mpegurl", "audio/x-mpequrl"]],
  ["m3u8", "application/vnd.apple.mpegurl"],
  ["m4v", "video/x-m4v"],
  ["ma", "application/mathematica"],
  ["mads", "application/mads+xml"],
  ["mag", "application/vnd.ecowin.chart"],
  ["man", "application/x-troff-man"],
  ["map", "application/x-navimap"],
  ["mar", "text/plain"],
  ["mathml", "application/mathml+xml"],
  ["mbd", "application/mbedlet"],
  ["mbk", "application/vnd.mobius.mbk"],
  ["mbox", "application/mbox"],
  ["mc$", "application/x-magic-cap-package-1.0"],
  ["mc1", "application/vnd.medcalcdata"],
  ["mcd", ["application/mcad", "application/vnd.mcd", "application/x-mathcad"]],
  ["mcf", ["image/vasa", "text/mcf"]],
  ["mcp", "application/netmc"],
  ["mcurl", "text/vnd.curl.mcurl"],
  ["mdb", "application/x-msaccess"],
  ["mdi", "image/vnd.ms-modi"],
  ["me", "application/x-troff-me"],
  ["meta4", "application/metalink4+xml"],
  ["mets", "application/mets+xml"],
  ["mfm", "application/vnd.mfmp"],
  ["mgp", "application/vnd.osgeo.mapguide.package"],
  ["mgz", "application/vnd.proteus.magazine"],
  ["mht", "message/rfc822"],
  ["mhtml", "message/rfc822"],
  ["mid", ["audio/mid", "audio/midi", "music/crescendo", "x-music/x-midi", "audio/x-midi", "application/x-midi", "audio/x-mid"]],
  ["midi", ["audio/midi", "music/crescendo", "x-music/x-midi", "audio/x-midi", "application/x-midi", "audio/x-mid"]],
  ["mif", ["application/vnd.mif", "application/x-mif", "application/x-frame"]],
  ["mime", ["message/rfc822", "www/mime"]],
  ["mj2", "video/mj2"],
  ["mjf", "audio/x-vnd.audioexplosion.mjuicemediafile"],
  ["mjpg", "video/x-motion-jpeg"],
  ["mlp", "application/vnd.dolby.mlp"],
  ["mm", ["application/base64", "application/x-meme"]],
  ["mmd", "application/vnd.chipnuts.karaoke-mmd"],
  ["mme", "application/base64"],
  ["mmf", "application/vnd.smaf"],
  ["mmr", "image/vnd.fujixerox.edmics-mmr"],
  ["mny", "application/x-msmoney"],
  ["mod", ["audio/mod", "audio/x-mod"]],
  ["mods", "application/mods+xml"],
  ["moov", "video/quicktime"],
  ["mov", "video/quicktime"],
  ["movie", "video/x-sgi-movie"],
  ["mp2", ["video/mpeg", "audio/mpeg", "video/x-mpeg", "audio/x-mpeg", "video/x-mpeq2a"]],
  ["mp3", ["audio/mpeg", "audio/mpeg3", "video/mpeg", "audio/x-mpeg-3", "video/x-mpeg"]],
  ["mp4", ["video/mp4", "application/mp4"]],
  ["mp4a", "audio/mp4"],
  ["mpa", ["video/mpeg", "audio/mpeg"]],
  ["mpc", ["application/vnd.mophun.certificate", "application/x-project"]],
  ["mpe", "video/mpeg"],
  ["mpeg", "video/mpeg"],
  ["mpg", ["video/mpeg", "audio/mpeg"]],
  ["mpga", "audio/mpeg"],
  ["mpkg", "application/vnd.apple.installer+xml"],
  ["mpm", "application/vnd.blueice.multipass"],
  ["mpn", "application/vnd.mophun.application"],
  ["mpp", "application/vnd.ms-project"],
  ["mpt", "application/x-project"],
  ["mpv", "application/x-project"],
  ["mpv2", "video/mpeg"],
  ["mpx", "application/x-project"],
  ["mpy", "application/vnd.ibm.minipay"],
  ["mqy", "application/vnd.mobius.mqy"],
  ["mrc", "application/marc"],
  ["mrcx", "application/marcxml+xml"],
  ["ms", "application/x-troff-ms"],
  ["mscml", "application/mediaservercontrol+xml"],
  ["mseq", "application/vnd.mseq"],
  ["msf", "application/vnd.epson.msf"],
  ["msg", "application/vnd.ms-outlook"],
  ["msh", "model/mesh"],
  ["msl", "application/vnd.mobius.msl"],
  ["msty", "application/vnd.muvee.style"],
  ["mts", "model/vnd.mts"],
  ["mus", "application/vnd.musician"],
  ["musicxml", "application/vnd.recordare.musicxml+xml"],
  ["mv", "video/x-sgi-movie"],
  ["mvb", "application/x-msmediaview"],
  ["mwf", "application/vnd.mfer"],
  ["mxf", "application/mxf"],
  ["mxl", "application/vnd.recordare.musicxml"],
  ["mxml", "application/xv+xml"],
  ["mxs", "application/vnd.triscape.mxs"],
  ["mxu", "video/vnd.mpegurl"],
  ["my", "audio/make"],
  ["mzz", "application/x-vnd.audioexplosion.mzz"],
  ["n-gage", "application/vnd.nokia.n-gage.symbian.install"],
  ["n3", "text/n3"],
  ["nap", "image/naplps"],
  ["naplps", "image/naplps"],
  ["nbp", "application/vnd.wolfram.player"],
  ["nc", "application/x-netcdf"],
  ["ncm", "application/vnd.nokia.configuration-message"],
  ["ncx", "application/x-dtbncx+xml"],
  ["ngdat", "application/vnd.nokia.n-gage.data"],
  ["nif", "image/x-niff"],
  ["niff", "image/x-niff"],
  ["nix", "application/x-mix-transfer"],
  ["nlu", "application/vnd.neurolanguage.nlu"],
  ["nml", "application/vnd.enliven"],
  ["nnd", "application/vnd.noblenet-directory"],
  ["nns", "application/vnd.noblenet-sealer"],
  ["nnw", "application/vnd.noblenet-web"],
  ["npx", "image/vnd.net-fpx"],
  ["nsc", "application/x-conference"],
  ["nsf", "application/vnd.lotus-notes"],
  ["nvd", "application/x-navidoc"],
  ["nws", "message/rfc822"],
  ["o", "application/octet-stream"],
  ["oa2", "application/vnd.fujitsu.oasys2"],
  ["oa3", "application/vnd.fujitsu.oasys3"],
  ["oas", "application/vnd.fujitsu.oasys"],
  ["obd", "application/x-msbinder"],
  ["oda", "application/oda"],
  ["odb", "application/vnd.oasis.opendocument.database"],
  ["odc", "application/vnd.oasis.opendocument.chart"],
  ["odf", "application/vnd.oasis.opendocument.formula"],
  ["odft", "application/vnd.oasis.opendocument.formula-template"],
  ["odg", "application/vnd.oasis.opendocument.graphics"],
  ["odi", "application/vnd.oasis.opendocument.image"],
  ["odm", "application/vnd.oasis.opendocument.text-master"],
  ["odp", "application/vnd.oasis.opendocument.presentation"],
  ["ods", "application/vnd.oasis.opendocument.spreadsheet"],
  ["odt", "application/vnd.oasis.opendocument.text"],
  ["oga", "audio/ogg"],
  ["ogv", "video/ogg"],
  ["ogx", "application/ogg"],
  ["omc", "application/x-omc"],
  ["omcd", "application/x-omcdatamaker"],
  ["omcr", "application/x-omcregerator"],
  ["onetoc", "application/onenote"],
  ["opf", "application/oebps-package+xml"],
  ["org", "application/vnd.lotus-organizer"],
  ["osf", "application/vnd.yamaha.openscoreformat"],
  ["osfpvg", "application/vnd.yamaha.openscoreformat.osfpvg+xml"],
  ["otc", "application/vnd.oasis.opendocument.chart-template"],
  ["otf", "application/x-font-otf"],
  ["otg", "application/vnd.oasis.opendocument.graphics-template"],
  ["oth", "application/vnd.oasis.opendocument.text-web"],
  ["oti", "application/vnd.oasis.opendocument.image-template"],
  ["otp", "application/vnd.oasis.opendocument.presentation-template"],
  ["ots", "application/vnd.oasis.opendocument.spreadsheet-template"],
  ["ott", "application/vnd.oasis.opendocument.text-template"],
  ["oxt", "application/vnd.openofficeorg.extension"],
  ["p", "text/x-pascal"],
  ["p10", ["application/pkcs10", "application/x-pkcs10"]],
  ["p12", ["application/pkcs-12", "application/x-pkcs12"]],
  ["p7a", "application/x-pkcs7-signature"],
  ["p7b", "application/x-pkcs7-certificates"],
  ["p7c", ["application/pkcs7-mime", "application/x-pkcs7-mime"]],
  ["p7m", ["application/pkcs7-mime", "application/x-pkcs7-mime"]],
  ["p7r", "application/x-pkcs7-certreqresp"],
  ["p7s", ["application/pkcs7-signature", "application/x-pkcs7-signature"]],
  ["p8", "application/pkcs8"],
  ["par", "text/plain-bas"],
  ["part", "application/pro_eng"],
  ["pas", "text/pascal"],
  ["paw", "application/vnd.pawaafile"],
  ["pbd", "application/vnd.powerbuilder6"],
  ["pbm", "image/x-portable-bitmap"],
  ["pcf", "application/x-font-pcf"],
  ["pcl", ["application/vnd.hp-pcl", "application/x-pcl"]],
  ["pclxl", "application/vnd.hp-pclxl"],
  ["pct", "image/x-pict"],
  ["pcurl", "application/vnd.curl.pcurl"],
  ["pcx", "image/x-pcx"],
  ["pdb", ["application/vnd.palm", "chemical/x-pdb"]],
  ["pdf", "application/pdf"],
  ["pfa", "application/x-font-type1"],
  ["pfr", "application/font-tdpfr"],
  ["pfunk", ["audio/make", "audio/make.my.funk"]],
  ["pfx", "application/x-pkcs12"],
  ["pgm", ["image/x-portable-graymap", "image/x-portable-greymap"]],
  ["pgn", "application/x-chess-pgn"],
  ["pgp", "application/pgp-signature"],
  ["pic", ["image/pict", "image/x-pict"]],
  ["pict", "image/pict"],
  ["pkg", "application/x-newton-compatible-pkg"],
  ["pki", "application/pkixcmp"],
  ["pkipath", "application/pkix-pkipath"],
  ["pko", ["application/ynd.ms-pkipko", "application/vnd.ms-pki.pko"]],
  ["pl", ["text/plain", "text/x-script.perl"]],
  ["plb", "application/vnd.3gpp.pic-bw-large"],
  ["plc", "application/vnd.mobius.plc"],
  ["plf", "application/vnd.pocketlearn"],
  ["pls", "application/pls+xml"],
  ["plx", "application/x-pixclscript"],
  ["pm", ["text/x-script.perl-module", "image/x-xpixmap"]],
  ["pm4", "application/x-pagemaker"],
  ["pm5", "application/x-pagemaker"],
  ["pma", "application/x-perfmon"],
  ["pmc", "application/x-perfmon"],
  ["pml", ["application/vnd.ctc-posml", "application/x-perfmon"]],
  ["pmr", "application/x-perfmon"],
  ["pmw", "application/x-perfmon"],
  ["png", "image/png"],
  ["pnm", ["application/x-portable-anymap", "image/x-portable-anymap"]],
  ["portpkg", "application/vnd.macports.portpkg"],
  ["pot", ["application/vnd.ms-powerpoint", "application/mspowerpoint"]],
  ["potm", "application/vnd.ms-powerpoint.template.macroenabled.12"],
  ["potx", "application/vnd.openxmlformats-officedocument.presentationml.template"],
  ["pov", "model/x-pov"],
  ["ppa", "application/vnd.ms-powerpoint"],
  ["ppam", "application/vnd.ms-powerpoint.addin.macroenabled.12"],
  ["ppd", "application/vnd.cups-ppd"],
  ["ppm", "image/x-portable-pixmap"],
  ["pps", ["application/vnd.ms-powerpoint", "application/mspowerpoint"]],
  ["ppsm", "application/vnd.ms-powerpoint.slideshow.macroenabled.12"],
  ["ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow"],
  ["ppt", ["application/vnd.ms-powerpoint", "application/mspowerpoint", "application/powerpoint", "application/x-mspowerpoint"]],
  ["pptm", "application/vnd.ms-powerpoint.presentation.macroenabled.12"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["ppz", "application/mspowerpoint"],
  ["prc", "application/x-mobipocket-ebook"],
  ["pre", ["application/vnd.lotus-freelance", "application/x-freelance"]],
  ["prf", "application/pics-rules"],
  ["prt", "application/pro_eng"],
  ["ps", "application/postscript"],
  ["psb", "application/vnd.3gpp.pic-bw-small"],
  ["psd", ["application/octet-stream", "image/vnd.adobe.photoshop"]],
  ["psf", "application/x-font-linux-psf"],
  ["pskcxml", "application/pskc+xml"],
  ["ptid", "application/vnd.pvi.ptid1"],
  ["pub", "application/x-mspublisher"],
  ["pvb", "application/vnd.3gpp.pic-bw-var"],
  ["pvu", "paleovu/x-pv"],
  ["pwn", "application/vnd.3m.post-it-notes"],
  ["pwz", "application/vnd.ms-powerpoint"],
  ["py", "text/x-script.phyton"],
  ["pya", "audio/vnd.ms-playready.media.pya"],
  ["pyc", "application/x-bytecode.python"],
  ["pyv", "video/vnd.ms-playready.media.pyv"],
  ["qam", "application/vnd.epson.quickanime"],
  ["qbo", "application/vnd.intu.qbo"],
  ["qcp", "audio/vnd.qcelp"],
  ["qd3", "x-world/x-3dmf"],
  ["qd3d", "x-world/x-3dmf"],
  ["qfx", "application/vnd.intu.qfx"],
  ["qif", "image/x-quicktime"],
  ["qps", "application/vnd.publishare-delta-tree"],
  ["qt", "video/quicktime"],
  ["qtc", "video/x-qtc"],
  ["qti", "image/x-quicktime"],
  ["qtif", "image/x-quicktime"],
  ["qxd", "application/vnd.quark.quarkxpress"],
  ["ra", ["audio/x-realaudio", "audio/x-pn-realaudio", "audio/x-pn-realaudio-plugin"]],
  ["ram", "audio/x-pn-realaudio"],
  ["rar", "application/x-rar-compressed"],
  ["ras", ["image/cmu-raster", "application/x-cmu-raster", "image/x-cmu-raster"]],
  ["rast", "image/cmu-raster"],
  ["rcprofile", "application/vnd.ipunplugged.rcprofile"],
  ["rdf", "application/rdf+xml"],
  ["rdz", "application/vnd.data-vision.rdz"],
  ["rep", "application/vnd.businessobjects"],
  ["res", "application/x-dtbresource+xml"],
  ["rexx", "text/x-script.rexx"],
  ["rf", "image/vnd.rn-realflash"],
  ["rgb", "image/x-rgb"],
  ["rif", "application/reginfo+xml"],
  ["rip", "audio/vnd.rip"],
  ["rl", "application/resource-lists+xml"],
  ["rlc", "image/vnd.fujixerox.edmics-rlc"],
  ["rld", "application/resource-lists-diff+xml"],
  ["rm", ["application/vnd.rn-realmedia", "audio/x-pn-realaudio"]],
  ["rmi", "audio/mid"],
  ["rmm", "audio/x-pn-realaudio"],
  ["rmp", ["audio/x-pn-realaudio-plugin", "audio/x-pn-realaudio"]],
  ["rms", "application/vnd.jcp.javame.midlet-rms"],
  ["rnc", "application/relax-ng-compact-syntax"],
  ["rng", ["application/ringing-tones", "application/vnd.nokia.ringing-tone"]],
  ["rnx", "application/vnd.rn-realplayer"],
  ["roff", "application/x-troff"],
  ["rp", "image/vnd.rn-realpix"],
  ["rp9", "application/vnd.cloanto.rp9"],
  ["rpm", "audio/x-pn-realaudio-plugin"],
  ["rpss", "application/vnd.nokia.radio-presets"],
  ["rpst", "application/vnd.nokia.radio-preset"],
  ["rq", "application/sparql-query"],
  ["rs", "application/rls-services+xml"],
  ["rsd", "application/rsd+xml"],
  ["rt", ["text/richtext", "text/vnd.rn-realtext"]],
  ["rtf", ["application/rtf", "text/richtext", "application/x-rtf"]],
  ["rtx", ["text/richtext", "application/rtf"]],
  ["rv", "video/vnd.rn-realvideo"],
  ["s", "text/x-asm"],
  ["s3m", "audio/s3m"],
  ["saf", "application/vnd.yamaha.smaf-audio"],
  ["saveme", "application/octet-stream"],
  ["sbk", "application/x-tbook"],
  ["sbml", "application/sbml+xml"],
  ["sc", "application/vnd.ibm.secure-container"],
  ["scd", "application/x-msschedule"],
  [
    "scm",
    ["application/vnd.lotus-screencam", "video/x-scm", "text/x-script.guile", "application/x-lotusscreencam", "text/x-script.scheme"]
  ],
  ["scq", "application/scvp-cv-request"],
  ["scs", "application/scvp-cv-response"],
  ["sct", "text/scriptlet"],
  ["scurl", "text/vnd.curl.scurl"],
  ["sda", "application/vnd.stardivision.draw"],
  ["sdc", "application/vnd.stardivision.calc"],
  ["sdd", "application/vnd.stardivision.impress"],
  ["sdkm", "application/vnd.solent.sdkm+xml"],
  ["sdml", "text/plain"],
  ["sdp", ["application/sdp", "application/x-sdp"]],
  ["sdr", "application/sounder"],
  ["sdw", "application/vnd.stardivision.writer"],
  ["sea", ["application/sea", "application/x-sea"]],
  ["see", "application/vnd.seemail"],
  ["seed", "application/vnd.fdsn.seed"],
  ["sema", "application/vnd.sema"],
  ["semd", "application/vnd.semd"],
  ["semf", "application/vnd.semf"],
  ["ser", "application/java-serialized-object"],
  ["set", "application/set"],
  ["setpay", "application/set-payment-initiation"],
  ["setreg", "application/set-registration-initiation"],
  ["sfd-hdstx", "application/vnd.hydrostatix.sof-data"],
  ["sfs", "application/vnd.spotfire.sfs"],
  ["sgl", "application/vnd.stardivision.writer-global"],
  ["sgm", ["text/sgml", "text/x-sgml"]],
  ["sgml", ["text/sgml", "text/x-sgml"]],
  ["sh", ["application/x-shar", "application/x-bsh", "application/x-sh", "text/x-script.sh"]],
  ["shar", ["application/x-bsh", "application/x-shar"]],
  ["shf", "application/shf+xml"],
  ["shtml", ["text/html", "text/x-server-parsed-html"]],
  ["sid", "audio/x-psid"],
  ["sis", "application/vnd.symbian.install"],
  ["sit", ["application/x-stuffit", "application/x-sit"]],
  ["sitx", "application/x-stuffitx"],
  ["skd", "application/x-koan"],
  ["skm", "application/x-koan"],
  ["skp", ["application/vnd.koan", "application/x-koan"]],
  ["skt", "application/x-koan"],
  ["sl", "application/x-seelogo"],
  ["sldm", "application/vnd.ms-powerpoint.slide.macroenabled.12"],
  ["sldx", "application/vnd.openxmlformats-officedocument.presentationml.slide"],
  ["slt", "application/vnd.epson.salt"],
  ["sm", "application/vnd.stepmania.stepchart"],
  ["smf", "application/vnd.stardivision.math"],
  ["smi", ["application/smil", "application/smil+xml"]],
  ["smil", "application/smil"],
  ["snd", ["audio/basic", "audio/x-adpcm"]],
  ["snf", "application/x-font-snf"],
  ["sol", "application/solids"],
  ["spc", ["text/x-speech", "application/x-pkcs7-certificates"]],
  ["spf", "application/vnd.yamaha.smaf-phrase"],
  ["spl", ["application/futuresplash", "application/x-futuresplash"]],
  ["spot", "text/vnd.in3d.spot"],
  ["spp", "application/scvp-vp-response"],
  ["spq", "application/scvp-vp-request"],
  ["spr", "application/x-sprite"],
  ["sprite", "application/x-sprite"],
  ["src", "application/x-wais-source"],
  ["sru", "application/sru+xml"],
  ["srx", "application/sparql-results+xml"],
  ["sse", "application/vnd.kodak-descriptor"],
  ["ssf", "application/vnd.epson.ssf"],
  ["ssi", "text/x-server-parsed-html"],
  ["ssm", "application/streamingmedia"],
  ["ssml", "application/ssml+xml"],
  ["sst", ["application/vnd.ms-pkicertstore", "application/vnd.ms-pki.certstore"]],
  ["st", "application/vnd.sailingtracker.track"],
  ["stc", "application/vnd.sun.xml.calc.template"],
  ["std", "application/vnd.sun.xml.draw.template"],
  ["step", "application/step"],
  ["stf", "application/vnd.wt.stf"],
  ["sti", "application/vnd.sun.xml.impress.template"],
  ["stk", "application/hyperstudio"],
  ["stl", ["application/vnd.ms-pkistl", "application/sla", "application/vnd.ms-pki.stl", "application/x-navistyle"]],
  ["stm", "text/html"],
  ["stp", "application/step"],
  ["str", "application/vnd.pg.format"],
  ["stw", "application/vnd.sun.xml.writer.template"],
  ["sub", "image/vnd.dvb.subtitle"],
  ["sus", "application/vnd.sus-calendar"],
  ["sv4cpio", "application/x-sv4cpio"],
  ["sv4crc", "application/x-sv4crc"],
  ["svc", "application/vnd.dvb.service"],
  ["svd", "application/vnd.svd"],
  ["svf", ["image/vnd.dwg", "image/x-dwg"]],
  ["svg", "image/svg+xml"],
  ["svr", ["x-world/x-svr", "application/x-world"]],
  ["swf", "application/x-shockwave-flash"],
  ["swi", "application/vnd.aristanetworks.swi"],
  ["sxc", "application/vnd.sun.xml.calc"],
  ["sxd", "application/vnd.sun.xml.draw"],
  ["sxg", "application/vnd.sun.xml.writer.global"],
  ["sxi", "application/vnd.sun.xml.impress"],
  ["sxm", "application/vnd.sun.xml.math"],
  ["sxw", "application/vnd.sun.xml.writer"],
  ["t", ["text/troff", "application/x-troff"]],
  ["talk", "text/x-speech"],
  ["tao", "application/vnd.tao.intent-module-archive"],
  ["tar", "application/x-tar"],
  ["tbk", ["application/toolbook", "application/x-tbook"]],
  ["tcap", "application/vnd.3gpp2.tcap"],
  ["tcl", ["text/x-script.tcl", "application/x-tcl"]],
  ["tcsh", "text/x-script.tcsh"],
  ["teacher", "application/vnd.smart.teacher"],
  ["tei", "application/tei+xml"],
  ["tex", "application/x-tex"],
  ["texi", "application/x-texinfo"],
  ["texinfo", "application/x-texinfo"],
  ["text", ["application/plain", "text/plain"]],
  ["tfi", "application/thraud+xml"],
  ["tfm", "application/x-tex-tfm"],
  ["tgz", ["application/gnutar", "application/x-compressed"]],
  ["thmx", "application/vnd.ms-officetheme"],
  ["tif", ["image/tiff", "image/x-tiff"]],
  ["tiff", ["image/tiff", "image/x-tiff"]],
  ["tmo", "application/vnd.tmobile-livetv"],
  ["torrent", "application/x-bittorrent"],
  ["tpl", "application/vnd.groove-tool-template"],
  ["tpt", "application/vnd.trid.tpt"],
  ["tr", "application/x-troff"],
  ["tra", "application/vnd.trueapp"],
  ["trm", "application/x-msterminal"],
  ["tsd", "application/timestamped-data"],
  ["tsi", "audio/tsp-audio"],
  ["tsp", ["application/dsptype", "audio/tsplayer"]],
  ["tsv", "text/tab-separated-values"],
  ["ttf", "application/x-font-ttf"],
  ["ttl", "text/turtle"],
  ["turbot", "image/florian"],
  ["twd", "application/vnd.simtech-mindmapper"],
  ["txd", "application/vnd.genomatix.tuxedo"],
  ["txf", "application/vnd.mobius.txf"],
  ["txt", "text/plain"],
  ["ufd", "application/vnd.ufdl"],
  ["uil", "text/x-uil"],
  ["uls", "text/iuls"],
  ["umj", "application/vnd.umajin"],
  ["uni", "text/uri-list"],
  ["unis", "text/uri-list"],
  ["unityweb", "application/vnd.unity"],
  ["unv", "application/i-deas"],
  ["uoml", "application/vnd.uoml+xml"],
  ["uri", "text/uri-list"],
  ["uris", "text/uri-list"],
  ["ustar", ["application/x-ustar", "multipart/x-ustar"]],
  ["utz", "application/vnd.uiq.theme"],
  ["uu", ["application/octet-stream", "text/x-uuencode"]],
  ["uue", "text/x-uuencode"],
  ["uva", "audio/vnd.dece.audio"],
  ["uvh", "video/vnd.dece.hd"],
  ["uvi", "image/vnd.dece.graphic"],
  ["uvm", "video/vnd.dece.mobile"],
  ["uvp", "video/vnd.dece.pd"],
  ["uvs", "video/vnd.dece.sd"],
  ["uvu", "video/vnd.uvvu.mp4"],
  ["uvv", "video/vnd.dece.video"],
  ["vcd", "application/x-cdlink"],
  ["vcf", "text/x-vcard"],
  ["vcg", "application/vnd.groove-vcard"],
  ["vcs", "text/x-vcalendar"],
  ["vcx", "application/vnd.vcx"],
  ["vda", "application/vda"],
  ["vdo", "video/vdo"],
  ["vew", "application/groupwise"],
  ["vis", "application/vnd.visionary"],
  ["viv", ["video/vivo", "video/vnd.vivo"]],
  ["vivo", ["video/vivo", "video/vnd.vivo"]],
  ["vmd", "application/vocaltec-media-desc"],
  ["vmf", "application/vocaltec-media-file"],
  ["voc", ["audio/voc", "audio/x-voc"]],
  ["vos", "video/vosaic"],
  ["vox", "audio/voxware"],
  ["vqe", "audio/x-twinvq-plugin"],
  ["vqf", "audio/x-twinvq"],
  ["vql", "audio/x-twinvq-plugin"],
  ["vrml", ["model/vrml", "x-world/x-vrml", "application/x-vrml"]],
  ["vrt", "x-world/x-vrt"],
  ["vsd", ["application/vnd.visio", "application/x-visio"]],
  ["vsf", "application/vnd.vsf"],
  ["vst", "application/x-visio"],
  ["vsw", "application/x-visio"],
  ["vtu", "model/vnd.vtu"],
  ["vxml", "application/voicexml+xml"],
  ["w60", "application/wordperfect6.0"],
  ["w61", "application/wordperfect6.1"],
  ["w6w", "application/msword"],
  ["wad", "application/x-doom"],
  ["wav", ["audio/wav", "audio/x-wav"]],
  ["wax", "audio/x-ms-wax"],
  ["wb1", "application/x-qpro"],
  ["wbmp", "image/vnd.wap.wbmp"],
  ["wbs", "application/vnd.criticaltools.wbs+xml"],
  ["wbxml", "application/vnd.wap.wbxml"],
  ["wcm", "application/vnd.ms-works"],
  ["wdb", "application/vnd.ms-works"],
  ["web", "application/vnd.xara"],
  ["weba", "audio/webm"],
  ["webm", "video/webm"],
  ["webp", "image/webp"],
  ["wg", "application/vnd.pmi.widget"],
  ["wgt", "application/widget"],
  ["wiz", "application/msword"],
  ["wk1", "application/x-123"],
  ["wks", "application/vnd.ms-works"],
  ["wm", "video/x-ms-wm"],
  ["wma", "audio/x-ms-wma"],
  ["wmd", "application/x-ms-wmd"],
  ["wmf", ["windows/metafile", "application/x-msmetafile"]],
  ["wml", "text/vnd.wap.wml"],
  ["wmlc", "application/vnd.wap.wmlc"],
  ["wmls", "text/vnd.wap.wmlscript"],
  ["wmlsc", "application/vnd.wap.wmlscriptc"],
  ["wmv", "video/x-ms-wmv"],
  ["wmx", "video/x-ms-wmx"],
  ["wmz", "application/x-ms-wmz"],
  ["woff", "application/x-font-woff"],
  ["word", "application/msword"],
  ["wp", "application/wordperfect"],
  ["wp5", ["application/wordperfect", "application/wordperfect6.0"]],
  ["wp6", "application/wordperfect"],
  ["wpd", ["application/wordperfect", "application/vnd.wordperfect", "application/x-wpwin"]],
  ["wpl", "application/vnd.ms-wpl"],
  ["wps", "application/vnd.ms-works"],
  ["wq1", "application/x-lotus"],
  ["wqd", "application/vnd.wqd"],
  ["wri", ["application/mswrite", "application/x-wri", "application/x-mswrite"]],
  ["wrl", ["model/vrml", "x-world/x-vrml", "application/x-world"]],
  ["wrz", ["model/vrml", "x-world/x-vrml"]],
  ["wsc", "text/scriplet"],
  ["wsdl", "application/wsdl+xml"],
  ["wspolicy", "application/wspolicy+xml"],
  ["wsrc", "application/x-wais-source"],
  ["wtb", "application/vnd.webturbo"],
  ["wtk", "application/x-wintalk"],
  ["wvx", "video/x-ms-wvx"],
  ["x-png", "image/png"],
  ["x3d", "application/vnd.hzn-3d-crossword"],
  ["xaf", "x-world/x-vrml"],
  ["xap", "application/x-silverlight-app"],
  ["xar", "application/vnd.xara"],
  ["xbap", "application/x-ms-xbap"],
  ["xbd", "application/vnd.fujixerox.docuworks.binder"],
  ["xbm", ["image/xbm", "image/x-xbm", "image/x-xbitmap"]],
  ["xdf", "application/xcap-diff+xml"],
  ["xdm", "application/vnd.syncml.dm+xml"],
  ["xdp", "application/vnd.adobe.xdp+xml"],
  ["xdr", "video/x-amt-demorun"],
  ["xdssc", "application/dssc+xml"],
  ["xdw", "application/vnd.fujixerox.docuworks"],
  ["xenc", "application/xenc+xml"],
  ["xer", "application/patch-ops-error+xml"],
  ["xfdf", "application/vnd.adobe.xfdf"],
  ["xfdl", "application/vnd.xfdl"],
  ["xgz", "xgl/drawing"],
  ["xhtml", "application/xhtml+xml"],
  ["xif", "image/vnd.xiff"],
  ["xl", "application/excel"],
  ["xla", ["application/vnd.ms-excel", "application/excel", "application/x-msexcel", "application/x-excel"]],
  ["xlam", "application/vnd.ms-excel.addin.macroenabled.12"],
  ["xlb", ["application/excel", "application/vnd.ms-excel", "application/x-excel"]],
  ["xlc", ["application/vnd.ms-excel", "application/excel", "application/x-excel"]],
  ["xld", ["application/excel", "application/x-excel"]],
  ["xlk", ["application/excel", "application/x-excel"]],
  ["xll", ["application/excel", "application/vnd.ms-excel", "application/x-excel"]],
  ["xlm", ["application/vnd.ms-excel", "application/excel", "application/x-excel"]],
  ["xls", ["application/vnd.ms-excel", "application/excel", "application/x-msexcel", "application/x-excel"]],
  ["xlsb", "application/vnd.ms-excel.sheet.binary.macroenabled.12"],
  ["xlsm", "application/vnd.ms-excel.sheet.macroenabled.12"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["xlt", ["application/vnd.ms-excel", "application/excel", "application/x-excel"]],
  ["xltm", "application/vnd.ms-excel.template.macroenabled.12"],
  ["xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template"],
  ["xlv", ["application/excel", "application/x-excel"]],
  ["xlw", ["application/vnd.ms-excel", "application/excel", "application/x-msexcel", "application/x-excel"]],
  ["xm", "audio/xm"],
  ["xml", ["application/xml", "text/xml", "application/atom+xml", "application/rss+xml"]],
  ["xmz", "xgl/movie"],
  ["xo", "application/vnd.olpc-sugar"],
  ["xof", "x-world/x-vrml"],
  ["xop", "application/xop+xml"],
  ["xpi", "application/x-xpinstall"],
  ["xpix", "application/x-vnd.ls-xpix"],
  ["xpm", ["image/xpm", "image/x-xpixmap"]],
  ["xpr", "application/vnd.is-xpr"],
  ["xps", "application/vnd.ms-xpsdocument"],
  ["xpw", "application/vnd.intercon.formnet"],
  ["xslt", "application/xslt+xml"],
  ["xsm", "application/vnd.syncml+xml"],
  ["xspf", "application/xspf+xml"],
  ["xsr", "video/x-amt-showrun"],
  ["xul", "application/vnd.mozilla.xul+xml"],
  ["xwd", ["image/x-xwd", "image/x-xwindowdump"]],
  ["xyz", ["chemical/x-xyz", "chemical/x-pdb"]],
  ["yang", "application/yang"],
  ["yin", "application/yin+xml"],
  ["z", ["application/x-compressed", "application/x-compress"]],
  ["zaz", "application/vnd.zzazz.deck+xml"],
  ["zip", ["application/zip", "multipart/x-zip", "application/x-zip-compressed", "application/x-compressed"]],
  ["zir", "application/vnd.zul"],
  ["zmm", "application/vnd.handheld-entertainment+xml"],
  ["zoo", "application/octet-stream"],
  ["zsh", "text/x-script.zsh"]
]);
function detectMimeType(filename) {
  if (!filename) {
    return defaultMimeType;
  }
  const parsed = path.parse(filename);
  const extension = (parsed.ext.substr(1) || parsed.name || "").split("?").shift().trim().toLowerCase();
  const value = extensions.has(extension) ? extensions.get(extension) : defaultMimeType;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
function detectExtension(mimeType) {
  if (!mimeType) {
    return defaultExtension;
  }
  const parts = mimeType.toLowerCase().trim().split("/");
  const rootType = parts.shift().trim();
  const subType = parts.join("/").trim();
  if (mimeTypes.has(rootType + "/" + subType)) {
    const value = mimeTypes.get(rootType + "/" + subType);
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
  switch (rootType) {
    case "text":
      return "txt";
    default:
      return "bin";
  }
}

// node_modules/nodemailer/dist/esm/mime-node/index.js
import crypto from "node:crypto";
import fs2 from "node:fs";
import { PassThrough as PassThrough2 } from "node:stream";
import urlModule from "node:url";

// node_modules/nodemailer/dist/esm/base64/index.js
var base64_exports = {};
__export(base64_exports, {
  Encoder: () => Encoder,
  encode: () => encode2,
  wrap: () => wrap
});
import { Transform } from "node:stream";
function encode2(buffer) {
  if (typeof buffer === "string") {
    buffer = Buffer.from(buffer, "utf-8");
  }
  return buffer.toString("base64");
}
function wrap(str, lineLength) {
  str = (str || "").toString();
  lineLength = Math.max(Number(lineLength) || 76, 1);
  if (str.length <= lineLength) {
    return str;
  }
  const result = [];
  let pos = 0;
  const chunkLength = lineLength * 1024;
  const wrapRegex = new RegExp(".{" + lineLength + "}", "g");
  while (pos < str.length) {
    const wrappedLines = str.substr(pos, chunkLength).replace(wrapRegex, "$&\r\n").trim();
    result.push(wrappedLines);
    pos += chunkLength;
  }
  return result.join("\r\n").trim();
}
var Encoder = class extends Transform {
  constructor(options) {
    super();
    this.options = options || {};
    if (this.options.lineLength !== false) {
      this.options.lineLength = this.options.lineLength || 76;
    }
    this._curLine = "";
    this._remainingBytes = false;
    this.inputBytes = 0;
    this.outputBytes = 0;
  }
  /** @internal */
  _transform(chunk, encoding, done) {
    let buf = encoding !== "buffer" ? Buffer.from(chunk, encoding) : chunk;
    if (!buf || !buf.length) {
      setImmediate(done);
      return;
    }
    this.inputBytes += buf.length;
    if (this._remainingBytes && this._remainingBytes.length) {
      buf = Buffer.concat([this._remainingBytes, buf], this._remainingBytes.length + buf.length);
      this._remainingBytes = false;
    }
    if (buf.length % 3) {
      this._remainingBytes = buf.slice(buf.length - buf.length % 3);
      buf = buf.slice(0, buf.length - buf.length % 3);
    } else {
      this._remainingBytes = false;
    }
    let b64 = this._curLine + encode2(buf);
    if (this.options.lineLength) {
      b64 = wrap(b64, this.options.lineLength);
      const lastLF = b64.lastIndexOf("\n");
      if (lastLF < 0) {
        this._curLine = b64;
        b64 = "";
      } else if (lastLF === b64.length - 1) {
        this._curLine = "";
      } else {
        this._curLine = b64.substring(lastLF + 1);
        b64 = b64.substring(0, lastLF + 1);
      }
    }
    if (b64) {
      this.outputBytes += b64.length;
      this.push(Buffer.from(b64, "ascii"));
    }
    setImmediate(done);
  }
  /** @internal */
  _flush(done) {
    if (this._remainingBytes && this._remainingBytes.length) {
      this._curLine += encode2(this._remainingBytes);
    }
    if (this._curLine) {
      this._curLine = wrap(this._curLine, this.options.lineLength);
      this.outputBytes += this._curLine.length;
      this.push(Buffer.from(this._curLine, "ascii"));
      this._curLine = "";
    }
    done();
  }
};

// node_modules/nodemailer/dist/esm/qp/index.js
var qp_exports = {};
__export(qp_exports, {
  Encoder: () => Encoder2,
  encode: () => encode3,
  wrap: () => wrap2
});
import { Transform as Transform2 } from "node:stream";
var MIN_LINE_LENGTH = 4;
var QP_RANGES = [
  [9],
  // <TAB>
  [10],
  // <LF>
  [13],
  // <CR>
  [32, 60],
  // <SP>!"#$%&'()*+,-./0123456789:;
  [62, 126]
  // >?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}
];
function encode3(buffer) {
  if (typeof buffer === "string") {
    buffer = Buffer.from(buffer, "utf-8");
  }
  let result = "";
  let ord;
  for (let i = 0, len = buffer.length; i < len; i++) {
    ord = buffer[i];
    if (checkRanges(ord, QP_RANGES) && !((ord === 32 || ord === 9) && (i === len - 1 || buffer[i + 1] === 10 || buffer[i + 1] === 13))) {
      result += String.fromCharCode(ord);
      continue;
    }
    result += "=" + (ord < 16 ? "0" : "") + ord.toString(16).toUpperCase();
  }
  return result;
}
function wrap2(str, lineLength) {
  str = (str || "").toString();
  lineLength = Math.max(Number(lineLength) || 76, MIN_LINE_LENGTH);
  if (str.length <= lineLength) {
    return str;
  }
  let pos = 0;
  const len = str.length;
  let match, code, line;
  const lineMargin = Math.floor(lineLength / 3);
  let result = "";
  while (pos < len) {
    line = str.substr(pos, lineLength);
    if (match = line.match(/\r\n/)) {
      line = line.substr(0, match.index + match[0].length);
      result += line;
      pos += line.length;
      continue;
    }
    if (line.substr(-1) === "\n") {
      result += line;
      pos += line.length;
      continue;
    }
    if (match = line.substr(-lineMargin).match(/\n.*?$/)) {
      line = line.substr(0, line.length - (match[0].length - 1));
      result += line;
      pos += line.length;
      continue;
    }
    if (line.length > lineLength - lineMargin && (match = line.substr(-lineMargin).match(/[ \t.,!?][^ \t.,!?]*$/))) {
      line = line.substr(0, line.length - (match[0].length - 1));
    } else if (line.match(/[=][\da-f]{0,2}$/i)) {
      if (match = line.match(/[=][\da-f]{0,1}$/i)) {
        line = line.substr(0, line.length - match[0].length);
      }
      while (line.length > 3 && line.length < len - pos && !line.match(/^(?:=[\da-f]{2}){1,4}$/i) && (match = line.match(/[=][\da-f]{2}$/gi))) {
        code = parseInt(match[0].substr(1, 2), 16);
        if (code < 128) {
          break;
        }
        line = line.substr(0, line.length - 3);
        if (code >= 192) {
          break;
        }
      }
    }
    if (!line.length) {
      line = str.substr(pos, lineLength);
    }
    if (pos + line.length < len && line.substr(-1) !== "\n") {
      if (line.length === lineLength && line.match(/[=][\da-f]{2}$/i)) {
        line = line.substr(0, line.length - 3);
      } else if (line.length === lineLength) {
        line = line.substr(0, line.length - 1);
      }
      pos += line.length;
      line += "=\r\n";
    } else {
      pos += line.length;
    }
    result += line;
  }
  return result;
}
function checkRanges(nr, ranges) {
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    if (!range.length) {
      continue;
    }
    if (range.length === 1 && nr === range[0]) {
      return true;
    }
    if (range.length === 2 && nr >= range[0] && nr <= range[1]) {
      return true;
    }
  }
  return false;
}
var Encoder2 = class extends Transform2 {
  constructor(options) {
    super();
    this.options = options || {};
    if (this.options.lineLength !== false) {
      this.options.lineLength = this.options.lineLength || 76;
    }
    this._curLine = "";
    this.inputBytes = 0;
    this.outputBytes = 0;
  }
  /** @internal */
  _transform(chunk, encoding, done) {
    let qp;
    if (encoding !== "buffer") {
      chunk = Buffer.from(chunk, encoding);
    }
    if (!chunk || !chunk.length) {
      return done();
    }
    this.inputBytes += chunk.length;
    if (this.options.lineLength) {
      qp = this._curLine + encode3(chunk);
      qp = wrap2(qp, this.options.lineLength);
      qp = qp.replace(/(^|\n)([^\n]*)$/, (match, lineBreak, lastLine) => {
        this._curLine = lastLine;
        return lineBreak;
      });
      if (qp) {
        this.outputBytes += qp.length;
        this.push(qp);
      }
    } else {
      qp = encode3(chunk);
      this.outputBytes += qp.length;
      this.push(qp, "ascii");
    }
    done();
  }
  /** @internal */
  _flush(done) {
    if (this._curLine) {
      this.outputBytes += this._curLine.length;
      this.push(this._curLine, "ascii");
    }
    done();
  }
};

// node_modules/nodemailer/dist/esm/mime-funcs/index.js
function isPlainText(value, isParam) {
  const re = isParam ? /[\x00-\x1f\x7f"\u0080-\uFFFF]/ : /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/;
  return typeof value === "string" && !re.test(value);
}
function quoteString(value) {
  return '"' + (value || "").toString().replace(/["\\]/g, "\\$&") + '"';
}
function hasLongerLines(str, lineLength) {
  if (str.length > 128 * 1024) {
    return true;
  }
  return new RegExp("^.{" + (lineLength + 1) + ",}", "m").test(str);
}
function encodeWord(data, mimeWordEncoding, maxLength) {
  mimeWordEncoding = (mimeWordEncoding || "Q").toString().toUpperCase().trim().charAt(0);
  maxLength = maxLength || 0;
  let encodedStr;
  const toCharset = "UTF-8";
  if (maxLength && maxLength > 7 + toCharset.length) {
    maxLength -= 7 + toCharset.length;
  }
  if (mimeWordEncoding === "Q") {
    encodedStr = encode3(data).replace(/[^a-z0-9!*+\-/=]/gi, (chr) => {
      const ord = chr.charCodeAt(0).toString(16).toUpperCase();
      if (chr === " ") {
        return "_";
      }
      return "=" + (ord.length === 1 ? "0" + ord : ord);
    });
  } else if (mimeWordEncoding === "B") {
    encodedStr = typeof data === "string" ? data : data.toString("utf-8");
    maxLength = maxLength ? Math.max(3, (maxLength - maxLength % 4) / 4 * 3) : 0;
  }
  if (maxLength && (mimeWordEncoding !== "B" ? encodedStr : encode2(data)).length > maxLength) {
    if (mimeWordEncoding === "Q") {
      encodedStr = splitMimeEncodedString(encodedStr, maxLength).join("?= =?" + toCharset + "?" + mimeWordEncoding + "?");
    } else {
      const parts = [];
      let lpart = "";
      for (let i = 0, len = encodedStr.length; i < len; i++) {
        let chr = encodedStr.charAt(i);
        if (/[\ud800-\udbff]/.test(chr) && /[\udc00-\udfff]/.test(encodedStr.charAt(i + 1))) {
          chr += encodedStr.charAt(++i);
        }
        if (Buffer.byteLength(lpart + chr) <= maxLength || i === 0) {
          lpart += chr;
        } else {
          parts.push(encode2(lpart));
          lpart = chr;
        }
      }
      if (lpart) {
        parts.push(encode2(lpart));
      }
      if (parts.length > 1) {
        encodedStr = parts.join("?= =?" + toCharset + "?" + mimeWordEncoding + "?");
      } else {
        encodedStr = parts.join("");
      }
    }
  } else if (mimeWordEncoding === "B") {
    encodedStr = encode2(data);
  }
  return "=?" + toCharset + "?" + mimeWordEncoding + "?" + encodedStr + (encodedStr.substr(-2) === "?=" ? "" : "?=");
}
function encodeWords(value, mimeWordEncoding, maxLength, encodeAll) {
  maxLength = maxLength || 0;
  const firstMatch = value.match(/(?:^|\s)([^\s]*["\u0080-\uFFFF])/);
  if (!firstMatch) {
    return value;
  }
  if (encodeAll) {
    return encodeWord(value, mimeWordEncoding, maxLength);
  }
  const lastMatch = value.match(/(["\u0080-\uFFFF][^\s]*)[^"\u0080-\uFFFF]*$/);
  if (!lastMatch) {
    return value;
  }
  const startIndex = firstMatch.index + (firstMatch[0].match(/[^\s]/) || {
    index: 0
  }).index;
  const endIndex = lastMatch.index + (lastMatch[1] || "").length;
  return (startIndex ? value.substr(0, startIndex) : "") + encodeWord(value.substring(startIndex, endIndex), mimeWordEncoding || "Q", maxLength) + (endIndex < value.length ? value.substr(endIndex) : "");
}
function buildHeaderValue(structured) {
  const paramsArray = [];
  Object.keys(structured.params || {}).forEach((key) => {
    const value2 = structured.params[key];
    const param = key.replace(/[\x00-\x1f\x7f]/g, "");
    if (!isPlainText(value2, true) || value2.length >= 75) {
      buildHeaderParam(param, value2, 50).forEach((encodedParam) => {
        if (!/[\s"\\;:/=(),<>@[\]?]|^[-']|'$/.test(encodedParam.value) || encodedParam.key.substr(-1) === "*") {
          paramsArray.push(encodedParam.key + "=" + encodedParam.value);
        } else {
          paramsArray.push(encodedParam.key + "=" + JSON.stringify(encodedParam.value));
        }
      });
    } else if (/[\s'"\\;:/=(),<>@[\]?]|^-/.test(value2)) {
      paramsArray.push(param + "=" + JSON.stringify(value2));
    } else {
      paramsArray.push(param + "=" + value2);
    }
  });
  const value = typeof structured.value === "string" ? structured.value.replace(/[\x00-\x1f\x7f]/g, "") : structured.value;
  return value + (paramsArray.length ? "; " + paramsArray.join("; ") : "");
}
function buildHeaderParam(key, data, maxLength) {
  const list = [];
  let encodedStr = typeof data === "string" ? data : (data || "").toString();
  let chr;
  let line;
  let startPos = 0;
  let i, len;
  maxLength = maxLength || 50;
  if (isPlainText(data, true)) {
    if (encodedStr.length <= maxLength) {
      return [
        {
          key,
          value: encodedStr
        }
      ];
    }
    encodedStr = encodedStr.replace(new RegExp(".{" + maxLength + "}", "g"), (str) => {
      list.push({
        line: str
      });
      return "";
    });
    if (encodedStr) {
      list.push({
        line: encodedStr
      });
    }
  } else {
    if (/[\uD800-\uDBFF]/.test(encodedStr)) {
      const encodedStrArr = [];
      for (i = 0, len = encodedStr.length; i < len; i++) {
        chr = encodedStr.charAt(i);
        if (/[\ud800-\udbff]/.test(chr) && /[\udc00-\udfff]/.test(encodedStr.charAt(i + 1))) {
          chr += encodedStr.charAt(i + 1);
          encodedStrArr.push(chr);
          i++;
        } else {
          encodedStrArr.push(chr);
        }
      }
      encodedStr = encodedStrArr;
    }
    line = "utf-8''";
    let encoded = true;
    startPos = 0;
    for (i = 0, len = encodedStr.length; i < len; i++) {
      chr = encodedStr[i];
      if (encoded) {
        chr = safeEncodeURIComponent(chr);
      } else {
        chr = chr === " " ? chr : safeEncodeURIComponent(chr);
        if (chr !== encodedStr[i]) {
          if ((safeEncodeURIComponent(line) + chr).length >= maxLength) {
            list.push({
              line,
              encoded
            });
            line = "";
            encoded = true;
          } else {
            encoded = true;
            i = startPos;
            line = "";
            continue;
          }
        }
      }
      if ((line + chr).length >= maxLength) {
        list.push({
          line,
          encoded
        });
        line = chr = encodedStr[i] === " " ? " " : safeEncodeURIComponent(encodedStr[i]);
        if (chr === encodedStr[i]) {
          encoded = false;
          startPos = i - 1;
        } else {
          encoded = true;
        }
      } else {
        line += chr;
      }
    }
    if (line) {
      list.push({
        line,
        encoded
      });
    }
  }
  return list.map((item, i2) => ({
    // encoded lines: {name}*{part}*
    // unencoded lines: {name}*{part}
    // if any line needs to be encoded then the first line (part==0) is always encoded
    key: key + "*" + i2 + (item.encoded ? "*" : ""),
    value: item.line
  }));
}
function parseHeaderValue(str) {
  const response = {
    value: "",
    params: {}
  };
  const setParam = (name2, value2) => {
    if (!isProtoKey(name2)) {
      response.params[name2] = value2;
    }
  };
  let key = false;
  let value = "";
  let type = "value";
  let quote = false;
  let escaped = false;
  let chr;
  for (let i = 0, len = str.length; i < len; i++) {
    chr = str.charAt(i);
    if (type === "key") {
      if (chr === "=") {
        key = value.trim().toLowerCase();
        type = "value";
        value = "";
        continue;
      }
      value += chr;
    } else {
      if (escaped) {
        value += chr;
      } else if (chr === "\\") {
        escaped = true;
        continue;
      } else if (quote && chr === quote) {
        quote = false;
      } else if (!quote && chr === '"') {
        quote = chr;
      } else if (!quote && chr === ";") {
        if (key === false) {
          response.value = value.trim();
        } else {
          setParam(key, value.trim());
        }
        type = "key";
        value = "";
      } else {
        value += chr;
      }
      escaped = false;
    }
  }
  if (type === "value") {
    if (key === false) {
      response.value = value.trim();
    } else {
      setParam(key, value.trim());
    }
  } else if (value.trim()) {
    setParam(value.trim().toLowerCase(), "");
  }
  Object.keys(response.params).forEach((key2) => {
    let actualKey, nr, match, value2;
    if (match = key2.match(/(\*(\d+)|\*(\d+)\*|\*)$/)) {
      actualKey = key2.substr(0, match.index);
      nr = Number(match[2] || match[3]) || 0;
      if (isProtoKey(actualKey)) {
        delete response.params[key2];
        return;
      }
      if (!response.params[actualKey] || typeof response.params[actualKey] !== "object") {
        response.params[actualKey] = {
          charset: false,
          values: []
        };
      }
      value2 = response.params[key2];
      if (nr === 0 && match[0].substr(-1) === "*" && (match = value2.match(/^([^']*)'[^']*'(.*)$/))) {
        response.params[actualKey].charset = match[1] || "iso-8859-1";
        value2 = match[2];
      }
      response.params[actualKey].values[nr] = value2;
      delete response.params[key2];
    }
  });
  Object.keys(response.params).forEach((key2) => {
    let value2;
    if (response.params[key2] && Array.isArray(response.params[key2].values)) {
      value2 = response.params[key2].values.map((val) => val || "").join("");
      if (response.params[key2].charset) {
        response.params[key2] = "=?" + response.params[key2].charset + "?Q?" + value2.replace(/[=?_\s]/g, (s) => {
          const c = s.charCodeAt(0).toString(16);
          if (s === " ") {
            return "_";
          }
          return "%" + (c.length < 2 ? "0" : "") + c;
        }).replace(/%/g, "=") + "?=";
      } else {
        response.params[key2] = value2;
      }
    }
  });
  return response;
}
function detectExtension2(mimeType) {
  return detectExtension(mimeType);
}
function detectMimeType2(extension) {
  return detectMimeType(extension);
}
function foldLines(str, lineLength, afterSpace) {
  str = (str || "").toString();
  lineLength = lineLength || 76;
  let pos = 0;
  const len = str.length;
  let result = "";
  let line, match;
  while (pos < len) {
    line = str.substr(pos, lineLength);
    if (line.length < lineLength) {
      result += line;
      break;
    }
    if (match = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
      line = match[0];
      result += line;
      pos += line.length;
      continue;
    } else if ((match = line.match(/(\s+)[^\s]*$/)) && match[0].length - (afterSpace ? (match[1] || "").length : 0) < line.length) {
      line = line.substr(0, line.length - (match[0].length - (afterSpace ? (match[1] || "").length : 0)));
    } else if (match = str.substr(pos + line.length).match(/^[^\s]+(\s*)/)) {
      line = line + match[0].substr(0, match[0].length - (!afterSpace ? (match[1] || "").length : 0));
    }
    result += line;
    pos += line.length;
    if (pos < len) {
      result += "\r\n";
    }
  }
  return result;
}
function splitMimeEncodedString(str, maxlen) {
  const lines = [];
  let curLine, fallbackLine, match, chr, done;
  maxlen = Math.max(maxlen || 0, 12);
  while (str.length) {
    curLine = str.substr(0, maxlen);
    if (match = curLine.match(/[=][0-9A-F]?$/i)) {
      curLine = curLine.substr(0, match.index);
    }
    fallbackLine = curLine.length ? curLine : str.substr(0, maxlen);
    done = false;
    while (!done && curLine.length) {
      done = true;
      if (match = str.substr(curLine.length).match(/^[=]([0-9A-F]{2})/i)) {
        chr = parseInt(match[1], 16);
        if (chr < 194 && chr > 127) {
          curLine = curLine.substr(0, curLine.length - 3);
          done = false;
        }
      }
    }
    if (!curLine.length) {
      curLine = fallbackLine;
    }
    lines.push(curLine);
    str = str.substr(curLine.length);
  }
  return lines;
}
function encodeURICharComponent(chr) {
  let res = "";
  let ord = chr.charCodeAt(0).toString(16).toUpperCase();
  if (ord.length % 2) {
    ord = "0" + ord;
  }
  if (ord.length > 2) {
    for (let i = 0, len = ord.length / 2; i < len; i++) {
      res += "%" + ord.substr(i, 2);
    }
  } else {
    res += "%" + ord;
  }
  return res;
}
function safeEncodeURIComponent(str) {
  str = (str || "").toString();
  try {
    str = encodeURIComponent(str);
  } catch (_E) {
    str = encodeURIComponent(Buffer.from(str, "utf-8").toString("utf-8"));
  }
  return str.replace(/[\x00-\x1F *'()<>@,;:\\"[\]?=\u007F-\uFFFF]/g, (chr) => encodeURICharComponent(chr));
}

// node_modules/nodemailer/dist/esm/addressparser/index.js
function _quoteLocalPart(address) {
  const lastAt = address.lastIndexOf("@");
  if (lastAt < 0) {
    return address;
  }
  const user = address.substr(0, lastAt);
  if (/^[^\s"(),:;<>@[\\\]]+$/.test(user) || /^"(?:[^"\\]|\\[\s\S])*"$/.test(user)) {
    return address;
  }
  return '"' + user.replace(/["\\]/g, "\\$&") + '"@' + address.substr(lastAt + 1);
}
var HAS_WHITESPACE = /\s/;
var QUOTED_LOCAL_ADDR = /^("(?:[^"\\]|\\[\s\S])*"@\S+)(?:\s+([\s\S]+))?$/;
var ADDR_SPEC = /^[^@\s]+@[^@\s]+$/;
var LOOSE_ADDR_SPEC = /^[^@\s]+@\S+$/;
var LOOSE_TEXT_ADDR = /\s*\b[^@\s]+@[^\s]+\b\s*/y;
function _isSpaceCode(code) {
  return code === 32 || code >= 9 && code <= 13 || code === 160 || code === 5760 || code >= 8192 && code <= 8202 || code === 8232 || code === 8233 || code === 8239 || code === 8287 || code === 12288 || code === 65279;
}
function _isWordCode(code) {
  return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95;
}
function _isBoundary(text, at) {
  return _isWordCode(text.charCodeAt(at - 1)) !== _isWordCode(text.charCodeAt(at));
}
function _indexOfAt(text, from, to) {
  for (let i = from; i < to; i++) {
    if (text.charCodeAt(i) === 64) {
      return i;
    }
  }
  return -1;
}
function _looseAddressStart(text) {
  const len = text.length;
  let pos = 0;
  while (pos < len) {
    while (pos < len && _isSpaceCode(text.charCodeAt(pos))) {
      pos++;
    }
    if (pos >= len) {
      break;
    }
    const runStart = pos;
    let runEnd = pos;
    while (runEnd < len && !_isSpaceCode(text.charCodeAt(runEnd))) {
      runEnd++;
    }
    let at = _indexOfAt(text, runStart, runEnd);
    if (at >= 0) {
      let lastBoundary = -1;
      for (let k = runEnd; k > runStart; k--) {
        if (_isBoundary(text, k)) {
          lastBoundary = k;
          break;
        }
      }
      let atomStart = runStart;
      while (lastBoundary >= 0 && at >= 0) {
        if (at > atomStart && runEnd > at + 1 && lastBoundary > at + 1) {
          for (let start = atomStart; start < at; start++) {
            if (_isBoundary(text, start)) {
              if (start > runStart) {
                return start;
              }
              let padded = runStart;
              while (padded > 0 && _isSpaceCode(text.charCodeAt(padded - 1))) {
                padded--;
              }
              return padded;
            }
          }
        }
        atomStart = at + 1;
        at = _indexOfAt(text, atomStart, runEnd);
      }
    }
    pos = runEnd;
  }
  return -1;
}
function _recoverAddrSpec(data) {
  if (!HAS_WHITESPACE.test(data.address)) {
    return;
  }
  let address;
  let rest;
  const quoted = data.address.match(QUOTED_LOCAL_ADDR);
  if (quoted) {
    if (!quoted[2]) {
      return;
    }
    address = quoted[1];
    rest = [quoted[2]];
  } else {
    if (data.address.indexOf('"') >= 0) {
      return;
    }
    const parts = data.address.split(/\s+/);
    let addrIndex = parts.findIndex((part) => ADDR_SPEC.test(part));
    if (addrIndex < 0) {
      addrIndex = parts.findIndex((part) => LOOSE_ADDR_SPEC.test(part));
    }
    if (addrIndex < 0) {
      return;
    }
    address = parts.splice(addrIndex, 1)[0];
    rest = parts;
  }
  data.address = address;
  data.text = [data.text].concat(rest).filter((part) => part).join(" ");
}
function _stripAddressComments(address) {
  const comments = [];
  let result = "";
  let comment = "";
  let depth = 0;
  let closer = "";
  let lastChar = "";
  for (let i = 0, len = address.length; i < len; i++) {
    const chr = address.charAt(i);
    if (depth) {
      if (chr === "\\" && i < len - 1) {
        comment += address.charAt(++i);
      } else if (chr === "(") {
        depth++;
        comment += chr;
      } else if (chr === ")" && !--depth) {
        comments.push(comment.trim());
        comment = "";
        if (lastChar !== "@" && address.charAt(i + 1) !== "@") {
          result += " ";
          lastChar = " ";
        }
      } else {
        comment += chr;
      }
      continue;
    }
    if (closer) {
      if (chr === "\\" && closer === '"' && i < len - 1) {
        result += chr + address.charAt(++i);
        lastChar = address.charAt(i);
        continue;
      }
      if (chr === closer) {
        closer = "";
      }
    } else if (chr === '"') {
      closer = '"';
    } else if (chr === "[") {
      closer = "]";
    } else if (chr === "(") {
      depth = 1;
      continue;
    }
    result += chr;
    lastChar = chr;
  }
  if (depth) {
    comments.push(comment.trim());
  }
  return { address: result.trim(), comments: comments.filter((text) => text) };
}
function _handleAddress(tokens, depth) {
  let isGroup = false;
  let state = "text";
  const addresses = [];
  const data = {
    address: [],
    comment: [],
    group: [],
    text: [],
    textWasQuoted: []
  };
  let insideQuotes = false;
  const lastChars = { address: "", comment: "", group: "", text: "" };
  for (let i = 0, len = tokens.length; i < len; i++) {
    const token = tokens[i];
    const prevToken = i ? tokens[i - 1] : null;
    if (token.type === "operator") {
      switch (token.value) {
        case "<":
          state = "address";
          insideQuotes = false;
          break;
        case "(":
          state = "comment";
          insideQuotes = false;
          break;
        case ":":
          state = "group";
          isGroup = true;
          insideQuotes = false;
          break;
        case '"':
          insideQuotes = !insideQuotes;
          state = "text";
          break;
        default:
          state = "text";
          insideQuotes = false;
          break;
      }
    } else if (token.value) {
      const prevPrevToken = i > 1 ? tokens[i - 2] : null;
      const opensAfterEmptyQuotedString = prevToken?.type === "operator" && prevToken.value === '"' && !!prevToken.noBreak && prevPrevToken?.type === "operator" && prevPrevToken.value === '"';
      if (state === "address") {
        token.value = token.value.replace(/^[^<]*<\s*/, "");
      }
      const parts = data[state];
      const joins = prevToken && prevToken.noBreak && parts.length && (prevToken.value !== ")" || lastChars[state] === "@" || token.value.charAt(0) === "@");
      if (joins) {
        data[state][data[state].length - 1] += token.value;
        if (token.value) {
          lastChars[state] = token.value.charAt(token.value.length - 1);
        }
        if (state === "text" && insideQuotes) {
          data.textWasQuoted[data.textWasQuoted.length - 1] = true;
        }
      } else {
        data[state].push(token.value);
        lastChars[state] = token.value.charAt(token.value.length - 1);
        if (state === "text") {
          data.textWasQuoted.push(insideQuotes || opensAfterEmptyQuotedString);
        }
      }
    }
  }
  if (!data.text.length && data.comment.length) {
    data.text = data.comment;
    data.comment = [];
  }
  if (isGroup) {
    data.text = data.text.join(" ");
    let groupMembers = [];
    if (data.group.length) {
      const parsedGroup = addressparser(data.group.join(","), { _depth: depth + 1 });
      parsedGroup.forEach((member) => {
        if (member.group) {
          groupMembers = groupMembers.concat(member.group);
        } else {
          groupMembers.push(member);
        }
      });
    }
    addresses.push({
      name: data.text || "",
      group: groupMembers
    });
  } else {
    const addressComments = [];
    const addressParts = [];
    for (const part of data.address) {
      if (part.indexOf("(") < 0) {
        addressParts.push(part);
        continue;
      }
      const stripped = _stripAddressComments(part);
      for (const comment of stripped.comments) {
        addressComments.push(comment);
      }
      if (stripped.address) {
        addressParts.push(stripped.address);
      }
    }
    data.address = addressParts;
    if (!data.address.length && data.text.length) {
      for (let i = data.text.length - 1; i >= 0; i--) {
        if (!data.textWasQuoted[i] && ADDR_SPEC.test(data.text[i])) {
          data.address = data.text.splice(i, 1);
          data.textWasQuoted.splice(i, 1);
          break;
        }
      }
      if (!data.address.length) {
        let extracted = false;
        for (let i = data.text.length - 1; i >= 0; i--) {
          if (!data.textWasQuoted[i]) {
            const part = data.text[i];
            let remainder = part;
            const at = _looseAddressStart(part);
            if (at >= 0) {
              LOOSE_TEXT_ADDR.lastIndex = at;
              const match = LOOSE_TEXT_ADDR.exec(part);
              if (match) {
                data.address = [match[0].trim()];
                extracted = true;
                remainder = part.slice(0, at) + " " + part.slice(at + match[0].length);
              }
            }
            data.text[i] = remainder.trim();
            if (extracted) {
              break;
            }
          }
        }
      }
    }
    if (!data.text.length && data.comment.length) {
      data.text = data.comment;
      data.comment = [];
    }
    if (data.address.length > 1) {
      data.text = data.text.concat(data.address.splice(1));
    }
    const addressFromQuotedText = !data.address.length && data.textWasQuoted.some((wasQuoted) => wasQuoted);
    data.text = data.text.join(" ");
    data.address = data.address.join(" ");
    if (addressFromQuotedText && data.text) {
      data.address = _quoteLocalPart(data.text);
      data.text = "";
    }
    _recoverAddrSpec(data);
    if (!data.text && addressComments.length) {
      data.text = addressComments.join(" ");
    }
    const address = {
      address: data.address || data.text || "",
      name: data.text || data.address || ""
    };
    if (address.address === address.name) {
      if (/@/.test(address.address || "")) {
        address.name = "";
      } else {
        address.address = "";
      }
    }
    addresses.push(address);
  }
  return addresses;
}
var Tokenizer = class {
  constructor(str) {
    this.str = (str || "").toString();
    this.operatorCurrent = "";
    this.operatorExpecting = "";
    this.node = null;
    this.escaped = false;
    this.inDomainLiteral = false;
    this.list = [];
    this.operators = {
      '"': '"',
      "(": ")",
      "<": ">",
      ",": "",
      ":": ";",
      // Semicolons are not a legal delimiter per the RFC2822 grammar other
      // than for terminating a group, but they are also not valid for any
      // other use in this context.  Given that some mail clients have
      // historically allowed the semicolon as a delimiter equivalent to the
      // comma in their UI, it makes sense to treat them the same as a comma
      // when used outside of a group.
      ";": ""
    };
  }
  /**
   * Tokenizes the original input string
   *
   * @return An array of operator|text tokens
   */
  tokenize() {
    const list = [];
    for (let i = 0, len = this.str.length; i < len; i++) {
      const chr = this.str.charAt(i);
      const nextChr = i < len - 1 ? this.str.charAt(i + 1) : null;
      this.checkChar(chr, nextChr);
    }
    this.list.forEach((node) => {
      node.value = (node.value || "").toString().trim();
      if (node.value) {
        list.push(node);
      }
    });
    return list;
  }
  /**
   * Checks if a character is an operator or text and acts accordingly
   *
   * @param chr Character from the address field
   */
  checkChar(chr, nextChr) {
    if (!this.escaped && !this.operatorExpecting) {
      if (!this.inDomainLiteral && chr === "[") {
        this.inDomainLiteral = true;
      } else if (this.inDomainLiteral && (chr === "]" || chr === "," || chr === ";")) {
        this.inDomainLiteral = false;
      }
    }
    if (this.escaped) {
    } else if (chr === this.operatorExpecting) {
      this.node = {
        type: "operator",
        value: chr
      };
      if (nextChr && ![" ", "	", "\r", "\n", ",", ";"].includes(nextChr)) {
        this.node.noBreak = true;
      }
      this.list.push(this.node);
      this.node = null;
      this.operatorExpecting = "";
      this.escaped = false;
      return;
    } else if (!this.operatorExpecting && !this.inDomainLiteral && chr in this.operators) {
      this.node = {
        type: "operator",
        value: chr
      };
      this.list.push(this.node);
      this.node = null;
      this.operatorExpecting = this.operators[chr];
      this.escaped = false;
      return;
    } else if (['"', "'"].includes(this.operatorExpecting) && chr === "\\") {
      this.escaped = true;
      return;
    }
    if (!this.node) {
      this.node = {
        type: "text",
        value: ""
      };
      this.list.push(this.node);
    }
    if (chr === "\n") {
      chr = " ";
    }
    if (chr.charCodeAt(0) >= 33 || [" ", "	"].includes(chr)) {
      this.node.value += chr;
    }
    this.escaped = false;
  }
};
var MAX_NESTED_GROUP_DEPTH = 50;
function addressparser(str, options) {
  options = options || {};
  const depth = options._depth || 0;
  if (depth > MAX_NESTED_GROUP_DEPTH) {
    return [];
  }
  const tokenizer = new Tokenizer(str);
  const tokens = tokenizer.tokenize();
  const addresses = [];
  let address = [];
  let parsedAddresses = [];
  tokens.forEach((token) => {
    if (token.type === "operator" && (token.value === "," || token.value === ";")) {
      if (address.length) {
        addresses.push(address);
      }
      address = [];
    } else {
      address.push(token);
    }
  });
  if (address.length) {
    addresses.push(address);
  }
  addresses.forEach((addr) => {
    const handled = _handleAddress(addr, depth);
    for (let i = 0; i < handled.length; i++) {
      parsedAddresses.push(handled[i]);
    }
  });
  const mergedAddresses = [];
  for (let i = parsedAddresses.length - 1; i >= 0; i--) {
    const current = parsedAddresses[i];
    const next = mergedAddresses.length ? mergedAddresses[mergedAddresses.length - 1] : null;
    if (next && current.address === "" && current.name && !current.group && next.address && next.name) {
      next.name = current.name + ", " + next.name;
    } else {
      mergedAddresses.push(current);
    }
  }
  mergedAddresses.reverse();
  parsedAddresses = mergedAddresses;
  if (options.flatten) {
    const flatAddresses = [];
    const walkAddressList = (list) => {
      list.forEach((entry) => {
        if (entry.group) {
          return walkAddressList(entry.group);
        }
        flatAddresses.push(entry);
      });
    };
    walkAddressList(parsedAddresses);
    return flatAddresses;
  }
  return parsedAddresses;
}
var addressparser_default = addressparser;

// node_modules/nodemailer/dist/esm/mime-node/last-newline.js
import { Transform as Transform3 } from "node:stream";
var LastNewline = class extends Transform3 {
  constructor() {
    super();
    this.lastByte = false;
  }
  /** @internal */
  _transform(chunk, encoding, done) {
    if (chunk.length) {
      this.lastByte = chunk[chunk.length - 1];
    }
    this.push(chunk);
    done();
  }
  /** @internal */
  _flush(done) {
    if (this.lastByte === 10) {
      return done();
    }
    if (this.lastByte === 13) {
      this.push(Buffer.from("\n"));
      return done();
    }
    this.push(Buffer.from("\r\n"));
    return done();
  }
};

// node_modules/nodemailer/dist/esm/mime-node/le-windows.js
import { Transform as Transform4 } from "node:stream";
var LeWindows = class extends Transform4 {
  constructor(options) {
    super(options);
    this.lastByte = false;
  }
  /**
   * Escapes dots
   * @internal
   */
  _transform(chunk, encoding, done) {
    let buf;
    let lastPos = 0;
    for (let i = 0, len = chunk.length; i < len; i++) {
      if (chunk[i] === 10) {
        if (i && chunk[i - 1] !== 13 || !i && this.lastByte !== 13) {
          if (i > lastPos) {
            buf = chunk.slice(lastPos, i);
            this.push(buf);
          }
          this.push(Buffer.from("\r\n"));
          lastPos = i + 1;
        }
      }
    }
    if (lastPos && lastPos < chunk.length) {
      buf = chunk.slice(lastPos);
      this.push(buf);
    } else if (!lastPos) {
      this.push(chunk);
    }
    this.lastByte = chunk[chunk.length - 1];
    done();
  }
};

// node_modules/nodemailer/dist/esm/mime-node/le-unix.js
import { Transform as Transform5 } from "node:stream";
var LeUnix = class extends Transform5 {
  constructor(options) {
    super(options);
  }
  /**
   * Escapes dots
   * @internal
   */
  _transform(chunk, encoding, done) {
    let buf;
    let lastPos = 0;
    for (let i = 0, len = chunk.length; i < len; i++) {
      if (chunk[i] === 13) {
        buf = chunk.slice(lastPos, i);
        lastPos = i + 1;
        this.push(buf);
      }
    }
    if (lastPos && lastPos < chunk.length) {
      buf = chunk.slice(lastPos);
      this.push(buf);
    } else if (!lastPos) {
      this.push(chunk);
    }
    done();
  }
};

// node_modules/nodemailer/dist/esm/mime-node/index.js
var FORMATTED_HEADERS = ["From", "Sender", "To", "Cc", "Bcc", "Reply-To", "Date", "References"];
var ATEXT = "[A-Za-z0-9!#$%&'*+\\-/=?^_`{|}~\\x80-\\uFFFF]";
var DOT_ATOM = new RegExp("^" + ATEXT + "+(?:\\." + ATEXT + "+)*$");
var QUOTED_STRING = /^"(?:[^"\\]|\\[\s\S])*"$/;
var PLAIN_ADDRESS = /^[^\s"(),:;<>@[\\\]]+@[^\s"(),:;<>@[\\\]]+$/;
var URL_PARSER_UNSAFE = /[/\\?#%\x00-\x20\x7F]/;
function normalizeDomain(domain, toUnicode2) {
  const mapper = toUnicode2 ? urlModule.domainToUnicode : urlModule.domainToASCII;
  if (typeof mapper === "function" && !URL_PARSER_UNSAFE.test(domain)) {
    const mapped = mapper(domain);
    if (mapped) {
      return mapped;
    }
  }
  return toUnicode2 ? toUnicode(domain) : toASCII(domain);
}
function _stripBoundaryControls(value) {
  return value.replace(/[\x00-\x1f\x7f]+/g, "");
}
var MimeNode = class _MimeNode {
  constructor(contentType, options) {
    this.nodeCounter = 0;
    options = options || {};
    this.baseBoundary = _stripBoundaryControls(options.baseBoundary || crypto.randomBytes(8).toString("hex"));
    this.boundaryPrefix = _stripBoundaryControls(options.boundaryPrefix || "--_NmP");
    this.disableFileAccess = !!options.disableFileAccess;
    this.disableUrlAccess = !!options.disableUrlAccess;
    this.normalizeHeaderKey = options.normalizeHeaderKey;
    this.date = options.parentNode ? null : /* @__PURE__ */ new Date();
    this.rootNode = options.rootNode || this;
    this.keepBcc = !!options.keepBcc;
    if (options.filename) {
      this.filename = options.filename;
      if (!contentType) {
        contentType = detectMimeType2(this.filename.split(".").pop());
      }
    }
    this.textEncoding = (options.textEncoding || "").toString().trim().charAt(0).toUpperCase();
    this.parentNode = options.parentNode;
    this.hostname = options.hostname;
    this.newline = options.newline;
    this.childNodes = [];
    this._nodeId = ++this.rootNode.nodeCounter;
    this._headers = [];
    this._isPlainText = false;
    this._hasLongLines = false;
    this._envelope = false;
    this._raw = false;
    this._transforms = [];
    this._processFuncs = [];
    if (contentType) {
      this.setHeader("Content-Type", contentType);
    }
  }
  /////// PUBLIC METHODS
  /**
   * Creates and appends a child node.Arguments provided are passed to MimeNode constructor
   *
   * @param [contentType] Optional content type
   * @param [options] Optional options object
   * @return Created node object
   */
  createChild(contentType, options) {
    if (!options && typeof contentType === "object") {
      options = contentType;
      contentType = void 0;
    }
    const node = new _MimeNode(contentType, options);
    this.appendChild(node);
    return node;
  }
  /**
   * Appends an existing node to the mime tree. Removes the node from an existing
   * tree if needed
   *
   * @param childNode node to be appended
   * @return Appended node object
   */
  appendChild(childNode) {
    if (childNode.parentNode && childNode.parentNode !== this) {
      childNode.remove();
    }
    if (childNode.rootNode !== this.rootNode) {
      childNode.rootNode = this.rootNode;
      childNode._nodeId = ++this.rootNode.nodeCounter;
    }
    childNode.parentNode = this;
    this.childNodes.push(childNode);
    return childNode;
  }
  /**
   * Replaces current node with another node
   *
   * @param node Replacement node
   * @return Replacement node
   */
  replace(node) {
    if (node === this) {
      return this;
    }
    this.parentNode.childNodes.forEach((childNode, i) => {
      if (childNode === this) {
        node.rootNode = this.rootNode;
        node.parentNode = this.parentNode;
        node._nodeId = this._nodeId;
        this.rootNode = this;
        this.parentNode = void 0;
        node.parentNode.childNodes[i] = node;
      }
    });
    return node;
  }
  /**
   * Removes current node from the mime tree
   *
   * @return removed node
   */
  remove() {
    if (!this.parentNode) {
      return this;
    }
    for (let i = this.parentNode.childNodes.length - 1; i >= 0; i--) {
      if (this.parentNode.childNodes[i] === this) {
        this.parentNode.childNodes.splice(i, 1);
        this.parentNode = void 0;
        this.rootNode = this;
        return this;
      }
    }
  }
  /**
   * Sets a header value. If the value for selected key exists, it is overwritten.
   * You can set multiple values as well by using [{key:'', value:''}] or
   * {key: 'value'} as the first argument.
   *
   * @param key Header key or a list of key value pairs
   * @param value Header value
   * @return current node
   */
  setHeader(key, value) {
    let added = false;
    if (!value && key && typeof key === "object") {
      if (key.key && "value" in key) {
        this.setHeader(key.key, key.value);
      } else if (Array.isArray(key)) {
        key.forEach((i) => {
          this.setHeader(i.key, i.value);
        });
      } else {
        Object.keys(key).forEach((i) => {
          this.setHeader(i, key[i]);
        });
      }
      return this;
    }
    key = this._normalizeHeaderKey(key);
    const headerValue = {
      key,
      value
    };
    for (let i = 0, len = this._headers.length; i < len; i++) {
      if (this._headers[i].key === key) {
        if (!added) {
          this._headers[i] = headerValue;
          added = true;
        } else {
          this._headers.splice(i, 1);
          i--;
          len--;
        }
      }
    }
    if (!added) {
      this._headers.push(headerValue);
    }
    return this;
  }
  /**
   * Adds a header value. If the value for selected key exists, the value is appended
   * as a new field and old one is not touched.
   * You can set multiple values as well by using [{key:'', value:''}] or
   * {key: 'value'} as the first argument.
   *
   * @param key Header key or a list of key value pairs
   * @param value Header value
   * @return current node
   */
  addHeader(key, value) {
    if (!value && key && typeof key === "object") {
      if (key.key && key.value) {
        this.addHeader(key.key, key.value);
      } else if (Array.isArray(key)) {
        key.forEach((i) => {
          this.addHeader(i.key, i.value);
        });
      } else {
        Object.keys(key).forEach((i) => {
          this.addHeader(i, key[i]);
        });
      }
      return this;
    } else if (Array.isArray(value)) {
      value.forEach((val) => {
        this.addHeader(key, val);
      });
      return this;
    }
    this._headers.push({
      key: this._normalizeHeaderKey(key),
      value
    });
    return this;
  }
  /**
   * Retrieves the first mathcing value of a selected key
   *
   * @param key Key to search for
   * @retun Value for the key
   */
  getHeader(key) {
    key = this._normalizeHeaderKey(key);
    for (let i = 0, len = this._headers.length; i < len; i++) {
      if (this._headers[i].key === key) {
        return this._headers[i].value;
      }
    }
  }
  /**
   * Sets body content for current node. If the value is a string, charset is added automatically
   * to Content-Type (if it is text/*). If the value is a Buffer, you need to specify
   * the charset yourself
   *
   * @param content Body content
   * @return current node
   */
  setContent(content) {
    this.content = content;
    if (typeof this.content.pipe === "function") {
      this._contentErrorHandler = (err) => {
        this.content.removeListener("error", this._contentErrorHandler);
        this.content = err;
      };
      this.content.once("error", this._contentErrorHandler);
    } else if (typeof this.content === "string") {
      this._isPlainText = isPlainText(this.content);
      if (this._isPlainText && hasLongerLines(this.content, 76)) {
        this._hasLongLines = true;
      }
    }
    return this;
  }
  build(callback) {
    let promise;
    if (!callback) {
      promise = new Promise((resolve3, reject) => {
        callback = callbackPromise(resolve3, reject);
      });
    }
    const done = callback;
    const stream = this.createReadStream();
    const buf = [];
    let buflen = 0;
    let returned = false;
    stream.on("readable", () => {
      let chunk;
      while ((chunk = stream.read()) !== null) {
        buf.push(chunk);
        buflen += chunk.length;
      }
    });
    stream.once("error", (err) => {
      if (returned) {
        return;
      }
      returned = true;
      return done(err);
    });
    stream.once("end", (chunk) => {
      if (returned) {
        return;
      }
      returned = true;
      if (chunk && chunk.length) {
        buf.push(chunk);
        buflen += chunk.length;
      }
      return done(null, Buffer.concat(buf, buflen));
    });
    return promise;
  }
  getTransferEncoding() {
    let transferEncoding = false;
    const contentType = (this.getHeader("Content-Type") || "").toString().toLowerCase().trim();
    if (this.content) {
      transferEncoding = (this.getHeader("Content-Transfer-Encoding") || "").toString().toLowerCase().trim();
      if (!transferEncoding || !["base64", "quoted-printable"].includes(transferEncoding)) {
        if (/^text\//i.test(contentType)) {
          if (this._isPlainText && !this._hasLongLines) {
            transferEncoding = "7bit";
          } else if (typeof this.content === "string" || this.content instanceof Buffer) {
            transferEncoding = this._getTextEncoding(this.content) === "Q" ? "quoted-printable" : "base64";
          } else {
            transferEncoding = this.textEncoding === "B" ? "base64" : "quoted-printable";
          }
        } else if (!/^(multipart|message)\//i.test(contentType)) {
          transferEncoding = transferEncoding || "base64";
        }
      }
    }
    return transferEncoding;
  }
  /**
   * Builds the header block for the mime node. Append \r\n\r\n before writing the content
   *
   * @returns Headers
   */
  buildHeaders() {
    const transferEncoding = this.getTransferEncoding();
    const headers = [];
    if (transferEncoding) {
      this.setHeader("Content-Transfer-Encoding", transferEncoding);
    }
    if (this.filename && !this.getHeader("Content-Disposition")) {
      this.setHeader("Content-Disposition", "attachment");
    }
    if (this.rootNode === this) {
      if (!this.getHeader("Date")) {
        this.setHeader("Date", this.date.toUTCString().replace(/GMT/, "+0000"));
      }
      this.messageId();
      if (!this.getHeader("MIME-Version")) {
        this.setHeader("MIME-Version", "1.0");
      }
      for (let i = this._headers.length - 2; i >= 0; i--) {
        const header = this._headers[i];
        if (header.key === "Content-Type") {
          this._headers.splice(i, 1);
          this._headers.push(header);
        }
      }
    }
    this._headers.forEach((header) => {
      let key = header.key;
      let value = header.value;
      let structured;
      let param;
      const options = {};
      const formattedHeaders = FORMATTED_HEADERS;
      if (value && typeof value === "object" && !formattedHeaders.includes(key)) {
        copyOwnKeys(options, value, (optionKey) => optionKey === "value");
        value = (value.value || "").toString();
        if (!value.trim()) {
          return;
        }
      }
      if (options.prepared) {
        if (options.foldLines) {
          headers.push(foldLines(key + ": " + value));
        } else {
          headers.push(key + ": " + value);
        }
        return;
      }
      switch (header.key) {
        case "Content-Disposition":
          structured = parseHeaderValue(value);
          if (this.filename) {
            structured.params.filename = this.filename;
          }
          value = buildHeaderValue(structured);
          break;
        case "Content-Type":
          structured = parseHeaderValue(value);
          structured.value = (structured.value || "").toString().replace(/[\x00-\x1f\x7f]/g, "");
          this._handleContentType(structured);
          if (structured.value.match(/^text\/plain\b/) && typeof this.content === "string" && /[\u0080-\uFFFF]/.test(this.content)) {
            structured.params.charset = "utf-8";
          }
          value = buildHeaderValue(structured);
          if (this.filename) {
            param = /[\x00-\x1f\x7f]/.test(this.filename) ? encodeWord(this.filename, this._getTextEncoding(this.filename), 52) : this._encodeWords(this.filename);
            if (param !== this.filename || /[\s'"\\;:/=(),<>@[\]?]|^-/.test(param)) {
              param = JSON.stringify(param);
            }
            value += "; name=" + param;
          }
          break;
        case "Bcc":
          if (!this.keepBcc) {
            return;
          }
          break;
      }
      value = this._encodeHeaderValue(key, value);
      if (!(value || "").toString().trim()) {
        return;
      }
      if (typeof this.normalizeHeaderKey === "function") {
        const normalized2 = this.normalizeHeaderKey(key, value);
        const cleaned = typeof normalized2 === "string" ? normalized2.replace(/[\x00-\x1f\x7f]/g, "") : "";
        if (cleaned) {
          key = cleaned;
        }
      }
      headers.push(foldLines(key + ": " + value, 76));
    });
    return headers.join("\r\n");
  }
  /**
   * Streams the rfc2822 message from the current node. If this is a root node,
   * mandatory header fields are set if missing (Date, Message-Id, MIME-Version)
   *
   * @return Compiled message
   */
  createReadStream(options) {
    options = options || {};
    const stream = new PassThrough2(options);
    let outputStream = stream;
    let transform;
    this.stream(stream, options, (err) => {
      if (err) {
        outputStream.emit("error", err);
        return;
      }
      stream.end();
    });
    for (let i = 0, len = this._transforms.length; i < len; i++) {
      transform = typeof this._transforms[i] === "function" ? this._transforms[i]() : this._transforms[i];
      outputStream.once("error", (err) => {
        transform.emit("error", err);
      });
      outputStream = outputStream.pipe(transform);
    }
    transform = new LastNewline();
    outputStream.once("error", (err) => {
      transform.emit("error", err);
    });
    outputStream = outputStream.pipe(transform);
    for (let i = 0, len = this._processFuncs.length; i < len; i++) {
      transform = this._processFuncs[i];
      outputStream = transform(outputStream);
    }
    if (this.newline) {
      const winbreak = ["win", "windows", "dos", "\r\n"].includes(this.newline.toString().toLowerCase());
      const newlineTransform = winbreak ? new LeWindows() : new LeUnix();
      const stream2 = outputStream.pipe(newlineTransform);
      outputStream.on("error", (err) => stream2.emit("error", err));
      return stream2;
    }
    return outputStream;
  }
  /**
   * Appends a transform stream object to the transforms list. Final output
   * is passed through this stream before exposing
   *
   * @param transform Read-Write stream
   */
  transform(transform) {
    this._transforms.push(transform);
  }
  /**
   * Appends a post process function. The functon is run after transforms and
   * uses the following syntax
   *
   *   processFunc(input) -> outputStream
   *
   * @param processFunc Read-Write stream
   */
  processFunc(processFunc) {
    this._processFuncs.push(processFunc);
  }
  stream(outputStream, options, done) {
    const transferEncoding = this.getTransferEncoding();
    let contentStream;
    let localStream;
    let returned = false;
    const callback = (err) => {
      if (returned) {
        return;
      }
      returned = true;
      done(err);
    };
    const finalize = () => {
      let childId = 0;
      const processChildNode = () => {
        if (childId >= this.childNodes.length) {
          outputStream.write("\r\n--" + this.boundary + "--\r\n");
          return callback();
        }
        const child = this.childNodes[childId++];
        outputStream.write((childId > 1 ? "\r\n" : "") + "--" + this.boundary + "\r\n");
        child.stream(outputStream, options, (err) => {
          if (err) {
            return callback(err);
          }
          setImmediate(processChildNode);
        });
      };
      if (this.multipart) {
        setImmediate(processChildNode);
      } else {
        return callback();
      }
    };
    const sendContent = () => {
      if (this.content) {
        if (Object.prototype.toString.call(this.content) === "[object Error]") {
          return callback(this.content);
        }
        if (typeof this.content.pipe === "function") {
          this.content.removeListener("error", this._contentErrorHandler);
          this._contentErrorHandler = (err) => callback(err);
          this.content.once("error", this._contentErrorHandler);
        }
        const createStream = () => {
          if (["quoted-printable", "base64"].includes(transferEncoding)) {
            contentStream = new (transferEncoding === "base64" ? base64_exports : qp_exports).Encoder(options);
            contentStream.pipe(outputStream, {
              end: false
            });
            contentStream.once("end", finalize);
            contentStream.once("error", (err) => callback(err));
            localStream = this._getStream(this.content);
            localStream.pipe(contentStream);
          } else {
            localStream = this._getStream(this.content);
            localStream.pipe(outputStream, {
              end: false
            });
            localStream.once("end", finalize);
          }
          localStream.once("error", (err) => callback(err));
        };
        if (this.content._resolve) {
          const chunks = [];
          let chunklen = 0;
          let returned2 = false;
          const sourceStream = this._getStream(this.content);
          sourceStream.on("error", (err) => {
            if (returned2) {
              return;
            }
            returned2 = true;
            callback(err);
          });
          sourceStream.on("readable", () => {
            let chunk;
            while ((chunk = sourceStream.read()) !== null) {
              chunks.push(chunk);
              chunklen += chunk.length;
            }
          });
          sourceStream.on("end", () => {
            if (returned2) {
              return;
            }
            returned2 = true;
            this.content._resolve = false;
            this.content._resolvedValue = Buffer.concat(chunks, chunklen);
            setImmediate(createStream);
          });
        } else {
          setImmediate(createStream);
        }
        return;
      }
      return setImmediate(finalize);
    };
    if (this._raw) {
      setImmediate(() => {
        if (Object.prototype.toString.call(this._raw) === "[object Error]") {
          return callback(this._raw);
        }
        if (typeof this._raw.pipe === "function") {
          this._raw.removeListener("error", this._contentErrorHandler);
        }
        const raw = this._getStream(this._raw);
        raw.pipe(outputStream, {
          end: false
        });
        raw.on("error", (err) => outputStream.emit("error", err));
        raw.on("end", finalize);
      });
    } else {
      outputStream.write(this.buildHeaders() + "\r\n\r\n");
      setImmediate(sendContent);
    }
  }
  /**
   * Sets envelope to be used instead of the generated one
   *
   * @return SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
   */
  setEnvelope(envelope) {
    let list;
    this._envelope = {
      from: false,
      to: []
    };
    if (envelope.from) {
      list = [];
      this._convertAddresses(this._parseEnvelopeAddresses(envelope.from), list);
      list = list.filter((address) => address && address.address);
      if (list.length && list[0]) {
        this._envelope.from = list[0].address;
      }
    }
    const seenRecipients = /* @__PURE__ */ new Set();
    const recipients = [];
    ["to", "cc", "bcc"].forEach((key) => {
      if (envelope[key]) {
        this._convertAddresses(this._parseEnvelopeAddresses(envelope[key]), recipients, seenRecipients);
      }
    });
    this._envelope.to = recipients.map((to) => to.address).filter((address) => address);
    const standardFields = ["to", "cc", "bcc", "from"];
    copyOwnKeys(this._envelope, envelope, (key) => standardFields.includes(key));
    return this;
  }
  /**
   * Generates and returns an object with parsed address fields
   *
   * @return Address object
   */
  getAddresses() {
    const addresses = {};
    const seenByKey = /* @__PURE__ */ new Map();
    this._headers.forEach((header) => {
      const key = header.key.toLowerCase();
      if (["from", "sender", "reply-to", "to", "cc", "bcc"].includes(key)) {
        if (!Array.isArray(addresses[key])) {
          addresses[key] = [];
          seenByKey.set(key, /* @__PURE__ */ new Set());
        }
        this._convertAddresses(this._parseAddresses(header.value), addresses[key], seenByKey.get(key));
      }
    });
    return addresses;
  }
  /**
   * Generates and returns SMTP envelope with the sender address and a list of recipients addresses
   *
   * @return SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
   */
  getEnvelope() {
    if (this._envelope) {
      return this._envelope;
    }
    const envelope = {
      from: false,
      to: []
    };
    const seenRecipients = /* @__PURE__ */ new Set();
    const recipients = [];
    this._headers.forEach((header) => {
      const list = [];
      if (header.key === "From" || !envelope.from && ["Reply-To", "Sender"].includes(header.key)) {
        this._convertAddresses(this._parseAddresses(header.value), list);
        if (list.length && list[0]) {
          envelope.from = list[0].address;
        }
      } else if (["To", "Cc", "Bcc"].includes(header.key)) {
        this._convertAddresses(this._parseAddresses(header.value), recipients, seenRecipients);
      }
    });
    envelope.to = recipients.map((to) => to.address);
    return envelope;
  }
  /**
   * Returns Message-Id value. If it does not exist, then creates one
   *
   * @return Message-Id value
   */
  messageId() {
    let messageId = this.getHeader("Message-ID");
    if (!messageId) {
      messageId = this._generateMessageId();
      this.setHeader("Message-ID", messageId);
    }
    return messageId;
  }
  /**
   * Sets pregenerated content that will be used as the output of this node
   *
   * @param raw Raw MIME contents
   */
  setRaw(raw) {
    this._raw = raw;
    if (this._raw && typeof this._raw.pipe === "function") {
      this._contentErrorHandler = (err) => {
        this._raw.removeListener("error", this._contentErrorHandler);
        this._raw = err;
      };
      this._raw.once("error", this._contentErrorHandler);
    }
    return this;
  }
  /////// PRIVATE METHODS
  /**
   * Checks an access policy flag for this node and every node above it. The flags are set
   * from the options the node was built with, and createChild only ever sees the options
   * the caller passed, so a child of a closed tree starts out open. Reading the answer off
   * the parent chain keeps it right whatever order the tree was assembled in.
   *
   * @param flag Either 'disableFileAccess' or 'disableUrlAccess'
   * @return true if this node or an ancestor closed that access
   * @internal
   */
  _accessDisabled(flag) {
    let node = this;
    while (node) {
      if (node[flag]) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }
  /**
   * Detects and returns handle to a stream related with the content.
   *
   * @param content Node content
   * @returns Stream object
   * @internal
   */
  _getStream(content) {
    let contentStream;
    if (content._resolvedValue) {
      contentStream = new PassThrough2();
      setImmediate(() => {
        try {
          contentStream.end(content._resolvedValue);
        } catch (_err) {
          contentStream.emit("error", _err);
        }
      });
      return contentStream;
    }
    if (typeof content.pipe === "function") {
      return content;
    }
    if (content && typeof content.path === "string" && !content.href) {
      if (this._accessDisabled("disableFileAccess")) {
        contentStream = new PassThrough2();
        setImmediate(() => {
          const err = new Error("File access rejected for " + content.path);
          err.code = EFILEACCESS;
          contentStream.emit("error", err);
        });
        return contentStream;
      }
      return fs2.createReadStream(content.path);
    }
    if (content && typeof content.href === "string") {
      if (this._accessDisabled("disableUrlAccess")) {
        contentStream = new PassThrough2();
        setImmediate(() => {
          const err = new Error("Url access rejected for " + content.href);
          err.code = EURLACCESS;
          contentStream.emit("error", err);
        });
        return contentStream;
      }
      return fetch_default(content.href, { headers: content.httpHeaders, tls: content.tls });
    }
    contentStream = new PassThrough2();
    setImmediate(() => {
      try {
        contentStream.end(content || "");
      } catch (_err) {
        contentStream.emit("error", _err);
      }
    });
    return contentStream;
  }
  /**
   * Parses addresses. Takes in a single address or an array or an
   * array of address arrays (eg. To: [[first group], [second group],...])
   *
   * @param addresses Addresses to be parsed
   * @return An array of address objects
   * @internal
   */
  _parseAddresses(addresses) {
    const flattened = [];
    const seen = /* @__PURE__ */ new WeakSet();
    const stack = [];
    const enter = (list) => {
      if (!seen.has(list)) {
        seen.add(list);
        stack.push({ list, pos: 0 });
      }
    };
    enter(Array.isArray(addresses) ? addresses : [addresses]);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.pos >= frame.list.length) {
        stack.pop();
        continue;
      }
      const address = frame.list[frame.pos++];
      if (Array.isArray(address)) {
        enter(address);
        continue;
      }
      if (address && address.address) {
        const normalized2 = this._normalizeAddress(address.address);
        if (normalized2 === address.address && typeof address.name === "string") {
          flattened.push(address);
          continue;
        }
        const copy = copyOwnKeys({}, address);
        copy.address = normalized2;
        copy.name = address.name || "";
        flattened.push(copy);
        continue;
      }
      const parsed = this._normalizeParsedAddresses(addressparser_default(address));
      for (let i = 0; i < parsed.length; i++) {
        flattened.push(parsed[i]);
      }
    }
    return flattened;
  }
  /**
   * Normalizes the addresses of a freshly parsed address list, groups included.
   *
   * Everything this method returns carries a normalized address, whether it arrived as an
   * object or was parsed out of a header value. Without this the two shapes disagree, and
   * a consumer reading the parsed form back is handed the ambiguous
   * 'user@evil.com@good.com' that the header and the envelope no longer carry.
   *
   * @param parsed An array of address objects, as returned by addressparser
   * @return The same array, with every address normalized
   * @internal
   */
  _normalizeParsedAddresses(parsed) {
    parsed.forEach((entry) => {
      if (entry.address) {
        entry.address = this._normalizeAddress(entry.address);
      } else if (entry.group) {
        this._normalizeParsedAddresses(entry.group);
      }
    });
    return parsed;
  }
  /**
   * Parses the addresses of an explicitly set envelope.
   *
   * An envelope value is an addr-spec and never a display name, so a bare local username
   * such as 'root' is the address here. Header parsing has to read the same value as a
   * display name, as a value with no '@' in it can not be an addr-spec in a header.
   *
   * @param addresses Addresses to be parsed
   * @return An array of address objects
   * @internal
   */
  _parseEnvelopeAddresses(addresses) {
    return this._parseAddresses(addresses).map((entry) => {
      if (entry.address || entry.group || !entry.name || /[\s@]/.test(entry.name)) {
        return entry;
      }
      return { address: this._normalizeAddress(entry.name), name: "" };
    });
  }
  /**
   * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
   *
   * @param key Key to be normalized
   * @return key in Camel-Case form
   * @internal
   */
  _normalizeHeaderKey(key) {
    key = (key || "").toString().replace(/\r?\n|\r/g, " ").replace(/[\x00-\x1f\x7f]/g, "").trim().toLowerCase().replace(/^X-SMTPAPI$|^(MIME|DKIM|ARC|BIMI)\b|^[a-z]|-(SPF|FBL|ID|MD5)$|-[a-z]/gi, (c) => c.toUpperCase()).replace(/^Content-Features$/i, "Content-features");
    return key;
  }
  /**
   * Checks if the content type is multipart and defines boundary if needed.
   * Doesn't return anything, modifies object argument instead.
   *
   * @param structured Parsed header value for 'Content-Type' key
   * @internal
   */
  _handleContentType(structured) {
    this.contentType = structured.value.trim().toLowerCase();
    this.multipart = /^multipart\//i.test(this.contentType) ? this.contentType.substr(this.contentType.indexOf("/") + 1) : false;
    if (this.multipart) {
      const declared = _stripBoundaryControls(structured.params.boundary || this.boundary || "");
      this.boundary = structured.params.boundary = declared || _stripBoundaryControls(this._generateBoundary());
    } else {
      this.boundary = false;
    }
  }
  /**
   * Generates a multipart boundary value
   *
   * @return boundary value
   * @internal
   */
  _generateBoundary() {
    return _stripBoundaryControls(this.rootNode.boundaryPrefix + "-" + this.rootNode.baseBoundary) + "-Part_" + this._nodeId;
  }
  /**
   * Encodes a header value for use in the generated rfc2822 email.
   *
   * @param key Header key
   * @param value Header value
   * @internal
   */
  _encodeHeaderValue(key, value) {
    key = this._normalizeHeaderKey(key);
    switch (key) {
      // Structured headers
      case "From":
      case "Sender":
      case "To":
      case "Cc":
      case "Bcc":
      case "Reply-To":
        return this._convertAddresses(this._parseAddresses(value));
      // values enclosed in <>
      case "Message-ID":
      case "In-Reply-To":
      case "Content-Id":
        value = (value || "").toString().replace(/\r?\n|\r/g, " ").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
        if (value.charAt(0) !== "<") {
          value = "<" + value;
        }
        if (value.charAt(value.length - 1) !== ">") {
          value = value + ">";
        }
        return value;
      // space separated list of values enclosed in <>
      case "References":
        value = [].concat.apply([], [].concat(value || "").map((elm) => {
          elm = (elm || "").toString().replace(/\r?\n|\r/g, " ").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
          return elm.replace(/<[^>]*>/g, (str) => str.replace(/\s/g, "")).split(/\s+/);
        })).map((elm) => {
          if (elm.charAt(0) !== "<") {
            elm = "<" + elm;
          }
          if (elm.charAt(elm.length - 1) !== ">") {
            elm = elm + ">";
          }
          return elm;
        });
        return value.join(" ").trim();
      case "Date":
        if (Object.prototype.toString.call(value) === "[object Date]") {
          return value.toUTCString().replace(/GMT/, "+0000");
        }
        value = (value || "").toString().replace(/\r?\n|\r/g, " ");
        return this._encodeHeaderText(value);
      case "Content-Type":
      case "Content-Disposition":
        return (value || "").toString().replace(/\r?\n|\r/g, " ");
      default:
        value = (value || "").toString().replace(/\r?\n|\r/g, " ");
        return this._encodeHeaderText(value);
    }
  }
  /**
   * Rebuilds address object using punycode and other adjustments
   *
   * @param addresses An array of address objects
   * @param [uniqueList] An array to be populated with addresses
   * @return address string
   * @internal
   */
  _convertAddresses(addresses, uniqueList, seenAddresses) {
    const values = [];
    uniqueList = uniqueList || [];
    if (!seenAddresses) {
      seenAddresses = /* @__PURE__ */ new Set();
      for (let i = 0; i < uniqueList.length; i++) {
        seenAddresses.add(uniqueList[i].address);
      }
    }
    [].concat(addresses || []).forEach((address) => {
      if (address.address) {
        address.address = this._normalizeAddress(address.address);
        if (!address.name) {
          values.push(PLAIN_ADDRESS.test(address.address) ? address.address : `<${address.address}>`);
        } else {
          values.push(`${this._encodeAddressName(address.name)} <${address.address}>`);
        }
        if (!seenAddresses.has(address.address)) {
          seenAddresses.add(address.address);
          uniqueList.push(address);
        }
      } else if (address.group) {
        const groupListAddresses = (address.group.length ? this._convertAddresses(address.group, uniqueList, seenAddresses) : "").trim();
        values.push(`${this._encodeAddressName(address.name)}:${groupListAddresses};`);
      }
    });
    return values.join(", ");
  }
  /**
   * Normalizes an email address
   *
   * @param address An array of address objects
   * @return address string
   * @internal
   */
  _normalizeAddress(address) {
    address = (address || "").toString().replace(/[\x00-\x1F\x7F<>]+/g, " ").trim();
    if (!address) {
      return address;
    }
    const lastAt = address.lastIndexOf("@");
    if (lastAt < 0) {
      return this._normalizeLocalPart(address);
    }
    const user = address.substr(0, lastAt);
    const domain = address.substr(lastAt + 1);
    let encodedDomain = domain;
    const smtputf8 = /[\x80-\uFFFF]/.test(user);
    try {
      encodedDomain = normalizeDomain(domain.toLowerCase(), smtputf8);
    } catch (_err) {
    }
    return `${this._normalizeLocalPart(user)}@${encodedDomain}`;
  }
  /**
   * Normalizes the local part of an address into a form that can be emitted as is.
   *
   * A local part is either a dot-atom or a quoted-string, anything else is not a valid
   * addr-spec. The quotes of a quoted local part get lost along the way, and a bare
   * 'user@evil.com@good.com' leaves it to the receiver which '@' splits the domain off,
   * while the split here is always at the last one. So whatever is not already one of
   * the two valid forms goes back out as a quoted-string.
   *
   * @param user Local part of an address
   * @return Local part as a dot-atom or as a quoted-string
   * @internal
   */
  _normalizeLocalPart(user) {
    if (DOT_ATOM.test(user) || QUOTED_STRING.test(user)) {
      return user;
    }
    return quoteString(user);
  }
  /**
   * If needed, mime encodes the name part
   *
   * @param name Name part of an address
   * @returns Mime word encoded string if needed
   * @internal
   */
  _encodeAddressName(name2) {
    if (!/^[\w ]*$/.test(name2)) {
      if (/^[\x20-\x7e]*$/.test(name2)) {
        return quoteString(name2);
      } else {
        return encodeWord(name2, this._getTextEncoding(name2), 52);
      }
    }
    return name2;
  }
  /**
   * Encodes an unstructured header value. Such a value can only carry VCHAR and WSP, so a
   * control char or DEL has to be forced into the mime encoded word that a non-ascii value
   * would get anyway. HT stays as it is, it is valid folding whitespace here.
   *
   * @param value Header value to encode
   * @returns Mime word encoded string if needed
   * @internal
   */
  _encodeHeaderText(value) {
    return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ? encodeWord(value, this._getTextEncoding(value), 52) : (
      // encodeWords only encodes if needed, otherwise the original string is returned
      this._encodeWords(value)
    );
  }
  /**
   * If needed, mime encodes the name part
   *
   * @param name Name part of an address
   * @returns Mime word encoded string if needed
   * @internal
   */
  _encodeWords(value) {
    return encodeWords(value, this._getTextEncoding(value), 52, true);
  }
  /**
   * Detects best mime encoding for a text value
   *
   * @param value Value to check for
   * @return either 'Q' or 'B'
   * @internal
   */
  _getTextEncoding(value) {
    value = (value || "").toString();
    if (this.textEncoding) {
      return this.textEncoding;
    }
    let nonLatinLen = 0;
    let latinLen = 0;
    for (let i = 0, len = value.length; i < len; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0 && code <= 8 || code === 11 || code === 12 || code >= 14 && code <= 31 || code >= 128) {
        nonLatinLen++;
      } else if (code >= 65 && code <= 90 || code >= 97 && code <= 122) {
        latinLen++;
      }
    }
    return nonLatinLen < latinLen ? "Q" : "B";
  }
  /**
   * Generates a message id
   *
   * @return Random Message-ID value
   * @internal
   */
  _generateMessageId() {
    return "<" + [2, 2, 2, 6].reduce(
      // crux to generate UUID-like random strings
      (prev, len) => prev + "-" + crypto.randomBytes(len).toString("hex"),
      crypto.randomBytes(4).toString("hex")
    ) + "@" + // try to use the domain of the FROM address or fallback to server hostname
    (this.getEnvelope().from || this.hostname || "localhost").split("@").pop() + ">";
  }
};
var mime_node_default = MimeNode;

// node_modules/nodemailer/dist/esm/mail-composer/index.js
function isContentObject(value) {
  const content = value;
  return typeof value === "object" && !!(content.content || content.path || content.href || content.raw);
}
var MailComposer = class {
  constructor(mail) {
    this.mail = mail || {};
    this.message = false;
  }
  /**
   * Builds MimeNode instance
   */
  compile() {
    this._alternatives = this.getAlternatives();
    this._htmlNode = this._alternatives.filter((alternative) => /^text\/html\b/i.test(alternative.contentType)).pop();
    this._attachments = this.getAttachments(!!this._htmlNode);
    this._useRelated = !!(this._htmlNode && this._attachments.related.length);
    this._useAlternative = this._alternatives.length > 1;
    this._useMixed = this._attachments.attached.length > 1 || this._alternatives.length && this._attachments.attached.length === 1;
    if (this.mail.raw) {
      this.message = new mime_node_default("message/rfc822", {
        newline: this.mail.newline,
        disableUrlAccess: this.mail.disableUrlAccess,
        disableFileAccess: this.mail.disableFileAccess
      }).setRaw(this.mail.raw);
    } else if (this._useMixed) {
      this.message = this._createMixed();
    } else if (this._useAlternative) {
      this.message = this._createAlternative();
    } else if (this._useRelated) {
      this.message = this._createRelated();
    } else {
      this.message = this._createContentNode(false, [].concat(this._alternatives || []).concat(this._attachments.attached || []).shift() || {
        contentType: "text/plain",
        content: ""
      });
    }
    if (this.mail.headers) {
      this.message.addHeader(this.mail.headers);
    }
    ["from", "sender", "to", "cc", "bcc", "reply-to", "in-reply-to", "references", "subject", "message-id", "date"].forEach((header) => {
      const key = header.replace(/-(\w)/g, (o, c) => c.toUpperCase());
      if (this.mail[key]) {
        this.message.setHeader(header, this.mail[key]);
      }
    });
    if (this.mail.envelope) {
      this.message.setEnvelope(this.mail.envelope);
    }
    this.message.messageId();
    return this.message;
  }
  /**
   * List all attachments. Resulting attachment objects can be used as input for MimeNode nodes
   *
   * @param findRelated If true separate related attachments from attached ones
   * @returns An object of arrays (`related` and `attached`)
   */
  getAttachments(findRelated) {
    let eventObject;
    const attachments = [].concat(this.mail.attachments || []).map((attachment, i) => {
      if (/^data:/i.test(attachment.path || attachment.href)) {
        attachment = this._processDataUrl(attachment);
      }
      const contentType = attachment.contentType || detectMimeType2(attachment.filename || attachment.path || attachment.href || "bin");
      const isImage = /^image\//i.test(contentType);
      const isMessageNode = /^message\//i.test(contentType);
      const contentDisposition = attachment.contentDisposition || (isMessageNode || isImage && attachment.cid ? "inline" : "attachment");
      let contentTransferEncoding;
      if ("contentTransferEncoding" in attachment) {
        contentTransferEncoding = attachment.contentTransferEncoding;
      } else if (isMessageNode) {
        contentTransferEncoding = "8bit";
      } else {
        contentTransferEncoding = "base64";
      }
      const data = {
        contentType,
        contentDisposition,
        contentTransferEncoding
      };
      if (attachment.filename) {
        data.filename = attachment.filename;
      } else if (!isMessageNode && attachment.filename !== false) {
        data.filename = (attachment.path || attachment.href || "").split(/[/\\]/).pop().split("?").shift() || "attachment-" + (i + 1);
        if (data.filename.indexOf(".") < 0) {
          data.filename += "." + detectExtension2(data.contentType);
        }
      }
      if (/^https?:\/\//i.test(attachment.path)) {
        attachment.href = attachment.path;
        attachment.path = void 0;
      }
      if (attachment.cid) {
        data.cid = attachment.cid;
      }
      if (attachment.raw) {
        data.raw = attachment.raw;
      } else if (attachment.path) {
        data.content = {
          path: attachment.path
        };
      } else if (attachment.href) {
        data.content = {
          href: attachment.href,
          httpHeaders: attachment.httpHeaders,
          tls: attachment.tls
        };
      } else {
        data.content = attachment.content || "";
      }
      if (attachment.encoding) {
        data.encoding = attachment.encoding;
      }
      if (attachment.headers) {
        data.headers = attachment.headers;
      }
      return data;
    });
    if (this.mail.icalEvent) {
      eventObject = Object.assign({}, this._getIcalEvent());
      eventObject.contentType = "application/ics";
      if (!eventObject.headers) {
        eventObject.headers = {};
      }
      eventObject.filename = eventObject.filename || "invite.ics";
      eventObject.headers["Content-Disposition"] = "attachment";
      eventObject.headers["Content-Transfer-Encoding"] = "base64";
    }
    if (!findRelated) {
      return {
        attached: attachments.concat(eventObject || []),
        related: []
      };
    }
    return {
      attached: attachments.filter((attachment) => !attachment.cid).concat(eventObject || []),
      related: attachments.filter((attachment) => !!attachment.cid)
    };
  }
  /**
   * Returns the icalEvent value with `path`/`href`/data uri input normalized into
   * a `content` entry, the same way as for regular attachments. The same event is
   * included twice (as a text/calendar alternative and as an application/ics
   * attachment), so the shared content object is marked to be resolved just once
   * and the buffered result is reused by the second node.
   *
   * @returns Normalized icalEvent data
   * @internal
   */
  _getIcalEvent() {
    if (!this._icalEvent) {
      let icalEvent;
      if (isContentObject(this.mail.icalEvent)) {
        icalEvent = copyOwnKeys({}, this.mail.icalEvent);
      } else {
        icalEvent = {
          content: this.mail.icalEvent
        };
      }
      if (/^data:/i.test(icalEvent.path || icalEvent.href)) {
        icalEvent = this._processDataUrl(icalEvent);
      }
      if (/^https?:\/\//i.test(icalEvent.path)) {
        icalEvent.href = icalEvent.path;
        icalEvent.path = void 0;
      }
      if (!icalEvent.raw) {
        if (icalEvent.path) {
          icalEvent.content = {
            path: icalEvent.path
          };
          icalEvent.path = void 0;
        } else if (icalEvent.href) {
          icalEvent.content = {
            href: icalEvent.href,
            httpHeaders: icalEvent.httpHeaders,
            tls: icalEvent.tls
          };
          icalEvent.href = void 0;
        }
      }
      if (icalEvent.content && typeof icalEvent.content === "object") {
        icalEvent.content._resolve = true;
      }
      this._icalEvent = icalEvent;
    }
    return this._icalEvent;
  }
  /**
   * List alternatives. Resulting objects can be used as input for MimeNode nodes
   *
   * @returns An array of alternative elements. Includes the `text` and `html` values as well
   */
  getAlternatives() {
    const alternatives = [];
    let text, html, watchHtml, amp, eventObject;
    if (this.mail.text) {
      if (isContentObject(this.mail.text)) {
        text = this.mail.text;
      } else {
        text = {
          content: this.mail.text
        };
      }
      text.contentType = "text/plain; charset=utf-8";
    }
    if (this.mail.watchHtml) {
      if (isContentObject(this.mail.watchHtml)) {
        watchHtml = this.mail.watchHtml;
      } else {
        watchHtml = {
          content: this.mail.watchHtml
        };
      }
      watchHtml.contentType = "text/watch-html; charset=utf-8";
    }
    if (this.mail.amp) {
      if (isContentObject(this.mail.amp)) {
        amp = this.mail.amp;
      } else {
        amp = {
          content: this.mail.amp
        };
      }
      amp.contentType = "text/x-amp-html; charset=utf-8";
    }
    if (this.mail.icalEvent) {
      eventObject = Object.assign({}, this._getIcalEvent());
      eventObject.filename = false;
      eventObject.contentType = "text/calendar; charset=utf-8; method=" + (eventObject.method || "PUBLISH").toString().trim().toUpperCase();
      if (!eventObject.headers) {
        eventObject.headers = {};
      }
    }
    if (this.mail.html) {
      if (isContentObject(this.mail.html)) {
        html = this.mail.html;
      } else {
        html = {
          content: this.mail.html
        };
      }
      html.contentType = "text/html; charset=utf-8";
    }
    [].concat(text || []).concat(watchHtml || []).concat(amp || []).concat(html || []).concat(eventObject || []).concat(this.mail.alternatives || []).forEach((alternative) => {
      if (/^data:/i.test(alternative.path || alternative.href)) {
        alternative = this._processDataUrl(alternative);
      }
      const data = {
        contentType: alternative.contentType || detectMimeType2(alternative.filename || alternative.path || alternative.href || "txt"),
        contentTransferEncoding: alternative.contentTransferEncoding
      };
      if (alternative.filename) {
        data.filename = alternative.filename;
      }
      if (/^https?:\/\//i.test(alternative.path)) {
        alternative.href = alternative.path;
        alternative.path = void 0;
      }
      if (alternative.raw) {
        data.raw = alternative.raw;
      } else if (alternative.path) {
        data.content = {
          path: alternative.path
        };
      } else if (alternative.href) {
        data.content = {
          href: alternative.href,
          httpHeaders: alternative.httpHeaders,
          tls: alternative.tls
        };
      } else {
        data.content = alternative.content || "";
      }
      if (alternative.encoding) {
        data.encoding = alternative.encoding;
      }
      if (alternative.headers) {
        data.headers = alternative.headers;
      }
      alternatives.push(data);
    });
    return alternatives;
  }
  /**
   * Builds multipart/mixed node. It should always contain different type of elements on the same level
   * eg. text + attachments
   *
   * @param parentNode Parent for this note. If it does not exist, a root node is created
   * @returns MimeNode node element
   * @internal
   */
  _createMixed(parentNode) {
    const node = parentNode ? parentNode.createChild("multipart/mixed", {
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    }) : new mime_node_default("multipart/mixed", {
      baseBoundary: this.mail.baseBoundary,
      textEncoding: this.mail.textEncoding,
      boundaryPrefix: this.mail.boundaryPrefix,
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    });
    if (this._useAlternative) {
      this._createAlternative(node);
    } else if (this._useRelated) {
      this._createRelated(node);
    }
    [].concat(!this._useAlternative && this._alternatives || []).concat(this._attachments.attached || []).forEach((element) => {
      if (!this._useRelated || element !== this._htmlNode) {
        this._createContentNode(node, element);
      }
    });
    return node;
  }
  /**
   * Builds multipart/alternative node. It should always contain same type of elements on the same level
   * eg. text + html view of the same data
   *
   * @param parentNode Parent for this note. If it does not exist, a root node is created
   * @returns MimeNode node element
   * @internal
   */
  _createAlternative(parentNode) {
    const node = parentNode ? parentNode.createChild("multipart/alternative", {
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    }) : new mime_node_default("multipart/alternative", {
      baseBoundary: this.mail.baseBoundary,
      textEncoding: this.mail.textEncoding,
      boundaryPrefix: this.mail.boundaryPrefix,
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    });
    this._alternatives.forEach((alternative) => {
      if (this._useRelated && this._htmlNode === alternative) {
        this._createRelated(node);
      } else {
        this._createContentNode(node, alternative);
      }
    });
    return node;
  }
  /**
   * Builds multipart/related node. It should always contain html node with related attachments
   *
   * @param parentNode Parent for this note. If it does not exist, a root node is created
   * @returns MimeNode node element
   * @internal
   */
  _createRelated(parentNode) {
    const node = parentNode ? parentNode.createChild('multipart/related; type="text/html"', {
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    }) : new mime_node_default('multipart/related; type="text/html"', {
      baseBoundary: this.mail.baseBoundary,
      textEncoding: this.mail.textEncoding,
      boundaryPrefix: this.mail.boundaryPrefix,
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    });
    this._createContentNode(node, this._htmlNode);
    this._attachments.related.forEach((alternative) => this._createContentNode(node, alternative));
    return node;
  }
  /**
   * Creates a regular node with contents
   *
   * @param parentNode Parent for this note. If it does not exist, a root node is created
   * @param element Node data
   * @returns MimeNode node element
   * @internal
   */
  _createContentNode(parentNode, element) {
    element = element || {};
    element.content = element.content || "";
    const encoding = (element.encoding || "utf8").toString().toLowerCase().replace(/[-_\s]/g, "");
    const node = parentNode ? parentNode.createChild(element.contentType, {
      filename: element.filename,
      textEncoding: this.mail.textEncoding,
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    }) : new mime_node_default(element.contentType, {
      filename: element.filename,
      baseBoundary: this.mail.baseBoundary,
      textEncoding: this.mail.textEncoding,
      boundaryPrefix: this.mail.boundaryPrefix,
      disableUrlAccess: this.mail.disableUrlAccess,
      disableFileAccess: this.mail.disableFileAccess,
      normalizeHeaderKey: this.mail.normalizeHeaderKey,
      newline: this.mail.newline
    });
    if (element.headers) {
      node.addHeader(element.headers);
    }
    if (element.cid) {
      node.setHeader("Content-Id", "<" + element.cid.replace(/[<>]/g, "") + ">");
    }
    if (element.contentTransferEncoding) {
      node.setHeader("Content-Transfer-Encoding", element.contentTransferEncoding);
    } else if (this.mail.encoding && /^text\//i.test(element.contentType)) {
      node.setHeader("Content-Transfer-Encoding", this.mail.encoding);
    }
    if (!/^text\//i.test(element.contentType) || element.contentDisposition) {
      node.setHeader("Content-Disposition", element.contentDisposition || (element.cid && /^image\//i.test(element.contentType) ? "inline" : "attachment"));
    }
    if (typeof element.content === "string" && !["utf8", "usascii", "ascii"].includes(encoding)) {
      element.content = Buffer.from(element.content, encoding);
    }
    if (element.raw) {
      node.setRaw(element.raw);
    } else {
      node.setContent(element.content);
    }
    return node;
  }
  /**
   * Parses data uri and converts it to a Buffer
   *
   * @param element Content element
   * @return Parsed element
   * @internal
   */
  _processDataUrl(element) {
    const dataUrl = element.path || element.href;
    if (!dataUrl || typeof dataUrl !== "string") {
      return element;
    }
    if (!dataUrl.startsWith("data:")) {
      return element;
    }
    if (dataUrl.length > 52428800) {
      let detectedType = "application/octet-stream";
      const commaPos = dataUrl.indexOf(",");
      if (commaPos > 0 && commaPos < 200) {
        const header = dataUrl.substring(5, commaPos);
        const parts = header.split(";");
        if (parts[0] && parts[0].includes("/")) {
          detectedType = parts[0].trim();
        }
      }
      return Object.assign(copyOwnKeys({}, element), {
        path: false,
        href: false,
        content: Buffer.alloc(0),
        contentType: element.contentType || detectedType
      });
    }
    let parsedDataUri;
    try {
      parsedDataUri = parseDataURI(dataUrl);
    } catch (_err) {
      return element;
    }
    if (!parsedDataUri) {
      return element;
    }
    element.content = parsedDataUri.data;
    element.contentType = element.contentType || parsedDataUri.contentType;
    if ("path" in element) {
      element.path = false;
    }
    if ("href" in element) {
      element.href = false;
    }
    return element;
  }
};
var mail_composer_default = MailComposer;

// node_modules/nodemailer/dist/esm/dkim/message-parser.js
import { Transform as Transform6 } from "node:stream";
var MessageParser = class extends Transform6 {
  constructor(options) {
    super(options);
    this.lastBytes = Buffer.alloc(4);
    this.headersParsed = false;
    this.headerBytes = 0;
    this.headerChunks = [];
    this.rawHeaders = false;
    this.bodySize = 0;
  }
  /**
   * Keeps count of the last 4 bytes in order to detect line breaks on chunk boundaries
   *
   * @param data Next data chunk from the stream
   */
  updateLastBytes(data) {
    const lblen = this.lastBytes.length;
    const nblen = Math.min(data.length, lblen);
    for (let i = 0, len = lblen - nblen; i < len; i++) {
      this.lastBytes[i] = this.lastBytes[i + nblen];
    }
    for (let i = 1; i <= nblen; i++) {
      this.lastBytes[lblen - i] = data[data.length - i];
    }
  }
  /**
   * Finds and removes message headers from the remaining body. We want to keep
   * headers separated until final delivery to be able to modify these
   *
   * @param data Next chunk of data
   * @return Returns true if headers are already found or false otherwise
   */
  checkHeaders(data) {
    if (this.headersParsed) {
      return true;
    }
    const lblen = this.lastBytes.length;
    let headerPos = 0;
    for (let i = 0, len = this.lastBytes.length + data.length; i < len; i++) {
      let chr;
      if (i < lblen) {
        chr = this.lastBytes[i];
      } else {
        chr = data[i - lblen];
      }
      if (chr === 10 && i) {
        const pr1 = i - 1 < lblen ? this.lastBytes[i - 1] : data[i - 1 - lblen];
        const pr2 = i > 1 ? i - 2 < lblen ? this.lastBytes[i - 2] : data[i - 2 - lblen] : false;
        if (pr1 === 10) {
          this.headersParsed = true;
          headerPos = i - lblen + 1;
          this.headerBytes += headerPos;
          break;
        } else if (pr1 === 13 && pr2 === 10) {
          this.headersParsed = true;
          headerPos = i - lblen + 1;
          this.headerBytes += headerPos;
          break;
        }
      }
    }
    if (this.headersParsed) {
      this.headerChunks.push(data.slice(0, headerPos));
      this.rawHeaders = Buffer.concat(this.headerChunks, this.headerBytes);
      this.headerChunks = null;
      this.emit("headers", this.parseHeaders());
      if (data.length > headerPos) {
        const chunk = data.slice(headerPos);
        this.bodySize += chunk.length;
        setImmediate(() => this.push(chunk));
      }
      return false;
    }
    this.headerBytes += data.length;
    this.headerChunks.push(data);
    this.updateLastBytes(data);
    return false;
  }
  /** @internal */
  _transform(chunk, encoding, callback) {
    if (!chunk || !chunk.length) {
      return callback();
    }
    if (typeof chunk === "string") {
      chunk = Buffer.from(chunk, encoding);
    }
    let headersFound;
    try {
      headersFound = this.checkHeaders(chunk);
    } catch (E) {
      return callback(E);
    }
    if (headersFound) {
      this.bodySize += chunk.length;
      this.push(chunk);
    }
    setImmediate(callback);
  }
  /** @internal */
  _flush(callback) {
    if (this.headerChunks) {
      this.rawHeaders = Buffer.concat(this.headerChunks, this.headerBytes);
      this.headerChunks = null;
      this.emit("headers", this.parseHeaders());
    }
    callback();
  }
  parseHeaders() {
    const rawLines = (this.rawHeaders || Buffer.alloc(0)).toString("binary").split(/\r?\n/);
    const lines = [];
    for (const rawLine of rawLines) {
      if (lines.length && /^[ \t]/.test(rawLine)) {
        lines[lines.length - 1] += "\n" + rawLine;
      } else {
        lines.push(rawLine);
      }
    }
    return lines.filter((line) => /[^ \t\r]/.test(line)).map((line) => ({
      key: line.substr(0, line.indexOf(":")).replace(/^[ \t]+|[ \t]+$/g, "").toLowerCase(),
      line
    }));
  }
};
var message_parser_default = MessageParser;

// node_modules/nodemailer/dist/esm/dkim/relaxed-body.js
import { Transform as Transform7 } from "node:stream";
import crypto2 from "node:crypto";
var CHAR_CR = 13;
var CHAR_LF = 10;
var CHAR_SPACE = 32;
var CHAR_TAB = 9;
var CRLF = Buffer.from("\r\n");
var EMPTY_LINES = Buffer.alloc(4096, CRLF);
var RelaxedBody = class extends Transform7 {
  constructor(options) {
    super();
    options = options || {};
    this.bodyHash = crypto2.createHash(options.hashAlgo || "sha256");
    this.byteLength = 0;
    this.debug = options.debug;
    this._debugBody = options.debug ? [] : false;
    this._lineHasContent = false;
    this._pendingWsp = false;
    this._pendingCr = false;
    this._pendingEmptyLines = 0;
  }
  /** @internal */
  _hashCanonical(data) {
    if (!data.length) {
      return;
    }
    this.bodyHash.update(data);
    if (this._debugBody) {
      this._debugBody.push(Buffer.from(data));
    }
  }
  /** @internal */
  _hashEmptyLines() {
    while (this._pendingEmptyLines > 0) {
      const count = Math.min(this._pendingEmptyLines, EMPTY_LINES.length / 2);
      this._hashCanonical(EMPTY_LINES.subarray(0, count * 2));
      this._pendingEmptyLines -= count;
    }
  }
  /**
   * Writes a content byte, with the space a pending run of whitespace collapses to,
   * into the output buffer and returns the new write position. Kept a method rather
   * than a closure so the write position stays a plain local in the byte loop
   * @internal
   */
  _emitContent(out, outPos, c) {
    if (!this._lineHasContent) {
      if (this._pendingEmptyLines) {
        this._hashCanonical(out.subarray(0, outPos));
        outPos = 0;
        this._hashEmptyLines();
      }
      this._lineHasContent = true;
    }
    if (this._pendingWsp) {
      out[outPos++] = CHAR_SPACE;
      this._pendingWsp = false;
    }
    out[outPos++] = c;
    return outPos;
  }
  updateHash(chunk, final) {
    const out = Buffer.allocUnsafe(chunk.length * 2 + 2);
    let outPos = 0;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (c === CHAR_LF) {
        if (this._lineHasContent) {
          out[outPos++] = CHAR_CR;
          out[outPos++] = CHAR_LF;
          this._lineHasContent = false;
        } else {
          this._pendingEmptyLines++;
        }
        this._pendingWsp = false;
        this._pendingCr = false;
        continue;
      }
      if (this._pendingCr) {
        outPos = this._emitContent(out, outPos, CHAR_CR);
        this._pendingCr = false;
      }
      if (c === CHAR_CR) {
        this._pendingCr = true;
      } else if (c === CHAR_SPACE || c === CHAR_TAB) {
        this._pendingWsp = true;
      } else {
        outPos = this._emitContent(out, outPos, c);
      }
    }
    if (final && this._pendingCr) {
      outPos = this._emitContent(out, outPos, CHAR_CR);
      this._pendingCr = false;
    }
    this._hashCanonical(out.subarray(0, outPos));
  }
  /** @internal */
  _transform(chunk, encoding, callback) {
    if (!chunk || !chunk.length) {
      return callback();
    }
    if (typeof chunk === "string") {
      chunk = Buffer.from(chunk, encoding);
    }
    this.updateHash(chunk);
    this.byteLength += chunk.length;
    this.push(chunk);
    callback();
  }
  /** @internal */
  _flush(callback) {
    this.updateHash(Buffer.alloc(0), true);
    if (this._lineHasContent) {
      this._hashCanonical(CRLF);
    }
    this.emit("hash", this.bodyHash.digest("base64"), this.debug ? Buffer.concat(this._debugBody) : false);
    callback();
  }
};
var relaxed_body_default = RelaxedBody;

// node_modules/nodemailer/dist/esm/dkim/sign.js
import crypto3 from "node:crypto";
function unsupportedHashAlgoError(hashAlgo) {
  const err = new Error('Unsupported DKIM hash algorithm "' + hashAlgo + '"');
  err.code = ECONFIG;
  return err;
}
function sign(headers, hashAlgo, bodyHash, options) {
  options = options || {};
  const defaultFieldNames = "From:Sender:Reply-To:Subject:Date:Message-ID:To:Cc:MIME-Version:Content-Type:Content-Transfer-Encoding:Content-ID:Content-Description:Resent-Date:Resent-From:Resent-Sender:Resent-To:Resent-Cc:Resent-Message-ID:In-Reply-To:References:List-Id:List-Help:List-Unsubscribe:List-Subscribe:List-Post:List-Owner:List-Archive";
  const fieldNames = options.headerFieldNames || defaultFieldNames;
  const canonicalizedHeaderData = relaxedHeaders(headers, fieldNames, options.skipFields);
  const dkimHeader = generateDKIMHeader(options.domainName, options.keySelector, canonicalizedHeaderData.fieldNames, hashAlgo, bodyHash);
  canonicalizedHeaderData.headers += "dkim-signature:" + relaxedHeaderLine(dkimHeader);
  let signer;
  try {
    signer = crypto3.createSign(("rsa-" + hashAlgo).toUpperCase());
  } catch (_E) {
    throw unsupportedHashAlgoError(hashAlgo);
  }
  signer.update(canonicalizedHeaderData.headers, "latin1");
  let signature;
  try {
    signature = signer.sign(options.privateKey, "base64");
  } catch (_E) {
    return false;
  }
  return dkimHeader + signature.replace(/(^.{73}|.{75}(?!\r?\n|\r))/g, "$&\r\n ").trim();
}
sign.relaxedHeaders = relaxedHeaders;
sign.unsupportedHashAlgoError = unsupportedHashAlgoError;
var sign_default = sign;
function generateDKIMHeader(domainName, keySelector, fieldNames, hashAlgo, bodyHash) {
  const cleanTagValue = (value) => (value || "").toString().replace(/[\x00-\x1f\x7f;=]/g, "");
  const dkim = [
    "v=1",
    "a=rsa-" + hashAlgo,
    "c=relaxed/relaxed",
    "d=" + toASCII(cleanTagValue(domainName)),
    "q=dns/txt",
    "s=" + cleanTagValue(keySelector),
    "bh=" + bodyHash,
    "h=" + cleanTagValue(fieldNames)
  ].join("; ");
  return foldLines("DKIM-Signature: " + dkim, 76) + ";\r\n b=";
}
function relaxedHeaders(headers, fieldNames, skipFields) {
  const includedFields = /* @__PURE__ */ new Set();
  const skip = /* @__PURE__ */ new Set();
  const headerFields = /* @__PURE__ */ new Map();
  (skipFields || "").toLowerCase().split(":").forEach((field) => {
    skip.add(field.trim());
  });
  (fieldNames || "").toLowerCase().split(":").filter((field) => !skip.has(field.trim())).forEach((field) => {
    includedFields.add(field.trim());
  });
  for (let i = headers.length - 1; i >= 0; i--) {
    const line = headers[i];
    if (includedFields.has(line.key) && !headerFields.has(line.key)) {
      headerFields.set(line.key, relaxedHeaderLine(line.line));
    }
  }
  const headersList = [];
  const fields = [];
  includedFields.forEach((field) => {
    if (headerFields.has(field)) {
      fields.push(field);
      headersList.push(field + ":" + headerFields.get(field));
    }
  });
  return {
    headers: headersList.join("\r\n") + "\r\n",
    fieldNames: fields.join(":")
  };
}
function relaxedHeaderLine(line) {
  return line.substr(line.indexOf(":") + 1).replace(/\r?\n/g, "").replace(/[ \t]+/g, " ").replace(/^ | $/g, "");
}

// node_modules/nodemailer/dist/esm/dkim/index.js
import { PassThrough as PassThrough3 } from "node:stream";
import fs3 from "node:fs";
import path2 from "node:path";
import crypto4 from "node:crypto";
var DKIM_ALGO = "sha256";
var MAX_MESSAGE_SIZE = 10 * 1024 * 1024;
var DKIMSigner = class {
  constructor(options, keys, input, output) {
    this.options = options || {};
    this.keys = keys;
    this.cacheTreshold = Number(this.options.cacheTreshold) || MAX_MESSAGE_SIZE;
    this.hashAlgo = this.options.hashAlgo || DKIM_ALGO;
    this.cacheDir = this.options.cacheDir || false;
    this.chunks = [];
    this.chunklen = 0;
    this.readPos = 0;
    this.cachePath = this.cacheDir ? path2.join(this.cacheDir, "message." + Date.now() + "-" + crypto4.randomBytes(14).toString("hex")) : false;
    this.cache = false;
    this.headers = false;
    this.bodyHash = false;
    this.parser = false;
    this.relaxedBody = false;
    this.input = input;
    this.output = output;
    this.output.usingCache = false;
    this.hasErrored = false;
    this.input.on("error", (err) => {
      this.hasErrored = true;
      this.cleanup();
      output.emit("error", err);
    });
  }
  cleanup() {
    if (!this.cache || !this.cachePath) {
      return;
    }
    fs3.unlink(this.cachePath, () => false);
  }
  createReadCache() {
    this.cache = fs3.createReadStream(this.cachePath);
    this.cache.once("error", (err) => {
      this.cleanup();
      this.output.emit("error", err);
    });
    this.cache.once("close", () => {
      this.cleanup();
    });
    this.cache.pipe(this.output);
  }
  sendNextChunk() {
    if (this.hasErrored) {
      return;
    }
    if (this.readPos >= this.chunks.length) {
      if (!this.cache) {
        this.output.end();
        return;
      }
      return this.createReadCache();
    }
    const chunk = this.chunks[this.readPos++];
    if (this.output.write(chunk) === false) {
      this.output.once("drain", () => {
        this.sendNextChunk();
      });
      return;
    }
    setImmediate(() => this.sendNextChunk());
  }
  sendSignedOutput() {
    let keyPos = 0;
    const signNextKey = () => {
      if (keyPos >= this.keys.length) {
        this.output.write(this.parser.rawHeaders);
        setImmediate(() => this.sendNextChunk());
        return;
      }
      const key = this.keys[keyPos++];
      let dkimField;
      try {
        dkimField = sign_default(this.headers, this.hashAlgo, this.bodyHash, {
          domainName: key.domainName,
          keySelector: key.keySelector,
          privateKey: key.privateKey,
          headerFieldNames: this.options.headerFieldNames,
          skipFields: this.options.skipFields
        });
      } catch (err) {
        this.hasErrored = true;
        this.cleanup();
        this.output.emit("error", err);
        return;
      }
      if (dkimField) {
        this.output.write(Buffer.from(dkimField + "\r\n"));
      }
      setImmediate(signNextKey);
    };
    if (this.bodyHash && this.headers) {
      return signNextKey();
    }
    this.output.write(this.parser.rawHeaders);
    this.sendNextChunk();
  }
  createWriteCache() {
    this.output.usingCache = true;
    this.cache = fs3.createWriteStream(this.cachePath);
    this.cache.once("error", (err) => {
      this.cleanup();
      this.relaxedBody.unpipe(this.cache);
      this.relaxedBody.on("readable", () => {
        while (this.relaxedBody.read() !== null) {
        }
      });
      this.hasErrored = true;
      this.output.emit("error", err);
    });
    this.cache.once("close", () => {
      this.sendSignedOutput();
    });
    this.relaxedBody.removeAllListeners("readable");
    this.relaxedBody.pipe(this.cache);
  }
  signStream() {
    this.parser = new message_parser_default();
    this.relaxedBody = new relaxed_body_default({
      hashAlgo: this.hashAlgo
    });
    this.parser.on("headers", (value) => {
      this.headers = value;
    });
    this.relaxedBody.on("hash", (value) => {
      this.bodyHash = value;
    });
    this.relaxedBody.on("readable", () => {
      let chunk;
      if (this.cache) {
        return;
      }
      while ((chunk = this.relaxedBody.read()) !== null) {
        this.chunks.push(chunk);
        this.chunklen += chunk.length;
        if (this.chunklen >= this.cacheTreshold && this.cachePath) {
          return this.createWriteCache();
        }
      }
    });
    this.relaxedBody.on("end", () => {
      if (this.cache) {
        return;
      }
      this.sendSignedOutput();
    });
    this.parser.pipe(this.relaxedBody);
    setImmediate(() => this.input.pipe(this.parser));
  }
};
var DKIM = class {
  constructor(options) {
    this.options = options || {};
    this.keys = [].concat(this.options.keys || {
      domainName: options.domainName,
      keySelector: options.keySelector,
      privateKey: options.privateKey
    });
  }
  sign(input, extraOptions) {
    const output = new PassThrough3();
    let inputStream = input;
    let writeValue = false;
    if (Buffer.isBuffer(input)) {
      writeValue = input;
      inputStream = new PassThrough3();
    } else if (typeof input === "string") {
      writeValue = Buffer.from(input);
      inputStream = new PassThrough3();
    }
    let options = this.options;
    if (extraOptions && Object.keys(extraOptions).length) {
      options = copyOwnKeys({}, extraOptions);
      copyOwnKeys(options, this.options);
    }
    const signer = new DKIMSigner(options, this.keys, inputStream, output);
    setImmediate(() => {
      try {
        signer.signStream();
      } catch (_E) {
        output.emit("error", sign_default.unsupportedHashAlgoError(signer.hashAlgo));
        return;
      }
      if (writeValue) {
        setImmediate(() => {
          inputStream.end(writeValue);
        });
      }
    });
    return output;
  }
};
var dkim_default = DKIM;

// node_modules/nodemailer/dist/esm/smtp-connection/http-proxy-client.js
import net5 from "node:net";
import tls from "node:tls";
var MAX_RESPONSE_HEADER_BYTES = 64 * 1024;
function httpProxyClient(proxyUrl, destinationPort, destinationHost, tlsOptions, callback) {
  if (typeof tlsOptions === "function") {
    callback = tlsOptions;
    tlsOptions = {};
  }
  tlsOptions = tlsOptions || {};
  const done = callback;
  destinationPort = Number(destinationPort) || 0;
  if (!destinationPort || /[\r\n]/.test(destinationHost)) {
    const err = new Error("Invalid proxy destination");
    err.code = EPROXY;
    setImmediate(() => done(err));
    return;
  }
  const proxy = parse(proxyUrl);
  const connectOptions = {
    host: proxy.hostname,
    port: Number(proxy.port) ? Number(proxy.port) : proxy.protocol === "https:" ? 443 : 80
  };
  let connect;
  if (proxy.protocol === "https:") {
    connectOptions.rejectUnauthorized = tlsOptions.rejectUnauthorized !== false;
    connect = tls.connect.bind(tls);
  } else {
    connect = net5.connect.bind(net5);
  }
  let socket;
  let finished = false;
  const tempSocketErr = (err) => {
    if (finished) {
      return;
    }
    finished = true;
    try {
      socket.destroy();
    } catch (_E) {
    }
    done(err);
  };
  const timeoutErr = () => {
    const err = new Error("Proxy socket timed out");
    err.code = "ETIMEDOUT";
    tempSocketErr(err);
  };
  socket = connect(connectOptions, () => {
    if (finished) {
      return;
    }
    const reqHeaders = {
      Host: destinationHost + ":" + destinationPort,
      Connection: "close"
    };
    if (proxy.auth) {
      reqHeaders["Proxy-Authorization"] = "Basic " + Buffer.from(proxy.auth).toString("base64");
    }
    socket.write(
      // HTTP method
      "CONNECT " + destinationHost + ":" + destinationPort + " HTTP/1.1\r\n" + // HTTP request headers
      Object.keys(reqHeaders).map((key) => key + ": " + reqHeaders[key]).join("\r\n") + // End request
      "\r\n\r\n"
    );
    let headers = "";
    const onSocketData = (chunk) => {
      let match;
      let remainder;
      if (finished) {
        return;
      }
      headers += chunk.toString("binary");
      if (match = headers.match(/\r\n\r\n/)) {
        socket.removeListener("data", onSocketData);
        remainder = headers.substr(match.index + match[0].length);
        headers = headers.substr(0, match.index);
        if (remainder) {
          socket.unshift(Buffer.from(remainder, "binary"));
        }
        finished = true;
        match = headers.match(/^HTTP\/\d+\.\d+ (\d+)/i);
        if (!match || (match[1] || "").charAt(0) !== "2") {
          try {
            socket.destroy();
          } catch (_E) {
          }
          const err = new Error("Invalid response from proxy" + (match && ": " + match[1] || ""));
          err.code = EPROXY;
          return done(err);
        }
        socket.removeListener("error", tempSocketErr);
        socket.removeListener("timeout", timeoutErr);
        socket.setTimeout(0);
        return done(null, socket);
      }
      if (headers.length > MAX_RESPONSE_HEADER_BYTES) {
        socket.removeListener("data", onSocketData);
        const err = new Error("Proxy response headers too large");
        err.code = EPROXY;
        return tempSocketErr(err);
      }
    };
    socket.on("data", onSocketData);
  });
  socket.setTimeout(httpProxyClient.timeout || 30 * 1e3);
  socket.on("timeout", timeoutErr);
  socket.once("error", tempSocketErr);
}
var http_proxy_client_default = httpProxyClient;

// node_modules/nodemailer/dist/esm/mailer/index.js
import util2 from "node:util";

// node_modules/nodemailer/dist/esm/mailer/mail-message.js
var hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
var MailMessage = class {
  constructor(mailer, data) {
    this.mailer = mailer;
    this.data = {};
    this.message = null;
    data = data || {};
    const options = mailer.options || {};
    const defaults = mailer._defaults || {};
    copyOwnKeys(this.data, data);
    this.data.headers = this.data.headers || {};
    copyOwnKeys(this.data, defaults, (key) => hasOwn(this.data, key));
    copyOwnKeys(this.data.headers, defaults.headers, (key) => hasOwn(this.data.headers, key));
    ["disableFileAccess", "disableUrlAccess", "normalizeHeaderKey", "maxRecipients"].forEach((key) => {
      if (key in options) {
        this.data[key] = options[key];
      }
    });
    ["disableFileAccess", "disableUrlAccess"].forEach((key) => {
      if (!(key in options) && hasOwn(defaults, key)) {
        this.data[key] = this.data[key] || defaults[key];
      }
    });
  }
  resolveContent(data, key, options, callback) {
    if (!callback && typeof options === "function") {
      callback = options;
      options = false;
    }
    options = options || {};
    const policy = {
      disableFileAccess: this.data.disableFileAccess || options.disableFileAccess,
      disableUrlAccess: this.data.disableUrlAccess || options.disableUrlAccess
    };
    return resolveContent(data, key, policy, callback);
  }
  resolveAll(callback) {
    const keys = [
      [this.data, "html"],
      [this.data, "text"],
      [this.data, "watchHtml"],
      [this.data, "amp"],
      [this.data, "icalEvent"]
    ];
    if (this.data.alternatives && this.data.alternatives.length) {
      this.data.alternatives.forEach((alternative, i) => {
        keys.push([this.data.alternatives, i]);
      });
    }
    if (this.data.attachments && this.data.attachments.length) {
      this.data.attachments.forEach((attachment, i) => {
        if (!attachment.filename) {
          attachment.filename = (attachment.path || attachment.href || "").split(/[/\\]/).pop().split("?").shift() || "attachment-" + (i + 1);
          if (attachment.filename.indexOf(".") < 0) {
            attachment.filename += "." + detectExtension2(attachment.contentType);
          }
        }
        if (!attachment.contentType) {
          attachment.contentType = detectMimeType2(attachment.filename || attachment.path || attachment.href || "bin");
        }
        keys.push([this.data.attachments, i]);
      });
    }
    const mimeNode = new mime_node_default();
    const addressKeys = ["from", "to", "cc", "bcc", "sender", "replyTo"];
    addressKeys.forEach((address) => {
      let value;
      if (this.message) {
        value = [].concat(mimeNode._parseAddresses(this.message.getHeader(address === "replyTo" ? "reply-to" : address)) || []);
      } else if (this.data[address]) {
        value = [].concat(mimeNode._parseAddresses(this.data[address]) || []);
      }
      if (value && value.length) {
        this.data[address] = value;
      } else if (address in this.data) {
        this.data[address] = null;
      }
    });
    const singleKeys = ["from", "sender"];
    singleKeys.forEach((address) => {
      if (this.data[address]) {
        this.data[address] = this.data[address].shift();
      }
    });
    let pos = 0;
    const resolveNext = () => {
      if (pos >= keys.length) {
        return callback(null, this.data);
      }
      const args = keys[pos++];
      if (!args[0] || !args[0][args[1]]) {
        return resolveNext();
      }
      resolveContent(...args, { disableFileAccess: this.data.disableFileAccess, disableUrlAccess: this.data.disableUrlAccess }, (err, value) => {
        if (err) {
          return callback(err);
        }
        const node = {
          content: value
        };
        if (args[0][args[1]] && typeof args[0][args[1]] === "object" && !Buffer.isBuffer(args[0][args[1]])) {
          copyOwnKeys(node, args[0][args[1]], (key) => key in node || ["content", "path", "href", "raw"].includes(key));
        }
        args[0][args[1]] = node;
        resolveNext();
      });
    };
    setImmediate(() => resolveNext());
  }
  normalize(callback) {
    const envelope = this.message.getEnvelope();
    const messageId = this.message.messageId();
    this.resolveAll((err, data) => {
      if (err) {
        return callback(err);
      }
      data.envelope = envelope;
      data.messageId = messageId;
      ["html", "text", "watchHtml", "amp"].forEach((key) => {
        if (data[key] && data[key].content) {
          if (typeof data[key].content === "string") {
            data[key] = data[key].content;
          } else if (Buffer.isBuffer(data[key].content)) {
            data[key] = data[key].content.toString();
          }
        }
      });
      if (data.icalEvent && Buffer.isBuffer(data.icalEvent.content)) {
        data.icalEvent.content = data.icalEvent.content.toString("base64");
        data.icalEvent.encoding = "base64";
      }
      if (data.alternatives && data.alternatives.length) {
        data.alternatives.forEach((alternative) => {
          if (alternative && alternative.content && Buffer.isBuffer(alternative.content)) {
            alternative.content = alternative.content.toString("base64");
            alternative.encoding = "base64";
          }
        });
      }
      if (data.attachments && data.attachments.length) {
        data.attachments.forEach((attachment) => {
          if (attachment && attachment.content && Buffer.isBuffer(attachment.content)) {
            attachment.content = attachment.content.toString("base64");
            attachment.encoding = "base64";
          }
        });
      }
      data.normalizedHeaders = {};
      Object.keys(data.headers || {}).forEach((key) => {
        if (isProtoKey(key)) {
          return;
        }
        let value = [].concat(data.headers[key] || []).shift();
        value = value && value.value || value;
        if (value) {
          if (["references", "in-reply-to", "message-id", "content-id"].includes(key)) {
            value = this.message._encodeHeaderValue(key, value);
          }
          data.normalizedHeaders[key] = value;
        }
      });
      if (data.list && typeof data.list === "object") {
        const listHeaders = this._getListHeaders(data.list);
        listHeaders.forEach((entry) => {
          data.normalizedHeaders[entry.key] = entry.value.map((val) => val && val.value || val).join(", ");
        });
      }
      if (data.references) {
        data.normalizedHeaders.references = this.message._encodeHeaderValue("references", data.references);
      }
      if (data.inReplyTo) {
        data.normalizedHeaders["in-reply-to"] = this.message._encodeHeaderValue("in-reply-to", data.inReplyTo);
      }
      return callback(null, data);
    });
  }
  setMailerHeader() {
    if (!this.message || !this.data.xMailer) {
      return;
    }
    this.message.setHeader("X-Mailer", this.data.xMailer);
  }
  setPriorityHeaders() {
    if (!this.message || !this.data.priority) {
      return;
    }
    switch ((this.data.priority || "").toString().toLowerCase()) {
      case "high":
        this.message.setHeader("X-Priority", "1 (Highest)");
        this.message.setHeader("X-MSMail-Priority", "High");
        this.message.setHeader("Importance", "High");
        break;
      case "low":
        this.message.setHeader("X-Priority", "5 (Lowest)");
        this.message.setHeader("X-MSMail-Priority", "Low");
        this.message.setHeader("Importance", "Low");
        break;
      default:
    }
  }
  setListHeaders() {
    if (!this.message || !this.data.list || typeof this.data.list !== "object") {
      return;
    }
    this._getListHeaders(this.data.list).forEach((listHeader) => {
      listHeader.value.forEach((value) => {
        this.message.addHeader(listHeader.key, value);
      });
    });
  }
  /** @internal */
  _getListHeaders(listData) {
    return Object.keys(listData).map((key) => ({
      key: "list-" + key.toLowerCase().trim(),
      value: [].concat(listData[key] || []).map((value) => ({
        prepared: true,
        foldLines: true,
        value: [].concat(value || []).map((value2) => {
          if (typeof value2 === "string") {
            value2 = {
              url: value2
            };
          }
          if (value2 && value2.url) {
            let comment = (value2.comment || "").toString().replace(/\r?\n|\r/g, " ");
            const needsEncoding = !isPlainText(comment) || /\x7f/.test(comment);
            if (key.toLowerCase().trim() === "id") {
              comment = needsEncoding ? encodeWord(comment) : quoteString(comment);
              return (value2.comment ? comment + " " : "") + this._formatListUrl(value2.url).replace(/^<[^:]+:\/{0,2}/, "<");
            }
            comment = needsEncoding ? encodeWord(comment) : comment.replace(/[()\\]/g, "\\$&");
            return this._formatListUrl(value2.url) + (value2.comment ? " (" + comment + ")" : "");
          }
          return "";
        }).filter((value2) => value2).join(", ")
      }))
    }));
  }
  /** @internal */
  _formatListUrl(url) {
    url = url.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").replace(/[\s<]+|[\s>]+/g, "");
    if (/^(https?|mailto|ftp):/.test(url)) {
      return "<" + url + ">";
    }
    if (/^[^@]+@[^@]+$/.test(url)) {
      return "<mailto:" + url + ">";
    }
    return "<http://" + url + ">";
  }
};

// node_modules/nodemailer/dist/esm/mailer/index.js
import net6 from "node:net";
import dns2 from "node:dns";
import crypto5 from "node:crypto";
var DEFAULT_MAX_RECIPIENTS = 1e5;
var Mail = class extends EventEmitter {
  constructor(transporter, options, defaults) {
    super();
    this.options = options || {};
    this._defaults = defaults || {};
    this._defaultPlugins = {
      compile: [(...args) => this._convertDataImages(...args)],
      stream: []
    };
    this._userPlugins = {
      compile: [],
      stream: []
    };
    this.meta = /* @__PURE__ */ new Map();
    this.dkim = this.options.dkim ? new dkim_default(this.options.dkim) : false;
    this.transporter = transporter;
    this.transporter.mailer = this;
    this.logger = getLogger(this.options, {
      component: this.options.component || "mail"
    });
    this.logger.debug({
      tnx: "create"
    }, "Creating transport: %s", this.getVersionString());
    if (typeof this.transporter.on === "function") {
      this.transporter.on("log", (log) => {
        this.logger.debug({
          tnx: "transport"
        }, "%s: %s", log.type, log.message);
      });
      this.transporter.on("error", (err) => {
        this.logger.error({
          err,
          tnx: "transport"
        }, "Transport Error: %s", err.message);
        this.emit("error", err);
      });
      this.transporter.on("idle", (...args) => {
        this.emit("idle", ...args);
      });
      this.transporter.on("clear", (...args) => {
        this.emit("clear", ...args);
      });
    }
    ["close", "isIdle", "verify"].forEach((method) => {
      this[method] = (...args) => {
        if (typeof this.transporter[method] === "function") {
          if (method === "verify" && typeof this.getSocket === "function") {
            this.transporter.getSocket = this.getSocket;
            this.getSocket = false;
          }
          return this.transporter[method](...args);
        }
        this.logger.warn({
          tnx: "transport",
          methodName: method
        }, "Non existing method %s called for transport", method);
        return false;
      };
    });
    if (this.options.proxy && typeof this.options.proxy === "string") {
      this.setupProxy(this.options.proxy);
    }
  }
  use(step, plugin) {
    step = (step || "").toString();
    if (!this._userPlugins.hasOwnProperty(step)) {
      this._userPlugins[step] = [plugin];
    } else {
      this._userPlugins[step].push(plugin);
    }
    return this;
  }
  sendMail(data, callback = null) {
    let promise;
    if (!callback) {
      promise = new Promise((resolve3, reject) => {
        callback = callbackPromise(resolve3, reject);
      });
    }
    const done = callback;
    if (typeof this.getSocket === "function") {
      this.transporter.getSocket = this.getSocket;
      this.getSocket = false;
    }
    const mail = new MailMessage(this, data);
    this.logger.debug({
      tnx: "transport",
      name: this.transporter.name,
      version: this.transporter.version,
      action: "send"
    }, "Sending mail using %s/%s", this.transporter.name, this.transporter.version);
    this._processPlugins("compile", mail, (err) => {
      if (err) {
        this.logger.error({
          err,
          tnx: "plugin",
          action: "compile"
        }, "PluginCompile Error: %s", err.message);
        return done(err);
      }
      let recipientCount;
      try {
        mail.message = new mail_composer_default(mail.data).compile();
        mail.setMailerHeader();
        mail.setPriorityHeaders();
        mail.setListHeaders();
        recipientCount = mail.message.getEnvelope().to.length;
      } catch (err2) {
        this.logger.error({
          err: err2,
          tnx: "transport",
          action: "send"
        }, "Compile Error: %s", err2.message);
        return done(err2);
      }
      const maxRecipients = mail.data.maxRecipients === void 0 ? DEFAULT_MAX_RECIPIENTS : mail.data.maxRecipients;
      if (maxRecipients && recipientCount > maxRecipients) {
        const err2 = new Error(`Message has ${recipientCount} recipients, which is over the ${maxRecipients} allowed by maxRecipients`);
        err2.code = EMAXRECIPIENTS;
        this.logger.error({
          err: err2,
          tnx: "transport",
          action: "send"
        }, "Send Error: %s", err2.message);
        return done(err2);
      }
      this._processPlugins("stream", mail, (err2) => {
        if (err2) {
          this.logger.error({
            err: err2,
            tnx: "plugin",
            action: "stream"
          }, "PluginStream Error: %s", err2.message);
          return done(err2);
        }
        if (mail.data.dkim || this.dkim) {
          mail.message.processFunc((input) => {
            const dkim = mail.data.dkim ? new dkim_default(mail.data.dkim) : this.dkim;
            this.logger.debug({
              tnx: "DKIM",
              messageId: mail.message.messageId(),
              dkimDomains: dkim.keys.map((key) => key.keySelector + "." + key.domainName).join(", ")
            }, "Signing outgoing message with %s keys", dkim.keys.length);
            return dkim.sign(input, mail.data._dkim);
          });
        }
        this.transporter.send(mail, (...args) => {
          if (args[0]) {
            this.logger.error({
              err: args[0],
              tnx: "transport",
              action: "send"
            }, "Send Error: %s", args[0].message);
          }
          done(...args);
        });
      });
    });
    return promise;
  }
  getVersionString() {
    return util2.format("%s (%s; +%s; %s/%s)", name, version, homepage, this.transporter.name, this.transporter.version);
  }
  /** @internal */
  _processPlugins(step, mail, callback) {
    step = (step || "").toString();
    if (!this._userPlugins.hasOwnProperty(step)) {
      return callback();
    }
    const userPlugins = this._userPlugins[step] || [];
    const defaultPlugins = this._defaultPlugins[step] || [];
    if (userPlugins.length) {
      this.logger.debug({
        tnx: "transaction",
        pluginCount: userPlugins.length,
        step
      }, "Using %s plugins for %s", userPlugins.length, step);
    }
    if (userPlugins.length + defaultPlugins.length === 0) {
      return callback();
    }
    let pos = 0;
    let block = "default";
    const processPlugins = () => {
      let curplugins = block === "default" ? defaultPlugins : userPlugins;
      if (pos >= curplugins.length) {
        if (block === "default" && userPlugins.length) {
          block = "user";
          pos = 0;
          curplugins = userPlugins;
        } else {
          return callback();
        }
      }
      const plugin = curplugins[pos++];
      plugin(mail, (err) => {
        if (err) {
          return callback(err);
        }
        processPlugins();
      });
    };
    processPlugins();
  }
  /**
   * Sets up proxy handler for a Nodemailer object
   *
   * @param proxyUrl Proxy configuration url
   */
  setupProxy(proxyUrl) {
    const proxy = parse(proxyUrl);
    this.getSocket = (options, callback) => {
      const protocol = proxy.protocol.replace(/:$/, "").toLowerCase();
      if (this.meta.has("proxy_handler_" + protocol)) {
        return this.meta.get("proxy_handler_" + protocol)(proxy, options, callback);
      }
      switch (protocol) {
        // Connect using a HTTP CONNECT method
        case "http":
        case "https":
          http_proxy_client_default(proxy.href, options.port, options.host, this.options.tls || {}, (err2, socket) => {
            if (err2) {
              return callback(err2);
            }
            return callback(null, {
              connection: socket
            });
          });
          return;
        case "socks":
        case "socks5":
        case "socks4":
        case "socks4a": {
          if (!this.meta.has("proxy_socks_module")) {
            let err2 = new Error("Socks module not loaded");
            err2.code = EPROXY;
            return callback(err2);
          }
          const connect = (ipaddress) => {
            const proxyV2 = !!this.meta.get("proxy_socks_module").SocksClient;
            const socksClient = proxyV2 ? this.meta.get("proxy_socks_module").SocksClient : this.meta.get("proxy_socks_module");
            const proxyType = Number(proxy.protocol.replace(/\D/g, "")) || 5;
            const connectionOpts = {
              proxy: {
                ipaddress,
                port: Number(proxy.port),
                type: proxyType
              },
              [proxyV2 ? "destination" : "target"]: {
                host: options.host,
                port: options.port
              },
              command: "connect"
            };
            if (proxy.username || proxy.password) {
              const username = proxy.username || "";
              const password = proxy.password || "";
              if (proxyV2) {
                connectionOpts.proxy.userId = username;
                connectionOpts.proxy.password = password;
              } else if (proxyType === 4) {
                connectionOpts.userid = username;
              } else {
                connectionOpts.authentication = {
                  username,
                  password
                };
              }
            }
            socksClient.createConnection(connectionOpts, (err2, info) => {
              if (err2) {
                return callback(err2);
              }
              return callback(null, {
                connection: info.socket || info
              });
            });
          };
          if (net6.isIP(proxy.hostname)) {
            return connect(proxy.hostname);
          }
          return dns2.resolve(proxy.hostname, (err2, address) => {
            if (err2) {
              return callback(err2);
            }
            connect(Array.isArray(address) ? address[0] : address);
          });
        }
      }
      let err = new Error("Unknown proxy configuration");
      err.code = EPROXY;
      callback(err);
    };
  }
  /** @internal */
  _convertDataImages(mail, callback) {
    if (!this.options.attachDataUrls && !mail.data.attachDataUrls || !mail.data.html) {
      return callback();
    }
    mail.resolveContent(mail.data, "html", { disableFileAccess: mail.data.disableFileAccess, disableUrlAccess: mail.data.disableUrlAccess }, (err, html) => {
      if (err) {
        return callback(err);
      }
      let cidCounter = 0;
      html = (html || "").toString().replace(/(<img\b[^<>]{0,1024} src\s{0,20}=[\s"']{0,20})(data:([^;]+);[^"'>\s]+)/gi, (match, prefix, dataUri, mimeType) => {
        const cid = crypto5.randomBytes(10).toString("hex") + "@localhost";
        if (!mail.data.attachments) {
          mail.data.attachments = [];
        }
        if (!Array.isArray(mail.data.attachments)) {
          mail.data.attachments = [].concat(mail.data.attachments || []);
        }
        mail.data.attachments.push({
          path: dataUri,
          cid,
          filename: "image-" + ++cidCounter + "." + detectExtension(mimeType)
        });
        return prefix + "cid:" + cid;
      });
      mail.data.html = html;
      callback();
    });
  }
  set(key, value) {
    return this.meta.set(key, value);
  }
  get(key) {
    return this.meta.get(key);
  }
};
var mailer_default = Mail;

// node_modules/nodemailer/dist/esm/smtp-pool/index.js
import { EventEmitter as EventEmitter4 } from "node:events";

// node_modules/nodemailer/dist/esm/smtp-connection/index.js
import { EventEmitter as EventEmitter2 } from "node:events";
import net7 from "node:net";
import tls2 from "node:tls";
import os2 from "node:os";
import crypto6 from "node:crypto";

// node_modules/nodemailer/dist/esm/smtp-connection/data-stream.js
import { Transform as Transform8 } from "node:stream";
var INSERT_LF = Buffer.from("\n");
var INSERT_LF_DOT = Buffer.from("\n.");
var INSERT_CR = Buffer.from("\r");
var INSERT_DOT = Buffer.from(".");
var DataStream = class extends Transform8 {
  constructor(options) {
    super(options);
    this.options = options || {};
    this.inByteCount = 0;
    this.outByteCount = 0;
    this.lastByte = false;
  }
  /**
   * Escapes dots
   * @internal
   */
  _transform(chunk, encoding, done) {
    const chunks = [];
    let chunklen = 0;
    let i, len, lastPos = 0;
    let buf;
    if (!chunk || !chunk.length) {
      return done();
    }
    if (typeof chunk === "string") {
      chunk = Buffer.from(chunk);
    }
    this.inByteCount += chunk.length;
    for (i = 0, len = chunk.length; i < len; i++) {
      const byte = chunk[i];
      const prev = i ? chunk[i - 1] : this.lastByte;
      let insert = false;
      if (prev === 13 && byte !== 10) {
        insert = byte === 46 ? INSERT_LF_DOT : INSERT_LF;
      } else if (byte === 10 && prev !== 13) {
        insert = INSERT_CR;
      } else if (byte === 46 && (prev === 10 || prev === false)) {
        insert = INSERT_DOT;
      }
      if (insert) {
        if (i > lastPos) {
          buf = chunk.slice(lastPos, i);
          chunks.push(buf);
          chunklen += buf.length;
        }
        chunks.push(insert);
        chunklen += insert.length;
        lastPos = i;
      }
    }
    if (chunks.length) {
      if (lastPos < chunk.length) {
        buf = chunk.slice(lastPos);
        chunks.push(buf);
        chunklen += buf.length;
      }
      this.outByteCount += chunklen;
      this.push(Buffer.concat(chunks, chunklen));
    } else {
      this.outByteCount += chunk.length;
      this.push(chunk);
    }
    this.lastByte = chunk[chunk.length - 1];
    done();
  }
  /**
   * Finalizes the stream with a dot on a single line
   * @internal
   */
  _flush(done) {
    let buf;
    if (this.lastByte === 10) {
      buf = Buffer.from(".\r\n");
    } else if (this.lastByte === 13) {
      buf = Buffer.from("\n.\r\n");
    } else {
      buf = Buffer.from("\r\n.\r\n");
    }
    this.outByteCount += buf.length;
    this.push(buf);
    done();
  }
};

// node_modules/nodemailer/dist/esm/smtp-connection/index.js
import { PassThrough as PassThrough4 } from "node:stream";
var CONNECTION_TIMEOUT = 2 * 60 * 1e3;
var SOCKET_TIMEOUT = 10 * 60 * 1e3;
var GREETING_TIMEOUT = 30 * 1e3;
var DNS_TIMEOUT = 30 * 1e3;
var TEARDOWN_NOOP = () => {
};
var MAX_RESPONSE_SIZE = 1024 * 1024;
function decodeServerResponse(str) {
  if (!str) {
    return str;
  }
  const utf8 = Buffer.from(str, "binary").toString("utf8");
  return utf8.includes("\uFFFD") ? str : utf8;
}
function isPartialResponse(str) {
  return isPartialLine(str.slice(str.lastIndexOf("\n") + 1));
}
function isPartialLine(line) {
  return /^\d+-/.test(line);
}
var SMTPConnection = class extends EventEmitter2 {
  constructor(options) {
    super(options);
    this.id = crypto6.randomBytes(8).toString("base64").replace(/\W/g, "");
    this.stage = "init";
    this.options = options || {};
    if (this.options.requireTLS && (this.options.ignoreTLS || this.options.opportunisticTLS)) {
      this.options = Object.assign({}, this.options, { ignoreTLS: false, opportunisticTLS: false });
    }
    this.secureConnection = !!this.options.secure;
    this.alreadySecured = !!this.options.secured;
    this.port = Number(this.options.port) || (this.secureConnection ? 465 : 587);
    this.host = this.options.host || "localhost";
    this.servername = this.options.servername ? this.options.servername : !net7.isIP(this.host) ? this.host : false;
    this.allowInternalNetworkInterfaces = this.options.allowInternalNetworkInterfaces || false;
    if (typeof this.options.secure === "undefined" && this.port === 465) {
      this.secureConnection = true;
    }
    this.name = (this.options.name || this._getHostname()).toString().replace(/[\r\n]+/g, "");
    this.logger = getLogger(this.options, {
      component: this.options.component || "smtp-connection",
      sid: this.id
    });
    this.customAuth = /* @__PURE__ */ new Map();
    for (const key of Object.keys(this.options.customAuth || {})) {
      const mapKey = (key || "").toString().trim().toUpperCase();
      if (mapKey) {
        this.customAuth.set(mapKey, this.options.customAuth[key]);
      }
    }
    this.version = version;
    this.authenticated = false;
    this.destroyed = false;
    this.secure = !!this.secureConnection;
    this._remainder = "";
    this._responseQueue = [];
    this._responsePartial = false;
    this.lastServerResponse = false;
    this._socket = false;
    this._supportedAuth = [];
    this.allowsAuth = false;
    this._envelope = false;
    this._supportedExtensions = [];
    this._maxAllowedSize = 0;
    this._responseActions = [];
    this._recipientQueue = [];
    this._greetingTimeout = false;
    this._connectionTimeout = false;
    this._destroyed = false;
    this._closing = false;
    this._currentDataStream = false;
    this._pendingSend = false;
    this._connectCallback = false;
    this._onSocketData = (chunk) => this._onData(chunk);
    this._onSocketError = (error2) => this._onError(error2, "ESOCKET", false, "CONN");
    this._onSocketClose = () => this._onClose();
    this._onSocketEnd = () => this._onEnd();
    this._onSocketTimeout = () => this._onTimeout();
    this._onConnectionSocketError = (err) => this._onConnectionError(err, "ESOCKET");
    this._connectionAttemptId = 0;
  }
  /**
   * Creates a connection to a SMTP server and sets up connection
   * listener
   */
  connect(connectCallback) {
    if (typeof connectCallback === "function") {
      this._connectCallback = connectCallback;
      this.once("connect", () => {
        this._connectCallback = false;
        this.logger.debug({
          tnx: "smtp"
        }, "SMTP handshake finished");
        connectCallback();
      });
      const isDestroyedMessage = this._isDestroyedMessage("connect");
      if (isDestroyedMessage) {
        return connectCallback(this._formatError(isDestroyedMessage, "ECONNECTION", false, "CONN"));
      }
    }
    let opts = {
      port: this.port,
      host: this.host,
      allowInternalNetworkInterfaces: this.allowInternalNetworkInterfaces,
      timeout: this.options.dnsTimeout || DNS_TIMEOUT
    };
    if (this.options.localAddress) {
      opts.localAddress = this.options.localAddress;
    }
    if (this.options.connection) {
      this._socket = this.options.connection;
      this._setupConnectionHandlers();
      if (this.secureConnection && !this.alreadySecured) {
        setImmediate(() => this._upgradeConnection((err) => {
          if (err) {
            this._onError(new Error("Error initiating TLS - " + (err.message || err)), "ETLS", false, "CONN");
            return;
          }
          this._onConnect();
        }));
      } else {
        setImmediate(() => this._onConnect());
      }
      return;
    } else if (this.options.socket) {
      this._socket = this.options.socket;
      return this._resolveAndConnect(opts, (_resolved) => {
        try {
          this._socket.connect(this.port, this.host, () => {
            this._socket.setKeepAlive(true);
            if (this.secureConnection && !this.alreadySecured) {
              return this._upgradeConnection((err) => {
                if (err) {
                  this._onError(new Error("Error initiating TLS - " + (err.message || err)), "ETLS", false, "CONN");
                  return;
                }
                this._onConnect();
              });
            }
            this._onConnect();
          });
          this._setupConnectionHandlers();
        } catch (E) {
          setImmediate(() => this._onError(E, "ECONNECTION", false, "CONN"));
          return;
        }
      });
    } else {
      if (this.secureConnection) {
        Object.assign(opts, this.options.tls || {});
        if (this.servername && !opts.servername) {
          opts.servername = this.servername;
        }
      }
      return this._resolveAndConnect(opts, (resolved) => {
        this._fallbackAddresses = (resolved._addresses || []).filter((addr) => addr !== opts.host);
        this._connectOpts = Object.assign({}, opts);
        this._connectToHost(opts, this.secureConnection);
      });
    }
  }
  /**
   * Resolves the hostname and applies resolved values to opts,
   * then calls the provided callback with the resolved data
   *
   * @param opts Connection options (modified in place)
   * @param callback Called with resolved data on success
   * @internal
   */
  _resolveAndConnect(opts, callback) {
    return resolveHostname(opts, (err, resolved) => {
      if (err) {
        return setImmediate(() => this._onError(err, "EDNS", false, "CONN"));
      }
      this.logger.debug({
        tnx: "dns",
        source: opts.host,
        resolved: resolved.host,
        cached: !!resolved.cached
      }, "Resolved %s as %s [cache %s]", opts.host, resolved.host, resolved.cached ? "hit" : "miss");
      for (const key of Object.keys(resolved)) {
        if (key.charAt(0) !== "_" && resolved[key]) {
          opts[key] = resolved[key];
        }
      }
      callback(resolved);
    });
  }
  /**
   * Attempts to connect to the specified host address
   *
   * @param opts Connection options
   * @param secure Whether to use TLS
   * @internal
   */
  _connectToHost(opts, secure) {
    if (this._destroyed || this._closing) {
      return;
    }
    this._connectionAttemptId++;
    const currentAttemptId = this._connectionAttemptId;
    const connectFn = secure ? tls2.connect : net7.connect;
    try {
      this._socket = connectFn(opts, () => {
        if (this._connectionAttemptId !== currentAttemptId) {
          return;
        }
        this._socket.setKeepAlive(true);
        this._onConnect();
      });
      this._setupConnectionHandlers();
    } catch (E) {
      setImmediate(() => this._onError(E, "ECONNECTION", false, "CONN"));
      return;
    }
  }
  /**
   * Sets up connection timeout and error handlers
   * @internal
   */
  _setupConnectionHandlers() {
    this._connectionTimeout = setTimeout(() => {
      this._onConnectionError("Connection timeout", "ETIMEDOUT");
    }, this.options.connectionTimeout || CONNECTION_TIMEOUT);
    this._socket.on("error", this._onConnectionSocketError);
  }
  /**
   * Handles connection errors with fallback to alternative addresses
   *
   * @param err Error object or message
   * @param code Error code
   * @internal
   */
  _onConnectionError(err, code) {
    clearTimeout(this._connectionTimeout);
    const canFallback = this._fallbackAddresses && this._fallbackAddresses.length && this.stage === "init" && !this._destroyed;
    if (!canFallback) {
      this._onError(err, code, false, "CONN");
      return;
    }
    const nextHost = this._fallbackAddresses.shift();
    this.logger.info({
      tnx: "network",
      failedHost: this._connectOpts.host,
      nextHost,
      error: err.message || err
    }, "Connection to %s failed, trying %s", this._connectOpts.host, nextHost);
    if (this._socket) {
      try {
        this._socket.removeListener("error", this._onConnectionSocketError);
        this._socket.on("error", TEARDOWN_NOOP);
        this._socket.destroy();
      } catch (_E) {
      }
      this._socket = null;
    }
    this._connectOpts.host = nextHost;
    this._connectToHost(this._connectOpts, this.secureConnection);
  }
  /**
   * Sends QUIT
   */
  quit() {
    this._sendCommand("QUIT");
    this._responseActions.push(this.close);
  }
  /**
   * Closes the connection to the server
   */
  close() {
    clearTimeout(this._connectionTimeout);
    clearTimeout(this._greetingTimeout);
    this._responseActions = [];
    if (this._closing) {
      return;
    }
    this._closing = true;
    const closeMethod = this.stage === "init" ? "destroy" : "end";
    this.logger.debug({
      tnx: "smtp"
    }, 'Closing connection to the server using "%s"', closeMethod);
    const socket = this._socket && this._socket.socket || this._socket;
    if (this._currentDataStream) {
      try {
        this._currentDataStream.unpipe(this._socket);
      } catch (_E) {
      }
      this._currentDataStream = false;
    }
    if (this._pendingSend) {
      const { stream, onStreamError } = this._pendingSend;
      if (stream) {
        stream.removeListener("error", onStreamError);
        stream.on("error", TEARDOWN_NOOP);
      }
      this._pendingSend = false;
    }
    if (socket && !socket.destroyed) {
      try {
        socket.setTimeout(0);
        socket.removeListener("data", this._onSocketData);
        socket.removeListener("timeout", this._onSocketTimeout);
        socket.removeListener("close", this._onSocketClose);
        socket.removeListener("end", this._onSocketEnd);
        socket.removeListener("error", this._onSocketError);
        socket.removeListener("error", this._onConnectionSocketError);
        socket.on("error", TEARDOWN_NOOP);
        socket[closeMethod]();
      } catch (_E) {
      }
    }
    this._destroy();
  }
  /**
   * Authenticate user
   */
  login(authData, callback) {
    const isDestroyedMessage = this._isDestroyedMessage("login");
    if (isDestroyedMessage) {
      return callback(this._formatError(isDestroyedMessage, "ECONNECTION", false, "API"));
    }
    this._auth = authData || {};
    this._authMethod = (this._auth.method || "").toString().trim().toUpperCase() || false;
    const canUseXOAuth2 = !!this._auth.oauth2 || this.customAuth.has("XOAUTH2");
    if (!this._authMethod && this._auth.oauth2 && !this._auth.credentials) {
      this._authMethod = "XOAUTH2";
    } else if (!this._authMethod || this._authMethod === "XOAUTH2" && !this._auth.oauth2) {
      const supported = this._supportedAuth.find((method) => method !== "XOAUTH2" || canUseXOAuth2);
      this._authMethod = (supported || "PLAIN").toUpperCase().trim();
    }
    if ((this._authMethod !== "XOAUTH2" || this.customAuth.has("XOAUTH2")) && (!this._auth.credentials || !this._auth.credentials.user || !this._auth.credentials.pass)) {
      if (this._auth.user && this._auth.pass || this.customAuth.has(this._authMethod)) {
        this._auth.credentials = {
          user: this._auth.user,
          pass: this._auth.pass,
          options: this._auth.options
        };
      } else {
        return callback(this._formatError('Missing credentials for "' + this._authMethod + '"', "EAUTH", false, "API"));
      }
    }
    if (this.customAuth.has(this._authMethod)) {
      const handler2 = this.customAuth.get(this._authMethod);
      let lastResponse;
      let returned = false;
      const resolve3 = () => {
        if (returned) {
          return;
        }
        returned = true;
        this.logger.info({
          tnx: "smtp",
          username: this._auth.user,
          action: "authenticated",
          method: this._authMethod
        }, "User %s authenticated", JSON.stringify(this._auth.user));
        this.authenticated = true;
        callback(null, true);
      };
      const reject = (err) => {
        if (returned) {
          return;
        }
        returned = true;
        callback(this._formatError(err, "EAUTH", lastResponse, "AUTH " + this._authMethod));
      };
      const sendCommand = (cmd, done) => {
        let promise;
        if (!done) {
          promise = new Promise((resolve4, reject2) => {
            done = callbackPromise(resolve4, reject2);
          });
        }
        this._responseActions.push((str) => {
          lastResponse = str;
          let codes = str.match(/^(\d+)(?:\s(\d+\.\d+\.\d+))?\s/);
          let data = {
            command: cmd,
            response: str
          };
          if (codes) {
            data.status = Number(codes[1]) || 0;
            if (codes[2]) {
              data.code = codes[2];
            }
            data.text = str.substr(codes[0].length);
          } else {
            data.text = str;
            data.status = 0;
          }
          done(null, data);
        });
        setImmediate(() => this._sendCommand(cmd));
        return promise;
      };
      const handlerResponse = handler2({
        auth: this._auth,
        method: this._authMethod,
        extensions: [].concat(this._supportedExtensions),
        authMethods: [].concat(this._supportedAuth),
        maxAllowedSize: this._maxAllowedSize || false,
        sendCommand,
        resolve: resolve3,
        reject
      });
      if (handlerResponse && typeof handlerResponse.catch === "function") {
        handlerResponse.then(resolve3).catch(reject);
      }
      return;
    }
    switch (this._authMethod) {
      case "XOAUTH2":
        this._handleXOauth2Token(false, callback);
        return;
      case "LOGIN":
        this._responseActions.push((str) => {
          this._actionAUTH_LOGIN_USER(str, callback);
        });
        this._sendCommand("AUTH LOGIN");
        return;
      case "PLAIN":
        this._responseActions.push((str) => {
          this._actionAUTHComplete(str, callback);
        });
        this._sendCommand(
          "AUTH PLAIN " + Buffer.from(
            //this._auth.user+'\u0000'+
            "\0" + // skip authorization identity as it causes problems with some servers
            this._auth.credentials.user + "\0" + this._auth.credentials.pass,
            "utf-8"
          ).toString("base64"),
          // log entry without passwords
          "AUTH PLAIN " + Buffer.from(
            //this._auth.user+'\u0000'+
            "\0" + // skip authorization identity as it causes problems with some servers
            this._auth.credentials.user + "\0/* secret */",
            "utf-8"
          ).toString("base64")
        );
        return;
      case "CRAM-MD5":
        this._responseActions.push((str) => {
          this._actionAUTH_CRAM_MD5(str, callback);
        });
        this._sendCommand("AUTH CRAM-MD5");
        return;
    }
    return callback(this._formatError('Unknown authentication method "' + this._authMethod + '"', "EAUTH", false, "API"));
  }
  /**
   * Sends a message
   *
   * @param envelope Envelope object, {from: addr, to: [addr]}
   * @param message String, Buffer or a Stream
   * @param callback Callback to return once sending is completed
   */
  send(envelope, message, done) {
    let returned = false;
    const callback = (err, info) => {
      if (returned) {
        return;
      }
      returned = true;
      if (this._pendingSend && this._pendingSend.callback === callback) {
        this._pendingSend = false;
      }
      done(err, info);
    };
    if (!message) {
      return callback(this._formatError("Empty message", "EMESSAGE", false, "API"));
    }
    const isDestroyedMessage = this._isDestroyedMessage("send message");
    if (isDestroyedMessage) {
      return callback(this._formatError(isDestroyedMessage, "ECONNECTION", false, "API"));
    }
    if (this._maxAllowedSize && envelope.size > this._maxAllowedSize) {
      setImmediate(() => {
        callback(this._formatError("Message size larger than allowed " + this._maxAllowedSize, "EMESSAGE", false, "MAIL FROM"));
      });
      return;
    }
    const pendingSend = {
      callback,
      stream: false,
      onStreamError: (err) => callback(this._formatError(err, "ESTREAM", false, "API"))
    };
    if (typeof message.on === "function") {
      pendingSend.stream = message;
      pendingSend.stream.on("error", pendingSend.onStreamError);
    }
    this._pendingSend = pendingSend;
    const startTime = Date.now();
    this._setEnvelope(envelope, (err, info) => {
      if (err) {
        const stream2 = new PassThrough4();
        if (typeof message.pipe === "function") {
          message.pipe(stream2);
        } else {
          stream2.write(message);
          stream2.end();
        }
        return callback(err);
      }
      const envelopeTime = Date.now();
      const stream = this._createSendStream((err2, str) => {
        if (err2) {
          return callback(err2);
        }
        const result = info;
        result.envelopeTime = envelopeTime - startTime;
        result.messageTime = Date.now() - envelopeTime;
        result.messageSize = stream.outByteCount;
        result.response = str;
        return callback(null, result);
      });
      if (typeof message.pipe === "function") {
        message.pipe(stream);
      } else {
        stream.write(message);
        stream.end();
      }
    });
  }
  /**
   * Resets connection state
   *
   * @param callback Callback to return once connection is reset
   */
  reset(callback) {
    const isDestroyedMessage = this._isDestroyedMessage("reset");
    if (isDestroyedMessage) {
      return callback(this._formatError(isDestroyedMessage, "ECONNECTION", false, "API"));
    }
    this._sendCommand("RSET");
    this._responseActions.push((str) => {
      if (str.charAt(0) !== "2") {
        return callback(this._formatError("Could not reset session state. response=" + str, "EPROTOCOL", str, "RSET"));
      }
      this._envelope = false;
      return callback(null, true);
    });
  }
  /**
   * Connection listener that is run when the connection to
   * the server is opened
   *
   * @event
   * @internal
   */
  _onConnect() {
    const socket = this._socket;
    clearTimeout(this._connectionTimeout);
    this.logger.info({
      tnx: "network",
      localAddress: socket.localAddress,
      localPort: socket.localPort,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort
    }, "%s established to %s:%s", this.secure ? "Secure connection" : "Connection", socket.remoteAddress, socket.remotePort);
    if (this._destroyed) {
      this.close();
      return;
    }
    this.stage = "connected";
    socket.removeListener("data", this._onSocketData);
    socket.removeListener("timeout", this._onSocketTimeout);
    socket.removeListener("close", this._onSocketClose);
    socket.removeListener("end", this._onSocketEnd);
    socket.removeListener("error", this._onConnectionSocketError);
    socket.removeListener("error", this._onSocketError);
    socket.on("error", this._onSocketError);
    socket.on("data", this._onSocketData);
    socket.once("close", this._onSocketClose);
    socket.once("end", this._onSocketEnd);
    socket.setTimeout(this.options.socketTimeout || SOCKET_TIMEOUT);
    socket.on("timeout", this._onSocketTimeout);
    this._greetingTimeout = setTimeout(() => {
      if (this._socket && !this._destroyed && this._responseActions[0] === this._actionGreeting) {
        this._onError("Greeting never received", "ETIMEDOUT", false, "CONN");
      }
    }, this.options.greetingTimeout || GREETING_TIMEOUT);
    this._responseActions.push(this._actionGreeting);
    socket.resume();
  }
  /**
   * 'data' listener for data coming from the server
   *
   * @event
   * @param chunk Data chunk coming from the server
   * @internal
   */
  _onData(chunk) {
    if (this._destroyed || !chunk || !chunk.length) {
      return;
    }
    const maxResponseSize = this.options.maxResponseSize || MAX_RESPONSE_SIZE;
    const data = chunk.toString("binary");
    if (!data.includes("\n")) {
      this._remainder += data;
      if (this._remainder.length > maxResponseSize) {
        return this._onResponseTooLarge();
      }
      return;
    }
    const lines = (this._remainder + data).split(/\r?\n/);
    this._remainder = lines.pop();
    for (let i = 0, len = lines.length; i < len; i++) {
      if (this._responsePartial) {
        this._responseQueue[this._responseQueue.length - 1] += "\n" + lines[i];
      } else {
        this._responseQueue.push(lines[i]);
      }
      this._responsePartial = isPartialLine(lines[i]);
      if (this._responsePartial && this._responseQueue[this._responseQueue.length - 1].length > maxResponseSize) {
        return this._onResponseTooLarge();
      }
    }
    if (this._remainder.length > maxResponseSize) {
      return this._onResponseTooLarge();
    }
    if (this._responsePartial) {
      return;
    }
    this._processResponse();
  }
  /**
   * Drops a connection whose peer keeps extending a reply it never completes, releasing
   * whatever was buffered for that reply
   * @internal
   */
  _onResponseTooLarge() {
    this._remainder = "";
    this._responseQueue = [];
    this._responsePartial = false;
    this._onError(new Error("Server response exceeds maximum allowed size"), "EPROTOCOL", false, "CONN");
  }
  /**
   * 'error' listener for the socket
   *
   * @event
   * @param err Error object
   * @param type Error name
   * @internal
   */
  _onError(err, type, data, command) {
    clearTimeout(this._connectionTimeout);
    clearTimeout(this._greetingTimeout);
    if (this._destroyed) {
      return;
    }
    err = this._formatError(err, type, data, command);
    const transientCodes = ["ETIMEDOUT", "ESOCKET", "ECONNECTION"];
    if (transientCodes.includes(err.code)) {
      this.logger.warn(data, err.message);
    } else {
      this.logger.error(data, err.message);
    }
    const pendingSend = this._pendingSend;
    this.emit("error", err);
    this.close();
    if (pendingSend) {
      pendingSend.callback(err);
    }
  }
  /** @internal */
  _formatError(message, type, response, command) {
    let err;
    if (/Error\]$/i.test(Object.prototype.toString.call(message))) {
      err = message;
    } else {
      err = new Error(message);
    }
    if (type && type !== "Error") {
      err.code = type;
    }
    if (response) {
      err.response = response;
      err.message += ": " + response;
    }
    const responseCode = typeof response === "string" && Number((response.match(/^\d+/) || [])[0]) || false;
    if (responseCode) {
      err.responseCode = responseCode;
    }
    if (command) {
      err.command = command;
    }
    return err;
  }
  /**
   * 'close' listener for the socket
   *
   * @event
   * @internal
   */
  _onClose() {
    let serverResponse = false;
    if (this._remainder && this._remainder.trim()) {
      this.lastServerResponse = serverResponse = decodeServerResponse(this._remainder.trim());
      if (this.options.debug || this.options.transactionLog) {
        this.logger.debug({
          tnx: "server"
        }, serverResponse);
      }
    }
    this.logger.info({
      tnx: "network"
    }, "Connection closed");
    const failureResponse = typeof serverResponse === "string" && /^[45]\d{2}[ -]/.test(serverResponse) ? serverResponse : false;
    if (this.upgrading && !this._destroyed) {
      return this._onError(new Error("Connection closed unexpectedly"), "ETLS", failureResponse, "CONN");
    }
    if (!failureResponse && this._responseActions[0] === this._actionGreeting && this._connectCallback && !this._destroyed) {
      const connectCallback = this._connectCallback;
      this._connectCallback = false;
      const err = this._formatError(new Error("Connection closed unexpectedly"), "ECONNECTION", false, "CONN");
      this.logger.warn({ tnx: "network" }, err.message);
      connectCallback(err);
      this.close();
      return;
    }
    if (failureResponse || this._responseActions[0] !== this.close && !this._destroyed) {
      return this._onError(new Error("Connection closed unexpectedly"), "ECONNECTION", failureResponse, "CONN");
    }
    this._destroy();
  }
  /**
   * 'end' listener for the socket
   *
   * @event
   * @internal
   */
  _onEnd() {
    if (this._socket && !this._socket.destroyed) {
      this._socket.end();
    }
  }
  /**
   * 'timeout' listener for the socket
   *
   * @event
   * @internal
   */
  _onTimeout() {
    return this._onError(new Error("Timeout"), "ETIMEDOUT", false, "CONN");
  }
  /**
   * Destroys the client, emits 'end'
   * @internal
   */
  _destroy() {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.destroyed = true;
    clearTimeout(this._connectionTimeout);
    clearTimeout(this._greetingTimeout);
    this._connectionTimeout = false;
    this._greetingTimeout = false;
    this.emit("end");
  }
  /**
   * Upgrades the connection to TLS
   *
   * @param callback Callback function to run when the connection
   *        has been secured
   * @internal
   */
  _upgradeConnection(callback) {
    this._remainder = "";
    this._responseQueue = [];
    this._responsePartial = false;
    const socketPlain = this._socket;
    socketPlain.removeListener("data", this._onSocketData);
    socketPlain.removeListener("timeout", this._onSocketTimeout);
    const opts = Object.assign({
      socket: socketPlain,
      host: this.host
    }, this.options.tls || {});
    if (this.servername && !opts.servername) {
      opts.servername = this.servername;
    }
    const removePlainSocketListeners = () => {
      socketPlain.removeListener("close", this._onSocketClose);
      socketPlain.removeListener("end", this._onSocketEnd);
      socketPlain.removeListener("error", this._onSocketError);
      socketPlain.removeListener("error", this._onConnectionSocketError);
    };
    this.upgrading = true;
    try {
      this._socket = tls2.connect(opts, () => {
        this.secure = true;
        this.upgrading = false;
        this._socket.on("data", this._onSocketData);
        removePlainSocketListeners();
        return callback(null, true);
      });
    } catch (err) {
      removePlainSocketListeners();
      return callback(err);
    }
    this._socket.on("error", this._onSocketError);
    this._socket.once("close", this._onSocketClose);
    this._socket.once("end", this._onSocketEnd);
    this._socket.setTimeout(this.options.socketTimeout || SOCKET_TIMEOUT);
    this._socket.on("timeout", this._onSocketTimeout);
    socketPlain.resume();
  }
  /**
   * Processes queued responses from the server
   * @internal
   */
  _processResponse() {
    if (!this._responseQueue.length) {
      return false;
    }
    const raw = (this._responseQueue.shift() || "").toString();
    if (!raw.trim()) {
      setImmediate(() => this._processResponse());
      return;
    }
    if (isPartialResponse(raw)) {
      this._responseQueue.unshift(raw);
      return;
    }
    const str = this.lastServerResponse = decodeServerResponse(raw);
    if (this.options.debug || this.options.transactionLog) {
      this.logger.debug({
        tnx: "server"
      }, str.replace(/\r?\n$/, ""));
    }
    const action = this._responseActions.shift();
    if (typeof action === "function") {
      action.call(this, str);
      setImmediate(() => this._processResponse());
    } else {
      return this._onError(new Error("Unexpected Response"), "EPROTOCOL", str, "CONN");
    }
  }
  /**
   * Send a command to the server, append \r\n
   *
   * @param str String to be sent to the server
   * @param logStr Optional string to be used for logging instead of the actual string
   * @internal
   */
  _sendCommand(str, logStr) {
    if (this._destroyed) {
      return;
    }
    const socket = this._socket;
    if (socket.destroyed) {
      return this.close();
    }
    if (this.options.debug || this.options.transactionLog) {
      this.logger.debug({
        tnx: "client"
      }, (logStr || str || "").toString().replace(/\r?\n$/, ""));
    }
    socket.write(Buffer.from(str + "\r\n", "utf-8"));
  }
  /**
   * Initiates a new message by submitting envelope data, starting with
   * MAIL FROM: command
   *
   * @param envelope Envelope object in the form of
   *        {from:'...', to:['...']}
   *        or
   *        {from:{address:'...',name:'...'}, to:[address:'...',name:'...']}
   * @internal
   */
  _setEnvelope(envelope, callback) {
    const args = [];
    let useSmtpUtf8 = false;
    this._envelope = envelope || {};
    this._envelope.from = (this._envelope.from && this._envelope.from.address || this._envelope.from || "").toString().trim();
    this._envelope.to = [].concat(this._envelope.to || []).map((to) => (to && to.address || to || "").toString().trim());
    if (!this._envelope.to.length) {
      return callback(this._formatError("No recipients defined", "EENVELOPE", false, "API"));
    }
    if (this._envelope.from && /[\r\n<>]/.test(this._envelope.from)) {
      return callback(this._formatError("Invalid sender " + JSON.stringify(this._envelope.from), "EENVELOPE", false, "API"));
    }
    if (/[\x80-\uFFFF]/.test(this._envelope.from)) {
      useSmtpUtf8 = true;
    }
    for (let i = 0, len = this._envelope.to.length; i < len; i++) {
      if (!this._envelope.to[i] || /[\r\n<>]/.test(this._envelope.to[i])) {
        return callback(this._formatError("Invalid recipient " + JSON.stringify(this._envelope.to[i]), "EENVELOPE", false, "API"));
      }
      if (/[\x80-\uFFFF]/.test(this._envelope.to[i])) {
        useSmtpUtf8 = true;
      }
    }
    this._envelope.rcptQueue = [].concat(this._envelope.to || []);
    this._envelope.rejected = [];
    this._envelope.rejectedErrors = [];
    this._envelope.accepted = [];
    if (this._envelope.dsn) {
      try {
        this._envelope.dsn = this._setDsnEnvelope(this._envelope.dsn);
      } catch (err) {
        return callback(this._formatError("Invalid DSN " + err.message, "EENVELOPE", false, "API"));
      }
    }
    if (this._envelope.requireTLSExtensionEnabled) {
      if (!this.secure) {
        return callback(this._formatError("REQUIRETLS can only be used over TLS connections (RFC 8689)", "EREQUIRETLS", false, "MAIL FROM"));
      }
      if (!this._supportedExtensions.includes("REQUIRETLS")) {
        return callback(this._formatError("Server does not support REQUIRETLS extension (RFC 8689)", "EREQUIRETLS", false, "MAIL FROM"));
      }
    }
    this._responseActions.push((str) => {
      this._actionMAIL(str, callback);
    });
    if (useSmtpUtf8 && this._supportedExtensions.includes("SMTPUTF8")) {
      args.push("SMTPUTF8");
      this._usingSmtpUtf8 = true;
    }
    if (this._envelope.use8BitMime && this._supportedExtensions.includes("8BITMIME")) {
      args.push("BODY=8BITMIME");
      this._using8BitMime = true;
    }
    if (this._envelope.size && this._supportedExtensions.includes("SIZE")) {
      const sizeValue = Number(this._envelope.size) || 0;
      if (sizeValue > 0) {
        args.push("SIZE=" + sizeValue);
      }
    }
    if (this._envelope.dsn && this._supportedExtensions.includes("DSN")) {
      if (this._envelope.dsn.ret) {
        args.push("RET=" + encodeXText(this._envelope.dsn.ret));
      }
      if (this._envelope.dsn.envid) {
        args.push("ENVID=" + encodeXText(this._envelope.dsn.envid));
      }
    }
    if (this._envelope.requireTLSExtensionEnabled) {
      args.push("REQUIRETLS");
    }
    this._sendCommand("MAIL FROM:<" + this._envelope.from + ">" + (args.length ? " " + args.join(" ") : ""));
  }
  /** @internal */
  _setDsnEnvelope(params) {
    let ret = (params.ret || params.return || "").toString().toUpperCase() || null;
    if (ret) {
      switch (ret) {
        case "HDRS":
        case "HEADERS":
          ret = "HDRS";
          break;
        case "FULL":
        case "BODY":
          ret = "FULL";
          break;
      }
    }
    if (ret && !["FULL", "HDRS"].includes(ret)) {
      throw new Error("ret: " + JSON.stringify(ret));
    }
    const envid = (params.envid || params.id || "").toString() || null;
    let notify = params.notify || null;
    if (notify) {
      if (typeof notify === "string") {
        notify = notify.split(",");
      }
      notify = notify.map((n) => n.trim().toUpperCase());
      const validNotify = ["NEVER", "SUCCESS", "FAILURE", "DELAY"];
      const invalidNotify = notify.filter((n) => !validNotify.includes(n));
      if (invalidNotify.length || notify.length > 1 && notify.includes("NEVER")) {
        throw new Error("notify: " + JSON.stringify(notify.join(",")));
      }
      notify = notify.join(",");
    }
    let orcpt = (params.recipient || params.orcpt || "").toString() || null;
    if (orcpt && orcpt.indexOf(";") < 0) {
      orcpt = "rfc822;" + orcpt;
    }
    return {
      ret,
      envid,
      notify,
      orcpt
    };
  }
  /** @internal */
  _getDsnRcptToArgs() {
    const envelope = this._envelope;
    const args = [];
    if (envelope.dsn && this._supportedExtensions.includes("DSN")) {
      if (envelope.dsn.notify) {
        args.push("NOTIFY=" + encodeXText(envelope.dsn.notify));
      }
      if (envelope.dsn.orcpt) {
        args.push("ORCPT=" + encodeXText(envelope.dsn.orcpt));
      }
    }
    return args.length ? " " + args.join(" ") : "";
  }
  /** @internal */
  _createSendStream(callback) {
    const envelope = this._envelope;
    const dataStream = new DataStream();
    if (this.options.lmtp) {
      envelope.accepted.forEach((recipient, i) => {
        const final = i === envelope.accepted.length - 1;
        this._responseActions.push((str) => {
          this._actionLMTPStream(recipient, final, str, callback);
        });
      });
    } else {
      this._responseActions.push((str) => {
        this._actionSMTPStream(str, callback);
      });
    }
    this._currentDataStream = dataStream;
    dataStream.pipe(this._socket, {
      end: false
    });
    if (this.options.debug) {
      const logStream = new PassThrough4();
      logStream.on("readable", () => {
        let chunk;
        while (chunk = logStream.read()) {
          this.logger.debug({
            tnx: "message"
          }, chunk.toString("binary").replace(/\r?\n$/, ""));
        }
      });
      dataStream.pipe(logStream);
    }
    dataStream.once("end", () => {
      if (this._currentDataStream === dataStream) {
        this._currentDataStream = false;
      }
      this.logger.info({
        tnx: "message",
        inByteCount: dataStream.inByteCount,
        outByteCount: dataStream.outByteCount
      }, "<%s bytes encoded mime message (source size %s bytes)>", dataStream.outByteCount, dataStream.inByteCount);
    });
    return dataStream;
  }
  /** ACTIONS **/
  /**
   * Will be run after the connection is created and the server sends
   * a greeting. If the incoming message starts with 220 initiate
   * SMTP session by sending EHLO command
   *
   * @param str Message from the server
   * @internal
   */
  _actionGreeting(str) {
    clearTimeout(this._greetingTimeout);
    if (str.substr(0, 3) !== "220") {
      this._onError(new Error("Invalid greeting. response=" + str), "EPROTOCOL", str, "CONN");
      return;
    }
    if (this.options.lmtp) {
      this._responseActions.push(this._actionLHLO);
      this._sendCommand("LHLO " + this.name);
    } else {
      this._responseActions.push(this._actionEHLO);
      this._sendCommand("EHLO " + this.name);
    }
  }
  /**
   * Handles server response for LHLO command. If it yielded in
   * error, emit 'error', otherwise treat this as an EHLO response
   *
   * @param str Message from the server
   * @internal
   */
  _actionLHLO(str) {
    if (str.charAt(0) !== "2") {
      this._onError(new Error("Invalid LHLO. response=" + str), "EPROTOCOL", str, "LHLO");
      return;
    }
    this._actionEHLO(str);
  }
  /**
   * Handles server response for EHLO command. If it yielded in
   * error, try HELO instead, otherwise initiate TLS negotiation
   * if STARTTLS is supported by the server or move into the
   * authentication phase.
   *
   * @param str Message from the server
   * @internal
   */
  _actionEHLO(str) {
    let match;
    if (str.substr(0, 3) === "421") {
      this._onError(new Error("Server terminates connection. response=" + str), "ECONNECTION", str, "EHLO");
      return;
    }
    if (str.charAt(0) !== "2") {
      if (this.options.requireTLS) {
        this._onError(new Error("EHLO failed but HELO does not support required STARTTLS. response=" + str), "ECONNECTION", str, "EHLO");
        return;
      }
      this._responseActions.push(this._actionHELO);
      this._sendCommand("HELO " + this.name);
      return;
    }
    this._ehloLines = str.split(/\r?\n/).map((line) => line.replace(/^\d+[ -]/, "").trim()).filter((line) => line).slice(1);
    if (!this.secure && !this.options.ignoreTLS && (/[ -]STARTTLS\b/im.test(str) || this.options.requireTLS)) {
      this._sendCommand("STARTTLS");
      this._responseActions.push(this._actionSTARTTLS);
      return;
    }
    if (/[ -]SMTPUTF8\b/im.test(str)) {
      this._supportedExtensions.push("SMTPUTF8");
    }
    if (/[ -]DSN\b/im.test(str)) {
      this._supportedExtensions.push("DSN");
    }
    if (/[ -]8BITMIME\b/im.test(str)) {
      this._supportedExtensions.push("8BITMIME");
    }
    if (/[ -]REQUIRETLS\b/im.test(str)) {
      this._supportedExtensions.push("REQUIRETLS");
    }
    if (/[ -]PIPELINING\b/im.test(str)) {
      this._supportedExtensions.push("PIPELINING");
    }
    if (/[ -]AUTH\b/i.test(str)) {
      this.allowsAuth = true;
    }
    const authMechanisms = /* @__PURE__ */ new Set();
    for (const line of this._ehloLines) {
      const authMatch = /^AUTH[\s=](.*)/i.exec(line);
      if (authMatch) {
        for (const mechanism of authMatch[1].split(/[\s=]+/)) {
          authMechanisms.add(mechanism.toUpperCase());
        }
      }
    }
    for (const mechanism of ["PLAIN", "LOGIN", "CRAM-MD5", "XOAUTH2"]) {
      if (authMechanisms.has(mechanism)) {
        this._supportedAuth.push(mechanism);
      }
    }
    if (match = str.match(/[ -]SIZE(?:[ \t]+(\d+))?/im)) {
      this._supportedExtensions.push("SIZE");
      this._maxAllowedSize = Number(match[1]) || 0;
    }
    this.emit("connect");
  }
  /**
   * Handles server response for HELO command. If it yielded in
   * error, emit 'error', otherwise move into the authentication phase.
   *
   * @param str Message from the server
   * @internal
   */
  _actionHELO(str) {
    if (str.charAt(0) !== "2") {
      this._onError(new Error("Invalid HELO. response=" + str), "EPROTOCOL", str, "HELO");
      return;
    }
    this.allowsAuth = true;
    this.emit("connect");
  }
  /**
   * Handles server response for STARTTLS command. If there's an error
   * try HELO instead, otherwise initiate TLS upgrade. If the upgrade
   * succeedes restart the EHLO
   *
   * @param str Message from the server
   * @internal
   */
  _actionSTARTTLS(str) {
    if (str.charAt(0) !== "2") {
      if (this.options.opportunisticTLS) {
        this.logger.info({
          tnx: "smtp"
        }, "Failed STARTTLS upgrade, continuing unencrypted");
        this.emit("connect");
        return;
      }
      this._onError(new Error("Error upgrading connection with STARTTLS"), "ETLS", str, "STARTTLS");
      return;
    }
    this._upgradeConnection((err, secured) => {
      if (err) {
        this._onError(new Error("Error initiating TLS - " + (err.message || err)), "ETLS", false, "STARTTLS");
        return;
      }
      this.logger.info({
        tnx: "smtp"
      }, "Connection upgraded with STARTTLS");
      if (secured) {
        if (this.options.lmtp) {
          this._responseActions.push(this._actionLHLO);
          this._sendCommand("LHLO " + this.name);
        } else {
          this._responseActions.push(this._actionEHLO);
          this._sendCommand("EHLO " + this.name);
        }
      } else {
        this.emit("connect");
      }
    });
  }
  /**
   * Handle the response for AUTH LOGIN command. We are expecting
   * '334 VXNlcm5hbWU6' (base64 for 'Username:'). Data to be sent as
   * response needs to be base64 encoded username. We do not need
   * exact match but settle with 334 response in general as some
   * hosts invalidly use a longer message than VXNlcm5hbWU6
   *
   * @param str Message from the server
   * @internal
   */
  _actionAUTH_LOGIN_USER(str, callback) {
    if (!/^334[ -]/.test(str)) {
      callback(this._formatError('Invalid login sequence while waiting for "334 VXNlcm5hbWU6"', "EAUTH", str, "AUTH LOGIN"));
      return;
    }
    this._responseActions.push((str2) => {
      this._actionAUTH_LOGIN_PASS(str2, callback);
    });
    this._sendCommand(Buffer.from(this._auth.credentials.user + "", "utf-8").toString("base64"));
  }
  /**
   * Handle the response for AUTH CRAM-MD5 command. We are expecting
   * '334 <challenge string>'. Data to be sent as response needs to be
   * base64 decoded challenge string, MD5 hashed using the password as
   * a HMAC key, prefixed by the username and a space, and finally all
   * base64 encoded again.
   *
   * @param str Message from the server
   * @internal
   */
  _actionAUTH_CRAM_MD5(str, callback) {
    const challengeMatch = str.match(/^334\s+(.+)$/);
    if (!challengeMatch) {
      return callback(this._formatError("Invalid login sequence while waiting for server challenge string", "EAUTH", str, "AUTH CRAM-MD5"));
    }
    const base64decoded = Buffer.from(challengeMatch[1], "base64").toString("ascii");
    const hmacMD5 = crypto6.createHmac("md5", this._auth.credentials.pass);
    hmacMD5.update(base64decoded);
    const prepended = this._auth.credentials.user + " " + hmacMD5.digest("hex");
    this._responseActions.push((str2) => {
      this._actionAUTH_CRAM_MD5_PASS(str2, callback);
    });
    this._sendCommand(
      Buffer.from(prepended).toString("base64"),
      // hidden hash for logs
      Buffer.from(this._auth.credentials.user + " /* secret */").toString("base64")
    );
  }
  /**
   * Handles the response to CRAM-MD5 authentication, if there's no error,
   * the user can be considered logged in. Start waiting for a message to send
   *
   * @param str Message from the server
   * @internal
   */
  _actionAUTH_CRAM_MD5_PASS(str, callback) {
    if (!str.match(/^235\s+/)) {
      return callback(this._formatError('Invalid login sequence while waiting for "235"', "EAUTH", str, "AUTH CRAM-MD5"));
    }
    this.logger.info({
      tnx: "smtp",
      username: this._auth.user,
      action: "authenticated",
      method: this._authMethod
    }, "User %s authenticated", JSON.stringify(this._auth.user));
    this.authenticated = true;
    callback(null, true);
  }
  /**
   * Handle the response for AUTH LOGIN command. We are expecting
   * '334 UGFzc3dvcmQ6' (base64 for 'Password:'). Data to be sent as
   * response needs to be base64 encoded password.
   *
   * @param str Message from the server
   * @internal
   */
  _actionAUTH_LOGIN_PASS(str, callback) {
    if (!/^334[ -]/.test(str)) {
      return callback(this._formatError('Invalid login sequence while waiting for "334 UGFzc3dvcmQ6"', "EAUTH", str, "AUTH LOGIN"));
    }
    this._responseActions.push((str2) => {
      this._actionAUTHComplete(str2, callback);
    });
    this._sendCommand(
      Buffer.from((this._auth.credentials.pass || "").toString(), "utf-8").toString("base64"),
      // Hidden pass for logs
      Buffer.from("/* secret */", "utf-8").toString("base64")
    );
  }
  /**
   * Handles the response for authentication, if there's no error,
   * the user can be considered logged in. Start waiting for a message to send
   *
   * @param str Message from the server
   * @internal
   */
  _actionAUTHComplete(str, isRetry, callback) {
    if (!callback && typeof isRetry === "function") {
      callback = isRetry;
      isRetry = false;
    }
    if (str.substr(0, 3) === "334") {
      this._responseActions.push((str2) => {
        if (isRetry || this._authMethod !== "XOAUTH2") {
          this._actionAUTHComplete(str2, true, callback);
        } else {
          setImmediate(() => this._handleXOauth2Token(true, callback));
        }
      });
      this._sendCommand("");
      return;
    }
    if (str.charAt(0) !== "2") {
      this.logger.info({
        tnx: "smtp",
        username: this._auth.user,
        action: "authfail",
        method: this._authMethod
      }, "User %s failed to authenticate", JSON.stringify(this._auth.user));
      return callback(this._formatError("Invalid login", "EAUTH", str, "AUTH " + this._authMethod));
    }
    this.logger.info({
      tnx: "smtp",
      username: this._auth.user,
      action: "authenticated",
      method: this._authMethod
    }, "User %s authenticated", JSON.stringify(this._auth.user));
    this.authenticated = true;
    callback(null, true);
  }
  /**
   * Handle response for a MAIL FROM: command
   *
   * @param str Message from the server
   * @internal
   */
  _actionMAIL(str, callback) {
    const envelope = this._envelope;
    if (Number(str.charAt(0)) !== 2) {
      const message = this._usingSmtpUtf8 && /^550 /.test(str) && /[\x80-\uFFFF]/.test(envelope.from) ? "Internationalized mailbox name not allowed" : "Mail command failed";
      return callback(this._formatError(message, "EENVELOPE", str, "MAIL FROM"));
    }
    if (!envelope.rcptQueue.length) {
      return callback(this._formatError("Can't send mail - no recipients defined", "EENVELOPE", false, "API"));
    }
    this._recipientQueue = [];
    const usePipelining = this._supportedExtensions.includes("PIPELINING");
    do {
      const curRecipient = envelope.rcptQueue.shift();
      this._recipientQueue.push(curRecipient);
      this._responseActions.push((str2) => {
        this._actionRCPT(str2, callback);
      });
      this._sendCommand("RCPT TO:<" + curRecipient + ">" + this._getDsnRcptToArgs());
    } while (usePipelining && envelope.rcptQueue.length);
  }
  /**
   * Handle response for a RCPT TO: command
   *
   * @param str Message from the server
   * @internal
   */
  _actionRCPT(str, callback) {
    const envelope = this._envelope;
    let err;
    const curRecipient = this._recipientQueue.shift();
    if (Number(str.charAt(0)) !== 2) {
      const message = this._usingSmtpUtf8 && /^553 /.test(str) && /[\x80-\uFFFF]/.test(curRecipient) ? "Internationalized mailbox name not allowed" : "Recipient command failed";
      envelope.rejected.push(curRecipient);
      err = this._formatError(message, "EENVELOPE", str, "RCPT TO");
      err.recipient = curRecipient;
      envelope.rejectedErrors.push(err);
    } else {
      envelope.accepted.push(curRecipient);
    }
    if (!envelope.rcptQueue.length && !this._recipientQueue.length) {
      if (envelope.rejected.length < envelope.to.length) {
        this._responseActions.push((str2) => {
          this._actionDATA(str2, callback);
        });
        this._sendCommand("DATA");
      } else {
        const deferred = envelope.rejectedErrors.find((rejectedErr) => rejectedErr.responseCode && rejectedErr.responseCode < 500);
        const reply = deferred?.response ?? str;
        err = this._formatError("Can't send mail - all recipients were rejected", "EENVELOPE", reply, "RCPT TO");
        err.rejected = envelope.rejected;
        err.rejectedErrors = envelope.rejectedErrors;
        return callback(err);
      }
    } else if (envelope.rcptQueue.length) {
      const nextRecipient = envelope.rcptQueue.shift();
      this._recipientQueue.push(nextRecipient);
      this._responseActions.push((str2) => {
        this._actionRCPT(str2, callback);
      });
      this._sendCommand("RCPT TO:<" + nextRecipient + ">" + this._getDsnRcptToArgs());
    }
  }
  /**
   * Handle response for a DATA command
   *
   * @param str Message from the server
   * @internal
   */
  _actionDATA(str, callback) {
    const envelope = this._envelope;
    if (!/^[23]/.test(str)) {
      return callback(this._formatError("Data command failed", "EENVELOPE", str, "DATA"));
    }
    const response = {
      accepted: envelope.accepted,
      rejected: envelope.rejected
    };
    if (this._ehloLines && this._ehloLines.length) {
      response.ehlo = this._ehloLines;
    }
    if (envelope.rejectedErrors.length) {
      response.rejectedErrors = envelope.rejectedErrors;
    }
    callback(null, response);
  }
  /**
   * Handle response for a DATA stream when using SMTP
   * We expect a single response that defines if the sending succeeded or failed
   *
   * @param str Message from the server
   * @internal
   */
  _actionSMTPStream(str, callback) {
    if (Number(str.charAt(0)) !== 2) {
      return callback(this._formatError("Message failed", "EMESSAGE", str, "DATA"));
    }
    return callback(null, str);
  }
  /**
   * Handle response for a DATA stream
   * We expect a separate response for every recipient. All recipients can either
   * succeed or fail separately
   *
   * @param recipient The recipient this response applies to
   * @param final Is this the final recipient?
   * @param str Message from the server
   * @internal
   */
  _actionLMTPStream(recipient, final, str, callback) {
    const envelope = this._envelope;
    let err;
    if (Number(str.charAt(0)) !== 2) {
      err = this._formatError("Message failed for recipient " + recipient, "EMESSAGE", str, "DATA");
      err.recipient = recipient;
      envelope.rejected.push(recipient);
      envelope.rejectedErrors.push(err);
      for (let i = 0, len = envelope.accepted.length; i < len; i++) {
        if (envelope.accepted[i] === recipient) {
          envelope.accepted.splice(i, 1);
        }
      }
    }
    if (final) {
      return callback(null, str);
    }
  }
  /** @internal */
  _handleXOauth2Token(isRetry, callback) {
    this._auth.oauth2.getToken(isRetry, (err, accessToken) => {
      if (err) {
        this.logger.info({
          tnx: "smtp",
          username: this._auth.user,
          action: "authfail",
          method: this._authMethod
        }, "User %s failed to authenticate", JSON.stringify(this._auth.user));
        return callback(this._formatError(err, "EAUTH", false, "AUTH XOAUTH2"));
      }
      this._responseActions.push((str) => {
        this._actionAUTHComplete(str, isRetry, callback);
      });
      this._sendCommand(
        "AUTH XOAUTH2 " + this._auth.oauth2.buildXOAuth2Token(accessToken),
        //  Hidden for logs
        "AUTH XOAUTH2 " + this._auth.oauth2.buildXOAuth2Token("/* secret */")
      );
    });
  }
  /**
   *
   * @param command
   * @internal
   */
  _isDestroyedMessage(command) {
    if (this._destroyed) {
      return "Cannot " + command + " - smtp connection is already destroyed.";
    }
    if (this._socket) {
      if (this._socket.destroyed) {
        return "Cannot " + command + " - smtp connection socket is already destroyed.";
      }
      if (!this._socket.writable) {
        return "Cannot " + command + " - smtp connection socket is already half-closed.";
      }
    }
  }
  /** @internal */
  _getHostname() {
    let defaultHostname;
    try {
      defaultHostname = os2.hostname() || "";
    } catch (_err) {
      defaultHostname = "localhost";
    }
    if (!defaultHostname || defaultHostname.indexOf(".") < 0) {
      defaultHostname = "[127.0.0.1]";
    }
    if (defaultHostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      defaultHostname = "[" + defaultHostname + "]";
    }
    return defaultHostname;
  }
};
var smtp_connection_default = SMTPConnection;

// node_modules/nodemailer/dist/esm/xoauth2/index.js
import { Stream } from "node:stream";
import crypto7 from "node:crypto";
var XOAuth2 = class extends Stream {
  constructor(options, logger) {
    super();
    this.options = options || {};
    this.configError = false;
    if (options && options.serviceClient) {
      if (!options.privateKey || !options.user) {
        const err = new Error('Options "privateKey" and "user" are required for service account!');
        err.code = EOAUTH2;
        this.configError = err;
      }
      const serviceRequestTimeout = Math.min(Math.max(Number(this.options.serviceRequestTimeout) || 0, 0), 3600);
      this.options.serviceRequestTimeout = serviceRequestTimeout || 5 * 60;
    }
    this.logger = getLogger({
      logger
    }, {
      component: this.options.component || "OAuth2"
    });
    this.provisionCallback = typeof this.options.provisionCallback === "function" ? this.options.provisionCallback : false;
    this.options.accessUrl = this.options.accessUrl || "https://accounts.google.com/o/oauth2/token";
    this.options.customHeaders = this.options.customHeaders || {};
    this.options.customParams = this.options.customParams || {};
    this.accessToken = this.options.accessToken || false;
    if (this.options.expires && Number(this.options.expires)) {
      this.expires = this.options.expires;
    } else {
      const timeout = Math.max(Number(this.options.timeout) || 0, 0);
      this.expires = timeout && Date.now() + timeout * 1e3 || 0;
    }
    this.renewing = false;
    this.renewalQueue = [];
  }
  /**
   * Returns or generates (if previous has expired) a XOAuth2 token
   *
   * @param renew If false then use cached access token (if available)
   * @param callback Callback function with error object and token string
   */
  getToken(renew, callback) {
    const done = callback;
    if (this.configError) {
      return done(this.configError);
    }
    if (!renew && this.accessToken && (!this.expires || this.expires > Date.now())) {
      this.logger.debug({
        tnx: "OAUTH2",
        user: this.options.user,
        action: "reuse"
      }, "Reusing existing access token for %s", this.options.user);
      return callback(null, this.accessToken);
    }
    if (!this.provisionCallback && !this.options.refreshToken && !this.options.serviceClient) {
      if (this.accessToken) {
        this.logger.debug({
          tnx: "OAUTH2",
          user: this.options.user,
          action: "reuse"
        }, "Reusing existing access token (no refresh capability) for %s", this.options.user);
        return callback(null, this.accessToken);
      }
      this.logger.error({
        tnx: "OAUTH2",
        user: this.options.user,
        action: "renew"
      }, "Cannot renew access token for %s: No refresh mechanism available", this.options.user);
      const err = new Error("Can't create new access token for user");
      err.code = EOAUTH2;
      return done(err);
    }
    if (this.renewing) {
      this.renewalQueue.push({ renew, callback: done });
      return;
    }
    this.renewing = true;
    const generateCallback = (err, accessToken) => {
      this.renewalQueue.forEach((item) => item.callback(err, accessToken));
      this.renewalQueue = [];
      this.renewing = false;
      if (err) {
        this.logger.error({
          err,
          tnx: "OAUTH2",
          user: this.options.user,
          action: "renew"
        }, "Failed generating new Access Token for %s", this.options.user);
      } else {
        this.logger.info({
          tnx: "OAUTH2",
          user: this.options.user,
          action: "renew"
        }, "Generated new Access Token for %s", this.options.user);
      }
      done(err, accessToken);
    };
    if (this.provisionCallback) {
      this.provisionCallback(this.options.user, !!renew, (err, accessToken, expires) => {
        if (!err && accessToken) {
          this.accessToken = accessToken;
          this.expires = expires || 0;
        }
        generateCallback(err, accessToken);
      });
    } else {
      this.generateToken(generateCallback);
    }
  }
  /**
   * Updates token values
   *
   * @param accessToken New access token
   * @param timeout Access token lifetime in seconds
   *
   * Emits 'token': { user: User email-address, accessToken: the new accessToken, timeout: TTL in seconds}
   */
  updateToken(accessToken, timeout) {
    this.accessToken = accessToken;
    timeout = Math.max(Number(timeout) || 0, 0);
    this.expires = timeout && Date.now() + timeout * 1e3 || 0;
    this.emit("token", {
      user: this.options.user,
      accessToken: accessToken || "",
      expires: this.expires
    });
  }
  /**
   * Generates a new XOAuth2 token with the credentials provided at initialization
   *
   * @param callback Callback function with error object and token string
   */
  generateToken(callback) {
    const done = callback;
    let urlOptions;
    let loggedUrlOptions;
    if (this.options.serviceClient) {
      const iat = Math.floor(Date.now() / 1e3);
      const tokenData = {
        iss: this.options.serviceClient,
        scope: this.options.scope || "https://mail.google.com/",
        sub: this.options.user,
        aud: this.options.accessUrl,
        iat,
        exp: iat + this.options.serviceRequestTimeout
      };
      let token;
      try {
        token = this.jwtSignRS256(tokenData);
      } catch (_err) {
        const err = new Error("Can't generate token. Check your auth options");
        err.code = EOAUTH2;
        return done(err);
      }
      urlOptions = {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token
      };
      loggedUrlOptions = {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: tokenData
      };
    } else {
      if (!this.options.refreshToken) {
        const err = new Error("Can't create new access token for user");
        err.code = EOAUTH2;
        return done(err);
      }
      urlOptions = {
        client_id: this.options.clientId || "",
        client_secret: this.options.clientSecret || "",
        refresh_token: this.options.refreshToken,
        grant_type: "refresh_token"
      };
      loggedUrlOptions = {
        client_id: this.options.clientId || "",
        client_secret: (this.options.clientSecret || "").substr(0, 6) + "...",
        refresh_token: (this.options.refreshToken || "").substr(0, 6) + "...",
        grant_type: "refresh_token"
      };
    }
    Object.assign(urlOptions, this.options.customParams);
    Object.assign(loggedUrlOptions, this.options.customParams);
    this.logger.debug({
      tnx: "OAUTH2",
      user: this.options.user,
      action: "generate"
    }, "Requesting token using: %s", JSON.stringify(loggedUrlOptions));
    this.postRequest(this.options.accessUrl, urlOptions, this.options, (error2, body) => {
      let data;
      if (error2) {
        return done(error2);
      }
      try {
        data = JSON.parse(body.toString());
      } catch (E) {
        return done(E);
      }
      if (!data || typeof data !== "object") {
        this.logger.debug({
          tnx: "OAUTH2",
          user: this.options.user,
          action: "post"
        }, "Response: %s", (body || "").toString());
        const err2 = new Error("Invalid authentication response");
        err2.code = EOAUTH2;
        return done(err2);
      }
      const logData = Object.assign({}, data);
      if (logData.access_token) {
        logData.access_token = (logData.access_token || "").toString().substr(0, 6) + "...";
      }
      this.logger.debug({
        tnx: "OAUTH2",
        user: this.options.user,
        action: "post"
      }, "Response: %s", JSON.stringify(logData));
      if (data.error) {
        let errorMessage = data.error;
        if (data.error_description) {
          errorMessage += ": " + data.error_description;
        }
        if (data.error_uri) {
          errorMessage += " (" + data.error_uri + ")";
        }
        const err2 = new Error(errorMessage);
        err2.code = EOAUTH2;
        return done(err2);
      }
      if (data.access_token) {
        this.updateToken(data.access_token, data.expires_in);
        return callback(null, this.accessToken);
      }
      const err = new Error("No access token");
      err.code = EOAUTH2;
      return done(err);
    });
  }
  /**
   * Converts an access_token and user id into a base64 encoded XOAuth2 token
   *
   * @param [accessToken] Access token string
   * @return Base64 encoded token for IMAP or SMTP login
   */
  buildXOAuth2Token(accessToken) {
    const authData = ["user=" + (this.options.user || ""), "auth=Bearer " + (accessToken || this.accessToken), "", ""];
    return Buffer.from(authData.join(""), "utf-8").toString("base64");
  }
  /**
   * Custom POST request handler.
   * This is only needed to keep paths short in Windows, usually this module
   * is a dependency of a dependency and if it tries to require something
   * like the request module the paths get way too long to handle for Windows.
   * As we do only a simple POST request we do not actually require complicated
   * logic support (no redirects, no nothing) anyway.
   *
   * @param url Url to POST to
   * @param payload Payload to POST
   * @param params Client options, the customHeaders and tls values are used for the request
   * @param callback Callback function with (err, buff)
   */
  postRequest(url, payload, params, callback) {
    let returned = false;
    const chunks = [];
    let chunklen = 0;
    const fetchOptions = {
      method: "post",
      headers: params.customHeaders,
      body: payload,
      allowErrorResponse: true,
      // unset falls back to the fetch default, a stalled token endpoint would otherwise keep
      // `renewing` set and queue every later request
      timeout: params.requestTimeout
    };
    if (/^https:/i.test(url)) {
      fetchOptions.tls = Object.assign({ rejectUnauthorized: true }, params.tls || {});
    }
    const req = fetch_default(url, fetchOptions);
    req.on("readable", () => {
      let chunk;
      while ((chunk = req.read()) !== null) {
        chunks.push(chunk);
        chunklen += chunk.length;
      }
    });
    req.once("error", (err) => {
      if (returned) {
        return;
      }
      returned = true;
      return callback(err);
    });
    req.once("end", () => {
      if (returned) {
        return;
      }
      returned = true;
      return callback(null, Buffer.concat(chunks, chunklen));
    });
  }
  /**
   * Encodes a buffer or a string into Base64url format
   *
   * @param data The data to convert
   * @return The encoded string
   */
  toBase64URL(data) {
    if (typeof data === "string") {
      data = Buffer.from(data);
    }
    return data.toString("base64").replace(/[=]+/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  /**
   * Creates a JSON Web Token signed with RS256 (SHA256 + RSA)
   *
   * @param payload The payload to include in the generated token
   * @return The generated and signed token
   */
  jwtSignRS256(payload) {
    const signedPayload = ['{"alg":"RS256","typ":"JWT"}', JSON.stringify(payload)].map((val) => this.toBase64URL(val)).join(".");
    const signature = crypto7.createSign("RSA-SHA256").update(signedPayload).sign(this.options.privateKey);
    return signedPayload + "." + this.toBase64URL(signature);
  }
};
var xoauth2_default = XOAuth2;

// node_modules/nodemailer/dist/esm/smtp-pool/pool-resource.js
import { EventEmitter as EventEmitter3 } from "node:events";
var PoolResource = class extends EventEmitter3 {
  constructor(pool) {
    super();
    this.pool = pool;
    this.options = pool.options;
    this.logger = this.pool.logger;
    if (this.options.auth) {
      switch ((this.options.auth.type || "").toString().toUpperCase()) {
        case "OAUTH2": {
          const oauth2 = new xoauth2_default(this.options.auth, this.logger);
          oauth2.provisionCallback = this.pool.mailer && this.pool.mailer.get("oauth2_provision_cb") || oauth2.provisionCallback;
          this.auth = {
            type: "OAUTH2",
            user: this.options.auth.user,
            oauth2,
            method: "XOAUTH2"
          };
          oauth2.on("token", (token) => this.pool.mailer.emit("token", token));
          oauth2.on("error", (err) => this._fail(err));
          break;
        }
        default:
          if (!this.options.auth.user && !this.options.auth.pass) {
            break;
          }
          this.auth = {
            type: (this.options.auth.type || "").toString().toUpperCase() || "LOGIN",
            user: this.options.auth.user,
            credentials: {
              user: this.options.auth.user || "",
              pass: this.options.auth.pass,
              options: this.options.auth.options
            },
            method: (this.options.auth.method || "").trim().toUpperCase() || this.options.authMethod || false
          };
      }
    }
    this._connection = false;
    this._connected = false;
    this.messages = 0;
    this.available = true;
    this._failed = false;
  }
  /**
   * Emits 'error' for the first failure only. A dead resource can report the same failure more
   * than once (the connection error, then the send callback), the pool handles it once
   * @internal
   */
  _fail(err) {
    if (this._failed) {
      return;
    }
    this._failed = true;
    this.emit("error", err);
  }
  /**
   * Initiates a connection to the SMTP server
   *
   * @param callback Callback function to run once the connection is established or failed
   */
  connect(callback) {
    this.pool.getSocket(this.options, (err, socketOptions) => {
      if (err) {
        this._fail(err);
        return callback(err);
      }
      let returned = false;
      let options = this.options;
      if (socketOptions && socketOptions.connection) {
        this.logger.info({
          tnx: "proxy",
          remoteAddress: socketOptions.connection.remoteAddress,
          remotePort: socketOptions.connection.remotePort,
          destHost: options.host || "",
          destPort: options.port || "",
          action: "connected"
        }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
        options = Object.assign(assign(false, options), socketOptions);
      }
      this.connection = new smtp_connection_default(options);
      this.connection.on("error", (err2) => {
        this._fail(err2);
        if (returned) {
          return;
        }
        returned = true;
        return callback(err2);
      });
      this.connection.once("end", () => {
        this.close();
        returned = true;
      });
      this.connection.connect((err2) => {
        if (returned) {
          return;
        }
        if (err2) {
          returned = true;
          return;
        }
        if (this.auth && (this.connection.allowsAuth || options.forceAuth)) {
          this.connection.login(this.auth, (err3) => {
            if (returned) {
              return;
            }
            returned = true;
            if (err3) {
              this.connection.close();
              this._fail(err3);
              return callback(err3);
            }
            this._connected = true;
            callback(null, true);
          });
        } else {
          returned = true;
          this._connected = true;
          return callback(null, true);
        }
      });
    });
  }
  /**
   * Sends an e-mail to be sent using the selected settings
   *
   * @param mail Mail object
   * @param callback Callback function
   */
  send(mail, callback) {
    if (!this._connected) {
      return this.connect((err) => {
        if (err) {
          return callback(err);
        }
        return this.send(mail, callback);
      });
    }
    const envelope = mail.message.getEnvelope();
    const messageId = mail.message.messageId();
    const recipients = [].concat(envelope.to || []);
    if (recipients.length > 3) {
      recipients.push("...and " + recipients.splice(2).length + " more");
    }
    this.logger.info({
      tnx: "send",
      messageId,
      cid: this.id
    }, "Sending message %s using #%s to <%s>", messageId, this.id, recipients.join(", "));
    if (mail.data.dsn) {
      envelope.dsn = mail.data.dsn;
    }
    if (mail.data.requireTLSExtensionEnabled) {
      envelope.requireTLSExtensionEnabled = mail.data.requireTLSExtensionEnabled;
    }
    this.connection.send(envelope, mail.message.createReadStream(), (err, info) => {
      this.messages++;
      if (err) {
        this.connection.close();
        this._fail(err);
        return callback(err);
      }
      info.envelope = {
        from: envelope.from,
        to: envelope.to
      };
      info.messageId = messageId;
      setImmediate(() => {
        if (this.messages >= this.options.maxMessages) {
          const err2 = new Error("Resource exhausted");
          err2.code = EMAXLIMIT;
          this.connection.close();
          this._fail(err2);
        } else {
          this.pool._checkRateLimit(() => {
            this.available = true;
            this.emit("available");
          });
        }
      });
      callback(null, info);
    });
  }
  /**
   * Closes the connection
   */
  close() {
    this._connected = false;
    if (this.auth && this.auth.oauth2) {
      this.auth.oauth2.removeAllListeners();
    }
    if (this.connection) {
      this.connection.close();
    }
    this.emit("close");
  }
};

// node_modules/nodemailer/dist/esm/well-known/services.js
var services = {
  "126": {
    "description": "126 Mail (NetEase)",
    "host": "smtp.126.com",
    "port": 465,
    "secure": true
  },
  "163": {
    "description": "163 Mail (NetEase)",
    "host": "smtp.163.com",
    "port": 465,
    "secure": true
  },
  "1und1": {
    "description": "1&1 Mail (German hosting provider)",
    "host": "smtp.1und1.de",
    "port": 465,
    "secure": true,
    "authMethod": "LOGIN"
  },
  "Aliyun": {
    "description": "Alibaba Cloud Mail",
    "domains": [
      "aliyun.com"
    ],
    "host": "smtp.aliyun.com",
    "port": 465,
    "secure": true
  },
  "AliyunQiye": {
    "description": "Alibaba Cloud Enterprise Mail",
    "host": "smtp.qiye.aliyun.com",
    "port": 465,
    "secure": true
  },
  "AOL": {
    "description": "AOL Mail",
    "domains": [
      "aol.com"
    ],
    "host": "smtp.aol.com",
    "port": 587
  },
  "Aruba": {
    "description": "Aruba PEC (Italian email provider)",
    "domains": [
      "aruba.it",
      "pec.aruba.it"
    ],
    "aliases": [
      "Aruba PEC"
    ],
    "host": "smtps.aruba.it",
    "port": 465,
    "secure": true,
    "authMethod": "LOGIN"
  },
  "Bluewin": {
    "description": "Bluewin (Swiss email provider)",
    "host": "smtpauths.bluewin.ch",
    "domains": [
      "bluewin.ch"
    ],
    "port": 465
  },
  "BOL": {
    "description": "BOL Mail (Brazilian provider)",
    "domains": [
      "bol.com.br"
    ],
    "host": "smtp.bol.com.br",
    "port": 587,
    "requireTLS": true
  },
  "DebugMail": {
    "description": "DebugMail (email testing service)",
    "host": "debugmail.io",
    "port": 25
  },
  "Disroot": {
    "description": "Disroot (privacy-focused provider)",
    "domains": [
      "disroot.org"
    ],
    "host": "disroot.org",
    "port": 587,
    "secure": false,
    "authMethod": "LOGIN"
  },
  "DynectEmail": {
    "description": "Dyn Email Delivery",
    "aliases": [
      "Dynect"
    ],
    "host": "smtp.dynect.net",
    "port": 25
  },
  "ElasticEmail": {
    "description": "Elastic Email",
    "aliases": [
      "Elastic Email"
    ],
    "host": "smtp.elasticemail.com",
    "port": 465,
    "secure": true
  },
  "Ethereal": {
    "description": "Ethereal Email (email testing service)",
    "aliases": [
      "ethereal.email"
    ],
    "host": "smtp.ethereal.email",
    "port": 587
  },
  "FastMail": {
    "description": "FastMail",
    "domains": [
      "fastmail.com",
      "fastmail.fm"
    ],
    "host": "smtp.fastmail.com",
    "port": 465,
    "secure": true
  },
  "Feishu Mail": {
    "description": "Feishu Mail (Lark)",
    "aliases": [
      "Feishu",
      "FeishuMail"
    ],
    "domains": [
      "www.feishu.cn"
    ],
    "host": "smtp.feishu.cn",
    "port": 465,
    "secure": true
  },
  "Forward Email": {
    "description": "Forward Email (email forwarding service)",
    "aliases": [
      "FE",
      "ForwardEmail"
    ],
    "domains": [
      "forwardemail.net"
    ],
    "host": "smtp.forwardemail.net",
    "port": 465,
    "secure": true
  },
  "GandiMail": {
    "description": "Gandi Mail",
    "aliases": [
      "Gandi",
      "Gandi Mail"
    ],
    "host": "mail.gandi.net",
    "port": 587
  },
  "Gmail": {
    "description": "Gmail",
    "aliases": [
      "Google Mail"
    ],
    "domains": [
      "gmail.com",
      "googlemail.com"
    ],
    "host": "smtp.gmail.com",
    "port": 465,
    "secure": true
  },
  "GmailWorkspace": {
    "description": "Gmail Workspace",
    "aliases": [
      "Google Workspace Mail"
    ],
    "host": "smtp-relay.gmail.com",
    "port": 465,
    "secure": true
  },
  "GMX": {
    "description": "GMX Mail",
    "domains": [
      "gmx.com",
      "gmx.net",
      "gmx.de"
    ],
    "host": "mail.gmx.com",
    "port": 587
  },
  "Godaddy": {
    "description": "GoDaddy Email (US)",
    "host": "smtpout.secureserver.net",
    "port": 25
  },
  "GodaddyAsia": {
    "description": "GoDaddy Email (Asia)",
    "host": "smtp.asia.secureserver.net",
    "port": 25
  },
  "GodaddyEurope": {
    "description": "GoDaddy Email (Europe)",
    "host": "smtp.europe.secureserver.net",
    "port": 25
  },
  "hot.ee": {
    "description": "Hot.ee (Estonian email provider)",
    "host": "mail.hot.ee"
  },
  "Hotmail": {
    "description": "Outlook.com / Hotmail",
    "aliases": [
      "Outlook",
      "Outlook.com",
      "Hotmail.com"
    ],
    "domains": [
      "hotmail.com",
      "outlook.com"
    ],
    "host": "smtp-mail.outlook.com",
    "port": 587
  },
  "iCloud": {
    "description": "iCloud Mail",
    "aliases": [
      "Me",
      "Mac"
    ],
    "domains": [
      "icloud.com",
      "me.com",
      "mac.com"
    ],
    "host": "smtp.mail.me.com",
    "port": 587
  },
  "Infomaniak": {
    "description": "Infomaniak Mail (Swiss hosting provider)",
    "host": "mail.infomaniak.com",
    "domains": [
      "ik.me",
      "ikmail.com",
      "etik.com"
    ],
    "port": 587
  },
  "KolabNow": {
    "description": "KolabNow (secure email service)",
    "domains": [
      "kolabnow.com"
    ],
    "aliases": [
      "Kolab"
    ],
    "host": "smtp.kolabnow.com",
    "port": 465,
    "secure": true,
    "authMethod": "LOGIN"
  },
  "Loopia": {
    "description": "Loopia (Swedish hosting provider)",
    "host": "mailcluster.loopia.se",
    "port": 465
  },
  "Loops": {
    "description": "Loops",
    "host": "smtp.loops.so",
    "port": 587
  },
  "mail.ee": {
    "description": "Mail.ee (Estonian email provider)",
    "host": "smtp.mail.ee"
  },
  "Mail.ru": {
    "description": "Mail.ru",
    "host": "smtp.mail.ru",
    "port": 465,
    "secure": true
  },
  "Mailcatch.app": {
    "description": "Mailcatch (email testing service)",
    "host": "sandbox-smtp.mailcatch.app",
    "port": 2525
  },
  "Maildev": {
    "description": "MailDev (local email testing)",
    "port": 1025,
    "ignoreTLS": true
  },
  "MailerSend": {
    "description": "MailerSend",
    "host": "smtp.mailersend.net",
    "port": 587
  },
  "Mailgun": {
    "description": "Mailgun",
    "host": "smtp.mailgun.org",
    "port": 465,
    "secure": true
  },
  "Mailjet": {
    "description": "Mailjet",
    "host": "in.mailjet.com",
    "port": 587
  },
  "Mailosaur": {
    "description": "Mailosaur (email testing service)",
    "host": "mailosaur.io",
    "port": 25
  },
  "Mailtrap": {
    "description": "Mailtrap",
    "host": "live.smtp.mailtrap.io",
    "port": 587
  },
  "Mandrill": {
    "description": "Mandrill (by Mailchimp)",
    "host": "smtp.mandrillapp.com",
    "port": 587
  },
  "Naver": {
    "description": "Naver Mail (Korean email provider)",
    "host": "smtp.naver.com",
    "port": 587
  },
  "OhMySMTP": {
    "description": "OhMySMTP (email delivery service)",
    "host": "smtp.ohmysmtp.com",
    "port": 587,
    "secure": false
  },
  "One": {
    "description": "One.com Email",
    "host": "send.one.com",
    "port": 465,
    "secure": true
  },
  "OpenMailBox": {
    "description": "OpenMailBox",
    "aliases": [
      "OMB",
      "openmailbox.org"
    ],
    "host": "smtp.openmailbox.org",
    "port": 465,
    "secure": true
  },
  "Outlook365": {
    "description": "Microsoft 365 / Office 365",
    "host": "smtp.office365.com",
    "port": 587,
    "secure": false
  },
  "Postmark": {
    "description": "Postmark",
    "aliases": [
      "PostmarkApp"
    ],
    "host": "smtp.postmarkapp.com",
    "port": 2525
  },
  "Proton": {
    "description": "Proton Mail",
    "aliases": [
      "ProtonMail",
      "Proton.me",
      "Protonmail.com",
      "Protonmail.ch"
    ],
    "domains": [
      "proton.me",
      "protonmail.com",
      "pm.me",
      "protonmail.ch"
    ],
    "host": "smtp.protonmail.ch",
    "port": 587,
    "requireTLS": true
  },
  "qiye.aliyun": {
    "description": "Alibaba Mail Enterprise Edition",
    "host": "smtp.mxhichina.com",
    "port": "465",
    "secure": true
  },
  "QQ": {
    "description": "QQ Mail",
    "domains": [
      "qq.com"
    ],
    "host": "smtp.qq.com",
    "port": 465,
    "secure": true
  },
  "QQex": {
    "description": "QQ Enterprise Mail",
    "aliases": [
      "QQ Enterprise"
    ],
    "domains": [
      "exmail.qq.com"
    ],
    "host": "smtp.exmail.qq.com",
    "port": 465,
    "secure": true
  },
  "Resend": {
    "description": "Resend",
    "host": "smtp.resend.com",
    "port": 465,
    "secure": true
  },
  "Runbox": {
    "description": "Runbox (Norwegian email provider)",
    "domains": [
      "runbox.com"
    ],
    "host": "smtp.runbox.com",
    "port": 465,
    "secure": true
  },
  "SendCloud": {
    "description": "SendCloud (Chinese email delivery)",
    "host": "smtp.sendcloud.net",
    "port": 2525
  },
  "SendGrid": {
    "description": "SendGrid",
    "host": "smtp.sendgrid.net",
    "port": 587
  },
  "SendinBlue": {
    "description": "Brevo (formerly Sendinblue)",
    "aliases": [
      "Brevo"
    ],
    "host": "smtp-relay.brevo.com",
    "port": 587
  },
  "SendPulse": {
    "description": "SendPulse",
    "host": "smtp-pulse.com",
    "port": 465,
    "secure": true
  },
  "SES": {
    "description": "AWS SES US East (N. Virginia)",
    "host": "email-smtp.us-east-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-AP-NORTHEAST-1": {
    "description": "AWS SES Asia Pacific (Tokyo)",
    "host": "email-smtp.ap-northeast-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-AP-NORTHEAST-2": {
    "description": "AWS SES Asia Pacific (Seoul)",
    "host": "email-smtp.ap-northeast-2.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-AP-NORTHEAST-3": {
    "description": "AWS SES Asia Pacific (Osaka)",
    "host": "email-smtp.ap-northeast-3.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-AP-SOUTH-1": {
    "description": "AWS SES Asia Pacific (Mumbai)",
    "host": "email-smtp.ap-south-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-AP-SOUTHEAST-1": {
    "description": "AWS SES Asia Pacific (Singapore)",
    "host": "email-smtp.ap-southeast-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-AP-SOUTHEAST-2": {
    "description": "AWS SES Asia Pacific (Sydney)",
    "host": "email-smtp.ap-southeast-2.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-CA-CENTRAL-1": {
    "description": "AWS SES Canada (Central)",
    "host": "email-smtp.ca-central-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-EU-CENTRAL-1": {
    "description": "AWS SES Europe (Frankfurt)",
    "host": "email-smtp.eu-central-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-EU-NORTH-1": {
    "description": "AWS SES Europe (Stockholm)",
    "host": "email-smtp.eu-north-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-EU-WEST-1": {
    "description": "AWS SES Europe (Ireland)",
    "host": "email-smtp.eu-west-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-EU-WEST-2": {
    "description": "AWS SES Europe (London)",
    "host": "email-smtp.eu-west-2.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-EU-WEST-3": {
    "description": "AWS SES Europe (Paris)",
    "host": "email-smtp.eu-west-3.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-SA-EAST-1": {
    "description": "AWS SES South America (S\xE3o Paulo)",
    "host": "email-smtp.sa-east-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-US-EAST-1": {
    "description": "AWS SES US East (N. Virginia)",
    "host": "email-smtp.us-east-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-US-EAST-2": {
    "description": "AWS SES US East (Ohio)",
    "host": "email-smtp.us-east-2.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-US-GOV-EAST-1": {
    "description": "AWS SES GovCloud (US-East)",
    "host": "email-smtp.us-gov-east-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-US-GOV-WEST-1": {
    "description": "AWS SES GovCloud (US-West)",
    "host": "email-smtp.us-gov-west-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-US-WEST-1": {
    "description": "AWS SES US West (N. California)",
    "host": "email-smtp.us-west-1.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "SES-US-WEST-2": {
    "description": "AWS SES US West (Oregon)",
    "host": "email-smtp.us-west-2.amazonaws.com",
    "port": 465,
    "secure": true
  },
  "Seznam": {
    "description": "Seznam Email (Czech email provider)",
    "aliases": [
      "Seznam Email"
    ],
    "domains": [
      "seznam.cz",
      "email.cz",
      "post.cz",
      "spoluzaci.cz"
    ],
    "host": "smtp.seznam.cz",
    "port": 465,
    "secure": true
  },
  "SMTP2GO": {
    "description": "SMTP2GO",
    "host": "mail.smtp2go.com",
    "port": 2525
  },
  "Sparkpost": {
    "description": "SparkPost",
    "aliases": [
      "SparkPost",
      "SparkPost Mail"
    ],
    "domains": [
      "sparkpost.com"
    ],
    "host": "smtp.sparkpostmail.com",
    "port": 587,
    "secure": false
  },
  "Tipimail": {
    "description": "Tipimail (email delivery service)",
    "host": "smtp.tipimail.com",
    "port": 587
  },
  "TurboSMTP": {
    "description": "TurboSMTP",
    "host": "pro.turbo-smtp.com",
    "port": 465,
    "secure": true
  },
  "TurboSMTP-EU": {
    "description": "TurboSMTP (EU region)",
    "host": "pro.eu.turbo-smtp.com",
    "port": 465,
    "secure": true
  },
  "Tutanota": {
    "description": "Tutanota (Tuta Mail)",
    "domains": [
      "tutanota.com",
      "tuta.com",
      "tutanota.de",
      "tuta.io"
    ],
    "host": "smtp.tutanota.com",
    "port": 465,
    "secure": true
  },
  "Yahoo": {
    "description": "Yahoo Mail",
    "domains": [
      "yahoo.com"
    ],
    "host": "smtp.mail.yahoo.com",
    "port": 465,
    "secure": true
  },
  "Yandex": {
    "description": "Yandex Mail",
    "domains": [
      "yandex.ru"
    ],
    "host": "smtp.yandex.ru",
    "port": 465,
    "secure": true
  },
  "Zimbra": {
    "description": "Zimbra Mail Server",
    "aliases": [
      "Zimbra Collaboration"
    ],
    "host": "smtp.zimbra.com",
    "port": 587,
    "requireTLS": true
  },
  "Zoho": {
    "description": "Zoho Mail",
    "host": "smtp.zoho.com",
    "port": 465,
    "secure": true,
    "authMethod": "LOGIN"
  }
};

// node_modules/nodemailer/dist/esm/well-known/index.js
var normalized = {};
Object.keys(services).forEach((key) => {
  const service = services[key];
  const normalizedService = normalizeService(service);
  normalized[normalizeKey(key)] = normalizedService;
  [].concat(service.aliases || []).forEach((alias) => {
    normalized[normalizeKey(alias)] = normalizedService;
  });
  [].concat(service.domains || []).forEach((domain) => {
    normalized[normalizeKey(domain)] = normalizedService;
  });
});
function normalizeKey(key) {
  return key.replace(/[^a-zA-Z0-9.-]/g, "").toLowerCase();
}
function normalizeService(service) {
  const response = {};
  Object.keys(service).forEach((key) => {
    if (!["domains", "aliases"].includes(key)) {
      response[key] = service[key];
    }
  });
  return response;
}
function wellKnown(key) {
  key = normalizeKey(key.split("@").pop());
  return normalized[key] || false;
}

// node_modules/nodemailer/dist/esm/smtp-pool/index.js
var REQUEUE_BASE_DELAY = 50;
var REQUEUE_MAX_DELAY = 2e3;
var SMTPPool = class extends EventEmitter4 {
  constructor(options) {
    super();
    options = options || {};
    if (typeof options === "string") {
      options = {
        url: options
      };
    }
    let urlData;
    let service = options.service;
    if (typeof options.getSocket === "function") {
      this.getSocket = options.getSocket;
    }
    if (options.url) {
      urlData = parseConnectionUrl(options.url);
      service = service || urlData.service;
    }
    this.options = assign(
      false,
      // create new object
      options,
      // regular options
      urlData,
      // url options
      service && wellKnown(service)
      // wellknown options
    );
    this.options.maxConnections = this.options.maxConnections || 5;
    this.options.maxMessages = this.options.maxMessages || 100;
    this.options.maxRequeues = typeof this.options.maxRequeues === "number" ? this.options.maxRequeues : 5;
    this.logger = getLogger(this.options, {
      component: this.options.component || "smtp-pool"
    });
    this.name = "SMTP (pool)";
    this.version = version + "[client:" + version + "]";
    this._rateLimit = {
      counter: 0,
      timeout: null,
      waiting: [],
      checkpoint: false,
      delta: Number(this.options.rateDelta) || 1e3,
      limit: Number(this.options.rateLimit) || 0
    };
    this._closed = false;
    this._queue = [];
    this._connections = [];
    this._connectionCounter = 0;
    this.idling = true;
    setImmediate(() => {
      if (this.idling) {
        this.emit("idle");
      }
    });
  }
  /**
   * Placeholder function for creating proxy sockets. This method immediatelly returns
   * without a socket
   *
   * @param options Connection options
   * @param callback Callback function to run with the socket keys
   */
  getSocket(options, callback) {
    setImmediate(() => callback(null, false));
  }
  /**
   * Queues an e-mail to be sent using the selected settings
   *
   * @param mail Mail object
   * @param callback Callback function
   */
  send(mail, callback) {
    if (this._closed) {
      const err = new Error("Connection pool was closed");
      err.code = ECONNECTION;
      setImmediate(() => callback(err));
      return false;
    }
    this._queue.push({
      mail,
      requeueAttempts: 0,
      callback
    });
    if (this.idling && this._queue.length >= this.options.maxConnections) {
      this.idling = false;
    }
    setImmediate(() => this._processMessages());
    return true;
  }
  /**
   * Closes all connections in the pool. If there is a message being sent, the connection
   * is closed later
   */
  close() {
    let connection;
    const len = this._connections.length;
    this._closed = true;
    this._clearRateLimit();
    if (!len && !this._queue.length) {
      return;
    }
    for (let i = len - 1; i >= 0; i--) {
      if (this._connections[i] && this._connections[i].available) {
        connection = this._connections[i];
        connection.close();
        this.logger.info({
          tnx: "connection",
          cid: connection.id,
          action: "removed"
        }, "Connection #%s removed", connection.id);
      }
    }
    if (len && !this._connections.length) {
      this.logger.debug({
        tnx: "connection"
      }, "All connections removed");
    }
    if (!this._queue.length) {
      return;
    }
    const invokeCallbacks = () => {
      if (!this._queue.length) {
        this.logger.debug({
          tnx: "connection"
        }, "Pending queue entries cleared");
        return;
      }
      const entry = this._queue.shift();
      if (entry && typeof entry.callback === "function") {
        try {
          entry.callback(new Error("Connection pool was closed"));
        } catch (E) {
          this.logger.error({
            err: E,
            tnx: "callback"
          }, "Callback error: %s", E.message);
        }
      }
      setImmediate(invokeCallbacks);
    };
    setImmediate(invokeCallbacks);
  }
  /**
   * Check the queue and available connections. If there is a message to be sent and there is
   * an available connection, then use this connection to send the mail
   * @internal
   */
  _processMessages() {
    if (this._closed) {
      return;
    }
    if (!this._queue.length) {
      if (!this.idling) {
        this.idling = true;
        this.emit("idle");
      }
      return;
    }
    let connection = this._connections.find((c) => c.available);
    if (!connection && this._connections.length < this.options.maxConnections) {
      connection = this._createConnection();
    }
    if (!connection) {
      this.idling = false;
      return;
    }
    if (!this.idling && this._queue.length < this.options.maxConnections) {
      this.idling = true;
      this.emit("idle");
    }
    const entry = connection.queueEntry = this._queue.shift();
    entry.messageId = (connection.queueEntry.mail.message.getHeader("message-id") || "").replace(/[<>\s]/g, "");
    connection.available = false;
    this.logger.debug({
      tnx: "pool",
      cid: connection.id,
      messageId: entry.messageId,
      action: "assign"
    }, "Assigned message <%s> to #%s (%s)", entry.messageId, connection.id, connection.messages + 1);
    if (this._rateLimit.limit) {
      this._rateLimit.counter++;
      if (!this._rateLimit.checkpoint) {
        this._rateLimit.checkpoint = Date.now();
      }
    }
    connection.send(entry.mail, (err, info) => {
      if (entry === connection.queueEntry) {
        try {
          entry.callback(err, info);
        } catch (E) {
          this.logger.error({
            err: E,
            tnx: "callback",
            cid: connection.id
          }, "Callback error for #%s: %s", connection.id, E.message);
        }
        connection.queueEntry = false;
      }
    });
  }
  /**
   * Creates a new pool resource
   * @internal
   */
  _createConnection() {
    const connection = new PoolResource(this);
    connection.id = ++this._connectionCounter;
    this.logger.info({
      tnx: "pool",
      cid: connection.id,
      action: "conection"
    }, "Created new pool resource #%s", connection.id);
    connection.on("available", () => {
      this.logger.debug({
        tnx: "connection",
        cid: connection.id,
        action: "available"
      }, "Connection #%s became available", connection.id);
      if (this._closed) {
        this.close();
      } else {
        this._processMessages();
      }
    });
    connection.once("error", (err) => {
      if (err.code !== EMAXLIMIT) {
        this.logger.warn({
          err,
          tnx: "pool",
          cid: connection.id
        }, "Pool Error for #%s: %s", connection.id, err.message);
      } else {
        this.logger.debug({
          tnx: "pool",
          cid: connection.id,
          action: "maxlimit"
        }, "Max messages limit exchausted for #%s", connection.id);
      }
      if (connection.queueEntry) {
        try {
          connection.queueEntry.callback(err);
        } catch (E) {
          this.logger.error({
            err: E,
            tnx: "callback",
            cid: connection.id
          }, "Callback error for #%s: %s", connection.id, E.message);
        }
        connection.queueEntry = false;
      }
      this._removeConnection(connection);
      this._continueProcessing();
    });
    connection.once("close", () => {
      this.logger.info({
        tnx: "connection",
        cid: connection.id,
        action: "closed"
      }, "Connection #%s was closed", connection.id);
      this._removeConnection(connection);
      if (connection.queueEntry) {
        setTimeout(() => {
          let delay = 0;
          if (connection.queueEntry) {
            if (this._shouldRequeuOnConnectionClose(connection.queueEntry)) {
              delay = this._requeueEntryOnConnectionClose(connection);
            } else {
              this._failDeliveryOnConnectionClose(connection);
            }
          }
          if (delay) {
            setTimeout(() => this._continueProcessing(), delay);
          } else {
            this._continueProcessing();
          }
        }, 50);
      } else {
        if (!this._closed && this.idling && !this._connections.length) {
          this.emit("clear");
        }
        this._continueProcessing();
      }
    });
    this._connections.push(connection);
    return connection;
  }
  /** @internal */
  _shouldRequeuOnConnectionClose(queueEntry) {
    if (this.options.maxRequeues < 0) {
      return true;
    }
    return queueEntry.requeueAttempts < this.options.maxRequeues;
  }
  /** @internal */
  _failDeliveryOnConnectionClose(connection) {
    if (connection.queueEntry && connection.queueEntry.callback) {
      try {
        const err = new Error("Reached maximum number of retries after connection was closed");
        err.code = ECONNECTION;
        connection.queueEntry.callback(err);
      } catch (E) {
        this.logger.error({
          err: E,
          tnx: "callback",
          messageId: connection.queueEntry.messageId,
          cid: connection.id
        }, "Callback error for #%s: %s", connection.id, E.message);
      }
      connection.queueEntry = false;
    }
  }
  /** @internal */
  _requeueEntryOnConnectionClose(connection) {
    const delay = Math.min(REQUEUE_BASE_DELAY * 2 ** connection.queueEntry.requeueAttempts, REQUEUE_MAX_DELAY);
    connection.queueEntry.requeueAttempts += 1;
    this.logger.debug({
      tnx: "pool",
      cid: connection.id,
      messageId: connection.queueEntry.messageId,
      action: "requeue"
    }, "Re-queued message <%s> for #%s. Attempt: #%s", connection.queueEntry.messageId, connection.id, connection.queueEntry.requeueAttempts);
    this._queue.unshift(connection.queueEntry);
    connection.queueEntry = false;
    return delay;
  }
  /**
   * Continue to process message if the pool hasn't closed
   * @internal
   */
  _continueProcessing() {
    if (this._closed) {
      this.close();
    } else {
      setTimeout(() => this._processMessages(), 100);
    }
  }
  /**
   * Remove resource from pool
   *
   * @param connection The PoolResource to remove
   * @internal
   */
  _removeConnection(connection) {
    const index = this._connections.indexOf(connection);
    if (index !== -1) {
      this._connections.splice(index, 1);
    }
  }
  /**
   * Checks if connections have hit current rate limit and if so, queues the availability callback
   *
   * @param callback Callback function to run once rate limiter has been cleared
   * @internal
   */
  _checkRateLimit(callback) {
    if (!this._rateLimit.limit) {
      return callback();
    }
    const now = Date.now();
    if (this._rateLimit.counter < this._rateLimit.limit) {
      return callback();
    }
    this._rateLimit.waiting.push(callback);
    if (this._rateLimit.checkpoint <= now - this._rateLimit.delta) {
      return this._clearRateLimit();
    }
    if (!this._rateLimit.timeout) {
      this._rateLimit.timeout = setTimeout(() => this._clearRateLimit(), this._rateLimit.delta - (now - this._rateLimit.checkpoint));
      this._rateLimit.checkpoint = now;
    }
  }
  /**
   * Clears current rate limit limitation and runs paused callback
   * @internal
   */
  _clearRateLimit() {
    clearTimeout(this._rateLimit.timeout);
    this._rateLimit.timeout = null;
    this._rateLimit.counter = 0;
    this._rateLimit.checkpoint = false;
    while (this._rateLimit.waiting.length) {
      const cb = this._rateLimit.waiting.shift();
      setImmediate(cb);
    }
  }
  /**
   * Returns true if there are free slots in the queue
   */
  isIdle() {
    return this.idling;
  }
  verify(callback) {
    let promise;
    if (!callback) {
      promise = new Promise((resolve3, reject) => {
        callback = callbackPromise(resolve3, reject);
      });
    }
    const done = callback;
    const auth = new PoolResource(this).auth;
    this.getSocket(this.options, (err, socketOptions) => {
      if (err) {
        return done(err);
      }
      let options = this.options;
      if (socketOptions && socketOptions.connection) {
        this.logger.info({
          tnx: "proxy",
          remoteAddress: socketOptions.connection.remoteAddress,
          remotePort: socketOptions.connection.remotePort,
          destHost: options.host || "",
          destPort: options.port || "",
          action: "connected"
        }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
        options = Object.assign(assign(false, options), socketOptions);
      }
      const connection = new smtp_connection_default(options);
      let returned = false;
      connection.once("error", (err2) => {
        if (returned) {
          return;
        }
        returned = true;
        connection.close();
        return done(err2);
      });
      connection.once("end", () => {
        if (returned) {
          return;
        }
        returned = true;
        return done(new Error("Connection closed"));
      });
      const finalize = () => {
        if (returned) {
          return;
        }
        returned = true;
        connection.quit();
        return done(null, true);
      };
      connection.connect((err2) => {
        if (returned) {
          return;
        }
        if (err2) {
          returned = true;
          connection.close();
          return done(err2);
        }
        if (auth && (connection.allowsAuth || options.forceAuth)) {
          connection.login(auth, (err3) => {
            if (returned) {
              return;
            }
            if (err3) {
              returned = true;
              connection.close();
              return done(err3);
            }
            finalize();
          });
        } else if (!auth && connection.allowsAuth && options.forceAuth) {
          const err3 = new Error("Authentication info was not provided");
          err3.code = ENOAUTH;
          returned = true;
          connection.close();
          return done(err3);
        } else {
          finalize();
        }
      });
    });
    return promise;
  }
};
var smtp_pool_default = SMTPPool;

// node_modules/nodemailer/dist/esm/smtp-transport/index.js
import { EventEmitter as EventEmitter5 } from "node:events";
var SMTPTransport = class extends EventEmitter5 {
  constructor(options) {
    super();
    options = options || {};
    if (typeof options === "string") {
      options = {
        url: options
      };
    }
    let urlData;
    let service = options.service;
    if (typeof options.getSocket === "function") {
      this.getSocket = options.getSocket;
    }
    if (options.url) {
      urlData = parseConnectionUrl(options.url);
      service = service || urlData.service;
    }
    this.options = assign(
      false,
      // create new object
      options,
      // regular options
      urlData,
      // url options
      service && wellKnown(service)
      // wellknown options
    );
    this.logger = getLogger(this.options, {
      component: this.options.component || "smtp-transport"
    });
    this.name = "SMTP";
    this.version = version + "[client:" + version + "]";
    if (this.options.auth) {
      this.auth = this.getAuth({});
    }
  }
  /**
   * Placeholder function for creating proxy sockets. This method immediatelly returns
   * without a socket
   *
   * @param options Connection options
   * @param callback Callback function to run with the socket keys
   */
  getSocket(options, callback) {
    setImmediate(() => callback(null, false));
  }
  getAuth(authOpts) {
    if (!authOpts) {
      if (this.auth && this.auth.oauth2 && this.mailer) {
        this.auth.oauth2.provisionCallback = this.mailer.get("oauth2_provision_cb") || this.auth.oauth2.provisionCallback;
      }
      return this.auth;
    }
    const authData = Object.assign({}, this.options.auth && typeof this.options.auth === "object" ? this.options.auth : {}, typeof authOpts === "object" ? authOpts : {});
    if (Object.keys(authData).length === 0) {
      return false;
    }
    switch ((authData.type || "").toString().toUpperCase()) {
      case "OAUTH2": {
        if (!authData.service && !authData.user) {
          return false;
        }
        const oauth2 = new xoauth2_default(authData, this.logger);
        oauth2.provisionCallback = this.mailer && this.mailer.get("oauth2_provision_cb") || oauth2.provisionCallback;
        oauth2.on("token", (token) => this.mailer.emit("token", token));
        oauth2.on("error", (err) => this.emit("error", err));
        return {
          type: "OAUTH2",
          user: authData.user,
          oauth2,
          method: "XOAUTH2"
        };
      }
      default:
        return {
          type: (authData.type || "").toString().toUpperCase() || "LOGIN",
          user: authData.user,
          credentials: {
            user: authData.user || "",
            pass: authData.pass,
            options: authData.options
          },
          method: (authData.method || "").trim().toUpperCase() || this.options.authMethod || false
        };
    }
  }
  /**
   * Sends an e-mail using the selected settings
   *
   * @param mail Mail object
   * @param callback Callback function
   */
  send(mail, callback) {
    this.getSocket(this.options, (err, socketOptions) => {
      if (err) {
        return callback(err);
      }
      let returned = false;
      let options = this.options;
      if (socketOptions && socketOptions.connection) {
        this.logger.info({
          tnx: "proxy",
          remoteAddress: socketOptions.connection.remoteAddress,
          remotePort: socketOptions.connection.remotePort,
          destHost: options.host || "",
          destPort: options.port || "",
          action: "connected"
        }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
        options = Object.assign(assign(false, options), socketOptions);
      }
      const connection = new smtp_connection_default(options);
      let perCallAuth;
      const cleanupPerCallAuth = () => {
        if (perCallAuth && perCallAuth !== this.auth && perCallAuth.oauth2) {
          perCallAuth.oauth2.removeAllListeners();
        }
        perCallAuth = null;
      };
      connection.once("error", (err2) => {
        if (returned) {
          return;
        }
        returned = true;
        cleanupPerCallAuth();
        connection.close();
        return callback(err2);
      });
      const sendMessage = () => {
        const envelope = mail.message.getEnvelope();
        const messageId = mail.message.messageId();
        const recipients = [].concat(envelope.to || []);
        if (recipients.length > 3) {
          recipients.push("...and " + recipients.splice(2).length + " more");
        }
        if (mail.data.dsn) {
          envelope.dsn = mail.data.dsn;
        }
        if (mail.data.requireTLSExtensionEnabled) {
          envelope.requireTLSExtensionEnabled = mail.data.requireTLSExtensionEnabled;
        }
        this.logger.info({
          tnx: "send",
          messageId
        }, "Sending message %s to <%s>", messageId, recipients.join(", "));
        connection.send(envelope, mail.message.createReadStream(), (err2, info) => {
          if (returned) {
            return;
          }
          returned = true;
          cleanupPerCallAuth();
          connection.close();
          if (err2) {
            this.logger.error({
              err: err2,
              tnx: "send"
            }, "Send error for %s: %s", messageId, err2.message);
            return callback(err2);
          }
          info.envelope = {
            from: envelope.from,
            to: envelope.to
          };
          info.messageId = messageId;
          try {
            return callback(null, info);
          } catch (E) {
            this.logger.error({
              err: E,
              tnx: "callback"
            }, "Callback error for %s: %s", messageId, E.message);
          }
        });
      };
      connection.connect((err2) => {
        if (returned) {
          return;
        }
        if (err2) {
          returned = true;
          connection.close();
          return callback(err2);
        }
        perCallAuth = this.getAuth(mail.data.auth);
        if (perCallAuth && (connection.allowsAuth || options.forceAuth)) {
          connection.login(perCallAuth, (err3) => {
            cleanupPerCallAuth();
            if (returned) {
              return;
            }
            if (err3) {
              returned = true;
              connection.close();
              return callback(err3);
            }
            sendMessage();
          });
        } else {
          sendMessage();
        }
      });
    });
  }
  verify(callback) {
    let promise;
    if (!callback) {
      promise = new Promise((resolve3, reject) => {
        callback = callbackPromise(resolve3, reject);
      });
    }
    const done = callback;
    this.getSocket(this.options, (err, socketOptions) => {
      if (err) {
        return done(err);
      }
      let options = this.options;
      if (socketOptions && socketOptions.connection) {
        this.logger.info({
          tnx: "proxy",
          remoteAddress: socketOptions.connection.remoteAddress,
          remotePort: socketOptions.connection.remotePort,
          destHost: options.host || "",
          destPort: options.port || "",
          action: "connected"
        }, "Using proxied socket from %s:%s to %s:%s", socketOptions.connection.remoteAddress, socketOptions.connection.remotePort, options.host || "", options.port || "");
        options = Object.assign(assign(false, options), socketOptions);
      }
      const connection = new smtp_connection_default(options);
      let returned = false;
      let perCallAuth;
      const cleanupPerCallAuth = () => {
        if (perCallAuth && perCallAuth !== this.auth && perCallAuth.oauth2) {
          perCallAuth.oauth2.removeAllListeners();
        }
        perCallAuth = null;
      };
      connection.once("error", (err2) => {
        if (returned) {
          return;
        }
        returned = true;
        cleanupPerCallAuth();
        connection.close();
        return done(err2);
      });
      connection.once("end", () => {
        if (returned) {
          return;
        }
        returned = true;
        cleanupPerCallAuth();
        return done(new Error("Connection closed"));
      });
      const finalize = () => {
        if (returned) {
          return;
        }
        returned = true;
        cleanupPerCallAuth();
        connection.quit();
        return done(null, true);
      };
      connection.connect((err2) => {
        if (returned) {
          return;
        }
        if (err2) {
          returned = true;
          connection.close();
          return done(err2);
        }
        perCallAuth = this.getAuth({});
        if (perCallAuth && (connection.allowsAuth || options.forceAuth)) {
          connection.login(perCallAuth, (err3) => {
            cleanupPerCallAuth();
            if (returned) {
              return;
            }
            if (err3) {
              returned = true;
              connection.close();
              return done(err3);
            }
            finalize();
          });
        } else if (!perCallAuth && connection.allowsAuth && options.forceAuth) {
          const err3 = new Error("Authentication info was not provided");
          err3.code = ENOAUTH;
          returned = true;
          cleanupPerCallAuth();
          connection.close();
          return done(err3);
        } else {
          finalize();
        }
      });
    });
    return promise;
  }
  /**
   * Releases resources
   */
  close() {
    if (this.auth && this.auth.oauth2) {
      this.auth.oauth2.removeAllListeners();
    }
    this.emit("close");
  }
};
var smtp_transport_default = SMTPTransport;

// node_modules/nodemailer/dist/esm/sendmail-transport/index.js
import { spawn } from "node:child_process";
var SendmailTransport = class {
  constructor(options) {
    options = options || {};
    this._spawn = spawn;
    this.options = options;
    this.name = "Sendmail";
    this.version = version;
    this.path = "sendmail";
    this.args = false;
    this.logger = getLogger(this.options, {
      component: this.options.component || "sendmail"
    });
    if (typeof options === "string") {
      this.path = options;
    } else if (typeof options === "object") {
      if (options.path) {
        this.path = options.path;
      }
      if (Array.isArray(options.args)) {
        this.args = options.args;
      }
    }
    this.winbreak = ["win", "windows", "dos", "\r\n"].includes((options.newline || "").toString().toLowerCase());
  }
  /**
   * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
   *
   * @param mail MailComposer object
   * @param done Callback function to run when the sending is completed
   */
  send(mail, done) {
    mail.message.keepBcc = true;
    const envelope = mail.message.getEnvelope();
    const messageId = mail.message.messageId();
    let returned;
    const hasInvalidAddresses = [].concat(envelope.from || []).concat(envelope.to || []).some((addr) => /^"?-/.test(addr));
    if (hasInvalidAddresses) {
      const err = new Error("Can not send mail. Invalid envelope addresses.");
      err.code = ESENDMAIL;
      return done(err);
    }
    const args = this.args ? ["-i"].concat(this.args).concat(envelope.to) : ["-i"].concat(envelope.from ? ["-f", envelope.from] : []).concat(envelope.to);
    const callback = (err) => {
      if (returned) {
        return;
      }
      returned = true;
      if (typeof done === "function") {
        if (err) {
          return done(err);
        }
        return done(null, {
          envelope,
          messageId,
          response: "Messages queued for delivery"
        });
      }
    };
    let sendmail;
    try {
      sendmail = this._spawn(this.path, args);
    } catch (E) {
      this.logger.error({
        err: E,
        tnx: "spawn",
        messageId
      }, "Error occurred while spawning sendmail. %s", E.message);
      return callback(E);
    }
    if (sendmail) {
      sendmail.on("error", (err) => {
        this.logger.error({
          err,
          tnx: "spawn",
          messageId
        }, "Error occurred when sending message %s. %s", messageId, err.message);
        callback(err);
      });
      sendmail.once("exit", (code) => {
        if (!code) {
          return callback();
        }
        const err = new Error(code === 127 ? "Sendmail command not found, process exited with code " + code : "Sendmail exited with code " + code);
        err.code = ESENDMAIL;
        this.logger.error({
          err,
          tnx: "stdin",
          messageId
        }, "Error sending message %s to sendmail. %s", messageId, err.message);
        callback(err);
      });
      sendmail.once("close", callback);
      sendmail.stdin.on("error", (err) => {
        this.logger.error({
          err,
          tnx: "stdin",
          messageId
        }, "Error occurred when piping message %s to sendmail. %s", messageId, err.message);
        callback(err);
      });
      const recipients = [].concat(envelope.to || []);
      if (recipients.length > 3) {
        recipients.push("...and " + recipients.splice(2).length + " more");
      }
      this.logger.info({
        tnx: "send",
        messageId
      }, "Sending message %s to <%s>", messageId, recipients.join(", "));
      const sourceStream = mail.message.createReadStream();
      let stream = sourceStream;
      if (this.options.newline) {
        stream = sourceStream.pipe(this.winbreak ? new LeWindows() : new LeUnix());
        sourceStream.once("error", (err) => stream.emit("error", err));
      }
      stream.once("error", (err) => {
        this.logger.error({
          err,
          tnx: "stdin",
          messageId
        }, "Error occurred when generating message %s. %s", messageId, err.message);
        sendmail.kill("SIGINT");
        callback(err);
      });
      stream.pipe(sendmail.stdin);
    } else {
      const err = new Error("sendmail was not found");
      err.code = ESENDMAIL;
      return callback(err);
    }
  }
};
var sendmail_transport_default = SendmailTransport;

// node_modules/nodemailer/dist/esm/stream-transport/index.js
var StreamTransport = class {
  constructor(options) {
    options = options || {};
    this.options = options;
    this.name = "StreamTransport";
    this.version = version;
    this.logger = getLogger(this.options, {
      component: this.options.component || "stream-transport"
    });
    this.winbreak = ["win", "windows", "dos", "\r\n"].includes((options.newline || "").toString().toLowerCase());
  }
  /**
   * Compiles a mailcomposer message and forwards it to handler that sends it
   *
   * @param mail MailComposer object
   * @param done Callback function to run when the sending is completed
   */
  send(mail, done) {
    mail.message.keepBcc = true;
    const envelope = mail.message.getEnvelope();
    const messageId = mail.message.messageId();
    const recipients = [].concat(envelope.to || []);
    if (recipients.length > 3) {
      recipients.push("...and " + recipients.splice(2).length + " more");
    }
    this.logger.info({
      tnx: "send",
      messageId
    }, "Sending message %s to <%s> using %s line breaks", messageId, recipients.join(", "), this.winbreak ? "<CR><LF>" : "<LF>");
    setImmediate(() => {
      let stream;
      try {
        stream = mail.message.createReadStream();
        if (this.options.newline) {
          const sourceStream = stream;
          stream = sourceStream.pipe(this.winbreak ? new LeWindows() : new LeUnix());
          sourceStream.once("error", (err) => stream.emit("error", err));
        }
      } catch (E) {
        this.logger.error({
          err: E,
          tnx: "send",
          messageId
        }, "Creating send stream failed for %s. %s", messageId, E.message);
        return done(E);
      }
      if (!this.options.buffer) {
        stream.once("error", (err) => {
          this.logger.error({
            err,
            tnx: "send",
            messageId
          }, "Failed creating message for %s. %s", messageId, err.message);
        });
        return done(null, {
          envelope,
          messageId,
          message: stream
        });
      }
      const chunks = [];
      let chunklen = 0;
      stream.on("readable", () => {
        let chunk;
        while ((chunk = stream.read()) !== null) {
          chunks.push(chunk);
          chunklen += chunk.length;
        }
      });
      stream.once("error", (err) => {
        this.logger.error({
          err,
          tnx: "send",
          messageId
        }, "Failed creating message for %s. %s", messageId, err.message);
        return done(err);
      });
      stream.on("end", () => done(null, {
        envelope,
        messageId,
        message: Buffer.concat(chunks, chunklen)
      }));
    });
  }
};
var stream_transport_default = StreamTransport;

// node_modules/nodemailer/dist/esm/json-transport/index.js
var JSONTransport = class {
  constructor(options) {
    options = options || {};
    this.options = options;
    this.name = "JSONTransport";
    this.version = version;
    this.logger = getLogger(this.options, {
      component: this.options.component || "json-transport"
    });
  }
  /**
   * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
   *
   * @param mail MailComposer object
   * @param done Callback function to run when the sending is completed
   */
  send(mail, done) {
    mail.message.keepBcc = true;
    const envelope = mail.message.getEnvelope();
    const messageId = mail.message.messageId();
    const recipients = [].concat(envelope.to || []);
    if (recipients.length > 3) {
      recipients.push("...and " + recipients.splice(2).length + " more");
    }
    this.logger.info({
      tnx: "send",
      messageId
    }, "Composing JSON structure of %s to <%s>", messageId, recipients.join(", "));
    setImmediate(() => {
      mail.normalize((err, data) => {
        if (err) {
          this.logger.error({
            err,
            tnx: "send",
            messageId
          }, "Failed building JSON structure for %s. %s", messageId, err.message);
          return done(err);
        }
        delete data.envelope;
        delete data.normalizedHeaders;
        return done(null, {
          envelope,
          messageId,
          message: this.options.skipEncoding ? data : JSON.stringify(data)
        });
      });
    });
  }
};
var json_transport_default = JSONTransport;

// node_modules/nodemailer/dist/esm/ses-transport/index.js
import EventEmitter6 from "node:events";
function tagSesError(err) {
  if (err && typeof err === "object" && !err.code) {
    err.code = ESES;
  }
  return err;
}
var SESTransport = class extends EventEmitter6 {
  constructor(options) {
    super();
    if (!options || !options.SES || !options.SES.sesClient) {
      const error2 = new Error("Missing SES configuration, expecting { sesClient, SendEmailCommand } from @aws-sdk/client-sesv2, see https://nodemailer.com/transports/ses/");
      error2.code = ECONFIG;
      throw error2;
    }
    this.options = options;
    this.ses = this.options.SES;
    this.name = "SESTransport";
    this.version = version;
    this.logger = getLogger(this.options, {
      component: this.options.component || "ses-transport"
    });
  }
  getRegion(cb) {
    if (this.ses.sesClient.config && typeof this.ses.sesClient.config.region === "function") {
      this.ses.sesClient.config.region().then((region) => cb(null, region), (err) => cb(err));
      return;
    }
    return cb(null, false);
  }
  /**
   * Compiles a mailcomposer message and forwards it to SES
   *
   * @param mail MailComposer object
   * @param callback Callback function to run when the sending is completed
   */
  send(mail, callback) {
    let fromHeader = mail.message._headers.find((header) => /^from$/i.test(header.key));
    if (fromHeader) {
      const mimeNode = new mime_node_default("text/plain");
      fromHeader = mimeNode._convertAddresses(mimeNode._parseAddresses(fromHeader.value));
    }
    const envelope = mail.message.getEnvelope();
    const messageId = mail.message.messageId();
    const recipients = [].concat(envelope.to || []);
    if (recipients.length > 3) {
      recipients.push("...and " + recipients.splice(2).length + " more");
    }
    this.logger.info({
      tnx: "send",
      messageId
    }, "Sending message %s to <%s>", messageId, recipients.join(", "));
    const getRawMessage = (next) => {
      if (!mail.data._dkim) {
        mail.data._dkim = {};
      }
      if (mail.data._dkim.skipFields && typeof mail.data._dkim.skipFields === "string") {
        mail.data._dkim.skipFields += ":date:message-id";
      } else {
        mail.data._dkim.skipFields = "date:message-id";
      }
      const sourceStream = mail.message.createReadStream();
      const stream = sourceStream.pipe(new LeWindows());
      const chunks = [];
      let chunklen = 0;
      stream.on("readable", () => {
        let chunk;
        while ((chunk = stream.read()) !== null) {
          chunks.push(chunk);
          chunklen += chunk.length;
        }
      });
      sourceStream.once("error", (err) => stream.emit("error", err));
      stream.once("error", (err) => next(err));
      stream.once("end", () => next(null, Buffer.concat(chunks, chunklen)));
    };
    setImmediate(() => getRawMessage((err, raw) => {
      if (err) {
        this.logger.error({
          err,
          tnx: "send",
          messageId
        }, "Failed creating message for %s. %s", messageId, err.message);
        return callback(err);
      }
      const sesMessage = copyOwnKeys({
        Content: {
          Raw: {
            // required
            Data: raw
            // required
          }
        },
        FromEmailAddress: fromHeader || envelope.from,
        Destination: {
          ToAddresses: envelope.to
        }
      }, mail.data.ses);
      this.getRegion((err2, region) => {
        if (err2 || !region) {
          region = "us-east-1";
        }
        let sendPromise;
        try {
          const command = new this.ses.SendEmailCommand(sesMessage);
          sendPromise = this.ses.sesClient.send(command);
        } catch (err3) {
          tagSesError(err3);
          this.logger.error({
            err: err3,
            tnx: "send"
          }, "Send error for %s: %s", messageId, err3.message);
          setImmediate(() => callback(err3));
          return;
        }
        sendPromise.then((data) => {
          if (region === "us-east-1") {
            region = "email";
          }
          const info = {
            envelope: {
              from: envelope.from,
              to: envelope.to
            },
            messageId: "<" + data.MessageId + (!/@/.test(data.MessageId) ? "@" + region + ".amazonses.com" : "") + ">",
            response: data.MessageId,
            raw
          };
          setImmediate(() => callback(null, info));
        }).catch((err3) => {
          tagSesError(err3);
          this.logger.error({
            err: err3,
            tnx: "send"
          }, "Send error for %s: %s", messageId, err3.message);
          setImmediate(() => callback(err3));
        });
      });
    }));
  }
  verify(callback) {
    let promise;
    if (!callback) {
      promise = new Promise((resolve3, reject) => {
        callback = callbackPromise(resolve3, reject);
      });
    }
    const done = callback;
    const cb = (err) => {
      if (err && !["InvalidParameterValue", "MessageRejected"].includes(err.code || err.Code || err.name)) {
        return done(tagSesError(err));
      }
      return done(null, true);
    };
    const sesMessage = {
      Content: {
        Raw: {
          Data: Buffer.from("From: <invalid@invalid>\r\nTo: <invalid@invalid>\r\n Subject: Invalid\r\n\r\nInvalid")
        }
      },
      FromEmailAddress: "invalid@invalid",
      Destination: {
        ToAddresses: ["invalid@invalid"]
      }
    };
    this.getRegion(() => {
      let sendPromise;
      try {
        const command = new this.ses.SendEmailCommand(sesMessage);
        sendPromise = this.ses.sesClient.send(command);
      } catch (err) {
        setImmediate(() => cb(err));
        return;
      }
      sendPromise.then(() => setImmediate(() => cb(null))).catch((err) => setImmediate(() => cb(err)));
    });
    return promise;
  }
};
var ses_transport_default = SESTransport;

// node_modules/nodemailer/dist/esm/nodemailer.js
var ETHEREAL_API = (process.env.ETHEREAL_API || "https://api.nodemailer.com").replace(/\/+$/, "");
var ETHEREAL_WEB = (process.env.ETHEREAL_WEB || "https://ethereal.email").replace(/\/+$/, "");
var ETHEREAL_API_KEY = (process.env.ETHEREAL_API_KEY || "").replace(/\s*/g, "") || null;
var ETHEREAL_CACHE = ["true", "yes", "y", "1"].includes((process.env.ETHEREAL_CACHE || "yes").toString().trim().toLowerCase());
var testAccount = false;
function createTransport(transporter, defaults) {
  let options;
  if (
    // provided transporter is a configuration object, not transporter plugin
    typeof transporter === "object" && typeof transporter.send !== "function" || // provided transporter looks like a connection url
    typeof transporter === "string" && /^(smtps?|direct):/i.test(transporter)
  ) {
    const urlConfig = typeof transporter === "string" ? transporter : transporter.url;
    if (urlConfig) {
      const parsed = parseConnectionUrl(urlConfig);
      options = typeof transporter === "object" ? assign(false, copyOwnKeys({}, transporter, (key) => key === "url"), parsed) : parsed;
    } else {
      options = transporter;
    }
    if (options.pool) {
      transporter = new smtp_pool_default(options);
    } else if (options.sendmail) {
      transporter = new sendmail_transport_default(options);
    } else if (options.streamTransport) {
      transporter = new stream_transport_default(options);
    } else if (options.jsonTransport) {
      transporter = new json_transport_default(options);
    } else if (options.SES) {
      const ses = options.SES;
      if (ses.ses && ses.aws) {
        const error2 = new Error("Using legacy SES configuration, expecting @aws-sdk/client-sesv2, see https://nodemailer.com/transports/ses/");
        error2.code = ECONFIG;
        throw error2;
      }
      transporter = new ses_transport_default(options);
    } else {
      transporter = new smtp_transport_default(options);
    }
  }
  return new mailer_default(transporter, options, defaults);
}
function createTestAccount(apiUrl, callback) {
  let promise;
  if (!callback && typeof apiUrl === "function") {
    callback = apiUrl;
    apiUrl = false;
  }
  if (!callback) {
    promise = new Promise((resolve3, reject) => {
      callback = callbackPromise(resolve3, reject);
    });
  }
  const done = callback;
  if (ETHEREAL_CACHE && testAccount) {
    setImmediate(() => done(null, testAccount));
    return promise;
  }
  apiUrl = apiUrl || ETHEREAL_API;
  const chunks = [];
  let chunklen = 0;
  const requestHeaders = {};
  const requestBody = {
    requestor: name,
    version
  };
  if (ETHEREAL_API_KEY) {
    requestHeaders.Authorization = "Bearer " + ETHEREAL_API_KEY;
  }
  const fetchOptions = {
    contentType: "application/json",
    method: "POST",
    headers: requestHeaders,
    body: Buffer.from(JSON.stringify(requestBody))
  };
  if (/^https:/i.test(apiUrl)) {
    fetchOptions.tls = { rejectUnauthorized: true };
  }
  const req = fetch_default(apiUrl + "/user", fetchOptions);
  req.on("readable", () => {
    let chunk;
    while ((chunk = req.read()) !== null) {
      chunks.push(chunk);
      chunklen += chunk.length;
    }
  });
  req.once("error", (err) => done(err));
  req.once("end", () => {
    const res = Buffer.concat(chunks, chunklen);
    let data;
    try {
      data = JSON.parse(res.toString());
    } catch (E) {
      return done(E);
    }
    if (data.status !== "success" || data.error) {
      return done(new Error(data.error || "Request failed"));
    }
    delete data.status;
    testAccount = data;
    done(null, testAccount);
  });
  return promise;
}
function getTestMessageUrl(info) {
  if (!info || !info.response) {
    return false;
  }
  const infoProps = /* @__PURE__ */ new Map();
  const response = info.response.toString();
  if (response.length > 2 && response.charAt(response.length - 1) === "]") {
    const open = response.indexOf("[", response.lastIndexOf("]", response.length - 2) + 1);
    if (open >= 0 && open < response.length - 2) {
      const props = response.substring(open + 1, response.length - 1);
      props.replace(/\b([A-Z0-9]+)=([^\s]+)/g, (m, key, value) => {
        infoProps.set(key, value);
        return m;
      });
    }
  }
  if (infoProps.has("STATUS") && infoProps.has("MSGID")) {
    return (testAccount && testAccount.web || ETHEREAL_WEB) + "/message/" + infoProps.get("MSGID");
  }
  return false;
}
var nodemailer = {
  createTransport,
  createTestAccount,
  getTestMessageUrl
};
var nodemailer_default = nodemailer;

// demo-data.json
var demo_data_default = {
  livelli: [
    "Home Training Beginner",
    "Entry Level",
    "Level 1",
    "Level 2",
    "Advanced",
    "PRO",
    "Approfondimenti ed extra"
  ],
  ordine_livelli: [
    {
      nome_livello: "Home Training Beginner",
      numero_ordine: 1
    },
    {
      nome_livello: "Entry Level",
      numero_ordine: 2
    },
    {
      nome_livello: "Level 1",
      numero_ordine: 3
    },
    {
      nome_livello: "Level 2",
      numero_ordine: 4
    },
    {
      nome_livello: "Advanced",
      numero_ordine: 5
    },
    {
      nome_livello: "PRO",
      numero_ordine: 6
    },
    {
      nome_livello: "Approfondimenti ed extra",
      numero_ordine: 7
    }
  ],
  database_esercizi: [
    {
      id: 1,
      id_esercizio: "001",
      nome_reale: "skierg regular",
      attrezzo: "skierg",
      pattern_biomeccanico: "cerniera d'anca, flessione del tronco su piano sagittale",
      ruolo: "engine, benchmark",
      tag_biomeccanici: "cerniera d'anca, flessione del tronco su piano sagittale \u2022 Warm Up, Attivazione Core, Piano Sagittale, Cerniera d'anca, Catena Cinetica Chiusa, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 2,
      id_esercizio: "002",
      nome_reale: "skierg pagaia mono",
      attrezzo: "skierg",
      pattern_biomeccanico: "stabilizzazione anca e core in pattern biomeccanico funzonale",
      ruolo: "engine",
      tag_biomeccanici: "stabilizzazione anca e core in pattern biomeccanico funzonale \u2022 Warm Up, Attivazione Core, Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 3,
      id_esercizio: "003",
      nome_reale: "skierg pagaia alternato",
      attrezzo: "skierg",
      pattern_biomeccanico: "stabilizzazione anca e core in pattern biomeccanico funzonale",
      ruolo: "engine",
      tag_biomeccanici: "stabilizzazione anca e core in pattern biomeccanico funzonale \u2022 Warm Up, Attivazione Core, Piano Sagittale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Metcon, Potenza Anaerobica,  Recupero Attivo",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 4,
      id_esercizio: "004",
      nome_reale: "skierg wood chopper",
      attrezzo: "skierg",
      pattern_biomeccanico: "stabilizzazione core in pattern biomeccanico funzonale",
      ruolo: "engine",
      tag_biomeccanici: "stabilizzazione core in pattern biomeccanico funzonale \u2022 Warm Up, Attivazione Core, Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 5,
      id_esercizio: "005",
      nome_reale: "skyerg manipoli alternato",
      attrezzo: "skierg",
      pattern_biomeccanico: "stabilizzazione core in trasferimento di carico",
      ruolo: "engine",
      tag_biomeccanici: "stabilizzazione core in trasferimento di carico \u2022 Warm Up, Attivazione Core, Piano Sagittale, Catena Cinetica Chiusa, Metcon, Potenza Anaerobica, Recupero Attivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 6,
      id_esercizio: "006",
      nome_reale: "skyerg manipoli regular",
      attrezzo: "skierg",
      pattern_biomeccanico: "cerniera d'anca, flessione del tronco su piano sagittale",
      ruolo: "engine",
      tag_biomeccanici: "cerniera d'anca, flessione del tronco su piano sagittale \u2022 Warm Up, Attivazione Core, Piano Sagittale, Cerniera d'anca, Catena Cinetica Chiusa, Metcon, Potenza Anaerobica, Recupero Attivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 7,
      id_esercizio: "007",
      nome_reale: "Coiled skyerg",
      attrezzo: "skierg",
      pattern_biomeccanico: "integrazione di tutte le linee ed i vettori di forza in un movimento spiralizzato",
      ruolo: "engine",
      tag_biomeccanici: "integrazione di tutte le linee ed i vettori di forza in un movimento spiralizzato \u2022 Warm Up, Attivazione Core, Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/hML7iVaIBaU",
      data_pubblicazione: null
    },
    {
      id: 8,
      id_esercizio: "008",
      nome_reale: "Skyerg superman row",
      attrezzo: "skierg",
      pattern_biomeccanico: "tirata verticale in quadrupedia",
      ruolo: "engine",
      tag_biomeccanici: "tirata verticale in quadrupedia \u2022 Warm Up, Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/faS9d_MgHfY",
      data_pubblicazione: null
    },
    {
      id: 9,
      id_esercizio: "009",
      nome_reale: "Proximal Walk salita",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Coordinazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 10,
      id_esercizio: "010",
      nome_reale: "Run",
      attrezzo: "treadmill meccanico curvo",
      pattern_biomeccanico: "corsa su treadmill meccanico curvo",
      ruolo: "engine, benchmark",
      tag_biomeccanici: "corsa su treadmill meccanico curvo \u2022 Warm Up, Multi-planare, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 11,
      id_esercizio: "011",
      nome_reale: "Air bike regular",
      attrezzo: "airbike",
      pattern_biomeccanico: "pedalare con movimento di spinta e trazione simultaneo delle braccia",
      ruolo: "engine, benchmark",
      tag_biomeccanici: "pedalare con movimento di spinta e trazione simultaneo delle braccia \u2022 Warm Up, Cool Down, Piano Sagittale, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 12,
      id_esercizio: "012",
      nome_reale: "ripetute in salita",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Cerniera d'anca, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 13,
      id_esercizio: "013",
      nome_reale: "camminata in salita",
      attrezzo: "treadmill frenato inclinato",
      pattern_biomeccanico: "camminata",
      ruolo: "engine",
      tag_biomeccanici: "camminata \u2022 Warm Up, Multi-planare, Capacit\xE0 Aerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 14,
      id_esercizio: "014",
      nome_reale: "corsa in salita",
      attrezzo: "treadmill meccanico in pendenza frenato",
      pattern_biomeccanico: "corsa",
      ruolo: "engine",
      tag_biomeccanici: "corsa \u2022 Multi-planare, Cerniera d'anca, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 15,
      id_esercizio: "015",
      nome_reale: "spingere in salita",
      attrezzo: "tapiroulant in salita frenato con funzionalit\xE0 di slitta",
      pattern_biomeccanico: "spingere slitta in salita",
      ruolo: "engine",
      tag_biomeccanici: "spingere slitta in salita \u2022 Warm Up, Attivazione Core, Piano Sagittale, Metcon",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 16,
      id_esercizio: "016",
      nome_reale: "Trainare in salita",
      attrezzo: "tapiroulant in salita frenato con funzionalit\xE0 di slitta",
      pattern_biomeccanico: "trainare slitta in salita (esercizio monolaterale)",
      ruolo: "engine",
      tag_biomeccanici: "trainare slitta in salita (esercizio monolaterale) \u2022 Warm Up, Attivazione Core, Connessione Controlaterale, Metcon",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 17,
      id_esercizio: "017",
      nome_reale: "Throwing",
      attrezzo: "palla",
      pattern_biomeccanico: "lancio, ciclcico",
      ruolo: null,
      tag_biomeccanici: "lancio, ciclcico \u2022 Warm Up, Multi-planare, Vettore Orizzontale, Spinta Orizzontale, Catene Crociate, Coordinazione",
      link_video: "https://youtu.be/71q-IETqjVU?si=ukbP7dUAlyQVdfZv",
      data_pubblicazione: null
    },
    {
      id: 18,
      id_esercizio: "018",
      nome_reale: "Wall Mobility Series",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Routine Mobilit\xE0, Multi-planare",
      link_video: "https://youtu.be/1mQ2JBcbdb0",
      data_pubblicazione: null
    },
    {
      id: 19,
      id_esercizio: "019",
      nome_reale: "Ground mobility Series",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Routine Mobilit\xE0, Multi-planare",
      link_video: "https://youtu.be/3wZjPvwGt8U",
      data_pubblicazione: null
    },
    {
      id: 20,
      id_esercizio: "020",
      nome_reale: "Butt Scoots",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Attivazione Core",
      link_video: "https://youtu.be/D2lFalo9z7Y?si=kYg6Vce2-yDhimKA",
      data_pubblicazione: null
    },
    {
      id: 21,
      id_esercizio: "021",
      nome_reale: "Band hip Circuit",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "abduzione ed flessione di anca",
      ruolo: null,
      tag_biomeccanici: "abduzione ed flessione di anca \u2022 Warm Up",
      link_video: "https://youtu.be/jiVtzTAmp40",
      data_pubblicazione: null
    },
    {
      id: 22,
      id_esercizio: "022",
      nome_reale: "Coiled Cable Punch",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "coordinazione alto basso, core stability in spinta monolaterale, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "coordinazione alto basso, core stability in spinta monolaterale, cerniera d'anca \u2022 Warm Up, Attivazione Core, Multi-planare, Vettore Orizzontale, Spinta Orizzontale, Connessione Controlaterale, Catena Cinetica Chiusa, Coordinazione",
      link_video: "https://youtu.be/tk8i-CdxQVI",
      data_pubblicazione: null
    },
    {
      id: 23,
      id_esercizio: "023",
      nome_reale: "Coiled Cable ROW",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "coordinazione alto basso, core stability in trazione monolaterale, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "coordinazione alto basso, core stability in trazione monolaterale, cerniera d'anca \u2022 Warm Up, Attivazione Core, Multi-planare, Vettore Orizzontale,  Trazione Orizzontale, Connessione Controlaterale, Catena Cinetica Chiusa, Coordinazione",
      link_video: "https://youtu.be/OdhNUbqajmM",
      data_pubblicazione: null
    },
    {
      id: 24,
      id_esercizio: "024",
      nome_reale: "Flag Bearer ISOINERZIALE",
      attrezzo: "isoinerziale",
      pattern_biomeccanico: "core stablity in estensione catene crociate e spirali",
      ruolo: "complementare",
      tag_biomeccanici: "core stablity in estensione catene crociate e spirali \u2022 Warm Up, Attivazione Core, Multi-planare, Catena Cinetica Chiusa",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 25,
      id_esercizio: "025",
      nome_reale: "Side Closing",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "flessione laterale del bacino sul torace",
      ruolo: null,
      tag_biomeccanici: "flessione laterale del bacino sul torace \u2022 Warm Up, Attivazione Core, Multi-planare, Trazione Verticale, Catena Cinetica Chiusa",
      link_video: "https://youtu.be/Z9bhpmPIRkM",
      data_pubblicazione: null
    },
    {
      id: 26,
      id_esercizio: "026",
      nome_reale: "Diagonal Band Deadlift",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "cerniera d'anca, estensione d'anca, attivazione catena estensoria crociata posteriore",
      ruolo: null,
      tag_biomeccanici: "cerniera d'anca, estensione d'anca, attivazione catena estensoria crociata posteriore \u2022 Warm Up, Attivazione Core, Multi-planare, Cerniera d'anca, Catena Cinetica Chiusa",
      link_video: "https://youtu.be/taxFYzgpVcw?si=iMiQonXmrhFei3Ch",
      data_pubblicazione: null
    },
    {
      id: 27,
      id_esercizio: "027",
      nome_reale: "Neutral Band Deadlift",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "cerniera d'anca, estensione d'anca, attivazione catena estensoria posteriore",
      ruolo: null,
      tag_biomeccanici: "cerniera d'anca, estensione d'anca, attivazione catena estensoria posteriore \u2022 Warm Up, Attivazione Core, Piano Sagittale, Cerniera d'anca, Catena Cinetica Chiusa",
      link_video: "https://youtu.be/4BHPu3MJLtY?si=ZAsrF_mYh2aUxSiy",
      data_pubblicazione: null
    },
    {
      id: 28,
      id_esercizio: "028",
      nome_reale: "Transverse hold",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "core stablity in piedi",
      ruolo: "complementare",
      tag_biomeccanici: "core stablity in piedi \u2022 Warm Up, Attivazione Core, Piano Trasverso, Stability, Tensione Strutturale, Catena Cinetica Chiusa",
      link_video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
      data_pubblicazione: null
    },
    {
      id: 29,
      id_esercizio: "029",
      nome_reale: "Ground Stretch",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "routine di esercizi completa",
      ruolo: null,
      tag_biomeccanici: "routine di esercizi completa \u2022 Warm Up, Piano Frontale, Multi-planare",
      link_video: "https://youtube.com/shorts/2mSUTq--DY0",
      data_pubblicazione: null
    },
    {
      id: 30,
      id_esercizio: "030",
      nome_reale: "Wall Stretch",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "routine di esercizi completa",
      ruolo: null,
      tag_biomeccanici: "routine di esercizi completa \u2022 Warm Up, Piano Frontale, Multi-planare",
      link_video: "https://youtube.com/shorts/w4QFxA9AZZc",
      data_pubblicazione: null
    },
    {
      id: 31,
      id_esercizio: "031",
      nome_reale: "Cobra to Down dog",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "stretching catena flessoria anteriore e ischiocrurali",
      ruolo: null,
      tag_biomeccanici: "stretching catena flessoria anteriore e ischiocrurali \u2022 Warm Up, Attivazione Core, Piano Sagittale",
      link_video: "https://youtube.com/shorts/JNLhhxNDkZs?si=IxpjFs4F8j3EOv0m",
      data_pubblicazione: null
    },
    {
      id: 32,
      id_esercizio: "032",
      nome_reale: "Cat-cow",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "mobilit\xE0 sul piano sagittale del rachide",
      ruolo: null,
      tag_biomeccanici: "mobilit\xE0 sul piano sagittale del rachide \u2022 Warm Up, Attivazione Core, Piano Sagittale, Cool Down",
      link_video: "https://youtube.com/shorts/EBQD1Sha26k?si=VlMRufJ_KWHm-_V1",
      data_pubblicazione: null
    },
    {
      id: 33,
      id_esercizio: "033",
      nome_reale: "Coiled Cobra",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "mobilit\xE0 anche, allungamento catena flessoria anteriore",
      ruolo: null,
      tag_biomeccanici: "mobilit\xE0 anche, allungamento catena flessoria anteriore \u2022 Warm Up, Multi-planare",
      link_video: "https://youtube.com/shorts/GU3ePuvJwMk",
      data_pubblicazione: null
    },
    {
      id: 34,
      id_esercizio: "034",
      nome_reale: "air bike solo braccia",
      attrezzo: "airbike",
      pattern_biomeccanico: "airbike con utilizzo delle sole braccia",
      ruolo: "engine",
      tag_biomeccanici: "airbike con utilizzo delle sole braccia \u2022 Warm Up, Spinta Orizzontale, Catena Cinetica Chiusa, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 35,
      id_esercizio: "035",
      nome_reale: "camminare",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Cool Down, Multi-planare, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 36,
      id_esercizio: "036",
      nome_reale: "Coiled Blade Position",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Tensione Strutturale, Catena Cinetica Chiusa, Isometria, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/1TqeXn-0Heo",
      data_pubblicazione: null
    },
    {
      id: 37,
      id_esercizio: "037",
      nome_reale: "Slamball Coiled Blade Position",
      attrezzo: "slamball, elastico",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Torsione, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtu.be/3uWc_xe1Zng",
      data_pubblicazione: null
    },
    {
      id: 38,
      id_esercizio: "038",
      nome_reale: "Rotational Blade Position",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Torsione, Catena Cinetica Chiusa, Trasferimento di Carico, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtu.be/aYG1nCXnzXs",
      data_pubblicazione: null
    },
    {
      id: 39,
      id_esercizio: "039",
      nome_reale: "Slam bal blade pos. dynamic",
      attrezzo: "slamball, elastico",
      pattern_biomeccanico: "cerniera d'anca, affondo, posizione coiled",
      ruolo: null,
      tag_biomeccanici: "cerniera d'anca, affondo, posizione coiled \u2022 Warm Up, Multi-planare, Cerniera d'anca, Torsione, Catena Cinetica Aperta, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/d9ffrlkNlIM",
      data_pubblicazione: null
    },
    {
      id: 40,
      id_esercizio: "040",
      nome_reale: "Screwdriver",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Tensione Strutturale, Catena Cinetica Chiusa, Trasferimento di Carico, Potenza Esplosiva, Metcon, Fulcro Fisso",
      link_video: "https://youtu.be/K65DsIr4nZw",
      data_pubblicazione: null
    },
    {
      id: 41,
      id_esercizio: "041",
      nome_reale: "Screwdriver Lunges",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Affondo, Torsione, Catena Cinetica Chiusa, Trasferimento di Carico, Forza Massimale, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/tR6uYjLvWZ8",
      data_pubblicazione: null
    },
    {
      id: 42,
      id_esercizio: "042",
      nome_reale: "Push the wall squat",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "accosciata, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "accosciata, cerniera d'anca \u2022 Warm Up, Multi-planare, Accosciata, Cerniera d'anca, Catena Cinetica Chiusa",
      link_video: "https://youtube.com/shorts/3a_ww0jGYsM",
      data_pubblicazione: null
    },
    {
      id: 43,
      id_esercizio: "043",
      nome_reale: "Pounce squat",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, simmetrico, accosciata",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, simmetrico, accosciata \u2022 Warm Up, Accosciata, Cerniera d'anca, Tensione Strutturale, Catena Cinetica Chiusa, Forza Massimale, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtu.be/X6q8nfv76Hs",
      data_pubblicazione: null
    },
    {
      id: 44,
      id_esercizio: "044",
      nome_reale: "Coiled Reverse Lunge",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, asimmetrico, affondo",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, asimmetrico, affondo \u2022 Warm Up, Multi-planare, Affondo, Torsione, Catena Cinetica Chiusa, Forza Massimale, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/I6ArgFBvg9Y",
      data_pubblicazione: null
    },
    {
      id: 45,
      id_esercizio: "045",
      nome_reale: "Landmine rotational Lunges",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, asimmetrico, ciclico",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, asimmetrico, ciclico \u2022 Warm Up, Multi-planare, Affondo, Torsione, Catena Cinetica Chiusa, Trasferimento di Carico, Forza Massimale, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/6w04XI9evxI",
      data_pubblicazione: null
    },
    {
      id: 46,
      id_esercizio: "046",
      nome_reale: "Split Switch Screwdriver",
      attrezzo: "landmine",
      pattern_biomeccanico: "gioco di gambe, flessione laterale della colonna, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "gioco di gambe, flessione laterale della colonna, cerniera d'anca \u2022 Warm Up, Multi-planare, Tensione Strutturale, Catena Cinetica Chiusa, Trasferimento di Carico, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/CJ0EctEmVQ0",
      data_pubblicazione: null
    },
    {
      id: 47,
      id_esercizio: "047",
      nome_reale: "wall driver",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "cerniera d'anca, spinta controlaterale da terra sul muro",
      ruolo: null,
      tag_biomeccanici: "cerniera d'anca, spinta controlaterale da terra sul muro \u2022 Warm Up, Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Fulcro Fisso",
      link_video: "https://youtu.be/wh3rTdnTxFc",
      data_pubblicazione: null
    },
    {
      id: 48,
      id_esercizio: "048",
      nome_reale: "Lockout Position",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Catena Cinetica Chiusa, Fulcro Fisso",
      link_video: "https://youtu.be/QRu_O3qf6SI",
      data_pubblicazione: null
    },
    {
      id: 49,
      id_esercizio: "049",
      nome_reale: "Step/Step back press",
      attrezzo: "landmine",
      pattern_biomeccanico: "spinta verticale",
      ruolo: null,
      tag_biomeccanici: "spinta verticale \u2022 Warm Up, Multi-planare, Spinta Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtu.be/UDMiSEEzIc4",
      data_pubblicazione: null
    },
    {
      id: 50,
      id_esercizio: "050",
      nome_reale: "Split Jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Multi-planare, Spinta Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Trasferimento di Carico, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/zIqsjVRtc5o",
      data_pubblicazione: null
    },
    {
      id: 51,
      id_esercizio: "051",
      nome_reale: "High hand switch",
      attrezzo: "landmine",
      pattern_biomeccanico: "gioco di gambe, coordinazione alto-basso",
      ruolo: null,
      tag_biomeccanici: "gioco di gambe, coordinazione alto-basso \u2022 Warm Up, Multi-planare, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtu.be/xpdmnY_MB6w",
      data_pubblicazione: null
    },
    {
      id: 52,
      id_esercizio: "052",
      nome_reale: "Dumbell Jerk",
      attrezzo: "manubri",
      pattern_biomeccanico: "spinta verticale, asimmetrico, affondo",
      ruolo: "complementare",
      tag_biomeccanici: "spinta verticale, asimmetrico, affondo \u2022 Warm Up, Multi-planare, Spinta Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Catene Crociate, Potenza Esplosiva, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/P0bx4BySQcU",
      data_pubblicazione: null
    },
    {
      id: 53,
      id_esercizio: "053",
      nome_reale: "Split C&J Touch & Go",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, spinta verticale",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, spinta verticale \u2022 Warm Up, Multi-planare, Spinta Verticale, Cerniera d'anca, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/HWcYpmL1Q9o?feature=share",
      data_pubblicazione: null
    },
    {
      id: 54,
      id_esercizio: "054",
      nome_reale: "Landmine press Cross Step",
      attrezzo: "landmine",
      pattern_biomeccanico: "flessione laterale della colonna, spinta verticale",
      ruolo: null,
      tag_biomeccanici: "flessione laterale della colonna, spinta verticale \u2022 Warm Up, Multi-planare, Spinta Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Trasferimento di Carico, Potenza Esplosiva, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/qvoz4TITY7s?si=QFDcXDPuLMZht54m",
      data_pubblicazione: null
    },
    {
      id: 55,
      id_esercizio: "055",
      nome_reale: "Hang Position ISO",
      attrezzo: "landmine",
      pattern_biomeccanico: "acosciata asimmatrica, tenuta isometrica, trazione verticale dal basso",
      ruolo: null,
      tag_biomeccanici: "acosciata asimmatrica, tenuta isometrica, trazione verticale dal basso \u2022 Isometria, Multi-planare, Trazione Verticale, Tensione Strutturale, Connessione Controlaterale, Catene Crociate, Forza Massimale, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/43Rx4Up-zZg",
      data_pubblicazione: null
    },
    {
      id: 56,
      id_esercizio: "056",
      nome_reale: "Landmine coiled Deadlift",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso, asimmetrico",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso, asimmetrico \u2022 Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catene Crociate, Forza Massimale, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/q8pfMEqSrm8",
      data_pubblicazione: null
    },
    {
      id: 57,
      id_esercizio: "057",
      nome_reale: "Landmine Step Clean",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/puBOJfw5u18",
      data_pubblicazione: null
    },
    {
      id: 58,
      id_esercizio: "058",
      nome_reale: "Landmine split clean",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/puBOJfw5u18",
      data_pubblicazione: null
    },
    {
      id: 59,
      id_esercizio: "059",
      nome_reale: "Split Clean and Jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: "spinta verticale, asimmetrico, due tempi",
      ruolo: "fondamentale",
      tag_biomeccanici: "spinta verticale, asimmetrico, due tempi \u2022 Multi-planare, Spinta Verticale, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/K7mbQ__p5pE",
      data_pubblicazione: null
    },
    {
      id: 60,
      id_esercizio: "060",
      nome_reale: "Band Hip circuit",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Attivazione Core, Piano Frontale, Catena Cinetica Chiusa, Catena Cinetica Aperta",
      link_video: "https://youtu.be/jiVtzTAmp40",
      data_pubblicazione: null
    },
    {
      id: 61,
      id_esercizio: "061",
      nome_reale: "Kettlebell Step clean",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso \u2022 Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Catene Crociate, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtu.be/DajheBayHjc",
      data_pubblicazione: null
    },
    {
      id: 62,
      id_esercizio: "062",
      nome_reale: "Landmine clean NO DOWN",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Plyometrics, Metcon, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/puBOJfw5u18",
      data_pubblicazione: null
    },
    {
      id: 63,
      id_esercizio: "063",
      nome_reale: "Landmine Clean and jerk NO DOWN",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, spinta verticale",
      ruolo: "engine",
      tag_biomeccanici: "cerniera d'anca, spinta verticale \u2022 Multi-planare, Cerniera d'anca, Spinta Verticale, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Plyometrics, Metcon, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/uLuFsjb8Ako",
      data_pubblicazione: null
    },
    {
      id: 64,
      id_esercizio: "064",
      nome_reale: "High Pull ISO",
      attrezzo: "landmine",
      pattern_biomeccanico: "trazione verticale dal basso, tenuta isometrica, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "trazione verticale dal basso, tenuta isometrica, cerniera d'anca \u2022 Warm Up, Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Isometria, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/Fsi34_9SXTU",
      data_pubblicazione: null
    },
    {
      id: 65,
      id_esercizio: "065",
      nome_reale: "High Pull",
      attrezzo: "landmine",
      pattern_biomeccanico: "trazione verticcal dal basso, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "trazione verticcal dal basso, cerniera d'anca \u2022 Warm Up, Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/Fsi34_9SXTU",
      data_pubblicazione: null
    },
    {
      id: 66,
      id_esercizio: "066",
      nome_reale: "High pull Step press",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Spinta Verticale, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/_Dqau_BcAls",
      data_pubblicazione: null
    },
    {
      id: 67,
      id_esercizio: "067",
      nome_reale: "High Pull to Step back press",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Spinta Verticale, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/D3RwNa-ADwY",
      data_pubblicazione: null
    },
    {
      id: 68,
      id_esercizio: "068",
      nome_reale: "Step Snatch",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/oiXFbv8X_B0",
      data_pubblicazione: null
    },
    {
      id: 69,
      id_esercizio: "069",
      nome_reale: "Split Snatch",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, asimmetrico, trazione verticale dal basso, lancio verticale",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, asimmetrico, trazione verticale dal basso, lancio verticale \u2022 Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtu.be/oiXFbv8X_B0",
      data_pubblicazione: null
    },
    {
      id: 70,
      id_esercizio: "070",
      nome_reale: "Dumbbell Split Snatch",
      attrezzo: "manubri",
      pattern_biomeccanico: "trazione verticale dal basso, affondo, cerniera d'anca",
      ruolo: "complementare",
      tag_biomeccanici: "trazione verticale dal basso, affondo, cerniera d'anca \u2022 Multi-planare, Spinta Verticale, Catena Cinetica Aperta, Catene Crociate, Potenza Esplosiva, Metcon, Potenza Anaerobica, Carico Asimmetrico",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 71,
      id_esercizio: "071",
      nome_reale: "Slamball coiled Skater's hops",
      attrezzo: "slamball",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Spostamento Laterale, Catena Cinetica Aperta, Potenza Esplosiva, Plyometrics, Carico Asimmetrico",
      link_video: "https://youtu.be/b3MFp94lCpU?si=_HipW6yr48Xfb4S0",
      data_pubblicazione: null
    },
    {
      id: 72,
      id_esercizio: "072",
      nome_reale: "Lateral Band clean",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "traslitterazione laterale, flessione laterale del rachide",
      ruolo: "complementare",
      tag_biomeccanici: "traslitterazione laterale, flessione laterale del rachide \u2022 Multi-planare, Spostamento Laterale, Catena Cinetica Aperta",
      link_video: "https://youtube.com/shorts/jtpzvqZ5xsQ",
      data_pubblicazione: null
    },
    {
      id: 73,
      id_esercizio: "073",
      nome_reale: "Lateral landmine clean",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, traslazione laterale, trazione verticale dal basso",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, traslazione laterale, trazione verticale dal basso \u2022 Multi-planare, Spostamento Laterale, Catena Cinetica Chiusa, Potenza Esplosiva, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/HO3_5xnwLmQ?feature=share",
      data_pubblicazione: null
    },
    {
      id: 74,
      id_esercizio: "074",
      nome_reale: "Side move",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "traslazione laterale",
      ruolo: null,
      tag_biomeccanici: "traslazione laterale \u2022 Warm Up, Multi-planare, Spostamento Laterale, Footwork, Catena Cinetica Aperta, Trasferimento di Carico, Plyometrics, Metcon",
      link_video: "https://youtu.be/ISkSG5yXhrU?si=aQYlqWHqyaE5nWL_",
      data_pubblicazione: null
    },
    {
      id: 75,
      id_esercizio: "075",
      nome_reale: "One arm press",
      attrezzo: "manubri",
      pattern_biomeccanico: "spinta verticale, asimmetrico",
      ruolo: "complementare",
      tag_biomeccanici: "spinta verticale, asimmetrico \u2022 Multi-planare, Spinta Verticale, Connessione Controlaterale, Forza Massimale, Carico Asimmetrico",
      link_video: "https://youtu.be/V-5Q4l-SM20",
      data_pubblicazione: null
    },
    {
      id: 76,
      id_esercizio: "076",
      nome_reale: "Push the wall row",
      attrezzo: "manubri",
      pattern_biomeccanico: "trazione verticale dal basso",
      ruolo: "complementare",
      tag_biomeccanici: "trazione verticale dal basso \u2022 Multi-planare, Trazione Verticale, Connessione Controlaterale, Forza Massimale, Carico Asimmetrico",
      link_video: "https://youtu.be/kEfEfmFUtQ4",
      data_pubblicazione: null
    },
    {
      id: 77,
      id_esercizio: "077",
      nome_reale: "Coiled Punch iso.",
      attrezzo: "isoinerziale",
      pattern_biomeccanico: "core stablity catene crociate e spirali in spinta monolaterale",
      ruolo: "complementare",
      tag_biomeccanici: "core stablity catene crociate e spirali in spinta monolaterale \u2022 Multi-planare, Spinta Orizzontale, Connessione Controlaterale",
      link_video: "https://youtube.com/shorts/mifz_6oZJlw",
      data_pubblicazione: null
    },
    {
      id: 78,
      id_esercizio: "078",
      nome_reale: "pull up Progressioni",
      attrezzo: "sbarra, anelli, TRX",
      pattern_biomeccanico: "estensione dell'omero sul piano sagittale in trazione",
      ruolo: "fondamentale",
      tag_biomeccanici: "estensione dell'omero sul piano sagittale in trazione \u2022 Piano Sagittale, Trazione Verticale, Catena Cinetica Chiusa, Forza Massimale, Fulcro Fisso",
      link_video: "https://youtu.be/nSj7QKBbvWA?si=fGWg_soHjRYO0xex",
      data_pubblicazione: null
    },
    {
      id: 79,
      id_esercizio: "079",
      nome_reale: "Bench press",
      attrezzo: "bilanciere",
      pattern_biomeccanico: "spinta orizzontale",
      ruolo: "fondamentale",
      tag_biomeccanici: "spinta orizzontale \u2022 Piano Sagittale, Spinta Orizzontale, Catena Cinetica Aperta, Forza Massimale",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 80,
      id_esercizio: "080",
      nome_reale: "Coiled Bench Row",
      attrezzo: "manubri",
      pattern_biomeccanico: "trazione verticale dal basso",
      ruolo: "complementare",
      tag_biomeccanici: "trazione verticale dal basso \u2022 Piano Sagittale, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Forza Massimale, Carico Asimmetrico",
      link_video: "https://youtu.be/2gCslk95r20",
      data_pubblicazione: null
    },
    {
      id: 81,
      id_esercizio: "081",
      nome_reale: "Meadow Row",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca asimmetrico, trazione verticale dal basso",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca asimmetrico, trazione verticale dal basso \u2022 Piano Sagittale, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Forza Massimale, Potenza Esplosiva, Metcon, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/aQOQKxucveA",
      data_pubblicazione: null
    },
    {
      id: 82,
      id_esercizio: "082",
      nome_reale: "Landmine Biker's Squat",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, asimmetrico, accosciata",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, asimmetrico, accosciata \u2022 Multi-planare, Cerniera d'anca, Connessione Controlaterale, Catena Cinetica Chiusa, Forza Massimale, Potenza Esplosiva, Metcon, Fulcro Fisso, Carico Asimmetrico, Tensione Strutturale",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 83,
      id_esercizio: "083",
      nome_reale: "Landmine press side step",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Spinta Verticale, Spinta Orizzontale, Connessione Controlaterale, Catena Cinetica Chiusa, Forza Massimale, Potenza Esplosiva, Metcon, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/y-Y_KnO0tY8?si=XCeLrysxaI-Y9fFd",
      data_pubblicazione: null
    },
    {
      id: 84,
      id_esercizio: "084",
      nome_reale: "Kneeling Transition over head press",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca asimmetrico, spinta verticale",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca asimmetrico, spinta verticale \u2022 Multi-planare, Spinta Verticale, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Potenza Esplosiva, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/Y-2AeFnKQLY",
      data_pubblicazione: null
    },
    {
      id: 85,
      id_esercizio: "085",
      nome_reale: "Landmine biceps curl",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Piano Sagittale, Spinta Verticale, Catena Cinetica Chiusa, Forza Massimale, Carico Asimmetrico, Tensione Strutturale, Coordinazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 86,
      id_esercizio: "086",
      nome_reale: "Power Coiled plank progressioni",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "core training",
      ruolo: "complementare a tutto",
      tag_biomeccanici: "core training \u2022 Attivazione Core, Multi-planare, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/n2BF9Za0WcU",
      data_pubblicazione: null
    },
    {
      id: 87,
      id_esercizio: "087",
      nome_reale: "banded hollow March (solo gambe)",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "core strenght, flessoestensione di anca, supino",
      ruolo: null,
      tag_biomeccanici: "core strenght, flessoestensione di anca, supino \u2022 Attivazione Core, Multi-planare, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/BiXLybXd-EA?si=ixnXudoESc_GSm69",
      data_pubblicazione: null
    },
    {
      id: 88,
      id_esercizio: "088",
      nome_reale: "Hollow March progressioni",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Attivazione Core, Multi-planare, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/6y8yrBMcXZE",
      data_pubblicazione: null
    },
    {
      id: 89,
      id_esercizio: "089",
      nome_reale: "Deadbug",
      attrezzo: "slamball",
      pattern_biomeccanico: "core training catene crociate",
      ruolo: "accessorio",
      tag_biomeccanici: "core training catene crociate \u2022 Attivazione Core, Multi-planare, Metcon",
      link_video: "https://youtu.be/b4InDUstH8Y?si=NP68qp2ACf_YIo2-",
      data_pubblicazione: null
    },
    {
      id: 90,
      id_esercizio: "090",
      nome_reale: "dragon flag progressioni",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "core training",
      ruolo: "complementare a tutto",
      tag_biomeccanici: "core training \u2022 Attivazione Core, Multi-planare",
      link_video: "https://youtu.be/LjHUx2MFcR8",
      data_pubblicazione: null
    },
    {
      id: 91,
      id_esercizio: "091",
      nome_reale: "Elbow Spiderman Toe Tap",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "core training",
      ruolo: "complementare a tutto",
      tag_biomeccanici: "core training \u2022 Attivazione Core, Multi-planare",
      link_video: "https://youtu.be/ktgDSN7EnhI",
      data_pubblicazione: null
    },
    {
      id: 92,
      id_esercizio: "092",
      nome_reale: "Bicycle Crunches",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "core training",
      ruolo: "complementare a tutto",
      tag_biomeccanici: "core training \u2022 Attivazione Core, Multi-planare, Metcon",
      link_video: "https://youtu.be/xOPJ8yPmf5A",
      data_pubblicazione: null
    },
    {
      id: 93,
      id_esercizio: "093",
      nome_reale: "Pallof Press con elastico",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "core stablity in piedi",
      ruolo: "complementare",
      tag_biomeccanici: "core stablity in piedi \u2022 Attivazione Core, Piano Trasverso",
      link_video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
      data_pubblicazione: null
    },
    {
      id: 94,
      id_esercizio: "094",
      nome_reale: "Transverse twist",
      attrezzo: "elastico o cavo",
      pattern_biomeccanico: "core stablity in rotazione su piano trasverso",
      ruolo: "complementare",
      tag_biomeccanici: "core stablity in rotazione su piano trasverso \u2022 Attivazione Core, Piano Trasverso",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 95,
      id_esercizio: "095",
      nome_reale: "Yin yang sit up press",
      attrezzo: "manubri",
      pattern_biomeccanico: "core strenght, spinta verticale asimmetrica",
      ruolo: "complementare",
      tag_biomeccanici: "core strenght, spinta verticale asimmetrica \u2022 Attivazione Core, Forza Massimale, Multi-planare, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/arECYW5JFeA",
      data_pubblicazione: null
    },
    {
      id: 96,
      id_esercizio: "096",
      nome_reale: "coiled Ax Sit up",
      attrezzo: "manubri",
      pattern_biomeccanico: "core strenght, spinta verticale asimmetrica",
      ruolo: "complementare",
      tag_biomeccanici: "core strenght, spinta verticale asimmetrica \u2022 Attivazione Core, Multi-planare, Metcon",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 97,
      id_esercizio: "097",
      nome_reale: "Endless rope Plank Alternating Pull",
      attrezzo: "endless rope",
      pattern_biomeccanico: "core training in trazione verticale monolaterale alternato",
      ruolo: "accessrio",
      tag_biomeccanici: "core training in trazione verticale monolaterale alternato \u2022 Forza Massimale, Multi-planare, Metcon, Potenza Anaerobica, Attivazione Core",
      link_video: "https://youtube.com/shorts/gcgilJEmzks",
      data_pubblicazione: null
    },
    {
      id: 98,
      id_esercizio: "098",
      nome_reale: "Avenger Blade passing",
      attrezzo: "landmine",
      pattern_biomeccanico: "gioco di gambe, flessione laterale della colonna",
      ruolo: null,
      tag_biomeccanici: "gioco di gambe, flessione laterale della colonna \u2022 Piano Sagittale, Affondo, Salto, Footwork, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Carico Asimmetrico, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/q9I2aChhPI8",
      data_pubblicazione: null
    },
    {
      id: 99,
      id_esercizio: "099",
      nome_reale: "Landmine quick Hops",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca \u2022 Piano Sagittale, Accosciata, Salto, Catena Cinetica Chiusa, Potenza Esplosiva, Metcon, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/pjwXBZ-vwD8",
      data_pubblicazione: null
    },
    {
      id: 100,
      id_esercizio: "100",
      nome_reale: "Speed skater touch",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "traslazione laterale",
      ruolo: "engine",
      tag_biomeccanici: "traslazione laterale \u2022 Warm Up, Multi-planare, Spostamento Laterale, Footwork, Catena Cinetica Aperta, Trasferimento di Carico, Plyometrics, Metcon, Potenza Esplosiva",
      link_video: "https://youtube.com/shorts/94IOklfsdws",
      data_pubblicazione: null
    },
    {
      id: 101,
      id_esercizio: "101",
      nome_reale: "Sprinter Push up",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "spinta orizzontale, cerniera d'anca",
      ruolo: "fondamentale",
      tag_biomeccanici: "spinta orizzontale, cerniera d'anca \u2022 Piano Sagittale, Spinta Orizzontale, Tensione Strutturale, Catena Cinetica Chiusa, Potenza Esplosiva, Metcon, Salto, Propedeutica alla Corsa, Stability",
      link_video: "https://youtube.com/shorts/r3P7Q1NJ06w",
      data_pubblicazione: null
    },
    {
      id: 102,
      id_esercizio: "102",
      nome_reale: "jumping rope",
      attrezzo: "jumping rope",
      pattern_biomeccanico: null,
      ruolo: "engine, benchmark",
      tag_biomeccanici: "Warm Up, Metcon, Catena Cinetica Aperta, Plyometrics, Footwork, Piano Sagittale, Capacit\xE0 Aerobica, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 103,
      id_esercizio: "103",
      nome_reale: "Heavy ROPE - race & chase",
      attrezzo: "heavy rope",
      pattern_biomeccanico: "rope flow",
      ruolo: "complementare",
      tag_biomeccanici: "rope flow \u2022 rope flow, Warm Up, Metcon, Attivazione Core, Multi-planare, Catena Cinetica Aperta, Coordinazione, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/sb5dZL9uA4w?si=mY1_OZy85wG29BYa",
      data_pubblicazione: null
    },
    {
      id: 104,
      id_esercizio: "104",
      nome_reale: "Overhand Matadors Wheel",
      attrezzo: "heavy rope",
      pattern_biomeccanico: "rope flow",
      ruolo: "complementare",
      tag_biomeccanici: "rope flow \u2022 rope flow, Warm Up, Metcon, Attivazione Core, Multi-planare, Catena Cinetica Aperta, Coordinazione, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/7dzFrsIVT7Q?si=8CfEDPP5L0mXNdHD",
      data_pubblicazione: null
    },
    {
      id: 105,
      id_esercizio: "105",
      nome_reale: "Underhand Matadors Wheel",
      attrezzo: "heavy rope",
      pattern_biomeccanico: "rope flow",
      ruolo: "complementare",
      tag_biomeccanici: "rope flow \u2022 rope flow, Warm Up, Metcon, Attivazione Core, Multi-planare, Catena Cinetica Aperta, Coordinazione, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/QDYnAATZuKc?si=BpQLXXXqB0_bA6Ng",
      data_pubblicazione: null
    },
    {
      id: 106,
      id_esercizio: "106",
      nome_reale: "Dragon Roll",
      attrezzo: "heavy rope",
      pattern_biomeccanico: "rope flow",
      ruolo: "complementare",
      tag_biomeccanici: "rope flow \u2022 rope flow, Warm Up, Metcon, Attivazione Core, Multi-planare, Catena Cinetica Aperta, Coordinazione, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/I3Jpk2S2bRE?si=IkQQs9ghbHbBufWV",
      data_pubblicazione: null
    },
    {
      id: 107,
      id_esercizio: "107",
      nome_reale: "underhand Sneak",
      attrezzo: "heavy rope",
      pattern_biomeccanico: "rope flow",
      ruolo: "complementare",
      tag_biomeccanici: "rope flow \u2022 rope flow, Warm Up, Metcon, Attivazione Core, Multi-planare, Catena Cinetica Aperta, Coordinazione, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/9IwTU7BGQlk?si=L3vOU6YwqEIO9QMD",
      data_pubblicazione: null
    },
    {
      id: 108,
      id_esercizio: "108",
      nome_reale: "overhand sneak",
      attrezzo: "heavy rope",
      pattern_biomeccanico: "rope flow",
      ruolo: "complementare",
      tag_biomeccanici: "rope flow \u2022 rope flow, Warm Up, Metcon, Attivazione Core, Multi-planare, Catena Cinetica Aperta, Coordinazione, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/Q9oc9fPb7Io?si=1aF3yA5jZFZ6EC1Y",
      data_pubblicazione: null
    },
    {
      id: 109,
      id_esercizio: "109",
      nome_reale: "in in-out out",
      attrezzo: "speed ladder",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtu.be/m4Yue9gwuFI?si=vUIuI3JqUYzBArCo",
      data_pubblicazione: null
    },
    {
      id: 110,
      id_esercizio: "110",
      nome_reale: "quarter turn",
      attrezzo: "speed ladder",
      pattern_biomeccanico: null,
      ruolo: "engine",
      tag_biomeccanici: "Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtu.be/dHdkUOXReAg?si=1vy8SoA6m-gMlISn",
      data_pubblicazione: null
    },
    {
      id: 111,
      id_esercizio: "111",
      nome_reale: "Heisman Shuffle",
      attrezzo: "speed ladder",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtu.be/jkUolZmHrwU?si=yQz2o5ZM1cHiqR4C",
      data_pubblicazione: null
    },
    {
      id: 112,
      id_esercizio: "112",
      nome_reale: "Icky shuffle variato",
      attrezzo: "speed ladder",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtu.be/WhQhJEpE954?si=lXQ_QPAE6xA-aJ4D",
      data_pubblicazione: null
    },
    {
      id: 113,
      id_esercizio: "113",
      nome_reale: "180\xB0 rotation jump",
      attrezzo: "speed ladder",
      pattern_biomeccanico: null,
      ruolo: "engine",
      tag_biomeccanici: "Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtu.be/aLmeiMhBcHM?si=yZ5RqyGw8po0TSDz",
      data_pubblicazione: null
    },
    {
      id: 114,
      id_esercizio: "114",
      nome_reale: "Skier touch",
      attrezzo: "speed ladder",
      pattern_biomeccanico: null,
      ruolo: "engine",
      tag_biomeccanici: "Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtu.be/jnfXQENDS_Y?si=APIWYmnPikpQmPhs",
      data_pubblicazione: null
    },
    {
      id: 115,
      id_esercizio: "115",
      nome_reale: "in in-out out sprawl",
      attrezzo: "speed ladder",
      pattern_biomeccanico: "saltelli, agility, footwork",
      ruolo: "accessorio",
      tag_biomeccanici: "saltelli, agility, footwork \u2022 Warm Up, Footwork, Plyometrics, Agilit\xE0, Metcon, Propedeutica alla Corsa",
      link_video: "https://youtube.com/shorts/TE_KtwU4WIE",
      data_pubblicazione: null
    },
    {
      id: 116,
      id_esercizio: "116",
      nome_reale: "High pull bounce",
      attrezzo: "landmine",
      pattern_biomeccanico: "trazione verticale dal basso, trasferimento di carico",
      ruolo: "accessorio",
      tag_biomeccanici: "trazione verticale dal basso, trasferimento di carico \u2022 Multi-planare, Cerniera d'anca, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/CWhiOuTGmjQ",
      data_pubblicazione: null
    },
    {
      id: 117,
      id_esercizio: "117",
      nome_reale: "Landmine quick Hops",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Cerniera d'anca, Accosciata, Salto, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/pjwXBZ-vwD8",
      data_pubblicazione: null
    },
    {
      id: 118,
      id_esercizio: "118",
      nome_reale: "Blade jump",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Affondo, Salto, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/WTxUNX64GvM",
      data_pubblicazione: null
    },
    {
      id: 119,
      id_esercizio: "119",
      nome_reale: "Super Mario Jump",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, salto",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, salto \u2022 Multi-planare, Salto, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/XluivIvnr4k",
      data_pubblicazione: null
    },
    {
      id: 120,
      id_esercizio: "120",
      nome_reale: "Aerial Jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, salto",
      ruolo: "engine",
      tag_biomeccanici: "cerniera d'anca, salto \u2022 Multi-planare, Salto, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/0uI_9_0qR7k",
      data_pubblicazione: null
    },
    {
      id: 121,
      id_esercizio: "121",
      nome_reale: "reverse aerial jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, salto",
      ruolo: "engine",
      tag_biomeccanici: "cerniera d'anca, salto \u2022 Fulcro Fisso",
      link_video: "https://youtube.com/shorts/sA0--x_VEPo",
      data_pubblicazione: null
    },
    {
      id: 122,
      id_esercizio: "122",
      nome_reale: "clubbell stability jump down",
      attrezzo: "bat/clubbell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Plyometrics",
      link_video: "https://youtu.be/GXKlV1aWruU?si=guobA3vjLOpL0l6N",
      data_pubblicazione: null
    },
    {
      id: 123,
      id_esercizio: "123",
      nome_reale: "Box Jump over",
      attrezzo: "plyobox",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Cerniera d'anca, Salto, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/2q5Wjes1FGY?si=7A7SvJIawIXZGSlz",
      data_pubblicazione: null
    },
    {
      id: 124,
      id_esercizio: "124",
      nome_reale: "Slamball Skater jump",
      attrezzo: "slamball",
      pattern_biomeccanico: "cerniera d'anca, coiled position, traslitterazione laterale",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, coiled position, traslitterazione laterale \u2022 Multi-planare, Spostamento Laterale, Footwork, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/b3MFp94lCpU?si=-Rk8BYA6Ob_mr4rA",
      data_pubblicazione: null
    },
    {
      id: 125,
      id_esercizio: "125",
      nome_reale: "Slamball Coiled lateral shift",
      attrezzo: "slamball",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Spostamento Laterale, Footwork, Potenza Esplosiva, Plyometrics, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/nKP0dA4dpzw",
      data_pubblicazione: null
    },
    {
      id: 126,
      id_esercizio: "126",
      nome_reale: "Split C&J Touch & Go",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Potenza Esplosiva, Plyometrics, Coordinazione, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/HWcYpmL1Q9o?feature=share",
      data_pubblicazione: null
    },
    {
      id: 127,
      id_esercizio: "127",
      nome_reale: "COMBO: Landmine clean ALT. SCRD T/GO",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, trasferimento di carico",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, trasferimento di carico \u2022 Warm Up, Multi-planare, Potenza Esplosiva, Plyometrics, Coordinazione, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/Zd7CQkHhnSo",
      data_pubblicazione: null
    },
    {
      id: 128,
      id_esercizio: "128",
      nome_reale: "COMBO: Landmine Split snatch High hand switch T/GO",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, lancio verticale, trasferimento di carico",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, lancio verticale, trasferimento di carico \u2022 Warm Up, Multi-planare, Potenza Esplosiva, Plyometrics, Coordinazione, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/ClRJ9dABoRg",
      data_pubblicazione: null
    },
    {
      id: 129,
      id_esercizio: "129",
      nome_reale: "COMBO: Landmine Clean & Jerk High hand switch T/GO",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, spinta verticale, trasferimento di carico",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, spinta verticale, trasferimento di carico \u2022 Warm Up, Multi-planare, Potenza Esplosiva, Plyometrics, Coordinazione, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/bB_a5s46QaU",
      data_pubblicazione: null
    },
    {
      id: 130,
      id_esercizio: "130",
      nome_reale: "cross jump double touch",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "destrezza, saltello",
      ruolo: "accessorio",
      tag_biomeccanici: "destrezza, saltello \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/PTciDyczhB8?si=7nmq5vZHDumttcyM",
      data_pubblicazione: null
    },
    {
      id: 131,
      id_esercizio: "131",
      nome_reale: "A-Skip",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "saltello",
      ruolo: "accessorio",
      tag_biomeccanici: "saltello \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/VRlw2TrsPvo?si=oS5PrWbJhfK_C9MA",
      data_pubblicazione: null
    },
    {
      id: 132,
      id_esercizio: "132",
      nome_reale: "Calciata dietro",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/UqHpz_bc078?si=BoeGQpGXrHWK4ByY",
      data_pubblicazione: null
    },
    {
      id: 133,
      id_esercizio: "133",
      nome_reale: "Skip e calciata gamba singola",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/XuvZlCcu7Gc?si=EazJlv-7nF48y-dq",
      data_pubblicazione: null
    },
    {
      id: 134,
      id_esercizio: "134",
      nome_reale: "Split Jumps (sagittale)",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "cerniera d'anca, salto verticale",
      ruolo: "engine",
      tag_biomeccanici: "cerniera d'anca, salto verticale \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtube.com/shorts/YoTx91IUJtk",
      data_pubblicazione: null
    },
    {
      id: 135,
      id_esercizio: "135",
      nome_reale: "Salto alfiere",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "destrezza, asaltello",
      ruolo: "accessorio",
      tag_biomeccanici: "destrezza, asaltello \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/Gw0ZwJs6AuQ?si=Pn8lHPgqN_A4nDxA",
      data_pubblicazione: null
    },
    {
      id: 136,
      id_esercizio: "136",
      nome_reale: "Cross jump 2-1-2",
      attrezzo: "box",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/9SHNa7RhQUw?si=_pu84CaDNM-x2fOF",
      data_pubblicazione: null
    },
    {
      id: 137,
      id_esercizio: "137",
      nome_reale: "jump 2-2-2 sagittal",
      attrezzo: "box",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/uzfVpyni67Y?si=43IY2zRlbLqazNbb",
      data_pubblicazione: null
    },
    {
      id: 138,
      id_esercizio: "138",
      nome_reale: "jump 2-1-2",
      attrezzo: "box o rialzo",
      pattern_biomeccanico: "saltello, salto verticale",
      ruolo: "engine",
      tag_biomeccanici: "saltello, salto verticale \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/CrrfX1tBvyI?si=yUmHcZDqQ2kpQ0S0",
      data_pubblicazione: null
    },
    {
      id: 139,
      id_esercizio: "139",
      nome_reale: "Balzo - salto in lungo",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/yF7dkUK7Nbw?si=OLOG3ZV6tYaPo0RL",
      data_pubblicazione: null
    },
    {
      id: 140,
      id_esercizio: "140",
      nome_reale: "Air Jack",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/qrLyxNceFeI?si=kjPmfsQ7uZgSH9MI",
      data_pubblicazione: null
    },
    {
      id: 141,
      id_esercizio: "141",
      nome_reale: "Tornado Jump",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/wYcB7w0e27Y?si=F5fplhPuxpGpOO1F",
      data_pubblicazione: null
    },
    {
      id: 142,
      id_esercizio: "142",
      nome_reale: "translate switch",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/lnuCHOUYLrI?si=rP0-oYNJQYHcVcxh",
      data_pubblicazione: null
    },
    {
      id: 143,
      id_esercizio: "143",
      nome_reale: "jump FWD 90\xB0 rotation",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/Xty3QXF2l-I?si=MkzYT-_88QanmfRT",
      data_pubblicazione: null
    },
    {
      id: 144,
      id_esercizio: "144",
      nome_reale: "Jumping jack forward 90\xB0 rotation",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/mvCgOmEMemo?si=5jxiQ_r3mh6dwSNu",
      data_pubblicazione: null
    },
    {
      id: 145,
      id_esercizio: "145",
      nome_reale: "one leg forward hops",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "destrezza, asaltello",
      ruolo: "accessorio",
      tag_biomeccanici: "destrezza, asaltello \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/J1LgaJX2wbc?si=8yRD-BHck-oFVImE",
      data_pubblicazione: null
    },
    {
      id: 146,
      id_esercizio: "146",
      nome_reale: "frontal plane open skip",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/kLtSzkOPHUw?si=1UzhtKy6PZv68LY2",
      data_pubblicazione: null
    },
    {
      id: 147,
      id_esercizio: "147",
      nome_reale: "Hurdle Step",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "circonduzione e mobilt\xE0 di anca, saltello",
      ruolo: null,
      tag_biomeccanici: "circonduzione e mobilt\xE0 di anca, saltello \u2022 Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/tZ28cg_Wi1c?si=bNZhGLkec-Fb_fZw",
      data_pubblicazione: null
    },
    {
      id: 148,
      id_esercizio: "148",
      nome_reale: "double pulse hops",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/0VMtt0J6hOA?si=sVc_d-sfG5PoqKYx",
      data_pubblicazione: null
    },
    {
      id: 149,
      id_esercizio: "149",
      nome_reale: "passo saltellato",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/qQ8cUJsXj4A?si=uSa0URe_6iQZGvQ3",
      data_pubblicazione: null
    },
    {
      id: 150,
      id_esercizio: "150",
      nome_reale: "Cross Step",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/ckdkAL-Q4FY?si=tvHwIjWNXHNUsyoH",
      data_pubblicazione: null
    },
    {
      id: 151,
      id_esercizio: "151",
      nome_reale: "pinocchietto",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtu.be/-NAO9tMarFc?si=x2nINXxqtvlOGUHx",
      data_pubblicazione: null
    },
    {
      id: 152,
      id_esercizio: "152",
      nome_reale: "Tuck Jump burpees",
      attrezzo: "corpo libero",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Warm Up, Salto, Footwork, Propedeutica alla Corsa, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica, Recupero Attivo",
      link_video: "https://youtube.com/shorts/OJfFV2KtD68",
      data_pubblicazione: null
    },
    {
      id: 153,
      id_esercizio: "153",
      nome_reale: "band split jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Potenza Esplosiva, Forza Massimale, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico, resistenza progressiva",
      link_video: "https://youtube.com/shorts/6FdCgshEV20",
      data_pubblicazione: null
    },
    {
      id: 154,
      id_esercizio: "154",
      nome_reale: "band split clean",
      attrezzo: "landmine",
      pattern_biomeccanico: "traslazione laterale, flessione laterale della colonna, gioco di gambe",
      ruolo: null,
      tag_biomeccanici: "traslazione laterale, flessione laterale della colonna, gioco di gambe \u2022 Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Potenza Esplosiva, Forza Massimale, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico, resistenza progressiva",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 155,
      id_esercizio: "155",
      nome_reale: "band split clean and jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa, Potenza Esplosiva, Forza Massimale, Plyometrics, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico, resistenza progressiva",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 156,
      id_esercizio: "156",
      nome_reale: "Bat Shake",
      attrezzo: "bat/clubbell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/JsefrELV2hU?si=13Sas4AZ4lqdu80O",
      data_pubblicazione: null
    },
    {
      id: 157,
      id_esercizio: "157",
      nome_reale: "Static Bat around the head",
      attrezzo: "bat/clubbell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/ig4SivT3FIc?si=YutU3lHkHcCVQ6yR",
      data_pubblicazione: null
    },
    {
      id: 158,
      id_esercizio: "158",
      nome_reale: "Bat around the head 90\xB0 e 180\xB0",
      attrezzo: "stick, bat",
      pattern_biomeccanico: "circonduzione spalle, rotazione piano trasverso",
      ruolo: null,
      tag_biomeccanici: "circonduzione spalle, rotazione piano trasverso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/INNpiEJL9As?si=7-xSjR1LJL__jzU8",
      data_pubblicazione: null
    },
    {
      id: 159,
      id_esercizio: "159",
      nome_reale: "Bat Basic Throw",
      attrezzo: "bat/clubbell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/l36MpIWicMo?si=eDm4DA2C_dHh5-FM",
      data_pubblicazione: null
    },
    {
      id: 160,
      id_esercizio: "160",
      nome_reale: "Bat Circular Throw",
      attrezzo: "clubbell",
      pattern_biomeccanico: "lancio, ciclico",
      ruolo: null,
      tag_biomeccanici: "lancio, ciclico \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/oWM6pwB1Zrc?si=gePKc-R65kniEnh2",
      data_pubblicazione: null
    },
    {
      id: 161,
      id_esercizio: "161",
      nome_reale: "Bat Circular Throw 90\xB0",
      attrezzo: "bat/clubbell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/MohkWWeuuVM?si=9iYj_o8ZNY7AQqLW",
      data_pubblicazione: null
    },
    {
      id: 162,
      id_esercizio: "162",
      nome_reale: "Bat Circular Throw 180\xB0",
      attrezzo: "stick, bat",
      pattern_biomeccanico: "lancio, ciclico, rotazione piano trasverso",
      ruolo: null,
      tag_biomeccanici: "lancio, ciclico, rotazione piano trasverso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/ZfYjQ659bMo?si=5CtK6H1ghOXZfBbz",
      data_pubblicazione: null
    },
    {
      id: 163,
      id_esercizio: "163",
      nome_reale: "Arm basic DB pendulum",
      attrezzo: "manubri",
      pattern_biomeccanico: "core stability, flessoestensione spalle",
      ruolo: null,
      tag_biomeccanici: "core stability, flessoestensione spalle \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/WL2Gbf9klSI?si=R-4lfDqWZo7_yc9B",
      data_pubblicazione: null
    },
    {
      id: 164,
      id_esercizio: "164",
      nome_reale: "Pendulum TS sag/front",
      attrezzo: "manubri",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/ld7Kf2oSluw?si=SJfjRKwVBHwVeFmU",
      data_pubblicazione: null
    },
    {
      id: 165,
      id_esercizio: "165",
      nome_reale: "Pendulum Squat TS basic",
      attrezzo: "manubri",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/9_okXhwjLYA?si=XktmuYmNQroiqfmK",
      data_pubblicazione: null
    },
    {
      id: 166,
      id_esercizio: "166",
      nome_reale: "Pendulum squat sagittale TS/double e mono",
      attrezzo: "manubri",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/9_okXhwjLYA?si=BxDWK0De2qi1w_xX",
      data_pubblicazione: null
    },
    {
      id: 167,
      id_esercizio: "167",
      nome_reale: "Pendulum TS Single arm- 90\xB0-180\xB0",
      attrezzo: "manubri",
      pattern_biomeccanico: "core stability, flessoestensione spalle, rotazione sul piano trasverso",
      ruolo: null,
      tag_biomeccanici: "core stability, flessoestensione spalle, rotazione sul piano trasverso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/FA9vwwWXdGA?si=M2cBgP8YR-_5s1aB",
      data_pubblicazione: null
    },
    {
      id: 168,
      id_esercizio: "168",
      nome_reale: "Pendulum TS side move",
      attrezzo: "manubri",
      pattern_biomeccanico: "core stability, traslazione laterale",
      ruolo: "propedeutico L master",
      tag_biomeccanici: "core stability, traslazione laterale \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/p6AxeGF0v08?si=CsMl_yeUvOTtca2y",
      data_pubblicazione: null
    },
    {
      id: 169,
      id_esercizio: "169",
      nome_reale: "Kettlebell Swing BASIC",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trasferimento di carico",
      ruolo: null,
      tag_biomeccanici: "cerniera d'anca, trasferimento di carico \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/qQVhe7iuaaY",
      data_pubblicazione: null
    },
    {
      id: 170,
      id_esercizio: "170",
      nome_reale: "Coiled Kettlebell Swing",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca",
      ruolo: "engine, benchmark",
      tag_biomeccanici: "cerniera d'anca \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/_WhdFAoC-g0",
      data_pubblicazione: null
    },
    {
      id: 171,
      id_esercizio: "171",
      nome_reale: "Kettlebell Skater Swing",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, traslazione laterale, trazione verticale dal basso",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, traslazione laterale, trazione verticale dal basso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtube.com/shorts/fNs7kd2FvEs",
      data_pubblicazione: null
    },
    {
      id: 172,
      id_esercizio: "172",
      nome_reale: "Kettlebell swing to clean",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtube.com/shorts/gy5fnoBpd0E?feature=share",
      data_pubblicazione: null
    },
    {
      id: 173,
      id_esercizio: "173",
      nome_reale: "DB/Kett. step Snatch",
      attrezzo: "manubri",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso, core stability",
      ruolo: "engine, benchmark",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso, core stability \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 174,
      id_esercizio: "174",
      nome_reale: "DB/Kett split snatch",
      attrezzo: "manubri, kettlebell",
      pattern_biomeccanico: "trazione verticale dal basso, affondo, cerniera d'anca",
      ruolo: "complementare",
      tag_biomeccanici: "trazione verticale dal basso, affondo, cerniera d'anca \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 175,
      id_esercizio: "175",
      nome_reale: "half kneeling clubbell Snatch",
      attrezzo: "clubbell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso, accosciata statica",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso, accosciata statica \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/AwVZtsBdFpg?si=Dfgyfkgtzkn0U3CN",
      data_pubblicazione: null
    },
    {
      id: 176,
      id_esercizio: "176",
      nome_reale: "half kneeling to stand clubbell snatch",
      attrezzo: "clubbell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso, lancio dal basso verso l'alto",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso, lancio dal basso verso l'alto \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/kGxO6XxLuxg?si=H49e5YrSvD9P207u",
      data_pubblicazione: null
    },
    {
      id: 177,
      id_esercizio: "177",
      nome_reale: "Clubbell Throw 180\xB0",
      attrezzo: "clubbell",
      pattern_biomeccanico: "lancio ciclico, rotazione piano trasverso",
      ruolo: "propedeutico L master",
      tag_biomeccanici: "lancio ciclico, rotazione piano trasverso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/gR25zBvBa48?si=kDHi-rlIwuOA4q6v",
      data_pubblicazione: null
    },
    {
      id: 178,
      id_esercizio: "178",
      nome_reale: "Frontal plane clubb circle",
      attrezzo: "bat/clubbell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/Abk0IE7G-wA?si=swbLBJMrMEg4F6vy",
      data_pubblicazione: null
    },
    {
      id: 179,
      id_esercizio: "179",
      nome_reale: "Clubbell Ax lunge",
      attrezzo: "clubbell",
      pattern_biomeccanico: "cerniera d'anca, spostamento sagittale",
      ruolo: "propedeutico L master",
      tag_biomeccanici: "cerniera d'anca, spostamento sagittale \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/SL75_q76B-8?si=KIvTzW2SDd9wERdd",
      data_pubblicazione: null
    },
    {
      id: 180,
      id_esercizio: "180",
      nome_reale: "single Dumbbell Pendulum lunge",
      attrezzo: "manubri",
      pattern_biomeccanico: "cerniera d'anca, core stability, affondo",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, core stability, affondo \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/mgABr0Ss9Fo?si=Hwr_UXlnHTfTy_Wk",
      data_pubblicazione: null
    },
    {
      id: 181,
      id_esercizio: "181",
      nome_reale: "Single Dumbbell T/S",
      attrezzo: "manubri",
      pattern_biomeccanico: "cerniera d'anca, core stability",
      ruolo: "engine",
      tag_biomeccanici: "cerniera d'anca, core stability \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/nuMELy_lT28?si=h26vlhmuc0tzl1cP",
      data_pubblicazione: null
    },
    {
      id: 182,
      id_esercizio: "182",
      nome_reale: "Diagonal Clubbell T/S",
      attrezzo: "clubbell",
      pattern_biomeccanico: "cerniera d'anca, core stability",
      ruolo: "propedeutico L master",
      tag_biomeccanici: "cerniera d'anca, core stability \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/Oym9Ibkkh1E?si=_eMoPUPN9PP_AqAY",
      data_pubblicazione: null
    },
    {
      id: 183,
      id_esercizio: "183",
      nome_reale: "neutral Clubbell T/S 90\xB0 e 180\xB0",
      attrezzo: "clubbell, bat",
      pattern_biomeccanico: "flessoestensione della spalla, rotazione sul piano trasverso",
      ruolo: null,
      tag_biomeccanici: "flessoestensione della spalla, rotazione sul piano trasverso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/Brwd1bxfTEM?si=z2EE4zDDtLwSDPO0",
      data_pubblicazione: null
    },
    {
      id: 184,
      id_esercizio: "184",
      nome_reale: "Box Jump Over",
      attrezzo: "plyobox",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Salto, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/2q5Wjes1FGY?si=f7t-ll0cuD81Whv-",
      data_pubblicazione: null
    },
    {
      id: 185,
      id_esercizio: "185",
      nome_reale: "Burpee Box Jump Over",
      attrezzo: "plyobox",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Salto, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/Hgw-qCK_QZc?si=PSXkzkRnDJy3gCrw",
      data_pubblicazione: null
    },
    {
      id: 186,
      id_esercizio: "186",
      nome_reale: "Box Jump",
      attrezzo: "plyobox",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Salto, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/52r_Ul5k03g?si=0yozqP91aSNLFNEk",
      data_pubblicazione: null
    },
    {
      id: 187,
      id_esercizio: "187",
      nome_reale: "Sprawl to Broad Jump",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "cerniera d'anca, accosciata, salto",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, accosciata, salto \u2022 Salto, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/-eqiqA8lXX4?si=HKSFeAxGQ24iaIKK",
      data_pubblicazione: null
    },
    {
      id: 188,
      id_esercizio: "188",
      nome_reale: "Kettlebell Snatch",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso \u2022 Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 189,
      id_esercizio: "189",
      nome_reale: "Kettlebell Coiled Thruster",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso, spinta verticale",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso, spinta verticale \u2022 Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/nQHKdic83T8",
      data_pubblicazione: null
    },
    {
      id: 190,
      id_esercizio: "190",
      nome_reale: "Dumbbell Coiled Thruster",
      attrezzo: "manubri",
      pattern_biomeccanico: "spinta verticale, asimmetrico",
      ruolo: "complementare",
      tag_biomeccanici: "spinta verticale, asimmetrico \u2022 Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/nQHKdic83T8",
      data_pubblicazione: null
    },
    {
      id: 191,
      id_esercizio: "191",
      nome_reale: "Endless rope Standing Power Pull",
      attrezzo: "endless rope",
      pattern_biomeccanico: "core training in trazione verticale simmetrica",
      ruolo: "accessrio",
      tag_biomeccanici: "core training in trazione verticale simmetrica \u2022 Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/rRgKOg0qaA4?si=aYRTcGburOhwv1a6",
      data_pubblicazione: null
    },
    {
      id: 192,
      id_esercizio: "192",
      nome_reale: "Endless rope kneeling pull",
      attrezzo: "endless rope",
      pattern_biomeccanico: "core training in trazione verticale monolaterale alternato in ginocchio",
      ruolo: "accessrio",
      tag_biomeccanici: "core training in trazione verticale monolaterale alternato in ginocchio \u2022 Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/sNkK5m4fYi0",
      data_pubblicazione: null
    },
    {
      id: 193,
      id_esercizio: "193",
      nome_reale: "Endless rope Half kneeling lateral pull",
      attrezzo: "endless rope",
      pattern_biomeccanico: "core training in trazione verticale spiralizzata",
      ruolo: "accessrio",
      tag_biomeccanici: "core training in trazione verticale spiralizzata \u2022 Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/nRxCW9Y2muU",
      data_pubblicazione: null
    },
    {
      id: 194,
      id_esercizio: "194",
      nome_reale: "endless rope wood chopper",
      attrezzo: "endless rope",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/H5vc75zL1Cg?si=3RDpV63g1NHs1lQg",
      data_pubblicazione: null
    },
    {
      id: 195,
      id_esercizio: "195",
      nome_reale: "Sitting endless rope climbing",
      attrezzo: "endless rope",
      pattern_biomeccanico: "core training, trazione orizzontale",
      ruolo: "accessrio",
      tag_biomeccanici: "core training, trazione orizzontale \u2022 Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 196,
      id_esercizio: "196",
      nome_reale: "Sprint Max Watt airbike",
      attrezzo: "airbike",
      pattern_biomeccanico: "sprint massima potenza su airbike",
      ruolo: "engine",
      tag_biomeccanici: "sprint massima potenza su airbike \u2022 Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 197,
      id_esercizio: "197",
      nome_reale: "Airbike solo braccia",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 198,
      id_esercizio: "198",
      nome_reale: "Trazioni esplosive (Skierg)",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 199,
      id_esercizio: "199",
      nome_reale: "Sprint massimale (Speedfit)",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 200,
      id_esercizio: "200",
      nome_reale: "Sprint massimale in salita",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 201,
      id_esercizio: "201",
      nome_reale: "Step Up esplosivo alternato",
      attrezzo: "scalino, box, plinto",
      pattern_biomeccanico: "scalino, salita monolaterale alternata esplosiva",
      ruolo: "engine",
      tag_biomeccanici: "scalino, salita monolaterale alternata esplosiva \u2022 Potenza Esplosiva, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/bAH_uySHG0c?si=H7r8TS-7k3vxrCRf",
      data_pubblicazione: null
    },
    {
      id: 202,
      id_esercizio: "202",
      nome_reale: "Varianti skyerg",
      attrezzo: "macchine cardio, engine",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Metcon, Potenza Anaerobica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 203,
      id_esercizio: "203",
      nome_reale: "Plyometric lunges",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "cerniera d'anca, affondo, salto",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, affondo, salto \u2022 Potenza Esplosiva, Salto, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/qwSTFU2DV5A?si=1bDypth-DLwWo1J9",
      data_pubblicazione: null
    },
    {
      id: 204,
      id_esercizio: "204",
      nome_reale: "Tuck Jump burpees",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "cerniera d'anca, accosciata, salto",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, accosciata, salto \u2022 Salto, Potenza Esplosiva, Plyometrics, Agilit\xE0, Metcon, Potenza Anaerobica",
      link_video: "https://youtube.com/shorts/OJfFV2KtD68",
      data_pubblicazione: null
    },
    {
      id: 205,
      id_esercizio: "205",
      nome_reale: "Kick-through progression",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "body folw",
      ruolo: "complementare",
      tag_biomeccanici: "body folw \u2022 Agilit\xE0, Coordinazione, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 206,
      id_esercizio: "206",
      nome_reale: "Side kick through",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "body folw",
      ruolo: "complementare",
      tag_biomeccanici: "body folw \u2022 Agilit\xE0, Coordinazione, Metcon, Potenza Anaerobica",
      link_video: "https://youtu.be/RVm9HCs56X8?si=OxaEACWRDQPW-qYy",
      data_pubblicazione: null
    },
    {
      id: 207,
      id_esercizio: "207",
      nome_reale: "Seated Endless rope power pull",
      attrezzo: "endless rope",
      pattern_biomeccanico: "trazione verticale da seduto, core training",
      ruolo: null,
      tag_biomeccanici: "trazione verticale da seduto, core training \u2022 Metcon, Potenza Anaerobica, Torsione, Trazione Verticale, Attivazione Core",
      link_video: "https://youtube.com/shorts/8QVxs6WyGJs",
      data_pubblicazione: null
    },
    {
      id: 208,
      id_esercizio: "208",
      nome_reale: "Landmine Plyo Lift NO DOWN",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca asimmetrico",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca asimmetrico \u2022 Potenza Anaerobica, Trazione Verticale, Metcon, Potenza Esplosiva, Plyometrics, Multi-planare, Connessione Controlaterale, Catena Cinetica Chiusa",
      link_video: "https://youtube.com/shorts/7r3ThD-zkpw",
      data_pubblicazione: null
    },
    {
      id: 209,
      id_esercizio: "209",
      nome_reale: "Lato lungo, Lato corto",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "video didattico teorico di approfondimento tecnico,",
      link_video: "https://youtu.be/0IotRiRVq9Y?si=r4PPBvaE2L5geehC",
      data_pubblicazione: null
    },
    {
      id: 210,
      id_esercizio: "210",
      nome_reale: "Routine mente-corpo",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Sessione Guidata, Moblit\xE0, Respirazione, Calma, Benessere Mente Corpo.",
      link_video: "https://youtu.be/xW3GdKQLYLE",
      data_pubblicazione: null
    },
    {
      id: 211,
      id_esercizio: "211",
      nome_reale: "Perch\xE8 ho scelto il Landmine",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "video didattico teorico di approfondimento tecnico,",
      link_video: "https://youtu.be/GKoWHa0U2GU?si=gAGDdLjoBPwDvex4",
      data_pubblicazione: null
    },
    {
      id: 212,
      id_esercizio: "212",
      nome_reale: "Lab: filosofia e regole",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "regole, filosofia, norme di comportamento, approfondimento.",
      link_video: "https://youtu.be/kzu3kHyCFJk?si=X8Ix3qpxu4L-Mw7U",
      data_pubblicazione: null
    },
    {
      id: 213,
      id_esercizio: "213",
      nome_reale: "Landmine - compromesso perfetto",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "filosofia, approfondimento concettuale.",
      link_video: "https://youtu.be/I3mTr9qBd4Y?si=pMhZTZuLDpbpkday",
      data_pubblicazione: null
    },
    {
      id: 214,
      id_esercizio: "214",
      nome_reale: "Il tuo Start up, ecco coasa devi sapere",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Introduzione all Lab, Appprofondimento.",
      link_video: "https://youtu.be/Ym7gkfyJYIQ?si=_1SYaQvb_pvVw-bv",
      data_pubblicazione: null
    },
    {
      id: 215,
      id_esercizio: "215",
      nome_reale: "Programmazione degli allenamenti",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "informazioni concettuali sul programma di allenamento",
      link_video: "https://youtu.be/84Zk9n2YsNE?si=lzqHhngS_WnYfa5z",
      data_pubblicazione: null
    },
    {
      id: 216,
      id_esercizio: "216",
      nome_reale: "Ground mobility tutorial",
      attrezzo: "Approfondimenti ed extra",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "tutorial, mobilit\xE0 articolare, routine di riscaldamento",
      link_video: "https://youtu.be/nyhsL01d0S8?si=ZDWdbW4_h-NizxN7",
      data_pubblicazione: null
    },
    {
      id: 217,
      id_esercizio: "217",
      nome_reale: "Kettlebell coiled high pull swing",
      attrezzo: "kettlebell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Catene Crociate, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/xYr1Ew0d9bI",
      data_pubblicazione: null
    },
    {
      id: 218,
      id_esercizio: "218",
      nome_reale: "Landmine Jerk",
      attrezzo: "landmine",
      pattern_biomeccanico: "spinta verticale, asimmetrico",
      ruolo: "fondamentale",
      tag_biomeccanici: "spinta verticale, asimmetrico \u2022 Warm Up, Multi-planare, Spinta Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Trasferimento di Carico, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/zIqsjVRtc5o",
      data_pubblicazione: null
    },
    {
      id: 219,
      id_esercizio: "219",
      nome_reale: "Punch isoinerziale",
      attrezzo: "isoinerziale",
      pattern_biomeccanico: "core stablity catene crociate spinta monolaterale",
      ruolo: "complementare",
      tag_biomeccanici: "core stablity catene crociate spinta monolaterale \u2022 Multi-planare, Spinta Orizzontale, Connessione Controlaterale",
      link_video: "https://youtu.be/-j07Q_jaTOA",
      data_pubblicazione: null
    },
    {
      id: 220,
      id_esercizio: "220",
      nome_reale: "Wall High Pull",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "attivazione pattern di high pull e deadlift",
      ruolo: null,
      tag_biomeccanici: "attivazione pattern di high pull e deadlift \u2022 Warm Up, Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Anaerobica, Fulcro Fisso, Carico Asimmetrico",
      link_video: "https://youtu.be/EBv0BjKhUlA?si=I07YNW02JWJF-oiD",
      data_pubblicazione: null
    },
    {
      id: 221,
      id_esercizio: "221",
      nome_reale: "Half kneeling snatch",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca asimmetrico, lancio verticale",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca asimmetrico, lancio verticale \u2022 Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/4UaIYL4E8_Q",
      data_pubblicazione: null
    },
    {
      id: 222,
      id_esercizio: "222",
      nome_reale: "Total kneeling snatch",
      attrezzo: "landmine",
      pattern_biomeccanico: "trazione verticale dal basso, lancio verticale, cerniera d'anca",
      ruolo: null,
      tag_biomeccanici: "trazione verticale dal basso, lancio verticale, cerniera d'anca \u2022 Multi-planare, Trazione Verticale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Potenza Anaerobica, Fulcro Fisso",
      link_video: "https://youtube.com/shorts/k4YFnGkzK-U",
      data_pubblicazione: null
    },
    {
      id: 223,
      id_esercizio: "223",
      nome_reale: "Kettlebell snatch lunge",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, affondo, trazione verticale dal basso",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, affondo, trazione verticale dal basso \u2022 Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Catene Crociate, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtube.com/shorts/blBeBKFUdzE",
      data_pubblicazione: null
    },
    {
      id: 224,
      id_esercizio: "224",
      nome_reale: "Kettlebell snatch swing to snatch lunge",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, affondo, trazione verticale dal basso",
      ruolo: "fondamentale",
      tag_biomeccanici: "cerniera d'anca, affondo, trazione verticale dal basso \u2022 Multi-planare, Cerniera d'anca, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Aperta, Catene Crociate, Potenza Esplosiva, Metcon, Carico Asimmetrico",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 225,
      id_esercizio: "225",
      nome_reale: "Ball over shoulder",
      attrezzo: "med ball, slam ball",
      pattern_biomeccanico: "cerniera d'anca, accosciata",
      ruolo: "engine benchmark",
      tag_biomeccanici: "cerniera d'anca, accosciata \u2022 Warm Up, Metcon, Potenza Anaerobica, Fulcro Fisso, Catene Cinetica Chiusa, Potenza Esplosiva",
      link_video: "https://youtu.be/Nwd-5fuLm3k?si=jGWxuH-RfvPTnkWN",
      data_pubblicazione: null
    },
    {
      id: 226,
      id_esercizio: "226",
      nome_reale: "Coiled kettlebell swing to snatch",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtu.be/l3TWgpjg5tA?si=P7ZXSUo9VPmWjiLC",
      data_pubblicazione: null
    },
    {
      id: 227,
      id_esercizio: "227",
      nome_reale: "Skyerg lunges",
      attrezzo: "skierg",
      pattern_biomeccanico: "affondi alternati con trazione verso il basso",
      ruolo: "engine",
      tag_biomeccanici: "affondi alternati con trazione verso il basso \u2022 Warm Up, Attivazione Core, Piano Sagittale, Cerniera d'anca, Catena Cinetica Chiusa, Metcon, Potenza Anaerobica, Capacit\xE0 Aerobica",
      link_video: "https://youtube.com/shorts/kYfL3_rgym8",
      data_pubblicazione: null
    },
    {
      id: 228,
      id_esercizio: "228",
      nome_reale: "COMBO Side kick through + Sprawl",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "body folw, cerniera d'anca, accosciata",
      ruolo: "complementare",
      tag_biomeccanici: "body folw, cerniera d'anca, accosciata \u2022 Agilit\xE0, Coordinazione, Metcon, Potenza Anaerobica, Potenza Esplosiva",
      link_video: "https://youtube.com/shorts/iRJEq6FnzxI",
      data_pubblicazione: null
    },
    {
      id: 229,
      id_esercizio: "229",
      nome_reale: "Split Clean T&go",
      attrezzo: "landmine",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso",
      ruolo: "engine, benchmark",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso \u2022 Multi-planare, Trazione Verticale, Connessione Controlaterale, Catena Cinetica Chiusa, Catene Crociate, Potenza Esplosiva, Metcon, Fulcro Fisso, Carico Asimmetrico, Plyometrics",
      link_video: "https://youtube.com/shorts/b8D0AuCfrp4?feature=share",
      data_pubblicazione: null
    },
    {
      id: 230,
      id_esercizio: "230",
      nome_reale: "kettlebell clean and press",
      attrezzo: "kettlebell",
      pattern_biomeccanico: "cerniera d'anca, trazione verticale dal basso, spinta verticale",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, trazione verticale dal basso, spinta verticale \u2022 ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Multi-planare, Attivazione Core, spinta verticale",
      link_video: "https://youtu.be/DajheBayHjc",
      data_pubblicazione: null
    },
    {
      id: 231,
      id_esercizio: "231",
      nome_reale: "Banded hoock",
      attrezzo: "lloop band",
      pattern_biomeccanico: "core training in rotazione sul piano trasverso",
      ruolo: "complementare a tutto",
      tag_biomeccanici: "core training in rotazione sul piano trasverso \u2022 core training, rotazioni piano trasverso",
      link_video: "https://youtube.com/shorts/jEOtxSBwhCU",
      data_pubblicazione: null
    },
    {
      id: 232,
      id_esercizio: "232",
      nome_reale: "rope rotation",
      attrezzo: "climbing rope",
      pattern_biomeccanico: "core training, trazione orizzontale",
      ruolo: "accessorio",
      tag_biomeccanici: "core training, trazione orizzontale \u2022 core training, trazione orizzontale",
      link_video: "https://youtube.com/shorts/ZyQbtwd1NC0",
      data_pubblicazione: null
    },
    {
      id: 233,
      id_esercizio: "233",
      nome_reale: "rotation slam",
      attrezzo: "slamball-medbal",
      pattern_biomeccanico: "core training, rotazione sul piano trasverso",
      ruolo: "complementare",
      tag_biomeccanici: "core training, rotazione sul piano trasverso \u2022 core training, rotazione sul piano trasverso",
      link_video: "https://youtube.com/shorts/HwYENrEDFqY",
      data_pubblicazione: null
    },
    {
      id: 234,
      id_esercizio: "234",
      nome_reale: "rebound push up",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "spinta orizzontale",
      ruolo: "complementare",
      tag_biomeccanici: "spinta orizzontale \u2022 core training, spnta orizzontale",
      link_video: "https://youtube.com/shorts/iSipY1JCKdQ",
      data_pubblicazione: null
    },
    {
      id: 235,
      id_esercizio: "235",
      nome_reale: "kettlebell + band swing",
      attrezzo: "kettlebell + loop band",
      pattern_biomeccanico: "cerniera d'anca, flessoestensione del tronco, catena posteriore, simmetrico",
      ruolo: "complementare",
      tag_biomeccanici: "cerniera d'anca, flessoestensione del tronco, catena posteriore, simmetrico \u2022 cerniera d'anca, flessoestensione del tronco, catena posteriore, simmetrico",
      link_video: "https://youtube.com/shorts/9OdSw-O94rU",
      data_pubblicazione: null
    },
    {
      id: 236,
      id_esercizio: "236",
      nome_reale: "kneeling power jump",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "cerniera d'anca, accosciata",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca, accosciata \u2022 cerniera d'anca, accosciata",
      link_video: "https://youtube.com/shorts/fGomFiNjpEI",
      data_pubblicazione: null
    },
    {
      id: 237,
      id_esercizio: "237",
      nome_reale: "rotational medball box lunge",
      attrezzo: "medball+box o rialzo",
      pattern_biomeccanico: "cerniera d'anca, rotazione del tronco",
      ruolo: "accessorio",
      tag_biomeccanici: "cerniera d'anca, rotazione del tronco \u2022 cerniera d'anca, rotazione del tronco",
      link_video: "https://youtube.com/shorts/iSHrpNIIpJ4",
      data_pubblicazione: null
    },
    {
      id: 238,
      id_esercizio: "238",
      nome_reale: "medball side kick thrue",
      attrezzo: "medball-slamball",
      pattern_biomeccanico: "core conditioning, catena flessoria",
      ruolo: "complementare",
      tag_biomeccanici: "core conditioning, catena flessoria \u2022 core conditioning, catena flessoria",
      link_video: "https://youtube.com/shorts/bkeLhDyiMWg",
      data_pubblicazione: null
    },
    {
      id: 239,
      id_esercizio: "239",
      nome_reale: "Gymnasty ABS",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "core strenght, piano sagittale",
      ruolo: "complementare",
      tag_biomeccanici: "core strenght, piano sagittale \u2022 pliometria, saltelli, multidirezionale",
      link_video: "https://youtube.com/shorts/2LBsvhVglwA",
      data_pubblicazione: null
    },
    {
      id: 240,
      id_esercizio: "240",
      nome_reale: "Knee drives",
      attrezzo: "corpo libero",
      pattern_biomeccanico: "pliometria, saltelli, multidirezionale",
      ruolo: "accessorio",
      tag_biomeccanici: "pliometria, saltelli, multidirezionale \u2022 Multi-planare, Spinta Orizzontale, Connessione Controlaterale, linee spirali, spinta orizzontale",
      link_video: "https://youtube.com/shorts/mifz_6oZJlw",
      data_pubblicazione: null
    },
    {
      id: 241,
      id_esercizio: "241",
      nome_reale: "Kettlebell skater clean",
      attrezzo: "kettlebell",
      pattern_biomeccanico: null,
      ruolo: null,
      tag_biomeccanici: "ballistic, Metcon, Potenza Anaerobica, Potenza Esplosiva, Catena Cinetica Aperta, Connessione Controlaterale, Propedeutica alla Corsa, Propedeutica al Lancio, Multi-planare, Attivazione Core",
      link_video: "https://youtube.com/shorts/HGsz2eixUxk",
      data_pubblicazione: null
    }
  ],
  allenamenti: [
    {
      id: 1,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: 'svolgi ogni movimento per circa 45" anche pi\xF9 volte',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 2,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: 'svolgi ogni movimento per circa 45" anche pi\xF9 volte',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 3,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: 'svolgi ogni movimento per circa 45" anche pi\xF9 volte',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 4,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "2",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "totalizza almeno 30 ripetizioni avanti e 30 indietro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 5,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "10 ripetizioni ogni movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 6,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "2",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "esegui 3 serie per lato da 12 ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 7,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "3",
      id_esercizio: "042",
      nome_esercizio: "Push the wall squat",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "esegui 3 serie per lato da 12 ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 8,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "10 rep ogni movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 9,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "2",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "esegui 3 serie per lato da 15 ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 10,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "3",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Studia con calma il movimento per  almeno 10 minuti, prendendoti le pause che ti servono",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 11,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "10 rep ogni movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 12,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "2",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "fai poche ripetizioni ma ben fatte, su pi\xF9 serie. tiotalizzane almeno  20 x lato",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 13,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "3",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "fai poche ripetizioni ma ben fatte, su pi\xF9 serie. tiotalizzane almeno 40 (20 per lato)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 14,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "10 rep ogni movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 15,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "2",
      id_esercizio: "022",
      nome_esercizio: "Coiled Cable Punch",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "totalizza almeno 30 movimenti per lato con calma e attenzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 16,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "3",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "totalizza almeno 30 movimenti per lato con calma e attenzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 17,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "esegui 3 serie per lato da 12 ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 18,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "10 rep ogni movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 19,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "2",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "totalizza almeno 30 ripetizioni con calma e attenzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 20,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "3",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "totalizza almeno 30 ripetizioni avanti e 30 indietro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 21,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "4",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "esegui 3 serie per lato da 15 ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 22,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "1",
      id_esercizio: "042",
      nome_esercizio: "Push the wall squat",
      parametri: "4 X10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 23,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "2",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 12+12",
      recupero: 'RBS 30" (Rest Betwin Sides)',
      minutaggio_blocco: "",
      note_tecniche: `"Rest Betwin Sides" significa che il recupero va svolto  fra un lato e la'altro. Si usa spesso negli esercizi monolaterali`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 24,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "3",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "3 x 15 + 15",
      recupero: 'RBS 30" (Rest Betwin Sides)',
      minutaggio_blocco: "",
      note_tecniche: `"Rest Betwin Sides" significa che il recupero va svolto  fra un lato e la'altro. Si usa spesso negli esercizi monolaterali`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 25,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "4",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "per l'uso dell'elastico vedi tutorial blade position",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 26,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "5",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "3 X 20",
      recupero: '45/60"',
      minutaggio_blocco: "",
      note_tecniche: "procurati un bastone o un manico di scopa come indicato nel tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 27,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "6",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "5 x 12",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "testa neutra, torace aperto, ritma la respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 28,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "1",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "All'occorrenza puoi usare anche un semplice asciugamano o canovaccio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 29,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "2",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "3 x 15 +15",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 30,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "3",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 12+12",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 31,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "4",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "per l'uso dell'elastico vedi tutorial blade position",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 32,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "5",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "3 X 20",
      recupero: '45/60"',
      minutaggio_blocco: "",
      note_tecniche: "procurati un bastone o un manico di scopa come indicato nel tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 33,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 34,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "2",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: '2 x 20" + 20"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 un esercizio che puoi eseguire in poco spazio, alternando avanzamento e arretramento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 35,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 36,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "2",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 37,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "3",
      id_esercizio: "042",
      nome_esercizio: "Push the wall squat",
      parametri: "4 X10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 38,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 39,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "2",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "3 x 15 +15",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 40,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "3",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "3 X 20",
      recupero: '45/60"',
      minutaggio_blocco: "",
      note_tecniche: "procurati un bastone o un manico di scopa come indicato nel tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 41,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 42,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "2",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "per l'uso dell'elastico vedi tutorial blade position",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 43,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "3",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "5 x 10",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "testa neutra, torace aperto, ritma la respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 44,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "1",
      id_esercizio: "022",
      nome_esercizio: "Coiled Cable Punch",
      parametri: "3 x 12+12",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 45,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "2",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "3 x 12+12",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 46,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "3",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 47,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 48,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "2",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "All'occorrenza puoi usare anche un semplice asciugamano o canovaccio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 49,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "3",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: '2 x 20" + 20"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 un esercizio che puoi eseguire in poco spazio, alternando avanzamento e arretramento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 50,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "3 x 15 +15",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 51,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "1",
      id_esercizio: "042",
      nome_esercizio: "Push the wall squat",
      parametri: "4 X10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Segui il tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 52,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "2",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 53,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "3",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "3 x 15 +15",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 54,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "4",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "per l'uso dell'elastico vedi tutorial blade position",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 55,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "5",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "3 X 20",
      recupero: '45/60"',
      minutaggio_blocco: "",
      note_tecniche: "procurati un bastone o un manico di scopa come indicato nel tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 56,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "6",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "5 x 16",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "testa neutra, torace aperto, ritma la respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 57,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "1",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "All'occorrenza puoi usare anche un semplice asciugamano o canovaccio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 58,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "2",
      id_esercizio: "025",
      nome_esercizio: "Side Closing",
      parametri: "3 x 15 +15",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 59,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "3",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Occorrono gli elastici che puoi trovare al  link fornito nel tuo welcome pack",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 60,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "4",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3 x 12+12",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "per l'uso dell'elastico vedi tutorial blade position",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 61,
      livello: "Home Training Beginner",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "5",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "3 X 20",
      recupero: '45/60"',
      minutaggio_blocco: "",
      note_tecniche: "procurati un bastone o un manico di scopa come indicato nel tutorial",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 62,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "abbina ad ogni ripetizione la corretta respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 63,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "2",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: "2 x 30+30",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "mantieni il busto in linea cercando di muovere solo il bacino",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 64,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "3",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "Tronco stabile, spinta dalle anche e secondariamente dalle gambe",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 65,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "5",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "3 x 20 rep",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "Movimento rapido delle braccia, Cura  lo sviluppo della tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 66,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "6",
      id_esercizio: "043",
      nome_esercizio: "Pounce squat",
      parametri: "3 x10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "sempre un secondo di pausa in basso, apnea in fase di sforzo, mantieni il corretto allineamento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 67,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "7",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "2 x 20+20",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 di fondamentale importanza per il  corretto apprendimento dei futuri esercizi",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 68,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "8",
      id_esercizio: "037",
      nome_esercizio: "Slamball Coiled Blade Position",
      parametri: "3 x10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "non lasciare mai il riferimento del gomito. movimento a carico della gamba anteriore",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 69,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "9",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "3 x 20",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "testa neutra, torace aperto, ritma la respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 70,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "abbina ad ogni ripetizione la corretta respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 71,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "2",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: "2 x 30+30",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "ritma la respirazione col movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 72,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "3",
      id_esercizio: "002",
      nome_esercizio: "skierg pagaia mono",
      parametri: '2 x 60"+60"',
      recupero: 'RBS 15"',
      minutaggio_blocco: "",
      note_tecniche: "fase di trazione in apnea, in spiro in fase ascendente",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 73,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "4",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: '3 x 30"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "Movimento rapido delle braccia, Cura  tecnica e respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 74,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "5",
      id_esercizio: "043",
      nome_esercizio: "Pounce squat",
      parametri: "3 x10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "sempre un secondo di pausa in basso, apnea in fase di sforzo, mantieni il corretto allineamento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 75,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "6",
      id_esercizio: "041",
      nome_esercizio: "Screwdriver Lunges",
      parametri: "3 x 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Cura  tecnica e respirazione. transizione esposiva con pause per ripristinare la posizione corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 76,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "7",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "2 x 10+10",
      recupero: '40"',
      minutaggio_blocco: "",
      note_tecniche: "tecnica di estrema importanza, cura i dettagli",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 77,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "8",
      id_esercizio: "091",
      nome_esercizio: "Elbow Spiderman Toe Tap",
      parametri: "3 x 12",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "curare la correttapostura del core e l'apertura dell'anca senza movimenti eccessivi del bacino",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 78,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "abbina ad ogni ripetizione la corretta respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 79,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "2",
      id_esercizio: "020",
      nome_esercizio: "Butt Scoots",
      parametri: "2 x 30+30",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "solleva contemporaneamente sia il gluteo che  tutta la gamba",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 80,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "3",
      id_esercizio: "004",
      nome_esercizio: "skierg wood chopper",
      parametri: '2 x 40"+40"',
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "cerca torsione e decompressione del tronco, anche qui attiva il core  per chiudere il fianco",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 81,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "4",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: '3 x 30"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Cura  tecnica e respirazione. transizione esposiva con pause per ripristinare la posizione corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 82,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "5",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "2 x 20+20",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 di fondamentale importanza , da curare in ogni dettaglio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 83,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "6",
      id_esercizio: "037",
      nome_esercizio: "Slamball Coiled Blade Position",
      parametri: "3 x10",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "inspia scendendo, transizione in apnea, espirazione esplosiva in alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 84,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "7",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "3 x 10+10",
      recupero: '40"',
      minutaggio_blocco: "",
      note_tecniche: "cura il ritmo della respirazione e la spiralizzazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 85,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "8",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "3 x 30",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "testa neutra, torace aperto, ritma la respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 86,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "9",
      id_esercizio: "091",
      nome_esercizio: "Elbow Spiderman Toe Tap",
      parametri: "3 x 15",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "curare la correttapostura del core e l'apertura dell'anca senza movimenti eccessivi del bacino",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 87,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "respira e mantieni un atteggiamento rilassato e attento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 88,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "2",
      id_esercizio: "022",
      nome_esercizio: "Coiled Cable Punch",
      parametri: "1 x 30+30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura la spiralizzazione in modo maniacale, respira nel modo corretto, spinta esplosiva ma controllata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 89,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "3",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "1 x 30+30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura la spiralizzazione in modo maniacale, respira nel modo corretto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 90,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "4",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "2 x 20+20",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 di fondamentale importanza , da curare in ogni dettaglio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 91,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "5",
      id_esercizio: "043",
      nome_esercizio: "Pounce squat",
      parametri: "3 x10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "sempre un secondo di pausa in basso, apnea in fase di sforzo, mantieni il corretto allineamento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 92,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "6",
      id_esercizio: "169",
      nome_esercizio: "Kettlebell Swing BASIC",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 uno degli esercizi fondamentali, non atrascurare nessun aspetto tecnico, segui il tutorial con attenzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 93,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "7",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "3 x 10+10",
      recupero: '40"',
      minutaggio_blocco: "",
      note_tecniche: "fase esplosiva in alto, transizioni rapide e posizioni stabili",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 94,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "8",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3 x 10+10",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "tieni il riferimento del gomito, tocca il pavimento col ginocchio ad ogni ripetizione, respira correttamente",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 95,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "abbina ad ogni ripetizione la corretta respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 96,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "2",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "3 x 8+8",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "core driven. apnea in fase di spinta, espirazione esplosiva in fase di chiusra della spinta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 97,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "3",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: `anche qui abbiamo lo stesso movimento "coiled" tipido di tutti gli altri esercizi. bacino stabile, un braccio tira e l'altro spinge`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 98,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "4",
      id_esercizio: "091",
      nome_esercizio: "Elbow Spiderman Toe Tap",
      parametri: "3 x 20",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "cerca di non spostarti sul  piano del pavimento, resta immobile co corpo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 99,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "5",
      id_esercizio: "037",
      nome_esercizio: "Slamball Coiled Blade Position",
      parametri: "3 x10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "inspia scendendo, transizione in apnea, espirazione esplosiva in alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 100,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "6",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3 x 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "movimento rapido delle braccia, transizione veloce e precisa, posizioni stabili. Espira durante lo scdrwr",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 101,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "7",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "usa la versione pi\xF9 elementare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 102,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "8",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "3 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "come sulla panca: spiralizzazione, spinta e tirata contemporanee, riespirazione ritmata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 103,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "respira e mantieni un atteggiamento rilassato e attento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 104,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "2",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "Tronco stabile, spinta dalle anche e secondariamente dalle gambe",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 105,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "3",
      id_esercizio: "022",
      nome_esercizio: "Coiled Cable Punch",
      parametri: "1 x 30+30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura la spiralizzazione in modo maniacale, respira nel modo corretto, spinta esplosiva ma controllata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 106,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "4",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "1 x 30+30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura la spiralizzazione in modo maniacale, respira nel modo corretto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 107,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "5",
      id_esercizio: "046",
      nome_esercizio: "Split Switch Screwdriver",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Cura  tecnica e respirazione. transizione esposiva con pause per ripristinare la posizione corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 108,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "6",
      id_esercizio: "169",
      nome_esercizio: "Kettlebell Swing BASIC",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 uno degli esercizi fondamentali, non atrascurare nessun aspetto tecnico, segui il tutorial con attenzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 109,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "7",
      id_esercizio: "051",
      nome_esercizio: "High hand switch",
      parametri: "3 x 12",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "respirazione ritmata, transizioni esplosive e posizioni stabilizzate. Attenzione ai polsi!",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 110,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "8",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "3 x 8+8",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "core driven. apnea in fase di spinta, espirazione esplosiva in fase di chiusra della spinta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 111,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "respira e mantieni un atteggiamento rilassato e attento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 112,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "2",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "2 x 20+20",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "cura anche la respirazione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 113,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "3",
      id_esercizio: "022",
      nome_esercizio: "Coiled Cable Punch",
      parametri: "1 x 30+30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura la spiralizzazione in modo maniacale, respira nel modo corretto, spinta esplosiva ma controllata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 114,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "1 x 30+30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura la spiralizzazione in modo maniacale, respira nel modo corretto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 115,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "5",
      id_esercizio: "048",
      nome_esercizio: "Lockout Position",
      parametri: '1 x 60"+60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "posizione isometrica. Respira, stabilizza e controlla costanrtemente ogni distretto corporeo e ogni particolare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 116,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "6",
      id_esercizio: "050",
      nome_esercizio: "Split Jerk",
      parametri: "3 x 8+8",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "transizioni esplosive e posizioni stabilizzate. Lockout solida e perfetta. Espira in modo potente in chiusura dell'alzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 117,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "7",
      id_esercizio: "049",
      nome_esercizio: "Step/Step back press",
      parametri: "3 x 5+5",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "fare combinate",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 118,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "respira e mantieni un atteggiamento rilassato e attento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 119,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "2",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "RESPIRAZIONE: lo sforzo si fa in apnea, inspira quando ricarichi",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 120,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "3",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: '6 x 30"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Ginocchia e piedi alti, passi lunghi e reattivi, talloni sul sedere",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 121,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "4a",
      id_esercizio: "169",
      nome_esercizio: "Kettlebell Swing BASIC",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 uno degli esercizi fondamentali, non atrascurare nessun aspetto tecnico, segui il tutorial con attenzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 122,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "4b",
      id_esercizio: "046",
      nome_esercizio: "Split Switch Screwdriver",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Cura  tecnica e respirazione. transizione esposiva con pause per ripristinare la posizione corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 123,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "5",
      id_esercizio: "047",
      nome_esercizio: "wall driver",
      parametri: "2 x 30",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "respirazione ritmata, transizioni esplosive e posizioni stabilizzate.Sempre in spinta sul muro!",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 124,
      livello: "Entry Level",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "6",
      id_esercizio: "051",
      nome_esercizio: "High hand switch",
      parametri: "3 x 15",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "respirazione ritmata, transizioni esplosive e posizioni stabilizzate. Attenzione ai polsi!",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 125,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "10 x",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 126,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "postura ben spiralizzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 127,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "3",
      id_esercizio: "055",
      nome_esercizio: "Hang Position ISO",
      parametri: "1 x  RPE 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "ISO: Isometrica-tieni la posizione pi\xF9 in basso possibile, mantenendo una postura corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 128,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "4",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "2 x 8+8",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "reset prima di ogni alzata-I primi cm estremamente lenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 129,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "5",
      id_esercizio: "116",
      nome_esercizio: "High pull bounce",
      parametri: "2 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "accompagna il bilanciere salendo e scendendo con tutto il corpo-tieni sempre il gomito alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 130,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "6",
      id_esercizio: "064",
      nome_esercizio: "High Pull ISO",
      parametri: "1 x  RPE 10",
      recupero: '40"',
      minutaggio_blocco: "",
      note_tecniche: "ricorda di mantenere la corretta spinta frontale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 131,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "7a",
      id_esercizio: "065",
      nome_esercizio: "High Pull",
      parametri: "3 x 5+5",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "JUMP SET",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 132,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "7b",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: "3 x 15+15",
      recupero: 'RBS no - RBE 60"',
      minutaggio_blocco: "",
      note_tecniche: "JUMP SET",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 133,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 134,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "2",
      id_esercizio: "022",
      nome_esercizio: "Coiled Cable Punch",
      parametri: "2 x 15+15",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 135,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "3",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "2 x 15+15",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 136,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "4",
      id_esercizio: "002",
      nome_esercizio: "skierg pagaia mono",
      parametri: '1 x 60"+60"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "La gamba avanzata \xE8 sul lato  opposto a quello in cui si tira",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 137,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "5",
      id_esercizio: "066",
      nome_esercizio: "High pull Step press",
      parametri: "4 x 6+6",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 138,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "6",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "studio",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "senza preoccuparsi di quante serie  o ripetizioni, approfondire la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 139,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 140,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "postura ben spiralizzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 141,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "3a",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: "1 x 3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 142,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "3b",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "1 x 3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "mantieni un ritmo sostenuto: devi terminare con un elevato affanno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 143,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "5",
      id_esercizio: "067",
      nome_esercizio: "High Pull to Step back press",
      parametri: "4 x 6+6",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 144,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "6",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "3 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Posizione ben allungata e spiralizzata-un braccio tire e l'altro spinge",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 145,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "7",
      id_esercizio: "069",
      nome_esercizio: "Split Snatch",
      parametri: "1 x 60",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 snatch per lato curando ogni aspetto tecnico e riposando al bisogno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 146,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "8",
      id_esercizio: "071",
      nome_esercizio: "Slamball coiled Skater's hops",
      parametri: "25 ripetizioni totali per lato",
      recupero: "Se necessario",
      minutaggio_blocco: "",
      note_tecniche: "cura il movimento e la tecncia",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 147,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 148,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "4",
      id_esercizio: "218",
      nome_esercizio: "Landmine Jerk",
      parametri: "4 x 6+6",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica. Resta qualche istante su ogni incastro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 149,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "5",
      id_esercizio: "221",
      nome_esercizio: "Half kneeling snatch",
      parametri: "3 x 6+6",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica. Resta qualche istante su ogni incastro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 150,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "6",
      id_esercizio: "039",
      nome_esercizio: "Slam bal blade pos. dynamic",
      parametri: '3 x 60" + 60"',
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Non lasciare mai il riferimento del gomito, tieni tutto il carico sulla gamba avanzata. Posizione solida e stabile, transizione esplosiva",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 151,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "7",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Posizione stabile. Transizione esplosiva e veloce.  Screwdriver veloce e preciso",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 152,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 153,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "3",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 154,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "4",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3 x 8+8",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "reset prima di ogni alzata-I primi cm estremamente lenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 155,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "5",
      id_esercizio: "067",
      nome_esercizio: "High Pull to Step back press",
      parametri: "4 x 6+6",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 156,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "6",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: "3 x 15+15",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 157,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "7",
      id_esercizio: "100",
      nome_esercizio: "Speed skater touch",
      parametri: '3 x 20"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "sviluppare movimento  arti inferiori",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 158,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "8",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "5' studio",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura nel dettaglio posizioni e transizioni della versione che riesci a fare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 159,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 160,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "3'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 161,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "3a",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: "1 x 4'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 162,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "3b",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "1 x 4'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "mantieni un ritmo sostenuto: devi terminare con un elevato affanno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 163,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "5",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "arrivare sempre a poggiare il bianciere sul petto e stabilizzarloli",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 164,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "6",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "Studio",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "dedicati ad acquisire la corretta tecnica. Utilizza quindi un carico gestibile e non preoccuparti di serie e ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 165,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "7",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "3 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Salita veloce e ritorno pi\xF9 controllato",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 166,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "8",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "Studio",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "dedicati ad acquisire la corretta tecnica. Utilizza quindi un carico gestibile e non preoccuparti di serie e ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 167,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 168,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 169,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "3",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 100 movimenti (50+50) riposando al bisogno e cercando costantemente di migliorarli",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 170,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3 x 8+8",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "Dare esplosivit\xE0 all'alzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 171,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "5",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 8+8",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "cura il trasferimento di carico - mantieni sempre il gomito sotto il bilanciere - tieni le ginocchia ben aperte",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 172,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "6",
      id_esercizio: "217",
      nome_esercizio: "Kettlebell coiled high pull swing",
      parametri: "Studio",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "dedicati ad acquisire la corretta tecnica. Utilizza quindi un carico gestibile e non preoccuparti di serie e ripetizioni",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 173,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "7",
      id_esercizio: "073",
      nome_esercizio: "Lateral landmine clean",
      parametri: "1 x 60",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 60 movimenti (30 per lato) riposando al bisogno e cercando costantemente di migliorarli",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 174,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 175,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "2",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "Isometrica",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 176,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "3",
      id_esercizio: "066",
      nome_esercizio: "High pull Step press",
      parametri: "3 x 8+8",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 177,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "4",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "fermo sul petto, NO fermo in alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 178,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "5",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "1 x 35",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "cerca una versione che ti permette almeno 20 ripetizioni alla prima serie.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 179,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "6a",
      id_esercizio: "099",
      nome_esercizio: "Landmine quick Hops",
      parametri: "3 x 8",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "bilanciere scarico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 180,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "6b",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "usa la versione della volta precedente",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 181,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia alte, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 182,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "2",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "5' studio",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "cura nel dettaglio posizioni e transizioni della versione che riesci a fare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 183,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "3",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 184,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "4",
      id_esercizio: "055",
      nome_esercizio: "Hang Position ISO",
      parametri: "1 x  RPE 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "ISO: Isometrica-tieni la posizione pi\xF9 in basso possibile, mantenendo una postura corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 185,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "5",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "continua a milgiorare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 186,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "6",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "3 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "porta il manubrio verso il fianco, non verso la spalla",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 187,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "7",
      id_esercizio: "217",
      nome_esercizio: "Kettlebell coiled high pull swing",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 100 movimenti (50+50) riposando al bisogno e cercando costantemente di migliorarli",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 188,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 189,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 190,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "3",
      id_esercizio: "024",
      nome_esercizio: "Flag Bearer ISOINERZIALE",
      parametri: "2 x 20+20",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Half kneeling position",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 191,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "4",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "1 x 50",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50 movimenti riposando al bisogno e cercando costantemente di migliorarli",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 192,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "5",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "Studio",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "segui il tutorial e cerca di acquisire la minima tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 193,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "6",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3 x 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "movimento rapido delle braccia, transizione veloce e precisa, posizioni stabili. Espira durante lo scdrwr",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 194,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "7",
      id_esercizio: "088",
      nome_esercizio: "Hollow March progressioni",
      parametri: '120"',
      recupero: "30/60",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 2' di lavoro nella versione pi base dell'esercizio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 195,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "8",
      id_esercizio: "071",
      nome_esercizio: "Slamball coiled Skater's hops",
      parametri: "3 x 10+10",
      recupero: 'RBS 30" - Rest 60"',
      minutaggio_blocco: "",
      note_tecniche: "ogni serie inizia dal lato con cui hai finito",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 196,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "6'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 197,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "2",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "3 x 20",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "nella versione che ti permette il nr di rep indicato (variando ogni serie se serve)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 198,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "3",
      id_esercizio: "036",
      nome_esercizio: "Coiled Blade Position",
      parametri: "Isometrica",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 199,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "4",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Posizione stabile. Transizione esplosiva e veloce.  Screwdriver veloce e preciso",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 200,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "5",
      id_esercizio: "072",
      nome_esercizio: "Lateral Band clean",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Posizione stabile. Transizione esplosiva e veloce. Tira un braccio solo, l'altro accompagna. Usa il core drive",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 201,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "6",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "salita veloce discesa pi\xF9 controllata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 202,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "7",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "1 x 40",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "con il tuo 20 RM precedente totalizza 40 ripetizioni in pi\xF9 serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 203,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 204,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 205,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "3",
      id_esercizio: "055",
      nome_esercizio: "Hang Position ISO",
      parametri: "1 x  RPE 10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "ISO: Isometrica-tieni la posizione pi\xF9 in basso possibile, mantenendo una postura corretta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 206,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "4",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '3 x 60"',
      recupero: '60""',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 207,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "5",
      id_esercizio: "061",
      nome_esercizio: "Kettlebell Step clean",
      parametri: "1 x 60",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 ripetizioni per lato riposando al bisogno e curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 208,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "6",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "continua a milgiorare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 209,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 210,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "6'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 211,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "3",
      id_esercizio: "024",
      nome_esercizio: "Flag Bearer ISOINERZIALE",
      parametri: "2 x 20",
      recupero: 'RBS 15"',
      minutaggio_blocco: "",
      note_tecniche: "Standing position stance neutra",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 212,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "4",
      id_esercizio: "218",
      nome_esercizio: "Landmine Jerk",
      parametri: "4 x 6+6",
      recupero: "Solo Reset e studio, NO rest",
      minutaggio_blocco: "",
      note_tecniche: "Resettare ogni ripetizione, massima cura tecnica. Resta qualche istante su ogni incastro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 213,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "5",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "3 x 8+8",
      recupero: 'RBS 30" Rest 60"',
      minutaggio_blocco: "",
      note_tecniche: "il disco deve toccare terra e ripartire immediatamente",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 214,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "6a",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3 x 8",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "movimento rapido delle braccia, transizione veloce e precisa, posizioni stabili. Espira durante lo scdrwr",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 215,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "6b",
      id_esercizio: "163",
      nome_esercizio: "Arm basic DB pendulum",
      parametri: "3 x 30",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "mantieni il corretto allineamento tronco/gambe, tieni le spalle rilassata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 216,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "11",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 217,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "2",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "1 x 30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 218,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "3",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "3 x 10+10",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Posizione stabile. Transizione esplosiva e veloce.  Screwdriver veloce e preciso",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 219,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "4",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x buffer 0",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "con il tuo 20 RM precedente  fai 3 serie a buffer 0",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 220,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "5",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "cerca un carico pi\xF9 intenso del solito",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 221,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "6",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "eseguili nella versione successiva a quella della volta precedente (da tutorial)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 222,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "1",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '3 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 223,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 224,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "3",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "continua a milgiorare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 225,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "4",
      id_esercizio: "171",
      nome_esercizio: "Kettlebell Skater Swing",
      parametri: "1 x 60",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 movimenti per lato  (Dx+Sx=1rep) curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 226,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "5",
      id_esercizio: "152",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "1 x 30",
      recupero: 'max 75" al bisogno',
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 movimenti recuperando al bisogno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 227,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "6",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "3 x 20",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "nella versione che ti permette il nr di rep indicato (variando ogni serie se serve)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 228,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 229,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "8'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 230,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "3",
      id_esercizio: "219",
      nome_esercizio: "Punch isoinerziale",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50 movimenti per lato curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 231,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4",
      id_esercizio: "171",
      nome_esercizio: "Kettlebell Skater Swing",
      parametri: "1 x 60",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 movimenti per lato curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 232,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "5",
      id_esercizio: "073",
      nome_esercizio: "Lateral landmine clean",
      parametri: "3 x 8+8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "\xE8 importante la stabilit\xE0 della posizione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 233,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "6",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "3 x 8+8",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "cura maniacalmente il core drive e la gestione del baricentro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 234,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "7",
      id_esercizio: "052",
      nome_esercizio: "Dumbell Jerk",
      parametri: "1 x 50",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 25 movimenti per lato curando bene la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 235,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "1",
      id_esercizio: "024",
      nome_esercizio: "Flag Bearer ISOINERZIALE",
      parametri: "2 x 20+20",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "Stance Controlaterale (G.A. sul lato che tira)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 236,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "2",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "2 x 20",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "cura la tecnica, il ritmo, la solidit\xE0 delle posizioni e l'esplosivit\xE0 della transizione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 237,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "3",
      id_esercizio: "220",
      nome_esercizio: "Wall High Pull",
      parametri: "1 x 40",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 20 movimenti per lato curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 238,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "4",
      id_esercizio: "116",
      nome_esercizio: "High pull bounce",
      parametri: "3 x 12",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Alterna mano destra e sinistra",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 239,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "5a",
      id_esercizio: "069",
      nome_esercizio: "Split Snatch",
      parametri: "5 x 5+5",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 240,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "5b",
      id_esercizio: "152",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "5 x 5",
      recupero: 'max 60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 241,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 242,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 243,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "3",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 244,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "4",
      id_esercizio: "088",
      nome_esercizio: "Hollow March progressioni",
      parametri: '3 x 45"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "stessa versione della volta prcedente",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 245,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "5",
      id_esercizio: "100",
      nome_esercizio: "Speed skater touch",
      parametri: '3 x 30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "sviluppare movimento  arti inferiori",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 246,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "6",
      id_esercizio: "153",
      nome_esercizio: "band split jerk",
      parametri: "1 x 30+30",
      recupero: "al bisogno",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 ripetizioni per lato",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 247,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "7",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3 x 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "porta il manubrio verso il fianco, non verso la spalla",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 248,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "1",
      id_esercizio: "018",
      nome_esercizio: "Wall Mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 249,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "10'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 250,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "3",
      id_esercizio: "219",
      nome_esercizio: "Punch isoinerziale",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50 movimenti per lato curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 251,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "4",
      id_esercizio: "172",
      nome_esercizio: "Kettlebell swing to clean",
      parametri: "1 x 100",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50 movimenti per lato curando ogni aspetto tecnico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 252,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "5",
      id_esercizio: "052",
      nome_esercizio: "Dumbell Jerk",
      parametri: "3 x 6+6",
      recupero: 'RBS 30" Res60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 253,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "1",
      id_esercizio: "024",
      nome_esercizio: "Flag Bearer ISOINERZIALE",
      parametri: "2 x 20+20",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "Stance Controlaterale (G.A. sul lato che tira)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 254,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "2",
      id_esercizio: "040",
      nome_esercizio: "Screwdriver",
      parametri: "1 x 30",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "migliora ogni ripetizione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 255,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "3",
      id_esercizio: "165",
      nome_esercizio: "Pendulum Squat TS basic",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 100 movimenti con attenzione tecnica, recuperando al bisogno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 256,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "4",
      id_esercizio: "057",
      nome_esercizio: "Landmine Step Clean",
      parametri: "3 x 10",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "NO SPLIT",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 257,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "5",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "2 x Ricalco precedente + 1 x max",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Ricalca le ripetizioni della volta precedente nelle prime due serie- porta la terza al cedimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 258,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "1",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "X 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 259,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "2",
      id_esercizio: "021",
      nome_esercizio: "Band hip Circuit",
      parametri: "x 15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 260,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "3",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '3 x 60"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 261,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "4",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "consolida il carico dell'ultima volta o prova a incrementare se senti che puoi",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 262,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "5",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "1 x 30",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 30 ripetizioni curando ogni aspetto tecnico e riposandpo al bisogno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 263,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "6",
      id_esercizio: "241",
      nome_esercizio: "Kettlebell skater clean",
      parametri: "3 x 15 +15",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 264,
      livello: "Level 1",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "7",
      id_esercizio: "071",
      nome_esercizio: "Slamball coiled Skater's hops",
      parametri: "3 x 10+10",
      recupero: 'RBS 30" - Rest 60"',
      minutaggio_blocco: "",
      note_tecniche: "ogni serie inizia dal lato con cui hai finito",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 265,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia alte, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 266,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "2a",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 267,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "2b",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 268,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "3",
      id_esercizio: "003",
      nome_esercizio: "skierg pagaia alternato",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "trasferisci il carico da una gamba all'altra insieme alla sbarra",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 269,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "4",
      id_esercizio: "116",
      nome_esercizio: "High pull bounce",
      parametri: '2 x 60"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "alterna Dx e Sx, molleggia sulle gambe seguendo il bilanciere",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 270,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "5",
      id_esercizio: "222",
      nome_esercizio: "Total kneeling snatch",
      parametri: "3 x 8+8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "bilanciere scarico, tieni l'incastro per stabilizzarlo al meglio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 271,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "6",
      id_esercizio: "068",
      nome_esercizio: "Step Snatch",
      parametri: "2 x 2,3,4,5-5,4,3,2",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 272,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "7",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: '3 x 30"+30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "mantieni sempre una postura spiralizzata-carico su gamba avanzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 273,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia late, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 274,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "2a",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 275,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "2b",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 276,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "3",
      id_esercizio: "003",
      nome_esercizio: "skierg pagaia alternato",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "trasferisci il carico da una gamba all'altra insieme alla sbarra",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 277,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "4",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "ritmo standard. correzioni tecniche",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 278,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "5",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "Versione che ti permette 15/20 rep alla prima serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 279,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "6",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "15 RM + 3 X buffer 1",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Cerca la versione che ti permette 15 RM, poi sovlgi 3 serie a buffer 1 in quella modalit\xE0",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 280,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia late, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 281,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "2a",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 282,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "2b",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "3'",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 283,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "3",
      id_esercizio: "003",
      nome_esercizio: "skierg pagaia alternato",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "trasferisci il carico da una gamba all'altra insieme alla sbarra",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 284,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "4",
      id_esercizio: "067",
      nome_esercizio: "High Pull to Step back press",
      parametri: "3 x 6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "-",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 285,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "5",
      id_esercizio: "057",
      nome_esercizio: "Landmine Step Clean",
      parametri: "3 x 6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "T&GO: il disco deve toccare terra e ripartire immediatamente. Movimento esplosivo ed elastico",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 286,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "6",
      id_esercizio: "071",
      nome_esercizio: "Slamball coiled Skater's hops",
      parametri: "3 x 5+5",
      recupero: 'Rest 60"',
      minutaggio_blocco: "",
      note_tecniche: "posizione solida e transizione esplosiva",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 287,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "7",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3 x 8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "movimento rapido delle braccia, transizione veloce e precisa, posizioni stabili. Espira durante lo scdrw",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 288,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "1",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "3'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 289,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia late, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 290,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "3",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: "2'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 291,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "4",
      id_esercizio: "115",
      nome_esercizio: "in in-out out sprawl",
      parametri: "x 12",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "Totalizza 12 sprawl",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 292,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "5",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "6MAV alternato",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: `MAV: Miglior Alzata Veloce, dove con "Veloce" si intende una velocit\xE0 esecutiva ottimale e una tecnica impeccabile, senza avvertire rallentamenti evidenti punti di stallo durante l'alzata`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 293,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "6",
      id_esercizio: "171",
      nome_esercizio: "Kettlebell Skater Swing",
      parametri: "3 x 12",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Dx+Sx=1rep - raggiungi un RPE di almeno 8",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 294,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "7",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "x 10 minuti",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "Studio del movimento per 10 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 295,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "1",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "2'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 296,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia late, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 297,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "3",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: "1'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 298,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "4",
      id_esercizio: "115",
      nome_esercizio: "in in-out out sprawl",
      parametri: "x 15",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "Totalizza 15 sprawl",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 299,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "5",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Reset su ogni rep",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 300,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "6",
      id_esercizio: "222",
      nome_esercizio: "Total kneeling snatch",
      parametri: "3 x 6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Transizioni potenti e posizioni stabili e forti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 301,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "7",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "3 x 20",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "nella versione che ti permette il nr di rep indicato (variando ogni serie se serve)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 302,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "ginocchia late, calciata dietro, falcata lunga, appoggio verticale",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 303,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "2",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: "2'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 304,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "3",
      id_esercizio: "115",
      nome_esercizio: "in in-out out sprawl",
      parametri: "x 20",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "Totalizza 20 sprawl",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 305,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "4",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "consolida il carico dell'ultima volta o prova a incrementare se senti che puoi",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 306,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "5",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "3 x 8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "cura il core drive e la gestione del baricentro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 307,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "6",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x buffer 1",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "versione successiva rel tutorial ispetto a quella della volta scorsa",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 308,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "7",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "Versione che ti permette 15/20 rep alla prima serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 309,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "1",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '3 x 60"',
      recupero: 'min 30 max 60"',
      minutaggio_blocco: "",
      note_tecniche: "Svolgi SIDE SWING se non riesci a fare l'esercizio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 310,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "2",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "3 x 15",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "nella versione che ti permette il nr di rep indicato (variando ogni serie se serve)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 311,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "3",
      id_esercizio: "038",
      nome_esercizio: "Rotational Blade Position",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Transizione veloce. tieni ogni posizione quanlche istante per stabilizzarla",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 312,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "3 x 5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Salta pi\xF9 in alto possibile senza perdere il corretto assetto.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 313,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "5",
      id_esercizio: "225",
      nome_esercizio: "Ball over shoulder",
      parametri: '3 x 60"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "Alterna la spalla ogni movimento. Tieni un ritmo molto sostenuto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 314,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "6",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 7+7",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "continua a milgiorare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 315,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "7",
      id_esercizio: "217",
      nome_esercizio: "Kettlebell coiled high pull swing",
      parametri: "3 x 10+10",
      recupero: 'RBS 30" Rest 60"',
      minutaggio_blocco: "",
      note_tecniche: "-",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 316,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "8",
      id_esercizio: "115",
      nome_esercizio: "in in-out out sprawl",
      parametri: "AMRAP 5 min.",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP: as many reps (o round) as possibile. Nel tempo stabilito devi sffettuare il maggior nr possibile di ripetizioni (in questo caso di sprawl)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 317,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "1",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '5 x 60"',
      recupero: 'min 30 max 60"',
      minutaggio_blocco: "",
      note_tecniche: "Svolgi SIDE SWING se non riesci a fare l'esercizio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 318,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "2",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "3 x 15",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "nella versione che ti permette il nr di rep indicato (variando ogni serie se serve)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 319,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "3",
      id_esercizio: "038",
      nome_esercizio: "Rotational Blade Position",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Transizione veloce. tieni ogni posizione quanlche istante per stabilizzarla",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 320,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "4",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "3 x 5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Salta pi\xF9 in alto possibile senza perdere il corretto assetto.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 321,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "5",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "Buffer 0 su ogni serie (quindi carico variabile)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 322,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "6",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x buffer 0",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "Stessa versione della scorsa volta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 323,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "7",
      id_esercizio: "083",
      nome_esercizio: "Landmine press side step",
      parametri: "1 x 50 RPE max 7",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50 rep (25 per lato) senza che l'eccessivo carico infici la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 324,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "8",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "Versione successiva a quella scorsa",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 325,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "1",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '5 x 60"',
      recupero: 'min 30 max 60"',
      minutaggio_blocco: "",
      note_tecniche: "Svolgi SIDE SWING se non riesci a fare l'esercizio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 326,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "2",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: "3 x 15",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "nella versione che ti permette il nr di rep indicato (variando ogni serie se serve)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 327,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "3",
      id_esercizio: "038",
      nome_esercizio: "Rotational Blade Position",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Transizione veloce. tieni ogni posizione quanlche istante per stabilizzarla",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 328,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "4",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "3 x 5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Salta pi\xF9 in alto possibile senza perdere il corretto assetto.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 329,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "5",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 7+7",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "continua a milgiorare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 330,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "6",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Carica il leg drive dal basso ogni rep. gamba avanti in fiamme",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 331,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "7",
      id_esercizio: "226",
      nome_esercizio: "Coiled kettlebell swing to snatch",
      parametri: "1 x 50",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "Totalizza 50 rep (25 + 25) per imparare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 332,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "1",
      id_esercizio: "103",
      nome_esercizio: "Heavy ROPE - race & chase",
      parametri: "Studio aleno 8 mnuti",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "se riesce facile aumenta il ritmo fino al cedimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 333,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "2a",
      id_esercizio: "227",
      nome_esercizio: "Skyerg lunges",
      parametri: '5 x 45"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 334,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "2b",
      id_esercizio: "097",
      nome_esercizio: "Endless rope Plank Alternating Pull",
      parametri: '5 x 45"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 335,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "3",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "6MAV alternato",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: `MAV: Miglior Alzata Veloce, dove con "Veloce" si intende una velocit\xE0 esecutiva ottimale e una tecnica impeccabile, senza avvertire rallentamenti evidenti punti di stallo durante l'alzata`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 336,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "4",
      id_esercizio: "123",
      nome_esercizio: "Box Jump over",
      parametri: "x 100",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "toalizza 100 box jump over",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 337,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "1",
      id_esercizio: "103",
      nome_esercizio: "Heavy ROPE - race & chase",
      parametri: "Studio aleno 4 minuti",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "se riesce facile aumenta il ritmo fino al cedimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 338,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "2a",
      id_esercizio: "227",
      nome_esercizio: "Skyerg lunges",
      parametri: '5 x 45"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 339,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "2b",
      id_esercizio: "097",
      nome_esercizio: "Endless rope Plank Alternating Pull",
      parametri: '5 x 45"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 340,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "3",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "3 x 8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "ritesta i carichi della scorsa volta e valuta se puoi incrementare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 341,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "4",
      id_esercizio: "181",
      nome_esercizio: "Single Dumbbell T/S",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50+50 movimenti per apprendere correttamemnte la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 342,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "5",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50+50 movimenti per apprendere correttamemnte la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 343,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "6",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "1 x 100",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 50+50 movimenti per apprendere correttamemnte la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 344,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "1",
      id_esercizio: "103",
      nome_esercizio: "Heavy ROPE - race & chase",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "se riesce facile aumenta il ritmo fino al cedimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 345,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "2a",
      id_esercizio: "227",
      nome_esercizio: "Skyerg lunges",
      parametri: '5 x 45"',
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 346,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "2b",
      id_esercizio: "097",
      nome_esercizio: "Endless rope Plank Alternating Pull",
      parametri: '5 x 45"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 347,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "3",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3 x 8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Reset su ogni rep",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 348,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "4",
      id_esercizio: "226",
      nome_esercizio: "Coiled kettlebell swing to snatch",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "cambio mano al volo alla 10\xB0 rep senza fermarsi",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 349,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "5a",
      id_esercizio: "015",
      nome_esercizio: "spingere in salita",
      parametri: '3 x 60"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 350,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "5b",
      id_esercizio: "200",
      nome_esercizio: "Sprint massimale in salita",
      parametri: '3 x 12"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 351,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "1",
      id_esercizio: "007",
      nome_esercizio: "Coiled skyerg",
      parametri: '2 x 45"+45"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 352,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "2",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "1 X 50",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 353,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "3",
      id_esercizio: "193",
      nome_esercizio: "Endless rope Half kneeling lateral pull",
      parametri: '2 x 45"+45"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 354,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "4",
      id_esercizio: "136",
      nome_esercizio: "Cross jump 2-1-2",
      parametri: "1 x 50",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "usa uno step adatto al tuo livello e totalizza 50 salti recuperando ogni 4-6 rep",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 355,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "5",
      id_esercizio: "218",
      nome_esercizio: "Landmine Jerk",
      parametri: "1 x 40",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "studio-totalizza almeno il nr di rep indicato cercando di affinare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 356,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "6",
      id_esercizio: "173",
      nome_esercizio: "DB/Kett. step Snatch",
      parametri: "1 x 40",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "studio-totalizza almeno il nr di rep indicato cercando di affinare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 357,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "1",
      id_esercizio: "007",
      nome_esercizio: "Coiled skyerg",
      parametri: '2 x 45"+45"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 358,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "2",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "1 X 50",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 359,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "3",
      id_esercizio: "193",
      nome_esercizio: "Endless rope Half kneeling lateral pull",
      parametri: '2 x 45"+45"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 360,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "4",
      id_esercizio: "112",
      nome_esercizio: "Icky shuffle variato",
      parametri: "3 x 4 A.R.",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: '4 volte andata e ritorno, poi. recupera 60"',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 361,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "5",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "5MAV",
      recupero: '30/90"',
      minutaggio_blocco: "",
      note_tecniche: "incrementi da bilanciere scarico fino a 5 MAV (al massimo 6 serie)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 362,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "6",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x buffer 1",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "Stessa versione della scorsa volta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 363,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "7",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "Stessa versione della scoirsa volta, valuta eventuali differenze nell'esecuzione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 364,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "1",
      id_esercizio: "007",
      nome_esercizio: "Coiled skyerg",
      parametri: '2 x 45"+45"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 365,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "2",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "1 X 50",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 366,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "3",
      id_esercizio: "193",
      nome_esercizio: "Endless rope Half kneeling lateral pull",
      parametri: '2 x 45"+45"',
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 367,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "4",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 6+6",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "continua a milgiorare la tecnica",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 368,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "5",
      id_esercizio: "087",
      nome_esercizio: "banded hollow March (solo gambe)",
      parametri: "3 x 20",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 369,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "6",
      id_esercizio: "152",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "6 x EMOM 10'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 370,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "1",
      id_esercizio: "103",
      nome_esercizio: "Heavy ROPE - race & chase",
      parametri: '3 x 90"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "se riesce facile aumenta il ritmo fino al cedimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 371,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "2",
      id_esercizio: "123",
      nome_esercizio: "Box Jump over",
      parametri: "10 x EMOM 10'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "EMOM=Every Minute On the Minute: eseguire un numero prestabilito di ripetizioni di uno o pi\xF9 esercizi all'inizio di ogni minuto; il tempo che avanza prima dello scoccare del minuto successivo costituisce l'unico tempo di recupero",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 372,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "3",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3 x 8+8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "-",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 373,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 374,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "5",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: "500mt",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 375,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "6",
      id_esercizio: "097",
      nome_esercizio: "Endless rope Plank Alternating Pull",
      parametri: '3 X 45"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 376,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "1",
      id_esercizio: "002",
      nome_esercizio: "skierg pagaia mono",
      parametri: '3 x 60"+60"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "la gamba avanti opposta al alto in cui tiri",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 377,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "2",
      id_esercizio: "172",
      nome_esercizio: "Kettlebell swing to clean",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 378,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "3",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "3 x 8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Carica il leg drive dal basso ogni rep. gamba avanti in fiamme",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 379,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "4",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: "1 x 120",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "totalizza 60+60 movimenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 380,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "5",
      id_esercizio: "014",
      nome_esercizio: "corsa in salita",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 381,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "1",
      id_esercizio: "007",
      nome_esercizio: "Coiled skyerg",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 382,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "2",
      id_esercizio: "123",
      nome_esercizio: "Box Jump over",
      parametri: "10 x EMOM 10'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "-",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 383,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "3",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "5MAV",
      recupero: '30/90"',
      minutaggio_blocco: "",
      note_tecniche: "regolarizza e/o correggi gli incrementi della scrosa volta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 384,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "4",
      id_esercizio: "180",
      nome_esercizio: "single Dumbbell Pendulum lunge",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 385,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "5",
      id_esercizio: "097",
      nome_esercizio: "Endless rope Plank Alternating Pull",
      parametri: '3 X 45"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 386,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "6",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 387,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "1",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: '3 x 60"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 388,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "2",
      id_esercizio: "014",
      nome_esercizio: "corsa in salita",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 389,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "3",
      id_esercizio: "204",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "8 x EMOM 10'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 390,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "4",
      id_esercizio: "062",
      nome_esercizio: "Landmine clean NO DOWN",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 391,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "5",
      id_esercizio: "228",
      nome_esercizio: "COMBO Side kick through + Sprawl",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 392,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "6",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 393,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "1",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '5 x 60"',
      recupero: 'min 30 max 60"',
      minutaggio_blocco: "",
      note_tecniche: "Svolgi SIDE SWING se non riesci a fare l'esercizio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 394,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "2",
      id_esercizio: "207",
      nome_esercizio: "Seated Endless rope power pull",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 395,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "3",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 396,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "4",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "3 x 5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "Salta pi\xF9 in alto possibile senza perdere il corretto assetto.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 397,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "5",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "5MAV",
      recupero: '30/90"',
      minutaggio_blocco: "",
      note_tecniche: "regolarizza e/o correggi gli incrementi della scrosa volta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 398,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "6",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 399,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "1",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: "x 10 min",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Studia e acquisisci il movimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 400,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "2",
      id_esercizio: "112",
      nome_esercizio: "Icky shuffle variato",
      parametri: "3 x 4 A.R.",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: '4 volte andata e ritorno, poi. recupera 60"',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 401,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "3",
      id_esercizio: "180",
      nome_esercizio: "single Dumbbell Pendulum lunge",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 402,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "4",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3 x 8 Buffer 0 su ogni serie",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "Buffer 0 su ogni serie = trovare il giusto carico iniziale (8RM) e variarlo in base alla fatica  in modo da termianare ogni serie a BUFFER 0",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 403,
      livello: "Level 2",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "5",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "-",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "il tempo rimanente della sessione lo passi su airbike o, in mancanza, in altro esercizio cardio",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 404,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "1",
      id_esercizio: "109",
      nome_esercizio: "in in-out out",
      parametri: "4 x 4 A.R.",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "effettua 4 volta andata e ritorno e poi recupera",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 405,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "2",
      id_esercizio: "083",
      nome_esercizio: "Landmine press side step",
      parametri: "4 X 6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "Stabilizza completamente la aposizione di arrivo.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 406,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "3a",
      id_esercizio: "181",
      nome_esercizio: "Single Dumbbell T/S",
      parametri: "3 X 15+15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Super Serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 407,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "3b",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "3 X 10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Super Serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 408,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "4a",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: "15 Cal",
      recupero: "Nessuno",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP - 20 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 409,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "4b",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "10 rep totali",
      recupero: "Nessuno",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP - 20 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 410,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 1",
      sequenza: "4c",
      id_esercizio: "039",
      nome_esercizio: "Slam bal blade pos. dynamic",
      parametri: "5+5 rep",
      recupero: "Nessuno",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP - 20 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 411,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "1",
      id_esercizio: "112",
      nome_esercizio: "Icky shuffle variato",
      parametri: "3 x 4 A.R.",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: '4 volte andata e ritorno, poi. recupera 60"',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 412,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "2",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "ramping 6+6MAV",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "Se la presa \xE8 l'anello debole, usa le fasce",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 413,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "3",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x buffer 0",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "Stessa versione della scorsa volta",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 414,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "4",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: '4 x 60"',
      recupero: '30-60"',
      minutaggio_blocco: "",
      note_tecniche: "2' in un senso e 2 nell'altro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 415,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 2",
      sequenza: "5",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x 10",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "ogni serie ad RPE 10",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 416,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "1",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 417,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "2",
      id_esercizio: "184",
      nome_esercizio: "Box Jump Over",
      parametri: "3 x 12",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 418,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "3",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4 x 6+6",
      recupero: '60-90"',
      minutaggio_blocco: "",
      note_tecniche: "Buffer 1 su ogni serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 419,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "4",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "4 x 6",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "Buffer 1 su ogni serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 420,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "5",
      id_esercizio: "096",
      nome_esercizio: "coiled Ax Sit up",
      parametri: "3 x 20",
      recupero: '60-90"',
      minutaggio_blocco: "",
      note_tecniche: "Alternare ogni ripetizione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 421,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 3",
      sequenza: "7",
      id_esercizio: "019",
      nome_esercizio: "Ground mobility Series",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Cool down.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 422,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "1",
      id_esercizio: "111",
      nome_esercizio: "Heisman Shuffle",
      parametri: "3 x 2 x A.R.",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 423,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "2a",
      id_esercizio: "083",
      nome_esercizio: "Landmine press side step",
      parametri: "4 X 6+6",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Super Serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 424,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "2b",
      id_esercizio: "086",
      nome_esercizio: "Power Coiled plank progressioni",
      parametri: '4 x 30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Super Serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 425,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "3",
      id_esercizio: "181",
      nome_esercizio: "Single Dumbbell T/S",
      parametri: "3 X 15+15",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Usa un carico considerevole ma che permetta di essere tecnicamente perfetti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 426,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "4a",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "x 10 Cal",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP - 20 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 427,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "4b",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: "x 20",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP - 20 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 428,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 4",
      sequenza: "4c",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "1x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP - 20 minuti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 429,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "1",
      id_esercizio: "110",
      nome_esercizio: "quarter turn",
      parametri: "4 x 1 A.R.",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: '1 volte andata e ritorno, poi recupera 30"',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 430,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "2",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x 6-10",
      recupero: '75-90"',
      minutaggio_blocco: "",
      note_tecniche: "svolgile in una versione che ti permetta di rimanere nel range indicato, a buffer 1-2",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 431,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "3",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3 x 7-10",
      recupero: 'RBS 40"',
      minutaggio_blocco: "",
      note_tecniche: "tutte a buffer 0",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 432,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 5",
      sequenza: "4",
      id_esercizio: "104",
      nome_esercizio: "Overhand Matadors Wheel",
      parametri: "x 3-5 min",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "studio o RPE: se facile usa una corda e una velocit\xE0 che ti porti ad RPE alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 433,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "5",
      id_esercizio: "105",
      nome_esercizio: "Underhand Matadors Wheel",
      parametri: "x 3-5 min",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "studio o RPE: se facile usa una corda e una velocit\xE0 che ti porti ad RPE alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 434,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "6",
      id_esercizio: "241",
      nome_esercizio: "Kettlebell skater clean",
      parametri: "4 x 15+15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Lavora ad RPE alto ma senza sporcare la tecnica (tip MAV)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 435,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "7",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x 8-10",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "esegui una versione che ti permette di stare in questo range a buffer 0-2",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 436,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "1",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "3'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "RPE 9",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 437,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "2",
      id_esercizio: "117",
      nome_esercizio: "Landmine quick Hops",
      parametri: "4 x 6",
      recupero: '45-60"',
      minutaggio_blocco: "",
      note_tecniche: "massima esplosivit\xE0",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 438,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "3",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "5+5 MAV",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: `MAV: Miglior Alzata Veloce, dove con "Veloce" si intende una velocit\xE0 esecutiva ottimale e una tecnica impeccabile, senza avvertire rallentamenti evidenti punti di stallo durante l'alzata`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 439,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "4",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3 x 10",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "ogni serie a RPE 8",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 440,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "5",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x 10",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "ogni serie ad RPE 10",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 441,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 6",
      sequenza: "6",
      id_esercizio: "089",
      nome_esercizio: "Deadbug",
      parametri: "4 x 20",
      recupero: "60s",
      minutaggio_blocco: "",
      note_tecniche: "utilizza MEDBALL-contatto a terra soltanto con zona lombare - allungati il pi\xF9 possibile",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 442,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "1",
      id_esercizio: "113",
      nome_esercizio: "180\xB0 rotation jump",
      parametri: "5 x 2 A.R.",
      recupero: '45-60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 443,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "2",
      id_esercizio: "049",
      nome_esercizio: "Step/Step back press",
      parametri: "5+5 MAV",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Ramping, stesse modalit\xE0 di sempre",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 444,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "3",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: "3 x 20",
      recupero: "90s",
      minutaggio_blocco: "",
      note_tecniche: "posizione sempre spiralizzata, tieni sempre il gomito sul suo riferimento",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 445,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4a",
      id_esercizio: "004",
      nome_esercizio: "skierg wood chopper",
      parametri: '45"',
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 446,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4b",
      id_esercizio: "039",
      nome_esercizio: "Slam bal blade pos. dynamic",
      parametri: "10+10 rep",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 447,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 7",
      sequenza: "4c",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "10 rep totali",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 448,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "1",
      id_esercizio: "114",
      nome_esercizio: "Skier touch",
      parametri: "5 x 1 A.R.",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: `fai un'andata e ritorno poi recupera  45"`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 449,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "2",
      id_esercizio: "207",
      nome_esercizio: "Seated Endless rope power pull",
      parametri: '4 x 60"',
      recupero: "60s",
      minutaggio_blocco: "",
      note_tecniche: "tieni il busto inclinato almeno a 45\xB0",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 450,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "3",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "ramping 6+6MAV",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "stessa progressione precedente, nota se ci sono cambiamenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 451,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "4",
      id_esercizio: "105",
      nome_esercizio: "Underhand Matadors Wheel",
      parametri: '6 x 60"',
      recupero: "60s",
      minutaggio_blocco: "",
      note_tecniche: "studio o RPE",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 452,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 8",
      sequenza: "5",
      id_esercizio: "241",
      nome_esercizio: "Kettlebell skater clean",
      parametri: '4 x 30"+30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "RPE alto",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 453,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "1",
      id_esercizio: "016",
      nome_esercizio: "Trainare in salita",
      parametri: '4 X 30+30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 454,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "2",
      id_esercizio: "186",
      nome_esercizio: "Box Jump",
      parametri: "x 30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "rpe basso - tempi dilatati - cerca di provare altezza maggiore delle volte precedenti se possibile",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 455,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "3",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "5+5 MAV",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "ricalca la progressione della scorsa volta e vedi se ci sono miglioramenti da fare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 456,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "4",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "4 x 6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "massima potenza",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 457,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 9",
      sequenza: "5",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "3 x 15+15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Core e hip hinge.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 458,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "1",
      id_esercizio: "115",
      nome_esercizio: "in in-out out sprawl",
      parametri: "4 x 4 A.R.",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: 'effettua 4 volta andata e ritorno e poi recupera 45"',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 459,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "2",
      id_esercizio: "083",
      nome_esercizio: "Landmine press side step",
      parametri: "5+5 MAV",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "MAV: velocit\xE0 esecutiva ottimale e una tecnica impeccabile, senza avvertire rallentamenti evidenti punti di stallo durante l'alzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 460,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "3",
      id_esercizio: "181",
      nome_esercizio: "Single Dumbbell T/S",
      parametri: "4 X 10+10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Usa un carico considerevole ma che permetta di essere tecnicamente perfetti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 461,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "4a",
      id_esercizio: "011",
      nome_esercizio: "Air bike regular",
      parametri: "12 Cal",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 462,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "4b",
      id_esercizio: "188",
      nome_esercizio: "Kettlebell Snatch",
      parametri: "10+10 rep",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 463,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 10",
      sequenza: "4c",
      id_esercizio: "185",
      nome_esercizio: "Burpee Box Jump Over",
      parametri: "8 rep",
      recupero: "no",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 464,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "1",
      id_esercizio: "112",
      nome_esercizio: "Icky shuffle variato",
      parametri: "3 x 4 A.R.",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: '4 volte andata e ritorno, poi. recupera 60"',
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 465,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "2",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x 6-10",
      recupero: '75-90"',
      minutaggio_blocco: "",
      note_tecniche: "svolgile in una versione che ti permetta di rimanere nel range indicato, a buffer 1-2",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 466,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "3",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "ramping 6+6MAV",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "stessa progressione precedente, nota se ci sono cambiamenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 467,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "4",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: '4 x 60"',
      recupero: '30-60"',
      minutaggio_blocco: "",
      note_tecniche: "2' in un senso e 2' nell'altro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 468,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "5",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "esegui modalit\xE0 che ti facciano rimanere sempre fra le 6 e le 10 rep",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 469,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 11",
      sequenza: "6",
      id_esercizio: "094",
      nome_esercizio: "Transverse twist",
      parametri: "Studio o rpe x 5-8 min min",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "se gi\xE0 pratico cerca la massima intensit\xE0 su 10-15 rep- altrimenti studia  il movimentoc con cura",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 470,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "1",
      id_esercizio: "016",
      nome_esercizio: "Trainare in salita",
      parametri: '4 x 30"+30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 471,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "2",
      id_esercizio: "010",
      nome_esercizio: "Run",
      parametri: "5'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 472,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "3",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3 x 8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "Ogni serie a RPE 8-9",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 473,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "4a",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: "12 Cal",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 474,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "4b",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "x 12",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 475,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "4c",
      id_esercizio: "204",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "x 12",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 476,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 12",
      sequenza: "4d",
      id_esercizio: "091",
      nome_esercizio: "Elbow Spiderman Toe Tap",
      parametri: "x 36",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 477,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "1",
      id_esercizio: "102",
      nome_esercizio: "jumping rope",
      parametri: '4 x 50"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "Variante facilitata: jumping jack o side swing jump per chi non ha fluidit\xE0 di salto.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 478,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "2",
      id_esercizio: "083",
      nome_esercizio: "Landmine press side step",
      parametri: "5+5 MAV",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "ricalca la progressione della volta precedente e nota se ci sono differenze",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 479,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "3",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "5 MAV",
      recupero: '30-90"',
      minutaggio_blocco: "",
      note_tecniche: `MAV: Miglior Alzata Veloce, dove con "Veloce" si intende una velocit\xE0 esecutiva ottimale e una tecnica impeccabile, senza avvertire rallentamenti evidenti punti di stallo durante l'alzata`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 480,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "4",
      id_esercizio: "180",
      nome_esercizio: "single Dumbbell Pendulum lunge",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 481,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 13",
      sequenza: "5",
      id_esercizio: "096",
      nome_esercizio: "coiled Ax Sit up",
      parametri: "3 x 30+30",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "esecuzione esplosiva e veloce",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 482,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "1",
      id_esercizio: "111",
      nome_esercizio: "Heisman Shuffle",
      parametri: "3 x 2 x A.R.",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 483,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "2",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "3 x 6-10",
      recupero: '75-90"',
      minutaggio_blocco: "",
      note_tecniche: "svolgile in una versione che ti permetta di rimanere nel range indicato, a buffer 1-2",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 484,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "3",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "ramping 6+6MAV",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "stessa progressione precedente, nota se ci sono cambiamenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 485,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "4a",
      id_esercizio: "104",
      nome_esercizio: "Overhand Matadors Wheel",
      parametri: '3 x 60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "SS - alterna con esercizio successivo senza riposare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 486,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "4b",
      id_esercizio: "105",
      nome_esercizio: "Underhand Matadors Wheel",
      parametri: '3 x 60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "SS - alterna con esercizio precedente senza riposare",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 487,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 14",
      sequenza: "5",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "esegui modalit\xE0 che ti facciano rimanere sempre fra le 6 e le 10 rep",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 488,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "1",
      id_esercizio: "016",
      nome_esercizio: "Trainare in salita",
      parametri: '4 x 30"+30"',
      recupero: 'RBS 15"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 489,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "2",
      id_esercizio: "203",
      nome_esercizio: "Plyometric lunges",
      parametri: "5 x 10",
      recupero: 'Rest 60"',
      minutaggio_blocco: "",
      note_tecniche: "esprimere la massima potenza: si cerca di saltare pi\xF9 in alto possibile ad ogni ripetizione",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 490,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "3",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "5+5 MAV",
      recupero: 'RBS 45-90"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 491,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "4",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "4 x 8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "Potenza Esplosiva. Seconda esposizione: incremento di volume. Ricorda: braccio portante sempre disteso, limite massima estensione al bacino. Nessuna trazione al petto.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 492,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 15",
      sequenza: "5",
      id_esercizio: "026",
      nome_esercizio: "Diagonal Band Deadlift",
      parametri: "4 x 15+15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Core e hip hinge.",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 493,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "1",
      id_esercizio: "109",
      nome_esercizio: "in in-out out",
      parametri: "4 x 4 A.R.",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "effettua 4 volta andata e ritorno e poi recupera",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 494,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "3",
      id_esercizio: "180",
      nome_esercizio: "single Dumbbell Pendulum lunge",
      parametri: "3 x 10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "usa lo stesso carico della volta precedente e osserva se ci sono differenze",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 495,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4a",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: "x 15 Cal",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 496,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4b",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: "x 30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 497,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4c",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 30'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 498,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 16",
      sequenza: "4d",
      id_esercizio: "204",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 499,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "1a",
      id_esercizio: "016",
      nome_esercizio: "Trainare in salita",
      parametri: '2 x 60+60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "SS - 2 volte per lato senza recupero",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 500,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "1b",
      id_esercizio: "015",
      nome_esercizio: "spingere in salita",
      parametri: '2 x 60"',
      recupero: "60s",
      minutaggio_blocco: "",
      note_tecniche: "SS",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 501,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "2a",
      id_esercizio: "109",
      nome_esercizio: "in in-out out",
      parametri: "4 x 4 A.R.",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "SS - 4 volta andata e ritorno, poi passa al successivo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 502,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "2b",
      id_esercizio: "113",
      nome_esercizio: "180\xB0 rotation jump",
      parametri: "4 x 2 A.R.",
      recupero: '30"',
      minutaggio_blocco: "",
      note_tecniche: "SS - 2 volte andata e ritorno poi passa al precedente",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 503,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "3",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "6+6 MAV",
      recupero: 'RBS 30" RBE 60"',
      minutaggio_blocco: "",
      note_tecniche: "stessa progressione precedente, nota se ci sono cambiamenti",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 504,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "4a",
      id_esercizio: "208",
      nome_esercizio: "Landmine Plyo Lift NO DOWN",
      parametri: "4 x 6+6",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "SS",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 505,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 17",
      sequenza: "4b",
      id_esercizio: "091",
      nome_esercizio: "Elbow Spiderman Toe Tap",
      parametri: "4 x 30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "SS",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 506,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "1a",
      id_esercizio: "014",
      nome_esercizio: "corsa in salita",
      parametri: '4 x 30"',
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "SS",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 507,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "1b",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: '4x 30"',
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "SS - alterna il senso ogni round",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 508,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "2",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "5+5 MAV",
      recupero: 'RBS 45-90"',
      minutaggio_blocco: "",
      note_tecniche: "Ricalca la progressione della volta precedente e nota se ci sono differenze",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 509,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "3A",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: "x 15 cal",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 510,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "3B",
      id_esercizio: "123",
      nome_esercizio: "Box Jump over",
      parametri: "x 15",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 25'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 511,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 18",
      sequenza: "3C",
      id_esercizio: "203",
      nome_esercizio: "Plyometric lunges",
      parametri: "2 X 20",
      recupero: 'RBE 30"',
      minutaggio_blocco: "",
      note_tecniche: `AMRAP 25' - svolgi 10 salti, recupera 30", svolgi altri 10 salti`,
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 512,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "1b",
      id_esercizio: "016",
      nome_esercizio: "Trainare in salita",
      parametri: '4 x 30+30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "SS (super serie)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 513,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "1b",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: '4 x 60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "SS (super serie) - alterna il senso ogni round",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 514,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "2A",
      id_esercizio: "110",
      nome_esercizio: "quarter turn",
      parametri: "4 x A.R. x 2",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "-",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 515,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "2B",
      id_esercizio: "115",
      nome_esercizio: "in in-out out sprawl",
      parametri: "4 x 4 A.R.",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "-",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 516,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "3",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3 x 8/10+8/10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Ogni Serie a buffer 2-1",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 517,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "4A",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "3 x 8/10+8/10",
      recupero: 'RBS 30"',
      minutaggio_blocco: "",
      note_tecniche: "Ogni Serie a buffer 2-1",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 518,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 19",
      sequenza: "4B",
      id_esercizio: "094",
      nome_esercizio: "Transverse twist",
      parametri: "4 x 20+20 o studio",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Se il movimento non \xE8 sufficientemente consolidato dedica 4-5 minuti per lato a perfezionarlo",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 519,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "1",
      id_esercizio: "015",
      nome_esercizio: "spingere in salita",
      parametri: "1 x 3'",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 520,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "2",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: '4 x 60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "2' in un senso e 2 nell'altro",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 521,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "3",
      id_esercizio: "050",
      nome_esercizio: "Split Jerk",
      parametri: "5+5 MAV",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 522,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "4A",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: "x 10 cal",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 20'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 523,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "4B",
      id_esercizio: "204",
      nome_esercizio: "Tuck Jump burpees",
      parametri: "x 20",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 20'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 524,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "4C",
      id_esercizio: "061",
      nome_esercizio: "Kettlebell Step clean",
      parametri: "x 30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 20'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 525,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 20",
      sequenza: "4D",
      id_esercizio: "092",
      nome_esercizio: "Bicycle Crunches",
      parametri: "x 40",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 20'",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 526,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "1",
      id_esercizio: "015",
      nome_esercizio: "spingere in salita",
      parametri: "1x 3'",
      recupero: "-",
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 527,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "2",
      id_esercizio: "090",
      nome_esercizio: "dragon flag progressioni",
      parametri: "3 x max",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "esegui modalit\xE0 che ti facciano rimanere sempre fra le 6 e le 8 rep",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 528,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "3",
      id_esercizio: "105",
      nome_esercizio: "Underhand Matadors Wheel",
      parametri: '4 x 60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Alterna ogni minuto o comunque suddividi il lavoro in base al bisogno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 529,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "4",
      id_esercizio: "106",
      nome_esercizio: "Dragon Roll",
      parametri: '4 x 60"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Alterna ogni minuto o comunque suddividi il lavoro in base al bisogno",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 530,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "5a",
      id_esercizio: "111",
      nome_esercizio: "Heisman Shuffle",
      parametri: "4 x 2A.R.",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "Super Serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 531,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "5b",
      id_esercizio: "114",
      nome_esercizio: "Skier touch",
      parametri: "4 x 2A.R.",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "Super Serie",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 532,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "6",
      id_esercizio: "069",
      nome_esercizio: "Split Snatch",
      parametri: "1 MAV studio",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "lavoro tecnico sulla singola ripetizione - scomporre se necessario l'esercizio per migliorare i vari range dell'alzata",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 533,
      livello: "Advanced",
      settimana: "Ciclo unico",
      giorno: "Giorno 21",
      sequenza: "7",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "4x 20",
      recupero: '60/90"',
      minutaggio_blocco: "",
      note_tecniche: "",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 610,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "1 - Video",
      sequenza: "",
      id_esercizio: "214",
      nome_esercizio: "Il tuo Start up, ecco coasa devi sapere",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "Introduzione all Lab, Appprofondimento.",
      link_video: "https://youtu.be/Ym7gkfyJYIQ?si=Nasv6xm5cP41XpnZ",
      data_pubblicazione: null
    },
    {
      id: 611,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "2 - Video",
      sequenza: "",
      id_esercizio: "212",
      nome_esercizio: "Lab: filosofia e regole",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "regole, filosofia, norme di comportamento, approfondimento.",
      link_video: "https://youtu.be/kzu3kHyCFJk?si=X8Ix3qpxu4L-Mw7U",
      data_pubblicazione: null
    },
    {
      id: 612,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "3 - Video",
      sequenza: "",
      id_esercizio: "215",
      nome_esercizio: "Programmazione degli allenamenti",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "informazioni concettuali sul programma di allenamento",
      link_video: "https://youtu.be/84Zk9n2YsNE?si=lzqHhngS_WnYfa5z",
      data_pubblicazione: null
    },
    {
      id: 613,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "4 - Video",
      sequenza: "",
      id_esercizio: "213",
      nome_esercizio: "Landmine - compromesso perfetto",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "filosofia, approfondimento concettuale",
      link_video: "https://youtu.be/I3mTr9qBd4Y?si=pMhZTZuLDpbpkday",
      data_pubblicazione: null
    },
    {
      id: 614,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "5 - Video",
      sequenza: "",
      id_esercizio: "211",
      nome_esercizio: "Perch\xE8 ho scelto il Landmine",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "video didattico teorico di approfondimento tecnico,",
      link_video: "https://youtu.be/GKoWHa0U2GU?si=gAGDdLjoBPwDvex4",
      data_pubblicazione: null
    },
    {
      id: 615,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "6 - Video",
      sequenza: "",
      id_esercizio: "209",
      nome_esercizio: "Lato lungo, Lato corto",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "video didattico teorico di approfondimento tecnico,",
      link_video: "https://youtu.be/0IotRiRVq9Y?si=r4PPBvaE2L5geehC",
      data_pubblicazione: null
    },
    {
      id: 616,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "7 - Video",
      sequenza: "",
      id_esercizio: "210",
      nome_esercizio: "Routine mente-corpo",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "sessione GUIDATA di mobilit\xE0 e benessere mente-corpo,",
      link_video: "https://youtu.be/xW3GdKQLYLE",
      data_pubblicazione: null
    },
    {
      id: 617,
      livello: "Approfondimenti ed extra",
      settimana: "info e didattica",
      giorno: "8 - Video",
      sequenza: "",
      id_esercizio: "216",
      nome_esercizio: "Ground mobility tutorial",
      parametri: "",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "TUTORIAL: La routine di mobilit\xE0 spiegata nel dettaglio",
      link_video: "https://youtu.be/nyhsL01d0S8?si=ZDWdbW4_h-NizxN7",
      data_pubblicazione: null
    },
    {
      id: 618,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "1a",
      id_esercizio: "051",
      nome_esercizio: "High hand switch",
      parametri: "3x30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/98n_uL3E4m8",
      data_pubblicazione: null
    },
    {
      id: 619,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "1b",
      id_esercizio: "054",
      nome_esercizio: "Landmine press Cross Step",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/K-8y_B7Ie5M",
      data_pubblicazione: null
    },
    {
      id: 620,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "2",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "rpe 8",
      link_video: "https://youtu.be/D8z_q4N4KjU",
      data_pubblicazione: null
    },
    {
      id: 621,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "3",
      id_esercizio: "043",
      nome_esercizio: "Pounce squat",
      parametri: "4x8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "rpe 8",
      link_video: "https://youtu.be/mF8y3rD4xLQ",
      data_pubblicazione: null
    },
    {
      id: 622,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "4a",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3x10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 623,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "4b",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "3x10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/y_4qB8E_F7c",
      data_pubblicazione: null
    },
    {
      id: 624,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "5a",
      id_esercizio: "069",
      nome_esercizio: "Split Snatch",
      parametri: '5x30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/G8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 625,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "5b",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: '5x30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/Q8z_4uD8xLQ",
      data_pubblicazione: null
    },
    {
      id: 626,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "1 allenamento A",
      sequenza: "5c",
      id_esercizio: "100",
      nome_esercizio: "Speed skater touch",
      parametri: '5x30"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/M8z_4uD8xLQ",
      data_pubblicazione: null
    },
    {
      id: 627,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "1a",
      id_esercizio: "046",
      nome_esercizio: "Split Switch Screwdriver",
      parametri: "3x30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/F8y3rD4xLQ8",
      data_pubblicazione: null
    },
    {
      id: 628,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "1b",
      id_esercizio: "064",
      nome_esercizio: "High Pull ISO",
      parametri: '3x15"+15"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/H8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 629,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "2a",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "3x6+6 (rpe 8)",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/J8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 630,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "2b",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3x8 (RPE8)",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/K8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 631,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "3a",
      id_esercizio: "230",
      nome_esercizio: "kettlebell clean and press",
      parametri: "3x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/L8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 632,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "3b",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/N8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 633,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "4a",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: '4x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 634,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "4b",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: '4x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/P8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 635,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "5a",
      id_esercizio: "063",
      nome_esercizio: "Landmine Clean and jerk NO DOWN",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 10'",
      link_video: "https://youtu.be/Q8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 636,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "2 allenamento B",
      sequenza: "5b",
      id_esercizio: "203",
      nome_esercizio: "Plyometric lunges",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 10'",
      link_video: "https://youtu.be/R8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 637,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "1a",
      id_esercizio: "051",
      nome_esercizio: "High hand switch",
      parametri: "3x30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/98n_uL3E4m8",
      data_pubblicazione: null
    },
    {
      id: 638,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "1b",
      id_esercizio: "054",
      nome_esercizio: "Landmine press Cross Step",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/K-8y_B7Ie5M",
      data_pubblicazione: null
    },
    {
      id: 639,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "2",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "rpe 8",
      link_video: "https://youtu.be/D8z_q4N4KjU",
      data_pubblicazione: null
    },
    {
      id: 640,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "3",
      id_esercizio: "043",
      nome_esercizio: "Pounce squat",
      parametri: "4x8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "rpe 8",
      link_video: "https://youtu.be/mF8y3rD4xLQ",
      data_pubblicazione: null
    },
    {
      id: 641,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "4a",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3x10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 642,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "4b",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "3x10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/y_4qB8E_F7c",
      data_pubblicazione: null
    },
    {
      id: 643,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "5a",
      id_esercizio: "069",
      nome_esercizio: "Split Snatch",
      parametri: '5x30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/G8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 644,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "5b",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: '5x30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/Q8z_4uD8xLQ",
      data_pubblicazione: null
    },
    {
      id: 645,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "3 allenamento A",
      sequenza: "5c",
      id_esercizio: "100",
      nome_esercizio: "Speed skater touch",
      parametri: '5x30"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/M8z_4uD8xLQ",
      data_pubblicazione: null
    },
    {
      id: 646,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "1a",
      id_esercizio: "046",
      nome_esercizio: "Split Switch Screwdriver",
      parametri: "3x30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/F8y3rD4xLQ8",
      data_pubblicazione: null
    },
    {
      id: 647,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "1b",
      id_esercizio: "064",
      nome_esercizio: "High Pull ISO",
      parametri: '3x15"+15"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/H8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 648,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "2a",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "3x6+6 (rpe 8)",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/J8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 649,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "2b",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3x8 (RPE8)",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/K8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 650,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "3a",
      id_esercizio: "230",
      nome_esercizio: "kettlebell clean and press",
      parametri: "3x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/L8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 651,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "3b",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/N8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 652,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "4a",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: '4x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 653,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "4b",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: '4x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/P8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 654,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "5a",
      id_esercizio: "063",
      nome_esercizio: "Landmine Clean and jerk NO DOWN",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 10'",
      link_video: "https://youtu.be/Q8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 655,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "4 allenamento B",
      sequenza: "5b",
      id_esercizio: "203",
      nome_esercizio: "Plyometric lunges",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 10'",
      link_video: "https://youtu.be/R8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 656,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "1a",
      id_esercizio: "051",
      nome_esercizio: "High hand switch",
      parametri: "3x30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/98n_uL3E4m8",
      data_pubblicazione: null
    },
    {
      id: 657,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "1b",
      id_esercizio: "054",
      nome_esercizio: "Landmine press Cross Step",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/K-8y_B7Ie5M",
      data_pubblicazione: null
    },
    {
      id: 658,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "2",
      id_esercizio: "056",
      nome_esercizio: "Landmine coiled Deadlift",
      parametri: "3x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "rpe 8",
      link_video: "https://youtu.be/D8z_q4N4KjU",
      data_pubblicazione: null
    },
    {
      id: 659,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "3",
      id_esercizio: "043",
      nome_esercizio: "Pounce squat",
      parametri: "4x8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "rpe 8",
      link_video: "https://youtu.be/mF8y3rD4xLQ",
      data_pubblicazione: null
    },
    {
      id: 660,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "4a",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "3x10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 661,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "4b",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "3x10+10",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/y_4qB8E_F7c",
      data_pubblicazione: null
    },
    {
      id: 662,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "5a",
      id_esercizio: "069",
      nome_esercizio: "Split Snatch",
      parametri: '5x30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/G8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 663,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "5b",
      id_esercizio: "170",
      nome_esercizio: "Coiled Kettlebell Swing",
      parametri: '5x30"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/Q8z_4uD8xLQ",
      data_pubblicazione: null
    },
    {
      id: 664,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "5 allenamento A",
      sequenza: "5c",
      id_esercizio: "100",
      nome_esercizio: "Speed skater touch",
      parametri: '5x30"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "circuito",
      link_video: "https://youtu.be/M8z_4uD8xLQ",
      data_pubblicazione: null
    },
    {
      id: 665,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "1a",
      id_esercizio: "046",
      nome_esercizio: "Split Switch Screwdriver",
      parametri: "3x30",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/F8y3rD4xLQ8",
      data_pubblicazione: null
    },
    {
      id: 666,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "1b",
      id_esercizio: "064",
      nome_esercizio: "High Pull ISO",
      parametri: '3x15"+15"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/H8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 667,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "2a",
      id_esercizio: "059",
      nome_esercizio: "Split Clean and Jerk",
      parametri: "3x6+6 (rpe 8)",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/J8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 668,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "2b",
      id_esercizio: "045",
      nome_esercizio: "Landmine rotational Lunges",
      parametri: "3x8 (RPE8)",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/K8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 669,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "3a",
      id_esercizio: "230",
      nome_esercizio: "kettlebell clean and press",
      parametri: "3x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/L8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 670,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "3b",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "3x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/N8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 671,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "4a",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: '4x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 672,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "4b",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: '4x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/P8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 673,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "5a",
      id_esercizio: "063",
      nome_esercizio: "Landmine Clean and jerk NO DOWN",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 10'",
      link_video: "https://youtu.be/Q8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 674,
      livello: "PRO",
      settimana: "Ciclo 1",
      giorno: "6 allenamento B",
      sequenza: "5b",
      id_esercizio: "203",
      nome_esercizio: "Plyometric lunges",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 10'",
      link_video: "https://youtu.be/R8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 675,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "1a",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "3x24",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/S8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 676,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "1b",
      id_esercizio: "049",
      nome_esercizio: "Step/Step back press",
      parametri: "3x8+8",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/T8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 677,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "2",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "4x8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 678,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "3a",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/y_4qB8E_F7c",
      data_pubblicazione: null
    },
    {
      id: 679,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "3b",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4x8+8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 680,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "4a",
      id_esercizio: "172",
      nome_esercizio: "Kettlebell swing to clean",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtu.be/U8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 681,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "4b",
      id_esercizio: "124",
      nome_esercizio: "Slamball Skater jump",
      parametri: "4x10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtu.be/V8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 682,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "7 allenamento A",
      sequenza: "4c",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: '4x40"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 683,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "1a",
      id_esercizio: "055",
      nome_esercizio: "Hang Position ISO",
      parametri: '3x20"+20"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/W8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 684,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "1b",
      id_esercizio: "116",
      nome_esercizio: "High pull bounce",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/X8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 685,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "2a",
      id_esercizio: "053",
      nome_esercizio: "Split C&J Touch & Go",
      parametri: "4x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/Y8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 686,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "2b",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "4x8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/Z8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 687,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "3a",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "4x10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/a8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 688,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "3b",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "4x8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/N8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 689,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "4a",
      id_esercizio: "073",
      nome_esercizio: "Lateral landmine clean",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/b8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 690,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "4b",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/P8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 691,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "8 allenamento B",
      sequenza: "4c",
      id_esercizio: "187",
      nome_esercizio: "Sprawl to Broad Jump",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/c8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 692,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "1a",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "3x24",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/S8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 693,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "1b",
      id_esercizio: "049",
      nome_esercizio: "Step/Step back press",
      parametri: "3x8+8",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/T8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 694,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "2",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "4x8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 695,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "3a",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/y_4qB8E_F7c",
      data_pubblicazione: null
    },
    {
      id: 696,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "3b",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4x8+8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 697,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "4a",
      id_esercizio: "172",
      nome_esercizio: "Kettlebell swing to clean",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtu.be/U8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 698,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "4b",
      id_esercizio: "124",
      nome_esercizio: "Slamball Skater jump",
      parametri: "4x10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtu.be/V8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 699,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "9 allenamento A",
      sequenza: "4c",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: '4x40"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 700,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "1a",
      id_esercizio: "055",
      nome_esercizio: "Hang Position ISO",
      parametri: '3x20"+20"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/W8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 701,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "1b",
      id_esercizio: "116",
      nome_esercizio: "High pull bounce",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/X8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 702,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "2a",
      id_esercizio: "053",
      nome_esercizio: "Split C&J Touch & Go",
      parametri: "4x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/Y8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 703,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "2b",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "4x8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/Z8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 704,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "3a",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "4x10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/a8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 705,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "3b",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "4x8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/N8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 706,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "4a",
      id_esercizio: "073",
      nome_esercizio: "Lateral landmine clean",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/b8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 707,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "4b",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/P8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 708,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "10 allenamento B",
      sequenza: "4c",
      id_esercizio: "187",
      nome_esercizio: "Sprawl to Broad Jump",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/c8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 709,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "1a",
      id_esercizio: "098",
      nome_esercizio: "Avenger Blade passing",
      parametri: "3x24",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/S8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 710,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "1b",
      id_esercizio: "049",
      nome_esercizio: "Step/Step back press",
      parametri: "3x8+8",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/T8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 711,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "2",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "4x8",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 712,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "3a",
      id_esercizio: "081",
      nome_esercizio: "Meadow Row",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/y_4qB8E_F7c",
      data_pubblicazione: null
    },
    {
      id: 713,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "3b",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4x8+8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 714,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "4a",
      id_esercizio: "172",
      nome_esercizio: "Kettlebell swing to clean",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtu.be/U8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 715,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "4b",
      id_esercizio: "124",
      nome_esercizio: "Slamball Skater jump",
      parametri: "4x10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtu.be/V8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 716,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "11 allenamento A",
      sequenza: "4c",
      id_esercizio: "001",
      nome_esercizio: "skierg regular",
      parametri: '4x40"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (4 round)",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 717,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "1a",
      id_esercizio: "055",
      nome_esercizio: "Hang Position ISO",
      parametri: '3x20"+20"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/W8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 718,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "1b",
      id_esercizio: "116",
      nome_esercizio: "High pull bounce",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/X8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 719,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "2a",
      id_esercizio: "053",
      nome_esercizio: "Split C&J Touch & Go",
      parametri: "4x6+6",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/Y8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 720,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "2b",
      id_esercizio: "076",
      nome_esercizio: "Push the wall row",
      parametri: "4x8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/Z8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 721,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "3a",
      id_esercizio: "101",
      nome_esercizio: "Sprinter Push up",
      parametri: "4x10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/a8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 722,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "3b",
      id_esercizio: "044",
      nome_esercizio: "Coiled Reverse Lunge",
      parametri: "4x8+8",
      recupero: 'RBS 45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/N8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 723,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "4a",
      id_esercizio: "073",
      nome_esercizio: "Lateral landmine clean",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/b8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 724,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "4b",
      id_esercizio: "206",
      nome_esercizio: "Side kick through",
      parametri: "x 8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/P8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 725,
      livello: "PRO",
      settimana: "Ciclo 2",
      giorno: "12 allenamento B",
      sequenza: "4c",
      id_esercizio: "187",
      nome_esercizio: "Sprawl to Broad Jump",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 15'",
      link_video: "https://youtu.be/c8z_4uQ4x9U",
      data_pubblicazione: null
    },
    {
      id: 726,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "1a",
      id_esercizio: "093",
      nome_esercizio: "Pallof Press con elastico",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
      data_pubblicazione: null
    },
    {
      id: 727,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "1b",
      id_esercizio: "163",
      nome_esercizio: "Arm basic DB pendulum",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/WL2Gbf9klSI?si=R-4lfDqWZo7_yc9B",
      data_pubblicazione: null
    },
    {
      id: 728,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "2",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "4x6",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8.5",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 729,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "3a",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "4x6-8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/nSj7QKBbvWA?si=fGWg_soHjRYO0xex",
      data_pubblicazione: null
    },
    {
      id: 730,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "3b",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/V-5Q4l-SM20",
      data_pubblicazione: null
    },
    {
      id: 731,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "4a",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtu.be/2gCslk95r20",
      data_pubblicazione: null
    },
    {
      id: 732,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "4b",
      id_esercizio: "234",
      nome_esercizio: "rebound push up",
      parametri: "3x8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/iSipY1JCKdQ",
      data_pubblicazione: null
    },
    {
      id: 733,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "13 allenamento A",
      sequenza: "4c",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: '3x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 734,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "1a",
      id_esercizio: "033",
      nome_esercizio: "Coiled Cobra",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/GU3ePuvJwMk",
      data_pubblicazione: null
    },
    {
      id: 735,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "1b",
      id_esercizio: "220",
      nome_esercizio: "Wall High Pull",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/EBv0BjKhUlA?si=I07YNW02JWJF-oiD",
      data_pubblicazione: null
    },
    {
      id: 736,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "2a",
      id_esercizio: "218",
      nome_esercizio: "Landmine Jerk",
      parametri: "4x5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8.5",
      link_video: "https://youtu.be/zIqsjVRtc5o",
      data_pubblicazione: null
    },
    {
      id: 737,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "2b",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4x8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 738,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "3a",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: '4x20"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/rRgKOg0qaA4?si=aYRTcGburOhwv1a6",
      data_pubblicazione: null
    },
    {
      id: 739,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "3b",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "4x8+8",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/arECYW5JFeA",
      data_pubblicazione: null
    },
    {
      id: 740,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "4a",
      id_esercizio: "120",
      nome_esercizio: "Aerial Jerk",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/0uI_9_0qR7k",
      data_pubblicazione: null
    },
    {
      id: 741,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "4b",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 742,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "14 allenamento B",
      sequenza: "4c",
      id_esercizio: "225",
      nome_esercizio: "Ball over shoulder",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtu.be/Nwd-5fuLm3k?si=jGWxuH-RfvPTnkWN",
      data_pubblicazione: null
    },
    {
      id: 743,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "1a",
      id_esercizio: "093",
      nome_esercizio: "Pallof Press con elastico",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
      data_pubblicazione: null
    },
    {
      id: 744,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "1b",
      id_esercizio: "163",
      nome_esercizio: "Arm basic DB pendulum",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/WL2Gbf9klSI?si=R-4lfDqWZo7_yc9B",
      data_pubblicazione: null
    },
    {
      id: 745,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "2",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "4x6",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8.5",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 746,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "3a",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "4x6-8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/nSj7QKBbvWA?si=fGWg_soHjRYO0xex",
      data_pubblicazione: null
    },
    {
      id: 747,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "3b",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/V-5Q4l-SM20",
      data_pubblicazione: null
    },
    {
      id: 748,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "4a",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtu.be/2gCslk95r20",
      data_pubblicazione: null
    },
    {
      id: 749,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "4b",
      id_esercizio: "234",
      nome_esercizio: "rebound push up",
      parametri: "3x8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/iSipY1JCKdQ",
      data_pubblicazione: null
    },
    {
      id: 750,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "15 allenamento A",
      sequenza: "4c",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: '3x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 751,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "1a",
      id_esercizio: "033",
      nome_esercizio: "Coiled Cobra",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/GU3ePuvJwMk",
      data_pubblicazione: null
    },
    {
      id: 752,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "1b",
      id_esercizio: "220",
      nome_esercizio: "Wall High Pull",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/EBv0BjKhUlA?si=I07YNW02JWJF-oiD",
      data_pubblicazione: null
    },
    {
      id: 753,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "2a",
      id_esercizio: "218",
      nome_esercizio: "Landmine Jerk",
      parametri: "4x5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8.5",
      link_video: "https://youtu.be/zIqsjVRtc5o",
      data_pubblicazione: null
    },
    {
      id: 754,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "2b",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4x8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 755,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "3a",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: '4x20"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/rRgKOg0qaA4?si=aYRTcGburOhwv1a6",
      data_pubblicazione: null
    },
    {
      id: 756,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "3b",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "4x8+8",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/arECYW5JFeA",
      data_pubblicazione: null
    },
    {
      id: 757,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "4a",
      id_esercizio: "120",
      nome_esercizio: "Aerial Jerk",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/0uI_9_0qR7k",
      data_pubblicazione: null
    },
    {
      id: 758,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "4b",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 759,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "16 allenamento B",
      sequenza: "4c",
      id_esercizio: "225",
      nome_esercizio: "Ball over shoulder",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtu.be/Nwd-5fuLm3k?si=jGWxuH-RfvPTnkWN",
      data_pubblicazione: null
    },
    {
      id: 760,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "1a",
      id_esercizio: "093",
      nome_esercizio: "Pallof Press con elastico",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
      data_pubblicazione: null
    },
    {
      id: 761,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "1b",
      id_esercizio: "163",
      nome_esercizio: "Arm basic DB pendulum",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/WL2Gbf9klSI?si=R-4lfDqWZo7_yc9B",
      data_pubblicazione: null
    },
    {
      id: 762,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "2",
      id_esercizio: "079",
      nome_esercizio: "Bench press",
      parametri: "4x6",
      recupero: '90"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8.5",
      link_video: "https://youtu.be/q_OfuLjIMFI",
      data_pubblicazione: null
    },
    {
      id: 763,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "3a",
      id_esercizio: "078",
      nome_esercizio: "pull up Progressioni",
      parametri: "4x6-8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/nSj7QKBbvWA?si=fGWg_soHjRYO0xex",
      data_pubblicazione: null
    },
    {
      id: 764,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "3b",
      id_esercizio: "075",
      nome_esercizio: "One arm press",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/V-5Q4l-SM20",
      data_pubblicazione: null
    },
    {
      id: 765,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "4a",
      id_esercizio: "080",
      nome_esercizio: "Coiled Bench Row",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtu.be/2gCslk95r20",
      data_pubblicazione: null
    },
    {
      id: 766,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "4b",
      id_esercizio: "234",
      nome_esercizio: "rebound push up",
      parametri: "3x8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/iSipY1JCKdQ",
      data_pubblicazione: null
    },
    {
      id: 767,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "17 allenamento A",
      sequenza: "4c",
      id_esercizio: "034",
      nome_esercizio: "air bike solo braccia",
      parametri: '3x30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "",
      data_pubblicazione: null
    },
    {
      id: 768,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "1a",
      id_esercizio: "033",
      nome_esercizio: "Coiled Cobra",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/GU3ePuvJwMk",
      data_pubblicazione: null
    },
    {
      id: 769,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "1b",
      id_esercizio: "220",
      nome_esercizio: "Wall High Pull",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/EBv0BjKhUlA?si=I07YNW02JWJF-oiD",
      data_pubblicazione: null
    },
    {
      id: 770,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "2a",
      id_esercizio: "218",
      nome_esercizio: "Landmine Jerk",
      parametri: "4x5+5",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8.5",
      link_video: "https://youtu.be/zIqsjVRtc5o",
      data_pubblicazione: null
    },
    {
      id: 771,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "2b",
      id_esercizio: "082",
      nome_esercizio: "Landmine Biker's Squat",
      parametri: "4x8",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/jqhow36DTdg",
      data_pubblicazione: null
    },
    {
      id: 772,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "3a",
      id_esercizio: "191",
      nome_esercizio: "Endless rope Standing Power Pull",
      parametri: '4x20"',
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/rRgKOg0qaA4?si=aYRTcGburOhwv1a6",
      data_pubblicazione: null
    },
    {
      id: 773,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "3b",
      id_esercizio: "095",
      nome_esercizio: "Yin yang sit up press",
      parametri: "4x8+8",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/arECYW5JFeA",
      data_pubblicazione: null
    },
    {
      id: 774,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "4a",
      id_esercizio: "120",
      nome_esercizio: "Aerial Jerk",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/0uI_9_0qR7k",
      data_pubblicazione: null
    },
    {
      id: 775,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "4b",
      id_esercizio: "205",
      nome_esercizio: "Kick-through progression",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtu.be/OGEUeBvoKc0?si=v7LIiDqSnd71NyM4",
      data_pubblicazione: null
    },
    {
      id: 776,
      livello: "PRO",
      settimana: "Ciclo 3",
      giorno: "18 allenamento B",
      sequenza: "4c",
      id_esercizio: "225",
      nome_esercizio: "Ball over shoulder",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtu.be/Nwd-5fuLm3k?si=jGWxuH-RfvPTnkWN",
      data_pubblicazione: null
    },
    {
      id: 777,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "1a",
      id_esercizio: "158",
      nome_esercizio: "Bat around the head 90\xB0 e 180\xB0",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/INNpiEJL9As?si=7-xSjR1LJL__jzU8",
      data_pubblicazione: null
    },
    {
      id: 778,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "1b",
      id_esercizio: "074",
      nome_esercizio: "Side move",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/ISkSG5yXhrU?si=aQYlqWHqyaE5nWL_",
      data_pubblicazione: null
    },
    {
      id: 779,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "2",
      id_esercizio: "127",
      nome_esercizio: "COMBO: Landmine clean ALT. SCRD T/GO",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtube.com/shorts/Zd7CQkHhnSo",
      data_pubblicazione: null
    },
    {
      id: 780,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "3a",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/OdhNUbqajmM",
      data_pubblicazione: null
    },
    {
      id: 781,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "3b",
      id_esercizio: "084",
      nome_esercizio: "Kneeling Transition over head press",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/Y-2AeFnKQLY",
      data_pubblicazione: null
    },
    {
      id: 782,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "4a",
      id_esercizio: "201",
      nome_esercizio: "Step Up esplosivo alternato",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/bAH_uySHG0c?si=H7r8TS-7k3vxrCRf",
      data_pubblicazione: null
    },
    {
      id: 783,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "4b",
      id_esercizio: "231",
      nome_esercizio: "Banded hoock",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/jEOtxSBwhCU",
      data_pubblicazione: null
    },
    {
      id: 784,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "19 allenamento A",
      sequenza: "4c",
      id_esercizio: "002",
      nome_esercizio: "skierg pagaia mono",
      parametri: '3x30"+30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 785,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "1a",
      id_esercizio: "031",
      nome_esercizio: "Cobra to Down dog",
      parametri: "3x8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/JNLhhxNDkZs?si=IxpjFs4F8j3EOv0m",
      data_pubblicazione: null
    },
    {
      id: 786,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "1b",
      id_esercizio: "147",
      nome_esercizio: "Hurdle Step",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/tZ28cg_Wi1c?si=bNZhGLkec-Fb_fZw",
      data_pubblicazione: null
    },
    {
      id: 787,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "2a",
      id_esercizio: "188",
      nome_esercizio: "Kettlebell Snatch",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 788,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "2b",
      id_esercizio: "119",
      nome_esercizio: "Super Mario Jump",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/XluivIvnr4k",
      data_pubblicazione: null
    },
    {
      id: 789,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "3a",
      id_esercizio: "077",
      nome_esercizio: "Coiled Punch iso.",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/mifz_6oZJlw",
      data_pubblicazione: null
    },
    {
      id: 790,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "3b",
      id_esercizio: "192",
      nome_esercizio: "Endless rope kneeling pull",
      parametri: '4x20"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/sNkK5m4fYi0",
      data_pubblicazione: null
    },
    {
      id: 791,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "4a",
      id_esercizio: "190",
      nome_esercizio: "Dumbbell Coiled Thruster",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/nQHKdic83T8",
      data_pubblicazione: null
    },
    {
      id: 792,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "4b",
      id_esercizio: "228",
      nome_esercizio: "COMBO Side kick through + Sprawl",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/iRJEq6FnzxI",
      data_pubblicazione: null
    },
    {
      id: 793,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "20 allenamento B",
      sequenza: "4c",
      id_esercizio: "233",
      nome_esercizio: "rotation slam",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/HwYENrEDFqY",
      data_pubblicazione: null
    },
    {
      id: 794,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "1a",
      id_esercizio: "158",
      nome_esercizio: "Bat around the head 90\xB0 e 180\xB0",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/INNpiEJL9As?si=7-xSjR1LJL__jzU8",
      data_pubblicazione: null
    },
    {
      id: 795,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "1b",
      id_esercizio: "074",
      nome_esercizio: "Side move",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/ISkSG5yXhrU?si=aQYlqWHqyaE5nWL_",
      data_pubblicazione: null
    },
    {
      id: 796,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "2",
      id_esercizio: "127",
      nome_esercizio: "COMBO: Landmine clean ALT. SCRD T/GO",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtube.com/shorts/Zd7CQkHhnSo",
      data_pubblicazione: null
    },
    {
      id: 797,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "3a",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/OdhNUbqajmM",
      data_pubblicazione: null
    },
    {
      id: 798,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "3b",
      id_esercizio: "084",
      nome_esercizio: "Kneeling Transition over head press",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/Y-2AeFnKQLY",
      data_pubblicazione: null
    },
    {
      id: 799,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "4a",
      id_esercizio: "201",
      nome_esercizio: "Step Up esplosivo alternato",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/bAH_uySHG0c?si=H7r8TS-7k3vxrCRf",
      data_pubblicazione: null
    },
    {
      id: 800,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "4b",
      id_esercizio: "231",
      nome_esercizio: "Banded hoock",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/jEOtxSBwhCU",
      data_pubblicazione: null
    },
    {
      id: 801,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "21 allenamento A",
      sequenza: "4c",
      id_esercizio: "002",
      nome_esercizio: "skierg pagaia mono",
      parametri: '3x30"+30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 802,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "1a",
      id_esercizio: "031",
      nome_esercizio: "Cobra to Down dog",
      parametri: "3x8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/JNLhhxNDkZs?si=IxpjFs4F8j3EOv0m",
      data_pubblicazione: null
    },
    {
      id: 803,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "1b",
      id_esercizio: "147",
      nome_esercizio: "Hurdle Step",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/tZ28cg_Wi1c?si=bNZhGLkec-Fb_fZw",
      data_pubblicazione: null
    },
    {
      id: 804,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "2a",
      id_esercizio: "188",
      nome_esercizio: "Kettlebell Snatch",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 805,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "2b",
      id_esercizio: "119",
      nome_esercizio: "Super Mario Jump",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/XluivIvnr4k",
      data_pubblicazione: null
    },
    {
      id: 806,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "3a",
      id_esercizio: "077",
      nome_esercizio: "Coiled Punch iso.",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/mifz_6oZJlw",
      data_pubblicazione: null
    },
    {
      id: 807,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "3b",
      id_esercizio: "192",
      nome_esercizio: "Endless rope kneeling pull",
      parametri: '4x20"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/sNkK5m4fYi0",
      data_pubblicazione: null
    },
    {
      id: 808,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "4a",
      id_esercizio: "190",
      nome_esercizio: "Dumbbell Coiled Thruster",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/nQHKdic83T8",
      data_pubblicazione: null
    },
    {
      id: 809,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "4b",
      id_esercizio: "228",
      nome_esercizio: "COMBO Side kick through + Sprawl",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/iRJEq6FnzxI",
      data_pubblicazione: null
    },
    {
      id: 810,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "22 allenamento B",
      sequenza: "4c",
      id_esercizio: "233",
      nome_esercizio: "rotation slam",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/HwYENrEDFqY",
      data_pubblicazione: null
    },
    {
      id: 811,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "1a",
      id_esercizio: "158",
      nome_esercizio: "Bat around the head 90\xB0 e 180\xB0",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/INNpiEJL9As?si=7-xSjR1LJL__jzU8",
      data_pubblicazione: null
    },
    {
      id: 812,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "1b",
      id_esercizio: "074",
      nome_esercizio: "Side move",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/ISkSG5yXhrU?si=aQYlqWHqyaE5nWL_",
      data_pubblicazione: null
    },
    {
      id: 813,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "2",
      id_esercizio: "127",
      nome_esercizio: "COMBO: Landmine clean ALT. SCRD T/GO",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtube.com/shorts/Zd7CQkHhnSo",
      data_pubblicazione: null
    },
    {
      id: 814,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "3a",
      id_esercizio: "023",
      nome_esercizio: "Coiled Cable ROW",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtu.be/OdhNUbqajmM",
      data_pubblicazione: null
    },
    {
      id: 815,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "3b",
      id_esercizio: "084",
      nome_esercizio: "Kneeling Transition over head press",
      parametri: "4x8+8",
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/Y-2AeFnKQLY",
      data_pubblicazione: null
    },
    {
      id: 816,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "4a",
      id_esercizio: "201",
      nome_esercizio: "Step Up esplosivo alternato",
      parametri: "3x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/bAH_uySHG0c?si=H7r8TS-7k3vxrCRf",
      data_pubblicazione: null
    },
    {
      id: 817,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "4b",
      id_esercizio: "231",
      nome_esercizio: "Banded hoock",
      parametri: "3x10+10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/jEOtxSBwhCU",
      data_pubblicazione: null
    },
    {
      id: 818,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "23 allenamento A",
      sequenza: "4c",
      id_esercizio: "002",
      nome_esercizio: "skierg pagaia mono",
      parametri: '3x30"+30"',
      recupero: '60"',
      minutaggio_blocco: "",
      note_tecniche: "circuito (3 round)",
      link_video: "https://youtube.com/shorts/7n-hAJAXoYU",
      data_pubblicazione: null
    },
    {
      id: 819,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "1a",
      id_esercizio: "031",
      nome_esercizio: "Cobra to Down dog",
      parametri: "3x8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/JNLhhxNDkZs?si=IxpjFs4F8j3EOv0m",
      data_pubblicazione: null
    },
    {
      id: 820,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "1b",
      id_esercizio: "147",
      nome_esercizio: "Hurdle Step",
      parametri: "3x10+10",
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtu.be/tZ28cg_Wi1c?si=bNZhGLkec-Fb_fZw",
      data_pubblicazione: null
    },
    {
      id: 821,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "2a",
      id_esercizio: "188",
      nome_esercizio: "Kettlebell Snatch",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "RPE 8",
      link_video: "https://youtu.be/rE8lJ9TxbEQ",
      data_pubblicazione: null
    },
    {
      id: 822,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "2b",
      id_esercizio: "119",
      nome_esercizio: "Super Mario Jump",
      parametri: "4x6+6",
      recupero: 'RBS 60"',
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/XluivIvnr4k",
      data_pubblicazione: null
    },
    {
      id: 823,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "3a",
      id_esercizio: "077",
      nome_esercizio: "Coiled Punch iso.",
      parametri: "4x8+8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "jump set | RPE 8",
      link_video: "https://youtube.com/shorts/mifz_6oZJlw",
      data_pubblicazione: null
    },
    {
      id: 824,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "3b",
      id_esercizio: "192",
      nome_esercizio: "Endless rope kneeling pull",
      parametri: '4x20"',
      recupero: '45"',
      minutaggio_blocco: "",
      note_tecniche: "jump set",
      link_video: "https://youtube.com/shorts/sNkK5m4fYi0",
      data_pubblicazione: null
    },
    {
      id: 825,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "4a",
      id_esercizio: "190",
      nome_esercizio: "Dumbbell Coiled Thruster",
      parametri: "x 6+6",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/nQHKdic83T8",
      data_pubblicazione: null
    },
    {
      id: 826,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "4b",
      id_esercizio: "228",
      nome_esercizio: "COMBO Side kick through + Sprawl",
      parametri: "x 8",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/iRJEq6FnzxI",
      data_pubblicazione: null
    },
    {
      id: 827,
      livello: "PRO",
      settimana: "Ciclo 4",
      giorno: "24 allenamento B",
      sequenza: "4c",
      id_esercizio: "233",
      nome_esercizio: "rotation slam",
      parametri: "x 10",
      recupero: "",
      minutaggio_blocco: "",
      note_tecniche: "AMRAP 12'",
      link_video: "https://youtube.com/shorts/HwYENrEDFqY",
      data_pubblicazione: null
    }
  ],
  diario_utente: [],
  stato_allenamenti: [],
  preferenze_utente: [],
  profili_utenti: [
    {
      id: "usr-coach-01",
      email: "firenzepersonaltrainer@gmail.com",
      nome: "Stefano",
      cognome: "Tronconi",
      telefono: "+39 340 0000000",
      codice_fiscale: "ARECST80A01D612Y",
      indirizzo: "Via del Landmine 46, Firenze",
      ruolo: "manager",
      crediti: 998,
      data_scadenza_crediti: "2099-12-31",
      data_ultimo_accesso: "2026-09-30T12:37:48.670Z",
      note_coach: "Head Coach & Amministratore Lab",
      tempo_cancellazione_ore: 12,
      name: "Stefano Tronconi",
      tipo_abbonamento: "standard",
      stato_iscrizione: "attivo",
      tempo_anticipo_prenotazione_ore: 24
    },
    {
      id: "usr-atleta-1790777073318",
      nome: "Alessandro",
      cognome: "Pantanella",
      email: "pantanella@gmail.com",
      telefono: "",
      codice_fiscale: "",
      indirizzo: "",
      ruolo: "atleta",
      crediti: 36,
      shared_wallet_with: null,
      tempo_cancellazione_ore: 24,
      tempo_anticipo_prenotazione_ore: 24,
      data_scadenza_crediti: "2026-11-29",
      data_ultimo_accesso: "2026-09-30T14:44:23.601Z",
      note_coach: "",
      created_at: "2026-09-30T14:04:33.341Z",
      updated_at: "2026-09-30T14:15:32.478Z"
    },
    {
      id: "usr-atleta-1790777073444",
      nome: "Pierpaola",
      cognome: "Ciancia",
      email: "pierpaolaciancia@gmail.com",
      telefono: "",
      codice_fiscale: "",
      indirizzo: "",
      ruolo: "atleta",
      crediti: 0,
      shared_wallet_with: "usr-atleta-1790777073318",
      tempo_cancellazione_ore: 24,
      tempo_anticipo_prenotazione_ore: 24,
      data_scadenza_crediti: "2026-11-29",
      data_ultimo_accesso: "2026-09-30T14:44:23.598Z",
      note_coach: "",
      created_at: "2026-09-30T14:04:33.444Z"
    },
    {
      id: "usr-atleta-1790778020747",
      nome: "Daniele",
      cognome: "Casci",
      email: "daniele.casci@gmail.com",
      telefono: "+39 335 629 9341",
      codice_fiscale: "",
      indirizzo: "",
      ruolo: "atleta",
      crediti: 0,
      shared_wallet_with: null,
      tempo_cancellazione_ore: 24,
      tempo_anticipo_prenotazione_ore: 24,
      data_scadenza_crediti: "2026-11-29",
      data_ultimo_accesso: "2026-09-30T14:20:20.748Z",
      note_coach: "",
      created_at: "2026-09-30T14:20:20.748Z",
      updated_at: "2026-09-30T14:21:01.220Z"
    }
  ],
  configurazione_lab: {
    tempo_cancellazione_ore: 24,
    tempo_anticipo_prenotazione_ore: 12,
    iban: "IT35A0103037761000000746509",
    intestatario_iban: "Stefano Tronconi",
    banca: "MPS",
    notifica_email: "firenzepersonaltrainer@gmail.com",
    notifica_whatsapp: "+39 340 0000000",
    orari_disponibili: [
      "07:30",
      "08:30",
      "09:30",
      "10:30",
      "11:30",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00"
    ],
    giorni_aperti: [
      1,
      2,
      3,
      4,
      5,
      6
    ],
    inattivita_mesi_reset: 6,
    stripe_mode: "live",
    stripe_publishable_key: "",
    stripe_secret_key: "",
    stripe_webhook_secret: "",
    stripe_collegato: false
  },
  tariffario_pacchetti: [
    {
      id: "pack-8",
      nome: "Pacchetto Lab 8",
      descrizione: "8 allenamenti Landmine Lab \u2022 Scadenza 4 settimane",
      crediti: 8,
      giorni_validita: 28,
      prezzo_euro: 280,
      tipo: "consumo",
      attivo: true,
      badge: "2x / settimana"
    },
    {
      id: "pack-12",
      nome: "Pacchetto Lab 12",
      descrizione: "12 allenamenti Landmine Lab \u2022 Scadenza 4 settimane",
      crediti: 12,
      giorni_validita: 28,
      prezzo_euro: 399,
      tipo: "consumo",
      attivo: true,
      badge: "3x / settimana"
    },
    {
      id: "pack-24",
      nome: "Pacchetto Lab 24",
      descrizione: "24 allenamenti Landmine Lab \u2022 Scadenza 12 settimane",
      crediti: 24,
      giorni_validita: 84,
      prezzo_euro: 690,
      tipo: "consumo",
      attivo: true,
      badge: "Trimestrale 2x"
    },
    {
      id: "pack-36",
      nome: "Pacchetto Lab 36",
      descrizione: "36 allenamenti Landmine Lab \u2022 Scadenza 12 settimane",
      crediti: 36,
      giorni_validita: 84,
      prezzo_euro: 890,
      tipo: "consumo",
      attivo: true,
      badge: "Miglior Risparmio (3x)"
    },
    {
      id: "pack-continuativo-2x-semestrale",
      nome: "Abbonamento Lab Continuativo 2X (Semestrale)",
      descrizione: "48 allenamenti prenotabili subito (24 sett x 2/sett) \u2022 Quota \u20AC250/mese \u2022 Risparmio 30\u20AC/mese \u2022 Assistente AI Booking",
      crediti: 48,
      giorni_validita: 180,
      prezzo_euro: 250,
      tipo: "abbonamento",
      attivo: true,
      badge: "Semestrale 2x (48 slot)"
    },
    {
      id: "pack-continuativo-3x-semestrale",
      nome: "Abbonamento Lab Continuativo 3X (Semestrale)",
      descrizione: "72 allenamenti prenotabili subito (24 sett x 3/sett) \u2022 Quota \u20AC359/mese \u2022 Risparmio 40\u20AC/mese \u2022 Assistente AI Booking",
      crediti: 72,
      giorni_validita: 180,
      prezzo_euro: 359,
      tipo: "abbonamento",
      attivo: true,
      badge: "Semestrale 3x (72 slot)"
    },
    {
      id: "pack-continuativo-2x-annuale",
      nome: "Abbonamento Lab Continuativo 2X (Annuale)",
      descrizione: "104 allenamenti prenotabili subito (52 sett x 2/sett) \u2022 Quota \u20AC230/mese \u2022 Risparmio 50\u20AC/m (600\u20AC/anno!) \u2022 AI Concierge Incluso",
      crediti: 104,
      giorni_validita: 365,
      prezzo_euro: 230,
      tipo: "abbonamento",
      attivo: true,
      badge: "\u{1F451} PREMIO 12 MESI (104 slot)"
    },
    {
      id: "pack-continuativo-3x-annuale",
      nome: "Abbonamento Lab Continuativo 3X (Annuale)",
      descrizione: "156 allenamenti prenotabili subito (52 sett x 3/sett) \u2022 Quota \u20AC329/mese \u2022 Risparmio 70\u20AC/m (840\u20AC/anno!) \u2022 AI Concierge Incluso",
      crediti: 156,
      giorni_validita: 365,
      prezzo_euro: 329,
      tipo: "abbonamento",
      attivo: true,
      badge: "\u{1F451} PREMIO 12 MESI (156 slot)"
    }
  ],
  prenotazioni_slot: [],
  transazioni_pagamenti: [
    {
      id: "tx-man-1790778290078",
      codice_transazione: "TX-MAN-46-290075",
      atleta_id: "usr-atleta-1790777073318",
      email_cliente: "pantanella@gmail.com",
      nome_cliente: "Alessandro Pantanella",
      codice_fiscale: "",
      indirizzo: "",
      id_pacchetto: "pack-36",
      nome_pacchetto: "Pacchetto Lab 36",
      importo_euro: 890,
      metodo: "bonifico",
      crediti_acquistati: 0,
      debiti_decurtati: 0,
      crediti_effettivi_aggiunti: 0,
      causale_bonifico: "AREA46-PANTANELLA-0075",
      stato: "completato",
      stato_fattura: "da_emettere",
      created_at: "2026-09-30T10:00:00.000Z",
      note: "Bonifico bancario saldato anticipatamente dall'atleta (\u20AC 890,00)",
      inserito_da: "coach_manuale"
    }
  ],
  transazioni_cancellate: [
    "TX-46-2026-002",
    "TX-46-2026-003",
    "TX-46-2026-004",
    "TX-46-2026-005",
    "TX-46-412954",
    "TX-46-454580",
    "TX-46-641672",
    "TX-46-2026-001",
    "TX-MAN-46-264429",
    "TX-MAN-46-386831"
  ],
  active_user_id: null,
  movimenti_crediti: [
    {
      id: "mov-1790779467659-35",
      atleta_id: "usr-atleta-1790777073318",
      email_cliente: "pantanella@gmail.com",
      nome_cliente: "Alessandro Pantanella",
      data_ora: "2026-09-30T14:44:27.659Z",
      tipo: "rimborso_cancellazione",
      delta_crediti: 1,
      saldo_risultante: 36,
      motivazione: "Ripristino credito per cancellazione/spostamento slot 2026-10-15 17:00 per Pierpaola Ciancia [Borsellino Condiviso]",
      operatore: "coach"
    },
    {
      id: "mov-1790779463601-420",
      atleta_id: "usr-atleta-1790777073318",
      email_cliente: "pantanella@gmail.com",
      nome_cliente: "Alessandro Pantanella",
      data_ora: "2026-09-30T14:44:23.601Z",
      tipo: "prenotazione_slot",
      delta_crediti: -1,
      saldo_risultante: 35,
      motivazione: "Prenotazione slot del 2026-10-15 ore 17:00 per Pierpaola Ciancia [Borsellino Condiviso]",
      operatore: "coach"
    },
    {
      id: "mov-1790778020748-876",
      atleta_id: "usr-atleta-1790778020747",
      email_cliente: "daniele.casci@gmail.com",
      nome_cliente: "Daniele Casci",
      data_ora: "2026-09-30T14:20:20.748Z",
      tipo: "bonus_regalo",
      delta_crediti: 1,
      saldo_risultante: 1,
      motivazione: "Crediti configurati in anagrafica",
      operatore: "coach"
    },
    {
      id: "mov-1790777085214-34",
      atleta_id: "usr-atleta-1790777073318",
      email_cliente: "pantanella@gmail.com",
      nome_cliente: "Alessandro Pantanella",
      data_ora: "2026-09-30T14:04:45.214Z",
      tipo: "bonus_regalo",
      delta_crediti: 10,
      saldo_risultante: 10,
      motivazione: "Crediti configurati in anagrafica",
      operatore: "coach"
    },
    {
      id: "mov-1790777073341-763",
      atleta_id: "usr-atleta-1790777073318",
      email_cliente: "pantanella@gmail.com",
      nome_cliente: "Alessandro Pantanella",
      data_ora: "2026-09-30T14:04:33.341Z",
      tipo: "bonus_regalo",
      delta_crediti: 10,
      saldo_risultante: 10,
      motivazione: "Crediti configurati in anagrafica",
      operatore: "coach"
    }
  ],
  eccezioni_calendario: [],
  attivita_lab: [
    {
      id: "act-landmine-lab",
      nome: "Landmine Lab",
      descrizione: "Allenamento guidato al Landmine Lab con programmazione progressiva",
      costo_crediti: 1,
      max_partecipanti: 1,
      durata_minuti: 60,
      colore: "#1c00ff",
      attiva: true
    },
    {
      id: "act-1790052617731-zufh",
      nome: "Personal Training privato",
      descrizione: "sessioni di allenamento one to one",
      costo_crediti: 3,
      max_partecipanti: 1,
      durata_minuti: 75,
      colore: "#8b5cf6",
      attiva: true,
      created_at: "2026-09-22T04:50:17.731Z"
    }
  ],
  regole_palinsesto: [
    {
      id: "rule-landmine-2026-2027",
      nome: "Orario Ordinario Landmine Lab",
      id_attivita: "act-landmine-lab",
      data_inizio: "2026-09-01",
      data_fine: "2027-07-31",
      giorni_settimana: [
        1,
        3,
        5
      ],
      fasce_orarie: [
        {
          nome: "Mattina",
          ora_inizio: "09:00",
          ultimo_accesso: "11:00",
          ora_fine_finestra: "12:30",
          intervallo_minuti: 15
        },
        {
          nome: "Pomeriggio",
          ora_inizio: "17:00",
          ultimo_accesso: "19:00",
          ora_fine_finestra: "20:30",
          intervallo_minuti: 15
        }
      ],
      attiva: true
    }
  ],
  prenotazioni_cancellate: [
    "bk-1790779463601"
  ],
  utenti_cancellati: [],
  notifiche_email: [
    {
      id: "email-1790778020748-915",
      destinatario: "daniele.casci@gmail.com",
      oggetto: "Benvenuto in Area46 Landmine Lab \u2014 Il tuo profilo atleta \xE8 attivo! \u{1F3CB}\uFE0F\u200D\u2642\uFE0F",
      corpo: `Ciao Daniele!

Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!
Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.

=============================================================================
\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)
=============================================================================

Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:

\u{1F34F} SE USI IPHONE (APPLE):
1. Apri questo link con il browser SAFARI: https://area46-app.vercel.app
2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).
3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).
4. In alto a destra tocca "Aggiungi".
Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.

\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):
1. Apri questo link con il browser GOOGLE CHROME: https://area46-app.vercel.app
2. In alto a destra, tocca i tre puntini verticali (\u22EE).
3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".
4. Conferma toccando "Installa".
Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.

=============================================================================
\u{1F511} COME ACCEDERE AL TUO PROFILO
=============================================================================
1. Apri l'app Area46 dal display del telefono.
2. Inserisci la tua email: daniele.casci@gmail.com
3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.

Buon allenamento con Landmine Lab!
Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.

\u2014 Area46 Landmine Lab Firenze
firenzepersonaltrainer@gmail.com`,
      html: `Ciao Daniele!<br><br>Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!<br>Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.<br><br>=============================================================================<br>\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)<br>=============================================================================<br><br>Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:<br><br>\u{1F34F} SE USI IPHONE (APPLE):<br>1. Apri questo link con il browser SAFARI: https://area46-app.vercel.app<br>2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).<br>3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).<br>4. In alto a destra tocca "Aggiungi".<br>Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.<br><br>\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):<br>1. Apri questo link con il browser GOOGLE CHROME: https://area46-app.vercel.app<br>2. In alto a destra, tocca i tre puntini verticali (\u22EE).<br>3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".<br>4. Conferma toccando "Installa".<br>Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.<br><br>=============================================================================<br>\u{1F511} COME ACCEDERE AL TUO PROFILO<br>=============================================================================<br>1. Apri l'app Area46 dal display del telefono.<br>2. Inserisci la tua email: daniele.casci@gmail.com<br>3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.<br><br>Buon allenamento con Landmine Lab!<br>Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.<br><br>\u2014 Area46 Landmine Lab Firenze<br>firenzepersonaltrainer@gmail.com`,
      inviato_il: "2026-09-30T14:20:20.748Z",
      tipo: "benvenuto_nuovo_atleta",
      stato: "inviata"
    },
    {
      id: "email-1790777073444-918",
      destinatario: "pierpaolaciancia@gmail.com",
      oggetto: "Benvenuto in Area46 Landmine Lab \u2014 Il tuo profilo atleta \xE8 attivo! \u{1F3CB}\uFE0F\u200D\u2642\uFE0F",
      corpo: `Ciao Pierpaola!

Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!
Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.

=============================================================================
\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)
=============================================================================

Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:

\u{1F34F} SE USI IPHONE (APPLE):
1. Apri questo link con il browser SAFARI: https://area46-app.vercel.app
2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).
3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).
4. In alto a destra tocca "Aggiungi".
Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.

\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):
1. Apri questo link con il browser GOOGLE CHROME: https://area46-app.vercel.app
2. In alto a destra, tocca i tre puntini verticali (\u22EE).
3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".
4. Conferma toccando "Installa".
Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.

=============================================================================
\u{1F511} COME ACCEDERE AL TUO PROFILO
=============================================================================
1. Apri l'app Area46 dal display del telefono.
2. Inserisci la tua email: pierpaolaciancia@gmail.com
3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.

Buon allenamento con Landmine Lab!
Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.

\u2014 Area46 Landmine Lab Firenze
firenzepersonaltrainer@gmail.com`,
      html: `Ciao Pierpaola!<br><br>Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!<br>Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.<br><br>=============================================================================<br>\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)<br>=============================================================================<br><br>Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:<br><br>\u{1F34F} SE USI IPHONE (APPLE):<br>1. Apri questo link con il browser SAFARI: https://area46-app.vercel.app<br>2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).<br>3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).<br>4. In alto a destra tocca "Aggiungi".<br>Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.<br><br>\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):<br>1. Apri questo link con il browser GOOGLE CHROME: https://area46-app.vercel.app<br>2. In alto a destra, tocca i tre puntini verticali (\u22EE).<br>3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".<br>4. Conferma toccando "Installa".<br>Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.<br><br>=============================================================================<br>\u{1F511} COME ACCEDERE AL TUO PROFILO<br>=============================================================================<br>1. Apri l'app Area46 dal display del telefono.<br>2. Inserisci la tua email: pierpaolaciancia@gmail.com<br>3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.<br><br>Buon allenamento con Landmine Lab!<br>Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.<br><br>\u2014 Area46 Landmine Lab Firenze<br>firenzepersonaltrainer@gmail.com`,
      inviato_il: "2026-09-30T14:04:33.444Z",
      tipo: "benvenuto_nuovo_atleta",
      stato: "inviata"
    },
    {
      id: "email-1790777073341-341",
      destinatario: "pantanella@gmail.com",
      oggetto: "Benvenuto in Area46 Landmine Lab \u2014 Il tuo profilo atleta \xE8 attivo! \u{1F3CB}\uFE0F\u200D\u2642\uFE0F",
      corpo: `Ciao Alessandro!

Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!
Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.

=============================================================================
\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)
=============================================================================

Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:

\u{1F34F} SE USI IPHONE (APPLE):
1. Apri questo link con il browser SAFARI: https://area46-app.vercel.app
2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).
3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).
4. In alto a destra tocca "Aggiungi".
Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.

\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):
1. Apri questo link con il browser GOOGLE CHROME: https://area46-app.vercel.app
2. In alto a destra, tocca i tre puntini verticali (\u22EE).
3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".
4. Conferma toccando "Installa".
Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.

=============================================================================
\u{1F511} COME ACCEDERE AL TUO PROFILO
=============================================================================
1. Apri l'app Area46 dal display del telefono.
2. Inserisci la tua email: pantanella@gmail.com
3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.

Buon allenamento con Landmine Lab!
Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.

\u2014 Area46 Landmine Lab Firenze
firenzepersonaltrainer@gmail.com`,
      html: `Ciao Alessandro!<br><br>Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!<br>Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.<br><br>=============================================================================<br>\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)<br>=============================================================================<br><br>Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:<br><br>\u{1F34F} SE USI IPHONE (APPLE):<br>1. Apri questo link con il browser SAFARI: https://area46-app.vercel.app<br>2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).<br>3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).<br>4. In alto a destra tocca "Aggiungi".<br>Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.<br><br>\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):<br>1. Apri questo link con il browser GOOGLE CHROME: https://area46-app.vercel.app<br>2. In alto a destra, tocca i tre puntini verticali (\u22EE).<br>3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".<br>4. Conferma toccando "Installa".<br>Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.<br><br>=============================================================================<br>\u{1F511} COME ACCEDERE AL TUO PROFILO<br>=============================================================================<br>1. Apri l'app Area46 dal display del telefono.<br>2. Inserisci la tua email: pantanella@gmail.com<br>3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.<br><br>Buon allenamento con Landmine Lab!<br>Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.<br><br>\u2014 Area46 Landmine Lab Firenze<br>firenzepersonaltrainer@gmail.com`,
      inviato_il: "2026-09-30T14:04:33.341Z",
      tipo: "benvenuto_nuovo_atleta",
      stato: "inviata"
    }
  ]
};

// local-api.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var TMP_DATA_FILE = "/tmp/demo-data.json";
function loadData() {
  let loaded = null;
  if (fs4.existsSync(TMP_DATA_FILE)) {
    try {
      const raw = fs4.readFileSync(TMP_DATA_FILE, "utf-8");
      loaded = JSON.parse(raw);
    } catch {
    }
  }
  if (!loaded) {
    try {
      loaded = JSON.parse(JSON.stringify(demo_data_default));
    } catch {
      loaded = {
        livelli: [],
        ordine_livelli: [],
        database_esercizi: [],
        allenamenti: [],
        diario_utente: [],
        stato_allenamenti: [],
        preferenze_utente: [],
        profili_utenti: [],
        configurazione_lab: {},
        prenotazioni_slot: [],
        tariffario_pacchetti: [],
        transazioni_pagamenti: [],
        movimenti_crediti: [],
        eccezioni_calendario: [],
        attivita_lab: [],
        regole_palinsesto: [],
        active_user_id: "usr-atleta-01"
      };
    }
  }
  if (loaded.utenti_cancellati && Array.isArray(loaded.utenti_cancellati)) {
    const delUsers = loaded.utenti_cancellati;
    loaded.profili_utenti = (loaded.profili_utenti || []).filter(
      (p) => !delUsers.includes(p.id) && !delUsers.includes(p.email?.toLowerCase())
    );
  }
  if (loaded.prenotazioni_cancellate && Array.isArray(loaded.prenotazioni_cancellate)) {
    const delBks = loaded.prenotazioni_cancellate;
    loaded.prenotazioni_slot = (loaded.prenotazioni_slot || []).filter(
      (p) => !delBks.includes(p.id)
    );
  }
  return loaded;
}
function saveData(data, skipCloudSync = false) {
  db = data;
  try {
    fs4.writeFileSync(TMP_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
  }
  try {
    const directPath = path3.resolve(__dirname, "demo-data.json");
    const parentPath = path3.resolve(__dirname, "..", "demo-data.json");
    if (fs4.existsSync(directPath)) {
      fs4.writeFileSync(directPath, JSON.stringify(data, null, 2), "utf-8");
    } else if (fs4.existsSync(parentPath)) {
      fs4.writeFileSync(parentPath, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch {
  }
  if (!skipCloudSync) {
    syncDataToGoogleDrive(data).catch(() => {
    });
  }
}
var FALLBACK_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "landmine-lab-level-pro",
  private_key_id: "f12a0fb3f48bd15c458740288a8ca0762caf0617",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDpPC+nKFWPGxvF\nFRpBUCYWNruYlikCCB4dNVFifVTkof847hde7XzLDa8s+PAfhrxbX/vxjMlI+R9i\nogLrG5p46+S1eoflGNCwedeuNgGVqW4rqw+Hs5x3RetXPHPzq0coua3IQNI6x81g\nJjXTAhM5rTa+5L0bfCu4F/tYYAuJCiNGP+amrFw+iPnZsfwowgeOJaZ07bTgifMJ\n8rDTTBomPBDfzY8oHdv4SeDYGbywIvCjgiuXkF+649RpLLuRtk7rLL/9w7tXi35w\n1LdFbilaHA6bq4c4OJLZKT1j5T39EKshmuXLRzT2VZ1otv/RA4sZW27vmZTw+JNj\n0kj60G3/AgMBAAECggEACIX9i9NKhSdNdX9W7UobijZH1sSuDPf0+cZIChxgbNaK\nuC7jRcHSDK2cWD1ksRJAceppD6PAe103S2h2SNdCZubf/c3Th4jHn5tkSWaJ2klN\n0GS49ZGXxzgT6KU564631AItGqNby3AfzkK3NtXdk/8DgChlzMpV4q1lrw4bfc+C\nKPdIXYLP8M+MvjjoFpo+IIIGbL5Y1r+etmjLaOcJ6M23fPZ0vuS3RBcQoSltOpZi\nyXLegBuQrq+3W+3VOWzaPyh2VxmBkzvkmEGSb3nITzlCjC6qu1HFZIydH4T6IR19\npeIKqFm5HfG3wsS60iVNl8pjUuzBBfYLb27+eosISQKBgQD+Drnuv6w2R4Vk+Z1C\nb0THh8i65HDDyVL6DFR7tQ+T6s8K4g0VRsUSspS7JoIvfs6DlBDuAxLtxn5knsZG\nr/U0o6Nh7/GhaNkicuD4hKItSqWZURo1tnTqP2ZL+MQczpUEHlA+tgoHtEaYTPr1\n2ZWdjXYk9KxXnNDmT9F2amxg/QKBgQDrBLQb8jR5znNUH+5tB83ERg2CMjxs27w2\n4GIMUZot9Viu6SDQh7llrBJ92mrv2Z1kNMiTGBBVY2ljAHc4yE5yCNLaoH1EExiQ\nWhKrS01X/A4NPZxxrpqk00RryuQ9f1T719IhbeqbtdZmbrwwkR9/wta9YyKwlf3X\nCNdAfunJqwKBgC6gjUdgLj8YCUdq+I3E1h64sQJ8AqYsQOpbcPXzWRSQt8cLjdMl\n1e2EkP94JdSJtWU4u5KzRboWAAR/j2xRxvMORWIoI3S4RYGpC9kQnqMpXBMza1gI\nUJTdZezzjyqqT3ceCSQ5TMX1NC+nkTel42uzFsfZj/fUdBKQ+6R8C8ARAoGBAJ7z\nhnFkRhOgCyZ5lkONxKCcFKTbHz0s/MZMymO0iUfOKZXbPQNs2Hqof7U5FZx1HVtZ\ny9KYsutdmjiIZxozd8LurtWJOE/jbnirQvcxrfT1F/filL3aruMNtLgG+ImTZkIS\n/R74/XUk7gZHnOZoMNqzR5O9ygeO2qkmZJdNfweTAoGASpJvdiWY0OBlF4DlkXsC\nycgiiqzqhIM1di1IcaDg3yFm1bVl6ybU73Bj+8QRqI8Lt59+vmKSWh3vc/Oa6Bgv\n6JptY/0yFilq2AAWH4NEAuYdH4FuPKcjcLCHYsOZiemwKY4sMIZkMN9vnOQdUeEH\npoUCIINFimi2Qu2AFcE+w2k=\n-----END PRIVATE KEY-----\n",
  client_email: "bot-allenamenti@landmine-lab-level-pro.iam.gserviceaccount.com",
  client_id: "102154547582805007074",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/bot-allenamenti%40landmine-lab-level-pro.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};
var CREDENZIALI_PATH = fs4.existsSync(path3.resolve(__dirname, "credenziali.json")) ? path3.resolve(__dirname, "credenziali.json") : path3.resolve(__dirname, "..", "credenziali.json");
var GDRIVE_DEMO_DATA_ID = "129ts4wdwsypvWCB2cBHXWw3WTIKmtktA";
function base64url(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function getGoogleDriveAccessToken() {
  let creds = null;
  if (fs4.existsSync(CREDENZIALI_PATH)) {
    try {
      creds = JSON.parse(fs4.readFileSync(CREDENZIALI_PATH, "utf-8"));
    } catch {
    }
  }
  if (!creds && process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch {
    }
  }
  if (!creds) {
    creds = FALLBACK_SERVICE_ACCOUNT;
  }
  if (!creds || !creds.client_email || !creds.private_key) return null;
  try {
    const now = Math.floor(Date.now() / 1e3);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: creds.token_uri,
      exp: now + 3600,
      iat: now
    };
    const signInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
    const signer = crypto8.createSign("RSA-SHA256");
    signer.update(signInput);
    const jwt = `${signInput}.${signer.sign(creds.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
    const res = await fetch(creds.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}
async function syncConfigToGoogleDrive(config) {
  return syncDataToGoogleDrive({ configurazione_lab: config });
}
var lastCloudFetchTime = 0;
async function syncDataToGoogleDrive(fullDb) {
  try {
    const token = await getGoogleDriveAccessToken();
    if (!token) return;
    const resGet = await fetch(`https://www.googleapis.com/drive/v3/files/${GDRIVE_DEMO_DATA_ID}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resGet.ok) return;
    const driveDb = await resGet.json();
    if (fullDb.transazioni_pagamenti !== void 0) {
      driveDb.transazioni_pagamenti = fullDb.transazioni_pagamenti || [];
    }
    if (fullDb.transazioni_cancellate !== void 0) {
      driveDb.transazioni_cancellate = fullDb.transazioni_cancellate || [];
    }
    if (fullDb.utenti_cancellati !== void 0) {
      driveDb.utenti_cancellati = fullDb.utenti_cancellati || [];
    }
    if (fullDb.profili_utenti !== void 0) {
      driveDb.profili_utenti = fullDb.profili_utenti || [];
    }
    if (fullDb.prenotazioni_cancellate !== void 0) {
      driveDb.prenotazioni_cancellate = fullDb.prenotazioni_cancellate || [];
    }
    if (fullDb.prenotazioni_slot !== void 0) {
      driveDb.prenotazioni_slot = fullDb.prenotazioni_slot || [];
    }
    if (fullDb.movimenti_crediti !== void 0) {
      driveDb.movimenti_crediti = fullDb.movimenti_crediti || [];
    }
    if (fullDb.diario_utente !== void 0) {
      driveDb.diario_utente = fullDb.diario_utente || [];
    }
    if (fullDb.stato_allenamenti !== void 0) {
      driveDb.stato_allenamenti = fullDb.stato_allenamenti || [];
    }
    if (fullDb.preferenze_utente !== void 0) {
      driveDb.preferenze_utente = fullDb.preferenze_utente || [];
    }
    if (fullDb.notifiche_email !== void 0) {
      driveDb.notifiche_email = fullDb.notifiche_email || [];
    }
    if (fullDb.eccezioni_calendario !== void 0) {
      driveDb.eccezioni_calendario = fullDb.eccezioni_calendario || [];
    }
    if (fullDb.regole_palinsesto !== void 0) {
      driveDb.regole_palinsesto = fullDb.regole_palinsesto || [];
    }
    if (fullDb.tariffario_pacchetti !== void 0) {
      driveDb.tariffario_pacchetti = fullDb.tariffario_pacchetti || [];
    }
    if (fullDb.attivita_lab !== void 0) {
      driveDb.attivita_lab = fullDb.attivita_lab || [];
    }
    if (fullDb.configurazione_lab) {
      driveDb.configurazione_lab = {
        ...driveDb.configurazione_lab || {},
        ...fullDb.configurazione_lab
      };
    }
    driveDb.last_cloud_sync = (/* @__PURE__ */ new Date()).toISOString();
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${GDRIVE_DEMO_DATA_ID}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(driveDb, null, 2)
    });
    lastCloudFetchTime = Date.now();
  } catch {
  }
}
async function tryLoadConfigFromGoogleDrive() {
  try {
    const token = await getGoogleDriveAccessToken();
    if (!token) return;
    const resGet = await fetch(`https://www.googleapis.com/drive/v3/files/${GDRIVE_DEMO_DATA_ID}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resGet.ok) return;
    const driveDb = await resGet.json();
    if (driveDb.configurazione_lab) {
      db.configurazione_lab = {
        ...db.configurazione_lab || {},
        ...driveDb.configurazione_lab
      };
    }
    if (driveDb.transazioni_cancellate && Array.isArray(driveDb.transazioni_cancellate)) {
      db.transazioni_cancellate = Array.from(
        /* @__PURE__ */ new Set([...db.transazioni_cancellate || [], ...driveDb.transazioni_cancellate, ...FICTITIOUS_TX_IDS])
      );
    }
    if (driveDb.transazioni_pagamenti && Array.isArray(driveDb.transazioni_pagamenti)) {
      db.transazioni_pagamenti = driveDb.transazioni_pagamenti.filter(
        (t) => !db.transazioni_cancellate?.includes(t.id) && !db.transazioni_cancellate?.includes(t.codice_transazione)
      );
    }
    if (driveDb.utenti_cancellati && Array.isArray(driveDb.utenti_cancellati)) {
      db.utenti_cancellati = Array.from(
        /* @__PURE__ */ new Set([...db.utenti_cancellati || [], ...driveDb.utenti_cancellati])
      );
    }
    if (driveDb.profili_utenti && Array.isArray(driveDb.profili_utenti)) {
      const activeKeys = new Set(
        driveDb.profili_utenti.flatMap((p) => [p.id, p.email?.toLowerCase()]).filter(Boolean)
      );
      if (db.utenti_cancellati) {
        db.utenti_cancellati = db.utenti_cancellati.filter((key) => !activeKeys.has(key));
      }
      db.profili_utenti = driveDb.profili_utenti.filter(
        (p) => !db.utenti_cancellati?.includes(p.id) && !db.utenti_cancellati?.includes(p.email?.toLowerCase())
      );
    }
    db.active_user_id = null;
    if (driveDb.prenotazioni_cancellate && Array.isArray(driveDb.prenotazioni_cancellate)) {
      db.prenotazioni_cancellate = Array.from(
        /* @__PURE__ */ new Set([...db.prenotazioni_cancellate || [], ...driveDb.prenotazioni_cancellate])
      );
      db.prenotazioni_slot = (db.prenotazioni_slot || []).filter(
        (p) => !db.prenotazioni_cancellate.includes(p.id)
      );
    }
    if (driveDb.prenotazioni_slot && Array.isArray(driveDb.prenotazioni_slot)) {
      db.prenotazioni_slot = driveDb.prenotazioni_slot.filter(
        (p) => !db.prenotazioni_cancellate?.includes(p.id)
      );
    }
    if (driveDb.movimenti_crediti && Array.isArray(driveDb.movimenti_crediti)) {
      db.movimenti_crediti = driveDb.movimenti_crediti;
    }
    if (driveDb.diario_utente && Array.isArray(driveDb.diario_utente)) {
      db.diario_utente = driveDb.diario_utente;
    }
    if (driveDb.stato_allenamenti && Array.isArray(driveDb.stato_allenamenti)) {
      db.stato_allenamenti = driveDb.stato_allenamenti;
    }
    if (driveDb.preferenze_utente && Array.isArray(driveDb.preferenze_utente)) {
      db.preferenze_utente = driveDb.preferenze_utente;
    }
    if (driveDb.notifiche_email && Array.isArray(driveDb.notifiche_email)) {
      db.notifiche_email = driveDb.notifiche_email;
    }
    if (driveDb.eccezioni_calendario && Array.isArray(driveDb.eccezioni_calendario)) {
      db.eccezioni_calendario = driveDb.eccezioni_calendario;
    }
    if (driveDb.regole_palinsesto && Array.isArray(driveDb.regole_palinsesto)) {
      db.regole_palinsesto = driveDb.regole_palinsesto;
    }
    if (driveDb.tariffario_pacchetti && Array.isArray(driveDb.tariffario_pacchetti)) {
      db.tariffario_pacchetti = driveDb.tariffario_pacchetti;
    }
    if (driveDb.attivita_lab && Array.isArray(driveDb.attivita_lab)) {
      db.attivita_lab = driveDb.attivita_lab;
    }
    saveData(db, true);
  } catch {
  }
}
async function ensureLatestDataFromDrive(force = false) {
  const now = Date.now();
  if (!force && lastCloudFetchTime > 0 && now - lastCloudFetchTime < 1e4) {
    return;
  }
  await tryLoadConfigFromGoogleDrive();
  lastCloudFetchTime = Date.now();
}
tryLoadConfigFromGoogleDrive().catch(() => {
});
var FICTITIOUS_TX_IDS = [
  "TX-46-2026-001",
  "TX-46-2026-002",
  "TX-46-2026-003",
  "TX-46-2026-004",
  "TX-46-2026-005"
];
var db = loadData();
db.transazioni_cancellate = Array.from(/* @__PURE__ */ new Set([...db.transazioni_cancellate || [], ...FICTITIOUS_TX_IDS]));
db.transazioni_pagamenti = (db.transazioni_pagamenti || []).filter(
  (t) => !db.transazioni_cancellate.includes(t.codice_transazione) && !db.transazioni_cancellate.includes(t.id)
);
function getWalletOwner(atleta, database) {
  if (!atleta) return null;
  if (atleta.shared_wallet_with) {
    const master = (database?.profili_utenti || []).find(
      (p) => p.id === atleta.shared_wallet_with || p.email?.toLowerCase() === atleta.shared_wallet_with?.toLowerCase()
    );
    if (master) return master;
  }
  return atleta;
}
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name2 = parts[0]?.trim();
    if (!name2) return;
    const value = parts.slice(1).join("=").trim();
    list[name2] = decodeURIComponent(value);
  });
  return list;
}
async function sendEmailNotification(arg1, arg2) {
  const params = (arg2 && typeof arg2 === "object" ? arg2 : arg1) || {};
  const recipient = (params.to || "").trim();
  const subject = (params.subject || "Notifica Area46 Landmine Lab").trim();
  const bodyText = (params.body || "").toString();
  const htmlBody = params.html || (bodyText ? `<p style="font-family: sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${bodyText.split("\n").join("<br>")}</p>` : "<p>Notifica Area46 Landmine Lab</p>");
  const emailRecord = {
    id: `email-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    destinatario: recipient,
    oggetto: subject,
    corpo: bodyText,
    html: htmlBody,
    inviato_il: (/* @__PURE__ */ new Date()).toISOString(),
    tipo: params.tipo || "sistema",
    stato: "inviata"
  };
  db.notifiche_email = db.notifiche_email || [];
  db.notifiche_email.unshift(emailRecord);
  const gmailUser = "firenzepersonaltrainer@gmail.com";
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD || db.configurazione_lab?.gmail_app_password || "").replace(/\s+/g, "");
  if (gmailPass && recipient) {
    try {
      console.log(`[GMAIL SMTP ATTEMPT] Invio email a "${recipient}" da "${gmailUser}"...`);
      const transporter = nodemailer_default.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });
      await transporter.sendMail({
        from: `Area46 Landmine Lab <${gmailUser}>`,
        to: recipient,
        subject,
        text: bodyText,
        html: htmlBody
      });
      console.log(`[GMAIL SMTP SUCCESS] Email inviata con successo via Gmail a ${recipient}`);
      saveData(db);
      return emailRecord;
    } catch (err) {
      console.error("[GMAIL SMTP ERROR]", err?.message || err);
      if (params.throwOnError) {
        throw new Error(`Errore invio Gmail SMTP: ${err?.message || err}`);
      }
    }
  }
  const resendApiKey = db.configurazione_lab?.resend_api_key || process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn(`[NOTIFICA EMAIL WARNING] RESEND_API_KEY / GMAIL_APP_PASSWORD non configurate. Email registrata nel diario locale.`);
    saveData(db);
    if (params.throwOnError) {
      throw new Error("Variabile d'ambiente GMAIL_APP_PASSWORD o RESEND_API_KEY non configurata su Vercel.");
    }
    return emailRecord;
  }
  if (!recipient) {
    console.warn(`[NOTIFICA EMAIL WARNING] Indirizzo email destinatario vuoto.`);
    saveData(db);
    if (params.throwOnError) {
      throw new Error("Indirizzo email destinatario non valido.");
    }
    return emailRecord;
  }
  try {
    console.log(`[RESEND ATTEMPT] Invio email a "${recipient}" (Oggetto: ${subject})...`);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Area46 Landmine Lab <onboarding@resend.dev>",
        to: [recipient],
        subject,
        text: bodyText,
        html: htmlBody
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[RESEND API REJECTION] HTTP ${response.status}: ${errText}`);
      if (params.throwOnError) {
        throw new Error(`Resend ha rifiutato l'invio (${response.status}): ${errText}`);
      }
    } else {
      const resData = await response.json().catch(() => ({}));
      console.log(`[EMAIL DISPATCH SUCCESS] Inviata via Resend a ${recipient}. ID:`, resData?.id);
    }
  } catch (err) {
    console.warn("[NOTIFICA EMAIL ERROR]", err?.message || err);
    if (params.throwOnError) {
      throw err;
    }
  }
  saveData(db);
  return emailRecord;
}
function getHydratedUser(user, database) {
  if (!user) return null;
  const walletOwner = getWalletOwner(user, database);
  const isShared = walletOwner && walletOwner.id !== user.id;
  const partners = (database.profili_utenti || []).filter(
    (other) => other.id !== user.id && (other.shared_wallet_with === user.id || other.shared_wallet_with?.toLowerCase() === user.email?.toLowerCase())
  );
  return {
    ...user,
    name: `${user.nome} ${user.cognome}`.trim(),
    crediti: isShared ? walletOwner.crediti : user.crediti,
    data_scadenza_crediti: isShared ? walletOwner.data_scadenza_crediti : user.data_scadenza_crediti,
    is_shared_wallet: isShared,
    shared_master_nome: isShared ? `${walletOwner.nome} ${walletOwner.cognome}`.trim() : void 0,
    is_wallet_master: partners.length > 0,
    shared_partners_count: partners.length,
    shared_partner_names: partners.map((x) => `${x.nome} ${x.cognome}`.trim())
  };
}
function getCurrentUser(reqOrDb, maybeDb) {
  const req = maybeDb ? reqOrDb : null;
  const database = maybeDb || reqOrDb;
  let candidate = null;
  if (req && req.headers) {
    const headerUser = req.headers["x-area46-user"] || req.headers["x-user-id"] || (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
    const cookies = parseCookies(req.headers.cookie);
    const cookieUser = cookies["area46_user_id"] || cookies["area46_user_email"];
    candidate = (headerUser || cookieUser || "").trim() || null;
  }
  if (candidate) {
    const user = (database.profili_utenti || []).find(
      (u) => u.id === candidate || u.email?.toLowerCase() === candidate.toLowerCase()
    );
    if (user) {
      return getHydratedUser(user, database);
    }
  }
  return null;
}
function addMovimentoCrediti(database, params) {
  database.movimenti_crediti = database.movimenti_crediti || [];
  const mov = {
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    atleta_id: params.atleta_id,
    email_cliente: params.email_cliente,
    nome_cliente: params.nome_cliente,
    data_ora: (/* @__PURE__ */ new Date()).toISOString(),
    tipo: params.tipo,
    delta_crediti: params.delta_crediti,
    saldo_risultante: params.saldo_risultante,
    motivazione: params.motivazione,
    operatore: params.operatore || "sistema"
  };
  database.movimenti_crediti.unshift(mov);
  return mov;
}
async function handleLocalApi(req, res, next) {
  await ensureLatestDataFromDrive();
  db = loadData();
  const host = req.headers?.host || "localhost:5173";
  const url = new URL(req.url ?? "/", `http://${host}`);
  let pathname = url.pathname;
  if (!pathname.startsWith("/app-api")) {
    const route = url.searchParams.get("__route");
    if (route) {
      pathname = `/app-api/${route.replace(/^\/+/, "")}`;
      url.searchParams.delete("__route");
    }
  }
  if (!pathname.startsWith("/app-api")) {
    if (next) return next();
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "Endpoint non trovato" }));
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  const method = req.method?.toUpperCase() ?? "GET";
  if (method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const getBody = async () => {
    if (req.body !== void 0 && req.body !== null) {
      if (typeof req.body === "string") {
        try {
          return { parsedBody: JSON.parse(req.body), rawBody: req.body };
        } catch {
          return { parsedBody: {}, rawBody: req.body };
        }
      }
      return { parsedBody: req.body, rawBody: JSON.stringify(req.body) };
    }
    return new Promise((resolve3) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        if (!data) return resolve3({ parsedBody: {}, rawBody: "" });
        try {
          resolve3({ parsedBody: JSON.parse(data), rawBody: data });
        } catch {
          resolve3({ parsedBody: {}, rawBody: data });
        }
      });
      req.on("error", () => resolve3({ parsedBody: {}, rawBody: "" }));
    });
  };
  const { parsedBody, rawBody } = await getBody();
  const currentUser = getCurrentUser(req, db);
  if (pathname === "/app-api/auth/current-user" && method === "GET") {
    return res.end(JSON.stringify(currentUser));
  }
  if (pathname === "/app-api/auth/logout" && method === "POST") {
    res.setHeader(
      "Set-Cookie",
      "area46_user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; HttpOnly"
    );
    return res.end(JSON.stringify({ ok: true, messaggio: "Disconnessione effettuata." }));
  }
  if (pathname === "/app-api/auth/login-email" && method === "POST") {
    const email = (parsedBody.email || "").trim().toLowerCase();
    const code = (parsedBody.code || "").trim();
    const requestOtpOnly = !!parsedBody.requestOtpOnly;
    if (!email || !email.includes("@")) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Inserisci un indirizzo email valido." }));
    }
    const isCoachEmail = email === "firenzepersonaltrainer@gmail.com";
    let found = (db.profili_utenti || []).find(
      (u) => u.email?.toLowerCase() === email
    );
    if (!found && !isCoachEmail) {
      res.statusCode = 403;
      return res.end(
        JSON.stringify({
          error: "Email non abilitata. L'accesso ad Area46 \xE8 riservato agli atleti censiti dal Coach Stefano Tronconi. Contatta il Lab per richiedere l'abilitazione."
        })
      );
    }
    if (requestOtpOnly) {
      console.log(`[AUTH] Richiesta invio OTP per email abilitata: "${email}"`);
      const otpCode = Math.floor(1e5 + Math.random() * 9e5).toString();
      try {
        await sendEmailNotification({
          to: email,
          subject: "Codice di Accesso - Area46 Landmine Lab",
          body: `Il tuo codice OTP di verifica per accedere ad Area46 Landmine Lab \xE8: ${otpCode}`,
          html: `<div style="font-family: sans-serif; padding: 24px; background-color: #f8f9fa; border-radius: 16px;">
              <h2 style="color: #09090b; margin-top: 0;">Area46 Landmine Lab</h2>
              <p style="color: #3f3f46; font-size: 14px;">Inserisci il seguente codice di verifica nell'applicazione per accedere al tuo account:</p>
              <div style="background-color: #ffffff; border: 2px solid #1c00ff; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #1c00ff;">${otpCode}</span>
              </div>
              <p style="color: #71717a; font-size: 12px;">Se non hai richiesto tu questo codice, puoi ignorare questa email.</p>
            </div>`,
          tipo: "sistema",
          throwOnError: true
        });
        console.log(`[AUTH] Email OTP inviata realmente via Resend a "${email}"`);
        return res.end(
          JSON.stringify({
            ok: true,
            messaggio: `Codice OTP inviato a ${email}`
          })
        );
      } catch (err) {
        console.warn(`[AUTH OTP FALLBACK] Resend Sandbox/Restrizione per "${email}":`, err?.message || err);
        return res.end(
          JSON.stringify({
            ok: true,
            messaggio: `Codice temporaneo generato per ${email}`,
            sandboxOtp: otpCode,
            isSandbox: true
          })
        );
      }
    }
    if (found) {
      if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
        db.utenti_cancellati = db.utenti_cancellati.filter(
          (u) => u !== found.id && u.toLowerCase() !== email
        );
      }
      found.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      if (!found.primo_accesso_notificato && !isCoachEmail) {
        found.primo_accesso_notificato = (/* @__PURE__ */ new Date()).toISOString();
        saveData(db);
        try {
          await sendEmailNotification({
            to: "firenzepersonaltrainer@gmail.com",
            subject: `Alert Primo Accesso Atleta - ${found.nome} ${found.cognome}`,
            body: `L'atleta ${found.nome} ${found.cognome} (${found.email}) ha appena effettuato il suo primo accesso alla Web App Area46 Landmine Lab.`,
            html: `<div style="font-family: sans-serif; padding: 20px; background-color: #f8f9fa; border-radius: 12px;">
                <h3 style="color: #09090b; margin-top: 0;">Alert Primo Accesso Atleta</h3>
                <p style="font-size: 14px; color: #3f3f46;">L'atleta <strong>${found.nome} ${found.cognome}</strong> (<code>${found.email}</code>) si \xE8 appena collegato per la prima volta alla Web App Area46 Landmine Lab.</p>
                <p style="font-size: 12px; color: #71717a;">Data e ora: ${(/* @__PURE__ */ new Date()).toLocaleString("it-IT")}</p>
              </div>`,
            tipo: "notifica_coach"
          });
          console.log(`[ALERT COACH] Notificato primo accesso per ${found.email}`);
        } catch (err) {
          console.warn("[ALERT COACH WARNING]", err);
        }
      } else {
        saveData(db);
      }
      res.setHeader(
        "Set-Cookie",
        `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      return res.end(JSON.stringify({ ok: true, user: getHydratedUser(found, db) }));
    }
    if (email === "firenzepersonaltrainer@gmail.com") {
      if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
        db.utenti_cancellati = db.utenti_cancellati.filter(
          (u) => u !== "usr-coach-01" && u.toLowerCase() !== email
        );
      }
      const coach = {
        id: "usr-coach-01",
        email: "firenzepersonaltrainer@gmail.com",
        nome: "Stefano",
        cognome: "Tronconi",
        ruolo: "manager",
        crediti: 999,
        data_ultimo_accesso: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.profili_utenti = db.profili_utenti || [];
      db.profili_utenti.push(coach);
      saveData(db);
      await syncDataToGoogleDrive(db);
      res.setHeader(
        "Set-Cookie",
        `area46_user_id=${encodeURIComponent(coach.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      return res.end(JSON.stringify({ ok: true, user: getHydratedUser(coach, db) }));
    }
    const cleanName = email.split("@")[0].replace(/[._-]/g, " ");
    const parts = cleanName.split(" ").filter(Boolean);
    const nome = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Nuovo";
    const cognome = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || "Atleta";
    const nuovoAtleta = {
      id: `usr-atleta-${Date.now()}`,
      email,
      nome,
      cognome,
      name: `${nome} ${cognome}`.trim(),
      ruolo: "atleta",
      crediti: 0,
      tempo_cancellazione_ore: 24,
      tempo_anticipo_prenotazione_ore: 24,
      data_scadenza_crediti: null,
      tipo_abbonamento: "standard",
      data_ultimo_accesso: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
      db.utenti_cancellati = db.utenti_cancellati.filter(
        (u) => u !== nuovoAtleta.id && u.toLowerCase() !== email
      );
    }
    db.profili_utenti = db.profili_utenti || [];
    db.profili_utenti.push(nuovoAtleta);
    saveData(db);
    await syncDataToGoogleDrive(db);
    const emailCoach = db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
    const notificaCoachBody = `
NOTIFICA NUOVO ACCESSO ATLETA \u2014 AREA46 TRAINING LAB
=============================================================================
Data e Ora: ${(/* @__PURE__ */ new Date()).toLocaleString("it-IT")}
Evento: Un nuovo atleta ha effettuato il primo accesso all'applicazione

DATI DEL NUOVO ATLETA:
- Nome e Cognome: ${nuovoAtleta.nome} ${nuovoAtleta.cognome}
- Email: ${nuovoAtleta.email}
- Ruolo: Atleta
- Saldo Crediti: 0 crediti

STATO ACCOUNT:
L'atleta \xE8 stato aggiunto automaticamente all'anagrafica del tuo gestionale.
Ha accesso immediato e gratuito a tutti i programmi di allenamento del Lab.
Puoi visualizzare la sua posizione, assegnare crediti o configurare pacchetti
direttamente dal Pannello Manager Atleti.
=============================================================================
      `.trim();
    await sendEmailNotification({
      to: emailCoach,
      subject: `[AREA46 NOTIFICA] Nuovo Atleta Registrato \u2014 ${nuovoAtleta.nome} ${nuovoAtleta.cognome}`,
      body: notificaCoachBody,
      tipo: "nuovo_utente_registrato"
    });
    res.setHeader(
      "Set-Cookie",
      `area46_user_id=${encodeURIComponent(nuovoAtleta.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
    );
    return res.end(JSON.stringify({ ok: true, user: getHydratedUser(nuovoAtleta, db), isNew: true }));
  }
  if (pathname === "/app-api/auth/oauth-login" && method === "POST") {
    const provider = parsedBody.provider || "google";
    const email = (parsedBody.email || "").trim().toLowerCase();
    const name2 = parsedBody.name || "";
    if (!email || !email.includes("@")) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Email account social non valida." }));
    }
    if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
      db.utenti_cancellati = db.utenti_cancellati.filter(
        (u) => u.toLowerCase() !== email
      );
    }
    let found = (db.profili_utenti || []).find(
      (u) => u.email?.toLowerCase() === email
    );
    let isNewOauth = false;
    if (!found) {
      isNewOauth = true;
      found = {
        id: `usr-${provider}-${Date.now()}`,
        email,
        nome: name2.split(" ")[0] || email.split("@")[0],
        cognome: name2.split(" ").slice(1).join(" ") || "",
        name: name2 || email.split("@")[0],
        ruolo: email === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta",
        crediti: 0,
        tempo_cancellazione_ore: 24,
        data_scadenza_crediti: null,
        tipo_abbonamento: "standard",
        data_ultimo_accesso: (/* @__PURE__ */ new Date()).toISOString(),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.profili_utenti = db.profili_utenti || [];
      db.profili_utenti.push(found);
      saveData(db);
      await syncDataToGoogleDrive(db);
      if (found.ruolo === "atleta") {
        const emailCoach = db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
        const notificaSocialBody = `
NOTIFICA NUOVO ACCESSO SOCIAL ATLETA \u2014 AREA46 TRAINING LAB
=============================================================================
Data e Ora: ${(/* @__PURE__ */ new Date()).toLocaleString("it-IT")}
Evento: Un nuovo atleta ha effettuato il primo accesso tramite social (${provider.toUpperCase()})

DATI DEL NUOVO ATLETA:
- Nome e Cognome: ${found.nome} ${found.cognome}
- Email: ${found.email}
- Ruolo: Atleta
- Saldo Crediti: 0 crediti

STATO ACCOUNT:
L'atleta \xE8 stato aggiunto automaticamente all'anagrafica del tuo gestionale.
Ha accesso immediato e gratuito a tutti i programmi di allenamento del Lab.
Puoi visualizzare la sua posizione, assegnare crediti o configurare pacchetti
direttamente dal Pannello Manager Atleti.
=============================================================================
          `.trim();
        await sendEmailNotification({
          to: emailCoach,
          subject: `[AREA46 NOTIFICA] Nuovo Atleta Registrato \u2014 ${found.nome} ${found.cognome}`,
          body: notificaSocialBody,
          tipo: "nuovo_utente_registrato"
        });
      }
    } else {
      found.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      saveData(db);
    }
    res.setHeader(
      "Set-Cookie",
      `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
    );
    return res.end(JSON.stringify({ ok: true, user: getHydratedUser(found, db), isNew: isNewOauth }));
  }
  if (pathname === "/app-api/auth/switch-user" && method === "POST") {
    const targetId = parsedBody.userId;
    const pin = (parsedBody.pin || "").trim();
    const found = (db.profili_utenti || []).find(
      (u) => u.id === targetId || u.email?.toLowerCase() === targetId?.toLowerCase()
    );
    if (found) {
      if (found.ruolo === "manager" && currentUser?.ruolo !== "manager") {
        if (pin !== "4646") {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: "PIN Coach errato o mancante." }));
        }
      }
      found.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      saveData(db);
      res.setHeader(
        "Set-Cookie",
        `area46_user_id=${encodeURIComponent(found.id)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      return res.end(JSON.stringify(getHydratedUser(found, db)));
    }
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "Utente non trovato" }));
  }
  if (pathname === "/app-api/manager/migrazione-glide" && method === "POST") {
    const isApply = parsedBody.mode === "apply";
    const payload = {
      utenti: parsedBody.utenti || [],
      diario: parsedBody.diario || []
    };
    const stats = {
      utenti_aggiornati: 0,
      utenti_creati: 0,
      voci_diario_inserite: 0,
      errori: []
    };
    if (payload.utenti.length > 0) {
      db.profili_utenti = db.profili_utenti || [];
      for (const u of payload.utenti) {
        if (!u.email || !u.email.includes("@")) {
          stats.errori.push(`Email non valida: ${u.email}`);
          continue;
        }
        const email = u.email.trim().toLowerCase();
        const existing = db.profili_utenti.find((p) => p.email.toLowerCase() === email);
        if (existing) {
          if (u.nome) existing.nome = u.nome;
          if (u.cognome) existing.cognome = u.cognome;
          existing.name = `${existing.nome} ${existing.cognome || ""}`.trim();
          if (u.telefono) existing.telefono = u.telefono;
          if (u.codice_fiscale) existing.codice_fiscale = u.codice_fiscale;
          if (u.indirizzo) existing.indirizzo = u.indirizzo;
          if (u.crediti !== void 0) existing.crediti = Number(u.crediti);
          if (u.data_scadenza_crediti) existing.data_scadenza_crediti = u.data_scadenza_crediti;
          if (u.tipo_abbonamento) existing.tipo_abbonamento = u.tipo_abbonamento;
          stats.utenti_aggiornati++;
        } else {
          const nuovo = {
            id: `usr-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
            email,
            nome: u.nome || email.split("@")[0],
            cognome: u.cognome || "",
            name: `${u.nome || email.split("@")[0]} ${u.cognome || ""}`.trim(),
            telefono: u.telefono || "",
            codice_fiscale: u.codice_fiscale || "",
            indirizzo: u.indirizzo || "",
            ruolo: email === "firenzepersonaltrainer@gmail.com" ? "manager" : "atleta",
            crediti: Number(u.crediti || 0),
            tempo_cancellazione_ore: 24,
            data_scadenza_crediti: u.data_scadenza_crediti || null,
            tipo_abbonamento: u.tipo_abbonamento || "standard",
            data_ultimo_accesso: (/* @__PURE__ */ new Date()).toISOString()
          };
          db.profili_utenti.push(nuovo);
          stats.utenti_creati++;
        }
      }
    }
    if (payload.diario.length > 0) {
      db.diario_utente = db.diario_utente || [];
      for (const d of payload.diario) {
        if (!d.email_cliente || !d.nome_esercizio) continue;
        const email = d.email_cliente.trim().toLowerCase();
        const dup = db.diario_utente.some(
          (e) => e.email_cliente.toLowerCase() === email && e.nome_esercizio.toLowerCase() === d.nome_esercizio.toLowerCase() && e.data_ora === d.data_ora
        );
        if (!dup) {
          db.diario_utente.push({
            id: Date.now() + Math.floor(Math.random() * 1e5),
            email_cliente: email,
            id_esercizio: d.id_esercizio || null,
            nome_esercizio: d.nome_esercizio,
            carico_kg: d.carico_kg ?? null,
            ripetizioni: d.ripetizioni ?? null,
            serie: d.serie ?? null,
            sets_json: d.sets_json ?? null,
            feedback: d.feedback || null,
            data_ora: d.data_ora || (/* @__PURE__ */ new Date()).toISOString(),
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          stats.voci_diario_inserite++;
        }
      }
    }
    if (isApply) {
      saveData(db);
    }
    return res.end(JSON.stringify({ ok: true, isApply, stats }));
  }
  if (pathname === "/app-api/profili" && method === "GET") {
    const now = /* @__PURE__ */ new Date();
    const delUsers = db.utenti_cancellati || [];
    const profili = (db.profili_utenti || []).filter((p) => !delUsers.includes(p.id) && !delUsers.includes(p.email?.toLowerCase())).map((p) => {
      const walletOwner = getWalletOwner(p, db);
      const isShared = walletOwner && walletOwner.id !== p.id;
      const effectiveCrediti = isShared ? walletOwner.crediti : p.crediti;
      const effectiveScadenza = isShared ? walletOwner.data_scadenza_crediti : p.data_scadenza_crediti;
      const partners = (db.profili_utenti || []).filter(
        (other) => other.id !== p.id && (other.shared_wallet_with === p.id || other.shared_wallet_with?.toLowerCase() === p.email?.toLowerCase())
      );
      const isMaster = partners.length > 0;
      let avviso_scadenza = false;
      let giorni_a_scadenza = null;
      if (effectiveScadenza) {
        const diffDays = Math.ceil(
          (new Date(effectiveScadenza).getTime() - now.getTime()) / (1e3 * 60 * 60 * 24)
        );
        giorni_a_scadenza = diffDays;
        if (diffDays <= 7) avviso_scadenza = true;
      }
      let mesi_inattivita = 0;
      let avviso_inattivita = false;
      if (p.data_ultimo_accesso) {
        const diffMesi = (now.getTime() - new Date(p.data_ultimo_accesso).getTime()) / (1e3 * 60 * 60 * 24 * 30.43);
        mesi_inattivita = Math.floor(diffMesi);
        if (mesi_inattivita >= 5) avviso_inattivita = true;
      }
      return {
        ...p,
        crediti: effectiveCrediti,
        data_scadenza_crediti: effectiveScadenza,
        shared_wallet_with: p.shared_wallet_with || null,
        is_shared_wallet: isShared,
        shared_master_nome: isShared ? `${walletOwner.nome} ${walletOwner.cognome}`.trim() : void 0,
        is_wallet_master: isMaster,
        shared_partners_count: partners.length,
        shared_partner_names: partners.map((x) => `${x.nome} ${x.cognome}`.trim()),
        tempo_cancellazione_ore: p.tempo_cancellazione_ore || 24,
        tempo_anticipo_prenotazione_ore: p.tempo_anticipo_prenotazione_ore || 24,
        giorni_a_scadenza,
        avviso_scadenza,
        mesi_inattivita,
        avviso_inattivita
      };
    });
    return res.end(JSON.stringify(profili));
  }
  if (pathname === "/app-api/profili" && method === "POST") {
    const creditiIniziali = Number(parsedBody.crediti ?? 0);
    const email = (parsedBody.email || `atleta${Date.now()}@area46lab.it`).trim().toLowerCase();
    const existingId = parsedBody.id || `usr-atleta-${Date.now()}`;
    if (db.utenti_cancellati && Array.isArray(db.utenti_cancellati)) {
      db.utenti_cancellati = db.utenti_cancellati.filter(
        (u) => u !== existingId && u.toLowerCase() !== email
      );
    }
    db.profili_utenti = db.profili_utenti || [];
    const existingIndex = db.profili_utenti.findIndex(
      (p) => p.id && p.id === existingId || p.email && p.email.toLowerCase() === email
    );
    const nuovo = {
      ...existingIndex >= 0 ? db.profili_utenti[existingIndex] : {},
      id: existingIndex >= 0 ? db.profili_utenti[existingIndex].id : existingId,
      nome: (parsedBody.nome || "Nuovo").trim(),
      cognome: (parsedBody.cognome || "Atleta").trim(),
      email,
      telefono: (parsedBody.telefono || "").trim(),
      codice_fiscale: (parsedBody.codice_fiscale || "").trim(),
      indirizzo: (parsedBody.indirizzo || "").trim(),
      ruolo: parsedBody.ruolo || "atleta",
      crediti: creditiIniziali,
      shared_wallet_with: parsedBody.shared_wallet_with?.trim() || null,
      tempo_cancellazione_ore: Number(parsedBody.tempo_cancellazione_ore || 24),
      tempo_anticipo_prenotazione_ore: Number(parsedBody.tempo_anticipo_prenotazione_ore || 24),
      data_scadenza_crediti: parsedBody.data_scadenza_crediti || new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10),
      data_ultimo_accesso: (/* @__PURE__ */ new Date()).toISOString(),
      note_coach: parsedBody.note_coach || "",
      created_at: existingIndex >= 0 && db.profili_utenti[existingIndex].created_at ? db.profili_utenti[existingIndex].created_at : (/* @__PURE__ */ new Date()).toISOString()
    };
    if (existingIndex >= 0) {
      db.profili_utenti[existingIndex] = nuovo;
    } else {
      db.profili_utenti.push(nuovo);
      if (nuovo.email && nuovo.email.includes("@")) {
        try {
          await sendEmailNotification({
            to: nuovo.email,
            subject: "Invito ad Area46 Landmine Lab - Profilo Atleta Attivato",
            body: `Ciao ${nuovo.nome} ${nuovo.cognome}!

Il tuo profilo atleta su Area46 Landmine Lab \xE8 stato attivato dal Coach Stefano Tronconi.

Accedi alla Web App dal link:
https://area46-app.vercel.app

Puoi salvare l'applicazione direttamente sulla schermata Home del tuo smartphone per consultare i tuoi allenamenti, il diario ed i crediti.`,
            html: `<div style="font-family: sans-serif; padding: 24px; background-color: #f8f9fa; border-radius: 16px;">
                <h2 style="color: #09090b; margin-top: 0;">Benvenuto in Area46 Landmine Lab!</h2>
                <p style="color: #3f3f46; font-size: 15px;">Ciao <strong>${nuovo.nome} ${nuovo.cognome}</strong>,</p>
                <p style="color: #3f3f46; font-size: 14px;">Il tuo profilo atleta \xE8 stato attivato dal Coach Stefano Tronconi su Area46 Landmine Lab.</p>
                <div style="background-color: #ffffff; border: 2px solid #1c00ff; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                  <a href="https://area46-app.vercel.app" style="font-weight: 900; font-size: 16px; color: #1c00ff; text-decoration: none;">Apri Area46 Web App &rarr;</a>
                </div>
                <p style="color: #71717a; font-size: 12px; margin-top: 16px;">\u{1F4F1} <strong>Istruzioni Smartphone:</strong> Apri il link dal tuo browser mobile (Safari su iPhone o Chrome su Android) e seleziona "Aggiungi a Home" per salvare l'App sullo schermo del telefono.</p>
              </div>`,
            tipo: "invito_atleta"
          });
          console.log(`[INVITO AUTOMATICO] Inviata mail di benvenuto a ${nuovo.email}`);
        } catch (err) {
          console.warn("[INVITO AUTOMATICO WARNING]", err?.message || err);
        }
      }
    }
    if (creditiIniziali !== 0) {
      addMovimentoCrediti(db, {
        atleta_id: nuovo.id,
        email_cliente: nuovo.email,
        nome_cliente: `${nuovo.nome} ${nuovo.cognome}`,
        tipo: creditiIniziali > 0 ? "bonus_regalo" : "penalty",
        delta_crediti: creditiIniziali,
        saldo_risultante: creditiIniziali,
        motivazione: "Crediti configurati in anagrafica",
        operatore: "coach"
      });
    }
    let notificaEmail = null;
    if (existingIndex < 0 && nuovo.ruolo === "atleta" && nuovo.email.includes("@")) {
      const appUrl = "https://area46-app.vercel.app";
      const welcomeBody = `
Ciao ${nuovo.nome}!

Il Coach Stefano Tronconi ha creato il tuo profilo atleta ufficiale nell'applicazione di Area46 Landmine Lab!
Da adesso puoi consultare tutti i tuoi programmi di allenamento, guardare i video tecnici e seguire le sessioni direttamente dal tuo smartphone.

=============================================================================
\u{1F4F1} COME SALVARE E INSTALLARE L'APP SUL TUO TELEFONO (COME UNA VERA APP)
=============================================================================

Per avere l'app sempre a portata di mano sul display del tuo smartphone, segui questa velocissima procedura in base al tuo telefono:

\u{1F34F} SE USI IPHONE (APPLE):
1. Apri questo link con il browser SAFARI: ${appUrl}
2. In basso al centro dello schermo, tocca l'icona di Condivisione (il quadrato con la freccetta verso l'alto \u238B).
3. Scorri le opzioni verso il basso e tocca "Aggiungi alla schermata Home" (+).
4. In alto a destra tocca "Aggiungi".
Fatto! L'icona di Area46 apparir\xE0 sul tuo schermo: toccandola, l'app si aprir\xE0 a schermo intero come una vera applicazione di sistema.

\u{1F916} SE USI ANDROID (SAMSUNG, XIAOMI, GOOGLE PIXEL, MOTOROLA, ECC.):
1. Apri questo link con il browser GOOGLE CHROME: ${appUrl}
2. In alto a destra, tocca i tre puntini verticali (\u22EE).
3. Tocca la voce "Installa app" oppure "Aggiungi a schermata Home".
4. Conferma toccando "Installa".
Fatto! Troverai l'app Area46 tra le tue applicazioni e sulla tua schermata principale.

=============================================================================
\u{1F511} COME ACCEDERE AL TUO PROFILO
=============================================================================
1. Apri l'app Area46 dal display del telefono.
2. Inserisci la tua email: ${nuovo.email}
3. Clicca su "Ricevi Codice di Accesso (OTP)": non hai bisogno di password complesse, riceverai un comodo codice numerico per accedere in sicurezza istantaneamente.

Buon allenamento con Landmine Lab!
Per qualsiasi dubbio o supporto, chiedi pure a Stefano al Lab.

\u2014 Area46 Landmine Lab Firenze
firenzepersonaltrainer@gmail.com
        `.trim();
      notificaEmail = await sendEmailNotification({
        to: nuovo.email,
        subject: `Benvenuto in Area46 Landmine Lab \u2014 Il tuo profilo atleta \xE8 attivo! \u{1F3CB}\uFE0F\u200D\u2642\uFE0F`,
        body: welcomeBody,
        tipo: "benvenuto_nuovo_atleta"
      });
    }
    saveData(db);
    await syncDataToGoogleDrive(db);
    res.statusCode = 201;
    return res.end(JSON.stringify({ ...nuovo, notifica_email: notificaEmail, isNew: existingIndex < 0 }));
  }
  const modCreditiMatch = pathname.match(/^\/app-api\/profili\/([a-zA-Z0-9_-]+)\/modifica-crediti$/);
  if (modCreditiMatch && method === "POST") {
    const targetId = modCreditiMatch[1];
    const profilo = (db.profili_utenti || []).find((p) => p.id === targetId);
    if (!profilo) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Profilo non trovato" }));
    }
    const saldoPrecedente = Number(profilo.crediti) || 0;
    let delta = 0;
    if (parsedBody.crediti !== void 0) {
      const nuovoVal = Number(parsedBody.crediti);
      delta = nuovoVal - saldoPrecedente;
      profilo.crediti = nuovoVal;
    } else if (parsedBody.delta !== void 0) {
      delta = Number(parsedBody.delta);
      profilo.crediti = saldoPrecedente + delta;
    }
    if (parsedBody.data_scadenza_crediti) {
      profilo.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
    }
    if (delta !== 0) {
      addMovimentoCrediti(db, {
        atleta_id: profilo.id,
        email_cliente: profilo.email,
        nome_cliente: `${profilo.nome} ${profilo.cognome}`,
        tipo: parsedBody.tipo || (delta > 0 ? "bonus_regalo" : delta < 0 ? "penalty" : "modifica_manuale"),
        delta_crediti: delta,
        saldo_risultante: profilo.crediti,
        motivazione: parsedBody.motivazione || (delta > 0 ? "Bonus/Regalo assegnato dal Coach" : "Rettifica/Penalty manuale Coach"),
        operatore: "coach"
      });
    }
    profilo.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    saveData(db);
    return res.end(JSON.stringify(profilo));
  }
  const profiliPutMatch = pathname.match(/^\/app-api\/profili\/([a-zA-Z0-9_-]+)$/);
  if (profiliPutMatch && method === "PUT") {
    const targetId = profiliPutMatch[1];
    const profilo = (db.profili_utenti || []).find((p) => p.id === targetId);
    if (!profilo) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Profilo non trovato" }));
    }
    if (parsedBody.nome !== void 0) profilo.nome = parsedBody.nome;
    if (parsedBody.cognome !== void 0) profilo.cognome = parsedBody.cognome;
    if (parsedBody.email !== void 0) profilo.email = parsedBody.email;
    if (parsedBody.telefono !== void 0) profilo.telefono = parsedBody.telefono;
    if (parsedBody.codice_fiscale !== void 0) profilo.codice_fiscale = parsedBody.codice_fiscale;
    if (parsedBody.indirizzo !== void 0) profilo.indirizzo = parsedBody.indirizzo;
    if (parsedBody.crediti !== void 0) profilo.crediti = Number(parsedBody.crediti);
    if (parsedBody.tempo_cancellazione_ore !== void 0) {
      profilo.tempo_cancellazione_ore = Number(parsedBody.tempo_cancellazione_ore);
    }
    if (parsedBody.tempo_anticipo_prenotazione_ore !== void 0) {
      profilo.tempo_anticipo_prenotazione_ore = Number(parsedBody.tempo_anticipo_prenotazione_ore);
    }
    if (parsedBody.data_scadenza_crediti !== void 0) {
      profilo.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
    }
    if (parsedBody.note_coach !== void 0) profilo.note_coach = parsedBody.note_coach;
    if (parsedBody.shared_wallet_with !== void 0) {
      profilo.shared_wallet_with = parsedBody.shared_wallet_with?.trim() || null;
    }
    profilo.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    saveData(db);
    await syncDataToGoogleDrive(db);
    return res.end(JSON.stringify(profilo));
  }
  const atletaDeleteMatch = pathname.match(/^\/app-api\/(?:atleti|profili)\/([a-zA-Z0-9_@.-]+)$/);
  if (atletaDeleteMatch && method === "DELETE") {
    const targetIdentifier = decodeURIComponent(atletaDeleteMatch[1]);
    const atleta = (db.profili_utenti || []).find(
      (p) => p.id === targetIdentifier || p.email?.toLowerCase() === targetIdentifier.toLowerCase()
    );
    const targetId = atleta ? atleta.id : targetIdentifier;
    const targetEmail = atleta ? atleta.email?.toLowerCase() : targetIdentifier.toLowerCase();
    db.profili_utenti = (db.profili_utenti || []).filter(
      (p) => p.id !== targetId && p.email?.toLowerCase() !== targetEmail
    );
    db.utenti_cancellati = db.utenti_cancellati || [];
    if (targetId && !db.utenti_cancellati.includes(targetId)) {
      db.utenti_cancellati.push(targetId);
    }
    if (targetEmail && !db.utenti_cancellati.includes(targetEmail)) {
      db.utenti_cancellati.push(targetEmail);
    }
    const bksToRemove = (db.prenotazioni_slot || []).filter(
      (p) => p.atleta_id === targetId || p.email_cliente?.toLowerCase() === targetEmail
    );
    const bksToRemoveIds = bksToRemove.map((p) => p.id);
    db.prenotazioni_cancellate = Array.from(
      /* @__PURE__ */ new Set([...db.prenotazioni_cancellate || [], ...bksToRemoveIds])
    );
    db.prenotazioni_slot = (db.prenotazioni_slot || []).filter(
      (p) => p.atleta_id !== targetId && p.email_cliente?.toLowerCase() !== targetEmail
    );
    db.movimenti_crediti = (db.movimenti_crediti || []).filter(
      (m) => m.atleta_id !== targetId && m.email_cliente?.toLowerCase() !== targetEmail
    );
    db.diario_utente = (db.diario_utente || []).filter(
      (d) => d.email_cliente?.toLowerCase() !== targetEmail
    );
    db.stato_allenamenti = (db.stato_allenamenti || []).filter(
      (s) => s.email_cliente?.toLowerCase() !== targetEmail
    );
    db.preferenze_utente = (db.preferenze_utente || []).filter(
      (pref) => pref.email?.toLowerCase() !== targetEmail
    );
    saveData(db);
    await syncDataToGoogleDrive(db);
    return res.end(
      JSON.stringify({
        success: true,
        message: "Atleta e tutti i dati associati eliminati definitivamente con successo"
      })
    );
  }
  const dismAnteprimaMatch = pathname.match(
    /^\/app-api\/atleti\/([a-zA-Z0-9_-]+)\/anteprima-dismissione$/
  );
  if (dismAnteprimaMatch && method === "GET") {
    const atletaId = dismAnteprimaMatch[1];
    const atleta = (db.profili_utenti || []).find((p) => p.id === atletaId);
    if (!atleta) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Atleta non trovato" }));
    }
    const tipoAbb = atleta.tipo_abbonamento || "lab_continuativo_3x";
    const tariffaPiena = tipoAbb === "lab_continuativo_2x" ? 35 : 33.25;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const currentTimeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    });
    const tuttePrenotazioni = (db.prenotazioni_slot || []).filter(
      (p) => p.atleta_id === atleta.id || p.email_cliente === atleta.email
    );
    const seduteSvolteList = tuttePrenotazioni.filter(
      (p) => p.stato === "confermata" && (p.data < todayStr || p.data === todayStr && p.orario <= currentTimeStr)
    );
    const seduteSvolteCount = seduteSvolteList.length;
    const prenotazioniFuture = tuttePrenotazioni.filter(
      (p) => p.stato === "confermata" && (p.data > todayStr || p.data === todayStr && p.orario > currentTimeStr)
    );
    const transazioniAtleta = (db.transazioni_pagamenti || []).filter(
      (t) => (t.atleta_id === atleta.id || t.email_cliente === atleta.email) && t.stato === "completato"
    );
    let totaleGiaVersato = 0;
    if (transazioniAtleta.length > 0) {
      totaleGiaVersato = Number(transazioniAtleta[0].importo_euro) || 0;
    } else {
      totaleGiaVersato = tipoAbb === "lab_continuativo_2x" ? 250 : 359;
    }
    const penaleStandard = 50;
    const valoreSedutePieno = Math.round(seduteSvolteCount * tariffaPiena * 100) / 100;
    const totaleDovuto = Math.round((valoreSedutePieno + penaleStandard) * 100) / 100;
    const totaleDaAddebitare = Math.max(
      0,
      Math.round((totaleDovuto - totaleGiaVersato) * 100) / 100
    );
    const emailCoach = db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
    return res.end(
      JSON.stringify({
        atleta: {
          id: atleta.id,
          nome: atleta.nome,
          cognome: atleta.cognome,
          email: atleta.email,
          telefono: atleta.telefono,
          codice_fiscale: atleta.codice_fiscale,
          indirizzo: atleta.indirizzo,
          crediti: atleta.crediti,
          tipo_abbonamento: tipoAbb,
          stato_iscrizione: atleta.stato_iscrizione || "attivo"
        },
        tipo_abbonamento: tipoAbb,
        tariffa_seduta: tariffaPiena,
        sedute_svolte: seduteSvolteCount,
        valore_sedute_pieno: valoreSedutePieno,
        penale_standard: penaleStandard,
        totale_gia_versato: totaleGiaVersato,
        totale_dovuto: totaleDovuto,
        totale_da_addebitare: totaleDaAddebitare,
        prenotazioni_future: prenotazioniFuture,
        email_coach: emailCoach
      })
    );
  }
  const dismExecuteMatch = pathname.match(
    /^\/app-api\/atleti\/([a-zA-Z0-9_-]+)\/dismissione-anticipata$/
  );
  if (dismExecuteMatch && method === "POST") {
    const atletaId = dismExecuteMatch[1];
    const atleta = (db.profili_utenti || []).find((p) => p.id === atletaId);
    if (!atleta) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Atleta non trovato" }));
    }
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const currentTimeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    });
    const prenotazioniCancellate = [];
    (db.prenotazioni_slot || []).forEach((p) => {
      const isThisAthlete = p.atleta_id === atleta.id || p.email_cliente === atleta.email;
      const isFuture = p.data > todayStr || p.data === todayStr && p.orario >= currentTimeStr;
      if (isThisAthlete && isFuture && p.stato === "confermata") {
        p.stato = "cancellata_dismissione";
        p.cancellato_il = (/* @__PURE__ */ new Date()).toISOString();
        p.note = "Cancellata per dismissione anticipata atleta";
        prenotazioniCancellate.push({ id: p.id, data: p.data, orario: p.orario });
      }
    });
    const tipoAbb = atleta.tipo_abbonamento || "lab_continuativo_3x";
    const defaultTariffa = tipoAbb === "lab_continuativo_2x" ? 35 : 33.25;
    const tariffa = Number(parsedBody.tariffa_seduta ?? defaultTariffa);
    const svolte = Number(parsedBody.sedute_svolte ?? 0);
    const penale = Number(parsedBody.penale_euro ?? 50);
    const versato = Number(
      parsedBody.totale_versato ?? (tipoAbb === "lab_continuativo_2x" ? 250 : 359)
    );
    const valoreSedute = Math.round(svolte * tariffa * 100) / 100;
    const totaleDovuto = Math.round((valoreSedute + penale) * 100) / 100;
    const totaleDaAddebitare = Math.max(0, Math.round((totaleDovuto - versato) * 100) / 100);
    const txCode = `TX-DISM-${Date.now().toString().slice(-6)}`;
    const nuovaTransazione = {
      codice_transazione: txCode,
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome} ${atleta.cognome}`.trim(),
      codice_fiscale: atleta.codice_fiscale || "",
      indirizzo: atleta.indirizzo || "",
      id_pacchetto: "dismissione-anticipata",
      nome_pacchetto: `Penale e conguaglio recesso anticipato (${svolte} sedute x ${tariffa}\u20AC + penale ${penale}\u20AC)`,
      importo_euro: totaleDaAddebitare,
      metodo: "carta",
      crediti_acquistati: 0,
      debiti_decurtati: 0,
      crediti_effettivi_aggiunti: 0,
      stato: "completato",
      stato_fattura: "da_emettere",
      note: parsedBody.note || "Dismissione anticipata richiesta dal coach",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.transazioni_pagamenti = db.transazioni_pagamenti || [];
    db.transazioni_pagamenti.unshift(nuovaTransazione);
    const creditiPrecedenti = atleta.crediti || 0;
    atleta.crediti = 0;
    atleta.stato_iscrizione = "dismesso";
    atleta.tipo_abbonamento = "nessuno";
    atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
    const notaAggiunta = `[DISMESSO ANTICIPATAMENTE il ${(/* @__PURE__ */ new Date()).toLocaleDateString(
      "it-IT"
    )}: addebitato saldo \u20AC ${totaleDaAddebitare} (penale \u20AC ${penale}, sedute ${svolte}x${tariffa}\u20AC). Revocati ${prenotazioniCancellate.length} slot.]`;
    atleta.note_coach = atleta.note_coach ? `${atleta.note_coach} | ${notaAggiunta}` : notaAggiunta;
    addMovimentoCrediti(db, {
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome} ${atleta.cognome}`,
      tipo: "penalty",
      delta_crediti: -creditiPrecedenti,
      saldo_risultante: 0,
      motivazione: `Dismissione anticipata: ricalcolo sedute a tariffa piena (${tariffa}\u20AC) + penale recesso ${penale}\u20AC. Revocate ${prenotazioniCancellate.length} prenotazioni future.`,
      operatore: "coach"
    });
    const emailCoach = db.configurazione_lab?.notifica_email || "firenzepersonaltrainer@gmail.com";
    const emailBody = `
RIEPILOGO DISMISSIONE ANTICIPATA \u2014 AREA46 TRAINING LAB
=============================================================================
Data Operazione: ${(/* @__PURE__ */ new Date()).toLocaleString("it-IT")}
Codice Transazione: ${txCode}
Stato Fiscale: DA EMETTERE

DATI FISCALI CLIENTE:
- Nome e Cognome: ${atleta.nome} ${atleta.cognome}
- Codice Fiscale: ${atleta.codice_fiscale || "NON SPECIFICATO (Richiedere al cliente)"}
- Indirizzo Fatturazione: ${atleta.indirizzo || "NON SPECIFICATO"}
- Email: ${atleta.email}
- Telefono: ${atleta.telefono || "-"}

CONTEGGIO RECESSO ANTICIPATO:
1. Sedute Svolte: ${svolte} x \u20AC ${tariffa.toFixed(2)} = \u20AC ${valoreSedute.toFixed(2)} (Ricalcolo tariffa base piena)
2. Penale di Recesso / Spese Chiusura: \u20AC ${penale.toFixed(2)}
3. Totale Valore Contrattuale: \u20AC ${totaleDovuto.toFixed(2)}
4. Quota Gi\xE0 Versata dal Cliente: -\u20AC ${versato.toFixed(2)}
-----------------------------------------------------------------------------
TOTALE NETTO ADDEBITATO DA FATTURARE: \u20AC ${totaleDaAddebitare.toFixed(2)}
=============================================================================

INDICAZIONI PER EMISSIONE FATTURA (SDI / GESTIONALE):
- Oggetto / Descrizione: "Saldo per risoluzione anticipata accordo continuativo Lab, conguaglio sedute fruite e penale di svincolo slot riservato."
- Importo Imponibile: \u20AC ${totaleDaAddebitare.toFixed(2)}
- Regime: Forfettario (esente IVA ex L. 190/2014) o Ordinario.
- Termine di emissione: Entro 12 giorni dalla data odierna.

CALENDARIO E PRENOTAZIONI:
- Slot revocati e liberati con successo: ${prenotazioniCancellate.length} prenotazioni rimosse.
- Posizione atleta: ARCHIVIATA / DISMESSA.
      `.trim();
    db.notifiche_email = db.notifiche_email || [];
    const emailRecord = {
      id: `email-${Date.now()}`,
      destinatario: emailCoach,
      oggetto: `[AREA46 FISCO] Dismissione Anticipata ${atleta.nome} ${atleta.cognome} \u2014 Dati per Emissione Fattura`,
      corpo: emailBody,
      inviato_il: (/* @__PURE__ */ new Date()).toISOString(),
      stato: "inviata"
    };
    db.notifiche_email.unshift(emailRecord);
    saveData(db);
    console.log(`[EMAIL DISMISSIONE] Inviata a ${emailCoach}:`, emailRecord.oggetto);
    return res.end(
      JSON.stringify({
        ok: true,
        messaggio: `Dismissione completata con successo! Revocate ${prenotazioniCancellate.length} prenotazioni future. Addebitato saldo di \u20AC ${totaleDaAddebitare.toFixed(2)}.`,
        dettagli: {
          atleta_id: atleta.id,
          nome_cliente: `${atleta.nome} ${atleta.cognome}`,
          codice_transazione: txCode,
          totale_addebitato: totaleDaAddebitare,
          penale_applicata: penale,
          sedute_svolte: svolte,
          tariffa_seduta: tariffa,
          prenotazioni_cancellate: prenotazioniCancellate,
          email_notifica: emailRecord
        }
      })
    );
  }
  if (pathname === "/app-api/movimenti-crediti" && method === "GET") {
    const atletaId = url.searchParams.get("atleta_id");
    const emailParam = url.searchParams.get("email");
    let rows = db.movimenti_crediti || [];
    if (currentUser.ruolo === "atleta") {
      rows = rows.filter(
        (m) => m.email_cliente === currentUser.email || m.atleta_id === currentUser.id
      );
    } else if (atletaId) {
      rows = rows.filter((m) => m.atleta_id === atletaId);
    } else if (emailParam) {
      rows = rows.filter((m) => m.email_cliente === emailParam);
    }
    rows.sort(
      (a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime()
    );
    return res.end(JSON.stringify(rows));
  }
  if (pathname === "/app-api/movimenti-crediti" && method === "POST") {
    const atletaId = parsedBody.atleta_id;
    const atleta = (db.profili_utenti || []).find((p) => p.id === atletaId);
    if (!atleta) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Atleta non trovato" }));
    }
    const delta = Number(parsedBody.delta_crediti || 0);
    atleta.crediti = (Number(atleta.crediti) || 0) + delta;
    atleta.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const mov = addMovimentoCrediti(db, {
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome} ${atleta.cognome}`,
      tipo: parsedBody.tipo || (delta >= 0 ? "bonus_regalo" : "penalty"),
      delta_crediti: delta,
      saldo_risultante: atleta.crediti,
      motivazione: parsedBody.motivazione || (delta >= 0 ? "Regalo Coach" : "Penalty"),
      operatore: "coach"
    });
    saveData(db);
    res.statusCode = 201;
    return res.end(JSON.stringify({ ok: true, movimento: mov, crediti_attuali: atleta.crediti }));
  }
  if (pathname === "/app-api/eccezioni-calendario" && method === "GET") {
    const dataFilter = url.searchParams.get("data");
    let list = db.eccezioni_calendario || [];
    if (dataFilter) {
      list = list.filter((e) => e.data === dataFilter);
    }
    return res.end(JSON.stringify(list));
  }
  if (pathname === "/app-api/eccezioni-calendario" && method === "POST") {
    db.eccezioni_calendario = db.eccezioni_calendario || [];
    if (parsedBody.orari && Array.isArray(parsedBody.orari) && parsedBody.orari.length > 0) {
      const createList = [];
      for (const o of parsedBody.orari) {
        const nuova2 = {
          id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: parsedBody.data,
          orario: o,
          tipo: parsedBody.tipo || "slot_bloccato",
          motivo: parsedBody.motivo || "",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.eccezioni_calendario.push(nuova2);
        createList.push(nuova2);
      }
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(createList));
    }
    const nuova = {
      id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      data: parsedBody.data,
      orario: parsedBody.orario || null,
      tipo: parsedBody.tipo || "slot_straordinario",
      // 'slot_straordinario', 'slot_bloccato', 'chiusura_giornata'
      motivo: parsedBody.motivo || "",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.eccezioni_calendario.push(nuova);
    saveData(db);
    res.statusCode = 201;
    return res.end(JSON.stringify(nuova));
  }
  if (pathname === "/app-api/eccezioni-calendario/chiusura-periodo" && method === "POST") {
    const { data_inizio, data_fine, motivo, proroga_scadenze } = parsedBody;
    if (!data_inizio || !data_fine) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Date di inizio e fine periodo obbligatorie" }));
    }
    db.eccezioni_calendario = db.eccezioni_calendario || [];
    const start = new Date(data_inizio);
    const end = new Date(data_fine);
    const diffMs = end.getTime() - start.getTime();
    const giorniChiusura = Math.max(1, Math.round(diffMs / (1e3 * 60 * 60 * 24)) + 1);
    const dateCreate = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      dateCreate.push(dStr);
      const existing = db.eccezioni_calendario.find(
        (e) => e.data === dStr && e.tipo === "chiusura_giornata"
      );
      if (!existing) {
        db.eccezioni_calendario.push({
          id: `exc-close-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: dStr,
          orario: null,
          tipo: "chiusura_giornata",
          motivo: motivo || "Chiusura programmata dello studio",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      (db.prenotazioni_slot || []).forEach((bk) => {
        if (bk.data === dStr && bk.stato === "confermata") {
          bk.stato = "cancellata_in_tempo";
          bk.cancellato_il = (/* @__PURE__ */ new Date()).toISOString();
          bk.note = `Annullata per chiusura studio: ${motivo || "Chiusura programmata"}`;
          const atleta = (db.profili_utenti || []).find(
            (p) => p.id === bk.atleta_id || p.email === bk.email_cliente
          );
          if (atleta && bk.credito_scalato) {
            atleta.crediti = (atleta.crediti ?? 0) + 1;
            addMovimentoCrediti(db, {
              atleta_id: atleta.id,
              email_cliente: atleta.email,
              nome_cliente: `${atleta.nome} ${atleta.cognome}`,
              tipo: "rimborso_cancellazione",
              delta_crediti: 1,
              saldo_risultante: atleta.crediti,
              motivazione: `Rimborso slot ${bk.data} ${bk.orario} per chiusura studio (${motivo || "Chiusura programmata"})`,
              operatore: "sistema"
            });
          }
        }
      });
      cur.setDate(cur.getDate() + 1);
    }
    let atletiAggiornati = 0;
    if (proroga_scadenze !== false) {
      (db.profili_utenti || []).forEach((p) => {
        if (p.ruolo === "atleta" && p.stato_iscrizione !== "dismesso" && p.data_scadenza_crediti) {
          if (p.data_scadenza_crediti >= data_inizio) {
            const oldScad = new Date(p.data_scadenza_crediti);
            oldScad.setDate(oldScad.getDate() + giorniChiusura);
            p.data_scadenza_crediti = oldScad.toISOString().slice(0, 10);
            atletiAggiornati++;
            addMovimentoCrediti(db, {
              atleta_id: p.id,
              email_cliente: p.email,
              nome_cliente: `${p.nome} ${p.cognome}`,
              tipo: "bonus_regalo",
              delta_crediti: 0,
              saldo_risultante: p.crediti,
              motivazione: `Proroga automatica di +${giorniChiusura} giorni alla scadenza per chiusura studio (${motivo || "Ferie / Festivit\xE0"}). Nuova scadenza: ${p.data_scadenza_crediti}`,
              operatore: "sistema"
            });
          }
        }
      });
    }
    saveData(db);
    res.statusCode = 201;
    return res.end(
      JSON.stringify({
        ok: true,
        giorni_chiusura: giorniChiusura,
        date_bloccate: dateCreate.length,
        atleti_prorogati: atletiAggiornati,
        messaggio: `Chiusura studio registrata per ${giorniChiusura} giorni (${data_inizio} \u2794 ${data_fine}). ${proroga_scadenze !== false ? `Scadenze prorogate automaticamente di +${giorniChiusura} giorni per ${atletiAggiornati} atleti attivi.` : ""}`
      })
    );
  }
  const excDeleteMatch = pathname.match(/^\/app-api\/eccezioni-calendario\/([a-zA-Z0-9_-]+)$/);
  if (excDeleteMatch && method === "DELETE") {
    const id = excDeleteMatch[1];
    db.eccezioni_calendario = (db.eccezioni_calendario || []).filter((e) => e.id !== id);
    saveData(db);
    return res.end(JSON.stringify({ ok: true }));
  }
  if (pathname === "/app-api/attivita" && method === "GET") {
    return res.end(JSON.stringify(db.attivita_lab || []));
  }
  if (pathname === "/app-api/attivita" && method === "POST") {
    db.attivita_lab = db.attivita_lab || [];
    const nuovaAttivita = {
      id: parsedBody.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: parsedBody.nome || "Nuova Attivit\xE0",
      descrizione: parsedBody.descrizione || "",
      costo_crediti: Number(parsedBody.costo_crediti) ?? 1,
      max_partecipanti: Number(parsedBody.max_partecipanti) ?? 1,
      durata_minuti: Number(parsedBody.durata_minuti) ?? 60,
      colore: parsedBody.colore || "#1c00ff",
      attiva: parsedBody.attiva !== false,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.attivita_lab.push(nuovaAttivita);
    saveData(db);
    res.statusCode = 201;
    return res.end(JSON.stringify(nuovaAttivita));
  }
  const actPutMatch = pathname.match(/^\/app-api\/attivita\/([a-zA-Z0-9_-]+)$/);
  if (actPutMatch && method === "PUT") {
    const id = actPutMatch[1];
    db.attivita_lab = db.attivita_lab || [];
    const idx = db.attivita_lab.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Attivit\xE0 non trovata" }));
    }
    db.attivita_lab[idx] = { ...db.attivita_lab[idx], ...parsedBody, id };
    saveData(db);
    return res.end(JSON.stringify(db.attivita_lab[idx]));
  }
  const actDelMatch = pathname.match(/^\/app-api\/attivita\/([a-zA-Z0-9_-]+)$/);
  if (actDelMatch && method === "DELETE") {
    const id = actDelMatch[1];
    db.attivita_lab = (db.attivita_lab || []).filter((a) => a.id !== id);
    saveData(db);
    return res.end(JSON.stringify({ ok: true }));
  }
  if (pathname === "/app-api/regole-palinsesto" && method === "GET") {
    return res.end(JSON.stringify(db.regole_palinsesto || []));
  }
  if (pathname === "/app-api/regole-palinsesto" && method === "POST") {
    db.regole_palinsesto = db.regole_palinsesto || [];
    const nuovaRegola = {
      id: parsedBody.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: parsedBody.nome || "Nuovo Palinsesto",
      id_attivita: parsedBody.id_attivita || "act-landmine-lab",
      data_inizio: parsedBody.data_inizio || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      data_fine: parsedBody.data_fine || null,
      giorni_settimana: Array.isArray(parsedBody.giorni_settimana) ? parsedBody.giorni_settimana : [1, 3, 5],
      fasce_orarie: Array.isArray(parsedBody.fasce_orarie) ? parsedBody.fasce_orarie : [],
      attiva: parsedBody.attiva !== false,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.regole_palinsesto.push(nuovaRegola);
    saveData(db);
    res.statusCode = 201;
    return res.end(JSON.stringify(nuovaRegola));
  }
  const rulePutMatch = pathname.match(/^\/app-api\/regole-palinsesto\/([a-zA-Z0-9_-]+)$/);
  if (rulePutMatch && method === "PUT") {
    const id = rulePutMatch[1];
    db.regole_palinsesto = db.regole_palinsesto || [];
    const idx = db.regole_palinsesto.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Regola di palinsesto non trovata" }));
    }
    db.regole_palinsesto[idx] = { ...db.regole_palinsesto[idx], ...parsedBody, id };
    saveData(db);
    return res.end(JSON.stringify(db.regole_palinsesto[idx]));
  }
  const ruleDelMatch = pathname.match(/^\/app-api\/regole-palinsesto\/([a-zA-Z0-9_-]+)$/);
  if (ruleDelMatch && method === "DELETE") {
    const id = ruleDelMatch[1];
    db.regole_palinsesto = (db.regole_palinsesto || []).filter((r) => r.id !== id);
    saveData(db);
    return res.end(JSON.stringify({ ok: true }));
  }
  if (pathname === "/app-api/lab-config" && method === "GET") {
    const reqSecret = req.headers["x-stripe-secret-key"]?.trim();
    const reqPub = req.headers["x-stripe-publishable-key"]?.trim();
    if (reqSecret && (!db.configurazione_lab?.stripe_secret_key || !db.configurazione_lab.stripe_secret_key.startsWith("sk_"))) {
      db.configurazione_lab = db.configurazione_lab || {};
      db.configurazione_lab.stripe_secret_key = reqSecret;
      if (reqPub) db.configurazione_lab.stripe_publishable_key = reqPub;
      db.configurazione_lab.stripe_collegato = true;
      saveData(db);
    } else if (process.env.STRIPE_SECRET_KEY && (!db.configurazione_lab?.stripe_secret_key || !db.configurazione_lab.stripe_secret_key.startsWith("sk_"))) {
      db.configurazione_lab = db.configurazione_lab || {};
      db.configurazione_lab.stripe_secret_key = process.env.STRIPE_SECRET_KEY.trim();
      if (process.env.STRIPE_PUBLISHABLE_KEY) {
        db.configurazione_lab.stripe_publishable_key = process.env.STRIPE_PUBLISHABLE_KEY.trim();
      }
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        db.configurazione_lab.stripe_webhook_secret = process.env.STRIPE_WEBHOOK_SECRET.trim();
      }
      db.configurazione_lab.stripe_collegato = true;
      saveData(db);
    }
    return res.end(JSON.stringify(db.configurazione_lab || {}));
  }
  if (pathname === "/app-api/lab-config" && method === "PUT") {
    db.configurazione_lab = {
      ...db.configurazione_lab || {},
      ...parsedBody
    };
    saveData(db);
    syncConfigToGoogleDrive(db.configurazione_lab).catch(() => {
    });
    return res.end(JSON.stringify(db.configurazione_lab));
  }
  if (pathname === "/app-api/prenotazioni" && method === "GET") {
    const dataFilter = url.searchParams.get("data");
    const emailFilter = url.searchParams.get("email");
    const atletaIdFilter = url.searchParams.get("atleta_id");
    const delBks = db.prenotazioni_cancellate || [];
    let prenotazioni = (db.prenotazioni_slot || []).filter(
      (p) => !delBks.includes(p.id) && (p.stato === "confermata" || !p.stato || p.stato === "attiva") && !p.stato?.startsWith("cancellata")
    );
    if (dataFilter) {
      prenotazioni = prenotazioni.filter((p) => p.data === dataFilter);
    }
    if (emailFilter) {
      const ef = emailFilter.toLowerCase();
      prenotazioni = prenotazioni.filter(
        (p) => p.email_cliente?.toLowerCase() === ef || p.atleta_id === emailFilter
      );
    }
    if (atletaIdFilter) {
      prenotazioni = prenotazioni.filter((p) => p.atleta_id === atletaIdFilter);
    }
    return res.end(JSON.stringify(prenotazioni));
  }
  if (pathname === "/app-api/prenotazioni/batch" && method === "POST") {
    const atletaId = parsedBody.atleta_id || parsedBody.email_cliente || currentUser?.id;
    if (!atletaId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Atleta non specificato o sessione non valida." }));
    }
    const atleta = (db.profili_utenti || []).find(
      (p) => p.id === atletaId || p.email?.toLowerCase() === atletaId?.toLowerCase() || p.email?.toLowerCase() === parsedBody.email_cliente?.toLowerCase()
    ) || (currentUser && (currentUser.id === atletaId || currentUser.email?.toLowerCase() === atletaId?.toLowerCase()) ? currentUser : null);
    if (!atleta) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: `Atleta "${atletaId}" non trovato nel database.` }));
    }
    const requestedSlots = parsedBody.slots || [];
    if (!Array.isArray(requestedSlots) || requestedSlots.length === 0) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Nessuno slot specificato per la prenotazione multipla." }));
    }
    const isManager = currentUser?.ruolo === "manager";
    const totalCost = requestedSlots.length;
    const walletOwner = getWalletOwner(atleta, db) || atleta;
    const isShared = walletOwner && walletOwner.id !== atleta.id;
    if (!isManager) {
      if ((walletOwner.crediti ?? 0) < totalCost) {
        res.statusCode = 403;
        return res.end(
          JSON.stringify({
            error: `Crediti insufficienti. ${isShared ? `Il borsellino condiviso (${walletOwner.nome} ${walletOwner.cognome}) ha` : "Hai"} ${walletOwner.crediti ?? 0} crediti ma hai selezionato ${totalCost} slot. Acquista un nuovo Pacchetto Lab o riduci la selezione.`,
            motivo: "crediti_insufficienti",
            crediti: walletOwner.crediti,
            richiesti: totalCost
          })
        );
      }
      if (walletOwner.data_scadenza_crediti) {
        const scadenza = new Date(walletOwner.data_scadenza_crediti);
        for (const s of requestedSlots) {
          if (new Date(s.data) > scadenza) {
            res.statusCode = 403;
            return res.end(
              JSON.stringify({
                error: `Uno o pi\xF9 slot selezionati (${s.data}) superano la data di scadenza del pacchetto (${walletOwner.data_scadenza_crediti}). Rinnova il pacchetto per prenotare.`,
                motivo: "crediti_scaduti",
                scadenza: walletOwner.data_scadenza_crediti
              })
            );
          }
        }
      }
      const anticipoOre = Number(
        atleta?.tempo_anticipo_prenotazione_ore ?? db.configurazione_lab?.tempo_anticipo_prenotazione_ore ?? 24
      );
      if (anticipoOre > 0) {
        const nowMs = Date.now();
        for (const s of requestedSlots) {
          const slotTs = (/* @__PURE__ */ new Date(`${s.data}T${s.orario}:00`)).getTime();
          const oreDiff = (slotTs - nowMs) / (1e3 * 60 * 60);
          if (oreDiff < anticipoOre) {
            res.statusCode = 400;
            return res.end(
              JSON.stringify({
                error: `Lo slot del ${s.data} alle ${s.orario} non pu\xF2 essere prenotato: la policy richiede almeno ${anticipoOre} ore di preavviso prima dell'inizio della sessione.`,
                motivo: "anticipo_insufficiente",
                anticipo_ore: anticipoOre
              })
            );
          }
        }
      }
    }
    db.prenotazioni_slot = db.prenotazioni_slot || [];
    const eccezioni = db.eccezioni_calendario || [];
    for (const s of requestedSlots) {
      const bloccato = eccezioni.find(
        (e) => e.data === s.data && (e.tipo === "chiusura_giornata" || e.tipo === "slot_bloccato" && e.orario === s.orario)
      );
      if (bloccato) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            error: `Lo slot del ${s.data} alle ${s.orario} non \xE8 disponibile: ${bloccato.motivo || "Chiusura o ferie del Lab"}.`
          })
        );
      }
      const slotGiaOccupato = db.prenotazioni_slot.find(
        (p) => p.data === s.data && p.orario === s.orario && p.stato === "confermata"
      );
      if (slotGiaOccupato) {
        res.statusCode = 409;
        return res.end(
          JSON.stringify({
            error: `Lo slot del ${s.data} alle ${s.orario} \xE8 gi\xE0 stato prenotato da un altro atleta. Capienza massima raggiunta per questa postazione.`
          })
        );
      }
    }
    walletOwner.crediti = Math.max(0, (walletOwner.crediti ?? 0) - totalCost);
    atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
    if (isShared) walletOwner.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
    const createPrenotazioni = [];
    const now = Date.now();
    requestedSlots.forEach((s, idx) => {
      const bk = {
        id: `bk-${now}-${idx}`,
        data: s.data,
        orario: s.orario,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        telefono_cliente: atleta.telefono || "",
        stato: "confermata",
        credito_scalato: true,
        note: s.note || "Prenotazione Multipla Rapida",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.prenotazioni_slot.push(bk);
      createPrenotazioni.push(bk);
    });
    addMovimentoCrediti(db, {
      atleta_id: walletOwner.id,
      email_cliente: walletOwner.email,
      nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
      tipo: "prenotazione_slot",
      delta_crediti: -totalCost,
      saldo_risultante: walletOwner.crediti,
      motivazione: isShared ? `Prenotazione a blocchi di ${totalCost} sessioni per ${atleta.nome} ${atleta.cognome} [Borsellino Condiviso]` : `Prenotazione multipla di ${totalCost} sessioni`,
      operatore: isManager ? "coach" : "atleta"
    });
    saveData(db);
    await syncDataToGoogleDrive(db);
    res.statusCode = 201;
    return res.end(
      JSON.stringify({
        ok: true,
        count: createPrenotazioni.length,
        prenotazioni: createPrenotazioni,
        crediti_rimanenti: walletOwner.crediti,
        messaggio: `${createPrenotazioni.length} sessioni prenotate con successo!`
      })
    );
  }
  if (pathname === "/app-api/prenotazioni" && method === "POST") {
    const isManager = currentUser?.ruolo === "manager";
    const atletaId = parsedBody.atleta_id || parsedBody.email_cliente || currentUser?.id;
    if (!atletaId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Atleta non specificato o sessione non valida." }));
    }
    const atleta = (db.profili_utenti || []).find(
      (p) => p.id === atletaId || p.email?.toLowerCase() === atletaId?.toLowerCase() || p.email?.toLowerCase() === parsedBody.email_cliente?.toLowerCase()
    ) || (currentUser && (currentUser.id === atletaId || currentUser.email?.toLowerCase() === atletaId?.toLowerCase()) ? currentUser : null);
    if (!atleta) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: `Atleta non trovato con identificativo "${atletaId}".` }));
    }
    const dataSlot = parsedBody.data;
    const orarioSlot = parsedBody.orario;
    if (!dataSlot || !orarioSlot) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Data e orario sono obbligatori." }));
    }
    const eccezioni = db.eccezioni_calendario || [];
    const bloccato = eccezioni.find(
      (e) => e.data === dataSlot && (e.tipo === "chiusura_giornata" || e.tipo === "slot_bloccato" && e.orario === orarioSlot)
    );
    if (bloccato) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          error: `Lo slot non \xE8 prenotabile: ${bloccato.motivo || "Chiusura straordinaria o ferie del Lab."}`
        })
      );
    }
    db.prenotazioni_slot = db.prenotazioni_slot || [];
    const slotGiaOccupato = db.prenotazioni_slot.find(
      (p) => p.data === dataSlot && p.orario === orarioSlot && (p.stato === "confermata" || !p.stato || p.stato === "attiva")
    );
    if (slotGiaOccupato) {
      res.statusCode = 409;
      return res.end(
        JSON.stringify({
          error: `Lo slot del ${dataSlot} alle ${orarioSlot} \xE8 gi\xE0 stato prenotato da ${slotGiaOccupato.nome_cliente}. Capienza massima raggiunta per questa postazione.`
        })
      );
    }
    const walletOwner = getWalletOwner(atleta, db) || atleta;
    const isShared = walletOwner && walletOwner.id !== atleta.id;
    if (!isManager) {
      if ((walletOwner.crediti ?? 0) <= 0) {
        res.statusCode = 403;
        return res.end(
          JSON.stringify({
            error: isShared ? `Crediti esauriti sul borsellino condiviso (${walletOwner.nome} ${walletOwner.cognome}). Rinnova il pacchetto per procedere con la prenotazione.` : "Crediti esauriti o saldo a debito. Acquista un nuovo pacchetto lab per procedere con la prenotazione.",
            motivo: "crediti_insufficienti",
            crediti: walletOwner.crediti
          })
        );
      }
      if (walletOwner.data_scadenza_crediti) {
        const scadenza = new Date(walletOwner.data_scadenza_crediti);
        const dataPrenotazione = new Date(dataSlot);
        if (dataPrenotazione > scadenza) {
          res.statusCode = 403;
          return res.end(
            JSON.stringify({
              error: `Il pacchetto crediti \xE8 scaduto il ${walletOwner.data_scadenza_crediti}. Rinnova il pacchetto per prenotare questa data.`,
              motivo: "crediti_scaduti",
              scadenza: walletOwner.data_scadenza_crediti
            })
          );
        }
      }
      const anticipoOre = Number(
        atleta?.tempo_anticipo_prenotazione_ore ?? db.configurazione_lab?.tempo_anticipo_prenotazione_ore ?? 24
      );
      if (anticipoOre > 0) {
        const slotTs = (/* @__PURE__ */ new Date(`${dataSlot}T${orarioSlot}:00`)).getTime();
        const oreDiff = (slotTs - Date.now()) / (1e3 * 60 * 60);
        if (oreDiff < anticipoOre) {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({
              error: `Prenotazione non consentita: la policy richiede almeno ${anticipoOre} ore di preavviso prima dell'inizio dello slot.`,
              motivo: "anticipo_insufficiente",
              anticipo_ore: anticipoOre
            })
          );
        }
      }
    }
    walletOwner.crediti = Math.max(0, (walletOwner.crediti ?? 0) - 1);
    atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
    if (isShared) walletOwner.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
    const nuovaPrenotazione = {
      id: `bk-${Date.now()}`,
      data: dataSlot,
      orario: orarioSlot,
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
      telefono_cliente: atleta.telefono || "",
      stato: "confermata",
      credito_scalato: true,
      note: parsedBody.note || (isManager ? "Assegnazione diretta dal Coach" : ""),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.prenotazioni_slot.push(nuovaPrenotazione);
    addMovimentoCrediti(db, {
      atleta_id: walletOwner.id,
      email_cliente: walletOwner.email,
      nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
      tipo: "prenotazione_slot",
      delta_crediti: -1,
      saldo_risultante: walletOwner.crediti,
      motivazione: isShared ? `Prenotazione slot del ${dataSlot} ore ${orarioSlot} per ${atleta.nome} ${atleta.cognome} [Borsellino Condiviso]` : `Prenotazione slot del ${dataSlot} ore ${orarioSlot}`,
      operatore: isManager ? "coach" : "atleta"
    });
    saveData(db);
    await syncDataToGoogleDrive(db);
    if (isManager) {
      console.log(`[NOTIFICA AUTOMATICA EMAIL] A: ${atleta.email} - Conferma Prenotazione Area46: ${dataSlot} ore ${orarioSlot}`);
    }
    res.statusCode = 201;
    return res.end(
      JSON.stringify({
        ok: true,
        prenotazione: nuovaPrenotazione,
        crediti_rimanenti: walletOwner.crediti,
        messaggio: `Slot confermato per il ${dataSlot} alle ${orarioSlot}. Ti aspettiamo al Lab!`,
        notifica: {
          email_inviata: true,
          email_destinatario: atleta.email,
          nome_destinatario: nuovaPrenotazione.nome_cliente,
          telefono_destinatario: atleta.telefono || ""
        }
      })
    );
  }
  const bkDeleteMatch = pathname.match(/^\/app-api\/prenotazioni\/([a-zA-Z0-9_-]+)$/);
  if (bkDeleteMatch && method === "DELETE") {
    const bkId = bkDeleteMatch[1];
    const bk = (db.prenotazioni_slot || []).find((p) => p.id === bkId);
    if (!bk) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Prenotazione non trovata" }));
    }
    const isManager = currentUser.ruolo === "manager";
    const atleta = (db.profili_utenti || []).find(
      (p) => p.email === bk.email_cliente || p.id === bk.atleta_id
    );
    const walletOwner = atleta ? getWalletOwner(atleta, db) : null;
    const isShared = walletOwner && atleta && walletOwner.id !== atleta.id;
    const oreLimite = atleta?.tempo_cancellazione_ore || db.configurazione_lab?.tempo_cancellazione_ore || 24;
    const slotTimestamp = (/* @__PURE__ */ new Date(`${bk.data}T${bk.orario}:00`)).getTime();
    const nowTimestamp = Date.now();
    const orePreavviso = (slotTimestamp - nowTimestamp) / (1e3 * 60 * 60);
    let rimborsato = false;
    let statoFinale = "cancellata_tardiva";
    let messaggio = "";
    const prorogaRequested = url.searchParams.get("proroga") === "true" || url.searchParams.get("proroga") === "7" || parsedBody?.proroga === true || parsedBody?.proroga === "true";
    if (orePreavviso >= oreLimite || isManager) {
      rimborsato = true;
      statoFinale = "cancellata_in_tempo";
      if (bk.credito_scalato && atleta && walletOwner) {
        walletOwner.crediti = (walletOwner.crediti ?? 0) + 1;
        let prorogaMsg = "";
        if (isManager && prorogaRequested && walletOwner.data_scadenza_crediti) {
          const scadenzaDate = /* @__PURE__ */ new Date(walletOwner.data_scadenza_crediti + "T00:00:00");
          scadenzaDate.setDate(scadenzaDate.getDate() + 7);
          const y = scadenzaDate.getFullYear();
          const m = String(scadenzaDate.getMonth() + 1).padStart(2, "0");
          const d = String(scadenzaDate.getDate()).padStart(2, "0");
          walletOwner.data_scadenza_crediti = `${y}-${m}-${d}`;
          prorogaMsg = ` (Scadenza carnet prorogata al ${(/* @__PURE__ */ new Date(
            walletOwner.data_scadenza_crediti + "T00:00:00"
          )).toLocaleDateString("it-IT")})`;
        }
        addMovimentoCrediti(db, {
          atleta_id: walletOwner.id,
          email_cliente: walletOwner.email,
          nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
          tipo: "rimborso_cancellazione",
          delta_crediti: 1,
          saldo_risultante: walletOwner.crediti,
          motivazione: isManager ? prorogaRequested ? `Rimborso slot ${bk.data} ${bk.orario} per ${atleta.nome} ${atleta.cognome}${isShared ? " [Borsellino Condiviso]" : ""} [Con proroga scadenza carnet +7gg]` : `Ripristino credito per cancellazione/spostamento slot ${bk.data} ${bk.orario} per ${atleta.nome} ${atleta.cognome}${isShared ? " [Borsellino Condiviso]" : ""}` : `Rimborso per cancellazione in tempo slot del ${bk.data} ${bk.orario}${isShared ? " [Borsellino Condiviso]" : ""}`,
          operatore: isManager ? "coach" : "atleta"
        });
        messaggio = isManager ? prorogaRequested ? `Sessione annullata dal Coach. 1 credito riaccreditato e scadenza prorogata di 7 giorni.` : `Sessione annullata dal Coach. 1 credito riaccreditato per consentire lo spostamento dello slot.` : `Prenotazione annullata con successo. Preavviso rispettato (${Math.max(
          0,
          Math.round(orePreavviso)
        )}h rimaste su ${oreLimite}h richieste). 1 credito \xE8 stato rimborsato al tuo wallet.`;
      } else {
        messaggio = "Prenotazione annullata con successo.";
      }
    } else {
      rimborsato = false;
      statoFinale = "cancellata_tardiva";
      if (atleta && walletOwner) {
        addMovimentoCrediti(db, {
          atleta_id: walletOwner.id,
          email_cliente: walletOwner.email,
          nome_cliente: `${walletOwner.nome} ${walletOwner.cognome}`.trim(),
          tipo: "penalty",
          delta_crediti: 0,
          saldo_risultante: walletOwner.crediti,
          motivazione: `Cancellazione tardiva slot del ${bk.data} ${bk.orario} (preavviso < ${oreLimite}h: credito trattenuto)`,
          operatore: "sistema"
        });
      }
      messaggio = `Prenotazione annullata oltre il termine di tolleranza di ${oreLimite} ore (preavviso di sole ${Math.max(
        0,
        Math.round(orePreavviso)
      )}h). In accordo con il regolamento di Area46 Lab, il credito della seduta viene trattenuto.`;
    }
    db.prenotazioni_cancellate = db.prenotazioni_cancellate || [];
    if (!db.prenotazioni_cancellate.includes(bkId)) {
      db.prenotazioni_cancellate.push(bkId);
    }
    db.prenotazioni_slot = (db.prenotazioni_slot || []).filter((p) => p.id !== bkId);
    saveData(db);
    await syncDataToGoogleDrive(db);
    if (isManager) {
      console.log(
        `[NOTIFICA AUTOMATICA EMAIL] A: ${atleta?.email || bk.email_cliente} - Avviso Annullamento Seduta Area46: ${bk.data} alle ${bk.orario}`
      );
    }
    return res.end(
      JSON.stringify({
        ok: true,
        rimborsato,
        stato: statoFinale,
        ore_preavviso: Math.round(orePreavviso * 10) / 10,
        ore_limite: oreLimite,
        crediti_attuali: walletOwner ? walletOwner.crediti : atleta?.crediti,
        messaggio,
        notifica: {
          email_inviata: true,
          email_destinatario: atleta?.email || bk.email_cliente,
          nome_destinatario: bk.nome_cliente,
          telefono_destinatario: atleta?.telefono || bk.telefono_cliente || ""
        }
      })
    );
  }
  if (pathname === "/app-api/tariffario" && method === "GET") {
    return res.end(JSON.stringify(db.tariffario_pacchetti || []));
  }
  const tarPutMatch = pathname.match(/^\/app-api\/tariffario\/([a-zA-Z0-9_-]+)$/);
  if (tarPutMatch && method === "PUT") {
    const packId = tarPutMatch[1];
    const pack = (db.tariffario_pacchetti || []).find((p) => p.id === packId);
    if (!pack) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Pacchetto non trovato" }));
    }
    Object.assign(pack, parsedBody);
    saveData(db);
    return res.end(JSON.stringify(pack));
  }
  if (pathname === "/app-api/transazioni" && method === "GET") {
    const cancellate = db.transazioni_cancellate || [];
    const txs = (db.transazioni_pagamenti || []).filter(
      (t) => !cancellate.includes(t.id) && !cancellate.includes(t.codice_transazione) && !FICTITIOUS_TX_IDS.includes(t.id) && !FICTITIOUS_TX_IDS.includes(t.codice_transazione)
    );
    return res.end(JSON.stringify(txs));
  }
  if (pathname === "/app-api/config/stripe/test-connection" && method === "POST") {
    const secretKey = parsedBody.stripe_secret_key || req.headers["x-stripe-secret-key"] || db.configurazione_lab?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({ ok: false, error: "Nessuna Stripe Secret Key fornita per il test." })
      );
    }
    try {
      const stripeRes = await fetch("https://api.stripe.com/v1/balance", {
        headers: {
          Authorization: `Bearer ${secretKey.trim()}`
        }
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            ok: false,
            error: stripeData.error?.message || "Chiave segreta Stripe non valida o non autorizzata."
          })
        );
      }
      db.configurazione_lab = db.configurazione_lab || {};
      db.configurazione_lab.stripe_collegato = true;
      if (parsedBody.stripe_secret_key) {
        db.configurazione_lab.stripe_secret_key = parsedBody.stripe_secret_key.trim();
      } else if (secretKey) {
        db.configurazione_lab.stripe_secret_key = secretKey.trim();
      }
      if (parsedBody.stripe_publishable_key) {
        db.configurazione_lab.stripe_publishable_key = parsedBody.stripe_publishable_key.trim();
      }
      if (parsedBody.stripe_mode) {
        db.configurazione_lab.stripe_mode = parsedBody.stripe_mode;
      }
      saveData(db);
      syncConfigToGoogleDrive(db.configurazione_lab).catch(() => {
      });
      return res.end(
        JSON.stringify({
          ok: true,
          livemode: stripeData.livemode,
          message: `Connessione a Stripe riuscita! Modalit\xE0: ${stripeData.livemode ? "LIVE (Incassi Reali attivi)" : "TEST (Sandbox di prova)"}`
        })
      );
    } catch (err) {
      res.statusCode = 500;
      return res.end(
        JSON.stringify({
          ok: false,
          error: err.message || "Impossibile contattare i server di Stripe."
        })
      );
    }
  }
  if (pathname === "/app-api/pagamenti/stripe-checkout" && method === "POST") {
    const atletaId = parsedBody.atleta_id || currentUser.id;
    const atleta = (db.profili_utenti || []).find((p) => p.id === atletaId || p.email === atletaId) || currentUser;
    const packId = parsedBody.id_pacchetto;
    const pacchetto = (db.tariffario_pacchetti || []).find((p) => p.id === packId);
    if (!pacchetto) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Pacchetto selezionato non valido" }));
    }
    const secretKey = parsedBody.stripe_secret_key || req.headers["x-stripe-secret-key"] || db.configurazione_lab?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
    const origin = req.headers.origin || "http://localhost:5173";
    if (secretKey && secretKey.startsWith("sk_")) {
      if (!db.configurazione_lab?.stripe_secret_key) {
        db.configurazione_lab = db.configurazione_lab || {};
        db.configurazione_lab.stripe_secret_key = secretKey.trim();
        db.configurazione_lab.stripe_collegato = true;
        saveData(db);
      }
      try {
        const returnPath = parsedBody.return_url || "/account";
        const buildParams = (includePayPal) => {
          const p = new URLSearchParams();
          p.append("mode", "payment");
          p.append("payment_method_types[0]", "card");
          if (includePayPal) {
            p.append("payment_method_types[1]", "paypal");
          }
          p.append("line_items[0][price_data][currency]", "eur");
          p.append("line_items[0][price_data][unit_amount]", String(Math.round(pacchetto.prezzo_euro * 100)));
          p.append("line_items[0][price_data][product_data][name]", pacchetto.nome);
          p.append(
            "line_items[0][price_data][product_data][description]",
            pacchetto.descrizione || "Pacchetto ingressi Area46 Landmine Lab"
          );
          p.append("line_items[0][quantity]", "1");
          p.append("customer_email", atleta.email);
          p.append("client_reference_id", atleta.id);
          p.append("metadata[pack_id]", pacchetto.id);
          p.append("metadata[pack_nome]", pacchetto.nome);
          p.append("metadata[pack_crediti]", String(pacchetto.crediti));
          p.append("metadata[giorni_validita]", String(pacchetto.giorni_validita || 60));
          p.append("metadata[atleta_id]", atleta.id);
          p.append("metadata[atleta_email]", atleta.email);
          p.append("metadata[codice_fiscale]", parsedBody.codice_fiscale || atleta.codice_fiscale || "");
          p.append("metadata[indirizzo]", parsedBody.indirizzo || atleta.indirizzo || "");
          p.append(
            "success_url",
            `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}&success=true`
          );
          p.append("cancel_url", `${origin}${returnPath}?canceled=true`);
          return p;
        };
        const wantsPayPal = parsedBody.metodo === "paypal";
        let params = buildParams(wantsPayPal);
        let stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey.trim()}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        });
        let session = await stripeRes.json();
        if (!stripeRes.ok && wantsPayPal) {
          params = buildParams(false);
          stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey.trim()}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
          });
          session = await stripeRes.json();
        }
        if (!stripeRes.ok) {
          throw new Error(session.error?.message || "Errore nella creazione della sessione di pagamento Stripe");
        }
        return res.end(
          JSON.stringify({
            ok: true,
            checkout_url: session.url,
            session_id: session.id
          })
        );
      } catch (err) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ error: err.message || "Errore di connessione a Stripe" }));
      }
    }
    const currentCrediti = Number(atleta.crediti) || 0;
    const packCrediti = Number(pacchetto.crediti) || 0;
    let debitiDecurtati = 0;
    let creditiEffettivi = packCrediti;
    if (currentCrediti < 0) {
      debitiDecurtati = Math.abs(currentCrediti);
      creditiEffettivi = packCrediti - debitiDecurtati;
    }
    const txCode = `TX-DEMO-${Date.now().toString().slice(-6)}`;
    const nuovaTransazione = {
      codice_transazione: txCode,
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
      codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
      indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
      id_pacchetto: pacchetto.id,
      nome_pacchetto: pacchetto.nome,
      importo_euro: pacchetto.prezzo_euro,
      metodo: "carta",
      crediti_acquistati: packCrediti,
      debiti_decurtati: debitiDecurtati,
      crediti_effettivi_aggiunti: creditiEffettivi,
      causale_bonifico: null,
      stato: "completato",
      stato_fattura: "da_emettere",
      is_demo: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (currentCrediti < 0) {
      atleta.crediti = creditiEffettivi;
    } else {
      atleta.crediti = currentCrediti + packCrediti;
    }
    const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 864e5).toISOString().slice(0, 10);
    if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
      atleta.data_scadenza_crediti = nuovaScadenza;
    }
    atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
    addMovimentoCrediti(db, {
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: nuovaTransazione.nome_cliente,
      tipo: "acquisto_carnet",
      delta_crediti: creditiEffettivi,
      saldo_risultante: atleta.crediti,
      motivazione: `Acquisto ${pacchetto.nome}${debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""}`,
      operatore: "atleta"
    });
    db.transazioni_pagamenti = db.transazioni_pagamenti || [];
    db.transazioni_pagamenti.unshift(nuovaTransazione);
    saveData(db);
    res.statusCode = 201;
    return res.end(
      JSON.stringify({
        ok: true,
        demo_mode: true,
        transazione: nuovaTransazione,
        messaggio: "Pacchetto Lab acquistato in modalit\xE0 demo. Per incassare realmente sul tuo conto bancario inserisci le chiavi Stripe nel pannello Fisco.",
        crediti_attuali: atleta.crediti
      })
    );
  }
  if (pathname === "/app-api/pagamenti/stripe-verify" && method === "POST") {
    const sessionId = parsedBody.session_id;
    if (!sessionId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Session ID mancante" }));
    }
    const existingTx = (db.transazioni_pagamenti || []).find(
      (t) => t.codice_transazione === sessionId || t.stripe_session_id === sessionId
    );
    if (existingTx) {
      return res.end(
        JSON.stringify({
          ok: true,
          already_processed: true,
          transazione: existingTx,
          messaggio: "Pagamento gi\xE0 registrato con successo."
        })
      );
    }
    const secretKey = parsedBody.stripe_secret_key || req.headers["x-stripe-secret-key"] || db.configurazione_lab?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Stripe non configurato" }));
    }
    if (secretKey && secretKey.startsWith("sk_") && !db.configurazione_lab?.stripe_secret_key) {
      db.configurazione_lab = db.configurazione_lab || {};
      db.configurazione_lab.stripe_secret_key = secretKey.trim();
      db.configurazione_lab.stripe_collegato = true;
      saveData(db);
    }
    try {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${secretKey.trim()}` }
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        throw new Error(session.error?.message || "Sessione non valida");
      }
      if (session.payment_status !== "paid") {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ error: `Stato pagamento non completato: ${session.payment_status}` })
        );
      }
      const meta = session.metadata || {};
      const packId = meta.pack_id;
      const atletaEmail = meta.atleta_email || session.customer_email;
      const pacchetto = (db.tariffario_pacchetti || []).find((p) => p.id === packId) || {
        id: packId,
        nome: meta.pack_nome || "Pacchetto Lab",
        crediti: Number(meta.pack_crediti) || 10,
        prezzo_euro: (session.amount_total || 0) / 100,
        giorni_validita: Number(meta.giorni_validita) || 60
      };
      const atleta = (db.profili_utenti || []).find(
        (p) => p.email === atletaEmail || p.id === meta.atleta_id
      ) || currentUser;
      const currentCrediti = Number(atleta.crediti) || 0;
      const packCrediti = Number(pacchetto.crediti) || 0;
      let debitiDecurtati = 0;
      let creditiEffettivi = packCrediti;
      if (currentCrediti < 0) {
        debitiDecurtati = Math.abs(currentCrediti);
        creditiEffettivi = packCrediti - debitiDecurtati;
      }
      const nuovaTransazione = {
        codice_transazione: `TX-ST-${Date.now().toString().slice(-6)}`,
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
        codice_fiscale: meta.codice_fiscale || atleta.codice_fiscale || "",
        indirizzo: meta.indirizzo || atleta.indirizzo || "",
        id_pacchetto: pacchetto.id,
        nome_pacchetto: pacchetto.nome,
        importo_euro: (session.amount_total || 0) / 100,
        metodo: "stripe_card",
        crediti_acquistati: packCrediti,
        debiti_decurtati: debitiDecurtati,
        crediti_effettivi_aggiunti: creditiEffettivi,
        causale_bonifico: null,
        stato: "completato",
        stato_fattura: "da_emettere",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (currentCrediti < 0) {
        atleta.crediti = creditiEffettivi;
      } else {
        atleta.crediti = currentCrediti + packCrediti;
      }
      const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 864e5).toISOString().slice(0, 10);
      if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
        atleta.data_scadenza_crediti = nuovaScadenza;
      }
      atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      addMovimentoCrediti(db, {
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: nuovaTransazione.nome_cliente,
        tipo: "acquisto_carnet",
        delta_crediti: creditiEffettivi,
        saldo_risultante: atleta.crediti,
        motivazione: `Acquisto Stripe ${pacchetto.nome}${debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""}`,
        operatore: "stripe"
      });
      db.transazioni_pagamenti = db.transazioni_pagamenti || [];
      db.transazioni_pagamenti.unshift(nuovaTransazione);
      saveData(db);
      return res.end(
        JSON.stringify({
          ok: true,
          verified: true,
          transazione: nuovaTransazione,
          crediti_attuali: atleta.crediti,
          messaggio: "Pagamento Stripe confermato con successo! Crediti accreditati nel wallet."
        })
      );
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message || "Errore verifica sessione Stripe" }));
    }
  }
  if ((pathname === "/app-api/pagamenti/stripe-webhook" || pathname === "/app-api/stripe-webhook" || pathname === "/api/stripe-webhook") && method === "POST") {
    const event = parsedBody;
    const sigHeader = req.headers["stripe-signature"] || "";
    const webhookSecret = db.configurazione_lab?.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && sigHeader && rawBody) {
      try {
        const parts = sigHeader.split(",").reduce((acc, part) => {
          const [k, v] = part.split("=");
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {});
        if (parts.t && parts.v1) {
          const expectedSig = crypto8.createHmac("sha256", webhookSecret.trim()).update(`${parts.t}.${rawBody}`).digest("hex");
          if (parts.v1 !== expectedSig) {
            console.warn("[Stripe Webhook] Firma HMAC non valida.");
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: "Firma webhook non valida" }));
          }
        }
      } catch (sigErr) {
        console.error("[Stripe Webhook] Errore verifica firma:", sigErr);
      }
    }
    if (event?.type === "checkout.session.completed") {
      const session = event.data?.object;
      if (session && session.id) {
        const existingTx = (db.transazioni_pagamenti || []).find(
          (t) => t.codice_transazione === session.id || t.stripe_session_id === session.id
        );
        if (!existingTx && session.payment_status === "paid") {
          const meta = session.metadata || {};
          const packId = meta.pack_id;
          const atletaEmail = meta.atleta_email || session.customer_email;
          const pacchetto = (db.tariffario_pacchetti || []).find((p) => p.id === packId) || {
            id: packId,
            nome: meta.pack_nome || "Pacchetto Lab",
            crediti: Number(meta.pack_crediti) || 10,
            prezzo_euro: (session.amount_total || 0) / 100,
            giorni_validita: Number(meta.giorni_validita) || 60
          };
          const atleta = (db.profili_utenti || []).find(
            (p) => p.email === atletaEmail || p.id === meta.atleta_id
          ) || currentUser;
          const currentCrediti = Number(atleta.crediti) || 0;
          const packCrediti = Number(pacchetto.crediti) || 0;
          let debitiDecurtati = 0;
          let creditiEffettivi = packCrediti;
          if (currentCrediti < 0) {
            debitiDecurtati = Math.abs(currentCrediti);
            creditiEffettivi = packCrediti - debitiDecurtati;
          }
          const nuovaTransazione = {
            codice_transazione: `TX-ST-${Date.now().toString().slice(-6)}`,
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
            atleta_id: atleta.id,
            email_cliente: atleta.email,
            nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
            codice_fiscale: meta.codice_fiscale || atleta.codice_fiscale || "",
            indirizzo: meta.indirizzo || atleta.indirizzo || "",
            id_pacchetto: pacchetto.id,
            nome_pacchetto: pacchetto.nome,
            importo_euro: (session.amount_total || 0) / 100,
            metodo: "stripe_card",
            crediti_acquistati: packCrediti,
            debiti_decurtati: debitiDecurtati,
            crediti_effettivi_aggiunti: creditiEffettivi,
            causale_bonifico: null,
            stato: "completato",
            stato_fattura: "da_emettere",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (currentCrediti < 0) {
            atleta.crediti = creditiEffettivi;
          } else {
            atleta.crediti = currentCrediti + packCrediti;
          }
          const nuovaScadenza = new Date(Date.now() + (pacchetto.giorni_validita || 60) * 864e5).toISOString().slice(0, 10);
          if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
            atleta.data_scadenza_crediti = nuovaScadenza;
          }
          atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
          addMovimentoCrediti(db, {
            atleta_id: atleta.id,
            email_cliente: atleta.email,
            nome_cliente: nuovaTransazione.nome_cliente,
            tipo: "acquisto_carnet",
            delta_crediti: creditiEffettivi,
            saldo_risultante: atleta.crediti,
            motivazione: `Webhook Stripe ${pacchetto.nome}${debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""}`,
            operatore: "stripe_webhook"
          });
          db.transazioni_pagamenti = db.transazioni_pagamenti || [];
          db.transazioni_pagamenti.unshift(nuovaTransazione);
          saveData(db);
        }
      }
    }
    return res.end(JSON.stringify({ received: true }));
  }
  if (pathname === "/app-api/transazioni/manuale" && method === "POST") {
    const atletaId = parsedBody.atleta_id || parsedBody.email_cliente;
    if (!atletaId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Atleta obbligatorio" }));
    }
    const atleta = (db.profili_utenti || []).find(
      (p) => p.id === atletaId || p.email?.toLowerCase() === String(atletaId).toLowerCase()
    );
    if (!atleta) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Atleta non trovato in anagrafica" }));
    }
    const importoEuro = Number(parsedBody.importo_euro);
    if (isNaN(importoEuro) || importoEuro <= 0) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({ error: "Importo non valido (deve essere un valore numerico maggiore di zero)" })
      );
    }
    const metodo = (parsedBody.metodo || "bonifico").toLowerCase();
    const packId = parsedBody.id_pacchetto || "manuale";
    const pacchettoTrovato = (db.tariffario_pacchetti || []).find((p) => p.id === packId);
    const nomePacchetto = parsedBody.nome_pacchetto || parsedBody.descrizione || pacchettoTrovato?.nome || (metodo === "bonifico" ? "Bonifico Bancario" : "Versamento Manuale");
    const creditiDaAccreditare = Number(parsedBody.crediti_da_accreditare) || 0;
    const dataPagamento = parsedBody.data_pagamento ? new Date(parsedBody.data_pagamento).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const txCode = `TX-MAN-46-${Date.now().toString().slice(-6)}`;
    const causaleBonifico = parsedBody.causale_bonifico || (metodo === "bonifico" ? `AREA46-${(atleta.cognome || "ATLETA").toUpperCase()}-${txCode.slice(-4)}` : null);
    const walletOwner = getWalletOwner(atleta, db) || atleta;
    const nuovaTransazione = {
      id: `tx-man-${Date.now()}`,
      codice_transazione: txCode,
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
      codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
      indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
      id_pacchetto: packId,
      nome_pacchetto: nomePacchetto,
      importo_euro: importoEuro,
      metodo,
      crediti_acquistati: creditiDaAccreditare,
      debiti_decurtati: 0,
      crediti_effettivi_aggiunti: creditiDaAccreditare,
      causale_bonifico: causaleBonifico,
      stato: "completato",
      stato_fattura: "da_emettere",
      created_at: dataPagamento,
      note: parsedBody.note || "",
      inserito_da: "coach_manuale"
    };
    if (creditiDaAccreditare > 0) {
      const currentCrediti = Number(walletOwner.crediti) || 0;
      walletOwner.crediti = currentCrediti + creditiDaAccreditare;
      if (parsedBody.data_scadenza_crediti) {
        walletOwner.data_scadenza_crediti = parsedBody.data_scadenza_crediti;
      } else if (parsedBody.giorni_validita || pacchettoTrovato?.giorni_validita) {
        const days = Number(parsedBody.giorni_validita || pacchettoTrovato?.giorni_validita);
        const nuovaScadenza = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
        if (!walletOwner.data_scadenza_crediti || nuovaScadenza > walletOwner.data_scadenza_crediti) {
          walletOwner.data_scadenza_crediti = nuovaScadenza;
        }
      }
      walletOwner.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      addMovimentoCrediti(db, {
        atleta_id: walletOwner.id,
        email_cliente: walletOwner.email,
        nome_cliente: `${walletOwner.nome || ""} ${walletOwner.cognome || ""}`.trim() || walletOwner.name || "Atleta",
        tipo: "versamento_manuale",
        delta_crediti: creditiDaAccreditare,
        saldo_risultante: walletOwner.crediti,
        motivazione: `Versamento manuale ${nomePacchetto} (\u20AC ${importoEuro.toFixed(2)}) registrato dal Coach`,
        operatore: "coach"
      });
    }
    db.transazioni_pagamenti = db.transazioni_pagamenti || [];
    if (db.transazioni_cancellate && Array.isArray(db.transazioni_cancellate)) {
      db.transazioni_cancellate = db.transazioni_cancellate.filter(
        (c) => c !== nuovaTransazione.id && c !== nuovaTransazione.codice_transazione
      );
    }
    db.transazioni_pagamenti.unshift(nuovaTransazione);
    saveData(db);
    syncDataToGoogleDrive(db).catch(() => {
    });
    res.statusCode = 201;
    return res.end(
      JSON.stringify({
        ok: true,
        transazione: nuovaTransazione,
        crediti_attuali: walletOwner.crediti,
        data_scadenza_crediti: walletOwner.data_scadenza_crediti,
        messaggio: `Versamento di \u20AC ${importoEuro.toFixed(2)} per ${nuovaTransazione.nome_cliente} registrato con successo nel Registro Fisco.`
      })
    );
  }
  if (pathname === "/app-api/transazioni/checkout" && method === "POST") {
    const atletaId = parsedBody.atleta_id || currentUser.id;
    const atleta = (db.profili_utenti || []).find((p) => p.id === atletaId || p.email === atletaId) || currentUser;
    const packId = parsedBody.id_pacchetto;
    const pacchetto = (db.tariffario_pacchetti || []).find((p) => p.id === packId);
    if (!pacchetto) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Pacchetto selezionato non valido" }));
    }
    const metodo = parsedBody.metodo || "carta";
    const currentCrediti = Number(atleta.crediti) || 0;
    const packCrediti = Number(pacchetto.crediti) || 0;
    let debitiDecurtati = 0;
    let creditiEffettivi = packCrediti;
    if (currentCrediti < 0) {
      debitiDecurtati = Math.abs(currentCrediti);
      creditiEffettivi = packCrediti - debitiDecurtati;
    }
    const isBonifico = metodo === "bonifico";
    const txCode = `TX-46-${Date.now().toString().slice(-6)}`;
    const causaleBonifico = `AREA46-${(atleta.cognome || "ATLETA").toUpperCase()}-${pacchetto.id.toUpperCase()}-${txCode.slice(-4)}`;
    const nuovaTransazione = {
      codice_transazione: txCode,
      atleta_id: atleta.id,
      email_cliente: atleta.email,
      nome_cliente: `${atleta.nome || ""} ${atleta.cognome || ""}`.trim() || atleta.name || "Atleta",
      codice_fiscale: parsedBody.codice_fiscale || atleta.codice_fiscale || "",
      indirizzo: parsedBody.indirizzo || atleta.indirizzo || "",
      id_pacchetto: pacchetto.id,
      nome_pacchetto: pacchetto.nome,
      importo_euro: pacchetto.prezzo_euro,
      metodo,
      crediti_acquistati: packCrediti,
      debiti_decurtati: debitiDecurtati,
      crediti_effettivi_aggiunti: creditiEffettivi,
      causale_bonifico: isBonifico ? causaleBonifico : null,
      stato: isBonifico ? "in_attesa_bonifico" : "completato",
      stato_fattura: "da_emettere",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!isBonifico) {
      if (currentCrediti < 0) {
        atleta.crediti = creditiEffettivi;
      } else {
        atleta.crediti = currentCrediti + packCrediti;
      }
      const nuovaScadenza = new Date(Date.now() + pacchetto.giorni_validita * 864e5).toISOString().slice(0, 10);
      if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
        atleta.data_scadenza_crediti = nuovaScadenza;
      }
      atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      addMovimentoCrediti(db, {
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: nuovaTransazione.nome_cliente,
        tipo: "acquisto_carnet",
        delta_crediti: creditiEffettivi,
        saldo_risultante: atleta.crediti,
        motivazione: `Acquisto ${pacchetto.nome}${debitiDecurtati > 0 ? ` (sanati ${debitiDecurtati} crediti di debito)` : ""}`,
        operatore: "atleta"
      });
    }
    db.transazioni_pagamenti = db.transazioni_pagamenti || [];
    db.transazioni_pagamenti.unshift(nuovaTransazione);
    saveData(db);
    res.statusCode = 201;
    return res.end(
      JSON.stringify({
        ok: true,
        transazione: nuovaTransazione,
        crediti_attuali: atleta.crediti,
        data_scadenza_crediti: atleta.data_scadenza_crediti,
        debiti_estinti: debitiDecurtati,
        ricevuta: {
          titolo: "RICEVUTA DI PAGAMENTO \u2014 AREA46 TRAINING LAB",
          codice: txCode,
          cliente: nuovaTransazione.nome_cliente,
          codice_fiscale: nuovaTransazione.codice_fiscale,
          importo: `${pacchetto.prezzo_euro} \u20AC`,
          descrizione: pacchetto.nome,
          metodo: metodo.toUpperCase(),
          data: (/* @__PURE__ */ new Date()).toLocaleDateString("it-IT")
        }
      })
    );
  }
  const bonificoMatch = pathname.match(
    /^\/app-api\/transazioni\/([a-zA-Z0-9_-]+)\/approva-bonifico$/
  );
  if (bonificoMatch && method === "POST") {
    const txCode = bonificoMatch[1];
    const tx = (db.transazioni_pagamenti || []).find((t) => t.codice_transazione === txCode);
    if (!tx) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Transazione non trovata" }));
    }
    if (tx.stato === "completato") {
      return res.end(
        JSON.stringify({ ok: true, messaggio: "Bonifico gi\xE0 approvato precedentemente.", tx })
      );
    }
    const atleta = (db.profili_utenti || []).find(
      (p) => p.id === tx.atleta_id || p.email === tx.email_cliente
    );
    if (atleta) {
      const currentCrediti = Number(atleta.crediti) || 0;
      if (currentCrediti < 0) {
        atleta.crediti = tx.crediti_effettivi_aggiunti;
      } else {
        atleta.crediti = currentCrediti + tx.crediti_acquistati;
      }
      const pack = (db.tariffario_pacchetti || []).find((p) => p.id === tx.id_pacchetto);
      const giorni = pack?.giorni_validita || 60;
      const nuovaScadenza = new Date(Date.now() + giorni * 864e5).toISOString().slice(0, 10);
      if (!atleta.data_scadenza_crediti || nuovaScadenza > atleta.data_scadenza_crediti) {
        atleta.data_scadenza_crediti = nuovaScadenza;
      }
      atleta.data_ultimo_accesso = (/* @__PURE__ */ new Date()).toISOString();
      addMovimentoCrediti(db, {
        atleta_id: atleta.id,
        email_cliente: atleta.email,
        nome_cliente: `${atleta.nome} ${atleta.cognome}`,
        tipo: "acquisto_carnet",
        delta_crediti: tx.crediti_effettivi_aggiunti,
        saldo_risultante: atleta.crediti,
        motivazione: `Bonifico confermato per ${tx.nome_pacchetto}`,
        operatore: "coach"
      });
    }
    tx.stato = "completato";
    tx.approvato_il = (/* @__PURE__ */ new Date()).toISOString();
    saveData(db);
    return res.end(JSON.stringify({ ok: true, tx, crediti_atleta: atleta?.crediti }));
  }
  const txDeleteMatch = pathname.match(/^\/app-api\/transazioni\/([a-zA-Z0-9_@.-]+)$/);
  if (txDeleteMatch && method === "DELETE") {
    const targetParam = decodeURIComponent(txDeleteMatch[1]);
    const initialCount = (db.transazioni_pagamenti || []).length;
    db.transazioni_cancellate = db.transazioni_cancellate || [];
    if (!db.transazioni_cancellate.includes(targetParam)) {
      db.transazioni_cancellate.push(targetParam);
    }
    db.transazioni_pagamenti = (db.transazioni_pagamenti || []).filter((t) => {
      return t.id !== targetParam && t.codice_transazione !== targetParam;
    });
    saveData(db);
    syncDataToGoogleDrive(db).catch(() => {
    });
    return res.end(
      JSON.stringify({
        success: true,
        deletedCount: initialCount - (db.transazioni_pagamenti || []).length,
        message: "Movimento fiscale eliminato con successo. Registro incassi ricalcolato."
      })
    );
  }
  if (pathname === "/app-api/transazioni/svuota-tutto" && method === "POST") {
    const allCodes = (db.transazioni_pagamenti || []).map((t) => t.codice_transazione || t.id);
    db.transazioni_cancellate = Array.from(
      /* @__PURE__ */ new Set([...db.transazioni_cancellate || [], ...allCodes, ...FICTITIOUS_TX_IDS])
    );
    db.transazioni_pagamenti = [];
    saveData(db);
    syncDataToGoogleDrive(db).catch(() => {
    });
    return res.end(
      JSON.stringify({
        success: true,
        message: "Tutti i movimenti fiscali sono stati eliminati permanentemente."
      })
    );
  }
  if (pathname === "/app-api/transazioni/export-invoicebuddy" && method === "GET") {
    const transazioni = (db.transazioni_pagamenti || []).map((t) => ({
      codice: t.codice_transazione,
      data: t.created_at?.slice(0, 10),
      cliente: t.nome_cliente,
      codice_fiscale: t.codice_fiscale || "N/D",
      indirizzo: t.indirizzo || "Firenze",
      descrizione: `${t.nome_pacchetto} (${t.crediti_acquistati} crediti Lab)`,
      importo_netto: Number(t.importo_euro || 0).toFixed(2),
      regime_fiscale: "Forfettario (art. 1, commi 54-89, L. 190/2014)",
      metodo_pagamento: t.metodo,
      stato: t.stato,
      stringa_copia_rapida: `${t.created_at?.slice(0, 10) || ""} | ${t.nome_cliente} | CF: ${t.codice_fiscale || "N/D"} | ${t.nome_pacchetto} | \u20AC ${t.importo_euro}`
    }));
    return res.end(JSON.stringify(transazioni));
  }
  if (pathname === "/app-api/livelli" && method === "GET") {
    const livelli = db.livelli || [];
    return res.end(JSON.stringify(livelli));
  }
  if (pathname === "/app-api/allenamenti" && method === "GET") {
    const livello = url.searchParams.get("livello");
    let all = db.allenamenti.filter(
      (a) => a.giorno !== null && (a.nome_esercizio && a.nome_esercizio.trim() !== "" || a.id_esercizio && a.id_esercizio.trim() !== "")
    );
    if (livello) {
      all = all.filter((a) => a.livello === livello);
    }
    const map2 = /* @__PURE__ */ new Map();
    for (const row of all) {
      const numMatch = String(row.giorno).match(/[0-9]+/);
      const giorno_num = numMatch ? parseInt(numMatch[0], 10) : 1;
      const key = `${row.livello ?? ""}-${row.settimana ?? ""}-${giorno_num}`;
      if (!map2.has(key)) {
        map2.set(key, {
          livello: row.livello,
          giorno: row.giorno,
          settimana: row.settimana || "Ciclo unico",
          giorno_num
        });
      }
    }
    const result = Array.from(map2.values()).sort((a, b) => {
      if (a.livello !== b.livello) return a.livello.localeCompare(b.livello);
      if (a.settimana !== b.settimana) return a.settimana.localeCompare(b.settimana);
      return a.giorno_num - b.giorno_num;
    });
    return res.end(JSON.stringify(result));
  }
  if (pathname === "/app-api/approfondimenti" && method === "GET") {
    const rows = db.allenamenti.filter((a) => a.livello === "Approfondimenti ed extra").map((a) => ({
      nome_esercizio: a.nome_esercizio,
      note_tecniche: a.note_tecniche,
      link_video: a.link_video,
      data_pubblicazione: a.data_pubblicazione
    })).sort((a, b) => a.data_pubblicazione > b.data_pubblicazione ? -1 : 1);
    return res.end(JSON.stringify(rows));
  }
  const giornoMatch = pathname.match(/^\/app-api\/allenamenti\/([^/]+)\/([^/]+)$/);
  if (giornoMatch && method === "GET") {
    const livello = decodeURIComponent(giornoMatch[1]);
    const giornoInt = parseInt(giornoMatch[2], 10);
    const rows = db.allenamenti.filter((a) => {
      if (a.livello !== livello) return false;
      const m = String(a.giorno).match(/[0-9]+/);
      return m && parseInt(m[0], 10) === giornoInt;
    }).map((a) => {
      const ex = db.database_esercizi.find((d) => d.id_esercizio === a.id_esercizio);
      return {
        ...a,
        link_video: ex?.link_video ?? a.link_video,
        target: ex?.target ?? null,
        attrezzatura: ex?.attrezzatura ?? null,
        livello_catalogo: ex?.livello ?? null,
        note_catalogo: ex?.note_tecniche ?? null
      };
    }).sort((a, b) => (a.sequenza ?? "").localeCompare(b.sequenza ?? ""));
    return res.end(JSON.stringify(rows));
  }
  const esMatch = pathname.match(/^\/app-api\/esercizi\/([^/]+)$/);
  if (esMatch && method === "GET") {
    const id = decodeURIComponent(esMatch[1]);
    const ex = db.database_esercizi.find((d) => d.id_esercizio === id);
    if (!ex) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Esercizio non trovato" }));
    }
    return res.end(JSON.stringify(ex));
  }
  if (pathname === "/app-api/libreria/attrezzi" && method === "GET") {
    const attrezzi = /* @__PURE__ */ new Set();
    for (const ex of db.database_esercizi) {
      if (ex.attrezzatura) {
        for (const item of ex.attrezzatura.split(",")) {
          const trimmed = item.trim();
          if (trimmed) attrezzi.add(trimmed);
        }
      }
    }
    return res.end(JSON.stringify(Array.from(attrezzi).sort()));
  }
  if (pathname === "/app-api/libreria" && method === "GET") {
    const search = url.searchParams.get("search")?.toLowerCase() || "";
    const target = url.searchParams.get("target") || "";
    const attrezzo = url.searchParams.get("attrezzo") || "";
    const livello = url.searchParams.get("livello") || "";
    let filtered = db.database_esercizi.filter((ex) => {
      if (search && !ex.nome_esercizio?.toLowerCase().includes(search)) return false;
      if (target && ex.target !== target) return false;
      if (attrezzo && !ex.attrezzatura?.toLowerCase().includes(attrezzo.toLowerCase()))
        return false;
      if (livello && ex.livello !== livello) return false;
      return true;
    });
    filtered.sort(
      (a, b) => (a.nome_esercizio ?? "").localeCompare(b.nome_esercizio ?? "")
    );
    return res.end(JSON.stringify(filtered));
  }
  if (pathname === "/app-api/stati" && method === "GET") {
    const rows = db.stato_allenamenti.filter((s) => s.email_cliente === currentUser.email);
    return res.end(JSON.stringify(rows));
  }
  const diarioCountMatch = pathname.match(/^\/app-api\/diario\/conteggio\/([^/]+)\/([^/]+)$/);
  if (diarioCountMatch && method === "GET") {
    const livello = decodeURIComponent(diarioCountMatch[1]);
    const giornoInt = parseInt(diarioCountMatch[2], 10);
    const eserciziGiorno = db.allenamenti.filter((a) => {
      if (a.livello !== livello) return false;
      const m = String(a.giorno).match(/[0-9]+/);
      return m && parseInt(m[0], 10) === giornoInt;
    }).map((a) => a.id_esercizio);
    const count = db.diario_utente.filter(
      (d) => d.email_cliente === currentUser.email && eserciziGiorno.includes(d.id_esercizio)
    ).length;
    return res.end(JSON.stringify({ count }));
  }
  if (pathname === "/app-api/stati/reset" && method === "POST") {
    const { livello, giorno } = parsedBody;
    const giornoInt = parseInt(String(giorno), 10);
    const eserciziGiorno = db.allenamenti.filter((a) => {
      if (a.livello !== livello) return false;
      const m = String(a.giorno).match(/[0-9]+/);
      return m && parseInt(m[0], 10) === giornoInt;
    }).map((a) => a.id_esercizio);
    const initialCount = db.diario_utente.length;
    db.diario_utente = db.diario_utente.filter(
      (d) => !(d.email_cliente === currentUser.email && eserciziGiorno.includes(d.id_esercizio))
    );
    const eliminati = initialCount - db.diario_utente.length;
    const existing = db.stato_allenamenti.find(
      (s) => s.email_cliente === currentUser.email && s.livello === livello && s.giorno === giornoInt
    );
    if (existing) {
      existing.stato = "non_iniziato";
      existing.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      db.stato_allenamenti.push({
        email_cliente: currentUser.email,
        livello,
        giorno: giornoInt,
        stato: "non_iniziato",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    saveData(db);
    return res.end(JSON.stringify({ ok: true, eliminati }));
  }
  if (pathname === "/app-api/stati" && method === "POST") {
    const { livello, giorno, stato } = parsedBody;
    const existing = db.stato_allenamenti.find(
      (s) => s.email_cliente === currentUser.email && s.livello === livello && s.giorno === Number(giorno)
    );
    if (existing) {
      existing.stato = stato;
      existing.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      db.stato_allenamenti.push({
        email_cliente: currentUser.email,
        livello,
        giorno: Number(giorno),
        stato,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    saveData(db);
    return res.end(JSON.stringify({ ok: true }));
  }
  if (pathname === "/app-api/diario" && method === "GET") {
    const targetEmail = url.searchParams.get("email");
    const filterEmail = targetEmail || (currentUser.ruolo === "manager" ? null : currentUser.email);
    const rows = [...db.diario_utente].filter((d) => !filterEmail || d.email_cliente === filterEmail).sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());
    return res.end(JSON.stringify(rows));
  }
  const diarioExMatch = pathname.match(/^\/app-api\/diario\/esercizio\/([^/]+)$/);
  if (diarioExMatch && method === "GET") {
    const idEsercizio = decodeURIComponent(diarioExMatch[1]);
    const targetEmail = url.searchParams.get("email");
    const filterEmail = targetEmail || (currentUser.ruolo === "manager" ? null : currentUser.email);
    const rows = [...db.diario_utente].filter(
      (d) => (!filterEmail || d.email_cliente === filterEmail) && d.id_esercizio === idEsercizio
    ).sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());
    return res.end(JSON.stringify(rows));
  }
  if (pathname === "/app-api/diario" && method === "POST") {
    const newEntry = {
      id: Date.now(),
      email_cliente: currentUser.email,
      id_esercizio: parsedBody.id_esercizio,
      nome_esercizio: parsedBody.nome_esercizio,
      carico_kg: parsedBody.sets_json ? null : parsedBody.carico_kg ?? null,
      feedback: parsedBody.feedback ?? null,
      ripetizioni: parsedBody.sets_json ? null : parsedBody.ripetizioni ?? null,
      serie: parsedBody.sets_json ? null : parsedBody.serie ?? null,
      sets_json: parsedBody.sets_json ?? null,
      rpe_json: parsedBody.rpe_json ?? null,
      data_ora: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.diario_utente.push(newEntry);
    saveData(db);
    res.statusCode = 201;
    return res.end(JSON.stringify(newEntry));
  }
  const diarioPatchMatch = pathname.match(/^\/app-api\/diario\/(\d+)$/);
  if (diarioPatchMatch && method === "PATCH") {
    const id = parseInt(diarioPatchMatch[1], 10);
    const entry = db.diario_utente.find((d) => d.id === id);
    if (!entry) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "Not found" }));
    }
    entry.sets_json = parsedBody.sets_json ?? entry.sets_json;
    entry.feedback = parsedBody.feedback ?? entry.feedback;
    if (parsedBody.sets_json) {
      entry.rpe_json = parsedBody.sets_json.map((s) => s.rpe ?? null);
    }
    saveData(db);
    return res.end(JSON.stringify(entry));
  }
  const diarioDeleteMatch = pathname.match(/^\/app-api\/diario\/(\d+)$/);
  if (diarioDeleteMatch && method === "DELETE") {
    const id = parseInt(diarioDeleteMatch[1], 10);
    db.diario_utente = db.diario_utente.filter((d) => d.id !== id);
    saveData(db);
    return res.end(JSON.stringify({ ok: true }));
  }
  if (pathname === "/app-api/preferenze" && method === "GET") {
    const pref = db.preferenze_utente.find((p) => p.email_cliente === currentUser.email);
    return res.end(JSON.stringify({ memoria_livello: pref?.memoria_livello ?? null }));
  }
  if (pathname === "/app-api/preferenze/livello" && method === "POST") {
    const existing = db.preferenze_utente.find((p) => p.email_cliente === currentUser.email);
    if (existing) {
      existing.memoria_livello = parsedBody.livello ?? null;
      existing.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      db.preferenze_utente.push({
        email_cliente: currentUser.email,
        memoria_livello: parsedBody.livello ?? null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    saveData(db);
    return res.end(JSON.stringify({ ok: true }));
  }
  if (pathname === "/app-api/tonnellaggio" && method === "GET") {
    const rows = db.diario_utente.filter((d) => d.email_cliente === currentUser.email).map((d) => {
      let tonnellaggio_voce = 0;
      if (d.sets_json && Array.isArray(d.sets_json)) {
        tonnellaggio_voce = d.sets_json.reduce((acc, s) => {
          const kg = Number(s.carico_kg) || 0;
          const reps = Number(s.ripetizioni) || 0;
          return acc + kg * reps;
        }, 0);
      } else if (d.carico_kg != null && d.ripetizioni != null && d.serie != null) {
        tonnellaggio_voce = Number(d.carico_kg) * Number(d.ripetizioni) * Number(d.serie);
      }
      return {
        id: d.id,
        data_ora: d.data_ora,
        nome_esercizio: d.nome_esercizio,
        carico_kg: d.carico_kg,
        ripetizioni: d.ripetizioni,
        serie: d.serie,
        sets_json: d.sets_json,
        tonnellaggio_voce
      };
    }).sort((a, b) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());
    return res.end(JSON.stringify(rows));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Endpoint demo non trovato" }));
}

// api-src/index.ts
async function handler(req, res) {
  try {
    await handleLocalApi(req, res);
  } catch (err) {
    console.error("Unhandled API error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Internal Server Error",
          message: err?.message || String(err)
        })
      );
    }
  }
}
export {
  handler as default
};
