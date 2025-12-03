function sketch() {
  openRobotPopup();

  new p5((p) => {
    p.setup = () => setupSimulator(p);
    p.draw  = () => drawSimulator(p);
  }, "p5-canvas");
}

function normalizeAngle(angle) {
  // angle을 -180 ~ 180 범위로 정규화
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

// =======================
// 로봇 JSON 관련 전역
// =======================

// 실제 로봇용 스텝 증분 JSON
//   d1: joint1 step 증분
//   d2: joint2 step 증분
//   pen: 0(업), 1(다운)
let motionJson    = [];
let jsonBuilt     = false;
let useJsonMotion = false; // 기본은 SVG 모션 사용
let jsonIndex     = 0;

// =======================
// 기존 전역 변수들
// =======================
let STEP_DEG = 0.01; // 1스탭당 몇도인지
const MAX_STEPS_PT   = 8;                 // point -> point 최대 8 step
const MAX_DELTA_DEG  = STEP_DEG * MAX_STEPS_PT; // 0.08도
const JOINT2_OFFSET = 140;


let STEP          = 2; // SVG 길이 기준 샘플링 단위(px)
let FILENAME      = "Cat.svg";
let drawScale     = 0.4;   // SVG → 로봇 스케일
let svgPathPoints = [];    // 최종: 로봇 좌표계 (x, y, pen)


// scale x,y offset
let Xoffset = +140;
let Yoffset = -50;

// 이미지 기준 기본 각도
let upperRestAngle = 0; // upperarm 이미지 기울어진 각도
let foreRestAngle  = 0; // forearm 이미지 기울어진 각도

// SVG를 모션 기준으로 쓸지 여부 + 인덱스/속도

// 로봇 관련 전역 변수
let canvasWidth, canvasHeight;

let baseX, baseY;       // Joint 1 x,y 좌표
let link1Length, link2Length;

let imgTop, imgUpper, imgFore;
let topPath, upperPath, forePath;

let currentAngleJoint1 = -90;
let currentAngleJoint2 = 0;
let currentPen         = 0; // 0: 펜 업, 1: 펜 다운

let targetAngleJoint1 = 0;
let targetAngleJoint2 = 0;
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

// 진짜 최소/최대 정렬
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
let isPlaying   = true;
let trailPoints = []; // 디버그용
let debugFrame  = 0;

// ✅ 궤적을 '구워둘' 레이어 & 이전 펜 위치(화면 좌표 기준)
let trailLayer      = null;
let prevPenScreenX  = null;
let prevPenScreenY  = null;
let prevPenState    = 0;

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
  if (jsonIndex >= motionJson.length) return;

  const cmd = motionJson[jsonIndex];

  // d1, d2는 step 증분이니까 각도로 변환
  const deltaDeg1 = cmd.d1 * STEP_DEG;
  const deltaDeg2 = cmd.d2 * STEP_DEG;

  // 각도 적용
  currentAngleJoint1 += normalizeAngle(deltaDeg1);
  currentAngleJoint2 += normalizeAngle(deltaDeg2);

  // 관절 제한 클램프 (혹시라도 JSON이 범위 넘어가면 잘라줌)
  currentAngleJoint1 = Math.max(J1_MIN, Math.min(J1_MAX, currentAngleJoint1));
  //currentAngleJoint2 = Math.max(J2_MIN, Math.min(J2_MAX, currentAngleJoint2));

  // 펜 상태 반영
  currentPen = cmd.pen;

  // 엔코더 값도 같이 업데이트
  $("encoder.joint_1").d = currentAngleJoint1;
  $("encoder.joint_2").d = currentAngleJoint2;

  jsonIndex++;
}
function startJsonPlayback(jsonData) {
  if (jsonData) {
    motionJson = jsonData;
  }
  jsonIndex     = 0;
  useJsonMotion = true;
  isPlaying     = true;

  // 초기화: 홈에서 시작한다고 가정 (필요하면 홈 각도로 바꾸기)
  currentAngleJoint1 = 0;
  currentAngleJoint2 = 0;
  currentPen         = 0;

  prevPenScreenX = null;
  prevPenScreenY = null;
  prevPenState   = 0;

  if (trailLayer) {
    trailLayer.clear();
  }
}

