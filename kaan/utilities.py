import os,uuid

def random_filename(old_filename):
    ext = os.path.splitext(old_filename)[1]
    new_filename = uuid.uuid4().hex + ext
    return new_filename


def random_foldername():
    new_foldername = uuid.uuid4().hex
    return new_foldername
