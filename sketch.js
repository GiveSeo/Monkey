function sketch() { // 화면에 시뮬레이터 띄우는 함수
  pop_sketch();

  new p5((p) => {
    p.setup = function () {
      psetup(p);
    };

    p.draw = () => {
      pdraw(p);
    };
  }, "p5-canvas");
}

let STEP = 2;
// 전역 변수
let FILENAME = "input.svg"
let draw_scale = 0.4
let svgPathPoints = []; // 최종: 로봇 좌표계 (x,y,pen)
let showSvgPath = false; // 파란 선 표시 여부
let Xoffset = -140;
let Yoffset = +50;
// upperarm 이미지의 기본 기울기(어깨→팔꿈치)
let upperRestAngle = 0; // rad

// [NEW] forearm 이미지에서 "엘보우→펜" 방향의 기본 기울기
let foreRestAngle = 0;  // rad

// SVG를 모션 기준으로 쓸지 여부 + 인덱스/속도
let useSvgAsMotion = true;
let svgIndex = 0;
let svgFrameSkip = 2;      // 숫자 줄이면 더 빨리 따라감
let svgFrameCounter = 0;



// SVG에서 DOM으로 파싱해서 PATH만 가져오기
// SVG에서 DOM으로 파싱해서 PATH + 기본 도형 가져오기 (Transform 지원)
// SVG에서 DOM으로 파싱해서 PATH + 기본 도형 가져오기 (Transform, use, defs 지원)
// SVG에서 DOM으로 파싱해서 PATH + 기본 도형 가져오기 (Transform, use, defs 지원)
// SVG에서 DOM으로 파싱해서 PATH + 기본 도형 가져오기 (Transform, use, defs 지원)
// SVG에서 DOM으로 파싱해서 PATH + 기본 도형 가져오기 (Transform, use, defs 지원)
function extractPathPointsFromSvg(svgText, sampleStep = 2) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgRoot = doc.documentElement;

  const points = [];

  // 브라우저에서 길이/좌표 계산을 위해 임시 svg 생성
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  tempSvg.setAttribute("width", "0");
  tempSvg.setAttribute("height", "0");
  tempSvg.style.position = "absolute";
  tempSvg.style.left = "-9999px";
  tempSvg.style.top = "-9999px";
  document.body.appendChild(tempSvg);

  let lastGlobalPt = null; // 이전 shape의 마지막 점

  // Transform 파싱 함수
  function parseTransform(transformStr) {
    if (!transformStr) return null;
    
    const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    
    // translate 파싱
    const translateMatch = transformStr.match(/translate\(([^)]+)\)/);
    if (translateMatch) {
      const values = translateMatch[1].split(/[\s,]+/).map(v => parseFloat(v));
      matrix.e = values[0] || 0;
      matrix.f = values[1] || 0;
    }
    
    // scale 파싱
    const scaleMatch = transformStr.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      const values = scaleMatch[1].split(/[\s,]+/).map(v => parseFloat(v));
      matrix.a = values[0] || 1;
      matrix.d = values[1] || values[0] || 1;
    }
    
    // rotate 파싱
    const rotateMatch = transformStr.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
      const values = rotateMatch[1].split(/[\s,]+/).map(v => parseFloat(v));
      const angle = values[0] * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      matrix.a = cos;
      matrix.b = sin;
      matrix.c = -sin;
      matrix.d = cos;
    }
    
    // matrix 파싱
    const matrixMatch = transformStr.match(/matrix\(([^)]+)\)/);
    if (matrixMatch) {
      const values = matrixMatch[1].split(/[\s,]+/).map(v => parseFloat(v));
      matrix.a = values[0];
      matrix.b = values[1];
      matrix.c = values[2];
      matrix.d = values[3];
      matrix.e = values[4];
      matrix.f = values[5];
    }
    
    return matrix;
  }

  // Transform 행렬 합성 함수
  function multiplyMatrices(m1, m2) {
    if (!m1) return m2;
    if (!m2) return m1;
    return {
      a: m1.a * m2.a + m1.c * m2.b,
      b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d,
      d: m1.b * m2.c + m1.d * m2.d,
      e: m1.a * m2.e + m1.c * m2.f + m1.e,
      f: m1.b * m2.e + m1.d * m2.f + m1.f
    };
  }

  // 부모 transform들을 누적 계산
  function getAccumulatedTransform(element) {
    let accMatrix = null;
    let current = element;
    
    while (current && current !== svgRoot) {
      const transformStr = current.getAttribute('transform');
      if (transformStr) {
        const matrix = parseTransform(transformStr);
        accMatrix = multiplyMatrices(matrix, accMatrix);
      }
      current = current.parentElement;
    }
    
    return accMatrix;
  }

  // 요소가 실제로 렌더링되어야 하는지 확인
  function shouldRender(element) {
    // defs 내부는 렌더링하지 않음
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === 'defs') {
        return false;
      }
      parent = parent.parentElement;
    }
    
    // display:none이나 visibility:hidden 체크
    const display = element.getAttribute('display');
    const visibility = element.getAttribute('visibility');
    if (display === 'none' || visibility === 'hidden') {
      return false;
    }
    
    return true;
  }

  // Transform 적용 함수
  function applyTransform(x, y, matrix) {
    if (!matrix) return { x, y };
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f
    };
  }

  // 기본 도형을 path로 변환하는 함수들 (transform 직접 적용)
  function circleToPath(cx, cy, r, matrix) {
    // transform을 중심점에 직접 적용
    const center = applyTransform(cx, cy, matrix);
    const newCx = center.x;
    const newCy = center.y;
    
    // scale 고려 (반지름도 변환)
    let newR = r;
    if (matrix) {
      // 평균 스케일 적용
      const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
      const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
      newR = r * (scaleX + scaleY) / 2;
    }
    
    return `M ${newCx - newR},${newCy} A ${newR},${newR} 0 1,0 ${newCx + newR},${newCy} A ${newR},${newR} 0 1,0 ${newCx - newR},${newCy} Z`;
  }

  function ellipseToPath(cx, cy, rx, ry, matrix) {
    const center = applyTransform(cx, cy, matrix);
    const newCx = center.x;
    const newCy = center.y;
    
    let newRx = rx, newRy = ry;
    if (matrix) {
      const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
      const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
      newRx = rx * scaleX;
      newRy = ry * scaleY;
    }
    
    return `M ${newCx - newRx},${newCy} A ${newRx},${newRy} 0 1,0 ${newCx + newRx},${newCy} A ${newRx},${newRy} 0 1,0 ${newCx - newRx},${newCy} Z`;
  }

  function rectToPath(x, y, width, height, rx, ry, matrix) {
    // 4개 꼭지점에 transform 적용
    const p1 = applyTransform(x, y, matrix);
    const p2 = applyTransform(x + width, y, matrix);
    const p3 = applyTransform(x + width, y + height, matrix);
    const p4 = applyTransform(x, y + height, matrix);
    
    if (rx || ry) {
      // 간단하게 처리 (정확하지 않을 수 있음)
      return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`;
    }
    return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`;
  }

  function lineToPath(x1, y1, x2, y2, matrix) {
    const p1 = applyTransform(x1, y1, matrix);
    const p2 = applyTransform(x2, y2, matrix);
    return `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
  }

  function polygonToPath(pointsStr, matrix) {
    const coords = pointsStr.trim().split(/[\s,]+/).map(v => parseFloat(v));
    if (coords.length < 4) return '';
    
    const p0 = applyTransform(coords[0], coords[1], matrix);
    let path = `M ${p0.x},${p0.y}`;
    
    for (let i = 2; i < coords.length; i += 2) {
      const p = applyTransform(coords[i], coords[i + 1], matrix);
      path += ` L ${p.x},${p.y}`;
    }
    path += ' Z';
    return path;
  }

  function polylineToPath(pointsStr, matrix) {
    const coords = pointsStr.trim().split(/[\s,]+/).map(v => parseFloat(v));
    if (coords.length < 4) return '';
    
    const p0 = applyTransform(coords[0], coords[1], matrix);
    let path = `M ${p0.x},${p0.y}`;
    
    for (let i = 2; i < coords.length; i += 2) {
      const p = applyTransform(coords[i], coords[i + 1], matrix);
      path += ` L ${p.x},${p.y}`;
    }
    return path;
  }

  // <use> 요소를 실제 요소로 변환하는 정보 반환
  function resolveUseElement(useEl) {
    const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href');
    if (!href) return null;
    
    const id = href.replace('#', '');
    const referenced = svgRoot.querySelector(`#${id}`);
    if (!referenced) return null;
    
    // 참조된 요소의 정보를 가져옴
    const tagName = referenced.tagName.toLowerCase();
    
    // use의 x, y 속성
    const x = parseFloat(useEl.getAttribute('x')) || 0;
    const y = parseFloat(useEl.getAttribute('y')) || 0;
    
    // use의 transform 속성
    const useTransform = useEl.getAttribute('transform');
    
    // 부모들의 누적 transform (use 요소 기준)
    const parentTransform = getAccumulatedTransform(useEl);
    
    // 최종 transform 계산: 부모 transform → translate(x,y) → use transform
    let finalMatrix = parentTransform;
    
    if (x !== 0 || y !== 0) {
      const translateMatrix = { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
      finalMatrix = multiplyMatrices(finalMatrix, translateMatrix);
    }
    
    if (useTransform) {
      const useMatrix = parseTransform(useTransform);
      finalMatrix = multiplyMatrices(finalMatrix, useMatrix);
    }
    
    // 참조된 요소 자체의 transform도 고려
    const refTransform = referenced.getAttribute('transform');
    if (refTransform) {
      const refMatrix = parseTransform(refTransform);
      finalMatrix = multiplyMatrices(finalMatrix, refMatrix);
    }
    
    return {
      element: referenced,
      transform: finalMatrix,
      tagName: tagName
    };
  }

  // 실제 렌더링할 요소들 수집 (use 해석 포함)
  const allElements = [];
  
  // 일반 그래픽 요소
  const directShapes = svgRoot.querySelectorAll("path, circle, rect, ellipse, line, polygon, polyline");
  directShapes.forEach(shape => {
    if (shouldRender(shape)) {
      allElements.push({
        element: shape,
        transform: null, // getAccumulatedTransform에서 계산할 것
        tagName: shape.tagName.toLowerCase()
      });
    }
  });
  
  // use 요소들 처리
  const useElements = svgRoot.querySelectorAll("use");
  useElements.forEach(useEl => {
    if (shouldRender(useEl)) {
      const resolved = resolveUseElement(useEl);
      if (resolved) {
        console.log('USE element:', {
          x: useEl.getAttribute('x'),
          y: useEl.getAttribute('y'),
          href: useEl.getAttribute('href') || useEl.getAttribute('xlink:href'),
          transform: resolved.transform,
          refElement: resolved.element
        });
        allElements.push(resolved);
      }
    }
  });

  console.log('Total elements to render:', allElements.length);

  if (allElements.length === 0) {
    console.warn("SVG에 렌더링할 그래픽 요소가 없습니다.");
    document.body.removeChild(tempSvg);
    return points;
  }

  allElements.forEach((shapeInfo) => {
    let pathD = '';
    const shape = shapeInfo.element;
    const tagName = shapeInfo.tagName;
    
    // transform 계산: shapeInfo.transform이 있으면 사용, 없으면 계산
    let transformMatrix;
    if (shapeInfo.transform) {
      // use 요소는 이미 계산된 transform 사용
      transformMatrix = shapeInfo.transform;
    } else {
      // 일반 요소는 부모들의 transform 계산
      transformMatrix = getAccumulatedTransform(shape);
    }
    
    // 각 도형 타입에 따라 path 데이터 생성 (transform 직접 적용)
    if (tagName === 'path') {
      pathD = shape.getAttribute('d');
      // path는 브라우저의 transform 처리를 사용 (그대로 유지)
    } else if (tagName === 'circle') {
      const cx = parseFloat(shape.getAttribute('cx')) || 0;
      const cy = parseFloat(shape.getAttribute('cy')) || 0;
      const r = parseFloat(shape.getAttribute('r')) || 0;
      console.log('Circle:', { cx, cy, r, transform: transformMatrix });
      pathD = circleToPath(cx, cy, r, transformMatrix);
      transformMatrix = null; // 이미 적용했으므로 null로
    } else if (tagName === 'ellipse') {
      const cx = parseFloat(shape.getAttribute('cx')) || 0;
      const cy = parseFloat(shape.getAttribute('cy')) || 0;
      const rx = parseFloat(shape.getAttribute('rx')) || 0;
      const ry = parseFloat(shape.getAttribute('ry')) || 0;
      pathD = ellipseToPath(cx, cy, rx, ry, transformMatrix);
      transformMatrix = null;
    } else if (tagName === 'rect') {
      const x = parseFloat(shape.getAttribute('x')) || 0;
      const y = parseFloat(shape.getAttribute('y')) || 0;
      const width = parseFloat(shape.getAttribute('width')) || 0;
      const height = parseFloat(shape.getAttribute('height')) || 0;
      const rx = parseFloat(shape.getAttribute('rx')) || 0;
      const ry = parseFloat(shape.getAttribute('ry')) || 0;
      pathD = rectToPath(x, y, width, height, rx, ry, transformMatrix);
      transformMatrix = null;
    } else if (tagName === 'line') {
      const x1 = parseFloat(shape.getAttribute('x1')) || 0;
      const y1 = parseFloat(shape.getAttribute('y1')) || 0;
      const x2 = parseFloat(shape.getAttribute('x2')) || 0;
      const y2 = parseFloat(shape.getAttribute('y2')) || 0;
      pathD = lineToPath(x1, y1, x2, y2, transformMatrix);
      transformMatrix = null;
    } else if (tagName === 'polygon') {
      const pointsStr = shape.getAttribute('points');
      if (pointsStr) pathD = polygonToPath(pointsStr, transformMatrix);
      transformMatrix = null;
    } else if (tagName === 'polyline') {
      const pointsStr = shape.getAttribute('points');
      if (pointsStr) pathD = polylineToPath(pointsStr, transformMatrix);
      transformMatrix = null;
    }
    
    // transform을 적용할지 결정
    const transformStr = transformMatrix ? 
      `matrix(${transformMatrix.a},${transformMatrix.b},${transformMatrix.c},${transformMatrix.d},${transformMatrix.e},${transformMatrix.f})` : null;

    if (!pathD) return;

    // path 요소 생성 및 추가
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute('d', pathD);
    if (transformStr) {
      pathEl.setAttribute('transform', transformStr);
    }
    tempSvg.appendChild(pathEl);

    let totalLength;
    try {
      totalLength = pathEl.getTotalLength();
    } catch (e) {
      console.warn("getTotalLength 실패, 이 shape는 스킵:", tagName, e);
      tempSvg.removeChild(pathEl);
      return;
    }

    if (!totalLength || totalLength === 0) {
      tempSvg.removeChild(pathEl);
      return;
    }

    const step = sampleStep > 0 ? sampleStep : totalLength / 50;

    // 이 shape의 점들을 먼저 localPoints에 모은다
    const localPoints = [];
    let isFirst = true;

    for (let len = 0; len <= totalLength; len += step) {
      const pt = pathEl.getPointAtLength(len);
      const pen = isFirst ? 0 : 1;
      
      // 디버그: 첫 점과 마지막 점 출력
      if (len === 0 || len >= totalLength - step) {
        console.log(`${tagName} point at len=${len.toFixed(1)}:`, pt, 'transform:', transformStr);
      }
      
      localPoints.push({ x: pt.x, y: pt.y, pen });
      isFirst = false;
    }

    // 끝점 보정
    const lastPt = pathEl.getPointAtLength(totalLength);
    localPoints.push({ x: lastPt.x, y: lastPt.y, pen: 1 });

    tempSvg.removeChild(pathEl);

    if (localPoints.length === 0) return;

    // shape -> shape 사이 로봇 팔 움직이게 하는 임의 점 넣기
    if (lastGlobalPt !== null) {
      const start = lastGlobalPt;
      const end = localPoints[0];

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dist = Math.hypot(dx, dy);

      const bridgeStep = sampleStep > 0 ? sampleStep : dist / 20;
      const bridgeCount = Math.max(1, Math.floor(dist / bridgeStep));

      for (let i = 1; i <= bridgeCount; i++) {
        const t = i / (bridgeCount + 1);
        points.push({
          x: start.x + dx * t,
          y: start.y + dy * t,
          pen: 0,
        });
      }
    }

    // 이번 shape의 포인트들을 전역 points에 추가
    for (const lp of localPoints) {
      points.push(lp);
    }

    // 다음 shape를 위해 마지막 점 업데이트
    lastGlobalPt = localPoints[localPoints.length - 1];
  });

  document.body.removeChild(tempSvg);
  return points;
}
// 로봇, 이미지 전역 변수
let canvasWidth, canvasHeight;

let baseX, baseY;
let link1Length, link2Length;

let imgTop, imgUpper, imgFore;
let topPath, upperPath, forePath;

let currentAngleJoint1 = 0;
let currentAngleJoint2 = 0;
let currentPen = 0; // 0: up, 1: down
let minJoint1 = 1e9;
let maxJoint1 = -1e9;
let minJoint2 = 1e9;
let maxJoint2 = -1e9;

const scale = 0.7;       // 전체 캔버스 스케일
const moreHeight = 100;
const imageScale = 0.5;  // png 이미지 자체 스케일

const J1_MIN = monkey.minJoint1;
const J1_MAX = monkey.maxJoint1;
const J2_MIN = monkey.minJoint2;
const J2_MAX = monkey.maxJoint2;

// upperarm 이미지의 기본 기울기(어깨→팔꿈치)


// 이미지 픽셀 정보
const TOP_JOINT_X = 746;
const TOP_JOINT_Y = 232;

const UPPER_JOINT_BASE_X  = 225;
const UPPER_JOINT_BASE_Y  = 532;
const UPPER_JOINT_ELBOW_X = 777;
const UPPER_JOINT_ELBOW_Y = 377;

const FORE_JOINT_ELBOW_X = 778;
const FORE_JOINT_ELBOW_Y = 375;
const FORE_PEN_X         = 192;
const FORE_PEN_Y         = 146;

let sequenceIndex = 0;
let frameCounter = 0;
let currentDuration = 0;
let isPlaying = true;
let trailPoints = [];

function pop_sketch() {
  const option = {
    title: "2DOF Robot Simulator",
    body:
      '<div id="p5-canvas"></div>' +
      '<div style="margin-top:10px;">' +
      '</div>',
    width: 1,
    height: 1,
    modal: true,
    actions: {},
  };

  w2custompopup.open(option);

}

// psetup
function psetup(p) {
  canvasWidth = 1200 * scale + 400;
  canvasHeight = 800 * scale + moreHeight;

  // spine 이미지 경로
  topPath   = spine.images.get("top.png");
  upperPath = spine.images.get("upperarm.png");
  forePath  = spine.images.get("forearm.png");

  // p5 이미지 로드
  imgTop   = p.loadImage(topPath);
  imgUpper = p.loadImage(upperPath);
  imgFore  = p.loadImage(forePath);

  // upperarm 길이 (엘보우 - 어깨)
  {
    const dx1 = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X) * imageScale;
    const dy1 = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y) * imageScale;
    link1Length = Math.hypot(dx1, dy1);
  }

  // upperarm 기본 기울기 (이미지 기준 어깨→팔꿈치)
  {
    const dxImg = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X);
    const dyImg = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y);
    upperRestAngle = Math.atan2(dyImg, dxImg); // rad
  }

  // forearm 길이 (엘보우→펜 끝 거리)
  {
    const dx2 = (FORE_PEN_X - FORE_JOINT_ELBOW_X) * imageScale;
    const dy2 = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y) * imageScale;
    link2Length = Math.hypot(dx2, dy2);
        // [NEW] forearm 기본 기울기 (이미지 기준 엘보우→펜)
    const dxImg2 = (FORE_PEN_X - FORE_JOINT_ELBOW_X);
    const dyImg2 = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y);
    foreRestAngle = Math.atan2(dyImg2, dxImg2); // rad
  }

  // 베이스 위치 (화면 하단 근처)
  baseX = 800;
  const groundY = canvasHeight - 50;

  if (imgTop) {
    const topH = imgTop.height * imageScale;
    const jointToBottom = topH - TOP_JOINT_Y * imageScale;
    baseY = groundY - jointToBottom;
  } else {
    baseY = groundY - 100;
  }

  // SVG 로드
  const svgPath = spine.images.get(FILENAME); // Spine에 등록된 SVG 경로
  p.loadStrings(svgPath, (lines) => {
    const svgText = lines.join("\n");
    const rawPoints = extractPathPointsFromSvg(svgText, STEP);
    console.log("SVG raw path points:", rawPoints.length);
    svgPathPoints = fitSvgPointsToWorkspace(rawPoints); // 로봇 작업 영역 안으로 매핑
    console.log("SVG fitted path points:", svgPathPoints.length);
  });

  w2custompopup.resize(canvasWidth + 16, canvasHeight + 96);
  p.createCanvas(canvasWidth, canvasHeight);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// =======================
