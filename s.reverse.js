function sketch() {
  openRobotPopup();

  new p5((p) => {
    p.setup = () => setupSimulator(p);
    p.draw  = () => drawSimulator(p);
  }, "p5-canvas");
}

// 전역 변수
let STEP          = 2;
let FILENAME      = "Cat.svg";
let drawScale     = 0.4;   // SVG → 로봇 스케일
let svgPathPoints = [];    // 최종: 로봇 좌표계 (x, y, pen)
let showSvgPath   = false; // 파란선 표시 여부

// scale x,y offset
let Xoffset = +140;
let Yoffset = -50;

// 이미지 기준 기본 각도
let upperRestAngle = 0; // upperarm 이미지 기울어진 각도
let foreRestAngle  = 0; // forearm 이미지 기울어진 각도

// SVG를 모션 기준으로 쓸지 여부 + 인덱스/속도
let useSvgAsMotion = true;
let svgIndex       = 0;
let svgFrameSkip   = 2; // 숫자 줄이면 더 빨리 움직임
let svgFrameCounter = 0;

// 로봇 관련 전역 변수
let canvasWidth, canvasHeight;

let baseX, baseY;       // Joint 1 x,y 좌표
let link1Length, link2Length;

let imgTop, imgUpper, imgFore;
let topPath, upperPath, forePath;

let currentAngleJoint1 = 0;
let currentAngleJoint2 = 0;
let currentPen         = 0; // 0: 펜 업, 1: 펜 다운

let targetAngleJoint1 = 0;
let targetAngleJoint2 = 0;
let joint1Moving = false;
let joint2Moving = false;
const ANGLE_THRESHOLD = 0.5; // 도달 판정 임계값 (도)

// 관절 범위 (path로 인해 한번 이상 이동해야 정상적인 관절 범위 확인 가능)
let minJoint1 =  1e9;
let maxJoint1 = -1e9;
let minJoint2 =  1e9;
let maxJoint2 = -1e9;

const scale      = 0.7;  // 전체 캔버스 스케일
const moreHeight = 100;
const imageScale = 0.5;  // PNG 이미지 자체 스케일

//spine 모델에서 최솟값, 최댓값 추출
const J1_MIN = monkey.minJoint1;
const J1_MAX = monkey.maxJoint1;
const J2_MIN = monkey.minJoint2;
const J2_MAX = monkey.maxJoint2;

// 이미지 기준 팔 관절 픽셀 좌표 (길이 구하거나, 각도 측정시 필요)
const TOP_JOINT_X = 220;
const TOP_JOINT_Y = 477;

const UPPER_JOINT_BASE_X  = 747;
const UPPER_JOINT_BASE_Y  = 226;
const UPPER_JOINT_ELBOW_X = 195;
const UPPER_JOINT_ELBOW_Y = 383;

const FORE_JOINT_ELBOW_X = 195;
const FORE_JOINT_ELBOW_Y = 385;
const FORE_PEN_X         = 778;
const FORE_PEN_Y         = 612;

// 재생 관련 상태
let isPlaying      = true;
let trailPoints    = [];
let debugFrame     = 0;

// 팝업 함수
function openRobotPopup() {
  const option = {
    title: "2DOF Robot Simulator",
    body: '<div id="p5-canvas"></div>',
    width: 1,
    height: 1,
    modal: true,
    actions: {},
  };
  w2custompopup.open(option);
}

