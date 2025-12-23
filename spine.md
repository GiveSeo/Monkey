# spine에 대해

spine 코드에는 text로 제공된 svg 파일을 파싱하여 동작할 수 있는 명령 모음 motionJson 으로 해석하는 plotto 클래스가 정의되어 있습니다.


## 주요 변수

### 로봇팔 이미지 변수
로봇팔 이미지의 치수에 대한 변수입니다.
이 값들은 로봇 팔의 기구학적 특성을 설정하고, 이미지 또는 설계도에서 측정된 좌표를 사용하여 로봇 팔의 길이와 각도를 계산하는 데 활용됩니다.
#### TOP_JOINT_X, TOP_JOINT_Y
plotto 본체 이미지에서 관절 위치의 좌표 변수입니다.

#### UPPER_JOINT_BASE_X, UPPER_JOINT_BASE_Y
plotto 상부 팔의 관절 위치 좌표 변수입니다. 상부 팔의 시작점이라 볼 수 있습니다.

#### UPPER_JOINT_ELBOW_X, UPPER_JOINT_ELBOW_Y
plotto 상부 팔과 하부 팔이 연결되는 팔꿈치 부분의 상부 팔 이미지 좌표 입니다.

#### FORE_JOINT_ELBOW_X, FORE_JOINT_ELBOW_Y
plotto 상부 팔과 하부 팔이 연결되는 팔꿈피 부분의 하부 팔 이미지 좌표 입니다.

#### FORE_PEN_X, FORE_PEN_Y
plotto 하부 팔에 펜이 연결되는 부분 이미지 좌표 입니다.

#### imageScale
이미지 스케일 변수입니다.


## Plotto 클래스 개요

### 주요 속성 (필드)

#### #baseX, #baseY
로봇팔 기준 좌표입니다. 로봇팔 joint1의 어깨 부분의 좌표를 나타냅니다.

#### #link1, #link2
로봇팔 두 링크(관절 사이)의 길이를 나타냅니다.
link1은 상부 팔, link2는 하부 팔의 길이입니다.
이 값들은 initLinkGeometry()에서 계산됩니다.

#### #upperRestAngle, #foreRestAngle
로봇팔 이미지 상 관절 - 관절 / 관절 - 펜 사이 각도입니다.
이 두 각도는 순 / 역 기구학 계산에 보정값으로 사용됩니다.

#### #JOINT2_OFFSET
로봇팔이 ㄷ자 모양일 때, 

#### #minEncoderJoint1, #maxEncoderJoint1, #minEncoderJoint2, #maxEncoderJoint2
joint1, joint2 두 관절의 각도 제약을 나타냅니다. 로봇팔의 로봇 스펙상 각도 범위를 나타낸 값으로, 관절이 움직일 수 있는 최소/ 최대 값 각도를 의미합니다.



## 주요 함수

### function extractPathPointsFromSvg(svgText, opts = {})
extractPathPointsFromSvg(svgText, opts={}) 함수는 SVG 이미지 소스 (svgText)를 입력으로 받아, 그 안에 포함된 모든 도형(graphic element)들의 경로를 따라 일정 간격의 점들을 추출하고 이를 좌표 리스트로 반환하는 기능을 합니다. 

#### 매개 변수
이 함수는 두개의 인수를 받습니다.
svgText : SVG 파일의 원본 텍스트 입니다. SVG를 문자열 형태로 제공하면, 함수가 이를 파싱하여 DOM 구조로 변환합니다.
opts : 경로 추출과 샘플링 옵션을 담은 객체입니다. 기본값은 {}이며, 다음과 같은 속성을 지정할 수 있습니다.
##### opts 옵션
|옵션 이름|타입 / 기본값 | 설명 |
|------|---|---|
|sampleStep |number / `null`|샘플링 간격를 직접 지정합니다. 이 값이 주어지면 각 경로를 고정된 간격으로 샘플링하며, samplesPerPath설정은 무시됩니다. |
|samplesPerPath |number / `200`|각 도형의 경로를 몇 등분으로 나눌지에 대한 대략적인 기준입니다. 경로 전체를 이 값으로 나누어 평균 간격을 계산합니다. |
|maxStepClamp |number / `2`|샘플 간격의 상한값을 지정합니다. 너무 긴 경로의 경우 간격이 지나치게 커지는 것을 방지하기 위한 값으로, 간격이 이보다 크다면 이 값으로 고정됩니다.|
|maxSamplesPerPath  |number / `3000`|각 경로당 생성될 수 있는 최대 샘플 점 갯수입니다.|
|bridgeScale |number / `1.0`|path간 이동 경로의 밀도를 결정하는 스케일 변수입니다.| 

