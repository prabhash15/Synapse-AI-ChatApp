
async def generate_thumbnail(url):
    
    import yt_dlp
    import requests

    ydl_opts = {
        'quiet': True,
        'skip_download': True,  # we don't wanna download the video
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
    response = requests.get(info['thumbnail'])
    return {
        "type":"thumbnail",
        "title": info['title'],
        "data":  list(response.content),
    }
    
    
    