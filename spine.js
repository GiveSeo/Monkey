class Plutto{
    #minEncoderJoint1 = -30;
    #maxEncoderJoint1 = 180;
    #minEncoderJoint2 = -100;
    #maxEncoderJoint2 = 30;
    #angleSpeedOffset = 10;
    #speedJointOffset = 10;
    // constructor 
    constructor(){
        this.repeat = null; // 반복 함수 저장
        this.encoderJoint1 = $('encoder.joint_1').d;
        this.encoderJoint2 = $('encoder.joint_2').d;    
        this.targetAngleJoint1 = null;
        this.targetAngleJoint2 = null;
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
}

// --------인스턴스-------------
const plutto = new Plutto(4);

let wait, wait_forever;

async function setup(spine) {
  const wait = function (n) { // n초 만큼 기다리는 Promise 반환
    return new Promise((r) => setTimeout(r, n));
  };

  const wait_forever = function () { // 무한 대기 함수
    return wait(0x7fffffff);
  };

  $('mode').d = 0; // 각도 기반 모드
  await wait(3000);
}

function serialize() {
    return;
}


function deserialize() {
  $('encoder.joint_1').d = Number(plutto.encoderJoint1.toFixed(3));
  $('encoder.joint_2').d = Number(plutto.encoderJoint2.toFixed(3));
  $('encoder.encoders').d = [$('encoder.joint_1').d, $('encoder.joint_2').d];
}

// put control code here, to run repeatedly
function loop() {}