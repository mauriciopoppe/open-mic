# Create backing tracks for your open mic or karaoke night

I perform in open mics in my spare time, when I decide to perform a cover of a song
I usually play the guitar as well as singing it.
Therefore, I create a backing track for the song that doesn’t have either the voice or the guitar,
that way, I can play it on the background while I sing and play the guitar.

Read https://mauriciopoppe.com/notes/backing-track-for-open-mic/ for more info
about how to create a backing track.

## Automated setup

Please also read `split-track.sh` for an automated script that runs the
two commands run in the article above.

```bash
# Read the script before running these commands!
chmod +x split-track.sh
./split-track.sh -v <youtube-video-url>
```

## Known errors

### `ERROR: unable to download video data: HTTP Error 403: Forbidden`

Check the latest release in https://github.com/yt-dlp/yt-dlp/releases, update the
entry in `requirements.txt` and reinstall the dependencies.
