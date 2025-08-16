# Create backing tracks for your open mic or karaoke night

I perform in open mics in my spare time. With the setup in this repo
I create a backing track that doesn’t have either the voice or the guitar,
that way, I can play it on the background while I sing and play the guitar.

Read https://mauriciopoppe.com/notes/backing-track-for-open-mic/ for more info
about this workflow.

## Split a song into tracks

Download the dependencies (yt-dlp and demucs) with the following:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Split a song into tracks:

```bash
# Read the script before running these commands!
chmod +x split-song.sh
./split-song.sh -v <youtube-video-url>

# The output is at ./separated/htdemucs_6s/
```

## Known errors

### `ERROR: unable to download video data: HTTP Error 403: Forbidden`

Check the latest release in https://github.com/yt-dlp/yt-dlp/releases, update the
entry in `requirements.txt` and reinstall the dependencies.