opts를 통해 경로 샘플링 간격과 밀도를 세밀하게 조정할 수 있습니다.

#### 실행 동작

##### SVG 파싱 및 초기 설정
***DOM 객체 생성*** : 함수는 주어진 SVG 텍스트를 파싱하여 DOM 객체를 생성합니다. 이 때, DOM 파서를이용하여 실제 SVG DOM 객체로(doc)변환합니다.
***임시 SVG 엘리먼트 생성*** : 
***변수 초기화*** : 최종으로 반환할 배열인 points를 초기화합니다.(point에는 {x, y, pen} 객체가 순서대로 쌓입니다.) 또한, 이전 도형의 마지막을 저장하는 lastGlobalPt도 초기화합니다.(첫 도형 후에 값을 채웁니다.), 이 값은 path 간 이동 경로를 계산하기 위해 사용됩니다.

##### 변환 행렬 유틸리티
SVG 요소들은 transfrom 속성을 통해 평행이동, 회전, 스케일, 기울이기(skew)등의 변환을 가지며, `<g>` 그룹을 이용해서 상위 그룹들의 변환이 누적 적용 될 수 있습니다. spine 코드에선 이러한 변환을 적용하기 위해 변환 affine 행렬을 이용해서 좌표계 경로를 구하며, 이 행렬 유틸리티 함수에 대해 소개하고자 합니다.

###### I() 
항등 행렬을 반환합니다(a=1, d=1이고 나머지 0인 단위행렬)
###### T(tx, ty) 
이동 행렬을 반환합니다. x방향 tx, y 방향 ty만큼 평행이동 시키는 행렬입니다.
###### S(sx, sy)
스케일 행렬을 반환합니다. x축 방향 sx배 y축 방향 sy배 확대/축소 합니다.
###### R(deg) 
회전 행렬을 반환합니다. 주어진 각도 만큼 원점을 중심으로 회전하는 행렬입니다.
###### KX(deg) 
X축 기준 기울이기 행렬을 반환합니다. 주어진 각도 만큼 x축 방향으로 기울이는 변환입니다.
###### KY(deg)
Y축 기준 기울이기 행렬을 반환합니다. 주어진 각도 만큼 y축 방향으로 기울이는 변환입니다.

###### multiplyMatrices(m1, m2)
두개의 행렬 m1,m2를 받아 순서대로 합성한 결과 행렬을 반환합니다. 

###### parseTransform(transformStr)
"translate(...)", "rotate(...)"와 같은 SVG transform 속성 문자열을 읽어들이고, 그 변환들의 합성 결과를 하나의 행렬로 변환하는 함수입니다. 
정규식으로 "이름" 패턴을 찾아서 각 변환명령을 순서대로 해석하며, 앞서 정의한 행렬 함수들을 이용합니다.

각 변환 행렬 m을 이전까지의 누적 행렬 M에 곱셈하며 합성해 나갑니다. 이렇게 하면 transform 문자열에 나열된 변환이 순차 적용된 최종 행렬 M을 얻게 됩니다.
###### getAccumulatedTransformInclusive(el)
`<g>`그룹에 속한 svg는 자신의 transform을 포함하여 부모를 따라 최상위 svg까지 거슬러 올라가며 모든 변환을 합성해야 합니다. 
이 함수는 요소 자체 -> 부모의 변환 .. 순으로 모두 곱한 전체 변환 행렬을 반환합니다.

###### getAccumulatedTransformParentsOnly(el) 
`<use>` 요소를 구할 때, 자기 자신의 transform을 적용하기 전 상위 요소의 transform을 적용해야 합니다.
이 함수는 요소 자체의 변환을 제외하고 부모들의 누적 변환을 구하여 반환합니다.

###### shouldRender(el)
실제로 그려지지 않는 요소를 제외하는 필터 함수입니다.
예를 들어, `<defs>`, display="none"와 같은 요소는 그려지지 않는 요소인데, 이와 같은 것을 제외합니다.

