import * as faceapi from 'face-api.js';
import * as ort from 'onnxruntime-web';
export { faceapi };

let sfaceSession: ort.InferenceSession | null = null;

export interface LivenessStatus {
  isLive: boolean;
  score: number;
  message: string;
}

export type LivenessChallenge = 'blink' | 'smile' | 'turn_left' | 'turn_right' | 'nod' | 'neutral';

export const loadModels = async () => {
  const MODEL_URL = '/models';
  try {
    const loadFaceApi = async () => {
        // Try local first, then GitHub CDN as fallback
        const sources = [
            MODEL_URL,
            'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/'
        ];
        
        for (const source of sources) {
            try {
                console.log(`FaceRecognition: Loading face-api models from ${source}...`);
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(source),
                    faceapi.nets.tinyFaceDetector.loadFromUri(source),
                    faceapi.nets.faceLandmark68Net.loadFromUri(source),
                    faceapi.nets.faceRecognitionNet.loadFromUri(source)
                ]);
                console.log(`FaceRecognition: Face-api models loaded from ${source}`);
                return;
            } catch (e) {
                console.warn(`FaceRecognition: Failed to load from ${source}, trying next...`, e);
            }
        }
        throw new Error("FaceRecognition: All face-api model sources failed.");
    };
    await loadFaceApi();

    // 2. Load SFace ONNX model
    if (!sfaceSession) {
        console.log("FaceRecognition: Loading SFace ONNX model...");
        try {
            sfaceSession = await ort.InferenceSession.create('/models/face_recognition_sface.onnx', {
                executionProviders: ['webgl'],
                graphOptimizationLevel: 'all'
            });
            console.log("FaceRecognition: SFace ONNX model loaded successfully.");
        } catch (e) {
            console.error("FaceRecognition: Failed to load SFace ONNX model. Falling back to CPU.", e);
            sfaceSession = await ort.InferenceSession.create('/models/face_recognition_sface.onnx', {
                executionProviders: ['wasm']
            });
        }
    }
  } catch (error) {
    console.error("FaceRecognition: Critical error in loadModels:", error);
  }
};

/**
 * Preprocesses the image for MobileFaceNet (112x112)
 * Includes face alignment based on eye coordinates
 */
// Preprocessing is now handled internally by face-api.js computeFaceDescriptor

export const getFaceDescriptor = async (videoElement: HTMLVideoElement): Promise<Float32Array | null> => {

  // Ensure video is ready and has dimensions
  if (videoElement.paused || videoElement.ended || videoElement.videoWidth === 0) {
    console.warn("Video element not ready for face detection");
    return null;
  }

  // Tiered Detection Strategy for reliability
  let result = null;
  
  // 1. High Sensitivity Tiny pass (fastest)
  const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.1 });
  result = await faceapi.detectSingleFace(videoElement, tinyOptions).withFaceLandmarks();
  
  // 2. Medium Sensitivity SSD pass (most robust)
  if (!result) {
    result = await faceapi
      .detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
      .withFaceLandmarks();
  }
  
  // 3. High Resolution Tiny pass (for distant faces)
  if (!result) {
    const tinyOptionsLarge = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.1 });
    result = await faceapi.detectSingleFace(videoElement, tinyOptionsLarge).withFaceLandmarks();
  }
    
  if (!result) return null;

  try {
    // 1. Face Alignment (Crucial for SFace/ArcFace)
    // We use a temporary canvas to crop and align the face
    const alignedCanvas = document.createElement('canvas');
    alignedCanvas.width = 112;
    alignedCanvas.height = 112;
    const ctx = alignedCanvas.getContext('2d');
    if (!ctx) return null;

    const landmarks = result.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Calculate center of eyes
    const getCenter = (pts: faceapi.Point[]) => ({
        x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
        y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length
    });

    const lEyeCenter = getCenter(leftEye);
    const rEyeCenter = getCenter(rightEye);

    // Alignment logic: Rotate and scale so eyes are horizontal and fixed distance
    const dy = rEyeCenter.y - lEyeCenter.y;
    const dx = rEyeCenter.x - lEyeCenter.x;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Canonical eye positions for 112x112 (OpenCV/InsightFace standard)
    const desiredLeftEye = { x: 112 * 0.35, y: 112 * 0.4 };
    const desiredRightEye = { x: 112 * 0.65, y: 112 * 0.4 };
    const desiredDist = desiredRightEye.x - desiredLeftEye.x;
    const scale = desiredDist / dist;

    ctx.save();
    ctx.translate(desiredLeftEye.x, desiredLeftEye.y);
    ctx.rotate(-angle);
    ctx.scale(scale, scale);
    ctx.translate(-lEyeCenter.x, -lEyeCenter.y);
    ctx.drawImage(videoElement, 0, 0);
    ctx.restore();

    // 2. Preprocessing for SFace (112x112 RGB Float32, NCHW)
    const imageData = ctx.getImageData(0, 0, 112, 112).data;
    const input = new Float32Array(112 * 112 * 3);
    const planeSize = 112 * 112;
    for (let i = 0; i < planeSize; i++) {
        input[i] = imageData[i * 4];               // R
        input[i + planeSize] = imageData[i * 4 + 1]; // G
        input[i + planeSize * 2] = imageData[i * 4 + 2]; // B
    }

    // 3. Inference with SFace ONNX
    if (!sfaceSession) {
        console.warn("SFace session not ready, falling back to face-api descriptor");
        const descriptor = await faceapi.computeFaceDescriptor(videoElement, result);
        return new Float32Array(descriptor);
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, 112, 112]);
    const output = await sfaceSession.run({ input: tensor });
    const embedding = output.output.data as Float32Array;

    // 4. L2 Normalization
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;

    return embedding;
  } catch (error) {
    console.error("Error during face recognition inference:", error);
    return null;
  }
};