// p5 setup 함수
function setupSimulator(p) {
  canvasWidth  = 1200 * scale + 400;
  canvasHeight = 800 * scale + moreHeight;

   p.frameRate(100);
  // Spine에서 이미지 경로 얻기 / 역방향 이미지 
  topPath   = spine.images.get("top_reverse.png");
  upperPath = spine.images.get("upperarm_reverse.png");
  forePath  = spine.images.get("forearm_reverse.png");

  // p5 이미지 로딩
  imgTop   = p.loadImage(topPath);
  imgUpper = p.loadImage(upperPath);
  imgFore  = p.loadImage(forePath);

  // 링크 길이 및 기본 각도 계산
  initLinkGeometry();

  // 베이스 위치 계산
  initBasePosition();

  // SVG 로드 & 점 추출 → 작업공간으로 맵핑
  const svgPath = spine.images.get(FILENAME); // Spine에 등록된 SVG 경로
  p.loadStrings(svgPath, (lines) => {
    const svgText  = lines.join("\n");
    const rawPts   = extractPathPointsFromSvg(svgText, STEP);  // SVG 원 좌표
    svgPathPoints  = fitSvgPointsToWorkspace(rawPts);          // 로봇 좌표계로 매핑
  });

  // 팝업, 캔버스 크기 조정
  w2custompopup.resize(canvasWidth + 16, canvasHeight + 96);
  p.createCanvas(canvasWidth, canvasHeight);
}

// 팔 길이, 각도 계산
function initLinkGeometry() {
  // upperarm 길이 각도
  {
    const dx = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X) * imageScale;
    const dy = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y) * imageScale;
    link1Length = Math.hypot(dx, dy);

    const dxImg = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X);
    const dyImg = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y);
    upperRestAngle = Math.atan2(dyImg, dxImg); // 이미지 상의 방향(rad)
  }

  // forearm 길이 각도
  {
    const dx = (FORE_PEN_X - FORE_JOINT_ELBOW_X) * imageScale;
    const dy = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y) * imageScale;
    link2Length = Math.hypot(dx, dy);

    const dxImg2 = (FORE_PEN_X - FORE_JOINT_ELBOW_X);
    const dyImg2 = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y);
    foreRestAngle = Math.atan2(dyImg2, dxImg2); // 이미지 상의 방향(rad)
  }
}

