from pathlib import Path
from PIL import Image
root=Path('E:/Game/ECHO HERO/art/enemies')
for clip in ['walk','attack']:
 frames=[Image.open(p).convert('RGB') for p in sorted((root/f'golem-{clip}-frames').glob('*.png'))]
 frames[0].save(root/f'golem-{clip}.gif',save_all=True,append_images=frames[1:],duration=[33,33,34]*(len(frames)//3)+[33]*(len(frames)%3),loop=0,optimize=True)
 print(clip,len(frames),flush=True)
