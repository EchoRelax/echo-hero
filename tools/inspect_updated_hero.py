import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'E:/Game/ECHO HERO/art/hero/hero-updated-original.glb')
o=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
o.scale=(1.85/o.dimensions.z,)*3;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
print('BOUNDS',[(min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)) for i in range(3)])
s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='TEXTURE';s.display.shading.light='STUDIO';s.world=bpy.data.worlds.new('World');s.world.color=(.13,.16,.19)
for m in bpy.data.materials:
 if m.use_nodes:
  ns=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name and 'metallic' not in n.image.name]
  if ns:m.node_tree.nodes.active=ns[0]
bpy.ops.object.camera_add(location=(2.8,-6,2.6));c=bpy.context.object;c.rotation_euler=(Vector((0,0,.93))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=2.8;s.camera=c
s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.filepath=r'E:/Game/ECHO HERO/art/hero/updated-source.png';bpy.ops.render.render(write_still=True)
