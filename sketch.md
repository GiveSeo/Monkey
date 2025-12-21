# sktech에 대해
sketch는 spine에서 해석된 svg 정보 **motionJson**을 바탕으로 화면 상에 그래픽으로 시뮬레이션합니다.  
로봇팔은 두가지 회전 관절(joint 1, joint 2)을 가지고, 코드에서는 정기구학을 통해 주어진 관절 각도에서 펜 끝의 각도를 계산하고 대응하는 이미지를 회전/이동 시켜서 화면에 그립니다.  
또한 펜 그리기 결과 궤적을 화면에 표시할 수 있으며, 수동 조작 모드(drawMode 1)과 자동 조작 모드(drawMode 2, 3, 4)를 지원합니다.

이 문서에서 sketch의 주요 변수, 함수, 동작 흐름을 설명하고자 합니다.
## 주요 변수

### drawMode 
로봇 시뮬레이터 동작 모드를 나타내는 변수입니다.  
0일때 수동 모드를 나타내며, dashBoard를 통해 로봇 팔을 움직일 수 있습니다.
1일때 기본 재생 모드를 나타내며, plotto.motionJson에 저장된 동작 시퀀스를 한 프레임당 한번 실행합니다.
2일때 가속 재생 모드를 나타내며, 프레임 하나에 가능한 많은 스텝을 처리합니다.
3일때 결과 모드를 나타내며, 한번에 그리기 결과를 볼 수 있습니다.

### bakeOnce
전체 경로를 한번 그렸는지 여부를 나타내는 변수입니다.
한번에 그리는 함수(bakeAllToTrailLayer)에서 중복 호출을 방지하거나 이미 그린 경로를 또 그리는 것을 방지하기 위한 변수입니다.

### jsonIndex
자동 모드 실행 시 사용되는 index 입니다.
plotto.motionJson의 현재 인덱스로, 로봇의 동작 명령을 순차적으로 따라갈 때 사용합니다.
playJsonStep 및 playJsonStepAndBake 함수가 이 값을 사용하며, 경로 시작시에는 0으로 초기화됩니다.

### JOINT2_OFFSET
joint2 값이 기본 모양일 때(로봇팔이 ㄷ자 모양) joint2가 0도임을 보장하기 위해 정의한 offset 각도입니다.

### foreRestAngle
forearm의 이미지 상 팔꿈치 관절과 펜 끝 각도 변수입니다. 회전 각도 계산에 활용됩니다.

### baseX, baseY 
initBasePosition()함수에서 설정되며, 로봇팔의 첫번째 관절이 그려질 위치를 정합니다.

### link1Length, link2Length
upperarm, forearm의 실제 이미지 상 길이(px)를 저장하는 변수입니다.
initLinkGeometry() 함수에서 게산되며, 실제 upperarm과 forearm의 관절 - 관절 / 관절 - 펜 사이 길이를 측정하여 저장하는 변수입니다.

### imgTop, imgUpper, imgFore
로봇팔의 각 부분에 해당되는 p5 이미지 객체입니다.
spine.images.get() 호출을 통해 topPath, upperPath, forePath에 이미지 경로를 얻어, 그 이미지 경로를 활용해 p5 이미지를 로딩하여 각각 imgTop, imgUpper, imgFore에 저장합니다.
이후 p.image(imgTop)와 같은 형태로 이미지를 랜더링 할 수 있습니다.

### currentAngleJoint1, currentAngleJoint2
로봇 joint1, joint2의 현재 각도를 나타냅니다.
로봇팔이 ㄷ자 모양일시 둘다 0의 값을 가지며, 시계방향일 시 -, 반시계 방향일 시 + 값을 가집니다.

### minJoint1, maxJoint1, minJoint2, maxJoint2
시뮬레이션 중 기록한 joint1, joint2의 최대 최소 각도를 저장합니다.

### scale
전체 캔버스 스케일 비율입니다. 주로 캔버스 크기를 조정하고, 로봇 그림을 화면에 알맞은 크기로 보이게 하기 위해 사용됩니다.

### moreHeight
추가 캔버스 높이 보정값입니다. 
canvasHeight 계산 시 사용되어, 기본 800*scale 높이에 100픽셀을 더해줍니다. 
이는 로봇 팔 아래쪽에 약간 여유 공간을 추가하여 그림이 잘리지 않도록 하는 역할입니다.

