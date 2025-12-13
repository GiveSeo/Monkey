// === J1 / J2 전용 대시보드 ===

// 심플 슬라이더 생성기 (HTML range)

// === 제어 로직 ===
let init = false;
// angles[0] = J1, angles[1] = J2
let angles = [0, 0];
// 모드 전환용 변수, false = SVG, true = Monkey FK 모드

// 슬라이더가 지정하는 목표 각도
let targetAngles = [0, 0];

let useSimpleFK = false;

// 키 입력에 따른 변화량 (degree 단위)
const KEY_STEP = 1.5;  // 너무 빠르면 줄이기/늘리기

function createSlider(parent, cfg, id, min, max, initial) {
  const [W, X, Y] = cfg;

  parent
    .append("foreignObject")
    .attr("x", X)
    .attr("y", Y)
    .attr("width", W)
    .attr("height", 30).html(`
            <input 
                type="range" 
                id="${id}"
                min="${min}" 
                max="${max}" 
                value="${initial}" 
                style="width:${W}px"
            />
        `);
}

// 버튼 생성기 (HTML button)
function createButton(parent, cfg, id, label, onClick) {
  const [W, X, Y] = cfg;

  parent.append("foreignObject")
    .attr("x", X).attr("y", Y)
    .attr("width", W).attr("height", 30)
    .html(`<button id="${id}" style="width:${W}px; height:28px;">${label}</button>`);

  if (onClick) select("#" + id).on("click", onClick);
}

// 팝업에 J1/J2/Speed 슬라이더 + 버튼 표시
function dashboard() {
  w2popup.resize(450, 440);
  window.onresize = () => {
    w2popup.resize(450, 550);
  };
  w2popup.on("close", () => {
    // 키보드 이벤트 같은 거 더 이상 안 씀
  });

  const popup_box = select("#dashboard");
  popup_box.html(""); // 기존 내용 싹 지우기
  popup_box.style("user_select", "none");

  setupSvgDragDrop(popup_box);

  const frame = popup_box
    .append("svg")
    .attr("width", 450)
    .attr("height", 550)
    .style("background", "#fff")
    .style("border", "1px solid #ddd");

  // 제목
  frame
    .append("text")
    .attr("x", 15)
    .attr("y", 25)
    .attr("font-size", "12px")
    .text("J1 / J2 Joint Angle Control");

  const sliderWidth = 260;
  const sliderX = 120;

  // J1 슬라이더 -----------------------------------------------------------------
  const J1 = frame.append("g");
  J1.append("text")
    .attr("x", 15)
    .attr("y", 115)
    .attr("font-size", "12px")
    .text("J1 ← →");

  createSlider(J1, [sliderWidth, sliderX, 105], "angle_J1", -30, 180, 0);

  //  J1 값 표시 UI 추가
  J1.append("foreignObject")
    .attr("x", sliderX + sliderWidth + 5)
    .attr("y", 105)
    .attr("width", 40)
    .attr("height", 30).html(`<div id="angle_J1_val" 
          style="font-size:14px; padding-top:4px;">0°</div>`);

  //  실시간 업데이트 이벤트
  select("#angle_J1").on("input", function () {
    select("#angle_J1_val").html(`${this.value}°`);
    targetAngles[0] = parseFloat(this.value);
  });

  // J2 슬라이더 -----------------------------------------------------------------
  const J2 = frame.append("g");
  J2.append("text")
    .attr("x", 15)
    .attr("y", 70)
    .attr("font-size", "12px")
    .text("J2 ↑ ↓");

  createSlider(J2, [sliderWidth, sliderX, 60], "angle_J2", -90, 10, 0);

  //  J2 값 표시 UI 추가
  J2.append("foreignObject")
    .attr("x", sliderX + sliderWidth + 5)
    .attr("y", 60)
    .attr("width", 40)
    .attr("height", 30).html(`<div id="angle_J2_val" 
          style="font-size:14px; padding-top:4px;">0°</div>`);

  //  실시간 업데이트 이벤트
  select("#angle_J2").on("input", function () {
    select("#angle_J2_val").html(`${this.value}°`);

    targetAngles[1] = parseFloat(this.value);
  });

  //   Pen Up/Down 버튼  -----------------------------------------------------------------
  const penBtn = frame.append("g");
  createButton(penBtn, [300, 50, 200], "pen_toggle_btn", "Pen Down");

  // 버튼 내부 상태
  let penIsDown = false;

  // 버튼 이벤트
  select("#pen_toggle_btn").on("click", () => {
    penIsDown = !penIsDown;

    //  핵심: p5에서 쓰는 currentPen을 여기서 직접 바꿔준다
    currentPen = penIsDown ? 1 : 0;

    // 버튼 텍스트 변경
    select("#pen_toggle_btn").text(penIsDown ? "Pen Up" : "Pen Down");
    console.log("Pen toggled →", penIsDown ? "UP (0)" : "DOWN (1)");
  });

  // Erase 버튼  -----------------------------------------------------------------
  const fkBtn = frame.append("g");
  createButton(fkBtn, [300, 50, 240], "erase_btn", "Erase");

  select("#erase_btn").on("click", () => {
    trailLayer.clear();
  });

  // SVG Draw 버튼  -----------------------------------------------------------------
  const drawBtn = frame.append("g");
  createButton(drawBtn, [300, 50, 280], "svg_draw_btn", "SVG Draw");

  select("#svg_draw_btn").on("click", () => {
    // 재생 시작
    $("mode").d = 1;
    startJsonPlayback();
    $("encoder.joint_1").d = currentAngleJoint1;
    $("encoder.joint_2").d = currentAngleJoint2;
    console.log("SVG drawing mode activated");
  });

  const manualBtn = frame.append("g");
  createButton(manualBtn, [300, 50, 320], "draw_manual_btn", "Draw Manual");

  select("#draw_manual_btn").on("click", () => {
    // 재생 시작
    $("mode").d = 0;
    currentPen = 0;

    console.log("manual drawing mode activated");
  });

  const drawDoubleBtm = frame.append("g");
  createButton(drawDoubleBtm, [300, 50, 360], "svg_draw_double_btn", "SVG Draw Double");

  select("#svg_draw_double_btn").on("click", () => {
    // 재생 시작
    $("mode").d = 2;
    currentPen = 0;
    startJsonPlayback();
    $("encoder.joint_1").d = currentAngleJoint1;
    $("encoder.joint_2").d = currentAngleJoint2;
    console.log("SVG drawing Double mode activated");
  });

  createButton(frame, [200, 20, 440], "download_json_btn", "Download JSON", () => {
    downloadMotionJson("motionJson.json"); // ✅ 이 함수는 전역에 있어야 함 (Sketch.js에 두는 걸 추천)
  });
}


