import { create as createFontkit } from "../../node_modules/fontkit/dist/browser-module.mjs";

export {
  defaultLanguage,
  logErrors,
  registerFormat,
  setDefaultLanguage,
} from "../../node_modules/fontkit/dist/browser-module.mjs";

const ON_CURVE = 1 << 0;
const X_SHORT_VECTOR = 1 << 1;
const Y_SHORT_VECTOR = 1 << 2;
const REPEAT = 1 << 3;
const SAME_X = 1 << 4;
const SAME_Y = 1 << 5;

const PATCHED_FONT = Symbol.for("erp-v2.fontkit.patched-font");
const PATCHED_SUBSET = Symbol.for("erp-v2.fontkit.patched-subset");

function pointSize(value) {
  return value >= 0 && value <= 255 ? 1 : 2;
}

function writeInt16(view, offset, value) {
  view.setInt16(offset, value, false);
  return offset + 2;
}

function writeUInt16(view, offset, value) {
  view.setUint16(offset, value, false);
  return offset + 2;
}

function encodePoint(value, lastValue, points, flag, shortFlag, sameFlag) {
  let diff = value - lastValue;

  if (value === lastValue) {
    return flag | sameFlag;
  }

  if (-255 <= diff && diff <= 255) {
    flag |= shortFlag;

    if (diff < 0) {
      diff = -diff;
    } else {
      flag |= sameFlag;
    }
  }

  points.push(diff);
  return flag;
}

function encodeSimpleGlyph(path, instructions = []) {
  const endPtsOfContours = [];
  const xPoints = [];
  const yPoints = [];
  const flags = [];
  let same = 0;
  let lastX = 0;
  let lastY = 0;
  let lastFlag = 0;
  let pointCount = 0;

  for (let i = 0; i < path.commands.length; i += 1) {
    const command = path.commands[i];

    for (let j = 0; j < command.args.length; j += 2) {
      const x = Math.round(command.args[j]);
      const y = Math.round(command.args[j + 1]);
      let flag = 0;

      if (command.command === "quadraticCurveTo" && j === 2) {
        const next = path.commands[i + 1];

        if (next?.command === "quadraticCurveTo") {
          const midX = (lastX + Math.round(next.args[0])) / 2;
          const midY = (lastY + Math.round(next.args[1])) / 2;

          if (x === midX && y === midY) {
            continue;
          }
        }
      }

      if (!(command.command === "quadraticCurveTo" && j === 0)) {
        flag |= ON_CURVE;
      }

      flag = encodePoint(x, lastX, xPoints, flag, X_SHORT_VECTOR, SAME_X);
      flag = encodePoint(y, lastY, yPoints, flag, Y_SHORT_VECTOR, SAME_Y);

      if (flag === lastFlag && same < 255) {
        flags[flags.length - 1] |= REPEAT;
        same += 1;
      } else {
        if (same > 0) {
          flags.push(same);
          same = 0;
        }

        flags.push(flag);
        lastFlag = flag;
      }

      lastX = x;
      lastY = y;
      pointCount += 1;
    }

    if (command.command === "closePath") {
      endPtsOfContours.push(pointCount - 1);
    }
  }

  if (same > 0) {
    flags.push(same);
  }

  if (
    path.commands.length > 1
    && path.commands[path.commands.length - 1].command !== "closePath"
  ) {
    endPtsOfContours.push(pointCount - 1);
  }

  const bbox = path.bbox ?? {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  };
  const instructionBytes = Uint8Array.from(instructions);
  const size =
    10
    + (endPtsOfContours.length * 2)
    + 2
    + instructionBytes.length
    + flags.length
    + xPoints.reduce((sum, value) => sum + pointSize(value), 0)
    + yPoints.reduce((sum, value) => sum + pointSize(value), 0);
  const padding = size % 4 === 0 ? 0 : 4 - (size % 4);
  const buffer = new Uint8Array(size + padding);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  offset = writeInt16(view, offset, endPtsOfContours.length);
  offset = writeInt16(view, offset, Math.floor(bbox.minX));
  offset = writeInt16(view, offset, Math.floor(bbox.minY));
  offset = writeInt16(view, offset, Math.ceil(bbox.maxX));
  offset = writeInt16(view, offset, Math.ceil(bbox.maxY));

  for (const value of endPtsOfContours) {
    offset = writeUInt16(view, offset, value);
  }

  offset = writeUInt16(view, offset, instructionBytes.length);
  buffer.set(instructionBytes, offset);
  offset += instructionBytes.length;

  for (const value of flags) {
    buffer[offset] = value;
    offset += 1;
  }

  for (const value of xPoints) {
    if (value >= 0 && value <= 255) {
      buffer[offset] = value;
      offset += 1;
    } else {
      offset = writeInt16(view, offset, value);
    }
  }

  for (const value of yPoints) {
    if (value >= 0 && value <= 255) {
      buffer[offset] = value;
      offset += 1;
    } else {
      offset = writeInt16(view, offset, value);
    }
  }

  return buffer;
}

function isTransformedWoff2Font(font) {
  return font?.type === "WOFF2" && font?.directory?.tables?.glyf?.transformed;
}

function pushSubsetGlyph(subset, glyph, buffer) {
  subset.glyf.push(buffer);
  subset.loca.offsets.push(subset.offset);
  subset.hmtx.metrics.push({
    advance: glyph.advanceWidth,
    bearing: glyph._getMetrics().leftBearing,
  });
  subset.offset += buffer.length;
  return subset.glyf.length - 1;
}

function patchSubset(subset) {
  if (!subset || subset[PATCHED_SUBSET] || !isTransformedWoff2Font(subset.font)) {
    return subset;
  }

  Object.defineProperty(subset, PATCHED_SUBSET, {
    value: true,
  });

  const originalAddGlyph = subset._addGlyph.bind(subset);

  subset._addGlyph = function patchedAddGlyph(gid) {
    const glyph = this.font.getGlyph(gid);
    const glyf = glyph?._decode?.();

    // fontkit's WOFF2 subsetter rewrites composite component offsets against
    // transformed glyph buffers, which crashes on Cairo Arabic glyphs. Flatten
    // those composites into simple outlines before embedding them.
    if (glyf && glyf.numberOfContours < 0) {
      return pushSubsetGlyph(
        this,
        glyph,
        encodeSimpleGlyph(glyph.path, glyf.instructions ?? [])
      );
    }

    return originalAddGlyph(gid);
  };

  return subset;
}

function patchFont(font) {
  if (!font || font[PATCHED_FONT] || typeof font.createSubset !== "function") {
    return font;
  }

  Object.defineProperty(font, PATCHED_FONT, {
    value: true,
  });

  const originalCreateSubset = font.createSubset.bind(font);

  font.createSubset = (...args) => patchSubset(originalCreateSubset(...args));

  return font;
}

export function create(buffer, postscriptName) {
  return patchFont(createFontkit(buffer, postscriptName));
}
