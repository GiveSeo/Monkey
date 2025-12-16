const STEP_DEG = 0.010986328;// 1스탭당 몇도인지(실제 스탭 각도 기준)
const MAX_STEPS_PT = 7;

class Plutto {
    #minEncoderJoint1 = -30;
    #maxEncoderJoint1 = 180;
    #minEncoderJoint2 = -100;
    #maxEncoderJoint2 = 30;
    #motionJson = [];
    #plot = [];

    #baseX = 0;
    #baseY = 0;
    #link1 = 0;
    #link2 = 0;
    #upperRestAngle = 0;
    #foreRestAngle = 0;
    #JOINT2_OFFSET = 0;

    #svgPathPoints = [];
    #jsonBuilt = false;
    // constructor 
    constructor() {
        this.repeat = null; // 반복 함수 저장
        $("encoder.joint_1").d = 0;
        $("encoder.joint_2").d = 0;

        $('pen').d = 0; // 펜이 종이에 붙어있지 않은 상태
    }
    get svgPathPoints() { return this.#svgPathPoints; }
    set svgPathPoints(v) { this.#svgPathPoints = Array.isArray(v) ? v : []; }

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

    setKinematics({
        baseX,
        baseY,
        link1Length,
        link2Length,
        upperRestAngle,
        foreRestAngle,
        JOINT2_OFFSET,
    }) {
        this.baseX = baseX;
        this.baseY = baseY;
        this.link1 = link1Length;
        this.link2 = link2Length;
        this.upperRestAngle = upperRestAngle;
        this.foreRestAngle = foreRestAngle;
        this.JOINT2_OFFSET = JOINT2_OFFSET;
    }
    get minJoint1() {
        return this.#minEncoderJoint1;
    }
    set minJoint1(value) {
        this.#minEncoderJoint1 = value;
    }
    get maxJoint1() {
        return this.#maxEncoderJoint1;
    }
    set maxJoint1(value) {
        this.#maxEncoderJoint1 = value;
    }
    get minJoint2() {
        return this.#minEncoderJoint2;
    }
    set minJoint2(value) {
        this.#minEncoderJoint2 = value;
    }
    get maxJoint2() {
        return this.#maxEncoderJoint2;
    }
    set maxJoint2(value) {
        this.#maxEncoderJoint2 = value;
    }
    get motionJson() {
        return this.#motionJson;
    }
    set motionJson(value) {
        this.#motionJson = Array.isArray(value) ? value : [];
    }
    get plot() {
        return this.#plot;
    }
    set plot(value) {
        this.#plot = Array.isArray(value) ? value : [];
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
        const sampleStep = opts.sampleStep ?? 1;      // extract 샘플링 간격
        const k = opts.k ?? 1.0;                 // SVG_BOX -> 로봇 공간 스케일
        const flipY = opts.flipY ?? false;
        const maxDelta = opts.maxDeltaDeg ?? MAX_DELTA_DEG;

        // 1) SVG -> raw points
        const rawPts = extractPathPointsFromSvg(svgText, sampleStep);

        // 2) raw -> 정규화 박스
        const ptsBox = normalizeToBox(rawPts);

        // 3) 박스 -> 로봇 타겟 좌표
        let fitted = mapBoxToRobotTargets(ptsBox, k, flipY);

        // 4) 각도 변화량 제한으로 리샘플
        fitted = resamplePathByAngle(fitted, maxDelta);

        // 5) plutto 상태로 저장
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

        const j1MinStep = Math.round(this.minJoint1 / STEP_DEG);
        const j1MaxStep = Math.round(this.maxJoint1 / STEP_DEG);
        const j2MinStep = Math.round(this.minJoint2 / STEP_DEG);
        const j2MaxStep = Math.round(this.maxJoint2 / STEP_DEG);

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
                const d1 = Math.max(-MAX_STEPS_PT, Math.min(MAX_STEPS_PT, rem1));
                const d2 = Math.max(-MAX_STEPS_PT, Math.min(MAX_STEPS_PT, rem2));

                // ⚠️ UI 의존 (가능하면 제거 가능)
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

        let targetStartJ1 = Math.round(firstIk.joint1 / STEP_DEG);
        let targetStartJ2 = Math.round(firstIk.joint2 / STEP_DEG);
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

            let targetStepJ1 = Math.round(ik.joint1 / STEP_DEG);
            let targetStepJ2 = Math.round(ik.joint2 / STEP_DEG);

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
}
// SVG 경로에서 포인트 추출 함수
function extractPathPointsFromSvg(svgText, sampleStep = 0.02) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgRoot = doc.documentElement;

    const points = [];

    // 브라우저 임시 svg
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tempSvg.setAttribute("width", "0");
    tempSvg.setAttribute("height", "0");
    tempSvg.style.position = "absolute";
    tempSvg.style.left = "-9999px";
    tempSvg.style.top = "-9999px";
    document.body.appendChild(tempSvg);

    let lastGlobalPt = null; // 이전 shape의 마지막 점

    // transform 파싱 함수
    function parseTransform(transformStr) {
        if (!transformStr) return null;

        // 단위행렬
        let M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

        // 단일 변환 생성기
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

        const toNums = (s) =>
            s
                .trim()
                .split(/[\s,]+/)
                .filter(Boolean)
                .map(parseFloat);

        // transform 함수들 추출: name(args)
        const re = /([a-zA-Z]+)\(([^)]*)\)/g;
        let match;

        while ((match = re.exec(transformStr)) !== null) {
            const name = match[1];
            const args = toNums(match[2]);

            let m = null;

            if (name === "translate") {
                const tx = args[0] ?? 0;
                const ty = args[1] ?? 0;
                m = T(tx, ty);
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
                // matrix(a b c d e f)
                if (args.length >= 6) {
                    m = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
                } else {
                    m = I();
                }
            } else {
                // 알 수 없는 transform이면 무시
                m = I();
            }

            // ⭐ SVG transform은 "작성된 순서대로 적용"되도록 누적:
            // p' = m * p, 그 다음 변환이 또 있으면 (next * (m*p)) → 누적은 "앞에 곱하기"
            M = multiplyMatrices(m, M);
        }

        return M;
    }

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

    function getAccumulatedTransform(el) {
        let acc = null;
        let cur = el;

        while (cur && cur !== svgRoot) {
            const tStr = cur.getAttribute("transform");
            if (tStr) {
                const m = parseTransform(tStr);
                acc = multiplyMatrices(m, acc);
            }
            cur = cur.parentElement;
        }
        return acc;
    }

    function applyTransform(x, y, m) {
        if (!m) return { x, y };
        return {
            x: m.a * x + m.c * y + m.e,
            y: m.b * x + m.d * y + m.f,
        };
    }

    function shouldRender(el) {
        // defs 안에 있으면 그리지 않음
        let parent = el.parentElement;
        while (parent) {
            if (parent.tagName.toLowerCase() === "defs") return false;
            parent = parent.parentElement;
        }

        const display = el.getAttribute("display");
        const visibility = el.getAttribute("visibility");
        if (display === "none" || visibility === "hidden") return false;

        return true;
    }

    // 기본 도형 좌표 추출 함수
    function circleToPath(cx, cy, r, m) {
        const center = applyTransform(cx, cy, m);
        let newR = r;

        if (m) {
            const sx = Math.sqrt(m.a * m.a + m.b * m.b);
            const sy = Math.sqrt(m.c * m.c + m.d * m.d);
            newR = (r * (sx + sy)) / 2;
        }

        const x0 = center.x - newR;
        const x1 = center.x + newR;
        const y = center.y;

        return `M ${x0},${y} A ${newR},${newR} 0 1,0 ${x1},${y} A ${newR},${newR} 0 1,0 ${x0},${y} Z`;
    }

    function ellipseToPath(cx, cy, rx, ry, m) {
        const center = applyTransform(cx, cy, m);
        let newRx = rx,
            newRy = ry;

        if (m) {
            const sx = Math.sqrt(m.a * m.a + m.b * m.b);
            const sy = Math.sqrt(m.c * m.c + m.d * m.d);
            newRx = rx * sx;
            newRy = ry * sy;
        }

        const x0 = center.x - newRx;
        const x1 = center.x + newRx;
        const y = center.y;

        return `M ${x0},${y} A ${newRx},${newRy} 0 1,0 ${x1},${y} A ${newRx},${newRy} 0 1,0 ${x0},${y} Z`;
    }

    function rectToPath(x, y, w, h, rx, ry, m) {
        // SVG 스펙: rx/ry 하나만 주어지면 다른 하나는 동일
        if ((rx && !ry) || (ry && !rx)) {
            rx = rx || ry;
            ry = ry || rx;
        }
        rx = rx || 0;
        ry = ry || 0;

        // rx/ry는 폭/높이의 절반을 넘을 수 없음
        rx = Math.min(rx, w / 2);
        ry = Math.min(ry, h / 2);

        // 라운드 없는 경우: 직선 사각형
        if (rx <= 1e-9 || ry <= 1e-9) {
            const p1 = applyTransform(x, y, m);
            const p2 = applyTransform(x + w, y, m);
            const p3 = applyTransform(x + w, y + h, m);
            const p4 = applyTransform(x, y + h, m);
            return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`;
        }

        // quarter-ellipse를 cubic bezier로 근사할 때 쓰는 상수
        // kappa = 4/3 * tan(pi/8) ≈ 0.5522847498307936
        const K = 0.5522847498307936;

        // 로컬 좌표계에서의 주요 점들
        const x0 = x, y0 = y;
        const x1 = x + w, y1 = y + h;

        // 각 코너에서 베지어 제어점 이동량
        const ox = rx * K;
        const oy = ry * K;

        // 변환 적용 헬퍼
        const P = (px, py) => applyTransform(px, py, m);

        // 라운드 사각형을 시계방향으로 구성
        // 시작점: top edge의 좌측 라운드 끝 (x0+rx, y0)
        const p0 = P(x0 + rx, y0);

        // top edge 직선 끝: (x1-rx, y0)
        const p1s = P(x1 - rx, y0);

        // TR 코너(Top->Right) : (x1-rx,y0) -> (x1,y0+ry)
        const c1 = P(x1 - rx + ox, y0);
        const c2 = P(x1, y0 + ry - oy);
        const p2e = P(x1, y0 + ry);

        // right edge 직선 끝: (x1, y1-ry)
        const p3s = P(x1, y1 - ry);

        // BR 코너(Right->Bottom) : (x1,y1-ry) -> (x1-rx,y1)
        const c3 = P(x1, y1 - ry + oy);
        const c4 = P(x1 - rx + ox, y1);
        const p4e = P(x1 - rx, y1);

        // bottom edge 직선 끝: (x0+rx, y1)
        const p5s = P(x0 + rx, y1);

        // BL 코너(Bottom->Left) : (x0+rx,y1) -> (x0,y1-ry)
        const c5 = P(x0 + rx - ox, y1);
        const c6 = P(x0, y1 - ry + oy);
        const p6e = P(x0, y1 - ry);

        // left edge 직선 끝: (x0, y0+ry)
        const p7s = P(x0, y0 + ry);

        // TL 코너(Left->Top) : (x0,y0+ry) -> (x0+rx,y0)
        const c7 = P(x0, y0 + ry - oy);
        const c8 = P(x0 + rx - ox, y0);
        const p8e = p0; // 닫힘점

        // path 구성 (직선은 L, 코너는 C)
        return [
            `M ${p0.x},${p0.y}`,
            `L ${p1s.x},${p1s.y}`,
            `C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2e.x},${p2e.y}`,
            `L ${p3s.x},${p3s.y}`,
            `C ${c3.x},${c3.y} ${c4.x},${c4.y} ${p4e.x},${p4e.y}`,
            `L ${p5s.x},${p5s.y}`,
            `C ${c5.x},${c5.y} ${c6.x},${c6.y} ${p6e.x},${p6e.y}`,
            `L ${p7s.x},${p7s.y}`,
            `C ${c7.x},${c7.y} ${c8.x},${c8.y} ${p8e.x},${p8e.y}`,
            "Z",
        ].join(" ");
    }

    function lineToPath(x1, y1, x2, y2, m) {
        const p1 = applyTransform(x1, y1, m);
        const p2 = applyTransform(x2, y2, m);
        return `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
    }

    function polyToPath(pointsStr, m, close) {
        const coords = pointsStr
            .trim()
            .split(/[\s,]+/)
            .map(parseFloat);
        if (coords.length < 4) return "";

        const p0 = applyTransform(coords[0], coords[1], m);
        let path = `M ${p0.x},${p0.y}`;

        for (let i = 2; i < coords.length; i += 2) {
            const p = applyTransform(coords[i], coords[i + 1], m);
            path += ` L ${p.x},${p.y}`;
        }
        if (close) path += " Z";
        return path;
    }

    // <use> 해석
    function resolveUseElement(useEl) {
        const href = useEl.getAttribute("href") || useEl.getAttribute("xlink:href");
        if (!href) return null;

        const id = href.replace("#", "");
        const ref = svgRoot.querySelector(`#${id}`);
        if (!ref) return null;

        const tagName = ref.tagName.toLowerCase();
        const x = parseFloat(useEl.getAttribute("x")) || 0;
        const y = parseFloat(useEl.getAttribute("y")) || 0;

        let m = getAccumulatedTransform(useEl);
        if (x !== 0 || y !== 0) {
            m = multiplyMatrices(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
        }

        const useTransform = useEl.getAttribute("transform");
        if (useTransform) {
            m = multiplyMatrices(m, parseTransform(useTransform));
        }

        const refTransform = ref.getAttribute("transform");
        if (refTransform) {
            m = multiplyMatrices(m, parseTransform(refTransform));
        }

        return { element: ref, transform: m, tagName };
    }

    // 실제로 그려질 요소 수집
    const allElements = [];

    const directShapes = svgRoot.querySelectorAll(
        "path, circle, rect, ellipse, line, polygon, polyline"
    );
    directShapes.forEach((el) => {
        if (!shouldRender(el)) return;
        allElements.push({
            element: el,
            transform: null,
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

    // 각 shape에 따라 처리
    allElements.forEach((info) => {
        const el = info.element;
        const tagName = info.tagName;

        let transformMatrix = info.transform || getAccumulatedTransform(el);
        let dAttr = "";

        if (tagName === "path") {
            dAttr = el.getAttribute("d");
            // path는 transform을 svg에 맡기기 위해 matrix로 넘김
        } else if (tagName === "circle") {
            const cx = parseFloat(el.getAttribute("cx")) || 0;
            const cy = parseFloat(el.getAttribute("cy")) || 0;
            const r = parseFloat(el.getAttribute("r")) || 0;
            dAttr = circleToPath(cx, cy, r, transformMatrix);
            transformMatrix = null; // 이미 좌표에 반영했으므로
        } else if (tagName === "ellipse") {
            const cx = parseFloat(el.getAttribute("cx")) || 0;
            const cy = parseFloat(el.getAttribute("cy")) || 0;
            const rx = parseFloat(el.getAttribute("rx")) || 0;
            const ry = parseFloat(el.getAttribute("ry")) || 0;
            dAttr = ellipseToPath(cx, cy, rx, ry, transformMatrix);
            transformMatrix = null;
        } else if (tagName === "rect") {
            const x = parseFloat(el.getAttribute("x")) || 0;
            const y = parseFloat(el.getAttribute("y")) || 0;
            const w = parseFloat(el.getAttribute("width")) || 0;
            const h = parseFloat(el.getAttribute("height")) || 0;
            const rx = parseFloat(el.getAttribute("rx")) || 0;
            const ry = parseFloat(el.getAttribute("ry")) || 0;
            dAttr = rectToPath(x, y, w, h, rx, ry, transformMatrix);
            transformMatrix = null;
        } else if (tagName === "line") {
            const x1 = parseFloat(el.getAttribute("x1")) || 0;
            const y1 = parseFloat(el.getAttribute("y1")) || 0;
            const x2 = parseFloat(el.getAttribute("x2")) || 0;
            const y2 = parseFloat(el.getAttribute("y2")) || 0;
            dAttr = lineToPath(x1, y1, x2, y2, transformMatrix);
            transformMatrix = null;
        } else if (tagName === "polygon") {
            const pts = el.getAttribute("points");
            if (pts) dAttr = polyToPath(pts, transformMatrix, true);
            transformMatrix = null;
        } else if (tagName === "polyline") {
            const pts = el.getAttribute("points");
            if (pts) dAttr = polyToPath(pts, transformMatrix, false);
            transformMatrix = null;
        }

        if (!dAttr) return;

        const pathEl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );
        pathEl.setAttribute("d", dAttr);

        if (transformMatrix) {
            const m = transformMatrix;
            pathEl.setAttribute(
                "transform",
                `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`
            );
        }

        tempSvg.appendChild(pathEl);

        let totalLength;
        try {
            totalLength = pathEl.getTotalLength();
        } catch (e) {
            console.warn("getTotalLength 실패, 이 shape는 스킵:", tagName, e);
            tempSvg.removeChild(pathEl);
            return;
        }

        if (!totalLength || totalLength === 0) {
            tempSvg.removeChild(pathEl);
            return;
        }

        const step = sampleStep > 0 ? sampleStep : totalLength / 50;
        const localPoints = [];
        let isFirst = true;

        // 일정 단위로 샘플링
        for (let len = 0; len <= totalLength; len += step) {
            const pt = pathEl.getPointAtLength(len);
            localPoints.push({ x: pt.x, y: pt.y, pen: isFirst ? 0 : 1 });
            isFirst = false;
        }

        // 끝점 추가
        const lastPt = pathEl.getPointAtLength(totalLength);
        localPoints.push({ x: lastPt.x, y: lastPt.y, pen: 1 });

        tempSvg.removeChild(pathEl);
        if (!localPoints.length) return;

        // 이전 shape의 끝점 → 이번 shape의 시작점 까지 펜 업 이동 (물리적으로 순간이동 방지)
        if (lastGlobalPt) {
            const start = lastGlobalPt;
            const end = localPoints[0];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.hypot(dx, dy);

            const bridgeStep = sampleStep > 0 ? sampleStep : dist / 20;
            const bridgeCount = Math.max(1, Math.floor(dist / bridgeStep));

            for (let i = 1; i <= bridgeCount; i++) {
                const t = i / (bridgeCount + 1);
                points.push({
                    x: start.x + dx * t,
                    y: start.y + dy * t,
                    pen: 0,
                });
            }
        }

        // 실제 path 포인트 추가
        for (const lp of localPoints) {
            points.push(lp);
        }

        lastGlobalPt = localPoints[localPoints.length - 1];
    });

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

    const s = SVG_BOX_SIZE / Math.max(w, h);

    // 스케일된 결과의 크기
    const newW = w * s;
    const newH = h * s;

    // 남는 여백을 반씩 → 중앙정렬
    const offX = (SVG_BOX_SIZE - newW) / 2;
    const offY = (SVG_BOX_SIZE - newH) / 2;

    return points.map(p => ({
        x: (p.x - minX) * s + offX,
        y: (p.y - minY) * s + offY,
        pen: p.pen
    }));
}
// SVG 박스 좌표계 → 로봇 작업공간 좌표계 매핑 함수
function mapBoxToRobotTargets(points, k = 1.0, flipY = false) {
    const home = plutto.fkPenXY_deg(0, 0);

    return points.map(p => {
        const u = p.x;
        const v = flipY ? (SVG_BOX_SIZE - p.y) : p.y;

        return {
            x: home.x + u * k,
            y: home.y + v * k,
            pen: p.pen
        };
    });
}

// 각도 변화량 기준 리샘플링
function resamplePathByAngle(points, maxDeltaDeg = MAX_DELTA_DEG) {
    if (!points || points.length === 0) return [];

    const result = [];
    const first = points[0];
    let prevIK = plutto.inverseKinematics2DOF(first.x, first.y, null, null);
    if (!prevIK) {
        console.warn("IK failed at first point in resamplePathByAngle");
        return points;
    }
    result.push({ x: first.x, y: first.y, pen: first.pen });

    function subdivide(p0, ik0, p1, depth = 0) {
        if (depth > 20) {
            const ik1_fallback = plutto.inverseKinematics2DOF(p1.x, p1.y, ik0.joint1, ik0.joint2) || ik0;
            return [{ point: p1, ik: ik1_fallback }];
        }

        const ik1 = plutto.inverseKinematics2DOF(p1.x, p1.y, ik0.joint1, ik0.joint2);
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

        const ikMid = plutto.inverseKinematics2DOF(mid.x, mid.y, ik0.joint1, ik0.joint2);
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

function degToStep(deg) {
    return Math.round(deg / STEP_DEG);
}

function stepToDeg(step) {
    return step * STEP_DEG;
}

function serialize() {
    return;
}


function deserialize() {
}

// put control code here, to run repeatedly
function loop() { }