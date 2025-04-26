

async def download(url):
    
    import yt_dlp
    import io 
    import subprocess
    
    buffer = io.BytesIO()
    ydl_opts = {
        
        "retries": 10,
        "fragment_retries": 10,
        'format': 'bestaudio/best',
        'outtmpl': '-',
        'quiet': False,
        'no_warnings': False,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
        }],
        'outtmpl': '-',  # this makes it pipe to stdout
        
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.extract_info(url, download=False)
        audio_url = result['url']

        # Use ffmpeg to fetch and convert the stream to mp3 binary
        process = subprocess.Popen(
            ['ffmpeg', '-i', audio_url, '-f', 'mp3', '-'],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )

        audio_data, _ = process.communicate()
        buffer.write(audio_data)
        buffer.seek(0)

    return {
        
        "type":"audio_binary",
        "data": buffer.read(),
    }