##### 그래픽 요소
SVG 내부의 각 도형 요소들을 수집하고, 각 요소 별로 경로 정보를 준비합니다. 이 때, 크게 두가지 요소를 다루는데, 직접적인 그래픽 요소(path와 기본 도형)와 `<use>`참고 요소 입니다.
***기본 그래픽 요소 처리***
svgRoot.querySelectorAll("path, circle, rect, ellipse, line, polygon, polyline")를 이용하여 svg 내 모든 기본 그래픽 요소를 선택합니다.
이 때, shouldRender(el)를 통해 렌더링 대상인지 확인하고, 맞다면 allElements 배열에 추가합니다. 이 때, 추가 시에 요소의 정보도 같이 저장합니다.
```javascript
 	allElements.push({
    element: el, // 요소
    transform: getAccumulatedTransformInclusive(el), // 누적 변환 행렬
    tagName: el.tagName.toLowerCase() // 태그 명
});
```
***`<use>` 요소 처리***
svg에서는 `<use xlink:href="#id">`와 같은 형태로 사전에 정의된 도형을 복사하여 쓸 수 있습니다.
`<use>` 요소는 자신의 위치(x, y 속성)와 변환(transform 속성)을 가질 수 있으며, 참조 대상 요소의 정의 변환까지 합쳐져서 최종 위치가 결정됩니다.
코드에선 `svgRoot.querySelectorAll("use")`를 통해 모든 `<use>`요소를 찾은 뒤, `shouldRender(useEl)`로 확인하여 처리합니다. 각 `<use>`에 대해 `resolveUseElement(useEl)` 함수를 호출하여 실제 참조된 원본 요소와 그 변환 정보를 얻습니다. 
###### resolveUseElement(useEl) 함수
이 함수는 `<use>` 요소의 원본 도형 + 여러 단계의 변환을 모두 해석해 하나의 실제 도형으로 변환한 뒤 렌더링 대상에 포함시키는 과정을 거친다.
`<use>`의 href 속성에서 참조 대상 추출 : `<use>` 요소의 href 또는 xlink:href 값을 읽어 #id 형태의 참조 대상 id를 추출하고, svgRoot.querySelector('#id')로 원본 그래픽 요소를 찾습니다.

원본 요소 존재 확인 : 만약 참조된 id에 해당 원본 요소가 존재하지 않으면, 건너뜁니다.

`<use>`요소의 x, y 속성을 평행이동 행렬로 변환 : `<use>` 요소의 x,y 속성을 읽어 (x,y)로 이동시키는 평행이동 행렬 T로 변환합니다.

변환 행렬 수집 : `<use>`로 인해 적용되는 모든 변환을 다음 네가지 종류로 분리하여 수집합니다.

| 구분 | 설명 |
|------|------|
| 부모 그룹 변환 | `<use>` 요소의 상위 `<g>` 요소들에 적용된 transform을 누적한 변환 행렬 |
| `<use>` 자체 변환 | `<use>` 요소에 직접 지정된 `transform` 속성으로부터 생성된 변환 행렬 |
| `<use>` 위치 이동 | `<use>` 요소의 `x`, `y` 속성으로부터 생성된 평행이동(translate) 행렬 |
| 원본 요소 변환 | `<use>`가 참조하는 원본 그래픽 요소(ref)에 적용된 `transform` 속성으로부터 생성된 변환 행렬 |

최종 변환 행렬 합성 : 수집된 변환 행렬을 부모 -> `<use>` -> x,y 이동 -> 원본 요소 변환 순으로 적용하여 하나의 행렬로 합성합니다.


`<use>` 해석 결과 객체 생성 : 해석된 `<use>` 요소에 대해 다음 정보를 포함하는 객체를 생성합니다.


렌더링 대상에 추가 : 위에서 해석된 객체를 allElements 배열에 추가하여, 렌더링 처리에 포함합니다.

이 단계까지 왔다면, allElements 배열에는 SVG 내 모든 처리 대상 도형이 등록되어 있습니다.


##### 도형을 경로 데이터(path)로 변환
SVG내에는 path 요소 외에도 `<circle>`,`<rect>` 등 다양한 기본 도형이 있습니다. 이 함수에서는 모든 도형을 path 데이터로 변환하여 처리합니다.
###### circleToPathLocal(cx,cr,y)
원은 path로 변환하기 위해 두개의 호로 표현합니다. svg path의 A(원호) 명령을 이용하여 두개의 호로 원을 구성합니다. 
`<circle>`요소의 cx, cy, r 속성을 읽어 중심 좌표와 반지름을 얻습니다.
원의 가장 왼쪽 점 (cx-r, cy)에서 M 명령으로 경로를 시작합니다.
첫 번째 A r r 0 1 1 명령으로 오른쪽 점 (cx + r, cy)까지 반원을 그립니다. 이후 두 번째 A r r 0 1 1 명령으로 다시 시작점 (cx - r, cy)까지 반원을 그립니다. 마지막에 Z 명령으로 경로를 닫아 하나의 완전한 원 path를 생성합니다.
이 방식으로 두개의 호가 연결되어 하나의 원 경로가 됩니다.

