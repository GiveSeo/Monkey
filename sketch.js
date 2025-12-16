function sketch() {
  openRobotPopup();

  new p5((p) => {
    p.setup = () => setupSimulator(p);
    p.draw = () => drawSimulator(p);
  }, "p5-canvas");
}

function normalizeAngle(angle) {
  // angle을 -180 ~ 180 범위로 정규화
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}
// 순방향 운동학 함수 (각도 → 펜 좌표)
function fkPenXY_deg(j1Deg, j2Deg) {
  const theta1 = (j1Deg * Math.PI / 180) * -1;

  const physicalJ2 = j2Deg + JOINT2_OFFSET;
  const theta2 = (physicalJ2 * Math.PI / 180) * -1;

  const theta1_fk = theta1 + upperRestAngle;

  const x2 = baseX + link1Length * Math.cos(theta1_fk);
  const y2 = baseY + link1Length * Math.sin(theta1_fk);

  const x3 = x2 + link2Length * Math.cos(theta1_fk + theta2);
  const y3 = y2 + link2Length * Math.sin(theta1_fk + theta2);

  return { x: x3, y: y3 };
}
// 시간 보장 변수
let lastJsonStepTime = 0;
const JSON_STEP_MS = 10;

// 그리기 모드
let drawMode = 0;


const FAST_STEPS_PER_FRAME = 5000; // 빠른 재생시 프레임당 최대 스텝 수
let bakedOnce = false; // 한번에 그릴 것인지 여부
// =======================
// 로봇 JSON 관련 전역
// =======================

// 실제 로봇용 스텝 증분 JSON
//   d1: joint1 step 증분
//   d2: joint2 step 증분
//   pen: 0(업), 1(다운)
let jsonBuilt = false;
let jsonIndex = 0;

// 실제 로봇팔 스케일
const SVG_BOX_SIZE = 250;
// =======================
// 기존 전역 변수들
// =======================
const MAX_DELTA_DEG = STEP_DEG * MAX_STEPS_PT; // 0.07도
const JOINT2_OFFSET = 143; // joint2가 0도일 때, 팔이 ㄷ자 모양이 되도록 오프셋 각도

let STEP = 1; // SVG 길이 기준 샘플링 단위(px)
let drawScale = 0.4; // SVG → 로봇 스케일
let svgPathPoints = []; // 최종: 로봇 좌표계 (x, y, pen)


// 이미지 기준 기본 각도
let upperRestAngle = 0; // upperarm 이미지 기울어진 각도
let foreRestAngle = 0; // forearm 이미지 기울어진 각도

// SVG를 모션 기준으로 쓸지 여부 + 인덱스/속도

// 로봇 관련 전역 변수
let canvasWidth, canvasHeight;

let baseX, baseY; // Joint 1 x,y 좌표
let link1Length, link2Length;

let imgTop, imgUpper, imgFore;
let topPath, upperPath, forePath;

let currentAngleJoint1 = 0; // 로봇 팔 joint1 각도
let currentAngleJoint2 = 0; // 로봇 팔 joint2 각도

// 관절 범위 (path로 인해 한번 이상 이동해야 정상적인 관절 범위 확인 가능)
let minJoint1 = 1e9;
let maxJoint1 = -1e9;
let minJoint2 = 1e9;
let maxJoint2 = -1e9;

const scale = 0.7; // 전체 캔버스 스케일
const moreHeight = 100;
const imageScale = 0.5; // PNG 이미지 자체 스케일

//spine 모델에서 최솟값, 최댓값 추출
const J1_MIN = plutto.minJoint1;
const J1_MAX = plutto.maxJoint1;

// 진짜 최소/최대 정렬
const J2_MIN = plutto.minJoint2;
const J2_MAX = plutto.maxJoint2;

// 이미지 기준 팔 관절 픽셀 좌표 (길이 구하거나, 각도 측정시 필요)
const TOP_JOINT_X = 220;
const TOP_JOINT_Y = 547;

const UPPER_JOINT_BASE_X = 747;
const UPPER_JOINT_BASE_Y = 226;
const UPPER_JOINT_ELBOW_X = 195;
const UPPER_JOINT_ELBOW_Y = 383;

