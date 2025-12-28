# Plotto Spine Code

## 0. 개요

본 문서는 로봇 드로잉 시스템 **Plotto**의 `Spine.js` 파일을 설명합니다.
이 문서는 Plotto 로봇 팔 코드의 구성 요소와 작동 방식을 설명합니다. 해당 코드는 2자유도(2-DOF) 로봇 팔을 제어하여 SVG로 정의된 경로를 따라 펜으로 그림을 그리는 기능을 제공합니다. 코드의 주요 상수, 클래스 속성, 함수, 그리고 전체적인 동작 흐름을 단계적으로 살펴보겠습니다.

---

## 1. 상수 정의

<details>
<summary><b>자세히 보기</b></summary>
<div markdown="1">

코드 상단에는 로봇 팔의 물리적인 치수와 초기 상태를 나타내는 상수들이 정의되어 있습니다. 자세한 설명은 다음과 같습니다.

- **`TOP_JOINT`**

  로봇 팔 상부 관절의 이미지 좌표입니다.

  ```javascript
  const TOP_JOINT_X = 220;
  const TOP_JOINT_Y = 547;
  ```

- **`UPPER_JOINT_BASE`**

  로봇 팔 상부 암(upper arm)이 기준(base)에 부착된 지점의 이미지 좌표입니다. 상부 암의 시작점이라고 볼 수 있습니다.

  ```javascript
  const UPPER_JOINT_BASE_X = 747;
  const UPPER_JOINT_BASE_Y = 226;
  ```

- **`UPPER_JOINT_ELBOW`**

  : 전완의 시작점(팔꿈치)의 이미지 좌표입니다. 이상적으로는 UPPER_JOINT_ELBOW와 동일한 위치여야 하지만, 측정 오차로 약간 차이가 있을 수 있습니다.

  ```javascript
  const UPPER_JOINT_ELBOW_X = 195;
  const UPPER_JOINT_ELBOW_Y = 383;
  ```

- **`FORE_JOINT_ELBOW`**

  전완의 시작점(팔꿈치)의 이미지 좌표입니다. 이상적으로는 UPPER_JOINT_ELBOW와 동일한 위치여야 하지만, 측정 오차로 약간 차이가 있을 수 있습니다.

  ```javascript
  const FORE_JOINT_ELBOW_X = 195;
  const FORE_JOINT_ELBOW_Y = 385;
  ```

- **`FORE_PEN`**

  로봇 팔 끝에 부착된 펜(Pen) 끝점의 이미지 좌표입니다. 전완의 끝점(펜이 위치한 지점)을 나타냅니다.

  ```javascript
  const FORE_PEN_X = 778;
  const FORE_PEN_Y = 612;
  ```

- **`imageScale`**

  이미지 좌표를 실제 로봇의 길이 단위로 변환하기 위한 스케일 계수입니다.

  예) `const imageScale = 0.5;` : 이미지 길이를 절반 스케일 후 실제 길이로 사용합니다.

> 이 값들은 로봇 팔의 기구학적 특성을 설정하고, 이미지 또는 설계도에서 측정된 좌표를 사용하여 로봇 팔의 길이와 각도를 계산하는 데 활용됩니다. 다음으로 주요 Plotto의 클래스를 살펴보겠습니다.

</div>
</details>

---

## 2. 클래스 정의
### 필드(변수)
모든 변수는 getter / setter가 정의되어 있습니다.

#### #baseX, #baseY
로봇팔 기준 좌표입니다.
joint1의 모터 부분이 위치하는 좌표를 나타냅니다.

#### #link1, #link2
로봇 팔의 두 관절 사이 길이를 나타냅니다. #link1은 상부 팔(joint1 ~ joint2)의 길이, #link2는 하부 팔(joint2 ~ pen)의 길이입니다. 이 값들은 initLinkGeometry()함수에서 계산됩니다.

#### #upperRestAngle, #foreRestAngle
로봇팔이 기준 자세시 이미지 각도를 라디안 값으로 변환한 값 입니다.
upperRestAngle은 상부 팔의 이미지 각도 입니다, foreRestAngle은 하부 팔의 이미지 각도 입니다.
이 두 각도는 순 / 역 기구학 계산에 보정값으로 사용됩니다.

#### #JOINT2_OFFSET 
두번째 관절의 오프셋 각도(offset)입니다. 이 값은 로봇의 각도 기준과 맞추기 위한 offset으로, 로봇팔이 ㄷ자 모양일 때, joint2가 0도이기를 보장하는 offset 입니다. 예를 들어, 로봇 joint2 엔코더가 0일때, 실제 로봇팔이 143도를 이루고 있다면 JOINT2_OFFSET = 143으로 설정하여 기구학 계산시 보정합니다.

#### #minEncoderJoint1, #maxEncoderJoint1, #minEncoderJoint2, #maxEncoderJoint2
로봇팔 관절의 각도 한계(제약)을 나타냅니다. 로봇팔의 물리적 제한이나 안전 범위를 설정한 값으로, 각 관절이 움직일 수 있는 최소/최대 각도를 의미합니다.

#### #STEP_DEG
엔코더 스텝당 각도를 나타냅니다. 즉, 관절을 한 스텝 움직였을 때 몇 도가 회전되는지 정의합니다.
기본 정의 값 0.0109...는 11.25 % 16 % 64로 계산된 값입니다.

#### #MAX_STEPS_PT
한 명령에 허용되는 최대 스텝수 입니다. 모든 motionJson에서의 명령은 MAX_STEPS_PT를 넘을 수 없습니다.

#### #MAX_DELTA_DEG
두 점 사이 최대 허용 각도 변화량 입니다. #STEP_DEG * #MAX_STEPS_PT를 곱하여 계산되며, 기본적으로 0.07도 정도가 됩니다.

#### #SVG_BOX_SIZE
SVG 경로를 로봇 좌표에 매핑할 때의 정규화 박스 크기 입니다. 기본 250으로 매핑되어 있으며, 로봇팔이 (0,0) ~ (250,250) 박스 안에 있는 정보는 그릴 수 있어야 합니다. 즉, 로봇이 그릴 그림의 최대 크기를 정의한다고 볼 수 있습니다.

#### #svgPathPoints
svg경로로부터 추출한 점 좌표 리스트 입니다. 이 리스트에는 {x,y,pen}의 형태로 객체들이 순서대로 들어 있으며, 이 경로를 통해 motionJson 생성을 진행합니다.

#### #motionJson
로봇 팔이 경로를 따라 움직이기 위해 수행해야 할 세부 명령 목록 입니다.
각 명령은{d1,d2,pen}의 형태로 저장되며, d1, d2는 다음 목적지로 가기 위해 움직여야 할 step 정수 값을 나타냅니다.
또한 pen은 해당 지점에서의 pen의 상태(0 = 들어올림, 1 = 내려놓음)입니다. motionJson은 buildMotionJsonFromSvg()에서 생성됩니다.

