import os
from PIL import Image

def compress_and_resize_images(folder_path, output_folder, size=(300, 300), quality=85):
    """
    Compress and resize all images in a folder.

    Args:
        folder_path (str): Path to the input folder containing images.
        output_folder (str): Path to save compressed and resized images.
        size (tuple): New size for the images (width, height).
        quality (int): Quality of the output image (1-100).
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    supported_formats = (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp")

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(supported_formats):
            try:
                input_path = os.path.join(folder_path, filename)
                output_path = os.path.join(output_folder, filename)

                with Image.open(input_path) as img:
                    img = img.convert("RGB")  # Ensure image is in RGB format
                    img = img.resize(size, Image.Resampling.LANCZOS)  # Updated resizing method
                    img.save(output_path, optimize=True, quality=quality)  # Compress and save

                print(f"Processed: {filename}")

            except Exception as e:
                print(f"Failed to process {filename}: {e}")

# Usage
folder_path = "profile_pics"
output_folder = "profile_picsx"
compress_and_resize_images(folder_path, output_folder)
