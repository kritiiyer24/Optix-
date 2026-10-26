/** Author: BinaryBeast1209 */
import { EYE_SAMPLE_SCRIPT } from '../scan/eyeSampleScript';

export const FACE_BRIDGE_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"></script>
    <script>
      const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";
      var msgQueue = [];
      function send(payload) {
        msgQueue.push(payload);
        drainQueue();
      }
      function drainQueue() {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          while (msgQueue.length > 0) {
            var item = msgQueue.shift();
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify(item));
            } catch (e) {}
          }
        } else {
          setTimeout(drainQueue, 50);
        }
      }
      window.onerror = function (message, source, line) {
        send({ type: "log", level: "error", message: String(message) + " @" + line });
      };
      async function boot(retryCount) {
        retryCount = retryCount || 0;
        send({ type: "status", message: "Connecting to neural face library..." });
        if (typeof faceapi === "undefined" || !faceapi.nets) {
          if (retryCount < 25) {
            setTimeout(function () { boot(retryCount + 1); }, 200);
            return;
          }
          send({ type: "error", message: "Face detection library failed to load from CDN." });
          return;
        }
        send({ type: "status", message: "Loading face recognition models..." });
        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
          ]);
          send({ type: "ready" });
        } catch (err) {
          send({ type: "error", message: err && err.message ? err.message : "Failed to load face models." });
        }
      }
      boot();
      ${EYE_SAMPLE_SCRIPT}
      window.__luma = async function (dataUrl) {
        try {
          var img = new Image();
          img.src = dataUrl;
          await img.decode();
          send({ type: "luma", meanLuma: frameLuma(img).meanLuma });
        } catch (error) {
          send({ type: "fail", message: error && error.message ? error.message : "Could not read the room light." });
        }
      };
      window.__span = async function (dataUrl) {
        try {
          var img = new Image();
          img.src = dataUrl;
          await img.decode();
          var result = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
            .withFaceLandmarks();
          if (!result) {
            send({ type: "fail", message: "Could not find both eyes. Keep them in the oval." });
            return;
          }
          var gaze = measureEyes(img, result.landmarks.positions);
          send({ type: "span", width: gaze.width, height: gaze.height, separationPx: gaze.separationPx });
        } catch (error) {
          send({ type: "fail", message: error && error.message ? error.message : "Could not measure distance." });
        }
      };
      window.__screen = async function (dataUrl) {
        try {
          var img = new Image();
          img.src = dataUrl;
          await img.decode();
          var result = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
            .withFaceLandmarks();
          if (!result || !result.landmarks || !result.landmarks.positions || result.landmarks.positions.length < 68) {
            send({ type: "fail", message: "Only human portrait photos are accepted. No human face was detected with visible eyes." });
            return;
          }
          var pos = result.landmarks.positions;
          var leftEyeCenter = { x: (pos[36].x + pos[39].x) / 2, y: (pos[36].y + pos[39].y) / 2 };
          var rightEyeCenter = { x: (pos[42].x + pos[45].x) / 2, y: (pos[42].y + pos[45].y) / 2 };
          var eyeDistance = Math.hypot(rightEyeCenter.x - leftEyeCenter.x, rightEyeCenter.y - leftEyeCenter.y);
          if (eyeDistance < 10) {
            send({ type: "fail", message: "Face or eyes are too small or distant in this photo. Please upload a closer portrait." });
            return;
          }
          var samples = sampleBoth(img, result.landmarks.positions);
          send({ type: "screen", left: samples.left, right: samples.right, annotatedUrl: samples.annotatedUrl });
        } catch (error) {
          send({ type: "fail", message: error && error.message ? error.message : "Only human photos are accepted. Could not detect a human face." });
        }
      };
      window.__embed = async function (dataUrl) {
        try {
          var img = new Image();
          img.src = dataUrl;
          await img.decode();
          var result = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (!result) {
            send({ type: "fail", message: "No human face found. Face the camera, use good light, and try again." });
            return;
          }
          send({ type: "ok", embedding: Array.from(result.descriptor) });
        } catch (error) {
          send({ type: "fail", message: error && error.message ? error.message : "Could not read that face." });
        }
      };
    </script>
  </body>
</html>`;