#### #plot
motionJson으로 생성된 1바이트 배열로, d1,d2,pen의 값에 따라 1바이트로 압축하여 표현한 배열입니다. plot의 표현 방식에 대해선 [Plotto_Path]를 참고해주세요

#### #jsonBuilt 
boolean 값으로, 현 svg에 대해 motionJson이 생성된 적이 있는지에 대한 변수입니다. svg경로를 처리하여 motionJson를 만들면, true로 설정되며, configure()등으로 설정이 변경되면 false로 리셋됩니다. 이 변수는 동일한 경로에 대해 motionJson 중복 생성을 방지하는데에 사용됩니다.

#### constructor()
new Plotto()로 객체를 생성하면 호출되는 생성자입니다.
`$("encoder.joint_1").d  = 0, $("encoder.joint_2").d  = 0`와 같은 엔코더 값 초기화, `$('pen').d = 0`로 초기값을 설정합니다. 필드에 있는 변수들을 한번에 변경 시엔 configure() 함수를 사용합니다.
#### configure()
필드에 있는 모든 변수를 한번에 효율적으로 설정하는 함수입니다.
매개변수로 여러 옵션을 객체 형태로 받으며, 각 옵션은 다음과 같습니다.
##### option
| 항목 | 설명 | 기본값 / 비고 |
|------|------|---------------|
| `baseX`, `baseY` | 로봇 팔 베이스(Joint 1)의 기준 좌표를 설정합니다. | `(0, 0)` |
| `link1Length` | 상부 암(link1)의 길이를 수동으로 지정합니다. | 미지정 시 `initLinkGeometry()`에서 이미지 기반 자동 계산 |
| `link2Length` | 전완(link2)의 길이를 수동으로 지정합니다. | 미지정 시 `initLinkGeometry()`에서 이미지 기반 자동 계산 |
| `upperRestAngle` | 상부 암의 기준 자세 각도를 설정합니다. (라디안) | 미지정 시 이미지 기반 자동 계산 |
| `foreRestAngle` | 전완의 기준 자세 각도를 설정합니다. (라디안) | 미지정 시 이미지 기반 자동 계산 |
| `JOINT2_OFFSET` | 팔꿈치(Joint 2) 관절의 기계적 오프셋 각도를 설정합니다. | `143°` |
| `SVG_BOX_SIZE` | SVG 경로 정규화에 사용하는 기준 박스 크기입니다. | `250` |
| `STEP_DEG` | 엔코더 1스텝당 회전 각도를 설정합니다. | 변경 시 `MAX_DELTA_DEG` 자동 재계산 |
| `MAX_STEPS_PT` | 포인트 간 허용되는 최대 엔코더 스텝 수입니다. | 변경 시 `MAX_DELTA_DEG` 자동 재계산 |
| `minJoint1` | Joint 1(상부 암)의 최소 각도 제한 | 사용자 설정 |
| `maxJoint1` | Joint 1(상부 암)의 최대 각도 제한 | 사용자 설정 |
| `minJoint2` | Joint 2(전완)의 최소 각도 제한 | 사용자 설정 |
| `maxJoint2` | Joint 2(전완)의 최대 각도 제한 | 사용자 설정 |

##### 내부 동작 순서
기구학적 파라미터 설정 : 인자에 따라 #baseX, #baseY, #link1, #link2,upperRestAngle, foreRestAngle, JOINT2_OFFSET 값을 설정합니다. 전달되지 않은 값은 이전 설정이나 기본값을 유지합니다.
SVG / 양자화 파라미터 설정 : SVG_BOX_SIZE, STEP_DEG, MAX_STEPS_PT 값을 갱신합니다. 이때 STEP_DEG나 MAX_STEPS_PT가 변경되면 내부적으로 #MAX_DELTA_DEG (최대 각도 변화량)도 새로운 값으로 업데이트됩니다.
관절 제한 설정 : 만약 새로운 관절 각도 제한 값들이 주어지면 해당 값을 반영합니다.
이전 경로 데이터 초기화 : 설정이 변경되었으므로, #jsonBuilt를 false로 하고, #motionJson과 #plot 배열을 빈 배열로 초기화합니다. 또한, initLinkGeometry()를 호출하여, 현재 이미지 정보 상 #link1, #link2, #upperRestAngle, #foreRestAngle을 계산하여 필드에 설정합니다.


### fkPenXY_deg(j1Deg, j2Deg)
이 함수는 관절 각도(j1Deg, j2Deg)를 받아 펜 끝 좌표(x3,y3)를 계산해 줍니다.

#### 실행 동작

각도 변환 : 우선 도 단위인 j1Deg를 라디안에 맞게 변환하며, 부호를 뒤집습니다(로봇 좌표게(시계 -, 반시계 +)와 반대이기 때문).
이 변환한 수를 theta1에 저장합니다.

이후 theta1에 upperRestAngle을 더한 각도를 theta1_ft에 저장합니다. 이는 이미지 상의 로봇팔 각도를 더한 실제 관절 각도입니다.

j2Deg + this.JOINT2_OFFSET을 더한 실제 각도 값을 라디안으로 변환하고 부호를 뒤집습니다. 이를 theta2에 저장합니다.

팔꿈치 좌표(x2,y2) 계산 :  
다음으로 좌표 계산을 진행합니다. 정기구학 공식과 동일합니다.

```javascript
x2 = baseX + link1 * cos(theta1_fk);
y2 = baseY + link1 * sin(theta1_fk);
```
(baseX, baseY)는 로봇 joint1 모터의 위치, link1은 상부 암 길이입니다.

펜 끝 좌표(x3,y3) 계산 :
```javascript
x3 = x2 + link2 * cos(theta1_fk + theta2);
y3 = y2 + link2 * sin(theta1_fk + theta2);
```
팔꿈치에서부터 theta2만큼 더 회전하므로, 팔꿈치에서의 절대 각도는 theta1_ft + theta2가 됩니다. 이 방향으로 link2만큼 더 나아간 지점이 펜 끝 좌표 입니다.

결과로 {x : x3, y : y3}를 반환합니다.



### inverseKinematics2DOF(targetX, targetY, prevJ1Deg, prevJ2Deg)

이 함수는 목표 펜 좌표(targetX, targetY)를 주면, 해당 지점에 펜일 위치시키기 위한 두 관절 각도(joint1, joint2)를 계산합니다. 2DOF 평면 로봇 팔 표준 역기구학 공식을 구현하고 있으며, 기존 각도에 가까운 각도를 반환합니다.

#### 실행 동작

목표 점 까지 벡터 계산 및 작업 공간 체크 : 목표점까지 상대 좌표로 거리(d)를 계산하고,  | L1 - L2 | (최소 거리) ~ |L1 + L2| (최대 거리) 안에 있는지 검사합니다.

역 기구학 각도 계산 : 목표점이 도달 가능 하다면, 삼각법을 이용해 팔꿈치 관절 각도(theta2)를 구합니다.

