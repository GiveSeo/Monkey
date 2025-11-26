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
const J2_MIN =  0;
const J2_MAX =  130;

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
function findMaxRectangleInPaper() {
  if (!paperRect) return null;

  const { x, y, w, h } = paperRect;
  const cx = x + w / 2;
  const cy = y + h / 2;

  let bestArea = 0;
  let bestRect = null;
  const widthStep = 5;
  const heightStep = 5;
  const maxGridStep = 8;

  // 가능한 모든 폭/높이 조합 탐색
  for (let width = 10; width <= w; width += widthStep) {
    for (let height = 10; height <= h; height += heightStep) {
      const halfW = width / 2;
      const halfH = height / 2;

      const corners = [
        { x: cx - halfW, y: cy - halfH }, // 좌상
        { x: cx + halfW, y: cy - halfH }, // 우상
        { x: cx + halfW, y: cy + halfH }, // 우하
        { x: cx - halfW, y: cy + halfH }, // 좌하
      ];

      // 1) 직사각형이 종이 안에 완전히 들어가야 함
      let insidePaper = corners.every(
        (p) =>
          p.x >= x && p.x <= x + w &&
          p.y >= y && p.y <= y + h
      );
      if (!insidePaper) continue;

      // 2) 경계 점들 빠른 체크
      const edgeMids = [
        { x: cx,         y: cy - halfH }, // 상 변 중앙
        { x: cx + halfW, y: cy },         // 우 변 중앙
        { x: cx,         y: cy + halfH }, // 하 변 중앙
        { x: cx - halfW, y: cy },         // 좌 변 중앙
      ];

      const boundaryPoints = corners.concat(edgeMids);
      let boundaryOK = boundaryPoints.every((p) => isReachableSimple(p.x, p.y));
      if (!boundaryOK) continue;

      // 3) 내부 전체 그리드 샘플링
      if (!allPointsReachableInRect(cx, cy, width, height, maxGridStep)) {
        continue;
      }

      // 면적 계산
      const area = width * height;
      if (area > bestArea) {
        bestArea = area;
        bestRect = { cx, cy, width, height };
      }
    }
  }

  return bestRect;
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