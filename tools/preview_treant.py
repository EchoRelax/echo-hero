import bpy
from pathlib import Path
from mathutils import Vector
R=Path(r'E:/Game/ECHO HERO');bpy.ops.wm.open_mainfile(filepath=str(R/'art/forest/treant-rig.blend'));s=bpy.context.scene;rig=bpy.data.objects['TreantRig']
s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='TEXTURE';s.display.shading.light='STUDIO';s.world=bpy.data.worlds.new('Preview');s.world.color=(.13,.16,.19)
for m in bpy.data.materials:
 if m.use_nodes:
  ns=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name and 'metallic' not in n.image.name]
  if ns:m.node_tree.nodes.active=ns[0]
bpy.ops.object.camera_add(location=(3,-7,3.8));c=bpy.context.object;c.rotation_euler=(Vector((0,0,1.4))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=4.6;s.camera=c;s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100
for name,frames in [('Walk',[10,28]),('Melee',[19,23]),('Cast',[28,34])]:
 rig.animation_data.action=bpy.data.actions[name]
 for f in frames:
  s.frame_set(f);s.render.filepath=str(R/f'art/forest/{name}-{f}.png');bpy.ops.render.render(write_still=True)
