class Plutto{
    #minEncoderJoint1 = -30;
    #maxEncoderJoint1 = 180;
    #minEncoderJoint2 = -100;
    #maxEncoderJoint2 = 30;
    #motionJson =[];
    #plot = [];
    // constructor 
    constructor(){
        this.repeat = null; // 반복 함수 저장
        $('encoder.joint_1').d = 0;
        $('encoder.joint_2').d = 0;
        
        $('pen').d = 0; // 펜이 종이에 붙어있지 않은 상태
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
const plutto = new Plutto();

let wait, wait_forever;

async function setup(spine) {
  const wait = function (n) { // n초 만큼 기다리는 Promise 반환
    return new Promise((r) => setTimeout(r, n));
  };

  const wait_forever = function () { // 무한 대기 함수
    return wait(0x7fffffff);
  };

  await wait(3000);
}

function degToStep(deg){
    return Math.round(deg / STEP_DEG);
}

function stepToDeg(step){
    
    return step * STEP_DEG;
}

function serialize() {
    return;
}


function deserialize() {
}

// put control code here, to run repeatedly
function loop() {}