```javascript
let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2); // 삼각법으로 theta2 구하기

const theta2Abs = Math.acos(cos2); 
const theta2List = [theta2Abs, -theta2Abs]; // theta2 후보(theta2는 안으로 굽힌 팔, 바깥으로 굽힌 팔 두가지임.)
```
구한 팔꿈치 각도는 절대값으로 두가지 경우가 있는데, 팔꿈치가 안쪽으로 굽힌 경우와, 바깥쪽으로 굽힌 경우입니다.

각 후보에 대해 theta1 구하기 : 역기구학을 통해 어깨관절의 각도 theta1를 얻습니다.
```javascript
k1 = L1 + L2 * cos(theta2_fk)
k2 = L2 * sin(theta2_fk)
```
이 값들은 역기구학 공식에서 중간 단계로, 두 링크에 의해 형성된 삼각형에서 어깨 관절과 목표점 사이 각도를 구하는 데 사용하는 변수입니다.
```javascript
const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);
```
를 통해 각각 theta2에 대한 절대 각도 theta1_fk를 구하고, offset 및 이미지 각도를 제외한 기준 자세 기준(ㄷ 자세 시 joint1 : 0, joint2 : 0도) 각도 theta1, theta2를 구합니다.

해 결정 : 이후 각각 theta1, theta2에 대해 plotto에서 정의한 최대 최소 각도를 넘는지 확인하고, 제한 각도를 벗어나면 그 해는 사용 불가로 간주합니다.(aVaild 또는 bVaild = false)

이후 만약 둘 다 사용 가능하다면, 인자로 받은 prevJ1Deg와 prevJ2Deg를 이용해 더 가까운 각도를 출력합니다.


### buildFromSvgText(svgText, opts = {})
buildFromSvgText는 svg 경로 문자열을 받아 일련의 처리를 거처 로봇팔의 경로 데이터(`#motionJson`, `#plot`)를 만듭니다.

#### 매개변수
| 매개변수 | 타입 | 설명 | 기본값 / 비고 |
|---------|------|------|---------------|
| `svgText` | `string` | SVG 파일의 전체 텍스트 내용입니다. 파싱되어 경로(path) 데이터로 변환됩니다. | 필수 |
| `opts` | `object` | SVG → 로봇 경로 변환 과정에서 사용되는 옵션 객체입니다. | 선택 |

##### opts 세부 옵션
| 옵션명 | 타입 | 설명 | 기본값 / 비고 |
|-------|------|------|---------------|
| `k` | `number` | 정규화된 SVG 박스를 로봇 좌표계로 매핑할 때 적용되는 스케일 계수입니다. | `1.0` |
| `flipY` | `boolean` | SVG 좌표계의 Y축을 상하 반전할지 여부를 설정합니다. | `false` |
| `maxDeltaDeg` | `number` | 포인트 간 허용되는 최대 관절 각도 변화량(도 단위)입니다. | `this.MAX_DELTA_DEG` |

#### 실행 동작
svg 경로를 통해 초기 점 배열 추출 : 매개변수 svgText를 extractPathPointsFromSvg()를 통해 점 배열을 추출하여, rawPts 배열에 저장합니다. 반환된 rawPts는 {x,y,pen} 객체들의 배열로, svg 경로를 따라 샘플링 된 점을 담고 있습니다.
좌표 정규화 : rawPts 배열은 원본 SVG 좌표계를 따르는 점 배열인데, 이를 (0,0) ~ (SVG_BOX_SIZE,SVG_BOX_SIZE) 범위에 매핑합니다. 이때, SVG_BOX_SIZE x SVG_BOX_SIZE 크기의 박스에 최대한 꽉 차게 축소/확대하고 위치를 맞춥니다. 이렇게 정규화한 좌표를 ptsBox에 저장합니다.
로봇 좌표계로 매핑 : ptsBox는 (0,0) ~ (SVG_BOX_SIZE,SVG_BOX_SIZE)로 정규회 되어 있는데,mapBoxToRobotTargets() 함수를 통해 시작을 0,0이 아닌 baseX, baseY부터 시작하도록 평행이동합니다. 이 좌표를 fitted 배열에 저장합니다.
각도 변화 기반 리샘플링 : 로봇팔의 좌표 -> 좌표의 운동 각동 변화가 #MAX_DELTA_DEG보다 낮게 리샘플링 하는 작업입니다. 이 함수를 통해 fitted 배열에 있는 좌표가 더 미세하게 분할되며, 분할된 배열이 fitted에 다시 저장됩니다.
상태 저장 : fitted 배열을 plotto.svgPathPoints에 저장하고, this.jsonBuilt = false로 설정하여, 아직 이 새로운 경로에 대한 motionJson이 생성되지 않았음을 표시합니다. 
motionJson 생성 : 마지막으로 buildMotionJsonFromSvg() 메서드를 호출하여, svgPathPoints를 기반으로 로봇 팔의 세부 동작 명령 목록을 생성합니다. 	motionJson이 완성되면, 내부에서 plotEncode()를 사용해 이 명령들을 이진 포맷으로 압축하여 this.plot 속성에 저장합니다.


### buildMotionJsonFromSvg()
buildMotionJsonFromSvg함수는 svgPathPoint를 입력으로 받아, 로봇 팔 각 관절에 대한 세부 움직임 명령 리스트 motionJson을 생성합니다. 결과적으로 로봇팔이 처음 위치에서 시작하여 경로의 모든 점을 방문하고, 펜을 올리거나 내리는 동작까지 포함한 명령이 만들어집니다.
이 떄, 모든 명령은 plotto에서 정의된 MAX_STEPS_PT를 넘지 않는 명령으로 변환합니다.
#### 실행 동작

**초기 설정 및 유효성 체크** : 함수가 호출되면 this.jsonBulit를 확인하여, plotto 객체에서 motionJson이 만들어졌는지를 확인합니다. 만든 적이 있다면 다시 만들지 않고 종료합니다.
그런다음 plotto motionJson 리스트를 초기화하고, curStepJ1, curStepJ2(현재 관절 위치를 추적하는 변수)를 0으로 초기화합니다. 또한, ji ~ j2의 각도 최대최소 스탭을 나타내는 (j1MinStep 등) 변수도 스탭 단위로 각도 제한을 저장해둡니다.

##### 보조 함수 moveToTarget(targetJ1, targetJ2, penState)
이 내부 함수는 현재 관절 위치에서 목표 관절 위치(targetJ1, targetJ2)까지 펜 상태 penstate로 이동하는데 필요한 d1,d2 명령을 motionJson에 추가합니다.
`totalDiff1 = targetJ1 - curStepJ1, totalDiff2 = targetJ2 - curStepJ2, maxDiff = max(|totalDiff1|, |totalDiff2|)` 식으로 구해서, 만약 maxDiff가 0이면 펜 상태가 바뀌지 않으면 motionJson에 추가하지 않고, pen 상태가 바뀌는 경우만 motionJson에 추가합니다.

maxDiff가 0이 아니라면, 실제 움직임이 필요한 것이므로, 큰 움직임을 한번에 하지 않고 MAX_STEPS_PT 이하의 작은 단계로 쪼개어 여러 움직임으로 추가합니다.