###### ellipseToPathLocal(cx, cy, rx, ry)
타원은 circle과 거의 동일한 방식으로 처리 되며, X·Y 방향 반지름이 서로 다른 원으로 생각할 수 있습니다.
`<ellipse>` 요소의 cx, cy, rx, ry 속성을 읽습니다. 이후 (cx - rx, cy)에서 M 명령으로 시작하며, A rx ry 0 1 1 명령으로 (cx + rx, cy)까지 반원을 그립니다.
다시 A rx ry 0 1 1 명령으로 시작점까지 이어줍니다. 마지막으로 Z 명령으로 경로를 닫아 하나의 타원 path를 생성합니다.

###### rectToPathLocal(x, y, width, height, rx, ry)
사각형은 rx, ry(모서리 반경)에 따라 두가지 방식으로 처리합니다.

***공통 처리***
x, y, width, height, rx, ry 속성을 읽습니다. 여기서 rx, ry가 없으면 0으로 처리하고, 하나만 지정된 경우 두 값을 동일하게 맞춥니다.
또한, rx > width / 2 이면 width / 2로 제한하고, ry > height / 2 이면 height / 2로 제한합니다.

***모서리가 둥근 사각형(rx > 0 && ry > 0)***
rx > 0 이고 ry > 0 인 경우, 각 모서리를 타원 1/4 호에 근사한 베지어 곡선으로 처리합니다.
원의 1/4을 큐빅 베지어로 근사하기 위해 K = 0.5522847498307936 상수를 사용하며, 각 모서리에 대해
ox = rx * K, oy = ry * K 값을 계산합니다.
직선(L)과 큐빅 베지어(C) 명령을 조합하여 네 모서리를 부드럽게 연결합니다. 이후 네 모서리를 모두 연결한 후 Z 명령으로 경로를 닫습니다.

이 결과, 원래 rect의 둥근 모서리를 rx, ry 반지름의 타원 호에 근접한 path로 변환합니다.

***모서리가 직각인 사각형(rx <=1e-9 && ry <=1e-9)***
M x,y로 시작한 뒤, 시계 방향으로 네 개의 L 명령을 사용해 꼭짓점을 연결합니다.
마지막에 Z 명령으로 경로를 닫아 단순 사각형 path를 생성합니다.

###### lineToPathLocal(x1, y1, x2, y2)
`<line>` 요소는 시작점 (x1, y1)과 끝점 (x2, y2)을 가지는 단순 선분입니다.
M x1,y1 → L x2,y2 형태의 path로 변환합니다.

###### polygonToPathLocal(points)
`<polygon>` 요소의 points 속성을 파싱하여 좌표 배열을 얻습니다.
첫번째 점을 M 명령으로 설정하며, 이후 각 점마다 L 명령을 추가하여 직선을 그립니다.
polygon은 닫힌 도형이므로 마지막에 Z 명령을 추가하여 경로를 닫습니다.

###### polylineToPathLocal(points)
`<polygon>` 요소의 points 속성을 파싱하여 좌표 배열을 얻습니다.
첫번째 점을 M 명령으로 설정하며, 이후 각 점마다 L 명령을 추가하여 직선을 그립니다.
polygon은 열린 꺾은 선이므로 마지막에 Z 명령을 추가하여 경로를 닫습니다.


##### 경로 길이 계산
이제 모든 요소에 대해 path 데이터가 준비되었으므로, 각 경로의 길이를 계산하는 단계를 거칩니다.
각 경로의 길이를 구하는 이유는, 점 샘플링 간격을 결정하고 최적화 하기 위해서입니다.
코드에서는 모든 요소에 대해 다음 과정을 수행하고, 결과를 prepared라는 새로운 배열에 모읍니다.

임시 path 요소 생성 : 각 요소에 대해 앞서 얻어둔 path 데이터 문자열과, 누적 변환 행렬을 꺼냅니다. 이후 document.createElementNS(..., "path")로 새로운 `<path>` 요소를 생성하고, 해당 경로 문자열을 d 속성에 지정합니다.
만약 누적 변환 행렬이 존재한다면, 이 path 요소에 행렬을 적용합니다. 행렬 m이 {a, b, c, d, e, f}라면 pathEl.setAttribute("transform", "matrix(a,b,c,d,e,f)") 형태로 지정합니다. 이를 통해 path가 실제 화면 좌표계에서 변환된 모양으로 취해집니다.

