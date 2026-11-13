from pathlib import Path
from PIL import Image
root=Path('E:/Game/ECHO HERO/art/enemies/boss2')
for clip in ['Walk','Melee','GroundSlam','Charge','WaveRelease']:
 paths=sorted((root/(clip+'-frames')).glob('*.png'))
 frames=[Image.open(p).convert('RGB') for p in paths]
 frames[0].save(root/(clip+'.gif'),save_all=True,append_images=frames[1:],duration=33,loop=0,optimize=True)
 print(clip,len(frames),flush=True)
paths=sorted((root/'integration-qa/combat-frames').glob('*.png'))
if paths:
 frames=[Image.open(p).convert('RGB').resize((768,540),Image.Resampling.LANCZOS) for p in paths]
 frames[0].save(root/'combat-preview.gif',save_all=True,append_images=frames[1:],duration=83,loop=0,optimize=True)
 print('Combat',len(frames),flush=True)
