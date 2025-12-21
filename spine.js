// 로봇 팔 이미지 정보 (plot 생성시 꼭 필요한 정보들)
const TOP_JOINT_X = 220;
const TOP_JOINT_Y = 547;

const UPPER_JOINT_BASE_X = 747;
const UPPER_JOINT_BASE_Y = 226;
const UPPER_JOINT_ELBOW_X = 195;
const UPPER_JOINT_ELBOW_Y = 383;

const FORE_JOINT_ELBOW_X = 195;
const FORE_JOINT_ELBOW_Y = 385;
const FORE_PEN_X = 778;
const FORE_PEN_Y = 612;
const imageScale = 0.5;

class Plotto {
    #minEncoderJoint1 = -30;
    #maxEncoderJoint1 = 180;
    #minEncoderJoint2 = -100;
    #maxEncoderJoint2 = 30;
    #motionJson = [];
    #plot = [];
    #svgPathPoints = [];
    #baseX = 0;
    #baseY = 0;
    #link1 = 0;
    #link2 = 0;
    #upperRestAngle = 0;
    #foreRestAngle = 0;
    #JOINT2_OFFSET = 143;
    #jsonBuilt = false;
    #STEP_DEG = 0.010986328;
    #MAX_STEPS_PT = 7;
    #MAX_DELTA_DEG = this.#STEP_DEG * this.#MAX_STEPS_PT;
    #SVG_BOX_SIZE = 250;

    // constructor 
    constructor() {
        this.repeat = null; // 반복 함수 저장
        $("encoder.joint_1").d = 0;
        $("encoder.joint_2").d = 0;

        $('pen').d = 0; // 펜이 종이에 붙어있지 않은 상태
    }

