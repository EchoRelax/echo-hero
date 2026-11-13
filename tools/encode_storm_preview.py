from pathlib import Path
from PIL import Image
root=Path('E:/Game/ECHO HERO/art/enemies/storm')
paths=sorted((root/'integration-qa/combat-frames').glob('*.png'))
assert paths,'Record the combat preview with ECHO_RECORD_PREVIEW=1 first'
frames=[Image.open(p).convert('RGB').resize((768,540),Image.Resampling.LANCZOS) for p in paths]
frames[0].save(root/'combat-preview.gif',save_all=True,append_images=frames[1:],duration=83,loop=0,optimize=True)
print('Encoded storm preview',len(frames),flush=True)
