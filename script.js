"use strict";

let canv, gl;
let animState;
let maxx, maxy
let midx, midy;

let widthHandle, heightHandle;
let pHandle, f;
let casergbHandle;
let aeq1Handle, beq1Handle, aeq2Handle, beq2Handle;

let p =[]

const ORDER = 36;

const mrandom =  Math.random;
const mfloor = Math.floor;
const mround = Math.round;
const mceil = Math.ceil;
const mabs = Math.abs;
const mmin = Math.min;
const mmax = Math.max;

const mPI = Math.PI;
const mPIS2 = Math.PI / 2;
const m2PI = Math.PI * 2;
const msin = Math.sin;
const mcos = Math.cos;
const matan2 = Math.atan2;

const mhypot = Math.hypot;
const msqrt = Math.sqrt;

const cos60 = 0.5;
const sin60 = Math.sqrt(3) / 2;
const cos120 = -0.5;
const sin120 = Math.sqrt(3) / 2;

//-----------------------------------------------------------------------------
// Marihot Hutagaol
//-----------------------------------------------------------------------------

  function alea (min, max) {
    if (typeof max == 'undefined') return min * mrandom();
    return min + (max - min) * mrandom();
  }

  function intAlea (min, max) {
    if (typeof max == 'undefined') {
      max = min; min = 0;
    }
    return mfloor(min + (max - min) * mrandom());
  } 
  function distance (p0, p1) {

    return mhypot (p0[0] - p1[0], p0[1] - p1[1]);

  }

function hashFunction(seed) {
  let n0 = 0xefc8249d;
  let n = n0;
  mash((seed || Math.random()));
  n0 = n;

	function mash(data) {
    data = data.toString() + 'U';
    n = n0;
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      var h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000;
    }
    return (n >>> 0) * 2.3283064365386963e-10;
  }
  return mash;
} 

function Noise1D (period, min = 0, max = 1, hash) {

  let currx, y0, y1;
  let phase = hash(0);

  return function(x) {
    let xx = x / period + phase;
    let intx = mfloor(xx);

    if (intx - 1 === currx) {
      ++currx;
      y0 = y1;
      y1 = min + (max - min) * hash(currx + 1);
    } else if (intx !== currx) {
      currx = intx;
      y0 = min + (max - min) * hash(currx);
      y1 = min + (max - min) * hash(currx + 1);
    }
    let frac = xx - currx;
    let z = (3 - 2 * frac) * frac * frac;
    return z * y1 + (1 - z) * y0;
  }
} 
let vertexSource = `
attribute vec2 position;


void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

let fragmentSource = `

  precision mediump float;

#define ORDER ${2 * ORDER}

  uniform float width;
  uniform float height;
  uniform int casergb;
  uniform vec2 p[ORDER];
  uniform float aeq1, beq1, aeq2, beq2;

  vec2 iResolution;
  vec2 z, znum, zden;

vec2 mult(vec2 z1, vec2 z2) {
  return vec2(z1.x * z2.x - z1.y * z2.y, z1.x * z2.y + z1.y * z2.x);
} // dmult

vec2 div( vec2 z1, vec2 z2) {
  return vec2(z1.x * z2.x + z1.y * z2.y, z1.y * z2.x - z1.x * z2.y) / (z2.x * z2.x + z2.y * z2.y);
} // div

