// === J1 / J2 전용 대시보드 ===

// 심플 슬라이더 생성기 (HTML range)

// === 제어 로직 ===
let init = false;
// angles[0] = J1, angles[1] = J2
let angles = [0, 0];
// 모드 전환용 변수, false = SVG, true = Monkey FK 모드
let useSimpleFK = false;

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
function createButton(parent, cfg, id, label) {
  const [W, X, Y] = cfg;

  parent
    .append("foreignObject")
    .attr("x", X)
    .attr("y", Y)
    .attr("width", W)
    .attr("height", 30).html(`
            <button id="${id}" style="width:${W}px; height:28px;">${label}</button>
        `);
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

    // J1 슬라이더
const J1 = frame.append("g");
J1.append("text")
  .attr("x", 15)
  .attr("y", 115)
  .attr("font-size", "12px")
  .text("J1 (deg)");

createSlider(J1, [sliderWidth, sliderX, 105], "angle_J1", -30, 180, 0);

//  J1 값 표시 UI 추가
J1.append("foreignObject")
  .attr("x", sliderX + sliderWidth + 5)
  .attr("y", 105)
  .attr("width", 40)
  .attr("height", 30)
  .html(`<div id="angle_J1_val" 
          style="font-size:14px; padding-top:4px;">0°</div>`);

//  실시간 업데이트 이벤트
select("#angle_J1").on("input", function () {
  select("#angle_J1_val").html(`${this.value}°`);
});


    // J2 슬라이더
const J2 = frame.append("g");
J2.append("text")
  .attr("x", 15)
  .attr("y", 70)
  .attr("font-size", "12px")
  .text("J2 (deg)");

createSlider(J2, [sliderWidth, sliderX, 60], "angle_J2", -90, 10, 0);

//  J2 값 표시 UI 추가
J2.append("foreignObject")
  .attr("x", sliderX + sliderWidth + 5)
  .attr("y", 60)
  .attr("width", 40)
  .attr("height", 30)
  .html(`<div id="angle_J2_val" 
          style="font-size:14px; padding-top:4px;">0°</div>`);

//  실시간 업데이트 이벤트
select("#angle_J2").on("input", function () {
  select("#angle_J2_val").html(`${this.value}°`);
});


  // === Pen Up/Down 버튼 ===
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

  // Erase 버튼
  const fkBtn = frame.append("g");
  createButton(fkBtn, [300, 50, 240], "erase_btn", "Erase");
 
  select("#erase_btn").on("click", () => {
      trailLayer.clear();
  });


  // SVG Draw 버튼
  const drawBtn = frame.append("g");
  createButton(drawBtn, [300, 50, 280], "svg_draw_btn", "SVG Draw");

  select("#svg_draw_btn").on("click", () => {
    // 재생 시작
    $('mode').d = 1;
    console.log("SVG drawing mode activated");
  });
}


function control() {
    console.log("1");
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

  // 3) 속도 슬라이더 → joint.max_speed
  if (select("#angle_speed").node()) {
    $("joint.max_speed").d =
      parseInt(select("#angle_speed").property("value")) || 100;
  }
}