이 path 요소를 아까 만든 tempSvg (숨겨진 SVG) 내부에 추가합니다. 이러면 브라우저 엔진이 해당 path의 길이와 모양을 계산할 수 있는 상태가 됩니다.

경로 길이 측정 : pathEl.getTotalLength()를 호출하여 해당 path (변환 적용된)의 전체 길이 (L)를 얻습니다.
길이가 유효하게 계산된 경우 (L > 0), 현재 요소의 정보를 prepared 배열에 추가합니다.
`prepared.push({ dAttr, transformMatrix, length: L });`

이제 prepared에 경로 데이터와 길이가 모이게 되고, 이 정보에 기반하여 점 샘플링을 수행합니다.

##### 점 샘플링
prepared에 담긴 각 경로를 따라 일정한 간격으로 점을 찍어 points 배열에 누적합니다. 샘플링 단위는 opts와 경로의 길이에 의해 결정되고, 각 도형의 bridge 부분도 함께 처리됩니다.

샘플링 루프 시작 :

샘플링 간격 설정 : 옵션으로 sampleStep이 주어졌다면, step = sampleStep으로 설정합니다. 
sampleStep이 없다면, 이 경로의 길이를 samplePerPath로 나눈 값으로 step을 정합니다.
이 때, 이렇게 계산한 step이 maxStepClamp보다 큰 경우, step = maxStepClamp로 상한을 제한합니다.(너무 간격이 커지는 것을 방지)

최대 점 수 제한 : 경로가 매우 길어서 step 간격으로 찍으면 점 개수가 maxSamplePerPath를 초과할 경우, 간격을 조금 늘려 점 개수를 제한합니다.
이 과정으로 최종 step이 결정됩니다.

경로를 따라 점 찍기 : 이제 루프를 돌며, 경로를 시작부터 끝까지 step 간격으로 따라가면서 좌표를 샘플링합니다.
len에 step을 더해가면서 루프가 진행되며, `pathEl.getPointAtLength(len)`를 통해 len 거리만큼 떨어진 지점의 좌표를 객체로 반환하고, isFirst가 true일시, pen을 0, 아닐 시 pen을 1로 처리하여 localPoints에 저장합니다.이후 isFirst를 false로 변경합니다(이로써, path 첫 점 이후는 모두 pen 1로 처리됩니다.)

또한, 루프 종료 후, 별도로 pathEl.getPointAtLength(totalLength)를 호출하여 경로의 마지막 점을 얻고, 이를 localPoints에 추가합니다.

임시 path 제거 : 사용이 끝난 pathEl은 다시 tempSvg.removeChild(pathEl)로 제거합니다. 이는 경로 겹침 문제를 피하고, 메모리 소비를 줄이기 위해서 입니다.

도형 간 bridge 추가 : 한 도형의 점을 points에 추가하기 전에, 만약 이전 도형의 마지막 위치가 있을 경우(lastGlobalPt가 null이 아닌 경우), 그 점에서 현재 새 경로의 첫 점까지 펜을 들어 이동하는 경로를 추가로 샘플링합니다.
bridge 샘플링 밀도는 기본 step에 opts.bridgeScale를 곱해 조절합니다.
예시 : bridgeStep = step * bridgeScale
bridge 구간은 펜을 든 이동이므로, pen은 0으로 기록합니다.


점 누적 및 lastGlobalPt 갱신 : 29.	이제 브리지 점(만약 있다면)이 points에 추가된 상태에서, 현재 도형의 실제 경로 점들(localPoints 배열)을 순서대로 points 배열에 이어붙입니다.
이후 lastGlobalPt를 localPoints의 마지막 점으로 업데이트 합니다.
모든 prepared 항목에 대해 위 과정을 마치면, points 배열에는 SVG의 모든 도형 경로를 따라 생성된 점이 순서대로 담기게 됩니다.
마지막으로 tempSvg (임시로 만들었던 보조 SVG 요소)를 document.body.removeChild(tempSvg)로 제거하여, 화면에 보이지 않게 생성했던 요소를 정리합니다. 그리고 points 배열을 return하여 함수 결과를 내보냅니다.

##### 출력 결과

이 함수의 반환값 points는 다음과 같은 javascript 배열입니다.
```javascript
[
  { x: Number, y: Number, pen: Number },
  { x: Number, y: Number, pen: Number },
  ...
]
```
이 결과를 통해, 좌표 -> 로봇의 step 증분값 으로 바꾸는 처리를 거처, 로봇이 이용 가능한 명령으로 변경하게 됩니다.

## 동작 흐름 정리

## 결론