void main(){

  iResolution = vec2(width, height);
  float r,g,b;
    vec3 rgb;

// z = -1...+1 on shortest dimension

  z = (gl_FragCoord.xy - 0.5 * iResolution ) / min(width, height) * 2.0 ;

// calculate (z-p1) * (z-p2) * (z-p5) / (z-p3) / (z-p4) / (z-p6)

  znum = z - p[0];
  zden = z - p[1];
  for (int k = 2; k < ORDER; k += 2) {
    znum = mult(znum, z - p[k]);
    zden = mult(zden, z - p[k + 1]);
  }
  z = div(znum, zden);

  b = atan(z.x + length(z), z.y) / 3.14159265; // thanks to wikipedia!
  r = mod(log(length(z))/4.0 + 0.5,1.0);
  g = mod(log(length(z))/6.0,1.0);

  if (casergb == 0) rgb = vec3(r,g,b);
  else if (casergb == 1) rgb = vec3(r,b,g);
  else if (casergb == 2) rgb = vec3(g,r,b);
  else if (casergb == 3) rgb = vec3(g,b,r);
  else if (casergb == 4) rgb = vec3(b,r,g);
  else rgb = vec3(b,g,r);

  rgb = min(aeq1 * rgb + beq1, aeq2 * rgb + beq2);
   rgb = max(vec3(0.0), rgb);
  rgb = rgb * rgb ;

  gl_FragColor = vec4(rgb, 1.0);
}
`;

function compileShader(shaderSource, shaderType){
  let shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
  	throw "Kompilasi shader gagal: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

function getAttribLocation(program, name) {
  let attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Tidak dapat menemukan atribut ' + name + '.';
  }
  return attributeLocation;
}

function getUniformLocation(program, name) {
  let attributeLocation = gl.getUniformLocation(program, name);
  if (attributeLocation === null) {
  	throw 'Tidak dapat menemukan uniform ' + name + '.';
  }
  return attributeLocation;
}

function animate() {}
animate = (function() {

let startTime;

return function(tStamp){

  let dt;
  let x,y, xtmp;

  if (animState == 0 && startOver()) {
    ++animState;
    startTime = tStamp;
  }

  switch (animState) {

    case 1 :
      dt = tStamp - startTime;
      let dk1 = 4 * ORDER / 6;
      let dk2 = 8 * ORDER / 6;
      let dk3 = 12 * ORDER / 6;
      let dk4 = 16 * ORDER / 6;
      let dk5 = 20 * ORDER / 6;
      for (let k = 0; k < 2 * ORDER / 6; ++k) {
        let pp = [f[k][0](dt), f[k][1](dt)];
        x = p[2 * k] = pp[0];
        y = p[2 * k + 1] = pp[1];
        p[2 * k + dk1] = xtmp = x * cos60 + y * sin60;
        p[2 * k + dk1 + 1] = y = - x * sin60 + y * cos60;
        x = xtmp;
        p[2 * k + dk2] = xtmp = x * cos60 + y * sin60;
        p[2 * k + dk2 + 1] = y = - x * sin60 + y * cos60;
        x = xtmp;
        p[2 * k + dk3] = xtmp = x * cos60 + y * sin60;
        p[2 * k + dk3 + 1] = y = - x * sin60 + y * cos60;
        x = xtmp;
        p[2 * k + dk4] = xtmp = x * cos60 + y * sin60;
        p[2 * k + dk4 + 1] = y = - x * sin60 + y * cos60;
        x = xtmp;
        p[2 * k + dk5] = x * cos60 + y * sin60;
        p[2 * k + dk5 + 1] = - x * sin60 + y * cos60;

      }
      gl.uniform2fv(pHandle,p);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      break;
  }

  requestAnimationFrame(animate);

}
})();

//-----------------------------------------------------------------------------
// Marihot Hutagaol
//-----------------------------------------------------------------------------

function startOver() {

  maxx = window.innerWidth;
  maxy = window.innerHeight;
  canv.width = maxx;
  canv.height = maxy;
  if (mmin (maxx, maxy) < 100) return false;

  mouseMove({clientX:maxx/2, clientY:maxy/2});

  canv.style.left = (window.innerWidth - maxx) / 2 + 'px';
  canv.style.top = (window.innerHeight - maxy) / 2 + 'px';

  midx = window.innerWidth / 2;
  midy = window.innerHeight / 2;

  gl.viewport(0, 0, maxx, maxy);

  gl.uniform1f(widthHandle, maxx);
  gl.uniform1f(heightHandle, maxy);

  f = [];
  for (let k = 0 ; k < 2 * ORDER; ++k) {
    f[k] = noise2D();
  }

  gl.uniform1i(casergbHandle, mfloor(6 * Math.random()));

  return true;

  function noise2D() {
    return [Noise1D(alea(10000, 20000),-1,1,hashFunction()),
            Noise1D(alea(10000, 20000),-1,1,hashFunction())];
  }

}
function initShadersStuff() {

  let vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
  let fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.useProgram(program);

  let vertexData = new Float32Array([
    -1.0,  1.0,
    -1.0, -1.0, 
     1.0,  1.0,
     1.0, -1.0,
  ]);

  let vertexDataBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
  let positionHandle = getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionHandle);
  gl.vertexAttribPointer(positionHandle,
    2,
    gl.FLOAT,
    false,
    2 * 4, 
    0
    );

  widthHandle = getUniformLocation(program, 'width');
  heightHandle = getUniformLocation(program, 'height');
  casergbHandle = getUniformLocation(program, 'casergb');
  pHandle = getUniformLocation(program, 'p');
  aeq1Handle = getUniformLocation(program, 'aeq1');
  beq1Handle = getUniformLocation(program, 'beq1');
  aeq2Handle = getUniformLocation(program, 'aeq2');
  beq2Handle = getUniformLocation(program, 'beq2');
}

function mouseMove(event) {

    let x = event.clientX / maxx;
    let y = event.clientY / maxy;

    let A2 = y;
    let A1 = A2 - x;
    let A3 = A2 + x;

    let aeq1 = (1 / (A2 - A1)).toString();
    if (!aeq1.includes(".")) aeq1 += ".0";
    let beq1 = (- A1 / (A2 - A1)).toString();
    if (!beq1.includes(".")) beq1 += ".0";
    let aeq2 = (- 1 / (A3 - A2)).toString();
    if (!aeq2.includes(".")) aeq2 += ".0";
    let beq2 = (A3 / (A3 - A2)).toString();
    if (!beq2.includes(".")) beq2 += ".0";
    gl.uniform1f(aeq1Handle, aeq1);
    gl.uniform1f(beq1Handle, beq1);
    gl.uniform1f(aeq2Handle, aeq2);
    gl.uniform1f(beq2Handle, beq2);
}

  {
    canv = document.createElement('canvas');
    canv.style.position="absolute";
    document.body.appendChild(canv);
    gl = canv.getContext('webgl');
  }

  canv.addEventListener('click', ()=> gl.uniform1i(casergbHandle,mfloor(Math.random() * 6)));

  window.addEventListener('mousemove', mouseMove);
  window.addEventListener('touchmove', event=>mouseMove(event.touches[0]));
  
  initShadersStuff();

  animState = 0;
  requestAnimationFrame(animate);