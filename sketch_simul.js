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

// =======================
// 전역 변수
// =======================

let STEP = 2;
let FILENAME = "Cat.svg";

let zeroPoseFrames = 60; 

// 🔵 기본 스케일 + 팔 길이 배율
const baseImageScale = 0.5;
const baseDrawScale  = 0.5;
let armScale = 1.0;

let draw_scale  = baseDrawScale  * armScale;
let imageScale  = baseImageScale * armScale;

let svgPathPoints = []; // 사용하지 않음
let workspacePoints = [];
let showSvgPath = false;
let Xoffset = -140;
let Yoffset = +50;

// 이미지 기준 기본 각도
let upperRestAngle = 0;
let foreRestAngle  = 0;

// 🔵 초록 네모 채우기용 변수
let fillPoints = []; // 초록 네모 안의 모든 점들
let fillIndex = 0;
let fillFrameSkip = 1; // 점 사이 이동 속도
let fillFrameCounter = 0;

// 로봇, 이미지 전역 변수
let canvasWidth, canvasHeight;

let baseX, baseY;
let link1Length, link2Length;

let imgTop, imgUpper, imgFore;
let topPath, upperPath, forePath;

let currentAngleJoint1 = 0;
let currentAngleJoint2 = 0;
let currentPen = 0;
let minJoint1 = 1e9;
let maxJoint1 = -1e9;
let minJoint2 = 1e9;
let maxJoint2 = -1e9;

const scale = 0.7;
const moreHeight = 100;

const J1_MIN = -30;
const J1_MAX =  180;
const J2_MIN =  40;
const J2_MAX =  160;

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

let paperRect = null;
let maxSquare = null; // 이제 직사각형 정보 저장

// =======================

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

  imageScale = baseImageScale * armScale;
  draw_scale = baseDrawScale * armScale;

  topPath   = spine.images.get("top.png");
  upperPath = spine.images.get("upperarm.png");
  forePath  = spine.images.get("forearm.png");

  imgTop   = p.loadImage(topPath);
  imgUpper = p.loadImage(upperPath);
  imgFore  = p.loadImage(forePath);

  // upperarm 길이
  {
    const dx1 = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X) * imageScale;
    const dy1 = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y) * imageScale;
    link1Length = Math.hypot(dx1, dy1);
  }

  // upperarm 기본 기울기
  {
    const dxImg = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X);
    const dyImg = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y);
    upperRestAngle = Math.atan2(dyImg, dxImg);
  }

  // forearm 길이
  {
    const dx2 = (FORE_PEN_X - FORE_JOINT_ELBOW_X) * imageScale;
    const dy2 = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y) * imageScale;
    link2Length = Math.hypot(dx2, dy2);

    const dxImg2 = (FORE_PEN_X - FORE_JOINT_ELBOW_X);
    const dyImg2 = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y);
    foreRestAngle = Math.atan2(dyImg2, dxImg2);
  }

  // 베이스 위치
  baseX = 800;
  const groundY = canvasHeight - 50;

  if (imgTop) {
    const topH = imgTop.height * imageScale;
    const jointToBottom = topH - TOP_JOINT_Y * imageScale;
    baseY = groundY - jointToBottom;
  } else {
    baseY = groundY - 100;
  }

  precomputeWorkspace();

  // 🔵 더미 paperRect 생성 (워크스페이스 기반)
  const Lsum = link1Length + link2Length;
  const maxReach = Lsum * 0.9;
  const drawCx = baseX;
  const drawCy = baseY - Lsum * 0.6;
  
  paperRect = {
    x: drawCx - maxReach,
    y: drawCy - maxReach,
    w: maxReach * 2,
    h: maxReach * 2,
  };

  // 🔵 최대 직사각형 계산
  maxSquare = findMaxRectangleInPaper();
  
  // 🔵 초록 네모 안의 모든 점 생성
  if (maxSquare) {
    generateFillPoints(maxSquare);
  }

  w2custompopup.resize(canvasWidth + 16, canvasHeight + 96);
  p.createCanvas(canvasWidth, canvasHeight);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function allPointsReachableInRect(cx, cy, width, height, maxGridStep) {
  const halfW = width / 2;
  const halfH = height / 2;

  if (width < 1 || height < 1) {
    return true;
  }

  const stepX = Math.min(maxGridStep, width / 4); 
  const stepY = Math.min(maxGridStep, height / 4);

  for (let x = cx - halfW; x <= cx + halfW + 1e-6; x += stepX) {
    for (let y = cy - halfH; y <= cy + halfH + 1e-6; y += stepY) {
      if (!isReachableSimple(x, y)) {
        return false;
      }
    }
  }
  return true;
}