### J1_MIN(), J1_MAX(), J2_MIN(), J2_MAX()
plotto에서 정의된 각각 관절의 최대 최소 각도를 반환하는 함수입니다.

### isPlaying
현재 자동 재생인지, 수동 재생인지 여부를 나타내는 변수입니다.

### trailLayer
펜 궤적을 그리는 별도 그래픽 레이어입니다.
p.createGraphics(canvasWidth, canvasHeight)로 메인 캔버스와 동일 크기의 오프스크린 버퍼를 생성하여 사용합니다.
이 레이어에 펜이 이동한 자취를 축적해서 그려두고, 메인 화면에 overlay하는 방식으로 사용합니다. 
별도 레이어를 두는 이유는, 로봇팔 랜더링 시 기존 로봇팔 이미지를 지워야 하는데, 매 프레임 배경을 지우더라도 기존 궤적을 보존하여 지속적으로 표시하기 위함입니다. 

### prevPenScreenX, prevPenScreenY
펜의 이전 프레임 화면 좌표를 기록하는 변수입니다.마지막으로 있던 펜 위치를 기록하여, 현 펜 위치와 연결하는 선을 그리는데 사용합니다.
prevPenState와 함께 활용하여, 펜이 내려져 있었을 때만 선을 그립니다.

### prevPenState
펜의 이전 상태를 저장합니다.
이전 프레임에서 펜이 내려진 상태였고 ***(prevPenState === 1)*** 이번에도 내려진 상태일 경우 ***($('pen').d === 1)***, 두 점 사이 선을 그립니다.

### plotto 객체 관련 변수
시뮬레이션 상에 사용되는 plotto 객체를 간단히 서술하겠습니다. 자세한 서술은 [plotto/spine을 참고해 주세요]

#### $('pen').d
펜의 현재 상태를 저장하는 변수입니다. 1일시 down(그림을 그리는 상태), 0일시 up(그림을 그리지 않는 상태)입니다.

#### $("encoder.joint_1").d, ("encoder.joint_2").d
각각 currentAngleJoint1, currentAngleJoint2에 저장된 값을 STEP(0.001...)단위로 정수로 변환하여 저장합니다.

#### plotto.motionJson
spine에서 해석한 svg 바탕 로봇 동작을 저장하는 변수입니다.
motionJson에서 정의한 동작 명령을 바탕으로 sketch에서 시뮬레이션 합니다.

## 주요 함수

### sketch() / openRobotPopup()

sketch() 함수는 로봇 시뮬레이터 UI를 실행시키는 역할을 합니다. openRobotPopup()은 시뮬레이터를 표시할 팝업 창을 여는 역할을 합니다.

openRobotPopup()을 호출하여 시뮬레이터를 띄울 팝업 창(모달 창)을 생성한 뒤, new p5(...)를 통해 p5.js 스케치 인스턴스를 초기화합니다. 이때 p5 인스턴스 생성자에 콜백 함수를 넘겨서, p.setup과 p.draw를 코드의 setupSimulator와 drawSimulator로 연결하고, "p5-canvas"라는 DOM 요소를 캔버스로 사용하도록 지정하고 있습니다.

p.setup은 실행 될 시 한번, p.draw는 일정 간격에 따라 실행되는 함수입니다.

### initLinkGeometry()
initLinkGeometry() 함수는 로봇 팔 링크의 기하 정보(길이와 기준 각도)를 계산하여 전역 변수에 설정합니다.
이 함수에서 계산된 upperRestAngle, foreRestAngle은 링크 회전 시 오프셋으로 활용되며, 게산된 link1Length, link2Length는 길이 계산시 활용됩니다.

### initBasePosition()
initBasePosition() 함수는 로봇 베이스 관절(joint1)의 화면 위치 (baseX, baseY)를 설정합니다. 
이 위치는 로봇 팔 전체의 기준점이 됩니다.
여기서 계산되는 baseX, baseY는 plotto.configure()를 통해 plotto.baseX, plotto.baseY로 복사되며, 정 기구학 계산과 이미지 위치 결정에 사용됩니다.