/**
 * Calculates Eye Aspect Ratio (EAR) to detect blinks
 */
export const calculateEAR = (eye: faceapi.Point[]) => {
  const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
  const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
  const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
  return (v1 + v2) / (2.0 * h);
};

/**
 * Detects liveness based on landmarks
 */
export const checkLiveness = (landmarks: faceapi.FaceLandmarks68, challenge: LivenessChallenge): LivenessStatus => {
  const pts = landmarks.positions;
  
  // 1. Blink Detection (EAR)
  const leftEye = pts.slice(36, 42);
  const rightEye = pts.slice(42, 48);
  const ear = (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2;
  
  // 2. Smile Detection (MAR - Mouth Aspect Ratio)
  const mouth = pts.slice(48, 68);
  const mouthWidth = Math.sqrt(Math.pow(mouth[0].x - mouth[6].x, 2) + Math.pow(mouth[0].y - mouth[6].y, 2));
  const mouthHeight = Math.sqrt(Math.pow(mouth[3].x - mouth[9].x, 2) + Math.pow(mouth[3].y - mouth[9].y, 2));
  const mar = mouthHeight / mouthWidth;

  // 3. Head Turn / Orientation (Nose position relative to jaw)
  const noseTip = pts[30];
  const jawLeft = pts[0];
  const jawRight = pts[16];
  const distL = Math.sqrt(Math.pow(noseTip.x - jawLeft.x, 2) + Math.pow(noseTip.y - jawLeft.y, 2));
  const distR = Math.sqrt(Math.pow(noseTip.x - jawRight.x, 2) + Math.pow(noseTip.y - jawRight.y, 2));
  const turnRatio = distL / distR;

  let isLive = false;
  let score = 0;
  let message = "";

  switch (challenge) {
    case 'blink':
      isLive = ear < 0.25; // Relaxed threshold from 0.22 for better reliability
      message = isLive ? "Blink detected!" : "Please blink your eyes";
      break;
    case 'smile':
      isLive = mar > 0.40; // Relaxed from 0.45
      message = isLive ? "Smile detected!" : "Please smile for the camera";
      break;
    case 'turn_left':
      isLive = turnRatio > 1.6; // Relaxed from 1.8
      message = isLive ? "Turn detected!" : "Please turn your head left";
      break;
    case 'turn_right':
      isLive = turnRatio < 0.65; // Relaxed from 0.55
      message = isLive ? "Turn detected!" : "Please turn your head right";
      break;
    case 'neutral':
      // More forgiving neutral state
      isLive = ear > 0.22 && mar < 0.40 && turnRatio > 0.7 && turnRatio < 1.4;
      message = isLive ? "Face centered" : "Look directly at the camera";
      break;
    default:
      isLive = true;
  }

  return { isLive, score, message };
};

export const compareFaces = (
  liveDescriptor: number[] | Float32Array, 
  storedDescriptors: any // Can be number[], Float32Array, or number[][] (multi-embedding)
) => {
  // Normalize storedDescriptors to number[][]
  let descriptors: number[][] = [];
  if (Array.isArray(storedDescriptors)) {
    if (Array.isArray(storedDescriptors[0])) {
      descriptors = storedDescriptors;
    } else {
      descriptors = [storedDescriptors as number[]];
    }
  } else if (storedDescriptors instanceof Float32Array) {
    descriptors = [Array.from(storedDescriptors)];
  }

  if (descriptors.length === 0) return { isMatch: false, similarity: 0 };

  // Calculate distances against all stored embeddings
  const distances = descriptors.map(stored => faceapi.euclideanDistance(liveDescriptor, stored));
  
  // Consensus Strategy: Instead of MIN distance (which can be easily spoofed by matching ONE bad sample),
  // we take the average of the TOP 5 most similar samples. 
  // This ensures the face is consistently matching the user's profile cluster.
  const sortedDistances = [...distances].sort((a, b) => a - b);
  const consensusCount = Math.min(5, sortedDistances.length);
  const consensusDist = sortedDistances.slice(0, consensusCount).reduce((a, b) => a + b, 0) / consensusCount;
  
  // PARANOID THRESHOLD: 
  // 0.32 is extremely strict for high-assurance SFace matching.
  // Standard is 0.40, Loose is 0.60.
  const threshold = 0.32; 
  const isMatch = consensusDist < threshold; 
  
  // Scale similarity for UI: 0.0 distance -> 100%, 0.4 distance -> 0%
  const similarity = Math.max(0, 1 - (consensusDist / 0.4)); 

  console.log(`Face Match [Consensus]: Dist=${consensusDist.toFixed(4)}, Best=${sortedDistances[0].toFixed(4)}, Match=${isMatch}`);
  
  return {
    isMatch,
    similarity,
    minDistance: consensusDist // Return consensus dist as the primary metric
  };
};

export const detectFace = async (videoElement: HTMLVideoElement) => {
  if (videoElement.paused || videoElement.ended || videoElement.videoWidth === 0) return null;
  
  // Lightweight detection for the visual mesh
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.1 });
  let result = await faceapi.detectSingleFace(videoElement, options).withFaceLandmarks();
  
  if (!result) {
    result = await faceapi
      .detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
      .withFaceLandmarks();
  }
  
  return result;
};


