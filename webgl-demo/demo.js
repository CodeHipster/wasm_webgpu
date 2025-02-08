var canvas = document.getElementById("c");
var gl = canvas.getContext("webgl");
if (!gl) {
    alert("no WebGL");
    //return;
}

var colors = [];
var verts = [];
var theta=0 
for(var radius=160.0; radius>1.0; radius-=0.3) {
    colors.push(radius/160.0, 0.3, 1-(radius/160.0));
    verts.push(radius*Math.cos(theta),radius*Math.sin(theta));
    theta+=0.1;
}
var numPoints = colors.length / 3;

var colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

var vertBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

var program = twgl.createProgramFromScripts(gl, ["vshader", "fshader"]);
gl.useProgram(program);

// look up the locations for the inputs to our shaders.
var u_matLoc = gl.getUniformLocation(program, "u_matrix");
var colorLoc = gl.getAttribLocation(program, "a_color");
var vertLoc = gl.getAttribLocation(program, "a_vertex");

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    
 // Set the matrix to some that makes 1 unit 1 pixel.
gl.uniformMatrix4fv(u_matLoc, false, [
    2 / canvas.width, 0, 0, 0,
    0, -2 / canvas.height, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    gl.vertexAttribPointer(vertLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertLoc);
    
    gl.drawArrays(gl.POINTS, 0, numPoints);
    
    requestAnimationFrame(draw, canvas);
}

draw();