// === 키보드 제어 추가 ===


window.addEventListener("keydown", (e) => {

  let changed = false;

  switch (e.key) {
    case "ArrowLeft":   // J1 --
      targetAngles[0] -= KEY_STEP;
      changed = true;
      break;

    case "ArrowRight":  // J1 ++
      targetAngles[0] += KEY_STEP;
      changed = true;
      break;

    case "ArrowUp":     // J2 ++
      targetAngles[1] += KEY_STEP;
      changed = true;
      break;

    case "ArrowDown":   // J2 --
      targetAngles[1] -= KEY_STEP;
      changed = true;
      break;

    default:
      return; // 다른 키는 무시
  }

  // 변경 없으면 종료
  if (!changed) return;

  // --- 각도 제한 ---
  targetAngles[0] = Math.max(-30, Math.min(180, targetAngles[0])); // J1
  targetAngles[1] = Math.max(-90, Math.min(10, targetAngles[1]));  // J2

  // --- 슬라이더도 업데이트 ---
  if (select("#angle_J1").node()) {
    select("#angle_J1").property("value", targetAngles[0]);
    select("#angle_J1_val").html(targetAngles[0].toFixed(1) + "°");
  }

  if (select("#angle_J2").node()) {
    select("#angle_J2").property("value", targetAngles[1]);
    select("#angle_J2_val").html(targetAngles[1].toFixed(1) + "°");
  }

  // 방향키의 기본동작(스크롤 등) 방지
  e.preventDefault();
});



function control() {
  // 1) 첫 호출에서 엔코더 값으로 초기화
  if (!init) {
    init = true;

    angles = [
      Math.round($("encoder.joint_1").d), // J1
      Math.round($("encoder.joint_2").d), // J2
    ];

    // 슬라이더에 현재 각도 반영
    if (select("#angle_J1").node()) {
      select("#angle_J1").property("value", angles[0]);
    }
    if (select("#angle_J2").node()) {
      select("#angle_J2").property("value", angles[1]);
    }

    // 속도 기본값 100
    if (select("#angle_speed").node()) {
      select("#angle_speed").property("value", 100);
    }
  }

  
  // 2) 매 프레임마다 슬라이더 값 읽어서 angles[] 업데이트
  if (select("#angle_J1").node()) {
    $("encoder.joint_1").d = parseInt(select("#angle_J1").property("value"));
  }
  if (select("#angle_J2").node()) {
    $("encoder.joint_2").d = parseInt(select("#angle_J2").property("value"));
  }

  let lerpSpeed = 0.05; // 0~1, 클수록 빠름
  for (let i = 0; i < 2; i++) {
    angles[i] = angles[i] + (targetAngles[i] - angles[i]) * lerpSpeed;
  }
  $("encoder.joint_1").d = Math.round(angles[0]);
  $("encoder.joint_2").d = Math.round(angles[1]);
}
function setupSvgDragDrop(popup_box_selection) {
  const el = popup_box_selection.node();
  if (!el) return;

  // ✅ 이미 등록했으면 재등록 방지
  if (el.__svg_drop_ready__) return;
  el.__svg_drop_ready__ = true;

  // 드래그 오버 시 기본 동작 막고 강조
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    el.style.outline = "3px dashed #4aa3ff";
    el.style.outlineOffset = "6px";
  });

  // 드래그가 떠나면 강조 해제
  el.addEventListener("dragleave", (e) => {
    el.style.outline = "";
    el.style.outlineOffset = "";
  });

  // ✅ 드롭 처리
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    el.style.outline = "";
    el.style.outlineOffset = "";

    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;

    const isSvg =
      (file.type === "image/svg+xml") ||
      file.name.toLowerCase().endsWith(".svg");

    if (!isSvg) {
      alert("SVG 파일만 드롭 가능!");
      return;
    }

    try {
      const svgText = await file.text();   // ✅ SVG 원문 읽기
      window.currentSvgName = file.name;   // (선택) 다운로드 파일명 등에 활용 가능

      if (typeof window.rebuildFromSvgText === "function") {
        window.rebuildFromSvgText(svgText); // ✅ Sketch 파이프라인 호출
        // SVG 모드로 자동 전환하고 싶으면 아래도 가능
        // $("mode").d = 1; startJsonPlayback();
      } else {
        alert("rebuildFromSvgText()가 없습니다. Sketch.js에 전역 함수로 추가해줘.");
      }
    } catch (err) {
      console.error(err);
      alert("SVG 읽기 실패");
    }
  });
}