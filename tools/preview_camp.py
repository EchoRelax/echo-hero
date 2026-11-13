import bpy,json
from pathlib import Path
from mathutils import Vector
r=Path(r'E:/Game/ECHO HERO/art/forest');d=json.loads((r/'camp-geometry.json').read_text());p=d['positions'];colors=d['colors'];verts=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
bpy.ops.wm.read_factory_settings(use_empty=True);mesh=bpy.data.meshes.new('Tree');mesh.from_pydata(verts,[],[tuple(range(i,i+3)) for i in range(0,len(verts),3)]);o=bpy.data.objects.new('Tree',mesh);bpy.context.collection.objects.link(o)
a=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for loop in mesh.loops:
 i=loop.vertex_index*3;a.data[loop.index].color=(*colors[i:i+3],1)
s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='VERTEX';s.display.shading.light='STUDIO';s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH';s.world=bpy.data.worlds.new('World');s.world.color=(.06,.075,.09)
bpy.ops.object.camera_add(location=(9,-15,19));c=bpy.context.object;c.rotation_euler=(Vector((0,0,0))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=21.5;s.camera=c;s.render.resolution_x=960;s.render.resolution_y=960;s.render.resolution_percentage=100;s.render.filepath=str(r/'camp-preview.png');bpy.ops.render.render(write_still=True)
