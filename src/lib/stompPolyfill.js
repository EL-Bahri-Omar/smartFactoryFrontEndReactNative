// src/lib/stompPolyfill.js
//
// React Native / Hermes does NOT define TextEncoder / TextDecoder (they are
// web-only globals), but @stomp/stompjs uses them on the hot path:
//   - Frame.marshall()      -> new TextEncoder().encode(cmdAndHeaders)
//   - Frame byteLength      -> new TextEncoder().encode(s).length
//   - Parser                -> new TextDecoder()
// So on a device the STOMP client throws "TextEncoder is not defined" the very
// moment it sends the CONNECT frame. The socket never reaches CONNECTED, the
// retry loop spins every 5s, and the UI stays stuck on "reconnecting…" while
// the sensor values never move. On web the browser provides them, which is why
// only mobile was broken.
//
// Import this module FIRST (see liveService.js) so the globals exist before
// @stomp/stompjs runs. Existing native/browser implementations are never
// overwritten.

const g = typeof globalThis !== "undefined" ? globalThis : global;

class TextEncoderPolyfill {
  constructor() {
    this.encoding = "utf-8";
  }

  /** @param {string} [input] @returns {Uint8Array} */
  encode(input) {
    const s = input == null ? "" : String(input);
    const out = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);

      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff) {
        // High surrogate — needs its low-surrogate partner.
        const c2 = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          out.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f)
          );
          i += 1;
        } else {
          out.push(0xef, 0xbf, 0xbd); // lone surrogate -> U+FFFD
        }
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        out.push(0xef, 0xbf, 0xbd); // stray low surrogate -> U+FFFD
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return Uint8Array.from(out);
  }
}

class TextDecoderPolyfill {
  constructor(encoding) {
    this.encoding = String(encoding || "utf-8").toLowerCase();
  }

  /** @param {ArrayBuffer|Uint8Array|string} [input] @returns {string} */
  decode(input) {
    if (input == null) return "";
    if (typeof input === "string") return input;

    let bytes;
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(input)) {
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else {
      bytes = Uint8Array.from(input);
    }

    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b1 = bytes[i++];
      if (b1 < 0x80) {
        out += String.fromCharCode(b1);
        continue;
      }
      let cp;
      if (b1 < 0xe0) {
        cp = ((b1 & 0x1f) << 6) | (bytes[i++] & 0x3f);
      } else if (b1 < 0xf0) {
        cp = ((b1 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      } else {
        cp =
          ((b1 & 0x07) << 18) |
          ((bytes[i++] & 0x3f) << 12) |
          ((bytes[i++] & 0x3f) << 6) |
          (bytes[i++] & 0x3f);
      }
      if (cp > 0xffff) {
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      } else {
        out += String.fromCharCode(cp);
      }
    }
    return out;
  }
}

if (typeof g.TextEncoder === "undefined") g.TextEncoder = TextEncoderPolyfill;
if (typeof g.TextDecoder === "undefined") g.TextDecoder = TextDecoderPolyfill;

export default true;