### startJsonPlayback(jsonData)
startJsonPlayback(jsonData) 함수는 새로운 그림 그리기나 모션 재시작시 호출되며, 로봇팔 자동 실행을 하기 전 관련 변수를 초기화하는 역할을 합니다.
인수로 새로운 motion JSON 데이터를 받을 수도 있고, 없으면 기존 plotto.motionJson을 사용합니다.

#### 실행 동작
로봇팔 자세 초기화 : currentAngleJoint1, currentAngleJoint2를 0으로 되돌립니다. 이는 현 로봇팔 joint 0,0이 아닐 시 제한 각도를 넘을 수 있기 때문입니다.
펜 상태 초기화 : $('pen').d = 0으로 펜을 올린 상태로 만듭니다.
이전 프레임 정보 초기화 : prevPenScreenX, prevPenScreenY, prevPenState 모두 초기화(null 또는 0). 펜 궤적 그리기용 이전 기록들을 지워주는 것입니다.
궤적 레이어 초기화 : trailLayer.clear()를 호출하여, 이전에 그려진 모든 펜 궤적를 지웁니다.

### playJsonStep()

playJsonStep() 함수는 자동 모드에서 한 스탭의 각도, 펜 상태를 갱신하는 역할을 합니다.
이 함수는 drawMode 1일시 매 프레임 호출됩니다.
#### 실행 동작
먼저 jsonIndex가 motionJson 길이를 넘지 않았는지 체크합니다.
이후 현재 index에 해당되는 명령 객체 cmd를 가져옵니다.
그리고 스텝 증분을 각도로 변환하여 현재 각도 / 펜 상태 를 갱신하고 엔코더 값 ***($("encoder.joint_1").d, $("encoder.joint_2").d)*** 을 업데이트 합니다

이 함수 호출 한 번으로 로봇 팔의 상태(currentAngleJoint*와 펜 상태)가 한 스텝만큼 변화하며, 해당 변화가 UI와 내부 상태에 모두 반영됩니다. 이후 drawSimulator의 나머지 부분에서 이 업데이트된 각도에 따라 로봇 그림이 새로 그려지게 됩니다.

### playJsonStepAndBake()

playJsonStepAndBake() 함수는 playJsonStep()과 유사하게 한 스텝의 명령을 처리하면서, 동시에 그 스텝에 해당하는 펜 궤적을 바로 trailLayer에 그려주는 기능을 추가한 것입니다. 
이 함수는 drawMode 2에서 사용되며, 한 프레임당 여러번 실행되기에, 기존 drawMode 1보다 더 빠른 그리기를 볼 수 있습니다.

#### 실행 동작
먼저 jsonIndex 경계 검사, cmd 가져오기, 각도 증분 계산 및 적용, 클램핑, 펜 상태/엔코더 업데이트 등을 진행합니다. 이는 playJsonStep()와 동일합니다.
이후 const pos = plotto.fkPenXY_deg(currentAngleJoint1, currentAngleJoint2) 에서 현재 (한 스텝 진행 후의) 펜 끝 좌표를 정밀 계산합니다. 
계산한 pos를 바탕으로 const penScreenX = pos.x * scale; const penScreenY = pos.y * scale; : 스케일을 곱하여 화면 픽셀 좌표계의 펜 위치를 구합니다. 
펜 위치를 구한 뒤, penState에 따라서 그릴지 말지를 결정하고, prevPenScreenX/Y, prevPenState를 갱신합니다.
마지막으로 return true;를 반환하는데, 이 함수의 호출부에서는 반환값을 체크하여 false면 루프를 멈추고, true면 계속 반복합니다. 즉, 더 그릴 명령이 남아있는 한 true를 반환하고, index가 끝까지 가면 처음 부분에서 return false 되어 루프가 종료됩니다.

playJsonStepAndBake()는 한 스텝의 시뮬레이션 + 해당 선분 즉시 그리기를 수행합니다. 이 때, 로봇팔 이미지의 랜더링은 drawMode 1과 같이 프레임 당 한번 진행되고, 그리기 궤적만 빠르게 진행되어 사용자가 그리기가 빠르게 진행되는 것처럼 느끼게 됩니다.

### bakeAllToTrailLayer()
bakeAllToTrailLayer() 함수는 현재 plotto.motionJson에 담긴 전체 경로를 한꺼번에 모두 그려주는 기능입니다. 
이 함수는 drawMode 3일 때 실행됩니다.
그리기 형식은 playJsonStepAndBake() 함수와 유사하나, 그리기를 motionJson의 끝까지 한번에 그립니다.

