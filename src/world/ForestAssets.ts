import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

export class ForestAssets {
  static treant: GLTF
  static roots: T.Group

  static async preload() {
    const loader = new GLTFLoader()
    const [boss, roots] = await Promise.all(['boss1', 'roots'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb?v=forest-1`)))
    this.treant = boss
    this.roots = roots.scene
  }

}