`rem1 = totalDiff1, rem2 = totalDiff2`으로 남은 이동 스텝을 저장하고, 반복문을 통해서 MAX_STEPS_PT까지 자릅니다. 이후 `$('pen').d = penState;`로 현재 펜 상태를 지정하고, 반복문 안에서는 펜 상태를 바꾸지 않으면서, rem1과 rem2가 0이 될때까지 반복합니다. 이 moveToTarget 함수를 통해 모든 d1, d2가 MAX_STEPS_PT 이하로 이루어집니다.

**홈 위치 -> 첫 번째 경로 점 이동**
로봇팔이 처음에는 홈 위치(Joint1 : 0도, Joint2 : 0도)에서 시작한다 가정하고, 가장 처음으로 진행하는 일은 svgPathPoints[0]을 가져와서, inverseKinematics2DOF()함수를 호출하는 일 입니다.
inverseKinematics2DOF()시, 처음 점에서 시작하므로, prevJ1=0, prevJ2=0으로 역기구학 계산을 진행합니다. 이후 얻은 각도 값을 firstIk에 반환하여, firstIK를 STEP 단위로 변환 후, penState = 0(시작할때 이므로)로 moveToTarget() 함수를 호출합니다.

이 호출로 인해 홈 위치에서 첫 점의 스탭까지의 명령이 plotto.motionJson에 추가됩니다. 이후 계산한 각도를 prevJ1Deg, prevJ2Deg에 저장합니다.

**경로를 따라 점 이동** : 이제 svgPathPoint의 모든 점을 차례대로 순회하며 처리합니다.
`for (let idx = 0; idx < totalPoints; idx++)` 반복문을 통해 순회합니다.
svgPathPoint에서 좌표를 얻어, inverseKinematics2DOF() -> moveToTarget() 를 반복합니다. 이때, curStepJ1, curStepJ2, prevJ1Deg, prevJ2Deg도 업데이트 합니다.

**마무리** : 
루프가 끝난 후, prevPen !==0(펜이 내려진 상태)라면 펜을 올리는 명령을 추가합니다.`this.motionJson.push({ d1: 0, d2: 0, pen: 0 })`
이후  `this.plot = plotEncode(this.motionJson);`를 통해 motionJson을 plot에 저장합니다(1 byte 형태)

### initLinkGeometry()
로봇 팔 이미지에 정의된 기준 좌표를 이용해 상부 팔(link1)과 하부 팔(link2)의
길이와 기준 자세 각도(rest angle)를 계산하는 초기화 함수입니다.
이렇게 계산된 값들은 이후 정·역기구학 계산 시 이미지 기준과 실제 관절 각도 간의 보정값으로 사용됩니다.

#### 실행 동작
상부 팔 길이 구하기 : UPPER_JOINT_BASE와 UPPER_JOINT_ELBOW 좌표 간의 거리를 계산하여 link1 길이로 설정합니다. 이 때, scale을 적용합니다.
상부 팔 이미지 각도 구하기 : 두 점을 연결하는 선의 방향을 atan2로 계산하여 upperRestAngle로 저장합니다.

하부 팔 길이 구하기 : FORE_JOINT_ELBOW와 FORE_PEN 좌표 간의 거리를 계산하여 link2 길이로 설정합니다.이 때, scale을 적용합니다.
하부 팔 이미지 각도 구하기 : 두 점을 연결하는 선의 방향을 atan2로 계산하여 foreRestAngle로 저장합니다.

## 3. 객체 정의

## 4. 주요 함수
### normalizeAngle(angle)
주어진 각도를 –180° ~ 180° 범위로 정규화하는 유틸리티 함수입니다.

#### 실행 동작
입력된 각도가 180°를 초과하면 360°를 반복적으로 빼서 범위 안으로 맞춥니다.
입력된 각도가 -180°보다 작으면 360°를 반복적으로 더해 범위 안으로 맞춥니다.
결과적으로 모든 각도를 동일한 기준 범위로 변환하여 각도 비교나 보간 시 발생할 수 있는 불연속 문제를 방지합니다.

### extractPathPointsFromSvg(svgText, opts = {})
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

#### 전반적인 실행 흐름
SVG 파싱 및 준비 : 주어진 svgText 문자열을 DOM Parser를 이용해 SVG DOM 객체로 변환하고, 가상으로 사용할 `<svg>`엘리먼트를 추가하여 SVG의 길이를 계산합니다.  
도형 요소 수집 : SVG 내의 모든 그리기 요소(`<path>, <circle>, <rect>, <line>, <polygon>, <polyline>` 등)을 찾고, 표시 속성이 숨김 처리되지 않은 것만 선별합니다. 이때 각 요소마다 해당 요소에 적용된 변횐 행렬(Transform)을 계산하여 함께 보관합니다.  
도형별 경로 변환 : 수집한 각 도형을 SVG `<path>`와 같은 형태인 경로 데이터(d)로 변환합니다. 기본 도형(`<rect>, <circle>`등)인 경우엔 경로 명령으로 바꾸고, 이미 `<path>`인 경우에는 그대로 사용하되, 내부에 MOVE 명령이 있을 경우 분리합니다.  
경로 샘플링 : 각 경로에 대해 일정 간격으로 값을 증가시키며 `getPointAtLength`를 이용해 좌표를 샘플링합니다. 첫 점은 펜을 들어서 이동(pen = 0)하며, 아후 점은 펜을 대고 그리는(pen = 1)상태로 샘플링하여 localPoints 리스트를 얻습니다.  
path 사이 보간 : 이전 경로의 마지막 점과 다음 경로 첫점 사이에 거리가 있다면, 펜을 든 상태로 해당 간격을 이동하는 중간 점을 삽입합니다.  
포인트 반환 : 모든 경로 조각들에 대해 샘플링이 끝나면, 이들을 순서대로 points 배열에 이어붙입니다. 결과적으로 points에는 SVG의 모든 도형을 순회하는 좌표 점들이 차례대로 담기며, 각 점은 펜 상태를 가지고 있어 언제 선을 그리고 언제 이동하는지 구분됩니다. 마지막으로 이 points 배열을 반환합니다.


#### 실행 동작

##### SVG 파싱 및 초기 설정
***DOM 객체 생성*** : 함수는 주어진 SVG 텍스트를 파싱하여 DOM 객체를 생성합니다. 이 때, DOM 파서를이용하여 실제 SVG DOM 객체로(doc)변환합니다.
***임시 SVG 엘리먼트 생성*** : 브라우저 환경에서 SVG 경로 길이 및 좌표 계산 API를 활용하기 위해 임시 `<svg>`요소를 동적으로 생성합니다. 이렇게 하는 이유는, SVG DOM의 `getTotalLength()` 및 `getPointAtLength()` 메소드는 SVG 요소가 DOM에 있어야 정상 동작하기 때문입니다.  
***변수 초기화*** : 최종으로 반환할 배열인 points를 초기화합니다.(point에는 {x, y, pen} 객체가 순서대로 쌓입니다.) 또한, 이전 도형의 마지막을 저장하는 lastGlobalPt도 초기화합니다.(첫 도형 후에 값을 채웁니다.), 이 값은 path 간 이동 경로를 계산하기 위해 사용됩니다.