#### 실행 동작
먼저 재생상태를 초기화합니다.jsonIndex, currentAngleJoint1, currentAngleJoint2, $('pen').d 등 변수를 초기화하고, trailLayer도 초기화합니다. 
이후 while (jsonIndex < plotto.motionJson.length)을 통해 motionJson의 모든 명령을 처리합니다.
playJsonStep을 통해 한스텝의 각도값 / 펜 상태를 갱신하고, 이 정보를 trailLayer에 누적합니다. 이를 motionJson의 끝까지 진행합니다.
루프가 끝나면, isPlaying을 false로 설정하고, 모드를 0으로 초기화 하며, 펜 정보도 초기화합니다.


함수 실행이 끝나면 trailLayer에는 주어진 motionJson 전체 경로가 한 번에 그려져 있게 됩니다. 그리고 drawMode를 0으로 돌려놓았으므로, 이후 drawSimulator에서 자동 재생 루틴이 돌지 않고, 로봇은 멈춘 상태(마지막 위치)로 유지됩니다.

### setupSimulator(p)
setupSimulator(p) 함수는 p5.js가 요구하는 setup 함수로, 시뮬레이터 초기 설정 작업을 수행합니다. 이 함수는 sketch()에서 p5 인스턴스를 생성할 때 연결되었으므로, 한 번만 실행됩니다.

#### 실행 동작
캔버스 크기 설정 : canvasWidth, canvasHeight를 통해 캔버스 크기를 결정합니다. 또한 p.frameRate(100)을 통해 p5의 프레임레이트를 100으로 설정합니다.
이미지 리소스 : spine.images.get()을 통해 이미지의 실제 경로를 얻고, p.loadImage()를 호출하여 경로의 이미지를 로드합니다.

초기 값 설정 : initLinkGeometry(), initBasePosition() 함수 호출을 통해 baseX,baseY와 링크 길이와 각도(link1Length, link2Length, upperRestAngle, foreRestAngle)를 계산합니다. 이후 계산한 값을 plotto.configure({ ... })을 통해 plotto 객체에 전달합니다.

펜 궤적 레이어 설정 : •	trailLayer = p.createGraphics(canvasWidth, canvasHeight)를 통해 p5의 레이어를 생성합니다. 이후 	trailLayer.clear()를 통해 방금 생성한 그래픽에 투명 배경을 지정합니다.(이후 여기에 선을 그릴 때 배경이 투명하므로, 메인 화면에 겹쳐 그려도 선 이외에 다른 것은 보이지 않습니다.)

팝업 크기 조정 및 캔버스 생성 : w2custompopup.resize(canvasWidth + 16, canvasHeight + 96)를 통해 팝업창의 크기를 캔버스 크기에 맞게 재조정하며(16, 96과 같은 수는 여유 offset 입니다.), •	p.createCanvas(canvasWidth, canvasHeight)를 통해 실제 p5 캔버스를 생성합니다.

setupSimulator()는 시뮬레이터가 동작하기 위한 모든 초기 준비 작업을 수행합니다: 화면 구성, 리소스 로드, 기하계산, 전역상태 세팅, UI 동기화 등을 마치고, 마지막에 캔버스를 만들어놨으므로, 이후 자동으로 p5가 drawSimulator 함수를 매 프레임 호출하게 됩니다.

### drawSimulator(p)
drawSimulator(p) 함수는 p5.js의 draw 루프 함수로, 화면을 지속적으로 업데이트하여 애니메이션과 상호작용을 처리합니다.
이 함수는 매 프레임 호출되며, 내부에서 현재 모드와 상태에 따라 로봇 팔의 움직임과 그리기를 수행합니다.

#### 실행 동작

디버그 프레임 증가: 프레임마다 debugFrame 변수를 1 씩 증가시킵니다.
모드에 따른 상태 설정 : drawMode에 따라 모드를 설정합니다.  
drawMode가 1일 경우(수동 모드)
```javascript
const step1 = $("encoder.joint_1").d;
const step2 = $("encoder.joint_2").d;
currentAngleJoint1 = normalizeAngle(stepToDeg(step1));
currentAngleJoint2 = normalizeAngle(stepToDeg(step2));
```
$("encoder.joint_1").d, $("encoder.joint_2").d 엔코더 값을 currentAngleJoint1/2에 대입합니다. 이로써 사용자 입력이 로봇팔 각도에 바로 반영됩니다(dashBoard에서 입력을 $("encoder.joint_1").d, $("encoder.joint_2").d에 대입합니다.)

