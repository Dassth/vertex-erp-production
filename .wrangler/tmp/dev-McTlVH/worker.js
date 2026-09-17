var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// node-built-in-modules:events
import libDefault from "events";
var require_events = __commonJS({
  "node-built-in-modules:events"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault;
  }
});

// node_modules/postgres-array/index.js
var require_postgres_array = __commonJS({
  "node_modules/postgres-array/index.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    exports.parse = function(source, transform) {
      return new ArrayParser(source, transform).parse();
    };
    var ArrayParser = class _ArrayParser {
      static {
        __name(this, "ArrayParser");
      }
      constructor(source, transform) {
        this.source = source;
        this.transform = transform || identity;
        this.position = 0;
        this.entries = [];
        this.recorded = [];
        this.dimension = 0;
      }
      isEof() {
        return this.position >= this.source.length;
      }
      nextCharacter() {
        var character = this.source[this.position++];
        if (character === "\\") {
          return {
            value: this.source[this.position++],
            escaped: true
          };
        }
        return {
          value: character,
          escaped: false
        };
      }
      record(character) {
        this.recorded.push(character);
      }
      newEntry(includeEmpty) {
        var entry;
        if (this.recorded.length > 0 || includeEmpty) {
          entry = this.recorded.join("");
          if (entry === "NULL" && !includeEmpty) {
            entry = null;
          }
          if (entry !== null) entry = this.transform(entry);
          this.entries.push(entry);
          this.recorded = [];
        }
      }
      consumeDimensions() {
        if (this.source[0] === "[") {
          while (!this.isEof()) {
            var char = this.nextCharacter();
            if (char.value === "=") break;
          }
        }
      }
      parse(nested) {
        var character, parser, quote;
        this.consumeDimensions();
        while (!this.isEof()) {
          character = this.nextCharacter();
          if (character.value === "{" && !quote) {
            this.dimension++;
            if (this.dimension > 1) {
              parser = new _ArrayParser(this.source.substr(this.position - 1), this.transform);
              this.entries.push(parser.parse(true));
              this.position += parser.position - 2;
            }
          } else if (character.value === "}" && !quote) {
            this.dimension--;
            if (!this.dimension) {
              this.newEntry();
              if (nested) return this.entries;
            }
          } else if (character.value === '"' && !character.escaped) {
            if (quote) this.newEntry(true);
            quote = !quote;
          } else if (character.value === "," && !quote) {
            this.newEntry();
          } else {
            this.record(character.value);
          }
        }
        if (this.dimension !== 0) {
          throw new Error("array dimension not balanced");
        }
        return this.entries;
      }
    };
    function identity(value) {
      return value;
    }
    __name(identity, "identity");
  }
});

// node_modules/pg-types/lib/arrayParser.js
var require_arrayParser = __commonJS({
  "node_modules/pg-types/lib/arrayParser.js"(exports, module) {
    init_modules_watch_stub();
    var array = require_postgres_array();
    module.exports = {
      create: /* @__PURE__ */ __name(function(source, transform) {
        return {
          parse: /* @__PURE__ */ __name(function() {
            return array.parse(source, transform);
          }, "parse")
        };
      }, "create")
    };
  }
});

// node_modules/postgres-date/index.js
var require_postgres_date = __commonJS({
  "node_modules/postgres-date/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
    var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
    var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
    var INFINITY = /^-?infinity$/;
    module.exports = /* @__PURE__ */ __name(function parseDate2(isoDate) {
      if (INFINITY.test(isoDate)) {
        return Number(isoDate.replace("i", "I"));
      }
      var matches = DATE_TIME.exec(isoDate);
      if (!matches) {
        return getDate(isoDate) || null;
      }
      var isBC = !!matches[8];
      var year = parseInt(matches[1], 10);
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var hour = parseInt(matches[4], 10);
      var minute = parseInt(matches[5], 10);
      var second = parseInt(matches[6], 10);
      var ms = matches[7];
      ms = ms ? 1e3 * parseFloat(ms) : 0;
      var date;
      var offset = timeZoneOffset(isoDate);
      if (offset != null) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        if (is0To99(year)) {
          date.setUTCFullYear(year);
        }
        if (offset !== 0) {
          date.setTime(date.getTime() - offset);
        }
      } else {
        date = new Date(year, month, day, hour, minute, second, ms);
        if (is0To99(year)) {
          date.setFullYear(year);
        }
      }
      return date;
    }, "parseDate");
    function getDate(isoDate) {
      var matches = DATE.exec(isoDate);
      if (!matches) {
        return;
      }
      var year = parseInt(matches[1], 10);
      var isBC = !!matches[4];
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var date = new Date(year, month, day);
      if (is0To99(year)) {
        date.setFullYear(year);
      }
      return date;
    }
    __name(getDate, "getDate");
    function timeZoneOffset(isoDate) {
      if (isoDate.endsWith("+00")) {
        return 0;
      }
      var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
      if (!zone) return;
      var type = zone[1];
      if (type === "Z") {
        return 0;
      }
      var sign = type === "-" ? -1 : 1;
      var offset = parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10);
      return offset * sign * 1e3;
    }
    __name(timeZoneOffset, "timeZoneOffset");
    function bcYearToNegativeYear(year) {
      return -(year - 1);
    }
    __name(bcYearToNegativeYear, "bcYearToNegativeYear");
    function is0To99(num2) {
      return num2 >= 0 && num2 < 100;
    }
    __name(is0To99, "is0To99");
  }
});

// node_modules/xtend/mutable.js
var require_mutable = __commonJS({
  "node_modules/xtend/mutable.js"(exports, module) {
    init_modules_watch_stub();
    module.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
    __name(extend, "extend");
  }
});

// node_modules/postgres-interval/index.js
var require_postgres_interval = __commonJS({
  "node_modules/postgres-interval/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var extend = require_mutable();
    module.exports = PostgresInterval;
    function PostgresInterval(raw) {
      if (!(this instanceof PostgresInterval)) {
        return new PostgresInterval(raw);
      }
      extend(this, parse(raw));
    }
    __name(PostgresInterval, "PostgresInterval");
    var properties = ["seconds", "minutes", "hours", "days", "months", "years"];
    PostgresInterval.prototype.toPostgres = function() {
      var filtered = properties.filter(this.hasOwnProperty, this);
      if (this.milliseconds && filtered.indexOf("seconds") < 0) {
        filtered.push("seconds");
      }
      if (filtered.length === 0) return "0";
      return filtered.map(function(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
        }
        return value + " " + property;
      }, this).join(" ");
    };
    var propertiesISOEquivalent = {
      years: "Y",
      months: "M",
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    };
    var dateProperties = ["years", "months", "days"];
    var timeProperties = ["hours", "minutes", "seconds"];
    PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
      var datePart = dateProperties.map(buildProperty, this).join("");
      var timePart = timeProperties.map(buildProperty, this).join("");
      return "P" + datePart + "T" + timePart;
      function buildProperty(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
        }
        return value + propertiesISOEquivalent[property];
      }
      __name(buildProperty, "buildProperty");
    };
    var NUMBER = "([+-]?\\d+)";
    var YEAR = NUMBER + "\\s+years?";
    var MONTH = NUMBER + "\\s+mons?";
    var DAY = NUMBER + "\\s+days?";
    var TIME = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?";
    var INTERVAL = new RegExp([YEAR, MONTH, DAY, TIME].map(function(regexString) {
      return "(" + regexString + ")?";
    }).join("\\s*"));
    var positions = {
      years: 2,
      months: 4,
      days: 6,
      hours: 9,
      minutes: 10,
      seconds: 11,
      milliseconds: 12
    };
    var negatives = ["hours", "minutes", "seconds", "milliseconds"];
    function parseMilliseconds(fraction) {
      var microseconds = fraction + "000000".slice(fraction.length);
      return parseInt(microseconds, 10) / 1e3;
    }
    __name(parseMilliseconds, "parseMilliseconds");
    function parse(interval) {
      if (!interval) return {};
      var matches = INTERVAL.exec(interval);
      var isNegative = matches[8] === "-";
      return Object.keys(positions).reduce(function(parsed, property) {
        var position = positions[property];
        var value = matches[position];
        if (!value) return parsed;
        value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
        if (!value) return parsed;
        if (isNegative && ~negatives.indexOf(property)) {
          value *= -1;
        }
        parsed[property] = value;
        return parsed;
      }, {});
    }
    __name(parse, "parse");
  }
});

// node_modules/postgres-bytea/index.js
var require_postgres_bytea = __commonJS({
  "node_modules/postgres-bytea/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var bufferFrom = Buffer.from || Buffer;
    module.exports = /* @__PURE__ */ __name(function parseBytea(input) {
      if (/^\\x/.test(input)) {
        return bufferFrom(input.substr(2), "hex");
      }
      var output = "";
      var i = 0;
      while (i < input.length) {
        if (input[i] !== "\\") {
          output += input[i];
          ++i;
        } else {
          if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
            output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
            i += 4;
          } else {
            var backslashes = 1;
            while (i + backslashes < input.length && input[i + backslashes] === "\\") {
              backslashes++;
            }
            for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
              output += "\\";
            }
            i += Math.floor(backslashes / 2) * 2;
          }
        }
      }
      return bufferFrom(output, "binary");
    }, "parseBytea");
  }
});

// node_modules/pg-types/lib/textParsers.js
var require_textParsers = __commonJS({
  "node_modules/pg-types/lib/textParsers.js"(exports, module) {
    init_modules_watch_stub();
    var array = require_postgres_array();
    var arrayParser = require_arrayParser();
    var parseDate2 = require_postgres_date();
    var parseInterval = require_postgres_interval();
    var parseByteA = require_postgres_bytea();
    function allowNull(fn) {
      return /* @__PURE__ */ __name(function nullAllowed(value) {
        if (value === null) return value;
        return fn(value);
      }, "nullAllowed");
    }
    __name(allowNull, "allowNull");
    function parseBool(value) {
      if (value === null) return value;
      return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
    }
    __name(parseBool, "parseBool");
    function parseBoolArray(value) {
      if (!value) return null;
      return array.parse(value, parseBool);
    }
    __name(parseBoolArray, "parseBoolArray");
    function parseBaseTenInt(string) {
      return parseInt(string, 10);
    }
    __name(parseBaseTenInt, "parseBaseTenInt");
    function parseIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(parseBaseTenInt));
    }
    __name(parseIntegerArray, "parseIntegerArray");
    function parseBigIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(function(entry) {
        return parseBigInteger(entry).trim();
      }));
    }
    __name(parseBigIntegerArray, "parseBigIntegerArray");
    var parsePointArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parsePoint(entry);
        }
        return entry;
      });
      return p.parse();
    }, "parsePointArray");
    var parseFloatArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseFloat(entry);
        }
        return entry;
      });
      return p.parse();
    }, "parseFloatArray");
    var parseStringArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value);
      return p.parse();
    }, "parseStringArray");
    var parseDateArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseDate2(entry);
        }
        return entry;
      });
      return p.parse();
    }, "parseDateArray");
    var parseIntervalArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseInterval(entry);
        }
        return entry;
      });
      return p.parse();
    }, "parseIntervalArray");
    var parseByteAArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(parseByteA));
    }, "parseByteAArray");
    var parseInteger = /* @__PURE__ */ __name(function(value) {
      return parseInt(value, 10);
    }, "parseInteger");
    var parseBigInteger = /* @__PURE__ */ __name(function(value) {
      var valStr = String(value);
      if (/^\d+$/.test(valStr)) {
        return valStr;
      }
      return value;
    }, "parseBigInteger");
    var parseJsonArray = /* @__PURE__ */ __name(function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(JSON.parse));
    }, "parseJsonArray");
    var parsePoint = /* @__PURE__ */ __name(function(value) {
      if (value[0] !== "(") {
        return null;
      }
      value = value.substring(1, value.length - 1).split(",");
      return {
        x: parseFloat(value[0]),
        y: parseFloat(value[1])
      };
    }, "parsePoint");
    var parseCircle = /* @__PURE__ */ __name(function(value) {
      if (value[0] !== "<" && value[1] !== "(") {
        return null;
      }
      var point = "(";
      var radius = "";
      var pointParsed = false;
      for (var i = 2; i < value.length - 1; i++) {
        if (!pointParsed) {
          point += value[i];
        }
        if (value[i] === ")") {
          pointParsed = true;
          continue;
        } else if (!pointParsed) {
          continue;
        }
        if (value[i] === ",") {
          continue;
        }
        radius += value[i];
      }
      var result = parsePoint(point);
      result.radius = parseFloat(radius);
      return result;
    }, "parseCircle");
    var init = /* @__PURE__ */ __name(function(register) {
      register(20, parseBigInteger);
      register(21, parseInteger);
      register(23, parseInteger);
      register(26, parseInteger);
      register(700, parseFloat);
      register(701, parseFloat);
      register(16, parseBool);
      register(1082, parseDate2);
      register(1114, parseDate2);
      register(1184, parseDate2);
      register(600, parsePoint);
      register(651, parseStringArray);
      register(718, parseCircle);
      register(1e3, parseBoolArray);
      register(1001, parseByteAArray);
      register(1005, parseIntegerArray);
      register(1007, parseIntegerArray);
      register(1028, parseIntegerArray);
      register(1016, parseBigIntegerArray);
      register(1017, parsePointArray);
      register(1021, parseFloatArray);
      register(1022, parseFloatArray);
      register(1231, parseFloatArray);
      register(1014, parseStringArray);
      register(1015, parseStringArray);
      register(1008, parseStringArray);
      register(1009, parseStringArray);
      register(1040, parseStringArray);
      register(1041, parseStringArray);
      register(1115, parseDateArray);
      register(1182, parseDateArray);
      register(1185, parseDateArray);
      register(1186, parseInterval);
      register(1187, parseIntervalArray);
      register(17, parseByteA);
      register(114, JSON.parse.bind(JSON));
      register(3802, JSON.parse.bind(JSON));
      register(199, parseJsonArray);
      register(3807, parseJsonArray);
      register(3907, parseStringArray);
      register(2951, parseStringArray);
      register(791, parseStringArray);
      register(1183, parseStringArray);
      register(1270, parseStringArray);
    }, "init");
    module.exports = {
      init
    };
  }
});

// node_modules/pg-int8/index.js
var require_pg_int8 = __commonJS({
  "node_modules/pg-int8/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var BASE = 1e6;
    function readInt8(buffer) {
      var high = buffer.readInt32BE(0);
      var low = buffer.readUInt32BE(4);
      var sign = "";
      if (high < 0) {
        high = ~high + (low === 0);
        low = ~low + 1 >>> 0;
        sign = "-";
      }
      var result = "";
      var carry;
      var t;
      var digits;
      var pad;
      var l;
      var i;
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        t = 4294967296 * carry + low;
        digits = "" + t % BASE;
        return sign + digits + result;
      }
    }
    __name(readInt8, "readInt8");
    module.exports = readInt8;
  }
});

// node_modules/pg-types/lib/binaryParsers.js
var require_binaryParsers = __commonJS({
  "node_modules/pg-types/lib/binaryParsers.js"(exports, module) {
    init_modules_watch_stub();
    var parseInt64 = require_pg_int8();
    var parseBits = /* @__PURE__ */ __name(function(data, bits, offset, invert, callback) {
      offset = offset || 0;
      invert = invert || false;
      callback = callback || function(lastValue, newValue, bits2) {
        return lastValue * Math.pow(2, bits2) + newValue;
      };
      var offsetBytes = offset >> 3;
      var inv = /* @__PURE__ */ __name(function(value) {
        if (invert) {
          return ~value & 255;
        }
        return value;
      }, "inv");
      var mask = 255;
      var firstBits = 8 - offset % 8;
      if (bits < firstBits) {
        mask = 255 << 8 - bits & 255;
        firstBits = bits;
      }
      if (offset) {
        mask = mask >> offset % 8;
      }
      var result = 0;
      if (offset % 8 + bits >= 8) {
        result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
      }
      var bytes2 = bits + offset >> 3;
      for (var i = offsetBytes + 1; i < bytes2; i++) {
        result = callback(result, inv(data[i]), 8);
      }
      var lastBits = (bits + offset) % 8;
      if (lastBits > 0) {
        result = callback(result, inv(data[bytes2]) >> 8 - lastBits, lastBits);
      }
      return result;
    }, "parseBits");
    var parseFloatFromBits = /* @__PURE__ */ __name(function(data, precisionBits, exponentBits) {
      var bias = Math.pow(2, exponentBits - 1) - 1;
      var sign = parseBits(data, 1);
      var exponent = parseBits(data, exponentBits, 1);
      if (exponent === 0) {
        return 0;
      }
      var precisionBitsCounter = 1;
      var parsePrecisionBits = /* @__PURE__ */ __name(function(lastValue, newValue, bits) {
        if (lastValue === 0) {
          lastValue = 1;
        }
        for (var i = 1; i <= bits; i++) {
          precisionBitsCounter /= 2;
          if ((newValue & 1 << bits - i) > 0) {
            lastValue += precisionBitsCounter;
          }
        }
        return lastValue;
      }, "parsePrecisionBits");
      var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
      if (exponent == Math.pow(2, exponentBits + 1) - 1) {
        if (mantissa === 0) {
          return sign === 0 ? Infinity : -Infinity;
        }
        return NaN;
      }
      return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
    }, "parseFloatFromBits");
    var parseInt16 = /* @__PURE__ */ __name(function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 15, 1, true) + 1);
      }
      return parseBits(value, 15, 1);
    }, "parseInt16");
    var parseInt32 = /* @__PURE__ */ __name(function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 31, 1, true) + 1);
      }
      return parseBits(value, 31, 1);
    }, "parseInt32");
    var parseFloat32 = /* @__PURE__ */ __name(function(value) {
      return parseFloatFromBits(value, 23, 8);
    }, "parseFloat32");
    var parseFloat64 = /* @__PURE__ */ __name(function(value) {
      return parseFloatFromBits(value, 52, 11);
    }, "parseFloat64");
    var parseNumeric = /* @__PURE__ */ __name(function(value) {
      var sign = parseBits(value, 16, 32);
      if (sign == 49152) {
        return NaN;
      }
      var weight = Math.pow(1e4, parseBits(value, 16, 16));
      var result = 0;
      var digits = [];
      var ndigits = parseBits(value, 16);
      for (var i = 0; i < ndigits; i++) {
        result += parseBits(value, 16, 64 + 16 * i) * weight;
        weight /= 1e4;
      }
      var scale = Math.pow(10, parseBits(value, 16, 48));
      return (sign === 0 ? 1 : -1) * Math.round(result * scale) / scale;
    }, "parseNumeric");
    var parseDate2 = /* @__PURE__ */ __name(function(isUTC, value) {
      var sign = parseBits(value, 1);
      var rawValue = parseBits(value, 63, 1);
      var result = new Date((sign === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
      if (!isUTC) {
        result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
      }
      result.usec = rawValue % 1e3;
      result.getMicroSeconds = function() {
        return this.usec;
      };
      result.setMicroSeconds = function(value2) {
        this.usec = value2;
      };
      result.getUTCMicroSeconds = function() {
        return this.usec;
      };
      return result;
    }, "parseDate");
    var parseArray = /* @__PURE__ */ __name(function(value) {
      var dim = parseBits(value, 32);
      var flags = parseBits(value, 32, 32);
      var elementType = parseBits(value, 32, 64);
      var offset = 96;
      var dims = [];
      for (var i = 0; i < dim; i++) {
        dims[i] = parseBits(value, 32, offset);
        offset += 32;
        offset += 32;
      }
      var parseElement = /* @__PURE__ */ __name(function(elementType2) {
        var length = parseBits(value, 32, offset);
        offset += 32;
        if (length == 4294967295) {
          return null;
        }
        var result;
        if (elementType2 == 23 || elementType2 == 20) {
          result = parseBits(value, length * 8, offset);
          offset += length * 8;
          return result;
        } else if (elementType2 == 25) {
          result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
          return result;
        } else {
          console.log("ERROR: ElementType not implemented: " + elementType2);
        }
      }, "parseElement");
      var parse = /* @__PURE__ */ __name(function(dimension, elementType2) {
        var array = [];
        var i2;
        if (dimension.length > 1) {
          var count = dimension.shift();
          for (i2 = 0; i2 < count; i2++) {
            array[i2] = parse(dimension, elementType2);
          }
          dimension.unshift(count);
        } else {
          for (i2 = 0; i2 < dimension[0]; i2++) {
            array[i2] = parseElement(elementType2);
          }
        }
        return array;
      }, "parse");
      return parse(dims, elementType);
    }, "parseArray");
    var parseText = /* @__PURE__ */ __name(function(value) {
      return value.toString("utf8");
    }, "parseText");
    var parseBool = /* @__PURE__ */ __name(function(value) {
      if (value === null) return null;
      return parseBits(value, 8) > 0;
    }, "parseBool");
    var init = /* @__PURE__ */ __name(function(register) {
      register(20, parseInt64);
      register(21, parseInt16);
      register(23, parseInt32);
      register(26, parseInt32);
      register(1700, parseNumeric);
      register(700, parseFloat32);
      register(701, parseFloat64);
      register(16, parseBool);
      register(1114, parseDate2.bind(null, false));
      register(1184, parseDate2.bind(null, true));
      register(1e3, parseArray);
      register(1007, parseArray);
      register(1016, parseArray);
      register(1008, parseArray);
      register(1009, parseArray);
      register(25, parseText);
    }, "init");
    module.exports = {
      init
    };
  }
});

// node_modules/pg-types/lib/builtins.js
var require_builtins = __commonJS({
  "node_modules/pg-types/lib/builtins.js"(exports, module) {
    init_modules_watch_stub();
    module.exports = {
      BOOL: 16,
      BYTEA: 17,
      CHAR: 18,
      INT8: 20,
      INT2: 21,
      INT4: 23,
      REGPROC: 24,
      TEXT: 25,
      OID: 26,
      TID: 27,
      XID: 28,
      CID: 29,
      JSON: 114,
      XML: 142,
      PG_NODE_TREE: 194,
      SMGR: 210,
      PATH: 602,
      POLYGON: 604,
      CIDR: 650,
      FLOAT4: 700,
      FLOAT8: 701,
      ABSTIME: 702,
      RELTIME: 703,
      TINTERVAL: 704,
      CIRCLE: 718,
      MACADDR8: 774,
      MONEY: 790,
      MACADDR: 829,
      INET: 869,
      ACLITEM: 1033,
      BPCHAR: 1042,
      VARCHAR: 1043,
      DATE: 1082,
      TIME: 1083,
      TIMESTAMP: 1114,
      TIMESTAMPTZ: 1184,
      INTERVAL: 1186,
      TIMETZ: 1266,
      BIT: 1560,
      VARBIT: 1562,
      NUMERIC: 1700,
      REFCURSOR: 1790,
      REGPROCEDURE: 2202,
      REGOPER: 2203,
      REGOPERATOR: 2204,
      REGCLASS: 2205,
      REGTYPE: 2206,
      UUID: 2950,
      TXID_SNAPSHOT: 2970,
      PG_LSN: 3220,
      PG_NDISTINCT: 3361,
      PG_DEPENDENCIES: 3402,
      TSVECTOR: 3614,
      TSQUERY: 3615,
      GTSVECTOR: 3642,
      REGCONFIG: 3734,
      REGDICTIONARY: 3769,
      JSONB: 3802,
      REGNAMESPACE: 4089,
      REGROLE: 4096
    };
  }
});

// node_modules/pg-types/index.js
var require_pg_types = __commonJS({
  "node_modules/pg-types/index.js"(exports) {
    init_modules_watch_stub();
    var textParsers = require_textParsers();
    var binaryParsers = require_binaryParsers();
    var arrayParser = require_arrayParser();
    var builtinTypes = require_builtins();
    exports.getTypeParser = getTypeParser;
    exports.setTypeParser = setTypeParser;
    exports.arrayParser = arrayParser;
    exports.builtins = builtinTypes;
    var typeParsers = {
      text: {},
      binary: {}
    };
    function noParse(val) {
      return String(val);
    }
    __name(noParse, "noParse");
    function getTypeParser(oid, format2) {
      format2 = format2 || "text";
      if (!typeParsers[format2]) {
        return noParse;
      }
      return typeParsers[format2][oid] || noParse;
    }
    __name(getTypeParser, "getTypeParser");
    function setTypeParser(oid, format2, parseFn) {
      if (typeof format2 == "function") {
        parseFn = format2;
        format2 = "text";
      }
      typeParsers[format2][oid] = parseFn;
    }
    __name(setTypeParser, "setTypeParser");
    textParsers.init(function(oid, converter) {
      typeParsers.text[oid] = converter;
    });
    binaryParsers.init(function(oid, converter) {
      typeParsers.binary[oid] = converter;
    });
  }
});

// node_modules/pg/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/pg/lib/defaults.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var user;
    try {
      user = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
    } catch {
    }
    module.exports = {
      // database host. defaults to localhost
      host: "localhost",
      // database user's name
      user,
      // name of database to connect
      database: void 0,
      // database user's password
      password: null,
      // a Postgres connection string to be used instead of setting individual connection items
      // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
      // in the defaults object.
      connectionString: void 0,
      // database port
      port: 5432,
      // number of rows to return at a time from a prepared statement's
      // portal. 0 will return all rows at once
      rows: 0,
      // binary result mode
      binary: false,
      // Connection pool options - see https://github.com/brianc/node-pg-pool
      // number of connections to use in connection pool
      // 0 will disable connection pooling
      max: 10,
      // max milliseconds a client can go unused before it is removed
      // from the pool and destroyed
      idleTimeoutMillis: 3e4,
      client_encoding: "",
      ssl: false,
      // SSL negotiation style: 'postgres' (traditional SSLRequest) or 'direct'
      sslnegotiation: void 0,
      application_name: void 0,
      fallback_application_name: void 0,
      options: void 0,
      parseInputDatesAsUTC: false,
      // max milliseconds any query using this connection will execute for before timing out in error.
      // false=unlimited
      statement_timeout: false,
      // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
      // false=unlimited
      lock_timeout: false,
      // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
      // false=unlimited
      idle_in_transaction_session_timeout: false,
      // max milliseconds to wait for query to complete (client side)
      query_timeout: false,
      connect_timeout: 0,
      keepalives: 1,
      keepalives_idle: 0
    };
    var pgTypes = require_pg_types();
    var parseBigInteger = pgTypes.getTypeParser(20, "text");
    var parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
    module.exports.__defineSetter__("parseInt8", function(val) {
      pgTypes.setTypeParser(20, "text", val ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
      pgTypes.setTypeParser(1016, "text", val ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
    });
  }
});

// node-built-in-modules:util/types
import libDefault2 from "util/types";
var require_types = __commonJS({
  "node-built-in-modules:util/types"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault2;
  }
});

// node_modules/pg/lib/utils.js
var require_utils = __commonJS({
  "node_modules/pg/lib/utils.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var defaults2 = require_defaults();
    var { isDate: isDate2 } = require_types();
    function escapeElement(elementRepresentation) {
      const escaped = elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return '"' + escaped + '"';
    }
    __name(escapeElement, "escapeElement");
    function arrayString(val) {
      let result = "{";
      for (let i = 0; i < val.length; i++) {
        if (i > 0) {
          result += ",";
        }
        let item = val[i];
        if (item == null) {
          result += "NULL";
        } else if (Array.isArray(item)) {
          result += arrayString(item);
        } else if (ArrayBuffer.isView(item)) {
          if (!(item instanceof Buffer)) {
            item = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
          }
          result += "\\\\x" + item.toString("hex");
        } else {
          result += escapeElement(prepareValue(item));
        }
      }
      result += "}";
      return result;
    }
    __name(arrayString, "arrayString");
    var prepareValue = /* @__PURE__ */ __name(function(val, seen) {
      if (val == null) {
        return null;
      }
      if (typeof val === "object") {
        if (val instanceof Buffer) {
          return val;
        }
        if (ArrayBuffer.isView(val)) {
          return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
        }
        if (isDate2(val)) {
          if (defaults2.parseInputDatesAsUTC) {
            return dateToStringUTC(val);
          } else {
            return dateToString(val);
          }
        }
        if (Array.isArray(val)) {
          return arrayString(val);
        }
        return prepareObject(val, seen);
      }
      return val.toString();
    }, "prepareValue");
    function prepareObject(val, seen) {
      if (val && typeof val.toPostgres === "function") {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error('circular reference detected while preparing "' + val + '" for query');
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    }
    __name(prepareObject, "prepareObject");
    function dateToString(date) {
      let offset = -date.getTimezoneOffset();
      let year = date.getFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":" + String(date.getSeconds()).padStart(2, "0") + "." + String(date.getMilliseconds()).padStart(3, "0");
      if (offset < 0) {
        ret += "-";
        offset *= -1;
      } else {
        ret += "+";
      }
      ret += String(Math.floor(offset / 60)).padStart(2, "0") + ":" + String(offset % 60).padStart(2, "0");
      if (isBCYear) ret += " BC";
      return ret;
    }
    __name(dateToString, "dateToString");
    function dateToStringUTC(date) {
      let year = date.getUTCFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0") + "T" + String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0") + ":" + String(date.getUTCSeconds()).padStart(2, "0") + "." + String(date.getUTCMilliseconds()).padStart(3, "0");
      ret += "+00:00";
      if (isBCYear) ret += " BC";
      return ret;
    }
    __name(dateToStringUTC, "dateToStringUTC");
    function normalizeQueryConfig(config, values, callback) {
      config = typeof config === "string" ? { text: config } : config;
      if (values) {
        if (typeof values === "function") {
          config.callback = values;
        } else {
          config.values = values;
        }
      }
      if (callback) {
        config.callback = callback;
      }
      return config;
    }
    __name(normalizeQueryConfig, "normalizeQueryConfig");
    var escapeIdentifier2 = /* @__PURE__ */ __name(function(str) {
      return '"' + str.replace(/"/g, '""') + '"';
    }, "escapeIdentifier");
    var escapeLiteral2 = /* @__PURE__ */ __name(function(str) {
      let hasBackslash = false;
      let escaped = "'";
      if (str == null) {
        return "''";
      }
      if (typeof str !== "string") {
        return "''";
      }
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === "\\") {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = " E" + escaped;
      }
      return escaped;
    }, "escapeLiteral");
    module.exports = {
      prepareValue: /* @__PURE__ */ __name(function prepareValueWrapper(value) {
        return prepareValue(value);
      }, "prepareValueWrapper"),
      normalizeQueryConfig,
      escapeIdentifier: escapeIdentifier2,
      escapeLiteral: escapeLiteral2
    };
  }
});

// node-built-in-modules:util
import libDefault3 from "util";
var require_util = __commonJS({
  "node-built-in-modules:util"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault3;
  }
});

// node-built-in-modules:crypto
import libDefault4 from "crypto";
var require_crypto = __commonJS({
  "node-built-in-modules:crypto"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault4;
  }
});

// node_modules/pg/lib/crypto/utils.js
var require_utils2 = __commonJS({
  "node_modules/pg/lib/crypto/utils.js"(exports, module) {
    init_modules_watch_stub();
    var nodeCrypto = require_crypto();
    module.exports = {
      postgresMd5PasswordHash,
      randomBytes: randomBytes3,
      deriveKey,
      sha256: sha2562,
      hashByName,
      hmacSha256,
      md5
    };
    var webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
    var subtleCrypto = webCrypto.subtle;
    var textEncoder = new TextEncoder();
    function randomBytes3(length) {
      return webCrypto.getRandomValues(Buffer.alloc(length));
    }
    __name(randomBytes3, "randomBytes");
    async function md5(string) {
      try {
        return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
      } catch (e) {
        const data = typeof string === "string" ? textEncoder.encode(string) : string;
        const hash = await subtleCrypto.digest("MD5", data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    __name(md5, "md5");
    async function postgresMd5PasswordHash(user, password, salt) {
      const inner = await md5(password + user);
      const outer = await md5(Buffer.concat([Buffer.from(inner), salt]));
      return "md5" + outer;
    }
    __name(postgresMd5PasswordHash, "postgresMd5PasswordHash");
    async function sha2562(text) {
      return await subtleCrypto.digest("SHA-256", text);
    }
    __name(sha2562, "sha256");
    async function hashByName(hashName, text) {
      return await subtleCrypto.digest(hashName, text);
    }
    __name(hashByName, "hashByName");
    async function hmacSha256(keyBuffer, msg) {
      const key = await subtleCrypto.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return await subtleCrypto.sign("HMAC", key, textEncoder.encode(msg));
    }
    __name(hmacSha256, "hmacSha256");
    async function deriveKey(password, salt, iterations) {
      const key = await subtleCrypto.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const params = { name: "PBKDF2", hash: "SHA-256", salt, iterations };
      return await subtleCrypto.deriveBits(params, key, 32 * 8, ["deriveBits"]);
    }
    __name(deriveKey, "deriveKey");
  }
});

// node_modules/pg/lib/crypto/cert-signatures.js
var require_cert_signatures = __commonJS({
  "node_modules/pg/lib/crypto/cert-signatures.js"(exports, module) {
    init_modules_watch_stub();
    function x509Error(msg, cert) {
      return new Error("SASL channel binding: " + msg + " when parsing public certificate " + cert.toString("base64"));
    }
    __name(x509Error, "x509Error");
    function readASN1Length(data, index) {
      let length = data[index++];
      if (length < 128) return { length, index };
      const lengthBytes = length & 127;
      if (lengthBytes > 4) throw x509Error("bad length", data);
      length = 0;
      for (let i = 0; i < lengthBytes; i++) {
        length = length << 8 | data[index++];
      }
      return { length, index };
    }
    __name(readASN1Length, "readASN1Length");
    function readASN1OID(data, index) {
      if (data[index++] !== 6) throw x509Error("non-OID data", data);
      const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index);
      index = indexAfterOIDLength;
      const lastIndex = index + OIDLength;
      const byte1 = data[index++];
      let oid = (byte1 / 40 >> 0) + "." + byte1 % 40;
      while (index < lastIndex) {
        let value = 0;
        while (index < lastIndex) {
          const nextByte = data[index++];
          value = value << 7 | nextByte & 127;
          if (nextByte < 128) break;
        }
        oid += "." + value;
      }
      return { oid, index };
    }
    __name(readASN1OID, "readASN1OID");
    function expectASN1Seq(data, index) {
      if (data[index++] !== 48) throw x509Error("non-sequence data", data);
      return readASN1Length(data, index);
    }
    __name(expectASN1Seq, "expectASN1Seq");
    function signatureAlgorithmHashFromCertificate(data, index) {
      if (index === void 0) index = 0;
      index = expectASN1Seq(data, index).index;
      const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index);
      index = indexAfterCertInfoLength + certInfoLength;
      index = expectASN1Seq(data, index).index;
      const { oid, index: indexAfterOID } = readASN1OID(data, index);
      switch (oid) {
        // RSA
        case "1.2.840.113549.1.1.4":
          return "MD5";
        case "1.2.840.113549.1.1.5":
          return "SHA-1";
        case "1.2.840.113549.1.1.11":
          return "SHA-256";
        case "1.2.840.113549.1.1.12":
          return "SHA-384";
        case "1.2.840.113549.1.1.13":
          return "SHA-512";
        case "1.2.840.113549.1.1.14":
          return "SHA-224";
        case "1.2.840.113549.1.1.15":
          return "SHA512-224";
        case "1.2.840.113549.1.1.16":
          return "SHA512-256";
        // ECDSA
        case "1.2.840.10045.4.1":
          return "SHA-1";
        case "1.2.840.10045.4.3.1":
          return "SHA-224";
        case "1.2.840.10045.4.3.2":
          return "SHA-256";
        case "1.2.840.10045.4.3.3":
          return "SHA-384";
        case "1.2.840.10045.4.3.4":
          return "SHA-512";
        // RSASSA-PSS: hash is indicated separately
        case "1.2.840.113549.1.1.10": {
          index = indexAfterOID;
          index = expectASN1Seq(data, index).index;
          if (data[index++] !== 160) throw x509Error("non-tag data", data);
          index = readASN1Length(data, index).index;
          index = expectASN1Seq(data, index).index;
          const { oid: hashOID } = readASN1OID(data, index);
          switch (hashOID) {
            // standalone hash OIDs
            case "1.2.840.113549.2.5":
              return "MD5";
            case "1.3.14.3.2.26":
              return "SHA-1";
            case "2.16.840.1.101.3.4.2.1":
              return "SHA-256";
            case "2.16.840.1.101.3.4.2.2":
              return "SHA-384";
            case "2.16.840.1.101.3.4.2.3":
              return "SHA-512";
          }
          throw x509Error("unknown hash OID " + hashOID, data);
        }
        // Ed25519 -- see https: return//github.com/openssl/openssl/issues/15477
        case "1.3.101.110":
        case "1.3.101.112":
          return "SHA-512";
        // Ed448 -- still not in pg 17.2 (if supported, digest would be SHAKE256 x 64 bytes)
        case "1.3.101.111":
        case "1.3.101.113":
          throw x509Error("Ed448 certificate channel binding is not currently supported by Postgres");
      }
      throw x509Error("unknown OID " + oid, data);
    }
    __name(signatureAlgorithmHashFromCertificate, "signatureAlgorithmHashFromCertificate");
    module.exports = { signatureAlgorithmHashFromCertificate };
  }
});

// node_modules/pg/lib/crypto/sasl.js
var require_sasl = __commonJS({
  "node_modules/pg/lib/crypto/sasl.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var crypto2 = require_utils2();
    var { signatureAlgorithmHashFromCertificate } = require_cert_signatures();
    function saslprep(password) {
      const nonAsciiSpace = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;
      const mappedToNothing = /[\u00AD\u034F\u1806\u180B\u180C\u180D\u200C\u200D\u2060\uFE00-\uFE0F\uFEFF]/g;
      return password.replace(nonAsciiSpace, " ").replace(mappedToNothing, "").normalize("NFKC");
    }
    __name(saslprep, "saslprep");
    var DEFAULT_MAX_SCRAM_ITERATIONS = 1e5;
    function startSession(mechanisms, stream, scramMaxIterations = DEFAULT_MAX_SCRAM_ITERATIONS) {
      const candidates = ["SCRAM-SHA-256"];
      if (stream) candidates.unshift("SCRAM-SHA-256-PLUS");
      const mechanism = candidates.find((candidate) => mechanisms.includes(candidate));
      if (!mechanism) {
        throw new Error("SASL: Only mechanism(s) " + candidates.join(" and ") + " are supported");
      }
      if (mechanism === "SCRAM-SHA-256-PLUS" && typeof stream.getPeerCertificate !== "function") {
        throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
      }
      const clientNonce = crypto2.randomBytes(18).toString("base64");
      const gs2Header = mechanism === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : stream ? "y" : "n";
      return {
        mechanism,
        clientNonce,
        response: gs2Header + ",,n=*,r=" + clientNonce,
        message: "SASLInitialResponse",
        scramMaxIterations
      };
    }
    __name(startSession, "startSession");
    async function continueSession(session, password, serverData, stream) {
      if (session.message !== "SASLInitialResponse") {
        throw new Error("SASL: Last message was not SASLInitialResponse");
      }
      if (typeof password !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
      }
      if (password === "") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
      }
      const sv = parseServerFirstMessage(serverData);
      if (!sv.nonce.startsWith(session.clientNonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
      } else if (sv.nonce.length === session.clientNonce.length) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
      }
      const scramMaxIterations = typeof session.scramMaxIterations === "number" ? session.scramMaxIterations : DEFAULT_MAX_SCRAM_ITERATIONS;
      if (scramMaxIterations !== 0 && sv.iteration > scramMaxIterations) {
        throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration count " + sv.iteration + " exceeds scramMaxIterations of " + scramMaxIterations
        );
      }
      const clientFirstMessageBare = "n=*,r=" + session.clientNonce;
      const serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
      let channelBinding = stream ? "eSws" : "biws";
      if (session.mechanism === "SCRAM-SHA-256-PLUS") {
        const peerCert = stream.getPeerCertificate().raw;
        let hashName = signatureAlgorithmHashFromCertificate(peerCert);
        if (hashName === "MD5" || hashName === "SHA-1") hashName = "SHA-256";
        const certHash = await crypto2.hashByName(hashName, peerCert);
        const bindingData = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(certHash)]);
        channelBinding = bindingData.toString("base64");
      }
      const clientFinalMessageWithoutProof = "c=" + channelBinding + ",r=" + sv.nonce;
      const authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
      const saltBytes = Buffer.from(sv.salt, "base64");
      const saltedPassword = await crypto2.deriveKey(saslprep(password), saltBytes, sv.iteration);
      const clientKey = await crypto2.hmacSha256(saltedPassword, "Client Key");
      const storedKey = await crypto2.sha256(clientKey);
      const clientSignature = await crypto2.hmacSha256(storedKey, authMessage);
      const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
      const serverKey = await crypto2.hmacSha256(saltedPassword, "Server Key");
      const serverSignatureBytes = await crypto2.hmacSha256(serverKey, authMessage);
      session.message = "SASLResponse";
      session.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
      session.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
    }
    __name(continueSession, "continueSession");
    function finalizeSession(session, serverData) {
      if (session.message !== "SASLResponse") {
        throw new Error("SASL: Last message was not SASLResponse");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
      }
      const { serverSignature } = parseServerFinalMessage(serverData);
      if (serverSignature !== session.serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
    }
    __name(finalizeSession, "finalizeSession");
    function isPrintableChars(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: text must be a string");
      }
      return text.split("").map((_, i) => text.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
    }
    __name(isPrintableChars, "isPrintableChars");
    function isBase64(text) {
      return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text);
    }
    __name(isBase64, "isBase64");
    function parseAttributePairs(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: attribute pairs text must be a string");
      }
      return new Map(
        text.split(",").map((attrValue) => {
          if (!/^.=/.test(attrValue)) {
            throw new Error("SASL: Invalid attribute pair entry");
          }
          const name = attrValue[0];
          const value = attrValue.substring(2);
          return [name, value];
        })
      );
    }
    __name(parseAttributePairs, "parseAttributePairs");
    function parseServerFirstMessage(data) {
      const attrPairs = parseAttributePairs(data);
      const nonce = attrPairs.get("r");
      if (!nonce) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
      } else if (!isPrintableChars(nonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
      }
      const salt = attrPairs.get("s");
      if (!salt) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
      } else if (!isBase64(salt)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
      }
      const iterationText = attrPairs.get("i");
      if (!iterationText) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
      } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
      }
      const iteration = parseInt(iterationText, 10);
      return {
        nonce,
        salt,
        iteration
      };
    }
    __name(parseServerFirstMessage, "parseServerFirstMessage");
    function parseServerFinalMessage(serverData) {
      const attrPairs = parseAttributePairs(serverData);
      const error = attrPairs.get("e");
      const serverSignature = attrPairs.get("v");
      if (error) {
        throw new Error(`SASL: SCRAM-SERVER-FINAL-MESSAGE: server returned error: "${error}"`);
      }
      if (!serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
      } else if (!isBase64(serverSignature)) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
      }
      return {
        serverSignature
      };
    }
    __name(parseServerFinalMessage, "parseServerFinalMessage");
    function xorBuffers(a, b) {
      if (!Buffer.isBuffer(a)) {
        throw new TypeError("first argument must be a Buffer");
      }
      if (!Buffer.isBuffer(b)) {
        throw new TypeError("second argument must be a Buffer");
      }
      if (a.length !== b.length) {
        throw new Error("Buffer lengths must match");
      }
      if (a.length === 0) {
        throw new Error("Buffers cannot be empty");
      }
      return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
    }
    __name(xorBuffers, "xorBuffers");
    module.exports = {
      startSession,
      continueSession,
      finalizeSession,
      DEFAULT_MAX_SCRAM_ITERATIONS
    };
  }
});

// node_modules/pg/lib/type-overrides.js
var require_type_overrides = __commonJS({
  "node_modules/pg/lib/type-overrides.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var types2 = require_pg_types();
    function TypeOverrides2(userTypes) {
      this._types = userTypes || types2;
      this.text = {};
      this.binary = {};
    }
    __name(TypeOverrides2, "TypeOverrides");
    TypeOverrides2.prototype.getOverrides = function(format2) {
      switch (format2) {
        case "text":
          return this.text;
        case "binary":
          return this.binary;
        default:
          return {};
      }
    };
    TypeOverrides2.prototype.setTypeParser = function(oid, format2, parseFn) {
      if (typeof format2 === "function") {
        parseFn = format2;
        format2 = "text";
      }
      this.getOverrides(format2)[oid] = parseFn;
    };
    TypeOverrides2.prototype.getTypeParser = function(oid, format2) {
      format2 = format2 || "text";
      return this.getOverrides(format2)[oid] || this._types.getTypeParser(oid, format2);
    };
    module.exports = TypeOverrides2;
  }
});

// node-built-in-modules:dns
import libDefault5 from "dns";
var require_dns = __commonJS({
  "node-built-in-modules:dns"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault5;
  }
});

// node-built-in-modules:fs
import libDefault6 from "fs";
var require_fs = __commonJS({
  "node-built-in-modules:fs"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault6;
  }
});

// node_modules/pg-connection-string/index.js
var require_pg_connection_string = __commonJS({
  "node_modules/pg-connection-string/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    function parse(str, options = {}) {
      if (str.charAt(0) === "/") {
        const config2 = str.split(" ");
        return { host: config2[0], database: config2[1] };
      }
      const config = /* @__PURE__ */ Object.create(null);
      let result;
      let dummyHost = false;
      if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str)) {
        str = encodeURI(str).replace(/%25(\d\d)/g, "%$1");
      }
      try {
        try {
          result = new URL(str, "postgres://base");
        } catch (e) {
          result = new URL(str.replace("@/", "@___DUMMY___/"), "postgres://base");
          dummyHost = true;
        }
      } catch (err) {
        err.input && (err.input = "*****REDACTED*****");
        throw err;
      }
      for (const entry of result.searchParams.entries()) {
        config[entry[0]] = entry[1];
      }
      config.user = config.user || decodeURIComponent(result.username);
      config.password = config.password || decodeURIComponent(result.password);
      if (result.protocol == "socket:") {
        config.host = decodeURI(result.pathname);
        config.database = result.searchParams.get("db");
        config.client_encoding = result.searchParams.get("encoding");
        return config;
      }
      const hostname = dummyHost ? "" : result.hostname;
      if (!config.host) {
        config.host = decodeURIComponent(hostname);
      } else if (hostname && /^%2f/i.test(hostname)) {
        result.pathname = hostname + result.pathname;
      }
      if (!config.port) {
        config.port = result.port;
      }
      const pathname = result.pathname.slice(1) || null;
      config.database = pathname ? decodeURI(pathname) : null;
      if (config.ssl === "true" || config.ssl === "1") {
        config.ssl = true;
      }
      if (config.ssl === "0") {
        config.ssl = false;
      }
      if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) {
        config.ssl = {};
      }
      if (config.sslnegotiation === "direct" && config.ssl === void 0) {
        config.ssl = true;
      }
      const fs = config.sslcert || config.sslkey || config.sslrootcert ? require_fs() : null;
      if (config.sslcert) {
        config.ssl.cert = fs.readFileSync(config.sslcert).toString();
      }
      if (config.sslkey) {
        config.ssl.key = fs.readFileSync(config.sslkey).toString();
      }
      if (config.sslrootcert) {
        config.ssl.ca = fs.readFileSync(config.sslrootcert).toString();
      }
      if (options.useLibpqCompat && config.uselibpqcompat) {
        throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
      }
      if (config.uselibpqcompat === "true" || options.useLibpqCompat) {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
          case "require": {
            if (config.sslrootcert) {
              config.ssl.checkServerIdentity = function() {
              };
            } else {
              config.ssl.rejectUnauthorized = false;
            }
            break;
          }
          case "verify-ca": {
            if (!config.ssl.ca) {
              throw new Error(
                "SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security."
              );
            }
            config.ssl.checkServerIdentity = function() {
            };
            break;
          }
          case "verify-full": {
            break;
          }
        }
      } else {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full": {
            if (config.sslmode !== "verify-full") {
              deprecatedSslModeWarning(config.sslmode);
            }
            break;
          }
          case "no-verify": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
        }
      }
      return config;
    }
    __name(parse, "parse");
    function toConnectionOptions(sslConfig) {
      const connectionOptions = Object.entries(sslConfig).reduce((c, [key, value]) => {
        if (value !== void 0 && value !== null) {
          c[key] = value;
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return connectionOptions;
    }
    __name(toConnectionOptions, "toConnectionOptions");
    function toClientConfig(config) {
      const poolConfig = Object.entries(config).reduce((c, [key, value]) => {
        if (key === "ssl") {
          const sslConfig = value;
          if (typeof sslConfig === "boolean") {
            c[key] = sslConfig;
          }
          if (typeof sslConfig === "object") {
            c[key] = toConnectionOptions(sslConfig);
          }
        } else if (value !== void 0 && value !== null) {
          if (key === "port") {
            if (value !== "") {
              const v = parseInt(value, 10);
              if (isNaN(v)) {
                throw new Error(`Invalid ${key}: ${value}`);
              }
              c[key] = v;
            }
          } else {
            c[key] = value;
          }
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return poolConfig;
    }
    __name(toClientConfig, "toClientConfig");
    function parseIntoClientConfig(str) {
      return toClientConfig(parse(str));
    }
    __name(parseIntoClientConfig, "parseIntoClientConfig");
    function deprecatedSslModeWarning(sslmode) {
      if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
        deprecatedSslModeWarning.warned = true;
        process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
      }
    }
    __name(deprecatedSslModeWarning, "deprecatedSslModeWarning");
    module.exports = parse;
    parse.parse = parse;
    parse.toClientConfig = toClientConfig;
    parse.parseIntoClientConfig = parseIntoClientConfig;
  }
});

// node_modules/pg/lib/connection-parameters.js
var require_connection_parameters = __commonJS({
  "node_modules/pg/lib/connection-parameters.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var dns = require_dns();
    var defaults2 = require_defaults();
    var parse = require_pg_connection_string().parse;
    var val = /* @__PURE__ */ __name(function(key, config, envVar) {
      if (config[key]) {
        return config[key];
      }
      if (envVar === void 0) {
        envVar = process.env["PG" + key.toUpperCase()];
      } else if (envVar === false) {
      } else {
        envVar = process.env[envVar];
      }
      return envVar || defaults2[key];
    }, "val");
    var readSSLConfigFromEnvironment = /* @__PURE__ */ __name(function() {
      switch (process.env.PGSSLMODE) {
        case "disable":
          return false;
        case "prefer":
        case "require":
        case "verify-ca":
        case "verify-full":
          return true;
        case "no-verify":
          return { rejectUnauthorized: false };
      }
      return defaults2.ssl;
    }, "readSSLConfigFromEnvironment");
    var quoteParamValue = /* @__PURE__ */ __name(function(value) {
      return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    }, "quoteParamValue");
    var add = /* @__PURE__ */ __name(function(params, config, paramName) {
      const value = config[paramName];
      if (value !== void 0 && value !== null) {
        params.push(paramName + "=" + quoteParamValue(value));
      }
    }, "add");
    var ConnectionParameters = class {
      static {
        __name(this, "ConnectionParameters");
      }
      constructor(config) {
        config = typeof config === "string" ? parse(config) : config || {};
        if (config.connectionString) {
          config = Object.assign({}, config, parse(config.connectionString));
        }
        this.user = val("user", config);
        this.database = val("database", config);
        if (this.database === void 0) {
          this.database = this.user;
        }
        this.port = parseInt(val("port", config), 10);
        this.host = val("host", config);
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: val("password", config)
        });
        this.binary = val("binary", config);
        this.options = val("options", config);
        this.ssl = typeof config.ssl === "undefined" ? readSSLConfigFromEnvironment() : config.ssl;
        if (typeof this.ssl === "string") {
          if (this.ssl === "true") {
            this.ssl = true;
          }
        }
        if (this.ssl === "no-verify") {
          this.ssl = { rejectUnauthorized: false };
        }
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this.sslnegotiation = val("sslnegotiation", config, "PGSSLNEGOTIATION");
        if (this.sslnegotiation !== void 0 && this.sslnegotiation !== "postgres" && this.sslnegotiation !== "direct") {
          throw new Error(
            `Invalid sslnegotiation value: "${this.sslnegotiation}". Valid values are "postgres" and "direct".`
          );
        }
        if (this.sslnegotiation === "direct" && !this.ssl) {
          throw new Error("sslnegotiation=direct requires SSL to be enabled");
        }
        this.client_encoding = val("client_encoding", config);
        this.replication = val("replication", config);
        this.isDomainSocket = !(this.host || "").indexOf("/");
        this.application_name = val("application_name", config, "PGAPPNAME");
        this.fallback_application_name = val("fallback_application_name", config, false);
        this.statement_timeout = val("statement_timeout", config, false);
        this.lock_timeout = val("lock_timeout", config, false);
        this.idle_in_transaction_session_timeout = val("idle_in_transaction_session_timeout", config, false);
        this.query_timeout = val("query_timeout", config, false);
        if (config.connectionTimeoutMillis === void 0) {
          this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
        } else {
          this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1e3);
        }
        if (config.keepAlive === false) {
          this.keepalives = 0;
        } else if (config.keepAlive === true) {
          this.keepalives = 1;
        }
        if (typeof config.keepAliveInitialDelayMillis === "number") {
          this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1e3);
        }
      }
      getLibpqConnectionString(cb) {
        const params = [];
        add(params, this, "user");
        add(params, this, "password");
        add(params, this, "port");
        add(params, this, "application_name");
        add(params, this, "fallback_application_name");
        add(params, this, "connect_timeout");
        add(params, this, "options");
        const ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
        add(params, ssl, "sslmode");
        add(params, ssl, "sslca");
        add(params, ssl, "sslkey");
        add(params, ssl, "sslcert");
        add(params, ssl, "sslrootcert");
        add(params, this, "sslnegotiation");
        if (this.database) {
          params.push("dbname=" + quoteParamValue(this.database));
        }
        if (this.replication) {
          params.push("replication=" + quoteParamValue(this.replication));
        }
        if (this.host) {
          params.push("host=" + quoteParamValue(this.host));
        }
        if (this.isDomainSocket) {
          return cb(null, params.join(" "));
        }
        if (this.client_encoding) {
          params.push("client_encoding=" + quoteParamValue(this.client_encoding));
        }
        dns.lookup(this.host, function(err, address) {
          if (err) return cb(err, null);
          params.push("hostaddr=" + quoteParamValue(address));
          return cb(null, params.join(" "));
        });
      }
    };
    module.exports = ConnectionParameters;
  }
});

// node_modules/pg/lib/result.js
var require_result = __commonJS({
  "node_modules/pg/lib/result.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var types2 = require_pg_types();
    var matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
    var Result2 = class {
      static {
        __name(this, "Result");
      }
      constructor(rowMode, types3) {
        this.command = null;
        this.rowCount = null;
        this.oid = null;
        this.rows = [];
        this.fields = [];
        this._parsers = void 0;
        this._types = types3;
        this.RowCtor = null;
        this.rowAsArray = rowMode === "array";
        if (this.rowAsArray) {
          this.parseRow = this._parseRowAsArray;
        }
        this._prebuiltEmptyResultObject = null;
      }
      // adds a command complete message
      addCommandComplete(msg) {
        let match2;
        if (msg.text) {
          match2 = matchRegexp.exec(msg.text);
        } else {
          match2 = matchRegexp.exec(msg.command);
        }
        if (match2) {
          this.command = match2[1];
          if (match2[3]) {
            this.oid = parseInt(match2[2], 10);
            this.rowCount = parseInt(match2[3], 10);
          } else if (match2[2]) {
            this.rowCount = parseInt(match2[2], 10);
          }
        }
      }
      _parseRowAsArray(rowData) {
        const row = new Array(rowData.length);
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          if (rawValue !== null) {
            row[i] = this._parsers[i](rawValue);
          } else {
            row[i] = null;
          }
        }
        return row;
      }
      parseRow(rowData) {
        const row = { ...this._prebuiltEmptyResultObject };
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          const field = this.fields[i].name;
          if (rawValue !== null) {
            const v = this.fields[i].format === "binary" ? Buffer.from(rawValue) : rawValue;
            row[field] = this._parsers[i](v);
          } else {
            row[field] = null;
          }
        }
        return row;
      }
      addRow(row) {
        this.rows.push(row);
      }
      addFields(fieldDescriptions) {
        this.fields = fieldDescriptions;
        if (this.fields.length) {
          this._parsers = new Array(fieldDescriptions.length);
        }
        const row = /* @__PURE__ */ Object.create(null);
        for (let i = 0; i < fieldDescriptions.length; i++) {
          const desc = fieldDescriptions[i];
          row[desc.name] = null;
          if (this._types) {
            this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || "text");
          } else {
            this._parsers[i] = types2.getTypeParser(desc.dataTypeID, desc.format || "text");
          }
        }
        this._prebuiltEmptyResultObject = { ...row };
      }
    };
    module.exports = Result2;
  }
});

// node_modules/pg/lib/query.js
var require_query = __commonJS({
  "node_modules/pg/lib/query.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var { EventEmitter } = require_events();
    var Result2 = require_result();
    var utils = require_utils();
    var Query2 = class extends EventEmitter {
      static {
        __name(this, "Query");
      }
      constructor(config, values, callback) {
        super();
        config = utils.normalizeQueryConfig(config, values, callback);
        this.text = config.text;
        this.values = config.values;
        this.rows = config.rows;
        this.types = config.types;
        this.name = config.name;
        this.queryMode = config.queryMode;
        this.binary = config.binary;
        this.portal = config.portal || "";
        this.callback = config.callback;
        this._rowMode = config.rowMode;
        if (process.domain && config.callback) {
          this.callback = process.domain.bind(config.callback);
        }
        this._result = new Result2(this._rowMode, this.types);
        this._results = this._result;
        this._canceledDueToError = false;
      }
      requiresPreparation() {
        if (this.queryMode === "extended") {
          return true;
        }
        if (this.name) {
          return true;
        }
        if (this.rows) {
          return true;
        }
        if (!this.text) {
          return false;
        }
        if (!this.values) {
          return false;
        }
        return this.values.length > 0;
      }
      _checkForMultirow() {
        if (this._result.command) {
          if (!Array.isArray(this._results)) {
            this._results = [this._result];
          }
          this._result = new Result2(this._rowMode, this._result._types);
          this._results.push(this._result);
        }
      }
      // associates row metadata from the supplied
      // message with this query object
      // metadata used when parsing row results
      handleRowDescription(msg) {
        this._checkForMultirow();
        this._result.addFields(msg.fields);
        this._accumulateRows = this.callback || !this.listeners("row").length;
      }
      handleDataRow(msg) {
        let row;
        if (this._canceledDueToError) {
          return;
        }
        try {
          row = this._result.parseRow(msg.fields);
        } catch (err) {
          this._canceledDueToError = err;
          return;
        }
        this.emit("row", row, this._result);
        if (this._accumulateRows) {
          this._result.addRow(row);
        }
      }
      handleCommandComplete(msg, connection) {
        this._checkForMultirow();
        this._result.addCommandComplete(msg);
        if (this.rows) {
          connection.sync();
        }
      }
      // if a named prepared statement is created with empty query text
      // the backend will send an emptyQuery message but *not* a command complete message
      // since we pipeline sync immediately after execute we don't need to do anything here
      // unless we have rows specified, in which case we did not pipeline the initial sync call
      handleEmptyQuery(connection) {
        if (this.rows) {
          connection.sync();
        }
      }
      handleError(err, connection) {
        if (this._canceledDueToError) {
          err = this._canceledDueToError;
          this._canceledDueToError = false;
        }
        if (this.callback) {
          return this.callback(err);
        }
        this.emit("error", err);
      }
      handleReadyForQuery(con) {
        if (this._canceledDueToError) {
          return this.handleError(this._canceledDueToError, con);
        }
        if (this.callback) {
          try {
            this.callback(null, this._results);
          } catch (err) {
            process.nextTick(() => {
              throw err;
            });
          }
        }
        this.emit("end", this._results);
      }
      submit(connection) {
        if (typeof this.text !== "string" && typeof this.name !== "string") {
          return new Error("A query must have either text or a name. Supplying neither is unsupported.");
        }
        const previous = connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name];
        if (this.text && previous && this.text !== previous) {
          return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
        }
        if (this.values && !Array.isArray(this.values)) {
          return new Error("Query values must be an array");
        }
        if (this.requiresPreparation()) {
          connection.stream.cork && connection.stream.cork();
          try {
            this.prepare(connection);
          } finally {
            connection.stream.uncork && connection.stream.uncork();
          }
        } else {
          connection.query(this.text);
        }
        return null;
      }
      hasBeenParsed(connection) {
        return this.name && (connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name]);
      }
      handlePortalSuspended(connection) {
        this._getRows(connection, this.rows);
      }
      _getRows(connection, rows) {
        connection.execute({
          portal: this.portal,
          rows
        });
        if (!rows) {
          connection.sync();
        } else {
          connection.flush();
        }
      }
      // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
      prepare(connection) {
        if (!this.hasBeenParsed(connection)) {
          connection.parse({
            text: this.text,
            name: this.name,
            types: this.types
          });
          if (this.name) {
            connection.submittedNamedStatements[this.name] = this.text;
          }
        }
        try {
          connection.bind({
            portal: this.portal,
            statement: this.name,
            values: this.values,
            binary: this.binary,
            valueMapper: utils.prepareValue
          });
        } catch (err) {
          connection.close({ type: "S", name: this.name });
          connection.sync();
          this.handleError(err, connection);
          return;
        }
        connection.describe({
          type: "P",
          name: this.portal || ""
        });
        this._getRows(connection, this.rows);
      }
      handleCopyInResponse(connection) {
        connection.sendCopyFail("No source stream defined");
      }
      handleCopyData(msg, connection) {
      }
    };
    module.exports = Query2;
  }
});

// node_modules/pg-protocol/dist/messages.js
var require_messages = __commonJS({
  "node_modules/pg-protocol/dist/messages.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NoticeMessage = exports.DataRowMessage = exports.CommandCompleteMessage = exports.ReadyForQueryMessage = exports.NotificationResponseMessage = exports.BackendKeyDataMessage = exports.AuthenticationMD5Password = exports.ParameterStatusMessage = exports.ParameterDescriptionMessage = exports.RowDescriptionMessage = exports.Field = exports.CopyResponse = exports.CopyDataMessage = exports.DatabaseError = exports.copyDone = exports.emptyQuery = exports.replicationStart = exports.portalSuspended = exports.noData = exports.closeComplete = exports.bindComplete = exports.parseComplete = void 0;
    exports.parseComplete = {
      name: "parseComplete",
      length: 5
    };
    exports.bindComplete = {
      name: "bindComplete",
      length: 5
    };
    exports.closeComplete = {
      name: "closeComplete",
      length: 5
    };
    exports.noData = {
      name: "noData",
      length: 5
    };
    exports.portalSuspended = {
      name: "portalSuspended",
      length: 5
    };
    exports.replicationStart = {
      name: "replicationStart",
      length: 4
    };
    exports.emptyQuery = {
      name: "emptyQuery",
      length: 4
    };
    exports.copyDone = {
      name: "copyDone",
      length: 4
    };
    var DatabaseError2 = class extends Error {
      static {
        __name(this, "DatabaseError");
      }
      constructor(message2, length, name) {
        super(message2);
        this.length = length;
        this.name = name;
      }
    };
    exports.DatabaseError = DatabaseError2;
    var CopyDataMessage = class {
      static {
        __name(this, "CopyDataMessage");
      }
      constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = "copyData";
      }
    };
    exports.CopyDataMessage = CopyDataMessage;
    var CopyResponse = class {
      static {
        __name(this, "CopyResponse");
      }
      constructor(length, name, binary, columnCount) {
        this.length = length;
        this.name = name;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
      }
    };
    exports.CopyResponse = CopyResponse;
    var Field = class {
      static {
        __name(this, "Field");
      }
      constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format2) {
        this.name = name;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format2;
      }
    };
    exports.Field = Field;
    var RowDescriptionMessage = class {
      static {
        __name(this, "RowDescriptionMessage");
      }
      constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = "rowDescription";
        this.fields = new Array(this.fieldCount);
      }
    };
    exports.RowDescriptionMessage = RowDescriptionMessage;
    var ParameterDescriptionMessage = class {
      static {
        __name(this, "ParameterDescriptionMessage");
      }
      constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = "parameterDescription";
        this.dataTypeIDs = new Array(this.parameterCount);
      }
    };
    exports.ParameterDescriptionMessage = ParameterDescriptionMessage;
    var ParameterStatusMessage = class {
      static {
        __name(this, "ParameterStatusMessage");
      }
      constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = "parameterStatus";
      }
    };
    exports.ParameterStatusMessage = ParameterStatusMessage;
    var AuthenticationMD5Password = class {
      static {
        __name(this, "AuthenticationMD5Password");
      }
      constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = "authenticationMD5Password";
      }
    };
    exports.AuthenticationMD5Password = AuthenticationMD5Password;
    var BackendKeyDataMessage = class {
      static {
        __name(this, "BackendKeyDataMessage");
      }
      constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = "backendKeyData";
      }
    };
    exports.BackendKeyDataMessage = BackendKeyDataMessage;
    var NotificationResponseMessage = class {
      static {
        __name(this, "NotificationResponseMessage");
      }
      constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = "notification";
      }
    };
    exports.NotificationResponseMessage = NotificationResponseMessage;
    var ReadyForQueryMessage = class {
      static {
        __name(this, "ReadyForQueryMessage");
      }
      constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = "readyForQuery";
      }
    };
    exports.ReadyForQueryMessage = ReadyForQueryMessage;
    var CommandCompleteMessage = class {
      static {
        __name(this, "CommandCompleteMessage");
      }
      constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = "commandComplete";
      }
    };
    exports.CommandCompleteMessage = CommandCompleteMessage;
    var DataRowMessage = class {
      static {
        __name(this, "DataRowMessage");
      }
      constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = "dataRow";
        this.fieldCount = fields.length;
      }
    };
    exports.DataRowMessage = DataRowMessage;
    var NoticeMessage = class {
      static {
        __name(this, "NoticeMessage");
      }
      constructor(length, message2) {
        this.length = length;
        this.message = message2;
        this.name = "notice";
      }
    };
    exports.NoticeMessage = NoticeMessage;
  }
});

// node_modules/pg-protocol/dist/buffer-writer.js
var require_buffer_writer = __commonJS({
  "node_modules/pg-protocol/dist/buffer-writer.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Writer = void 0;
    var Writer = class {
      static {
        __name(this, "Writer");
      }
      constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
      }
      ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
          const oldBuffer = this.buffer;
          const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
          this.buffer = Buffer.allocUnsafe(newSize);
          oldBuffer.copy(this.buffer);
        }
      }
      addInt32(num2) {
        this.ensure(4);
        this.buffer[this.offset++] = num2 >>> 24 & 255;
        this.buffer[this.offset++] = num2 >>> 16 & 255;
        this.buffer[this.offset++] = num2 >>> 8 & 255;
        this.buffer[this.offset++] = num2 >>> 0 & 255;
        return this;
      }
      addInt16(num2) {
        this.ensure(2);
        this.buffer[this.offset++] = num2 >>> 8 & 255;
        this.buffer[this.offset++] = num2 >>> 0 & 255;
        return this;
      }
      addCString(string) {
        if (!string) {
          this.ensure(1);
        } else {
          const len = Buffer.byteLength(string);
          this.ensure(len + 1);
          this.buffer.write(string, this.offset, "utf-8");
          this.offset += len;
        }
        this.buffer[this.offset++] = 0;
        return this;
      }
      addString(string = "") {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
      }
      // Write an Int32 byte-length prefix immediately followed by the string's UTF-8
      // bytes. Postgres' Bind wire format prefixes every parameter with its length,
      // and doing it in one method computes Buffer.byteLength ONCE — the previous
      // `addInt32(Buffer.byteLength(s)).addString(s)` pairing scanned the string
      // three times (byteLength for the prefix, byteLength again inside addString,
      // then the encode), which is costly for large text parameters.
      addInt32PrefixedString(string) {
        const len = Buffer.byteLength(string);
        this.ensure(4 + len);
        const buffer = this.buffer;
        let offset = this.offset;
        buffer[offset++] = len >>> 24 & 255;
        buffer[offset++] = len >>> 16 & 255;
        buffer[offset++] = len >>> 8 & 255;
        buffer[offset++] = len >>> 0 & 255;
        buffer.write(string, offset, "utf-8");
        this.offset = offset + len;
        return this;
      }
      add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
      }
      join(code) {
        if (code) {
          this.buffer[this.headerPosition] = code;
          const length = this.offset - (this.headerPosition + 1);
          this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
      }
      flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
      }
      clear() {
        this.offset = 5;
        this.headerPosition = 0;
      }
    };
    exports.Writer = Writer;
  }
});

// node_modules/pg-protocol/dist/serializer.js
var require_serializer = __commonJS({
  "node_modules/pg-protocol/dist/serializer.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serialize = void 0;
    var buffer_writer_1 = require_buffer_writer();
    var writer = new buffer_writer_1.Writer();
    var startup = /* @__PURE__ */ __name((opts) => {
      writer.addInt16(3).addInt16(0);
      for (const key of Object.keys(opts)) {
        writer.addCString(key).addCString(opts[key]);
      }
      writer.addCString("client_encoding").addCString("UTF8");
      const bodyBuffer = writer.addCString("").flush();
      const length = bodyBuffer.length + 4;
      return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
    }, "startup");
    var requestSsl = /* @__PURE__ */ __name(() => {
      const response = Buffer.allocUnsafe(8);
      response.writeInt32BE(8, 0);
      response.writeInt32BE(80877103, 4);
      return response;
    }, "requestSsl");
    var password = /* @__PURE__ */ __name((password2) => {
      return writer.addCString(password2).flush(
        112
        /* code.startup */
      );
    }, "password");
    var sendSASLInitialResponseMessage = /* @__PURE__ */ __name(function(mechanism, initialResponse) {
      writer.addCString(mechanism).addInt32PrefixedString(initialResponse);
      return writer.flush(
        112
        /* code.startup */
      );
    }, "sendSASLInitialResponseMessage");
    var sendSCRAMClientFinalMessage = /* @__PURE__ */ __name(function(additionalData) {
      return writer.addString(additionalData).flush(
        112
        /* code.startup */
      );
    }, "sendSCRAMClientFinalMessage");
    var query = /* @__PURE__ */ __name((text) => {
      return writer.addCString(text).flush(
        81
        /* code.query */
      );
    }, "query");
    var emptyArray = [];
    var parse = /* @__PURE__ */ __name((query2) => {
      const name = query2.name || "";
      if (name.length > 63) {
        console.error("Warning! Postgres only supports 63 characters for query names.");
        console.error("You supplied %s (%s)", name, name.length);
        console.error("This can cause conflicts and silent errors executing queries");
      }
      const types2 = query2.types || emptyArray;
      const len = types2.length;
      const buffer = writer.addCString(name).addCString(query2.text).addInt16(len);
      for (let i = 0; i < len; i++) {
        buffer.addInt32(types2[i]);
      }
      return writer.flush(
        80
        /* code.parse */
      );
    }, "parse");
    var paramWriter = new buffer_writer_1.Writer();
    var writeValues = /* @__PURE__ */ __name(function(values, valueMapper) {
      for (let i = 0; i < values.length; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        if (mappedVal == null) {
          writer.addInt16(
            0
            /* ParamType.STRING */
          );
          paramWriter.addInt32(-1);
        } else if (mappedVal instanceof Buffer) {
          writer.addInt16(
            1
            /* ParamType.BINARY */
          );
          paramWriter.addInt32(mappedVal.length);
          paramWriter.add(mappedVal);
        } else {
          writer.addInt16(
            0
            /* ParamType.STRING */
          );
          paramWriter.addInt32PrefixedString(mappedVal);
        }
      }
    }, "writeValues");
    var bind = /* @__PURE__ */ __name((config = {}) => {
      const portal = config.portal || "";
      const statement = config.statement || "";
      const binary = config.binary || false;
      const values = config.values || emptyArray;
      const len = values.length;
      writer.addCString(portal).addCString(statement);
      writer.addInt16(len);
      try {
        writeValues(values, config.valueMapper);
      } catch (err) {
        writer.clear();
        paramWriter.clear();
        throw err;
      }
      writer.addInt16(len);
      writer.add(paramWriter.flush());
      writer.addInt16(1);
      writer.addInt16(
        binary ? 1 : 0
        /* ParamType.STRING */
      );
      return writer.flush(
        66
        /* code.bind */
      );
    }, "bind");
    var emptyExecute = Buffer.from([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]);
    var execute = /* @__PURE__ */ __name((config) => {
      if (!config || !config.portal && !config.rows) {
        return emptyExecute;
      }
      const portal = config.portal || "";
      const rows = config.rows || 0;
      const portalLength = Buffer.byteLength(portal);
      const len = 4 + portalLength + 1 + 4;
      const buff = Buffer.allocUnsafe(1 + len);
      buff[0] = 69;
      buff.writeInt32BE(len, 1);
      buff.write(portal, 5, "utf-8");
      buff[portalLength + 5] = 0;
      buff.writeUInt32BE(rows, buff.length - 4);
      return buff;
    }, "execute");
    var cancel = /* @__PURE__ */ __name((processID, secretKey) => {
      const buffer = Buffer.allocUnsafe(16);
      buffer.writeInt32BE(16, 0);
      buffer.writeInt16BE(1234, 4);
      buffer.writeInt16BE(5678, 6);
      buffer.writeInt32BE(processID, 8);
      buffer.writeInt32BE(secretKey, 12);
      return buffer;
    }, "cancel");
    var cstringMessage = /* @__PURE__ */ __name((code, string) => {
      const stringLen = Buffer.byteLength(string);
      const len = 4 + stringLen + 1;
      const buffer = Buffer.allocUnsafe(1 + len);
      buffer[0] = code;
      buffer.writeInt32BE(len, 1);
      buffer.write(string, 5, "utf-8");
      buffer[len] = 0;
      return buffer;
    }, "cstringMessage");
    var emptyDescribePortal = writer.addCString("P").flush(
      68
      /* code.describe */
    );
    var emptyDescribeStatement = writer.addCString("S").flush(
      68
      /* code.describe */
    );
    var describe = /* @__PURE__ */ __name((msg) => {
      return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
    }, "describe");
    var close = /* @__PURE__ */ __name((msg) => {
      const text = `${msg.type}${msg.name || ""}`;
      return cstringMessage(67, text);
    }, "close");
    var copyData = /* @__PURE__ */ __name((chunk) => {
      return writer.add(chunk).flush(
        100
        /* code.copyFromChunk */
      );
    }, "copyData");
    var copyFail = /* @__PURE__ */ __name((message2) => {
      return cstringMessage(102, message2);
    }, "copyFail");
    var codeOnlyBuffer = /* @__PURE__ */ __name((code) => Buffer.from([code, 0, 0, 0, 4]), "codeOnlyBuffer");
    var flushBuffer = codeOnlyBuffer(
      72
      /* code.flush */
    );
    var syncBuffer = codeOnlyBuffer(
      83
      /* code.sync */
    );
    var endBuffer = codeOnlyBuffer(
      88
      /* code.end */
    );
    var copyDoneBuffer = codeOnlyBuffer(
      99
      /* code.copyDone */
    );
    var serialize = {
      startup,
      password,
      requestSsl,
      sendSASLInitialResponseMessage,
      sendSCRAMClientFinalMessage,
      query,
      parse,
      bind,
      execute,
      describe,
      close,
      flush: /* @__PURE__ */ __name(() => flushBuffer, "flush"),
      sync: /* @__PURE__ */ __name(() => syncBuffer, "sync"),
      end: /* @__PURE__ */ __name(() => endBuffer, "end"),
      copyData,
      copyDone: /* @__PURE__ */ __name(() => copyDoneBuffer, "copyDone"),
      copyFail,
      cancel
    };
    exports.serialize = serialize;
  }
});

// node_modules/pg-protocol/dist/buffer-reader.js
var require_buffer_reader = __commonJS({
  "node_modules/pg-protocol/dist/buffer-reader.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BufferReader = void 0;
    var BufferReader = class {
      static {
        __name(this, "BufferReader");
      }
      constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        this.encoding = "utf-8";
      }
      setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
      }
      int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
      }
      byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
      }
      int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
      cstring() {
        const start = this.offset;
        let end = start;
        while (this.buffer[end++]) {
        }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
      }
      bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
    };
    exports.BufferReader = BufferReader;
  }
});

// node_modules/pg-protocol/dist/parser.js
var require_parser = __commonJS({
  "node_modules/pg-protocol/dist/parser.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parser = void 0;
    var messages_1 = require_messages();
    var buffer_reader_1 = require_buffer_reader();
    var CODE_LENGTH = 1;
    var LEN_LENGTH = 4;
    var HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
    var LATEINIT_LENGTH = -1;
    var emptyBuffer = Buffer.allocUnsafe(0);
    var Parser = class {
      static {
        __name(this, "Parser");
      }
      constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") {
          throw new Error("Binary mode not supported yet");
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
      }
      parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
          const code = this.buffer[offset];
          const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
          const fullMessageLength = CODE_LENGTH + length;
          if (fullMessageLength + offset <= bufferFullLength) {
            const message2 = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
            callback(message2);
            offset += fullMessageLength;
          } else {
            break;
          }
        }
        if (offset === bufferFullLength) {
          this.buffer = emptyBuffer;
          this.bufferLength = 0;
          this.bufferOffset = 0;
        } else {
          this.bufferLength = bufferFullLength - offset;
          this.bufferOffset = offset;
        }
      }
      mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
          const newLength = this.bufferLength + buffer.byteLength;
          const newFullLength = newLength + this.bufferOffset;
          if (newFullLength > this.buffer.byteLength) {
            let newBuffer;
            if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
              newBuffer = this.buffer;
            } else {
              let newBufferLength = this.buffer.byteLength * 2;
              while (newLength >= newBufferLength) {
                newBufferLength *= 2;
              }
              newBuffer = Buffer.allocUnsafe(newBufferLength);
            }
            this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
            this.buffer = newBuffer;
            this.bufferOffset = 0;
          }
          buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
          this.bufferLength = newLength;
        } else {
          this.buffer = buffer;
          this.bufferOffset = 0;
          this.bufferLength = buffer.byteLength;
        }
      }
      handlePacket(offset, code, length, bytes2) {
        const { reader } = this;
        reader.setBuffer(offset, bytes2);
        let message2;
        switch (code) {
          case 50:
            message2 = messages_1.bindComplete;
            break;
          case 49:
            message2 = messages_1.parseComplete;
            break;
          case 51:
            message2 = messages_1.closeComplete;
            break;
          case 110:
            message2 = messages_1.noData;
            break;
          case 115:
            message2 = messages_1.portalSuspended;
            break;
          case 99:
            message2 = messages_1.copyDone;
            break;
          case 87:
            message2 = messages_1.replicationStart;
            break;
          case 73:
            message2 = messages_1.emptyQuery;
            break;
          case 68:
            message2 = parseDataRowMessage(reader);
            break;
          case 67:
            message2 = parseCommandCompleteMessage(reader);
            break;
          case 90:
            message2 = parseReadyForQueryMessage(reader);
            break;
          case 65:
            message2 = parseNotificationMessage(reader);
            break;
          case 82:
            message2 = parseAuthenticationResponse(reader, length);
            break;
          case 83:
            message2 = parseParameterStatusMessage(reader);
            break;
          case 75:
            message2 = parseBackendKeyData(reader);
            break;
          case 69:
            message2 = parseErrorMessage(reader, "error");
            break;
          case 78:
            message2 = parseErrorMessage(reader, "notice");
            break;
          case 84:
            message2 = parseRowDescriptionMessage(reader);
            break;
          case 116:
            message2 = parseParameterDescriptionMessage(reader);
            break;
          case 71:
            message2 = parseCopyInMessage(reader);
            break;
          case 72:
            message2 = parseCopyOutMessage(reader);
            break;
          case 100:
            message2 = parseCopyData(reader, length);
            break;
          default:
            return new messages_1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
        }
        reader.setBuffer(0, emptyBuffer);
        message2.length = length;
        return message2;
      }
    };
    exports.Parser = Parser;
    var parseReadyForQueryMessage = /* @__PURE__ */ __name((reader) => {
      const status = reader.string(1);
      return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
    }, "parseReadyForQueryMessage");
    var parseCommandCompleteMessage = /* @__PURE__ */ __name((reader) => {
      const text = reader.cstring();
      return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
    }, "parseCommandCompleteMessage");
    var parseCopyData = /* @__PURE__ */ __name((reader, length) => {
      const chunk = reader.bytes(length - 4);
      return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
    }, "parseCopyData");
    var parseCopyInMessage = /* @__PURE__ */ __name((reader) => parseCopyMessage(reader, "copyInResponse"), "parseCopyInMessage");
    var parseCopyOutMessage = /* @__PURE__ */ __name((reader) => parseCopyMessage(reader, "copyOutResponse"), "parseCopyOutMessage");
    var parseCopyMessage = /* @__PURE__ */ __name((reader, messageName) => {
      const isBinary = reader.byte() !== 0;
      const columnCount = reader.int16();
      const message2 = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
      for (let i = 0; i < columnCount; i++) {
        message2.columnTypes[i] = reader.int16();
      }
      return message2;
    }, "parseCopyMessage");
    var parseNotificationMessage = /* @__PURE__ */ __name((reader) => {
      const processId = reader.int32();
      const channel = reader.cstring();
      const payload = reader.cstring();
      return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
    }, "parseNotificationMessage");
    var parseRowDescriptionMessage = /* @__PURE__ */ __name((reader) => {
      const fieldCount = reader.int16();
      const message2 = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        message2.fields[i] = parseField(reader);
      }
      return message2;
    }, "parseRowDescriptionMessage");
    var parseField = /* @__PURE__ */ __name((reader) => {
      const name = reader.cstring();
      const tableID = reader.uint32();
      const columnID = reader.int16();
      const dataTypeID = reader.uint32();
      const dataTypeSize = reader.int16();
      const dataTypeModifier = reader.int32();
      const mode = reader.int16() === 0 ? "text" : "binary";
      return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
    }, "parseField");
    var parseParameterDescriptionMessage = /* @__PURE__ */ __name((reader) => {
      const parameterCount = reader.int16();
      const message2 = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
      for (let i = 0; i < parameterCount; i++) {
        message2.dataTypeIDs[i] = reader.uint32();
      }
      return message2;
    }, "parseParameterDescriptionMessage");
    var parseDataRowMessage = /* @__PURE__ */ __name((reader) => {
      const fieldCount = reader.int16();
      const fields = new Array(fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        fields[i] = len === -1 ? null : reader.string(len);
      }
      return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
    }, "parseDataRowMessage");
    var parseParameterStatusMessage = /* @__PURE__ */ __name((reader) => {
      const name = reader.cstring();
      const value = reader.cstring();
      return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
    }, "parseParameterStatusMessage");
    var parseBackendKeyData = /* @__PURE__ */ __name((reader) => {
      const processID = reader.int32();
      const secretKey = reader.int32();
      return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
    }, "parseBackendKeyData");
    var parseAuthenticationResponse = /* @__PURE__ */ __name((reader, length) => {
      const code = reader.int32();
      const message2 = {
        name: "authenticationOk",
        length
      };
      switch (code) {
        case 0:
          break;
        case 3:
          if (message2.length === 8) {
            message2.name = "authenticationCleartextPassword";
          }
          break;
        case 5:
          if (message2.length === 12) {
            message2.name = "authenticationMD5Password";
            const salt = reader.bytes(4);
            return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
          }
          break;
        case 10:
          {
            message2.name = "authenticationSASL";
            message2.mechanisms = [];
            let mechanism;
            do {
              mechanism = reader.cstring();
              if (mechanism) {
                message2.mechanisms.push(mechanism);
              }
            } while (mechanism);
          }
          break;
        case 11:
          message2.name = "authenticationSASLContinue";
          message2.data = reader.string(length - 8);
          break;
        case 12:
          message2.name = "authenticationSASLFinal";
          message2.data = reader.string(length - 8);
          break;
        default:
          throw new Error("Unknown authenticationOk message type " + code);
      }
      return message2;
    }, "parseAuthenticationResponse");
    var parseErrorMessage = /* @__PURE__ */ __name((reader, name) => {
      const fields = {};
      let fieldType = reader.string(1);
      while (fieldType !== "\0") {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
      }
      const messageValue = fields.M;
      const message2 = name === "notice" ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
      message2.severity = fields.S;
      message2.code = fields.C;
      message2.detail = fields.D;
      message2.hint = fields.H;
      message2.position = fields.P;
      message2.internalPosition = fields.p;
      message2.internalQuery = fields.q;
      message2.where = fields.W;
      message2.schema = fields.s;
      message2.table = fields.t;
      message2.column = fields.c;
      message2.dataType = fields.d;
      message2.constraint = fields.n;
      message2.file = fields.F;
      message2.line = fields.L;
      message2.routine = fields.R;
      return message2;
    }, "parseErrorMessage");
  }
});

// node_modules/pg-protocol/dist/index.js
var require_dist = __commonJS({
  "node_modules/pg-protocol/dist/index.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DatabaseError = exports.serialize = void 0;
    exports.parse = parse;
    var messages_1 = require_messages();
    Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return messages_1.DatabaseError;
    }, "get") });
    var serializer_1 = require_serializer();
    Object.defineProperty(exports, "serialize", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return serializer_1.serialize;
    }, "get") });
    var parser_1 = require_parser();
    function parse(stream, callback) {
      const parser = new parser_1.Parser();
      stream.on("data", (buffer) => parser.parse(buffer, callback));
      return new Promise((resolve) => stream.on("end", () => resolve()));
    }
    __name(parse, "parse");
  }
});

// node-built-in-modules:net
import libDefault7 from "net";
var require_net = __commonJS({
  "node-built-in-modules:net"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault7;
  }
});

// node-built-in-modules:tls
import libDefault8 from "tls";
var require_tls = __commonJS({
  "node-built-in-modules:tls"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault8;
  }
});

// node_modules/pg-cloudflare/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/pg-cloudflare/dist/index.js"(exports) {
    "use strict";
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CloudflareSocket = void 0;
    var events_1 = require_events();
    var CloudflareSocket = class extends events_1.EventEmitter {
      static {
        __name(this, "CloudflareSocket");
      }
      constructor(ssl) {
        super();
        this.ssl = ssl;
        this.writable = false;
        this.destroyed = false;
        this._upgrading = false;
        this._upgraded = false;
        this._cfSocket = null;
        this._cfWriter = null;
        this._cfReader = null;
      }
      setNoDelay() {
        return this;
      }
      setKeepAlive() {
        return this;
      }
      ref() {
        return this;
      }
      unref() {
        return this;
      }
      async connect(port, host, connectListener) {
        try {
          log("connecting");
          if (connectListener)
            this.once("connect", connectListener);
          const options = this.ssl ? { secureTransport: "starttls" } : {};
          const mod = await import("cloudflare:sockets");
          const connect = mod.connect;
          this._cfSocket = connect(`${host}:${port}`, options);
          this._cfWriter = this._cfSocket.writable.getWriter();
          this._addClosedHandler();
          this._cfReader = this._cfSocket.readable.getReader();
          if (this.ssl) {
            this._listenOnce().catch((e) => this.emit("error", e));
          } else {
            this._listen().catch((e) => this.emit("error", e));
          }
          await this._cfWriter.ready;
          log("socket ready");
          this.writable = true;
          this.emit("connect");
          return this;
        } catch (e) {
          this.emit("error", e);
        }
      }
      async _listen() {
        while (true) {
          log("awaiting receive from CF socket");
          const { done, value } = await this._cfReader.read();
          log("CF socket received:", done, value);
          if (done) {
            log("done");
            break;
          }
          this.emit("data", Buffer.from(value));
        }
      }
      async _listenOnce() {
        log("awaiting first receive from CF socket");
        const { done, value } = await this._cfReader.read();
        log("First CF socket received:", done, value);
        this.emit("data", Buffer.from(value));
      }
      write(data, encoding = "utf8", callback = () => {
      }) {
        if (data.length === 0)
          return callback();
        if (typeof data === "string")
          data = Buffer.from(data, encoding);
        log("sending data direct:", data);
        this._cfWriter.write(data).then(() => {
          log("data sent");
          callback();
        }, (err) => {
          log("send error", err);
          callback(err);
        });
        return true;
      }
      end(data = Buffer.alloc(0), encoding = "utf8", callback = () => {
      }) {
        log("ending CF socket");
        this.write(data, encoding, (err) => {
          this._cfSocket.close();
          if (callback)
            callback(err);
        });
        return this;
      }
      destroy(reason) {
        log("destroying CF socket", reason);
        this.destroyed = true;
        return this.end();
      }
      startTls(options) {
        if (this._upgraded) {
          this.emit("error", "Cannot call `startTls()` more than once on a socket");
          return;
        }
        this._cfWriter.releaseLock();
        this._cfReader.releaseLock();
        this._upgrading = true;
        this._cfSocket = this._cfSocket.startTls(options);
        this._cfWriter = this._cfSocket.writable.getWriter();
        this._cfReader = this._cfSocket.readable.getReader();
        this._addClosedHandler();
        this._listen().catch((e) => this.emit("error", e));
      }
      _addClosedHandler() {
        this._cfSocket.closed.then(() => {
          if (!this._upgrading) {
            log("CF socket closed");
            this._cfSocket = null;
            this.emit("close");
          } else {
            this._upgrading = false;
            this._upgraded = true;
          }
        }).catch((e) => this.emit("error", e));
      }
    };
    exports.CloudflareSocket = CloudflareSocket;
    var debug = false;
    function dump(data) {
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        const buf = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(data);
        const hex = buf.toString("hex");
        const str = new TextDecoder().decode(data);
        return `
>>> STR: "${str.replace(/\n/g, "\\n")}"
>>> HEX: ${hex}
`;
      } else {
        return data;
      }
    }
    __name(dump, "dump");
    function log(...args) {
      debug && console.log(...args.map(dump));
    }
    __name(log, "log");
  }
});

// node_modules/pg/lib/stream.js
var require_stream = __commonJS({
  "node_modules/pg/lib/stream.js"(exports, module) {
    init_modules_watch_stub();
    var { getStream, getSecureStream } = getStreamFuncs();
    module.exports = {
      /**
       * Get a socket stream compatible with the current runtime environment.
       * @returns {Duplex}
       */
      getStream,
      /**
       * Get a TLS secured socket, compatible with the current environment,
       * using the socket and other settings given in `options`.
       * @returns {Duplex}
       */
      getSecureStream
    };
    function getNodejsStreamFuncs() {
      function getStream2(ssl) {
        const net = require_net();
        return new net.Socket();
      }
      __name(getStream2, "getStream");
      function getSecureStream2(options) {
        const tls = require_tls();
        return tls.connect(options);
      }
      __name(getSecureStream2, "getSecureStream");
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    __name(getNodejsStreamFuncs, "getNodejsStreamFuncs");
    function getCloudflareStreamFuncs() {
      function getStream2(ssl) {
        const { CloudflareSocket } = require_dist2();
        return new CloudflareSocket(ssl);
      }
      __name(getStream2, "getStream");
      function getSecureStream2(options) {
        options.socket.startTls(options);
        return options.socket;
      }
      __name(getSecureStream2, "getSecureStream");
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    __name(getCloudflareStreamFuncs, "getCloudflareStreamFuncs");
    function isCloudflareRuntime() {
      if (typeof navigator === "object" && navigator !== null && true) {
        return true;
      }
      if (typeof Response === "function") {
        const resp = new Response(null, { cf: { thing: true } });
        if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) {
          return true;
        }
      }
      return false;
    }
    __name(isCloudflareRuntime, "isCloudflareRuntime");
    function getStreamFuncs() {
      if (isCloudflareRuntime()) {
        return getCloudflareStreamFuncs();
      }
      return getNodejsStreamFuncs();
    }
    __name(getStreamFuncs, "getStreamFuncs");
  }
});

// node_modules/pg/lib/connection.js
var require_connection = __commonJS({
  "node_modules/pg/lib/connection.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var EventEmitter = require_events().EventEmitter;
    var { parse, serialize } = require_dist();
    var stream = require_stream();
    var { getStream } = stream;
    var flushBuffer = serialize.flush();
    var syncBuffer = serialize.sync();
    var endBuffer = serialize.end();
    var Connection2 = class extends EventEmitter {
      static {
        __name(this, "Connection");
      }
      constructor(config) {
        super();
        config = config || {};
        this.stream = config.stream || getStream(config.ssl);
        if (typeof this.stream === "function") {
          this.stream = this.stream(config);
        }
        this._keepAlive = config.keepAlive;
        this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis;
        this.parsedStatements = {};
        this.submittedNamedStatements = {};
        this.ssl = config.ssl || false;
        this.sslNegotiation = config.sslNegotiation || "postgres";
        this._ending = false;
        this._emitMessage = false;
        const self = this;
        this.on("newListener", function(eventName) {
          if (eventName === "message") {
            self._emitMessage = true;
          }
        });
      }
      connect(port, host) {
        const self = this;
        this._connecting = true;
        this.stream.setNoDelay(true);
        this.stream.connect(port, host);
        this.stream.once("connect", function() {
          if (self._keepAlive) {
            self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
          }
          self.emit("connect");
        });
        const reportStreamError = /* @__PURE__ */ __name(function(error) {
          if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
            return;
          }
          self.emit("error", error);
        }, "reportStreamError");
        this.stream.on("error", reportStreamError);
        this.stream.on("close", function() {
          self.emit("end");
        });
        if (!this.ssl) {
          return this.attachListeners(this.stream);
        }
        if (this.sslNegotiation === "direct") {
          return this.stream.once("connect", function() {
            self.upgradeToSSL(host, reportStreamError);
          });
        }
        this.stream.once("data", function(buffer) {
          const responseCode = buffer.toString("utf8");
          switch (responseCode) {
            case "S":
              break;
            case "N":
              self.stream.end();
              return self.emit("error", new Error("The server does not support SSL connections"));
            default:
              self.stream.end();
              return self.emit("error", new Error("There was an error establishing an SSL connection"));
          }
          self.upgradeToSSL(host, reportStreamError);
        });
      }
      upgradeToSSL(host, reportStreamError) {
        const self = this;
        const options = {
          socket: self.stream
        };
        if (self.ssl !== true) {
          Object.assign(options, self.ssl);
          if ("key" in self.ssl) {
            options.key = self.ssl.key;
          }
        }
        if (self.sslNegotiation === "direct") {
          options.ALPNProtocols = ["postgresql"];
        }
        const net = require_net();
        if (net.isIP && net.isIP(host) === 0) {
          options.servername = host;
        }
        try {
          self.stream = stream.getSecureStream(options);
        } catch (err) {
          return self.emit("error", err);
        }
        self.attachListeners(self.stream);
        self.stream.on("error", reportStreamError);
        self.emit("sslconnect");
      }
      attachListeners(stream2) {
        parse(stream2, (msg) => {
          const eventName = msg.name === "error" ? "errorMessage" : msg.name;
          if (this._emitMessage) {
            this.emit("message", msg);
          }
          this.emit(eventName, msg);
        });
      }
      requestSsl() {
        this.stream.write(serialize.requestSsl());
      }
      startup(config) {
        this.stream.write(serialize.startup(config));
      }
      cancel(processID, secretKey) {
        this._send(serialize.cancel(processID, secretKey));
      }
      password(password) {
        this._send(serialize.password(password));
      }
      sendSASLInitialResponseMessage(mechanism, initialResponse) {
        this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
      }
      sendSCRAMClientFinalMessage(additionalData) {
        this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
      }
      _send(buffer) {
        if (!this.stream.writable) {
          return false;
        }
        return this.stream.write(buffer);
      }
      query(text) {
        this._send(serialize.query(text));
      }
      // send parse message
      parse(query) {
        this._send(serialize.parse(query));
      }
      // send bind message
      bind(config) {
        this._send(serialize.bind(config));
      }
      // send execute message
      execute(config) {
        this._send(serialize.execute(config));
      }
      flush() {
        if (this.stream.writable) {
          this.stream.write(flushBuffer);
        }
      }
      sync() {
        this._ending = true;
        this._send(syncBuffer);
      }
      ref() {
        this.stream.ref();
      }
      unref() {
        this.stream.unref();
      }
      end() {
        this._ending = true;
        if (!this._connecting || !this.stream.writable) {
          this.stream.end();
          return;
        }
        return this.stream.write(endBuffer, () => {
          this.stream.end();
        });
      }
      close(msg) {
        this._send(serialize.close(msg));
      }
      describe(msg) {
        this._send(serialize.describe(msg));
      }
      sendCopyFromChunk(chunk) {
        this._send(serialize.copyData(chunk));
      }
      endCopyFrom() {
        this._send(serialize.copyDone());
      }
      sendCopyFail(msg) {
        this._send(serialize.copyFail(msg));
      }
    };
    module.exports = Connection2;
  }
});

// node-built-in-modules:path
import libDefault9 from "path";
var require_path = __commonJS({
  "node-built-in-modules:path"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault9;
  }
});

// node-built-in-modules:stream
import libDefault10 from "stream";
var require_stream2 = __commonJS({
  "node-built-in-modules:stream"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault10;
  }
});

// node-built-in-modules:string_decoder
import libDefault11 from "string_decoder";
var require_string_decoder = __commonJS({
  "node-built-in-modules:string_decoder"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault11;
  }
});

// node_modules/split2/index.js
var require_split2 = __commonJS({
  "node_modules/split2/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var { Transform } = require_stream2();
    var { StringDecoder } = require_string_decoder();
    var kLast = /* @__PURE__ */ Symbol("last");
    var kDecoder = /* @__PURE__ */ Symbol("decoder");
    function transform(chunk, enc, cb) {
      let list;
      if (this.overflow) {
        const buf = this[kDecoder].write(chunk);
        list = buf.split(this.matcher);
        if (list.length === 1) return cb();
        list.shift();
        this.overflow = false;
      } else {
        this[kLast] += this[kDecoder].write(chunk);
        list = this[kLast].split(this.matcher);
      }
      this[kLast] = list.pop();
      for (let i = 0; i < list.length; i++) {
        try {
          push(this, this.mapper(list[i]));
        } catch (error) {
          return cb(error);
        }
      }
      this.overflow = this[kLast].length > this.maxLength;
      if (this.overflow && !this.skipOverflow) {
        cb(new Error("maximum buffer reached"));
        return;
      }
      cb();
    }
    __name(transform, "transform");
    function flush(cb) {
      this[kLast] += this[kDecoder].end();
      if (this[kLast]) {
        try {
          push(this, this.mapper(this[kLast]));
        } catch (error) {
          return cb(error);
        }
      }
      cb();
    }
    __name(flush, "flush");
    function push(self, val) {
      if (val !== void 0) {
        self.push(val);
      }
    }
    __name(push, "push");
    function noop(incoming) {
      return incoming;
    }
    __name(noop, "noop");
    function split(matcher, mapper, options) {
      matcher = matcher || /\r?\n/;
      mapper = mapper || noop;
      options = options || {};
      switch (arguments.length) {
        case 1:
          if (typeof matcher === "function") {
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof matcher === "object" && !(matcher instanceof RegExp) && !matcher[Symbol.split]) {
            options = matcher;
            matcher = /\r?\n/;
          }
          break;
        case 2:
          if (typeof matcher === "function") {
            options = mapper;
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof mapper === "object") {
            options = mapper;
            mapper = noop;
          }
      }
      options = Object.assign({}, options);
      options.autoDestroy = true;
      options.transform = transform;
      options.flush = flush;
      options.readableObjectMode = true;
      const stream = new Transform(options);
      stream[kLast] = "";
      stream[kDecoder] = new StringDecoder("utf8");
      stream.matcher = matcher;
      stream.mapper = mapper;
      stream.maxLength = options.maxLength;
      stream.skipOverflow = options.skipOverflow || false;
      stream.overflow = false;
      stream._destroy = function(err, cb) {
        this._writableState.errorEmitted = false;
        cb(err);
      };
      return stream;
    }
    __name(split, "split");
    module.exports = split;
  }
});

// node_modules/pgpass/lib/helper.js
var require_helper = __commonJS({
  "node_modules/pgpass/lib/helper.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var path = require_path();
    var Stream = require_stream2().Stream;
    var split = require_split2();
    var util = require_util();
    var defaultPort = 5432;
    var isWin = process.platform === "win32";
    var warnStream = process.stderr;
    var S_IRWXG = 56;
    var S_IRWXO = 7;
    var S_IFMT = 61440;
    var S_IFREG = 32768;
    function isRegFile(mode) {
      return (mode & S_IFMT) == S_IFREG;
    }
    __name(isRegFile, "isRegFile");
    var fieldNames = ["host", "port", "database", "user", "password"];
    var nrOfFields = fieldNames.length;
    var passKey = fieldNames[nrOfFields - 1];
    function warn() {
      var isWritable = warnStream instanceof Stream && true === warnStream.writable;
      if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write(util.format.apply(util, args));
      }
    }
    __name(warn, "warn");
    Object.defineProperty(module.exports, "isWin", {
      get: /* @__PURE__ */ __name(function() {
        return isWin;
      }, "get"),
      set: /* @__PURE__ */ __name(function(val) {
        isWin = val;
      }, "set")
    });
    module.exports.warnTo = function(stream) {
      var old = warnStream;
      warnStream = stream;
      return old;
    };
    module.exports.getFileName = function(rawEnv) {
      var env = rawEnv || process.env;
      var file = env.PGPASSFILE || (isWin ? path.join(env.APPDATA || "./", "postgresql", "pgpass.conf") : path.join(env.HOME || "./", ".pgpass"));
      return file;
    };
    module.exports.usePgPass = function(stats, fname) {
      if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) {
        return false;
      }
      if (isWin) {
        return true;
      }
      fname = fname || "<unkn>";
      if (!isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
      }
      if (stats.mode & (S_IRWXG | S_IRWXO)) {
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
      }
      return true;
    };
    var matcher = module.exports.match = function(connInfo, entry) {
      return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
        if (idx == 1) {
          if (Number(connInfo[field] || defaultPort) === Number(entry[field])) {
            return prev && true;
          }
        }
        return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
      }, true);
    };
    module.exports.getPassword = function(connInfo, stream, cb) {
      var pass;
      var lineStream = stream.pipe(split());
      function onLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
          pass = entry[passKey];
          lineStream.end();
        }
      }
      __name(onLine, "onLine");
      var onEnd = /* @__PURE__ */ __name(function() {
        stream.destroy();
        cb(pass);
      }, "onEnd");
      var onErr = /* @__PURE__ */ __name(function(err) {
        stream.destroy();
        warn("WARNING: error on reading file: %s", err);
        cb(void 0);
      }, "onErr");
      stream.on("error", onErr);
      lineStream.on("data", onLine).on("end", onEnd).on("error", onErr);
    };
    var parseLine = module.exports.parseLine = function(line) {
      if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
      }
      var curChar = "";
      var prevChar = "";
      var fieldIdx = 0;
      var startIdx = 0;
      var endIdx = 0;
      var obj = {};
      var isLastField = false;
      var addToObj = /* @__PURE__ */ __name(function(idx, i0, i1) {
        var field = line.substring(i0, i1);
        if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) {
          field = field.replace(/\\([:\\])/g, "$1");
        }
        obj[fieldNames[idx]] = field;
      }, "addToObj");
      for (var i = 0; i < line.length - 1; i += 1) {
        curChar = line.charAt(i + 1);
        prevChar = line.charAt(i);
        isLastField = fieldIdx == nrOfFields - 1;
        if (isLastField) {
          addToObj(fieldIdx, startIdx);
          break;
        }
        if (i >= 0 && curChar == ":" && prevChar !== "\\") {
          addToObj(fieldIdx, startIdx, i + 1);
          startIdx = i + 2;
          fieldIdx += 1;
        }
      }
      obj = Object.keys(obj).length === nrOfFields ? obj : null;
      return obj;
    };
    var isValidEntry = module.exports.isValidEntry = function(entry) {
      var rules = {
        // host
        0: function(x) {
          return x.length > 0;
        },
        // port
        1: function(x) {
          if (x === "*") {
            return true;
          }
          x = Number(x);
          return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
        },
        // database
        2: function(x) {
          return x.length > 0;
        },
        // username
        3: function(x) {
          return x.length > 0;
        },
        // password
        4: function(x) {
          return x.length > 0;
        }
      };
      for (var idx = 0; idx < fieldNames.length; idx += 1) {
        var rule = rules[idx];
        var value = entry[fieldNames[idx]] || "";
        var res = rule(value);
        if (!res) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/pgpass/lib/index.js
var require_lib = __commonJS({
  "node_modules/pgpass/lib/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var path = require_path();
    var fs = require_fs();
    var helper = require_helper();
    module.exports = function(connInfo, cb) {
      var file = helper.getFileName();
      fs.stat(file, function(err, stat) {
        if (err || !helper.usePgPass(stat, file)) {
          return cb(void 0);
        }
        var st = fs.createReadStream(file);
        helper.getPassword(connInfo, st, cb);
      });
    };
    module.exports.warnTo = helper.warnTo;
  }
});

// node_modules/pg/lib/client.js
var require_client = __commonJS({
  "node_modules/pg/lib/client.js"(exports, module) {
    init_modules_watch_stub();
    var EventEmitter = require_events().EventEmitter;
    var utils = require_utils();
    var nodeUtils = require_util();
    var sasl = require_sasl();
    var TypeOverrides2 = require_type_overrides();
    var ConnectionParameters = require_connection_parameters();
    var Query2 = require_query();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var crypto2 = require_utils2();
    var activeQueryDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.activeQuery is deprecated and will be removed in pg@9.0"
    );
    var queryQueueDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.queryQueue is deprecated and will be removed in pg@9.0."
    );
    var pgPassDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code."
    );
    var byoPromiseDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0."
    );
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    function coerceNumberOrDefault(value, defaultValue) {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : defaultValue;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
      }
      return defaultValue;
    }
    __name(coerceNumberOrDefault, "coerceNumberOrDefault");
    var Client2 = class extends EventEmitter {
      static {
        __name(this, "Client");
      }
      constructor(config) {
        super();
        this.connectionParameters = new ConnectionParameters(config);
        this.user = this.connectionParameters.user;
        this.database = this.connectionParameters.database;
        this.port = this.connectionParameters.port;
        this.host = this.connectionParameters.host;
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: this.connectionParameters.password
        });
        this.replication = this.connectionParameters.replication;
        const c = config || {};
        if (c.Promise) {
          byoPromiseDeprecationNotice();
        }
        this._Promise = c.Promise || global.Promise;
        this._types = new TypeOverrides2(c.types);
        this._ending = false;
        this._ended = false;
        this._connecting = false;
        this._connected = false;
        this._connectionError = false;
        this._queryable = true;
        this._activeQuery = null;
        this._txStatus = null;
        this.enableChannelBinding = Boolean(c.enableChannelBinding);
        this.scramMaxIterations = coerceNumberOrDefault(c.scramMaxIterations, sasl.DEFAULT_MAX_SCRAM_ITERATIONS);
        this.connection = c.connection || new Connection2({
          stream: c.stream,
          ssl: this.connectionParameters.ssl,
          sslNegotiation: this.connectionParameters.sslnegotiation,
          keepAlive: c.keepAlive || false,
          keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
          encoding: this.connectionParameters.client_encoding || "utf8"
        });
        this._queryQueue = [];
        this._sentQueryQueue = [];
        this.pipeline = Boolean(c.pipeline);
        this.binary = c.binary || defaults2.binary;
        this.processID = null;
        this.secretKey = null;
        this.ssl = this.connectionParameters.ssl || false;
        this.sslNegotiation = this.connectionParameters.sslnegotiation || "postgres";
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
      }
      get activeQuery() {
        activeQueryDeprecationNotice();
        return this._activeQuery;
      }
      set activeQuery(val) {
        activeQueryDeprecationNotice();
        this._activeQuery = val;
      }
      _getActiveQuery() {
        return this._activeQuery;
      }
      _errorAllQueries(err) {
        const enqueueError = /* @__PURE__ */ __name((query) => {
          process.nextTick(() => {
            query.handleError(err, this.connection);
          });
        }, "enqueueError");
        const activeQuery = this._getActiveQuery();
        if (activeQuery) {
          enqueueError(activeQuery);
          this._activeQuery = null;
        }
        this._sentQueryQueue.forEach(enqueueError);
        this._sentQueryQueue.length = 0;
        this._queryQueue.forEach(enqueueError);
        this._queryQueue.length = 0;
      }
      _connect(callback) {
        const self = this;
        const con = this.connection;
        this._connectionCallback = callback;
        if (this._connecting || this._connected) {
          const err = new Error("Client has already been connected. You cannot reuse a client.");
          process.nextTick(() => {
            callback(err);
          });
          return;
        }
        this._connecting = true;
        if (this._connectionTimeoutMillis > 0) {
          this.connectionTimeoutHandle = setTimeout(() => {
            con._ending = true;
            con.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis);
          if (this.connectionTimeoutHandle.unref) {
            this.connectionTimeoutHandle.unref();
          }
        }
        if (this.host && this.host.indexOf("/") === 0) {
          con.connect(this.host + "/.s.PGSQL." + this.port);
        } else {
          con.connect(this.port, this.host);
        }
        con.on("connect", function() {
          if (self.ssl) {
            if (self.sslNegotiation !== "direct") {
              con.requestSsl();
            }
          } else {
            con.startup(self.getStartupConf());
          }
        });
        con.on("sslconnect", function() {
          con.startup(self.getStartupConf());
        });
        this._attachListeners(con);
        con.once("end", () => {
          const error = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
          clearTimeout(this.connectionTimeoutHandle);
          this._errorAllQueries(error);
          this._ended = true;
          if (!this._ending) {
            if (this._connecting && !this._connectionError) {
              if (this._connectionCallback) {
                this._connectionCallback(error);
              } else {
                this._handleErrorEvent(error);
              }
            } else if (!this._connectionError) {
              this._handleErrorEvent(error);
            }
          }
          process.nextTick(() => {
            this.emit("end");
          });
        });
      }
      connect(callback) {
        if (callback) {
          this._connect(callback);
          return;
        }
        return new this._Promise((resolve, reject) => {
          this._connect((error) => {
            if (error) {
              reject(error);
            } else {
              resolve(this);
            }
          });
        });
      }
      _attachListeners(con) {
        con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
        con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
        con.on("authenticationSASL", this._handleAuthSASL.bind(this));
        con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
        con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
        con.on("backendKeyData", this._handleBackendKeyData.bind(this));
        con.on("error", this._handleErrorEvent.bind(this));
        con.on("errorMessage", this._handleErrorMessage.bind(this));
        con.on("readyForQuery", this._handleReadyForQuery.bind(this));
        con.on("notice", this._handleNotice.bind(this));
        con.on("rowDescription", this._handleRowDescription.bind(this));
        con.on("dataRow", this._handleDataRow.bind(this));
        con.on("portalSuspended", this._handlePortalSuspended.bind(this));
        con.on("emptyQuery", this._handleEmptyQuery.bind(this));
        con.on("commandComplete", this._handleCommandComplete.bind(this));
        con.on("parseComplete", this._handleParseComplete.bind(this));
        con.on("copyInResponse", this._handleCopyInResponse.bind(this));
        con.on("copyData", this._handleCopyData.bind(this));
        con.on("notification", this._handleNotification.bind(this));
      }
      _getPassword(cb) {
        const con = this.connection;
        if (typeof this.password === "function") {
          this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((pass) => {
            if (pass !== void 0) {
              if (typeof pass !== "string") {
                con.emit("error", new TypeError("Password must be a string"));
                return;
              }
              this.connectionParameters.password = this.password = pass;
            } else {
              this.connectionParameters.password = this.password = null;
            }
            cb();
          }).catch((err) => {
            con.emit("error", err);
          });
        } else if (this.password !== null) {
          cb();
        } else {
          try {
            const pgPass = require_lib();
            pgPass(this.connectionParameters, (pass) => {
              if (void 0 !== pass) {
                pgPassDeprecationNotice();
                this.connectionParameters.password = this.password = pass;
              }
              cb();
            });
          } catch (e) {
            this.emit("error", e);
          }
        }
      }
      _handleAuthCleartextPassword(msg) {
        this._getPassword(() => {
          this.connection.password(this.password);
        });
      }
      _handleAuthMD5Password(msg) {
        this._getPassword(async () => {
          try {
            const hashedPassword = await crypto2.postgresMd5PasswordHash(this.user, this.password, msg.salt);
            this.connection.password(hashedPassword);
          } catch (e) {
            this.emit("error", e);
          }
        });
      }
      _handleAuthSASL(msg) {
        this._getPassword(() => {
          try {
            this.saslSession = sasl.startSession(
              msg.mechanisms,
              this.enableChannelBinding && this.connection.stream,
              this.scramMaxIterations
            );
            this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
          } catch (err) {
            this.connection.emit("error", err);
          }
        });
      }
      async _handleAuthSASLContinue(msg) {
        try {
          await sasl.continueSession(
            this.saslSession,
            this.password,
            msg.data,
            this.enableChannelBinding && this.connection.stream
          );
          this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleAuthSASLFinal(msg) {
        try {
          sasl.finalizeSession(this.saslSession, msg.data);
          this.saslSession = null;
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleBackendKeyData(msg) {
        this.processID = msg.processID;
        this.secretKey = msg.secretKey;
      }
      _handleReadyForQuery(msg) {
        if (this._connecting) {
          this._connecting = false;
          this._connected = true;
          clearTimeout(this.connectionTimeoutHandle);
          if (this._connectionCallback) {
            this._connectionCallback(null, this);
            this._connectionCallback = null;
          }
          this.emit("connect");
        }
        const activeQuery = this._getActiveQuery();
        this._activeQuery = null;
        this._txStatus = msg?.status ?? null;
        this.readyForQuery = true;
        if (activeQuery) {
          activeQuery.handleReadyForQuery(this.connection);
        }
        this._pulseQueryQueue();
      }
      // if we receive an error event or error message
      // during the connection process we handle it here
      _handleErrorWhileConnecting(err) {
        if (this._connectionError) {
          return;
        }
        this._connectionError = true;
        clearTimeout(this.connectionTimeoutHandle);
        if (this._connectionCallback) {
          return this._connectionCallback(err);
        }
        this.emit("error", err);
      }
      // if we're connected and we receive an error event from the connection
      // this means the socket is dead - do a hard abort of all queries and emit
      // the socket error on the client as well
      _handleErrorEvent(err) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(err);
        }
        this._queryable = false;
        this._errorAllQueries(err);
        this.emit("error", err);
      }
      // handle error messages from the postgres backend
      _handleErrorMessage(msg) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(msg);
        }
        const activeQuery = this._getActiveQuery();
        if (!activeQuery) {
          this._handleErrorEvent(msg);
          return;
        }
        this._activeQuery = null;
        if (activeQuery.name) {
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
        activeQuery.handleError(msg, this.connection);
      }
      _handleRowDescription(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected rowDescription message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleRowDescription(msg);
      }
      _handleDataRow(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected dataRow message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleDataRow(msg);
      }
      _handlePortalSuspended(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected portalSuspended message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handlePortalSuspended(this.connection);
      }
      _handleEmptyQuery(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected emptyQuery message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleEmptyQuery(this.connection);
      }
      _handleCommandComplete(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected commandComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCommandComplete(msg, this.connection);
      }
      _handleParseComplete() {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected parseComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        if (activeQuery.name) {
          this.connection.parsedStatements[activeQuery.name] = activeQuery.text;
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
      }
      _handleCopyInResponse(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyInResponse message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyInResponse(this.connection);
      }
      _handleCopyData(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyData message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyData(msg, this.connection);
      }
      _handleNotification(msg) {
        this.emit("notification", msg);
      }
      _handleNotice(msg) {
        this.emit("notice", msg);
      }
      getStartupConf() {
        const params = this.connectionParameters;
        const data = {
          user: params.user,
          database: params.database
        };
        const appName = params.application_name || params.fallback_application_name;
        if (appName) {
          data.application_name = appName;
        }
        if (params.replication) {
          data.replication = "" + params.replication;
        }
        if (params.statement_timeout) {
          data.statement_timeout = String(parseInt(params.statement_timeout, 10));
        }
        if (params.lock_timeout) {
          data.lock_timeout = String(parseInt(params.lock_timeout, 10));
        }
        if (params.idle_in_transaction_session_timeout) {
          data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
        }
        if (params.options) {
          data.options = params.options;
        }
        return data;
      }
      cancel(client, query) {
        if (client.activeQuery === query) {
          const con = this.connection;
          if (this.host && this.host.indexOf("/") === 0) {
            con.connect(this.host + "/.s.PGSQL." + this.port);
          } else {
            con.connect(this.port, this.host);
          }
          con.on("connect", function() {
            con.cancel(client.processID, client.secretKey);
          });
        } else if (client._queryQueue.indexOf(query) !== -1) {
          client._queryQueue.splice(client._queryQueue.indexOf(query), 1);
        } else if (client._sentQueryQueue.indexOf(query) !== -1) {
          query.callback = () => {
          };
        }
      }
      setTypeParser(oid, format2, parseFn) {
        return this._types.setTypeParser(oid, format2, parseFn);
      }
      getTypeParser(oid, format2) {
        return this._types.getTypeParser(oid, format2);
      }
      // escapeIdentifier and escapeLiteral moved to utility functions & exported
      // on PG
      // re-exported here for backwards compatibility
      escapeIdentifier(str) {
        return utils.escapeIdentifier(str);
      }
      escapeLiteral(str) {
        return utils.escapeLiteral(str);
      }
      _pulseQueryQueue() {
        if (this.pipeline) {
          this._pulsePipelinedQueryQueue();
          return;
        }
        if (this.readyForQuery === true) {
          this._activeQuery = this._queryQueue.shift();
          const activeQuery = this._getActiveQuery();
          if (activeQuery) {
            this.readyForQuery = false;
            this.hasExecuted = true;
            const queryError = activeQuery.submit(this.connection);
            if (queryError) {
              process.nextTick(() => {
                activeQuery.handleError(queryError, this.connection);
                this.readyForQuery = true;
                this._pulseQueryQueue();
              });
            }
          } else if (this.hasExecuted) {
            this._activeQuery = null;
            this.emit("drain");
          }
        }
      }
      _pulsePipelinedQueryQueue() {
        if (!this._connected || !this._queryable) {
          return;
        }
        while (this._queryQueue.length > 0) {
          const query = this._queryQueue.shift();
          this.hasExecuted = true;
          const queryError = query.submit(this.connection);
          if (queryError) {
            process.nextTick(() => {
              query.handleError(queryError, this.connection);
            });
            continue;
          }
          this._sentQueryQueue.push(query);
        }
        if (this.readyForQuery && !this._activeQuery && this._sentQueryQueue.length > 0) {
          this._activeQuery = this._sentQueryQueue.shift();
          this.readyForQuery = false;
        }
        if (!this._activeQuery && this._sentQueryQueue.length === 0 && this._queryQueue.length === 0 && this.hasExecuted) {
          this.emit("drain");
        }
      }
      query(config, values, callback) {
        let query;
        let result;
        if (config == null) {
          throw new TypeError("Client was passed a null or undefined query");
        }
        if (typeof config.submit === "function") {
          result = query = config;
          if (!query.callback) {
            if (typeof values === "function") {
              query.callback = values;
            } else if (callback) {
              query.callback = callback;
            }
          }
        } else {
          query = new Query2(config, values, callback);
          if (!query.callback) {
            result = new this._Promise((resolve, reject) => {
              query.callback = (err, res) => err ? reject(err) : resolve(res);
            }).catch((err) => {
              Error.captureStackTrace(err);
              throw err;
            });
          } else if (typeof query.callback !== "function") {
            throw new TypeError("callback is not a function");
          }
        }
        const readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        if (readTimeout) {
          const queryCallback = query.callback || (() => {
          });
          const readTimeoutTimer = setTimeout(() => {
            const error = new Error("Query read timeout");
            process.nextTick(() => {
              query.handleError(error, this.connection);
            });
            queryCallback(error);
            query.callback = () => {
            };
            const index = this._queryQueue.indexOf(query);
            if (index > -1) {
              this._queryQueue.splice(index, 1);
            } else if (this.pipeline) {
              this.connection.stream.destroy();
              return;
            }
            this._pulseQueryQueue();
          }, readTimeout);
          query.callback = (err, res) => {
            clearTimeout(readTimeoutTimer);
            queryCallback(err, res);
          };
        }
        if (this.binary && !query.binary) {
          query.binary = true;
        }
        if (query._result && !query._result._types) {
          query._result._types = this._types;
        }
        if (!this._queryable) {
          process.nextTick(() => {
            query.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._ending) {
          process.nextTick(() => {
            query.handleError(new Error("Client was closed and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._queryQueue.length > 0 && !this.pipeline) {
          queryQueueLengthDeprecationNotice();
        }
        this._queryQueue.push(query);
        this._pulseQueryQueue();
        return result;
      }
      ref() {
        this.connection.ref();
      }
      unref() {
        this.connection.unref();
      }
      getTransactionStatus() {
        return this._txStatus;
      }
      end(cb) {
        this._ending = true;
        if (!this.connection._connecting || this._ended) {
          if (cb) {
            cb();
            return;
          } else {
            return this._Promise.resolve();
          }
        }
        if (!this._queryable) {
          this.connection.stream.destroy();
        } else if (this.pipeline && (this._getActiveQuery() || this._sentQueryQueue.length > 0 || this._queryQueue.length > 0)) {
          this.once("drain", () => this.connection.end());
        } else if (this._getActiveQuery()) {
          this.connection.stream.destroy();
        } else {
          this.connection.end();
        }
        if (cb) {
          this.connection.once("end", cb);
        } else {
          return new this._Promise((resolve) => {
            this.connection.once("end", resolve);
          });
        }
      }
      get queryQueue() {
        queryQueueDeprecationNotice();
        return this._queryQueue;
      }
    };
    Client2.Query = Query2;
    module.exports = Client2;
  }
});

// node_modules/pg-pool/index.js
var require_pg_pool = __commonJS({
  "node_modules/pg-pool/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var EventEmitter = require_events().EventEmitter;
    var NOOP = /* @__PURE__ */ __name(function() {
    }, "NOOP");
    var removeWhere = /* @__PURE__ */ __name((list, predicate) => {
      const i = list.findIndex(predicate);
      return i === -1 ? void 0 : list.splice(i, 1)[0];
    }, "removeWhere");
    var IdleItem = class {
      static {
        __name(this, "IdleItem");
      }
      constructor(client, idleListener, timeoutId) {
        this.client = client;
        this.idleListener = idleListener;
        this.timeoutId = timeoutId;
      }
    };
    var PendingItem = class {
      static {
        __name(this, "PendingItem");
      }
      constructor(callback) {
        this.callback = callback;
      }
    };
    function throwOnDoubleRelease() {
      throw new Error("Release called on client which has already been released to the pool.");
    }
    __name(throwOnDoubleRelease, "throwOnDoubleRelease");
    function promisify(Promise2, callback) {
      if (callback) {
        return { callback, result: void 0 };
      }
      let rej;
      let res;
      const cb = /* @__PURE__ */ __name(function(err, client) {
        err ? rej(err) : res(client);
      }, "cb");
      const result = new Promise2(function(resolve, reject) {
        res = resolve;
        rej = reject;
      }).catch((err) => {
        Error.captureStackTrace(err);
        throw err;
      });
      return { callback: cb, result };
    }
    __name(promisify, "promisify");
    function makeIdleListener(pool, client) {
      return /* @__PURE__ */ __name(function idleListener(err) {
        err.client = client;
        client.removeListener("error", idleListener);
        client.on("error", () => {
          pool.log("additional client error after disconnection due to error", err);
        });
        pool._remove(client);
        pool.emit("error", err, client);
      }, "idleListener");
    }
    __name(makeIdleListener, "makeIdleListener");
    var Pool2 = class extends EventEmitter {
      static {
        __name(this, "Pool");
      }
      constructor(options, Client2) {
        super();
        this.options = Object.assign({}, options);
        if (options != null && "password" in options) {
          Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: options.password
          });
        }
        if (options != null && options.ssl && options.ssl.key) {
          Object.defineProperty(this.options.ssl, "key", {
            enumerable: false
          });
        }
        this.options.max = this.options.max || this.options.poolSize || 10;
        this.options.min = this.options.min || 0;
        this.options.maxUses = this.options.maxUses || Infinity;
        this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
        this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
        this.log = this.options.log || function() {
        };
        this.Client = this.options.Client || Client2 || require_lib2().Client;
        this.Promise = this.options.Promise || global.Promise;
        if (typeof this.options.idleTimeoutMillis === "undefined") {
          this.options.idleTimeoutMillis = 1e4;
        }
        this._clients = [];
        this._idle = [];
        this._expired = /* @__PURE__ */ new WeakSet();
        this._pendingQueue = [];
        this._endCallback = void 0;
        this.ending = false;
        this.ended = false;
      }
      _promiseTry(f) {
        const Promise2 = this.Promise;
        if (typeof Promise2.try === "function") {
          return Promise2.try(f);
        }
        return new Promise2((resolve) => resolve(f()));
      }
      _isFull() {
        return this._clients.length >= this.options.max;
      }
      _isAboveMin() {
        return this._clients.length > this.options.min;
      }
      _pulseQueue() {
        this.log("pulse queue");
        if (this.ended) {
          this.log("pulse queue ended");
          return;
        }
        if (this.ending) {
          this.log("pulse queue on ending");
          if (this._idle.length) {
            this._idle.slice().map((item) => {
              this._remove(item.client);
            });
          }
          if (!this._clients.length) {
            this.ended = true;
            this._endCallback();
          }
          return;
        }
        if (!this._pendingQueue.length) {
          this.log("no queued requests");
          return;
        }
        if (!this._idle.length && this._isFull()) {
          return;
        }
        const pendingItem = this._pendingQueue.shift();
        if (this._idle.length) {
          const idleItem = this._idle.pop();
          clearTimeout(idleItem.timeoutId);
          const client = idleItem.client;
          client.ref && client.ref();
          const idleListener = idleItem.idleListener;
          return this._acquireClient(client, pendingItem, idleListener, false);
        }
        if (!this._isFull()) {
          return this.newClient(pendingItem);
        }
        throw new Error("unexpected condition");
      }
      _remove(client, callback) {
        const removed = removeWhere(this._idle, (item) => item.client === client);
        if (removed !== void 0) {
          clearTimeout(removed.timeoutId);
        }
        this._clients = this._clients.filter((c) => c !== client);
        const context = this;
        client.end(() => {
          context.emit("remove", client);
          if (typeof callback === "function") {
            callback();
          }
        });
      }
      connect(cb) {
        if (this.ending) {
          const err = new Error("Cannot use a pool after calling end on the pool");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        const response = promisify(this.Promise, cb);
        const result = response.result;
        if (this._isFull() || this._idle.length) {
          if (this._idle.length) {
            process.nextTick(() => this._pulseQueue());
          }
          if (!this.options.connectionTimeoutMillis) {
            this._pendingQueue.push(new PendingItem(response.callback));
            return result;
          }
          const queueCallback = /* @__PURE__ */ __name((err, res, done) => {
            clearTimeout(tid);
            response.callback(err, res, done);
          }, "queueCallback");
          const pendingItem = new PendingItem(queueCallback);
          const tid = setTimeout(() => {
            removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
            pendingItem.timedOut = true;
            response.callback(new Error("timeout exceeded when trying to connect"));
          }, this.options.connectionTimeoutMillis);
          if (tid.unref) {
            tid.unref();
          }
          this._pendingQueue.push(pendingItem);
          return result;
        }
        this.newClient(new PendingItem(response.callback));
        return result;
      }
      newClient(pendingItem) {
        const client = new this.Client(this.options);
        this._clients.push(client);
        const idleListener = makeIdleListener(this, client);
        this.log("checking client timeout");
        let tid;
        let timeoutHit = false;
        if (this.options.connectionTimeoutMillis) {
          tid = setTimeout(() => {
            if (client.connection) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.connection.stream.destroy();
            } else if (!client.isConnected()) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.end();
            }
          }, this.options.connectionTimeoutMillis);
        }
        this.log("connecting new client");
        client.connect((err) => {
          if (tid) {
            clearTimeout(tid);
          }
          client.on("error", idleListener);
          if (err) {
            this.log("client failed to connect", err);
            this._clients = this._clients.filter((c) => c !== client);
            if (timeoutHit) {
              err = new Error("Connection terminated due to connection timeout", { cause: err });
            }
            this._pulseQueue();
            if (!pendingItem.timedOut) {
              pendingItem.callback(err, void 0, NOOP);
            }
          } else {
            this.log("new client connected");
            if (this.options.onConnect) {
              this._promiseTry(() => this.options.onConnect(client)).then(
                () => {
                  this._afterConnect(client, pendingItem, idleListener);
                },
                (hookErr) => {
                  this._clients = this._clients.filter((c) => c !== client);
                  client.end(() => {
                    this._pulseQueue();
                    if (!pendingItem.timedOut) {
                      pendingItem.callback(hookErr, void 0, NOOP);
                    }
                  });
                }
              );
              return;
            }
            return this._afterConnect(client, pendingItem, idleListener);
          }
        });
      }
      _afterConnect(client, pendingItem, idleListener) {
        if (this.options.maxLifetimeSeconds !== 0) {
          const maxLifetimeTimeout = setTimeout(() => {
            this.log("ending client due to expired lifetime");
            this._expired.add(client);
            const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client);
            if (idleIndex !== -1) {
              this._acquireClient(
                client,
                new PendingItem((err, client2, clientRelease) => clientRelease()),
                idleListener,
                false
              );
            }
          }, this.options.maxLifetimeSeconds * 1e3);
          maxLifetimeTimeout.unref();
          client.once("end", () => clearTimeout(maxLifetimeTimeout));
        }
        return this._acquireClient(client, pendingItem, idleListener, true);
      }
      // acquire a client for a pending work item
      _acquireClient(client, pendingItem, idleListener, isNew) {
        if (isNew) {
          this.emit("connect", client);
        }
        this.emit("acquire", client);
        client.release = this._releaseOnce(client, idleListener);
        client.removeListener("error", idleListener);
        if (!pendingItem.timedOut) {
          if (isNew && this.options.verify) {
            this.options.verify(client, (err) => {
              if (err) {
                client.release(err);
                return pendingItem.callback(err, void 0, NOOP);
              }
              pendingItem.callback(void 0, client, client.release);
            });
          } else {
            pendingItem.callback(void 0, client, client.release);
          }
        } else {
          if (isNew && this.options.verify) {
            this.options.verify(client, client.release);
          } else {
            client.release();
          }
        }
      }
      // returns a function that wraps _release and throws if called more than once
      _releaseOnce(client, idleListener) {
        let released = false;
        return (err) => {
          if (released) {
            throwOnDoubleRelease();
          }
          released = true;
          this._release(client, idleListener, err);
        };
      }
      // release a client back to the poll, include an error
      // to remove it from the pool
      _release(client, idleListener, err) {
        client.on("error", idleListener);
        client._poolUseCount = (client._poolUseCount || 0) + 1;
        this.emit("release", err, client);
        if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
          if (client._poolUseCount >= this.options.maxUses) {
            this.log("remove expended client");
          }
          return this._remove(client, this._pulseQueue.bind(this));
        }
        const isExpired = this._expired.has(client);
        if (isExpired) {
          this.log("remove expired client");
          this._expired.delete(client);
          return this._remove(client, this._pulseQueue.bind(this));
        }
        let tid;
        if (this.options.idleTimeoutMillis && this._isAboveMin()) {
          tid = setTimeout(() => {
            if (this._isAboveMin()) {
              this.log("remove idle client");
              this._remove(client, this._pulseQueue.bind(this));
            }
          }, this.options.idleTimeoutMillis);
          if (this.options.allowExitOnIdle) {
            tid.unref();
          }
        }
        if (this.options.allowExitOnIdle) {
          client.unref();
        }
        this._idle.push(new IdleItem(client, idleListener, tid));
        this._pulseQueue();
      }
      query(text, values, cb) {
        if (typeof text === "function") {
          const response2 = promisify(this.Promise, text);
          setImmediate(function() {
            return response2.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
          });
          return response2.result;
        }
        if (typeof values === "function") {
          cb = values;
          values = void 0;
        }
        const response = promisify(this.Promise, cb);
        cb = response.callback;
        this.connect((err, client) => {
          if (err) {
            return cb(err);
          }
          let clientReleased = false;
          const onError = /* @__PURE__ */ __name((err2) => {
            if (clientReleased) {
              return;
            }
            clientReleased = true;
            client.release(err2);
            cb(err2);
          }, "onError");
          client.once("error", onError);
          this.log("dispatching query");
          try {
            client.query(text, values, (err2, res) => {
              this.log("query dispatched");
              client.removeListener("error", onError);
              if (clientReleased) {
                return;
              }
              clientReleased = true;
              client.release(err2);
              if (err2) {
                return cb(err2);
              }
              return cb(void 0, res);
            });
          } catch (err2) {
            client.release(err2);
            return cb(err2);
          }
        });
        return response.result;
      }
      end(cb) {
        this.log("ending");
        if (this.ending) {
          const err = new Error("Called end on pool more than once");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        this.ending = true;
        const promised = promisify(this.Promise, cb);
        this._endCallback = promised.callback;
        this._pulseQueue();
        return promised.result;
      }
      get waitingCount() {
        return this._pendingQueue.length;
      }
      get idleCount() {
        return this._idle.length;
      }
      get expiredCount() {
        return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0);
      }
      get totalCount() {
        return this._clients.length;
      }
    };
    module.exports = Pool2;
  }
});

// node_modules/pg/lib/native/query.js
var require_query2 = __commonJS({
  "node_modules/pg/lib/native/query.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var EventEmitter = require_events().EventEmitter;
    var util = require_util();
    var utils = require_utils();
    var NativeQuery = module.exports = function(config, values, callback) {
      EventEmitter.call(this);
      config = utils.normalizeQueryConfig(config, values, callback);
      this.text = config.text;
      this.values = config.values;
      this.name = config.name;
      this.queryMode = config.queryMode;
      this.callback = config.callback;
      this.state = "new";
      this._arrayMode = config.rowMode === "array";
      this._emitRowEvents = false;
      this.on(
        "newListener",
        function(event) {
          if (event === "row") this._emitRowEvents = true;
        }.bind(this)
      );
    };
    util.inherits(NativeQuery, EventEmitter);
    var errorFieldMap = {
      sqlState: "code",
      statementPosition: "position",
      messagePrimary: "message",
      context: "where",
      schemaName: "schema",
      tableName: "table",
      columnName: "column",
      dataTypeName: "dataType",
      constraintName: "constraint",
      sourceFile: "file",
      sourceLine: "line",
      sourceFunction: "routine"
    };
    NativeQuery.prototype.handleError = function(err) {
      const fields = this.native && this.native.pq.resultErrorFields();
      if (fields) {
        for (const key in fields) {
          const normalizedFieldName = errorFieldMap[key] || key;
          err[normalizedFieldName] = fields[key];
        }
      }
      if (this.callback) {
        this.callback(err);
      } else {
        this.emit("error", err);
      }
      this.state = "error";
    };
    NativeQuery.prototype.then = function(onSuccess, onFailure) {
      return this._getPromise().then(onSuccess, onFailure);
    };
    NativeQuery.prototype.catch = function(callback) {
      return this._getPromise().catch(callback);
    };
    NativeQuery.prototype._getPromise = function() {
      if (this._promise) return this._promise;
      this._promise = new Promise(
        function(resolve, reject) {
          this._once("end", resolve);
          this._once("error", reject);
        }.bind(this)
      );
      return this._promise;
    };
    NativeQuery.prototype.submit = function(client) {
      this.state = "running";
      const self = this;
      this.native = client.native;
      client.native.arrayMode = this._arrayMode;
      let after = /* @__PURE__ */ __name(function(err, rows, results) {
        client.native.arrayMode = false;
        setImmediate(function() {
          self.emit("_done");
        });
        if (err) {
          return self.handleError(err);
        }
        if (self._emitRowEvents) {
          if (results.length > 1) {
            rows.forEach((rowOfRows, i) => {
              rowOfRows.forEach((row) => {
                self.emit("row", row, results[i]);
              });
            });
          } else {
            rows.forEach(function(row) {
              self.emit("row", row, results);
            });
          }
        }
        self.state = "end";
        self.emit("end", results);
        if (self.callback) {
          self.callback(null, results);
        }
      }, "after");
      if (process.domain) {
        after = process.domain.bind(after);
      }
      if (this.name) {
        if (this.name.length > 63) {
          console.error("Warning! Postgres only supports 63 characters for query names.");
          console.error("You supplied %s (%s)", this.name, this.name.length);
          console.error("This can cause conflicts and silent errors executing queries");
        }
        const values = (this.values || []).map(utils.prepareValue);
        if (client.namedQueries[this.name]) {
          if (this.text && client.namedQueries[this.name] !== this.text) {
            const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
            return after(err);
          }
          return client.native.execute(this.name, values, after);
        }
        return client.native.prepare(this.name, this.text, values.length, function(err) {
          if (err) return after(err);
          client.namedQueries[self.name] = self.text;
          return self.native.execute(self.name, values, after);
        });
      } else if (this.values) {
        if (!Array.isArray(this.values)) {
          const err = new Error("Query values must be an array");
          return after(err);
        }
        const vals = this.values.map(utils.prepareValue);
        client.native.query(this.text, vals, after);
      } else if (this.queryMode === "extended") {
        client.native.query(this.text, [], after);
      } else {
        client.native.query(this.text, after);
      }
    };
  }
});

// node_modules/pg/lib/native/client.js
var require_client2 = __commonJS({
  "node_modules/pg/lib/native/client.js"(exports, module) {
    init_modules_watch_stub();
    var nodeUtils = require_util();
    var Native;
    try {
      Native = __require("pg-native");
    } catch (e) {
      throw e;
    }
    var TypeOverrides2 = require_type_overrides();
    var EventEmitter = require_events().EventEmitter;
    var util = require_util();
    var ConnectionParameters = require_connection_parameters();
    var NativeQuery = require_query2();
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    var Client2 = module.exports = function(config) {
      EventEmitter.call(this);
      config = config || {};
      this._Promise = config.Promise || global.Promise;
      this._types = new TypeOverrides2(config.types);
      this.native = new Native({
        types: this._types
      });
      this._queryQueue = [];
      this._ending = false;
      this._connecting = false;
      this._connected = false;
      this._queryable = true;
      this.pipeline = Boolean(config.pipeline);
      this._pipelineInFlight = false;
      const cp = this.connectionParameters = new ConnectionParameters(config);
      if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString;
      this.user = cp.user;
      Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: cp.password
      });
      this.database = cp.database;
      this.host = cp.host;
      this.port = cp.port;
      this.namedQueries = {};
    };
    Client2.Query = NativeQuery;
    util.inherits(Client2, EventEmitter);
    Client2.prototype._errorAllQueries = function(err) {
      const enqueueError = /* @__PURE__ */ __name((query) => {
        process.nextTick(() => {
          query.native = this.native;
          query.handleError(err);
        });
      }, "enqueueError");
      if (this._hasActiveQuery()) {
        enqueueError(this._activeQuery);
        this._activeQuery = null;
      }
      this._queryQueue.forEach(enqueueError);
      this._queryQueue.length = 0;
    };
    Client2.prototype._connect = function(cb) {
      const self = this;
      if (this._connecting) {
        process.nextTick(() => cb(new Error("Client has already been connected. You cannot reuse a client.")));
        return;
      }
      this._connecting = true;
      this.connectionParameters.getLibpqConnectionString(function(err, conString) {
        if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
        if (err) return cb(err);
        self.native.connect(conString, function(err2) {
          if (err2) {
            self.native.end();
            return cb(err2);
          }
          self._connected = true;
          self.native.on("error", function(err3) {
            self._queryable = false;
            self._errorAllQueries(err3);
            self.emit("error", err3);
          });
          self.native.on("notification", function(msg) {
            self.emit("notification", {
              channel: msg.relname,
              payload: msg.extra
            });
          });
          self.emit("connect");
          self._pulseQueryQueue(true);
          cb(null, this);
        });
      });
    };
    Client2.prototype.connect = function(callback) {
      if (callback) {
        this._connect(callback);
        return;
      }
      return new this._Promise((resolve, reject) => {
        this._connect((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(this);
          }
        });
      });
    };
    Client2.prototype.query = function(config, values, callback) {
      let query;
      let result;
      let readTimeout;
      let readTimeoutTimer;
      let queryCallback;
      if (config === null || config === void 0) {
        throw new TypeError("Client was passed a null or undefined query");
      } else if (typeof config.submit === "function") {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        result = query = config;
        if (typeof values === "function") {
          config.callback = values;
        }
      } else {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        query = new NativeQuery(config, values, callback);
        if (!query.callback) {
          let resolveOut, rejectOut;
          result = new this._Promise((resolve, reject) => {
            resolveOut = resolve;
            rejectOut = reject;
          }).catch((err) => {
            Error.captureStackTrace(err);
            throw err;
          });
          query.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
        }
      }
      if (readTimeout) {
        queryCallback = query.callback || (() => {
        });
        readTimeoutTimer = setTimeout(() => {
          const error = new Error("Query read timeout");
          process.nextTick(() => {
            query.handleError(error, this.connection);
          });
          queryCallback(error);
          query.callback = () => {
          };
          const index = this._queryQueue.indexOf(query);
          if (index > -1) {
            this._queryQueue.splice(index, 1);
          }
          this._pulseQueryQueue();
        }, readTimeout);
        query.callback = (err, res) => {
          clearTimeout(readTimeoutTimer);
          queryCallback(err, res);
        };
      }
      if (!this._queryable) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client has encountered a connection error and is not queryable"));
        });
        return result;
      }
      if (this._ending) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client was closed and is not queryable"));
        });
        return result;
      }
      if (this._queryQueue.length > 0 && !this.pipeline) {
        queryQueueLengthDeprecationNotice();
      }
      this._queryQueue.push(query);
      this._pulseQueryQueue();
      return result;
    };
    Client2.prototype.end = function(cb) {
      const self = this;
      this._ending = true;
      if (this._connecting && !this._connected) {
        this.once("connect", () => {
          this.end(() => {
          });
        });
      }
      let result;
      if (!cb) {
        result = new this._Promise(function(resolve, reject) {
          cb = /* @__PURE__ */ __name((err) => err ? reject(err) : resolve(), "cb");
        });
      }
      const doEnd = /* @__PURE__ */ __name(function() {
        self.native.end(function() {
          self._connected = false;
          self._errorAllQueries(new Error("Connection terminated"));
          process.nextTick(() => {
            self.emit("end");
            if (cb) cb();
          });
        });
      }, "doEnd");
      if (this.pipeline && (this._pipelineInFlight || this._queryQueue.length > 0)) {
        this.once("drain", doEnd);
      } else {
        doEnd();
      }
      return result;
    };
    Client2.prototype._hasActiveQuery = function() {
      return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
    };
    Client2.prototype._pulseQueryQueue = function(initialConnection) {
      if (!this._connected) {
        return;
      }
      if (this.pipeline && !initialConnection) {
        return this._pulsePipelinedQueryQueue();
      }
      if (this._hasActiveQuery()) {
        return;
      }
      const query = this._queryQueue.shift();
      if (!query) {
        if (!initialConnection) {
          this.emit("drain");
        }
        return;
      }
      this._activeQuery = query;
      query.submit(this);
      const self = this;
      query.once("_done", function() {
        self._pulseQueryQueue();
      });
    };
    Client2.prototype._pulsePipelinedQueryQueue = function() {
      if (!this._connected || this._pipelineInFlight) {
        return;
      }
      if (this._queryQueue.length === 0) {
        if (this.hasExecuted) {
          this.emit("drain");
        }
        return;
      }
      this._pipelineInFlight = true;
      const self = this;
      const queries = [];
      const nativeQueries = [];
      const utils = require_utils();
      while (this._queryQueue.length > 0) {
        const query = this._queryQueue.shift();
        this.hasExecuted = true;
        nativeQueries.push(query);
        const values = query.values ? query.values.map(utils.prepareValue) : null;
        const pipelineEntry = { text: query.text, name: query.name };
        if (values) {
          pipelineEntry.values = values;
        }
        if (query.name && this.namedQueries[query.name]) {
          pipelineEntry._alreadyPrepared = true;
        }
        queries.push(pipelineEntry);
      }
      this.native.pipeline(queries, function(err, results) {
        self._pipelineInFlight = false;
        if (err) {
          for (let i = 0; i < nativeQueries.length; i++) {
            const q = nativeQueries[i];
            q.native = self.native;
            q.handleError(err);
          }
          self._pulsePipelinedQueryQueue();
          return;
        }
        for (let i = 0; i < nativeQueries.length; i++) {
          const q = nativeQueries[i];
          const r = results[i];
          q.native = self.native;
          if (r.err) {
            q.handleError(r.err);
          } else {
            if (q.name) {
              self.namedQueries[q.name] = q.text;
            }
            q.state = "end";
            q.emit("end", r.result);
            if (q.callback) {
              q.callback(null, r.result);
            }
          }
          setImmediate(function() {
            q.emit("_done");
          });
        }
        self._pulsePipelinedQueryQueue();
      });
    };
    Client2.prototype.cancel = function(query) {
      if (this._activeQuery === query) {
        this.native.cancel(function() {
        });
      } else if (this._queryQueue.indexOf(query) !== -1) {
        this._queryQueue.splice(this._queryQueue.indexOf(query), 1);
      }
    };
    Client2.prototype.ref = function() {
    };
    Client2.prototype.unref = function() {
    };
    Client2.prototype.setTypeParser = function(oid, format2, parseFn) {
      return this._types.setTypeParser(oid, format2, parseFn);
    };
    Client2.prototype.getTypeParser = function(oid, format2) {
      return this._types.getTypeParser(oid, format2);
    };
    Client2.prototype.isConnected = function() {
      return this._connected;
    };
    Client2.prototype.getTransactionStatus = function() {
      return this.native.getTransactionStatus();
    };
  }
});

// node_modules/pg/lib/native/index.js
var require_native = __commonJS({
  "node_modules/pg/lib/native/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    module.exports = require_client2();
  }
});

// node_modules/pg/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/pg/lib/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var Client2 = require_client();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var Result2 = require_result();
    var utils = require_utils();
    var Pool2 = require_pg_pool();
    var TypeOverrides2 = require_type_overrides();
    var { DatabaseError: DatabaseError2 } = require_dist();
    var { escapeIdentifier: escapeIdentifier2, escapeLiteral: escapeLiteral2 } = require_utils();
    var poolFactory = /* @__PURE__ */ __name((Client3) => {
      return class BoundPool extends Pool2 {
        static {
          __name(this, "BoundPool");
        }
        constructor(options) {
          super(options, Client3);
        }
      };
    }, "poolFactory");
    var PG = /* @__PURE__ */ __name(function(clientConstructor2) {
      this.defaults = defaults2;
      this.Client = clientConstructor2;
      this.Query = this.Client.Query;
      this.Pool = poolFactory(this.Client);
      this._pools = [];
      this.Connection = Connection2;
      this.types = require_pg_types();
      this.DatabaseError = DatabaseError2;
      this.TypeOverrides = TypeOverrides2;
      this.escapeIdentifier = escapeIdentifier2;
      this.escapeLiteral = escapeLiteral2;
      this.Result = Result2;
      this.utils = utils;
    }, "PG");
    var clientConstructor = Client2;
    var forceNative = false;
    try {
      forceNative = !!process.env.NODE_PG_FORCE_NATIVE;
    } catch {
    }
    if (forceNative) {
      clientConstructor = require_native();
    }
    module.exports = new PG(clientConstructor);
    Object.defineProperty(module.exports, "native", {
      configurable: true,
      enumerable: false,
      get() {
        let native = null;
        try {
          native = new PG(require_native());
        } catch (err) {
          if (err.code !== "MODULE_NOT_FOUND") {
            throw err;
          }
        }
        Object.defineProperty(module.exports, "native", {
          value: native
        });
        return native;
      }
    });
  }
});

// node_modules/pg/esm/index.mjs
var esm_exports = {};
__export(esm_exports, {
  Client: () => Client,
  Connection: () => Connection,
  DatabaseError: () => DatabaseError,
  Pool: () => Pool,
  Query: () => Query,
  Result: () => Result,
  TypeOverrides: () => TypeOverrides,
  default: () => esm_default,
  defaults: () => defaults,
  escapeIdentifier: () => escapeIdentifier,
  escapeLiteral: () => escapeLiteral,
  types: () => types
});
var import_lib, Client, Pool, Connection, types, Query, DatabaseError, escapeIdentifier, escapeLiteral, Result, TypeOverrides, defaults, esm_default;
var init_esm = __esm({
  "node_modules/pg/esm/index.mjs"() {
    init_modules_watch_stub();
    import_lib = __toESM(require_lib2(), 1);
    Client = import_lib.default.Client;
    Pool = import_lib.default.Pool;
    Connection = import_lib.default.Connection;
    types = import_lib.default.types;
    Query = import_lib.default.Query;
    DatabaseError = import_lib.default.DatabaseError;
    escapeIdentifier = import_lib.default.escapeIdentifier;
    escapeLiteral = import_lib.default.escapeLiteral;
    Result = import_lib.default.Result;
    TypeOverrides = import_lib.default.TypeOverrides;
    defaults = import_lib.default.defaults;
    esm_default = import_lib.default;
  }
});

// node_modules/adm-zip/util/constants.js
var require_constants = __commonJS({
  "node_modules/adm-zip/util/constants.js"(exports, module) {
    init_modules_watch_stub();
    module.exports = {
      /* The local file header */
      LOCHDR: 30,
      // LOC header size
      LOCSIG: 67324752,
      // "PK\003\004"
      LOCVER: 4,
      // version needed to extract
      LOCFLG: 6,
      // general purpose bit flag
      LOCHOW: 8,
      // compression method
      LOCTIM: 10,
      // modification time (2 bytes time, 2 bytes date)
      LOCCRC: 14,
      // uncompressed file crc-32 value
      LOCSIZ: 18,
      // compressed size
      LOCLEN: 22,
      // uncompressed size
      LOCNAM: 26,
      // filename length
      LOCEXT: 28,
      // extra field length
      /* The Data descriptor */
      EXTSIG: 134695760,
      // "PK\007\008"
      EXTHDR: 16,
      // EXT header size
      EXTCRC: 4,
      // uncompressed file crc-32 value
      EXTSIZ: 8,
      // compressed size
      EXTLEN: 12,
      // uncompressed size
      /* The central directory file header */
      CENHDR: 46,
      // CEN header size
      CENSIG: 33639248,
      // "PK\001\002"
      CENVEM: 4,
      // version made by
      CENVER: 6,
      // version needed to extract
      CENFLG: 8,
      // encrypt, decrypt flags
      CENHOW: 10,
      // compression method
      CENTIM: 12,
      // modification time (2 bytes time, 2 bytes date)
      CENCRC: 16,
      // uncompressed file crc-32 value
      CENSIZ: 20,
      // compressed size
      CENLEN: 24,
      // uncompressed size
      CENNAM: 28,
      // filename length
      CENEXT: 30,
      // extra field length
      CENCOM: 32,
      // file comment length
      CENDSK: 34,
      // volume number start
      CENATT: 36,
      // internal file attributes
      CENATX: 38,
      // external file attributes (host system dependent)
      CENOFF: 42,
      // LOC header offset
      /* The entries in the end of central directory */
      ENDHDR: 22,
      // END header size
      ENDSIG: 101010256,
      // "PK\005\006"
      ENDSUB: 8,
      // number of entries on this disk
      ENDTOT: 10,
      // total number of entries
      ENDSIZ: 12,
      // central directory size in bytes
      ENDOFF: 16,
      // offset of first CEN header
      ENDCOM: 20,
      // zip file comment length
      END64HDR: 20,
      // zip64 END header size
      END64SIG: 117853008,
      // zip64 Locator signature, "PK\006\007"
      END64START: 4,
      // number of the disk with the start of the zip64
      END64OFF: 8,
      // relative offset of the zip64 end of central directory
      END64NUMDISKS: 16,
      // total number of disks
      ZIP64SIG: 101075792,
      // zip64 signature, "PK\006\006"
      ZIP64HDR: 56,
      // zip64 record minimum size
      ZIP64LEAD: 12,
      // leading bytes at the start of the record, not counted by the value stored in ZIP64SIZE
      ZIP64SIZE: 4,
      // zip64 size of the central directory record
      ZIP64VEM: 12,
      // zip64 version made by
      ZIP64VER: 14,
      // zip64 version needed to extract
      ZIP64DSK: 16,
      // zip64 number of this disk
      ZIP64DSKDIR: 20,
      // number of the disk with the start of the record directory
      ZIP64SUB: 24,
      // number of entries on this disk
      ZIP64TOT: 32,
      // total number of entries
      ZIP64SIZB: 40,
      // zip64 central directory size in bytes
      ZIP64OFF: 48,
      // offset of start of central directory with respect to the starting disk number
      ZIP64EXTRA: 56,
      // extensible data sector
      /* Compression methods */
      STORED: 0,
      // no compression
      SHRUNK: 1,
      // shrunk
      REDUCED1: 2,
      // reduced with compression factor 1
      REDUCED2: 3,
      // reduced with compression factor 2
      REDUCED3: 4,
      // reduced with compression factor 3
      REDUCED4: 5,
      // reduced with compression factor 4
      IMPLODED: 6,
      // imploded
      // 7 reserved for Tokenizing compression algorithm
      DEFLATED: 8,
      // deflated
      ENHANCED_DEFLATED: 9,
      // enhanced deflated
      PKWARE: 10,
      // PKWare DCL imploded
      // 11 reserved by PKWARE
      BZIP2: 12,
      //  compressed using BZIP2
      // 13 reserved by PKWARE
      LZMA: 14,
      // LZMA
      // 15-17 reserved by PKWARE
      IBM_TERSE: 18,
      // compressed using IBM TERSE
      IBM_LZ77: 19,
      // IBM LZ77 z
      AES_ENCRYPT: 99,
      // WinZIP AES encryption method
      /* General purpose bit flag */
      // values can obtained with expression 2**bitnr
      FLG_ENC: 1,
      // Bit 0: encrypted file
      FLG_COMP1: 2,
      // Bit 1, compression option
      FLG_COMP2: 4,
      // Bit 2, compression option
      FLG_DESC: 8,
      // Bit 3, data descriptor
      FLG_ENH: 16,
      // Bit 4, enhanced deflating
      FLG_PATCH: 32,
      // Bit 5, indicates that the file is compressed patched data.
      FLG_STR: 64,
      // Bit 6, strong encryption (patented)
      // Bits 7-10: Currently unused.
      FLG_EFS: 2048,
      // Bit 11: Language encoding flag (EFS)
      // Bit 12: Reserved by PKWARE for enhanced compression.
      // Bit 13: encrypted the Central Directory (patented).
      // Bits 14-15: Reserved by PKWARE.
      FLG_MSK: 4096,
      // mask header values
      /* Load type */
      FILE: 2,
      BUFFER: 1,
      NONE: 0,
      /* 4.5 Extensible data fields */
      EF_ID: 0,
      EF_SIZE: 2,
      /* Header IDs */
      ID_ZIP64: 1,
      ID_AVINFO: 7,
      ID_PFS: 8,
      ID_OS2: 9,
      ID_NTFS: 10,
      ID_OPENVMS: 12,
      ID_UNIX: 13,
      ID_FORK: 14,
      ID_PATCH: 15,
      ID_X509_PKCS7: 20,
      ID_X509_CERTID_F: 21,
      ID_X509_CERTID_C: 22,
      ID_STRONGENC: 23,
      ID_RECORD_MGT: 24,
      ID_X509_PKCS7_RL: 25,
      ID_IBM1: 101,
      ID_IBM2: 102,
      ID_POSZIP: 18064,
      EF_ZIP64_OR_32: 4294967295,
      EF_ZIP64_OR_16: 65535,
      EF_ZIP64_SUNCOMP: 0,
      EF_ZIP64_SCOMP: 8,
      EF_ZIP64_RHO: 16,
      EF_ZIP64_DSN: 24
    };
  }
});

// node_modules/adm-zip/util/errors.js
var require_errors = __commonJS({
  "node_modules/adm-zip/util/errors.js"(exports) {
    init_modules_watch_stub();
    var errors = {
      /* Header error messages */
      INVALID_LOC: "Invalid LOC header (bad signature)",
      INVALID_CEN: "Invalid CEN header (bad signature)",
      INVALID_END: "Invalid END header (bad signature)",
      /* Descriptor */
      DESCRIPTOR_NOT_EXIST: "No descriptor present",
      DESCRIPTOR_UNKNOWN: "Unknown descriptor format",
      DESCRIPTOR_FAULTY: "Descriptor data is malformed",
      /* ZipEntry error messages*/
      NO_DATA: "Nothing to decompress",
      BAD_CRC: "CRC32 checksum failed {0}",
      MAX_OUTPUT_EXCEEDED: "Decompressed data exceeds the declared uncompressed size",
      FILE_IN_THE_WAY: "There is a file in the way: {0}",
      UNKNOWN_METHOD: "Invalid/unsupported compression method",
      /* Inflater error messages */
      AVAIL_DATA: "inflate::Available inflate data did not terminate",
      INVALID_DISTANCE: "inflate::Invalid literal/length or distance code in fixed or dynamic block",
      TO_MANY_CODES: "inflate::Dynamic block code description: too many length or distance codes",
      INVALID_REPEAT_LEN: "inflate::Dynamic block code description: repeat more than specified lengths",
      INVALID_REPEAT_FIRST: "inflate::Dynamic block code description: repeat lengths with no first length",
      INCOMPLETE_CODES: "inflate::Dynamic block code description: code lengths codes incomplete",
      INVALID_DYN_DISTANCE: "inflate::Dynamic block code description: invalid distance code lengths",
      INVALID_CODES_LEN: "inflate::Dynamic block code description: invalid literal/length code lengths",
      INVALID_STORE_BLOCK: "inflate::Stored block length did not match one's complement",
      INVALID_BLOCK_TYPE: "inflate::Invalid block type (type == 3)",
      /* ADM-ZIP error messages */
      CANT_EXTRACT_FILE: "Could not extract the file",
      CANT_OVERRIDE: "Target file already exists",
      DISK_ENTRY_TOO_LARGE: "Number of disk entries is too large",
      NO_ZIP: "No zip file was loaded",
      NO_ENTRY: "Entry doesn't exist",
      DUPLICATE_ENTRY: "Duplicate entry name {0}",
      DIRECTORY_CONTENT_ERROR: "A directory cannot have content",
      FILE_NOT_FOUND: 'File not found: "{0}"',
      NOT_IMPLEMENTED: "Not implemented",
      INVALID_FILENAME: "Invalid filename",
      INVALID_FORMAT: "Invalid or unsupported zip format. No END header found",
      ZIP64_VALUE_TOO_LARGE: "Zip64 value exceeds the maximum safe integer",
      INVALID_PASS_PARAM: "Incompatible password parameter",
      WRONG_PASSWORD: "Wrong Password",
      /* ADM-ZIP */
      COMMENT_TOO_LONG: "Comment is too long",
      // Comment can be max 65535 bytes long (NOTE: some non-US characters may take more space)
      EXTRA_FIELD_PARSE_ERROR: "Extra field parsing error"
    };
    function E(message2) {
      return function(...args) {
        if (args.length) {
          message2 = message2.replace(/\{(\d)\}/g, (_, n) => args[n] || "");
        }
        return new Error("ADM-ZIP: " + message2);
      };
    }
    __name(E, "E");
    for (const msg of Object.keys(errors)) {
      exports[msg] = E(errors[msg]);
    }
  }
});

// node_modules/adm-zip/util/utils.js
var require_utils3 = __commonJS({
  "node_modules/adm-zip/util/utils.js"(exports, module) {
    init_modules_watch_stub();
    var fsystem = require_fs();
    var pth = require_path();
    var Constants = require_constants();
    var Errors = require_errors();
    var isWin = typeof process === "object" && "win32" === process.platform;
    var is_Obj = /* @__PURE__ */ __name((obj) => typeof obj === "object" && obj !== null, "is_Obj");
    var crcTable = new Uint32Array(256).map((t, c) => {
      for (let k = 0; k < 8; k++) {
        if ((c & 1) !== 0) {
          c = 3988292384 ^ c >>> 1;
        } else {
          c >>>= 1;
        }
      }
      return c >>> 0;
    });
    function Utils(opts) {
      this.sep = pth.sep;
      this.fs = fsystem;
      if (is_Obj(opts)) {
        if (is_Obj(opts.fs) && typeof opts.fs.statSync === "function") {
          this.fs = opts.fs;
        }
      }
    }
    __name(Utils, "Utils");
    module.exports = Utils;
    Utils.prototype.makeDir = function(folder) {
      const self = this;
      function mkdirSync(fpath) {
        let resolvedPath = fpath.split(self.sep)[0];
        fpath.split(self.sep).forEach(function(name) {
          if (!name || name.substr(-1, 1) === ":") return;
          resolvedPath += self.sep + name;
          var stat;
          try {
            stat = self.fs.statSync(resolvedPath);
          } catch (e) {
            if (e.message && e.message.startsWith("ENOENT")) {
              self.fs.mkdirSync(resolvedPath);
            } else {
              throw e;
            }
          }
          if (stat && stat.isFile()) throw Errors.FILE_IN_THE_WAY(`"${resolvedPath}"`);
        });
      }
      __name(mkdirSync, "mkdirSync");
      mkdirSync(folder);
    };
    Utils.prototype.writeFileTo = function(path, content, overwrite, attr) {
      const self = this;
      if (self.fs.existsSync(path)) {
        if (!overwrite) return false;
        var stat = self.fs.statSync(path);
        if (stat.isDirectory()) {
          return false;
        }
      }
      var folder = pth.dirname(path);
      if (!self.fs.existsSync(folder)) {
        self.makeDir(folder);
      }
      var fd;
      try {
        fd = self.fs.openSync(path, "w", 438);
      } catch (e) {
        self.fs.chmodSync(path, 438);
        fd = self.fs.openSync(path, "w", 438);
      }
      if (fd) {
        try {
          self.fs.writeSync(fd, content, 0, content.length, 0);
        } finally {
          self.fs.closeSync(fd);
        }
      }
      self.fs.chmodSync(path, attr || 438);
      return true;
    };
    Utils.prototype.writeFileToAsync = function(path, content, overwrite, attr, callback) {
      if (typeof attr === "function") {
        callback = attr;
        attr = void 0;
      }
      const self = this;
      self.fs.exists(path, function(exist) {
        if (exist && !overwrite) return callback(false);
        self.fs.stat(path, function(err, stat) {
          if (exist && stat && stat.isDirectory()) {
            return callback(false);
          }
          var folder = pth.dirname(path);
          self.fs.exists(folder, function(exists) {
            if (!exists) {
              try {
                self.makeDir(folder);
              } catch (e) {
                return callback(false);
              }
            }
            const writeToFd = /* @__PURE__ */ __name(function(fd) {
              self.fs.write(fd, content, 0, content.length, 0, function(writeErr) {
                self.fs.close(fd, function() {
                  if (writeErr) return callback(false);
                  self.fs.chmod(path, attr || 438, function() {
                    callback(true);
                  });
                });
              });
            }, "writeToFd");
            self.fs.open(path, "w", 438, function(err2, fd) {
              if (err2) {
                self.fs.chmod(path, 438, function() {
                  self.fs.open(path, "w", 438, function(retryErr, fd2) {
                    if (retryErr || !fd2) return callback(false);
                    writeToFd(fd2);
                  });
                });
              } else if (fd) {
                writeToFd(fd);
              } else {
                callback(false);
              }
            });
          });
        });
      });
    };
    Utils.prototype.assertPathSafe = function(root, target) {
      const self = this;
      if (typeof self.fs.lstatSync !== "function") return;
      const resolvedRoot = pth.resolve(root);
      const resolvedTarget = pth.resolve(target);
      if (resolvedTarget === resolvedRoot) return;
      const rel = pth.relative(resolvedRoot, resolvedTarget);
      if (!rel || rel === ".." || rel.startsWith(".." + pth.sep) || pth.isAbsolute(rel)) return;
      let cur = resolvedRoot;
      for (const part of rel.split(pth.sep)) {
        if (!part || part === ".") continue;
        cur = pth.join(cur, part);
        let stat;
        try {
          stat = self.fs.lstatSync(cur);
        } catch (e) {
          break;
        }
        if (stat.isSymbolicLink()) throw Errors.FILE_IN_THE_WAY(`"${cur}"`);
      }
    };
    Utils.prototype.findFiles = function(path) {
      const self = this;
      const canLstat = typeof self.fs.lstatSync === "function";
      const rootReal = self.fs.realpathSync(path);
      function escapesRoot(p) {
        if (!canLstat) return false;
        if (!self.fs.lstatSync(p).isSymbolicLink()) return false;
        let real;
        try {
          real = self.fs.realpathSync(p);
        } catch (e) {
          return true;
        }
        return !(real === rootReal || real.startsWith(rootReal + pth.sep));
      }
      __name(escapesRoot, "escapesRoot");
      function findSync(dir, pattern, recursive, visited) {
        if (typeof pattern === "boolean") {
          recursive = pattern;
          pattern = void 0;
        }
        let files = [];
        self.fs.readdirSync(dir).forEach(function(file) {
          const path2 = pth.join(dir, file);
          if (escapesRoot(path2)) return;
          const stat = self.fs.statSync(path2);
          if (!pattern || pattern.test(path2)) {
            files.push(pth.normalize(path2) + (stat.isDirectory() ? self.sep : ""));
          }
          if (stat.isDirectory() && recursive) {
            const realDir = self.fs.realpathSync(path2);
            if (!visited.has(realDir)) {
              visited.add(realDir);
              files = files.concat(findSync(path2, pattern, recursive, visited));
            }
          }
        });
        return files;
      }
      __name(findSync, "findSync");
      return findSync(path, void 0, true, /* @__PURE__ */ new Set([rootReal]));
    };
    Utils.prototype.findFilesAsync = function(dir, cb) {
      const self = this;
      const results = [];
      let finished = false;
      const finish = /* @__PURE__ */ __name(function(err) {
        if (finished) return;
        finished = true;
        cb(err, err ? void 0 : results);
      }, "finish");
      const canLstat = typeof self.fs.lstat === "function";
      let rootReal = null;
      const escapesRoot = /* @__PURE__ */ __name(function(file, cb2) {
        if (!canLstat) return cb2(null, false);
        self.fs.lstat(file, function(err, lst) {
          if (err) return cb2(err);
          if (!lst || !lst.isSymbolicLink()) return cb2(null, false);
          self.fs.realpath(file, function(err2, real) {
            if (err2) return cb2(null, true);
            cb2(null, !(real === rootReal || real.startsWith(rootReal + pth.sep)));
          });
        });
      }, "escapesRoot");
      const walk = /* @__PURE__ */ __name(function(dir2, visited, done) {
        self.fs.readdir(dir2, function(err, list) {
          if (err) return done(err);
          let pending = list.length;
          if (!pending) return done();
          list.forEach(function(name) {
            const file = pth.join(dir2, name);
            escapesRoot(file, function(err2, escapes) {
              if (err2) return done(err2);
              if (escapes) {
                if (!--pending) done();
                return;
              }
              self.fs.stat(file, function(err3, stat) {
                if (err3) return done(err3);
                if (!stat) {
                  if (!--pending) done();
                  return;
                }
                results.push(pth.normalize(file) + (stat.isDirectory() ? self.sep : ""));
                if (!stat.isDirectory()) {
                  if (!--pending) done();
                  return;
                }
                self.fs.realpath(file, function(err4, realDir) {
                  if (err4) return done(err4);
                  if (visited.has(realDir)) {
                    if (!--pending) done();
                    return;
                  }
                  visited.add(realDir);
                  walk(file, visited, function(err5) {
                    if (err5) return done(err5);
                    if (!--pending) done();
                  });
                });
              });
            });
          });
        });
      }, "walk");
      self.fs.realpath(dir, function(err, realDir) {
        if (err) return finish(err);
        rootReal = realDir;
        walk(dir, /* @__PURE__ */ new Set([realDir]), finish);
      });
    };
    Utils.prototype.getAttributes = function() {
    };
    Utils.prototype.setAttributes = function() {
    };
    Utils.crc32update = function(crc, byte) {
      return crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
    };
    Utils.crc32 = function(buf) {
      if (typeof buf === "string") {
        buf = Buffer.from(buf, "utf8");
      }
      let len = buf.length;
      let crc = ~0;
      for (let off = 0; off < len; ) crc = Utils.crc32update(crc, buf[off++]);
      return ~crc >>> 0;
    };
    Utils.methodToString = function(method) {
      switch (method) {
        case Constants.STORED:
          return "STORED (" + method + ")";
        case Constants.DEFLATED:
          return "DEFLATED (" + method + ")";
        default:
          return "UNSUPPORTED (" + method + ")";
      }
    };
    Utils.canonical = function(path) {
      if (!path) return "";
      const safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
      return pth.join(".", safeSuffix);
    };
    Utils.zipnamefix = function(path) {
      if (!path) return "";
      const safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
      return pth.posix.join(".", safeSuffix);
    };
    Utils.findLast = function(arr, callback) {
      if (!Array.isArray(arr)) throw new TypeError("arr is not array");
      const len = arr.length >>> 0;
      for (let i = len - 1; i >= 0; i--) {
        if (callback(arr[i], i, arr)) {
          return arr[i];
        }
      }
      return void 0;
    };
    Utils.sanitize = function(prefix, name) {
      prefix = pth.resolve(pth.normalize(prefix));
      var parts = name.split("/");
      for (var i = 0, l = parts.length; i < l; i++) {
        var path = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
        if (path === prefix || path.startsWith(prefix + pth.sep)) {
          return path;
        }
      }
      return pth.normalize(pth.join(prefix, pth.basename(name)));
    };
    Utils.toBuffer = /* @__PURE__ */ __name(function toBuffer(input, encoder) {
      if (Buffer.isBuffer(input)) {
        return input;
      } else if (input instanceof Uint8Array) {
        return Buffer.from(input);
      } else {
        return typeof input === "string" ? encoder(input) : Buffer.alloc(0);
      }
    }, "toBuffer");
    Utils.readBigUInt64LE = function(buffer, index) {
      const lo = buffer.readUInt32LE(index);
      const hi = buffer.readUInt32LE(index + 4);
      const value = hi * 4294967296 + lo;
      if (value > Number.MAX_SAFE_INTEGER) {
        throw Errors.ZIP64_VALUE_TOO_LARGE();
      }
      return value;
    };
    Utils.writeBigUInt64LE = function(buffer, value, index) {
      const lo = value >>> 0;
      const hi = Math.floor(value / 4294967296) >>> 0;
      buffer.writeUInt32LE(lo, index);
      buffer.writeUInt32LE(hi, index + 4);
    };
    Utils.fromDOS2Date = function(val) {
      return new Date((val >> 25 & 127) + 1980, Math.max((val >> 21 & 15) - 1, 0), Math.max(val >> 16 & 31, 1), val >> 11 & 31, val >> 5 & 63, (val & 31) << 1);
    };
    Utils.fromDate2DOS = function(val) {
      let date = 0;
      let time = 0;
      if (val.getFullYear() > 1979) {
        date = (val.getFullYear() - 1980 & 127) << 9 | val.getMonth() + 1 << 5 | val.getDate();
        time = val.getHours() << 11 | val.getMinutes() << 5 | val.getSeconds() >> 1;
      }
      return date << 16 | time;
    };
    Utils.isWin = isWin;
    Utils.crcTable = crcTable;
  }
});

// node_modules/adm-zip/util/fattr.js
var require_fattr = __commonJS({
  "node_modules/adm-zip/util/fattr.js"(exports, module) {
    init_modules_watch_stub();
    var pth = require_path();
    module.exports = function(path, { fs }) {
      var _path = path || "", _obj = newAttr(), _stat = null;
      function newAttr() {
        return {
          directory: false,
          readonly: false,
          hidden: false,
          executable: false,
          mtime: 0,
          atime: 0
        };
      }
      __name(newAttr, "newAttr");
      if (_path && fs.existsSync(_path)) {
        _stat = fs.statSync(_path);
        _obj.directory = _stat.isDirectory();
        _obj.mtime = _stat.mtime;
        _obj.atime = _stat.atime;
        _obj.executable = (73 & _stat.mode) !== 0;
        _obj.readonly = (128 & _stat.mode) === 0;
        _obj.hidden = pth.basename(_path)[0] === ".";
      } else {
        console.warn("Invalid path: " + _path);
      }
      return {
        get directory() {
          return _obj.directory;
        },
        get readOnly() {
          return _obj.readonly;
        },
        get hidden() {
          return _obj.hidden;
        },
        get mtime() {
          return _obj.mtime;
        },
        get atime() {
          return _obj.atime;
        },
        get executable() {
          return _obj.executable;
        },
        decodeAttributes: /* @__PURE__ */ __name(function() {
        }, "decodeAttributes"),
        encodeAttributes: /* @__PURE__ */ __name(function() {
        }, "encodeAttributes"),
        toJSON: /* @__PURE__ */ __name(function() {
          return {
            path: _path,
            isDirectory: _obj.directory,
            isReadOnly: _obj.readonly,
            isHidden: _obj.hidden,
            isExecutable: _obj.executable,
            mTime: _obj.mtime,
            aTime: _obj.atime
          };
        }, "toJSON"),
        toString: /* @__PURE__ */ __name(function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }, "toString")
      };
    };
  }
});

// node_modules/adm-zip/util/decoder.js
var require_decoder = __commonJS({
  "node_modules/adm-zip/util/decoder.js"(exports, module) {
    init_modules_watch_stub();
    module.exports = {
      efs: true,
      encode: /* @__PURE__ */ __name((data) => Buffer.from(data, "utf8"), "encode"),
      decode: /* @__PURE__ */ __name((data) => data.toString("utf8"), "decode")
    };
  }
});

// node_modules/adm-zip/util/index.js
var require_util2 = __commonJS({
  "node_modules/adm-zip/util/index.js"(exports, module) {
    init_modules_watch_stub();
    module.exports = require_utils3();
    module.exports.Constants = require_constants();
    module.exports.Errors = require_errors();
    module.exports.FileAttr = require_fattr();
    module.exports.decoder = require_decoder();
  }
});

// node_modules/adm-zip/headers/entryHeader.js
var require_entryHeader = __commonJS({
  "node_modules/adm-zip/headers/entryHeader.js"(exports, module) {
    init_modules_watch_stub();
    var Utils = require_util2();
    var Constants = Utils.Constants;
    module.exports = function() {
      var _verMade = 20, _version = 10, _flags = 0, _method = 0, _time = 0, _crc = 0, _compressedSize = 0, _size = 0, _fnameLen = 0, _extraLen = 0, _comLen = 0, _diskStart = 0, _inattr = 0, _attr = 0, _offset = 0;
      _verMade |= Utils.isWin ? 2560 : 768;
      _flags |= Constants.FLG_EFS;
      const _localHeader = {
        extraLen: 0
      };
      const uint32 = /* @__PURE__ */ __name((val) => Math.max(0, val) >>> 0, "uint32");
      const uint16 = /* @__PURE__ */ __name((val) => Math.max(0, val) & 65535, "uint16");
      const uint8 = /* @__PURE__ */ __name((val) => Math.max(0, val) & 255, "uint8");
      _time = Utils.fromDate2DOS(/* @__PURE__ */ new Date());
      return {
        get made() {
          return _verMade;
        },
        set made(val) {
          _verMade = val;
        },
        get version() {
          return _version;
        },
        set version(val) {
          _version = val;
        },
        get flags() {
          return _flags;
        },
        set flags(val) {
          _flags = val;
        },
        get flags_efs() {
          return (_flags & Constants.FLG_EFS) > 0;
        },
        set flags_efs(val) {
          if (val) {
            _flags |= Constants.FLG_EFS;
          } else {
            _flags &= ~Constants.FLG_EFS;
          }
        },
        get flags_desc() {
          return (_flags & Constants.FLG_DESC) > 0;
        },
        set flags_desc(val) {
          if (val) {
            _flags |= Constants.FLG_DESC;
          } else {
            _flags &= ~Constants.FLG_DESC;
          }
        },
        get method() {
          return _method;
        },
        set method(val) {
          switch (val) {
            case Constants.STORED:
              this.version = 10;
              break;
            case Constants.DEFLATED:
            default:
              this.version = 20;
          }
          _method = val;
        },
        get time() {
          return Utils.fromDOS2Date(this.timeval);
        },
        set time(val) {
          val = new Date(val);
          this.timeval = Utils.fromDate2DOS(val);
        },
        get timeval() {
          return _time;
        },
        set timeval(val) {
          _time = uint32(val);
        },
        get timeHighByte() {
          return uint8(_time >>> 8);
        },
        get crc() {
          return _crc;
        },
        set crc(val) {
          _crc = uint32(val);
        },
        get compressedSize() {
          return _compressedSize;
        },
        set compressedSize(val) {
          _compressedSize = uint32(val);
        },
        get size() {
          return _size;
        },
        set size(val) {
          _size = uint32(val);
        },
        get fileNameLength() {
          return _fnameLen;
        },
        set fileNameLength(val) {
          _fnameLen = val;
        },
        get extraLength() {
          return _extraLen;
        },
        set extraLength(val) {
          _extraLen = val;
        },
        get extraLocalLength() {
          return _localHeader.extraLen;
        },
        set extraLocalLength(val) {
          _localHeader.extraLen = val;
        },
        get commentLength() {
          return _comLen;
        },
        set commentLength(val) {
          _comLen = val;
        },
        get diskNumStart() {
          return _diskStart;
        },
        set diskNumStart(val) {
          _diskStart = uint32(val);
        },
        get inAttr() {
          return _inattr;
        },
        set inAttr(val) {
          _inattr = uint32(val);
        },
        get attr() {
          return _attr;
        },
        set attr(val) {
          _attr = uint32(val);
        },
        // get Unix file permissions
        get fileAttr() {
          return (_attr || 0) >> 16 & 511;
        },
        get offset() {
          return _offset;
        },
        set offset(val) {
          _offset = uint32(val);
        },
        get encrypted() {
          return (_flags & Constants.FLG_ENC) === Constants.FLG_ENC;
        },
        get centralHeaderSize() {
          return Constants.CENHDR + _fnameLen + _extraLen + _comLen;
        },
        get realDataOffset() {
          return _offset + Constants.LOCHDR + _localHeader.fnameLen + _localHeader.extraLen;
        },
        get localHeader() {
          return _localHeader;
        },
        loadLocalHeaderFromBinary: /* @__PURE__ */ __name(function(input) {
          if (_offset < 0 || _offset + Constants.LOCHDR > input.length) {
            throw Utils.Errors.INVALID_LOC();
          }
          var data = input.slice(_offset, _offset + Constants.LOCHDR);
          if (data.readUInt32LE(0) !== Constants.LOCSIG) {
            throw Utils.Errors.INVALID_LOC();
          }
          _localHeader.version = data.readUInt16LE(Constants.LOCVER);
          _localHeader.flags = data.readUInt16LE(Constants.LOCFLG);
          _localHeader.flags_desc = (_localHeader.flags & Constants.FLG_DESC) > 0;
          _localHeader.method = data.readUInt16LE(Constants.LOCHOW);
          _localHeader.time = data.readUInt32LE(Constants.LOCTIM);
          _localHeader.crc = data.readUInt32LE(Constants.LOCCRC);
          _localHeader.compressedSize = data.readUInt32LE(Constants.LOCSIZ);
          _localHeader.size = data.readUInt32LE(Constants.LOCLEN);
          _localHeader.fnameLen = data.readUInt16LE(Constants.LOCNAM);
          _localHeader.extraLen = data.readUInt16LE(Constants.LOCEXT);
          const extraStart = _offset + Constants.LOCHDR + _localHeader.fnameLen;
          const extraEnd = extraStart + _localHeader.extraLen;
          return input.slice(extraStart, extraEnd);
        }, "loadLocalHeaderFromBinary"),
        loadFromBinary: /* @__PURE__ */ __name(function(data) {
          if (data.length !== Constants.CENHDR || data.readUInt32LE(0) !== Constants.CENSIG) {
            throw Utils.Errors.INVALID_CEN();
          }
          _verMade = data.readUInt16LE(Constants.CENVEM);
          _version = data.readUInt16LE(Constants.CENVER);
          _flags = data.readUInt16LE(Constants.CENFLG);
          _method = data.readUInt16LE(Constants.CENHOW);
          _time = data.readUInt32LE(Constants.CENTIM);
          _crc = data.readUInt32LE(Constants.CENCRC);
          _compressedSize = data.readUInt32LE(Constants.CENSIZ);
          _size = data.readUInt32LE(Constants.CENLEN);
          _fnameLen = data.readUInt16LE(Constants.CENNAM);
          _extraLen = data.readUInt16LE(Constants.CENEXT);
          _comLen = data.readUInt16LE(Constants.CENCOM);
          _diskStart = data.readUInt16LE(Constants.CENDSK);
          _inattr = data.readUInt16LE(Constants.CENATT);
          _attr = data.readUInt32LE(Constants.CENATX);
          _offset = data.readUInt32LE(Constants.CENOFF);
        }, "loadFromBinary"),
        localHeaderToBinary: /* @__PURE__ */ __name(function() {
          var data = Buffer.alloc(Constants.LOCHDR);
          data.writeUInt32LE(Constants.LOCSIG, 0);
          data.writeUInt16LE(_version, Constants.LOCVER);
          data.writeUInt16LE(_flags & ~Constants.FLG_DESC, Constants.LOCFLG);
          data.writeUInt16LE(_method, Constants.LOCHOW);
          data.writeUInt32LE(_time, Constants.LOCTIM);
          data.writeUInt32LE(_crc, Constants.LOCCRC);
          data.writeUInt32LE(_compressedSize, Constants.LOCSIZ);
          data.writeUInt32LE(_size, Constants.LOCLEN);
          data.writeUInt16LE(_fnameLen, Constants.LOCNAM);
          data.writeUInt16LE(_localHeader.extraLen, Constants.LOCEXT);
          return data;
        }, "localHeaderToBinary"),
        centralHeaderToBinary: /* @__PURE__ */ __name(function() {
          var data = Buffer.alloc(Constants.CENHDR + _fnameLen + _extraLen + _comLen);
          data.writeUInt32LE(Constants.CENSIG, 0);
          data.writeUInt16LE(_verMade, Constants.CENVEM);
          data.writeUInt16LE(_version, Constants.CENVER);
          data.writeUInt16LE(_flags & ~Constants.FLG_DESC, Constants.CENFLG);
          data.writeUInt16LE(_method, Constants.CENHOW);
          data.writeUInt32LE(_time, Constants.CENTIM);
          data.writeUInt32LE(_crc, Constants.CENCRC);
          data.writeUInt32LE(_compressedSize, Constants.CENSIZ);
          data.writeUInt32LE(_size, Constants.CENLEN);
          data.writeUInt16LE(_fnameLen, Constants.CENNAM);
          data.writeUInt16LE(_extraLen, Constants.CENEXT);
          data.writeUInt16LE(_comLen, Constants.CENCOM);
          data.writeUInt16LE(_diskStart, Constants.CENDSK);
          data.writeUInt16LE(_inattr, Constants.CENATT);
          data.writeUInt32LE(_attr, Constants.CENATX);
          data.writeUInt32LE(_offset, Constants.CENOFF);
          return data;
        }, "centralHeaderToBinary"),
        toJSON: /* @__PURE__ */ __name(function() {
          const bytes2 = /* @__PURE__ */ __name(function(nr) {
            return nr + " bytes";
          }, "bytes");
          return {
            made: _verMade,
            version: _version,
            flags: _flags,
            method: Utils.methodToString(_method),
            time: this.time,
            crc: "0x" + _crc.toString(16).toUpperCase(),
            compressedSize: bytes2(_compressedSize),
            size: bytes2(_size),
            fileNameLength: bytes2(_fnameLen),
            extraLength: bytes2(_extraLen),
            commentLength: bytes2(_comLen),
            diskNumStart: _diskStart,
            inAttr: _inattr,
            attr: _attr,
            offset: _offset,
            centralHeaderSize: bytes2(Constants.CENHDR + _fnameLen + _extraLen + _comLen)
          };
        }, "toJSON"),
        toString: /* @__PURE__ */ __name(function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }, "toString")
      };
    };
  }
});

// node_modules/adm-zip/headers/mainHeader.js
var require_mainHeader = __commonJS({
  "node_modules/adm-zip/headers/mainHeader.js"(exports, module) {
    init_modules_watch_stub();
    var Utils = require_util2();
    var Constants = Utils.Constants;
    module.exports = function() {
      var _volumeEntries = 0, _totalEntries = 0, _size = 0, _offset = 0, _commentLength = 0;
      const needsZip64 = /* @__PURE__ */ __name(() => _volumeEntries > Constants.EF_ZIP64_OR_16 || _totalEntries > Constants.EF_ZIP64_OR_16 || _size > Constants.EF_ZIP64_OR_32 || _offset > Constants.EF_ZIP64_OR_32, "needsZip64");
      return {
        get diskEntries() {
          return _volumeEntries;
        },
        set diskEntries(val) {
          _volumeEntries = _totalEntries = val;
        },
        get totalEntries() {
          return _totalEntries;
        },
        set totalEntries(val) {
          _totalEntries = _volumeEntries = val;
        },
        get size() {
          return _size;
        },
        set size(val) {
          _size = val;
        },
        get offset() {
          return _offset;
        },
        set offset(val) {
          _offset = val;
        },
        get commentLength() {
          return _commentLength;
        },
        set commentLength(val) {
          _commentLength = val;
        },
        get mainHeaderSize() {
          return (needsZip64() ? Constants.ZIP64HDR + Constants.END64HDR : 0) + Constants.ENDHDR + _commentLength;
        },
        loadFromBinary: /* @__PURE__ */ __name(function(data) {
          if ((data.length !== Constants.ENDHDR || data.readUInt32LE(0) !== Constants.ENDSIG) && (data.length < Constants.ZIP64HDR || data.readUInt32LE(0) !== Constants.ZIP64SIG)) {
            throw Utils.Errors.INVALID_END();
          }
          if (data.readUInt32LE(0) === Constants.ENDSIG) {
            _volumeEntries = data.readUInt16LE(Constants.ENDSUB);
            _totalEntries = data.readUInt16LE(Constants.ENDTOT);
            _size = data.readUInt32LE(Constants.ENDSIZ);
            _offset = data.readUInt32LE(Constants.ENDOFF);
            _commentLength = data.readUInt16LE(Constants.ENDCOM);
          } else {
            _volumeEntries = Utils.readBigUInt64LE(data, Constants.ZIP64SUB);
            _totalEntries = Utils.readBigUInt64LE(data, Constants.ZIP64TOT);
            _size = Utils.readBigUInt64LE(data, Constants.ZIP64SIZB);
            _offset = Utils.readBigUInt64LE(data, Constants.ZIP64OFF);
            _commentLength = 0;
          }
        }, "loadFromBinary"),
        toBinary: /* @__PURE__ */ __name(function() {
          if (!needsZip64()) {
            var b = Buffer.alloc(Constants.ENDHDR + _commentLength);
            b.writeUInt32LE(Constants.ENDSIG, 0);
            b.writeUInt32LE(0, 4);
            b.writeUInt16LE(_volumeEntries, Constants.ENDSUB);
            b.writeUInt16LE(_totalEntries, Constants.ENDTOT);
            b.writeUInt32LE(_size, Constants.ENDSIZ);
            b.writeUInt32LE(_offset, Constants.ENDOFF);
            b.writeUInt16LE(_commentLength, Constants.ENDCOM);
            b.fill(" ", Constants.ENDHDR);
            return b;
          }
          var b = Buffer.alloc(this.mainHeaderSize);
          let offset = 0;
          b.writeUInt32LE(Constants.ZIP64SIG, offset);
          Utils.writeBigUInt64LE(b, Constants.ZIP64HDR - Constants.ZIP64LEAD, offset + Constants.ZIP64SIZE);
          b.writeUInt16LE(45, offset + Constants.ZIP64VEM);
          b.writeUInt16LE(45, offset + Constants.ZIP64VER);
          b.writeUInt32LE(0, offset + Constants.ZIP64DSK);
          b.writeUInt32LE(0, offset + Constants.ZIP64DSKDIR);
          Utils.writeBigUInt64LE(b, _volumeEntries, offset + Constants.ZIP64SUB);
          Utils.writeBigUInt64LE(b, _totalEntries, offset + Constants.ZIP64TOT);
          Utils.writeBigUInt64LE(b, _size, offset + Constants.ZIP64SIZB);
          Utils.writeBigUInt64LE(b, _offset, offset + Constants.ZIP64OFF);
          const zip64EndOffset = _offset + _size;
          offset += Constants.ZIP64HDR;
          b.writeUInt32LE(Constants.END64SIG, offset);
          b.writeUInt32LE(0, offset + Constants.END64START);
          Utils.writeBigUInt64LE(b, zip64EndOffset, offset + Constants.END64OFF);
          b.writeUInt32LE(1, offset + Constants.END64NUMDISKS);
          offset += Constants.END64HDR;
          b.writeUInt32LE(Constants.ENDSIG, offset);
          b.writeUInt32LE(0, offset + 4);
          b.writeUInt16LE(Math.min(_volumeEntries, Constants.EF_ZIP64_OR_16), offset + Constants.ENDSUB);
          b.writeUInt16LE(Math.min(_totalEntries, Constants.EF_ZIP64_OR_16), offset + Constants.ENDTOT);
          b.writeUInt32LE(Math.min(_size, Constants.EF_ZIP64_OR_32), offset + Constants.ENDSIZ);
          b.writeUInt32LE(Math.min(_offset, Constants.EF_ZIP64_OR_32), offset + Constants.ENDOFF);
          b.writeUInt16LE(_commentLength, offset + Constants.ENDCOM);
          b.fill(" ", offset + Constants.ENDHDR);
          return b;
        }, "toBinary"),
        toJSON: /* @__PURE__ */ __name(function() {
          const offset = /* @__PURE__ */ __name(function(nr, len) {
            let offs = nr.toString(16).toUpperCase();
            while (offs.length < len) offs = "0" + offs;
            return "0x" + offs;
          }, "offset");
          return {
            diskEntries: _volumeEntries,
            totalEntries: _totalEntries,
            size: _size + " bytes",
            offset: offset(_offset, 4),
            commentLength: _commentLength
          };
        }, "toJSON"),
        toString: /* @__PURE__ */ __name(function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }, "toString")
      };
    };
  }
});

// node_modules/adm-zip/headers/index.js
var require_headers = __commonJS({
  "node_modules/adm-zip/headers/index.js"(exports) {
    init_modules_watch_stub();
    exports.EntryHeader = require_entryHeader();
    exports.MainHeader = require_mainHeader();
  }
});

// node-built-in-modules:zlib
import libDefault12 from "zlib";
var require_zlib = __commonJS({
  "node-built-in-modules:zlib"(exports, module) {
    init_modules_watch_stub();
    module.exports = libDefault12;
  }
});

// node_modules/adm-zip/methods/deflater.js
var require_deflater = __commonJS({
  "node_modules/adm-zip/methods/deflater.js"(exports, module) {
    init_modules_watch_stub();
    module.exports = function(inbuf) {
      var zlib = require_zlib();
      var opts = { chunkSize: (parseInt(inbuf.length / 1024) + 1) * 1024 };
      return {
        deflate: /* @__PURE__ */ __name(function() {
          return zlib.deflateRawSync(inbuf, opts);
        }, "deflate"),
        deflateAsync: /* @__PURE__ */ __name(function(callback) {
          var tmp = zlib.createDeflateRaw(opts), parts = [], total = 0;
          tmp.on("data", function(data) {
            parts.push(data);
            total += data.length;
          });
          tmp.on("end", function() {
            var buf = Buffer.alloc(total), written = 0;
            buf.fill(0);
            for (var i = 0; i < parts.length; i++) {
              var part = parts[i];
              part.copy(buf, written);
              written += part.length;
            }
            callback && callback(buf);
          });
          tmp.end(inbuf);
        }, "deflateAsync")
      };
    };
  }
});

// node_modules/adm-zip/methods/inflater.js
var require_inflater = __commonJS({
  "node_modules/adm-zip/methods/inflater.js"(exports, module) {
    init_modules_watch_stub();
    var version = +(process?.versions?.node ?? "").split(".")[0] || 0;
    var Errors = require_errors();
    module.exports = function(inbuf, expectedLength) {
      var zlib = require_zlib();
      const maxOutputLength = expectedLength > 0 ? expectedLength : 1;
      const option = version >= 15 ? { maxOutputLength } : {};
      return {
        inflate: /* @__PURE__ */ __name(function() {
          return zlib.inflateRawSync(inbuf, option);
        }, "inflate"),
        inflateAsync: /* @__PURE__ */ __name(function(callback) {
          var tmp = zlib.createInflateRaw(option), parts = [], total = 0, done = false;
          const fail2 = /* @__PURE__ */ __name(function(err) {
            if (done) return;
            done = true;
            tmp.destroy();
            callback && callback(Buffer.alloc(0), err);
          }, "fail");
          tmp.on("error", function(err) {
            fail2(err);
          });
          tmp.on("data", function(data) {
            if (done) return;
            total += data.length;
            if (total > maxOutputLength) {
              return fail2(Errors.MAX_OUTPUT_EXCEEDED());
            }
            parts.push(data);
          });
          tmp.on("end", function() {
            if (done) return;
            done = true;
            var buf = Buffer.alloc(total), written = 0;
            buf.fill(0);
            for (var i = 0; i < parts.length; i++) {
              var part = parts[i];
              part.copy(buf, written);
              written += part.length;
            }
            callback && callback(buf);
          });
          tmp.end(inbuf);
        }, "inflateAsync")
      };
    };
  }
});

// node_modules/adm-zip/methods/zipcrypto.js
var require_zipcrypto = __commonJS({
  "node_modules/adm-zip/methods/zipcrypto.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    var { randomFillSync } = require_crypto();
    var Errors = require_errors();
    var crctable = new Uint32Array(256).map((t, crc) => {
      for (let j = 0; j < 8; j++) {
        if (0 !== (crc & 1)) {
          crc = crc >>> 1 ^ 3988292384;
        } else {
          crc >>>= 1;
        }
      }
      return crc >>> 0;
    });
    var uMul = /* @__PURE__ */ __name((a, b) => Math.imul(a, b) >>> 0, "uMul");
    var crc32update = /* @__PURE__ */ __name((pCrc32, bval) => {
      return crctable[(pCrc32 ^ bval) & 255] ^ pCrc32 >>> 8;
    }, "crc32update");
    var genSalt = /* @__PURE__ */ __name(() => {
      if ("function" === typeof randomFillSync) {
        return randomFillSync(Buffer.alloc(12));
      } else {
        return genSalt.node();
      }
    }, "genSalt");
    genSalt.node = () => {
      const salt = Buffer.alloc(12);
      const len = salt.length;
      for (let i = 0; i < len; i++) salt[i] = Math.random() * 256 & 255;
      return salt;
    };
    var config = {
      genSalt
    };
    function Initkeys(pw) {
      const pass = Buffer.isBuffer(pw) ? pw : Buffer.from(pw);
      this.keys = new Uint32Array([305419896, 591751049, 878082192]);
      for (let i = 0; i < pass.length; i++) {
        this.updateKeys(pass[i]);
      }
    }
    __name(Initkeys, "Initkeys");
    Initkeys.prototype.updateKeys = function(byteValue) {
      const keys = this.keys;
      keys[0] = crc32update(keys[0], byteValue);
      keys[1] += keys[0] & 255;
      keys[1] = uMul(keys[1], 134775813) + 1;
      keys[2] = crc32update(keys[2], keys[1] >>> 24);
      return byteValue;
    };
    Initkeys.prototype.next = function() {
      const k = (this.keys[2] | 2) >>> 0;
      return uMul(k, k ^ 1) >> 8 & 255;
    };
    function make_decrypter(pwd) {
      const keys = new Initkeys(pwd);
      return function(data) {
        const result = Buffer.alloc(data.length);
        let pos = 0;
        for (let c of data) {
          result[pos++] = keys.updateKeys(c ^ keys.next());
        }
        return result;
      };
    }
    __name(make_decrypter, "make_decrypter");
    function make_encrypter(pwd) {
      const keys = new Initkeys(pwd);
      return function(data, result, pos = 0) {
        if (!result) result = Buffer.alloc(data.length);
        for (let c of data) {
          const k = keys.next();
          result[pos++] = c ^ k;
          keys.updateKeys(c);
        }
        return result;
      };
    }
    __name(make_encrypter, "make_encrypter");
    function decrypt(data, header, pwd) {
      if (!data || !Buffer.isBuffer(data) || data.length < 12) {
        return Buffer.alloc(0);
      }
      const decrypter = make_decrypter(pwd);
      const salt = decrypter(data.slice(0, 12));
      const verifyByte = (header.flags & 8) === 8 ? header.timeHighByte : header.crc >>> 24;
      if (salt[11] !== verifyByte) {
        throw Errors.WRONG_PASSWORD();
      }
      return decrypter(data.slice(12));
    }
    __name(decrypt, "decrypt");
    function _salter(data) {
      if (Buffer.isBuffer(data) && data.length >= 12) {
        config.genSalt = function() {
          return data.slice(0, 12);
        };
      } else if (data === "node") {
        config.genSalt = genSalt.node;
      } else {
        config.genSalt = genSalt;
      }
    }
    __name(_salter, "_salter");
    function encrypt(data, header, pwd, oldlike = false) {
      if (data == null) data = Buffer.alloc(0);
      if (!Buffer.isBuffer(data)) data = Buffer.from(data.toString());
      const encrypter = make_encrypter(pwd);
      const salt = config.genSalt();
      salt[11] = header.crc >>> 24 & 255;
      if (oldlike) salt[10] = header.crc >>> 16 & 255;
      const result = Buffer.alloc(data.length + 12);
      encrypter(salt, result);
      return encrypter(data, result, 12);
    }
    __name(encrypt, "encrypt");
    module.exports = { decrypt, encrypt, _salter };
  }
});

// node_modules/adm-zip/methods/index.js
var require_methods = __commonJS({
  "node_modules/adm-zip/methods/index.js"(exports) {
    init_modules_watch_stub();
    exports.Deflater = require_deflater();
    exports.Inflater = require_inflater();
    exports.ZipCrypto = require_zipcrypto();
  }
});

// node_modules/adm-zip/zipEntry.js
var require_zipEntry = __commonJS({
  "node_modules/adm-zip/zipEntry.js"(exports, module) {
    init_modules_watch_stub();
    var Utils = require_util2();
    var Headers = require_headers();
    var Constants = Utils.Constants;
    var Methods = require_methods();
    module.exports = function(options, input) {
      var _centralHeader = new Headers.EntryHeader(), _entryName = Buffer.alloc(0), _comment = Buffer.alloc(0), _isDirectory = false, uncompressedData = null, _extra = Buffer.alloc(0), _extralocal = Buffer.alloc(0), _efs = true;
      const opts = options;
      const decoder = typeof opts.decoder === "object" ? opts.decoder : Utils.decoder;
      _efs = decoder.hasOwnProperty("efs") ? decoder.efs : false;
      function getCompressedDataFromZip() {
        if (!input || !(input instanceof Uint8Array)) {
          return Buffer.alloc(0);
        }
        _extralocal = _centralHeader.loadLocalHeaderFromBinary(input);
        const dataOffset = _centralHeader.realDataOffset;
        const dataEnd = dataOffset + _centralHeader.compressedSize;
        if (dataOffset < 0 || dataEnd < dataOffset || dataEnd > input.length) {
          throw Utils.Errors.INVALID_LOC();
        }
        return input.slice(dataOffset, dataEnd);
      }
      __name(getCompressedDataFromZip, "getCompressedDataFromZip");
      function crc32OK(data) {
        const expectedCrc = _centralHeader.flags_desc || _centralHeader.localHeader.flags_desc ? _centralHeader.crc : _centralHeader.localHeader.crc;
        return Utils.crc32(data) === expectedCrc;
      }
      __name(crc32OK, "crc32OK");
      function decompress(async, callback, pass) {
        if (typeof callback === "undefined" && typeof async === "string") {
          pass = async;
          async = void 0;
        }
        if (_isDirectory) {
          if (async && callback) {
            callback(Buffer.alloc(0), Utils.Errors.DIRECTORY_CONTENT_ERROR());
          }
          return Buffer.alloc(0);
        }
        var compressedData;
        try {
          compressedData = getCompressedDataFromZip();
          if (compressedData.length === 0) {
            if (async && callback) callback(compressedData);
            return compressedData;
          }
          if (_centralHeader.encrypted) {
            if ("string" !== typeof pass && !Buffer.isBuffer(pass)) {
              throw Utils.Errors.INVALID_PASS_PARAM();
            }
            compressedData = Methods.ZipCrypto.decrypt(compressedData, _centralHeader, pass);
          }
        } catch (err) {
          if (async && callback) {
            callback(Buffer.alloc(0), err);
            return Buffer.alloc(0);
          }
          throw err;
        }
        var data;
        switch (_centralHeader.method) {
          case Utils.Constants.STORED:
            data = Buffer.alloc(compressedData.length);
            compressedData.copy(data);
            if (!crc32OK(data)) {
              if (async && callback) callback(data, Utils.Errors.BAD_CRC());
              throw Utils.Errors.BAD_CRC();
            } else {
              if (async && callback) callback(data);
              return data;
            }
          case Utils.Constants.DEFLATED:
            var inflater = new Methods.Inflater(compressedData, _centralHeader.size);
            if (!async) {
              data = inflater.inflate();
              if (!crc32OK(data)) {
                throw Utils.Errors.BAD_CRC(`"${decoder.decode(_entryName)}"`);
              }
              return data;
            } else {
              inflater.inflateAsync(function(result, err) {
                if (!callback) return;
                if (err) {
                  callback(Buffer.alloc(0), err);
                } else if (!crc32OK(result)) {
                  callback(result, Utils.Errors.BAD_CRC());
                } else {
                  callback(result);
                }
              });
            }
            break;
          default:
            if (async && callback) callback(Buffer.alloc(0), Utils.Errors.UNKNOWN_METHOD());
            throw Utils.Errors.UNKNOWN_METHOD();
        }
      }
      __name(decompress, "decompress");
      function compress(async, callback) {
        if ((!uncompressedData || !uncompressedData.length) && Buffer.isBuffer(input)) {
          if (async && callback) callback(getCompressedDataFromZip());
          return getCompressedDataFromZip();
        }
        if (uncompressedData.length && !_isDirectory) {
          var compressedData;
          switch (_centralHeader.method) {
            case Utils.Constants.STORED:
              _centralHeader.compressedSize = _centralHeader.size;
              compressedData = Buffer.alloc(uncompressedData.length);
              uncompressedData.copy(compressedData);
              if (async && callback) callback(compressedData);
              return compressedData;
            default:
            case Utils.Constants.DEFLATED:
              var deflater = new Methods.Deflater(uncompressedData);
              if (!async) {
                var deflated = deflater.deflate();
                _centralHeader.compressedSize = deflated.length;
                return deflated;
              } else {
                deflater.deflateAsync(function(data) {
                  compressedData = Buffer.alloc(data.length);
                  _centralHeader.compressedSize = data.length;
                  data.copy(compressedData);
                  callback && callback(compressedData);
                });
              }
              deflater = null;
              break;
          }
        } else if (async && callback) {
          callback(Buffer.alloc(0));
        } else {
          return Buffer.alloc(0);
        }
      }
      __name(compress, "compress");
      function readUInt64LE(buffer, offset) {
        return Utils.readBigUInt64LE(buffer, offset);
      }
      __name(readUInt64LE, "readUInt64LE");
      function parseExtra(data) {
        try {
          var offset = 0;
          var signature, size, part;
          while (offset + 4 < data.length) {
            signature = data.readUInt16LE(offset);
            offset += 2;
            size = data.readUInt16LE(offset);
            offset += 2;
            part = data.slice(offset, offset + size);
            offset += size;
            if (Constants.ID_ZIP64 === signature) {
              parseZip64ExtendedInformation(part);
            }
          }
        } catch (error) {
          throw Utils.Errors.EXTRA_FIELD_PARSE_ERROR();
        }
      }
      __name(parseExtra, "parseExtra");
      function parseZip64ExtendedInformation(data) {
        var size, compressedSize, offset, diskNumStart;
        if (data.length >= Constants.EF_ZIP64_SCOMP) {
          size = readUInt64LE(data, Constants.EF_ZIP64_SUNCOMP);
          if (_centralHeader.size === Constants.EF_ZIP64_OR_32) {
            _centralHeader.size = size;
          }
        }
        if (data.length >= Constants.EF_ZIP64_RHO) {
          compressedSize = readUInt64LE(data, Constants.EF_ZIP64_SCOMP);
          if (_centralHeader.compressedSize === Constants.EF_ZIP64_OR_32) {
            _centralHeader.compressedSize = compressedSize;
          }
        }
        if (data.length >= Constants.EF_ZIP64_DSN) {
          offset = readUInt64LE(data, Constants.EF_ZIP64_RHO);
          if (_centralHeader.offset === Constants.EF_ZIP64_OR_32) {
            _centralHeader.offset = offset;
          }
        }
        if (data.length >= Constants.EF_ZIP64_DSN + 4) {
          diskNumStart = data.readUInt32LE(Constants.EF_ZIP64_DSN);
          if (_centralHeader.diskNumStart === Constants.EF_ZIP64_OR_16) {
            _centralHeader.diskNumStart = diskNumStart;
          }
        }
      }
      __name(parseZip64ExtendedInformation, "parseZip64ExtendedInformation");
      return {
        get entryName() {
          return decoder.decode(_entryName);
        },
        get rawEntryName() {
          return _entryName;
        },
        set entryName(val) {
          _entryName = Utils.toBuffer(val, decoder.encode);
          var lastChar = _entryName[_entryName.length - 1];
          _isDirectory = lastChar === 47 || lastChar === 92;
          _centralHeader.fileNameLength = _entryName.length;
        },
        get efs() {
          if (typeof _efs === "function") {
            return _efs(this.entryName);
          } else {
            return _efs;
          }
        },
        get extra() {
          return _extra;
        },
        set extra(val) {
          _extra = val;
          _centralHeader.extraLength = val.length;
          parseExtra(val);
        },
        get comment() {
          return decoder.decode(_comment);
        },
        set comment(val) {
          _comment = Utils.toBuffer(val, decoder.encode);
          _centralHeader.commentLength = _comment.length;
          if (_comment.length > 65535) throw Utils.Errors.COMMENT_TOO_LONG();
        },
        get name() {
          const n = decoder.decode(_entryName);
          return _isDirectory ? n.replace(/[/\\]$/, "").split("/").pop() : n.split("/").pop();
        },
        get isDirectory() {
          return _isDirectory;
        },
        getCompressedData: /* @__PURE__ */ __name(function() {
          return compress(false, null);
        }, "getCompressedData"),
        getCompressedDataAsync: /* @__PURE__ */ __name(function(callback) {
          compress(true, callback);
        }, "getCompressedDataAsync"),
        setData: /* @__PURE__ */ __name(function(value) {
          uncompressedData = Utils.toBuffer(value, Utils.decoder.encode);
          if (!_isDirectory && uncompressedData.length) {
            _centralHeader.size = uncompressedData.length;
            _centralHeader.method = Utils.Constants.DEFLATED;
            _centralHeader.crc = Utils.crc32(value);
            _centralHeader.changed = true;
          } else {
            _centralHeader.method = Utils.Constants.STORED;
          }
        }, "setData"),
        getData: /* @__PURE__ */ __name(function(pass) {
          if (_centralHeader.changed) {
            return uncompressedData;
          } else {
            return decompress(false, null, pass);
          }
        }, "getData"),
        getDataAsync: /* @__PURE__ */ __name(function(callback, pass) {
          if (_centralHeader.changed) {
            callback(uncompressedData);
          } else {
            decompress(true, callback, pass);
          }
        }, "getDataAsync"),
        set attr(attr) {
          _centralHeader.attr = attr;
        },
        get attr() {
          return _centralHeader.attr;
        },
        set header(data) {
          _centralHeader.loadFromBinary(data);
        },
        get header() {
          return _centralHeader;
        },
        packCentralHeader: /* @__PURE__ */ __name(function() {
          _centralHeader.flags_efs = this.efs;
          _centralHeader.extraLength = _extra.length;
          var header = _centralHeader.centralHeaderToBinary();
          var addpos = Utils.Constants.CENHDR;
          _entryName.copy(header, addpos);
          addpos += _entryName.length;
          _extra.copy(header, addpos);
          addpos += _centralHeader.extraLength;
          _comment.copy(header, addpos);
          return header;
        }, "packCentralHeader"),
        packLocalHeader: /* @__PURE__ */ __name(function() {
          let addpos = 0;
          _centralHeader.flags_efs = this.efs;
          _centralHeader.extraLocalLength = _extralocal.length;
          const localHeaderBuf = _centralHeader.localHeaderToBinary();
          const localHeader = Buffer.alloc(localHeaderBuf.length + _entryName.length + _centralHeader.extraLocalLength);
          localHeaderBuf.copy(localHeader, addpos);
          addpos += localHeaderBuf.length;
          _entryName.copy(localHeader, addpos);
          addpos += _entryName.length;
          _extralocal.copy(localHeader, addpos);
          addpos += _extralocal.length;
          return localHeader;
        }, "packLocalHeader"),
        toJSON: /* @__PURE__ */ __name(function() {
          const bytes2 = /* @__PURE__ */ __name(function(nr) {
            return "<" + (nr && nr.length + " bytes buffer" || "null") + ">";
          }, "bytes");
          return {
            entryName: this.entryName,
            name: this.name,
            comment: this.comment,
            isDirectory: this.isDirectory,
            header: _centralHeader.toJSON(),
            compressedData: bytes2(input),
            data: bytes2(uncompressedData)
          };
        }, "toJSON"),
        toString: /* @__PURE__ */ __name(function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }, "toString")
      };
    };
  }
});

// node_modules/adm-zip/zipFile.js
var require_zipFile = __commonJS({
  "node_modules/adm-zip/zipFile.js"(exports, module) {
    init_modules_watch_stub();
    var ZipEntry = require_zipEntry();
    var Headers = require_headers();
    var Utils = require_util2();
    module.exports = function(inBuffer, options) {
      var entryList = [], entryTable = /* @__PURE__ */ Object.create(null), _comment = Buffer.alloc(0), mainHeader = new Headers.MainHeader(), loadedEntries = false;
      var password = null;
      const temporary = /* @__PURE__ */ new Set();
      const opts = options;
      const { noSort, decoder } = opts;
      if (inBuffer) {
        readMainHeader(opts.readEntries);
      } else {
        loadedEntries = true;
      }
      function makeTemporaryFolders() {
        const foldersList = /* @__PURE__ */ new Set();
        for (const elem of Object.keys(entryTable)) {
          const elements = elem.split("/");
          elements.pop();
          if (!elements.length) continue;
          for (let i = 0; i < elements.length; i++) {
            const sub = elements.slice(0, i + 1).join("/") + "/";
            foldersList.add(sub);
          }
        }
        for (const elem of foldersList) {
          if (!(elem in entryTable)) {
            const tempfolder = new ZipEntry(opts);
            tempfolder.entryName = elem;
            tempfolder.attr = 16;
            tempfolder.temporary = true;
            entryList.push(tempfolder);
            entryTable[tempfolder.entryName] = tempfolder;
            temporary.add(tempfolder);
          }
        }
      }
      __name(makeTemporaryFolders, "makeTemporaryFolders");
      function readEntries() {
        loadedEntries = true;
        entryTable = /* @__PURE__ */ Object.create(null);
        if (mainHeader.diskEntries > (inBuffer.length - mainHeader.offset) / Utils.Constants.CENHDR) {
          throw Utils.Errors.DISK_ENTRY_TOO_LARGE();
        }
        entryList = new Array(mainHeader.diskEntries);
        var index = mainHeader.offset;
        for (var i = 0; i < entryList.length; i++) {
          var tmp = index, entry = new ZipEntry(opts, inBuffer);
          entry.header = inBuffer.slice(tmp, tmp += Utils.Constants.CENHDR);
          entry.entryName = inBuffer.slice(tmp, tmp += entry.header.fileNameLength);
          if (entry.header.extraLength) {
            entry.extra = inBuffer.slice(tmp, tmp += entry.header.extraLength);
          }
          if (entry.header.commentLength) entry.comment = inBuffer.slice(tmp, tmp + entry.header.commentLength);
          index += entry.header.centralHeaderSize;
          if (entry.entryName in entryTable) {
            throw Utils.Errors.DUPLICATE_ENTRY(`"${entry.entryName}"`);
          }
          entryList[i] = entry;
          entryTable[entry.entryName] = entry;
        }
        temporary.clear();
        makeTemporaryFolders();
      }
      __name(readEntries, "readEntries");
      function readMainHeader(readNow) {
        var i = inBuffer.length - Utils.Constants.ENDHDR, max = Math.max(0, i - 65535), n = max, endStart = inBuffer.length, endOffset = -1, commentEnd = 0;
        const trailingSpace = typeof opts.trailingSpace === "boolean" ? opts.trailingSpace : false;
        if (trailingSpace) max = 0;
        for (i; i >= n; i--) {
          if (inBuffer[i] !== 80) continue;
          if (inBuffer.readUInt32LE(i) === Utils.Constants.ENDSIG) {
            endOffset = i;
            commentEnd = i;
            endStart = i + Utils.Constants.ENDHDR;
            n = i - Utils.Constants.END64HDR;
            continue;
          }
          if (inBuffer.readUInt32LE(i) === Utils.Constants.END64SIG) {
            n = max;
            continue;
          }
          if (inBuffer.readUInt32LE(i) === Utils.Constants.ZIP64SIG) {
            endOffset = i;
            endStart = i + Utils.readBigUInt64LE(inBuffer, i + Utils.Constants.ZIP64SIZE) + Utils.Constants.ZIP64LEAD;
            break;
          }
        }
        if (endOffset == -1) throw Utils.Errors.INVALID_FORMAT();
        mainHeader.loadFromBinary(inBuffer.slice(endOffset, endStart));
        if (mainHeader.commentLength) {
          _comment = inBuffer.slice(commentEnd + Utils.Constants.ENDHDR);
        }
        if (readNow) readEntries();
      }
      __name(readMainHeader, "readMainHeader");
      function sortEntries() {
        if (entryList.length > 1 && !noSort) {
          entryList = entryList.map((entry) => ({ entry, key: entry.entryName.toLowerCase() })).sort((a, b) => a.key.localeCompare(b.key)).map((pair) => pair.entry);
        }
      }
      __name(sortEntries, "sortEntries");
      return {
        /**
         * Returns an array of ZipEntry objects existent in the current opened archive
         * @return Array
         */
        get entries() {
          if (!loadedEntries) {
            readEntries();
          }
          return entryList.filter((e) => !temporary.has(e));
        },
        /**
         * Archive comment
         * @return {String}
         */
        get comment() {
          return decoder.decode(_comment);
        },
        set comment(val) {
          _comment = Utils.toBuffer(val, decoder.encode);
          mainHeader.commentLength = _comment.length;
        },
        getEntryCount: /* @__PURE__ */ __name(function() {
          if (!loadedEntries) {
            return mainHeader.diskEntries;
          }
          return entryList.length;
        }, "getEntryCount"),
        forEach: /* @__PURE__ */ __name(function(callback) {
          this.entries.forEach(callback);
        }, "forEach"),
        /**
         * Returns a reference to the entry with the given name or null if entry is inexistent
         *
         * @param entryName
         * @return ZipEntry
         */
        getEntry: /* @__PURE__ */ __name(function(entryName) {
          if (!loadedEntries) {
            readEntries();
          }
          return entryTable[entryName] || null;
        }, "getEntry"),
        /**
         * Adds the given entry to the entry list
         *
         * @param entry
         */
        setEntry: /* @__PURE__ */ __name(function(entry) {
          if (!loadedEntries) {
            readEntries();
          }
          entryList.push(entry);
          entryTable[entry.entryName] = entry;
          mainHeader.totalEntries = entryList.length;
        }, "setEntry"),
        /**
         * Removes the file with the given name from the entry list.
         *
         * If the entry is a directory, then all nested files and directories will be removed
         * @param entryName
         * @returns {void}
         */
        deleteFile: /* @__PURE__ */ __name(function(entryName, withsubfolders = true) {
          if (!loadedEntries) {
            readEntries();
          }
          const entry = entryTable[entryName];
          const list = this.getEntryChildren(entry, withsubfolders).map((child) => child.entryName);
          list.forEach(this.deleteEntry);
        }, "deleteFile"),
        /**
         * Removes the entry with the given name from the entry list.
         *
         * @param {string} entryName
         * @returns {void}
         */
        deleteEntry: /* @__PURE__ */ __name(function(entryName) {
          if (!loadedEntries) {
            readEntries();
          }
          const entry = entryTable[entryName];
          const index = entryList.indexOf(entry);
          if (index >= 0) {
            entryList.splice(index, 1);
            delete entryTable[entryName];
            mainHeader.totalEntries = entryList.length;
          }
        }, "deleteEntry"),
        /**
         *  Iterates and returns all nested files and directories of the given entry
         *
         * @param entry
         * @return Array
         */
        getEntryChildren: /* @__PURE__ */ __name(function(entry, subfolders = true) {
          if (!loadedEntries) {
            readEntries();
          }
          if (typeof entry === "object") {
            if (entry.isDirectory && subfolders) {
              const list = [];
              const name = entry.entryName;
              for (const zipEntry of entryList) {
                if (zipEntry.entryName.startsWith(name)) {
                  list.push(zipEntry);
                }
              }
              return list;
            } else {
              return [entry];
            }
          }
          return [];
        }, "getEntryChildren"),
        /**
         *  How many child elements entry has
         *
         * @param {ZipEntry} entry
         * @return {integer}
         */
        getChildCount: /* @__PURE__ */ __name(function(entry) {
          if (entry && entry.isDirectory) {
            const list = this.getEntryChildren(entry);
            return list.includes(entry) ? list.length - 1 : list.length;
          }
          return 0;
        }, "getChildCount"),
        /**
         * Returns the zip file
         *
         * @return Buffer
         */
        compressToBuffer: /* @__PURE__ */ __name(function() {
          if (!loadedEntries) {
            readEntries();
          }
          sortEntries();
          const dataBlock = [];
          const headerBlocks = [];
          let totalSize = 0;
          let dindex = 0;
          mainHeader.size = 0;
          mainHeader.offset = 0;
          let totalEntries = 0;
          for (const entry of this.entries) {
            const compressedData = entry.getCompressedData();
            entry.header.offset = dindex;
            const localHeader = entry.packLocalHeader();
            const dataLength = localHeader.length + compressedData.length;
            dindex += dataLength;
            dataBlock.push(localHeader);
            dataBlock.push(compressedData);
            const centralHeader = entry.packCentralHeader();
            headerBlocks.push(centralHeader);
            mainHeader.size += centralHeader.length;
            totalSize += dataLength + centralHeader.length;
            totalEntries++;
          }
          totalSize += mainHeader.mainHeaderSize;
          mainHeader.offset = dindex;
          mainHeader.totalEntries = totalEntries;
          dindex = 0;
          const outBuffer = Buffer.alloc(totalSize);
          for (const content of dataBlock) {
            content.copy(outBuffer, dindex);
            dindex += content.length;
          }
          for (const content of headerBlocks) {
            content.copy(outBuffer, dindex);
            dindex += content.length;
          }
          const mh = mainHeader.toBinary();
          if (_comment) {
            _comment.copy(mh, mh.length - _comment.length);
          }
          mh.copy(outBuffer, dindex);
          inBuffer = outBuffer;
          loadedEntries = false;
          return outBuffer;
        }, "compressToBuffer"),
        toAsyncBuffer: /* @__PURE__ */ __name(function(onSuccess, onFail, onItemStart, onItemEnd) {
          try {
            if (!loadedEntries) {
              readEntries();
            }
            sortEntries();
            const dataBlock = [];
            const centralHeaders = [];
            let totalSize = 0;
            let dindex = 0;
            let totalEntries = 0;
            mainHeader.size = 0;
            mainHeader.offset = 0;
            const compress2Buffer = /* @__PURE__ */ __name(function(entryLists) {
              if (entryLists.length > 0) {
                const entry = entryLists.shift();
                const name = entry.entryName + entry.extra.toString();
                if (onItemStart) onItemStart(name);
                entry.getCompressedDataAsync(function(compressedData) {
                  if (onItemEnd) onItemEnd(name);
                  entry.header.offset = dindex;
                  const localHeader = entry.packLocalHeader();
                  const dataLength = localHeader.length + compressedData.length;
                  dindex += dataLength;
                  dataBlock.push(localHeader);
                  dataBlock.push(compressedData);
                  const centalHeader = entry.packCentralHeader();
                  centralHeaders.push(centalHeader);
                  mainHeader.size += centalHeader.length;
                  totalSize += dataLength + centalHeader.length;
                  totalEntries++;
                  compress2Buffer(entryLists);
                });
              } else {
                totalSize += mainHeader.mainHeaderSize;
                mainHeader.offset = dindex;
                mainHeader.totalEntries = totalEntries;
                dindex = 0;
                const outBuffer = Buffer.alloc(totalSize);
                dataBlock.forEach(function(content) {
                  content.copy(outBuffer, dindex);
                  dindex += content.length;
                });
                centralHeaders.forEach(function(content) {
                  content.copy(outBuffer, dindex);
                  dindex += content.length;
                });
                const mh = mainHeader.toBinary();
                if (_comment) {
                  _comment.copy(mh, mh.length - _comment.length);
                }
                mh.copy(outBuffer, dindex);
                inBuffer = outBuffer;
                loadedEntries = false;
                onSuccess(outBuffer);
              }
            }, "compress2Buffer");
            compress2Buffer(Array.from(this.entries));
          } catch (e) {
            onFail(e);
          }
        }, "toAsyncBuffer")
      };
    };
  }
});

// node_modules/adm-zip/adm-zip.js
var require_adm_zip = __commonJS({
  "node_modules/adm-zip/adm-zip.js"(exports, module) {
    init_modules_watch_stub();
    var Utils = require_util2();
    var pth = require_path();
    var ZipEntry = require_zipEntry();
    var ZipFile = require_zipFile();
    var get_Bool = /* @__PURE__ */ __name((...val) => Utils.findLast(val, (c) => typeof c === "boolean"), "get_Bool");
    var get_Str = /* @__PURE__ */ __name((...val) => Utils.findLast(val, (c) => typeof c === "string"), "get_Str");
    var get_Fun = /* @__PURE__ */ __name((...val) => Utils.findLast(val, (c) => typeof c === "function"), "get_Fun");
    var defaultOptions2 = {
      // option "noSort" : if true it disables files sorting
      noSort: false,
      // read entries during load (initial loading may be slower)
      readEntries: false,
      // default method is none
      method: Utils.Constants.NONE,
      // file system
      fs: null
    };
    module.exports = function(input, options) {
      let inBuffer = null;
      const opts = Object.assign(/* @__PURE__ */ Object.create(null), defaultOptions2);
      if (input && "object" === typeof input) {
        if (!(input instanceof Uint8Array)) {
          Object.assign(opts, input);
          input = opts.input ? opts.input : void 0;
          if (opts.input) delete opts.input;
        }
        if (Buffer.isBuffer(input)) {
          inBuffer = input;
          opts.method = Utils.Constants.BUFFER;
          input = void 0;
        }
      }
      Object.assign(opts, options);
      const filetools = new Utils(opts);
      const applyDirAttributes = /* @__PURE__ */ __name((dirEntries) => {
        dirEntries.filter((d) => d.attr).sort((a, b) => b.path.length - a.path.length).forEach((d) => filetools.fs.chmodSync(d.path, d.attr));
      }, "applyDirAttributes");
      if (typeof opts.decoder !== "object" || typeof opts.decoder.encode !== "function" || typeof opts.decoder.decode !== "function") {
        opts.decoder = Utils.decoder;
      }
      if (input && "string" === typeof input) {
        if (filetools.fs.existsSync(input)) {
          opts.method = Utils.Constants.FILE;
          opts.filename = input;
          inBuffer = filetools.fs.readFileSync(input);
        } else {
          throw Utils.Errors.INVALID_FILENAME();
        }
      }
      const _zip = new ZipFile(inBuffer, opts);
      const { canonical, sanitize, zipnamefix } = Utils;
      function getEntry(entry) {
        if (entry && _zip) {
          var item;
          if (typeof entry === "string") item = _zip.getEntry(pth.posix.normalize(entry));
          if (typeof entry === "object" && typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined") item = _zip.getEntry(entry.entryName);
          if (item) {
            return item;
          }
        }
        return null;
      }
      __name(getEntry, "getEntry");
      function fixPath(zipPath) {
        const { join, normalize, sep } = pth.posix;
        return join(pth.isAbsolute(zipPath) ? "/" : ".", normalize(sep + zipPath.split("\\").join(sep) + sep));
      }
      __name(fixPath, "fixPath");
      function filenameFilter(filterfn) {
        if (filterfn instanceof RegExp) {
          return /* @__PURE__ */ (function(rx) {
            return function(filename) {
              return rx.test(filename);
            };
          })(filterfn);
        } else if ("function" !== typeof filterfn) {
          return () => true;
        }
        return filterfn;
      }
      __name(filenameFilter, "filenameFilter");
      const relativePath = /* @__PURE__ */ __name((local, entry) => {
        let lastChar = entry.slice(-1);
        lastChar = lastChar === filetools.sep ? filetools.sep : "";
        return pth.relative(local, entry) + lastChar;
      }, "relativePath");
      return {
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @param {Buffer|string} [pass] - password
         * @return Buffer or Null in case of error
         */
        readFile: /* @__PURE__ */ __name(function(entry, pass) {
          var item = getEntry(entry);
          return item && item.getData(pass) || null;
        }, "readFile"),
        /**
         * Returns how many child elements has on entry (directories) on files it is always 0
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @returns {integer}
         */
        childCount: /* @__PURE__ */ __name(function(entry) {
          const item = getEntry(entry);
          if (item) {
            return _zip.getChildCount(item);
          }
        }, "childCount"),
        /**
         * Asynchronous readFile
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @param {callback} callback
         *
         * @return Buffer or Null in case of error
         */
        readFileAsync: /* @__PURE__ */ __name(function(entry, callback) {
          var item = getEntry(entry);
          if (item) {
            item.getDataAsync(callback);
          } else {
            callback(null, "getEntry failed for:" + entry);
          }
        }, "readFileAsync"),
        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param {ZipEntry|string} entry - ZipEntry object or String with the full path of the entry
         * @param {string} encoding - Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText: /* @__PURE__ */ __name(function(entry, encoding) {
          var item = getEntry(entry);
          if (item) {
            var data = item.getData();
            if (data && data.length) {
              return data.toString(encoding || "utf8");
            }
          }
          return "";
        }, "readAsText"),
        /**
         * Asynchronous readAsText
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @param {callback} callback
         * @param {string} [encoding] - Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsTextAsync: /* @__PURE__ */ __name(function(entry, callback, encoding) {
          var item = getEntry(entry);
          if (item) {
            item.getDataAsync(function(data, err) {
              if (err) {
                callback(data, err);
                return;
              }
              if (data && data.length) {
                callback(data.toString(encoding || "utf8"));
              } else {
                callback("");
              }
            });
          } else {
            callback("");
          }
        }, "readAsTextAsync"),
        /**
         * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
         *
         * @param {ZipEntry|string} entry
         * @param {boolean} withsubfolders
         * @returns {void}
         */
        deleteFile: /* @__PURE__ */ __name(function(entry, withsubfolders = true) {
          var item = getEntry(entry);
          if (item) {
            _zip.deleteFile(item.entryName, withsubfolders);
          }
        }, "deleteFile"),
        /**
         * Remove the entry from the file or directory without affecting any nested entries
         *
         * @param {ZipEntry|string} entry
         * @returns {void}
         */
        deleteEntry: /* @__PURE__ */ __name(function(entry) {
          var item = getEntry(entry);
          if (item) {
            _zip.deleteEntry(item.entryName);
          }
        }, "deleteEntry"),
        /**
         * Adds a comment to the zip. The zip must be rewritten after adding the comment.
         *
         * @param {string} comment
         */
        addZipComment: /* @__PURE__ */ __name(function(comment) {
          _zip.comment = comment;
        }, "addZipComment"),
        /**
         * Returns the zip comment
         *
         * @return String
         */
        getZipComment: /* @__PURE__ */ __name(function() {
          return _zip.comment || "";
        }, "getZipComment"),
        /**
         * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
         * The comment cannot exceed 65535 characters in length
         *
         * @param {ZipEntry} entry
         * @param {string} comment
         */
        addZipEntryComment: /* @__PURE__ */ __name(function(entry, comment) {
          var item = getEntry(entry);
          if (item) {
            item.comment = comment;
          }
        }, "addZipEntryComment"),
        /**
         * Returns the comment of the specified entry
         *
         * @param {ZipEntry} entry
         * @return String
         */
        getZipEntryComment: /* @__PURE__ */ __name(function(entry) {
          var item = getEntry(entry);
          if (item) {
            return item.comment || "";
          }
          return "";
        }, "getZipEntryComment"),
        /**
         * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
         *
         * @param {ZipEntry} entry
         * @param {Buffer} content
         */
        updateFile: /* @__PURE__ */ __name(function(entry, content) {
          var item = getEntry(entry);
          if (item) {
            item.setData(content);
          }
        }, "updateFile"),
        /**
         * Adds a file from the disk to the archive
         *
         * @param {string} localPath File to add to zip
         * @param {string} [zipPath] Optional path inside the zip
         * @param {string} [zipName] Optional name for the file
         * @param {string} [comment] Optional file comment
         */
        addLocalFile: /* @__PURE__ */ __name(function(localPath, zipPath, zipName, comment) {
          if (filetools.fs.existsSync(localPath)) {
            zipPath = zipPath ? fixPath(zipPath) : "";
            const p = pth.win32.basename(pth.win32.normalize(localPath));
            zipPath += zipName ? zipName : p;
            const _attr = filetools.fs.statSync(localPath);
            const data = _attr.isFile() ? filetools.fs.readFileSync(localPath) : Buffer.alloc(0);
            if (_attr.isDirectory()) zipPath += filetools.sep;
            this.addFile(zipPath, data, comment, _attr);
          } else {
            throw Utils.Errors.FILE_NOT_FOUND(localPath);
          }
        }, "addLocalFile"),
        /**
         * Callback for showing if everything was done.
         *
         * @callback doneCallback
         * @param {Error} err - Error object
         * @param {boolean} done - was request fully completed
         */
        /**
         * Adds a file from the disk to the archive
         *
         * @param {(object|string)} options - options object, if it is string it us used as localPath.
         * @param {string} options.localPath - Local path to the file.
         * @param {string} [options.comment] - Optional file comment.
         * @param {string} [options.zipPath] - Optional path inside the zip
         * @param {string} [options.zipName] - Optional name for the file
         * @param {doneCallback} callback - The callback that handles the response.
         */
        addLocalFileAsync: /* @__PURE__ */ __name(function(options2, callback) {
          options2 = typeof options2 === "object" ? options2 : { localPath: options2 };
          const localPath = pth.resolve(options2.localPath);
          const { comment } = options2;
          let { zipPath, zipName } = options2;
          const self = this;
          filetools.fs.stat(localPath, function(err, stats) {
            if (err) return callback(err, false);
            zipPath = zipPath ? fixPath(zipPath) : "";
            const p = pth.win32.basename(pth.win32.normalize(localPath));
            zipPath += zipName ? zipName : p;
            if (stats.isFile()) {
              filetools.fs.readFile(localPath, function(err2, data) {
                if (err2) return callback(err2, false);
                self.addFile(zipPath, data, comment, stats);
                return setImmediate(callback, void 0, true);
              });
            } else if (stats.isDirectory()) {
              zipPath += filetools.sep;
              self.addFile(zipPath, Buffer.alloc(0), comment, stats);
              return setImmediate(callback, void 0, true);
            }
          });
        }, "addLocalFileAsync"),
        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param {string} localPath - local path to the folder
         * @param {string} [zipPath] - optional path inside zip
         * @param {(RegExp|function)} [filter] - optional RegExp or Function if files match will be included.
         */
        addLocalFolder: /* @__PURE__ */ __name(function(localPath, zipPath, filter) {
          filter = filenameFilter(filter);
          zipPath = zipPath ? fixPath(zipPath) : "";
          localPath = pth.normalize(localPath);
          if (filetools.fs.existsSync(localPath)) {
            const items = filetools.findFiles(localPath);
            const self = this;
            if (items.length) {
              for (const filepath of items) {
                const p = pth.join(zipPath, relativePath(localPath, filepath));
                if (filter(p)) {
                  self.addLocalFile(filepath, pth.dirname(p));
                }
              }
            }
          } else {
            throw Utils.Errors.FILE_NOT_FOUND(localPath);
          }
        }, "addLocalFolder"),
        /**
         * Asynchronous addLocalFolder
         * @param {string} localPath
         * @param {callback} callback
         * @param {string} [zipPath] optional path inside zip
         * @param {RegExp|function} [filter] optional RegExp or Function if files match will
         *               be included.
         */
        addLocalFolderAsync: /* @__PURE__ */ __name(function(localPath, callback, zipPath, filter) {
          filter = filenameFilter(filter);
          zipPath = zipPath ? fixPath(zipPath) : "";
          localPath = pth.normalize(localPath);
          var self = this;
          filetools.fs.open(localPath, "r", function(err) {
            if (err && err.code === "ENOENT") {
              callback(void 0, Utils.Errors.FILE_NOT_FOUND(localPath));
            } else if (err) {
              callback(void 0, err);
            } else {
              var items = filetools.findFiles(localPath);
              var i = -1;
              var next = /* @__PURE__ */ __name(function() {
                i += 1;
                if (i < items.length) {
                  var filepath = items[i];
                  var p = relativePath(localPath, filepath).split("\\").join("/");
                  p = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
                  if (filter(p)) {
                    filetools.fs.stat(filepath, function(er0, stats) {
                      if (er0) callback(void 0, er0);
                      if (stats.isFile()) {
                        filetools.fs.readFile(filepath, function(er1, data) {
                          if (er1) {
                            callback(void 0, er1);
                          } else {
                            self.addFile(zipPath + p, data, "", stats);
                            next();
                          }
                        });
                      } else {
                        self.addFile(zipPath + p + "/", Buffer.alloc(0), "", stats);
                        next();
                      }
                    });
                  } else {
                    process.nextTick(() => {
                      next();
                    });
                  }
                } else {
                  callback(true, void 0);
                }
              }, "next");
              next();
            }
          });
        }, "addLocalFolderAsync"),
        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param {object | string} options - options object, if it is string it us used as localPath.
         * @param {string} options.localPath - Local path to the folder.
         * @param {string} [options.zipPath] - optional path inside zip.
         * @param {RegExp|function} [options.filter] - optional RegExp or Function if files match will be included.
         * @param {function|string} [options.namefix] - optional function to help fix filename
         * @param {doneCallback} callback - The callback that handles the response.
         *
         */
        addLocalFolderAsync2: /* @__PURE__ */ __name(function(options2, callback) {
          const self = this;
          options2 = typeof options2 === "object" ? options2 : { localPath: options2 };
          const localPath = pth.resolve(options2.localPath);
          let { zipPath, filter, namefix } = options2;
          if (filter instanceof RegExp) {
            filter = /* @__PURE__ */ (function(rx) {
              return function(filename) {
                return rx.test(filename);
              };
            })(filter);
          } else if ("function" !== typeof filter) {
            filter = /* @__PURE__ */ __name(function() {
              return true;
            }, "filter");
          }
          zipPath = zipPath ? fixPath(zipPath) : "";
          if (namefix === "latin1") {
            namefix = /* @__PURE__ */ __name((str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, ""), "namefix");
          }
          if (typeof namefix !== "function") namefix = /* @__PURE__ */ __name((str) => str, "namefix");
          const relPathFix = /* @__PURE__ */ __name((entry) => pth.join(zipPath, namefix(relativePath(localPath, entry))), "relPathFix");
          const fileNameFix = /* @__PURE__ */ __name((entry) => pth.win32.basename(pth.win32.normalize(namefix(entry))), "fileNameFix");
          filetools.fs.open(localPath, "r", function(err) {
            if (err && err.code === "ENOENT") {
              callback(Utils.Errors.FILE_NOT_FOUND(localPath), false);
            } else if (err) {
              callback(err, false);
            } else {
              filetools.findFilesAsync(localPath, function(err2, fileEntries) {
                if (err2) return callback(err2, false);
                fileEntries = fileEntries.filter((dir) => filter(relPathFix(dir)));
                if (!fileEntries.length) return callback(void 0, true);
                setImmediate(
                  fileEntries.reverse().reduce(function(next, entry) {
                    return function(err3, done) {
                      if (err3 || done === false) return setImmediate(next, err3, false);
                      self.addLocalFileAsync(
                        {
                          localPath: entry,
                          zipPath: pth.dirname(relPathFix(entry)),
                          zipName: fileNameFix(entry)
                        },
                        next
                      );
                    };
                  }, callback)
                );
              });
            }
          });
        }, "addLocalFolderAsync2"),
        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param {string} localPath - path where files will be extracted
         * @param {object} props - optional properties
         * @param {string} [props.zipPath] - optional path inside zip
         * @param {RegExp|function} [props.filter] - optional RegExp or Function if files match will be included.
         * @param {function|string} [props.namefix] - optional function to help fix filename
         */
        addLocalFolderPromise: /* @__PURE__ */ __name(function(localPath, props) {
          return new Promise((resolve, reject) => {
            this.addLocalFolderAsync2(Object.assign({ localPath }, props), (err, done) => {
              if (err) return reject(err);
              if (done) resolve(this);
            });
          });
        }, "addLocalFolderPromise"),
        /**
         * Allows you to create a entry (file or directory) in the zip file.
         * If you want to create a directory the entryName must end in / and a null buffer should be provided.
         * Comment and attributes are optional
         *
         * @param {string} entryName
         * @param {Buffer | string} content - file content as buffer or utf8 coded string
         * @param {string} [comment] - file comment
         * @param {number | object} [attr] - number as unix file permissions, object as filesystem Stats object
         */
        addFile: /* @__PURE__ */ __name(function(entryName, content, comment, attr) {
          entryName = zipnamefix(entryName);
          let entry = getEntry(entryName);
          const update = entry != null;
          if (!update) {
            entry = new ZipEntry(opts);
            entry.entryName = entryName;
          }
          entry.comment = comment || "";
          const isStat = "object" === typeof attr && attr instanceof filetools.fs.Stats;
          if (isStat) {
            entry.header.time = attr.mtime;
          }
          var fileattr = entry.isDirectory ? 16 : 0;
          let unix = entry.isDirectory ? 16384 : 32768;
          if (isStat) {
            unix |= 4095 & attr.mode;
          } else if ("number" === typeof attr) {
            unix |= 4095 & attr;
          } else {
            unix |= entry.isDirectory ? 493 : 420;
          }
          fileattr = (fileattr | unix << 16) >>> 0;
          entry.attr = fileattr;
          entry.setData(content);
          if (!update) _zip.setEntry(entry);
          return entry;
        }, "addFile"),
        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @param {string} [password]
         * @returns Array
         */
        getEntries: /* @__PURE__ */ __name(function(password) {
          _zip.password = password;
          return _zip ? _zip.entries : [];
        }, "getEntries"),
        /**
         * Returns a ZipEntry object representing the file or folder specified by ``name``.
         *
         * @param {string} name
         * @return ZipEntry
         */
        getEntry: /* @__PURE__ */ __name(function(name) {
          return getEntry(name);
        }, "getEntry"),
        getEntryCount: /* @__PURE__ */ __name(function() {
          return _zip.getEntryCount();
        }, "getEntryCount"),
        forEach: /* @__PURE__ */ __name(function(callback) {
          return _zip.forEach(callback);
        }, "forEach"),
        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param {string|ZipEntry} entry - ZipEntry object or String with the full path of the entry
         * @param {string} targetPath - Target folder where to write the file
         * @param {boolean} [maintainEntryPath=true] - If maintainEntryPath is true and the entry is inside a folder, the entry folder will be created in targetPath as well. Default is TRUE
         * @param {boolean} [overwrite=false] - If the file already exists at the target path, the file will be overwriten if this is true.
         * @param {boolean} [keepOriginalPermission=false] - The file will be set as the permission from the entry if this is true.
         * @param {string} [outFileName] - String If set will override the filename of the extracted file (Only works if the entry is a file)
         *
         * @return Boolean
         */
        extractEntryTo: /* @__PURE__ */ __name(function(entry, targetPath, maintainEntryPath, overwrite, keepOriginalPermission, outFileName) {
          overwrite = get_Bool(false, overwrite);
          keepOriginalPermission = get_Bool(false, keepOriginalPermission);
          maintainEntryPath = get_Bool(true, maintainEntryPath);
          outFileName = get_Str(keepOriginalPermission, outFileName);
          var item = getEntry(entry);
          if (!item) {
            throw Utils.Errors.NO_ENTRY();
          }
          var entryName = canonical(item.entryName);
          var target = sanitize(targetPath, outFileName && !item.isDirectory ? canonical(outFileName) : maintainEntryPath ? entryName : pth.basename(entryName));
          if (item.isDirectory) {
            var children = _zip.getEntryChildren(item);
            children.forEach(function(child) {
              if (child.isDirectory) return;
              var content2 = child.getData();
              if (!content2) {
                throw Utils.Errors.CANT_EXTRACT_FILE();
              }
              var name = canonical(maintainEntryPath ? child.entryName : child.entryName.substring(item.entryName.length));
              var childName = sanitize(targetPath, name);
              filetools.assertPathSafe(targetPath, childName);
              const fileAttr2 = keepOriginalPermission ? child.header.fileAttr : void 0;
              filetools.writeFileTo(childName, content2, overwrite, fileAttr2);
            });
            return true;
          }
          var content = item.getData(_zip.password);
          if (!content) throw Utils.Errors.CANT_EXTRACT_FILE();
          filetools.assertPathSafe(targetPath, target);
          if (filetools.fs.existsSync(target) && !overwrite) {
            throw Utils.Errors.CANT_OVERRIDE();
          }
          const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
          filetools.writeFileTo(target, content, overwrite, fileAttr);
          return true;
        }, "extractEntryTo"),
        /**
         * Test the archive
         * @param {string} [pass]
         */
        test: /* @__PURE__ */ __name(function(pass) {
          if (!_zip) {
            return false;
          }
          for (var entry of _zip.entries) {
            try {
              if (entry.isDirectory) {
                continue;
              }
              var content = entry.getData(pass);
              if (!content) {
                return false;
              }
            } catch (err) {
              return false;
            }
          }
          return true;
        }, "test"),
        /**
         * Extracts the entire archive to the given location
         *
         * @param {string} targetPath Target location
         * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         * @param {string|Buffer} [pass] password
         */
        extractAllTo: /* @__PURE__ */ __name(function(targetPath, overwrite, keepOriginalPermission, pass) {
          keepOriginalPermission = get_Bool(false, keepOriginalPermission);
          pass = get_Str(keepOriginalPermission, pass);
          overwrite = get_Bool(false, overwrite);
          if (!_zip) throw Utils.Errors.NO_ZIP();
          const dirEntries = [];
          _zip.entries.forEach(function(entry) {
            var entryName = sanitize(targetPath, canonical(entry.entryName));
            filetools.assertPathSafe(targetPath, entryName);
            if (entry.isDirectory) {
              filetools.makeDir(entryName);
              if (keepOriginalPermission) dirEntries.push({ path: entryName, attr: entry.header.fileAttr });
              return;
            }
            var content = entry.getData(pass);
            if (!content) {
              throw Utils.Errors.CANT_EXTRACT_FILE();
            }
            const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
            filetools.writeFileTo(entryName, content, overwrite, fileAttr);
            try {
              filetools.fs.utimesSync(entryName, entry.header.time, entry.header.time);
            } catch (err) {
            }
          });
          applyDirAttributes(dirEntries);
        }, "extractAllTo"),
        /**
         * Asynchronous extractAllTo
         *
         * @param {string} targetPath Target location
         * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         * @param {function} callback The callback will be executed when all entries are extracted successfully or any error is thrown.
         */
        extractAllToAsync: /* @__PURE__ */ __name(function(targetPath, overwrite, keepOriginalPermission, callback) {
          callback = get_Fun(overwrite, keepOriginalPermission, callback);
          keepOriginalPermission = get_Bool(false, keepOriginalPermission);
          overwrite = get_Bool(false, overwrite);
          if (!callback) {
            return new Promise((resolve, reject) => {
              this.extractAllToAsync(targetPath, overwrite, keepOriginalPermission, function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve(this);
                }
              });
            });
          }
          if (!_zip) {
            callback(Utils.Errors.NO_ZIP());
            return;
          }
          targetPath = pth.resolve(targetPath);
          const getPath = /* @__PURE__ */ __name((entry) => sanitize(targetPath, pth.normalize(canonical(entry.entryName))), "getPath");
          const getError = /* @__PURE__ */ __name((msg, file) => new Error(msg + ': "' + file + '"'), "getError");
          const dirEntries = [];
          const fileEntries = [];
          _zip.entries.forEach((e) => {
            if (e.isDirectory) {
              dirEntries.push(e);
            } else {
              fileEntries.push(e);
            }
          });
          const deferredDirAttr = [];
          for (const entry of dirEntries) {
            const dirPath = getPath(entry);
            const dirAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
            try {
              filetools.assertPathSafe(targetPath, dirPath);
              filetools.makeDir(dirPath);
            } catch (er) {
              callback(getError("Unable to create folder", dirPath));
              continue;
            }
            if (dirAttr) deferredDirAttr.push({ path: dirPath, attr: dirAttr });
            try {
              filetools.fs.utimesSync(dirPath, entry.header.time, entry.header.time);
            } catch (er) {
            }
          }
          const done = /* @__PURE__ */ __name((err) => {
            if (!err) {
              try {
                applyDirAttributes(deferredDirAttr);
              } catch (er) {
                return callback(getError("Unable to set folder permissions", er.path || ""));
              }
            }
            callback(err);
          }, "done");
          fileEntries.reverse().reduce(function(next, entry) {
            return function(err) {
              if (err) {
                next(err);
              } else {
                const entryName = pth.normalize(canonical(entry.entryName));
                const filePath = sanitize(targetPath, entryName);
                try {
                  filetools.assertPathSafe(targetPath, filePath);
                } catch (er) {
                  return next(er);
                }
                entry.getDataAsync(function(content, err_1) {
                  if (err_1) {
                    next(err_1);
                  } else if (!content) {
                    next(Utils.Errors.CANT_EXTRACT_FILE());
                  } else {
                    const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
                    filetools.writeFileToAsync(filePath, content, overwrite, fileAttr, function(succ) {
                      if (!succ) {
                        return next(getError("Unable to write file", filePath));
                      }
                      filetools.fs.utimes(filePath, entry.header.time, entry.header.time, function() {
                        next();
                      });
                    });
                  }
                });
              }
            };
          }, done)();
        }, "extractAllToAsync"),
        /**
         * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
         *
         * @param {string} targetFileName
         * @param {function} callback
         */
        writeZip: /* @__PURE__ */ __name(function(targetFileName, callback) {
          if (arguments.length === 1) {
            if (typeof targetFileName === "function") {
              callback = targetFileName;
              targetFileName = "";
            }
          }
          if (!targetFileName && opts.filename) {
            targetFileName = opts.filename;
          }
          if (!targetFileName) return;
          var zipData = _zip.compressToBuffer();
          if (zipData) {
            var ok2 = filetools.writeFileTo(targetFileName, zipData, true);
            if (typeof callback === "function") callback(!ok2 ? new Error("failed") : null, "");
          }
        }, "writeZip"),
        /**
                 *
                 * @param {string} targetFileName
                 * @param {object} [props]
                 * @param {boolean} [props.overwrite=true] If the file already exists at the target path, the file will be overwriten if this is true.
                 * @param {boolean} [props.perm] The file will be set as the permission from the entry if this is true.
        
                 * @returns {Promise<void>}
                 */
        writeZipPromise: /* @__PURE__ */ __name(function(targetFileName, props) {
          const { overwrite, perm } = Object.assign({ overwrite: true }, props);
          return new Promise((resolve, reject) => {
            if (!targetFileName && opts.filename) targetFileName = opts.filename;
            if (!targetFileName) reject("ADM-ZIP: ZIP File Name Missing");
            this.toBufferPromise().then((zipData) => {
              const ret = /* @__PURE__ */ __name((done) => done ? resolve(done) : reject("ADM-ZIP: Wasn't able to write zip file"), "ret");
              filetools.writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
            }, reject);
          });
        }, "writeZipPromise"),
        /**
         * @returns {Promise<Buffer>} A promise to the Buffer.
         */
        toBufferPromise: /* @__PURE__ */ __name(function() {
          return new Promise((resolve, reject) => {
            _zip.toAsyncBuffer(resolve, reject);
          });
        }, "toBufferPromise"),
        /**
         * Returns the content of the entire zip file as a Buffer object
         *
         * @prop {function} [onSuccess]
         * @prop {function} [onFail]
         * @prop {function} [onItemStart]
         * @prop {function} [onItemEnd]
         * @returns {Buffer}
         */
        toBuffer: /* @__PURE__ */ __name(function(onSuccess, onFail, onItemStart, onItemEnd) {
          if (typeof onSuccess === "function") {
            _zip.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
            return null;
          }
          return _zip.compressToBuffer();
        }, "toBuffer")
      };
    };
  }
});

// .wrangler/tmp/bundle-hMKi1M/middleware-loader.entry.ts
init_modules_watch_stub();

// .wrangler/tmp/bundle-hMKi1M/middleware-insertion-facade.js
init_modules_watch_stub();

// server/worker.ts
init_modules_watch_stub();

// server/storage.ts
init_modules_watch_stub();

// server/migrations.ts
init_modules_watch_stub();
var MIGRATIONS = [
  {
    version: 1,
    name: "initial",
    sql: `
create table if not exists vertex_state (
  id smallint primary key check (id = 1),
  revision bigint not null,
  data jsonb not null,
  updated_at timestamptz not null,
  updated_by text not null
);
create table if not exists vertex_history (
  revision bigint primary key,
  command text not null,
  actor text not null,
  at timestamptz not null default now(),
  data jsonb not null
);
create table if not exists vertex_sessions (
  token_hash text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists vertex_drafts (
  user_id text not null,
  draft_key text not null,
  rev bigint not null,
  data text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_key)
);
create table if not exists vertex_meta (
  key text primary key,
  value text not null
);
`
  },
  {
    version: 2,
    name: "backend_only_access",
    // Only the Node backend (a role that bypasses RLS, e.g. Supabase "postgres") may read these tables.
    // RLS without policies denies the Supabase Data API roles even if grants are added later.
    sql: `
alter table vertex_state enable row level security;
alter table vertex_history enable row level security;
alter table vertex_sessions enable row level security;
alter table vertex_drafts enable row level security;
alter table vertex_meta enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on vertex_state, vertex_history, vertex_sessions, vertex_drafts, vertex_meta from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on vertex_state, vertex_history, vertex_sessions, vertex_drafts, vertex_meta from authenticated';
  end if;
end $$;
`
  }
];
var SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
var MIGRATIONS_TABLE = `
create table if not exists vertex_schema_migrations (
  version integer primary key,
  name text not null,
  applied_at timestamptz not null default now()
)`;
function statements(sql) {
  const out = [];
  let buf = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql.startsWith("$$", i)) {
      inDollar = !inDollar;
      buf += "$$";
      i++;
      continue;
    }
    if (sql[i] === ";" && !inDollar) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += sql[i];
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
__name(statements, "statements");
function migrationFileName(m) {
  return `${String(m.version).padStart(4, "0")}_${m.name}.sql`;
}
__name(migrationFileName, "migrationFileName");

// server/storage.ts
var SCHEMA = MIGRATIONS.map((m) => `-- ${migrationFileName(m)}
${m.sql.trim()}`).join("\n\n");
var HISTORY_LIMIT = 200;
var SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
async function openPostgres(connectionString, options = {}) {
  const schema = options.schema ?? "public";
  if (!SCHEMA_NAME.test(schema)) throw new Error(`Invalid schema name \u201C${schema}\u201D.`);
  const { default: pg2 } = await Promise.resolve().then(() => (init_esm(), esm_exports));
  const pool = new pg2.Pool({ connectionString, max: options.max ?? 10 });
  const scoped = schema !== "public";
  if (scoped && options.migrate !== false) await pool.query(`create schema if not exists "${schema}"`);
  const db = {
    kind: "postgres",
    schema,
    query: /* @__PURE__ */ __name((sql, params) => scoped ? db.transaction((tx) => tx.query(sql, params)) : pool.query(sql, params), "query"),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (scoped) await client.query(`set local search_path to "${schema}"`);
        const result = await fn({ query: /* @__PURE__ */ __name((sql, params) => client.query(sql, params), "query") });
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback").catch(() => {
        });
        throw err;
      } finally {
        client.release();
      }
    },
    close: /* @__PURE__ */ __name(() => pool.end(), "close")
  };
  if (options.migrate !== false) await migrate(db);
  return db;
}
__name(openPostgres, "openPostgres");
async function migrate(db) {
  await db.query(MIGRATIONS_TABLE);
  const { rows } = await db.query("select version from vertex_schema_migrations");
  const done = new Set(rows.map((r) => Number(r.version)));
  const applied = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.transaction(async (tx) => {
      for (const statement of statements(m.sql)) await tx.query(statement);
      await tx.query("insert into vertex_schema_migrations (version, name) values ($1, $2)", [m.version, migrationFileName(m)]);
    });
    applied.push(m.version);
  }
  return applied;
}
__name(migrate, "migrate");
async function schemaVersion(db) {
  const { rows } = await db.query("select max(version) as v from vertex_schema_migrations");
  return Number(rows[0]?.v ?? 0);
}
__name(schemaVersion, "schemaVersion");
function toRow(r) {
  return {
    revision: Number(r.revision),
    data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    updatedBy: r.updated_by
  };
}
__name(toRow, "toRow");
async function readState(q, lock = false) {
  const { rows } = await q.query(
    `select revision, data, updated_at, updated_by from vertex_state where id = 1${lock ? " for update" : ""}`
  );
  return rows[0] ? toRow(rows[0]) : null;
}
__name(readState, "readState");
async function writeState(q, next) {
  const json = JSON.stringify(next.data);
  await q.query(
    `insert into vertex_state (id, revision, data, updated_at, updated_by) values (1, $1, $2::jsonb, $3, $4)
     on conflict (id) do update set revision = excluded.revision, data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    [next.revision, json, next.at.toISOString(), next.actor]
  );
  await q.query(`insert into vertex_history (revision, command, actor, at, data) values ($1, $2, $3, $4, $5::jsonb)`, [
    next.revision,
    next.command,
    next.actor,
    next.at.toISOString(),
    json
  ]);
  await q.query(`delete from vertex_history where revision <= $1`, [next.revision - HISTORY_LIMIT]);
}
__name(writeState, "writeState");

// server/service.ts
init_modules_watch_stub();
import { createHash, randomBytes, randomUUID } from "node:crypto";

// src/lib/defaults.ts
init_modules_watch_stub();
var DB_VERSION = 2;
var DEFAULT_UNITS = [
  { id: "U1", name: "Unit 1", shortName: "Unit 1", speciality: "Production unit 1", dailyCapacityJobs: 5 },
  { id: "U2", name: "Unit 2", shortName: "Unit 2", speciality: "Production unit 2", dailyCapacityJobs: 5 },
  { id: "U3", name: "Unit 3", shortName: "Unit 3", speciality: "Production unit 3", dailyCapacityJobs: 5 },
  { id: "U4", name: "Unit 4", shortName: "Unit 4", speciality: "Production unit 4", dailyCapacityJobs: 5 }
];
function account(id, name, email, role, unitId, designation, initials, adminTier = null) {
  return {
    id,
    name,
    email,
    role,
    unitId,
    adminTier,
    designation,
    initials,
    passwordHash: null,
    passwordSalt: null,
    passwordSetAt: null,
    active: true
  };
}
__name(account, "account");
var DEFAULT_USERS = [
  account("USR-ADM1", "Administrator 1", "admin1@vertex.local", "admin", null, "Workflow administrator", "A1", "full"),
  account("USR-ADM2", "Administrator 2", "admin2@vertex.local", "admin", null, "Production & dispatch", "A2", "operations"),
  account("USR-ADM3", "Administrator 3", "admin3@vertex.local", "admin", null, "Billing", "A3", "billing"),
  account("USR-U1", "Unit 1 Supervisor", "unit1@vertex.local", "unit", "U1", "Unit 1 shop floor", "U1"),
  account("USR-U2", "Unit 2 Supervisor", "unit2@vertex.local", "unit", "U2", "Unit 2 shop floor", "U2"),
  account("USR-U3", "Unit 3 Supervisor", "unit3@vertex.local", "unit", "U3", "Unit 3 shop floor", "U3"),
  account("USR-U4", "Unit 4 Supervisor", "unit4@vertex.local", "unit", "U4", "Unit 4 shop floor", "U4")
];
function defaultCompany() {
  return {
    name: "Vertex Print Pack",
    address: "",
    phone: "",
    email: "",
    gstin: "",
    invoicePrefix: "INV",
    bankDetails: "",
    invoiceTerms: "Goods once dispatched will not be taken back. Subject to local jurisdiction.",
    updatedAt: null,
    updatedBy: null
  };
}
__name(defaultCompany, "defaultCompany");
function defaultSettings() {
  return {
    taxLabel: "GST",
    taxPct: 18,
    profitMethod: "markup",
    profitPct: 20,
    bufferHours: 6,
    processCharges: [],
    orderCharges: [],
    updatedAt: null,
    updatedBy: null
  };
}
__name(defaultSettings, "defaultSettings");
function emptyCounters() {
  return { material: 0, product: 0, customer: 0, plan: 0, costing: 0, order: 0, dispatch: 0, invoice: 0, person: 0, machine: 0 };
}
__name(emptyCounters, "emptyCounters");
function buildEmptyDB(now = /* @__PURE__ */ new Date()) {
  return {
    version: DB_VERSION,
    revision: 0,
    createdAt: now.toISOString(),
    migrations: [],
    company: defaultCompany(),
    settings: defaultSettings(),
    units: DEFAULT_UNITS.map((u) => ({ ...u })),
    people: [],
    machines: [],
    users: DEFAULT_USERS.map((u) => ({ ...u })),
    materials: [],
    products: [],
    customers: [],
    plans: [],
    costings: [],
    orders: [],
    dispatches: [],
    invoices: [],
    notifications: [],
    audit: [],
    counters: emptyCounters()
  };
}
__name(buildEmptyDB, "buildEmptyDB");

// src/lib/db.ts
init_modules_watch_stub();

// src/lib/migrate.ts
init_modules_watch_stub();

// src/lib/permissions.ts
init_modules_watch_stub();
var TIER_CAPABILITIES = {
  full: ["master", "planning", "costing", "costing.internals", "production.monitor", "dispatch", "billing", "administration"],
  operations: ["production.monitor", "dispatch", "billing"],
  billing: ["billing"]
};
var UNIT_CAPABILITIES = ["production.work"];
function capabilitiesOf(user) {
  if (!user) return [];
  if (user.role === "unit") return UNIT_CAPABILITIES;
  return TIER_CAPABILITIES[user.adminTier ?? "full"] ?? [];
}
__name(capabilitiesOf, "capabilitiesOf");
function can(user, capability) {
  return capabilitiesOf(user).includes(capability);
}
__name(can, "can");
function seedTierFor(userId, role) {
  if (role !== "admin") return null;
  if (userId.endsWith("ADM2")) return "operations";
  if (userId.endsWith("ADM3")) return "billing";
  return "full";
}
__name(seedTierFor, "seedTierFor");

// src/lib/migrate.ts
var MIGRATION_PROCESS_ALLOCATION = "process-level-allocation-v1";
function migrateProcess(raw, stage, index, fallbackUnit) {
  if (raw.stageId && raw.unitId && raw.status) return raw;
  const done = raw.done ?? false;
  return {
    id: raw.id,
    processDefId: raw.processDefId,
    stageId: stage.id,
    stageDefId: stage.stageDefId,
    stageName: stage.name,
    name: raw.name,
    index: raw.index ?? index,
    unitId: raw.unitId ?? fallbackUnit,
    status: raw.status ?? (done ? "Completed" : stage.status === "Blocked" ? "Blocked" : "Scheduled"),
    durationHours: raw.durationHours ?? 0,
    // The stage's own planned window is the only timing these records ever had.
    plannedStart: raw.plannedStart ?? stage.plannedStart,
    plannedEnd: raw.plannedEnd ?? stage.plannedEnd,
    actualStart: raw.actualStart,
    actualEnd: raw.actualEnd ?? raw.doneAt ?? void 0,
    responsiblePersonId: raw.responsiblePersonId ?? null,
    machineId: raw.machineId ?? null,
    requiresMachine: raw.requiresMachine ?? false,
    noMachineRequired: raw.noMachineRequired ?? false,
    updatedBy: raw.updatedBy,
    updatedAt: raw.updatedAt,
    note: raw.note,
    problem: raw.problem,
    done,
    doneAt: raw.doneAt ?? null,
    doneBy: raw.doneBy ?? null,
    historical: true
  };
}
__name(migrateProcess, "migrateProcess");
function migrateOrder(order) {
  let touched = false;
  const stages = order.stages.map((stage) => {
    const fallbackUnit = stage.unitId ?? stage.processes[0]?.unitId ?? "";
    const processes = stage.processes.map((p, i) => {
      const migrated = migrateProcess(p, stage, i, fallbackUnit);
      if (migrated !== p) touched = true;
      return migrated;
    });
    return touched ? { ...stage, processes } : stage;
  });
  return touched ? { ...order, stages } : order;
}
__name(migrateOrder, "migrateOrder");
function migratePlan(plan, db) {
  if (plan.processUnits && Object.keys(plan.processUnits).length) return plan;
  const product = db.products.find((p) => p.id === plan.productId);
  const processUnits = {};
  const stageUnits = plan.stageUnits ?? {};
  if (product) {
    for (const stage of product.stages) {
      const unitId = stageUnits[stage.id];
      if (!unitId) continue;
      for (const process2 of stage.processes) processUnits[process2.id] = unitId;
    }
  }
  return { ...plan, processUnits };
}
__name(migratePlan, "migratePlan");
function migrateToProcessAllocation(db) {
  const users = db.users.map((u) => u.adminTier || u.role !== "admin" ? u : { ...u, adminTier: seedTierFor(u.id, u.role) });
  const products = db.products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => ({
      ...stage,
      processes: stage.processes.map((p) => typeof p.requiresMachine === "boolean" ? p : { ...p, requiresMachine: false })
    }))
  }));
  const withProducts = { ...db, users, products };
  return {
    ...withProducts,
    plans: withProducts.plans.map((plan) => migratePlan(plan, withProducts)),
    orders: withProducts.orders.map(migrateOrder),
    migrations: db.migrations.includes(MIGRATION_PROCESS_ALLOCATION) ? db.migrations : [...db.migrations, MIGRATION_PROCESS_ALLOCATION]
  };
}
__name(migrateToProcessAllocation, "migrateToProcessAllocation");

// src/lib/db.ts
function normalizeDB(db) {
  const users = [...db.users];
  for (const u of DEFAULT_USERS) if (!users.some((x) => x.id === u.id)) users.push({ ...u });
  const filled = {
    ...buildEmptyDB(new Date(db.createdAt || Date.now())),
    ...db,
    company: { ...defaultCompany(), ...db.company },
    settings: { ...defaultSettings(), ...db.settings },
    counters: { ...emptyCounters(), ...db.counters },
    migrations: db.migrations ?? [],
    users
  };
  return migrateToProcessAllocation(filled);
}
__name(normalizeDB, "normalizeDB");

// src/lib/auth.ts
init_modules_watch_stub();
var ITERATIONS = 12e4;
var MIN_PASSWORD_LENGTH = 8;
function toHex(buffer) {
  const bytes2 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes2, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
function fromHex(hex) {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
__name(fromHex, "fromHex");
function newSalt() {
  const bytes2 = new Uint8Array(16);
  crypto.getRandomValues(bytes2);
  return toHex(bytes2);
}
__name(newSalt, "newSalt");
async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256
  );
  return toHex(bits);
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, saltHex, hashHex) {
  const candidate = await hashPassword(password, saltHex);
  if (candidate.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}
__name(verifyPassword, "verifyPassword");
function passwordProblem(password, confirm) {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}
__name(passwordProblem, "passwordProblem");

// src/domain/registry.ts
init_modules_watch_stub();

// src/domain/dispatch.ts
init_modules_watch_stub();

// src/lib/billing.ts
init_modules_watch_stub();

// src/lib/costing.ts
init_modules_watch_stub();

// src/lib/yield.ts
init_modules_watch_stub();
var EPS = 1e-9;
function fitCount(usable, piece, gap) {
  if (!(piece > 0) || usable + EPS < piece) return 0;
  return Math.floor((usable + gap + EPS) / (piece + gap));
}
__name(fitCount, "fitCount");
function validateYieldInput(input) {
  const { sheetLengthMm, sheetWidthMm, cutLengthMm, cutWidthMm, edgeMarginMm, cutGapMm } = input;
  if (!(sheetLengthMm > 0) || !(sheetWidthMm > 0)) return "Source sheet dimensions must be greater than zero.";
  if (!(cutLengthMm > 0) || !(cutWidthMm > 0)) return "Cut-piece dimensions must be greater than zero.";
  if (!(edgeMarginMm >= 0) || !(cutGapMm >= 0)) return "Edge allowance and cutting gap cannot be negative.";
  if (sheetLengthMm - 2 * edgeMarginMm <= 0 || sheetWidthMm - 2 * edgeMarginMm <= 0)
    return "The edge allowance leaves no usable area on the sheet.";
  return null;
}
__name(validateYieldInput, "validateYieldInput");
function calculateYield(input) {
  const usableLengthMm = input.sheetLengthMm - 2 * input.edgeMarginMm;
  const usableWidthMm = input.sheetWidthMm - 2 * input.edgeMarginMm;
  const empty = {
    ups: 0,
    orientation: "as-drawn",
    along: 0,
    across: 0,
    usableLengthMm: Math.max(0, usableLengthMm),
    usableWidthMm: Math.max(0, usableWidthMm),
    yieldPct: 0,
    areaLimit: 0,
    error: null
  };
  const invalid = validateYieldInput(input);
  if (invalid) return { ...empty, error: invalid };
  const pieceArea = input.cutLengthMm * input.cutWidthMm;
  const areaLimit = Math.floor((usableLengthMm * usableWidthMm + EPS) / pieceArea);
  const alongA = fitCount(usableLengthMm, input.cutLengthMm, input.cutGapMm);
  const acrossA = fitCount(usableWidthMm, input.cutWidthMm, input.cutGapMm);
  let best = {
    ups: alongA * acrossA,
    along: alongA,
    across: acrossA,
    orientation: "as-drawn"
  };
  if (input.rotationAllowed) {
    const alongB = fitCount(usableLengthMm, input.cutWidthMm, input.cutGapMm);
    const acrossB = fitCount(usableWidthMm, input.cutLengthMm, input.cutGapMm);
    if (alongB * acrossB > best.ups) {
      best = { ups: alongB * acrossB, along: alongB, across: acrossB, orientation: "rotated" };
    }
  }
  const sheetArea = input.sheetLengthMm * input.sheetWidthMm;
  return {
    ...empty,
    ups: best.ups,
    along: best.along,
    across: best.across,
    orientation: best.orientation,
    yieldPct: sheetArea > 0 ? best.ups * pieceArea * 100 / sheetArea : 0,
    areaLimit,
    error: best.ups === 0 ? input.rotationAllowed ? "The cut piece does not fit on the usable sheet area in either orientation." : "The cut piece does not fit on the usable sheet area. Allow rotation or check the sizes." : null
  };
}
__name(calculateYield, "calculateYield");
function validateUpsOverride(override, reason, input) {
  if (override === null) return null;
  if (!Number.isInteger(override) || override < 1) return "Ups override must be a whole number of at least 1.";
  if (!reason.trim()) return "Record why the calculated layout is being overridden.";
  const invalid = validateYieldInput({ ...input, cutGapMm: 0 });
  if (invalid) return invalid;
  const usable = (input.sheetLengthMm - 2 * input.edgeMarginMm) * (input.sheetWidthMm - 2 * input.edgeMarginMm);
  const limit = Math.floor((usable + EPS) / (input.cutLengthMm * input.cutWidthMm));
  if (override > limit)
    return `Ups override ${override} exceeds the physical area limit of ${limit} pieces for this sheet.`;
  return null;
}
__name(validateUpsOverride, "validateUpsOverride");
function ceilSafe(value) {
  return Math.ceil(value - EPS);
}
__name(ceilSafe, "ceilSafe");
function roundUpToMultiple(value, multiple) {
  if (!(multiple > 0)) return value;
  return Number((ceilSafe(value / multiple) * multiple).toFixed(6));
}
__name(roundUpToMultiple, "roundUpToMultiple");

// src/lib/costing.ts
var round2 = /* @__PURE__ */ __name((value) => Math.round((value + Number.EPSILON) * 100) / 100, "round2");
var toPaise = /* @__PURE__ */ __name((value) => Math.round((value + Number.EPSILON) * 100), "toPaise");
var fromPaise = /* @__PURE__ */ __name((paise) => paise / 100, "fromPaise");
var round4 = /* @__PURE__ */ __name((value) => Math.round(value * 1e4) / 1e4, "round4");
function pricedUnitLabel(m) {
  if (m.pricingBasis === "per_kg") return "kg";
  if (m.pricingBasis === "per_pack") return `pack of ${m.packSize ?? "?"} ${m.kind === "sheet" ? "sheets" : m.uom}`;
  return m.kind === "sheet" ? "sheet" : m.uom;
}
__name(pricedUnitLabel, "pricedUnitLabel");
function materialConfigIssues(m) {
  const out = [];
  if (m.price === null) out.push("Price missing");
  else if (!(m.price >= 0)) out.push("Price must not be negative");
  if (m.pricingBasis === "per_pack" && !(m.packSize && m.packSize > 0)) out.push("Pack size missing");
  if (!(m.purchaseMultiple > 0)) out.push("Purchase rounding must be greater than zero");
  if (!(m.wastagePct >= 0 && m.wastagePct < 100)) out.push("Wastage must be between 0 and 99.99%");
  if (m.kind === "sheet") {
    if (!(m.sheetLengthMm && m.sheetLengthMm > 0) || !(m.sheetWidthMm && m.sheetWidthMm > 0))
      out.push("Sheet size missing");
    if (m.pricingBasis === "per_kg" && !(m.gsm && m.gsm > 0)) out.push("GSM missing for per-kg pricing");
  } else if (m.pricingBasis === "per_kg") {
    out.push("Per-kg pricing applies to sheet materials; use per unit with uom kg");
  }
  return out;
}
__name(materialConfigIssues, "materialConfigIssues");
function usageConfigIssues(line, m) {
  const out = [];
  if (m.kind === "sheet") {
    if (line.piecesPerProduct === null) out.push("Cut pieces per product not entered");
    else if (!(line.piecesPerProduct > 0)) out.push("Cut pieces per product must be greater than zero");
    if (!(line.cutLengthMm && line.cutLengthMm > 0) || !(line.cutWidthMm && line.cutWidthMm > 0))
      out.push("Cut-piece size missing");
    if (m.sheetLengthMm && m.sheetWidthMm && line.cutLengthMm && line.cutWidthMm) {
      const input = {
        sheetLengthMm: m.sheetLengthMm,
        sheetWidthMm: m.sheetWidthMm,
        cutLengthMm: line.cutLengthMm,
        cutWidthMm: line.cutWidthMm,
        edgeMarginMm: m.edgeMarginMm,
        cutGapMm: m.cutGapMm,
        rotationAllowed: line.rotationAllowed
      };
      const overrideError = validateUpsOverride(line.upsOverride, line.upsOverrideReason, input);
      if (overrideError) out.push(overrideError);
      else if (line.upsOverride === null) {
        const y = calculateYield(input);
        if (y.ups === 0) out.push(y.error ?? "Piece does not fit on the sheet");
      }
    }
  } else if (line.qtyPerPiece === null) {
    out.push("Consumption per piece not entered");
  } else if (!(line.qtyPerPiece > 0)) {
    out.push("Consumption per piece must be greater than zero");
  }
  return out;
}
__name(usageConfigIssues, "usageConfigIssues");
function computeOrderCosting(args) {
  const { product, settings, inputs } = args;
  const issues = [];
  const error = /* @__PURE__ */ __name((message2, fix) => issues.push({ level: "error", message: message2, fix }), "error");
  const warn = /* @__PURE__ */ __name((message2, fix) => issues.push({ level: "warning", message: message2, fix }), "warn");
  const productFix = { label: "Open product in Master", to: `/master/products/${product.productId}` };
  const qty = args.quantity;
  if (!Number.isInteger(qty) || qty < 1) error("Requested quantity must be a whole number of at least 1.");
  const q = Number.isInteger(qty) && qty > 0 ? qty : 0;
  if (product.spec?.status === "proposed") {
    const open = product.spec.openItems.length ? ` Open: ${product.spec.openItems.slice(0, 3).join("; ")}${product.spec.openItems.length > 3 ? "; \u2026" : ""}.` : "";
    error(`Specification is a proposal awaiting customer confirmation (size ${product.spec.rawSize || "not given"}, unit ${product.spec.sizeUnit ?? "unknown"}).${open}`, productFix);
  }
  if (!product.stages.length) error("The product has no stages.", productFix);
  for (const s of product.stages) {
    if (!s.processes.length) error(`Stage \u201C${s.name}\u201D has no processes.`, productFix);
  }
  const byId = new Map(args.materials.map((m) => [m.id, m]));
  const stageName = /* @__PURE__ */ __name((id) => product.stages.find((s) => s.id === id)?.name ?? "", "stageName");
  const processName = /* @__PURE__ */ __name((id) => product.stages.flatMap((s) => s.processes).find((p2) => p2.id === id)?.name ?? "", "processName");
  const materialLines = [];
  if (!product.materials.length) warn("No materials are defined for this product \u2014 only process costs are included.", productFix);
  for (const bom of product.materials) {
    const m = byId.get(bom.materialId);
    if (!m) {
      error("A material used by this product no longer exists in the registry.", productFix);
      continue;
    }
    const materialFix = { label: `Configure ${m.name}`, to: `/master/costing?material=${m.id}` };
    if (!m.active) warn(`${m.name} is deactivated in Master but still used by this product.`, materialFix);
    for (const problem of materialConfigIssues(m)) error(`${m.name}: ${problem}.`, materialFix);
    for (const problem of usageConfigIssues(bom, m)) error(`${m.name}: ${problem}.`, materialFix);
    const line = {
      bomLineId: bom.id,
      materialId: m.id,
      code: m.code,
      name: m.name,
      kind: m.kind,
      uom: m.uom,
      stageName: stageName(bom.stageId),
      processName: processName(bom.processId),
      price: m.price,
      pricingBasis: m.pricingBasis,
      pricedUnitLabel: pricedUnitLabel(m),
      sheet: null,
      piecesNeeded: 0,
      netQty: 0,
      wastagePct: m.wastagePct,
      wastageQty: 0,
      totalQty: 0,
      purchaseQty: 0,
      purchaseUnit: pricedUnitLabel(m),
      surplusQty: 0,
      amount: 0
    };
    const wastagePct = m.wastagePct >= 0 && m.wastagePct < 100 ? m.wastagePct : 0;
    const multiple = m.purchaseMultiple > 0 ? m.purchaseMultiple : 1;
    if (m.kind === "sheet") {
      const ready = m.sheetLengthMm && m.sheetWidthMm && bom.cutLengthMm && bom.cutWidthMm && bom.piecesPerProduct !== null && bom.piecesPerProduct > 0;
      if (ready) {
        const input = {
          sheetLengthMm: m.sheetLengthMm,
          sheetWidthMm: m.sheetWidthMm,
          cutLengthMm: bom.cutLengthMm,
          cutWidthMm: bom.cutWidthMm,
          edgeMarginMm: m.edgeMarginMm,
          cutGapMm: m.cutGapMm,
          rotationAllowed: bom.rotationAllowed
        };
        const y = calculateYield(input);
        const overrideOk = bom.upsOverride !== null && !validateUpsOverride(bom.upsOverride, bom.upsOverrideReason, input);
        const ups = overrideOk ? bom.upsOverride : y.ups;
        line.sheet = {
          ...input,
          calculatedUps: y.ups,
          ups,
          upsSource: overrideOk ? "override" : "calculated",
          orientation: y.orientation,
          across: y.across,
          along: y.along,
          overrideReason: overrideOk ? bom.upsOverrideReason : "",
          yieldPct: overrideOk ? ups * input.cutLengthMm * input.cutWidthMm * 100 / (input.sheetLengthMm * input.sheetWidthMm) : y.yieldPct
        };
        if (ups > 0) {
          line.piecesNeeded = q * bom.piecesPerProduct;
          line.netQty = ceilSafe(line.piecesNeeded / ups);
          line.wastageQty = ceilSafe(line.netQty * wastagePct / 100);
          line.totalQty = line.netQty + line.wastageQty;
          if (m.pricingBasis === "per_pack" && m.packSize && m.packSize > 0) {
            line.purchaseQty = roundUpToMultiple(ceilSafe(line.totalQty / m.packSize), multiple);
            line.surplusQty = line.purchaseQty * m.packSize - line.totalQty;
          } else if (m.pricingBasis === "per_kg" && m.gsm && m.gsm > 0) {
            const kgPerSheet = input.sheetLengthMm / 1e3 * (input.sheetWidthMm / 1e3) * (m.gsm / 1e3);
            line.purchaseQty = roundUpToMultiple(round4(line.totalQty * kgPerSheet), multiple);
            line.surplusQty = round4(line.purchaseQty / kgPerSheet - line.totalQty);
          } else {
            line.purchaseQty = roundUpToMultiple(line.totalQty, multiple);
            line.surplusQty = round4(line.purchaseQty - line.totalQty);
          }
        }
      }
    } else if (bom.qtyPerPiece !== null && bom.qtyPerPiece > 0) {
      line.netQty = round4(q * bom.qtyPerPiece);
      line.piecesNeeded = line.netQty;
      line.wastageQty = round4(line.netQty * wastagePct / 100);
      line.totalQty = round4(line.netQty + line.wastageQty);
      if (m.pricingBasis === "per_pack" && m.packSize && m.packSize > 0) {
        line.purchaseQty = roundUpToMultiple(ceilSafe(line.totalQty / m.packSize), multiple);
        line.surplusQty = round4(line.purchaseQty * m.packSize - line.totalQty);
      } else {
        line.purchaseQty = roundUpToMultiple(line.totalQty, multiple);
        line.surplusQty = round4(line.purchaseQty - line.totalQty);
      }
    }
    line.amount = m.price !== null && m.price >= 0 ? round2(line.purchaseQty * m.price) : 0;
    materialLines.push(line);
  }
  const processLines = [];
  for (const stage of product.stages) {
    for (const p2 of stage.processes) {
      if (p2.setupHours === null) error(`${stage.name} \u203A ${p2.name}: setup time not entered (enter 0 if none).`, productFix);
      if (p2.runHoursPer1000 === null) error(`${stage.name} \u203A ${p2.name}: run time not entered.`, productFix);
      const runHours = Math.max(0, p2.runHoursPer1000 ?? 0) * q / 1e3;
      const hours = round2(Math.max(0, p2.setupHours ?? 0) + runHours);
      let basis = p2.costBasis;
      let rate = p2.rate;
      let setupCharge = p2.setupCharge;
      let chargeName = null;
      if (p2.chargeId) {
        const charge = settings.processCharges.find((c) => c.id === p2.chargeId);
        const chargeFix = { label: "Open process charges", to: "/master/costing?tab=charges" };
        if (!charge) {
          error(`${stage.name} \u203A ${p2.name}: its process charge was removed from Master.`, productFix);
          rate = null;
          setupCharge = null;
        } else {
          chargeName = charge.name;
          basis = charge.basis;
          rate = charge.rate;
          setupCharge = charge.setupCharge;
          if (!charge.active) warn(`Process charge \u201C${charge.name}\u201D is deactivated but still referenced.`, chargeFix);
          if (rate === null) error(`Process charge \u201C${charge.name}\u201D has no rate.`, chargeFix);
          if (setupCharge === null) error(`Process charge \u201C${charge.name}\u201D has no setup charge (enter 0 if none).`, chargeFix);
        }
      } else {
        if (rate === null) error(`${stage.name} \u203A ${p2.name}: process rate missing (enter 0 if no charge).`, productFix);
        if (setupCharge === null)
          error(`${stage.name} \u203A ${p2.name}: setup charge missing (enter 0 if none).`, productFix);
      }
      if (rate !== null && rate < 0 || setupCharge !== null && setupCharge < 0)
        error(`${stage.name} \u203A ${p2.name}: charges cannot be negative.`, productFix);
      const r = rate !== null && rate >= 0 ? rate : 0;
      const runCost = basis === "per_1000" ? r * q / 1e3 : basis === "per_piece" ? r * q : basis === "per_hour" ? r * runHours : r;
      const setupCost2 = setupCharge !== null && setupCharge >= 0 ? setupCharge : 0;
      processLines.push({
        stageId: stage.id,
        stageName: stage.name,
        processId: p2.id,
        processName: p2.name,
        chargeName,
        basis,
        rate,
        setupCharge,
        hours,
        runCost: round2(runCost),
        setupCost: round2(setupCost2),
        amount: round2(runCost + setupCost2)
      });
    }
  }
  const materialCost = round2(materialLines.reduce((s, l) => s + l.amount, 0));
  const processRunCost = round2(processLines.reduce((s, l) => s + l.runCost, 0));
  const setupCost = round2(processLines.reduce((s, l) => s + l.setupCost, 0));
  const chargeLines = [];
  for (const c of inputs.charges) {
    const label2 = c.name.trim() || "Unnamed charge";
    if (!c.name.trim()) error("Every additional order charge needs a name.");
    if (c.amount === null) error(`${label2}: amount missing (enter 0 or remove the charge).`);
    else if (c.amount < 0) error(`${label2}: amount cannot be negative.`);
    const a = c.amount !== null && c.amount >= 0 ? c.amount : 0;
    const amount = c.basis === "fixed" ? a : c.basis === "per_1000" ? a * q / 1e3 : (materialCost + processRunCost + setupCost) * a / 100;
    chargeLines.push({ id: c.id, name: label2, basis: c.basis, input: c.amount, amount: round2(amount) });
  }
  const chargesCost = round2(chargeLines.reduce((s, l) => s + l.amount, 0));
  const totalCost = round2(materialCost + processRunCost + setupCost + chargesCost);
  const costPerPiece = q ? totalCost / q : 0;
  let p = inputs.profitPct;
  if (!Number.isFinite(p) || p < 0) {
    error("Profit percentage must be zero or more.");
    p = 0;
  } else if (inputs.profitMethod === "margin" && p >= 100) {
    error("Margin on selling price must be below 100%.");
    p = 0;
  } else if (p > 1e3) {
    error("Profit percentage looks wrong (over 1000%).");
    p = 0;
  }
  const targetSelling = inputs.profitMethod === "margin" ? totalCost / (1 - p / 100) : totalCost * (1 + p / 100);
  const sellingPerPiece = q ? round2(targetSelling / q) : 0;
  const totalSelling = fromPaise(toPaise(sellingPerPiece) * q);
  const profitAmount = round2(totalSelling - totalCost);
  if (q && totalCost > 0 && profitAmount < 0) warn("Selling price is below total cost after rounding.");
  let discountAmount = 0;
  if (!Number.isFinite(inputs.discountValue) || inputs.discountValue < 0) {
    error("Discount cannot be negative.");
  } else if (inputs.discountType === "percent") {
    if (inputs.discountValue > 100) error("Discount percentage cannot exceed 100%.");
    else discountAmount = round2(totalSelling * inputs.discountValue / 100);
  } else if (inputs.discountValue > totalSelling) {
    error("Discount cannot exceed the total selling price.");
  } else {
    discountAmount = round2(inputs.discountValue);
  }
  let taxPct = inputs.taxPct;
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
    error("Tax percentage must be between 0 and 100.");
    taxPct = 0;
  }
  const taxableValue = round2(totalSelling - discountAmount);
  const taxAmount = round2(taxableValue * taxPct / 100);
  return {
    quantity: q,
    materialLines,
    processLines,
    chargeLines,
    materialCost,
    processRunCost,
    setupCost,
    chargesCost,
    totalCost,
    costPerPiece,
    profitMethod: inputs.profitMethod,
    profitPct: p,
    sellingPerPiece,
    totalSelling,
    profitAmount,
    effectiveMarkupPct: totalCost > 0 ? profitAmount / totalCost * 100 : 0,
    effectiveMarginPct: totalSelling > 0 ? profitAmount / totalSelling * 100 : 0,
    discountAmount,
    taxableValue,
    taxLabel: settings.taxLabel,
    taxPct,
    taxAmount,
    grandTotal: round2(taxableValue + taxAmount),
    issues,
    valid: !issues.some((i) => i.level === "error")
  };
}
__name(computeOrderCosting, "computeOrderCosting");

// src/lib/billing.ts
function orderBalance(order, dispatches) {
  const dispatchedQty = dispatches.filter((d) => d.orderId === order.id).reduce((s, d) => s + d.quantity, 0);
  const completedQty = order.status === "Completed" ? order.completedQty : 0;
  return {
    orderedQty: order.quantity,
    completedQty,
    dispatchedQty,
    remainingQty: Math.max(0, completedQty - dispatchedQty)
  };
}
__name(orderBalance, "orderBalance");
var BillingError = class extends Error {
  static {
    __name(this, "BillingError");
  }
};
function allocateInvoice(totals, previous, thisQty) {
  const ordered = totals.quantity;
  const previouslyDispatched = previous.reduce((s, p) => s + p.partial.thisQty, 0);
  if (!Number.isInteger(thisQty) || thisQty < 1) throw new BillingError("Dispatch quantity must be a whole number of at least 1.");
  if (previouslyDispatched + thisQty > ordered)
    throw new BillingError(
      `Only ${ordered - previouslyDispatched} pieces remain to be billed on this order; ${thisQty} were requested.`
    );
  const ratePaise = toPaise(totals.sellingPerPiece);
  const isFinal = previouslyDispatched + thisQty === ordered;
  let subtotal;
  let discount;
  let tax;
  if (isFinal) {
    subtotal = toPaise(totals.totalSelling) - previous.reduce((s, p) => s + toPaise(p.subtotal), 0);
    discount = toPaise(totals.discountAmount) - previous.reduce((s, p) => s + toPaise(p.discount), 0);
    const taxable2 = subtotal - discount;
    tax = toPaise(totals.taxAmount) - previous.reduce((s, p) => s + toPaise(p.taxAmount), 0);
    if (subtotal < 0 || discount < 0 || taxable2 < 0 || tax < 0)
      throw new BillingError("Previous invoices already exceed the order totals; the final invoice cannot be reconciled.");
  } else {
    subtotal = ratePaise * thisQty;
    discount = Math.round(toPaise(totals.discountAmount) * thisQty / ordered);
    tax = Math.round((subtotal - discount) * totals.taxPct / 100);
  }
  const taxable = subtotal - discount;
  return {
    quantity: thisQty,
    rate: fromPaise(ratePaise),
    subtotal: fromPaise(subtotal),
    discount: fromPaise(discount),
    taxableValue: fromPaise(taxable),
    taxPct: totals.taxPct,
    taxAmount: fromPaise(tax),
    total: fromPaise(taxable + tax),
    previouslyDispatched,
    remainingAfter: ordered - previouslyDispatched - thisQty,
    isFinal,
    isSingleFull: isFinal && previous.length === 0
  };
}
__name(allocateInvoice, "allocateInvoice");
var ALLOCATION_NOTE = "Rate is the finalized selling price per piece. Discount is allocated by quantity and tax is calculated on this invoice\u2019s taxable value; the final dispatch invoice absorbs rounding so all invoices total the order value exactly.";
var GSTIN_RE = /^[0-9]{2}[A-Z0-9]{13}$/;
function gstinState(gstin) {
  const v = gstin.trim().toUpperCase();
  return GSTIN_RE.test(v) ? v.slice(0, 2) : null;
}
__name(gstinState, "gstinState");
function isValidGstin(gstin) {
  return gstinState(gstin) !== null;
}
__name(isValidGstin, "isValidGstin");
function splitTax(taxAmount, sellerGstin, buyerGstin, placeOfSupply) {
  const seller = gstinState(sellerGstin);
  const buyer = gstinState(buyerGstin) ?? (/^\d{2}$/.test(placeOfSupply.trim()) ? placeOfSupply.trim() : null);
  if (!seller || !buyer) return { cgst: null, sgst: null, igst: null };
  if (seller !== buyer) return { cgst: null, sgst: null, igst: taxAmount };
  const paise = toPaise(taxAmount);
  const cgst = Math.floor(paise / 2);
  return { cgst: fromPaise(cgst), sgst: fromPaise(paise - cgst), igst: null };
}
__name(splitTax, "splitTax");
function financialYear(isoDate) {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
__name(financialYear, "financialYear");
function invoiceNumber(prefix, isoDate, seq) {
  const clean = prefix.trim().replace(/[^A-Za-z0-9-]/g, "") || "INV";
  return `${clean}/${financialYear(isoDate)}/${String(seq).padStart(4, "0")}`;
}
__name(invoiceNumber, "invoiceNumber");

// src/domain/common.ts
init_modules_watch_stub();

// node_modules/date-fns/constructFrom.js
init_modules_watch_stub();

// node_modules/date-fns/constants.js
init_modules_watch_stub();
var daysInYear = 365.2425;
var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
var minTime = -maxTime;
var millisecondsInWeek = 6048e5;
var millisecondsInDay = 864e5;
var millisecondsInMinute = 6e4;
var millisecondsInHour = 36e5;
var secondsInHour = 3600;
var secondsInDay = secondsInHour * 24;
var secondsInWeek = secondsInDay * 7;
var secondsInYear = secondsInDay * daysInYear;
var secondsInMonth = secondsInYear / 12;
var secondsInQuarter = secondsInMonth * 3;
var constructFromSymbol = /* @__PURE__ */ Symbol.for("constructDateFrom");

// node_modules/date-fns/constructFrom.js
function constructFrom(date, value) {
  if (typeof date === "function") return date(value);
  if (date && typeof date === "object" && constructFromSymbol in date)
    return date[constructFromSymbol](value);
  if (date instanceof Date) return new date.constructor(value);
  return new Date(value);
}
__name(constructFrom, "constructFrom");

// node_modules/date-fns/toDate.js
init_modules_watch_stub();
function toDate(argument, context) {
  return constructFrom(context || argument, argument);
}
__name(toDate, "toDate");

// node_modules/date-fns/getISOWeekYear.js
init_modules_watch_stub();

// node_modules/date-fns/startOfISOWeek.js
init_modules_watch_stub();

// node_modules/date-fns/startOfWeek.js
init_modules_watch_stub();

// node_modules/date-fns/_lib/defaultOptions.js
init_modules_watch_stub();
var defaultOptions = {};
function getDefaultOptions() {
  return defaultOptions;
}
__name(getDefaultOptions, "getDefaultOptions");

// node_modules/date-fns/startOfWeek.js
function startOfWeek(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const _date = toDate(date, options?.in);
  const day = _date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  _date.setDate(_date.getDate() - diff);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
__name(startOfWeek, "startOfWeek");

// node_modules/date-fns/startOfISOWeek.js
function startOfISOWeek(date, options) {
  return startOfWeek(date, { ...options, weekStartsOn: 1 });
}
__name(startOfISOWeek, "startOfISOWeek");

// node_modules/date-fns/getISOWeekYear.js
function getISOWeekYear(date, options) {
  const _date = toDate(date, options?.in);
  const year = _date.getFullYear();
  const fourthOfJanuaryOfNextYear = constructFrom(_date, 0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
  const fourthOfJanuaryOfThisYear = constructFrom(_date, 0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}
__name(getISOWeekYear, "getISOWeekYear");

// node_modules/date-fns/differenceInCalendarDays.js
init_modules_watch_stub();

// node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js
init_modules_watch_stub();
function getTimezoneOffsetInMilliseconds(date) {
  const _date = toDate(date);
  const utcDate = new Date(
    Date.UTC(
      _date.getFullYear(),
      _date.getMonth(),
      _date.getDate(),
      _date.getHours(),
      _date.getMinutes(),
      _date.getSeconds(),
      _date.getMilliseconds()
    )
  );
  utcDate.setUTCFullYear(_date.getFullYear());
  return +date - +utcDate;
}
__name(getTimezoneOffsetInMilliseconds, "getTimezoneOffsetInMilliseconds");

// node_modules/date-fns/_lib/normalizeDates.js
init_modules_watch_stub();
function normalizeDates(context, ...dates) {
  const normalize = constructFrom.bind(
    null,
    context || dates.find((date) => typeof date === "object")
  );
  return dates.map(normalize);
}
__name(normalizeDates, "normalizeDates");

// node_modules/date-fns/startOfDay.js
init_modules_watch_stub();
function startOfDay(date, options) {
  const _date = toDate(date, options?.in);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
__name(startOfDay, "startOfDay");

// node_modules/date-fns/differenceInCalendarDays.js
function differenceInCalendarDays(laterDate, earlierDate, options) {
  const [laterDate_, earlierDate_] = normalizeDates(
    options?.in,
    laterDate,
    earlierDate
  );
  const laterStartOfDay = startOfDay(laterDate_);
  const earlierStartOfDay = startOfDay(earlierDate_);
  const laterTimestamp = +laterStartOfDay - getTimezoneOffsetInMilliseconds(laterStartOfDay);
  const earlierTimestamp = +earlierStartOfDay - getTimezoneOffsetInMilliseconds(earlierStartOfDay);
  return Math.round((laterTimestamp - earlierTimestamp) / millisecondsInDay);
}
__name(differenceInCalendarDays, "differenceInCalendarDays");

// node_modules/date-fns/startOfISOWeekYear.js
init_modules_watch_stub();
function startOfISOWeekYear(date, options) {
  const year = getISOWeekYear(date, options);
  const fourthOfJanuary = constructFrom(options?.in || date, 0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  return startOfISOWeek(fourthOfJanuary);
}
__name(startOfISOWeekYear, "startOfISOWeekYear");

// node_modules/date-fns/isSameDay.js
init_modules_watch_stub();
function isSameDay(laterDate, earlierDate, options) {
  const [dateLeft_, dateRight_] = normalizeDates(
    options?.in,
    laterDate,
    earlierDate
  );
  return +startOfDay(dateLeft_) === +startOfDay(dateRight_);
}
__name(isSameDay, "isSameDay");

// node_modules/date-fns/isValid.js
init_modules_watch_stub();

// node_modules/date-fns/isDate.js
init_modules_watch_stub();
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}
__name(isDate, "isDate");

// node_modules/date-fns/isValid.js
function isValid(date) {
  return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
}
__name(isValid, "isValid");

// node_modules/date-fns/_lib/getRoundingMethod.js
init_modules_watch_stub();
function getRoundingMethod(method) {
  return (number) => {
    const round = method ? Math[method] : Math.trunc;
    const result = round(number);
    return result === 0 ? 0 : result;
  };
}
__name(getRoundingMethod, "getRoundingMethod");

// node_modules/date-fns/differenceInMilliseconds.js
init_modules_watch_stub();
function differenceInMilliseconds(laterDate, earlierDate) {
  return +toDate(laterDate) - +toDate(earlierDate);
}
__name(differenceInMilliseconds, "differenceInMilliseconds");

// node_modules/date-fns/differenceInMinutes.js
init_modules_watch_stub();
function differenceInMinutes(dateLeft, dateRight, options) {
  const diff = differenceInMilliseconds(dateLeft, dateRight) / millisecondsInMinute;
  return getRoundingMethod(options?.roundingMethod)(diff);
}
__name(differenceInMinutes, "differenceInMinutes");

// node_modules/date-fns/startOfYear.js
init_modules_watch_stub();
function startOfYear(date, options) {
  const date_ = toDate(date, options?.in);
  date_.setFullYear(date_.getFullYear(), 0, 1);
  date_.setHours(0, 0, 0, 0);
  return date_;
}
__name(startOfYear, "startOfYear");

// node_modules/date-fns/format.js
init_modules_watch_stub();

// node_modules/date-fns/_lib/defaultLocale.js
init_modules_watch_stub();

// node_modules/date-fns/locale/en-US.js
init_modules_watch_stub();

// node_modules/date-fns/locale/en-US/_lib/formatDistance.js
init_modules_watch_stub();
var formatDistanceLocale = {
  lessThanXSeconds: {
    one: "less than a second",
    other: "less than {{count}} seconds"
  },
  xSeconds: {
    one: "1 second",
    other: "{{count}} seconds"
  },
  halfAMinute: "half a minute",
  lessThanXMinutes: {
    one: "less than a minute",
    other: "less than {{count}} minutes"
  },
  xMinutes: {
    one: "1 minute",
    other: "{{count}} minutes"
  },
  aboutXHours: {
    one: "about 1 hour",
    other: "about {{count}} hours"
  },
  xHours: {
    one: "1 hour",
    other: "{{count}} hours"
  },
  xDays: {
    one: "1 day",
    other: "{{count}} days"
  },
  aboutXWeeks: {
    one: "about 1 week",
    other: "about {{count}} weeks"
  },
  xWeeks: {
    one: "1 week",
    other: "{{count}} weeks"
  },
  aboutXMonths: {
    one: "about 1 month",
    other: "about {{count}} months"
  },
  xMonths: {
    one: "1 month",
    other: "{{count}} months"
  },
  aboutXYears: {
    one: "about 1 year",
    other: "about {{count}} years"
  },
  xYears: {
    one: "1 year",
    other: "{{count}} years"
  },
  overXYears: {
    one: "over 1 year",
    other: "over {{count}} years"
  },
  almostXYears: {
    one: "almost 1 year",
    other: "almost {{count}} years"
  }
};
var formatDistance = /* @__PURE__ */ __name((token, count, options) => {
  let result;
  const tokenValue = formatDistanceLocale[token];
  if (typeof tokenValue === "string") {
    result = tokenValue;
  } else if (count === 1) {
    result = tokenValue.one;
  } else {
    result = tokenValue.other.replace("{{count}}", count.toString());
  }
  if (options?.addSuffix) {
    if (options.comparison && options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }
  return result;
}, "formatDistance");

// node_modules/date-fns/locale/en-US/_lib/formatLong.js
init_modules_watch_stub();

// node_modules/date-fns/locale/_lib/buildFormatLongFn.js
init_modules_watch_stub();
function buildFormatLongFn(args) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : args.defaultWidth;
    const format2 = args.formats[width] || args.formats[args.defaultWidth];
    return format2;
  };
}
__name(buildFormatLongFn, "buildFormatLongFn");

// node_modules/date-fns/locale/en-US/_lib/formatLong.js
var dateFormats = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y",
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};
var timeFormats = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};
var dateTimeFormats = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};
var formatLong = {
  date: buildFormatLongFn({
    formats: dateFormats,
    defaultWidth: "full"
  }),
  time: buildFormatLongFn({
    formats: timeFormats,
    defaultWidth: "full"
  }),
  dateTime: buildFormatLongFn({
    formats: dateTimeFormats,
    defaultWidth: "full"
  })
};

// node_modules/date-fns/locale/en-US/_lib/formatRelative.js
init_modules_watch_stub();
var formatRelativeLocale = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};
var formatRelative = /* @__PURE__ */ __name((token, _date, _baseDate, _options) => formatRelativeLocale[token], "formatRelative");

// node_modules/date-fns/locale/en-US/_lib/localize.js
init_modules_watch_stub();

// node_modules/date-fns/locale/_lib/buildLocalizeFn.js
init_modules_watch_stub();
function buildLocalizeFn(args) {
  return (value, options) => {
    const context = options?.context ? String(options.context) : "standalone";
    let valuesArray;
    if (context === "formatting" && args.formattingValues) {
      const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      const width = options?.width ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      const defaultWidth = args.defaultWidth;
      const width = options?.width ? String(options.width) : args.defaultWidth;
      valuesArray = args.values[width] || args.values[defaultWidth];
    }
    const index = args.argumentCallback ? args.argumentCallback(value) : value;
    return valuesArray[index];
  };
}
__name(buildLocalizeFn, "buildLocalizeFn");

// node_modules/date-fns/locale/en-US/_lib/localize.js
var eraValues = {
  narrow: ["B", "A"],
  abbreviated: ["BC", "AD"],
  wide: ["Before Christ", "Anno Domini"]
};
var quarterValues = {
  narrow: ["1", "2", "3", "4"],
  abbreviated: ["Q1", "Q2", "Q3", "Q4"],
  wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
};
var monthValues = {
  narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  abbreviated: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  wide: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
};
var dayValues = {
  narrow: ["S", "M", "T", "W", "T", "F", "S"],
  short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  wide: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ]
};
var dayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  }
};
var formattingDayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  }
};
var ordinalNumber = /* @__PURE__ */ __name((dirtyNumber, _options) => {
  const number = Number(dirtyNumber);
  const rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + "st";
      case 2:
        return number + "nd";
      case 3:
        return number + "rd";
    }
  }
  return number + "th";
}, "ordinalNumber");
var localize = {
  ordinalNumber,
  era: buildLocalizeFn({
    values: eraValues,
    defaultWidth: "wide"
  }),
  quarter: buildLocalizeFn({
    values: quarterValues,
    defaultWidth: "wide",
    argumentCallback: /* @__PURE__ */ __name((quarter) => quarter - 1, "argumentCallback")
  }),
  month: buildLocalizeFn({
    values: monthValues,
    defaultWidth: "wide"
  }),
  day: buildLocalizeFn({
    values: dayValues,
    defaultWidth: "wide"
  }),
  dayPeriod: buildLocalizeFn({
    values: dayPeriodValues,
    defaultWidth: "wide",
    formattingValues: formattingDayPeriodValues,
    defaultFormattingWidth: "wide"
  })
};

// node_modules/date-fns/locale/en-US/_lib/match.js
init_modules_watch_stub();

// node_modules/date-fns/locale/_lib/buildMatchFn.js
init_modules_watch_stub();
function buildMatchFn(args) {
  return (string, options = {}) => {
    const width = options.width;
    const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    const matchResult = string.match(matchPattern);
    if (!matchResult) {
      return null;
    }
    const matchedString = matchResult[0];
    const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
      // [TODO] -- I challenge you to fix the type
      findKey(parsePatterns, (pattern) => pattern.test(matchedString))
    );
    let value;
    value = args.valueCallback ? args.valueCallback(key) : key;
    value = options.valueCallback ? (
      // [TODO] -- I challenge you to fix the type
      options.valueCallback(value)
    ) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
__name(buildMatchFn, "buildMatchFn");
function findKey(object, predicate) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
      return key;
    }
  }
  return void 0;
}
__name(findKey, "findKey");
function findIndex(array, predicate) {
  for (let key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
  return void 0;
}
__name(findIndex, "findIndex");

// node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
init_modules_watch_stub();
function buildMatchPatternFn(args) {
  return (string, options = {}) => {
    const matchResult = string.match(args.matchPattern);
    if (!matchResult) return null;
    const matchedString = matchResult[0];
    const parseResult = string.match(args.parsePattern);
    if (!parseResult) return null;
    let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
__name(buildMatchPatternFn, "buildMatchPatternFn");

// node_modules/date-fns/locale/en-US/_lib/match.js
var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
var parseOrdinalNumberPattern = /\d+/i;
var matchEraPatterns = {
  narrow: /^(b|a)/i,
  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
  wide: /^(before christ|before common era|anno domini|common era)/i
};
var parseEraPatterns = {
  any: [/^b/i, /^(a|c)/i]
};
var matchQuarterPatterns = {
  narrow: /^[1234]/i,
  abbreviated: /^q[1234]/i,
  wide: /^[1234](th|st|nd|rd)? quarter/i
};
var parseQuarterPatterns = {
  any: [/1/i, /2/i, /3/i, /4/i]
};
var matchMonthPatterns = {
  narrow: /^[jfmasond]/i,
  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
var parseMonthPatterns = {
  narrow: [
    /^j/i,
    /^f/i,
    /^m/i,
    /^a/i,
    /^m/i,
    /^j/i,
    /^j/i,
    /^a/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ],
  any: [
    /^ja/i,
    /^f/i,
    /^mar/i,
    /^ap/i,
    /^may/i,
    /^jun/i,
    /^jul/i,
    /^au/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ]
};
var matchDayPatterns = {
  narrow: /^[smtwf]/i,
  short: /^(su|mo|tu|we|th|fr|sa)/i,
  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
var parseDayPatterns = {
  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
};
var matchDayPeriodPatterns = {
  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
var parseDayPeriodPatterns = {
  any: {
    am: /^a/i,
    pm: /^p/i,
    midnight: /^mi/i,
    noon: /^no/i,
    morning: /morning/i,
    afternoon: /afternoon/i,
    evening: /evening/i,
    night: /night/i
  }
};
var match = {
  ordinalNumber: buildMatchPatternFn({
    matchPattern: matchOrdinalNumberPattern,
    parsePattern: parseOrdinalNumberPattern,
    valueCallback: /* @__PURE__ */ __name((value) => parseInt(value, 10), "valueCallback")
  }),
  era: buildMatchFn({
    matchPatterns: matchEraPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseEraPatterns,
    defaultParseWidth: "any"
  }),
  quarter: buildMatchFn({
    matchPatterns: matchQuarterPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseQuarterPatterns,
    defaultParseWidth: "any",
    valueCallback: /* @__PURE__ */ __name((index) => index + 1, "valueCallback")
  }),
  month: buildMatchFn({
    matchPatterns: matchMonthPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseMonthPatterns,
    defaultParseWidth: "any"
  }),
  day: buildMatchFn({
    matchPatterns: matchDayPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseDayPatterns,
    defaultParseWidth: "any"
  }),
  dayPeriod: buildMatchFn({
    matchPatterns: matchDayPeriodPatterns,
    defaultMatchWidth: "any",
    parsePatterns: parseDayPeriodPatterns,
    defaultParseWidth: "any"
  })
};

// node_modules/date-fns/locale/en-US.js
var enUS = {
  code: "en-US",
  formatDistance,
  formatLong,
  formatRelative,
  localize,
  match,
  options: {
    weekStartsOn: 0,
    firstWeekContainsDate: 1
  }
};

// node_modules/date-fns/_lib/format/formatters.js
init_modules_watch_stub();

// node_modules/date-fns/getDayOfYear.js
init_modules_watch_stub();
function getDayOfYear(date, options) {
  const _date = toDate(date, options?.in);
  const diff = differenceInCalendarDays(_date, startOfYear(_date));
  const dayOfYear = diff + 1;
  return dayOfYear;
}
__name(getDayOfYear, "getDayOfYear");

// node_modules/date-fns/getISOWeek.js
init_modules_watch_stub();
function getISOWeek(date, options) {
  const _date = toDate(date, options?.in);
  const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
  return Math.round(diff / millisecondsInWeek) + 1;
}
__name(getISOWeek, "getISOWeek");

// node_modules/date-fns/getWeek.js
init_modules_watch_stub();

// node_modules/date-fns/startOfWeekYear.js
init_modules_watch_stub();

// node_modules/date-fns/getWeekYear.js
init_modules_watch_stub();
function getWeekYear(date, options) {
  const _date = toDate(date, options?.in);
  const year = _date.getFullYear();
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const firstWeekOfNextYear = constructFrom(options?.in || date, 0);
  firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
  const firstWeekOfThisYear = constructFrom(options?.in || date, 0);
  firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
  if (+_date >= +startOfNextYear) {
    return year + 1;
  } else if (+_date >= +startOfThisYear) {
    return year;
  } else {
    return year - 1;
  }
}
__name(getWeekYear, "getWeekYear");

// node_modules/date-fns/startOfWeekYear.js
function startOfWeekYear(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const year = getWeekYear(date, options);
  const firstWeek = constructFrom(options?.in || date, 0);
  firstWeek.setFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setHours(0, 0, 0, 0);
  const _date = startOfWeek(firstWeek, options);
  return _date;
}
__name(startOfWeekYear, "startOfWeekYear");

// node_modules/date-fns/getWeek.js
function getWeek(date, options) {
  const _date = toDate(date, options?.in);
  const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
  return Math.round(diff / millisecondsInWeek) + 1;
}
__name(getWeek, "getWeek");

// node_modules/date-fns/_lib/addLeadingZeros.js
init_modules_watch_stub();
function addLeadingZeros(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  const output = Math.abs(number).toString().padStart(targetLength, "0");
  return sign + output;
}
__name(addLeadingZeros, "addLeadingZeros");

// node_modules/date-fns/_lib/format/lightFormatters.js
init_modules_watch_stub();
var lightFormatters = {
  // Year
  y(date, token) {
    const signedYear = date.getFullYear();
    const year = signedYear > 0 ? signedYear : 1 - signedYear;
    return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
  },
  // Month
  M(date, token) {
    const month = date.getMonth();
    return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
  },
  // Day of the month
  d(date, token) {
    return addLeadingZeros(date.getDate(), token.length);
  },
  // AM or PM
  a(date, token) {
    const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return dayPeriodEnumValue.toUpperCase();
      case "aaa":
        return dayPeriodEnumValue;
      case "aaaaa":
        return dayPeriodEnumValue[0];
      case "aaaa":
      default:
        return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
    }
  },
  // Hour [1-12]
  h(date, token) {
    return addLeadingZeros(date.getHours() % 12 || 12, token.length);
  },
  // Hour [0-23]
  H(date, token) {
    return addLeadingZeros(date.getHours(), token.length);
  },
  // Minute
  m(date, token) {
    return addLeadingZeros(date.getMinutes(), token.length);
  },
  // Second
  s(date, token) {
    return addLeadingZeros(date.getSeconds(), token.length);
  },
  // Fraction of second
  S(date, token) {
    const numberOfDigits = token.length;
    const milliseconds = date.getMilliseconds();
    const fractionalSeconds = Math.trunc(
      milliseconds * Math.pow(10, numberOfDigits - 3)
    );
    return addLeadingZeros(fractionalSeconds, token.length);
  }
};

// node_modules/date-fns/_lib/format/formatters.js
var dayPeriodEnum = {
  am: "am",
  pm: "pm",
  midnight: "midnight",
  noon: "noon",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "night"
};
var formatters = {
  // Era
  G: /* @__PURE__ */ __name(function(date, token, localize2) {
    const era = date.getFullYear() > 0 ? 1 : 0;
    switch (token) {
      // AD, BC
      case "G":
      case "GG":
      case "GGG":
        return localize2.era(era, { width: "abbreviated" });
      // A, B
      case "GGGGG":
        return localize2.era(era, { width: "narrow" });
      // Anno Domini, Before Christ
      case "GGGG":
      default:
        return localize2.era(era, { width: "wide" });
    }
  }, "G"),
  // Year
  y: /* @__PURE__ */ __name(function(date, token, localize2) {
    if (token === "yo") {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return localize2.ordinalNumber(year, { unit: "year" });
    }
    return lightFormatters.y(date, token);
  }, "y"),
  // Local week-numbering year
  Y: /* @__PURE__ */ __name(function(date, token, localize2, options) {
    const signedWeekYear = getWeekYear(date, options);
    const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
    if (token === "YY") {
      const twoDigitYear = weekYear % 100;
      return addLeadingZeros(twoDigitYear, 2);
    }
    if (token === "Yo") {
      return localize2.ordinalNumber(weekYear, { unit: "year" });
    }
    return addLeadingZeros(weekYear, token.length);
  }, "Y"),
  // ISO week-numbering year
  R: /* @__PURE__ */ __name(function(date, token) {
    const isoWeekYear = getISOWeekYear(date);
    return addLeadingZeros(isoWeekYear, token.length);
  }, "R"),
  // Extended year. This is a single number designating the year of this calendar system.
  // The main difference between `y` and `u` localizers are B.C. years:
  // | Year | `y` | `u` |
  // |------|-----|-----|
  // | AC 1 |   1 |   1 |
  // | BC 1 |   1 |   0 |
  // | BC 2 |   2 |  -1 |
  // Also `yy` always returns the last two digits of a year,
  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
  u: /* @__PURE__ */ __name(function(date, token) {
    const year = date.getFullYear();
    return addLeadingZeros(year, token.length);
  }, "u"),
  // Quarter
  Q: /* @__PURE__ */ __name(function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      // 1, 2, 3, 4
      case "Q":
        return String(quarter);
      // 01, 02, 03, 04
      case "QQ":
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th
      case "Qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      // Q1, Q2, Q3, Q4
      case "QQQ":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "formatting"
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)
      case "QQQQQ":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "formatting"
        });
      // 1st quarter, 2nd quarter, ...
      case "QQQQ":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "Q"),
  // Stand-alone quarter
  q: /* @__PURE__ */ __name(function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      // 1, 2, 3, 4
      case "q":
        return String(quarter);
      // 01, 02, 03, 04
      case "qq":
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th
      case "qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      // Q1, Q2, Q3, Q4
      case "qqq":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "standalone"
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)
      case "qqqqq":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "standalone"
        });
      // 1st quarter, 2nd quarter, ...
      case "qqqq":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "standalone"
        });
    }
  }, "q"),
  // Month
  M: /* @__PURE__ */ __name(function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "M":
      case "MM":
        return lightFormatters.M(date, token);
      // 1st, 2nd, ..., 12th
      case "Mo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      // Jan, Feb, ..., Dec
      case "MMM":
        return localize2.month(month, {
          width: "abbreviated",
          context: "formatting"
        });
      // J, F, ..., D
      case "MMMMM":
        return localize2.month(month, {
          width: "narrow",
          context: "formatting"
        });
      // January, February, ..., December
      case "MMMM":
      default:
        return localize2.month(month, { width: "wide", context: "formatting" });
    }
  }, "M"),
  // Stand-alone month
  L: /* @__PURE__ */ __name(function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      // 1, 2, ..., 12
      case "L":
        return String(month + 1);
      // 01, 02, ..., 12
      case "LL":
        return addLeadingZeros(month + 1, 2);
      // 1st, 2nd, ..., 12th
      case "Lo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      // Jan, Feb, ..., Dec
      case "LLL":
        return localize2.month(month, {
          width: "abbreviated",
          context: "standalone"
        });
      // J, F, ..., D
      case "LLLLL":
        return localize2.month(month, {
          width: "narrow",
          context: "standalone"
        });
      // January, February, ..., December
      case "LLLL":
      default:
        return localize2.month(month, { width: "wide", context: "standalone" });
    }
  }, "L"),
  // Local week of year
  w: /* @__PURE__ */ __name(function(date, token, localize2, options) {
    const week = getWeek(date, options);
    if (token === "wo") {
      return localize2.ordinalNumber(week, { unit: "week" });
    }
    return addLeadingZeros(week, token.length);
  }, "w"),
  // ISO week of year
  I: /* @__PURE__ */ __name(function(date, token, localize2) {
    const isoWeek = getISOWeek(date);
    if (token === "Io") {
      return localize2.ordinalNumber(isoWeek, { unit: "week" });
    }
    return addLeadingZeros(isoWeek, token.length);
  }, "I"),
  // Day of the month
  d: /* @__PURE__ */ __name(function(date, token, localize2) {
    if (token === "do") {
      return localize2.ordinalNumber(date.getDate(), { unit: "date" });
    }
    return lightFormatters.d(date, token);
  }, "d"),
  // Day of year
  D: /* @__PURE__ */ __name(function(date, token, localize2) {
    const dayOfYear = getDayOfYear(date);
    if (token === "Do") {
      return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
    }
    return addLeadingZeros(dayOfYear, token.length);
  }, "D"),
  // Day of week
  E: /* @__PURE__ */ __name(function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    switch (token) {
      // Tue
      case "E":
      case "EE":
      case "EEE":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "EEEEE":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "EEEEEE":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "EEEE":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "E"),
  // Local day of week
  e: /* @__PURE__ */ __name(function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      // Numerical value (Nth day of week with current locale or weekStartsOn)
      case "e":
        return String(localDayOfWeek);
      // Padded numerical value
      case "ee":
        return addLeadingZeros(localDayOfWeek, 2);
      // 1st, 2nd, ..., 7th
      case "eo":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "eee":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "eeeee":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "eeeeee":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "eeee":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "e"),
  // Stand-alone local day of week
  c: /* @__PURE__ */ __name(function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      // Numerical value (same as in `e`)
      case "c":
        return String(localDayOfWeek);
      // Padded numerical value
      case "cc":
        return addLeadingZeros(localDayOfWeek, token.length);
      // 1st, 2nd, ..., 7th
      case "co":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "ccc":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "standalone"
        });
      // T
      case "ccccc":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "standalone"
        });
      // Tu
      case "cccccc":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "standalone"
        });
      // Tuesday
      case "cccc":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "standalone"
        });
    }
  }, "c"),
  // ISO day of week
  i: /* @__PURE__ */ __name(function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    switch (token) {
      // 2
      case "i":
        return String(isoDayOfWeek);
      // 02
      case "ii":
        return addLeadingZeros(isoDayOfWeek, token.length);
      // 2nd
      case "io":
        return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
      // Tue
      case "iii":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "iiiii":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "iiiiii":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "iiii":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "i"),
  // AM or PM
  a: /* @__PURE__ */ __name(function(date, token, localize2) {
    const hours = date.getHours();
    const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "aaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "aaaaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "aaaa":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "a"),
  // AM, PM, midnight, noon
  b: /* @__PURE__ */ __name(function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours === 12) {
      dayPeriodEnumValue = dayPeriodEnum.noon;
    } else if (hours === 0) {
      dayPeriodEnumValue = dayPeriodEnum.midnight;
    } else {
      dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    }
    switch (token) {
      case "b":
      case "bb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "bbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "bbbbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "bbbb":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "b"),
  // in the morning, in the afternoon, in the evening, at night
  B: /* @__PURE__ */ __name(function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours >= 17) {
      dayPeriodEnumValue = dayPeriodEnum.evening;
    } else if (hours >= 12) {
      dayPeriodEnumValue = dayPeriodEnum.afternoon;
    } else if (hours >= 4) {
      dayPeriodEnumValue = dayPeriodEnum.morning;
    } else {
      dayPeriodEnumValue = dayPeriodEnum.night;
    }
    switch (token) {
      case "B":
      case "BB":
      case "BBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "BBBBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "BBBB":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  }, "B"),
  // Hour [1-12]
  h: /* @__PURE__ */ __name(function(date, token, localize2) {
    if (token === "ho") {
      let hours = date.getHours() % 12;
      if (hours === 0) hours = 12;
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return lightFormatters.h(date, token);
  }, "h"),
  // Hour [0-23]
  H: /* @__PURE__ */ __name(function(date, token, localize2) {
    if (token === "Ho") {
      return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
    }
    return lightFormatters.H(date, token);
  }, "H"),
  // Hour [0-11]
  K: /* @__PURE__ */ __name(function(date, token, localize2) {
    const hours = date.getHours() % 12;
    if (token === "Ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  }, "K"),
  // Hour [1-24]
  k: /* @__PURE__ */ __name(function(date, token, localize2) {
    let hours = date.getHours();
    if (hours === 0) hours = 24;
    if (token === "ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  }, "k"),
  // Minute
  m: /* @__PURE__ */ __name(function(date, token, localize2) {
    if (token === "mo") {
      return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
    }
    return lightFormatters.m(date, token);
  }, "m"),
  // Second
  s: /* @__PURE__ */ __name(function(date, token, localize2) {
    if (token === "so") {
      return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
    }
    return lightFormatters.s(date, token);
  }, "s"),
  // Fraction of second
  S: /* @__PURE__ */ __name(function(date, token) {
    return lightFormatters.S(date, token);
  }, "S"),
  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
  X: /* @__PURE__ */ __name(function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    if (timezoneOffset === 0) {
      return "Z";
    }
    switch (token) {
      // Hours and optional minutes
      case "X":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XX`
      case "XXXX":
      case "XX":
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XXX`
      case "XXXXX":
      case "XXX":
      // Hours and minutes with `:` delimiter
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  }, "X"),
  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
  x: /* @__PURE__ */ __name(function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Hours and optional minutes
      case "x":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xx`
      case "xxxx":
      case "xx":
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xxx`
      case "xxxxx":
      case "xxx":
      // Hours and minutes with `:` delimiter
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  }, "x"),
  // Timezone (GMT)
  O: /* @__PURE__ */ __name(function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Short
      case "O":
      case "OO":
      case "OOO":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      // Long
      case "OOOO":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  }, "O"),
  // Timezone (specific non-location)
  z: /* @__PURE__ */ __name(function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Short
      case "z":
      case "zz":
      case "zzz":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      // Long
      case "zzzz":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  }, "z"),
  // Seconds timestamp
  t: /* @__PURE__ */ __name(function(date, token, _localize) {
    const timestamp = Math.trunc(+date / 1e3);
    return addLeadingZeros(timestamp, token.length);
  }, "t"),
  // Milliseconds timestamp
  T: /* @__PURE__ */ __name(function(date, token, _localize) {
    return addLeadingZeros(+date, token.length);
  }, "T")
};
function formatTimezoneShort(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.trunc(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
__name(formatTimezoneShort, "formatTimezoneShort");
function formatTimezoneWithOptionalMinutes(offset, delimiter) {
  if (offset % 60 === 0) {
    const sign = offset > 0 ? "-" : "+";
    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
  }
  return formatTimezone(offset, delimiter);
}
__name(formatTimezoneWithOptionalMinutes, "formatTimezoneWithOptionalMinutes");
function formatTimezone(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
  const minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}
__name(formatTimezone, "formatTimezone");

// node_modules/date-fns/_lib/format/longFormatters.js
init_modules_watch_stub();
var dateLongFormatter = /* @__PURE__ */ __name((pattern, formatLong2) => {
  switch (pattern) {
    case "P":
      return formatLong2.date({ width: "short" });
    case "PP":
      return formatLong2.date({ width: "medium" });
    case "PPP":
      return formatLong2.date({ width: "long" });
    case "PPPP":
    default:
      return formatLong2.date({ width: "full" });
  }
}, "dateLongFormatter");
var timeLongFormatter = /* @__PURE__ */ __name((pattern, formatLong2) => {
  switch (pattern) {
    case "p":
      return formatLong2.time({ width: "short" });
    case "pp":
      return formatLong2.time({ width: "medium" });
    case "ppp":
      return formatLong2.time({ width: "long" });
    case "pppp":
    default:
      return formatLong2.time({ width: "full" });
  }
}, "timeLongFormatter");
var dateTimeLongFormatter = /* @__PURE__ */ __name((pattern, formatLong2) => {
  const matchResult = pattern.match(/(P+)(p+)?/) || [];
  const datePattern = matchResult[1];
  const timePattern = matchResult[2];
  if (!timePattern) {
    return dateLongFormatter(pattern, formatLong2);
  }
  let dateTimeFormat;
  switch (datePattern) {
    case "P":
      dateTimeFormat = formatLong2.dateTime({ width: "short" });
      break;
    case "PP":
      dateTimeFormat = formatLong2.dateTime({ width: "medium" });
      break;
    case "PPP":
      dateTimeFormat = formatLong2.dateTime({ width: "long" });
      break;
    case "PPPP":
    default:
      dateTimeFormat = formatLong2.dateTime({ width: "full" });
      break;
  }
  return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
}, "dateTimeLongFormatter");
var longFormatters = {
  p: timeLongFormatter,
  P: dateTimeLongFormatter
};

// node_modules/date-fns/_lib/protectedTokens.js
init_modules_watch_stub();
var dayOfYearTokenRE = /^D+$/;
var weekYearTokenRE = /^Y+$/;
var throwTokens = ["D", "DD", "YY", "YYYY"];
function isProtectedDayOfYearToken(token) {
  return dayOfYearTokenRE.test(token);
}
__name(isProtectedDayOfYearToken, "isProtectedDayOfYearToken");
function isProtectedWeekYearToken(token) {
  return weekYearTokenRE.test(token);
}
__name(isProtectedWeekYearToken, "isProtectedWeekYearToken");
function warnOrThrowProtectedError(token, format2, input) {
  const _message = message(token, format2, input);
  console.warn(_message);
  if (throwTokens.includes(token)) throw new RangeError(_message);
}
__name(warnOrThrowProtectedError, "warnOrThrowProtectedError");
function message(token, format2, input) {
  const subject = token[0] === "Y" ? "years" : "days of the month";
  return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}
__name(message, "message");

// node_modules/date-fns/format.js
var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
var escapedStringRegExp = /^'([^]*?)'?$/;
var doubleQuoteRegExp = /''/g;
var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
function format(date, formatStr, options) {
  const defaultOptions2 = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const originalDate = toDate(date, options?.in);
  if (!isValid(originalDate)) {
    throw new RangeError("Invalid time value");
  }
  let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
    const firstCharacter = substring[0];
    if (firstCharacter === "p" || firstCharacter === "P") {
      const longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale.formatLong);
    }
    return substring;
  }).join("").match(formattingTokensRegExp).map((substring) => {
    if (substring === "''") {
      return { isToken: false, value: "'" };
    }
    const firstCharacter = substring[0];
    if (firstCharacter === "'") {
      return { isToken: false, value: cleanEscapedString(substring) };
    }
    if (formatters[firstCharacter]) {
      return { isToken: true, value: substring };
    }
    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError(
        "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
      );
    }
    return { isToken: false, value: substring };
  });
  if (locale.localize.preprocessor) {
    parts = locale.localize.preprocessor(originalDate, parts);
  }
  const formatterOptions = {
    firstWeekContainsDate,
    weekStartsOn,
    locale
  };
  return parts.map((part) => {
    if (!part.isToken) return part.value;
    const token = part.value;
    if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
      warnOrThrowProtectedError(token, formatStr, String(date));
    }
    const formatter = formatters[token[0]];
    return formatter(originalDate, token, locale.localize, formatterOptions);
  }).join("");
}
__name(format, "format");
function cleanEscapedString(input) {
  const matched = input.match(escapedStringRegExp);
  if (!matched) {
    return input;
  }
  return matched[1].replace(doubleQuoteRegExp, "'");
}
__name(cleanEscapedString, "cleanEscapedString");

// node_modules/date-fns/parseISO.js
init_modules_watch_stub();
function parseISO(argument, options) {
  const invalidDate = /* @__PURE__ */ __name(() => constructFrom(options?.in, NaN), "invalidDate");
  const additionalDigits = options?.additionalDigits ?? 2;
  const dateStrings = splitDateString(argument);
  let date;
  if (dateStrings.date) {
    const parseYearResult = parseYear(dateStrings.date, additionalDigits);
    date = parseDate(parseYearResult.restDateString, parseYearResult.year);
  }
  if (!date || isNaN(+date)) return invalidDate();
  const timestamp = +date;
  let time = 0;
  let offset;
  if (dateStrings.time) {
    time = parseTime(dateStrings.time);
    if (isNaN(time)) return invalidDate();
  }
  if (dateStrings.timezone) {
    offset = parseTimezone(dateStrings.timezone);
    if (isNaN(offset)) return invalidDate();
  } else {
    const tmpDate = new Date(timestamp + time);
    const result = toDate(0, options?.in);
    result.setFullYear(
      tmpDate.getUTCFullYear(),
      tmpDate.getUTCMonth(),
      tmpDate.getUTCDate()
    );
    result.setHours(
      tmpDate.getUTCHours(),
      tmpDate.getUTCMinutes(),
      tmpDate.getUTCSeconds(),
      tmpDate.getUTCMilliseconds()
    );
    return result;
  }
  return toDate(timestamp + time + offset, options?.in);
}
__name(parseISO, "parseISO");
var patterns = {
  dateTimeDelimiter: /[T ]/,
  timeZoneDelimiter: /[Z ]/i,
  timezone: /([Z+-].*)$/
};
var dateRegex = /^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/;
var timeRegex = /^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/;
var timezoneRegex = /^([+-])(\d{2})(?::?(\d{2}))?$/;
function splitDateString(dateString) {
  const dateStrings = {};
  const array = dateString.split(patterns.dateTimeDelimiter);
  let timeString;
  if (array.length > 2) {
    return dateStrings;
  }
  if (/:/.test(array[0])) {
    timeString = array[0];
  } else {
    dateStrings.date = array[0];
    timeString = array[1];
    if (patterns.timeZoneDelimiter.test(dateStrings.date)) {
      dateStrings.date = dateString.split(patterns.timeZoneDelimiter)[0];
      timeString = dateString.substr(
        dateStrings.date.length,
        dateString.length
      );
    }
  }
  if (timeString) {
    const token = patterns.timezone.exec(timeString);
    if (token) {
      dateStrings.time = timeString.replace(token[1], "");
      dateStrings.timezone = token[1];
    } else {
      dateStrings.time = timeString;
    }
  }
  return dateStrings;
}
__name(splitDateString, "splitDateString");
function parseYear(dateString, additionalDigits) {
  const regex = new RegExp(
    "^(?:(\\d{4}|[+-]\\d{" + (4 + additionalDigits) + "})|(\\d{2}|[+-]\\d{" + (2 + additionalDigits) + "})$)"
  );
  const captures = dateString.match(regex);
  if (!captures) return { year: NaN, restDateString: "" };
  const year = captures[1] ? parseInt(captures[1]) : null;
  const century = captures[2] ? parseInt(captures[2]) : null;
  return {
    year: century === null ? year : century * 100,
    restDateString: dateString.slice((captures[1] || captures[2]).length)
  };
}
__name(parseYear, "parseYear");
function parseDate(dateString, year) {
  if (year === null) return /* @__PURE__ */ new Date(NaN);
  const captures = dateString.match(dateRegex);
  if (!captures) return /* @__PURE__ */ new Date(NaN);
  const isWeekDate = !!captures[4];
  const dayOfYear = parseDateUnit(captures[1]);
  const month = parseDateUnit(captures[2]) - 1;
  const day = parseDateUnit(captures[3]);
  const week = parseDateUnit(captures[4]);
  const dayOfWeek = parseDateUnit(captures[5]) - 1;
  if (isWeekDate) {
    if (!validateWeekDate(year, week, dayOfWeek)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    return dayOfISOWeekYear(year, week, dayOfWeek);
  } else {
    const date = /* @__PURE__ */ new Date(0);
    if (!validateDate(year, month, day) || !validateDayOfYearDate(year, dayOfYear)) {
      return /* @__PURE__ */ new Date(NaN);
    }
    date.setUTCFullYear(year, month, Math.max(dayOfYear, day));
    return date;
  }
}
__name(parseDate, "parseDate");
function parseDateUnit(value) {
  return value ? parseInt(value) : 1;
}
__name(parseDateUnit, "parseDateUnit");
function parseTime(timeString) {
  const captures = timeString.match(timeRegex);
  if (!captures) return NaN;
  const hours = parseTimeUnit(captures[1]);
  const minutes = parseTimeUnit(captures[2]);
  const seconds = parseTimeUnit(captures[3]);
  if (!validateTime(hours, minutes, seconds)) {
    return NaN;
  }
  return hours * millisecondsInHour + minutes * millisecondsInMinute + seconds * 1e3;
}
__name(parseTime, "parseTime");
function parseTimeUnit(value) {
  return value && parseFloat(value.replace(",", ".")) || 0;
}
__name(parseTimeUnit, "parseTimeUnit");
function parseTimezone(timezoneString) {
  if (timezoneString === "Z") return 0;
  const captures = timezoneString.match(timezoneRegex);
  if (!captures) return 0;
  const sign = captures[1] === "+" ? -1 : 1;
  const hours = parseInt(captures[2]);
  const minutes = captures[3] && parseInt(captures[3]) || 0;
  if (!validateTimezone(hours, minutes)) {
    return NaN;
  }
  return sign * (hours * millisecondsInHour + minutes * millisecondsInMinute);
}
__name(parseTimezone, "parseTimezone");
function dayOfISOWeekYear(isoWeekYear, week, day) {
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(isoWeekYear, 0, 4);
  const fourthOfJanuaryDay = date.getUTCDay() || 7;
  const diff = (week - 1) * 7 + day + 1 - fourthOfJanuaryDay;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}
__name(dayOfISOWeekYear, "dayOfISOWeekYear");
var daysInMonths = [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isLeapYearIndex(year) {
  return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
}
__name(isLeapYearIndex, "isLeapYearIndex");
function validateDate(year, month, date) {
  return month >= 0 && month <= 11 && date >= 1 && date <= (daysInMonths[month] || (isLeapYearIndex(year) ? 29 : 28));
}
__name(validateDate, "validateDate");
function validateDayOfYearDate(year, dayOfYear) {
  return dayOfYear >= 1 && dayOfYear <= (isLeapYearIndex(year) ? 366 : 365);
}
__name(validateDayOfYearDate, "validateDayOfYearDate");
function validateWeekDate(_year, week, day) {
  return week >= 1 && week <= 53 && day >= 0 && day <= 6;
}
__name(validateWeekDate, "validateWeekDate");
function validateTime(hours, minutes, seconds) {
  if (hours === 24) {
    return minutes === 0 && seconds === 0;
  }
  return seconds >= 0 && seconds < 60 && minutes >= 0 && minutes < 60 && hours >= 0 && hours < 25;
}
__name(validateTime, "validateTime");
function validateTimezone(_hours, minutes) {
  return minutes >= 0 && minutes <= 59;
}
__name(validateTimezone, "validateTimezone");

// src/domain/common.ts
var ok = /* @__PURE__ */ __name((db, value) => ({ ok: true, db, value }), "ok");
var fail = /* @__PURE__ */ __name((error, extra = {}) => ({
  ok: false,
  error,
  ...extra
}), "fail");
function requireCapability(ctx, capability) {
  if (can({ role: ctx.actor.role, adminTier: ctx.actor.adminTier ?? null, unitId: ctx.actor.unitId }, capability)) return null;
  return fail("Your account does not have access to this part of the workflow.");
}
__name(requireCapability, "requireCapability");
var AUDIT_LIMIT = 3e3;
var NOTIFY_LIMIT = 300;
function audit(db, ctx, entry) {
  const full = {
    ...entry,
    id: ctx.newId("aud"),
    at: ctx.now.toISOString(),
    userId: ctx.actor.id,
    user: ctx.actor.name,
    role: ctx.actor.role
  };
  return { ...db, audit: [full, ...db.audit].slice(0, AUDIT_LIMIT) };
}
__name(audit, "audit");
function notify(db, ctx, n) {
  if (db.notifications.some((x) => x.key === n.key)) return db;
  const full = { ...n, id: ctx.newId("ntf"), createdAt: ctx.now.toISOString(), read: false };
  return { ...db, notifications: [full, ...db.notifications].slice(0, NOTIFY_LIMIT) };
}
__name(notify, "notify");
function nextSeq(db, key) {
  const n = (db.counters[key] ?? 0) + 1;
  return [{ ...db, counters: { ...db.counters, [key]: n } }, n];
}
__name(nextSeq, "nextSeq");
function docCode(prefix, n) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
__name(docCode, "docCode");
function stampNew(ctx) {
  const at = ctx.now.toISOString();
  return { createdAt: at, createdBy: ctx.actor.name, updatedAt: at, updatedBy: ctx.actor.name };
}
__name(stampNew, "stampNew");
function stampUpdate(record, ctx) {
  return { ...record, updatedAt: ctx.now.toISOString(), updatedBy: ctx.actor.name };
}
__name(stampUpdate, "stampUpdate");
function customerSnapshot(c) {
  return {
    id: c.id,
    code: c.code,
    company: c.company,
    contactPerson: c.contactPerson,
    phone: c.phone,
    email: c.email,
    billingAddress: c.billingAddress,
    deliveryAddress: c.deliveryAddress || c.billingAddress,
    gstin: c.gstin,
    placeOfSupply: c.placeOfSupply,
    paymentTerms: c.paymentTerms
  };
}
__name(customerSnapshot, "customerSnapshot");
function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}
__name(isIsoDate, "isIsoDate");
var isFiniteNumber = /* @__PURE__ */ __name((v) => typeof v === "number" && Number.isFinite(v), "isFiniteNumber");
function sameText(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
__name(sameText, "sameText");
function deepClone(value) {
  return structuredClone(value);
}
__name(deepClone, "deepClone");
function staleRecord(label2, current, expected) {
  if (expected === void 0 || (current.updatedAt ?? null) === expected) return null;
  return fail(
    `${label2} was changed${current.updatedBy ? ` by ${current.updatedBy}` : ""} in another tab or window after you opened it. Load the latest version, then re-apply your change.`,
    { conflict: true }
  );
}
__name(staleRecord, "staleRecord");
function hasFieldErrors(errors) {
  return Object.keys(errors).length > 0;
}
__name(hasFieldErrors, "hasFieldErrors");
function validationFailure(errors) {
  const first = Object.values(errors)[0];
  return fail(first ?? "Please correct the highlighted fields.", { fieldErrors: errors });
}
__name(validationFailure, "validationFailure");
var COMMANDS = /* @__PURE__ */ new Map();
function command(name, factory, wire) {
  COMMANDS.set(name, { name, build: wire ? wire.build : (args) => factory(...args) });
  return (...args) => {
    const inner = factory(...args);
    const tagged = /* @__PURE__ */ __name((db, ctx) => inner(db, ctx), "tagged");
    tagged.command = { name, args: wire ? wire.args(...args) : args };
    return tagged;
  };
}
__name(command, "command");

// src/domain/dispatch.ts
function companyInvoiceIssues(company, taxPct) {
  const out = [];
  if (!company.name.trim()) out.push("Company name is missing.");
  if (!company.address.trim()) out.push("Company address is missing.");
  if (company.gstin.trim() && !isValidGstin(company.gstin)) out.push("Company GSTIN is not a valid 15-character GSTIN.");
  if (taxPct > 0 && !company.gstin.trim()) out.push("Company GSTIN is required to issue a tax invoice.");
  return out;
}
__name(companyInvoiceIssues, "companyInvoiceIssues");
function finalizedCostingFor(db, order) {
  const costing = db.costings.find((c) => c.id === order.costingId);
  return costing?.status === "Finalized" && costing.snapshot ? costing : null;
}
__name(finalizedCostingFor, "finalizedCostingFor");
function orderInvoices(db, orderId) {
  return db.invoices.filter((i) => i.orderId === orderId).sort((a, b) => a.partial.seq - b.partial.seq);
}
__name(orderInvoices, "orderInvoices");
function validateDispatchRequest(db, req) {
  const e = {};
  const order = db.orders.find((o) => o.id === req.orderId);
  if (!order) return { fieldErrors: e, amounts: null, error: "Production order not found." };
  if (order.status !== "Completed")
    return { fieldErrors: e, amounts: null, error: `${order.code} is still in production; only completed production can be dispatched.` };
  const costing = finalizedCostingFor(db, order);
  if (!costing) return { fieldErrors: e, amounts: null, error: "The finalized costing snapshot for this order is missing." };
  const balance = orderBalance(order, db.dispatches);
  if (!(Number.isInteger(req.quantity) && req.quantity >= 1)) e.quantity = "Enter a whole number of pieces (at least 1).";
  else if (req.quantity > balance.remainingQty)
    e.quantity = balance.remainingQty === 0 ? "Nothing remains to dispatch on this order." : `Only ${balance.remainingQty.toLocaleString("en-IN")} ${order.uom} remain available.`;
  const previous = db.dispatches.filter((d) => d.orderId === order.id).sort((a, b) => a.seq - b.seq);
  if (!isIsoDate(req.date)) e.date = "Enter the dispatch date.";
  else {
    const completedDay = order.completedAt?.slice(0, 10);
    if (completedDay && req.date < completedDay) e.date = `Dispatch cannot be dated before production completed (${completedDay}).`;
    const last = previous[previous.length - 1];
    if (last && req.date < last.date) e.date = `Dispatch cannot be dated before the previous dispatch (${last.date}).`;
  }
  if (!req.deliveryAddress.trim()) e.deliveryAddress = "Enter the delivery destination.";
  let amounts = null;
  if (!e.quantity) {
    try {
      amounts = allocateInvoice(costing.snapshot.result, orderInvoices(db, order.id), req.quantity);
    } catch (err) {
      if (err instanceof BillingError) e.quantity = err.message;
      else throw err;
    }
  }
  return { fieldErrors: e, amounts, error: null };
}
__name(validateDispatchRequest, "validateDispatchRequest");
var confirmDispatch = command(
  "confirmDispatch",
  (req) => (db, ctx) => {
    const denied = requireCapability(ctx, "dispatch");
    if (denied) return denied;
    if (!req.requestId) return fail("Missing request id.");
    const replay = db.dispatches.find((d) => d.requestId === req.requestId);
    if (replay) {
      const invoice2 = db.invoices.find((i) => i.id === replay.invoiceId);
      if (invoice2) return ok(db, { dispatch: replay, invoice: invoice2, duplicate: true });
    }
    const { fieldErrors, amounts, error } = validateDispatchRequest(db, req);
    if (error) return fail(error);
    if (Object.keys(fieldErrors).length || !amounts)
      return fail(Object.values(fieldErrors)[0] ?? "Check the dispatch details.", { fieldErrors });
    const order = db.orders.find((o) => o.id === req.orderId);
    const costing = finalizedCostingFor(db, order);
    const snapshot2 = costing.snapshot;
    const plan = db.plans.find((p) => p.id === order.planId);
    const companyProblems = companyInvoiceIssues(db.company, snapshot2.result.taxPct);
    if (companyProblems.length)
      return fail(`Complete the company profile before invoicing: ${companyProblems.join(" ")}`);
    const previousDispatches = db.dispatches.filter((d) => d.orderId === order.id);
    let next = db;
    let dispatchSeq;
    let invoiceSeq;
    [next, dispatchSeq] = nextSeq(next, "dispatch");
    [next, invoiceSeq] = nextSeq(next, "invoice");
    const dispatchId = ctx.newId("DSP");
    const invoiceId = ctx.newId("INV");
    const seq = previousDispatches.length + 1;
    const { updatedAt: _u, updatedBy: _b, ...company } = db.company;
    void _u;
    void _b;
    const dispatch = {
      id: dispatchId,
      code: docCode("DSP", dispatchSeq),
      orderId: order.id,
      seq,
      date: req.date,
      quantity: req.quantity,
      deliveryAddress: req.deliveryAddress.trim(),
      transporter: req.transporter.trim(),
      vehicleNo: req.vehicleNo.trim(),
      notes: req.notes.trim(),
      invoiceId,
      requestId: req.requestId,
      createdAt: ctx.now.toISOString(),
      createdBy: ctx.actor.name
    };
    const tax = splitTax(amounts.taxAmount, company.gstin, snapshot2.customer.gstin, snapshot2.customer.placeOfSupply);
    const descriptionParts = [order.productName, order.dimensions, order.options].filter((s) => s && s.trim());
    const invoice = {
      id: invoiceId,
      number: invoiceNumber(company.invoicePrefix, req.date, invoiceSeq),
      issueDate: req.date,
      orderId: order.id,
      dispatchId,
      requestId: req.requestId,
      company,
      customer: snapshot2.customer,
      deliveryAddress: dispatch.deliveryAddress,
      refs: {
        orderCode: order.code,
        planCode: plan?.code ?? snapshot2.plan.code,
        costingCode: costing.code,
        dispatchCode: dispatch.code,
        customerRef: order.customerRef
      },
      productName: order.productName,
      lines: [
        {
          description: descriptionParts.join(" \u2014 "),
          hsn: order.hsn,
          quantity: amounts.quantity,
          uom: order.uom,
          rate: amounts.rate,
          amount: amounts.subtotal
        }
      ],
      subtotal: amounts.subtotal,
      discount: amounts.discount,
      taxableValue: amounts.taxableValue,
      taxLabel: snapshot2.result.taxLabel,
      taxPct: amounts.taxPct,
      taxAmount: amounts.taxAmount,
      ...tax,
      total: amounts.total,
      partial: {
        seq,
        orderedQty: order.quantity,
        previouslyDispatched: amounts.previouslyDispatched,
        thisQty: amounts.quantity,
        remainingAfter: amounts.remainingAfter,
        isFinal: amounts.isFinal,
        isSingleFull: amounts.isSingleFull
      },
      paymentTerms: snapshot2.customer.paymentTerms,
      transporter: dispatch.transporter,
      vehicleNo: dispatch.vehicleNo,
      notes: dispatch.notes,
      allocationNote: ALLOCATION_NOTE,
      createdAt: ctx.now.toISOString(),
      createdBy: ctx.actor.name
    };
    next = { ...next, dispatches: [...next.dispatches, dispatch], invoices: [...next.invoices, invoice] };
    next = audit(next, ctx, {
      action: amounts.isSingleFull ? "Full order dispatched" : "Dispatch confirmed",
      entity: "Dispatch",
      entityId: dispatch.id,
      entityLabel: `${dispatch.code} \u2014 ${order.code}`,
      field: "Quantity",
      newValue: `${dispatch.quantity} ${order.uom} (dispatch ${seq}, ${amounts.remainingAfter} remaining)`
    });
    next = audit(next, ctx, {
      action: "Invoice generated",
      entity: "Invoice",
      entityId: invoice.id,
      entityLabel: `${invoice.number} \u2014 ${snapshot2.customer.company}`,
      field: "Invoice total",
      newValue: invoice.total.toFixed(2)
    });
    next = notify(next, ctx, {
      key: `${order.id}:dispatch:${dispatch.id}`,
      title: `${invoice.number} issued`,
      message: `${dispatch.quantity.toLocaleString("en-IN")} ${order.uom} dispatched on ${dispatch.date} for ${snapshot2.customer.company}. ${amounts.remainingAfter.toLocaleString("en-IN")} remaining.`,
      level: "success",
      audience: "admin",
      orderId: order.id
    });
    return ok(next, { dispatch, invoice, duplicate: false });
  }
);
var confirmDispatchReceived = command(
  "confirmDispatchReceived",
  (dispatchId) => (db, ctx) => {
    const denied = requireCapability(ctx, "dispatch");
    if (denied) return denied;
    const dispatch = db.dispatches.find((d) => d.id === dispatchId);
    if (!dispatch) return fail("Shipment not found.");
    if (dispatch.receivedAt)
      return fail(`${dispatch.code} was already confirmed received by ${dispatch.receivedBy ?? "another user"}.`);
    const order = db.orders.find((o) => o.id === dispatch.orderId);
    const received = { ...dispatch, receivedAt: ctx.now.toISOString(), receivedBy: ctx.actor.name };
    let next = { ...db, dispatches: db.dispatches.map((d) => d.id === dispatchId ? received : d) };
    next = audit(next, ctx, {
      action: "Delivery confirmed received",
      entity: "Dispatch",
      entityId: dispatch.id,
      entityLabel: `${dispatch.code} \u2014 ${order?.code ?? dispatch.orderId}`,
      field: "Received quantity",
      newValue: `${dispatch.quantity} ${order?.uom ?? "pcs"} \u2014 invoice download enabled`
    });
    return ok(next, received);
  }
);

// src/domain/imports.ts
init_modules_watch_stub();

// src/lib/templates/jewelleryBoxes.ts
init_modules_watch_stub();
var JEWELLERY_BATCH_ID = "jewellery-boxes-2026-09";
var ref = /* @__PURE__ */ __name((text) => `Reference only \u2014 not an approved specification or current price. ${text}`, "ref");
var JEWELLERY_MATERIALS = [
  {
    key: "board",
    name: "Kappa / grey board \u2014 structural (grade to confirm)",
    kind: "sheet",
    uom: "sheet",
    supplier: "Lead: Sowji Papers, Sivakasi (sowjipapers.com) \u2014 advertises kappa/grey board 1\u20134 mm, 650\u20132600 GSM.",
    notes: ref(
      'Confirm grade, thickness, GSM, measured sheet size, grain direction and price basis. Legacy Rakhi box (BOM 014, 20-04-2023) used "1.5MM-950GSM SANTHANAM BOARD 79X104CM" at Rs 50/sheet; the nominal 79\xD7104 cm size is unverified. Thickness and GSM are kept separately \u2014 no conversion is assumed.'
    )
  },
  {
    key: "wrapper",
    name: "Outer wrapper paper \u2014 printable art / specialty (grade to confirm)",
    kind: "sheet",
    uom: "sheet",
    supplier: "Lead: Sona Papers, Chennai branch (sonapapers.com) \u2014 confirm wrapping/printing suitability for the chosen grade.",
    notes: ref(
      "Confirm grade, GSM, colour, print method, sheet size and finish. Legacy BOM 014 used digital printing on 454\xD7316 mm sheets and thermal lamination; legacy MDF BOM 068 used 13\xD719 in 128 gsm art paper. Lamination is optional and not selected."
    )
  },
  {
    key: "liner",
    name: "Inner liner \u2014 paper / specialty paper / approved fabric (to select)",
    kind: "sheet",
    uom: "sheet",
    supplier: "To be sourced once the substrate is chosen.",
    notes: ref("Confirm substrate, cut size, coverage and adhesive compatibility.")
  },
  {
    key: "insert-board",
    name: "Insert support board \u2014 board-backed pad (thickness to confirm)",
    kind: "sheet",
    uom: "sheet",
    supplier: "Lead: Sowji Papers, Sivakasi (board range) \u2014 thickness from the approved insert design.",
    notes: ref('Legacy BOM 014 used "1mm 633gsm Santhanam Board 79x104cm" for its coin insert (historical zero-rated line). The coin insert is not copied to these products.')
  },
  {
    key: "cushion",
    name: "Cushioning foam \u2014 EVA / PU / EPE (grade to select)",
    kind: "sheet",
    uom: "sheet",
    supplier: "Lead: Axiom Designs & Packaging, Chennai (axiomdesigns.in) \u2014 custom die-cut EVA/PU/PE foam. Jewellery-contact suitability must be sampled.",
    notes: ref(
      'One family, grade to select \u2014 alternatives are not charged together. Confirm grade, density/hardness, colour, thickness, dimensions and contact suitability. Legacy BOM 014 listed "EPE FOAM 6MMX1400X65METER @ 50/METER" as a zero-valued line; that is not a verified free material.'
    )
  },
  {
    key: "covering",
    name: "Presentation covering \u2014 velvet / velour / satin (to select)",
    kind: "quantity",
    uom: "mtr",
    supplier: "Lead: Rigid Boxes India, Sivakasi (rigidboxesindia.in) \u2014 offers velvet presentation options locally.",
    notes: ref("Confirm colour, backing, shedding, colour transfer and adhesion. Consumption per piece must be measured from the approved insert.")
  },
  {
    key: "magnet",
    name: "Closure magnet \u2014 size and grade to confirm",
    kind: "quantity",
    uom: "nos",
    supplier: "Lead: Star Trace, Chennai (startrace.in) \u2014 neodymium and other magnets; small packaging sizes need quotation.",
    notes: ref('Count follows the closure drawing \u2014 two per box is NOT assumed. Legacy BOM 014 used "MAGNET - 6MM X 1.5MM" at Rs 1.25 (20-04-2023).')
  },
  {
    key: "steel-counterpart",
    name: "Steel counterpart for magnet closure (optional)",
    kind: "quantity",
    uom: "nos",
    supplier: "To quote with the chosen magnet.",
    notes: ref("Alternative closure arrangement. Not linked to any product until the closure drawing selects it.")
  },
  {
    key: "corner-tape",
    name: "Rigid-box corner stay tape \u2014 kraft / PET (to select)",
    kind: "quantity",
    uom: "mtr",
    supplier: "Lead: Bandx Industries, Chennai (bandx.in) \u2014 kraft-paper and PET corner stay tapes.",
    notes: ref('Confirm tape type, width, length per box and machine compatibility. Legacy BOM 014 listed "Corner Tape -12mm" as a zero-valued line.')
  },
  {
    key: "adhesive",
    name: "Adhesive \u2014 paper/board and lining bonding (grade to select)",
    kind: "quantity",
    uom: "kg",
    supplier: "Lead: S P Associates, Chennai (gumpowders.com) \u2014 paper/board pasting and rigid-box adhesives.",
    notes: ref("Select a grade per bond (wrapping, lining, insert). Consumption must be measured or supplier-supported. Setting time is recorded separately from labour.")
  },
  {
    key: "accessories",
    name: "Insert accessories \u2014 ribbon / elastic / tabs / retainers (per design)",
    kind: "quantity",
    uom: "nos",
    supplier: "To be sourced once the insert design is approved.",
    notes: ref("Approved design and measured consumption required. Legacy BOM 014 used satin ribbon for its coin insert (zero-valued line) \u2014 not copied.")
  },
  {
    key: "interleaf",
    name: "Protective interleaf / bag (to specify)",
    kind: "quantity",
    uom: "nos",
    supplier: "To be specified.",
    notes: ref("Surface protection before packing.")
  },
  {
    key: "carton",
    name: "Corrugated outer carton (size and packed quantity to confirm)",
    kind: "quantity",
    uom: "nos",
    supplier: "To be quoted.",
    notes: ref('Legacy BOMs used "Corrugated Box 25x15x8 5Ply" at Rs 70 (one carton per 100 Rakhi boxes; four per 100 MDF boxes). Packed quantity for these products is unknown.')
  }
];
var P = /* @__PURE__ */ __name((key, name, description = "") => ({ key, name, description }), "P");
function jewelleryRoute(insertNote, fitNote) {
  return [
    {
      key: "s1",
      name: "Wrapper printing and finishing",
      description: "Optional, not selected yet: inner-liner printing, lamination/coating, foil/embossing/branding. For 25-piece batches compare digital print, specialty paper with branding and outsourced print.",
      processes: [
        P("p1", "Artwork, prepress and print layout"),
        P("p2", "Case and tray wrapper printing", "Split into separate operations if production or charging differs."),
        P("p3", "Wrapper trimming / die-cutting and inspection")
      ]
    },
    {
      key: "s2",
      name: "Structural board preparation",
      description: "Cut list comes from the approved structural drawing \u2014 finished-box size alone does not define it.",
      processes: [
        P("p1", "Board inspection and identification", "Confirm the selected grade before cutting."),
        P("p2", "Cut case panels and tray components", "From the approved cut list."),
        P("p3", "Score or V-groove", "Only where the approved construction needs it."),
        P("p4", "Corner / slot cutting and magnet recess", "Where applicable to the approved construction."),
        P("p5", "Dimension check and variant matching")
      ]
    },
    {
      key: "s3",
      name: "Case and magnetic closure assembly",
      description: "Order of magnet fitting and wrapping follows the actual construction. Magnets are never concealed before polarity and alignment are checked.",
      processes: [
        P("p1", "Position case panels with hinge / spine spacing"),
        P("p2", "Locate and fix magnets / counterparts", "Count and positions from the closure drawing."),
        P("p3", "Polarity and alignment check", "Before the magnets are covered."),
        P("p4", "Apply outer wrapper and turn in edges"),
        P("p5", "Attach inner liner"),
        P("p6", "Press and set", "Adhesive setting time is recorded separately from active labour.")
      ]
    },
    {
      key: "s4",
      name: "Inner tray formation",
      description: "",
      processes: [
        P("p1", "Form tray walls"),
        P("p2", "Reinforce corners", "Method to be chosen (e.g. corner stay tape)."),
        P("p3", "Apply tray wrapper and turn-ins"),
        P("p4", "Fit tray lining"),
        P("p5", "Tray squareness, dimension and case-fit check")
      ]
    },
    {
      key: "s5",
      name: "Jewellery-specific insert making",
      description: `Proposed insert: ${insertNote}. The legacy coin insert is not copied.`,
      processes: [
        P("p1", "Cut insert support board and/or foam"),
        P("p2", "Make cavities, holes, slots or retainers", insertNote),
        P("p3", "Apply presentation covering"),
        P("p4", "Add ribbon, elastic, tabs or roller components", "Only those specified by the approved insert design."),
        P("p5", "Jewellery fit check", fitNote)
      ]
    },
    {
      key: "s6",
      name: "Final assembly and setting",
      description: "",
      processes: [
        P("p1", "Fix tray into case"),
        P("p2", "Install the approved insert"),
        P("p3", "Lid and closure alignment check"),
        P("p4", "Press / set", "As required by the materials and adhesive; waiting time is not operator labour."),
        P("p5", "Clean residue and surface inspection")
      ]
    },
    {
      key: "s7",
      name: "Quality inspection and packing",
      description: "Tolerances, test counts and curing times are taken from the approved sample, supplier instructions or measurement \u2014 none are assumed.",
      processes: [
        P(
          "p1",
          "Final quality inspection",
          "Dimensions and insert fit; jewellery supported without force; closure alignment and retention; clean corners, sound bonds, hinge movement; no wrinkles, exposed board, glue marks or damage; artwork/colour/logo match; lining does not shed or transfer colour; quantity and variant identification."
        ),
        P("p2", "Apply surface protection"),
        P("p3", "Pack into approved outer carton"),
        P("p4", "Record accepted, rejected and reworked quantities; identify the batch")
      ]
    }
  ];
}
__name(jewelleryRoute, "jewelleryRoute");
var DEFAULT_COST_BASIS = "per_1000";
var U = /* @__PURE__ */ __name((key, material, stage, process2, note) => ({ key, material, stage, process: process2, note }), "U");
var SHELL_USAGE = [
  U("u-wrapper", "wrapper", "s1", "p2", "Case and tray wrappers \u2014 sheet size, cut size and pieces from the approved layout."),
  U("u-board", "board", "s2", "p2", "Case panels and tray components. Shared-sheet nesting to be used when the cut list is approved."),
  U("u-magnet", "magnet", "s3", "p2", "Count from the closure drawing (not assumed)."),
  U("u-adhesive", "adhesive", "s3", "p4", "Wrapping, lining and component bonding \u2014 consumption to be measured."),
  U("u-liner-case", "liner", "s3", "p5", "Case inner liner."),
  U("u-tape", "corner-tape", "s4", "p2", "Tray corner reinforcement \u2014 length per box to be measured."),
  U("u-liner-tray", "liner", "s4", "p4", "Tray lining."),
  U("u-interleaf", "interleaf", "s7", "p2", "Surface protection."),
  U("u-carton", "carton", "s7", "p3", "Outer carton \u2014 packed quantity to be confirmed.")
];
var PAD_USAGE = [
  U("u-insert-board", "insert-board", "s5", "p1", "Board-backed pad base."),
  U("u-cushion", "cushion", "s5", "p1", "Cushioning layer \u2014 thickness from actual clearance and support needs."),
  U("u-covering", "covering", "s5", "p3", "Pad covering \u2014 consumption to be measured.")
];
var COMMON_OPEN_ITEMS = [
  "Size unit of the original size string",
  "Internal or external dimension basis",
  "Confirmed length, width and height",
  "Actual jewellery size, weight and clearance",
  "Box opening style and closure (magnetic construction is a proposal)",
  "Board, wrapper, lining and insert selections",
  "Artwork, logo, colour and finishing",
  "Structural drawing and component cut list",
  "Prototype / white sample and jewellery fit check",
  "Approved sample version and acceptance criteria",
  "Supplier quotations and actual production method per process",
  "Process times, rates and setup charges",
  "Tax rate / HSN"
];
var T = /* @__PURE__ */ __name((n, sourceName, rawSize, insertApproach, opts = {}) => ({
  key: `row-${String(n).padStart(2, "0")}`,
  sourceRow: n,
  sourceName,
  rawSize,
  requestedQty: 25,
  insertApproach,
  fitNote: opts.fitNote ?? "Fit the actual jewellery or an approved representative sample.",
  aliases: opts.aliases ?? [],
  usage: [
    ...SHELL_USAGE,
    ...opts.usage ?? PAD_USAGE,
    U("u-accessories", "accessories", "s5", "p4", opts.accessories ?? "Only the accessories named in the approved insert design.")
  ]
}), "T");
var JEWELLERY_PRODUCTS = [
  T(1, "Bracelet", "2*8.5", "Covered pad with bracelet retainers or a shaped recess \u2014 confirm against the jewellery sample", {
    accessories: "Bracelet retainers (if the pad design is chosen; a shaped foam recess is the alternative)."
  }),
  T(2, "Mini Chain", "3*10", "Chain pad with retaining slits/tabs, and pendant accommodation if required", {
    accessories: "Retaining tabs for the chain; pendant support only if required."
  }),
  T(3, "Chain Box", "12*4", "Elongated chain pad with retention at suitable positions", { accessories: "Chain retention tabs/slits at approved positions." }),
  T(4, "Big Chain", "15*4", "Chain support with sufficient clearance for the actual chain and clasp", {
    fitNote: "Verify clearance for the actual chain and clasp.",
    accessories: "Chain support/retention as designed."
  }),
  T(5, "Necklace Box", "7*6", "Necklace-shaped presentation pad; earring positions only if requested", {
    accessories: "Necklace retention; earring positions only if requested."
  }),
  T(6, "Necklace Box", "8*7", "Separate necklace-pad variant matched to this box and its jewellery", { accessories: "Necklace retention for this variant." }),
  T(7, "Haram Box", "13*6", "Long necklace / haram pad with support for pendant and chain", {
    fitNote: "Verify support for the pendant and chain.",
    accessories: "Haram pendant and chain supports."
  }),
  T(8, "Haram Box", "15*6", "Separate long-haram pad variant; verify pendant clearance", {
    fitNote: "Verify pendant clearance for this variant.",
    accessories: "Haram supports for this variant."
  }),
  T(9, "Jimmikke Box", "3*4", "Earring card or covered insert supporting the pair, with clearance below the earrings", {
    fitNote: "Verify earring-post/back clearance and space below hanging jimmikke.",
    aliases: ["Jimikki box", "Jimikki", "Jhumka box"],
    usage: [
      U("u-insert-board", "insert-board", "s5", "p1", "Earring card / covered insert base."),
      U("u-covering", "covering", "s5", "p3", "Card covering \u2014 consumption to be measured.")
    ],
    accessories: "Earring holding slits/holes as designed (no cushioning layer unless the approved design adds one)."
  }),
  T(10, "Bangle Roller", "6*4", "Covered removable roller / cushion sized to the actual bangles", {
    fitNote: "Verify roller diameter, usable length, removal method and lid clearance.",
    usage: [
      U("u-cushion", "cushion", "s5", "p1", "Roller / cushion core \u2014 diameter and length from the actual bangles."),
      U("u-covering", "covering", "s5", "p3", "Roller covering \u2014 consumption to be measured.")
    ],
    accessories: "Roller end pieces / removal aid as designed."
  })
];
var templateProductName = /* @__PURE__ */ __name((t) => `${t.sourceName} \u2014 ${t.rawSize}`, "templateProductName");
function templateSpec(t, batchId) {
  return {
    importKey: `${batchId}:${t.key}`,
    status: "proposed",
    sourceRow: t.sourceRow,
    sourceName: t.sourceName,
    rawSize: t.rawSize,
    sizeUnit: null,
    dimensionBasis: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    requestedQty: t.requestedQty,
    construction: "Magnetic rigid box (case with magnetic closure and inner tray) \u2014 proposed from the \u201CMagnet Box\u201D heading; confirmation pending.",
    insertApproach: t.insertApproach,
    aliases: t.aliases,
    openItems: [...COMMON_OPEN_ITEMS],
    notes: [
      `Customer list row ${t.sourceRow}: "${t.sourceName}", size "${t.rawSize}", requested quantity ${t.requestedQty} (batch quantity, not consumption).`,
      "Route and materials are a proposed template synthesised from two legacy BOMs used only as workflow references \u2014 SILVERA Rakhi box 68\xD7150 mm (BOM 014, effective 20-04-2023, costed for 100 nos with observation quantities of 100\u2013110) and MDF box 200\xD7200 mm (BOM 068, effective 15-08-2025). MDF, coin cavities, U-lock and the legacy coin insert are not applied. Legacy prices, zero-valued lines and totals were not imported.",
      "Supplier listings are sourcing leads, not approved vendors, stock or prices.",
      "Do not treat as a production-ready BOM until dimensions, construction, materials, inserts and rates are confirmed."
    ].join("\n")
  };
}
__name(templateSpec, "templateSpec");

// src/domain/imports.ts
var TEMPLATE_BATCHES = {
  [JEWELLERY_BATCH_ID]: {
    id: JEWELLERY_BATCH_ID,
    title: "Jewellery boxes \u2014 ten proposed magnetic rigid-box products",
    materials: JEWELLERY_MATERIALS,
    products: JEWELLERY_PRODUCTS
  }
};
var materialImportKey = /* @__PURE__ */ __name((batchId, key) => `${batchId}:material:${key}`, "materialImportKey");
var normal = /* @__PURE__ */ __name((s) => s.toLowerCase().replace(/\s+/g, " ").replace(/[–—]/g, "-").trim(), "normal");
function findMaterial(db, batchId, t) {
  return db.materials.find((m) => m.importKey === materialImportKey(batchId, t.key)) ?? db.materials.find((m) => sameText(m.name, t.name));
}
__name(findMaterial, "findMaterial");
function matchProduct(db, batchId, t) {
  const name = templateProductName(t);
  const importKey = `${batchId}:${t.key}`;
  const imported = db.products.find((p) => p.spec?.importKey === importKey);
  if (imported) return { kind: "already-imported", name, key: t.key, productId: imported.id, code: imported.code };
  const sameName = db.products.find((p) => normal(p.name) === normal(name));
  if (sameName) return { kind: "matches-existing", name, key: t.key, productId: sameName.id, code: sameName.code, reason: "A product with this name and size already exists." };
  const sameSpec = db.products.find((p) => p.spec && sameText(p.spec.sourceName, t.sourceName) && p.spec.rawSize.replace(/\s/g, "") === t.rawSize);
  if (sameSpec) return { kind: "matches-existing", name, key: t.key, productId: sameSpec.id, code: sameSpec.code, reason: `Its specification already records "${t.sourceName}" size ${t.rawSize}.` };
  const alias = db.products.find((p) => [t.sourceName, ...t.aliases].some((a) => normal(p.name) === normal(a) || normal(p.name).startsWith(`${normal(a)} `)));
  if (alias)
    return {
      kind: "matches-existing",
      name,
      key: t.key,
      productId: alias.id,
      code: alias.code,
      reason: `"${alias.name}" looks like the same product (name or alias match) but its size is not recorded. It was not changed \u2014 review it before importing this row separately.`
    };
  return { kind: "create", name, key: t.key };
}
__name(matchProduct, "matchProduct");
function planTemplateImport(db, batchId) {
  const batch = TEMPLATE_BATCHES[batchId];
  if (!batch) return null;
  const rows = batch.products.map((t) => matchProduct(db, batchId, t));
  const needed = new Set(rows.filter((r) => r.kind === "create").flatMap((r) => batch.products.find((t) => t.key === r.key).usage.map((u) => u.material)));
  const materialsToCreate = [];
  const materialsReused = [];
  for (const m of batch.materials) {
    const existing = findMaterial(db, batchId, m);
    if (existing) materialsReused.push({ name: existing.name, code: existing.code });
    else if (needed.has(m.key) || rows.some((r) => r.kind === "create")) materialsToCreate.push(m.name);
  }
  return { batchId, rows, materialsToCreate, materialsReused };
}
__name(planTemplateImport, "planTemplateImport");
var importProductTemplates = command(
  "importProductTemplates",
  (batchId) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const batch = TEMPLATE_BATCHES[batchId];
    if (!batch) return fail("Unknown template batch.");
    const plan = planTemplateImport(db, batchId);
    const result = { created: [], skipped: [], materialsCreated: 0 };
    for (const r of plan.rows)
      if (r.kind !== "create")
        result.skipped.push({ name: r.name, reason: r.kind === "already-imported" ? `Already imported as ${r.code} \u2014 left unchanged.` : `${r.reason} (${r.code})` });
    const toCreate = plan.rows.filter((r) => r.kind === "create");
    if (!toCreate.length) return ok(db, result);
    let next = db;
    const materialIds = /* @__PURE__ */ new Map();
    for (const t of batch.materials) {
      const existing = findMaterial(next, batchId, t);
      if (existing) {
        materialIds.set(t.key, existing.id);
        continue;
      }
      let seq;
      [next, seq] = nextSeq(next, "material");
      const material = {
        id: ctx.newId("MAT"),
        code: docCode("MAT", seq),
        name: t.name,
        kind: t.kind,
        uom: t.kind === "sheet" ? "sheet" : t.uom,
        price: null,
        pricingBasis: "per_unit",
        packSize: null,
        gsm: null,
        sizeUnit: "mm",
        sheetLengthMm: null,
        sheetWidthMm: null,
        edgeMarginMm: 0,
        cutGapMm: 0,
        wastagePct: 0,
        purchaseMultiple: 1,
        supplier: t.supplier,
        notes: `${t.notes}
Wastage, edge margin and cutting gap are 0 until a documented basis is entered.`,
        active: true,
        priceUpdatedAt: null,
        priceUpdatedBy: null,
        approval: "candidate",
        thicknessMm: null,
        importKey: materialImportKey(batchId, t.key),
        ...stampNew(ctx)
      };
      next = { ...next, materials: [...next.materials, material] };
      materialIds.set(t.key, material.id);
      result.materialsCreated++;
    }
    for (const row of toCreate) {
      const t = batch.products.find((p) => p.key === row.key);
      const idBase = `${batchId}:${t.key}`;
      const route = jewelleryRoute(t.insertApproach, t.fitNote);
      const stages = route.map((s) => ({
        id: `stg:${idBase}:${s.key}`,
        name: s.name,
        description: s.description,
        processes: s.processes.map((p) => ({
          id: `prc:${idBase}:${s.key}:${p.key}`,
          name: p.name,
          description: p.description,
          setupHours: null,
          runHoursPer1000: null,
          chargeId: null,
          costBasis: DEFAULT_COST_BASIS,
          rate: null,
          setupCharge: null,
          requiresMachine: false,
          method: ""
        }))
      }));
      const materials = t.usage.map((u) => ({
        id: `bom:${idBase}:${u.key}`,
        materialId: materialIds.get(u.material),
        stageId: `stg:${idBase}:${u.stage}`,
        processId: u.process ? `prc:${idBase}:${u.stage}:${u.process}` : null,
        qtyPerPiece: null,
        piecesPerProduct: null,
        cutLengthMm: null,
        cutWidthMm: null,
        rotationAllowed: false,
        upsOverride: null,
        upsOverrideReason: "",
        note: `${u.note} Rotation off until grain direction is confirmed. Proposed usage \u2014 awaiting confirmation.`
      }));
      let seq;
      [next, seq] = nextSeq(next, "product");
      const product = {
        id: ctx.newId("PRD"),
        code: docCode("PRD", seq),
        name: row.name,
        category: "Jewellery box",
        description: `Proposed magnetic rigid box for ${t.sourceName} (customer size "${t.rawSize}", unit unknown). Insert: ${t.insertApproach}.`,
        hsn: "",
        uom: "pcs",
        taxPct: null,
        stages,
        materials,
        active: true,
        version: 1,
        spec: templateSpec(t, batchId),
        ...stampNew(ctx)
      };
      next = audit({ ...next, products: [...next.products, product] }, ctx, {
        action: "Product created (template import)",
        entity: "Product",
        entityId: product.id,
        entityLabel: `${product.code} \u2014 ${product.name}`,
        newValue: `Proposed specification \xB7 ${stages.length} stages \xB7 ${stages.reduce((n, s) => n + s.processes.length, 0)} processes \xB7 ${materials.length} material usages`
      });
      result.created.push({ id: product.id, code: product.code, name: product.name });
    }
    next = audit(next, ctx, {
      action: "Product templates imported",
      entity: "System",
      entityId: batchId,
      entityLabel: batch.title,
      newValue: `${result.created.length} created, ${result.skipped.length} skipped, ${result.materialsCreated} candidate materials added`
    });
    return ok(next, result);
  }
);

// src/domain/master.ts
init_modules_watch_stub();
var nonNeg = /* @__PURE__ */ __name((v) => v === null || isFiniteNumber(v) && v >= 0, "nonNeg");
var positiveOrNull = /* @__PURE__ */ __name((v) => v === null || isFiniteNumber(v) && v > 0, "positiveOrNull");
function productsUsingMaterial(products, materialId) {
  return products.filter((p) => p.materials.some((l) => l.materialId === materialId));
}
__name(productsUsingMaterial, "productsUsingMaterial");
function validateMaterialDraft(materials, products, d) {
  const e = {};
  const name = d.name.trim();
  if (!name) e.name = "Enter the material name.";
  else {
    const dup = materials.find((m) => m.id !== d.id && sameText(m.name, name));
    if (dup) e.name = `\u201C${dup.name}\u201D already exists (${dup.code}). Select it instead of creating a duplicate.`;
  }
  const code = d.code.trim();
  if (code && materials.some((m) => m.id !== d.id && sameText(m.code, code))) e.code = "This code is already used by another material.";
  if (d.kind === "quantity" && !d.uom.trim()) e.uom = "Enter the unit of measure (e.g. kg, nos, mtr).";
  if (d.price !== null && !(isFiniteNumber(d.price) && d.price >= 0)) e.price = "Price must be zero or more \u2014 or leave it blank if unknown.";
  if (d.pricingBasis === "per_pack" && !positiveOrNull(d.packSize)) e.packSize = "Pack size must be greater than zero.";
  if (d.pricingBasis === "per_pack" && d.packSize === null) e.packSize = "Enter how many units are in one pack.";
  if (d.pricingBasis === "per_kg" && d.kind !== "sheet") e.pricingBasis = "Per-kg pricing needs sheet size and GSM. For bulk items use per unit with uom \u201Ckg\u201D.";
  if (d.kind === "sheet" && d.pricingBasis === "per_kg" && !positiveOrNull(d.gsm)) e.gsm = "GSM must be greater than zero.";
  if (d.thicknessMm !== void 0 && !positiveOrNull(d.thicknessMm)) e.thicknessMm = "Thickness must be greater than zero \u2014 or leave it blank.";
  if (!positiveOrNull(d.sheetLengthMm)) e.sheetLengthMm = "Sheet length must be greater than zero.";
  if (!positiveOrNull(d.sheetWidthMm)) e.sheetWidthMm = "Sheet width must be greater than zero.";
  if (!(isFiniteNumber(d.edgeMarginMm) && d.edgeMarginMm >= 0)) e.edgeMarginMm = "Edge allowance cannot be negative.";
  if (!(isFiniteNumber(d.cutGapMm) && d.cutGapMm >= 0)) e.cutGapMm = "Cutting gap cannot be negative.";
  if (d.kind === "sheet" && d.sheetLengthMm && d.sheetWidthMm && (d.sheetLengthMm - 2 * d.edgeMarginMm <= 0 || d.sheetWidthMm - 2 * d.edgeMarginMm <= 0))
    e.edgeMarginMm = "The edge allowance leaves no usable area on this sheet.";
  if (!(isFiniteNumber(d.wastagePct) && d.wastagePct >= 0 && d.wastagePct < 100)) e.wastagePct = "Wastage must be between 0 and 99.99%.";
  if (!(isFiniteNumber(d.purchaseMultiple) && d.purchaseMultiple > 0)) e.purchaseMultiple = "Purchase rounding must be greater than zero.";
  if (d.id) {
    const current = materials.find((m) => m.id === d.id);
    if (current && current.kind !== d.kind && productsUsingMaterial(products, d.id).length)
      e.kind = "This material is used by products; its type cannot change. Create a new material instead.";
  }
  return e;
}
__name(validateMaterialDraft, "validateMaterialDraft");
var saveMaterial = command(
  "saveMaterial",
  (draft) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const errors = validateMaterialDraft(db.materials, db.products, draft);
    if (hasFieldErrors(errors)) return validationFailure(errors);
    const fields = {
      name: draft.name.trim(),
      kind: draft.kind,
      uom: draft.kind === "sheet" ? "sheet" : draft.uom.trim(),
      price: draft.price,
      pricingBasis: draft.pricingBasis,
      packSize: draft.pricingBasis === "per_pack" ? draft.packSize : null,
      gsm: draft.kind === "sheet" ? draft.gsm : null,
      sizeUnit: draft.sizeUnit,
      sheetLengthMm: draft.kind === "sheet" ? draft.sheetLengthMm : null,
      sheetWidthMm: draft.kind === "sheet" ? draft.sheetWidthMm : null,
      edgeMarginMm: draft.kind === "sheet" ? draft.edgeMarginMm : 0,
      cutGapMm: draft.kind === "sheet" ? draft.cutGapMm : 0,
      wastagePct: draft.wastagePct,
      purchaseMultiple: draft.purchaseMultiple,
      supplier: draft.supplier.trim(),
      notes: draft.notes.trim(),
      ...draft.approval ? { approval: draft.approval } : {},
      ...draft.thicknessMm !== void 0 ? { thicknessMm: draft.thicknessMm } : {}
    };
    if (!draft.id) {
      let next2 = db;
      let seq;
      [next2, seq] = nextSeq(next2, "material");
      const material = {
        id: ctx.newId("MAT"),
        code: draft.code.trim() || docCode("MAT", seq),
        ...fields,
        active: true,
        priceUpdatedAt: draft.price !== null ? ctx.now.toISOString() : null,
        priceUpdatedBy: draft.price !== null ? ctx.actor.name : null,
        ...stampNew(ctx)
      };
      next2 = { ...next2, materials: [...next2.materials, material] };
      next2 = audit(next2, ctx, {
        action: "Material created",
        entity: "Material",
        entityId: material.id,
        entityLabel: `${material.code} \u2014 ${material.name}`,
        field: "Price",
        newValue: material.price === null ? "Not set" : String(material.price)
      });
      return ok(next2, material);
    }
    const current = db.materials.find((m) => m.id === draft.id);
    if (!current) return fail("Material not found.");
    const stale = staleRecord(current.name, current, draft.expectedUpdatedAt);
    if (stale) return stale;
    const priceChanged = current.price !== draft.price;
    const updated = stampUpdate(
      {
        ...current,
        code: draft.code.trim() || current.code,
        ...fields,
        priceUpdatedAt: priceChanged ? ctx.now.toISOString() : current.priceUpdatedAt,
        priceUpdatedBy: priceChanged ? ctx.actor.name : current.priceUpdatedBy
      },
      ctx
    );
    let next = { ...db, materials: db.materials.map((m) => m.id === current.id ? updated : m) };
    next = audit(next, ctx, {
      action: priceChanged ? "Material price changed" : "Material updated",
      entity: "Material",
      entityId: current.id,
      entityLabel: `${updated.code} \u2014 ${updated.name}`,
      field: priceChanged ? "Price" : void 0,
      oldValue: priceChanged ? current.price === null ? "Not set" : String(current.price) : void 0,
      newValue: priceChanged ? updated.price === null ? "Not set" : String(updated.price) : void 0
    });
    return ok(next, updated);
  }
);
var setMaterialActive = command(
  "setMaterialActive",
  (id, active) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const m = db.materials.find((x) => x.id === id);
    if (!m) return fail("Material not found.");
    const updated = stampUpdate({ ...m, active }, ctx);
    const next = audit({ ...db, materials: db.materials.map((x) => x.id === id ? updated : x) }, ctx, {
      action: active ? "Material reactivated" : "Material deactivated",
      entity: "Material",
      entityId: id,
      entityLabel: `${m.code} \u2014 ${m.name}`
    });
    return ok(next, updated);
  }
);
var deleteMaterial = command(
  "deleteMaterial",
  (id) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const m = db.materials.find((x) => x.id === id);
    if (!m) return fail("Material not found.");
    const users = productsUsingMaterial(db.products, id);
    if (users.length)
      return fail(`${m.name} is used by ${users.map((p) => p.name).join(", ")}. Remove it from those products or deactivate it instead.`);
    const next = audit({ ...db, materials: db.materials.filter((x) => x.id !== id) }, ctx, {
      action: "Material deleted",
      entity: "Material",
      entityId: id,
      entityLabel: `${m.code} \u2014 ${m.name}`
    });
    return ok(next, null);
  }
);
function validateSpec(spec) {
  const e = {};
  if (!spec) return e;
  const positive = /* @__PURE__ */ __name((v) => v === null || isFiniteNumber(v) && v > 0, "positive");
  if (!positive(spec.lengthMm)) e["spec.lengthMm"] = "Length must be greater than zero \u2014 or leave it blank.";
  if (!positive(spec.widthMm)) e["spec.widthMm"] = "Width must be greater than zero \u2014 or leave it blank.";
  if (!positive(spec.heightMm)) e["spec.heightMm"] = "Height must be greater than zero \u2014 or leave it blank.";
  if (spec.requestedQty !== null && !(Number.isInteger(spec.requestedQty) && spec.requestedQty >= 1))
    e["spec.requestedQty"] = "Requested quantity must be a whole number of at least 1.";
  if (spec.status === "confirmed") {
    if (!spec.sizeUnit?.trim()) e["spec.sizeUnit"] = "Record the confirmed size unit before marking the specification confirmed.";
    if (!spec.dimensionBasis) e["spec.dimensionBasis"] = "State whether the dimensions are internal or external.";
    if (spec.lengthMm === null) e["spec.lengthMm"] = "Enter the confirmed length.";
    if (spec.widthMm === null) e["spec.widthMm"] = "Enter the confirmed width.";
    if (spec.heightMm === null) e["spec.heightMm"] = "Enter the confirmed height.";
  }
  return e;
}
__name(validateSpec, "validateSpec");
function validateBomLine(line, m, stages, prefix) {
  const e = {};
  const key = /* @__PURE__ */ __name((f) => `${prefix}.${line.id}.${f}`, "key");
  if (line.stageId && !stages.some((s) => s.id === line.stageId)) e[key("stage")] = "The linked stage no longer exists.";
  if (line.processId) {
    const stage = stages.find((s) => s.id === line.stageId);
    if (!stage || !stage.processes.some((p) => p.id === line.processId)) e[key("process")] = "The linked process must belong to the selected stage.";
  }
  if (m.kind === "sheet") {
    if (line.piecesPerProduct !== null && !(Number.isInteger(line.piecesPerProduct) && line.piecesPerProduct >= 1))
      e[key("piecesPerProduct")] = "Cut pieces per product must be a whole number of at least 1 \u2014 or leave it blank until the cut list is approved.";
    if (!positiveOrNull(line.cutLengthMm)) e[key("cutLengthMm")] = "Cut length must be greater than zero \u2014 or leave it blank.";
    if (!positiveOrNull(line.cutWidthMm)) e[key("cutWidthMm")] = "Cut width must be greater than zero \u2014 or leave it blank.";
    if (line.upsOverride !== null && !(Number.isInteger(line.upsOverride) && line.upsOverride >= 1))
      e[key("upsOverride")] = "Ups override must be a whole number of at least 1.";
  } else if (line.qtyPerPiece !== null && !(isFiniteNumber(line.qtyPerPiece) && line.qtyPerPiece > 0)) {
    e[key("qtyPerPiece")] = "Consumption per piece must be greater than zero \u2014 or leave it blank until it is measured.";
  }
  return e;
}
__name(validateBomLine, "validateBomLine");
function validateProductDraft(products, materials, charges, d) {
  const e = {};
  if (!d.name.trim()) e.name = "Enter the product name.";
  else if (products.some((p) => p.id !== d.id && sameText(p.name, d.name))) e.name = "A product with this name already exists.";
  if (d.code.trim() && products.some((p) => p.id !== d.id && sameText(p.code, d.code))) e.code = "This code is already used by another product.";
  if (!d.uom.trim()) e.uom = "Enter the finished-goods unit (e.g. pcs).";
  if (d.taxPct !== null && !(isFiniteNumber(d.taxPct) && d.taxPct >= 0 && d.taxPct <= 100)) e.taxPct = "Tax must be between 0 and 100%.";
  if (!d.stages.length) e.stages = "Add at least one stage.";
  Object.assign(e, validateSpec(d.spec));
  d.stages.forEach((s, i) => {
    if (!s.name.trim()) e[`stage.${s.id}.name`] = `Name stage ${i + 1}.`;
    else if (d.stages.some((o) => o.id !== s.id && sameText(o.name, s.name))) e[`stage.${s.id}.name`] = "Stage names must be unique within the product.";
    if (!s.processes.length) e[`stage.${s.id}.processes`] = `Add at least one process to stage ${i + 1}.`;
    s.processes.forEach((p, j) => {
      const k = /* @__PURE__ */ __name((f) => `process.${p.id}.${f}`, "k");
      if (!p.name.trim()) e[k("name")] = `Name process ${j + 1} of stage ${i + 1}.`;
      if (!nonNeg(p.setupHours)) e[k("setupHours")] = "Setup hours cannot be negative \u2014 or leave blank until measured.";
      if (!nonNeg(p.runHoursPer1000)) e[k("runHoursPer1000")] = "Run hours cannot be negative \u2014 or leave blank until measured.";
      if (p.chargeId) {
        if (!charges.some((c) => c.id === p.chargeId)) e[k("chargeId")] = "Select an existing process charge.";
      } else {
        if (!nonNeg(p.rate)) e[k("rate")] = "Rate must be zero or more.";
        if (!nonNeg(p.setupCharge)) e[k("setupCharge")] = "Setup charge must be zero or more.";
      }
    });
  });
  d.materials.forEach((line) => {
    const m = materials.find((x) => x.id === line.materialId);
    if (!m) {
      e[`material.${line.id}.materialId`] = "Select a material.";
      return;
    }
    Object.assign(e, validateBomLine(line, m, d.stages, "material"));
  });
  return e;
}
__name(validateProductDraft, "validateProductDraft");
function normaliseProduct(d) {
  return {
    name: d.name.trim(),
    category: d.category.trim(),
    description: d.description.trim(),
    hsn: d.hsn.trim(),
    uom: d.uom.trim(),
    taxPct: d.taxPct,
    stages: d.stages.map((s) => ({
      ...s,
      name: s.name.trim(),
      description: s.description.trim(),
      processes: s.processes.map((p) => ({
        ...p,
        name: p.name.trim(),
        description: p.description.trim(),
        rate: p.chargeId ? null : p.rate,
        setupCharge: p.chargeId ? null : p.setupCharge
      }))
    })),
    materials: d.materials.map((l) => ({ ...l, upsOverrideReason: l.upsOverrideReason.trim(), note: l.note.trim() })),
    ...d.spec !== void 0 ? { spec: d.spec ? { ...d.spec, sizeUnit: d.spec.sizeUnit?.trim() || null, notes: d.spec.notes.trim() } : null } : {}
  };
}
__name(normaliseProduct, "normaliseProduct");
var saveProduct = command(
  "saveProduct",
  (draft) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const errors = validateProductDraft(db.products, db.materials, db.settings.processCharges, draft);
    if (hasFieldErrors(errors)) return validationFailure(errors);
    const processCount = draft.stages.reduce((s, st) => s + st.processes.length, 0);
    const summary = `${draft.stages.length} stages \xB7 ${processCount} processes \xB7 ${draft.materials.length} materials`;
    if (!draft.id) {
      let next2 = db;
      let seq;
      [next2, seq] = nextSeq(next2, "product");
      const product = {
        id: ctx.newId("PRD"),
        code: draft.code.trim() || docCode("PRD", seq),
        ...normaliseProduct(draft),
        active: true,
        version: 1,
        ...stampNew(ctx)
      };
      next2 = audit({ ...next2, products: [...next2.products, product] }, ctx, {
        action: "Product created",
        entity: "Product",
        entityId: product.id,
        entityLabel: `${product.code} \u2014 ${product.name}`,
        newValue: summary
      });
      return ok(next2, product);
    }
    const current = db.products.find((p) => p.id === draft.id);
    if (!current) return fail("Product not found.");
    const stale = staleRecord(current.name, current, draft.expectedUpdatedAt);
    if (stale) return stale;
    const updated = stampUpdate(
      { ...current, code: draft.code.trim() || current.code, ...normaliseProduct(draft), version: current.version + 1 },
      ctx
    );
    const before = `${current.stages.length} stages \xB7 ${current.stages.reduce((s, st) => s + st.processes.length, 0)} processes \xB7 ${current.materials.length} materials`;
    const next = audit({ ...db, products: db.products.map((p) => p.id === current.id ? updated : p) }, ctx, {
      action: "Product updated",
      entity: "Product",
      entityId: current.id,
      entityLabel: `${updated.code} \u2014 ${updated.name}`,
      field: "Definition",
      oldValue: before,
      newValue: `${summary} (v${updated.version})`
    });
    return ok(next, updated);
  }
);
var setProductActive = command(
  "setProductActive",
  (id, active) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const p = db.products.find((x) => x.id === id);
    if (!p) return fail("Product not found.");
    const updated = stampUpdate({ ...p, active }, ctx);
    return ok(
      audit({ ...db, products: db.products.map((x) => x.id === id ? updated : x) }, ctx, {
        action: active ? "Product reactivated" : "Product deactivated",
        entity: "Product",
        entityId: id,
        entityLabel: `${p.code} \u2014 ${p.name}`
      }),
      updated
    );
  }
);
var deleteProduct = command(
  "deleteProduct",
  (id) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const p = db.products.find((x) => x.id === id);
    if (!p) return fail("Product not found.");
    if (db.plans.some((pl) => pl.productId === id))
      return fail(`${p.name} is referenced by plans or orders. Deactivate it instead so history stays intact.`);
    return ok(
      audit({ ...db, products: db.products.filter((x) => x.id !== id) }, ctx, {
        action: "Product deleted",
        entity: "Product",
        entityId: id,
        entityLabel: `${p.code} \u2014 ${p.name}`
      }),
      null
    );
  }
);
function validateCustomerDraft(customers, d) {
  const e = {};
  if (!d.company.trim()) e.company = "Enter the company name.";
  else if (customers.some((c) => c.id !== d.id && sameText(c.company, d.company)))
    e.company = "A customer with this company name already exists.";
  if (d.code.trim() && customers.some((c) => c.id !== d.id && sameText(c.code, d.code))) e.code = "This code is already used.";
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Enter a valid email address, e.g. accounts@example.com.";
  if (d.phone.trim() && !/^[+0-9 ()-]{6,20}$/.test(d.phone.trim())) e.phone = "Use digits, spaces, +, - or brackets only.";
  if (!d.billingAddress.trim()) e.billingAddress = "The billing address is required for invoices.";
  if (d.gstin.trim() && !isValidGstin(d.gstin)) e.gstin = "A GSTIN has 15 characters and starts with the 2-digit state code.";
  return e;
}
__name(validateCustomerDraft, "validateCustomerDraft");
var saveCustomer = command(
  "saveCustomer",
  (draft) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const errors = validateCustomerDraft(db.customers, draft);
    if (hasFieldErrors(errors)) return validationFailure(errors);
    const fields = {
      company: draft.company.trim(),
      contactPerson: draft.contactPerson.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      billingAddress: draft.billingAddress.trim(),
      deliveryAddress: draft.deliveryAddress.trim(),
      gstin: draft.gstin.trim().toUpperCase(),
      placeOfSupply: draft.placeOfSupply.trim(),
      paymentTerms: draft.paymentTerms.trim(),
      notes: draft.notes.trim()
    };
    if (!draft.id) {
      let next2 = db;
      let seq;
      [next2, seq] = nextSeq(next2, "customer");
      const customer = {
        id: ctx.newId("CUS"),
        code: draft.code.trim() || docCode("CUS", seq),
        ...fields,
        active: true,
        ...stampNew(ctx)
      };
      next2 = audit({ ...next2, customers: [...next2.customers, customer] }, ctx, {
        action: "Customer created",
        entity: "Customer",
        entityId: customer.id,
        entityLabel: `${customer.code} \u2014 ${customer.company}`
      });
      return ok(next2, customer);
    }
    const current = db.customers.find((c) => c.id === draft.id);
    if (!current) return fail("Customer not found.");
    const stale = staleRecord(current.company, current, draft.expectedUpdatedAt);
    if (stale) return stale;
    const updated = stampUpdate({ ...current, code: draft.code.trim() || current.code, ...fields }, ctx);
    const changed = Object.keys(fields).filter((k) => current[k] !== updated[k]);
    const next = audit({ ...db, customers: db.customers.map((c) => c.id === current.id ? updated : c) }, ctx, {
      action: "Customer updated",
      entity: "Customer",
      entityId: current.id,
      entityLabel: `${updated.code} \u2014 ${updated.company}`,
      field: changed.length ? changed.join(", ") : void 0
    });
    return ok(next, updated);
  }
);
var setCustomerActive = command(
  "setCustomerActive",
  (id, active) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const c = db.customers.find((x) => x.id === id);
    if (!c) return fail("Customer not found.");
    const updated = stampUpdate({ ...c, active }, ctx);
    return ok(
      audit({ ...db, customers: db.customers.map((x) => x.id === id ? updated : x) }, ctx, {
        action: active ? "Customer reactivated" : "Customer deactivated",
        entity: "Customer",
        entityId: id,
        entityLabel: `${c.code} \u2014 ${c.company}`
      }),
      updated
    );
  }
);
var deleteCustomer = command(
  "deleteCustomer",
  (id) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const c = db.customers.find((x) => x.id === id);
    if (!c) return fail("Customer not found.");
    if (db.plans.some((p) => p.customerId === id))
      return fail(`${c.company} is referenced by plans or orders. Deactivate the customer instead.`);
    return ok(
      audit({ ...db, customers: db.customers.filter((x) => x.id !== id) }, ctx, {
        action: "Customer deleted",
        entity: "Customer",
        entityId: id,
        entityLabel: `${c.code} \u2014 ${c.company}`
      }),
      null
    );
  }
);
var saveProcessCharge = command(
  "saveProcessCharge",
  (d) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const e = {};
    if (!d.name.trim()) e.name = "Enter the charge name.";
    else if (db.settings.processCharges.some((c) => c.id !== d.id && sameText(c.name, d.name))) e.name = "A process charge with this name exists.";
    if (!nonNeg(d.rate)) e.rate = "Rate must be zero or more.";
    if (!nonNeg(d.setupCharge)) e.setupCharge = "Setup charge must be zero or more.";
    if (hasFieldErrors(e)) return validationFailure(e);
    const current = d.id ? db.settings.processCharges.find((c) => c.id === d.id) : void 0;
    if (d.id && !current) return fail("Process charge not found.");
    const stale = current ? staleRecord(current.name, current, d.expectedUpdatedAt) : null;
    if (stale) return stale;
    const charge = current ? stampUpdate({ ...current, name: d.name.trim(), basis: d.basis, rate: d.rate, setupCharge: d.setupCharge }, ctx) : { id: ctx.newId("PCH"), name: d.name.trim(), basis: d.basis, rate: d.rate, setupCharge: d.setupCharge, active: true, ...stampNew(ctx) };
    const processCharges = current ? db.settings.processCharges.map((c) => c.id === charge.id ? charge : c) : [...db.settings.processCharges, charge];
    const next = audit({ ...db, settings: { ...db.settings, processCharges } }, ctx, {
      action: current ? "Process charge updated" : "Process charge created",
      entity: "Costing Config",
      entityId: charge.id,
      entityLabel: charge.name,
      field: "Rate / setup",
      oldValue: current ? `${current.rate ?? "Not set"} / ${current.setupCharge ?? "Not set"}` : void 0,
      newValue: `${charge.rate ?? "Not set"} / ${charge.setupCharge ?? "Not set"}`
    });
    return ok(next, charge);
  }
);
function productsUsingCharge(products, chargeId) {
  return products.filter((p) => p.stages.some((s) => s.processes.some((pr) => pr.chargeId === chargeId)));
}
__name(productsUsingCharge, "productsUsingCharge");
var setProcessChargeActive = command(
  "setProcessChargeActive",
  (id, active) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const c = db.settings.processCharges.find((x) => x.id === id);
    if (!c) return fail("Process charge not found.");
    return ok(
      audit(
        { ...db, settings: { ...db.settings, processCharges: db.settings.processCharges.map((x) => x.id === id ? stampUpdate({ ...x, active }, ctx) : x) } },
        ctx,
        { action: active ? "Process charge reactivated" : "Process charge deactivated", entity: "Costing Config", entityId: id, entityLabel: c.name }
      ),
      null
    );
  }
);
var deleteProcessCharge = command(
  "deleteProcessCharge",
  (id) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const c = db.settings.processCharges.find((x) => x.id === id);
    if (!c) return fail("Process charge not found.");
    const users = productsUsingCharge(db.products, id);
    if (users.length) return fail(`\u201C${c.name}\u201D is used by ${users.map((p) => p.name).join(", ")}. Deactivate it instead.`);
    return ok(
      audit({ ...db, settings: { ...db.settings, processCharges: db.settings.processCharges.filter((x) => x.id !== id) } }, ctx, {
        action: "Process charge deleted",
        entity: "Costing Config",
        entityId: id,
        entityLabel: c.name
      }),
      null
    );
  }
);
var saveOrderChargeTemplate = command(
  "saveOrderChargeTemplate",
  (d) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const e = {};
    if (!d.name.trim()) e.name = "Enter the charge name.";
    else if (db.settings.orderCharges.some((c) => c.id !== d.id && sameText(c.name, d.name))) e.name = "An order charge with this name exists.";
    if (!nonNeg(d.amount)) e.amount = "Amount must be zero or more.";
    if (d.basis === "percent" && d.amount !== null && d.amount > 100) e.amount = "A percentage charge cannot exceed 100%.";
    if (hasFieldErrors(e)) return validationFailure(e);
    const template = {
      id: d.id ?? ctx.newId("OCH"),
      name: d.name.trim(),
      basis: d.basis,
      amount: d.amount,
      applyByDefault: d.applyByDefault,
      active: d.active
    };
    const exists = db.settings.orderCharges.some((c) => c.id === template.id);
    const orderCharges = exists ? db.settings.orderCharges.map((c) => c.id === template.id ? template : c) : [...db.settings.orderCharges, template];
    return ok(
      audit({ ...db, settings: { ...db.settings, orderCharges } }, ctx, {
        action: exists ? "Order charge updated" : "Order charge created",
        entity: "Costing Config",
        entityId: template.id,
        entityLabel: template.name,
        newValue: `${template.amount ?? "Not set"} (${template.basis})`
      }),
      template
    );
  }
);
var deleteOrderChargeTemplate = command(
  "deleteOrderChargeTemplate",
  (id) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const c = db.settings.orderCharges.find((x) => x.id === id);
    if (!c) return fail("Order charge not found.");
    return ok(
      audit({ ...db, settings: { ...db.settings, orderCharges: db.settings.orderCharges.filter((x) => x.id !== id) } }, ctx, {
        action: "Order charge deleted",
        entity: "Costing Config",
        entityId: id,
        entityLabel: c.name
      }),
      null
    );
  }
);
var saveCostingDefaults = command(
  "saveCostingDefaults",
  (d) => (db, ctx) => {
    const denied = requireCapability(ctx, "master");
    if (denied) return denied;
    const stale = staleRecord("Costing defaults", db.settings, d.expectedUpdatedAt);
    if (stale) return stale;
    const e = {};
    if (!d.taxLabel.trim()) e.taxLabel = "Enter the tax label shown on invoices, e.g. GST.";
    if (!(isFiniteNumber(d.taxPct) && d.taxPct >= 0 && d.taxPct <= 100)) e.taxPct = "Tax must be between 0 and 100%.";
    if (!(isFiniteNumber(d.profitPct) && d.profitPct >= 0)) e.profitPct = "Profit must be zero or more.";
    else if (d.profitMethod === "margin" && d.profitPct >= 100) e.profitPct = "Margin on selling price must be below 100%.";
    if (!(isFiniteNumber(d.bufferHours) && d.bufferHours >= 0 && d.bufferHours <= 200)) e.bufferHours = "Buffer must be between 0 and 200 working hours.";
    if (hasFieldErrors(e)) return validationFailure(e);
    const prev = db.settings;
    const settings = {
      ...prev,
      taxLabel: d.taxLabel.trim(),
      taxPct: d.taxPct,
      profitMethod: d.profitMethod,
      profitPct: d.profitPct,
      bufferHours: d.bufferHours,
      updatedAt: ctx.now.toISOString(),
      updatedBy: ctx.actor.name
    };
    return ok(
      audit({ ...db, settings }, ctx, {
        action: "Costing defaults updated",
        entity: "Costing Config",
        entityId: "defaults",
        entityLabel: "Costing defaults",
        oldValue: `${prev.taxLabel} ${prev.taxPct}% \xB7 ${prev.profitMethod} ${prev.profitPct}% \xB7 buffer ${prev.bufferHours} h`,
        newValue: `${settings.taxLabel} ${settings.taxPct}% \xB7 ${settings.profitMethod} ${settings.profitPct}% \xB7 buffer ${settings.bufferHours} h`
      }),
      settings
    );
  }
);

// src/domain/orderCosting.ts
init_modules_watch_stub();

// src/lib/schedule.ts
init_modules_watch_stub();

// src/lib/workhours.ts
init_modules_watch_stub();
var WORK_START_HOUR = 9;
var WORK_END_HOUR = 18;
var WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR;
var MIN = 6e4;
function isWorkingDay(d) {
  return d.getDay() !== 0;
}
__name(isWorkingDay, "isWorkingDay");
function atHour(d, hour) {
  const out = new Date(d);
  out.setHours(hour, 0, 0, 0);
  return out;
}
__name(atHour, "atHour");
function nextWorkingDayStart(d) {
  const out = atHour(d, WORK_START_HOUR);
  out.setDate(out.getDate() + 1);
  while (!isWorkingDay(out)) out.setDate(out.getDate() + 1);
  return out;
}
__name(nextWorkingDayStart, "nextWorkingDayStart");
function alignForward(date) {
  let d = new Date(date);
  for (let guard = 0; guard < 400; guard++) {
    if (!isWorkingDay(d)) {
      d = atHour(d, WORK_START_HOUR);
      d.setDate(d.getDate() + 1);
      continue;
    }
    if (d < atHour(d, WORK_START_HOUR)) return atHour(d, WORK_START_HOUR);
    if (d >= atHour(d, WORK_END_HOUR)) {
      d = nextWorkingDayStart(d);
      continue;
    }
    return d;
  }
  return d;
}
__name(alignForward, "alignForward");
function alignBackward(date) {
  let d = new Date(date);
  for (let guard = 0; guard < 400; guard++) {
    if (!isWorkingDay(d)) {
      d.setDate(d.getDate() - 1);
      d = atHour(d, WORK_END_HOUR);
      continue;
    }
    if (d > atHour(d, WORK_END_HOUR)) return atHour(d, WORK_END_HOUR);
    if (d <= atHour(d, WORK_START_HOUR)) {
      d.setDate(d.getDate() - 1);
      d = atHour(d, WORK_END_HOUR);
      continue;
    }
    return d;
  }
  return d;
}
__name(alignBackward, "alignBackward");
function addWorkingHours(start, hours) {
  let cursor = alignForward(start);
  let remaining = Math.max(0, Math.round(hours * 60));
  for (let guard = 0; guard < 2e3 && remaining > 0; guard++) {
    const dayEnd = atHour(cursor, WORK_END_HOUR);
    const availableMin = Math.max(0, (dayEnd.getTime() - cursor.getTime()) / MIN);
    if (remaining <= availableMin) {
      return new Date(cursor.getTime() + remaining * MIN);
    }
    remaining -= availableMin;
    cursor = nextWorkingDayStart(cursor);
  }
  return cursor;
}
__name(addWorkingHours, "addWorkingHours");
function subWorkingHours(end, hours) {
  let cursor = alignBackward(end);
  let remaining = Math.max(0, Math.round(hours * 60));
  for (let guard = 0; guard < 2e3 && remaining > 0; guard++) {
    const dayStart = atHour(cursor, WORK_START_HOUR);
    const availableMin = Math.max(0, (cursor.getTime() - dayStart.getTime()) / MIN);
    if (remaining <= availableMin) {
      return new Date(cursor.getTime() - remaining * MIN);
    }
    remaining -= availableMin;
    const prev = new Date(cursor);
    prev.setDate(prev.getDate() - 1);
    cursor = alignBackward(atHour(prev, WORK_END_HOUR));
  }
  return cursor;
}
__name(subWorkingHours, "subWorkingHours");
function workingHoursBetween(from, to) {
  if (to <= from) return 0;
  let cursor = alignForward(from);
  const target = to;
  let total = 0;
  for (let guard = 0; guard < 2e3; guard++) {
    if (cursor >= target) break;
    const dayEnd = atHour(cursor, WORK_END_HOUR);
    const sliceEnd = dayEnd < target ? dayEnd : target;
    total += Math.max(0, (sliceEnd.getTime() - cursor.getTime()) / MIN / 60);
    if (dayEnd >= target) break;
    cursor = nextWorkingDayStart(cursor);
  }
  return Number(total.toFixed(2));
}
__name(workingHoursBetween, "workingHoursBetween");

// src/lib/schedule.ts
var PRIORITY_BUFFER = { Urgent: 0.35, High: 0.65, Normal: 1, Low: 1.35 };
var COMPLETED_STATUSES = ["Completed", "Completed by Progression"];
function isStageDone(stage) {
  return COMPLETED_STATUSES.includes(stage.status);
}
__name(isStageDone, "isStageDone");
function isProcessDone(process2) {
  return process2.status === "Completed";
}
__name(isProcessDone, "isProcessDone");
function processHours(p, quantity) {
  return Math.max(0, p.setupHours ?? 0) + Math.max(0, p.runHoursPer1000 ?? 0) * quantity / 1e3;
}
__name(processHours, "processHours");
function allProcesses(order) {
  return order.stages.flatMap((s) => s.processes);
}
__name(allProcesses, "allProcesses");
function deriveStageStatus(stage, now = /* @__PURE__ */ new Date()) {
  const processes = stage.processes;
  if (!processes.length) return stage.status;
  if (processes.every(isProcessDone)) return "Completed";
  if (processes.some((p) => p.status === "Blocked")) return "Blocked";
  if (processes.some((p) => p.status === "In Progress")) return "In Progress";
  if (processes.some(isProcessDone)) return "In Progress";
  const open = processes.filter((p) => !isProcessDone(p));
  if (open.some((p) => new Date(p.plannedEnd).getTime() < now.getTime())) return "Delayed";
  return "Scheduled";
}
__name(deriveStageStatus, "deriveStageStatus");
function recalcStage(stage, now = /* @__PURE__ */ new Date()) {
  if (!stage.processes.length) return stage;
  const starts = stage.processes.map((p) => p.plannedStart).sort();
  const ends = stage.processes.map((p) => p.plannedEnd).sort();
  const actualStarts = stage.processes.map((p) => p.actualStart).filter(Boolean).sort();
  const actualEnds = stage.processes.map((p) => p.actualEnd).filter(Boolean).sort();
  const status = deriveStageStatus(stage, now);
  const complete = status === "Completed";
  return {
    ...stage,
    status,
    plannedStart: starts[0] ?? stage.plannedStart,
    plannedEnd: ends[ends.length - 1] ?? stage.plannedEnd,
    durationHours: Number(stage.processes.reduce((s, p) => s + p.durationHours, 0).toFixed(2)),
    actualStart: actualStarts[0] ?? stage.actualStart,
    actualEnd: complete ? actualEnds[actualEnds.length - 1] ?? stage.actualEnd : void 0,
    problem: stage.processes.find((p) => p.problem)?.problem
  };
}
__name(recalcStage, "recalcStage");
function recalcStages(stages, now = /* @__PURE__ */ new Date()) {
  return stages.map((s) => recalcStage(s, now));
}
__name(recalcStages, "recalcStages");
function allStagesComplete(stages) {
  return stages.length > 0 && stages.every((s) => s.processes.every(isProcessDone));
}
__name(allStagesComplete, "allStagesComplete");
function processBlockers(order, processId) {
  const sequence = allProcesses(order);
  const at = sequence.findIndex((p) => p.id === processId);
  if (at < 0) return [];
  return sequence.slice(0, at).filter((p) => !isProcessDone(p));
}
__name(processBlockers, "processBlockers");
function planSpread(available, required) {
  if (required <= 0) return { factor: 1, slackPerHour: 0 };
  if (available <= required) return { factor: Math.max(0.35, available / required), slackPerHour: 0 };
  return { factor: 1, slackPerHour: Math.min(6, (available - required) / required) };
}
__name(planSpread, "planSpread");
function planAnchor(orderDate, now) {
  const booked = parseISO(orderDate);
  return alignForward(isSameDay(booked, now) && now > booked ? now : booked < now ? now : booked);
}
__name(planAnchor, "planAnchor");
function deliveryMoment(deliveryDate) {
  const d = parseISO(deliveryDate);
  d.setHours(18, 0, 0, 0);
  return d;
}
__name(deliveryMoment, "deliveryMoment");
function buildJobStages(input) {
  const durations = input.stages.map((s) => s.processes.map((p) => Math.max(0.25, processHours(p, input.quantity))));
  const required = durations.flat().reduce((a, b) => a + b, 0);
  const start = planAnchor(input.orderDate, input.now);
  const planEnd = subWorkingHours(deliveryMoment(input.deliveryDate), input.bufferHours * PRIORITY_BUFFER[input.priority]);
  const { factor, slackPerHour } = planSpread(workingHoursBetween(start, planEnd), required);
  let cursor = start;
  let first = true;
  return input.stages.map((stage, si) => {
    const stageId = input.newId("stg");
    const processes = stage.processes.map((p, pi) => {
      const dur = Number(Math.max(0.25, durations[si][pi] * factor).toFixed(2));
      const gap = first ? 0 : dur * slackPerHour;
      first = false;
      const plannedStart = gap > 0 ? addWorkingHours(cursor, gap) : cursor;
      const plannedEnd = addWorkingHours(plannedStart, dur);
      cursor = plannedEnd;
      return {
        id: input.newId("jpr"),
        processDefId: p.id,
        stageId,
        stageDefId: stage.id,
        stageName: stage.name,
        name: p.name,
        index: pi,
        unitId: input.processUnits[p.id],
        status: "Scheduled",
        durationHours: dur,
        plannedStart: plannedStart.toISOString(),
        plannedEnd: plannedEnd.toISOString(),
        responsiblePersonId: null,
        machineId: null,
        requiresMachine: !!p.requiresMachine,
        noMachineRequired: false,
        done: false,
        doneAt: null,
        doneBy: null
      };
    });
    return {
      id: stageId,
      stageDefId: stage.id,
      index: si,
      name: stage.name,
      description: stage.description,
      status: "Scheduled",
      plannedStart: processes[0]?.plannedStart ?? start.toISOString(),
      plannedEnd: processes[processes.length - 1]?.plannedEnd ?? start.toISOString(),
      durationHours: Number(processes.reduce((s, p) => s + p.durationHours, 0).toFixed(2)),
      processes
    };
  });
}
__name(buildJobStages, "buildJobStages");
function rescheduleIncomplete(order, newDeliveryDate, bufferHours, now) {
  const pending = allProcesses(order).filter((p) => !isProcessDone(p));
  if (!pending.length) return order.stages;
  const doneEnds = allProcesses(order).filter(isProcessDone).map((p) => p.actualEnd).filter(Boolean).sort();
  const anchor = doneEnds.length ? new Date(doneEnds[doneEnds.length - 1]) : now;
  const start = alignForward(anchor > now ? anchor : now);
  const planEnd = subWorkingHours(deliveryMoment(newDeliveryDate), bufferHours * PRIORITY_BUFFER[order.priority]);
  const required = pending.reduce((s, p) => s + Math.max(0.25, p.durationHours), 0);
  const { factor, slackPerHour } = planSpread(workingHoursBetween(start, planEnd), required);
  const windows = /* @__PURE__ */ new Map();
  let cursor = start;
  pending.forEach((p, i) => {
    const dur = Number(Math.max(0.25, Math.max(0.25, p.durationHours) * factor).toFixed(2));
    const gap = i === 0 ? 0 : dur * slackPerHour;
    const windowStart = gap > 0 ? addWorkingHours(cursor, gap) : cursor;
    const plannedEnd = addWorkingHours(windowStart, dur);
    const keepStart = p.status === "In Progress" && p.actualStart ? new Date(p.actualStart) : windowStart;
    windows.set(p.id, { plannedStart: keepStart.toISOString(), plannedEnd: plannedEnd.toISOString(), durationHours: dur });
    cursor = plannedEnd;
  });
  return recalcStages(
    order.stages.map((stage) => ({
      ...stage,
      processes: stage.processes.map((p) => {
        const w = windows.get(p.id);
        if (!w) return p;
        return { ...p, ...w, status: p.status === "Delayed" ? "Scheduled" : p.status };
      })
    })),
    now
  );
}
__name(rescheduleIncomplete, "rescheduleIncomplete");
function remainingHours(order) {
  return allProcesses(order).filter((p) => !isProcessDone(p)).reduce((sum, p) => sum + p.durationHours, 0);
}
__name(remainingHours, "remainingHours");
function jobHealth(order, now = /* @__PURE__ */ new Date()) {
  const pending = allProcesses(order).filter((p) => !isProcessDone(p));
  if (!pending.length) return "Completed";
  if (pending.some((p) => p.status === "Blocked")) return "Delayed";
  if (pending.some((p) => new Date(p.plannedEnd).getTime() < now.getTime())) return "Delayed";
  const deadline = deliveryMoment(order.deliveryDate);
  if (deadline.getTime() < now.getTime()) return "Delayed";
  if (workingHoursBetween(now, deadline) < remainingHours(order)) return "At Risk";
  if (pending.some((p) => new Date(p.plannedStart).getTime() < now.getTime() && p.status !== "In Progress")) return "At Risk";
  return "On Time";
}
__name(jobHealth, "jobHealth");
function refreshStageStatuses(order, now = /* @__PURE__ */ new Date()) {
  let changed = false;
  const stages = order.stages.map((stage) => {
    let processChanged = false;
    const processes = stage.processes.map((p) => {
      if (isProcessDone(p) || p.status === "Blocked" || p.status === "In Progress") return p;
      const overdue = new Date(p.plannedEnd).getTime() < now.getTime();
      if (overdue && p.status !== "Delayed") {
        processChanged = true;
        return { ...p, status: "Delayed" };
      }
      if (!overdue && p.status === "Delayed") {
        processChanged = true;
        return { ...p, status: "Scheduled" };
      }
      return p;
    });
    if (processChanged) {
      changed = true;
      return recalcStage({ ...stage, processes }, now);
    }
    const status = deriveStageStatus(stage, now);
    if (status !== stage.status) {
      changed = true;
      return { ...stage, status };
    }
    return stage;
  });
  return changed ? stages : order.stages;
}
__name(refreshStageStatuses, "refreshStageStatuses");

// src/domain/planning.ts
init_modules_watch_stub();
function validatePlanDraft(db, d, existing) {
  const e = {};
  const customer = db.customers.find((c) => c.id === d.customerId);
  if (!customer) e.customerId = "Select a customer.";
  else if (!customer.active && existing?.customerId !== customer.id) e.customerId = "This customer is deactivated in Master.";
  const product = db.products.find((p) => p.id === d.productId);
  if (!product) e.productId = "Select a product.";
  else if (!product.active && existing?.productId !== product.id) e.productId = "This product is deactivated in Master.";
  if (!(Number.isInteger(d.quantity) && d.quantity >= 1)) e.quantity = "Enter a whole number of pieces (at least 1).";
  else if (d.quantity > 1e8) e.quantity = "Quantity looks too large.";
  if (!isIsoDate(d.orderDate)) e.orderDate = "Enter the order date.";
  if (!isIsoDate(d.deliveryDate)) e.deliveryDate = "Enter the required delivery date.";
  else if (isIsoDate(d.orderDate) && d.deliveryDate < d.orderDate) e.deliveryDate = "Delivery cannot be before the order date.";
  if (product) {
    for (const unitId of Object.values(d.processUnits)) {
      if (unitId && !db.units.some((u) => u.id === unitId)) e.processUnits = "An allocated production unit no longer exists.";
    }
  }
  return e;
}
__name(validatePlanDraft, "validatePlanDraft");
function planReadiness(db, plan) {
  const blocking = [];
  const warnings = [];
  const product = db.products.find((p) => p.id === plan.productId);
  const customer = db.customers.find((c) => c.id === plan.customerId);
  if (!customer) blocking.push({ level: "error", message: "The customer no longer exists.", fix: { label: "Open Master \u2192 Customers", to: "/master/customers" } });
  else {
    if (!customer.active) blocking.push({ level: "error", message: `${customer.company} is deactivated.`, fix: { label: "Open customer", to: `/master/customers?id=${customer.id}` } });
    if (!customer.billingAddress.trim())
      warnings.push({ level: "warning", message: `${customer.company} has no billing address \u2014 invoices need one.`, fix: { label: "Complete customer", to: `/master/customers?id=${customer.id}` } });
  }
  if (!product) {
    blocking.push({ level: "error", message: "The product no longer exists.", fix: { label: "Open Master \u2192 Products", to: "/master/products" } });
    return { blocking, warnings };
  }
  const productFix = { label: "Open product in Master", to: `/master/products/${product.id}` };
  if (!product.active) blocking.push({ level: "error", message: `${product.name} is deactivated.`, fix: productFix });
  if (!product.stages.length) blocking.push({ level: "error", message: `${product.name} has no stages defined.`, fix: productFix });
  if (plan.productVersion && plan.productVersion !== product.version)
    warnings.push({
      level: "warning",
      message: `${product.name} was edited in Master after this plan was saved (v${plan.productVersion} \u2192 v${product.version}). Review the process allocations.`
    });
  product.stages.forEach((s, i) => {
    if (!s.processes.length) blocking.push({ level: "error", message: `Stage ${i + 1} \u201C${s.name}\u201D has no processes.`, fix: productFix });
    s.processes.forEach((process2, pi) => {
      const where = `${s.name} (${s.id}) \u203A ${pi + 1}. ${process2.name}`;
      const unitId = plan.processUnits[process2.id];
      if (!unitId) blocking.push({ level: "error", message: `Allocate a production unit to ${where}.` });
      else {
        const unit = db.units.find((u) => u.id === unitId);
        if (!unit) blocking.push({ level: "error", message: `${where} is allocated to a unit that no longer exists.` });
      }
    });
  });
  if (Number.isInteger(plan.quantity) && plan.quantity > 0) {
    const preview = computeOrderCosting({
      quantity: plan.quantity,
      product: { productId: product.id, stages: product.stages, materials: product.materials, spec: product.spec },
      materials: db.materials,
      settings: db.settings,
      inputs: defaultCostingInputs(db, product, () => "preview")
    });
    const seen = new Set(blocking.map((b) => b.message));
    for (const issue of preview.issues) {
      if (seen.has(issue.message)) continue;
      seen.add(issue.message);
      warnings.push({ ...issue, level: "warning" });
    }
  }
  return { blocking, warnings };
}
__name(planReadiness, "planReadiness");
function cleanProcessUnits(db, productId, processUnits) {
  const product = db.products.find((p) => p.id === productId);
  if (!product) return {};
  const out = {};
  for (const stage of product.stages)
    for (const process2 of stage.processes) if (processUnits[process2.id]) out[process2.id] = processUnits[process2.id];
  return out;
}
__name(cleanProcessUnits, "cleanProcessUnits");
var savePlan = command(
  "savePlan",
  (draft) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const existing = draft.id ? db.plans.find((p) => p.id === draft.id) : void 0;
    if (draft.id && !existing) return fail("Plan not found.");
    const stale = existing ? staleRecord(existing.code, existing, draft.expectedUpdatedAt) : null;
    if (stale) return stale;
    if (existing && existing.status !== "Draft")
      return fail(`${existing.code} is ${existing.status}. Return it to draft before editing.`);
    const errors = validatePlanDraft(db, draft, existing);
    if (hasFieldErrors(errors)) return validationFailure(errors);
    const product = db.products.find((p) => p.id === draft.productId);
    const fields = {
      customerId: draft.customerId,
      productId: draft.productId,
      productVersion: product.version,
      quantity: draft.quantity,
      orderDate: draft.orderDate,
      deliveryDate: draft.deliveryDate,
      priority: draft.priority,
      customerRef: draft.customerRef.trim(),
      dimensions: draft.dimensions.trim(),
      options: draft.options.trim(),
      instructions: draft.instructions.trim(),
      processUnits: cleanProcessUnits(db, draft.productId, draft.processUnits)
    };
    if (!existing) {
      let next2 = db;
      let seq;
      [next2, seq] = nextSeq(next2, "plan");
      const plan = {
        id: ctx.newId("PLN"),
        code: docCode("PLN", seq),
        ...fields,
        status: "Draft",
        submittedAt: null,
        submittedBy: null,
        costingId: null,
        orderId: null,
        ...stampNew(ctx)
      };
      next2 = audit({ ...next2, plans: [plan, ...next2.plans] }, ctx, {
        action: "Plan created",
        entity: "Plan",
        entityId: plan.id,
        entityLabel: `${plan.code} \u2014 ${product.name}`,
        newValue: `${plan.quantity} ${product.uom} \xB7 delivery ${plan.deliveryDate}`
      });
      return ok(next2, plan);
    }
    const updated = stampUpdate({ ...existing, ...fields }, ctx);
    const next = audit({ ...db, plans: db.plans.map((p) => p.id === existing.id ? updated : p) }, ctx, {
      action: "Plan updated",
      entity: "Plan",
      entityId: existing.id,
      entityLabel: `${existing.code} \u2014 ${product.name}`,
      field: existing.quantity !== updated.quantity ? "Quantity" : void 0,
      oldValue: existing.quantity !== updated.quantity ? String(existing.quantity) : void 0,
      newValue: existing.quantity !== updated.quantity ? String(updated.quantity) : void 0
    });
    return ok(next, updated);
  }
);
var submitPlan = command(
  "submitPlan",
  (planId) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const plan = db.plans.find((p) => p.id === planId);
    if (!plan) return fail("Plan not found.");
    if (plan.status === "Ready for Costing") return ok(db, plan);
    if (plan.status !== "Draft") return fail(`${plan.code} is ${plan.status} and cannot be submitted.`);
    const errors = validatePlanDraft(db, { ...plan }, plan);
    if (hasFieldErrors(errors)) return validationFailure(errors);
    const readiness = planReadiness(db, plan);
    if (readiness.blocking.length)
      return fail("Complete the required plan details before sending it to costing.", { issues: readiness.blocking });
    const product = db.products.find((p) => p.id === plan.productId);
    const updated = stampUpdate(
      {
        ...plan,
        productVersion: product.version,
        processUnits: cleanProcessUnits(db, plan.productId, plan.processUnits),
        status: "Ready for Costing",
        submittedAt: ctx.now.toISOString(),
        submittedBy: ctx.actor.name
      },
      ctx
    );
    const next = audit({ ...db, plans: db.plans.map((p) => p.id === planId ? updated : p) }, ctx, {
      action: "Plan sent to costing",
      entity: "Plan",
      entityId: planId,
      entityLabel: `${plan.code} \u2014 ${product.name}`,
      field: "Status",
      oldValue: plan.status,
      newValue: updated.status
    });
    return ok(next, updated);
  }
);
var returnPlanToDraft = command(
  "returnPlanToDraft",
  (planId) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const plan = db.plans.find((p) => p.id === planId);
    if (!plan) return fail("Plan not found.");
    if (plan.status === "Draft") return ok(db, plan);
    if (plan.status !== "Ready for Costing") return fail(`${plan.code} is ${plan.status} and cannot return to draft.`);
    const costing = db.costings.find((c) => c.id === plan.costingId);
    if (costing?.status === "Finalized") return fail("The costing for this plan is already finalized.");
    const updated = stampUpdate({ ...plan, status: "Draft" }, ctx);
    return ok(
      audit({ ...db, plans: db.plans.map((p) => p.id === planId ? updated : p) }, ctx, {
        action: "Plan returned to draft",
        entity: "Plan",
        entityId: planId,
        entityLabel: plan.code,
        field: "Status",
        oldValue: plan.status,
        newValue: "Draft"
      }),
      updated
    );
  }
);
var cancelPlan = command(
  "cancelPlan",
  (planId, reason) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const plan = db.plans.find((p) => p.id === planId);
    if (!plan) return fail("Plan not found.");
    if (plan.status === "Cancelled") return ok(db, plan);
    if (plan.status === "In Production") return fail("A plan already in production cannot be cancelled.");
    if (!reason.trim()) return validationFailure({ reason: "Record why the plan is cancelled." });
    const updated = stampUpdate({ ...plan, status: "Cancelled" }, ctx);
    return ok(
      audit({ ...db, plans: db.plans.map((p) => p.id === planId ? updated : p) }, ctx, {
        action: "Plan cancelled",
        entity: "Plan",
        entityId: planId,
        entityLabel: plan.code,
        field: "Status",
        oldValue: plan.status,
        newValue: "Cancelled",
        reason: reason.trim()
      }),
      updated
    );
  }
);

// src/domain/orderCosting.ts
function defaultCostingInputs(db, product, newId2) {
  return {
    profitMethod: db.settings.profitMethod,
    profitPct: db.settings.profitPct,
    taxPct: product?.taxPct ?? db.settings.taxPct,
    charges: db.settings.orderCharges.filter((c) => c.active && c.applyByDefault).map((c) => ({ id: newId2("chg"), templateId: c.id, name: c.name, basis: c.basis, amount: c.amount })),
    discountType: "amount",
    discountValue: 0
  };
}
__name(defaultCostingInputs, "defaultCostingInputs");
var openCosting = command(
  "openCosting",
  (planId) => (db, ctx) => {
    const denied = requireCapability(ctx, "costing");
    if (denied) return denied;
    const plan = db.plans.find((p) => p.id === planId);
    if (!plan) return fail("Plan not found.");
    const existing = db.costings.find((c) => c.planId === planId);
    if (existing) return ok(db, existing);
    if (plan.status !== "Ready for Costing")
      return fail(`${plan.code} is ${plan.status}. Send the plan to costing from Planning first.`);
    const product = db.products.find((p) => p.id === plan.productId);
    let next = db;
    let seq;
    [next, seq] = nextSeq(next, "costing");
    const costing = {
      id: ctx.newId("CST"),
      code: docCode("CST", seq),
      planId,
      inputs: defaultCostingInputs(db, product, ctx.newId),
      status: "Draft",
      finalizedAt: null,
      finalizedBy: null,
      snapshot: null,
      orderId: null,
      ...stampNew(ctx)
    };
    next = {
      ...next,
      costings: [costing, ...next.costings],
      plans: next.plans.map((p) => p.id === planId ? { ...p, costingId: costing.id } : p)
    };
    next = audit(next, ctx, {
      action: "Order costing opened",
      entity: "Costing",
      entityId: costing.id,
      entityLabel: `${costing.code} \u2014 ${plan.code}`
    });
    return ok(next, costing);
  }
);
var saveCostingInputs = command(
  "saveCostingInputs",
  (costingId, inputs, expectedUpdatedAt) => (db, ctx) => {
    const denied = requireCapability(ctx, "costing");
    if (denied) return denied;
    const costing = db.costings.find((c) => c.id === costingId);
    if (!costing) return fail("Costing not found.");
    if (costing.status === "Finalized") return fail(`${costing.code} is finalized and can no longer be changed.`);
    const stale = staleRecord(costing.code, costing, expectedUpdatedAt);
    if (stale) return stale;
    if (!isFiniteNumber(inputs.profitPct) || !isFiniteNumber(inputs.taxPct) || !isFiniteNumber(inputs.discountValue))
      return fail("Enter valid numbers for profit, tax and discount.");
    const updated = stampUpdate({ ...costing, inputs: deepClone(inputs) }, ctx);
    const next = audit({ ...db, costings: db.costings.map((c) => c.id === costingId ? updated : c) }, ctx, {
      action: "Costing inputs saved",
      entity: "Costing",
      entityId: costingId,
      entityLabel: costing.code,
      field: "Profit / tax",
      oldValue: `${costing.inputs.profitMethod} ${costing.inputs.profitPct}% \xB7 tax ${costing.inputs.taxPct}%`,
      newValue: `${inputs.profitMethod} ${inputs.profitPct}% \xB7 tax ${inputs.taxPct}%`
    });
    return ok(next, updated);
  }
);
var finalizeCosting = command(
  "finalizeCosting",
  (costingId, inputs, expectedUpdatedAt) => (db, ctx) => {
    const denied = requireCapability(ctx, "costing");
    if (denied) return denied;
    const costing = db.costings.find((c) => c.id === costingId);
    if (!costing) return fail("Costing not found.");
    const plan = db.plans.find((p) => p.id === costing.planId);
    if (!plan) return fail("The plan for this costing no longer exists.");
    const existingOrder = db.orders.find((o) => o.id === costing.orderId) ?? db.orders.find((o) => o.id === plan.orderId) ?? db.orders.find((o) => o.planId === plan.id);
    if (existingOrder) {
      const finalized2 = db.costings.find((c) => c.id === existingOrder.costingId) ?? costing;
      return ok(db, { costing: finalized2, order: existingOrder, created: false });
    }
    if (costing.status === "Finalized") return fail(`${costing.code} is finalized but its production order is missing.`);
    const stale = inputs ? staleRecord(costing.code, costing, expectedUpdatedAt) : null;
    if (stale) return stale;
    if (plan.status !== "Ready for Costing") return fail(`${plan.code} is ${plan.status}; only plans ready for costing can be finalized.`);
    const readiness = planReadiness(db, plan);
    if (readiness.blocking.length) return fail("The plan is incomplete.", { issues: readiness.blocking });
    const product = db.products.find((p) => p.id === plan.productId);
    const customer = db.customers.find((c) => c.id === plan.customerId);
    const useInputs = deepClone(inputs ?? costing.inputs);
    const result = computeOrderCosting({
      quantity: plan.quantity,
      product: { productId: product.id, stages: product.stages, materials: product.materials, spec: product.spec },
      materials: db.materials,
      settings: db.settings,
      inputs: useInputs
    });
    if (!result.valid)
      return fail("Resolve the costing errors before finalizing.", { issues: result.issues.filter((i) => i.level === "error") });
    const usedChargeIds = new Set(product.stages.flatMap((s) => s.processes.map((p) => p.chargeId)).filter(Boolean));
    const snapshot2 = deepClone({
      takenAt: ctx.now.toISOString(),
      takenBy: ctx.actor.name,
      customer: customerSnapshot(customer),
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        hsn: product.hsn,
        uom: product.uom,
        version: product.version,
        stages: product.stages,
        materials: product.materials.map((l) => ({ ...l, material: db.materials.find((m) => m.id === l.materialId) }))
      },
      processCharges: db.settings.processCharges.filter((c) => usedChargeIds.has(c.id)),
      plan: {
        code: plan.code,
        quantity: plan.quantity,
        orderDate: plan.orderDate,
        deliveryDate: plan.deliveryDate,
        priority: plan.priority,
        customerRef: plan.customerRef,
        dimensions: plan.dimensions,
        options: plan.options,
        instructions: plan.instructions,
        processUnits: plan.processUnits,
        stageUnits: plan.stageUnits
      },
      inputs: useInputs,
      result
    });
    let next = db;
    let seq;
    [next, seq] = nextSeq(next, "order");
    const order = {
      id: ctx.newId("ORD"),
      code: docCode("JOB", seq),
      planId: plan.id,
      costingId: costing.id,
      customerId: customer.id,
      productId: product.id,
      customer: snapshot2.customer,
      productCode: product.code,
      productName: product.name,
      hsn: product.hsn,
      uom: product.uom,
      quantity: plan.quantity,
      orderDate: plan.orderDate,
      deliveryDate: plan.deliveryDate,
      priority: plan.priority,
      customerRef: plan.customerRef,
      dimensions: plan.dimensions,
      options: plan.options,
      instructions: plan.instructions,
      stages: buildJobStages({
        stages: snapshot2.product.stages,
        processUnits: plan.processUnits,
        quantity: plan.quantity,
        orderDate: plan.orderDate,
        deliveryDate: plan.deliveryDate,
        priority: plan.priority,
        bufferHours: db.settings.bufferHours,
        now: ctx.now,
        newId: ctx.newId
      }),
      status: "Active",
      completedAt: null,
      completedQty: 0,
      createdAt: ctx.now.toISOString(),
      createdBy: ctx.actor.name
    };
    const finalized = stampUpdate(
      {
        ...costing,
        inputs: useInputs,
        status: "Finalized",
        finalizedAt: ctx.now.toISOString(),
        finalizedBy: ctx.actor.name,
        snapshot: snapshot2,
        orderId: order.id
      },
      ctx
    );
    next = {
      ...next,
      costings: next.costings.map((c) => c.id === costing.id ? finalized : c),
      plans: next.plans.map((p) => p.id === plan.id ? stampUpdate({ ...p, status: "In Production", orderId: order.id, costingId: costing.id }, ctx) : p),
      orders: [order, ...next.orders]
    };
    next = audit(next, ctx, {
      action: "Costing finalized",
      entity: "Costing",
      entityId: costing.id,
      entityLabel: `${costing.code} \u2014 ${plan.code}`,
      field: "Customer amount",
      newValue: `${result.grandTotal.toFixed(2)} (${result.sellingPerPiece.toFixed(2)} / ${product.uom})`
    });
    next = audit(next, ctx, {
      action: "Production order created",
      entity: "Production Order",
      entityId: order.id,
      entityLabel: `${order.code} \u2014 ${customer.company}`,
      field: "Stages scheduled",
      newValue: `${order.stages.length} stages \xB7 delivery ${order.deliveryDate}`
    });
    next = notify(next, ctx, {
      key: `${order.id}:created`,
      title: `${order.code} released to production`,
      message: `${order.stages.length}-stage schedule generated for ${customer.company} \u2014 ${order.quantity.toLocaleString("en-IN")} ${order.uom} of ${product.name}.`,
      level: "success",
      audience: "admin",
      orderId: order.id
    });
    for (const unitId of new Set(order.stages.map((s) => s.unitId))) {
      const mine = order.stages.filter((s) => s.unitId === unitId);
      next = notify(next, ctx, {
        key: `${order.id}:assigned:${unitId}`,
        title: `${order.code} \u2014 work assigned to ${unitId}`,
        message: `Stage${mine.length > 1 ? "s" : ""} ${mine.map((s) => `${s.index + 1}. ${s.name}`).join(", ")} assigned to your unit.`,
        level: "info",
        audience: "unit",
        unitId,
        orderId: order.id
      });
    }
    return ok(next, { costing: finalized, order, created: true });
  }
);

// src/domain/production.ts
init_modules_watch_stub();

// src/lib/notify.ts
init_modules_watch_stub();

// src/lib/format.ts
init_modules_watch_stub();
var inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
var inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
var num = new Intl.NumberFormat("en-IN");
function toDate2(value) {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}
__name(toDate2, "toDate");
function fmtTime(value) {
  const d = toDate2(value ?? null);
  return d ? format(d, "hh:mm a") : "\u2014";
}
__name(fmtTime, "fmtTime");
function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
__name(initialsOf, "initialsOf");
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
__name(uid, "uid");

// src/lib/notify.ts
var DUE_SOON_MINUTES = 90;
var DEADLINE_WARN_MINUTES = 120;
function make(key, title, message2, level, audience, orderId, unitId, now, topic = "production") {
  return { id: uid("ntf"), key, title, message: message2, level, audience, topic, unitId, orderId, createdAt: now.toISOString(), read: false };
}
__name(make, "make");
function evaluateNotifications(orders, existingKeys, now = /* @__PURE__ */ new Date()) {
  const out = [];
  const push = /* @__PURE__ */ __name((n) => {
    if (existingKeys.has(n.key)) return;
    existingKeys.add(n.key);
    out.push(n);
  }, "push");
  for (const order of orders) {
    if (order.status === "Completed") continue;
    const who = order.customer.company;
    const pending = allProcesses(order).filter((p) => !isProcessDone(p));
    for (const process2 of pending.slice(0, 2)) {
      if (processBlockers(order, process2.id).length) continue;
      const minsToStart = differenceInMinutes(new Date(process2.plannedStart), now);
      const minsToEnd = differenceInMinutes(new Date(process2.plannedEnd), now);
      const label2 = `${order.code} \u2014 ${process2.stageName} \u203A ${process2.name}`;
      if (process2.status === "Blocked") {
        push(make(`${order.id}:${process2.id}:blocked`, `${label2} blocked`, `${process2.name} is blocked at ${process2.unitId}. ${process2.problem ?? ""}`, "danger", "all", order.id, process2.unitId, now));
      } else if (minsToEnd < 0) {
        push(make(`${order.id}:${process2.id}:should-finish`, `${label2} overdue`, `${process2.name} should have been completed by ${fmtTime(process2.plannedEnd)}.`, "danger", "all", order.id, process2.unitId, now));
      } else if (minsToStart < 0 && process2.status !== "In Progress") {
        push(make(`${order.id}:${process2.id}:should-start`, `${label2} not started`, `${process2.name} was planned to start at ${fmtTime(process2.plannedStart)}.`, "warn", "all", order.id, process2.unitId, now));
      } else if (minsToStart >= 0 && minsToStart <= DUE_SOON_MINUTES && process2.status !== "In Progress") {
        push(make(`${order.id}:${process2.id}:due-soon`, `${label2} due to start`, `${process2.name} is due to start at ${fmtTime(process2.plannedStart)}.`, "info", "unit", order.id, process2.unitId, now));
      } else if (process2.status === "In Progress" && minsToEnd <= DEADLINE_WARN_MINUTES) {
        push(make(`${order.id}:${process2.id}:closing`, `${label2} closing soon`, `${process2.name} must be completed by ${fmtTime(process2.plannedEnd)} to stay on plan.`, "warn", "unit", order.id, process2.unitId, now));
      }
    }
    const health = jobHealth(order, now);
    if (health === "At Risk")
      push(make(`${order.id}:at-risk`, `${order.code} is approaching its deadline`, `${who} \u2014 remaining processes may not fit before ${order.deliveryDate}.`, "warn", "admin", order.id, void 0, now));
    else if (health === "Delayed")
      push(make(`${order.id}:delayed`, `${order.code} is delayed`, `${who} \u2014 a planned process time has passed or a problem is open.`, "danger", "admin", order.id, void 0, now));
    const hoursToDeadline = differenceInMinutes(deliveryMoment(order.deliveryDate), now) / 60;
    if (hoursToDeadline > 0 && hoursToDeadline <= 48)
      push(make(`${order.id}:delivery-soon`, `${order.code} delivery approaching`, `Delivery for ${who} is due on ${order.deliveryDate}. ${pending.length} process(es) still open.`, "warn", "admin", order.id, void 0, now));
  }
  return out;
}
__name(evaluateNotifications, "evaluateNotifications");
var TOPIC_CAPABILITY = {
  production: ["production.monitor", "production.work"],
  dispatch: ["dispatch"],
  billing: ["billing"]
};
function isVisibleTo(n, user) {
  if (!user) return false;
  const capabilities = TOPIC_CAPABILITY[n.topic ?? "production"];
  if (!capabilities.some((c) => can(user, c))) return false;
  if (user.role === "admin") return n.audience === "admin" || n.audience === "all";
  if (n.audience === "admin") return false;
  return !!user.unitId && n.unitId === user.unitId;
}
__name(isVisibleTo, "isVisibleTo");

// src/domain/production.ts
function find(db, orderId, processId) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return fail("Production order not found.");
  for (const stage of order.stages) {
    const process2 = stage.processes.find((p) => p.id === processId);
    if (process2) return { order, stage, process: process2 };
  }
  return fail("Process not found on this order.");
}
__name(find, "find");
function locate(db, ctx, orderId, processId) {
  const found = find(db, orderId, processId);
  if (isFailure(found)) return found;
  if (ctx.actor.role !== "unit") return fail("Process progress is updated by the assigned production unit.");
  if (ctx.actor.unitId !== found.process.unitId)
    return fail(`This process is allocated to ${found.process.unitId}; you can only update your own unit's processes.`);
  return found;
}
__name(locate, "locate");
var isFailure = /* @__PURE__ */ __name((v) => "ok" in v, "isFailure");
function replaceOrder(db, order) {
  return { ...db, orders: db.orders.map((o) => o.id === order.id ? order : o) };
}
__name(replaceOrder, "replaceOrder");
function withProcess(order, updated, now) {
  const stages = order.stages.map(
    (s) => s.id === updated.stageId ? recalcStage({ ...s, processes: s.processes.map((p) => p.id === updated.id ? updated : p) }, now) : s
  );
  return { ...order, stages };
}
__name(withProcess, "withProcess");
function blockedMessage(order, processId) {
  const blockers = processBlockers(order, processId);
  if (!blockers.length) return null;
  const first = blockers[0];
  return `Waiting for \u201C${first.stageName} \u203A ${first.name}\u201D at ${first.unitId}${blockers.length > 1 ? ` and ${blockers.length - 1} earlier process(es)` : ""}.`;
}
__name(blockedMessage, "blockedMessage");
var label = /* @__PURE__ */ __name((order, process2) => `${order.code} \u2014 ${process2.stageName} \u203A ${process2.name}`, "label");
var assignProcessResources = command(
  "assignProcessResources",
  (orderId, processId, resources) => (db, ctx) => {
    const found = locate(db, ctx, orderId, processId);
    if (isFailure(found)) return found;
    const { order, process: process2 } = found;
    if (isProcessDone(process2)) return fail(`${process2.name} is already completed.`);
    const errors = {};
    const person = resources.responsiblePersonId ? db.people.find((p) => p.id === resources.responsiblePersonId) : null;
    if (resources.responsiblePersonId && !person) errors.responsiblePersonId = "Select a person from this unit.";
    else if (person && (!person.active || person.unitId !== process2.unitId))
      errors.responsiblePersonId = `${person.name} does not belong to ${process2.unitId}.`;
    const machine = resources.machineId ? db.machines.find((m) => m.id === resources.machineId) : null;
    if (resources.machineId && !machine) errors.machineId = "Select a machine from this unit.";
    else if (machine && (!machine.active || machine.unitId !== process2.unitId))
      errors.machineId = `${machine.name} does not belong to ${process2.unitId}.`;
    if (process2.requiresMachine && !machine) errors.machineId = "This process is configured to need a machine.";
    if (machine && resources.noMachineRequired) errors.machineId = "Either choose a machine or mark the process as needing none.";
    if (Object.keys(errors).length) return fail(Object.values(errors)[0], { fieldErrors: errors });
    const stamp = ctx.now.toISOString();
    const updated = {
      ...process2,
      responsiblePersonId: person?.id ?? null,
      machineId: machine?.id ?? null,
      noMachineRequired: !machine && resources.noMachineRequired,
      assignedBy: ctx.actor.name,
      assignedAt: stamp,
      updatedBy: ctx.actor.name,
      updatedAt: stamp
    };
    const next = audit(replaceOrder(db, withProcess(order, updated, ctx.now)), ctx, {
      action: "Process resources assigned",
      entity: "Process",
      entityId: processId,
      entityLabel: label(order, process2),
      field: "Responsible person / machine",
      oldValue: `${process2.responsiblePersonId ?? "\u2014"} / ${process2.machineId ?? (process2.noMachineRequired ? "No machine" : "\u2014")}`,
      newValue: `${person?.name ?? "\u2014"} / ${machine?.name ?? (updated.noMachineRequired ? "No machine required" : "\u2014")}`
    });
    return ok(next, updated);
  }
);
var startProcess = command(
  "startProcess",
  (orderId, processId) => (db, ctx) => {
    const found = locate(db, ctx, orderId, processId);
    if (isFailure(found)) return found;
    const { order, process: process2 } = found;
    if (isProcessDone(process2)) return fail(`${process2.name} is already completed.`);
    if (process2.status === "In Progress") return ok(db, process2);
    const blocked = blockedMessage(order, processId);
    if (blocked) return fail(blocked);
    if (!process2.responsiblePersonId)
      return fail("Assign a responsible person before starting this process.", {
        fieldErrors: { responsiblePersonId: "Assign a responsible person before starting." }
      });
    if (process2.requiresMachine && !process2.machineId)
      return fail("This process needs a machine before it can start.", { fieldErrors: { machineId: "Select the machine." } });
    const stamp = ctx.now.toISOString();
    const resumed = process2.status === "Blocked";
    const updated = {
      ...process2,
      status: "In Progress",
      actualStart: process2.actualStart ?? stamp,
      problem: void 0,
      updatedBy: ctx.actor.name,
      updatedAt: stamp
    };
    let next = replaceOrder(db, withProcess(order, updated, ctx.now));
    next = audit(next, ctx, {
      action: resumed ? "Process resumed after problem" : "Process started",
      entity: "Process",
      entityId: processId,
      entityLabel: label(order, process2),
      field: "Status",
      oldValue: process2.status,
      newValue: "In Progress",
      reason: resumed ? `Problem cleared: ${process2.problem ?? ""}` : void 0
    });
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:started:${stamp}`,
      title: `${order.code} \u2014 ${process2.name} ${resumed ? "resumed" : "started"}`,
      message: `${ctx.actor.name} (${process2.unitId}) ${resumed ? "resumed" : "started"} ${process2.stageName} \u203A ${process2.name}.`,
      level: "info",
      audience: "admin",
      unitId: process2.unitId,
      orderId
    });
    return ok(next, updated);
  }
);
var completeProcess = command(
  "completeProcess",
  (orderId, processId) => (db, ctx) => {
    const found = locate(db, ctx, orderId, processId);
    if (isFailure(found)) return found;
    const { order, process: process2 } = found;
    if (isProcessDone(process2))
      return ok(db, { process: process2, stageCompleted: isStageDone(found.stage), orderCompleted: order.status === "Completed" });
    const blocked = blockedMessage(order, processId);
    if (blocked) return fail(blocked);
    if (!process2.responsiblePersonId)
      return fail("Record the responsible person before completing this process.", {
        fieldErrors: { responsiblePersonId: "Assign a responsible person." }
      });
    const stamp = ctx.now.toISOString();
    const updated = {
      ...process2,
      status: "Completed",
      actualStart: process2.actualStart ?? stamp,
      actualEnd: stamp,
      problem: void 0,
      done: true,
      doneAt: stamp,
      doneBy: ctx.actor.name,
      updatedBy: ctx.actor.name,
      updatedAt: stamp
    };
    const workedOrder = withProcess(order, updated, ctx.now);
    const stage = workedOrder.stages.find((s) => s.id === process2.stageId);
    const stageCompleted = isStageDone(stage);
    const orderCompleted = allStagesComplete(workedOrder.stages);
    const updatedOrder = {
      ...workedOrder,
      status: orderCompleted ? "Completed" : workedOrder.status,
      completedAt: orderCompleted ? stamp : workedOrder.completedAt,
      completedQty: orderCompleted ? workedOrder.quantity : workedOrder.completedQty
    };
    let next = replaceOrder(db, updatedOrder);
    next = audit(next, ctx, {
      action: "Process completed",
      entity: "Process",
      entityId: processId,
      entityLabel: label(order, process2),
      field: "Status",
      oldValue: process2.status,
      newValue: "Completed"
    });
    if (stageCompleted) {
      next = audit(next, ctx, {
        action: "Stage completed",
        entity: "Stage",
        entityId: stage.id,
        entityLabel: `${order.code} \u2014 ${stage.name}`,
        field: "Status",
        newValue: "Completed",
        reason: "All required processes of this stage are complete."
      });
      next = notify(next, ctx, {
        key: `${orderId}:${stage.id}:stage-completed`,
        title: `${order.code} \u2014 ${stage.name} completed`,
        message: `Every process in ${stage.name} is closed.`,
        level: "success",
        audience: "admin",
        orderId
      });
    }
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:completed`,
      title: `${order.code} \u2014 ${process2.name} completed`,
      message: `${ctx.actor.name} (${process2.unitId}) closed ${process2.stageName} \u203A ${process2.name}.`,
      level: "success",
      audience: "admin",
      unitId: process2.unitId,
      orderId
    });
    const following = updatedOrder.stages.flatMap((s) => s.processes).find((p) => !isProcessDone(p));
    if (following && following.unitId !== process2.unitId && !processBlockers(updatedOrder, following.id).length) {
      next = notify(next, ctx, {
        key: `${orderId}:${following.id}:ready`,
        title: `${order.code} \u2014 ${following.name} ready for ${following.unitId}`,
        message: `${process2.stageName} \u203A ${process2.name} is complete. ${following.stageName} \u203A ${following.name} can start.`,
        level: "info",
        audience: "unit",
        unitId: following.unitId,
        orderId
      });
    }
    if (orderCompleted) {
      next = audit(next, ctx, {
        action: "Production completed",
        entity: "Production Order",
        entityId: orderId,
        entityLabel: `${order.code} \u2014 ${order.customer.company}`,
        field: "Completed quantity",
        newValue: String(order.quantity)
      });
      next = notify(next, ctx, {
        key: `${orderId}:ready-dispatch`,
        title: `${order.code} ready for dispatch`,
        message: `All stages closed for ${order.customer.company}. ${order.quantity.toLocaleString("en-IN")} ${order.uom} available in Dispatch.`,
        level: "success",
        audience: "admin",
        orderId
      });
    }
    return ok(next, { process: updated, stageCompleted, orderCompleted });
  }
);
var reportProcessProblem = command(
  "reportProcessProblem",
  (orderId, processId, problem) => (db, ctx) => {
    const found = locate(db, ctx, orderId, processId);
    if (isFailure(found)) return found;
    const { order, process: process2 } = found;
    if (!problem.trim()) return fail("Describe the problem.", { fieldErrors: { problem: "Describe the problem." } });
    if (isProcessDone(process2)) return fail(`${process2.name} is already completed.`);
    const stamp = ctx.now.toISOString();
    const updated = {
      ...process2,
      status: "Blocked",
      problem: problem.trim(),
      updatedBy: ctx.actor.name,
      updatedAt: stamp
    };
    let next = replaceOrder(db, withProcess(order, updated, ctx.now));
    next = audit(next, ctx, {
      action: "Problem reported",
      entity: "Process",
      entityId: processId,
      entityLabel: label(order, process2),
      field: "Status",
      oldValue: process2.status,
      newValue: "Blocked",
      reason: problem.trim()
    });
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:blocked:${stamp}`,
      title: `Problem reported \u2014 ${order.code}`,
      message: `${process2.unitId} reported a problem in ${process2.stageName} \u203A ${process2.name}: ${problem.trim()}`,
      level: "danger",
      audience: "admin",
      unitId: process2.unitId,
      orderId
    });
    return ok(next, updated);
  }
);
var saveProcessNote = command(
  "saveProcessNote",
  (orderId, processId, note) => (db, ctx) => {
    const found = locate(db, ctx, orderId, processId);
    if (isFailure(found)) return found;
    const { order, process: process2 } = found;
    const updated = {
      ...process2,
      note: note.trim() || void 0,
      updatedBy: ctx.actor.name,
      updatedAt: ctx.now.toISOString()
    };
    const next = audit(replaceOrder(db, withProcess(order, updated, ctx.now)), ctx, {
      action: "Process note saved",
      entity: "Process",
      entityId: processId,
      entityLabel: label(order, process2),
      field: "Note",
      oldValue: process2.note,
      newValue: note.trim() || "(cleared)"
    });
    return ok(next, updated);
  }
);
var setOrderPriority = command(
  "setOrderPriority",
  (orderId, priority) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return fail("Production order not found.");
    if (order.priority === priority) return ok(db, order);
    const updated = { ...order, priority };
    return ok(
      audit(replaceOrder(db, updated), ctx, {
        action: "Priority changed",
        entity: "Production Order",
        entityId: orderId,
        entityLabel: order.code,
        field: "Priority",
        oldValue: order.priority,
        newValue: priority
      }),
      updated
    );
  }
);
var reviseDeliveryDate = command(
  "reviseDeliveryDate",
  (orderId, deliveryDate, reason) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return fail("Production order not found.");
    if (order.status === "Completed") return fail("Production is already complete.");
    if (!isIsoDate(deliveryDate)) return fail("Enter a valid delivery date.", { fieldErrors: { deliveryDate: "Enter a valid date." } });
    if (deliveryDate < order.orderDate)
      return fail("Delivery cannot be before the order date.", { fieldErrors: { deliveryDate: "Delivery cannot be before the order date." } });
    if (!reason.trim()) return fail("Record the reason for the change.", { fieldErrors: { reason: "Record the reason for the change." } });
    const updated = { ...order, deliveryDate, stages: rescheduleIncomplete(order, deliveryDate, db.settings.bufferHours, ctx.now) };
    let next = audit(replaceOrder(db, updated), ctx, {
      action: "Delivery date revised",
      entity: "Production Order",
      entityId: orderId,
      entityLabel: order.code,
      field: "Delivery date",
      oldValue: order.deliveryDate,
      newValue: deliveryDate,
      reason: reason.trim()
    });
    const affected = new Set(
      order.stages.flatMap((s) => s.processes).filter((p) => !isProcessDone(p)).map((p) => p.unitId)
    );
    for (const unitId of affected) {
      next = notify(next, ctx, {
        key: `${orderId}:replan:${deliveryDate}:${unitId}`,
        title: `${order.code} re-planned`,
        message: `Delivery moved from ${order.deliveryDate} to ${deliveryDate}. Your pending process times were updated.`,
        level: "warn",
        audience: "unit",
        unitId,
        orderId
      });
    }
    return ok(next, updated);
  }
);
var reassignProcessUnit = command(
  "reassignProcessUnit",
  (orderId, processId, unitId, reason) => (db, ctx) => {
    const denied = requireCapability(ctx, "planning");
    if (denied) return denied;
    const found = find(db, orderId, processId);
    if (isFailure(found)) return found;
    const { order, process: process2 } = found;
    if (!db.units.some((u) => u.id === unitId)) return fail("Select an existing production unit.");
    if (process2.unitId === unitId) return ok(db, order);
    if (isProcessDone(process2) || process2.status === "In Progress" || process2.actualStart)
      return fail("Only a process that has not started can move to another unit.");
    if (!reason.trim()) return fail("Record the reason for the change.", { fieldErrors: { reason: "Record the reason for the change." } });
    const cleared = !!(process2.responsiblePersonId || process2.machineId);
    const updatedProcess = {
      ...process2,
      unitId,
      // Resources belong to the previous unit — the new unit must re-allocate.
      responsiblePersonId: null,
      machineId: null,
      noMachineRequired: false,
      assignedBy: void 0,
      assignedAt: void 0,
      updatedBy: ctx.actor.name,
      updatedAt: ctx.now.toISOString()
    };
    const updated = withProcess(order, updatedProcess, ctx.now);
    let next = audit(replaceOrder(db, updated), ctx, {
      action: "Process unit re-assigned",
      entity: "Process",
      entityId: processId,
      entityLabel: label(order, process2),
      field: "Production unit",
      oldValue: process2.unitId,
      newValue: unitId,
      reason: `${reason.trim()}${cleared ? " (responsible person and machine cleared for re-assignment)" : ""}`
    });
    next = notify(next, ctx, {
      key: `${orderId}:${processId}:assigned:${unitId}:${ctx.now.getTime()}`,
      title: `${order.code} \u2014 ${process2.name} assigned to ${unitId}`,
      message: `${process2.stageName} \u203A ${process2.name} moved from ${process2.unitId} to your unit. Assign a responsible person${process2.requiresMachine ? " and machine" : ""} before starting.`,
      level: "info",
      audience: "unit",
      unitId,
      orderId
    });
    return ok(next, updated);
  }
);
function sweepSchedules(db, now) {
  let changed = false;
  const orders = db.orders.map((o) => {
    if (o.status === "Completed") return o;
    const stages = refreshStageStatuses(o, now);
    if (stages === o.stages) return o;
    changed = true;
    return { ...o, stages };
  });
  const fresh = evaluateNotifications(orders, new Set(db.notifications.map((n) => n.key)), now);
  if (!changed && !fresh.length) return db;
  return { ...db, orders, notifications: [...fresh, ...db.notifications].slice(0, 300) };
}
__name(sweepSchedules, "sweepSchedules");

// src/domain/resources.ts
init_modules_watch_stub();
var savePerson = command(
  "savePerson",
  (draft) => (db, ctx) => {
    const denied = ctx.actor.role === "unit" && ctx.actor.unitId === draft.unitId && !draft.id ? null : requireCapability(ctx, "administration");
    if (denied) return denied;
    const errors = {};
    if (!draft.name.trim()) errors.name = "Enter the person\u2019s name.";
    if (!db.units.some((u) => u.id === draft.unitId)) errors.unitId = "Select the unit this person works in.";
    const clash = db.people.find((p) => p.id !== draft.id && p.unitId === draft.unitId && sameText(p.name, draft.name));
    if (clash) errors.name = `${clash.name} already exists in this unit.`;
    if (Object.keys(errors).length) return validationFailure(errors);
    const existing = draft.id ? db.people.find((p) => p.id === draft.id) : void 0;
    if (draft.id && !existing) return fail("Person not found.");
    if (existing) {
      const updated = stampUpdate({ ...existing, unitId: draft.unitId, name: draft.name.trim(), designation: draft.designation.trim() }, ctx);
      return ok(
        audit({ ...db, people: db.people.map((p) => p.id === existing.id ? updated : p) }, ctx, {
          action: "Person updated",
          entity: "Resource",
          entityId: updated.id,
          entityLabel: `${updated.name} (${updated.unitId})`
        }),
        updated
      );
    }
    const [counted, seq] = nextSeq(db, "person");
    const person = {
      id: ctx.newId("PER"),
      unitId: draft.unitId,
      name: draft.name.trim(),
      designation: draft.designation.trim(),
      active: true,
      ...stampNew(ctx)
    };
    return ok(
      audit({ ...counted, people: [...counted.people, person] }, ctx, {
        action: "Person added",
        entity: "Resource",
        entityId: person.id,
        entityLabel: `${person.name} (${person.unitId})`,
        newValue: docCode("PER", seq)
      }),
      person
    );
  }
);
var setPersonActive = command(
  "setPersonActive",
  (personId, active) => (db, ctx) => {
    const denied = requireCapability(ctx, "administration");
    if (denied) return denied;
    const person = db.people.find((p) => p.id === personId);
    if (!person) return fail("Person not found.");
    if (person.active === active) return ok(db, person);
    const updated = stampUpdate({ ...person, active }, ctx);
    return ok(
      audit({ ...db, people: db.people.map((p) => p.id === personId ? updated : p) }, ctx, {
        action: active ? "Person reactivated" : "Person deactivated",
        entity: "Resource",
        entityId: personId,
        entityLabel: `${person.name} (${person.unitId})`
      }),
      updated
    );
  }
);
var saveMachine = command(
  "saveMachine",
  (draft) => (db, ctx) => {
    const denied = ctx.actor.role === "unit" && ctx.actor.unitId === draft.unitId && !draft.id ? null : requireCapability(ctx, "administration");
    if (denied) return denied;
    const errors = {};
    if (!draft.name.trim()) errors.name = "Enter the machine name.";
    if (!db.units.some((u) => u.id === draft.unitId)) errors.unitId = "Select the unit this machine belongs to.";
    const clash = db.machines.find((m) => m.id !== draft.id && m.unitId === draft.unitId && sameText(m.name, draft.name));
    if (clash) errors.name = `${clash.name} already exists in this unit.`;
    if (Object.keys(errors).length) return validationFailure(errors);
    const existing = draft.id ? db.machines.find((m) => m.id === draft.id) : void 0;
    if (draft.id && !existing) return fail("Machine not found.");
    if (existing) {
      const updated = stampUpdate({ ...existing, unitId: draft.unitId, code: draft.code.trim(), name: draft.name.trim() }, ctx);
      return ok(
        audit({ ...db, machines: db.machines.map((m) => m.id === existing.id ? updated : m) }, ctx, {
          action: "Machine updated",
          entity: "Resource",
          entityId: updated.id,
          entityLabel: `${updated.name} (${updated.unitId})`
        }),
        updated
      );
    }
    const [counted, seq] = nextSeq(db, "machine");
    const machine = {
      id: ctx.newId("MCH"),
      unitId: draft.unitId,
      code: draft.code.trim() || docCode("MCH", seq),
      name: draft.name.trim(),
      active: true,
      ...stampNew(ctx)
    };
    return ok(
      audit({ ...counted, machines: [...counted.machines, machine] }, ctx, {
        action: "Machine added",
        entity: "Resource",
        entityId: machine.id,
        entityLabel: `${machine.name} (${machine.unitId})`,
        newValue: machine.code
      }),
      machine
    );
  }
);
var setMachineActive = command(
  "setMachineActive",
  (machineId, active) => (db, ctx) => {
    const denied = requireCapability(ctx, "administration");
    if (denied) return denied;
    const machine = db.machines.find((m) => m.id === machineId);
    if (!machine) return fail("Machine not found.");
    if (machine.active === active) return ok(db, machine);
    const updated = stampUpdate({ ...machine, active }, ctx);
    return ok(
      audit({ ...db, machines: db.machines.map((m) => m.id === machineId ? updated : m) }, ctx, {
        action: active ? "Machine reactivated" : "Machine deactivated",
        entity: "Resource",
        entityId: machineId,
        entityLabel: `${machine.name} (${machine.unitId})`
      }),
      updated
    );
  }
);
var saveUnit = command(
  "saveUnit",
  (draft) => (db, ctx) => {
    const denied = requireCapability(ctx, "administration");
    if (denied) return denied;
    const unit = db.units.find((u) => u.id === draft.id);
    if (!unit) return fail("Unit not found.");
    const errors = {};
    if (!draft.name.trim()) errors.name = "Enter the unit name.";
    if (!Number.isFinite(draft.dailyCapacityJobs) || draft.dailyCapacityJobs < 1) errors.dailyCapacityJobs = "Capacity must be at least 1 job.";
    if (Object.keys(errors).length) return validationFailure(errors);
    const updated = {
      ...unit,
      name: draft.name.trim(),
      shortName: draft.shortName.trim() || draft.name.trim(),
      speciality: draft.speciality.trim(),
      dailyCapacityJobs: Math.round(draft.dailyCapacityJobs)
    };
    return ok(
      audit({ ...db, units: db.units.map((u) => u.id === unit.id ? updated : u) }, ctx, {
        action: "Unit updated",
        entity: "Resource",
        entityId: unit.id,
        entityLabel: updated.name,
        oldValue: unit.name,
        newValue: updated.name
      }),
      updated
    );
  }
);

// src/domain/system.ts
init_modules_watch_stub();
function validateCompany(d) {
  const e = {};
  if (!d.name.trim()) e.name = "Enter the company name printed on invoices.";
  if (d.gstin.trim() && !isValidGstin(d.gstin)) e.gstin = `Enter a 15-character GSTIN: 2-digit state code, then 13 letters or digits (e.g. 33AAACV1234C1ZW). You entered ${d.gstin.trim().length} characters.`;
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Enter a valid email address.";
  if (!/^[A-Za-z0-9-]{1,12}$/.test(d.invoicePrefix.trim())) e.invoicePrefix = "Use 1\u201312 letters, digits or hyphens.";
  return e;
}
__name(validateCompany, "validateCompany");
var saveCompanyProfile = command(
  "saveCompanyProfile",
  (d) => (db, ctx) => {
    const denied = requireCapability(ctx, "administration");
    if (denied) return denied;
    const stale = staleRecord("The company profile", db.company, d.expectedUpdatedAt);
    if (stale) return stale;
    const errors = validateCompany(d);
    if (hasFieldErrors(errors)) return validationFailure(errors);
    const company = {
      name: d.name.trim(),
      address: d.address.trim(),
      phone: d.phone.trim(),
      email: d.email.trim(),
      gstin: d.gstin.trim().toUpperCase(),
      invoicePrefix: d.invoicePrefix.trim(),
      bankDetails: d.bankDetails.trim(),
      invoiceTerms: d.invoiceTerms.trim(),
      updatedAt: ctx.now.toISOString(),
      updatedBy: ctx.actor.name
    };
    return ok(
      audit({ ...db, company }, ctx, {
        action: "Company profile updated",
        entity: "System",
        entityId: "company",
        entityLabel: company.name,
        field: "Applies to",
        newValue: "Invoices issued from now on (issued invoices keep their snapshot)"
      }),
      company
    );
  }
);
var setPasswordHash = command(
  "setPasswordHash",
  (userId, hash, salt, mode) => (db, ctx) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user || !user.active) return fail("Account not found.");
    if (mode === "first-time" && user.passwordHash) return fail("This account already has a password. Sign in instead.");
    if (mode === "change" && ctx.actor.id !== userId) return fail("You can only change your own password.");
    const updated = { ...user, passwordHash: hash, passwordSalt: salt, passwordSetAt: ctx.now.toISOString() };
    return ok(
      audit({ ...db, users: db.users.map((u) => u.id === userId ? updated : u) }, ctx, {
        action: mode === "first-time" ? "Password created on first sign-in" : "Password changed",
        entity: "Account",
        entityId: userId,
        entityLabel: user.email
      }),
      updated
    );
  }
);
var resetPassword = command(
  "resetPassword",
  (userId) => (db, ctx) => {
    const denied = requireCapability(ctx, "administration");
    if (denied) return denied;
    const user = db.users.find((u) => u.id === userId);
    if (!user) return fail("Account not found.");
    if (user.id === ctx.actor.id) return fail("Use \u201CChange password\u201D for your own account.");
    const updated = { ...user, passwordHash: null, passwordSalt: null, passwordSetAt: null };
    return ok(
      audit({ ...db, users: db.users.map((u) => u.id === userId ? updated : u) }, ctx, {
        action: "Password reset \u2014 new password required at next sign-in",
        entity: "Account",
        entityId: userId,
        entityLabel: user.email
      }),
      updated
    );
  }
);
var updateDisplayName = command(
  "updateDisplayName",
  (name) => (db, ctx) => {
    const user = db.users.find((u) => u.id === ctx.actor.id);
    if (!user) return fail("Account not found.");
    const clean = name.trim();
    if (clean.length < 2) return validationFailure({ name: "Enter at least 2 characters." });
    if (db.users.some((u) => u.id !== user.id && u.name.toLowerCase() === clean.toLowerCase()))
      return validationFailure({ name: "Another account already uses this name \u2014 audit entries must stay distinguishable." });
    const updated = { ...user, name: clean, initials: initialsOf(clean) || user.initials };
    return ok(
      audit({ ...db, users: db.users.map((u) => u.id === user.id ? updated : u) }, { ...ctx, actor: { ...ctx.actor, name: clean } }, {
        action: "Display name changed",
        entity: "Account",
        entityId: user.id,
        entityLabel: user.email,
        field: "Name",
        oldValue: user.name,
        newValue: clean
      }),
      updated
    );
  }
);
var CLEAR_CONFIRMATION = "CLEAR BUSINESS DATA";
var clearBusinessData = command(
  "clearBusinessData",
  (confirmation) => (db, ctx) => {
    const denied = requireCapability(ctx, "administration");
    if (denied) return denied;
    if (confirmation.trim() !== CLEAR_CONFIRMATION) return fail(`Type ${CLEAR_CONFIRMATION} to confirm.`);
    const counts = `${db.products.length} products, ${db.materials.length} materials, ${db.customers.length} customers, ${db.plans.length} plans, ${db.orders.length} orders, ${db.invoices.length} invoices`;
    const next = {
      ...db,
      materials: [],
      products: [],
      customers: [],
      plans: [],
      costings: [],
      orders: [],
      dispatches: [],
      invoices: [],
      notifications: [],
      settings: { ...db.settings, processCharges: [], orderCharges: [] }
    };
    return ok(
      audit(next, ctx, {
        action: "Business data cleared",
        entity: "System",
        entityId: "database",
        entityLabel: "All business records",
        oldValue: counts,
        newValue: "Empty \u2014 accounts, company profile, defaults and document counters kept"
      }),
      null
    );
  }
);
var markReadOp = /* @__PURE__ */ __name((ids, visible) => (db) => ok(
  {
    ...db,
    notifications: db.notifications.map((n) => (ids === "all" ? visible(n) : ids.includes(n.id)) ? { ...n, read: true } : n)
  },
  null
), "markReadOp");
var clearOp = /* @__PURE__ */ __name((visible) => (db) => ok({ ...db, notifications: db.notifications.filter((n) => !visible(n)) }, null), "clearOp");
var visibleToActor = /* @__PURE__ */ __name((ctx) => (n) => isVisibleTo(n, { role: ctx.actor.role, adminTier: ctx.actor.adminTier ?? null, unitId: ctx.actor.unitId }), "visibleToActor");
var markNotificationsRead = command("markNotificationsRead", markReadOp, {
  args: /* @__PURE__ */ __name((ids) => [ids], "args"),
  build: /* @__PURE__ */ __name((args, ctx) => markReadOp(args[0], visibleToActor(ctx)), "build")
});
var clearNotifications = command("clearNotifications", clearOp, {
  args: /* @__PURE__ */ __name(() => [], "args"),
  build: /* @__PURE__ */ __name((_args, ctx) => clearOp(visibleToActor(ctx)), "build")
});

// server/service.ts
var SESSION_HOURS = 12;
var NOT_A_COMMAND = /* @__PURE__ */ new Set(["setPasswordHash"]);
var actorFor = /* @__PURE__ */ __name((u) => ({ id: u.id, name: u.name, role: u.role, unitId: u.unitId, adminTier: u.adminTier }), "actorFor");
var SYSTEM = { id: "system", name: "System", role: "admin", unitId: null, adminTier: "full" };
var newId = /* @__PURE__ */ __name((prefix) => `${prefix}-${randomUUID().slice(0, 13)}`, "newId");
var hashToken = /* @__PURE__ */ __name((token) => createHash("sha256").update(token).digest("hex"), "hashToken");
function publicState(db) {
  return { ...db, users: db.users.map((u) => ({ ...u, passwordHash: u.passwordHash ? "set" : null, passwordSalt: null })) };
}
__name(publicState, "publicState");
function publicAccounts(db) {
  return db.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    unitId: u.unitId,
    adminTier: u.adminTier,
    designation: u.designation,
    initials: u.initials,
    active: u.active,
    hasPassword: !!u.passwordHash
  }));
}
__name(publicAccounts, "publicAccounts");
var VertexService = class {
  static {
    __name(this, "VertexService");
  }
  failures = /* @__PURE__ */ new Map();
  db;
  clock;
  constructor(db, clock = () => /* @__PURE__ */ new Date()) {
    this.db = db;
    this.clock = clock;
  }
  /** Creates the state row the first time. Never replaces existing data. */
  async ensureState() {
    await this.db.transaction(async (tx) => {
      const current = await readState(tx, true);
      if (current) return;
      const now = this.clock();
      await writeState(tx, { revision: 1, data: normalizeDB(buildEmptyDB(now)), actor: "system", command: "initialise", at: now });
    });
  }
  async state() {
    const row = await readState(this.db);
    if (!row) throw new Error("State not initialised");
    return { revision: row.revision, db: normalizeDB(row.data) };
  }
  /* --------------------------------- auth --------------------------------- */
  locked(userId) {
    const f = this.failures.get(userId);
    return !!f && f.until > Date.now();
  }
  noteFailure(userId) {
    const f = this.failures.get(userId) ?? { count: 0, until: 0 };
    f.count += 1;
    if (f.count >= 5) {
      f.until = Date.now() + 6e4;
      f.count = 0;
    }
    this.failures.set(userId, f);
  }
  async openSession(tx, userId) {
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(this.clock().getTime() + SESSION_HOURS * 36e5);
    await tx.query("insert into vertex_sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [hashToken(token), userId, expires.toISOString()]);
    return token;
  }
  /** Apply a system-level change (sign-in audit, password) inside the state lock. */
  async mutate(label2, actor, fn, tx) {
    const row = await readState(tx, true);
    if (!row) throw new Error("State not initialised");
    const ctx = { actor, now: this.clock(), newId };
    const current = normalizeDB(row.data);
    const r = fn(current, ctx);
    if (r.ok && r.db !== current) await writeState(tx, { revision: row.revision + 1, data: r.db, actor: actor.name, command: label2, at: ctx.now });
    return r;
  }
  async login(userId, password) {
    if (this.locked(userId)) return { ok: false, status: 429, error: "Too many attempts. Wait a minute and try again." };
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true);
      const user = row?.data.users.find((u) => u.id === userId && u.active);
      if (!row || !user) return { ok: false, status: 401, error: "Account not found." };
      if (!user.passwordHash || !user.passwordSalt) return { ok: false, status: 409, error: "This account has no password yet. Create one to continue." };
      if (!await verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        this.noteFailure(userId);
        return { ok: false, status: 401, error: "Incorrect password." };
      }
      this.failures.delete(userId);
      await this.mutate("signIn", actorFor(user), (d, ctx) => ok(audit(d, ctx, { action: "Signed in", entity: "Account", entityId: user.id, entityLabel: user.email }), null), tx);
      const token = await this.openSession(tx, user.id);
      return { ok: true, token, user: publicAccounts({ users: [user] })[0] };
    });
  }
  async createFirstPassword(userId, password, confirm) {
    const problem = passwordProblem(password, confirm);
    if (problem) return { ok: false, status: 422, error: problem };
    const salt = newSalt();
    const hash = await hashPassword(password, salt);
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true);
      const user = row?.data.users.find((u) => u.id === userId && u.active);
      if (!user) return { ok: false, status: 404, error: "Account not found." };
      const r = await this.mutate("createFirstPassword", actorFor(user), setPasswordHash(userId, hash, salt, "first-time"), tx);
      if (!r.ok) return { ok: false, status: 409, error: r.error };
      await this.mutate("signIn", actorFor(user), (d, ctx) => ok(audit(d, ctx, { action: "Signed in", entity: "Account", entityId: user.id, entityLabel: user.email }), null), tx);
      const token = await this.openSession(tx, user.id);
      return { ok: true, token, user: publicAccounts({ users: [r.value] })[0] };
    });
  }
  async changePassword(userId, current, next, confirm) {
    const row = await readState(this.db);
    const user = row?.data.users.find((u) => u.id === userId && u.active);
    if (!user?.passwordHash || !user.passwordSalt) return { ok: false, status: 401, error: "Sign in again to change your password." };
    if (!await verifyPassword(current, user.passwordSalt, user.passwordHash)) return { ok: false, status: 401, error: "Your current password is incorrect." };
    const problem = passwordProblem(next, confirm);
    if (problem) return { ok: false, status: 422, error: problem };
    const salt = newSalt();
    const hash = await hashPassword(next, salt);
    return this.db.transaction(async (tx) => {
      const r = await this.mutate("changePassword", actorFor(user), setPasswordHash(userId, hash, salt, "change"), tx);
      if (!r.ok) return { ok: false, status: 409, error: r.error };
      await tx.query("delete from vertex_sessions where user_id = $1", [userId]);
      return { ok: true };
    });
  }
  /** The active account behind a session token, or null. */
  async sessionUser(token) {
    if (!token) return null;
    const { rows } = await this.db.query("select user_id from vertex_sessions where token_hash = $1 and expires_at > $2", [
      hashToken(token),
      this.clock().toISOString()
    ]);
    if (!rows[0]) return null;
    const row = await readState(this.db);
    return row?.data.users.find((u) => u.id === rows[0].user_id && u.active) ?? null;
  }
  async logout(token) {
    if (!token) return;
    const user = await this.sessionUser(token);
    await this.db.transaction(async (tx) => {
      await tx.query("delete from vertex_sessions where token_hash = $1", [hashToken(token)]);
      if (user) await this.mutate("signOut", actorFor(user), (d, ctx) => ok(audit(d, ctx, { action: "Signed out", entity: "Account", entityId: user.id, entityLabel: user.email }), null), tx);
    });
  }
  /* ------------------------------- commands ------------------------------- */
  async command(token, name, args) {
    const spec = COMMANDS.get(name);
    if (!spec || NOT_A_COMMAND.has(name)) return { ok: false, status: 400, error: `Unknown command \u201C${name}\u201D.` };
    if (!Array.isArray(args)) return { ok: false, status: 400, error: "Command arguments must be a list." };
    const tokenUser = await this.sessionUser(token);
    if (!tokenUser) return { ok: false, status: 401, error: "Your session has ended. Sign in again." };
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true);
      if (!row) throw new Error("State not initialised");
      const current = normalizeDB(row.data);
      const user = current.users.find((u) => u.id === tokenUser.id && u.active);
      if (!user) return { ok: false, status: 401, error: "Your session has ended. Sign in again." };
      const ctx = { actor: actorFor(user), now: this.clock(), newId };
      let result;
      try {
        result = spec.build(args, ctx)(current, ctx);
      } catch (err) {
        return { ok: false, status: 400, error: `The request could not be applied: ${err instanceof Error ? err.message : String(err)}` };
      }
      if (!result.ok) {
        const status = /does not have access|Only an administrator/.test(result.error) ? 403 : result.conflict ? 409 : 422;
        return { ok: false, status, error: result.error, fieldErrors: result.fieldErrors, conflict: result.conflict, issues: result.issues };
      }
      if (result.db === current) return { ok: true, revision: row.revision, value: result.value, db: publicState(current) };
      const revision = row.revision + 1;
      await writeState(tx, { revision, data: result.db, actor: user.name, command: name, at: ctx.now });
      return { ok: true, revision, value: result.value, db: publicState(result.db) };
    });
  }
  /** Clock-driven status changes, applied by the server as the System actor. */
  async sweep() {
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true);
      if (!row) return false;
      const current = normalizeDB(row.data);
      const next = sweepSchedules(current, this.clock());
      if (next === current) return false;
      await writeState(tx, { revision: row.revision + 1, data: next, actor: SYSTEM.name, command: "sweepSchedules", at: this.clock() });
      return true;
    });
  }
  /* -------------------------------- drafts -------------------------------- */
  async getDraft(userId, key) {
    const { rows } = await this.db.query(
      "select rev, data, updated_at from vertex_drafts where user_id = $1 and draft_key = $2",
      [userId, key]
    );
    const r = rows[0];
    return r ? { rev: Number(r.rev), data: r.data, updatedAt: new Date(r.updated_at).toISOString() } : null;
  }
  /** Saves a draft unless a newer revision (from another tab or device) is stored. */
  async putDraft(userId, key, knownRev, data) {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query(
        "select rev, data, updated_at from vertex_drafts where user_id = $1 and draft_key = $2 for update",
        [userId, key]
      );
      const current = rows[0];
      if (current && Number(current.rev) > knownRev)
        return { ok: false, status: 409, current: { rev: Number(current.rev), data: current.data, updatedAt: new Date(current.updated_at).toISOString() } };
      const rev = Math.max(knownRev, current ? Number(current.rev) : 0) + 1;
      await tx.query(
        `insert into vertex_drafts (user_id, draft_key, rev, data, updated_at) values ($1, $2, $3, $4, $5)
         on conflict (user_id, draft_key) do update set rev = excluded.rev, data = excluded.data, updated_at = excluded.updated_at`,
        [userId, key, rev, data, this.clock().toISOString()]
      );
      return { ok: true, rev };
    });
  }
  async deleteDraft(userId, key) {
    await this.db.query("delete from vertex_drafts where user_id = $1 and draft_key = $2", [userId, key]);
  }
  /* ------------------------------ migration ------------------------------- */
  /**
   * Load an exported browser dataset into an EMPTY server database. Existing
   * server data is never replaced: the import is refused unless the server holds
   * no business records yet. IDs, accounts (with their password hashes) and
   * document counters are kept exactly.
   */
  async importBrowserDataset(dataset, importedBy, drafts) {
    const incoming = normalizeDB(dataset);
    return this.db.transaction(async (tx) => {
      const row = await readState(tx, true);
      if (row) {
        const d = row.data;
        const hasRecords = [d.products, d.materials, d.customers, d.plans, d.costings, d.orders, d.dispatches, d.invoices].some((l) => l.length > 0);
        if (hasRecords) return { ok: false, status: 409, error: "The server already holds business records. The import was refused so nothing is replaced." };
      }
      const revision = (row?.revision ?? 0) + 1;
      await writeState(tx, { revision, data: incoming, actor: importedBy, command: "importBrowserDataset", at: this.clock() });
      await tx.query(`insert into vertex_meta (key, value) values ('imported_from_browser', $1) on conflict (key) do update set value = excluded.value`, [
        JSON.stringify({ at: this.clock().toISOString(), by: importedBy, revision, createdAt: incoming.createdAt })
      ]);
      if (drafts) {
        for (const draft of drafts) {
          try {
            const parsed = JSON.parse(draft.value);
            await tx.query("insert into vertex_drafts (user_id, draft_key, rev, data) values ($1, $2, $3, $4)", [parsed.userId, draft.key, parsed.rev, parsed.data]);
          } catch {
          }
        }
      }
      return { ok: true, revision };
    });
  }
};

// server/api.ts
init_modules_watch_stub();

// src/lib/wire.ts
init_modules_watch_stub();
var NON_FINITE = "$nonFinite";
function toWire(value) {
  return JSON.stringify(value, (_k, v) => typeof v === "number" && !Number.isFinite(v) ? { [NON_FINITE]: String(v) } : v);
}
__name(toWire, "toWire");
function fromWire(text) {
  return JSON.parse(text, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && NON_FINITE in v) return Number(v[NON_FINITE]);
    return v;
  });
}
__name(fromWire, "fromWire");

// server/backup.ts
init_modules_watch_stub();
var import_adm_zip = __toESM(require_adm_zip(), 1);
import { createCipheriv, createDecipheriv, createHash as createHash2, randomBytes as randomBytes2, scryptSync } from "node:crypto";
var ARCHIVE_FORMAT = "vertex-erp-archive";
var ARCHIVE_FORMAT_VERSION = 1;
var LEGACY_FORMAT = "vertex-erp-backup-v1";
var sha256 = /* @__PURE__ */ __name((buf) => createHash2("sha256").update(buf).digest("hex"), "sha256");
function summarise(state, drafts = []) {
  return {
    users: state.users.length,
    usersWithPassword: state.users.filter((u) => u.passwordHash).length,
    units: state.units?.length ?? 0,
    people: state.people?.length ?? 0,
    machines: state.machines?.length ?? 0,
    materials: state.materials.length,
    products: state.products.length,
    productStages: state.products.reduce((n, p) => n + p.stages.length, 0),
    productProcesses: state.products.reduce((n, p) => n + p.stages.reduce((m, s) => m + s.processes.length, 0), 0),
    productMaterialUsages: state.products.reduce((n, p) => n + p.materials.length, 0),
    customers: state.customers.length,
    plans: state.plans.length,
    costings: state.costings.length,
    orders: state.orders.length,
    dispatches: state.dispatches.length,
    dispatchesReceived: state.dispatches.filter((d) => d.receivedAt).length,
    invoices: state.invoices.length,
    notifications: state.notifications?.length ?? 0,
    auditEntries: state.audit.length,
    drafts: drafts.length
  };
}
__name(summarise, "summarise");
function splitCredentials(state) {
  const credentials = {};
  const users = state.users.map((u) => {
    if (u.passwordHash) credentials[u.id] = { passwordHash: u.passwordHash, passwordSalt: u.passwordSalt, passwordSetAt: u.passwordSetAt };
    return { ...u, passwordHash: null, passwordSalt: null, passwordSetAt: u.passwordHash ? u.passwordSetAt : null };
  });
  return { publicState: { ...state, users }, credentials };
}
__name(splitCredentials, "splitCredentials");
function encryptCredentials(credentials, passphrase) {
  const salt = randomBytes2(16);
  const iv = randomBytes2(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return { kdf: "scrypt", salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}
__name(encryptCredentials, "encryptCredentials");
function decryptCredentials(file, passphrase) {
  const key = scryptSync(passphrase, Buffer.from(file.salt, "base64"), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.iv, "base64"));
  decipher.setAuthTag(Buffer.from(file.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(file.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}
__name(decryptCredentials, "decryptCredentials");
var RESTORE_MD = `# Restoring a Vertex ERP backup

This archive restores the application data only up to its export time (see
manifest.json \u2192 exportedAt and database.revision). Anything saved later is not in it.

1. Prepare an EMPTY PostgreSQL database (a new Supabase project or any PostgreSQL 15+).
2. Fill in config.template.env for the destination and keep it out of source control.
3. Validate without writing anything:
   node dist-server/main.js restore <archive.zip> --into <DATABASE_URL> --dry-run
4. Restore (the schema in migrations/ is applied first):
   node dist-server/main.js restore <archive.zip> --into <DATABASE_URL> --confirm <destination-label>
   - Account passwords: set VERTEX_BACKUP_PASSPHRASE to the passphrase used when the
     archive was made. Without it, add --without-credentials: every account then
     chooses a new password at its first sign-in.
   - A destination that already holds data is refused. To replace it, add --replace;
     a pre-restore archive of the destination is written first.
5. Start the server against the destination (DATABASE_URL), sign in, check the records.
6. Keep the old deployment until the new one is verified.

The app's own login is used (not Supabase Auth); changing a Supabase account email
does not move these accounts \u2014 they live in this archive.
`;
var CONFIG_TEMPLATE = `# Vertex ERP server configuration \u2014 placeholders only, never commit real values.
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
# DATABASE_SCHEMA=public
PORT=8787
SECURE_COOKIES=1
BACKUP_DIR=<path on storage separate from the database>
BACKUP_INTERVAL_MIN=60
BACKUP_KEEP=72
# Passphrase that encrypts account password hashes inside backups (keep it outside the database).
VERTEX_BACKUP_PASSPHRASE=<long random passphrase>
`;
async function snapshot(db) {
  return db.transaction(async (tx) => {
    if (db.kind === "postgres") await tx.query("set transaction isolation level repeatable read");
    const row = await readState(tx);
    if (!row) throw new Error("Nothing to back up: the database has no state yet.");
    const { rows } = await tx.query("select user_id, draft_key, rev, data from vertex_drafts order by user_id, draft_key");
    return { row, drafts: rows.map((r) => ({ userId: r.user_id, key: r.draft_key, rev: Number(r.rev), data: r.data })), schema: await schemaVersion(tx) };
  });
}
__name(snapshot, "snapshot");
function archiveName(now) {
  const p = /* @__PURE__ */ __name((n, w = 2) => String(n).padStart(w, "0"), "p");
  return `vertex-erp-backup-${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z.zip`;
}
__name(archiveName, "archiveName");
async function buildArchive(db, options = {}) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const { row, drafts, schema } = await snapshot(db);
  const { publicState: publicState2, credentials } = splitCredentials(row.data);
  const hasCredentials = Object.keys(credentials).length > 0;
  const files = {
    "data.json": Buffer.from(JSON.stringify({ state: publicState2, drafts }, null, 1)),
    "config.template.env": Buffer.from(CONFIG_TEMPLATE),
    "RESTORE.md": Buffer.from(RESTORE_MD)
  };
  for (const m of MIGRATIONS) files[`migrations/${migrationFileName(m)}`] = Buffer.from(m.sql.trim() + "\n");
  if (hasCredentials && options.passphrase) files["credentials.enc.json"] = Buffer.from(JSON.stringify(encryptCredentials(credentials, options.passphrase), null, 1));
  const manifest = {
    format: ARCHIVE_FORMAT,
    formatVersion: ARCHIVE_FORMAT_VERSION,
    appVersion: options.appVersion ?? "vertex-erp",
    schemaVersion: schema || SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    database: { kind: db.kind, schema: db.schema, revision: row.revision, updatedAt: row.updatedAt, updatedBy: row.updatedBy },
    counts: summarise(row.data, drafts),
    counters: row.data.counters,
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha256(v)])),
    credentials: !hasCredentials ? "none-set" : options.passphrase ? "encrypted" : "omitted",
    attachments: { count: 0, note: "Vertex ERP stores no file attachments; issued documents are regenerated from their saved snapshots." },
    notice: `Contains data committed up to revision ${row.revision} (${row.updatedAt}). Changes saved after ${now.toISOString()} are not included.`
  };
  const zip = new import_adm_zip.default();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 1)));
  for (const [name, content] of Object.entries(files)) zip.addFile(name, content);
  return { buffer: zip.toBuffer(), manifest };
}
__name(buildArchive, "buildArchive");
var EMPTY_STATUS = { lastSuccessAt: null, lastSuccessRevision: null, lastSuccessName: null, lastFailureAt: null, lastFailure: null, credentials: null };
var ARCHIVE_NAME = /^vertex-erp-backup-[A-Za-z0-9._-]+.zip$/;
async function runBackup(db, store, options = {}) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const status = await store.readStatus().catch(() => ({ ...EMPTY_STATUS }));
  try {
    const { buffer, manifest } = await buildArchive(db, { ...options, now });
    const name = archiveName(now);
    await store.put(name, buffer, { exportedAt: manifest.exportedAt, revision: manifest.database.revision });
    const back = await store.get(name);
    if (!back) throw new Error("The backup could not be read back from " + store.label);
    const check = verifyArchive(Buffer.from(back), { passphrase: options.passphrase });
    if (!check.ok) throw new Error(`Backup written but failed verification: ${check.error}`);
    await store.writeStatus({ ...status, lastSuccessAt: now.toISOString(), lastSuccessRevision: manifest.database.revision, lastSuccessName: name, credentials: manifest.credentials });
    if (options.keep) {
      const all = (await store.list()).map((l) => l.name).sort();
      for (const old of all.slice(0, Math.max(0, all.length - options.keep))) await store.remove(old);
    }
    return { name, manifest };
  } catch (err) {
    await store.writeStatus({ ...status, lastFailureAt: now.toISOString(), lastFailure: err instanceof Error ? err.message : String(err) }).catch(() => {
    });
    throw err;
  }
}
__name(runBackup, "runBackup");
function verifyArchive(buffer, options = {}) {
  let zip;
  try {
    zip = new import_adm_zip.default(buffer);
  } catch {
    return { ok: false, error: "Not a readable ZIP archive." };
  }
  const read = /* @__PURE__ */ __name((name) => zip.getEntry(name)?.getData() ?? null, "read");
  const manifestBuf = read("manifest.json");
  const dataBuf = read("data.json");
  if (!manifestBuf || !dataBuf) return { ok: false, error: "The archive is missing manifest.json or data.json." };
  let manifest;
  let data;
  try {
    manifest = JSON.parse(manifestBuf.toString("utf8"));
    data = JSON.parse(dataBuf.toString("utf8"));
  } catch {
    return { ok: false, error: "manifest.json or data.json is not valid JSON." };
  }
  if (data.format === LEGACY_FORMAT) {
    const { sha256: sum, ...content } = data;
    if (sha256(JSON.stringify(content)) !== sum) return { ok: false, error: "Checksum mismatch \u2014 the legacy archive was changed or is incomplete." };
    const state2 = data.state;
    const legacyManifest = {
      format: ARCHIVE_FORMAT,
      formatVersion: 0,
      appVersion: "legacy",
      schemaVersion: 1,
      exportedAt: String(data.createdAt ?? manifest.exportedAt ?? ""),
      database: { kind: "unknown", schema: "public", revision: Number(data.revision), updatedAt: String(data.updatedAt), updatedBy: String(data.updatedBy) },
      counts: summarise(state2, data.drafts ?? []),
      counters: state2.counters,
      files: {},
      credentials: "none-set",
      attachments: { count: 0, note: "" },
      notice: "Legacy archive: account password hashes are stored unencrypted inside it \u2014 keep it private."
    };
    const { publicState: publicState2, credentials: credentials2 } = splitCredentials(state2);
    return {
      ok: true,
      content: { manifest: legacyManifest, state: publicState2, drafts: data.drafts ?? [], credentials: credentials2, credentialsFile: null, legacy: true },
      warnings: ["Legacy archive format (before v1). It contains unencrypted password hashes."]
    };
  }
  if (manifest.format !== ARCHIVE_FORMAT) return { ok: false, error: "Not a Vertex ERP backup archive." };
  if (!(manifest.formatVersion >= 1 && manifest.formatVersion <= ARCHIVE_FORMAT_VERSION))
    return { ok: false, error: `Unsupported archive format version ${manifest.formatVersion}. This server reads version ${ARCHIVE_FORMAT_VERSION}.` };
  if (manifest.schemaVersion > SCHEMA_VERSION)
    return { ok: false, error: `The archive needs schema version ${manifest.schemaVersion}; this server only knows up to ${SCHEMA_VERSION}. Upgrade the server first.` };
  for (const [name, expected] of Object.entries(manifest.files ?? {})) {
    const buf = read(name);
    if (!buf) return { ok: false, error: `The archive is missing ${name}.` };
    if (sha256(buf) !== expected) return { ok: false, error: `Checksum mismatch in ${name} \u2014 the archive was changed or is incomplete.` };
  }
  if (!manifest.files?.["data.json"]) return { ok: false, error: "The manifest does not list data.json." };
  const state = data.state;
  const drafts = data.drafts ?? [];
  if (!state || !Array.isArray(state.users)) return { ok: false, error: "data.json has no dataset." };
  const counts = summarise(state, drafts);
  for (const [k, v] of Object.entries(manifest.counts)) {
    if (k === "usersWithPassword") continue;
    if (counts[k] !== v) return { ok: false, error: `Record count mismatch for ${k}: manifest ${v}, data ${counts[k]}.` };
  }
  if (state.users.some((u) => u.passwordHash || u.passwordSalt)) return { ok: false, error: "data.json unexpectedly contains credentials." };
  const warnings = [];
  let credentials = null;
  const encBuf = read("credentials.enc.json");
  const credentialsFile = encBuf ? JSON.parse(encBuf.toString("utf8")) : null;
  if (credentialsFile) {
    if (options.passphrase) {
      try {
        credentials = decryptCredentials(credentialsFile, options.passphrase);
      } catch {
        return { ok: false, error: "The backup passphrase does not open credentials.enc.json." };
      }
    } else warnings.push("Account passwords are encrypted; provide the backup passphrase to restore them.");
  } else if (manifest.credentials === "omitted") {
    warnings.push("This archive has no account passwords (no passphrase was configured). Accounts would choose new passwords after a restore.");
  }
  return { ok: true, content: { manifest, state, drafts, credentials, credentialsFile }, warnings };
}
__name(verifyArchive, "verifyArchive");
async function previewRestore(target, content, options = {}) {
  const existing = await readState(target);
  const blockers = [];
  const warnings = [];
  if (existing && !options.replace) blockers.push("The destination already holds data. Restore into an empty database, or use --replace (a pre-restore archive is written first).");
  const needsCredentials = content.manifest.credentials !== "none-set" || content.credentials && Object.keys(content.credentials).length > 0;
  if (needsCredentials && !content.credentials && !options.withoutCredentials)
    blockers.push("Account passwords are not available (missing or wrong passphrase). Provide the passphrase, or use --without-credentials so accounts choose new passwords.");
  if (needsCredentials && !content.credentials && options.withoutCredentials) warnings.push("Accounts will have no passwords after the restore; each chooses one at first sign-in.");
  return {
    destination: { kind: target.kind, schema: target.schema, empty: !existing, revision: existing?.revision ?? null, counts: existing ? summarise(existing.data) : null },
    archive: {
      exportedAt: content.manifest.exportedAt,
      revision: content.manifest.database.revision,
      counts: content.manifest.counts,
      credentials: content.credentials ? "available" : content.manifest.credentials,
      notice: content.manifest.notice
    },
    warnings,
    blockers
  };
}
__name(previewRestore, "previewRestore");

// server/api.ts
var SESSION_COOKIE = "vx_session";
var MAX_BODY = 8 * 1024 * 1024;
var MAX_ARCHIVE = 64 * 1024 * 1024;
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  status;
  constructor(status, message2) {
    super(message2);
    this.status = status;
  }
};
function cookie(req, name) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return void 0;
}
__name(cookie, "cookie");
async function bytes(req, limit) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > limit) throw new HttpError(413, "Request too large.");
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > limit) throw new HttpError(413, "Request too large.");
  return buf;
}
__name(bytes, "bytes");
async function body(req) {
  const text = new TextDecoder().decode(await bytes(req, MAX_BODY));
  if (!text) return {};
  try {
    return fromWire(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}
__name(body, "body");
function createApiHandler(service, options = {}) {
  const allowed = new Set(options.allowedOrigins ?? []);
  const json = /* @__PURE__ */ __name((status, payload, headers = {}) => new Response(toWire(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } }), "json");
  const sessionCookie = /* @__PURE__ */ __name((token) => `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ""}; Path=/; HttpOnly; SameSite=Strict${options.secureCookies ? "; Secure" : ""}; Max-Age=${token ? SESSION_HOURS * 3600 : 0}`, "sessionCookie");
  async function route(req, path) {
    const method = req.method;
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET,POST,PUT,DELETE", "access-control-allow-headers": "content-type,x-vertex-request" } });
    if (method !== "GET" && req.headers.get("x-vertex-request") !== "1") throw new HttpError(403, "Missing request header.");
    const token = cookie(req, SESSION_COOKIE);
    if (path === "/api/health" && method === "GET") {
      const s = await service.state();
      return json(200, { ok: true, database: service.db.kind, schema: service.db.schema, revision: s.revision, deployment: options.deployment ?? null });
    }
    if (path === "/api/accounts" && method === "GET") {
      const s = await service.state();
      return json(200, { accounts: publicAccounts(s.db), company: s.db.company.name });
    }
    if (path === "/api/auth/login" && method === "POST") {
      const b = await body(req);
      const r = await service.login(String(b.userId ?? ""), String(b.password ?? ""));
      if (!r.ok) return json(r.status, r);
      return json(200, { ok: true, user: r.user }, { "set-cookie": sessionCookie(r.token) });
    }
    if (path === "/api/auth/first-password" && method === "POST") {
      const b = await body(req);
      const r = await service.createFirstPassword(String(b.userId ?? ""), String(b.password ?? ""), String(b.confirm ?? ""));
      if (!r.ok) return json(r.status, r);
      return json(200, { ok: true, user: r.user }, { "set-cookie": sessionCookie(r.token) });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      await service.logout(token);
      return json(200, { ok: true }, { "set-cookie": sessionCookie(null) });
    }
    const user = await service.sessionUser(token);
    if (path === "/api/session" && method === "GET") return json(200, user ? { ok: true, userId: user.id } : { ok: false, error: "Not signed in." });
    if (!user) return json(401, { ok: false, error: "Your session has ended. Sign in again." });
    if (path === "/api/auth/change-password" && method === "POST") {
      const b = await body(req);
      const r = await service.changePassword(user.id, String(b.current ?? ""), String(b.next ?? ""), String(b.confirm ?? ""));
      return r.ok ? json(200, r, { "set-cookie": sessionCookie(null) }) : json(r.status, r);
    }
    if (path === "/api/state" && method === "GET") {
      const s = await service.state();
      const since = Number(new URL(req.url).searchParams.get("since"));
      if (Number.isFinite(since) && since === s.revision) return json(200, { ok: true, revision: s.revision, unchanged: true });
      return json(200, { ok: true, revision: s.revision, db: publicState(s.db) });
    }
    if (path === "/api/commands" && method === "POST") {
      const b = await body(req);
      const r = await service.command(token, String(b.name ?? ""), b.args ?? []);
      return json(r.ok ? 200 : r.status, r);
    }
    if (path === "/api/export" && method === "GET") {
      if (!can(user, "administration")) return json(403, { ok: false, error: "Only Administrator 1 can export the dataset." });
      const s = await service.state();
      return json(200, { ok: true, revision: s.revision, db: publicState(s.db) });
    }
    if (path.startsWith("/api/backup/")) {
      if (!can(user, "administration")) return json(403, { ok: false, error: "Only Administrator 1 can manage backups." });
      const cfg = options.backup;
      if (path === "/api/backup/status" && method === "GET") {
        const s = await service.state();
        if (!cfg) return json(200, { ok: true, configured: false, currentRevision: s.revision, backups: [], status: null });
        return json(200, {
          ok: true,
          configured: true,
          location: cfg.store.label,
          schedule: cfg.schedule,
          keep: cfg.keep,
          passphraseConfigured: !!cfg.passphrase,
          currentRevision: s.revision,
          status: await cfg.store.readStatus(),
          backups: await cfg.store.list()
        });
      }
      if (path === "/api/backup/fresh" && method === "GET") {
        const { buffer, manifest } = await buildArchive(service.db, { passphrase: cfg?.passphrase, appVersion: cfg?.appVersion });
        return new Response(buffer, {
          status: 200,
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${archiveName(new Date(manifest.exportedAt))}"`,
            "cache-control": "no-store",
            "x-vertex-revision": String(manifest.database.revision),
            "x-vertex-credentials": manifest.credentials
          }
        });
      }
      if (!cfg) return json(409, { ok: false, error: "Stored backups are not configured for this deployment." });
      if (path === "/api/backup/run" && method === "POST") {
        try {
          const { name, manifest } = await runBackup(service.db, cfg.store, { passphrase: cfg.passphrase, appVersion: cfg.appVersion, keep: cfg.keep });
          return json(200, { ok: true, name, exportedAt: manifest.exportedAt, revision: manifest.database.revision, credentials: manifest.credentials, counts: manifest.counts });
        } catch (e) {
          return json(500, { ok: false, error: `Backup failed: ${e.message}` });
        }
      }
      const file = /^\/api\/backup\/file\/([^/]+)$/.exec(path);
      if (file && method === "GET") {
        const name = decodeURIComponent(file[1]);
        if (!ARCHIVE_NAME.test(name)) return json(400, { ok: false, error: "Invalid backup name." });
        const data = await cfg.store.get(name);
        if (!data) return json(404, { ok: false, error: "Backup not found." });
        return new Response(data, {
          status: 200,
          headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" }
        });
      }
      if (path === "/api/backup/validate" && method === "POST") {
        const check = verifyArchive(Buffer.from(await bytes(req, MAX_ARCHIVE)), { passphrase: cfg.passphrase });
        if (!check.ok) return json(200, { ok: true, valid: false, error: check.error });
        const preview = await previewRestore(service.db, check.content);
        return json(200, {
          ok: true,
          valid: true,
          manifest: {
            exportedAt: check.content.manifest.exportedAt,
            revision: check.content.manifest.database.revision,
            schemaVersion: check.content.manifest.schemaVersion,
            notice: check.content.manifest.notice,
            legacy: !!check.content.legacy
          },
          warnings: check.warnings,
          preview
        });
      }
    }
    const draft = /^\/api\/drafts\/(.+)$/.exec(path);
    if (draft) {
      const key = decodeURIComponent(draft[1]);
      if (method === "GET") {
        const d = await service.getDraft(user.id, key);
        return json(200, d ? { ok: true, ...d } : { ok: false, missing: true, error: "No draft." });
      }
      if (method === "PUT") {
        const b = await body(req);
        const r = await service.putDraft(user.id, key, Number(b.knownRev ?? 0), toWire(b.data ?? null));
        return json(r.ok ? 200 : 409, r);
      }
      if (method === "DELETE") {
        await service.deleteDraft(user.id, key);
        return json(200, { ok: true });
      }
    }
    throw new HttpError(404, "Not found.");
  }
  __name(route, "route");
  return /* @__PURE__ */ __name(async function handle(req) {
    const path = new URL(req.url).pathname;
    let res;
    try {
      res = await route(req, path);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      res = json(status, { ok: false, error: status === 500 ? "The server could not complete the request. Nothing was saved." : err.message });
    }
    const origin = req.headers.get("origin");
    if (origin && allowed.has(origin)) {
      res.headers.set("access-control-allow-origin", origin);
      res.headers.set("access-control-allow-credentials", "true");
      res.headers.set("vary", "origin");
    }
    return res;
  }, "handle");
}
__name(createApiHandler, "createApiHandler");

// server/worker.ts
var PREFIX = "archives/";
var STATUS_KEY = "backup-status.json";
var SCHEDULE = "hourly (Cloudflare Cron Trigger)";
function r2Store(bucket) {
  return {
    label: "Cloudflare R2 bucket vertex-erp-backups",
    async put(name, data, meta) {
      if (!ARCHIVE_NAME.test(name)) throw new Error("Invalid backup name.");
      await bucket.put(PREFIX + name, data, { customMetadata: { exportedAt: meta.exportedAt, revision: String(meta.revision) }, httpMetadata: { contentType: "application/zip" } });
    },
    async get(name) {
      const obj = await bucket.get(PREFIX + name);
      return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
    },
    async list() {
      const { objects } = await bucket.list({ prefix: PREFIX, include: ["customMetadata"], limit: 1e3 });
      return objects.map((o) => ({
        name: o.key.slice(PREFIX.length),
        size: o.size,
        exportedAt: o.customMetadata?.exportedAt ?? null,
        revision: o.customMetadata?.revision ? Number(o.customMetadata.revision) : null
      })).filter((o) => ARCHIVE_NAME.test(o.name)).sort((a, b) => b.name.localeCompare(a.name));
    },
    async remove(name) {
      await bucket.delete(PREFIX + name);
    },
    async readStatus() {
      const obj = await bucket.get(STATUS_KEY);
      return obj ? { ...EMPTY_STATUS, ...JSON.parse(await obj.text()) } : { ...EMPTY_STATUS };
    },
    async writeStatus(status) {
      await bucket.put(STATUS_KEY, JSON.stringify(status, null, 1), { httpMetadata: { contentType: "application/json" } });
    }
  };
}
__name(r2Store, "r2Store");
async function openDb(env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured for this Worker.");
  return openPostgres(env.DATABASE_URL, { schema: env.DATABASE_SCHEMA || void 0, migrate: false, max: 1 });
}
__name(openDb, "openDb");
var unavailable = /* @__PURE__ */ __name((message2) => new Response(JSON.stringify({ ok: false, error: message2 }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } }), "unavailable");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    let db;
    try {
      db = await openDb(env);
    } catch (err) {
      console.error("database unavailable", err);
      return unavailable("The database is not reachable right now. Nothing was saved.");
    }
    try {
      const service = new VertexService(db);
      const api = createApiHandler(service, {
        secureCookies: url.protocol === "https:",
        deployment: "Cloudflare Worker",
        backup: env.BACKUPS ? { store: r2Store(env.BACKUPS), passphrase: env.VERTEX_BACKUP_PASSPHRASE || void 0, appVersion: env.APP_VERSION, keep: Number(env.BACKUP_KEEP ?? 168), schedule: SCHEDULE } : void 0
      });
      return await api(request);
    } finally {
      ctx.waitUntil(db.close());
    }
  },
  async scheduled(_event, env, ctx) {
    const db = await openDb(env);
    const job = (async () => {
      try {
        await new VertexService(db).sweep();
        if (env.BACKUPS) {
          const { name, manifest } = await runBackup(db, r2Store(env.BACKUPS), {
            passphrase: env.VERTEX_BACKUP_PASSPHRASE || void 0,
            appVersion: env.APP_VERSION,
            keep: Number(env.BACKUP_KEEP ?? 168)
          });
          console.log(`backup ${name} revision ${manifest.database.revision}`);
        }
      } catch (err) {
        console.error("scheduled job failed", err);
      } finally {
        await db.close();
      }
    })();
    ctx.waitUntil(job);
    await job;
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body2 = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body2);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body2, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-hMKi1M/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-hMKi1M/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
