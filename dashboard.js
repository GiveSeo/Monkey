// 시스템 초기화 변수
let init = false;

let angles = [0, 0];

// 슬라이더가 지정하는 목표 각도
let targetAngles = [0, 0];

let useSimpleFK = false;

// 키 입력에 따른 변화량 (degree 단위)
const KEY_STEP = 1.5;  // 너무 빠르면 줄이기/늘리기
// SVG 드롭 상태 표시
let lastSvgName = "(none)";
let lastSvgSize = 0;
let lastSvgStatus = "No SVG loaded";

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
  w2popup.resize(470, 610);
  window.onresize = () => {
    w2popup.resize(470, 610);
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
    .attr("y", 95)
    .attr("font-size", "12px")
    .text("J1 / J2 Joint Angle Control");

  // === SVG Drag & Drop 안내 영역 ==========================================
  frame.append("rect")
    .attr("x", 15)
    .attr("y", 15)
    .attr("width", 420)
    .attr("height", 55)
    .attr("rx", 8)
    .attr("fill", "#f7fbff")
    .attr("stroke", "#4aa3ff")
    .attr("stroke-dasharray", "6 4");

  frame.append("text")
    .attr("x", 25)
    .attr("y", 38)
    .attr("font-size", "12px")
    .attr("fill", "#2a7fd6")
    .text("여기로 SVG 파일을 드래그 & 드롭하세요");

  frame.append("text")
    .attr("id", "svg_status_text")
    .attr("x", 25)
    .attr("y", 58)
    .attr("font-size", "11px")
    .attr("fill", "#333")
    .text(`SVG: ${lastSvgName} | ${lastSvgStatus}`);
  const sliderWidth = 260;
  const sliderX = 120;

  // J1 슬라이더 -----------------------------------------------------------------
  const J1 = frame.append("g");
  J1.append("text")
    .attr("x", 15)
    .attr("y", 185)
    .attr("font-size", "12px")
    .text("J1 ← →");

  createSlider(J1, [sliderWidth, sliderX, 175], "angle_J1", -30, 180, 0);

  //  J1 값 표시 UI 추가
  J1.append("foreignObject")
    .attr("x", sliderX + sliderWidth + 5)
    .attr("y", 175)
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
    .attr("y", 140)
    .attr("font-size", "12px")
    .text("J2 ↑ ↓");

  createSlider(J2, [sliderWidth, sliderX, 130], "angle_J2", -90, 10, 0);

  //  J2 값 표시 UI 추가
  J2.append("foreignObject")
    .attr("x", sliderX + sliderWidth + 5)
    .attr("y", 130)
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
  createButton(penBtn, [300, 50, 270], "pen_toggle_btn", "Pen Down");

  // 버튼 내부 상태
  let penIsDown = false;

  // 버튼 이벤트
  select("#pen_toggle_btn").on("click", () => {
    penIsDown = !penIsDown;

    //  핵심: p5에서 쓰는 currentPen을 여기서 직접 바꿔준다
    $('pen').d = penIsDown ? 1 : 0;

    // 버튼 텍스트 변경
    select("#pen_toggle_btn").text(penIsDown ? "Pen Up" : "Pen Down");
    console.log("Pen toggled →", penIsDown ? "UP (0)" : "DOWN (1)");
  });

  // Erase 버튼  -----------------------------------------------------------------
  const fkBtn = frame.append("g");
  createButton(fkBtn, [300, 50, 310], "erase_btn", "Erase");

  select("#erase_btn").on("click", () => {
    trailLayer.clear();
  });

  // SVG Draw 버튼  -----------------------------------------------------------------
  const drawBtn = frame.append("g");
  createButton(drawBtn, [300, 50, 350], "svg_draw_btn", "SVG Draw");

  select("#svg_draw_btn").on("click", () => {
    // 재생 시작
    drawMode = 1; // drawMode는 sketch에 정의되어 있는 변수입니다.
    startJsonPlayback();
    $("encoder.joint_1").d = degToStep(currentAngleJoint1);
    $("encoder.joint_2").d = degToStep(currentAngleJoint2);
    console.log("SVG drawing mode activated");
  });

  const manualBtn = frame.append("g");
  createButton(manualBtn, [300, 50, 390], "draw_manual_btn", "Draw Manual");

  select("#draw_manual_btn").on("click", () => {
    // 재생 시작
    drawMode = 0;
    $('pen').d = 0;

    console.log("manual drawing mode activated");
  });

  const drawFastBtm = frame.append("g");
  createButton(drawFastBtm, [300, 50, 430], "svg_draw_fast_btn", "SVG Draw Fast");

  select("#svg_draw_fast_btn").on("click", () => {
    // 재생 시작
    drawMode = 2;
    $('pen').d = 0;
    startJsonPlayback();
    $("encoder.joint_1").d = currentAngleJoint1;
    $("encoder.joint_2").d = currentAngleJoint2;
    console.log("SVG drawing Fast mode activated");
  });

  const drawAllBtm = frame.append("g");
  createButton(drawAllBtm, [300, 50, 470], "svg_draw_all_btn", "SVG Draw All");

  select("#svg_draw_all_btn").on("click", () => {
    // 재생 시작
    drawMode = 3;
    $('pen').d = 0;
    startJsonPlayback();
    $("encoder.joint_1").d = currentAngleJoint1;
    $("encoder.joint_2").d = currentAngleJoint2;
    console.log("SVG drawing All mode activated");
  });

  createButton(frame, [200, 20, 510], "download_txt_btn", "Download TXT", () => {
    downloadPlotTxtDecSpace("motion_plot.txt"); // ✅ 이 함수는 전역에 있어야 함 (Sketch.js에 두는 걸 추천)
  });
}
// === 키보드 이벤트 처리 ===
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
    $("encoder.joint_1").d = degToStep(parseFloat(select("#angle_J1").property("value")));
  }
  if (select("#angle_J2").node()) {
    $("encoder.joint_2").d = degToStep(parseFloat(select("#angle_J2").property("value")));
  }

  let lerpSpeed = 0.05; // 0~1, 클수록 빠름
  for (let i = 0; i < 2; i++) {
    angles[i] = angles[i] + (targetAngles[i] - angles[i]) * lerpSpeed;
  }
  $("encoder.joint_1").d = degToStep(angles[0]);
  $("encoder.joint_2").d = degToStep(angles[1]);
}
// === SVG 드래그 앤 드롭 처리 함수 ===
function setupSvgDragDrop(popup_box_selection) {
  const el = popup_box_selection.node();
  if (!el) return;

  // ✅ 이미 등록했으면 재등록 방지
  if (el.__svg_drop_ready__) return;
  el.__svg_drop_ready__ = true;

  // ---- TXT plot 파서 ----
  function parsePlotTxt(text) {
    // "10 20 30 ..." 공백/줄바꿈 구분 허용
    const arr = text
      .trim()
      .split(/\s+/)
      .map(Number);

    // 0~255 정수만 남기기
    const bytes = arr.filter(n => Number.isInteger(n) && n >= 0 && n <= 255);

    return bytes;
  }

  // 드래그 오버 시 기본 동작 막고 강조
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    el.style.outline = "3px dashed #4aa3ff";
    el.style.outlineOffset = "6px";
  });

  // 드래그가 떠나면 강조 해제
  el.addEventListener("dragleave", () => {
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

    const lower = (file.name || "").toLowerCase();

    const isSvg =
      file.type === "image/svg+xml" ||
      lower.endsWith(".svg");

    const isTxt =
      file.type === "text/plain" ||
      lower.endsWith(".txt");

    // ✅ SVG/TXT 둘 다 허용
    if (!isSvg && !isTxt) {
      lastSvgName = file.name || "(unknown)";
      lastSvgSize = file.size || 0;
      lastSvgStatus = "Unsupported ❌";
      const t = document.getElementById("svg_status_text");
      if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
      alert("SVG 또는 TXT(plot) 파일만 드롭 가능!");
      return;
    }

    // ✅ 로딩 시작 상태 표시
    lastSvgName = file.name;
    lastSvgSize = file.size || 0;
    lastSvgStatus = "Loading...";
    {
      const t = document.getElementById("svg_status_text");
      if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
    }

    try {
      const text = await file.text();
      window.currentSvgName = file.name;

      // =========================
      // 1) SVG 처리
      // =========================
      if (isSvg) {
        const looksLikeSvg = (text && text.includes("<svg"));
        if (!looksLikeSvg) {
          lastSvgStatus = "Invalid SVG text ❌";
          const t = document.getElementById("svg_status_text");
          if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
          alert("SVG 텍스트가 올바르지 않습니다.");
          return;
        }

        if (typeof window.rebuildFromSvgText === "function") {
          window.rebuildFromSvgText(text);

          const kb = (lastSvgSize / 1024).toFixed(1);
          lastSvgStatus = `SVG Loaded ✅ (${kb} KB)`;
          const t = document.getElementById("svg_status_text");
          if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
        } else {
          lastSvgStatus = "rebuildFromSvgText() missing ❌";
          const t = document.getElementById("svg_status_text");
          if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
          alert("rebuildFromSvgText()가 없습니다. Sketch.js에 전역 함수로 추가해줘.");
        }
        return;
      }

      // =========================
      // 2) TXT(plot) 처리
      // =========================
      if (isTxt) {
        // plotDecode가 전역이어야 함
        if (typeof window.plotDecode !== "function" && typeof plotDecode !== "function") {
          lastSvgStatus = "plotDecode() missing ❌";
          const t = document.getElementById("svg_status_text");
          if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
          alert("plotDecode()가 없습니다. plotDecode를 전역(window.plotDecode)으로 빼주세요.");
          return;
        }

        const bytes = parsePlotTxt(text);
        if (bytes.length === 0) {
          lastSvgStatus = "TXT empty/invalid ❌";
          const t = document.getElementById("svg_status_text");
          if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
          alert("TXT에 유효한 0~255 숫자(byte)가 없습니다.");
          return;
        }

        // 1) plotto.plot에 저장
        plotto.plot = bytes;

        // 2) decode 해서 motionJson 생성
        const decoder = (typeof plotDecode === "function") ? plotDecode : window.plotDecode;
        const motion = decoder(bytes);

        plotto.motionJson = motion;

        // 3) 재생 상태 초기화(있으면)
        plotto.jsonBuilt = true;
        if (typeof startJsonPlayback === "function") startJsonPlayback();

        const kb = (lastSvgSize / 1024).toFixed(1);
        lastSvgStatus = `TXT Plot Loaded ✅ (${kb} KB, ${bytes.length} bytes, ${motion.length} cmds)`;
        const t = document.getElementById("svg_status_text");
        if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;

        return;
      }
    } catch (err) {
      console.error(err);
      lastSvgStatus = "Read failed ❌";
      const t = document.getElementById("svg_status_text");
      if (t) t.textContent = `FILE: ${lastSvgName} | ${lastSvgStatus}`;
      alert(`파일 읽기/처리 실패: ${err?.message || err}`);
    }
  });
}
// === 플롯 TXT 다운로드 함수 (10진수 공백 구분) ===

function downloadPlotTxtDecSpace(filename = "motion_plot.txt") {
  if (!plotto.plot || plotto.plot.length === 0) {
    alert("plot 비어있음 (plotEncode 먼저 수행됐는지 확인)");
    return;
  }

  const text = plotto.plot.join(" "); // ✅ 10진수 공백 구분

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
// 드롭다운 시 svg 재빌드 함수
window.rebuildFromSvgText = function (svgText) {

  // 엔진 처리: plotto에게 위임
  if (plotto && typeof plotto.buildFromSvgText === "function") {
    plotto.buildFromSvgText(svgText);
  } else {
    console.error("plotto.buildFromSvgText가 없습니다.");
    return;
  }

  // 렌더링(재생)은 sketch에게
  if (typeof startJsonPlayback === "function") startJsonPlayback();
};