drawMode가 1이 아닐 경우(자동 모드)
```javascript
isPlaying = true;
```
isPlaying 변수를 true로 변경하여 자동모드 변수를 변경합니다.

화면 초기화 : p.background(245)로 캔버스 전체를 밝은 회색 배경으로 체웁니다(이 때, 이전 프레임에 그린 로봇, 텍스트가 지워집니다.)
```javascript
if (trailLayer) { p.image(trailLayer, 0, 0); } // 이전 궤적 그리기
```
trailLayer가 존재하면, 그것을 현재 프레임에 그립니다.(trailLayer에는 그동안 펜으로 그린 궤적이 저장되어 있으므로, 이전에 그린 빨간 선 경로가 캔버스에 유지됩니다.)

스케일 적용 : 
```javascript
p.scale(scale)
```
이후의 그리기 연산은 미리 정한 scale을 적용합니다.

자동 모션 명령 처리(수동은 제외) : 
```javascript
 	if (plotto.motionJson.length > 0) {
    if (drawMode === 1) { ... }
    else if (drawMode === 2) { ... }
    else if (drawMode === 3) {...}
}
```
drawMode 1일 경우, playJsonStep()을 호출하여 한 스텝만 처리합니다.
drawMode 2일 경우, performance.now() 함수를 사용하여, 0.1밀리초(빠른 속도) 단위로 playJsonStepAndBake() 함수를 실행합니다. 이렇게 해서 한 프레임 내에 많은 스텝을 처리하여 빠른 그리기를 구현하였습니다.
이 때에는 그리기는 한 프레임에 여러번 실행되고 로봇팔 이미지 랜더링은 한 프레임에 한번 실행되어, 실제적으로는 빠르게 그려지는 것으로 보이게 됩니다.
drawMode 3일 경우, bakeAllToTrailLayer() 함수를 사용하여, motionJson를 while문을 통해 한번에 탐색하여 한번에 trailLayer에 그리기를 수행합니다.

정기구학 계산 : 모드를 통해 정해진 currentAngleJoint1 / 2에 맞는 로봇 관절의 위치와 펜 위치를 계산합니다.

관절 위치 계산 : 

펜 위치 및 실시간 궤적 추가 : 
penX, penY에 x3, y3의 펜 끝 좌표를 저장하여, scale 만큼을 곱한 penScreenX, penScreenY를 계산하고, prevPenState와 $('pen').d를 통해 궤적을 추가합니다. 이 궤적 추가는 수동 모드와, 자동모드 (drawMode === 1)에서 그리기를 보장하기 위함입니다.

관절 범위 기록 : 
```javascript
  if (debugFrame > 5) {
    minJoint1 = Math.min(minJoint1, currentAngleJoint1);
    maxJoint1 = Math.max(maxJoint1, currentAngleJoint1);
    minJoint2 = Math.min(minJoint2, currentAngleJoint2);
    maxJoint2 = Math.max(maxJoint2, currentAngleJoint2);
  }
```
debugFrame 5 이상일 시, currentAngleJoint 값에서 기록된 관절 범위를 기록합니다.
디버그 텍스트 출력 : 
```javascript
  p.push(); p.fill(0); p.textSize(12); // 글자색을 검정, 크기를 12px로 설정하고 그래픽 상태 저장
  p.text(`J1: ${currentAngleJoint1.toFixed(2)} deg`, 50, 50); // 현재 joint 1 각도(도 기준)
  p.text(`J2: ${currentAngleJoint2.toFixed(2)} deg`, 50, 70); // 현재 joint 2 각도(도 기준)
  const encStep1 = $("encoder.joint_1").d;
  const encStep2 = $("encoder.joint_2").d;

  p.text(`ENC1: ${encStep1} step`, 50, 90); // 현재 joint 1 각도(Step 기준)
  p.text(`ENC2: ${encStep2} step`, 50, 110); // 현재 joint 2 각도(Step 기준)
  p.text(`Pen X: ${x3.toFixed(1)} px`, 50, 130); // penX 좌표
  p.text(`Pen Y: ${y3.toFixed(1)} px`, 50, 150); // penY 좌표

  p.text(isPlaying ? "Playing" : "Paused", 50, 170); // Playing 여부(자동 / 수동 여부)
  p.text(`Pen: ${$('pen').d}`, 50, 190); // pen이 1인지 0인지 표시
  p.text(`MIN J1: ${minJoint1.toFixed(2)}`, 50, 290); // minJont1의 값(작동된 joint1각도 중 최소 값)
  p.text(`MAX J1: ${maxJoint1.toFixed(2)}`, 50, 310); // maxJont1의 값(작동된 joint1각도 중 최대 값)
  p.text(`MIN J2: ${minJoint2.toFixed(2)}`, 50, 330); // minJont2의 값(작동된 joint2각도 중 최소 값)
  p.text(`MAX J2: ${maxJoint2.toFixed(2)}`, 50, 350); // maxJont2의 값(작동된 joint2각도 중 최대 값)
  p.pop();
```

