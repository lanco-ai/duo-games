/** Parse only headers: no native image decoder or untrusted SVG on the server. */
export function imageInfo(b: Buffer) {
  let mime = "",
    width = 0,
    height = 0;
  if (
    b.length >= 24 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    b.toString("ascii", 12, 16) === "IHDR"
  ) {
    mime = "image/png";
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
  } else if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
    mime = "image/jpeg";
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 255) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 216 || marker === 217) {
        i += 2;
        continue;
      }
      const length = b.readUInt16BE(i + 2);
      if (length < 2 || i + 2 + length > b.length) break;
      if ([192, 193, 194].includes(marker)) {
        height = b.readUInt16BE(i + 5);
        width = b.readUInt16BE(i + 7);
        break;
      }
      i += length + 2;
    }
  } else if (
    b.length >= 30 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    mime = "image/webp";
    const format = b.toString("ascii", 12, 16);
    if (format === "VP8X") {
      width = 1 + b.readUIntLE(24, 3);
      height = 1 + b.readUIntLE(27, 3);
    } else if (
      format === "VP8 " &&
      b[23] === 157 &&
      b[24] === 1 &&
      b[25] === 42
    ) {
      width = b.readUInt16LE(26) & 16383;
      height = b.readUInt16LE(28) & 16383;
    } else if (format === "VP8L" && b[20] === 47) {
      const bits = b.readUInt32LE(21);
      width = (bits & 16383) + 1;
      height = ((bits >>> 14) & 16383) + 1;
    }
  }
  if (
    !mime ||
    width < 1 ||
    height < 1 ||
    width > 1600 ||
    height > 1600 ||
    width / height < 0.25 ||
    width / height > 4
  )
    throw new Error("INVALID");
  return { mime, ratio: width / height };
}
