import bpy, math, json, struct, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT
for f in ['01-png','02-models','03-views','04-source/fonts','05-checks']:(OUT/f).mkdir(parents=True,exist_ok=True)
DRAFT='--draft' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for mat in list(bpy.data.materials):bpy.data.materials.remove(mat)
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(code):return tuple(linear(int(code[i:i+2],16)/255) for i in (0,2,4))
def material(name,code):
 m=bpy.data.materials.new(name+' | #'+code);m.diffuse_color=(*rgb(code),1);m.use_nodes=True
 n=m.node_tree.nodes;n.clear();o=n.new('ShaderNodeOutputMaterial');e=n.new('ShaderNodeEmission');e.inputs[0].default_value=m.diffuse_color;m.node_tree.links.new(e.outputs[0],o.inputs['Surface']);return m
amber=material('Contour','F59E0B');accent=material('Task','D97706');face=material('Board','2A2A32');side=material('Side','493A29');top=material('Top','594124');white=material('Wordmark','FAFAF9')
model=bpy.data.collections.new('01 | Planning cube — editable geometry');bpy.context.scene.collection.children.link(model)
def link(obj):model.objects.link(obj);return obj
def mesh(name,verts,faces,mats,indices=None):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=link(bpy.data.objects.new(name,d))
 for m in mats:d.materials.append(m)
 if indices:
  for p,i in zip(d.polygons,indices):p.material_index=i
 return o
def stroke(name,points,r=.028,closed=False,mat=amber):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=1;d.bevel_depth=r;d.bevel_resolution=3;d.use_fill_caps=True
 s=d.splines.new('POLY');s.points.add(len(points)-1)
 for p,co in zip(s.points,points):p.co=(*co,1)
 s.use_cyclic_u=closed;d.materials.append(mat);return link(bpy.data.objects.new(name,d))
def prism(name,profile,near,far,mats):
 n=len(profile);v=[(x,near,z) for x,z in profile]+[(x,far,z) for x,z in profile]
 fs=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(j,j+n,(j+1)%n+n,(j+1)%n) for j in range(n)]
 o=mesh(name,v,fs,mats,[0,1]+[2 if j==2 else 1 for j in range(n)] if len(mats)>1 else None)
 return o,v
# A true cube, with one continuous unwrapped planning axis around its left/front corner.
W=H=D=4.4
L=W;s=L/2
profile=[(-s,0),(s,0),(s,H),(-s,H)]
# Open vertical faces: no charcoal or brown panel underneath the artwork.
# The top is retained; only the nine outline edges visible in the master view are drawn.
verts=[(x,y,z) for y in [-s,s] for x,z in profile]
mesh('Cube | top plane', [(-s,-s,H),(s,-s,H),(s,s,H),(-s,s,H)],[(0,1,2,3)],[top])
stroke('Cube edge | top perimeter',[(-s,-s,H),(s,-s,H),(s,s,H),(-s,s,H)],closed=True)
for i,(x,y) in enumerate([(-s,s),(-s,-s),(s,-s)]):stroke('Cube edge | vertical %d'%i,[(x,y,0),(x,y,H)])
stroke('Cube edge | lower open sides',[(-s,s,0),(-s,-s,0),(s,-s,0)])
def wrap(u,z,depth=.10):
 # Mitered offset surfaces meet at one exact shared corner.
 if abs(u-L)<1e-8:return (-s-depth,-s-depth,z)
 if u<L:return (-s-depth,s-u,z)
 return (u-3*s,-s-depth,z)
def wrapped_path(points,depth=.10):
 result=[]
 for i,(u,z) in enumerate(points):
  if i:
   pu,pz=points[i-1]
   if min(pu,u)<L<max(pu,u):
    f=(L-pu)/(u-pu);result.append(wrap(L,pz+f*(z-pz),depth))
  result.append(wrap(u,z,depth))
 return result
stroke('Timeline | continuous around both faces',wrapped_path([(.40,3.64),(8.40,3.64)],.035),r=.024)
for i,u in enumerate([.9,1.9,2.9,3.9,4.9,5.9,6.9,7.9]):
 stroke('Timeline | tick %d'%i,[wrap(u,3.64,.035),wrap(u,3.89,.035)],r=.024)
tasks=[(.55,2.45,2.95),(5.6,7.25,2.95),(2.85,5.45,2.05),(6.5,8.05,2.05),(.85,2.25,1.15),(5.95,7.75,1.15)]
for i,(a,b,z) in enumerate(tasks):
 us=[a]+([L] if a<L<b else [])+[b]
 # Closed solid L-section for the task that crosses the corner; no overlapping boxes.
 xy=[wrap(u,0,.10)[:2] for u in us]+[wrap(u,0,.002)[:2] for u in reversed(us)]
 n=len(xy);v=[(x,y,zz) for zz in [z-.20,z+.20] for x,y in xy]
 fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
 o=mesh('Task %02d | %s'%(i+1,'continuous corner-wrapped solid' if a<L<b else 'solid Gantt bar'),v,fs,[accent]);o['start_unwrapped']=a;o['finish_unwrapped']=b;o['row_center']=z
 perimeter=[(a,z-.20),(b,z-.20),(b,z+.20),(a,z+.20),(a,z-.20)]
 stroke('Task %02d | continuous perimeter'%(i+1),wrapped_path(perimeter,.105),r=.024)
 if a<L<b:stroke('Task %02d | physical corner fold'%(i+1),[wrap(L,z-.20,.105),wrap(L,z+.20,.105)],r=.024)
