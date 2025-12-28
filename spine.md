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

#### 입력 매개 변수


#### 실행 동작




## 동작 흐름 정리

## 결론