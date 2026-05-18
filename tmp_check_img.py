from PIL import Image
img = Image.open('/tmp/info_screen.png')
print('Size:', img.size)
print('Mode:', img.mode)