    get svgPathPoints() { return this.#svgPathPoints; }
    set svgPathPoints(v) { this.#svgPathPoints = Array.isArray(v) ? v : []; }

    get SVG_BOX_SIZE() { return this.#SVG_BOX_SIZE; }
    set SVG_BOX_SIZE(v) {
        this.#SVG_BOX_SIZE = Number(v);
    }

    get STEP_DEG() { return this.#STEP_DEG; }
    set STEP_DEG(v) {
        this.#STEP_DEG = Number(v);
        this.#MAX_DELTA_DEG = this.#STEP_DEG * this.#MAX_STEPS_PT;
    }

    get MAX_STEPS_PT() { return this.#MAX_STEPS_PT; }
    set MAX_STEPS_PT(v) {
        this.#MAX_STEPS_PT = Number(v);
        this.#MAX_DELTA_DEG = this.#STEP_DEG * this.#MAX_STEPS_PT;
    }

    get MAX_DELTA_DEG() { return this.#MAX_DELTA_DEG; }

    get jsonBuilt() { return this.#jsonBuilt; }
    set jsonBuilt(v) { this.#jsonBuilt = !!v; }

    get baseX() { return this.#baseX; }
    set baseX(v) { this.#baseX = Number(v) || 0; }

    get baseY() { return this.#baseY; }
    set baseY(v) { this.#baseY = Number(v) || 0; }

    get link1() { return this.#link1; }
    set link1(v) { this.#link1 = Number(v) || 0; }

    get link2() { return this.#link2; }
    set link2(v) { this.#link2 = Number(v) || 0; }

    get upperRestAngle() { return this.#upperRestAngle; }
    set upperRestAngle(v) { this.#upperRestAngle = Number(v) || 0; }

    get foreRestAngle() { return this.#foreRestAngle; }
    set foreRestAngle(v) { this.#foreRestAngle = Number(v) || 0; }

    get JOINT2_OFFSET() { return this.#JOINT2_OFFSET; }
    set JOINT2_OFFSET(v) { this.#JOINT2_OFFSET = Number(v) || 0; }

    get minJoint1() {
        return this.#minEncoderJoint1;
    }
    set minJoint1(v) {
        this.#minEncoderJoint1 = v;
    }
    get maxJoint1() {
        return this.#maxEncoderJoint1;
    }
    set maxJoint1(v) {
        this.#maxEncoderJoint1 = v;
    }
    get minJoint2() {
        return this.#minEncoderJoint2;
    }
    set minJoint2(v) {
        this.#minEncoderJoint2 = v;
    }
    get maxJoint2() {
        return this.#maxEncoderJoint2;
    }
    set maxJoint2(v) {
        this.#maxEncoderJoint2 = v;
    }
    get motionJson() {
        return this.#motionJson;
    }
    set motionJson(v) {
        this.#motionJson = Array.isArray(v) ? v : [];
    }
    get plot() {
        return this.#plot;
    }
    set plot(v) {
        this.#plot = Array.isArray(v) ? v : [];
    }
    //설정 함수
    configure({
        baseX, baseY,
        link1Length, link2Length,
        upperRestAngle, foreRestAngle,
        JOINT2_OFFSET,
        SVG_BOX_SIZE,
        STEP_DEG,
        MAX_STEPS_PT,
        // (선택) joint limit
        minJoint1, maxJoint1, minJoint2, maxJoint2,
    } = {}) {

        // 1) kinematics (기존 setKinematics 내용 합침)
        if (baseX !== undefined) this.baseX = baseX;
        if (baseY !== undefined) this.baseY = baseY;
        if (link1Length !== undefined) this.link1 = link1Length;
        if (link2Length !== undefined) this.link2 = link2Length;
        if (upperRestAngle !== undefined) this.upperRestAngle = upperRestAngle;
        if (foreRestAngle !== undefined) this.foreRestAngle = foreRestAngle;
        if (JOINT2_OFFSET !== undefined) this.JOINT2_OFFSET = JOINT2_OFFSET;

        // 2) svg / quantization
        if (SVG_BOX_SIZE !== undefined) this.SVG_BOX_SIZE = SVG_BOX_SIZE;
        if (STEP_DEG !== undefined) this.STEP_DEG = STEP_DEG;
        if (MAX_STEPS_PT !== undefined) this.MAX_STEPS_PT = MAX_STEPS_PT;

        // 3) (선택) joint limit
        if (minJoint1 !== undefined) this.minJoint1 = minJoint1;
        if (maxJoint1 !== undefined) this.maxJoint1 = maxJoint1;
        if (minJoint2 !== undefined) this.minJoint2 = minJoint2;
        if (maxJoint2 !== undefined) this.maxJoint2 = maxJoint2;

        // 4) build 상태 리셋(설정 바뀌면 이전 결과 무효)
        this.jsonBuilt = false;
        this.motionJson = [];
        this.plot = [];
        this.initLinkGeometry();
    }
    fkPenXY_deg(j1Deg, j2Deg) {
        const theta1 = (j1Deg * Math.PI / 180) * -1;

        const physicalJ2 = j2Deg + this.JOINT2_OFFSET;
        const theta2 = (physicalJ2 * Math.PI / 180) * -1;

        const theta1_fk = theta1 + this.upperRestAngle;

        const x2 = this.baseX + this.link1 * Math.cos(theta1_fk);
        const y2 = this.baseY + this.link1 * Math.sin(theta1_fk);

        const x3 = x2 + this.link2 * Math.cos(theta1_fk + theta2);
        const y3 = y2 + this.link2 * Math.sin(theta1_fk + theta2);

        return { x: x3, y: y3 };
    }
    inverseKinematics2DOF(targetX, targetY, prevJ1Deg, prevJ2Deg) {
        const L1 = this.link1;
        const L2 = this.link2;

        const dx = targetX - this.baseX;
        const dy = targetY - this.baseY;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) d = 1e-6;

        const maxReach = L1 + L2 - 1e-3;
        const minReach = Math.abs(L1 - L2) + 1e-3;

        if (d > maxReach || d < minReach) {
            return null;
        }

        let cos2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
        cos2 = Math.max(-1, Math.min(1, cos2));

        const theta2Abs = Math.acos(cos2);
        const theta2List = [theta2Abs, -theta2Abs];

        const solve = (theta2_fk) => {
            const k1 = L1 + L2 * Math.cos(theta2_fk);
            const k2 = L2 * Math.sin(theta2_fk);
            const theta1_fk = Math.atan2(dy, dx) - Math.atan2(k2, k1);

            const theta1 = theta1_fk - this.upperRestAngle;
            const theta2 = theta2_fk;

            const joint1DegPhysical = (-theta1 * 180) / Math.PI;
            const joint2DegPhysical = (-theta2 * 180) / Math.PI;

            const joint1Old = joint1DegPhysical;
            const joint2Old = -(joint2DegPhysical - this.JOINT2_OFFSET);

            const joint1Deg = normalizeAngle(joint1Old);
            const joint2Deg = normalizeAngle(-joint2Old);

            return { joint1: joint1Deg, joint2: joint2Deg };
        };

        const solA = solve(theta2List[0]);
        const solB = solve(theta2List[1]);

        const aValid =
            solA.joint1 >= this.minJoint1 &&
            solA.joint1 <= this.maxJoint1 &&
            solA.joint2 >= this.minJoint2 &&
            solA.joint2 <= this.maxJoint2;

        const bValid =
            solB.joint1 >= this.minJoint1 &&
            solB.joint1 <= this.maxJoint1 &&
            solB.joint2 >= this.minJoint2 &&
            solB.joint2 <= this.maxJoint2;

        if (!aValid && !bValid) return null;

        if (typeof prevJ1Deg !== "number" || typeof prevJ2Deg !== "number") {
            return aValid ? solA : solB;
        }

        const score = (sol) => {
            const d1 = normalizeAngle(sol.joint1 - prevJ1Deg);
            const d2 = normalizeAngle(sol.joint2 - prevJ2Deg);
            return d1 * d1 + d2 * d2;
        };

        if (aValid && bValid) {
            return score(solB) < score(solA) ? solB : solA;
        }

        return aValid ? solA : solB;
    }
    buildFromSvgText(svgText, opts = {}) {
        // opts로 튜닝 가능하게
        const sampleStep = opts.sampleStep ?? 0.001;      // extract 샘플링 간격
        const k = opts.k ?? 1.0;                 // SVG_BOX -> 로봇 공간 스케일
        const flipY = opts.flipY ?? false;
        const maxDelta = opts.maxDeltaDeg ?? this.MAX_DELTA_DEG;

        // 1) SVG -> raw points
        const rawPts = extractPathPointsFromSvg(svgText, {
            samplesPerPath: 350,      // path 하나를 대략 200등분
            maxSamplesPerPath: 4000,  // path 하나당 최대 점 개수
            maxStepClamp: 2,          // 긴 path가 너무 듬성해지지 않게
            bridgeScale: 1.0,         // path 사이 pen-up 이동 밀도
        });

        // 2) raw -> 정규화 박스
        const ptsBox = normalizeToBox(rawPts);

        // 3) 박스 -> 로봇 타겟 좌표
        let fitted = mapBoxToRobotTargets(ptsBox, k, flipY);

        // 4) 각도 변화량 제한으로 리샘플
        fitted = resamplePathByAngle(fitted, maxDelta);

        // 5) plotto 상태로 저장
        this.svgPathPoints = fitted;
        this.jsonBuilt = false;

        // 6) motionJson + plot 생성
        this.buildMotionJsonFromSvg();   // 아래 메서드 필요
    }
    buildMotionJsonFromSvg() {
        if (this.jsonBuilt) return;
        if (!this.svgPathPoints || this.svgPathPoints.length === 0) return;

        console.log("motionJson 생성 (this 버전)");
        this.motionJson = [];

        let curStepJ1 = 0;
        let curStepJ2 = 0;
        let prevPen = 0;

        const j1MinStep = Math.round(this.minJoint1 / this.STEP_DEG);
        const j1MaxStep = Math.round(this.maxJoint1 / this.STEP_DEG);
        const j2MinStep = Math.round(this.minJoint2 / this.STEP_DEG);
        const j2MaxStep = Math.round(this.maxJoint2 / this.STEP_DEG);

        let prevJ1Deg = 0;
        let prevJ2Deg = 0;
        let skippedPoints = 0;

        const moveToTarget = (targetJ1, targetJ2, penState) => {
            const totalDiff1 = targetJ1 - curStepJ1;
            const totalDiff2 = targetJ2 - curStepJ2;
            const maxDiff = Math.max(Math.abs(totalDiff1), Math.abs(totalDiff2));

            if (maxDiff === 0) {
                if (penState !== prevPen) {
                    this.motionJson.push({ d1: 0, d2: 0, pen: penState });
                    prevPen = penState;
                }
                return;
            }

            let rem1 = totalDiff1;
            let rem2 = totalDiff2;

            while (rem1 !== 0 || rem2 !== 0) {
                const d1 = Math.max(-this.MAX_STEPS_PT, Math.min(this.MAX_STEPS_PT, rem1));
                const d2 = Math.max(-this.MAX_STEPS_PT, Math.min(this.MAX_STEPS_PT, rem2));

                $('pen').d = penState;

                if (d1 !== 0 || d2 !== 0 || $('pen').d !== prevPen) {
                    this.motionJson.push({ d1, d2, pen: $('pen').d });
                    prevPen = $('pen').d;
                }

                curStepJ1 += d1;
                curStepJ2 += d2;
                rem1 -= d1;
                rem2 -= d2;
            }
        };

        // Home -> 첫 포인트
        const firstPt = this.svgPathPoints[0];
        const firstIk = this.inverseKinematics2DOF(firstPt.x, firstPt.y, 0, 0);

        if (!firstIk) {
            console.error("첫 포인트가 작업 영역 밖입니다!");
            return;
        }

        let targetStartJ1 = Math.round(firstIk.joint1 / this.STEP_DEG);
        let targetStartJ2 = Math.round(firstIk.joint2 / this.STEP_DEG);
        targetStartJ1 = Math.max(j1MinStep, Math.min(j1MaxStep, targetStartJ1));
        targetStartJ2 = Math.max(j2MinStep, Math.min(j2MaxStep, targetStartJ2));

        console.log(`Home(0,0) → 첫 포인트(${targetStartJ1}, ${targetStartJ2})`);
        moveToTarget(targetStartJ1, targetStartJ2, 0);

        prevJ1Deg = firstIk.joint1;
        prevJ2Deg = firstIk.joint2;

        // SVG 경로
        const totalPoints = this.svgPathPoints.length;
        const logInterval = Math.max(1, Math.floor(totalPoints / 10));

        for (let idx = 0; idx < totalPoints; idx++) {
            const pt = this.svgPathPoints[idx];

            if (idx % logInterval === 0) {
                console.log(
                    `진행: ${idx}/${totalPoints} (${Math.round(
                        (idx / totalPoints) * 100
                    )}%), 스킵: ${skippedPoints}`
                );
            }

            const ik = this.inverseKinematics2DOF(
                pt.x,
                pt.y,
                prevJ1Deg,
                prevJ2Deg
            );

            if (!ik) {
                skippedPoints++;
                continue;
            }

            let targetStepJ1 = Math.round(ik.joint1 / this.STEP_DEG);
            let targetStepJ2 = Math.round(ik.joint2 / this.STEP_DEG);

            targetStepJ1 = Math.max(j1MinStep, Math.min(j1MaxStep, targetStepJ1));
            targetStepJ2 = Math.max(j2MinStep, Math.min(j2MaxStep, targetStepJ2));

            moveToTarget(targetStepJ1, targetStepJ2, pt.pen);

            prevJ1Deg = ik.joint1;
            prevJ2Deg = ik.joint2;
        }

        if (prevPen !== 0) {
            this.motionJson.push({ d1: 0, d2: 0, pen: 0 });
        }

        this.jsonBuilt = true;

        console.log(`motionJson 생성 완료! (${this.motionJson.length}개)`);

        try {
            this.plot = plotEncode(this.motionJson);
        } catch (err) {
            console.error("plotEncode 오류:", err);
        }
    }
    initLinkGeometry() {
        // upperarm 길이 각도
        {
            const dx = (UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X) * imageScale;
            const dy = (UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y) * imageScale;
            this.#link1 = Math.hypot(dx, dy);

            const dxImg = UPPER_JOINT_ELBOW_X - UPPER_JOINT_BASE_X;
            const dyImg = UPPER_JOINT_ELBOW_Y - UPPER_JOINT_BASE_Y;
            this.upperRestAngle = Math.atan2(dyImg, dxImg); // 이미지 상의 방향(rad)
        }

        // forearm 길이 각도
        {
            const dx = (FORE_PEN_X - FORE_JOINT_ELBOW_X) * imageScale;
            const dy = (FORE_PEN_Y - FORE_JOINT_ELBOW_Y) * imageScale;
            this.#link2 = Math.hypot(dx, dy);

            const dxImg2 = FORE_PEN_X - FORE_JOINT_ELBOW_X;
            const dyImg2 = FORE_PEN_Y - FORE_JOINT_ELBOW_Y;
            this.foreRestAngle = Math.atan2(dyImg2, dxImg2); // 이미지 상의 방향(rad)
        }
    }
}
function normalizeAngle(angle) {
    // angle을 -180 ~ 180 범위로 정규화
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
}
// SVG 경로에서 포인트 추출 함수
function extractPathPointsFromSvg(svgText, opts = {}) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgRoot = doc.documentElement;

    const {
        sampleStep = null,           // 숫자면 고정 step (px)
        samplesPerPath = 200,        // path 하나를 대략 몇 등분 할지(길이/등분 = step)
        maxStepClamp = 2,            // 긴 path가 너무 듬성해지는 걸 방지 (상한만)
        maxSamplesPerPath = 3000,    // 짧은 path에서 폭주 방지 (minStep 대체)
        bridgeScale = 1.0,           // shape 간 pen-up 이동 샘플링 밀도
    } = opts;

    const points = [];

    // 브라우저 임시 svg (getTotalLength/getPointAtLength 용)
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tempSvg.setAttribute("width", "0");
    tempSvg.setAttribute("height", "0");
    tempSvg.style.position = "absolute";
    tempSvg.style.left = "-9999px";
    tempSvg.style.top = "-9999px";
    document.body.appendChild(tempSvg);

    let lastGlobalPt = null;

    // =========================
    // Matrix utilities
    // =========================
    const I = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    const T = (tx = 0, ty = 0) => ({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
    const S = (sx = 1, sy = sx) => ({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
    const R = (deg = 0) => {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
    };
    const KX = (deg = 0) => {
        const rad = (deg * Math.PI) / 180;
        return { a: 1, b: 0, c: Math.tan(rad), d: 1, e: 0, f: 0 };
    };
    const KY = (deg = 0) => {
        const rad = (deg * Math.PI) / 180;
        return { a: 1, b: Math.tan(rad), c: 0, d: 1, e: 0, f: 0 };
    };

    function multiplyMatrices(m1, m2) {
        if (!m1) return m2;
        if (!m2) return m1;
        return {
            a: m1.a * m2.a + m1.c * m2.b,
            b: m1.b * m2.a + m1.d * m2.b,
            c: m1.a * m2.c + m1.c * m2.d,
            d: m1.b * m2.c + m1.d * m2.d,
            e: m1.a * m2.e + m1.c * m2.f + m1.e,
            f: m1.b * m2.e + m1.d * m2.f + m1.f,
        };
    }

    // transform="translate(...) rotate(...) ..." 파서
    function parseTransform(transformStr) {
        if (!transformStr) return null;

        let M = I();

        const toNums = (s) =>
            s
                .trim()
                .split(/[\s,]+/)
                .filter(Boolean)
                .map(parseFloat);

        const re = /([a-zA-Z]+)\(([^)]*)\)/g;
        let match;

        while ((match = re.exec(transformStr)) !== null) {
            const name = match[1];
            const args = toNums(match[2]);

            let m = I();

            if (name === "translate") {
                m = T(args[0] ?? 0, args[1] ?? 0);
            } else if (name === "scale") {
                const sx = args[0] ?? 1;
                const sy = args[1] ?? sx;
                m = S(sx, sy);
            } else if (name === "rotate") {
                const ang = args[0] ?? 0;
                const cx = args[1];
                const cy = args[2];
                if (typeof cx === "number" && typeof cy === "number") {
                    // rotate(a cx cy) = T(cx,cy) * R(a) * T(-cx,-cy)
                    m = multiplyMatrices(T(cx, cy), multiplyMatrices(R(ang), T(-cx, -cy)));
                } else {
                    m = R(ang);
                }
            } else if (name === "skewX") {
                m = KX(args[0] ?? 0);
            } else if (name === "skewY") {
                m = KY(args[0] ?? 0);
            } else if (name === "matrix") {
                if (args.length >= 6) {
                    m = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
                }
            }

            // SVG transform은 "작성된 순서대로 적용" → 누적은 앞에 곱하기
            M = multiplyMatrices(m, M);
        }

        return M;
    }

    // el 자신 포함, 부모로 올라가며 transform 누적
    function getAccumulatedTransformInclusive(el) {
        let acc = null;
        let cur = el;
        while (cur && cur !== svgRoot) {
            const tStr = cur.getAttribute && cur.getAttribute("transform");
            if (tStr) acc = multiplyMatrices(parseTransform(tStr), acc);
            cur = cur.parentElement;
        }
        return acc;
    }

    // el의 부모부터 올라가며 transform 누적 (el 자신 제외)
    function getAccumulatedTransformParentsOnly(el) {
        let acc = null;
        let cur = el ? el.parentElement : null;
        while (cur && cur !== svgRoot) {
            const tStr = cur.getAttribute && cur.getAttribute("transform");
            if (tStr) acc = multiplyMatrices(parseTransform(tStr), acc);
            cur = cur.parentElement;
        }
        return acc;
    }

    // =========================
    // Visibility filter
    // =========================
    function shouldRender(el) {
        // defs 안이면 제외
        let parent = el.parentElement;
        while (parent) {
            if (parent.tagName && parent.tagName.toLowerCase() === "defs") return false;
            parent = parent.parentElement;
        }
        const display = el.getAttribute("display");
        const visibility = el.getAttribute("visibility");
        if (display === "none" || visibility === "hidden") return false;
        return true;
    }

    // =========================
    // Local shape -> local path
    // (⚠️ 여기서는 transform을 절대 적용하지 않는다)
    // =========================
    function circleToPathLocal(cx, cy, r) {
        const x0 = cx - r;
        const x1 = cx + r;
        const y = cy;
        return `M ${x0},${y} A ${r},${r} 0 1,1 ${x1},${y} A ${r},${r} 0 1,1 ${x0},${y} Z`;
    }

    function ellipseToPathLocal(cx, cy, rx, ry) {
        const x0 = cx - rx;
        const x1 = cx + rx;
        const y = cy;
        // sweep-flag를 1로 변경 (반시계방향)
        return `M ${x0},${y} A ${rx},${ry} 0 1,1 ${x1},${y} A ${rx},${ry} 0 1,1 ${x0},${y} Z`;
    }

    function rectToPathLocal(x, y, w, h, rx, ry) {
        if ((rx && !ry) || (ry && !rx)) {
            rx = rx || ry;
            ry = ry || rx;
        }
        rx = rx || 0;
        ry = ry || 0;

        rx = Math.min(rx, w / 2);
        ry = Math.min(ry, h / 2);

        if (rx <= 1e-9 || ry <= 1e-9) {
            const x0 = x, y0 = y;
            const x1 = x + w, y1 = y + h;
            return `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
        }

        const K = 0.5522847498307936;
        const ox = rx * K;
        const oy = ry * K;

        const x0 = x, y0 = y;
        const x1 = x + w, y1 = y + h;

        const p0 = { x: x0 + rx, y: y0 };
        const p1s = { x: x1 - rx, y: y0 };

        const c1 = { x: x1 - rx + ox, y: y0 };
        const c2 = { x: x1, y: y0 + ry - oy };
        const p2e = { x: x1, y: y0 + ry };

        const p3s = { x: x1, y: y1 - ry };

        const c3 = { x: x1, y: y1 - ry + oy };
        const c4 = { x: x1 - rx + ox, y: y1 };
        const p4e = { x: x1 - rx, y: y1 };

        const p5s = { x: x0 + rx, y: y1 };

        const c5 = { x: x0 + rx - ox, y: y1 };
        const c6 = { x: x0, y: y1 - ry + oy };
        const p6e = { x: x0, y: y1 - ry };

        const p7s = { x: x0, y: y0 + ry };

        const c7 = { x: x0, y: y0 + ry - oy };
        const c8 = { x: x0 + rx - ox, y: y0 };

        return [
            `M ${p0.x},${p0.y}`,
            `L ${p1s.x},${p1s.y}`,
            `C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2e.x},${p2e.y}`,
            `L ${p3s.x},${p3s.y}`,
            `C ${c3.x},${c3.y} ${c4.x},${c4.y} ${p4e.x},${p4e.y}`,
            `L ${p5s.x},${p5s.y}`,
            `C ${c5.x},${c5.y} ${c6.x},${c6.y} ${p6e.x},${p6e.y}`,
            `L ${p7s.x},${p7s.y}`,
            `C ${c7.x},${c7.y} ${c8.x},${c8.y} ${p0.x},${p0.y}`,
            "Z",
        ].join(" ");
    }

    function lineToPathLocal(x1, y1, x2, y2) {
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    function polyToPathLocal(pointsStr, close) {
        const coords = pointsStr
            .trim()
            .split(/[\s,]+/)
            .map(parseFloat);

        if (coords.length < 4) return "";

        let d = `M ${coords[0]},${coords[1]}`;
        for (let i = 2; i < coords.length; i += 2) {
            d += ` L ${coords[i]},${coords[i + 1]}`;
        }
        if (close) d += " Z";
        return d;
    }

    // =========================
    // <use> resolve (transform 올바르게 합성)
    // final = parentAcc * useOwnTransform * T(x,y) * refTransform
    // =========================
    function resolveUseElement(useEl) {
        const href = useEl.getAttribute("href") || useEl.getAttribute("xlink:href");
        if (!href) return null;

        const id = href.replace("#", "");
        const ref = svgRoot.querySelector(`#${id}`);
        if (!ref) return null;

        const x = parseFloat(useEl.getAttribute("x")) || 0;
        const y = parseFloat(useEl.getAttribute("y")) || 0;

        const parentAcc = getAccumulatedTransformParentsOnly(useEl);
        const useOwn = parseTransform(useEl.getAttribute("transform")) || null;
        const refOwn = parseTransform(ref.getAttribute("transform")) || null;

        let M = I();
        if (refOwn) M = multiplyMatrices(refOwn, M);
        if (x !== 0 || y !== 0) M = multiplyMatrices(T(x, y), M);
        if (useOwn) M = multiplyMatrices(useOwn, M);
        if (parentAcc) M = multiplyMatrices(parentAcc, M);

        return { element: ref, transform: M, tagName: ref.tagName.toLowerCase() };
    }

    // =========================
    // Collect elements
    // =========================
    const allElements = [];

    const directShapes = svgRoot.querySelectorAll(
        "path, circle, rect, ellipse, line, polygon, polyline"
    );
    directShapes.forEach((el) => {
        if (!shouldRender(el)) return;
        allElements.push({
            element: el,
            transform: getAccumulatedTransformInclusive(el),
            tagName: el.tagName.toLowerCase(),
        });
    });

    const useElements = svgRoot.querySelectorAll("use");
    useElements.forEach((useEl) => {
        if (!shouldRender(useEl)) return;
        const resolved = resolveUseElement(useEl);
        if (resolved) allElements.push(resolved);
    });

    if (allElements.length === 0) {
        console.warn("SVG에 렌더링할 그래픽 요소가 없습니다.");
        document.body.removeChild(tempSvg);
        return points;
    }

    // =========================
    // PASS #1: build local d + transform + length
    // =========================
    const prepared = []; // { dAttr, transformMatrix, length }

    for (const info of allElements) {
        const el = info.element;
        const tagName = info.tagName;

        let transformMatrix = info.transform || null;
        let dAttr = "";

        if (tagName === "path") {
            dAttr = el.getAttribute("d") || "";
        } else if (tagName === "circle") {
            const cx = parseFloat(el.getAttribute("cx")) || 0;
            const cy = parseFloat(el.getAttribute("cy")) || 0;
            const r = parseFloat(el.getAttribute("r")) || 0;
            dAttr = circleToPathLocal(cx, cy, r);
        } else if (tagName === "ellipse") {
            const cx = parseFloat(el.getAttribute("cx")) || 0;
            const cy = parseFloat(el.getAttribute("cy")) || 0;
            const rx = parseFloat(el.getAttribute("rx")) || 0;
            const ry = parseFloat(el.getAttribute("ry")) || 0;
            dAttr = ellipseToPathLocal(cx, cy, rx, ry);
        } else if (tagName === "rect") {
            const x = parseFloat(el.getAttribute("x")) || 0;
            const y = parseFloat(el.getAttribute("y")) || 0;
            const w = parseFloat(el.getAttribute("width")) || 0;
            const h = parseFloat(el.getAttribute("height")) || 0;
            const rx = parseFloat(el.getAttribute("rx")) || 0;
            const ry = parseFloat(el.getAttribute("ry")) || 0;
            dAttr = rectToPathLocal(x, y, w, h, rx, ry);
        } else if (tagName === "line") {
            const x1 = parseFloat(el.getAttribute("x1")) || 0;
            const y1 = parseFloat(el.getAttribute("y1")) || 0;
            const x2 = parseFloat(el.getAttribute("x2")) || 0;
            const y2 = parseFloat(el.getAttribute("y2")) || 0;
            dAttr = lineToPathLocal(x1, y1, x2, y2);
        } else if (tagName === "polygon") {
            const pts = el.getAttribute("points");
            if (pts) dAttr = polyToPathLocal(pts, true);
        } else if (tagName === "polyline") {
            const pts = el.getAttribute("points");
            if (pts) dAttr = polyToPathLocal(pts, false);
        }

        if (!dAttr) continue;

        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("d", dAttr);

        if (transformMatrix) {
            const m = transformMatrix;
            pathEl.setAttribute("transform", `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`);
        }

        tempSvg.appendChild(pathEl);

        let L = 0;
        try {
            L = pathEl.getTotalLength();
        } catch (e) {
            tempSvg.removeChild(pathEl);
            continue;
        }

        tempSvg.removeChild(pathEl);

        if (L > 0) {
            prepared.push({ dAttr, transformMatrix, length: L });
        }
    }

    if (!prepared.length) {
        document.body.removeChild(tempSvg);
        return points;
    }

    // =========================
    // PASS #2: sampling
    // =========================
    for (const item of prepared) {
        const { dAttr, transformMatrix, length: totalLength } = item;

        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("d", dAttr);

        if (transformMatrix) {
            const m = transformMatrix;
            pathEl.setAttribute("transform", `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`);
        }

        tempSvg.appendChild(pathEl);

        // ✅ 각 path마다 step 다르게: (길이 / samplesPerPath), min 없이 maxStep + maxSamples만
        let step;
        if (typeof sampleStep === "number" && sampleStep > 0) {
            step = sampleStep;
        } else {
            step = totalLength / Math.max(1, samplesPerPath);
            step = Math.min(step, maxStepClamp);

            const n = Math.ceil(totalLength / Math.max(step, 1e-9));
            if (n > maxSamplesPerPath) {
                step = totalLength / maxSamplesPerPath;
            }
        }

        const localPoints = [];
        let isFirst = true;

        for (let len = 0; len <= totalLength; len += step) {
            const pt = pathEl.getPointAtLength(len);
            localPoints.push({ x: pt.x, y: pt.y, pen: isFirst ? 0 : 1 });
            isFirst = false;
        }

        // 끝점 보장
        const lastPt = pathEl.getPointAtLength(totalLength);
        localPoints.push({ x: lastPt.x, y: lastPt.y, pen: 1 });

        tempSvg.removeChild(pathEl);
        if (!localPoints.length) continue;

        // bridge (pen up)
        if (lastGlobalPt) {
            const start = lastGlobalPt;
            const end = localPoints[0];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.hypot(dx, dy);

            const bridgeStep = step * bridgeScale;
            const bridgeCount = Math.max(1, Math.floor(dist / Math.max(bridgeStep, 1e-9)));

            for (let i = 1; i <= bridgeCount; i++) {
                const t = i / (bridgeCount + 1);
                points.push({
                    x: start.x + dx * t,
                    y: start.y + dy * t,
                    pen: 0,
                });
            }
        }

        for (const lp of localPoints) points.push(lp);
        lastGlobalPt = localPoints[localPoints.length - 1];
    }

    document.body.removeChild(tempSvg);
    return points;
}


// SVG 좌표계(0~SVG_BOX_SIZE)로 정규화 함수
function normalizeToBox(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    const w = Math.max(1e-9, maxX - minX);
    const h = Math.max(1e-9, maxY - minY);

    const s = plotto.SVG_BOX_SIZE / Math.max(w, h);

    // 스케일된 결과의 크기
    const newW = w * s;
    const newH = h * s;

    // 남는 여백을 반씩 → 중앙정렬
    const offX = (plotto.SVG_BOX_SIZE - newW) / 2;
    const offY = (plotto.SVG_BOX_SIZE - newH) / 2;

    return points.map(p => ({
        x: (p.x - minX) * s + offX,
        y: (p.y - minY) * s + offY,
        pen: p.pen
    }));
}
// SVG 박스 좌표계 → 로봇 작업공간 좌표계 매핑 함수
function mapBoxToRobotTargets(points, k = 1.0, flipY = false) {
    const home = plotto.fkPenXY_deg(0, 0);

    return points.map(p => {
        const u = p.x;
        const v = flipY ? (plotto.SVG_BOX_SIZE - p.y) : p.y;

        return {
            x: home.x + u * k,
            y: home.y + v * k,
            pen: p.pen
        };
    });
}

// 각도 변화량 기준 리샘플링
function resamplePathByAngle(points, maxDeltaDeg = plotto.MAX_DELTA_DEG) {
    if (!points || points.length === 0) return [];

    const result = [];
    const first = points[0];
    let prevIK = plotto.inverseKinematics2DOF(first.x, first.y, null, null);
    if (!prevIK) {
        console.warn("IK failed at first point in resamplePathByAngle");
        return points;
    }
    result.push({ x: first.x, y: first.y, pen: first.pen });

    function subdivide(p0, ik0, p1, depth = 0) {
        if (depth > 20) {
            const ik1_fallback = plotto.inverseKinematics2DOF(p1.x, p1.y, ik0.joint1, ik0.joint2) || ik0;
            return [{ point: p1, ik: ik1_fallback }];
        }

        const ik1 = plotto.inverseKinematics2DOF(p1.x, p1.y, ik0.joint1, ik0.joint2);
        if (!ik1) {
            return [{ point: p1, ik: ik0 }];
        }

        const d1 = Math.abs(ik1.joint1 - ik0.joint1);
        const d2 = Math.abs(ik1.joint2 - ik0.joint2);
        const maxDelta = Math.max(d1, d2);

        if (maxDelta <= maxDeltaDeg) {
            return [{ point: p1, ik: ik1 }];
        }

        const mid = {
            x: (p0.x + p1.x) / 2,
            y: (p0.y + p1.y) / 2,
            pen: p1.pen,  // ★ 목적지의 펜 상태를 유지
        };

        const ikMid = plotto.inverseKinematics2DOF(mid.x, mid.y, ik0.joint1, ik0.joint2);
        if (!ikMid) {
            return [{ point: p1, ik: ik1 }];
        }

        const left = subdivide(p0, ik0, mid, depth + 1);
        const right = subdivide(mid, ikMid, p1, depth + 1);
        return [...left, ...right];
    }

    let prevPoint = first;

    for (let i = 1; i < points.length; i++) {
        const curr = points[i];
        const segPoints = subdivide(prevPoint, prevIK, curr);
        for (const sp of segPoints) {
            result.push({
                x: sp.point.x,
                y: sp.point.y,
                pen: curr.pen,  // ★ 현재 포인트의 원래 펜 상태 사용
            });
        }
        const last = segPoints[segPoints.length - 1];
        prevPoint = curr;
        prevIK = last.ik;
    }

    return result;
}


function encodeNibble(d) {
    const map = {
        [-7]: 0b1001,
        [-6]: 0b1010,
        [-5]: 0b1011,
        [-4]: 0b1100,
        [-3]: 0b1101,
        [-2]: 0b1110,
        [-1]: 0b1111,
        [0]: 0b0000,
        [1]: 0b0001,
        [2]: 0b0010,
        [3]: 0b0011,
        [4]: 0b0100,
        [5]: 0b0101,
        [6]: 0b0110,
        [7]: 0b0111,
    };
    return map[d];
}

function decodeNibble(n) {
    const map = {
        0b1001: -7,
        0b1010: -6,
        0b1011: -5,
        0b1100: -4,
        0b1101: -3,
        0b1110: -2,
        0b1111: -1,
        0b0000: 0,
        0b0001: 1,
        0b0010: 2,
        0b0011: 3,
        0b0100: 4,
        0b0101: 5,
        0b0110: 6,
        0b0111: 7,
    };
    return map[n];
}

function encodeDeltaByte(d1, d2) {
    const hi = encodeNibble(d1);
    const lo = encodeNibble(d2);
    return (hi << 4) | lo;
}

function decodeDeltaByte(byte) {
    const hi = (byte >> 4) & 0b1111;
    const lo = byte & 0b1111;
    return { d1: decodeNibble(hi), d2: decodeNibble(lo) };
}

// motionJson -> plot(bytes)
function plotEncode(motionJson) {
    if (!Array.isArray(motionJson)) {
        throw new Error("plotEncode: motionJson must be an array");
    }

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

// plot(bytes) -> motionJson
function plotDecode(byteArray) {
    if (!Array.isArray(byteArray)) {
        throw new Error("plotDecode: byteArray must be an array");
    }

    const out = [];
    let pen = 0; // ✅ 지역 변수로만 처리

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

// --------인스턴스-------------
const plotto = new Plotto();

plotto.configure({
    baseX: 0,
    baseY: 0,
    JOINT2_OFFSET: 143,
    STEP_DEG: plotto.STEP_DEG,
    MAX_STEPS_PT: plotto.MAX_STEPS_PT,
    SVG_BOX_SIZE: 250,
});
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

function degToStep(deg) {
    return Math.round(deg / plotto.STEP_DEG);
}

function stepToDeg(step) {
    return step * plotto.STEP_DEG;
}

function serialize() {
    return;
}


function deserialize() {
}

// put control code here, to run repeatedly
function loop() { }