function buildMotionJsonFromSvg() {
  if (jsonBuilt) return;
  if (!svgPathPoints || svgPathPoints.length === 0) return;

  console.log("🔧 motionJson 생성 시작...");
  motionJson = [];

  // =========================================================
  // 1. 초기 설정 (홈 위치 0,0)
  // =========================================================
  let curStepJ1 = 0;
  let curStepJ2 = 0;
  let prevPen   = 0;

  // 관절 제한 (도 → step) 변환
  const j1MinStep = Math.round(J1_MIN / STEP_DEG);
  const j1MaxStep = Math.round(J1_MAX / STEP_DEG);
  const j2MinStep = Math.round(J2_MIN / STEP_DEG);
  const j2MaxStep = Math.round(J2_MAX / STEP_DEG);

  // IK 연속성을 위한 이전 각도 변수
  let prevJ1Deg = 0;
  let prevJ2Deg = 0;

  // =========================================================
  // 보조 함수: 두 스텝 위치 사이를 MAX_STEPS_PT 이하로 분할하여 이동
  // =========================================================
  function moveToTarget(targetJ1, targetJ2, penState) {
    const totalDiff1 = targetJ1 - curStepJ1;
    const totalDiff2 = targetJ2 - curStepJ2;

    const maxDiff = Math.max(Math.abs(totalDiff1), Math.abs(totalDiff2));
    
    if (maxDiff === 0) {
      // 움직임이 없지만 펜 상태가 바뀌었다면 기록
      if (penState !== prevPen) {
        motionJson.push({
          d1: 0,
          d2: 0,
          pen: penState,
        });
        prevPen = penState;
      }
      return;
    }

    // MAX_STEPS_PT(8)를 초과하면 분할
    const stepsNeeded = Math.ceil(maxDiff / MAX_STEPS_PT);

    // 안전장치: 너무 많이 분할되는 경우 제한
    if (stepsNeeded > 1000) {
      console.warn(`⚠️ 과도한 분할 감지 (${stepsNeeded}), 100으로 제한`);
      stepsNeeded = 100;
    }

    let accumulatedJ1 = 0;
    let accumulatedJ2 = 0;

    for (let i = 1; i <= stepsNeeded; i++) {
      // 선형 보간으로 중간 지점 계산
      const t = i / stepsNeeded;

      // 목표 누적 증분 계산
      const targetAccJ1 = Math.round(totalDiff1 * t);
      const targetAccJ2 = Math.round(totalDiff2 * t);

      // 이번 스텝의 실제 증분
      const d1 = targetAccJ1 - accumulatedJ1;
      const d2 = targetAccJ2 - accumulatedJ2;

      // 누적값 업데이트
      accumulatedJ1 = targetAccJ1;
      accumulatedJ2 = targetAccJ2;

      // 마지막 구간에서만 penState 적용
      const currentPen = penState;

      // 움직임이 있거나 펜 상태가 변경되었을 때만 JSON 추가
      if (d1 !== 0 || d2 !== 0 || currentPen !== prevPen) {
        motionJson.push({
          d1: d1,
          d2: d2,
          pen: currentPen,
        });
        prevPen = currentPen;
      }

      // 현재 위치 업데이트
      curStepJ1 += d1;
      curStepJ2 += d2;
    }
  }

  // =========================================================
  // 2. Home(0,0) -> 첫 번째 포인트 이동 경로 생성
  // =========================================================
  if (svgPathPoints.length > 0) {
    const firstPt = svgPathPoints[0];
    const firstIk = inverseKinematics2DOF(firstPt.x, firstPt.y, 0, 0);

    if (firstIk) {
      let targetStartJ1 = Math.round(firstIk.joint1 / STEP_DEG);
      let targetStartJ2 = Math.round(firstIk.joint2 / STEP_DEG);

      targetStartJ1 = Math.max(j1MinStep, Math.min(j1MaxStep, targetStartJ1));
      targetStartJ2 = Math.max(j2MinStep, Math.min(j2MaxStep, targetStartJ2));

      console.log(`📍 Home(0,0) → 첫 포인트(${targetStartJ1}, ${targetStartJ2})`);
      moveToTarget(targetStartJ1, targetStartJ2, 0);

      prevJ1Deg = firstIk.joint1;
      prevJ2Deg = firstIk.joint2;
    }
  }

  // =========================================================
  // 3. SVG 경로 따라가기
  // =========================================================
  let processedPoints = 0;
  const totalPoints = svgPathPoints.length;
  const logInterval = Math.max(1, Math.floor(totalPoints / 10)); // 10% 단위로 로그

  for (let idx = 0; idx < svgPathPoints.length; idx++) {
    const pt = svgPathPoints[idx];

    // 진행상황 로그
    if (idx % logInterval === 0) {
      console.log(`📊 진행: ${idx}/${totalPoints} (${Math.round(idx/totalPoints*100)}%)`);
    }

    // IK로 joint 각도(도) 계산
    const ik = inverseKinematics2DOF(pt.x, pt.y, prevJ1Deg, prevJ2Deg);

    if (!ik) {
      console.warn(`⚠️ IK 실패, 포인트 ${idx} 스킵`, pt);
      continue;
    }

    // 각도(도) → step (정수)
    let targetStepJ1 = Math.round(ik.joint1 / STEP_DEG);
    let targetStepJ2 = Math.round(ik.joint2 / STEP_DEG);

    // 관절 제한 적용
    targetStepJ1 = Math.max(j1MinStep, Math.min(j1MaxStep, targetStepJ1));
    targetStepJ2 = Math.max(j2MinStep, Math.min(j2MaxStep, targetStepJ2));

    // 목표 위치로 이동
    moveToTarget(targetStepJ1, targetStepJ2, pt.pen);

    // 상태 업데이트
    prevJ1Deg = ik.joint1;
    prevJ2Deg = ik.joint2;
    processedPoints++;
  }

  jsonBuilt = true;
  
  console.log(`✅ motionJson 생성 완료!`);
  console.log(`   - 총 ${motionJson.length}개 명령`);
  console.log(`   - 처리된 포인트: ${processedPoints}/${totalPoints}`);
  console.log(`   - 모든 움직임 ≤ ${MAX_STEPS_PT} step 보장`);
  console.log("");
  console.log("=== JSON 출력 시작 ===");
  console.log(JSON.stringify(motionJson));
  console.log("=== JSON 출력 끝 ===");
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

  // ✅ trailLayer 생성 (캔버스와 같은 크기, 투명 배경)
  trailLayer = p.createGraphics(canvasWidth, canvasHeight);
  trailLayer.clear();

  // SVG 로드 & 점 추출 → 작업공간으로 맵핑
  const svgPath = spine.images.get(FILENAME); // Spine에 등록된 SVG 경로
  p.loadStrings(svgPath, (lines) => {
    const svgText  = lines.join("\n");
    const rawPts   = extractPathPointsFromSvg(svgText, STEP);  // SVG 원 좌표
    let fittedPts  = fitSvgPointsToWorkspaceSafe(rawPts);          // 로봇 좌표계로 매핑

    // 필요하면 거리/각도 리샘플링 추가
    // fittedPts = resamplePathByDistance(fittedPts, 4);
    fittedPts = resamplePathByAngle(fittedPts, MAX_DELTA_DEG);

    svgPathPoints = fittedPts;

    // ✅ 1) SVG → 로봇용 JSON 생성
    buildMotionJsonFromSvgSafe();

    // ✅ 2) 시뮬레이터를 JSON 기준으로 돌려보고 싶다면:
    startJsonPlayback();
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
function extractPathPointsFromSvg(svgText, sampleStep = 0.02) {
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

    // 일정 단위로 샘플링
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

// 각도 변화량 기준 리샘플링
function resamplePathByAngle(points, maxDeltaDeg = MAX_DELTA_DEG) {
  if (!points || points.length === 0) return [];

  const result = [];

  // 첫 점 IK
  const first = points[0];
  let prevIK = inverseKinematics2DOF(first.x, first.y, null, null);
  if (!prevIK) {
    console.warn("IK failed at first point in resamplePathByAngle");
    return points;
  }
  result.push({ x: first.x, y: first.y, pen: first.pen });

  function subdivide(p0, ik0, p1, depth = 0) {
    // 재귀 깊이 제한
    if (depth > 20) {
      const ik1_fallback = inverseKinematics2DOF(p1.x, p1.y, ik0.joint1, ik0.joint2) || ik0;
      return [{ point: p1, ik: ik1_fallback }];
    }

    const ik1 = inverseKinematics2DOF(p1.x, p1.y, ik0.joint1, ik0.joint2);
    if (!ik1) {
      return [{ point: p1, ik: ik0 }];
    }

    const d1 = Math.abs(ik1.joint1 - ik0.joint1);
    const d2 = Math.abs(ik1.joint2 - ik0.joint2);
    const maxDelta = Math.max(d1, d2);

    if (maxDelta <= maxDeltaDeg) {
      return [{ point: p1, ik: ik1 }];
    }

    // 각도 변화 너무 크면 중간점 삽입
    const mid = {
      x: (p0.x + p1.x) / 2,
      y: (p0.y + p1.y) / 2,
      pen: p1.pen,
    };

    const ikMid = inverseKinematics2DOF(mid.x, mid.y, ik0.joint1, ik0.joint2);
    if (!ikMid) {
      return [{ point: p1, ik: ik1 }];
    }

    const left  = subdivide(p0,  ik0,   mid, depth + 1);
    const right = subdivide(mid, ikMid, p1, depth + 1);
    return [...left, ...right];
  }

  let prevPoint = first;

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const segPoints = subdivide(prevPoint, prevIK, curr);
    for (const sp of segPoints) {
      result.push({
        x: sp.point.x,
        y: sp.point.y,
        pen: curr.pen,
      });
    }
    const last = segPoints[segPoints.length - 1];
    prevPoint = curr;
    prevIK    = last.ik;
  }

  return result;
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

// 거리 기준 리샘플링 (필요하면 사용)
function resamplePathByDistance(points, targetDist = 5) {
  if (!points || points.length === 0) return [];

  const result = [];
  let prev = points[0];
  result.push(prev);

  let accDist = 0;

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const segLen = Math.hypot(dx, dy);

    if (segLen === 0) {
      prev = curr;
      continue;
    }

    let distFromPrev = targetDist - accDist;

    while (distFromPrev <= segLen) {
      const t = distFromPrev / segLen;

      result.push({
        x: prev.x + dx * t,
        y: prev.y + dy * t,
        pen: curr.pen,
      });

      distFromPrev += targetDist;
    }

    accDist = segLen - (distFromPrev - targetDist);
    prev = curr;
  }

  return result;
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
  const maxReach = L1 + L2 - 1e-3; //약간의 여유 공간(10^-3)
  const minReach = Math.abs(L1 - L2) + 1e-3;
  // d = Math.max(minReach, Math.min(maxReach, d)); // 필요하면 활성화

  let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cos2     = Math.max(-1, Math.min(1, cos2));

  const theta2Abs  = Math.acos(cos2);        // 0 ~ π
  const theta2List = [theta2Abs, -theta2Abs]; // elbow down / up

function solve(theta2_fk) {
  const k1 = L1 + L2 * Math.cos(theta2_fk);
  const k2 = L2 * Math.sin(theta2_fk);

  const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);

  const theta1 = theta1_fk - upperRestAngle;
  const theta2 = theta2_fk;

  const joint1DegPhysical = -theta1 * 180 / Math.PI;
  const joint2DegPhysical = -theta2 * 180 / Math.PI;

  // 기존 내부 기준 (시계 +, 반시계 -)
  const joint1Old = joint1DegPhysical;
  const joint2Old = -(joint2DegPhysical - JOINT2_OFFSET);

  // ✅ 새 논리 기준: 시계 -, 반시계 +
  const joint1Deg = joint1Old;        // joint1은 그대로 사용
  const joint2Deg = -joint2Old;       // 부호 반전

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

// 스텝 단위 양자화 (0.01도)
function quantizeToStep(x) {
  // x: degree
  const steps = Math.round(x / STEP_DEG); // 가장 가까운 step
  return steps * STEP_DEG;
}

//p5 draw 함수
function drawSimulator(p) {
  debugFrame++;

  const mode = $('mode').d;

  if (mode === 0) {
    // ---------- 수동 모드 ----------
    // 자동 재생 끄기
    isPlaying    = false;
    useJsonMotion = false;

    // 대시보드에서 조절한 엔코더 값을 현재 각도로 사용
    // (이미 deg 단위면 그대로, 아니면 STEP_DEG 곱해서 바꿔줘)
    const enc1 = $('encoder.joint_1').d;
    const enc2 = $('encoder.joint_2').d;

    currentAngleJoint1 = normalizeAngle(enc1);
    currentAngleJoint2 = normalizeAngle(enc2);

  } else if (mode === 1) {
    // ---------- 자동 모드 ----------
    isPlaying      = true;
    useJsonMotion  = true;   // JSON 재생 기준
    
  }

  // 배경
  p.background(245);

  // ✅ 먼저, 이미 '구워둔' 궤적 레이어를 그대로 그린다 (scale 적용 X)
  if (trailLayer) {
    p.image(trailLayer, 0, 0);
  }

  // 이후부터는 기존처럼 scale 적용
  p.scale(scale);

  // 1) 모션 소스 선택 (JSON or SVG)
  if (isPlaying&&useJsonMotion && motionJson.length > 0) {
    // 로봇 JSON 기준 재생
    playJsonStep();
  }

  // 2) Forward Kinematics (현재 joint 각도로 포즈 계산)
const theta1 = p.radians(currentAngleJoint1) * -1;

// 🔸 joint2: 새 기준(0이었던 곳이 140)이므로,
//    물리각 = currentAngleJoint2 + 140
const physicalJ2 =   currentAngleJoint2 +  JOINT2_OFFSET;
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

    if (prevPenScreenX !== null && prevPenScreenY !== null &&
        prevPenState === 1 && currentPen === 1) {
      trailLayer.push();
      trailLayer.stroke(255, 0, 0);
      trailLayer.strokeWeight(2);
      trailLayer.noFill();
      trailLayer.line(prevPenScreenX, prevPenScreenY, penScreenX, penScreenY);
      trailLayer.pop();
    }

    prevPenScreenX = penScreenX;
    prevPenScreenY = penScreenY;
    prevPenState   = currentPen;
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
  p.text(`J1: ${$("encoder.joint_1").d} deg`, 50, 50);
  p.text(`J2: ${(currentAngleJoint2).toFixed(2)} deg`, 50, 70);
  p.text(`L1: ${link1Length.toFixed(0)}px`,   50, 90);
  p.text(`L2: ${link2Length.toFixed(0)}px`,   50, 110);

  p.text(isPlaying ? "Playing" : "Paused", 50, 150);
  p.text(`Pen: ${currentPen}`,              50, 170);
  p.text(`MIN J1: ${minJoint1}`,            50, 290);
  p.text(`MAX J1: ${maxJoint1}`,            50, 310);
  p.text(`MIN J2: ${minJoint2}`,            50, 330);
  p.text(`MAX J2: ${maxJoint2}`,            50, 350);
  p.pop();

  // 필요하면 여기서 showSvgPath로 파란 SVG 궤적도 표시 가능
}






// ===============================================
// 작업 영역 검증 및 자동 스케일 조정
// ===============================================

/**
 * SVG 포인트가 실제 작업 영역 내에 들어가는지 검증하고
 * 필요시 자동으로 스케일을 조정합니다.
 */
function fitSvgPointsToWorkspaceSafe(points) {
  if (!points || !points.length) return [];

  const Lsum = link1Length + link2Length;
  
  // 1) SVG 원본 좌표의 bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  let maxR = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    maxR = Math.max(maxR, Math.hypot(dx, dy));
  }
  if (maxR < 1e-6) maxR = 1.0;

  // 2) 초기 스케일 계산
  const safetyMargin = 0.85; // 작업반경의 85%만 사용 (안전 여유)
  const maxReach = Lsum * safetyMargin;
  let scaleSvg = (maxReach * drawScale) / maxR;

  // 3) 그림 중심 위치
  const drawCx = baseX;
  const drawCy = baseY + Lsum * 0.6;

  // 4) 반복적으로 IK 검증하며 스케일 조정
  const maxIterations = 5;
  let validScale = false;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    console.log(`🔍 검증 반복 ${iter + 1}/${maxIterations}, scale: ${scaleSvg.toFixed(4)}`);
    
    let failCount = 0;
    let outOfRangeCount = 0;
    
    // 모든 포인트를 변환하고 IK 검증
    const testPoints = points.map((p) => {
      const dx = (p.x - cx) * scaleSvg + Xoffset;
      const dy = (p.y - cy) * scaleSvg + Yoffset;
      
      return {
        x: drawCx + dx,
        y: drawCy + dy,
        pen: p.pen,
      };
    });
    
    // 샘플링하여 검증 (모든 점을 다 체크하면 느리므로)
    const sampleRate = Math.max(1, Math.floor(testPoints.length / 100));
    
    for (let i = 0; i < testPoints.length; i += sampleRate) {
      const pt = testPoints[i];
      
      // IK 계산 시도
      const ik = inverseKinematics2DOF(pt.x, pt.y, 0, 0);
      
      if (!ik) {
        failCount++;
        continue;
      }
      
      // 관절 제한 확인
      if (ik.joint1 < J1_MIN || ik.joint1 > J1_MAX ||
          ik.joint2 < J2_MIN || ik.joint2 > J2_MAX) {
        outOfRangeCount++;
      }
    }
    
    const sampleSize = Math.ceil(testPoints.length / sampleRate);
    const failRate = failCount / sampleSize;
    const outRate = outOfRangeCount / sampleSize;
    
    console.log(`   IK 실패: ${failCount}/${sampleSize} (${(failRate*100).toFixed(1)}%)`);
    console.log(`   범위 초과: ${outOfRangeCount}/${sampleSize} (${(outRate*100).toFixed(1)}%)`);
    
    // 성공 조건: 실패율 5% 이하
    if (failRate < 0.05 && outRate < 0.05) {
      validScale = true;
      console.log(`✅ 적합한 스케일 발견!`);
      break;
    }
    
    // 스케일 축소 (10%씩)
    scaleSvg *= 0.9;
  }
  
  if (!validScale) {
    console.warn(`⚠️ 완벽한 스케일을 찾지 못했지만 최선의 스케일로 진행합니다.`);
  }
  
  // 5) 최종 변환
  const result = points.map((p) => {
    const dx = (p.x - cx) * scaleSvg + Xoffset;
    const dy = (p.y - cy) * scaleSvg + Yoffset;
    
    return {
      x: drawCx + dx,
      y: drawCy + dy,
      pen: p.pen,
    };
  });
  
  console.log(`📐 최종 스케일: ${scaleSvg.toFixed(4)}`);
  return result;
}

// ===============================================
// IK 함수도 개선: 도달 불가능한 경우 null 반환
// ===============================================
function inverseKinematics2DOFSafe(targetX, targetY, prevJ1Deg, prevJ2Deg) {
  const L1 = link1Length;
  const L2 = link2Length;

  const dx = targetX - baseX;
  const dy = targetY - baseY;
  let d = Math.hypot(dx, dy);
  if (d < 1e-6) d = 1e-6;

  // 작업 영역 체크
  const maxReach = L1 + L2 - 1e-3;
  const minReach = Math.abs(L1 - L2) + 1e-3;
  
  // ❌ 도달 불가능하면 null 반환
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

  const joint1DegPhysical = -theta1 * 180 / Math.PI;
  const joint2DegPhysical = -theta2 * 180 / Math.PI;

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

  // 관절 제한 체크: 두 해 모두 범위를 벗어나면 null
  const aValid = (solA.joint1 >= J1_MIN && solA.joint1 <= J1_MAX &&
                  solA.joint2 >= J2_MIN && solA.joint2 <= J2_MAX);
  const bValid = (solB.joint1 >= J1_MIN && solB.joint1 <= J1_MAX &&
                  solB.joint2 >= J2_MIN && solB.joint2 <= J2_MAX);

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
    return (score(solB) < score(solA)) ? solB : solA;
  }
  
  return aValid ? solA : solB;
}

// ===============================================
// buildMotionJsonFromSvg도 개선된 함수 사용
// ===============================================
function buildMotionJsonFromSvgSafe() {
  if (jsonBuilt) return;
  if (!svgPathPoints || svgPathPoints.length === 0) return;

  console.log("🔧 motionJson 생성 시작 (안전 모드)...");
  motionJson = [];

  let curStepJ1 = 0;
  let curStepJ2 = 0;
  let prevPen = 0;

  const j1MinStep = Math.round(J1_MIN / STEP_DEG);
  const j1MaxStep = Math.round(J1_MAX / STEP_DEG);
  const j2MinStep = Math.round(J2_MIN / STEP_DEG);
  const j2MaxStep = Math.round(J2_MAX / STEP_DEG);

  let prevJ1Deg = 0;
  let prevJ2Deg = 0;
  
  let skippedPoints = 0;

  function moveToTarget(targetJ1, targetJ2, penState) {
    const totalDiff1 = targetJ1 - curStepJ1;
    const totalDiff2 = targetJ2 - curStepJ2;
    const maxDiff = Math.max(Math.abs(totalDiff1), Math.abs(totalDiff2));
    
    if (maxDiff === 0) {
      if (penState !== prevPen) {
        motionJson.push({ d1: 0, d2: 0, pen: penState });
        prevPen = penState;
      }
      return;
    }

    const stepsNeeded = Math.ceil(maxDiff / MAX_STEPS_PT);
    if (stepsNeeded > 1000) {
      console.warn(`⚠️ 과도한 분할 감지 (${stepsNeeded})`);
      stepsNeeded = 1000;
    }

    let accumulatedJ1 = 0;
    let accumulatedJ2 = 0;

    for (let i = 1; i <= stepsNeeded; i++) {
      const t = i / stepsNeeded;
      const targetAccJ1 = Math.round(totalDiff1 * t);
      const targetAccJ2 = Math.round(totalDiff2 * t);
      const d1 = targetAccJ1 - accumulatedJ1;
      const d2 = targetAccJ2 - accumulatedJ2;

      accumulatedJ1 = targetAccJ1;
      accumulatedJ2 = targetAccJ2;

      const currentPen = penState;

      if (d1 !== 0 || d2 !== 0 || currentPen !== prevPen) {
        motionJson.push({ d1, d2, pen: currentPen });
        prevPen = currentPen;
      }

      curStepJ1 += d1;
      curStepJ2 += d2;
    }
  }

  // Home -> 첫 포인트
  if (svgPathPoints.length > 0) {
    const firstPt = svgPathPoints[0];
    const firstIk = inverseKinematics2DOFSafe(firstPt.x, firstPt.y, 0, 0);

    if (firstIk) {
      let targetStartJ1 = Math.round(firstIk.joint1 / STEP_DEG);
      let targetStartJ2 = Math.round(firstIk.joint2 / STEP_DEG);
      targetStartJ1 = Math.max(j1MinStep, Math.min(j1MaxStep, targetStartJ1));
      targetStartJ2 = Math.max(j2MinStep, Math.min(j2MaxStep, targetStartJ2));

      console.log(`📍 Home(0,0) → 첫 포인트(${targetStartJ1}, ${targetStartJ2})`);
      moveToTarget(targetStartJ1, targetStartJ2, 0);

      prevJ1Deg = firstIk.joint1;
      prevJ2Deg = firstIk.joint2;
    } else {
      console.error("❌ 첫 포인트가 작업 영역 밖입니다!");
    }
  }

  // SVG 경로
  const totalPoints = svgPathPoints.length;
  const logInterval = Math.max(1, Math.floor(totalPoints / 10));

  for (let idx = 0; idx < svgPathPoints.length; idx++) {
    const pt = svgPathPoints[idx];

    if (idx % logInterval === 0) {
      console.log(`📊 진행: ${idx}/${totalPoints} (${Math.round(idx/totalPoints*100)}%), 스킵: ${skippedPoints}`);
    }

    const ik = inverseKinematics2DOFSafe(pt.x, pt.y, prevJ1Deg, prevJ2Deg);

    if (!ik) {
      skippedPoints++;
      continue; // IK 실패 또는 범위 밖
    }

    let targetStepJ1 = Math.round(ik.joint1 / STEP_DEG);
    let targetStepJ2 = Math.round(ik.joint2 / STEP_DEG);
    
    // 한번 더 체크
    targetStepJ1 = Math.max(j1MinStep, Math.min(j1MaxStep, targetStepJ1));
    targetStepJ2 = Math.max(j2MinStep, Math.min(j2MaxStep, targetStepJ2));

    moveToTarget(targetStepJ1, targetStepJ2, pt.pen);

    prevJ1Deg = ik.joint1;
    prevJ2Deg = ik.joint2;
  }

  jsonBuilt = true;
  
  console.log(`✅ motionJson 생성 완료!`);
  console.log(`   - 총 ${motionJson.length}개 명령`);
  console.log(`   - 처리된 포인트: ${totalPoints - skippedPoints}/${totalPoints}`);
  console.log(`   - 스킵된 포인트: ${skippedPoints} (${(skippedPoints/totalPoints*100).toFixed(1)}%)`);
  console.log(`   - 모든 움직임 ≤ ${MAX_STEPS_PT} step 보장`);
  console.log("");
  console.log("=== JSON 출력 시작 ===");
  console.log(JSON.stringify(motionJson));
  console.log("=== JSON 출력 끝 ===");
}