def wrapped_plate(name,profile,depth=.105):
 # These small markers lie entirely on one of the two faces.
 n=len(profile);v=[wrap(u,z,d) for d in [depth,depth-.025] for u,z in profile]
 fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
 return mesh(name,v,fs,[amber])
connections=[(0,2,None),(2,5,None)]
for i,(before,after,custom_mid) in enumerate(connections):
 a,b,z=tasks[before];a2,b2,z2=tasks[after];mid=custom_mid or (b+a2)/2
 points=[(b,z),(mid,z),(mid,z2),(a2,z2)] if z!=z2 else [(b,z),(a2,z2)]
 stroke('Dependency %d | finish to start'%(i+1),wrapped_path(points),r=.020)
 wrapped_plate('Dependency %d | arrowhead'%(i+1),[(a2-.10,z2+.065),(a2,z2),(a2-.10,z2-.065)])
u=tasks[-1][1];z=.47;r=.14
stroke('Milestone | finish link',wrapped_path([(u,1.15-.20),(u,z+r)]),r=.022)
wrapped_plate('Milestone | diamond',[(u-r,z),(u,z-r),(u+r,z),(u,z+r)])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
scene.render.dither_intensity=0
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb('2A2A32'),1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=1
bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='Camera | orthographic master';camera.data.type='ORTHO';scene.camera=camera
objects=list(model.objects)
def set_camera(offset,res=(2048,2048),margin=1.24,objs=None):
 camera.location=Vector((0,0,H/2))+Vector(offset);camera.rotation_euler=(-Vector(offset)).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
 q=camera.rotation_euler.to_quaternion();right=q@Vector((1,0,0));up=q@Vector((0,1,0))
 pts=[o.matrix_world@Vector(v) for o in (objs or objects) for v in o.bound_box]
 xx=[p.dot(right) for p in pts];yy=[p.dot(up) for p in pts]
 camera.location+=right*((min(xx)+max(xx))/2-camera.location.dot(right))+up*((min(yy)+max(yy))/2-camera.location.dot(up))
 scene.render.resolution_x,scene.render.resolution_y=res
 aspect=res[0]/res[1];camera.data.ortho_scale=max(max(xx)-min(xx),(max(yy)-min(yy))*aspect)*margin
 bpy.context.view_layer.update()
 return right,up
master_offset=(-12,-12,12)
set_camera(master_offset,res=(1000,1000) if DRAFT else (2048,2048))
scene['design']='Six project tasks on three rows + finish-to-start dependencies + terminal milestone on a cube with the planning chart continuously wrapped around two adjacent faces.'
scene['projection']='Orthographic; parallel physical edges remain parallel in every render.'
scene['palette']='F59E0B / D97706 / 2A2A32 / FAFAF9; open vertical faces; top plane 594124'
bpy.context.preferences.filepaths.save_version=0
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.shading.type='MATERIAL'
def render(path,transparent=False):
 scene.render.film_transparent=transparent;scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
if DRAFT:
 render(OUT/'05-checks/draft.png');sys.exit(0)
# Invariants describe actual geometry, not painted perspective.
assert all(tasks[a][1]<tasks[b][0] for a,b,_ in connections)
assert W==D==H
assert all(0<a<b<2*L and .22<z<H-.22 for a,b,z in tasks)
assert sum(a<L<b for a,b,z in tasks)==1
assert wrap(L,0,.1)==(-s-.1,-s-.1,0)
assert all((Vector(verts[i+4])-Vector(verts[i])-Vector((0,D,0))).length<1e-6 for i in range(4))
checks={'orthographic':camera.data.type=='ORTHO','board_dimensions':[W,D,H],'task_intervals':tasks,'finish_to_start_positive_lag':True,'all_tasks_inside_board':True,'depth_edges_parallel_equal':True,'cube_all_dimensions_equal':True,'one_single_closed_corner_task':True,'task_count':6,'vertical_faces_open_transparent':True,'timeline_crosses_shared_corner':True,'task_axis_unwrapped_length':2*L,'emission_materials_no_lighting_gradient':True,'master_camera_offset':master_offset}
(OUT/'05-checks/geometry.json').write_text(json.dumps(checks,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'02-models/open-planner-studio.blend'))
render(OUT/'01-png/open-planner-studio-symbol-dark.png')
render(OUT/'01-png/open-planner-studio-symbol-transparent.png',True)
for name,offset in [('front',(0,-18,0)),('back',(0,18,0)),('left',(-18,0,0)),('right',(18,0,0)),('top',(0,0,18)),('rear-isometric',(9,14,8))]:
 set_camera(offset,res=(1200,1200),margin=1.18);render(OUT/('03-views/'+name+'.png'))