const FORE_JOINT_ELBOW_X = 195;
const FORE_JOINT_ELBOW_Y = 385;
const FORE_PEN_X = 778;
const FORE_PEN_Y = 612;

// 재생 관련 상태
let isPlaying = false;
let debugFrame = 0;

// 궤적을 '구워둘' 레이어 & 이전 펜 위치(화면 좌표 기준)
let trailLayer = null;
let prevPenScreenX = null;
let prevPenScreenY = null;
let prevPenState = 0;

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

function playJsonStep() {
  if (jsonIndex >= plutto.motionJson.length) {
    return;
  }

  const cmd = plutto.motionJson[jsonIndex];

  // d1, d2는 step 증분이니까 각도로 변환
  const deltaDeg1 = cmd.d1 * STEP_DEG;
  const deltaDeg2 = cmd.d2 * STEP_DEG;

  // 각도 적용
  currentAngleJoint1 += normalizeAngle(deltaDeg1);
  currentAngleJoint2 += normalizeAngle(deltaDeg2);

  // 관절 제한 클램프 (혹시라도 JSON이 범위 넘어가면 잘라줌)
  currentAngleJoint1 = Math.max(J1_MIN, Math.min(J1_MAX, currentAngleJoint1));
  currentAngleJoint2 = Math.max(J2_MIN, Math.min(J2_MAX, currentAngleJoint2));

  // 펜 상태 반영
  $('pen').d = cmd.pen;

  // 엔코더 값도 같이 업데이트
  $("encoder.joint_1").d = currentAngleJoint1;
  $("encoder.joint_2").d = currentAngleJoint2;

  jsonIndex++;
}

function playJsonSteps(n) {
  for (let i = 0; i < n; i++) {
    if (jsonIndex >= plutto.motionJson.length) return false;
    playJsonStep();
  }
  return true;
}

function startJsonPlayback(jsonData) {
  if (jsonData) {
    plutto.motionJson = jsonData;
  }
  jsonIndex = 0;
  isPlaying = false;
  bakedOnce = false;

  // 초기화: 홈에서 시작한다고 가정 (필요하면 홈 각도로 바꾸기)
  currentAngleJoint1 = 0;
  currentAngleJoint2 = 0;
  $('pen').d = 0;

  prevPenScreenX = null;
  prevPenScreenY = null;
  prevPenState = 0;

  if (trailLayer) {
    trailLayer.clear();
  }
}
// 한번에 그리기 함수
function bakeAllToTrailLayer() {
  if (bakedOnce) return;
  bakedOnce = true;

  // ✅ playback 상태만 수동 리셋
  jsonIndex = 0;
  currentAngleJoint1 = 0;
  currentAngleJoint2 = 0;
  $('pen').d = 0;

  prevPenScreenX = null;
  prevPenScreenY = null;
  prevPenState = 0;

  if (trailLayer) trailLayer.clear();

  let prevX = null, prevY = null, prevPen = 0;

  while (jsonIndex < plutto.motionJson.length) {
    playJsonStep();

    const pos = fkPenXY_deg(currentAngleJoint1, currentAngleJoint2);
    const x = pos.x * scale;
    const y = pos.y * scale;

    if (prevX !== null && prevY !== null && prevPen === 1 && $('pen').d === 1) {
      trailLayer.push();
      trailLayer.stroke(255, 0, 0);
      trailLayer.strokeWeight(2);
      trailLayer.line(prevX, prevY, x, y);
      trailLayer.pop();
    }

    prevX = x;
    prevY = y;
    prevPen = $('pen').d;
  }

  isPlaying = false;
  drawMode = 0; 
  $('pen').d = 0;
  prevPenState = 0;
  prevPenScreenX = null;
  prevPenScreenY = null;  // ✅ 끝나면 수동 모드로
}