##### 변환 행렬 유틸리티
SVG 요소들은 transfrom 속성을 통해 평행이동, 회전, 스케일, 기울이기(skew)등의 변환을 가지며, `<g>` 그룹을 이용해서 상위 그룹들의 변환이 누적 적용 될 수 있습니다. spine 코드에선 이러한 변환을 적용하기 위해 변환 affine 행렬을 이용해서 좌표계 경로를 구하며, 이 행렬 유틸리티 함수에 대해 소개하고자 합니다.

###### I() 
항등 행렬{a:1, b:0, c:0, d:1, e:0, f:0}을 반환합니다(a=1, d=1이고 나머지 0인 단위행렬)
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
예를 들어, transform="translate(10, 5) rotate(30)"와 같은 문자열을 파싱하여 하나의 행렬 객체로 반환합니다.  
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

##### 도형을 경로 데이터(path)로 변환
SVG내에는 path 요소 외에도 `<circle>`,`<rect>` 등 다양한 기본 도형이 있습니다. 이 함수에서는 모든 도형을 path 데이터로 변환하여 처리합니다. 또한, 하나의 `<path>`요소에도 moveTo(M)으로 pen이 0이 되는 부분이 있는데,그 path도 각각 따로 변환합니다.  
###### splitSubpaths(dAttr)
주어진 path 데이터 문자열 dAttr를 받아 여러 하위 경로로 분리하는 함수입니다. splitSubpaths 함수는 정규식을 사용하여 문자열 내에서 M 또는 m으로 시작하는 세그먼트를 찾아 분리된 문자열들의 배열로 반환합니다.  
이렇게 분리함으로써 `<path>` 하나에 여러 독립 도형이 그려져 있는 경우라도 각 MoveTo로 시작하는 경로를 개별 도형처럼 다룰 수 있게 됩니다. 이후 단계에서 이들을 각각 따로 샘플링하고, 도형 사이를 펜 업으로 이동하는 것이 가능해집니다.

###### circleToPathLocal(cx,cr,y)
원은 path로 변환하기 위해 두개의 호로 표현합니다. svg path의 A(원호) 명령을 이용하여 두개의 호로 원을 구성합니다. 
`<circle>`요소의 cx, cy, r 속성을 읽어 중심 좌표와 반지름을 얻습니다.
원의 가장 왼쪽점에서 시작(M x0,y 형식, x0 = cx - r)하여 우측으로 반원을 그리는 아크 명령 A를 사용하고, 다시 좌측으로 돌아오는 두 번째 아크 명령을 추가하여 닫는 식입니다. 마지막에 Z로 경로를 닫아 완전한 원을 표현합니다. 
이 방식으로 원을 SVG path의 A 명령으로 표현할 수 있습니다.

###### ellipseToPathLocal(cx, cy, rx, ry)
타원은 4개의 베지어 곡선으로 근사하여 경로로 변환합니다.
구현에서 사용된 `K = 0.5522...`는 원이나 타원을 4개의 곡선으로 근사할 때 사용되는 카파(kappa) 상수로, 이 상수를 사용하면 베지어 곡선의 중점이 실제 원에 거의 근접하도록 제어점의 거리를 결정할 수 있습니다.

이 함수는 우선 주어진 rotation 값을 고려해 미리 회전 변환을 적용합니다. 이후 타원의 4개의 주요 점과 베지어 제어 점도 회전하여 구합니다.
그런 뒤에, 경로 문자열을 구성합니다. M 명령으로 시작하여 left 점으로 이동하고, 이어서 C 큐빅 베지어 명령을 사용하여 top 점까지 곡선을 그리도록 제어점 c1, c2를 지정합니다. 같은 방식으로 연속된 3개의 C 명령을 사용하여 top->right, right->bottom, bottom->left로 이어지는 곡선들을 추가합니다. 마지막에 Z로 닫아서 하나의 연속된 패스로 타원을 근사합니다.

###### rectToPathLocal(x, y, width, height, rx, ry)
사각형은 rx, ry(모서리 반경)에 따라 두가지 방식으로 처리합니다.

***공통 처리***
x, y, width, height, rx, ry 속성을 읽습니다. 여기서 rx, ry가 없으면 0으로 처리하고, 하나만 지정된 경우 두 값을 동일하게 맞춥니다.
또한, rx > width / 2 이면 width / 2로 제한하고, ry > height / 2 이면 height / 2로 제한합니다.

***모서리가 둥근 사각형(rx > 0 && ry > 0)***
rx > 0 이고 ry > 0 인 경우, 각 모서리를 타원 1/4 호에 근사한 베지어 곡선으로 처리합니다.
원의 1/4을 큐빅 베지어로 근사하기 위해 `K = 0.5522...` 상수(카파 상수)를 사용하며, 각 모서리에 대해
ox = rx * K, oy = ry * K 값을 계산합니다.
직선(L)과 큐빅 베지어(C) 명령을 조합하여 네 모서리를 부드럽게 연결합니다. 이후 네 모서리를 모두 연결한 후 Z 명령으로 경로를 닫습니다.

이 결과, 원래 rect의 둥근 모서리를 rx, ry 반지름의 타원 호에 근접한 path로 변환합니다.

***모서리가 직각인 사각형(rx <=1e-9 && ry <=1e-9)***
M x,y로 시작한 뒤, 시계 방향으로 네 개의 L 명령을 사용해 꼭짓점을 연결합니다.
마지막에 Z 명령으로 경로를 닫아 단순 사각형 path를 생성합니다.

###### lineToPathLocal(x1, y1, x2, y2)
`<line>` 요소는 시작점 (x1, y1)과 끝점 (x2, y2)을 가지는 단순 선분입니다.
M x1,y1 → L x2,y2 형태의 path로 변환합니다.

###### polyToPathLocal(pointsStr, close)
`<polygon>,  <polyline>` 요소의 points 속성을 파싱하여 좌표 배열을 얻습니다.
첫번째 점을 M 명령으로 설정하며, 이후 각 점마다 L 명령을 추가하여 직선을 그립니다.
마지막에 close가 true이면(`<polygon>`의 경우) Z를 붙여 닫고, false 이면(`<polyline>`의 경우) 열린 채로 둡니다. 결과적으로 polygon / polyline도 path 데이터로 변환됩니다.     

위의 각 도형 변환 함수를 통해 SVG 기본 도형 요소들이 모두 경로 문자열(path)로 변환됩니다. 이 때, 원본이 path인 경우에는 splitSubpaths함수를 통해 여러 조각으로 나뉘어 질 수 있습니다.(path 안에 M이 두번 이상 있는 경우.)