set_camera(master_offset)
# Portable GLB from evaluated mesh copies. Authoring curves remain untouched.
def export_glb(path,items):
 gltf={'asset':{'version':'2.0','generator':'Open Planner Studio deterministic Blender builder'},'extensionsUsed':['KHR_materials_unlit'],'extensionsRequired':['KHR_materials_unlit'],'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'buffers':[{}],'bufferViews':[],'accessors':[]};binary=bytearray();materials=list(bpy.data.materials)
 for m in materials:gltf['materials'].append({'name':m.name,'pbrMetallicRoughness':{'baseColorFactor':list(m.diffuse_color),'metallicFactor':0,'roughnessFactor':1},'extensions':{'KHR_materials_unlit':{}},'doubleSided':True})
 def accessor(values,vector=False):
  while len(binary)%4:binary.append(0)
  start=len(binary);flat=[v for row in values for v in row] if vector else values;binary.extend(struct.pack('<%d%s'%(len(flat),'f' if vector else 'I'),*flat));vi=len(gltf['bufferViews']);gltf['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start,'target':34962 if vector else 34963})
  acc={'bufferView':vi,'componentType':5126 if vector else 5125,'count':len(values),'type':'VEC3' if vector else 'SCALAR'}
  if vector:acc.update(min=[min(r[i] for r in values) for i in range(3)],max=[max(r[i] for r in values) for i in range(3)])
  gltf['accessors'].append(acc);return len(gltf['accessors'])-1
 dg=bpy.context.evaluated_depsgraph_get()
 for obj in items:
  ev=obj.evaluated_get(dg);data=ev.to_mesh();data.calc_loop_triangles();points=[]
  for v in data.vertices:
   co=obj.matrix_world@v.co;points.append((co.x,co.z,-co.y))
  pos=accessor(points,True);prims=[]
  for mi,m in enumerate(data.materials):
   inds=[i for t in data.loop_triangles if t.material_index==mi for i in t.vertices]
   if inds:prims.append({'attributes':{'POSITION':pos},'indices':accessor(inds),'material':[mat.name for mat in materials].index(m.name),'mode':4})
  gltf['scenes'][0]['nodes'].append(len(gltf['nodes']));gltf['nodes'].append({'name':obj.name,'mesh':len(gltf['meshes'])});gltf['meshes'].append({'name':obj.name,'primitives':prims});ev.to_mesh_clear()
 gltf['buffers'][0]['byteLength']=len(binary);js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
 with path.open('wb') as f:f.write(struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary)));f.write(struct.pack('<I4s',len(js),b'JSON'));f.write(js);f.write(struct.pack('<I4s',len(binary),b'BIN\0'));f.write(binary)
export_glb(OUT/'02-models/open-planner-studio.glb',objects)
# Text remains editable FONT objects and uses the reference family and weights.
origin=camera.location.copy();q=camera.rotation_euler.to_quaternion();right=q@Vector((1,0,0));up=q@Vector((0,1,0));forward=q@Vector((0,0,-1))
def bounds(objs):
 pts=[o.matrix_world@Vector(v)-origin for o in objs for v in o.bound_box];return min(p.dot(right) for p in pts),max(p.dot(right) for p in pts),min(p.dot(up) for p in pts),max(p.dot(up) for p in pts)
fonts=ROOT/'04-source/fonts';bold=bpy.data.fonts.load(str(fonts/'SpaceGrotesk-700.ttf'));medium=bpy.data.fonts.load(str(fonts/'SpaceGrotesk-500.ttf'))
words=bpy.data.collections.new('02 | Wordmark — editable text');scene.collection.children.link(words)
def text(name,body,x,y,size,font,mat,spacing=1):
 d=bpy.data.curves.new(name,'FONT');d.body=body;d.font=font;d.size=size;d.space_character=spacing;d.resolution_u=24;d.materials.append(mat)
 o=bpy.data.objects.new(name,d);words.objects.link(o);o.location=origin+forward*12+right*x+up*y;o.rotation_euler=camera.rotation_euler;bpy.context.view_layer.update();return o
x=bounds(objects)[1]+.72
op=text('Wordmark | Open','Open',x,0,1.70,bold,white)
pl=text('Wordmark | Planner','Planner',bounds([op])[1]+.27,0,1.70,bold,accent)
st=text('Wordmark | STUDIO','STUDIO',x+.04,-1.02,.65,medium,white,1.7)
all_objects=objects+[op,pl,st];l,r,b,t=bounds(all_objects)
scene.render.resolution_x=3600;scene.render.resolution_y=1440
camera.location=origin+right*((l+r)/2)+up*((b+t)/2);camera.data.ortho_scale=max(r-l,(t-b)*2.5)*1.16
scene.render.film_transparent=False;scene['wordmark']='Open Planner / STUDIO | Space Grotesk 700 / 500';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'02-models/open-planner-studio-wordmark.blend'))
render(OUT/'01-png/open-planner-studio-wordmark-dark.png');render(OUT/'01-png/open-planner-studio-wordmark-transparent.png',True)
export_glb(OUT/'02-models/open-planner-studio-wordmark.glb',all_objects)
print('PLANNER_PACKAGE_RENDER_COMPLETE')