// SVG 포인트를 로봇 작업 영역 (베이스 위 반원)으로 매핑
// =======================
function fitSvgPointsToWorkspace(points) {
  if (!points || points.length === 0) return [];

  // 1) SVG bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // 2) 중심 기준 최대 반경
  let maxR = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const r  = Math.hypot(dx, dy);
    if (r > maxR) maxR = r;
  }
  if (maxR < 1e-6) maxR = 1.0;

  // 3) 로봇 작업반경
  const Lsum = link1Length + link2Length;
  const maxReach = Lsum * 0.9; // 살짝 여유
  const scaleSvg = (maxReach * draw_scale) / maxR;
  //             ^^^^^^^^^^^^^^^
  // 0.6 정도면 SVG가 팔길이보다 확실히 작아짐
  // 너무 크면 0.5, 너무 작으면 0.7 이런 식으로 직접 튜닝

  // 4) 그림 중심을 베이스 위쪽에 배치
  const drawCx = baseX;
  const drawCy = baseY - Lsum * 0.6;

  // 5) 한 번에 스케일 + 평행이동만 적용 (추가 리스케일 없음)
  const fitted = points.map((p) => {
    const dx = (p.x - cx) * scaleSvg + Xoffset;
    const dy = (p.y - cy) * scaleSvg + Yoffset;
    return {
      x: drawCx + dx,
      y: drawCy + dy,
      pen: p.pen,
    };
  });

  return fitted;
}
// =======================
// 2DOF 역기구학: 타겟 (x, y) -> joint1, joint2 (deg)
// =======================
function inverseKinematics2DOF(targetX, targetY, prevJoint1Deg, prevJoint2Deg) {
  const L1 = link1Length;
  const L2 = link2Length;

  // 베이스 기준 좌표
  const dx = targetX - baseX;
  const dy = targetY - baseY;

  let d = Math.hypot(dx, dy);
  if (d < 1e-6) d = 1e-6;

  // 작업 공간 내로 클램핑
  const maxReach = L1 + L2 - 1e-3;
  const minReach = Math.abs(L1 - L2) + 1e-3;
  d = Math.max(minReach, Math.min(maxReach, d));

  // cos(theta2_fk)
  let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cos2 = Math.max(-1, Math.min(1, cos2));

  const theta2_fk_abs = Math.acos(cos2); // 0 ~ π

  // 두 가지 브랜치: elbow-down / elbow-up
  const theta2_fk_list = [ theta2_fk_abs, -theta2_fk_abs ];

  function solveFor(theta2_fk) {
    const k1 = L1 + L2 * Math.cos(theta2_fk);
    const k2 = L2 * Math.sin(theta2_fk);

    const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);

    // FK에서 theta1_fk = theta1 + upperRestAngle 였음
    const theta1 = theta1_fk - upperRestAngle;
    const theta2 = theta2_fk;

    // 기존 FK 코드: theta1 = -rad(joint1), theta2 = -rad(joint2)
    const joint1Deg = -theta1 * 180 / Math.PI;
    const joint2Deg = -theta2 * 180 / Math.PI;

    return { joint1: joint1Deg, joint2: joint2Deg };
  }

  const solA = solveFor(theta2_fk_list[0]);
  const solB = solveFor(theta2_fk_list[1]);

  // 이전 각도가 없으면 (처음 프레임 등) 일단 solA 사용
  if (typeof prevJoint1Deg !== "number" || typeof prevJoint2Deg !== "number") {
    return solA;
  }

  // 두 해 중에서 "이전 각도와 더 가까운" 해 선택
  function score(sol) {
    const d1 = sol.joint1 - prevJoint1Deg;
    const d2 = sol.joint2 - prevJoint2Deg;
    return d1 * d1 + d2 * d2;
  }

  let best = solA;
  let bestScore = score(solA);
  const scoreB = score(solB);

  if (scoreB < bestScore) {
    best = solB;
    bestScore = scoreB;
  }

  // (옵션) joint2 부호 제한 걸고 싶으면 여기서 필터링 가능
  // 예: 항상 joint2 >= 0 인 해만 쓰고 싶다면:
  /*
  const candidates = [solA, solB].filter(s => s.joint2 >= 0);
  if (candidates.length > 0) {
    // 그 중에서 prev와 가장 가까운 해 선택
    let cBest = candidates[0];
    let cScore = score(cBest);
    for (let i = 1; i < candidates.length; i++) {
      const sc = score(candidates[i]);
      if (sc < cScore) {
        cScore = sc;
        cBest = candidates[i];
      }
    }
    best = cBest;
  }
  */

  return best;
}
function trunc1(x) {
  return (x >= 0)
    ? Math.floor(x * 10) / 10
    : Math.ceil(x * 10) / 10;
}
// =======================
// pdraw
// =======================
let debugFrame = 0;
function pdraw(p) {
    debugFrame++;
    
  p.background(245);
  p.scale(scale);

  // 1) 각도 / 펜 상태 업데이트
if (isPlaying) {
  if (useSvgAsMotion && svgPathPoints.length > 0) {

    const pt = svgPathPoints[svgIndex];

    // 🔥 [NEW] 펜 업일 때는 건너뛰지 않고 매 프레임 이동 → 순간이동 제거
    const dynamicSkip = (pt.pen === 0 ? 1 : svgFrameSkip);

    svgFrameCounter++;
    if (svgFrameCounter >= dynamicSkip) {
      svgFrameCounter = 0;
      svgIndex++;
      if (svgIndex >= svgPathPoints.length) {
        svgIndex = svgPathPoints.length - 1;
      }
    }

    // IK 계산 (이전 각도 사용을 강력 추천하면 이렇게)
    const ik = inverseKinematics2DOF(
      pt.x,
      pt.y,
      currentAngleJoint1,
      currentAngleJoint2
    );
    
    let j1 = trunc1(ik.joint1);
    let j2 = trunc1(ik.joint2);
    // 범위 내에 있는지 검사
    j1 = Math.max(J1_MIN, Math.min(J1_MAX, j1));
    j2 = Math.max(J2_MIN, Math.min(J2_MAX, j2));
    $('encoder.joint_1').d = j1;
    $('encoder.joint_2').d = j2;
    currentAngleJoint1 = j1;
    currentAngleJoint2 = j2;
    currentPen = pt.pen;
  }
}

  // 관절 각도(도 → 라디안, 부호 보정)
  const theta1 = p.radians(currentAngleJoint1) * -1;
  const theta2 = p.radians(currentAngleJoint2) * -1;

  // upperarm 기본 기울기 포함한 FK용 각도
  const theta1_fk = theta1 + upperRestAngle;

  // 2. 포워드 키네매틱스: 어깨→팔꿈치→손끝(수학적 엔드이펙터)
  const x2 = baseX + link1Length * p.cos(theta1_fk);
  const y2 = baseY + link1Length * p.sin(theta1_fk);

  const x3 = x2 + link2Length * p.cos(theta1_fk + theta2);
  const y3 = y2 + link2Length * p.sin(theta1_fk + theta2);

  // upper arm 렌더링
  if (imgUpper) {
    p.push();
    p.translate(baseX, baseY); // 어깨 기준
    p.rotate(theta1);          // joint1 각도만 사용
    p.scale(imageScale);
    p.image(imgUpper, -UPPER_JOINT_BASE_X, -UPPER_JOINT_BASE_Y);
    p.pop();
  }

  // forearm 랜더링
  if (imgFore) {
    p.push();
    p.translate(x2, y2); // 팔꿈치 위치

    // [NEW]
    // forearm 이미지의 "엘보우→펜" 벡터가
    // 수학 모델의 (theta1_fk + theta2) 방향과 일치하도록 회전
    const foreRotate = theta1_fk + theta2 - foreRestAngle;
    p.rotate(foreRotate);

    p.scale(imageScale);
    p.image(imgFore, -FORE_JOINT_ELBOW_X, -FORE_JOINT_ELBOW_Y);
    p.pop();
  }

  // ======================
  // top 렌더링
  // ======================
  if (imgTop) {
    p.push();
    p.translate(baseX, baseY);
    p.scale(imageScale);
    p.image(imgTop, -TOP_JOINT_X, -TOP_JOINT_Y);
    p.pop();
  }

  // ======================
  // 펜 좌표 계산 (이미지 오프셋 기반으로 정확히)
  // ======================
  const penX = x3;
  const penY = y3;

  // ======================
  // 궤적 (빨간 선) - 펜이 내려가 있을 때만 기록
  // ======================
   trailPoints.push({ x: penX, y: penY, pen: currentPen });
   //if (trailPoints.length > 10000) trailPoints.shift();

if (trailPoints.length > 1) {
  p.push();
  p.stroke(255, 0, 0);
  p.strokeWeight(2);
  p.noFill();

  for (let i = 1; i < trailPoints.length; i++) {
    const prev = trailPoints[i - 1];
    const curr = trailPoints[i];

    // 🔥 이전 점과 현재 점이 둘 다 펜 다운일 때만 선을 그림
    if (prev.pen === 1 && curr.pen === 1) {
      p.line(prev.x, prev.y, curr.x, curr.y);
    }
  }

  p.pop();
}

  // 펜 위치 표시
  p.push();
  p.stroke(0);
  p.fill(currentPen === 1 ? p.color(100, 200, 255) : p.color(200));
  p.ellipse(penX, penY, 20, 20);
  p.pop();

  // (옵션) IK가 맞추는 수학적 엔드이펙터 위치 디버그용 점
  // p.push();
  // p.fill(0, 255, 0);
  // p.noStroke();
  // p.ellipse(x3, y3, 8, 8);
  // p.pop();

  // ======================
  // 디버그 텍스트
  // ======================
 
  
  if(debugFrame>5){
     minJoint1 = Math.min(minJoint1, currentAngleJoint1);
  maxJoint1 = Math.max(maxJoint1, currentAngleJoint1);
  minJoint2 = Math.min(minJoint2, currentAngleJoint2);
  maxJoint2 = Math.max(maxJoint2, currentAngleJoint2);   
  }
 
  p.push();
  p.fill(0);
  p.textSize(12);
  p.text(`J1: ${$('encoder.joint_1').d} deg`, 50, 50);
  p.text(`J2: ${$('encoder.joint_2').d} deg`, 50, 70);
  p.text(`L1: ${link1Length.toFixed(0)}px`, 50, 90);
  p.text(`L2: ${link2Length.toFixed(0)}px`, 50, 110);

  p.text(isPlaying ? "Playing" : "Paused", 50, 150);
  p.text(`Pen: ${currentPen}`, 50, 170);
  p.text(`SVG pts: ${svgPathPoints.length}`, 50, 190);
  p.text(`SVG idx: ${svgIndex}`, 50, 210);
  p.text(`SVG motion: ${useSvgAsMotion}`, 50, 230);
  p.text(`MIN JOINT1: ${minJoint1} deg`, 50, 250);
  p.text(`MAX JOINT1: ${maxJoint1} deg`, 50, 270);
  p.text(`MIN JOINT2: ${minJoint2} deg`, 50, 290);
  p.text(`MAX JOINT2: ${maxJoint2} deg`, 50, 310);
  p.pop();

  // ======================
  // SVG 원본 궤적 (파란 선) - 이미 로봇 좌표계
  // ======================
  if (showSvgPath) {
    drawSvgPathPoints(p);
  }
}

// =======================
// SVG (x,y,pen) 궤적 그리기 (파란 선)
// =======================
function drawSvgPathPoints(p) {
  if (!svgPathPoints || svgPathPoints.length < 2) return;

  p.push();
  p.stroke(0, 0, 255);
  p.strokeWeight(2);
  p.noFill();

  for (let i = 1; i < svgPathPoints.length; i++) {
    const prev = svgPathPoints[i - 1];
    const curr = svgPathPoints[i];

    if (prev.pen === 1 && curr.pen === 1) {
      p.line(prev.x, prev.y, curr.x, curr.y);
    }
  }
  p.pop();
}