***`<use>` 요소 처리***
svg에서는 `<use xlink:href="#id">`와 같은 형태로 사전에 정의된 도형을 복사하여 쓸 수 있습니다.
`<use>`는 xlink:href 또는 최근 href 속성으로 참조 대상의 id를 가리키며 x, y 등의 속성으로 위치를 조정하거나 자체적으로 transform을 가질 수도 있습니다.
`extractPathPointsFromSvg()` 함수에선 `resolveUseElement(useEl)`가 그 처리을 담당합니디.

###### resolveUseElement(useEl) 함수
이 함수는 `<use>` 요소의 원본 도형 + 여러 단계의 변환을 모두 해석해 하나의 실제 도형으로 변환한 뒤 렌더링 대상에 포함시키는 과정을 거칩니다.
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

최종 변환 행렬 합성 : 수집된 변환 행렬을 부모 -> `<use>` 자체 변환 -> `<use>` 위치 이동 -> 원본 요소 변환 순으로 적용하여 하나의 행렬로 합성합니다.


`<use>` 해석 결과 객체 생성 : 해석된 `<use>` 요소에 대해 다음 정보를 포함하는 객체를 생성합니다.

반환값으로는 `{ element: ref, transform: M, tagName: ref.tagName.toLowerCase() } ` 객체를 생성하여 리턴합니다.

요약하면, `<use>` 요소는 내부에서 참조된 도형을 찾아 복제한 뒤 위치/변환을 적용해주는 형태로 다루며, 그렇게 변환된 도형은 실제 `<path>`나 `<circle>` 등과 동일하게 이후 과정(경로 변환, 샘플링 등)을 거치게 됩니다.

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
***`<use>` 요소 추가*** : `svgRoot.querySelectorAll("use")`를 통해 모든 `<use>`요소를 순회하며 
shouldRender로 표시 여부를 검사한 뒤, 표시 대상이면 위에서 설명한 resolveUseElement(useEl)를 호출합니다. resolveUseElement가 유효한 객체(참조 성공)를 반환하면, 이를 allElements에 추가합니다.  

이 과정들을 거치면 allElements 배열에는 SVG에 실제 그려질 모든 도형 요소들이 추가되게 됩니다.

##### 경로 길이 계산
도형별로 얻은 경로 데이터를 정리하고 길이를 구하는 단계입니다. allElements 리스트를 이용하여 다음과 같이 처리합니다.

각 경로의 길이를 구하는 이유는, 점 샘플링 간격을 결정하고 최적화 하기 위해서입니다.


객체 값 꺼내기 및 배열 초가화 : 객체에서 element, tagName, transform을 꺼냅니다. 이후 경로 데이터를 담을 dList 배열도 초기화합니다. 또한, 최종 경로 객체를 담을 prepared 배열도 초기화합니다.

이후 요소의 종류별로 분기하여 경로 데이터를 얻습니다.  
요소 별 분기 : 
**path 일 경우** : 이미 경로 데이터를 가지고 있는 요소로, 문자열을 가져 온 뒤, `splitSubpaths()`를 호출하여 필요 시에 여러 하위 경로로 분할합니다. `splitSubpaths()`의 결과를 dList 배열에 담습니다.
**circle인 경우** : `circleToPathLocal(cx, cy, r)`을 호출하여 경로 문자열을 생성하고, 이를 dList에 추가합니다. 
**ellipse인 경우** : `ellipseToPathLocal(cx, cy, rx, ry, rotation)`을 호출합니다. 여기서 rotation 각도는 특별히 계산하는데, transformMatrix가 존재할 경우 행렬로부터 회전 성분을 추출하여 사용합니다. 코드에서는 행렬 m의 a,b 값을 이용해 `rotation = atan2(m.b, m.a) * (180/Math.PI)`로 각도를 얻는데, 이는 행렬의 변형이 순수 회전/스케일 조합일 때 그 회전 각도를 근사합니다.
**rect인 경우** : `rectToPathLocal(x, y, width, height, rx, ry)` 호출 결과 경로 문자열을 dList에 추가합니다.
**line인 경우** : `lineToPathLocal(x1, y1, x2, y2)` 결과 문자열을 넣습니다.
**polygon / polyline 인 경우** : `polyToPathLocal(points, true)` / `polyToPathLocal(points, false)` 호출히여 경로 문자열을 dList에 추가합니다.
이렇게 해서 dList에 한 요소로부터 유래된 하나 이상의 d 문자열이 들어갑니다.

경로 길이 측정 : dList를 순회하며 하나의 임시 `<path>` 요소 `pathEl`를 생성하고 `pathEl.setAttribute("d", dAttr);`로 경로 데이터를 설정합니다.
만약 해당 요소에 `transformMatrix`가 있다면 적용합니다. 이후 `pathEl.getTotalLength()`를 통해 전체 길이를 구합니다. 길이를 얻었다면 `pathEl.getTotalLength()`로 임시 path를 제거하고, prepared 리스트에 객체를 추가합니다.

`prepared.push({ dAttr, transformMatrix, length: L });`

이제 prepared에 경로 데이터와 길이가 모이게 되고, 이 정보에 기반하여 점 샘플링을 수행합니다.

##### 점 샘플링
prepared에 담긴 각 경로를 따라 일정한 간격으로 점을 찍어 points 배열에 누적합니다. 샘플링 단위는 opts와 경로의 길이에 의해 결정되고, 각 도형의 bridge 부분도 함께 처리됩니다.

샘플링 루프 시작 : prepared 배열을 순회하면서 각 항목(item)에 대해 처리합니다. 우선 임시 `<path>`요소 `pathEl`를 생성하고 dAttr를 설정합니다. 이후 임시 svg에 대해 transformMatrix가 있다면 적용합니다. 이후 `tempSvg.appendChild(pathEl);`로 임시 SVG DOM에 추가합니다.

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


점 누적 및 lastGlobalPt 갱신 : 이제 브리지 점(만약 있다면)이 points에 추가된 상태에서, 현재 도형의 실제 경로 점들(localPoints 배열)을 순서대로 points 배열에 이어붙입니다.
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

### normalizeToBox(points)
normalizeToBox 함수는 points의 모든 점을 0 ~ SVG_BOX_SIZE 범위에 매핑합니다. 즉 그림을 SVG_BOX_SIZE x SVG_BOX_SIZE 크기의 박스에 최대한 꽉 차게 축소/확대하고 위치를 맞춥니다.

