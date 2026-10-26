/** Author: BinaryBeast1209 */
export const EYE_SAMPLE_SCRIPT = `
function sampleBoth(img, positions) {
  if (!positions || positions.length < 48) {
    throw new Error('Could not find both eyes in that photo.');
  }
  var left = sampleEye(img, positions.slice(36, 42));
  var right = sampleEye(img, positions.slice(42, 48));

  // Generate full annotated image with Green Circles on irises and Orange Boxes on red reflexes
  var annotCanvas = document.createElement('canvas');
  var w = img.naturalWidth || img.width || 800;
  var h = img.naturalHeight || img.height || 600;
  var maxDim = 1200;
  var scale = 1;
  if (w > maxDim || h > maxDim) {
    scale = maxDim / Math.max(w, h);
    annotCanvas.width = Math.round(w * scale);
    annotCanvas.height = Math.round(h * scale);
  } else {
    annotCanvas.width = w;
    annotCanvas.height = h;
  }
  var actx = annotCanvas.getContext('2d');
  actx.drawImage(img, 0, 0, annotCanvas.width, annotCanvas.height);
  var strokeW = Math.max(2, Math.round(annotCanvas.width / 320));

  function drawEye(eye) {
    if (!eye || !eye.iris) return;
    // 1. Green circle on iris
    actx.strokeStyle = '#00E000';
    actx.lineWidth = strokeW;
    actx.beginPath();
    actx.arc(eye.iris.cx * scale, eye.iris.cy * scale, eye.iris.r * scale, 0, Math.PI * 2);
    actx.stroke();

    // 2. Orange box on measured red reflex
    if (eye.bounds && eye.bounds.found) {
      actx.strokeStyle = '#FFA500';
      actx.lineWidth = strokeW;
      actx.strokeRect(eye.bounds.x * scale, eye.bounds.y * scale, eye.bounds.w * scale, eye.bounds.h * scale);
    }
  }

  drawEye(left);
  drawEye(right);

  var annotatedUrl = annotCanvas.toDataURL('image/jpeg', 0.85);

  return {
    left: left,
    right: right,
    annotatedUrl: annotatedUrl
  };
}
function emptyEye(spanPx, meanLuma) {
  return {
    crescent: 0,
    vertical: 0,
    reflex: 0,
    meanLuma: meanLuma,
    brightOffsetX: 0,
    brightOffsetY: 0,
    offsetXPx: 0,
    offsetYPx: 0,
    spanPx: spanPx,
    cropUrl: undefined
  };
}
function reflexBounds(img, sx, sy, sw, sh) {
  var limit = 180;
  var pxW = Math.max(12, Math.round(sw));
  var pxH = Math.max(12, Math.round(sh));
  if (pxW > limit || pxH > limit) {
    var fit = limit / Math.max(pxW, pxH);
    pxW = Math.max(12, Math.round(pxW * fit));
    pxH = Math.max(12, Math.round(pxH * fit));
  }
  var canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, pxW, pxH);
  var data = ctx.getImageData(0, 0, pxW, pxH).data;
  var luma = 0;
  var xs = [];
  var ys = [];
  for (var py = 0; py < pxH; py++) {
    for (var px = 0; px < pxW; px++) {
      var p = (py * pxW + px) * 4;
      var r = data[p];
      var g = data[p + 1];
      var b = data[p + 2];
      var yv = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      luma += yv;
      var white = yv > 0.82 && r > 180 && g > 180 && b > 180;
      if (white) continue;
      if (!(r > 40 && r > g * 1.15 && r > b * 1.15)) continue;
      xs.push(px);
      ys.push(py);
    }
  }
  var meanLuma = luma / (pxW * pxH);
  if (xs.length < 20) return { found: false, meanLuma: meanLuma };
  xs.sort(function (a, b) { return a - b; });
  ys.sort(function (a, b) { return a - b; });
  function pct(arr, fraction) {
    return arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * fraction)))];
  }
  var x0 = pct(xs, 0.02);
  var x1 = pct(xs, 0.98);
  var y0 = pct(ys, 0.02);
  var y1 = pct(ys, 0.98);
  var imgX = sx + (x0 / pxW) * sw;
  var imgY = sy + (y0 / pxH) * sh;
  var imgW = ((x1 - x0 + 1) / pxW) * sw;
  var imgH = ((y1 - y0 + 1) / pxH) * sh;
  var width = img.naturalWidth || img.width || 0;
  var height = img.naturalHeight || img.height || 0;
  if (imgX < 0) imgX = 0;
  if (imgY < 0) imgY = 0;
  if (width && imgX + imgW > width) imgW = width - imgX;
  if (height && imgY + imgH > height) imgH = height - imgY;
  if (!(imgW >= 8) || !(imgH >= 8)) return { found: false, meanLuma: meanLuma };
  return { found: true, meanLuma: meanLuma, x: imgX, y: imgY, w: imgW, h: imgH };
}
function sampleEye(img, points) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  var sumX = 0, sumY = 0;
  for (var i = 0; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxX = Math.max(maxX, points[i].x);
    maxY = Math.max(maxY, points[i].y);
    sumX += points[i].x;
    sumY += points[i].y;
  }
  var cx = sumX / points.length;
  var cy = sumY / points.length;
  var eyeW = Math.max(12, maxX - minX);
  var irisR = eyeW * 0.38;
  var boxW = Math.max(8, maxX - minX);
  var boxH = Math.max(8, maxY - minY);
  var bounds = reflexBounds(img, minX, minY, boxW, boxH);
  if (!bounds.found) {
    var empty = emptyEye(0, bounds.meanLuma);
    empty.iris = { cx: cx, cy: cy, r: irisR };
    empty.bounds = bounds;
    return empty;
  }
  var sample = readRegion(img, bounds.x, bounds.y, bounds.w, bounds.h, bounds.w);
  sample.iris = { cx: cx, cy: cy, r: irisR };
  sample.bounds = bounds;
  return sample;
}
function readRegion(img, x, y, w, h, spanPx) {
  var canvas = document.createElement('canvas');
  var pxW = Math.max(12, Math.round(w));
  var pxH = Math.max(12, Math.round(h));
  canvas.width = pxW;
  canvas.height = pxH;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, pxW, pxH);
  var data = ctx.getImageData(0, 0, pxW, pxH).data;
  var midX = pxW / 2;
  var midY = pxH / 2;
  var leftR = 0, leftN = 0, rightR = 0, rightN = 0;
  var topR = 0, topN = 0, botR = 0, botN = 0;
  var luma = 0, red = 0, n = 0, seen = 0;
  var massX = 0, massY = 0;
  var best = -1, bestX = midX, bestY = midY, glint = false;
  for (var py = 0; py < pxH; py++) {
    for (var px = 0; px < pxW; px++) {
      var p = (py * pxW + px) * 4;
      var r = data[p];
      var g = data[p + 1];
      var b = data[p + 2];
      var yv = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      luma += yv;
      seen++;
      var white = yv > 0.82 && r > 180 && g > 180 && b > 180;
      if (white) {
        var bright = r + g + b;
        if (bright > best) { best = bright; bestX = px; bestY = py; glint = true; }
        continue;
      }
      if (!(r > 40 && r > g * 1.15 && r > b * 1.15)) continue;
      red += r / 255;
      n++;
      massX += px;
      massY += py;
      if (px < midX) { leftR += r; leftN++; } else { rightR += r; rightN++; }
      if (py < midY) { topR += r; topN++; } else { botR += r; botN++; }
    }
  }
  function mean(sum, count) { return count ? sum / count : 0; }
  var pupilX = n ? massX / n : midX;
  var pupilY = n ? massY / n : midY;
  if (!glint) { bestX = pupilX; bestY = pupilY; }
  var lr = mean(leftR, leftN);
  var rr = mean(rightR, rightN);
  var tr = mean(topR, topN);
  var br = mean(botR, botN);
  var enough = n >= 20;

  // Extract a square close-up crop of the pupil
  var cropCanvas = document.createElement('canvas');
  var cropDim = 120;
  cropCanvas.width = cropDim;
  cropCanvas.height = cropDim;
  var cctx = cropCanvas.getContext('2d');
  var pad = Math.max(4, Math.round(w * 0.35));
  cctx.drawImage(img, x - pad, y - pad, w + pad * 2, h + pad * 2, 0, 0, cropDim, cropDim);
  var cropUrl = cropCanvas.toDataURL('image/jpeg', 0.9);

  return {
    crescent: enough ? (rr - lr) / (rr + lr + 1) : 0,
    vertical: enough ? (br - tr) / (br + tr + 1) : 0,
    reflex: enough ? red / n : 0,
    meanLuma: seen ? luma / seen : 0,
    brightOffsetX: (bestX - pupilX) / (pxW / 2),
    brightOffsetY: (bestY - pupilY) / (pxH / 2),
    offsetXPx: bestX - pupilX,
    offsetYPx: bestY - pupilY,
    spanPx: spanPx,
    cropUrl: cropUrl
  };
}
function measureEyes(img, positions) {
  if (!positions || positions.length < 48) {
    throw new Error('Could not find both eyes. Keep them in the oval.');
  }
  function center(start) {
    var x = 0, y = 0;
    for (var i = 0; i < 6; i++) {
      x += positions[start + i].x;
      y += positions[start + i].y;
    }
    return { x: x / 6, y: y / 6 };
  }
  var left = center(36);
  var right = center(42);
  var dx = left.x - right.x;
  var dy = left.y - right.y;
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    separationPx: Math.sqrt(dx * dx + dy * dy)
  };
}
function frameLuma(img) {
  var canvas = document.createElement('canvas');
  var w = 48;
  var h = 48;
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  var data = ctx.getImageData(0, 0, w, h).data;
  var luma = 0;
  var n = w * h;
  for (var i = 0; i < n; i++) {
    var p = i * 4;
    luma += (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
  }
  return { meanLuma: luma / n };
}
`;
