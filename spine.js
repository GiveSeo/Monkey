class Monkey{
    #minEncoderJoint1 = -30;
    #maxEncoderJoint1 = 180;
    #minEncoderJoint2 = -100;
    #maxEncoderJoint2 = 30;
    #angleSpeedOffset = 10;
    #speedJointOffset = 10;
    // constructor 
    constructor(angleSpeed){
        this._angleSpeed = angleSpeed;
        this.repeat = null; // 반복 함수 저장
        this.encoderJoint1 = $('encoder.joint_1').d;
        this.encoderJoint2 = $('encoder.joint_2').d;    
        this.targetAngleJoint1 = null;
        this.targetAngleJoint2 = null;
        this._speedJoint1 = 0;
        this._speedJoint2 = 0;
    }
    get angleSpeed() {
        return this._angleSpeed;
    }

    set angleSpeed(value) {
        this._angleSpeed = value / this.#angleSpeedOffset;
    }
    // speed gettet, setter
    get speedJoint1() {
        return this._speedJoint1;
    }

    set speedJoint1(value) {
        this._speedJoint1 = value / this.#speedJointOffset;
    }

    get speedJoint2() {
        return this._speedJoint2;
    }

    set speedJoint2(value) {
        this._speedJoint2 = value / this.#speedJointOffset;
    }
    get minJoint1(){
        return this.#minEncoderJoint1;
    }
    set minJoint1(value){
        this.#minEncoderJoint1 = value;
    }
    get maxJoint1(){
        return this.#maxEncoderJoint1;
    }
    set maxJoint1(value){
        this.#maxEncoderJoint1 = value;
    }
    get minJoint2(){
        return this.#minEncoderJoint2;
    }
    set minJoint2(value){
        this.#minEncoderJoint2 = value;
    }
    get maxJoint2(){
        return this.#maxEncoderJoint2;
    }
    set maxJoint2(value){
        this.#maxEncoderJoint2 = value;
    }
    // 각도 기반 이동
    moveByAngle(
    targetAngleJoint1,
    targetAngleJoint2
  ) {
    if ( // 이미 목표 각도라면 종료
      this.targetAngleJoint1 === targetAngleJoint1 &&
      this.targetAngleJoint2 === targetAngleJoint2 
    ) {
      return;
    }

    // 목표 각도 설정
    this.targetAngleJoint1 = targetAngleJoint1;
    this.targetAngleJoint2 = targetAngleJoint2;

    this.repeat = setInterval(() => {
      if (this.encoderJoint1 < this.targetAngleJoint1) {
        if (this.encoderJoint1 + this.angleSpeed > this.targetAngleJoint1) {
          this.encoderJoint1 = this.targetAngleJoint1;
        } else {
          this.encoderJoint1 += this.angleSpeed;
        }
      } else if (this.encoderJoint1 > this.targetAngleJoint1) {
        if (this.encoderJoint1 - this.angleSpeed < this.targetAngleJoint1) {
          this.encoderJoint1 = this.targetAngleJoint1;
        } else {
          this.encoderJoint1 -= this.angleSpeed;
        }
      }

      if (this.encoderJoint2 < this.targetAngleJoint2) {
        if (this.encoderJoint2 + this.angleSpeed > this.targetAngleJoint2) {
          this.encoderJoint2 = this.targetAngleJoint2;
        } else {
          this.encoderJoint2 += this.angleSpeed;
        }
      } else if (this.encoderJoint2 > this.targetAngleJoint2) {
        if (this.encoderJoint2 - this.angleSpeed < this.targetAngleJoint2) {
          this.encoderJoint2 = this.targetAngleJoint2;
        } else {
          this.encoderJoint2 -= this.angleSpeed;
        }
      }

      if (
        this.encoderJoint1 === this.targetAngleJoint1 &&
        this.encoderJoint2 === this.targetAngleJoint2 
      ) {
        clearInterval(this.repeat);
        this.repeat = null;
      }
    }, 50);
  }
}

// --------인스턴스-------------
const monkey = new Monkey(4);

let wait, wait_forever;

async function setup(spine) {
  const wait = function (n) { // n초 만큼 기다리는 Promise 반환
    return new Promise((r) => setTimeout(r, n));
  };

  const wait_forever = function () { // 무한 대기 함수
    return wait(0x7fffffff);
  };

  $('mode').d = 0; // 각도 기반 모드
  $('joint.max_speed').d = 100;
  $('joint.angles').d = [0, 0];
  $('encoder.joint_1').d = 0;
  $('encoder.joint_2').d = 0;
  await wait(3000);
}

function serialize() {
//   if (dongle != null) {
//     return;
//   }

  // set control mode
    let angleSpeed = $('joint.max_speed').d;
    monkey.angleSpeed = angleSpeed;

    let angles = $('joint.angles').d;
    monkey.moveByAngle(angles[0], angles[1]);
    return;
}


function deserialize() {
  $('encoder.joint_1').d = Number(monkey.encoderJoint1.toFixed(3));
  $('encoder.joint_2').d = Number(monkey.encoderJoint2.toFixed(3));
  $('encoder.encoders').d = [$('encoder.joint_1').d, $('encoder.joint_2').d];
}

// put control code here, to run repeatedly
function loop() {
    control()
}