#### 실행 동작
최대 최소 값 찾기 : points의 점을 모두 순회하며 minX, maxX, minY, maxY를 구합니다.
원본 경로의 폭과 높이 계산 : `w = maxX - minX , h = maxY - minY`와 같은 식으로 원본 points의 폭과 높이를 계산합니다.
정규화 스케일 계산 : 경로가 SVG_BOX_SIZE에 들어오도록 더 큰 길이를 기준으로 스케일 계수 s를 계산합니다.
`s = SVG_BOX_SIZE / max(w, h)`
중앙 정렬을 위한 오프셋 계산 : 스케일 적용 후, 남는 여백을 양쪽에 동일하게 분배하기 위해 경로가 박스의 중앙에 위치하게 하는 오프셋을 계산합니다.
```javascript
  const offX = (plotto.SVG_BOX_SIZE - newW) / 2;
  const offY = (plotto.SVG_BOX_SIZE - newH) / 2;
```
좌표 변환 : 모든 점에 대해 다음과 같은 변환을 적용합니다.
**원점 이동**: (p.x - minX, p.y - minY), **스케일 적용** : 곱하기 s, **오프셋 적용** : + offX / offY
이때, pen 상태는 유지합니다.
좌표 변환 이후, 출력좌표는 항상 0 ~ SVG_BOX_SIZE 범위 내에 위치합니다.


### mapBoxToRobotTargets(points, k = 1.0, flipY = false)
정규화 된 points 기준(normalizeToBox를 거친 points 배열 기준) 로봇 작업 좌표계로 변환하는 함수입니다.
SVG 경로를 로봇 펜이 따라갈 절대 위치 좌표로 매핑합니다.

#### 실행 동작
로봇 기준점 계산 : `const home = plotto.fkPenXY_deg(0, 0);`으로 joint1, joint2가 각각 0도일 때, 펜 끝 위치를 home으로 사용합니다. 이후 모든 SVG 좌표는 이 기준점에 상대적으로 배치됩니다.

SVG 좌표 추출 및 반전 처리 : `filpY === true`일 경우 로봇 좌표계 차이를 보정하기 위해 y축을 반전하며, `u = p.x, v = p.y`로 좌표를 추출합니다.

로봇 좌표계로 변환 : 정규화된 박스 좌표에 스케일 변수 k(평소에는 1)를 적용한 뒤, 기준점 home을 더하여 실제 로봇 좌표계로 변환합니다. 이때, pen의 상태는 유지합니다.
```javascript
x = home.x + u * k
y = home.y + v * k
```
이후 변환된 배열을 반환합니다.


### resamplePathByAngle(points, maxDeltaDeg = plotto.MAX_DELTA_DEG)

resamplePathByAngle 함수는 연속된 두 점 사이의 관절 각도 변화가 maxDeltaDeg를 넘지 않도록 중간 점을 삽입하는 함수입니다.

#### 실행 동작
초기화 및 첫 점 추가 : 결과 리스트 `result`를 생성하고, 첫 점은 그대로 추가합니다. 또한, 첫 점의 역기구학 해도 미리 보관합니다. 이후 각 인접한 점 쌍`(prevPoint, currPoint)`에 대해 두 점의 역기구학 결과 각도를 구한 뒤, 각각 변화량을 확인합니다.
중간 점 삽입 : 두 관절의 각도 변화가 `maxDeltaDeg` 이하라면 그대로 두고, 아니라면 중간값`mid`을 삽입합니다.
중간 점의 pen 상태는 현재 세그먼트의 끝 점과 동일하게 설정합니다.

`mid`에 대해 IK를 계산하고, `prevPoint -> mid`와 `mid -> currPoint`에 대해 두 구간에 재귀적으로 같은 과정을 적용합니다.
재귀를 통해 분할이 완료되면 `PrevPoint`에서 `currPoint`에 이르는 작은 세그먼트 점이 생성됩니다.

이 각 세그먼트의 점을 `result`에 추가합니다.
최종적으로 result를 반환합니다.

---

### 2.5. 움직임 명령 압축 및 인코딩: plotEncode / plotDecode

### 작동 흐름

1. **encodeNibble(d) / decodeNibble(n)**

    - 생성된 `motionJson`을 하드웨어로 전송하기 위해 
    이진 데이터로 압축합니다. 

    - Plotto 코드에서는 두 관절의 변화량, 즉 Δ 명령들과 펜 업/다운 명령을 효율적으로 표현하기 위해 커스텀 인코딩을 사용합니다. 
    - 이때 특수 바이트 값을 통해 타 명령들과 구분하면서도, 단 1byte 만으로 표현할 수 있습니다. (자세한 내용은 [Plotto Path](Plotto_Path) 문서를 참고하세요.)

    <details>
    <summary><b>참고 : 매핑 테이블</b></summary>
      
      | $\mathbf{d}$ 값 (10진수) | 4비트 이진수 (Nibble) | $\mathbf{d}$ 값 (10진수) | 4비트 이진수 (Nibble) |
      | :----------------------: | :-------------------: | :----------------------: | :-------------------: |
      |      $\mathbf{-7}$       |       $0b1001$        |       $\mathbf{0}$       |       $0b0000$        |
      |      $\mathbf{-6}$       |       $0b1010$        |       $\mathbf{1}$       |       $0b0001$        |
      |      $\mathbf{-5}$       |       $0b1011$        |       $\mathbf{2}$       |       $0b0010$        |
      |      $\mathbf{-4}$       |       $0b1100$        |       $\mathbf{3}$       |       $0b0011$        |
      |      $\mathbf{-3}$       |       $0b1101$        |       $\mathbf{4}$       |       $0b0100$        |
      |      $\mathbf{-2}$       |       $0b1110$        |       $\mathbf{5}$       |       $0b0101$        |
      |      $\mathbf{-1}$       |       $0b1111$        |       $\mathbf{6}$       |       $0b0110$        |
      |                          |                       |       $\mathbf{7}$       |       $0b0111$        |

    - Plotto_Path의 변환규칙에 의해, `0b1000`에 대한 엔트리가 없다는 점을 주의해야 합니다. `encodeNibble`에서 아예 생성하지 않으므로 `decodeNibble`에서도 기대하지 않습니다.
    </details>

    - **encodeNibble(d)** : -7 ~ 7 범위의 정수를 4비트 값(0x0~0xF)에 매핑합니다. 
    - **decodeNibble(n)** : 4비트 값을 다시 -7~7 정수로 복원하는 매핑입니다.

2. **encodeDeltaByte(d1,d2) / decodeDeltaByte(byte)**

    - **encodeDeltaByte(d1,d2)**
      - 내부적으로 `encodeNibble`을 이용하여 상위 4비트는 d1을, 하위 4비트는 d2를 표현합니다.
      - 두 관절의 Δ스텝(d1, d2, 각각 -7~7 범위)을 받아 하나의 바이트 값으로 합칩니다.
      - 예: d1=3, d2=-1이라면 <br>`encodeNibble(3)=0b0011`, `encodeNibble(-1)=0b1111`이므로<br> 최종 값은 `0b00111111 (0x3F)`이 됩니다.

    - **decodeDeltaByte(byte)**
      - 4비트 값을 다시 -7~7 정수로 복원하는 매핑입니다.
      - 바이트를 받아 상위/하위 4비트를 각각 추출하고,   `decodeNibble`을 통해 <br>정수 값으로 풀어낸 후 `{ d1: ..., d2: ... }` 객체를 반환합니다.

    > 이 두 함수는 **관절 및 펜 명령**을 압축/해제하는 기본 구성 요소입니다.

