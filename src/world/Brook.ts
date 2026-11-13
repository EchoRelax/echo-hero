import * as T from 'three'

const center = new T.Vector2(-8.7, 4.3)
const radius = new T.Vector2(4.05, 2.55)

function basin(scale: number) {
  const contour = new T.Shape()
  for (let i = 0; i < 36; i++) {
    const angle = i / 36 * Math.PI * 2
    const shape = scale * (1 + Math.sin(angle * 3 + 0.3) * 0.10 + Math.sin(angle * 5 - 0.6) * 0.052)
    const x = Math.cos(angle) * radius.x * shape
    const z = Math.sin(angle) * radius.y * shape
    if (i === 0) contour.moveTo(x, -z)
    else contour.lineTo(x, -z)
  }
  contour.closePath()
  return new T.ShapeGeometry(contour).rotateX(-Math.PI / 2)
}

export class Brook {
  private uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, {
    time: { value: 0 },
    basinRadius: { value: radius },
    shallow: { value: new T.Color('#65e8df') },
    deep: { value: new T.Color('#28aee2') },
    foam: { value: new T.Color('#c2ffff') },
  }])

  constructor(scene: T.Scene, block: (x: number, z: number, radius: number) => void) {
    const shore = new T.Mesh(basin(1.19), new T.MeshStandardMaterial({ color: '#f2cf8e', roughness: 1 }))
    shore.position.set(center.x, 0.017, center.y)
    const surface = new T.Mesh(basin(1), new T.ShaderMaterial({
      uniforms: this.uniforms, fog: true,
      vertexShader: `
        varying vec2 water;
        #include <fog_pars_vertex>
        void main() {
          water = position.xz;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        varying vec2 water;
        uniform vec2 basinRadius;
        uniform vec3 shallow;
        uniform vec3 deep;
        uniform vec3 foam;
        uniform float time;
        #include <fog_pars_fragment>
        void main() {
          float edge = length(water / basinRadius);
          vec2 p = water + vec2(sin(water.y * 2.6 - time * 0.7), cos(water.x * 2.2 + time * 0.8)) * 0.18;
          float line1 = abs(sin((p.x + p.y * 0.65) * 3.3 + time * 0.50));
          float line2 = abs(sin((p.y - p.x * 0.53) * 3.8 - time * 0.33));
          float lines = 1.0 - smoothstep(0.035, 0.23, min(line1, line2));
          float shore = smoothstep(0.55, 0.95, edge);
          vec3 color = mix(deep, shallow, shore);
          color = mix(color, foam, lines * (0.14 + 0.11 * shore));
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    }))
    surface.position.set(center.x, 0.028, center.y)
    scene.add(shore, surface)
    for (const dx of [-2.2, 0, 2.2]) block(center.x + dx, center.y, dx === 0 ? 2.38 : 1.69)

    const stone = new T.DodecahedronGeometry(1)
    const rock = new T.MeshStandardMaterial({ color: '#829b9b', flatShading: true })
    const bank = new T.InstancedMesh(stone, rock, 13)
    const transform = new T.Object3D()
    for (let i = 0; i < bank.count; i++) {
      const angle = 0.44 + i * 2.399
      const size = 0.16 + i % 4 * 0.071
      transform.position.set(center.x + Math.cos(angle) * radius.x * 1.13, size * 0.38, center.y + Math.sin(angle) * radius.y * 1.12)
      transform.rotation.set(0.16, i * 0.89, 0)
      transform.scale.set(size * 1.32, size * 0.70, size)
      transform.updateMatrix()
      bank.setMatrixAt(i, transform.matrix)
    }
    scene.add(bank)
  }

  update(dt: number) {
    this.uniforms.time.value += dt
  }
}