// =======================
// 워크스페이스 샘플링
// =======================
function precomputeWorkspace() {
  workspacePoints = [];

  const step1 = 3;
  const step2 = 3;

  for (let j1 = J1_MIN; j1 <= J1_MAX; j1 += step1) {
    for (let j2 = J2_MIN; j2 <= J2_MAX; j2 += step2) {
      const theta1 = (j1 * Math.PI / 180) * -1;
      const theta2 = (j2 * Math.PI / 180) * -1;

      const theta1_fk = theta1 + upperRestAngle;

      const x2 = baseX + link1Length * Math.cos(theta1_fk);
      const y2 = baseY + link1Length * Math.sin(theta1_fk);

      const x3 = x2 + link2Length * Math.cos(theta1_fk + theta2);
      const y3 = y2 + link2Length * Math.sin(theta1_fk + theta2);

      workspacePoints.push({ x: x3, y: y3 });
    }
  }
}

// =======================
// 점 도달 가능 여부 판별
// =======================
function isReachableSimple(x, y) {
  const L1 = link1Length;
  const L2 = link2Length;

  const dx = x - baseX;
  const dy = y - baseY;
  const r = Math.hypot(dx, dy);

  if (r > L1 + L2 + 1e-6) return false;
  if (r < Math.abs(L1 - L2) - 1e-6) return false;

  let cos2 = (r * r - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cos2 = Math.max(-1, Math.min(1, cos2));

  const theta2_abs = Math.acos(cos2);
  const theta2_candidates = [theta2_abs, -theta2_abs];

  for (const theta2_fk of theta2_candidates) {
    const k1 = L1 + L2 * Math.cos(theta2_fk);
    const k2 = L2 * Math.sin(theta2_fk);

    const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);
    const theta1 = theta1_fk - upperRestAngle;

    const joint1Deg = -theta1 * 180 / Math.PI;
    const joint2Deg = -theta2_fk * 180 / Math.PI;

    if (
      joint1Deg >= J1_MIN &&
      joint1Deg <= J1_MAX &&
      joint2Deg >= J2_MIN &&
      joint2Deg <= J2_MAX
    ) {
      return true;
    }
  }

  return false;
}

// =======================
// 최대 직사각형 찾기
// =======================
// =======================
// 최대 직사각형 찾기 (최적화 버전)
// =======================
// =======================
// 최대 직사각형 찾기 (최적화 버전)
// =======================
function findMaxRectangleInPaper() {
  if (!paperRect) return null;

  const { x, y, w, h } = paperRect;
  
  let bestArea = 0;
  let bestRect = null;
  
  // 1단계: 대략적인 중심점 찾기 (성긴 그리드)
  const coarseStep = 30;
  const candidates = [];
  
  for (let cx = x + 50; cx < x + w - 50; cx += coarseStep) {
    for (let cy = y + 50; cy < y + h - 50; cy += coarseStep) {
      // 🔵 중심점이 baseX보다 왼쪽에 있고 도달 가능한지 체크
      if (cx < baseX && isReachableSimple(cx, cy)) {
        candidates.push({ cx, cy });
      }
    }
  }
  
  console.log(`Found ${candidates.length} candidate centers`);
  
  // 2단계: 각 후보 중심점에서 최대 직사각형 찾기
  for (const center of candidates) {
    const { cx, cy } = center;
    
    // 🔵 baseX 제약을 고려한 최대 폭 계산
    const maxPossibleWidth = Math.min(w, (baseX - cx) * 2);
    
    // 이진 탐색으로 최대 크기 찾기
    let maxWidth = binarySearchMaxWidth(cx, cy, maxPossibleWidth);
    let maxHeight = binarySearchMaxHeight(cx, cy, maxWidth);
    
    if (maxWidth > 0 && maxHeight > 0) {
      const area = maxWidth * maxHeight;
      if (area > bestArea) {
        bestArea = area;
        bestRect = { cx, cy, width: maxWidth, height: maxHeight };
      }
    }
  }

  console.log("Best rect found:", bestRect);
  return bestRect;
}