drawSimulator는 이와 같은 과정을 매 프레임 반복합니다. 수동 모드라면 사용자가 값을 설정할 때 마다 currentAngleJoint에 반영되어 그림이 움직이고, 자동 모드라면 motionJson을 따라 그림을 그립니다.

## 동작 흐름 정리

### 시뮬레이터 실행 시작
sketch() 함수가 실행되고, 이 함수는 모달 팝업과 p5 인스턴스를 생성하여 setupSimulator과 drawSimulator를 연결합니다.

### 초기 설정
팝업창 / 캔버스 / 프레임 레이트 설정 및 이미지 리소스를 불러오고, spine으로부터 받은 이미지 좌표 데이터를 이용하여 링크 길이와 각도를 계산합니다.
이후 로봇 베이스 위치를 결정하고 plotto 객체에 configure를 통해 각종 설정값을 전달합니다.
또한 펜 궤적을 그릴 trailLayer를 생성한 뒤, p5 canvas를 생성하면 draw 루프가 실행됩니다.

### 메인 루프 (drawSimulator)
p5가 설정한 100fps를 목표로 drawSimulator를 계속 호출하면서 시뮬레이션이 진행됩니다. 각 프레임마다 현재 모드를 확인하고 수동 / 자동 모드 분기 처리를 진행합니다. 수동이면 입력값을 읽어 currentAngleJoint에 반영하고, 아닐 시 isPlaying 변수만 세팅합니다.

이후 배경을 지우고, 이미 그려진 궤적(trailLayer)를 다시 그립니다.(이전 프레임에서 그린 궤적 유지를 위함.)

자동모드 동작 실행 : 만약 자동모드 일 경우, drawMode 값에 따라 한 스텝씩 또는 여러 스텝을 빠르게 처리합니다. 이 과정에서 currentAngleJoint와 펜 상태 등이 갱신되고, (고속모드의 경우 동시에 선도 그려짐) jsonIndex가 진행됩니다.

*** drawMode 1 일시 *** : drawSimulator가 매 프레임 playJsonStep()을 호출하여 한 스텝씩 진행하며 currentAngleJoint가 갱신됩니다.
*** drawMode 2 일시 *** : drawSimulator가 한번 호출 될 때, 여러 스탭을 소비하며 궤적을 그립니다.
*** drawMode 3 일시 *** : 내부에서 루프를 돌며(while) drawSimulator의 개입 없이, 즉시 trailLayer에 그림을 완성합니다.

로봇팔 이미지 랜더링 : 계산된 각도와 좌표를 이용해, 상부팔, 하부팔, 베이스 이미지를 적절한 위치와 회전으로 그립니다. 

펜 궤적 그리기 : 펜 끝 좌표를 이용하여, 펜이 내려져 있다고 판단 시(prevPenState, $('pen').d의 변수에 따름) trailLayer에 추가로 선을 그립니다.

디버그 정보 업데이트 : 관절 각도의 min/max, 상태 텍스트 등 여러 텍스트를 출력합니다.

## 결론
sktech 부분은 spine에서 정의된 motionJson 정보를 바탕으로 로봇팔을 랜더링을 진행합니다.
