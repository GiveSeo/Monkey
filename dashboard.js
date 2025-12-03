// =======================
// 슬라이더 생성 함수
// =======================

// parent: D3 selection (g 요소)
// cfg: [width, x, y]
// id: input range id
function createSlider(parent, cfg, id, min, max, initial) {
  const [W, X, Y] = cfg;

  parent.append('foreignObject')
    .attr("x", X)
    .attr("y", Y)
    .attr("width", W)
    .attr("height", 30)
    .html(`
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

// =======================
// J1 / J2 / Speed + 모드 + 그리기 버튼 대시보드
// =======================
function enterAutoMode() {
  // 홈 포즈로 초기화
  currentAngleJoint1 = 0;
  currentAngleJoint2 = 0;
  currentPen         = 0;

  $('encoder.joint_1').d = currentAngleJoint1;
  $('encoder.joint_2').d = currentAngleJoint2;

  // JSON 재생 인덱스 리셋
  jsonIndex     = 0;
  isPlaying     = true;
  useJsonMotion = true;
  useSvgAsMotion = false;

  // 궤적도 초기화하고 싶으면
  if (trailLayer) trailLayer.clear();
  prevPenScreenX = null;
  prevPenScreenY = null;
}
function dashboard() {
  // 팝업 크기 설정
  w2popup.resize(400, 280);
  window.onresize = () => {
    w2popup.resize(400, 280);
  };
  w2popup.on('close', () => {
    // 필요 시 정리 코드
  });

  const popup_box = select('#dashboard');
  popup_box.html('');                  // 기존 내용 지우기
  popup_box.style('user_select', 'none');

  const frame = popup_box.append('svg')
    .attr("width", 400)
    .attr("height", 270)
    .style("background", "#fff")
    .style("border", "1px solid #ddd");

  // 제목
  frame.append("text")
    .attr("x", 15)
    .attr("y", 25)
    .attr("font-size", "12px")
    .text("J1 / J2 Joint Angle Control");

  const sliderWidth = 260;
  const sliderX = 100;

  // === J2 슬라이더 (예: 0 ~ 120도) ===
  const J2 = frame.append('g');
  J2.append("text")
    .attr("x", 15)
    .attr("y", 70)
    .attr("font-size", "12px")
    .text("J2 (deg)");
  createSlider(J2, [sliderWidth, sliderX, 60], "angle_J2", -120, 120, 0);

  // === J1 슬라이더 (-120 ~ 120도) ===
  const J1 = frame.append('g');
  J1.append("text")
    .attr("x", 15)
    .attr("y", 115)
    .attr("font-size", "12px")
    .text("J1 (deg)");
  createSlider(J1, [sliderWidth, sliderX, 105], "angle_J1", -30, 180, 0);
  // === 모드 전환 버튼 (Manual / SVG Draw) ===
  frame.append('foreignObject')
    .attr("x", 15)
    .attr("y", 190)
    .attr("width", 360)
    .attr("height", 30)
    .html(`
      <div style="display:flex; gap:8px;">
        <button type="button" id="btn_mode0" style="flex:1; font-size:11px;">
          Manual (encoder)
        </button>
        <button type="button" id="btn_mode1" style="flex:1; font-size:11px;">
          SVG Draw
        </button>
      </div>
    `);

  // === 그리기 ON/OFF + Clear 버튼 ===
  frame.append('foreignObject')
    .attr("x", 15)
    .attr("y", 225)
    .attr("width", 360)
    .attr("height", 30)
    .html(`
      <div style="display:flex; gap:8px;">
        <button type="button" id="btn_draw_toggle" style="flex:1; font-size:11px;">
          Draw ON/OFF
        </button>
        <button type="button" id="btn_clear" style="flex:1; font-size:11px;">
          Clear Drawing
        </button>
      </div>
    `);

  // foreignObject 안 HTML이 실제 DOM에 붙은 뒤에 이벤트 등록
  setTimeout(() => {
    // 모드 버튼
    const btn0 = document.getElementById("btn_mode0");
    const btn1 = document.getElementById("btn_mode1");

    if (btn0) {
      btn0.addEventListener("click", () => {
        // 수동 모드: 슬라이더 -> encoder 직접
        $('mode').d = 0;
        console.log("Mode 0: Manual (encoder)");
      });
    }

    if (btn1) {
      btn1.addEventListener("click", () => {
        // 자동 모드: SVG/JSON 재생
        $('mode').d = 1;
        enterAutoMode();
        console.log("Mode 1: SVG Draw");
        // 필요하면 여기에서 JSON 재생 초기화도 가능
        // jsonIndex = 0;
        // currentAngleJoint1 = 0;
        // currentAngleJoint2 = 0;
        // currentPen = 0;
      });
    }

    // Draw ON/OFF 토글 버튼
    const btnDraw = document.getElementById("btn_draw_toggle");
    if (btnDraw) {
      btnDraw.addEventListener("click", () => {
        if (currentPen === 1) {
          currentPen = 0;  // 펜 업
          console.log("✏️ Draw OFF");
        } else {
          currentPen = 1;  // 펜 다운
          // 갑자기 켰을 때 이상한 직선 방지
          prevPenScreenX = null;
          prevPenScreenY = null;
          console.log("✏️ Draw ON");
        }
      });
    }

    // Clear 버튼 (trailLayer 지우기)
    const btnClear = document.getElementById("btn_clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (trailLayer) {
          trailLayer.clear();
        }
        prevPenScreenX = null;
        prevPenScreenY = null;
        console.log("🧽 Drawing Cleared");
      });
    }
  }, 0);
}

// =======================
// control(): 슬라이더 -> encoder / joint.angles
// =======================

let init = false;
// angles[0] = J1, angles[1] = J2
let angles = [0, 0];

function control() {
  const mode = $('mode').d ?? 0;   // 0: 수동(encoder), 1: 자동(SVG/JSON)

  // 1) 첫 호출에서 엔코더 값으로 슬라이더 초기화
  if (!init) {
    init = true;

    angles = [
      Math.round($('encoder.joint_1').d),  // J1
      Math.round($('encoder.joint_2').d),  // J2
    ];

    if (select('#angle_J1').node()) {
      select('#angle_J1').property("value", angles[0]);
    }
    if (select('#angle_J2').node()) {
      select('#angle_J2').property("value", angles[1]);
    }
    if (select('#angle_speed').node()) {
      select('#angle_speed').property("value", 100);
    }
  }

  // 2) 매 프레임마다 슬라이더 값 읽기
  if (select('#angle_J1').node()) {
    angles[0] = parseInt(select('#angle_J1').property("value")) || 0;
  }
  if (select('#angle_J2').node()) {
    angles[1] = parseInt(select('#angle_J2').property("value")) || 0;
  }

  // 3) 속도 슬라이더 -> joint.max_speed
  if (select('#angle_speed').node()) {
    $('joint.max_speed').d = parseInt(select('#angle_speed').property("value")) || 100;
  }

  // 4) 모드에 따른 동작
  if (mode === 0) {
    // 🔹 수동 모드: 슬라이더 값 -> encoder & joint.angles
    $('encoder.joint_1').d = angles[0];
    $('encoder.joint_2').d = angles[1];
    $('joint.angles').d    = angles;   // 실제 로봇 명령도 보내고 싶으면 유지
  } else if (mode === 1) {
    // 🔹 자동 모드: encoder는 JSON/SVG 재생 로직에서만 갱신
    // 여기서는 건드리지 않음
  }

  // 5) (옵션) 엔코더 상태 텍스트 갱신
  if (select('#encoder_joint_1').node()) {
    select('#encoder_joint_1').text($('encoder.joint_1').d + ' °');
  }
  if (select('#encoder_joint_2').node()) {
    select('#encoder_joint_2').text($('encoder.joint_2').d + ' °');
  }
}