3. **plotEncode(motionJson)**

    - `motionJson` 배열을 입력으로 받아, 각 명령을 순차적으로 처리하면서 특수하게 인코딩된 바이트 배열을 생성합니다. 

      <details>
      <summary><b>코드 보기</b></summary>

      ```javascript
      function plotEncode(motionJson) {
        const out = [];
        let prevPen = 0;
        for (let i = 0; i < motionJson.length; i++) {
            const cmd = motionJson[i];
            const pen = cmd.pen ? 1 : 0;
            if (pen !== prevPen) {
                out.push(pen === 1 ? 0x80 : 0x08);
                prevPen = pen;
            }
            out.push(encodeDeltaByte(cmd.d1, cmd.d2));
        }
        return out;
      }
      ```
    </details><br>  
  
      **동작방식**


    1. 결과를 저장할 빈 배열 `out`을 생성하고,
      이전 펜 상태를 나타내는 `prevPen`을 `0`(pen up)으로 초기화합니다.

    2. `motionJson` 배열의 각 명령 `cmd`를 순차적으로 순회합니다.

    3. 현재 명령의 펜 상태를 숫자 값으로 정규화합니다.
        - `pen = cmd.pen ? 1 : 0`

    4. 현재 펜 상태(`pen`)와 이전 펜 상태(`prevPen`)를 비교하여
      펜 상태 변화가 있는지 확인합니다.

        4-1. 펜 상태가 변경되었다면, 상태에 따라 다음 명령 바이트를 추가합니다.
        - pen up → pen down : `0x80`
        - pen down → pen up : `0x08`

    5. 펜 상태 변경 명령을 기록한 후,
      `prevPen`을 현재 펜 상태로 갱신합니다.

    6. 두 관절의 Δ 이동량 `(d1, d2)`를
      `encodeDeltaByte(d1, d2)`를 통해 하나의 바이트로 인코딩하고
      결과를 `out` 배열에 추가합니다.

    7. 이 Δ 이동 바이트는 실제 이동이 없는 경우에도 항상 추가되며,
      `(d1, d2) = (0, 0)`일 경우 `0x00`이 기록됩니다.

    8. 모든 명령을 처리하면,
      `out` 배열에는 펜 상태 변화와 관절 이동이 순서대로 기록된
      바이트 시퀀스가 완성됩니다.

    9. 완성된 바이트 배열 `out`을 반환합니다.



4. **plotDecode(byteArray)**

    - `plotDecode`는 `plotEncode`의 역으로, 바이트 배열을 받아 다시 `{d1,d2,pen}` 명령 객체 리스트로 복원합니다.
    - 주로 디버깅이나 검증 용도로 쓰일 수 있습니다.


    <details>
    <summary><b>코드 보기</b></summary>

      ```javascript
      function plotDecode(byteArray) {
      if (!Array.isArray(byteArray)) {
          throw new Error("plotDecode: byteArray must be an array");
      }

      const out = [];
      let pen = 0; 

      for (let i = 0; i < byteArray.length; i++) {
          const b = byteArray[i];

          if (b === 0x80) {
              pen = 1;
          } else if (b === 0x08) {
              pen = 0;
          } else {
              const { d1, d2 } = decodeDeltaByte(b);
              out.push({ d1, d2, pen });
          }
      }

      return out;
      }
      ```
    </details><br>  
  


      **동작방식**


    1. **입력 검증**
        - `byteArray`가 배열인지 확인합니다. 그렇지 않으면 오류를 발생시킵니다.

    2. **초기화**
        - `out`: 결과 객체 배열
        - `pen`: 펜 상태 초기화 (0: 펜 업, 1: 펜 다운)

    3. **배열 순회**  
        -  `byteArray`의 각 바이트를 순차적으로 처리합니다.

    4. **펜 상태 처리**  
        - `0x80`: 펜 다운 (pen = 1)
        - `0x08`: 펜 업 (pen = 0)

    5. **Δ 이동 명령 처리**
        -  `0x80` 또는 `0x08` 외의 바이트는 Δ 이동 명령입니다.  
        -  `decodeDeltaByte`를 사용해 `(d1, d2)` 값을 복원하고, 현재 `pen` 상태와 함께 <>`{d1, d2, pen}` 객체를 `out` 배열에 추가합니다.

    6. **펜 상태만 변경될 경우**  
        - `0x00`은 `d1 = 0`, `d2 = 0`, 현재 펜 상태로 복원됩니다.  
        - 이 경우 제자리 이동 명령으로 해석됩니다.

    7. **결과 반환**  
        -  최종적으로 `{d1, d2, pen}` 객체들의 배열을 반환합니다.



## 결론
Plotto 코드는 2-DOF 펜 로봇 팔을 위한 경로 생성 및 제어 명령 생성기입니다. 

사용자는 SVG 형태로 그리려는 형상을 입력하고, 코드는 이를 로봇 팔의 작업 영역에 맞게 스케일링 및 변환하여 연속된 펜 움직임 좌표 목록을 만듭니다. 

이후 로봇 팔이 원활하게 움직일 수 있도록 해당 경로를 세분화하고, 각 구간에 대한 관절의 세부 스텝 명령을 생성합니다. 마지막으로 이 명령들을 효율적인 바이트 코드로 인코딩하여, 실제 제어 하드웨어로 쉽게 전달될 수 있도록 합니다.

각 구성 요소는 다음과 같은 역할을 담당합니다:

•	기구학 계산 (FK & IK): 로봇 팔의 좌표 ↔ 관절 각도 변환을 담당하여 경로 점을 관절 명령으로 변환합니다.

•	SVG 경로 처리: 복잡한 SVG 도형도 일련의 직선 점들로 분해하여 따라갈 수 있게 합니다.

•	경로 최적화 (resample): 관절의 물리적 제약을 고려해 경로를 부드럽고 안전하게 다듬습니다.

•	모션 JSON 생성: 시작부터 끝까지 펜의 움직임과 그림 그리기 동작을 모두 포함한 스텝 명령 리스트를 만듭니다.

•	명령 인코딩: 이 스텝 명령 리스트를 최소한의 데이터로 표현해 전송할 수 있게 합니다.

해당 코드를 인수인계받는 개발자는 위 내용을 바탕으로, 
- 로봇 팔의 물리적 파라미터를 조정하거나 다른 로봇에 적용할 경우 configure() 부분과 kinematics 부분을 조정할 수 있고, 
- SVG 입력에 따라 로봇 움직임을 생성하는 로직을 이해하여 필요한 경우 세분화 단계(MAX_DELTA_DEG 등)나 샘플링 밀도(samplesPerPath 등)를 튜닝할 수 있습니다. 
- 또한 motionJson과 plot 결과를 이용해 실제 하드웨어 제어 코드와 연동하거나, 시뮬레이션에서 움직임을 검증할 수 있습니다.


**파이프라인**

![Image](https://github.com/user-attachments/assets/9f13e787-d523-4bd3-91fc-b0ceb89c5a49)