// p5 setup 함수
function setupSimulator(p) {
  canvasWidth = 1200 * scale + 400;
  canvasHeight = 800 * scale + moreHeight;

  p.frameRate(100);

  // Spine에서 이미지 경로 얻기 / 역방향 이미지
  topPath = spine.images.get("top_reverse.png");
  upperPath = spine.images.get("upperarm_reverse.png");
  forePath = spine.images.get("forearm_reverse.png");

  // p5 이미지 로딩
  imgTop = p.loadImage(topPath);
  imgUpper = p.loadImage(upperPath);
  imgFore = p.loadImage(forePath);

  // 링크 길이 및 기본 각도 계산
  initLinkGeometry();

  // 베이스 위치 계산
  initBasePosition();

  // trailLayer 생성 (캔버스와 같은 크기, 투명 배경)
  trailLayer = p.createGraphics(canvasWidth, canvasHeight);
  trailLayer.clear();

  // ✅ 여기서 SVG loadStrings(Spine 경로로 읽기) 제거
  //    (드롭 이벤트에서 rebuildFromSvgText(svgText) 호출할 것)

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

    const dxImg = UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X;
    const dyImg = UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y;
    upperRestAngle = Math.atan2(dyImg, dxImg); // 이미지 상의 방향(rad)
  }

  // forearm 길이 각도
  {
    const dx = (FORE_PEN_X - FORE_JOINT_ELBOW_X) * imageScale;
    const dy = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y) * imageScale;
    link2Length = Math.hypot(dx, dy);

    const dxImg2 = FORE_PEN_X - FORE_JOINT_ELBOW_X;
    const dyImg2 = FORE_PEN_Y - FORE_JOINT_ELBOW_Y;
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

// 2DOF 역기구학 함수
function inverseKinematics2DOF(targetX, targetY, prevJ1Deg, prevJ2Deg) {
  const L1 = link1Length;
  const L2 = link2Length;

  const dx = targetX - baseX;
  const dy = targetY - baseY;
  let d = Math.hypot(dx, dy);
  if (d < 1e-6) d = 1e-6;

  // 작업 영역 체크
  const maxReach = L1 + L2 - 1e-3;
  const minReach = Math.abs(L1 - L2) + 1e-3;

  // 도달 불가능하면 null 반환
  if (d > maxReach || d < minReach) {
    return null;
  }

  let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cos2 = Math.max(-1, Math.min(1, cos2));

  const theta2Abs = Math.acos(cos2);
  const theta2List = [theta2Abs, -theta2Abs];

  function solve(theta2_fk) {
    const k1 = L1 + L2 * Math.cos(theta2_fk);
    const k2 = L2 * Math.sin(theta2_fk);
    const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);

    const theta1 = theta1_fk - upperRestAngle;
    const theta2 = theta2_fk;

    const joint1DegPhysical = (-theta1 * 180) / Math.PI;
    const joint2DegPhysical = (-theta2 * 180) / Math.PI;

    // 기존 내부 기준
    const joint1Old = joint1DegPhysical;
    const joint2Old = -(joint2DegPhysical - JOINT2_OFFSET);

    // 새 논리 기준: 시계 -, 반시계 +
    const joint1Deg = normalizeAngle(joint1Old);
    const joint2Deg = normalizeAngle(-joint2Old);

    return { joint1: joint1Deg, joint2: joint2Deg };
  }

  const solA = solve(theta2List[0]);
  const solB = solve(theta2List[1]);

  // 관절 제한 체크
  const aValid =
    solA.joint1 >= J1_MIN &&
    solA.joint1 <= J1_MAX &&
    solA.joint2 >= J2_MIN &&
    solA.joint2 <= J2_MAX;
  const bValid =
    solB.joint1 >= J1_MIN &&
    solB.joint1 <= J1_MAX &&
    solB.joint2 >= J2_MIN &&
    solB.joint2 <= J2_MAX;

  if (!aValid && !bValid) {
    return null; // 둘 다 범위 밖
  }

  // 이전 각도가 없으면 유효한 해 반환
  if (typeof prevJ1Deg !== "number" || typeof prevJ2Deg !== "number") {
    return aValid ? solA : solB;
  }

  // 연속성 기준 선택 (유효한 해만 고려)
  function score(sol) {
    const d1 = normalizeAngle(sol.joint1 - prevJ1Deg);
    const d2 = normalizeAngle(sol.joint2 - prevJ2Deg);
    return d1 * d1 + d2 * d2;
  }

  if (aValid && bValid) {
    return score(solB) < score(solA) ? solB : solA;
  }

  return aValid ? solA : solB;
}

