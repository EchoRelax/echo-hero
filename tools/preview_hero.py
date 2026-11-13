import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(r'E:\Game\ECHO HERO')
bpy.ops.wm.open_mainfile(filepath=str(root/'art/hero/hero-rig.blend'))
rig=bpy.data.objects['Hero_Rig'];scene=bpy.context.scene
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(root/'public/models/sword.glb'))
socket=bpy.data.objects['SwordSocket']
for obj in set(bpy.data.objects)-before:
 if obj.parent is None:
  bind=obj.matrix_world.copy()
  obj.parent=socket
  obj.matrix_parent_inverse.identity()
  obj.matrix_basis=bind

for track in rig.animation_data.nla_tracks:track.mute=True
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='TEXTURE'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.cavity_type='BOTH'
scene.display.shading.background_type='WORLD'
scene.world=bpy.data.worlds.new('PreviewWorld')
scene.world.color=(.13,.16,.19)
for m in bpy.data.materials:
 if m.use_nodes:
  node=next((n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name and 'metallic' not in n.image.name),None)
  if node:m.node_tree.nodes.active=node
camdata=bpy.data.cameras.new('PreviewCamera');cam=bpy.data.objects.new('PreviewCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(2.8,-6,2.6);target=Vector((0,0,.93));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=2.8
scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for clip,frames in [('Idle',[1]),('Run',[7,19]),('Attack',[10,16,22]),('Hit',[7]),('Death',[37])]:
 rig.animation_data.action=bpy.data.actions[clip]
 for frame in frames:
  scene.frame_set(frame)
  scene.render.filepath=str(root/f'art/hero/{clip.lower()}-{frame}.png')
  bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle']
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/hero/hero-equipped.blend'))
print('Preview renders complete')
