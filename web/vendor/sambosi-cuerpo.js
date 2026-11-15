/* SAMBOSI · cuerpo anatómico 3D (piel, músculos, esqueleto, órganos) sobre un esqueleto Mixamo */
(function () {
  'use strict';

  function crear(T, cfg) {
    var api = {}, vivo = true;
    var canvas = cfg.canvas, stage = cfg.stage;
    var V3 = function (x, y, z) { return new T.Vector3(x, y, z); };
    var col = function (hex) { var c = new T.Color(hex); return [c.r, c.g, c.b]; };
    var mezclaC = function (a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var lerp = function (a, b, k) { return a + (b - a) * k; };
    var rnd = (function () { var s = 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

    /* ---------- renderer, escena, cámara ---------- */
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { cfg.onEstado && cfg.onEstado({ error: 'WebGL no disponible' }); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    var ancho = stage.clientWidth || 600, alto = stage.clientHeight || 600;
    renderer.setSize(ancho, alto, false);
    var escena = new T.Scene();
    var camara = new T.PerspectiveCamera(30, ancho / alto, 0.05, 50);
    camara.position.set(0, 1.15, 4.6);
    escena.add(camara);
    var ctl = null;
    if (T.OrbitControls && !cfg.sinControles) {
      ctl = new T.OrbitControls(camara, canvas);
      ctl.target.set(0, 0.95, 0);
      ctl.enablePan = false; ctl.enableDamping = true; ctl.dampingFactor = 0.08;
      ctl.minDistance = 1.2; ctl.maxDistance = 6.5;
      ctl.minPolarAngle = 0.35; ctl.maxPolarAngle = 2.1;
      ctl.autoRotate = cfg.autoGiro !== false; ctl.autoRotateSpeed = 0.9;
      var reanudar = 0;
      ctl.addEventListener('start', function () { ctl.autoRotate = false; clearTimeout(reanudar); stage.style.cursor = 'grabbing'; });
      ctl.addEventListener('end', function () { stage.style.cursor = 'grab'; reanudar = setTimeout(function () { if (vivo) ctl.autoRotate = true; }, 7000); });
    }

    /* luces que acompañan a la cámara para que siempre se vea con volumen */
    escena.add(new T.HemisphereLight(0xdfe8ff, 0x24161c, 0.5));
    var clave = new T.DirectionalLight(0xfff4ea, 0.95); clave.position.set(1.4, 1.6, 2.2); camara.add(clave); clave.target.position.set(0, -0.2, -4); camara.add(clave.target);
    var relleno = new T.DirectionalLight(0x9db8ff, 0.3); relleno.position.set(-2.2, 0.4, 1.2); camara.add(relleno); relleno.target.position.set(0, 0, -4); camara.add(relleno.target);
    var contra = new T.DirectionalLight(0x7aa0ff, 0.9); contra.position.set(0.3, 1.2, -3); camara.add(contra); contra.target.position.set(0, 0, 2); camara.add(contra.target);

    /* piso holográfico (marca SAMBOSI) */
    var piso = new T.Group();
    var anillo = function (r1, r2, op) {
      var m = new T.Mesh(new T.RingGeometry(r1, r2, 96), new T.MeshBasicMaterial({ color: 0x6E94FF, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; return m;
    };
    piso.add(anillo(0.52, 0.535, 0.7)); piso.add(anillo(0.72, 0.726, 0.35));
    var giro = anillo(0.88, 0.9, 0.25); piso.add(giro);
    var disco = new T.Mesh(new T.CircleGeometry(0.75, 64), new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vU; void main(){ float d = distance(vU, vec2(0.5)); gl_FragColor = vec4(0.3, 0.5, 1.0, smoothstep(0.5, 0.0, d) * 0.3); }'
    }));
    disco.rotation.x = -Math.PI / 2; piso.add(disco);
    escena.add(piso);

    /* ---------- materiales ---------- */
    var uT = { value: 0 }, uAct = { value: 0.7 }, uFr = { value: 0 }, uZf = { value: 0 };
    var fibras = function (mat, k) {
      mat.onBeforeCompile = function (sh) {
        sh.uniforms.uFib = { value: k };
        sh.vertexShader = 'varying vec2 vUvF;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vUvF = uv;');
        sh.fragmentShader = 'uniform float uFib; varying vec2 vUvF;\n' + sh.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\n  float fib = 0.5 + 0.5 * sin(vUvF.x * 6.2831 * 9.0);\n  float fino = 0.5 + 0.5 * sin(vUvF.x * 6.2831 * 31.0 + vUvF.y * 3.0);\n  diffuseColor.rgb *= 1.0 - uFib * (0.16 * fib + 0.07 * fino);');
      };
      mat.customProgramCacheKey = function () { return 'fib' + k; };
      return mat;
    };
    var plano = new T.Plane(new T.Vector3(-1, 0, 0), 0.7), corteObj = 0.7;
    var matMus = fibras(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0, transparent: true, clippingPlanes: [plano] }), 1.0);
    var matHue = fibras(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, transparent: true }), 0.12);
    var matHueDoble = matHue.clone(); matHueDoble.side = T.DoubleSide; fibras(matHueDoble, 0.12);
    var matOjo = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.0, transparent: true });

    /* fantasma holográfico de la piel (aditivo, con piel animada) */
    var matFantasma = new T.ShaderMaterial({
      uniforms: { uT: uT, uOp: { value: 0.2 }, uA: { value: new T.Color('#3D6BFF') }, uB: { value: new T.Color('#9DE7FF') }, uTinte: { value: new T.Color('#9DE7FF') } },
      vertexShader: [
        '#include <common>', '#include <skinning_pars_vertex>',
        'varying vec3 vN; varying vec3 vV; varying float vY;',
        'void main(){',
        '#include <beginnormal_vertex>', '#include <skinbase_vertex>', '#include <skinnormal_vertex>', '#include <defaultnormal_vertex>',
        '#include <begin_vertex>', '#include <skinning_vertex>', '#include <project_vertex>',
        'vN = normalize(transformedNormal); vV = normalize(-mvPosition.xyz); vY = (modelMatrix * vec4(transformed, 1.0)).y;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uT; uniform float uOp; uniform vec3 uA; uniform vec3 uB; uniform vec3 uTinte;',
        'varying vec3 vN; varying vec3 vV; varying float vY;',
        'void main(){',
        '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);',
        '  float banda = smoothstep(0.05, 0.0, abs(fract(vY * 0.42 - uT * 0.12) - 0.5));',
        '  vec3 c = mix(uA, uTinte, f) * (0.4 + f * 1.4) + banda * vec3(0.4, 0.6, 1.0);',
        '  gl_FragColor = vec4(c, clamp(f * 0.9 + banda * 0.35, 0.0, 1.0) * uOp);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    /* piel realista (tono del tripulante) */
    var matPiel = new T.MeshPhysicalMaterial({ color: new T.Color('#C98D69'), roughness: 0.58, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.6, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new T.Color('#ffd9c4'), transparent: true });
    matPiel.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <output_fragment>',
        '#include <output_fragment>\n  float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);\n  gl_FragColor.rgb += vec3(0.25, 0.42, 0.9) * rim * 0.45;');
    };
    /* resplandor (rayos X) para el órgano del punto elegido */
    var matBrillo = function (hex) {
      return new T.ShaderMaterial({
        uniforms: { uT: uT, uC: { value: new T.Color(hex) }, uOp: { value: 0 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float uT; uniform vec3 uC; uniform float uOp; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 1.6); float p = 0.75 + 0.25 * sin(uT * 4.0); gl_FragColor = vec4(uC * (0.5 + f * 1.4) * p, (0.18 + f * 0.75) * uOp); }',
        transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending
      });
    };

    /* ---------- utilidades de geometría ---------- */
    function Cubeta() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
    Cubeta.prototype.agregar = function (g, colorFn) {
      var base = this.p.length / 3;
      var P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (var k = 0; k < P.count; k++) {
        this.p.push(P.getX(k), P.getY(k), P.getZ(k));
        this.n.push(N.getX(k), N.getY(k), N.getZ(k));
        var u = U ? U.getX(k) : 0, v = U ? U.getY(k) : 0;
        this.uv.push(u, v);
        var c = typeof colorFn === 'function' ? colorFn(u, v, k) : colorFn;
        this.c.push(c[0], c[1], c[2]);
      }
      var I = g.index;
      if (I) for (var q = 0; q < I.count; q++) this.i.push(base + I.getX(q));
      else for (var r = 0; r < P.count; r++) this.i.push(base + r);
    };
    Cubeta.prototype.geometria = function () {
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.i);
      return g;
    };

    /* barrido: tubo de sección elíptica a lo largo de puntos densos */
    function barrido(pts, wh, refs, nR) {
      nR = nR || 12;
      var n = pts.length, pos = [], uv = [], idx = [];
      var tan = new T.Vector3(), s = new T.Vector3(), nn = new T.Vector3(), tmp = new T.Vector3();
      for (var i = 0; i < n; i++) {
        var t = n > 1 ? i / (n - 1) : 0;
        tan.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        nn.copy(refs[i]).normalize();
        s.crossVectors(tan, nn);
        if (s.lengthSq() < 1e-8) { tmp.set(0, 0, 1); if (Math.abs(tan.z) > 0.9) tmp.set(1, 0, 0); s.crossVectors(tan, tmp); }
        s.normalize(); nn.crossVectors(s, tan).normalize();
        var r = wh(t), w = r[0], h = r[1];
        for (var j = 0; j <= nR; j++) {
          var a = j / nR * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          pos.push(pts[i].x + s.x * ca * w + nn.x * sa * h, pts[i].y + s.y * ca * w + nn.y * sa * h, pts[i].z + s.z * ca * w + nn.z * sa * h);
          uv.push(j / nR, t);
        }
      }
      for (var i2 = 0; i2 < n - 1; i2++) for (var j2 = 0; j2 < nR; j2++) {
        var a0 = i2 * (nR + 1) + j2, b0 = a0 + nR + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
      var c0 = pos.length / 3; pos.push(pts[0].x, pts[0].y, pts[0].z); uv.push(0.5, 0);
      var c1 = pos.length / 3; pos.push(pts[n - 1].x, pts[n - 1].y, pts[n - 1].z); uv.push(0.5, 1);
      for (var j3 = 0; j3 < nR; j3++) { idx.push(c0, j3 + 1, j3); var l = (n - 1) * (nR + 1); idx.push(c1, l + j3, l + j3 + 1); }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      var N = g.attributes.normal;
      for (var i4 = 0; i4 < n; i4++) {
        var p0 = i4 * (nR + 1), p1 = p0 + nR;
        var x = N.getX(p0) + N.getX(p1), y = N.getY(p0) + N.getY(p1), z = N.getZ(p0) + N.getZ(p1), L = Math.sqrt(x * x + y * y + z * z) || 1;
        N.setXYZ(p0, x / L, y / L, z / L); N.setXYZ(p1, x / L, y / L, z / L);
      }
      return g;
    }
    function curva(ctrl, n) {
      if (ctrl.length === 2) { var o = []; for (var i = 0; i <= n; i++) o.push(ctrl[0].clone().lerp(ctrl[1], i / n)); return o; }
      return new T.CatmullRomCurve3(ctrl, false, 'centripetal').getSpacedPoints(n);
    }
    function largo(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L; }
    /* elipsoide deformable */
    function esfera(c, rad, quat, disp, ws, hs) {
      var g = new T.SphereGeometry(1, ws || 28, hs || 20);
      var P = g.attributes.position, v = new T.Vector3();
      for (var k = 0; k < P.count; k++) {
        v.fromBufferAttribute(P, k);
        var d = disp ? disp(v.x, v.y, v.z) : 0;
        var q = Array.isArray(d) ? d : [d, d, d];
        v.set(v.x * rad[0] * (1 + q[0]), v.y * rad[1] * (1 + q[1]), v.z * rad[2] * (1 + q[2]));
        if (quat) v.applyQuaternion(quat);
        v.add(c);
        P.setXYZ(k, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    }
    function quatDe(dirY, dirZ) {
      var y = dirY.clone().normalize(), z = dirZ ? dirZ.clone() : V3(0, 0, 1);
      var x = new T.Vector3().crossVectors(y, z); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize();
      z.crossVectors(x, y).normalize();
      return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
    }
    /* superficie entre dos curvas (para láminas: ilion, escápula, diafragma) */
    function lamina(curA, curB, nu, nv, grosor) {
      var A = curva(curA, nu), B = curB.length === 1 ? null : curva(curB, nu);
      var pos = [], uv = [], idx = [];
      for (var i = 0; i <= nu; i++) for (var j = 0; j <= nv; j++) {
        var a = A[i], b = B ? B[i] : curB[0];
        var p = a.clone().lerp(b, j / nv);
        pos.push(p.x, p.y, p.z); uv.push(i / nu, j / nv);
      }
      for (var i2 = 0; i2 < nu; i2++) for (var j2 = 0; j2 < nv; j2++) {
        var q = i2 * (nv + 1) + j2, r = q + nv + 1;
        idx.push(q, r, q + 1, q + 1, r, r + 1);
      }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    }

    /* ---------- carga del modelo ---------- */
    var mezclador = null, capas = {}, organos = {}, anclas = {}, listo = false, modelo = null, cabeza = [];
    var estado = { modo: cfg.modo || 'musculos', punto: cfg.punto || null, bpm: 68 };
    var opac = { piel: 0, fantasma: 0.14, musculos: 1, esqueleto: 1, organos: 0 };
    var objetivo = {};
    var MODOS = {
      piel: { piel: 1, fantasma: 0.0, musculos: 0, esqueleto: 0, organos: 0 },
      musculos: { piel: 0, fantasma: 0.12, musculos: 1, esqueleto: 1, organos: 0 },
      esqueleto: { piel: 0, fantasma: 0.22, musculos: 0, esqueleto: 1, organos: 0 },
      organos: { piel: 0, fantasma: 0.2, musculos: 0, esqueleto: 0.12, organos: 1 },
      todo: { piel: 0, fantasma: 0.14, musculos: 0.12, esqueleto: 0.45, organos: 1 },
      mitad: { piel: 0, fantasma: 0.34, musculos: 1, esqueleto: 0.22, organos: 0.7 }
    };
    var metas = function () { objetivo = Object.assign({}, MODOS[estado.modo]); objetivo.cabeza = estado.punto === 'mente' && estado.modo !== 'organos' ? 0.18 : 1; objetivo.cerebro = estado.punto === 'mente' || estado.modo === 'mitad' ? 1 : 0; };
    metas(); opac = Object.assign({}, objetivo);
    if (estado.modo === 'mitad') { corteObj = 0; plano.constant = 0; }

    function cargar() {
      fetch(cfg.url).then(function (r) { if (!r.ok) throw new Error('descarga ' + r.status); return r.text(); })
        .then(function (txt) {
          var glb = cfg.aGLB(txt);
          new T.GLTFLoader().parse(glb, '', function (g) {
            try { var t0 = performance.now(); montar(g); api._ms = Math.round(performance.now() - t0); listo = true; cfg.onEstado && cfg.onEstado({ listo: true }); }
            catch (e) { console.error(e); cfg.onEstado && cfg.onEstado({ error: 'modelo: ' + (e && e.message ? e.message : e) }); }
          }, function (e) { cfg.onEstado && cfg.onEstado({ error: 'lectura: ' + (e && e.message ? e.message : e) }); });
        })
        .catch(function (e) { cfg.onEstado && cfg.onEstado({ error: e && e.message ? e.message : String(e) }); });
    }

    function montar(g) {
      modelo = g.scene;
      var hueso = function (nm) { return modelo.getObjectByName('mixamorig' + nm) || modelo.getObjectByName('mixamorig:' + nm); };
      var clip = T.AnimationClip.findByName(g.animations, 'idle') || T.AnimationClip.findByName(g.animations, 'Idle') || g.animations[0];
      if (clip) { mezclador = new T.AnimationMixer(modelo); mezclador.clipAction(clip).play(); mezclador.update(0); }
      modelo.updateMatrixWorld(true);
      /* escala a 1,75 m y de frente a +z */
      var w = function (nm) { return hueso(nm).getWorldPosition(new T.Vector3()); };
      var alto = w('HeadTop_End').y - Math.min(w('LeftToe_End').y, w('RightToe_End').y);
      modelo.scale.multiplyScalar(1.72 / alto); modelo.updateMatrixWorld(true);
      var lado = w('LeftArm').sub(w('RightArm')); lado.y = 0; lado.normalize();
      var frente = lado.clone().cross(V3(0, 1, 0));
      modelo.rotation.y -= Math.atan2(frente.x, frente.z); modelo.updateMatrixWorld(true);
      lado = w('LeftArm').sub(w('RightArm')); lado.y = 0; lado.normalize();
      frente = lado.clone().cross(V3(0, 1, 0));
      if (frente.z < 0) { modelo.rotation.y += Math.PI; modelo.updateMatrixWorld(true); }
      var pies = Math.min(w('LeftToe_End').y, w('RightToe_End').y, w('LeftFoot').y - 0.08);
      var cen = w('Hips');
      modelo.position.x -= cen.x; modelo.position.z -= cen.z; modelo.position.y -= pies - 0.005;
      modelo.updateMatrixWorld(true);
      escena.add(modelo);

      /* piel: muestreo de vértices (pose actual) */
      var malla = null, extra = [];
      modelo.traverse(function (o) { if (o.isSkinnedMesh) { if (/Surface|Body|Mesh$/i.test(o.name) && !malla) malla = o; else extra.push(o); } });
      if (!malla) modelo.traverse(function (o) { if (o.isSkinnedMesh && !malla) malla = o; });
      extra.forEach(function (o) { if (o !== malla) o.visible = false; });
      malla.frustumCulled = false;
      var huesos = malla.skeleton.bones;
      var PV = malla.geometry.attributes.position, SI = malla.geometry.attributes.skinIndex, SW = malla.geometry.attributes.skinWeight;
      var vert = [], dueno = [];
      var tmp = new T.Vector3();
      for (var i = 0; i < PV.count; i++) {
        tmp.fromBufferAttribute(PV, i); malla.boneTransform(i, tmp); tmp.applyMatrix4(malla.matrixWorld);
        var ws = [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)], is = [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)];
        var b = 0; for (var k = 1; k < 4; k++) if (ws[k] > ws[b]) b = k;
        vert.push(tmp.clone()); dueno.push(huesos[is[b]].name.replace(/^mixamorig:?/, ''));
      }
      malla.material = matFantasma;
      malla.renderOrder = 9;
      var piel2 = new T.SkinnedMesh(malla.geometry, matPiel);
      piel2.bind(malla.skeleton, malla.bindMatrix);
      piel2.frustumCulled = false; piel2.renderOrder = 8;
      malla.parent.add(piel2);
      piel2.position.copy(malla.position); piel2.quaternion.copy(malla.quaternion); piel2.scale.copy(malla.scale);
      capas.fantasma = [malla]; capas.piel = [piel2];

      var J = {};
      modelo.traverse(function (o) { if (o.isBone) J[o.name.replace(/^mixamorig:?/, '')] = o.getWorldPosition(new T.Vector3()); });
      var B = {};
      modelo.traverse(function (o) { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; });
      construir(J, B, vert, dueno);
    }

    /* ---------- tablas de radio de piel ---------- */
    function Tubo(A, Bp, nombres, nt, nf, t0, t1, frenteRef) {
      this.A = A.clone(); this.B = Bp.clone();
      this.u = Bp.clone().sub(A); this.L = this.u.length(); this.u.normalize();
      var fr = (frenteRef || V3(0, 0, 1)).clone(); fr.sub(this.u.clone().multiplyScalar(fr.dot(this.u))).normalize();
      this.fr = fr; this.la = new T.Vector3().crossVectors(fr, this.u).normalize();
      this.nt = nt; this.nf = nf; this.t0 = t0; this.t1 = t1;
      this.R = new Float32Array(nt * nf); this.cnt = new Uint16Array(nt * nf);
      this.lado = 1;
    }
    Tubo.prototype.setLado = function (s) { this.lado = s; if (s < 0) this.la.multiplyScalar(-1); return this; };
    Tubo.prototype.llenar = function (vert, dueno, nombres) {
      var d = new T.Vector3();
      for (var i = 0; i < vert.length; i++) {
        if (nombres.indexOf(dueno[i]) < 0) continue;
        d.subVectors(vert[i], this.A);
        var t = d.dot(this.u) / this.L; if (t < this.t0 || t > this.t1) continue;
        var x = d.dot(this.la), z = d.dot(this.fr);
        var r = Math.sqrt(x * x + z * z), f = Math.atan2(x, z);
        var it = Math.round((t - this.t0) / (this.t1 - this.t0) * (this.nt - 1)), jf = ((Math.round(f / (Math.PI * 2) * this.nf) % this.nf) + this.nf) % this.nf;
        var q = it * this.nf + jf;
        if (r > this.R[q]) this.R[q] = r; this.cnt[q]++;
      }
      /* rellenar huecos y suavizar */
      for (var pase = 0; pase < 40; pase++) {
        var falta = 0;
        for (var a = 0; a < this.nt; a++) for (var b = 0; b < this.nf; b++) {
          var q2 = a * this.nf + b; if (this.R[q2] > 0) continue;
          var s = 0, c = 0;
          var vec = [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]];
          for (var v = 0; v < 4; v++) { var aa = vec[v][0], bb = (vec[v][1] + this.nf) % this.nf; if (aa < 0 || aa >= this.nt) continue; var rr = this.R[aa * this.nf + bb]; if (rr > 0) { s += rr; c++; } }
          if (c) this.R[q2] = -s / c; else falta++;
        }
        for (var z2 = 0; z2 < this.R.length; z2++) if (this.R[z2] < 0) this.R[z2] = -this.R[z2];
        if (!falta) break;
      }
      for (var p2 = 0; p2 < 2; p2++) {
        var R2 = new Float32Array(this.R.length);
        for (var a3 = 0; a3 < this.nt; a3++) for (var b3 = 0; b3 < this.nf; b3++) {
          var s3 = this.R[a3 * this.nf + b3] * 4, c3 = 4;
          var nb = [[a3 - 1, b3], [a3 + 1, b3], [a3, b3 - 1], [a3, b3 + 1]];
          for (var v3 = 0; v3 < 4; v3++) { var a4 = nb[v3][0], b4 = (nb[v3][1] + this.nf) % this.nf; if (a4 < 0 || a4 >= this.nt) continue; s3 += this.R[a4 * this.nf + b4]; c3++; }
          R2[a3 * this.nf + b3] = s3 / c3;
        }
        this.R = R2;
      }
      return this;
    };
    Tubo.prototype.radio = function (t, fDeg) {
      var x = clamp((t - this.t0) / (this.t1 - this.t0), 0, 1) * (this.nt - 1);
      var f = (fDeg / 360) * this.nf; f = ((f % this.nf) + this.nf) % this.nf;
      var a = Math.floor(x), b = Math.min(this.nt - 1, a + 1), ka = x - a;
      var c = Math.floor(f), d = (c + 1) % this.nf, kc = f - c;
      var R = this.R, nf = this.nf;
      return lerp(lerp(R[a * nf + c], R[a * nf + d], kc), lerp(R[b * nf + c], R[b * nf + d], kc), ka);
    };
    /* punto en superficie: t a lo largo, f en grados (0 = frente, +90 = lado externo), hundido "dentro" */
    Tubo.prototype.punto = function (t, fDeg, dentro) {
      var r = this.radio(t, fDeg) - (dentro || 0);
      var f = fDeg * Math.PI / 180;
      return this.A.clone().addScaledVector(this.u, t * this.L).addScaledVector(this.fr, Math.cos(f) * r).addScaledVector(this.la, Math.sin(f) * r);
    };
    Tubo.prototype.normal = function (fDeg) { var f = fDeg * Math.PI / 180; return this.fr.clone().multiplyScalar(Math.cos(f)).addScaledVector(this.la, Math.sin(f)); };
    Tubo.prototype.coords = function (p) {
      var d = p.clone().sub(this.A); var t = d.dot(this.u) / this.L;
      var f = Math.atan2(d.dot(this.la), d.dot(this.fr)) * 180 / Math.PI;
      return [t, f];
    };
    Tubo.prototype.eje = function (t) { return this.A.clone().addScaledVector(this.u, t * this.L); };

    /* ---------- construcción anatómica ---------- */
    function construir(J, B, vert, dueno) {
      var cub = { musculos: {}, esqueleto: {}, organos: {} };
      var cubeta = function (capa, hueso) { if (!B[hueso]) hueso = 'Hips'; return cub[capa][hueso] || (cub[capa][hueso] = new Cubeta()); };
      var C = {
        mus: col('#9A2A33'), mus2: col('#AE3A3C'), mus3: col('#7E1F2B'), prof: col('#5E1820'), tendon: col('#DCC8B6'), fascia: col('#C9A196'),
        hueso: col('#E3D6BD'), hueso2: col('#CDBB9C'), cart: col('#C9DDE2'), disco: col('#B5CBD8'), diente: col('#F4EFE4'), cuenca: col('#2A1D19')
      };

      /* ejes del cuerpo */
      var yPie = 0;
      var torso = new Tubo(V3(0, J.LeftUpLeg.y - 0.11, 0), V3(0, J.Neck.y + 0.01, 0), null, 64, 32, 0, 1);
      /* centro z por altura: usar media de z de los vértices del tronco */
      (function () {
        var sum = 0, n = 0;
        for (var i = 0; i < vert.length; i++) if (['Spine', 'Spine1', 'Spine2', 'Hips'].indexOf(dueno[i]) >= 0) { sum += vert[i].z; n++; }
        var zc = n ? sum / n : 0; torso.A.z = zc; torso.B.z = zc;
      })();
      torso.llenar(vert, dueno, ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck']);
      var yT = function (y) { return (y - torso.A.y) / torso.L; };
      var TP = function (y, f, dentro, s) { return torso.punto(yT(y), f * (s || 1), dentro); };
      var cuello = new Tubo(V3(0, J.Neck.y - 0.03, J.Neck.z), J.Head.clone(), null, 12, 24, 0, 1).llenar(vert, dueno, ['Neck', 'Head', 'Spine2']);

      var miembros = {};
      [['Left', 1], ['Right', -1]].forEach(function (par) {
        var L = par[0], s = par[1];
        miembros[L] = {
          s: s,
          brazo: new Tubo(J[L + 'Arm'], J[L + 'ForeArm'], null, 22, 20, -0.25, 1.08).setLado(s).llenar(vert, dueno, [L + 'Arm', L + 'Shoulder']),
          ante: new Tubo(J[L + 'ForeArm'], J[L + 'Hand'], null, 20, 20, -0.05, 1.05).setLado(s).llenar(vert, dueno, [L + 'ForeArm', L + 'Arm']),
          muslo: new Tubo(J[L + 'UpLeg'], J[L + 'Leg'], null, 24, 20, -0.1, 1.06).setLado(s).llenar(vert, dueno, [L + 'UpLeg']),
          pierna: new Tubo(J[L + 'Leg'], J[L + 'Foot'], null, 22, 20, -0.04, 1.04).setLado(s).llenar(vert, dueno, [L + 'Leg', L + 'UpLeg'])
        };
      });

      /* ===== músculos ===== */
      var nMus = 0;
      function musculo(capaHueso, ctrl, w, h, op) {
        op = op || {};
        var ta = op.ta == null ? 0.08 : op.ta, tb = op.tb == null ? 0.12 : op.tb;
        var pre = curva(ctrl, 64), L = largo(pre);
        var n = clamp(Math.round(L / 0.006), 10, 48);
        var pts = curva(ctrl, n);
        var refs = [];
        for (var i = 0; i < pts.length; i++) {
          var t = i / (pts.length - 1);
          if (op.sobre) {
            var r = op.sobre(pts[i], t);
            if (r) { pts[i] = r.p; refs.push(r.n); continue; }
          }
          refs.push(op.ref ? op.ref(pts[i], t) : V3(0, 0, 1));
        }
        var forma = op.forma || 'huso';
        var tono = op.col || (nMus++ % 3 === 0 ? C.mus2 : nMus % 3 === 1 ? C.mus : C.mus3);
        var tend = op.tendon || C.tendon;
        var perfil = function (t) {
          var a = ta, b = 1 - tb, core;
          if (t <= a) core = 0.24 + 0.08 * (t / Math.max(a, 1e-3));
          else if (t >= b) core = 0.24 + 0.08 * ((1 - t) / Math.max(tb, 1e-3));
          else { var x = (t - a) / (b - a); core = Math.max(0.3, Math.pow(Math.sin(Math.PI * x), forma === 'plano' ? 0.22 : forma === 'medio' ? 0.4 : 0.62)); }
          var e = Math.min(t, 1 - t); if (e < 0.04) core *= 0.25 + 0.75 * Math.sqrt(e / 0.04);
          return core;
        };
        var g = barrido(pts, function (t) {
          var k = perfil(t);
          var enT = t < ta || t > 1 - tb;
          return [w * (enT ? Math.max(k, op.tendonAncho || 0.3) : k), h * k * (enT ? 0.55 : 1)];
        }, refs, op.nR || 14);
        cubeta('musculos', capaHueso).agregar(g, function (u, v) {
          var a = ta, b = 1 - tb, k = 0;
          if (v < a) k = clamp((a - v) / (a * 0.5 + 1e-3), 0, 1);
          else if (v > b) k = clamp((v - b) / (tb * 0.5 + 1e-3), 0, 1);
          var base = mezclaC(tono, C.mus3, 0.25 * Math.abs(Math.cos(u * Math.PI * 2)));
          return mezclaC(base, tend, k);
        });
        return pts;
      }
      /* proyección sobre un "tubo" de piel */
      var sobreTubo = function (tb, dentro) {
        return function (p) {
          var c = tb.coords(p);
          return { p: tb.punto(c[0], c[1], dentro), n: tb.normal(c[1]) };
        };
      };
      var mezclaSobre = function (a, b, corte) { return function (p, t) { return t < corte ? a(p, t) : b ? b(p, t) : null; }; };
      function capaProfunda(tb, dentro, hueso, t0, t1, nt, nf, rayas) {
        var pos = [], uv = [], idx = [];
        for (var i = 0; i <= nt; i++) for (var j = 0; j <= nf; j++) {
          var t = lerp(t0, t1, i / nt), f = j / nf * 360 - 180;
          var p = tb.punto(t, f, typeof dentro === 'function' ? dentro(t, f) : dentro);
          pos.push(p.x, p.y, p.z); uv.push(j / nf, (t - t0) / (t1 - t0));
        }
        for (var i2 = 0; i2 < nt; i2++) for (var j2 = 0; j2 < nf; j2++) {
          var a = i2 * (nf + 1) + j2, b = a + nf + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
        var g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        var k = Math.floor(nt / 2) * (nf + 1) + Math.floor(nf / 4);
        var nrm = V3(g.attributes.normal.getX(k), g.attributes.normal.getY(k), g.attributes.normal.getZ(k));
        var pp = V3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        var c = tb.coords(pp), out = pp.clone().sub(tb.eje(c[0]));
        if (nrm.dot(out) < 0) { for (var q = 0; q < idx.length; q += 3) { var tmp2 = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp2; } g.setIndex(idx); g.computeVertexNormals(); }
        var N = g.attributes.normal;
        for (var i4 = 0; i4 <= nt; i4++) { var p0 = i4 * (nf + 1), p1 = p0 + nf; var x = N.getX(p0) + N.getX(p1), y = N.getY(p0) + N.getY(p1), z = N.getZ(p0) + N.getZ(p1), L = Math.sqrt(x * x + y * y + z * z) || 1; N.setXYZ(p0, x / L, y / L, z / L); N.setXYZ(p1, x / L, y / L, z / L); }
        cubeta('musculos', hueso).agregar(g, function (u, v) { return mezclaC(C.prof, C.mus3, 0.25 + 0.25 * Math.sin((rayas ? v : u) * (rayas || 60))); });
      }

      capaProfunda(torso, 0.017, 'Spine1', yT(J.LeftUpLeg.y - 0.095), 1.0, 52, 40, 140);
      Object.keys(miembros).forEach(function (L) {
        var m = miembros[L];
        capaProfunda(m.brazo, 0.014, L + 'Arm', 0.0, 1.0, 14, 18);
        capaProfunda(m.ante, 0.012, L + 'ForeArm', 0.0, 0.92, 14, 18);
        capaProfunda(m.muslo, 0.02, L + 'UpLeg', -0.04, 1.05, 18, 20);
        capaProfunda(m.pierna, 0.014, L + 'Leg', -0.02, 0.97, 16, 18);
        /* pie y mano: tejido blando + tendones */
        var fin = J[L + 'Toe_End'] || J[L + 'ToeBase'].clone().add(V3(0, 0, 0.08));
        var pie = new Tubo(J[L + 'Foot'].clone().add(V3(0, 0.01, -0.03)), fin, null, 14, 16, -0.08, 0.98, V3(0, 1, 0)).llenar(vert, dueno, [L + 'Foot', L + 'ToeBase', L + 'Toe_End']);
        capaProfunda(pie, 0.004, L + 'Foot', 0.0, 0.62, 10, 16);
        capaProfunda(pie, 0.004, L + 'ToeBase', 0.6, 0.97, 6, 16);
        for (var td = 0; td < 4; td++) {
          var ang = lerp(-35, 35, td / 3);
          musculo(L + 'Foot', [pie.punto(0.05, ang * 0.4, 0.001), pie.punto(0.5, ang, 0.001), pie.punto(0.9, ang * 1.15, 0.001)], 0.0028, 0.0016, { ta: 1, tb: 0, col: C.tendon, tendonAncho: 1, sobre: sobreTubo(pie, 0.001) });
        }
        musculo(L + 'Leg', [m.pierna.punto(0.78, 180, 0.004), m.pierna.punto(1.02, 180, 0.0), pie.punto(-0.06, 180, 0.004)], 0.007, 0.004, { ta: 1, tb: 0, col: C.tendon, tendonAncho: 1 }); // tendón de Aquiles
        var mano = new Tubo(J[L + 'Hand'], J[L + 'HandMiddle1'], null, 10, 16, 0.0, 1.05).setLado(m.s).llenar(vert, dueno, [L + 'Hand']);
        capaProfunda(mano, 0.003, L + 'Hand', 0.02, 1.02, 8, 16);
        ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach(function (d) {
          var a1 = J[L + 'Hand' + d + '1'], a4 = J[L + 'Hand' + d + '4'] || J[L + 'Hand' + d + '3'];
          if (!a1 || !a4) return;
          var dedo = new Tubo(a1, a4, null, 8, 10, 0.0, 1.0).setLado(m.s).llenar(vert, dueno, [L + 'Hand' + d + '1', L + 'Hand' + d + '2', L + 'Hand' + d + '3']);
          capaProfunda(dedo, 0.0015, L + 'Hand' + d + '1', -0.05, 0.98, 8, 10);
          if (d !== 'Thumb') musculo(L + 'Hand', [mano.punto(0.15, 180, 0.0), a1.clone().add(mano.normal(180).multiplyScalar(0.006))], 0.0022, 0.0014, { ta: 1, tb: 0, col: C.tendon, tendonAncho: 1 });
        });
      });
      Object.keys(miembros).forEach(function (L) {
        var m = miembros[L], s = m.s;
        var br = m.brazo, an = m.ante, mu = m.muslo, pi = m.pierna;
        var sB = function (d) { return sobreTubo(br, d); };
        var sA = function (d) { return sobreTubo(an, d); };
        var sM = function (d) { return sobreTubo(mu, d); };
        var sP = function (d) { return sobreTubo(pi, d); };
        var hb = L + 'Arm', ha = L + 'ForeArm', hm = L + 'UpLeg', hp = L + 'Leg';

        /* --- brazo --- */
        musculo(hb, [br.punto(0.12, 5, 0.014), br.punto(0.5, 0, 0.014), br.punto(0.97, 0, 0.016)], 0.019, 0.015, { ta: 0.1, tb: 0.17, sobre: sB(0.014) }); // bíceps
        musculo(hb, [br.punto(0.42, 60, 0.012), br.punto(0.95, 40, 0.012)], 0.012, 0.009, { sobre: sB(0.011), ta: 0.05, tb: 0.15 }); // braquial
        musculo(hb, [br.punto(0.04, 185, 0.014), br.punto(0.5, 182, 0.015), br.punto(0.96, 180, 0.012)], 0.017, 0.014, { ta: 0.05, tb: 0.32, tendonAncho: 0.7, sobre: sB(0.013) }); // tríceps largo
        musculo(hb, [br.punto(0.1, 135, 0.012), br.punto(0.55, 140, 0.013), br.punto(0.92, 165, 0.012)], 0.013, 0.011, { ta: 0.06, tb: 0.25, sobre: sB(0.012) }); // tríceps lateral
        musculo(hb, [br.punto(0.4, -130, 0.011), br.punto(0.92, -160, 0.011)], 0.011, 0.009, { ta: 0.05, tb: 0.2, sobre: sB(0.01) }); // tríceps medial
        /* deltoides: tres cabezas sobre la cabeza del húmero */
        var cabeza = J[hb];
        var deltaIns = br.punto(0.42, 80, 0.008);
        [[-55, 0.05, V3(s * 0.11, 1.44, 0.05)], [0, 0, V3(s * 0.155, 1.455, 0.005)], [55, -0.05, V3(s * 0.12, 1.445, -0.06)]].forEach(function (d, k) {
          var org = d[2].clone(); org.y = J[hb].y + 0.03 + (k === 1 ? 0.006 : 0);
          var medio = br.punto(0.12, 90 + (k - 1) * 55, 0.011);
          musculo(hb, [org, medio, deltaIns], 0.024, 0.013, { ta: 0.03, tb: 0.14, forma: 'medio', tendon: C.fascia, sobre: function (p, t) { return t > 0.3 ? sobreTubo(br, 0.011)(p) : null; }, ref: function (p) { return p.clone().sub(cabeza); } });
        });
        /* --- antebrazo --- */
        musculo(ha, [br.punto(0.62, 95, 0.012), an.punto(0.18, 70, 0.013), an.punto(0.6, 60, 0.008), an.punto(0.96, 50, 0.006)], 0.015, 0.012, { ta: 0.05, tb: 0.45, sobre: function (p, t) { var c = an.coords(p); return c[0] < -0.05 ? sobreTubo(br, 0.012)(p) : sobreTubo(an, 0.012)(p); } }); // braquiorradial
        [-20, -55, -90].forEach(function (f, k) { // flexores
          musculo(ha, [br.punto(1.0, -95, 0.01), an.punto(0.3, f, 0.012), an.punto(0.95, f * 0.4 - 5, 0.006)], 0.012 - k * 0.001, 0.01, { ta: 0.05, tb: 0.42, sobre: sA(0.011) });
        });
        [130, 160, -170].forEach(function (f, k) { // extensores
          musculo(ha, [br.punto(1.0, 95, 0.01), an.punto(0.28, f, 0.011), an.punto(0.95, f * 0.9 + 15, 0.006)], 0.011, 0.009, { ta: 0.05, tb: 0.45, sobre: sA(0.01) });
        });
        musculo(ha, [an.punto(0.55, 110, 0.008), an.punto(0.97, 30, 0.005)], 0.008, 0.005, { ta: 0.05, tb: 0.3, sobre: sA(0.006) }); // abductor largo del pulgar

        /* --- muslo --- */
        musculo(hm, [mu.punto(0.03, 15, 0.018), mu.punto(0.5, 5, 0.022), mu.punto(1.0, 0, 0.012)], 0.026, 0.022, { ta: 0.07, tb: 0.15, sobre: sM(0.02) }); // recto femoral
        musculo(hm, [mu.punto(0.05, 75, 0.02), mu.punto(0.5, 80, 0.022), mu.punto(0.95, 45, 0.012)], 0.03, 0.022, { ta: 0.05, tb: 0.14, sobre: sM(0.021) }); // vasto lateral
        musculo(hm, [mu.punto(0.4, -45, 0.016), mu.punto(0.8, -45, 0.02), mu.punto(1.0, -20, 0.012)], 0.026, 0.02, { ta: 0.05, tb: 0.1, sobre: sM(0.018) }); // vasto medial (gota)
        musculo(hm, [mu.punto(-0.03, 50, 0.012), mu.punto(0.45, -30, 0.012), mu.punto(0.95, -100, 0.01), pi.punto(0.1, -40, 0.008)], 0.011, 0.006, { ta: 0.03, tb: 0.12, sobre: function (p) { var c = mu.coords(p); return c[0] > 1.0 ? sobreTubo(pi, 0.006)(p) : sobreTubo(mu, 0.008)(p); } }); // sartorio
        musculo(hm, [mu.punto(0.0, -80, 0.02), mu.punto(0.35, -90, 0.022), mu.punto(0.75, -100, 0.016)], 0.03, 0.022, { ta: 0.05, tb: 0.12, sobre: sM(0.02) }); // aductores
        musculo(hm, [mu.punto(0.0, -120, 0.016), mu.punto(0.5, -125, 0.018), mu.punto(0.95, -115, 0.01)], 0.016, 0.013, { ta: 0.05, tb: 0.15, sobre: sM(0.014) }); // grácil
        musculo(hm, [mu.punto(0.04, 175, 0.02), mu.punto(0.5, 160, 0.022), mu.punto(1.0, 135, 0.012)], 0.025, 0.02, { ta: 0.08, tb: 0.2, sobre: sM(0.019) }); // bíceps femoral
        musculo(hm, [mu.punto(0.04, -165, 0.02), mu.punto(0.5, -155, 0.022), mu.punto(1.0, -135, 0.012)], 0.024, 0.02, { ta: 0.08, tb: 0.25, sobre: sM(0.019) }); // semitendinoso
        musculo(hm, [mu.punto(-0.05, 105, 0.008), mu.punto(0.5, 105, 0.005), mu.punto(1.02, 95, 0.004)], 0.016, 0.003, { ta: 0.0, tb: 0.0, col: C.fascia, tendon: C.fascia, forma: 'plano', sobre: sM(0.003) }); // cintilla iliotibial
        /* --- pierna --- */
        musculo(hp, [pi.punto(-0.03, 165, 0.02), pi.punto(0.28, 160, 0.025), pi.punto(0.62, 175, 0.014), pi.punto(1.0, 180, 0.006)], 0.024, 0.02, { ta: 0.04, tb: 0.42, tendonAncho: 0.45, sobre: sP(0.02) }); // gemelo lateral
        musculo(hp, [pi.punto(-0.03, -160, 0.02), pi.punto(0.3, -155, 0.026), pi.punto(0.62, -175, 0.014), pi.punto(1.0, 180, 0.006)], 0.026, 0.021, { ta: 0.04, tb: 0.42, tendonAncho: 0.45, sobre: sP(0.02) }); // gemelo medial
        musculo(hp, [pi.punto(0.25, 120, 0.014), pi.punto(0.6, 110, 0.014), pi.punto(0.9, 160, 0.008)], 0.022, 0.012, { ta: 0.04, tb: 0.25, sobre: sP(0.012) }); // sóleo lateral
        musculo(hp, [pi.punto(0.25, -110, 0.014), pi.punto(0.6, -110, 0.014), pi.punto(0.9, -160, 0.008)], 0.02, 0.012, { ta: 0.04, tb: 0.25, sobre: sP(0.012) }); // sóleo medial
        musculo(hp, [pi.punto(0.06, 30, 0.014), pi.punto(0.5, 25, 0.015), pi.punto(0.97, -10, 0.006)], 0.016, 0.013, { ta: 0.04, tb: 0.42, sobre: sP(0.013) }); // tibial anterior
        musculo(hp, [pi.punto(0.08, 75, 0.012), pi.punto(0.6, 85, 0.012), pi.punto(1.0, 120, 0.006)], 0.012, 0.01, { ta: 0.04, tb: 0.45, sobre: sP(0.011) }); // peroneos
        musculo(hp, [pi.punto(0.15, 50, 0.011), pi.punto(1.0, 25, 0.005)], 0.01, 0.007, { ta: 0.04, tb: 0.45, sobre: sP(0.008) }); // extensor de los dedos
        /* --- glúteos y cadera (en el tronco) --- */
        var yG = J[hm].y;
        musculo('Hips', [TP(yG + 0.075, 168, 0.03, s), TP(yG + 0.0, 140, 0.035, s), mu.punto(0.18, 120, 0.012)], 0.04, 0.016, { ta: 0.04, tb: 0.18, forma: 'medio', sobre: function (p, t) { return t < 0.7 ? sobreTubo(torso, 0.016)(p) : sobreTubo(mu, 0.012)(p); } }); // glúteo mayor
        musculo('Hips', [TP(yG - 0.015, 172, 0.03, s), TP(yG - 0.05, 150, 0.03, s), mu.punto(0.2, 140, 0.012)], 0.036, 0.015, { ta: 0.04, tb: 0.18, forma: 'medio', sobre: function (p, t) { return t < 0.7 ? sobreTubo(torso, 0.015)(p) : sobreTubo(mu, 0.012)(p); } }); // glúteo mayor (fascículo bajo)
        musculo('Hips', [TP(yG + 0.095, 120, 0.016, s), TP(yG + 0.05, 100, 0.018, s), mu.punto(0.02, 95, 0.012)], 0.035, 0.016, { ta: 0.04, tb: 0.1, forma: 'medio', sobre: sobreTubo(torso, 0.016) }); // glúteo medio
        musculo('Hips', [TP(yG + 0.075, 60, 0.012, s), mu.punto(0.08, 75, 0.012), mu.punto(0.25, 95, 0.008)], 0.015, 0.011, { ta: 0.05, tb: 0.2, sobre: function (p, t) { return t < 0.4 ? sobreTubo(torso, 0.012)(p) : sobreTubo(mu, 0.01)(p); } }); // tensor de la fascia lata
      });

      /* --- tronco --- */
      var yH = J.Hips.y, yS = J.Spine.y, yS1 = J.Spine1.y, yS2 = J.Spine2.y, yN = J.Neck.y, yA = (J.LeftArm.y + J.RightArm.y) / 2;
      var yPub = J.LeftUpLeg.y - 0.035, yXif = yS1 + 0.035, yEsternon = yA + 0.02;
      var sT = function (d) { return sobreTubo(torso, d); };
      [1, -1].forEach(function (s) {
        var L = s > 0 ? 'Left' : 'Right', br = miembros[L].brazo;
        var hum = br.punto(0.13, 20, 0.014);
        /* pectoral mayor: abanico de fascículos */
        for (var k = 0; k < 7; k++) {
          var y0 = lerp(yEsternon - 0.005, yXif + 0.02, k / 6);
          var f0 = k === 0 ? 14 : 5;
          var org = k === 0 ? TP(yEsternon + 0.003, 26, 0.012, s) : TP(y0, f0, 0.012, s);
          var mid = TP(lerp(y0, yA - 0.02, 0.55) + (k === 0 ? 0.005 : 0), lerp(f0, 55, 0.6), 0.016, s);
          musculo('Spine2', [org, mid, hum], 0.03, 0.0095, { ta: 0.0, tb: 0.16, forma: 'plano', tendonAncho: 0.5, sobre: function (p, t) { return t < 0.62 ? sobreTubo(torso, 0.014)(p) : null; }, ref: function (p) { return p.clone().sub(V3(0, p.y, torso.A.z)); } });
        }
        /* recto abdominal en segmentos (cuadritos) + vaina */
        var cortes = [yXif + 0.01, yXif - 0.05, yXif - 0.105, yS - 0.025, yPub + 0.005];
        for (var q = 0; q < 4; q++) {
          var arr = cortes[q] - 0.004, aba = cortes[q + 1] + 0.004;
          musculo(q < 2 ? 'Spine1' : 'Spine', [TP(arr + 0.002, 10, 0.0068, s), TP((arr + aba) / 2, 9.5, 0.0068, s), TP(aba - 0.002, q === 3 ? 5 : 9, 0.0068, s)], q === 3 ? 0.027 : 0.034, 0.0062, { ta: 0.0, tb: 0.0, forma: 'plano', sobre: sT(0.0068), col: C.mus });
        }
        /* oblicuo externo */
        for (var o = 0; o < 6; o++) {
          var ya = yXif + 0.03 - o * 0.035;
          musculo('Spine1', [TP(ya, 70 + o * 4, 0.012, s), TP(ya - 0.07, 45 + o * 2, 0.012, s), TP(Math.max(yPub + 0.03, ya - 0.14), 20 + o * 2, 0.01, s)], 0.024, 0.008, { ta: 0.04, tb: 0.1, forma: 'plano', tendonAncho: 0.9, tendon: C.fascia, sobre: sT(0.009) });
        }
        /* serrato anterior: dedos sobre las costillas */
        for (var r2 = 0; r2 < 4; r2++) {
          var yr = yA - 0.05 - r2 * 0.035;
          musculo('Spine2', [TP(yr - 0.01, 50 + r2 * 3, 0.01, s), TP(yr + 0.015, 85, 0.012, s), TP(yA - 0.03, 115, 0.02, s)], 0.014, 0.008, { ta: 0.08, tb: 0.05, forma: 'medio', sobre: sT(0.01) });
        }
        /* trapecio */
        for (var tz = 0; tz < 7; tz++) {
          var yo = lerp(yN + 0.11, yS1 - 0.02, tz / 6);
          var dest = tz < 2 ? V3(s * lerp(0.1, 0.13, tz), yA + 0.028, torso.A.z - 0.01) : tz < 4 ? V3(s * 0.14, yA + 0.025, torso.A.z - 0.035) : V3(s * 0.1, yA + 0.0, -0.07);
          var ini = tz < 2 ? cuello.punto(lerp(1.0, 0.45, tz), 180 * s, 0.008) : TP(yo, 179, 0.01, s);
          musculo(tz < 2 ? 'Neck' : 'Spine2', [ini, TP(lerp(yo, yA + 0.02, 0.5), lerp(176, 140, 0.5), 0.01, s), dest], 0.028, 0.008, { ta: tz === 3 ? 0.18 : 0.06, tb: 0.1, forma: 'plano', tendonAncho: 0.9, tendon: C.fascia, sobre: function (p, t) { var c = torso.coords(p); if (c[0] > 0.97) return sobreTubo(cuello, 0.008)(p); return t < 0.85 ? sobreTubo(torso, 0.009)(p) : null; } });
        }
        /* dorsal ancho */
        for (var dz = 0; dz < 6; dz++) {
          var yd = lerp(yS2 - 0.02, yH + 0.02, dz / 5);
          var axila = br.punto(0.12, -120, 0.012);
          musculo('Spine1', [TP(yd, 178, 0.01, s), TP(lerp(yd, yA - 0.07, 0.55), 130, 0.012, s), axila], 0.03, 0.008, { ta: dz > 2 ? 0.25 : 0.1, tb: 0.12, forma: 'plano', tendonAncho: 0.9, tendon: C.fascia, sobre: function (p, t) { return t < 0.8 ? sobreTubo(torso, 0.01)(p) : null; } });
        }
        /* erectores (se ven entre trapecio y dorsal) */
        musculo('Spine', [TP(yPub + 0.04, 172, 0.02, s), TP(yS1, 170, 0.022, s), TP(yS2 + 0.05, 172, 0.02, s)], 0.022, 0.016, { ta: 0.12, tb: 0.05, sobre: sT(0.02) });
        /* esternocleidomastoideo */
        var mast = cuello.punto(1.15, 125 * s, 0.006);
        musculo('Neck', [mast, cuello.punto(0.55, 50 * s, 0.008), V3(s * 0.018, yEsternon + 0.01, TP(yEsternon + 0.01, 8, 0.008, s).z)], 0.011, 0.008, { ta: 0.04, tb: 0.16, sobre: function (p) { var c = cuello.coords(p); return c[0] > 0.05 ? sobreTubo(cuello, 0.007)(p) : null; } });
        /* escalenos */
        musculo('Neck', [cuello.punto(0.85, 95 * s, 0.01), cuello.punto(0.2, 110 * s, 0.012)], 0.011, 0.008, { ta: 0.05, tb: 0.1, sobre: sobreTubo(cuello, 0.01) });
      });
      /* suelo pélvico y origen de los aductores (cubre el pubis) */
      (function () {
        var zP = torso.punto(yT(yPub), 0, 0.03).z;
        cubeta('musculos', 'Hips').agregar(esfera(V3(0, yPub - 0.022, zP - 0.06), [0.04, 0.026, 0.036], null, null, 20, 14), function (u, v) { return mezclaC(C.prof, C.mus3, 0.3 + 0.2 * Math.sin(u * 50)); });
      })();
      /* línea alba / vaina (fascia blanca entre cuadritos) */
      musculo('Spine1', [TP(yXif + 0.01, 0, 0.018), TP(yS, 0, 0.018), TP(yPub, 0, 0.017)], 0.045, 0.004, { ta: 0, tb: 0, col: C.fascia, tendon: C.fascia, forma: 'plano', sobre: sT(0.018) });

      /* ===== esqueleto ===== */
      var HUE = function (hueso) { return cubeta('esqueleto', hueso); };
      function largoHueso(hueso, a, b, r, op) {
        op = op || {};
        var pts = curva(op.medio ? [a, op.medio, b] : [a, b], clamp(Math.round(a.distanceTo(b) / 0.006), 8, 40));
        var refs = pts.map(function () { return op.ref || V3(0, 0, 1); });
        var e0 = op.e0 == null ? 1.8 : op.e0, e1 = op.e1 == null ? 1.7 : op.e1;
        var g = barrido(pts, function (t) {
          var k = 1 + (e0 - 1) * Math.exp(-Math.pow(t / 0.09, 2)) + (e1 - 1) * Math.exp(-Math.pow((1 - t) / 0.09, 2));
          var cierre = Math.min(t, 1 - t) < 0.025 ? 0.4 + 0.6 * Math.sqrt(Math.min(t, 1 - t) / 0.025) : 1;
          var rr = r * k * cierre * (op.plano ? 1 : 1);
          return [rr * (op.ancho || 1), rr];
        }, refs, op.nR || 12);
        HUE(hueso).agregar(g, op.color || function (u, v) { return mezclaC(C.hueso, C.hueso2, 0.5 + 0.5 * Math.sin(v * 40 + u * 6) * 0.3); });
      }
      function bola(hueso, c, rad, quat, color, disp, ws, hs) { HUE(hueso).agregar(esfera(c, rad, quat, disp, ws, hs), color || C.hueso); }
      var tubito = function (hueso, ctrl, r, color, nR) {
        var pts = curva(ctrl, clamp(Math.round(largo(curva(ctrl, 20)) / 0.005), 6, 50));
        var refs = pts.map(function (p) { return V3(0, 0, 1); });
        var rr = typeof r === 'function' ? r : function () { return [r, r]; };
        HUE(hueso).agregar(barrido(pts, rr, refs, nR || 8), color || C.hueso);
      };

      /* columna */
      var zSp = function (y) {
        var c = torso.coords(V3(0, y, 0));
        var atras = torso.punto(c[0], 180, 0).z;
        var prof = y < yS1 ? 0.075 : y < yA ? 0.085 : 0.06;
        return atras + prof;
      };
      var nVert = 24;
      var yL5 = yH + 0.012, yC1 = (J.LeftEye ? (J.LeftEye.y + J.RightEye.y) / 2 : J.Head.y + 0.06) - 0.06;
      var pesos = [], sumaP = 0;
      for (var v = 0; v < nVert; v++) { var pw = v < 5 ? 1.35 : v < 17 ? lerp(1.1, 0.85, (v - 5) / 11) : 0.72; pesos.push(pw); sumaP += pw; }
      var yVert = [yL5], acum = 0;
      for (var v2 = 0; v2 < nVert; v2++) { acum += pesos[v2]; yVert.push(lerp(yL5, yC1, acum / sumaP)); }
      var zCol = function (y) { return y > yN - 0.02 ? lerp(zSp(yN - 0.02), J.Head.z - 0.03, clamp((y - (yN - 0.02)) / (yC1 - yN + 0.02), 0, 1)) : zSp(y); };
      var colPts = yVert.map(function (y) { return V3(0, y, zCol(y)); });
      var colC = new T.CatmullRomCurve3(colPts);
      var vMid = [];
      for (var vv = 0; vv < nVert; vv++) {
        var p0 = colPts[vv], p1 = colPts[vv + 1], mid = p0.clone().lerp(p1, 0.5);
        vMid.push(mid);
        var dir = p1.clone().sub(p0).normalize();
        var tipo = vv < 5 ? 'L' : vv < 17 ? 'T' : 'C';
        var r0 = tipo === 'L' ? 0.02 : tipo === 'T' ? lerp(0.017, 0.012, (vv - 5) / 12) : 0.0095;
        var hu = mid.y < yS ? 'Hips' : mid.y < yS1 ? 'Spine' : mid.y < yS2 ? 'Spine1' : mid.y < yN ? 'Spine2' : 'Neck';
        var q = quatDe(dir, V3(0, 0, 1));
        var alto = p0.distanceTo(p1);
        /* cuerpo vertebral */
        bola(hu, mid, [r0, alto * 0.36, r0 * 0.82], q, C.hueso);
        /* disco */
        bola(hu, p1, [r0 * 0.92, alto * 0.12, r0 * 0.75], q, C.disco);
        /* arco y apófisis espinosa */
        var atras = V3(0, 0, -1);
        var esp = tipo === 'L' ? 0.032 : tipo === 'T' ? 0.036 : 0.02;
        var baja = tipo === 'T' ? -0.022 : -0.006;
        tubito(hu, [mid.clone().addScaledVector(atras, r0 * 0.8), mid.clone().addScaledVector(atras, r0 + esp).add(V3(0, baja, 0))], function (t) { return [0.0035 + 0.003 * (1 - t), 0.006 * (1 - t * 0.5)]; }, C.hueso, 6);
        /* apófisis transversas */
        var tr = tipo === 'L' ? 0.032 : tipo === 'T' ? 0.026 : 0.018;
        [1, -1].forEach(function (s) {
          tubito(hu, [mid.clone().addScaledVector(atras, r0 * 0.9), mid.clone().addScaledVector(atras, r0 * 1.2).add(V3(s * tr, 0.002, 0))], function (t) { return [0.0035, 0.0035 + 0.0015 * t]; }, C.hueso, 6);
        });
      }
      /* sacro y cóccix */
      var pSac = colPts[0].clone();
      tubito('Hips', [pSac.clone().add(V3(0, 0.0, 0.005)), pSac.clone().add(V3(0, -0.05, -0.015)), pSac.clone().add(V3(0, -0.095, -0.0))], function (t) { return [0.045 * (1 - t * 0.78), 0.014 * (1 - t * 0.5)]; }, C.hueso, 14);

      /* costillas */
      var zcC = function (y) { var c = torso.coords(V3(0, y, 0)); return (torso.punto(c[0], 0, 0).z + torso.punto(c[0], 180, 0).z) / 2; };
      var yManu = yEsternon - 0.012, yFinEst = yXif + 0.015;
      var puntaCart = [];
      for (var ri = 0; ri < 12; ri++) {
        var vRef = vMid[16 - ri];
        var yb = vRef.y;
        var yPunta = ri < 7 ? lerp(yManu, yFinEst, ri / 6) - 0.01 - ri * 0.003 : ri < 10 ? yFinEst - 0.03 - (ri - 6) * 0.032 : yb - 0.085;
        var bajar = Math.max(0.02, yb - yPunta);
        var ancho = Math.min(torso.radio(yT(yb - bajar * 0.5), 90), torso.radio(yT(yb - bajar * 0.5), -90));
        var a = Math.max(0.05, ancho - (ri < 2 ? 0.035 : 0.03)) * (ri === 0 ? 0.6 : ri === 1 ? 0.85 : 1);
        var zfront = torso.punto(yT(yb - bajar), 0, 0.03).z, zback = vRef.z - 0.012;
        var zc = (zfront + zback) / 2 + 0.005, bF = zfront - zc, bB = zc - zback;
        var fin = ri < 7 ? 72 : ri < 10 ? 55 : ri === 10 ? 0 : -25;
        [1, -1].forEach(function (s) {
          var pts = [];
          for (var k = 0; k <= 26; k++) {
            var ang = lerp(-82, fin, k / 26) * Math.PI / 180;
            var tt = k / 26;
            var x = s * a * Math.cos(ang) * (ang < -0.9 ? 0.92 : 1);
            var z = zc + Math.sin(ang) * (ang < 0 ? bB : bF);
            var y = yb - bajar * Math.pow(tt, 1.2) + 0.012 * Math.sin(Math.PI * tt);
            pts.push(V3(x, y, z));
          }
          pts[0] = V3(s * 0.016, yb + 0.004, zback + 0.012);
          var hb = yb > yS2 ? 'Spine2' : 'Spine1';
          var refs = pts.map(function (p) { return V3(p.x, 0, p.z - zc); });
          HUE(hb).agregar(barrido(pts, function (t) { return [0.0105 * (ri < 2 ? 0.9 : 1) * (t < 0.04 ? 0.7 : 1), 0.0042]; }, refs, 8), function (u, v) { return mezclaC(C.hueso, C.hueso2, 0.25 + 0.25 * Math.sin(v * 9)); });
          if (s > 0) puntaCart.push(pts[pts.length - 1]);
        });
      }
      /* esternón */
      var zEst = function (y) { return torso.punto(yT(y), 0, 0.028).z; };
      tubito('Spine2', [V3(0, yManu, zEst(yManu)), V3(0, lerp(yManu, yFinEst, 0.5), zEst(lerp(yManu, yFinEst, 0.5)) + 0.004), V3(0, yFinEst, zEst(yFinEst))], function (t) { return [0.019 * (t < 0.2 ? 1.3 - t : 1) * (t > 0.9 ? 1 - (t - 0.9) * 6 : 1), 0.0055]; }, C.hueso, 12);
      /* cartílagos costales */
      for (var ci = 0; ci < 10; ci++) {
        var tip = puntaCart[ci];
        [1, -1].forEach(function (s) {
          var a0 = V3(s * Math.abs(tip.x), tip.y, tip.z);
          var yEnd = ci < 7 ? lerp(yManu, yFinEst, ci / 6) - 0.004 : yFinEst - 0.008 - (ci - 7) * 0.014;
          var b0 = ci < 7 ? V3(s * 0.016, yEnd, zEst(yEnd) - 0.002) : V3(s * (0.03 + (ci - 7) * 0.012), yEnd, zEst(yEnd) - 0.004);
          var m0 = a0.clone().lerp(b0, 0.5); m0.y = Math.min(a0.y, b0.y) - 0.006 * (ci > 3 ? 2 : 1); m0.z += 0.006;
          tubito(ci < 4 ? 'Spine2' : 'Spine1', [a0, m0, b0], function () { return [0.0062, 0.0036]; }, C.cart, 8);
        });
      }
      /* clavículas y escápulas */
      [1, -1].forEach(function (s) {
        var L = s > 0 ? 'Left' : 'Right';
        var ac = V3(s * 0.138, yA + 0.01, torso.A.z - 0.012);
        var est = V3(s * 0.02, yManu + 0.004, zEst(yManu) - 0.006);
        var mc = TP(yA + 0.012, 30, 0.014, s); mc.x = s * 0.07;
        tubito(L + 'Shoulder', [est, mc, ac], function (t) { return [0.0068 * (1 + 0.35 * Math.exp(-t * 8) + 0.3 * Math.exp(-(1 - t) * 8)), 0.0058]; }, C.hueso, 10);
        var zEsc = torso.punto(yT(yA - 0.06), 150 * s, 0.03).z;
        var sup = V3(s * 0.055, yA + 0.025, zEsc + 0.005), inf = V3(s * 0.085, yA - 0.155, zEsc + 0.004), lat = V3(s * 0.135, yA - 0.02, zEsc + 0.03);
        var g = lamina([sup, sup.clone().lerp(inf, 0.5).add(V3(-s * 0.004, 0, -0.002)), inf], [lat, lat.clone().lerp(inf, 0.55).add(V3(s * 0.01, 0, -0.008)), inf], 10, 6);
        HUE('Spine2').agregar(g, C.hueso2);
        tubito('Spine2', [V3(s * 0.06, yA - 0.012, zEsc - 0.006), V3(s * 0.11, yA + 0.012, zEsc - 0.004), ac.clone().add(V3(0, 0, -0.02))], function (t) { return [0.005, 0.009 * (0.6 + t * 0.6)]; }, C.hueso, 8);
        bola('Spine2', lat.clone().add(V3(s * 0.004, 0.002, 0.004)), [0.012, 0.018, 0.012], null, C.cart);
        /* manguito rotador, redondos y romboides (cubren la escápula) */
        var hum = J[L + 'Arm'], brz = miembros[L].brazo;
        var fuera = function (p) { return p.clone().sub(V3(0, p.y, torso.A.z)); };
        var espM = V3(s * 0.058, yA - 0.014, zEsc - 0.004);
        for (var ki = 0; ki < 5; ki++) {
          var om = espM.clone().lerp(inf, (ki + 0.6) / 5.2).add(V3(s * 0.004, 0, -0.004));
          var ml = om.clone().lerp(lat, 0.55).add(V3(0, 0, -0.012));
          musculo('Spine2', [om, ml, hum.clone().add(V3(-s * 0.004, -0.012 - ki * 0.004, -0.024))], 0.019, 0.0075, { ta: 0.03, tb: 0.15, forma: 'plano', tendonAncho: 0.6, ref: fuera, sobre: function (p, t) { return t < 0.75 ? sobreTubo(torso, 0.012)(p) : null; } }); // infraespinoso
        }
        musculo('Spine2', [V3(s * 0.062, yA + 0.01, zEsc - 0.002), V3(s * 0.1, yA + 0.022, zEsc + 0.006), hum.clone().add(V3(0, 0.016, -0.006))], 0.014, 0.008, { ta: 0.04, tb: 0.2, ref: fuera, sobre: function (p, t) { return t < 0.6 ? sobreTubo(torso, 0.012)(p) : null; } }); // supraespinoso
        musculo('Spine2', [inf.clone().add(V3(0, 0.008, -0.006)), inf.clone().lerp(lat, 0.5).add(V3(s * 0.01, -0.02, -0.01)), brz.punto(0.16, -150, 0.012)], 0.017, 0.012, { ta: 0.04, tb: 0.18, ref: fuera }); // redondo mayor
        musculo('Spine2', [lat.clone().lerp(inf, 0.35).add(V3(0, 0, -0.012)), hum.clone().add(V3(s * 0.004, -0.03, -0.025))], 0.011, 0.007, { ta: 0.04, tb: 0.2, ref: fuera }); // redondo menor
        for (var ro = 0; ro < 3; ro++) {
          var vS = vMid[15 - ro * 2];
          musculo('Spine2', [V3(s * 0.006, vS.y + 0.004, vS.z - 0.03), espM.clone().lerp(inf, 0.1 + ro * 0.38).add(V3(0, 0, -0.008))], 0.022, 0.006, { ta: 0.08, tb: 0.06, forma: 'plano', tendon: C.fascia, ref: fuera, sobre: sobreTubo(torso, 0.012) }); // romboides
        }
      });
      /* pelvis */
      [1, -1].forEach(function (s) {
        var L = s > 0 ? 'Left' : 'Right';
        var acet = J[L + 'UpLeg'].clone().add(V3(-s * 0.008, 0.008, 0));
        var anchoP = torso.radio(yT(yH + 0.05), 90 * s) - 0.02;
        var psis = V3(s * 0.045, yH + 0.05, zSp(yH) - 0.012), cresta = V3(s * anchoP, yH + 0.055, torso.A.z - 0.01), asis = V3(s * (anchoP - 0.025), yH + 0.012, torso.punto(yT(yH), 40 * s, 0.035).z);
        var crest = [psis, V3(s * (anchoP - 0.035), yH + 0.065, psis.z + 0.035), cresta, V3(s * (anchoP - 0.004), yH + 0.042, cresta.z + 0.04), asis];
        var base = [V3(s * 0.03, yH - 0.015, psis.z + 0.01), V3(s * 0.055, yH - 0.03, psis.z + 0.04), acet.clone().add(V3(-s * 0.015, 0.02, -0.02)), acet.clone().add(V3(0, 0.02, 0.005)), acet.clone().add(V3(-s * 0.005, 0.015, 0.025))];
        HUE('Hips').agregar(lamina(crest, base, 14, 6), function (u, v) { return mezclaC(C.hueso, C.hueso2, v * 0.6); });
        tubito('Hips', crest, function () { return [0.007, 0.006]; }, C.hueso, 8);
        var sinf = V3(s * 0.013, yPub - 0.002, torso.punto(yT(yPub), 0, 0.03).z);
        var isq = acet.clone().add(V3(-s * 0.028, -0.05, -0.05));
        tubito('Hips', [acet.clone().add(V3(-s * 0.01, 0.012, 0.018)), acet.clone().lerp(sinf, 0.5).add(V3(0, 0.012, 0.01)), sinf], function () { return [0.0075, 0.0075]; }, C.hueso, 8);
        tubito('Hips', [sinf, sinf.clone().add(V3(s * 0.014, -0.03, -0.03)), isq], function () { return [0.0065, 0.0075]; }, C.hueso, 8);
        tubito('Hips', [isq, acet.clone().add(V3(-s * 0.02, -0.02, -0.025)), acet.clone().add(V3(-s * 0.012, 0.01, -0.02))], function (t) { return [0.011 - t * 0.003, 0.009]; }, C.hueso, 8);
        bola('Hips', isq, [0.012, 0.014, 0.013], null, C.hueso);
        /* acetábulo */
        var aro = new T.TorusGeometry(0.026, 0.0055, 8, 24, Math.PI * 1.5); aro.rotateZ(Math.PI * 0.25); aro.rotateY(s * Math.PI * 0.5 - s * 0.35); aro.translate(acet.x - s * 0.006, acet.y + 0.002, acet.z);
        HUE('Hips').agregar(aro, C.hueso2);
      });

      /* huesos largos de brazos y piernas, manos y pies */
      [1, -1].forEach(function (s) {
        var L = s > 0 ? 'Left' : 'Right', m = miembros[L];
        var br = m.brazo, an = m.ante, mu = m.muslo, pi = m.pierna;
        /* húmero */
        bola(L + 'Arm', J[L + 'Arm'].clone().add(V3(-s * 0.004, 0.004, 0)), [0.021, 0.022, 0.021], null, C.hueso);
        largoHueso(L + 'Arm', br.eje(0.04), br.eje(0.97), 0.0085, { e0: 1.6, e1: 2.1, ancho: 1.0 });
        bola(L + 'Arm', br.eje(1.0).addScaledVector(br.la, 0.02), [0.008, 0.009, 0.008], null, C.hueso);
        bola(L + 'Arm', br.eje(1.0).addScaledVector(br.la, -0.022), [0.009, 0.009, 0.009], null, C.hueso);
        /* radio y cúbito */
        var codo = br.eje(1.0);
        largoHueso(L + 'ForeArm', codo.clone().addScaledVector(an.fr, -0.012).addScaledVector(an.la, -0.012).add(V3(0, 0.025, 0)), an.eje(0.97).addScaledVector(an.la, -0.011), 0.0058, { e0: 2.0, e1: 1.5 });
        largoHueso(L + 'ForeArm', codo.clone().addScaledVector(an.la, 0.013), an.eje(0.98).addScaledVector(an.la, 0.012), 0.0062, { e0: 1.4, e1: 2.0 });
        /* fémur */
        var cab = J[L + 'UpLeg'].clone();
        bola(L + 'UpLeg', cab, [0.02, 0.02, 0.02], null, C.hueso);
        var troc = cab.clone().addScaledVector(mu.la, 0.05).add(V3(0, -0.012, 0));
        tubito(L + 'UpLeg', [cab, cab.clone().lerp(troc, 0.55).add(V3(0, -0.012, 0)), troc.clone().add(V3(0, -0.02, 0))], function () { return [0.011, 0.011]; }, C.hueso, 10);
        bola(L + 'UpLeg', troc.clone().add(V3(0, 0.006, -0.004)), [0.016, 0.022, 0.017], null, C.hueso);
        largoHueso(L + 'UpLeg', troc.clone().add(V3(0, -0.02, 0)), mu.eje(0.97), 0.0125, { e0: 1.3, e1: 2.3, medio: troc.clone().lerp(mu.eje(0.97), 0.5).addScaledVector(mu.fr, 0.008) });
        bola(L + 'Leg', mu.eje(1.0).add(V3(0, 0.0, 0)).addScaledVector(mu.fr, 0.034), [0.019, 0.022, 0.009], null, C.hueso); // rótula
        /* tibia y peroné */
        largoHueso(L + 'Leg', pi.eje(0.02).addScaledVector(pi.la, -0.003), pi.eje(0.95).addScaledVector(pi.la, -0.004), 0.0115, { e0: 2.6, e1: 1.6 });
        largoHueso(L + 'Leg', pi.eje(0.07).addScaledVector(pi.la, 0.03).addScaledVector(pi.fr, -0.008), pi.eje(1.0).addScaledVector(pi.la, 0.022), 0.0052, { e0: 1.7, e1: 1.9 });
        /* pie */
        var tob = J[L + 'Foot'], dedo = J[L + 'ToeBase'], punta = J[L + 'Toe_End'] || dedo.clone().add(V3(0, 0, 0.06));
        var adel = dedo.clone().sub(tob); adel.y = 0; adel.normalize();
        var lat = new T.Vector3().crossVectors(V3(0, 1, 0), adel).multiplyScalar(-s).normalize();
        var suelo = Math.min(dedo.y, punta.y);
        bola(L + 'Foot', tob.clone().add(V3(0, -0.028, 0)).addScaledVector(adel, 0.004), [0.018, 0.016, 0.022], quatDe(V3(0, 1, 0), adel), C.hueso); // astrágalo
        bola(L + 'Foot', tob.clone().add(V3(0, -0.06, 0)).addScaledVector(adel, -0.03), [0.017, 0.022, 0.036], quatDe(V3(0, 1, 0), adel), C.hueso); // calcáneo
        bola(L + 'Foot', tob.clone().lerp(dedo, 0.38).add(V3(0, -0.03, 0)), [0.026, 0.014, 0.022], quatDe(V3(0, 1, 0), adel), C.hueso2); // tarso
        for (var dd = 0; dd < 5; dd++) {
          var off = (dd - 1.2) * 0.012 * s;
          var desde = tob.clone().lerp(dedo, 0.52).addScaledVector(lat, off * s * 0.6).add(V3(0, -0.028 + dd * 0.002, 0));
          var hasta = dedo.clone().addScaledVector(lat, off * s * 1.15).add(V3(0, Math.max(suelo + 0.01, dedo.y - 0.006) - dedo.y, 0));
          largoHueso(L + 'Foot', desde, hasta, dd === 0 ? 0.0055 : 0.0038, { e0: 1.5, e1: 1.6, nR: 8 });
          var fin2 = hasta.clone().addScaledVector(adel, dd === 0 ? 0.042 : 0.03 - dd * 0.003).add(V3(0, -0.002, 0));
          largoHueso(L + 'ToeBase', hasta, fin2, dd === 0 ? 0.0048 : 0.003, { e0: 1.4, e1: 1.3, nR: 7 });
        }
        /* mano */
        var mano = J[L + 'Hand'];
        bola(L + 'Hand', mano.clone().lerp(J[L + 'HandMiddle1'], 0.18), [0.016, 0.011, 0.008], quatDe(J[L + 'HandMiddle1'].clone().sub(mano), V3(0, 0, 1)), C.hueso2);
        ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach(function (d) {
          var j1 = J[L + 'Hand' + d + '1'], j2 = J[L + 'Hand' + d + '2'], j3 = J[L + 'Hand' + d + '3'], j4 = J[L + 'Hand' + d + '4'];
          if (!j1) return;
          var r = d === 'Thumb' ? 0.0046 : d === 'Pinky' ? 0.0032 : 0.0038;
          var base = d === 'Thumb' ? mano.clone().lerp(j1, 0.4) : mano.clone().lerp(j1, 0.3);
          largoHueso(L + 'Hand', base, j1, r, { e0: 1.4, e1: 1.6, nR: 7 });
          largoHueso(L + 'Hand' + d + '1', j1, j2, r * 0.95, { e0: 1.4, e1: 1.4, nR: 7 });
          if (j3) largoHueso(L + 'Hand' + d + '2', j2, j3, r * 0.85, { e0: 1.3, e1: 1.3, nR: 7 });
          if (j3 && j4) largoHueso(L + 'Hand' + d + '3', j3, j3.clone().lerp(j4, 0.85), r * 0.75, { e0: 1.3, e1: 1.1, nR: 7 });
        });
      });

      /* cráneo */
      var ojoI = J.LeftEye || J.Head.clone().add(V3(0.03, 0.06, 0.09)), ojoD = J.RightEye || J.Head.clone().add(V3(-0.03, 0.06, 0.09));
      var cima = J.HeadTop_End || J.Head.clone().add(V3(0, 0.17, 0));
      var ojos = ojoI.clone().add(ojoD).multiplyScalar(0.5);
      var kc = clamp(ojoI.distanceTo(ojoD) / 0.063, 0.85, 1.15);
      var cabT = new Tubo(J.Head.clone(), cima.clone(), null, 20, 24, -0.25, 1.15).llenar(vert, dueno, ['Head', 'HeadTop_End', 'LeftEye', 'RightEye']);
      var frenteZ = cabT.punto(clamp((ojos.y + 0.03 - J.Head.y) / cabT.L, 0, 1), 0, 0.012).z;
      var rx = 0.07 * kc, ry = 0.082 * kc, rz = 0.094 * kc;
      var cranC = V3(0, ojos.y + 0.03 * kc, frenteZ - rz + 0.004);
      var radC = [rx, ry, rz];
      bola('Head', cranC, radC, null, C.hueso, function (x, y, z) {
        var d = 0;
        if (z > 0.55 && y < 0.25) d -= 0.22 * (z - 0.55) * (0.25 - y); /* frente vertical */
        if (y < -0.25 && z > -0.2) d -= 0.5 * (-0.25 - y) * (0.6 + z * 0.5); /* base anterior */
        if (y < -0.55) d -= 0.4 * (-0.55 - y);
        if (Math.abs(x) > 0.7 && y < 0.2 && y > -0.6 && z > -0.5) d -= 0.07 * (Math.abs(x) - 0.7) / 0.3; /* fosa temporal */
        return d;
      }, 40, 32);
      var sobreCraneo = function (off) {
        return function (p) {
          var d = p.clone().sub(cranC); var e = V3(d.x / rx, d.y / ry, d.z / rz).normalize();
          var q = cranC.clone().add(V3(e.x * rx, e.y * ry, e.z * rz));
          var n = V3(e.x / rx, e.y / ry, e.z / rz).normalize();
          return { p: q.addScaledVector(n, off), n: n };
        };
      };
      var zFr = frenteZ - 0.004;
      var yNar = ojos.y - 0.034 * kc, yDi = ojos.y - 0.064 * kc, yMen = ojos.y - 0.112 * kc;
      /* maxilar */
      bola('Head', V3(0, ojos.y - 0.046 * kc, zFr - 0.03), [0.032 * kc, 0.03 * kc, 0.03], null, C.hueso, function (x, y, z) { return z < -0.3 ? -0.25 : 0; });
      [1, -1].forEach(function (s) {
        var o = s > 0 ? ojoI : ojoD;
        var oc = V3(o.x, o.y, zFr - 0.004);
        /* reborde orbitario y cuenca */
        var aro = new T.TorusGeometry(0.0172 * kc, 0.003, 8, 28);
        aro.applyMatrix4(new T.Matrix4().makeScale(1.05, 0.92, 1)); aro.translate(oc.x, oc.y, oc.z - 0.004);
        HUE('Head').agregar(aro, C.hueso);
        bola('Head', oc.clone().add(V3(0, 0, -0.017)), [0.0165 * kc, 0.015 * kc, 0.011], null, C.cuenca);
        tubito('Head', [V3(s * 0.006, o.y + 0.02, zFr - 0.004), V3(o.x, o.y + 0.021, zFr - 0.006), V3(o.x + s * 0.019, o.y + 0.012, zFr - 0.016)], function () { return [0.0055, 0.004]; }, C.hueso, 8);
        /* pómulo y arco cigomático */
        bola('Head', V3(o.x + s * 0.013, o.y - 0.026 * kc, zFr - 0.014), [0.016, 0.012, 0.018], null, C.hueso);
        tubito('Head', [V3(o.x + s * 0.022, o.y - 0.028 * kc, zFr - 0.024), V3(s * (rx - 0.002), o.y - 0.03 * kc, cranC.z + 0.012), V3(s * (rx - 0.008), o.y - 0.032 * kc, cranC.z - 0.004)], function () { return [0.0042, 0.0034]; }, C.hueso, 8);
        /* apófisis mastoides */
        bola('Head', V3(s * (rx - 0.012), ojos.y - 0.05 * kc, cranC.z - 0.03), [0.008, 0.013, 0.009], null, C.hueso);
      });
      /* abertura nasal y huesos nasales */
      bola('Head', V3(0, yNar, zFr - 0.002), [0.0095 * kc, 0.0135 * kc, 0.006], null, C.cuenca, function (x, y, z) { return y > 0.4 ? -0.35 * (y - 0.4) : 0; });
      tubito('Head', [V3(0, ojos.y - 0.004, zFr - 0.001), V3(0, yNar + 0.012, zFr + 0.006)], function () { return [0.0045, 0.0028]; }, C.hueso, 6);
      /* dientes */
      for (var di = -7; di <= 7; di++) {
        var ang = di / 7 * 1.3, rr = 0.027 * kc;
        var pd = V3(Math.sin(ang) * rr, yDi, zFr - 0.026 + Math.cos(ang) * rr - 0.004);
        var qd = quatDe(V3(0, 1, 0), V3(Math.sin(ang), 0, Math.cos(ang)));
        bola('Head', pd.clone().add(V3(0, 0.0055, 0)), [Math.abs(di) < 3 ? 0.0034 : 0.0042, 0.0056, 0.0032], qd, C.diente, null, 10, 8);
        bola('Head', pd.clone().add(V3(0, -0.0062, -0.0015)), [Math.abs(di) < 3 ? 0.003 : 0.0041, 0.0052, 0.003], qd, C.diente, null, 10, 8);
      }
      /* mandíbula */
      var menton = V3(0, yMen + 0.01, zFr - 0.008);
      [1, -1].forEach(function (s) {
        var angulo = V3(s * 0.047 * kc, yMen + 0.024 * kc, cranC.z + 0.006);
        var condilo = V3(s * 0.052 * kc, ojos.y - 0.034 * kc, cranC.z - 0.006);
        var coron = V3(s * 0.045 * kc, ojos.y - 0.04 * kc, cranC.z + 0.03);
        var rf = function (p) { return V3(p.x * 4, 0, p.z - cranC.z); };
        var cuerpoM = curva([menton, V3(s * 0.024 * kc, yMen + 0.012, zFr - 0.024), angulo], 20);
        HUE('Head').agregar(barrido(cuerpoM, function (t) { return [0.011 - t * 0.002, 0.0055]; }, cuerpoM.map(rf), 8), C.hueso);
        var rama = curva([angulo, angulo.clone().lerp(condilo, 0.5).add(V3(0, 0, 0.006)), condilo], 14);
        HUE('Head').agregar(barrido(rama, function (t) { return [0.011, 0.0042]; }, rama.map(function () { return V3(s, 0, 0); }), 8), C.hueso);
        tubito('Head', [angulo.clone().lerp(condilo, 0.55).add(V3(0, 0, 0.008)), coron], function () { return [0.004, 0.003]; }, C.hueso, 6);
      });
      bola('Head', menton.clone().add(V3(0, 0.002, -0.002)), [0.014, 0.011, 0.008], null, C.hueso);

      /* músculos de la cara y cuello profundo (écorché) */
      [1, -1].forEach(function (s) {
        var o = s > 0 ? ojoI : ojoD;
        var sc = sobreCraneo(0.004);
        for (var f = 0; f < 4; f++) { /* temporal: abanico */
          var a0 = V3(s * rx, cranC.y + lerp(0.035, -0.005, f / 3), cranC.z + lerp(0.05, -0.055, f / 3));
          musculo('Head', [a0, V3(s * rx, ojos.y - 0.006, cranC.z + lerp(0.035, 0.005, f / 3)), V3(s * 0.046 * kc, ojos.y - 0.042 * kc, cranC.z + 0.028)], 0.016, 0.0045, { ta: 0.03, tb: 0.28, forma: 'plano', tendonAncho: 0.6, sobre: function (p, t) { return t < 0.7 ? sc(p) : null; }, ref: function (p) { return V3(s, 0, 0); } });
        }
        musculo('Head', [V3(o.x + s * 0.02, o.y - 0.03 * kc, zFr - 0.026), V3(s * 0.054 * kc, yDi - 0.012, cranC.z + 0.02), V3(s * 0.05 * kc, yMen + 0.026 * kc, cranC.z + 0.01)], 0.014, 0.0075, { ta: 0.12, tb: 0.05, ref: function (p) { return V3(s, 0, 0.3); } }); // masetero
        for (var fr2 = 0; fr2 < 3; fr2++) { var xf = s * lerp(0.008, 0.042, fr2 / 2) * kc; musculo('Head', [V3(xf, o.y + 0.022, zFr), V3(xf * 1.05, o.y + 0.05, zFr - 0.01), V3(xf * 1.1, cranC.y + 0.055, cranC.z + rz * 0.6)], 0.011, 0.0022, { ta: 0.02, tb: 0.35, forma: 'plano', tendonAncho: 0.95, tendon: C.fascia, sobre: sobreCraneo(0.0025) }); } // frontal
        var orb = new T.TorusGeometry(0.0205 * kc, 0.0034, 6, 30); orb.applyMatrix4(new T.Matrix4().makeScale(1.1, 0.92, 0.35)); orb.translate(o.x, o.y - 0.002, zFr - 0.004);
        cubeta('musculos', 'Head').agregar(orb, C.mus); // orbicular del ojo
        musculo('Head', [V3(o.x + s * 0.014, o.y - 0.03 * kc, zFr - 0.008), V3(s * 0.022, yDi - 0.004, zFr + 0.0)], 0.0055, 0.004, { ta: 0.05, tb: 0.08, ref: function () { return V3(0, 0, 1); } }); // cigomático mayor
        musculo('Head', [V3(o.x, o.y - 0.024 * kc, zFr - 0.006), V3(s * 0.012, yDi + 0.006, zFr + 0.002)], 0.007, 0.003, { ta: 0.05, tb: 0.08, forma: 'medio', ref: function () { return V3(0, 0, 1); } }); // elevador del labio
        musculo('Head', [V3(s * 0.02, yDi - 0.006, zFr), V3(s * 0.016, yMen + 0.012, zFr - 0.004)], 0.008, 0.003, { ta: 0.05, tb: 0.08, forma: 'medio', ref: function () { return V3(0, 0, 1); } }); // depresor
      });
      var boca = new T.TorusGeometry(0.018 * kc, 0.0052, 8, 30); boca.applyMatrix4(new T.Matrix4().makeScale(1.25, 0.62, 0.7)); boca.translate(0, yDi, zFr + 0.004);
      cubeta('musculos', 'Head').agregar(boca, C.mus2); // orbicular de la boca
      cubeta('musculos', 'Head').agregar(esfera(V3(0, yMen + 0.008, zFr - 0.006), [0.012, 0.008, 0.006], null, null, 16, 12), C.mus3); // mentoniano
      /* masa muscular profunda del cuello */
      (function () {
        var pts = curva([V3(0, yA + 0.01, cuello.A.z), V3(0, yN + 0.04, J.Neck.z), V3(0, ojos.y - 0.07 * kc, cranC.z - 0.03)], 24);
        var g = barrido(pts, function (t) { var tt = clamp(t, 0.02, 0.98); return [Math.max(0.02, cuello.radio(tt * 0.95, 90) - 0.011), Math.max(0.02, (cuello.radio(tt * 0.95, 0) + cuello.radio(tt * 0.95, 180)) / 2 - 0.013)]; }, pts.map(function () { return V3(0, 0, 1); }), 18);
        cubeta('musculos', 'Neck').agregar(g, function (u, v) { return mezclaC(C.prof, C.mus3, 0.35 + 0.25 * Math.sin(u * 40)); });
      })();

      /* ===== órganos ===== */
      var org = function (id, hueso, geo, hex, op) {
        op = op || {};
        var mat = new T.MeshStandardMaterial({ color: new T.Color(hex), roughness: op.rug == null ? 0.42 : op.rug, metalness: 0, transparent: true, vertexColors: !!op.vc });
        if (op.fibras) fibras(mat, op.fibras);
        if (op.neuronas) {
          mat.onBeforeCompile = function (sh) {
            sh.uniforms.uT = uT; sh.uniforms.uAct = uAct; sh.uniforms.uFr = uFr; sh.uniforms.uZf = uZf;
            sh.vertexShader = 'varying vec3 vPB;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPB = position;');
            sh.fragmentShader = 'uniform float uT; uniform float uAct; uniform float uFr; uniform float uZf; varying vec3 vPB;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
              '#include <emissivemap_fragment>\n' +
              '  float n1 = sin(dot(vPB, vec3(91.0, 57.0, 73.0)) + uT * 3.1) * sin(dot(vPB, vec3(-63.0, 88.0, 41.0)) - uT * 2.3);\n' +
              '  float chispa = smoothstep(0.8, 1.0, n1);\n' +
              '  float ola = smoothstep(0.04, 0.0, abs(fract(vPB.z * 9.0 + vPB.y * 4.0 - uT * 0.5) - 0.5));\n' +
              '  float frente = smoothstep(uZf - 0.01, uZf + 0.045, vPB.z);\n' +
              '  totalEmissiveRadiance += vec3(0.62, 0.52, 1.0) * (chispa * 1.3 + ola * 0.35) * uAct;\n' +
              '  totalEmissiveRadiance += vec3(0.95, 0.62, 0.25) * frente * uFr * (0.35 + 0.25 * sin(uT * 3.0));');
          };
          mat.customProgramCacheKey = function () { return 'neuronas'; };
          (api._cerebro || (api._cerebro = [])).push(mat);
        }
        var m = new T.Mesh(geo, mat); m.renderOrder = 2;
        var brillo = new T.Mesh(geo, matBrillo(op.brillo || '#7FA8FF')); brillo.renderOrder = 20; brillo.visible = false;
        escena.add(m); escena.add(brillo);
        B[hueso].attach(m); B[hueso].attach(brillo);
        var o = organos[id] || (organos[id] = { mallas: [], brillos: [] });
        o.mallas.push(m); o.brillos.push(brillo);
        return m;
      };
      var ruido = function (x, y, z, f) { return Math.sin(x * f + 1.3) * Math.sin(y * f * 1.1 + 0.7) * Math.sin(z * f * 0.9 + 2.1); };
      /* cerebro: dos hemisferios con circunvoluciones, cerebelo y tronco, con actividad neuronal */
      var cerC = cranC.clone().add(V3(0, -0.008, -0.004));
      uZf.value = cerC.z + 0.035;
      var bx = rx - 0.008, by = ry - 0.013, bz = rz - 0.01;
      var surcos = function (x, y, z) {
        var a = Math.sin(x * 19 + 2.2 * Math.sin(y * 11 + z * 7));
        var b = Math.sin(y * 17 + 2.0 * Math.sin(z * 13 + x * 5));
        var c = Math.sin(z * 21 + 1.8 * Math.sin(x * 9 + y * 6));
        return Math.pow(Math.min(1, Math.abs(a + b + c) / 3 * 1.7), 0.55);
      };
      var colCer = function (g, c, rad, fn) {
        var P = g.attributes.position, cs = [], d = new T.Vector3();
        var claro = col('#EBB8B6'), oscuro = col('#8E525B');
        for (var k = 0; k < P.count; k++) {
          d.set((P.getX(k) - c.x) / rad[0], (P.getY(k) - c.y) / rad[1], (P.getZ(k) - c.z) / rad[2]).normalize();
          var q = mezclaC(oscuro, claro, fn(d.x, d.y, d.z)); cs.push(q[0], q[1], q[2]);
        }
        g.setAttribute('color', new T.Float32BufferAttribute(cs, 3));
        return g;
      };
      [1, -1].forEach(function (s) {
        var c = cerC.clone().add(V3(s * bx * 0.47, 0, 0)), rad = [bx * 0.54, by, bz];
        var g = esfera(c, rad, null, function (x, y, z) {
          var d = 0.06 * (surcos(x, y, z) - 0.6);
          if (x * s < -0.5) d -= 0.6 * (-x * s - 0.5);
          if (y < -0.35) d -= 0.4 * (-0.35 - y) * (z > -0.3 ? 1 : 0.35);
          var syl = Math.abs(y + 0.1 - z * 0.45);
          if (x * s > 0.25 && z > -0.25 && syl < 0.08) d -= 0.09 * (1 - syl / 0.08);
          if (z < -0.6 && y < -0.25) d -= 0.25;
          return d;
        }, 110, 84);
        org('mente', 'Head', colCer(g, c, rad, surcos), '#FFFFFF', { rug: 0.5, brillo: '#B9A7F5', vc: true, neuronas: true });
      });
      (function () {
        var c = cerC.clone().add(V3(0, -by * 0.66, -bz * 0.58)), rad = [bx * 0.6, by * 0.27, bz * 0.34];
        var fn = function (x, y, z) { return 0.5 + 0.5 * Math.abs(Math.sin(y * 34)); };
        var g = esfera(c, rad, null, function (x, y, z) { var d = 0.045 * Math.abs(Math.sin(y * 34)) - 0.02; if (Math.abs(x) < 0.12) d -= 0.08; return d; }, 64, 48);
        org('mente', 'Head', colCer(g, c, rad, fn), '#FFFFFF', { rug: 0.5, brillo: '#B9A7F5', vc: true, neuronas: true });
      })();
      org('mente', 'Head', (function () { var pts = curva([cerC.clone().add(V3(0, -by * 0.3, -bz * 0.05)), cerC.clone().add(V3(0, -by * 0.8, -bz * 0.2)), V3(0, J.Neck.y + 0.01, zSp(yN) + 0.012)], 16); return barrido(pts, function (t) { return [0.0085 - t * 0.003, 0.0085 - t * 0.003]; }, pts.map(function () { return V3(0, 0, 1); }), 10); })(), '#D7A3A0', { brillo: '#B9A7F5' });
      /* ojos (también en la capa muscular) */
      [ojoI, ojoD].forEach(function (o) {
        var oc = V3(o.x, o.y, zFr - 0.0125);
        var g = esfera(oc, [0.0118, 0.0118, 0.0118], null, null, 20, 16);
        var cOjo = function (u, v, k) { var p = g.attributes.position; var dz = (p.getZ(k) - oc.z) / 0.0118; return dz > 0.93 ? col('#141414') : dz > 0.8 ? col('#4A6A7A') : col('#F2EEE8'); };
        cubeta('musculos', 'Head').agregar(g, cOjo);
        var g2 = g.clone(); var m = new T.Mesh(g2, matOjo.clone()); var c2 = []; for (var k = 0; k < g2.attributes.position.count; k++) { var cc = cOjo(0, 0, k); c2.push(cc[0], cc[1], cc[2]); } g2.setAttribute('color', new T.Float32BufferAttribute(c2, 3));
        m.renderOrder = 2; escena.add(m); B.Head.attach(m); (organos.ojos || (organos.ojos = { mallas: [], brillos: [] })).mallas.push(m);
      });
      /* laringe y tráquea */
      var yLar = yN + 0.03, zTr = cuello.punto(0.3, 0, 0.022).z;
      org('voz', 'Neck', esfera(V3(0, yLar, zTr + 0.004), [0.017, 0.02, 0.014], null, function (x, y, z) { return z > 0.5 && Math.abs(x) < 0.3 ? 0.18 * (1 - Math.abs(x) / 0.3) : 0; }, 24, 18), '#E3CFC0', { brillo: '#B9A7F5' });
      var trq = curva([V3(0, yLar - 0.012, zTr), V3(0, yA, zTr - 0.012), V3(0, yA - 0.07, zcC(yA - 0.07) - 0.01)], 40);
      org('voz', 'Spine2', barrido(trq, function () { return [0.0095, 0.0085]; }, trq.map(function () { return V3(0, 0, 1); }), 14), '#E6D3C6', { brillo: '#B9A7F5', rug: 0.5 });
      var carina = trq[trq.length - 1];
      [1, -1].forEach(function (s) {
        var br = curva([carina, carina.clone().add(V3(s * 0.025, -0.016, -0.004)), carina.clone().add(V3(s * 0.05, -0.04, -0.008))], 16);
        org('oxigeno', 'Spine2', barrido(br, function (t) { return [0.0072 - t * 0.002, 0.0068 - t * 0.002]; }, br.map(function () { return V3(0, 0, 1); }), 10), '#E6D3C6', { brillo: '#8CCBF0' });
      });
      /* pulmones */
      var yPul = yA - 0.1;
      [1, -1].forEach(function (s) {
        var ancho = torso.radio(yT(yPul), 90 * s) - 0.04;
        var c = V3(s * (ancho * 0.52 + 0.012), yPul, zcC(yPul) - 0.005);
        org('oxigeno', 'Spine2', esfera(c, [ancho * 0.52, 0.115, Math.min(0.075, (torso.punto(yT(yPul), 0, 0).z - torso.punto(yT(yPul), 180, 0).z) / 2 - 0.035)], null, function (x, y, z) {
          var d = 0.025 * ruido(x, y, z, 14);
          if (y > 0.4) d -= 0.45 * (y - 0.4) * (1 - 0.5 * Math.max(0, z));
          if (x * s < -0.2) d -= 0.22 * (-x * s - 0.2); /* cara medial */
          if (s > 0 && x < 0 && y < 0.15 && y > -0.75 && z > -0.1) d -= 0.32; /* escotadura cardíaca */
          if (y < -0.6) d -= 0.4 * (-0.6 - y) * (0.5 + 0.5 * z);
          var fis = Math.abs(y + 0.15 - x * s * 0.6 - z * 0.2); if (fis < 0.05) d -= 0.05 * (1 - fis / 0.05);
          return d;
        }, 48, 40), '#CC7A82', { rug: 0.6, brillo: '#8CCBF0', fibras: 0.25 });
      });
      /* corazón y grandes vasos */
      var yCor = yA - 0.125;
      var cCor = V3(0.022, yCor, zcC(yCor) + 0.03);
      var ejeCor = V3(0.55, -0.62, 0.55).normalize();
      var corazon = org('corazon', 'Spine2', esfera(cCor, [0.042, 0.058, 0.04], quatDe(ejeCor, V3(0, 0, 1)), function (x, y, z) {
        var d = 0;
        if (y > 0) d -= 0.25 * y * y; else d += -0.12 * y;
        if (y < -0.5) d -= 0.5 * (-0.5 - y);
        var surco = Math.abs(x + 0.1 * y); if (surco < 0.08 && z > 0) d -= 0.06 * (1 - surco / 0.08);
        return d;
      }, 40, 32), '#A9262E', { rug: 0.38, brillo: '#F49B8E' });
      var aorta = curva([cCor.clone().add(V3(-0.012, 0.035, 0.006)), V3(0.004, yCor + 0.075, cCor.z - 0.004), V3(-0.006, yCor + 0.09, cCor.z - 0.035), V3(-0.012, yCor + 0.07, zSp(yCor) + 0.03), V3(-0.012, yCor - 0.05, zSp(yCor - 0.05) + 0.028), V3(-0.01, yS - 0.03, zSp(yS) + 0.03)], 60);
      org('corazon', 'Spine2', barrido(aorta, function (t) { return [0.0125 - t * 0.003, 0.0125 - t * 0.003]; }, aorta.map(function () { return V3(0, 0, 1); }), 12), '#C9363B', { brillo: '#F49B8E' });
      [[-0.008, 0.11], [0.006, 0.105], [0.016, 0.098]].forEach(function (d) {
        var p0 = V3(d[0] - 0.004, yCor + 0.088, cCor.z - 0.025), r = curva([p0, p0.clone().add(V3(d[0] * 0.8, 0.03, 0.006))], 8);
        org('corazon', 'Spine2', barrido(r, function () { return [0.0045, 0.0045]; }, r.map(function () { return V3(0, 0, 1); }), 8), '#C9363B', { brillo: '#F49B8E' });
      });
      var pulm = curva([cCor.clone().add(V3(0.0, 0.03, 0.022)), V3(0.012, yCor + 0.07, cCor.z + 0.008), V3(0.03, yCor + 0.075, cCor.z - 0.014)], 24);
      org('corazon', 'Spine2', barrido(pulm, function () { return [0.0105, 0.0105]; }, pulm.map(function () { return V3(0, 0, 1); }), 12), '#4E6BB8', { brillo: '#F49B8E' });
      var cava = curva([cCor.clone().add(V3(-0.035, 0.02, -0.01)), V3(-0.03, yCor + 0.11, cCor.z - 0.025)], 12);
      org('corazon', 'Spine2', barrido(cava, function () { return [0.009, 0.009]; }, cava.map(function () { return V3(0, 0, 1); }), 10), '#3E4F96', { brillo: '#F49B8E' });
      api._corazon = corazon;
      /* diafragma (fino) */
      /* hígado */
      var yHig = yXif - 0.035;
      org('comida', 'Spine1', esfera(V3(-0.035, yHig, zcC(yHig) + 0.015), [0.08, 0.045, 0.06], quatDe(V3(-0.3, 1, 0), V3(0, 0, 1)), function (x, y, z) { var d = 0; if (y < 0) d -= 0.5 * y * y; if (x > 0.3) d -= 0.45 * (x - 0.3); if (y > 0.3) d -= 0.2 * (y - 0.3); return d + 0.02 * ruido(x, y, z, 9); }, 40, 30), '#7E2C27', { rug: 0.35, brillo: '#8FD9A8' });
      /* estómago */
      var yEst = yXif - 0.045, zE = zcC(yEst);
      var est = curva([V3(0.012, yEst + 0.06, zE - 0.01), V3(0.05, yEst + 0.035, zE + 0.01), V3(0.07, yEst - 0.01, zE + 0.03), V3(0.045, yEst - 0.05, zE + 0.05), V3(0.0, yEst - 0.045, zE + 0.05), V3(-0.022, yEst - 0.025, zE + 0.035)], 50);
      org('comida', 'Spine1', barrido(est, function (t) { var k = t < 0.15 ? 0.6 + t * 2.7 : t < 0.55 ? 1 : 1 - (t - 0.55) * 1.4; return [0.034 * k, 0.03 * k]; }, est.map(function (p) { return V3(0, 0, 1); }), 16), '#D9958A', { rug: 0.4, brillo: '#8FD9A8', fibras: 0.35 });
      var eso = curva([V3(0, yA - 0.01, zTr - 0.022), V3(-0.004, yA - 0.12, zcC(yA - 0.12) - 0.035), est[0]], 30);
      org('comida', 'Spine2', barrido(eso, function () { return [0.0065, 0.0055]; }, eso.map(function () { return V3(0, 0, 1); }), 8), '#C98579', { brillo: '#8FD9A8' });
      /* intestino grueso (marco) */
      var yIg = yS - 0.005, zI = zcC(yIg) + 0.03;
      var colon = curva([V3(-0.075, yPub + 0.05, zI), V3(-0.085, yIg + 0.04, zI - 0.005), V3(-0.065, yIg + 0.075, zI + 0.02), V3(0.0, yIg + 0.065, zI + 0.04), V3(0.07, yIg + 0.08, zI + 0.015), V3(0.085, yIg + 0.0, zI - 0.005), V3(0.07, yPub + 0.045, zI), V3(0.02, yPub + 0.035, zI + 0.015), V3(0.0, yPub + 0.01, zI - 0.03)], 120);
      org('comida', 'Spine', barrido(colon, function (t) { var k = 1 + 0.16 * Math.sin(t * 150); return [0.016 * k, 0.015 * k]; }, colon.map(function () { return V3(0, 0, 1); }), 14), '#C98676', { brillo: '#8FD9A8' });
      /* intestino delgado (asas) */
      var asas = [];
      for (var ai = 0; ai <= 260; ai++) {
        var u = ai / 260;
        asas.push(V3(0.05 * Math.sin(u * Math.PI * 9) * (0.7 + 0.3 * Math.cos(u * 7)), lerp(yIg + 0.035, yPub + 0.06, u) + 0.012 * Math.sin(u * 61), zI + 0.012 + 0.016 * Math.cos(u * Math.PI * 13)));
      }
      org('comida', 'Spine', barrido(asas, function () { return [0.0105, 0.0105]; }, asas.map(function () { return V3(0, 0, 1); }), 10), '#DDA593', { brillo: '#8FD9A8' });
      /* riñones y vejiga */
      [1, -1].forEach(function (s) {
        var yR = yS1 - 0.02 - (s < 0 ? 0.012 : 0);
        org('comida', 'Spine1', esfera(V3(s * 0.05, yR, zSp(yR) + 0.045), [0.022, 0.036, 0.015], quatDe(V3(-s * 0.2, 1, 0), V3(s * 0.4, 0, 1)), function (x, y, z) { return x * s < -0.5 && Math.abs(y) < 0.4 ? -0.3 : 0; }, 24, 20), '#8E2F2F', { brillo: '#8FD9A8' });
      });
      org('comida', 'Hips', esfera(V3(0, yPub + 0.02, zcC(yPub + 0.02) + 0.035), [0.028, 0.025, 0.024], null, null, 20, 16), '#D9AAA2', { brillo: '#8FD9A8' });

      /* el reloj SAMBOSI en la muñeca izquierda */
      (function () {
        var an = miembros.Left.ante;
        var c = an.punto(0.86, 180, -0.004);
        var n = an.normal(180);
        var q = quatDe(n, an.u);
        var cuerpo = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.008, 32), new T.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.35, metalness: 0.6 }));
        cuerpo.position.copy(c); cuerpo.quaternion.copy(q);
        var pantalla = new T.Mesh(new T.CircleGeometry(0.0165, 32), new T.MeshBasicMaterial({ color: 0x4F7BFF }));
        pantalla.position.set(0, 0.0042, 0); pantalla.rotation.x = -Math.PI / 2; cuerpo.add(pantalla);
        var correa = new T.Mesh(new T.TorusGeometry(an.radio(0.86, 0) + 0.002, 0.003, 8, 40), new T.MeshStandardMaterial({ color: 0x23252c, roughness: 0.7 }));
        correa.position.copy(an.eje(0.86)); correa.quaternion.copy(new T.Quaternion().setFromUnitVectors(V3(0, 0, 1), an.u)); correa.scale.set(1, 1, 3.2);
        escena.add(cuerpo); escena.add(correa);
        B.LeftHand.attach(cuerpo); B.LeftHand.attach(correa);
        api._reloj = pantalla;
        var brillo = new T.Mesh(new T.SphereGeometry(0.03, 16, 12), matBrillo('#E8D36B'));
        brillo.position.copy(c); brillo.visible = false; brillo.renderOrder = 20; escena.add(brillo); B.LeftHand.attach(brillo);
        organos.rad = { mallas: [cuerpo, correa], brillos: [brillo], fijo: true };
      })();

      /* mallas finales por hueso */
      capas.musculos = []; capas.esqueleto = []; capas.organos = [];
      Object.keys(cub).forEach(function (capa) {
        Object.keys(cub[capa]).forEach(function (h) {
          var mat = capa === 'musculos' ? matMus : matHueDoble;
          if (h === 'Head') {
            mat = fibras(mat.clone(), capa === 'musculos' ? 1.0 : 0.12);
            if (capa === 'musculos') mat.clippingPlanes = [plano];
          }
          var m = new T.Mesh(cub[capa][h].geometria(), mat);
          m.renderOrder = capa === 'esqueleto' ? 1 : 3;
          m.frustumCulled = false;
          escena.add(m); B[h].attach(m);
          capas[capa].push(m);
          if (h === 'Head') cabeza.push(m);
        });
      });
      Object.keys(organos).forEach(function (k) { if (organos[k].fijo) return; organos[k].mallas.forEach(function (m) { capas.organos.push(m); }); });

      /* anclas para los puntos (siguen al cuerpo) */
      var ancla = function (id, p, hueso) { var o = new T.Object3D(); o.position.copy(p); escena.add(o); B[hueso].attach(o); anclas[id] = o; };
      ancla('mente', cranC.clone().add(V3(0, ry * 0.55, rz * 0.45)), 'Head');
      ancla('voz', V3(0, yLar, zTr + 0.02), 'Neck');
      ancla('corazon', cCor.clone().add(V3(0.005, 0, 0.03)), 'Spine2');
      ancla('oxigeno', V3(-0.075, yPul + 0.02, zcC(yPul) + 0.07), 'Spine2');
      ancla('temp', miembros.Right.brazo.punto(0.45, 30, -0.004), 'RightArm');
      ancla('comida', V3(0.04, yEst - 0.01, zE + 0.08), 'Spine1');
      ancla('rad', miembros.Left.ante.punto(0.86, 180, -0.012), 'LeftHand');
      ancla('sangre', miembros.Right.ante.punto(0.12, 0, -0.004), 'RightForeArm');   /* pliegue del codo: donde se saca sangre */
      aplicarOpacidad(true);
      aplicarPunto();
    }

    /* ---------- modos, punto elegido ---------- */
    function aplicarOpacidad(forzar) {
      var cer = organos.mente ? organos.mente.mallas : [];
      Object.keys(capas).forEach(function (k) {
        var op0 = opac[k] == null ? 0 : opac[k];
        capas[k].forEach(function (m) {
          var op = op0;
          if (cabeza.indexOf(m) >= 0) op *= opac.cabeza;
          if (cer.indexOf(m) >= 0) op = Math.max(op, opac.cerebro);
          var mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach(function (mt) {
            if (mt === matFantasma) mt.uniforms.uOp.value = op;
            else { mt.opacity = op; mt.depthWrite = op > 0.96; }
          });
          m.visible = op > 0.01;
        });
      });
    }
    var PUNTO_ORGANO = { mente: 'mente', voz: 'voz', oxigeno: 'oxigeno', corazon: 'corazon', comida: 'comida', rad: 'rad', temp: null, sangre: null };
    function aplicarPunto() {
      Object.keys(organos).forEach(function (k) {
        var on = PUNTO_ORGANO[estado.punto] === k;
        organos[k].brillos.forEach(function (b) { b.visible = on; b.material.uniforms.uOp.value = on ? (k === 'mente' ? 0.3 : estado.modo === 'organos' || estado.modo === 'todo' || estado.modo === 'mitad' ? 0.45 : 1) : 0; });
        organos[k].mallas.forEach(function (m) { if (m.material.emissive) { m.material.emissive.set(on && estado.modo === 'organos' ? 0x331111 : 0x000000); } });
      });
      matFantasma.uniforms.uTinte.value.set(estado.punto === 'temp' ? '#FFB36B' : '#9DE7FF');
    }
    api.modo = function (m) { if (!MODOS[m]) return; estado.modo = m; metas(); corteObj = m === 'mitad' ? 0 : 0.7; aplicarPunto(); };
    api.punto = function (p) { estado.punto = p; metas(); aplicarPunto(); };
    api.mente = function (estres) { uFr.value = estres ? 1 : 0; uAct.value = estres ? 1 : 0.6; };
    var foco = null, enFoco = false;
    api.enfocar = function (p) {
      if (!ctl || !listo) return;
      if (p === 'mente' && anclas.mente) { var c = anclas.mente.getWorldPosition(new T.Vector3()); foco = { t: V3(0, c.y - 0.04, c.z * 0.5), d: 1.25 }; enFoco = true; }
      else if (enFoco) { foco = { t: V3(0, 0.95, 0), d: 4.6 }; enFoco = false; }
    };
    api.piel = function (hex) { matPiel.color.set(hex); };
    api.bpm = function (n) { if (n > 20) estado.bpm = n; };
    api.camara = function (az, pol, dist, ty) {
      var tgt = V3(0, ty == null ? 0.95 : ty, 0);
      camara.position.set(tgt.x + dist * Math.sin(pol) * Math.sin(az), tgt.y + dist * Math.cos(pol), tgt.z + dist * Math.sin(pol) * Math.cos(az));
      camara.lookAt(tgt); if (ctl) { ctl.target.copy(tgt); ctl.autoRotate = false; ctl.update(); }
    };

    /* ---------- bucle ---------- */
    var reloj = new T.Clock(), raf = 0, fase = 0;
    var v = new T.Vector3(), q = new T.Vector3();
    var nodos = null;
    function bucle() {
      if (!vivo) return;
      raf = requestAnimationFrame(bucle);
      var dt = Math.min(reloj.getDelta(), 0.05);
      uT.value += dt;
      giro.rotation.z += dt * 0.4;
      var cambio = false;
      Object.keys(objetivo).forEach(function (k) {
        var a = opac[k] == null ? 0 : opac[k], b = objetivo[k];
        if (Math.abs(a - b) > 0.002) { opac[k] = a + (b - a) * Math.min(1, dt * 6); cambio = true; } else if (a !== b) { opac[k] = b; cambio = true; }
      });
      if (cambio) aplicarOpacidad();
      if (Math.abs(plano.constant - corteObj) > 0.0005) plano.constant += (corteObj - plano.constant) * Math.min(1, dt * 3.5);
      if (mezclador) mezclador.update(dt);
      if (api._corazon) {
        fase += dt * estado.bpm / 60;
        var f = fase % 1, k = Math.exp(-Math.pow((f - 0.08) / 0.05, 2)) + 0.55 * Math.exp(-Math.pow((f - 0.3) / 0.06, 2));
        api._corazon.scale.setScalar(1 + 0.045 * k);
      }
      if (api._reloj) api._reloj.material.color.setHSL(0.62, 0.9, 0.55 + 0.1 * Math.sin(uT.value * 2));
      if (foco && ctl) {
        var k2 = Math.min(1, dt * 3);
        ctl.target.lerp(foco.t, k2);
        var dir = camara.position.clone().sub(ctl.target), dd = dir.length();
        var nd = dd + (foco.d - dd) * k2;
        camara.position.copy(ctl.target).addScaledVector(dir.normalize(), nd);
        if (ctl.target.distanceTo(foco.t) < 0.002 && Math.abs(nd - foco.d) < 0.005) foco = null;
      }
      if (ctl) ctl.update();
      renderer.render(escena, camara);
      if (listo) moverPuntos();
    }
    function moverPuntos() {
      if (!nodos || !nodos.length || !nodos[0].isConnected) nodos = stage.querySelectorAll('[data-hs]');
      var w = stage.clientWidth, h = stage.clientHeight, cam = camara.position;
      for (var i = 0; i < nodos.length; i++) {
        var el = nodos[i], a = anclas[el.getAttribute('data-hs')];
        if (!a) continue;
        a.getWorldPosition(v);
        q.set(0, v.y, 0);
        var detras = v.distanceTo(cam) > q.distanceTo(cam) + 0.02;
        var p = v.clone().project(camara);
        el.style.left = ((p.x * 0.5 + 0.5) * w).toFixed(1) + 'px';
        el.style.top = ((-p.y * 0.5 + 0.5) * h).toFixed(1) + 'px';
        el.style.opacity = detras ? '0.3' : '1';
      }
    }
    var ro = new ResizeObserver(function () {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
    });
    ro.observe(stage);
    bucle();
    cargar();

    api.cerrar = function () {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect();
      if (ctl) ctl.dispose();
      escena.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
    };
    api.listo = function () { return listo; };
    api.info = function () { var n = 0, v = 0; escena.traverse(function (o) { if (o.isMesh) { n++; v += o.geometry.attributes.position.count; } }); return { mallas: n, vertices: v, ms: api._ms }; };
    api.render = function () { renderer.render(escena, camara); };
    return api;
  }
  window.SambosiCuerpo = { crear: crear };
})();