//p5 draw 함수
function drawSimulator(p) {
  debugFrame++;


  if (drawMode === 0) {
    // ---------- 수동 모드 ----------
    // 자동 재생 끄기
    isPlaying = false;
    // 대시보드에서 조절한 엔코더 값을 현재 각도로 사용
    const enc1 = $("encoder.joint_1").d;
    const enc2 = $("encoder.joint_2").d;

    currentAngleJoint1 = normalizeAngle(enc1);
    currentAngleJoint2 = normalizeAngle(enc2);
  } else if (drawMode === 1) {
    // ---------- 자동 모드 ----------
    isPlaying = true;
    p.frameRate(100);
  } else if (drawMode === 2) {
    // ---------- 빠르게 그리기 -------
    isPlaying = true;
    p.frameRate(200);
  } else if (drawMode === 3) {
    // ---------- 한번에 결과보기 -----
    isPlaying = false;
  }

  // 배경
  p.background(245);

  // 먼저, 이미 '구워둔' 궤적 레이어를 그대로 그린다 (scale 적용 X)
  if (trailLayer) {
    p.image(trailLayer, 0, 0);
  }

  // 이후부터는 기존처럼 scale 적용
  p.scale(scale);

  // 1) 모션 소스 선택 (JSON or SVG)
  if (plutto.motionJson.length > 0) {
    if (drawMode === 3) {
    }
    else if (drawMode === 1) {
      const now = p.millis();
      if (now - lastJsonStepTime >= JSON_STEP_MS) {
        playJsonStep();
        lastJsonStepTime = now;
      }
    }
    else if (drawMode === 2) {
      playJsonSteps(FAST_STEPS_PER_FRAME);
    }
  }

  // 2) Forward Kinematics (현재 joint 각도로 포즈 계산)
  const theta1 = p.radians(currentAngleJoint1) * -1;

  //    joint2: 새 기준(0이었던 곳이 140)이므로,
  //    물리각 = currentAngleJoint2 + 140
  const physicalJ2 = currentAngleJoint2 + JOINT2_OFFSET;
  const theta2 = p.radians(physicalJ2) * -1;

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

  // 6) 펜 위치 & 궤적 trailLayer에 '굽기'
  const penX = x3;
  const penY = y3;

  if (trailLayer) {
    const penScreenX = penX * scale;
    const penScreenY = penY * scale;

    if (
      prevPenScreenX !== null &&
      prevPenScreenY !== null &&
      prevPenState === 1 &&
      $('pen').d === 1
    ) {
      trailLayer.push();
      trailLayer.stroke(255, 0, 0);
      trailLayer.strokeWeight(2);
      trailLayer.noFill();
      trailLayer.line(prevPenScreenX, prevPenScreenY, penScreenX, penScreenY);
      trailLayer.pop();
    }

    prevPenScreenX = penScreenX;
    prevPenScreenY = penScreenY;
    prevPenState = $('pen').d;
  }

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
  p.text(`J1: ${currentAngleJoint1.toFixed(2)} deg`, 50, 50);
  p.text(`J2: ${currentAngleJoint2.toFixed(2)} deg`, 50, 70);
  p.text(`L1: ${link1Length.toFixed(0)}px`, 50, 90);
  p.text(`L2: ${link2Length.toFixed(0)}px`, 50, 110);
  p.text(`Pen X: ${x3.toFixed(1)} px`, 50, 130);  // ★ 추가
  p.text(`Pen Y: ${y3.toFixed(1)} px`, 50, 150); // ★ 추가

  p.text(isPlaying ? "Playing" : "Paused", 50, 170);
  p.text(`Pen: ${$('pen').d}`, 50, 190);
  p.text(`MIN J1: ${minJoint1.toFixed(2)}`, 50, 290);
  p.text(`MAX J1: ${maxJoint1.toFixed(2)}`, 50, 310);
  p.text(`MIN J2: ${minJoint2.toFixed(2)}`, 50, 330);
  p.text(`MAX J2: ${maxJoint2.toFixed(2)}`, 50, 350);
  p.pop();
}