// 베이스 위치 계산
function initBasePosition() {
  baseX = 800;

  const topMargin = 80; // 화면 위에서 조금 내려온 위치

  if (imgTop) {
    const jointFromTop = TOP_JOINT_Y * imageScale;
    // 이미지의 위쪽에서 관절까지 거리만큼 내려오기
    baseY = topMargin + jointFromTop;
  } else {
    baseY = topMargin + 100;
  }
}
// svg에서 path, 기본 도형 좌표 추출 함수
function extractPathPointsFromSvg(svgText, sampleStep = 2) {
  const parser  = new DOMParser();
  const doc     = parser.parseFromString(svgText, "image/svg+xml");
  const svgRoot = doc.documentElement;

  const points  = [];

  // 브라우저 임시 svg
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  tempSvg.setAttribute("width", "0");
  tempSvg.setAttribute("height", "0");
  tempSvg.style.position = "absolute";
  tempSvg.style.left = "-9999px";
  tempSvg.style.top  = "-9999px";
  document.body.appendChild(tempSvg);

  let lastGlobalPt = null; // 이전 shape의 마지막 점

  // transform 파싱 함수
  function parseTransform(transformStr) {
    if (!transformStr) return null;

    const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    const parseArgs = (regex) => {
      const match = transformStr.match(regex);
      if (!match) return null;
      return match[1].split(/[\s,]+/).map(parseFloat);
    };

    const t = parseArgs(/translate\(([^)]+)\)/);
    if (t) {
      m.e = t[0] || 0;
      m.f = t[1] || 0;
    }

    const s = parseArgs(/scale\(([^)]+)\)/);
    if (s) {
      m.a = s[0] || 1;
      m.d = s[1] || s[0] || 1;
    }

    const r = parseArgs(/rotate\(([^)]+)\)/);
    if (r) {
      const angle = r[0] * Math.PI / 180;
      const cos   = Math.cos(angle);
      const sin   = Math.sin(angle);
      m.a = cos;
      m.b = sin;
      m.c = -sin;
      m.d = cos;
    }

    const mm = parseArgs(/matrix\(([^)]+)\)/);
    if (mm) {
      m.a = mm[0]; m.b = mm[1];
      m.c = mm[2]; m.d = mm[3];
      m.e = mm[4]; m.f = mm[5];
    }

    return m;
  }

  function multiplyMatrices(m1, m2) {
    if (!m1) return m2;
    if (!m2) return m1;
    return {
      a: m1.a * m2.a + m1.c * m2.b,
      b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d,
      d: m1.b * m2.c + m1.d * m2.d,
      e: m1.a * m2.e + m1.c * m2.f + m1.e,
      f: m1.b * m2.e + m1.d * m2.f + m1.f,
    };
  }

  function getAccumulatedTransform(el) {
    let acc = null;
    let cur = el;

    while (cur && cur !== svgRoot) {
      const tStr = cur.getAttribute("transform");
      if (tStr) {
        const m = parseTransform(tStr);
        acc = multiplyMatrices(m, acc);
      }
      cur = cur.parentElement;
    }
    return acc;
  }

  function applyTransform(x, y, m) {
    if (!m) return { x, y };
    return {
      x: m.a * x + m.c * y + m.e,
      y: m.b * x + m.d * y + m.f,
    };
  }

  function shouldRender(el) {
    // defs 안에 있으면 그리지 않음
    let parent = el.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === "defs") return false;
      parent = parent.parentElement;
    }

    const display    = el.getAttribute("display");
    const visibility = el.getAttribute("visibility");
    if (display === "none" || visibility === "hidden") return false;

    return true;
  }
  // 기본 도형 좌표 추출 함수
  function circleToPath(cx, cy, r, m) {
    const center = applyTransform(cx, cy, m);
    let newR = r;

    if (m) {
      const sx = Math.sqrt(m.a * m.a + m.b * m.b);
      const sy = Math.sqrt(m.c * m.c + m.d * m.d);
      newR = r * (sx + sy) / 2;
    }

    const x0 = center.x - newR;
    const x1 = center.x + newR;
    const y  = center.y;

    return `M ${x0},${y} A ${newR},${newR} 0 1,0 ${x1},${y} A ${newR},${newR} 0 1,0 ${x0},${y} Z`;
  }

  function ellipseToPath(cx, cy, rx, ry, m) {
    const center = applyTransform(cx, cy, m);
    let newRx = rx, newRy = ry;

    if (m) {
      const sx = Math.sqrt(m.a * m.a + m.b * m.b);
      const sy = Math.sqrt(m.c * m.c + m.d * m.d);
      newRx = rx * sx;
      newRy = ry * sy;
    }

    const x0 = center.x - newRx;
    const x1 = center.x + newRx;
    const y  = center.y;

    return `M ${x0},${y} A ${newRx},${newRy} 0 1,0 ${x1},${y} A ${newRx},${newRy} 0 1,0 ${x0},${y} Z`;
  }

  function rectToPath(x, y, w, h, rx, ry, m) {
    const p1 = applyTransform(x,       y,       m);
    const p2 = applyTransform(x + w,   y,       m);
    const p3 = applyTransform(x + w,   y + h,   m);
    const p4 = applyTransform(x,       y + h,   m);
    // rx, ry는 일단 무시하고 일반 사각형으로 처리
    return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`;
  }

  function lineToPath(x1, y1, x2, y2, m) {
    const p1 = applyTransform(x1, y1, m);
    const p2 = applyTransform(x2, y2, m);
    return `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
  }

  function polyToPath(pointsStr, m, close) {
    const coords = pointsStr.trim().split(/[\s,]+/).map(parseFloat);
    if (coords.length < 4) return "";

    const p0 = applyTransform(coords[0], coords[1], m);
    let path = `M ${p0.x},${p0.y}`;

    for (let i = 2; i < coords.length; i += 2) {
      const p = applyTransform(coords[i], coords[i + 1], m);
      path += ` L ${p.x},${p.y}`;
    }
    if (close) path += " Z";
    return path;
  }

  // <use> 해석
  function resolveUseElement(useEl) {
    const href = useEl.getAttribute("href") || useEl.getAttribute("xlink:href");
    if (!href) return null;

    const id   = href.replace("#", "");
    const ref  = svgRoot.querySelector(`#${id}`);
    if (!ref) return null;

    const tagName = ref.tagName.toLowerCase();
    const x = parseFloat(useEl.getAttribute("x")) || 0;
    const y = parseFloat(useEl.getAttribute("y")) || 0;

    let m = getAccumulatedTransform(useEl);
    if (x !== 0 || y !== 0) {
      m = multiplyMatrices(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
    }

    const useTransform = useEl.getAttribute("transform");
    if (useTransform) {
      m = multiplyMatrices(m, parseTransform(useTransform));
    }

    const refTransform = ref.getAttribute("transform");
    if (refTransform) {
      m = multiplyMatrices(m, parseTransform(refTransform));
    }

    return { element: ref, transform: m, tagName };
  }

  // 실제로 그려질 요소 수집
  const allElements = [];

  const directShapes = svgRoot.querySelectorAll("path, circle, rect, ellipse, line, polygon, polyline");
  directShapes.forEach((el) => {
    if (!shouldRender(el)) return;
    allElements.push({ element: el, transform: null, tagName: el.tagName.toLowerCase() });
  });

  const useElements = svgRoot.querySelectorAll("use");
  useElements.forEach((useEl) => {
    if (!shouldRender(useEl)) return;
    const resolved = resolveUseElement(useEl);
    if (resolved) allElements.push(resolved);
  });

  if (allElements.length === 0) {
    console.warn("SVG에 렌더링할 그래픽 요소가 없습니다.");
    document.body.removeChild(tempSvg);
    return points;
  }

  // 각 shape에 따라 처리
  allElements.forEach((info) => {
    const el      = info.element;
    const tagName = info.tagName;

    let transformMatrix = info.transform || getAccumulatedTransform(el);
    let dAttr = "";

    if (tagName === "path") {
      dAttr = el.getAttribute("d");
      // path는 transform을 svg에 맡기기 위해 matrix로 넘김
    } else if (tagName === "circle") {
      const cx = parseFloat(el.getAttribute("cx")) || 0;
      const cy = parseFloat(el.getAttribute("cy")) || 0;
      const r  = parseFloat(el.getAttribute("r"))  || 0;
      dAttr    = circleToPath(cx, cy, r, transformMatrix);
      transformMatrix = null; // 이미 좌표에 반영했으므로
    } else if (tagName === "ellipse") {
      const cx = parseFloat(el.getAttribute("cx")) || 0;
      const cy = parseFloat(el.getAttribute("cy")) || 0;
      const rx = parseFloat(el.getAttribute("rx")) || 0;
      const ry = parseFloat(el.getAttribute("ry")) || 0;
      dAttr    = ellipseToPath(cx, cy, rx, ry, transformMatrix);
      transformMatrix = null;
    } else if (tagName === "rect") {
      const x  = parseFloat(el.getAttribute("x"))      || 0;
      const y  = parseFloat(el.getAttribute("y"))      || 0;
      const w  = parseFloat(el.getAttribute("width"))  || 0;
      const h  = parseFloat(el.getAttribute("height")) || 0;
      const rx = parseFloat(el.getAttribute("rx"))     || 0;
      const ry = parseFloat(el.getAttribute("ry"))     || 0;
      dAttr    = rectToPath(x, y, w, h, rx, ry, transformMatrix);
      transformMatrix = null;
    } else if (tagName === "line") {
      const x1 = parseFloat(el.getAttribute("x1")) || 0;
      const y1 = parseFloat(el.getAttribute("y1")) || 0;
      const x2 = parseFloat(el.getAttribute("x2")) || 0;
      const y2 = parseFloat(el.getAttribute("y2")) || 0;
      dAttr    = lineToPath(x1, y1, x2, y2, transformMatrix);
      transformMatrix = null;
    } else if (tagName === "polygon") {
      const pts = el.getAttribute("points");
      if (pts) dAttr = polyToPath(pts, transformMatrix, true);
      transformMatrix = null;
    } else if (tagName === "polyline") {
      const pts = el.getAttribute("points");
      if (pts) dAttr = polyToPath(pts, transformMatrix, false);
      transformMatrix = null;
    }

    if (!dAttr) return;

    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", dAttr);

    if (transformMatrix) {
      const m = transformMatrix;
      pathEl.setAttribute("transform", `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`);
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
    const localPoints = [];
    let isFirst = true;

    for (let len = 0; len <= totalLength; len += step) {
      const pt = pathEl.getPointAtLength(len);
      localPoints.push({ x: pt.x, y: pt.y, pen: isFirst ? 0 : 1 });
      isFirst = false;
    }

    // 끝점 추가
    const lastPt = pathEl.getPointAtLength(totalLength);
    localPoints.push({ x: lastPt.x, y: lastPt.y, pen: 1 });

    tempSvg.removeChild(pathEl);
    if (!localPoints.length) return;

    // 이전 shape의 끝점 → 이번 shape의 시작점 까지 펜 업 이동 (물리적으로 순간이동 방지)
    if (lastGlobalPt) {
      const start = lastGlobalPt;
      const end   = localPoints[0];
      const dx    = end.x - start.x;
      const dy    = end.y - start.y;
      const dist  = Math.hypot(dx, dy);

      const bridgeStep  = sampleStep > 0 ? sampleStep : dist / 20;
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

    // 실제 path 포인트 추가
    for (const lp of localPoints) {
      points.push(lp);
    }

    lastGlobalPt = localPoints[localPoints.length - 1];
  });

  document.body.removeChild(tempSvg);
  return points;
}

// svg에서 추출한 좌표 scale 함수
function fitSvgPointsToWorkspace(points) {
  if (!points || !points.length) return [];

  // 1) SVG 원본 좌표의 bounding box 계산
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  // 2) SVG 중심점 (cx, cy)
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // 3) 중심 기준 최대 반경 (가장 멀리 있는 점까지의 거리)
  let maxR = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    maxR = Math.max(maxR, Math.hypot(dx, dy));
  }
  // 점이 거의 한 점에 몰려 있으면 1로 처리 (0으로 나누기 방지)
  if (maxR < 1e-6) maxR = 1.0;

  // 4) 로봇 작업반경 기준 스케일 계산
  const Lsum     = link1Length + link2Length;   // 이론상 최대 팔 길이 합
  const maxReach = Lsum * 0.9;                  // 살짝 여유있게 90%만 사용
  const scaleSvg = (maxReach * drawScale) / maxR;

  // 5) 그림 중심을 "베이스 아래쪽"에 배치 (천장 로봇)
  //    p5 좌표계는 y가 아래로 증가하므로, baseY보다 큰 값이 아래쪽.
  const drawCx = baseX;
  const drawCy = baseY + Lsum * 0.6;

  // 6) 스케일 + 평행이동 + 유저 오프셋(Xoffset, Yoffset) 적용
  return points.map((p) => {
    const dx = (p.x - cx) * scaleSvg + Xoffset;
    const dy = (p.y - cy) * scaleSvg + Yoffset;

    return {
      x: drawCx + dx,
      y: drawCy + dy,
      pen: p.pen,   // 펜 업/다운 정보는 그대로 유지
    };
  });
}

// 2DOF 역기구학 함수
function inverseKinematics2DOF(targetX, targetY, prevJ1Deg, prevJ2Deg) {
  const L1 = link1Length;
  const L2 = link2Length;

  const dx = targetX - baseX;
  const dy = targetY - baseY;
  let d    = Math.hypot(dx, dy);
  if (d < 1e-6) d = 1e-6;

  // 작업공간까지
  const maxReach = L1 + L2 - 1e-3; //약간의 여유 공간(10 -3승)
  const minReach = Math.abs(L1 - L2) + 1e-3;
   // d = Math.max(minReach, Math.min(maxReach, d));

  let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cos2     = Math.max(-1, Math.min(1, cos2));

  const theta2Abs = Math.acos(cos2);        // 0 ~ π
  const theta2List = [theta2Abs, -theta2Abs]; // elbow down / up

  function solve(theta2_fk) {
    const k1 = L1 + L2 * Math.cos(theta2_fk);
    const k2 = L2 * Math.sin(theta2_fk);

    const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);

    const theta1 = theta1_fk - upperRestAngle; // FK때 더해준 각도 다시 빼기
    const theta2 = theta2_fk;

    const joint1Deg = -theta1 * 180 / Math.PI;
    const joint2Deg = -theta2 * 180 / Math.PI;
    return { joint1: joint1Deg, joint2: joint2Deg };
  }

  const solA = solve(theta2List[0]);
  const solB = solve(theta2List[1]);

  // 이전 각도 정보가 없으면 solA 사용
  if (typeof prevJ1Deg !== "number" || typeof prevJ2Deg !== "number") {
    return solA;
  }

  function score(sol) {
    const d1 = sol.joint1 - prevJ1Deg;
    const d2 = sol.joint2 - prevJ2Deg;
    return d1 * d1 + d2 * d2;
  }

  const scoreA = score(solA);
  const scoreB = score(solB);
  return (scoreB < scoreA) ? solB : solA;
}

