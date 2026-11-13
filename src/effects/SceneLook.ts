import * as T from 'three'
import { zones, zoneAt } from '../config/zones'

const viewport = new T.Vector2(1, 1)
const shadowGeometry = new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
const matrix = new T.Object3D()

function shadowTexture() {
  const size = 32
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1)
      const index = (y * size + x) * 4
      pixels.fill(255, index, index + 3)
      pixels[index + 3] = Math.round((1 - T.MathUtils.smoothstep(distance, 0.51, 0.98)) * 255)
    }
  }
  const texture = new T.DataTexture(pixels, size, size)
  texture.minFilter = texture.magFilter = T.LinearFilter
  texture.needsUpdate = true
  return texture
}

const map = shadowTexture()
const contact = new T.MeshBasicMaterial({ color: '#243044', map, transparent: true, opacity: 0.36, depthWrite: false })
const projection = new T.MeshBasicMaterial({ color: '#334a55', map, transparent: true, opacity: 0.31, depthWrite: false })

export function contactShadow(radius: number) {
  const shadow = new T.Mesh(shadowGeometry, contact)
  shadow.position.set(0.06, 0.026, 0.04)
  shadow.scale.set(radius, 1, radius * 0.69)
  return shadow
}

interface ShadowStamp { x: number; z: number; span: number; width: number; yaw: number; groundY: number }

export class SceneryShadows {
  private stamps: ShadowStamp[][] = zones.map(() => [])

  cast(x: number, z: number, width: number, height: number, groundY = .012) {
    const offset = height * 0.37
    this.stamps[zones.indexOf(zoneAt(x, z))].push({
      x: x + offset * 0.75, z: z + offset * 0.55,
      span: width + offset, width, yaw: -0.66, groundY,
    })
  }

  addTo(scene: T.Scene) {
    for (const stamps of this.stamps) {
      const batch = new T.InstancedMesh(shadowGeometry, projection, stamps.length)
      stamps.forEach(({ x, z, span, width, yaw, groundY }, i) => {
        matrix.position.set(x, groundY, z)
        matrix.rotation.set(0, yaw, 0)
        matrix.scale.set(span, 1, width)
        matrix.updateMatrix()
        batch.setMatrixAt(i, matrix.matrix)
      })
      scene.add(batch)
    }
  }
}

function lineMaterial(color: string, width: number) {
  const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { ink: { value: new T.Color(color) }, width: { value: width } }])
  uniforms.viewport = { value: viewport }
  return new T.ShaderMaterial({
    uniforms, side: T.BackSide, fog: true,
    vertexShader: `
      uniform vec2 viewport;
      uniform float width;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * mvPosition;
        vec2 edge = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy * viewport;
        clip.xy += edge / max(length(edge), 0.001) * (2.0 * width / viewport) * clip.w;
        gl_Position = clip;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 ink;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(ink, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  })
}

const heroInk = lineMaterial('#25303b', 1.42)
const enemyInk = lineMaterial('#303746', 1.15)

export function resizeLook(width: number, height: number) {
  viewport.set(width, height)
}

export function contour(mesh: T.Mesh, hero = false) {
  mesh.add(new T.Mesh(mesh.geometry, hero ? heroInk : enemyInk))
}