// 최대 폭 찾기 (baseX 제약 포함)
function binarySearchMaxWidth(cx, cy, maxPossible) {
  let low = 10;
  let high = maxPossible;
  let maxWidth = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const halfW = mid / 2;
    
    // 🔵 오른쪽 끝이 baseX를 넘지 않는지 체크
    if (cx + halfW >= baseX) {
      high = mid - 1;
      continue;
    }
    
    // 이 폭으로 직사각형을 만들 수 있는지 체크 (높이는 임시로 100 사용)
    if (canFitRectangle(cx, cy, mid, 100)) {
      maxWidth = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return maxWidth;
}

// 최대 높이 찾기
function binarySearchMaxHeight(cx, cy, fixedWidth) {
  let low = 10;
  let high = paperRect.h;
  let maxHeight = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    
    if (canFitRectangle(cx, cy, fixedWidth, mid)) {
      maxHeight = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return maxHeight;
}

// 직사각형이 들어갈 수 있는지 빠르게 체크
function canFitRectangle(cx, cy, width, height) {
  const halfW = width / 2;
  const halfH = height / 2;
  
  // 🔵 오른쪽 끝이 baseX를 넘지 않는지 체크
  if (cx + halfW >= baseX) return false;
  
  // 1) 종이 안에 있는지
  if (cx - halfW < paperRect.x || cx + halfW > paperRect.x + paperRect.w) return false;
  if (cy - halfH < paperRect.y || cy + halfH > paperRect.y + paperRect.h) return false;
  
  // 2) 코너만 체크 (빠른 검증)
  const corners = [
    { x: cx - halfW, y: cy - halfH },
    { x: cx + halfW, y: cy - halfH },
    { x: cx + halfW, y: cy + halfH },
    { x: cx - halfW, y: cy + halfH },
  ];
  
  for (const corner of corners) {
    if (!isReachableSimple(corner.x, corner.y)) return false;
  }
  
  // 3) 변의 중간점 체크
  const edgeMids = [
    { x: cx, y: cy - halfH },
    { x: cx + halfW, y: cy },
    { x: cx, y: cy + halfH },
    { x: cx - halfW, y: cy },
  ];
  
  for (const mid of edgeMids) {
    if (!isReachableSimple(mid.x, mid.y)) return false;
  }
  
  // 4) 성긴 내부 그리드 체크 (크기에 비례)
  const step = Math.max(20, Math.min(width, height) / 5);
  
  for (let x = cx - halfW + step; x < cx + halfW; x += step) {
    for (let y = cy - halfH + step; y < cy + halfH; y += step) {
      if (!isReachableSimple(x, y)) return false;
    }
  }
  
  return true;
}

// 이진 탐색으로 최대 크기 찾기
function binarySearchMaxSize(cx, cy, isWidth) {
  let low = 10;
  let high = isWidth ? paperRect.w : paperRect.h;
  let maxSize = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    
    // 현재 크기로 직사각형을 만들 수 있는지 체크
    const testWidth = isWidth ? mid : maxSize || 100;
    const testHeight = isWidth ? maxSize || 100 : mid;
    
    if (canFitRectangle(cx, cy, testWidth, testHeight)) {
      maxSize = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return maxSize;
}

// 직사각형이 들어갈 수 있는지 빠르게 체크
function canFitRectangle(cx, cy, width, height) {
  const halfW = width / 2;
  const halfH = height / 2;
  
  // 1) 종이 안에 있는지
  if (cx - halfW < paperRect.x || cx + halfW > paperRect.x + paperRect.w) return false;
  if (cy - halfH < paperRect.y || cy + halfH > paperRect.y + paperRect.h) return false;
  
  // 2) 코너만 체크 (빠른 검증)
  const corners = [
    { x: cx - halfW, y: cy - halfH },
    { x: cx + halfW, y: cy - halfH },
    { x: cx + halfW, y: cy + halfH },
    { x: cx - halfW, y: cy + halfH },
  ];
  
  for (const corner of corners) {
    if (!isReachableSimple(corner.x, corner.y)) return false;
  }
  
  // 3) 변의 중간점 체크
  const edgeMids = [
    { x: cx, y: cy - halfH },
    { x: cx + halfW, y: cy },
    { x: cx, y: cy + halfH },
    { x: cx - halfW, y: cy },
  ];
  
  for (const mid of edgeMids) {
    if (!isReachableSimple(mid.x, mid.y)) return false;
  }
  
  // 4) 성긴 내부 그리드 체크 (크기에 비례)
  const step = Math.max(20, Math.min(width, height) / 5);
  
  for (let x = cx - halfW + step; x < cx + halfW; x += step) {
    for (let y = cy - halfH + step; y < cy + halfH; y += step) {
      if (!isReachableSimple(x, y)) return false;
    }
  }
  
  return true;
}

// =======================
// 🔵 직사각형 안의 모든 점 생성 (지그재그 패턴)
// =======================
function generateFillPoints(rect) {
  fillPoints = [];
  
  const { cx, cy, width, height } = rect;
  const halfW = width / 2;
  const halfH = height / 2;
  const spacing = 5; // 점 간격 (픽셀)
  
  // 지그재그로 채우기
  let goingRight = true;
  for (let y = cy - halfH; y <= cy + halfH; y += spacing) {
    if (goingRight) {
      for (let x = cx - halfW; x <= cx + halfW; x += spacing) {
        fillPoints.push({ x, y, pen: 1 });
      }
    } else {
      for (let x = cx + halfW; x >= cx - halfW; x -= spacing) {
        fillPoints.push({ x, y, pen: 1 });
      }
    }
    goingRight = !goingRight;
  }
  
  console.log(`Generated ${fillPoints.length} fill points`);
}

// =======================
// 2DOF 역기구학
// =======================
function inverseKinematics2DOF(targetX, targetY, prevJoint1Deg, prevJoint2Deg) {
  const L1 = link1Length;
  const L2 = link2Length;

  const dx = targetX - baseX;
  const dy = targetY - baseY;

  let d = Math.hypot(dx, dy);
  if (d < 1e-6) d = 1e-6;

  const maxReach = L1 + L2 - 1e-3;
  const minReach = Math.abs(L1 - L2) + 1e-3;
  d = Math.max(minReach, Math.min(maxReach, d));

  let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cos2 = Math.max(-1, Math.min(1, cos2));

  const theta2_fk_abs = Math.acos(cos2);

  const theta2_fk_list = [ theta2_fk_abs, -theta2_fk_abs ];

  function solveFor(theta2_fk) {
    const k1 = L1 + L2 * Math.cos(theta2_fk);
    const k2 = L2 * Math.sin(theta2_fk);

    const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);

    const theta1 = theta1_fk - upperRestAngle;
    const theta2 = theta2_fk;

    const joint1Deg = -theta1 * 180 / Math.PI;
    const joint2Deg = -theta2 * 180 / Math.PI;

    return { joint1: joint1Deg, joint2: joint2Deg };
  }

  let best = null;
  let bestScore = Infinity;

  function score(sol) {
    const d1 = sol.joint1 - prevJoint1Deg;
    const d2 = sol.joint2 - prevJoint2Deg;
    return d1 * d1 + d2 * d2;
  }

  for (const t2 of theta2_fk_list) {
    const sol = solveFor(t2);
    const j1 = sol.joint1;
    const j2 = sol.joint2;

    if (j1 < J1_MIN || j1 > J1_MAX) continue;
    if (j2 < J2_MIN || j2 > J2_MAX) continue;

    if (typeof prevJoint1Deg !== "number" || typeof prevJoint2Deg !== "number") {
      best = sol;
      bestScore = 0;
      break;
    }

    const sc = score(sol);
    if (sc < bestScore) {
      best = sol;
      bestScore = sc;
    }
  }

  if (!best) {
    return {
      reachable: false,
      joint1: prevJoint1Deg,
      joint2: prevJoint2Deg,
    };
  }

  return {
    reachable: true,
    joint1: best.joint1,
    joint2: best.joint2,
  };
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

  // 워크스페이스
  if (workspacePoints.length > 0) {
    p.push();
    p.stroke(0, 150, 255, 80);
    p.strokeWeight(2);
    for (const wp of workspacePoints) {
      p.point(wp.x, wp.y);
    }
    p.pop();
  }

  // 종이 영역
  if (paperRect) {
    p.push();
    p.noFill();
    p.stroke(150);
    p.strokeWeight(2);
    p.rect(paperRect.x, paperRect.y, paperRect.w, paperRect.h);
    p.pop();
  }

  // 최대 직사각형
  if (maxSquare) {
    p.push();
    p.noFill();
    p.stroke(0, 200, 0);
    p.strokeWeight(3);
    p.rectMode(p.CENTER);
    p.rect(maxSquare.cx, maxSquare.cy, maxSquare.width, maxSquare.height);
    p.rectMode(p.CORNER);
    p.pop();
  }

  // ======================
  // 1) 각도 / 펜 상태 업데이트
  // ======================
  if (zeroPoseFrames > 0) {
    currentAngleJoint1 = 0;
    currentAngleJoint2 = 0;
    currentPen = 0;
    zeroPoseFrames--;
  } else if (isPlaying && fillPoints.length > 0) {
    // 🔵 초록 네모 채우기
    const pt = fillPoints[fillIndex];

    fillFrameCounter++;
    if (fillFrameCounter >= fillFrameSkip) {
      fillFrameCounter = 0;
      fillIndex++;
      if (fillIndex >= fillPoints.length) {
        fillIndex = fillPoints.length - 1;
        isPlaying = false; // 완료
      }
    }

    const ik = inverseKinematics2DOF(
      pt.x,
      pt.y,
      currentAngleJoint1,
      currentAngleJoint2
    );
    
    if (ik.reachable) {
      let j1 = trunc1(ik.joint1);
      let j2 = trunc1(ik.joint2);

      currentAngleJoint1 = j1;
      currentAngleJoint2 = j2;
      currentPen = pt.pen;
    } else {
      currentPen = 0;
    }
  }

  // 관절 각도
  const theta1 = p.radians(currentAngleJoint1) * -1;
  const theta2 = p.radians(currentAngleJoint2) * -1;

  const theta1_fk = theta1 + upperRestAngle;

  // 포워드 키네매틱스
  const x2 = baseX + link1Length * p.cos(theta1_fk);
  const y2 = baseY + link1Length * p.sin(theta1_fk);

  const x3 = x2 + link2Length * p.cos(theta1_fk + theta2);
  const y3 = y2 + link2Length * p.sin(theta1_fk + theta2);

  // upper arm 렌더링
  if (imgUpper) {
    p.push();
    p.translate(baseX, baseY);
    p.rotate(theta1);
    p.scale(imageScale);
    p.image(imgUpper, -UPPER_JOINT_BASE_X, -UPPER_JOINT_BASE_Y);
    p.pop();
  }

  // forearm 렌더링
  if (imgFore) {
    p.push();
    p.translate(x2, y2);

    const foreRotate = theta1_fk + theta2 - foreRestAngle;
    p.rotate(foreRotate);

    p.scale(imageScale);
    p.image(imgFore, -FORE_JOINT_ELBOW_X, -FORE_JOINT_ELBOW_Y);
    p.pop();
  }

  // top 렌더링
  if (imgTop) {
    p.push();
    p.translate(baseX, baseY);
    p.scale(imageScale);
    p.image(imgTop, -TOP_JOINT_X, -TOP_JOINT_Y);
    p.pop();
  }

  // 펜 좌표
  const penX = x3;
  const penY = y3;

  // 궤적
  trailPoints.push({ x: penX, y: penY, pen: currentPen });

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

  // 디버그 텍스트
  if (debugFrame > 5) {
    minJoint1 = Math.min(minJoint1, currentAngleJoint1);
    maxJoint1 = Math.max(maxJoint1, currentAngleJoint1);
    minJoint2 = Math.min(minJoint2, currentAngleJoint2);
    maxJoint2 = Math.max(maxJoint2, currentAngleJoint2);   
  }
 
  p.push();
  p.fill(0);
  p.textSize(12);
  p.text(`J1: ${currentAngleJoint1.toFixed(1)} deg`, 50, 50);
  p.text(`J2: ${currentAngleJoint2.toFixed(1)} deg`, 50, 70);
  p.text(`L1: ${link1Length.toFixed(0)}px`, 50, 90);
  p.text(`L2: ${link2Length.toFixed(0)}px`, 50, 110);
  p.text(isPlaying ? "Playing" : "Completed", 50, 150);
  p.text(`Pen: ${currentPen}`, 50, 170);
  p.text(`Fill pts: ${fillPoints.length}`, 50, 190);
  p.text(`Fill idx: ${fillIndex}`, 50, 210);
  p.text(`MIN JOINT1: ${minJoint1.toFixed(1)} deg`, 50, 230);
  p.text(`MAX JOINT1: ${maxJoint1.toFixed(1)} deg`, 50, 250);
  p.text(`MIN JOINT2: ${minJoint2.toFixed(1)} deg`, 50, 270);
  p.text(`MAX JOINT2: ${maxJoint2.toFixed(1)} deg`, 50, 290);
  p.text(`MAX RECT: ${maxSquare ? maxSquare.width.toFixed(0) : 0}x${maxSquare ? maxSquare.height.toFixed(0) : 0} px`, 50, 310);
  p.text(`AREA: ${maxSquare ? (maxSquare.width * maxSquare.height).toFixed(0) : 0} px²`, 50, 330);
  p.pop();
}