// 펄스 단위가 0.1도이므로, 소수점 첫째 이하는 버림
function trunc1(x) {
  return x >= 0
    ? Math.floor(x * 10) / 10
    : Math.ceil(x * 10) / 10;
}

//p5 draw 함수
function drawSimulator(p) {
  debugFrame++;

  p.background(245);
  p.scale(scale);

  // 1) 목표점 선택 & IK 계산
  if (isPlaying && useSvgAsMotion && svgPathPoints.length > 0) {
    const pt = svgPathPoints[svgIndex];

    const dynamicSkip = (pt.pen === 0 ? 1 : svgFrameSkip);
    svgFrameCounter++;

    if (svgFrameCounter >= dynamicSkip) {
      svgFrameCounter = 0;
      
      // 다음 포인트로 이동 (joint1, joint2가 모두 목표에 도달했을 때만)
      if (!joint1Moving && !joint2Moving) {
        svgIndex = Math.min(svgIndex + 1, svgPathPoints.length - 1);
        
        const ik = inverseKinematics2DOF(
          pt.x,
          pt.y,
          currentAngleJoint1,
          currentAngleJoint2
        );

        let j1 = trunc1(ik.joint1);
        let j2 = trunc1(ik.joint2);

        j1 = Math.max(J1_MIN, Math.min(J1_MAX, j1));
        j2 = Math.max(J2_MIN, Math.min(J2_MAX, j2));

        targetAngleJoint1 = j1;
        targetAngleJoint2 = j2;
        joint1Moving = true;
        currentPen = pt.pen;
      }
    }
    // 최대한 오차를 보기 위해 joint1 -> joint2 순으로 움직이는 코드
    // joint1 제어
    if (joint1Moving) {
      const diff1 = targetAngleJoint1 - currentAngleJoint1;
      
      if (Math.abs(diff1) < ANGLE_THRESHOLD) {
        currentAngleJoint1 = targetAngleJoint1;
        joint1Moving = false;
        joint2Moving = true;
      } else {
        const step1 = Math.sign(diff1) * Math.min(Math.abs(diff1), 2.0);
        currentAngleJoint1 += step1;
      }
      
      $("encoder.joint_1").d = currentAngleJoint1;
    }

    // joint2 제어
    if (joint2Moving) {
      const diff2 = targetAngleJoint2 - currentAngleJoint2;
      
      if (Math.abs(diff2) < ANGLE_THRESHOLD) {
        currentAngleJoint2 = targetAngleJoint2;
        joint2Moving = false;
      } else {
        const step2 = Math.sign(diff2) * Math.min(Math.abs(diff2), 2.0);
        currentAngleJoint2 += step2;
      }
      
      $("encoder.joint_2").d = currentAngleJoint2;
    }
  }

  // 2) Forward Kinematics (현재 joint 각도로 포즈 계산)
  const theta1 = p.radians(currentAngleJoint1) * -1;
  const theta2 = p.radians(currentAngleJoint2) * -1;

  const theta1_fk = theta1 + upperRestAngle;

  const x2 = baseX + link1Length * p.cos(theta1_fk);
  const y2 = baseY + link1Length * p.sin(theta1_fk);

  const x3 = x2 + link2Length * p.cos(theta1_fk + theta2);
  const y3 = y2 + link2Length * p.sin(theta1_fk + theta2);

  // 3) Upperarm 렌더링
  if (imgUpper) {
    p.push();
    p.translate(baseX, baseY);
    p.rotate(theta1); // upper는 joint1만 반영
    p.scale(imageScale);
    p.image(imgUpper, -UPPER_JOINT_BASE_X, -UPPER_JOINT_BASE_Y);
    p.pop();
  }

  // 4) Forearm 렌더링
  if (imgFore) {
    p.push();
    p.translate(x2, y2);

    const foreRotate = theta1_fk + theta2 - foreRestAngle;
    p.rotate(foreRotate);

    p.scale(imageScale);
    p.image(imgFore, -FORE_JOINT_ELBOW_X, -FORE_JOINT_ELBOW_Y);
    p.pop();
  }

  // 5) Top 렌더링
  if (imgTop) {
    p.push();
    p.translate(baseX, baseY);
    p.scale(imageScale);
    p.image(imgTop, -TOP_JOINT_X, -TOP_JOINT_Y);
    p.pop();
  }

  // 6) 펜 위치 & 궤적 기록
  const penX = x3;
  const penY = y3;

  trailPoints.push({ x: penX, y: penY, pen: currentPen });

  // 펜이 다운이면 궤적을 그림
  if (trailPoints.length > 1) {
    p.push();
    p.stroke(255, 0, 0);
    p.strokeWeight(2);
    p.noFill();

    for (let i = 1; i < trailPoints.length; i++) {
      const prev = trailPoints[i - 1];
      const curr = trailPoints[i];
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

  // 7) 관절 범위 기록
  if (debugFrame > 5) {
    minJoint1 = Math.min(minJoint1, currentAngleJoint1);
    maxJoint1 = Math.max(maxJoint1, currentAngleJoint1);
    minJoint2 = Math.min(minJoint2, currentAngleJoint2);
    maxJoint2 = Math.max(maxJoint2, currentAngleJoint2);
  }

  // 8) 디버그 텍스트
  p.push();
  p.fill(0);
  p.textSize(12);
  p.text(`J1: ${$("encoder.joint_1").d} deg`, 50, 50);
  p.text(`J2: ${$("encoder.joint_2").d} deg`, 50, 70);
  p.text(`L1: ${link1Length.toFixed(0)}px`,   50, 90);
  p.text(`L2: ${link2Length.toFixed(0)}px`,   50, 110);

  p.text(isPlaying ? "Playing" : "Paused", 50, 150);
  p.text(`Pen: ${currentPen}`,              50, 170);
  p.text(`SVG pts: ${svgPathPoints.length}`,50, 190);
  p.text(`SVG idx: ${svgIndex}`,            50, 210);
  p.text(`SVG motion: ${useSvgAsMotion}`,   50, 230);
  p.text(`J1 moving: ${joint1Moving}`,      50, 250);
  p.text(`J2 moving: ${joint2Moving}`,      50, 270);
  p.text(`MIN J1: ${minJoint1}`,            50, 290);
  p.text(`MAX J1: ${maxJoint1}`,            50, 310);
  p.text(`MIN J2: ${minJoint2}`,            50, 330);
  p.text(`MAX J2: ${maxJoint2}`,            50, 350);
  p.pop();

  // 9) SVG 원본 궤적 (파란선)
  if (showSvgPath) {
    drawSvgPathPoints(p);
  }
}

// 파란 선 (궤적) 원본 궤적 그리기
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
