from PIL import Image
import PIL
import os
import glob


for filename in glob.glob('*.png'):
    if os.path.isfile('./' + filename + '.webp') == False:
        image = Image.open(filename)
        image = image.convert('RGB')
        image.save(filename.replace('.png', '') + '.webp',
                   'webp', optimize=True, quality=12)
        print(filename + ' converted')
        os.remove(filename)

for filename in glob.glob('*.jpeg'):
    if os.path.isfile('./' + filename + '.webp') == False:
        image = Image.open(filename)
        image = image.convert('RGB')
        image.save(filename.replace('.jpeg', '') + '.webp',
                   'webp', optimize=True, quality=12)
        print(filename + ' converted')
        os.remove(filename)

for filename in glob.glob('*.jpg'):
    if os.path.isfile('./' + filename + '.webp') == False:
        image = Image.open(filename)
        image = image.convert('RGB')
        image.save(filename.replace('.jpg', '') + '.webp',
                   'webp', optimize=True, quality=12)
        print(filename + ' converted')
        os.remove(filename)
