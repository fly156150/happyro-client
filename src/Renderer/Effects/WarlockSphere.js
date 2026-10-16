import WebGL from 'Utils/WebGL.js';
import Texture from 'Utils/Texture.js';
import glMatrix from 'Utils/gl-matrix.js';
import Client from 'Core/Client.js';
import Camera from 'Renderer/Camera.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import Configs from 'Core/Configs.js';
import _vertexShader from './WarlockSphere.vs?raw';
import _fragmentShader from './WarlockSphere.fs?raw';

// Load dependencies
/**
 * @var {WebGLTexture}
 */
let _textures = {};
let _generation = 0;

/**
 * @var {WebGLProgram}
 */
let _program;

/**
 * @var {WebGLBuffer}
 */
let _buffer;

/**
 * @var {mat4}
 */
const mat4 = glMatrix.mat4;

const _rotationMatrices = (function () {
	const matrices = [];
	for (let i = 0; i < 5; i++) {
		matrices.push({
			posMat: mat4.create(),
			texMat: mat4.create()
		});
	}
	return matrices;
})();

const _textureMatrix = mat4.create();

const WLS = {
	FIRE: 68, // WLS_FIRE
	WIND: 69, // WLS_WIND
	WATER: 70, // WLS_WATER
	STONE: 71 // WLS_STONE
};

const SphereFiles = [];
SphereFiles[WLS.FIRE] = 'fireorb.bmp';
SphereFiles[WLS.WIND] = 'lightningorb.bmp';
SphereFiles[WLS.WATER] = 'waterorb.bmp';
SphereFiles[WLS.STONE] = 'stoneorb.bmp';

class WarlockSphere {
	constructor(entity, spheres) {
		this.position = entity.position;
		this.spheres = spheres ? spheres : [];

		this.initialAlpha = 0;
	}

	init(gl) {
		this.ready = true;
	}

	free(gl) {
		this.ready = false;
	}

	static init(gl) {
		const generation = ++_generation;
		_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);
		_buffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([
				-1.0, -1.0, 0.0, 0.0, +1.0, -1.0, 1.0, 0.0, +1.0, +1.0, 1.0, 1.0, +1.0, +1.0, 1.0, 1.0, -1.0, +1.0, 0.0,
				1.0, -1.0, -1.0, 0.0, 0.0
			]),
			gl.STATIC_DRAW
		);

		WarlockSphere.ready = false;
		for (const [element, file] of Object.entries(SphereFiles)) {
			Client.loadFile(`data/texture/effect/${file}`, buffer => {
				Texture.load(buffer, function () {
					if (generation !== _generation) return;
					const texture = gl.createTexture();
					gl.bindTexture(gl.TEXTURE_2D, texture);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					if (Configs.get('enableMipmap')) gl.generateMipmap(gl.TEXTURE_2D);
					_textures[element] = texture;
					WarlockSphere.ready = Object.keys(_textures).length === 4;
				});
			});
		}
	}

	static free(gl) {
		_generation++;
		for (const texture of Object.values(_textures)) gl.deleteTexture(texture);
		_textures = {};

		if (_program) {
			gl.deleteProgram(_program);
			_program = null;
		}

		if (_buffer) {
			gl.deleteBuffer(_buffer);
		}

		this.ready = false;
	}

	static beforeRender(gl, modelView, projection, fog, tick) {
		const uniform = _program.uniform;
		const attribute = _program.attribute;
		gl.useProgram(_program);

		let _matrix, offset;
		for (let i = 0, _len = _rotationMatrices.length; i < _len; i++) {
			const vcRad = ((Camera.angle[0] - 90) * Math.PI) / 180;
			const hcRad = (Camera.angle[1] * Math.PI) / 180;
			offset = (i * 2 * Math.PI) / _rotationMatrices.length;
			const rotRad = offset - (tick / 64 / 180) * Math.PI;

			//_matrix = _rotationMatrices[i].texMat;
			//mat4.identity(_matrix);
			const textureMatrix = mat4.create();
			mat4.rotateX(_rotationMatrices[i].texMat, textureMatrix, vcRad);
			mat4.rotateY(_rotationMatrices[i].texMat, _rotationMatrices[i].texMat, hcRad - rotRad);

			_matrix = _rotationMatrices[i].posMat;
			mat4.identity(_matrix);
			mat4.rotateY(_matrix, _matrix, rotRad);
		}

		// Bind matrix
		gl.uniformMatrix4fv(uniform.uModelViewMat, false, modelView);
		gl.uniformMatrix4fv(uniform.uProjectionMat, false, projection);

		// Texture
		gl.activeTexture(gl.TEXTURE0);
		gl.uniform1i(uniform.uDiffuse, 0);

		// Enable all attributes
		gl.enableVertexAttribArray(attribute.aPosition);
		gl.enableVertexAttribArray(attribute.aTextureCoord);

		gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);

		gl.vertexAttribPointer(attribute.aPosition, 2, gl.FLOAT, false, 4 * 4, 0);
		gl.vertexAttribPointer(attribute.aTextureCoord, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
	}

	render(gl, tick) {
		const uniform = _program.uniform;

		gl.uniform3fv(uniform.uPosition, this.position);

		gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);

		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

		gl.uniform1f(uniform.uCameraZoom, Camera.zoom);

		let _matrix;

		SpriteRenderer.runWithDepth(false, true, false, () => {
			for (let i = this.spheres.length; i > 0; i--) {
				_matrix = _rotationMatrices[i % _rotationMatrices.length];

				gl.uniformMatrix4fv(uniform.uTextureRotMat, false, _matrix.texMat);
				gl.uniformMatrix4fv(uniform.uRotationMat, false, _matrix.posMat);

				gl.bindTexture(gl.TEXTURE_2D, _textures[this.spheres[i - 1]]);
				gl.uniform1f(uniform.uSize, 0.3);
				gl.uniform4fv(uniform.uColor, [1, 1, 1, this.initialAlpha]);
				gl.uniform1f(uniform.uZIndex, 0.02);
				gl.drawArrays(gl.TRIANGLES, 0, 6);
			}
		});

		if (this.initialAlpha < 1) {
			this.initialAlpha = Math.min(this.initialAlpha + 0.005, 1);
		}
	}

	static afterRender(gl) {
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.disableVertexAttribArray(_program.attribute.aPosition);
		gl.disableVertexAttribArray(_program.attribute.aTextureCoord);
	}
}

WarlockSphere.renderBeforeEntities = false;
/**
 * Export
 */
export default WarlockSphere;
